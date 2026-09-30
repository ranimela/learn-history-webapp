import { NextRequest, NextResponse } from "next/server";
import { db, ensureTablesExist } from "@/lib/db/client";
import { learnerProfile, topics, contents, attempts } from "@/lib/db/schema";
import { eq, desc, sql } from "drizzle-orm";
import { computeLevelInfo } from "@/lib/grading";

export async function GET(_req: NextRequest) {
  try {
    await ensureTablesExist();

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

    const totalXp = profile?.totalXp || 0;
    const levelInfo = computeLevelInfo(totalXp);

    // Get recent topics with contentId
    const recentTopics = await db
      .select({
        id: topics.id,
        name: topics.name,
        wikiTitle: topics.wikiTitle,
        lastStudiedAt: topics.lastStudiedAt,
        contentId: contents.id,
      })
      .from(topics)
      .leftJoin(contents, eq(topics.id, contents.topicId))
      .orderBy(desc(topics.lastStudiedAt))
      .limit(6)
      .all();

    // Query battle history log of finished attempts
    const battleLog = await db
      .select({
        attemptId: attempts.id,
        contentId: attempts.contentId,
        topicName: topics.name,
        score: attempts.score,
        nQuestions: attempts.nQuestions,
        difficulty: attempts.difficulty,
        totalXpEarned: attempts.totalXpEarned,
        finishedAt: attempts.finishedAt,
      })
      .from(attempts)
      .innerJoin(contents, eq(attempts.contentId, contents.id))
      .innerJoin(topics, eq(contents.topicId, topics.id))
      .where(sql`${attempts.finishedAt} IS NOT NULL`)
      .orderBy(desc(attempts.finishedAt))
      .limit(20)
      .all();

    return NextResponse.json({
      learner: {
        totalXp,
        level: levelInfo.level,
        currentLevelXp: levelInfo.currentLevelXp,
        nextLevelXp: levelInfo.nextLevelXp,
        progressPercent: levelInfo.progressPercent,
        streakDays: profile?.streakDays || 0,
      },
      recentTopics: recentTopics.filter((t) => t.contentId !== null),
      battleLog,
    });
  } catch (error: any) {
    console.error("Fetch learner HUD error:", error);
    return NextResponse.json({ error: "Failed to fetch learner HUD" }, { status: 500 });
  }
}
