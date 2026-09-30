import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db/client";
import { generationJobs } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const job = await db
      .select()
      .from(generationJobs)
      .where(eq(generationJobs.id, params.id))
      .get();

    if (!job) {
      return NextResponse.json({ error: "Job not found" }, { status: 404 });
    }

    return NextResponse.json({ job });
  } catch (err: any) {
    return NextResponse.json({ error: "Failed to check job status" }, { status: 500 });
  }
}
