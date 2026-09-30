import { NextRequest, NextResponse } from "next/server";
import { searchWikipediaCandidates } from "@/lib/wikipedia";
import { ResolveTopicRequestSchema } from "@/lib/schemas";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = ResolveTopicRequestSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ error: "Please enter a valid historical topic (2-100 characters)." }, { status: 400 });
    }

    const candidates = await searchWikipediaCandidates(parsed.data.query);

    return NextResponse.json({ candidates });
  } catch (error: any) {
    console.error("Topic resolution error:", error);
    return NextResponse.json({ error: "Failed to resolve topic" }, { status: 500 });
  }
}
