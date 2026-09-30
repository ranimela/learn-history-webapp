import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db/client";
import { attempts, answers, questions } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { SubmitAnswerRequestSchema } from "@/lib/schemas";
import { gradeSingleAnswer } from "@/lib/grading";

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const attemptId = params.id;
    const body = await req.json();
    const parsed = SubmitAnswerRequestSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid submission data" }, { status: 400 });
    }

    const { questionId, chosenIdx, timeMs } = parsed.data;

    // Verify attempt exists
    const attempt = await db
      .select()
      .from(attempts)
      .where(eq(attempts.id, attemptId))
      .get();

    if (!attempt) {
      return NextResponse.json({ error: "Attempt not found" }, { status: 404 });
    }

    // Fetch the ground-truth question from DB
    const question = await db
      .select()
      .from(questions)
      .where(eq(questions.id, questionId))
      .get();

    if (!question) {
      return NextResponse.json({ error: "Question not found" }, { status: 404 });
    }

    // Deterministic evaluation in code
    const grading = gradeSingleAnswer({
      chosenIdx,
      correctIdx: question.correctIdx,
    });

    // Record answer row in DB for audit trail, adaptivity, and spaced repetition
    const answerId = `ans_${crypto.randomUUID()}`;
    await db.insert(answers).values({
      id: answerId,
      attemptId,
      questionId,
      chosenIdx,
      correct: grading.isCorrect,
      timeMs,
    });

    // Update ongoing attempt score if correct
    let newScore = attempt.score;
    if (grading.isCorrect) {
      newScore += 1;
      await db
        .update(attempts)
        .set({ score: newScore })
        .where(eq(attempts.id, attemptId));
    }

    // Count answers submitted so far for this attempt
    const allAnswersForAttempt = await db
      .select()
      .from(answers)
      .where(eq(answers.attemptId, attemptId))
      .all();

    const isFinished = allAnswersForAttempt.length >= attempt.nQuestions;

    return NextResponse.json({
      isCorrect: grading.isCorrect,
      isSkipped: grading.isSkipped,
      correctIdx: question.correctIdx,
      explanation: question.explanation,
      currentScore: newScore,
      answeredCount: allAnswersForAttempt.length,
      totalQuestions: attempt.nQuestions,
      isFinished,
    });
  } catch (error: any) {
    console.error("Submit answer error:", error);
    return NextResponse.json({ error: "Failed to grade answer" }, { status: 500 });
  }
}
