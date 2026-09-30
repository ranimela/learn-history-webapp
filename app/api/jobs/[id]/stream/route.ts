import { NextRequest } from "next/server";
import { db } from "@/lib/db/client";
import { generationJobs } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

export const dynamic = "force-dynamic";

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      let isClosed = false;

      req.signal.addEventListener("abort", () => {
        isClosed = true;
        controller.close();
      });

      const checkInterval = setInterval(async () => {
        if (isClosed) {
          clearInterval(checkInterval);
          return;
        }

        try {
          const job = await db
            .select()
            .from(generationJobs)
            .where(eq(generationJobs.id, params.id))
            .get();

          if (!job) {
            controller.enqueue(encoder.encode(`event: error\ndata: ${JSON.stringify({ error: "Job not found" })}\n\n`));
            clearInterval(checkInterval);
            controller.close();
            return;
          }

          controller.enqueue(encoder.encode(`event: update\ndata: ${JSON.stringify(job)}\n\n`));

          if (job.status === "completed" || job.status === "failed") {
            clearInterval(checkInterval);
            controller.close();
          }
        } catch (err: any) {
          controller.enqueue(encoder.encode(`event: error\ndata: ${JSON.stringify({ error: err.message })}\n\n`));
          clearInterval(checkInterval);
          controller.close();
        }
      }, 750);
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
