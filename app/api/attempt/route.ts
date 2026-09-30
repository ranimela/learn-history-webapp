import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db/client";
import { attempts } from "@/lib/db/schema";

export async function POST(req: NextRequest) {
  try {
    const { contentId, nQuestions = 10, difficulty = 2 } = await req.json();

    if (!contentId) {
      return NextResponse.json({ error: "contentId is required" }, { status: 400 });
    }

    const attemptId = `att_${crypto.randomUUID()}`;

    await db.insert(attempts).values({
      id: attemptId,
      learnerId: 1,
      contentId,
      nQuestions,
      difficulty: Number(difficulty) || 2,
      startedAt: new Date().toISOString(),
      score: 0,
      totalXpEarned: 0,
    });

    return NextResponse.json({ attemptId });
  } catch (error: any) {
    console.error("Start attempt error:", error);
    return NextResponse.json({ error: "Failed to initialize attempt" }, { status: 500 });
  }
}
