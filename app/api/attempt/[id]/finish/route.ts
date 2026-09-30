import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db/client";
import { attempts, contents, topics, learnerProfile, answers, questions } from "@/lib/db/schema";
import { eq, and, sql } from "drizzle-orm";
import { calculateAttemptXp, computeLevelInfo, calculateStreakUpdate } from "@/lib/grading";

export async function POST(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const attemptId = params.id;

    const attempt = await db
      .select()
      .from(attempts)
      .where(eq(attempts.id, attemptId))
      .get();

    if (!attempt) {
      return NextResponse.json({ error: "Attempt not found" }, { status: 404 });
    }

    const content = await db
      .select()
      .from(contents)
      .where(eq(contents.id, attempt.contentId))
      .get();

    if (!content) {
      return NextResponse.json({ error: "Content not found" }, { status: 404 });
    }

    const topic = await db
      .select()
      .from(topics)
      .where(eq(topics.id, content.topicId))
      .get();

    // Check if first-time topic attempt
    const priorAttemptsOnContent = await db
      .select()
      .from(attempts)
      .where(and(eq(attempts.contentId, attempt.contentId), sql`finished_at IS NOT NULL`))
      .all();

    const isFirstTimeTopic = priorAttemptsOnContent.length === 0;

    // Calculate XP
    const xpBreakdown = calculateAttemptXp({
      score: attempt.score,
      totalQuestions: attempt.nQuestions,
      isFirstTimeTopic,
    });

    // Mark attempt completed
    await db
      .update(attempts)
      .set({
        finishedAt: new Date().toISOString(),
        totalXpEarned: xpBreakdown.totalXp,
      })
      .where(eq(attempts.id, attemptId));

    // Update topic lastStudiedAt
    await db
      .update(topics)
      .set({ lastStudiedAt: new Date().toISOString() })
      .where(eq(topics.id, content.topicId));

    // Update or initialize Learner Profile
    let profile = await db
      .select()
      .from(learnerProfile)
      .where(eq(learnerProfile.learnerId, 1))
      .get();

    if (!profile) {
      await db.insert(learnerProfile).values({
        id: `prof_${crypto.randomUUID()}`,
        learnerId: 1,
        totalXp: 0,
        level: 1,
        streakDays: 0,
        lastActiveDate: null,
      });
      profile = await db
        .select()
        .from(learnerProfile)
        .where(eq(learnerProfile.learnerId, 1))
        .get();
    }

    const newTotalXp = (profile?.totalXp || 0) + xpBreakdown.totalXp;
    const streakUpdate = calculateStreakUpdate(profile?.lastActiveDate);
    const levelInfo = computeLevelInfo(newTotalXp);

    await db
      .update(learnerProfile)
      .set({
        totalXp: newTotalXp,
        level: levelInfo.level,
        streakDays: streakUpdate.streakDays,
        lastActiveDate: streakUpdate.lastActiveDate,
        updatedAt: new Date().toISOString(),
      })
      .where(eq(learnerProfile.learnerId, 1));

    // Gather per-question summary review for the student
    const attemptAnswers = await db
      .select()
      .from(answers)
      .where(eq(answers.attemptId, attemptId))
      .all();

    const reviewQuestions = [];
    for (const ans of attemptAnswers) {
      const q = await db
        .select()
        .from(questions)
        .where(eq(questions.id, ans.questionId))
        .get();
      if (q) {
        let opts: string[] = [];
        try {
          opts = JSON.parse(q.optionsJson);
        } catch {
          opts = [];
        }
        reviewQuestions.push({
          questionId: q.id,
          stem: q.stem,
          options: opts,
          chosenIdx: ans.chosenIdx,
          correctIdx: q.correctIdx,
          isCorrect: ans.correct,
          explanation: q.explanation,
        });
      }
    }

    let followups: string[] = [];
    try {
      if (content.followupsJson) {
        followups = JSON.parse(content.followupsJson);
      }
    } catch {
      followups = [];
    }

    return NextResponse.json({
      attemptId,
      score: attempt.score,
      totalQuestions: attempt.nQuestions,
      xpEarned: xpBreakdown,
      lessonText: content.lessonText,
      sourceUrl: content.sourceUrl,
      topicTitle: topic ? topic.name : "History Challenge",
      followups,
      reviewQuestions,
      playerState: {
        totalXp: newTotalXp,
        level: levelInfo.level,
        currentLevelXp: levelInfo.currentLevelXp,
        nextLevelXp: levelInfo.nextLevelXp,
        progressPercent: levelInfo.progressPercent,
        streakDays: streakUpdate.streakDays,
      },
    });
  } catch (error: any) {
    console.error("Finalize attempt error:", error);
    return NextResponse.json({ error: "Failed to finalize attempt" }, { status: 500 });
  }
}
