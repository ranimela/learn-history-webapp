import { NextRequest, NextResponse } from "next/server";
import { db, ensureTablesExist } from "@/lib/db/client";
import { topics, contents, questions, generationJobs } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { GenerateContentRequestSchema } from "@/lib/schemas";
import { fetchWikipediaExtract } from "@/lib/wikipedia";
import { generateQuizContent } from "@/lib/llm/generator";
import { validateQuizContent } from "@/lib/llm/validator";

export async function POST(req: NextRequest) {
  try {
    await ensureTablesExist();

    const body = await req.json();
    const parsed = GenerateContentRequestSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid request parameters" }, { status: 400 });
    }

    const { pageId, title, difficulty = 3, refresh = false } = parsed.data;

    // Check if content already generated and cached for this Wikipedia page (unless refresh is requested)
    if (!refresh) {
      const existingTopic = await db
        .select()
        .from(topics)
        .where(eq(topics.wikiPageId, pageId))
        .get();

      if (existingTopic) {
        const existingContent = await db
          .select()
          .from(contents)
          .where(eq(contents.topicId, existingTopic.id))
          .get();

        if (existingContent) {
          // Check if existing content has enough questions matching the requested difficulty
          const allPoolQuestions = await db
            .select()
            .from(questions)
            .where(eq(questions.contentId, existingContent.id))
            .all();

          const matchingQuestions = allPoolQuestions.filter((q) => {
            if (difficulty === 1) return q.difficulty <= 2;
            if (difficulty === 3) return q.difficulty >= 4;
            return q.difficulty >= 2 && q.difficulty <= 3;
          });

          if (matchingQuestions.length >= 8) {
            return NextResponse.json({
              contentId: existingContent.id,
              cached: true,
            });
          }
        }
      }
    } else {
      // Purge any stale existing topic records for this pageId
      const oldTopics = await db
        .select()
        .from(topics)
        .where(eq(topics.wikiPageId, pageId))
        .all();
      for (const ot of oldTopics) {
        await db.delete(topics).where(eq(topics.id, ot.id));
      }
    }

    // Create asynchronous generation job
    const jobId = `job_${crypto.randomUUID()}`;
    await db.insert(generationJobs).values({
      id: jobId,
      wikiPageId: pageId,
      wikiTitle: title,
      status: "pending",
      progressPercent: 5,
      message: "Queued for generation...",
    });

    // Fire background execution outside of the HTTP response lifecycle
    executeGenerationPipeline(jobId, pageId, title, difficulty).catch((err) => {
      console.error(`Background job ${jobId} unhandled failure:`, err);
    });

    return NextResponse.json({
      jobId,
      status: "pending",
      cached: false,
    });
  } catch (error: any) {
    console.error("Content generation route error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

async function executeGenerationPipeline(
  jobId: string,
  pageId: number,
  title: string,
  difficulty: number
) {
  try {
    // 1. Fetching source
    await db
      .update(generationJobs)
      .set({
        status: "fetching_source",
        progressPercent: 20,
        message: "Retrieving verified historical records from Wikipedia...",
        updatedAt: new Date().toISOString(),
      })
      .where(eq(generationJobs.id, jobId));

    const extract = await fetchWikipediaExtract(pageId, title);

    // 2. Generating facts and questions
    await db
      .update(generationJobs)
      .set({
        status: "extracting_facts",
        progressPercent: 50,
        message: "Synthesizing lesson brief and generating candidate questions...",
        updatedAt: new Date().toISOString(),
      })
      .where(eq(generationJobs.id, jobId));

    const generated = await generateQuizContent(title, extract.fullExtract, difficulty);

    // 3. Grounding & Anti-hallucination validation
    await db
      .update(generationJobs)
      .set({
        status: "validating",
        progressPercent: 80,
        message: "Auditing answer keys and verifying source quotes...",
        updatedAt: new Date().toISOString(),
      })
      .where(eq(generationJobs.id, jobId));

    const validation = await validateQuizContent(generated, extract.fullExtract);

    if (validation.validQuestions.length < 5) {
      throw new Error(
        `This historical topic is too thin or unverified to generate a complete quiz. Please try another topic.`
      );
    }

    // 4. Persistence into database
    const topicId = `top_${crypto.randomUUID()}`;
    const contentId = `cnt_${crypto.randomUUID()}`;

    // Insert topic
    await db.insert(topics).values({
      id: topicId,
      learnerId: 1,
      name: title,
      wikiTitle: extract.title,
      wikiPageId: pageId,
      lastStudiedAt: new Date().toISOString(),
    });

    // Insert content
    await db.insert(contents).values({
      id: contentId,
      topicId,
      lessonText: generated.lesson_text,
      factsJson: JSON.stringify(validation.validFacts),
      followupsJson: JSON.stringify(generated.followups),
      sourceUrl: extract.canonicalUrl,
      model: process.env.LLM_MODEL || "mock",
    });

    // Insert validated questions (take up to 15)
    for (const q of validation.validQuestions.slice(0, 15)) {
      await db.insert(questions).values({
        id: `q_${crypto.randomUUID()}`,
        contentId,
        stem: q.stem,
        optionsJson: JSON.stringify(q.options),
        correctIdx: q.correct_idx,
        explanation: q.explanation,
        factId: q.fact_id,
        difficulty: q.difficulty,
        isDateRecall: q.is_date_recall || false,
      });
    }

    // 5. Complete job
    await db
      .update(generationJobs)
      .set({
        status: "completed",
        progressPercent: 100,
        contentId,
        topicId,
        message: "Quiz generated successfully! Preparing arena...",
        updatedAt: new Date().toISOString(),
      })
      .where(eq(generationJobs.id, jobId));
  } catch (error: any) {
    console.error(`Error in generation job ${jobId}:`, error);
    await db
      .update(generationJobs)
      .set({
        status: "failed",
        error: error.message || "An unexpected error occurred during generation.",
        updatedAt: new Date().toISOString(),
      })
      .where(eq(generationJobs.id, jobId));
  }
}
