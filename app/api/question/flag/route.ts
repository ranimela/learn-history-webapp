import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db/client";
import { questions } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { FlagQuestionRequestSchema } from "@/lib/schemas";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = FlagQuestionRequestSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid question ID" }, { status: 400 });
    }

    await db
      .update(questions)
      .set({ flagged: true })
      .where(eq(questions.id, parsed.data.questionId));

    return NextResponse.json({ ok: true });
  } catch (error: any) {
    return NextResponse.json({ error: "Failed to flag question" }, { status: 500 });
  }
}
