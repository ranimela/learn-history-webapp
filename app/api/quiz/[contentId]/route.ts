import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db/client";
import { contents, questions, topics } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { PublicQuizSession } from "@/lib/schemas";

export async function GET(
  _req: NextRequest,
  { params }: { params: { contentId: string } }
) {
  try {
    const content = await db
      .select()
      .from(contents)
      .where(eq(contents.id, params.contentId))
      .get();

    if (!content) {
      return NextResponse.json({ error: "Quiz content not found" }, { status: 404 });
    }

    const topic = await db
      .select()
      .from(topics)
      .where(eq(topics.id, content.topicId))
      .get();

    const allQuestions = await db
      .select()
      .from(questions)
      .where(and(eq(questions.contentId, params.contentId), eq(questions.flagged, false)))
      .all();

    if (allQuestions.length === 0) {
      return NextResponse.json({ error: "No active questions available for this quiz" }, { status: 400 });
    }

    const { searchParams } = new URL(_req.url);
    const diffParam = searchParams.get("difficulty");
    const diffLevel = diffParam ? parseInt(diffParam, 10) : 2;

    // Strictly prioritize questions matching difficulty:
    // Level 1 (Recruit) -> 1.0 (strongly prefers level 1 and 2)
    // Level 2 (Veteran) -> 3.0 (prefers level 3, then 2/4)
    // Level 3 (Legend)  -> 5.0 (strongly prefers level 4 and 5)
    const targetDiff = diffLevel === 1 ? 1.0 : diffLevel === 3 ? 5.0 : 3.0;
    const sortedQuestions = [...allQuestions].sort((a, b) => {
      return Math.abs(a.difficulty - targetDiff) - Math.abs(b.difficulty - targetDiff);
    });

    // Select up to 10 questions from pool
    const selectedQuestions = sortedQuestions.slice(0, 10);

    // ANTI-CHEAT SANITIZATION:
    // Strip correctIdx, explanation, and factId completely
    const sanitizedQuestions = selectedQuestions.map((q) => {
      let parsedOptions: [string, string, string, string];
      try {
        parsedOptions = JSON.parse(q.optionsJson);
      } catch {
        parsedOptions = ["Option A", "Option B", "Option C", "Option D"];
      }

      return {
        id: q.id,
        stem: q.stem,
        options: parsedOptions,
        difficulty: q.difficulty,
      };
    });

    const session: PublicQuizSession = {
      attemptId: "", // Will be assigned when attempt initializes
      contentId: content.id,
      topicTitle: topic ? topic.name : "History Challenge",
      totalQuestions: sanitizedQuestions.length,
      questions: sanitizedQuestions,
    };

    return NextResponse.json(session);
  } catch (error: any) {
    console.error("Fetch quiz error:", error);
    return NextResponse.json({ error: "Failed to load quiz session" }, { status: 500 });
  }
}
