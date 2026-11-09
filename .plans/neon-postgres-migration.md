# Specification: Neon PostgreSQL Migration and Vercel Deployment

## Summary for Approval
This plan migrates History Quest from local SQLite to Neon Serverless PostgreSQL and deploys the app to Vercel at `history.melameds.net`.
What could break: SQL dialect discrepancies between SQLite and PostgreSQL (e.g. timestamp functions or boolean representations).
What you need to decide: None; all conventions, stack choices, and fresh database preferences have been confirmed.

## Goal & Non-Goals
### Goals (from PRD)
- 100% of completed quiz attempts and battle logs initiated on `https://history.melameds.net` persist in Neon PostgreSQL without data loss.
- 0 DNS or SSL certificate errors when accessing `https://history.melameds.net`.

### Non-Goals (from PRD)
- User authentication, multi-tenant accounts, or password management (remains anonymous single-learner profile for v1).
- Migration of legacy data from local SQLite (`local.db`)—database starts fresh.
- Offline support or local SQLite fallbacks in production.

## Architectural Overview
- Replace `@libsql/client` and `drizzle-orm/libsql` with `@neondatabase/serverless` and `drizzle-orm/neon-http`.
- The database schema is transformed from SQLite column primitives (`drizzle-orm/sqlite-core`) to PostgreSQL column primitives (`drizzle-orm/pg-core`).
- Database queries across serverless API routes (`/api/attempt`, `/api/learner`, etc.) will execute over Neon's HTTP serverless driver, eliminating connection pooling exhaustion on Vercel lambdas.
- GitHub repository commits to `main` trigger automatic build and deployment pipelines on Vercel, serving `https://history.melameds.net`.

## Immutable Data Contracts
```typescript
// Core DB relational contracts (PostgreSQL)
export interface TopicRecord {
  id: string;
  learnerId: number;
  name: string;
  wikiTitle: string;
  wikiPageId: number;
  lastStudiedAt: string | null;
  createdAt: string;
}

export interface ContentRecord {
  id: string;
  topicId: string;
  lessonText: string;
  factsJson: string;
  followupsJson: string | null;
  sourceUrl: string;
  model: string;
  difficulty: number;
  createdAt: string;
}

export interface QuestionRecord {
  id: string;
  contentId: string;
  stem: string;
  optionsJson: string;
  correctIdx: number;
  explanation: string;
  factId: string;
  difficulty: number;
  isDateRecall: number;
  flagged: number;
  createdAt: string;
}

export interface AttemptRecord {
  id: string;
  learnerId: number;
  contentId: string;
  startedAt: string;
  finishedAt: string | null;
  score: number;
  nQuestions: number;
  difficulty: number;
  totalXpEarned: number;
}
```

## Affected Files
- `package.json`: Add `@neondatabase/serverless`, remove `@libsql/client` (or keep as fallback).
- `drizzle.config.ts`: Update dialect to `postgresql`.
- `lib/db/schema.ts`: Migrate all table definitions from `sqliteTable` to `pgTable`.
- `lib/db/client.ts`: Migrate client connection to `neon()` HTTP and `drizzle-orm/neon-http`.
- `lib/db/queries.ts` (if any SQL adjustments needed).
- `.env.example`: Update documentation to reflect PostgreSQL connection format.

Pristine modules (untouched):
- `app/quiz/[contentId]/page.tsx`
- `app/results/[attemptId]/page.tsx`
- `lib/llm/generator.ts`
- `lib/llm/validator.ts`
- `lib/quiz/grader.ts`

## Logging & Observability
- Server-side error logging via standard `console.error` with timestamps and error stack traces in Vercel runtime logs.
- Never log raw database credentials or connection strings.
- Health-check query logging on DB initialization failure.

## Step-by-Step Micro-Tasks
- **Task 1 (Dependencies & Config)**: Install `@neondatabase/serverless` and update `drizzle.config.ts` for PostgreSQL dialect. (Serves AC-1)
- **Task 2 (Schema & Client Migration)**: Convert `lib/db/schema.ts` to `pgTable` definitions and `lib/db/client.ts` to `drizzle-orm/neon-http`. (Serves AC-1, AC-3)
- **Task 3 (Schema Push & Verification)**: Run `drizzle-kit push` against Neon DB and verify table creation in Neon. (Serves AC-1, AC-3, AC-4)
- **Task 4 (Build & Deploy)**: Verify TypeScript types (`tsc --noEmit`), execute test suite (`vitest run`), commit, and push branch to trigger Vercel deployment. (Serves AC-2, AC-3, AC-4)

## Acceptance Traceability
| AC ID | Micro-Task(s) | Verification Method |
|---|---|---|
| AC-1 (Schema Init) | Task 1, Task 2, Task 3 | Drizzle push success output and table presence verification in Neon |
| AC-2 (Public Domain) | Task 4 | HTTPS request to `https://history.melameds.net` returning HTTP 200 |
| AC-3 (Quiz Flow) | Task 2, Task 3, Task 4 | Local & live quiz flow completes and creates row in `attempts` |
| AC-4 (History Retrieval) | Task 2, Task 3, Task 4 | Calling `/api/learner` returns recorded stats and past battle records |

## Verification Criteria
- `npx drizzle-kit push`: Exits code 0 with all 7 tables synchronized to Neon.
- `npx vitest run`: All test suites pass.
- `npx tsc --noEmit`: 0 type errors.
- `npm run build`: Production build completes cleanly.
- `curl -I https://history.melameds.net`: Returns HTTP 200/307 with valid SSL.

## Context Pruning
- `lib/db/schema.ts`
- `lib/db/client.ts`
- `drizzle.config.ts`
