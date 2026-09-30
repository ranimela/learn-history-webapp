# Architecture Specification: History Quiz App (v0 Core)

## Architectural Overview

This system is an asynchronous, decoupled, fact-grounded educational quiz platform engineered for an 11-year-old history enthusiast. 

### Core State & Execution Boundaries
1. **Ingestion & Retrieval Boundary (Wikipedia)**: Decoupled from the LLM. Ingests raw articles, extracts lead sections, filters disambiguations, and breaks oversized articles into thematic sub-eras to avoid narrative truncations.
2. **Asynchronous Generation Engine (Vercel AI SDK + Job Queue)**: Generation and validation are decoupled from the client's HTTP request-response cycle to prevent 10–15s serverless gateway timeouts. `POST /api/content/generate` creates an asynchronous generation job (`job_id`) in the database. The client tracks execution via Server-Sent Events (SSE) `/api/jobs/[id]/stream` or polling.
3. **Anti-Hallucination Pipeline**: The Generator LLM extracts verbatim quotes from Wikipedia for each fact. A zero-cost deterministic code validator verifies that every fact span exists character-for-character in the raw Wikipedia extract *before* the Question Validator LLM evaluates distractors and answer keys.
4. **Server-Authoritative Quiz Runner**: `correct_idx`, `explanation`, and `fact_id` are never transmitted to the browser before question submission. Answers are submitted incrementally (`POST /api/attempt/[id]/answer`), giving immediate pedagogical feedback while protecting upcoming questions.
5. **Player Progression Engine**: Hybrid state model. A cached `learner_profile` table maintains O(1) XP, streak, and tier status for the Fortnite-style HUD, backed by immutable `attempt` and `answer` audit logs.

---

## Immutable Data Contracts

### 1. Ingestion / Source Contract (`WikipediaExtract`)
```ts
export interface WikipediaCandidate {
  pageId: number;
  title: string;
  description: string;
  thumbnailUrl?: string;
}

export interface WikipediaArticleSource {
  pageId: number;
  title: string;
  canonicalUrl: string;
  leadSummary: string;       // Balanced thematic overview
  fullExtract: string;       // Clean text without HTML/citations
  sections: Array<{ title: string; content: string }>;
}
```

### 2. Generation Engine Contract (`LLM Generation & Validation`)
```ts
import { z } from "zod";

export const FactItemSchema = z.object({
  id: z.string(),                     // e.g. "f1", "f2"
  verbatim_quote: z.string(),         // Verbatim span from Wikipedia
  fact_statement: z.string(),         // Kid-friendly atomic statement
});

export const RawQuestionSchema = z.object({
  stem: z.string().min(10),
  options: z.tuple([z.string(), z.string(), z.string(), z.string()]),
  correct_idx: z.union([z.literal(0), z.literal(1), z.literal(2), z.literal(3)]),
  explanation: z.string(),
  fact_id: z.string(),
  difficulty: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4), z.literal(5)]),
  is_date_recall: z.boolean(),
});

export const GeneratorOutputSchema = z.object({
  facts: z.array(FactItemSchema).min(12).max(25),
  lesson_text: z.string().min(500).max(3000),
  followups: z.array(z.string()).min(2).max(4),
  questions: z.array(RawQuestionSchema).min(12).max(18),
});

export const ValidatorQuestionReportSchema = z.object({
  question_index: z.number(),
  ok: z.boolean(),
  issue: z.string().optional(),
});

export const ValidatorOutputSchema = z.object({
  evaluations: z.array(ValidatorQuestionReportSchema),
});
```

### 3. Client Quiz Session Contract (Anti-Cheat Projection)
```ts
export interface PublicQuizQuestion {
  id: string;
  stem: string;
  options: [string, string, string, string];
  difficulty: number;
}

export interface PublicQuizSession {
  attemptId: string;
  contentId: string;
  topicTitle: string;
  totalQuestions: number;
  questions: PublicQuizQuestion[]; // correct_idx & explanation strictly STRIPPED
}
```

### 4. Interactive Step Submission & Evaluation Contract
```ts
export interface SubmitAnswerRequest {
  questionId: string;
  chosenIdx: number | null; // null = "I don't know"
  timeMs: number;
}

export interface SubmitAnswerResponse {
  isCorrect: boolean;
  correctIdx: number;
  explanation: string;
  currentScore: number;
  isFinished: boolean;
}

export interface FinalizeAttemptResponse {
  attemptId: string;
  score: number;
  totalQuestions: number;
  xpEarned: {
    base: number;
    perfectBonus: number;
    firstTimeBonus: number;
    total: number;
  };
  lessonText: string;
  followups: string[];
  newPlayerState: {
    level: number;
    currentXp: number;
    nextLevelXp: number;
    streakDays: number;
  };
}
```

---

## Affected Files

### Configuration & Infrastructure
- `package.json` (Next.js 14/15, Tailwind, Drizzle, @libsql/client, ai, zod)
- `tsconfig.json`
- `drizzle.config.ts`
- `.env.example`

### Core Domain & Data Layer (`/lib`)
- `lib/db/schema.ts` (Tables: topics, contents, questions, attempts, answers, generation_jobs, learner_profile)
- `lib/db/client.ts` (Drizzle client connecting to LibSQL/Turso or local SQLite)
- `lib/wikipedia.ts` (Wikimedia API search, extract retrieval, User-Agent header compliance, section splitting)
- `lib/llm/generator.ts` (Vercel AI SDK generateObject pipeline)
- `lib/llm/validator.ts` (Verbatim quote string check + LLM question validation pass)
- `lib/grading.ts` (Deterministic scoring, XP calculation, streak logic)

### API Endpoints (`/app/api`)
- `app/api/topic/resolve/route.ts` (Topic search & disambiguation)
- `app/api/content/generate/route.ts` (Triggers async generation job, returns jobId)
- `app/api/jobs/[id]/stream/route.ts` (SSE progress stream: "Finding sources" -> "Verifying quotes" -> "Validating questions" -> "Ready")
- `app/api/quiz/[contentId]/route.ts` (Serves sanitized questions without answers)
- `app/api/attempt/[id]/answer/route.ts` (Server-authoritative per-question grading)
- `app/api/attempt/[id]/finish/route.ts` (XP computation & lesson delivery)
- `app/api/question/flag/route.ts` (Flags invalid/broken question)

### User Interface Layer (`/app`)
- `app/layout.tsx` (Fortnite-themed dark mode shell, chunky typography, XP header HUD)
- `app/page.tsx` (Topic search input, recent topics, HUD display)
- `app/quiz/[contentId]/page.tsx` (Step-by-step quiz runner with tactile game animations)
- `app/results/[attemptId]/page.tsx` (Victory/review screen, XP gain animation, lesson text, follow-up chips)

---

## Step-by-Step Micro-Tasks

1. **Skeleton & DB Foundations**: Initialize Next.js app with Tailwind, Drizzle schema, and local SQLite/Turso client. Setup unit tests for pure scoring.
2. **Wikipedia Ingestion Module**: Build and test `lib/wikipedia.ts` with User-Agent compliance, query resolution, lead summary extraction, and token safety.
3. **Async Job & Anti-Hallucination Pipeline**: Implement `lib/llm/generator.ts` and `lib/llm/validator.ts` with verbatim quote verification and SSE job streaming.
4. **Server-Authoritative Attempt Engine**: Implement `POST /api/attempt/[id]/answer` and `finish` endpoints with tamper-proof grading and XP bonuses.
5. **Fortnite-Themed Game UI**: Build high-contrast, tactile UI components (chunky italic display font, angled badges, glowing XP progress bar, responsive question cards).
6. **E2E Integration & Verification**: Execute end-to-end dry runs on 5 sample topics to verify zero data leakage and sub-second UI interactions.

---

## Verification Criteria

1. **Determinism & Anti-Hallucination Test**: Unit test verifying that if a generated fact's `verbatim_quote` is not found in the raw Wikipedia extract, the generation pipeline instantly rejects the fact before spending tokens on validation.
2. **Anti-Cheating Projection Test**: Inspect `GET /app/api/quiz/[contentId]` response payload. Assert that neither `correct_idx`, `explanation`, nor `fact_id` exist in the client JSON.
3. **Serverless Timeout Immunity**: Verify that `POST /api/content/generate` returns within < 500ms with a `jobId`, delegating heavy LLM calls to the async worker while the client receives SSE status updates.
4. **Scoring & XP Math Tests**: `grading.test.ts` verifying:
   - "I don't know" (`chosenIdx: null`) records 0 points but does not penalize streaks.
   - 10/10 score grants `perfectBonus: 50`.
   - First-time topic grants `firstTimeBonus: 20`.

---

## Context Pruning

When the **Builder** agent initiates code generation, it is strictly permitted to read ONLY:
1. `/.plans/v0-core-architecture.md` (This document)
2. `HISTORY_QUIZ_SPEC.md` (Original domain context & requirements)
3. `lib/db/schema.ts` (Once created, for schema contracts)

All other files and external exploratory dialogues must be pruned from active Builder context.
