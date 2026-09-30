# History Quiz App: Build Spec (v0.1)

Single-user web app for one ~11 year old who loves history. He enters a topic, gets a 10-question multiple-choice quiz, then a short lesson text. Content is grounded in retrieved facts. Grading is deterministic. Progress is stored per question so adaptivity and spaced repetition can be added later.

## 1. Decisions locked in

| Item | Decision |
|---|---|
| Users | One kid, no accounts, no identity |
| Access control | Shared passcode (env var) or unguessable URL. Purpose: protect API budget, not identity |
| Safety / privacy | Out of scope for v0. Revisit if shared with anyone else |
| Audience | ~11, knowledgeable, loves history. Target reading level: upper elementary to middle school, with harder reasoning questions |
| Multi-user | Not now. Keep a `learner_id` column (default `1`) so a later migration is unnecessary |
| Design theme | Inspired by Fortnite-style game UI (see section 9). No Fortnite names, logos, fonts, or assets |

## 2. Core loop

1. Kid types a topic (free text).
2. Backend resolves the topic to a Wikipedia page. If ambiguous, show 2 to 3 interpretations and let him pick.
3. Fetch page extract (plain text) as the fact source.
4. One LLM call (structured output) produces: lesson text, fact list with IDs, and a pool of ~15 questions.
5. Validator LLM call checks every answer key against the fact list. Drop failing questions.
6. Serve 10 questions (from the pool). Each has an "I don't know" option that scores 0 but is not counted as wrong.
7. Grade in code. Show per-question explanation, score, then the lesson text.
8. Persist attempt and per-answer rows.

Display order is quiz then lesson, but generation is lesson-first internally so both are consistent.

## 3. Stack

- **App:** Next.js (App Router), TypeScript, Tailwind. Single deployment (Vercel or Cloudflare).
- **DB:** SQLite via Turso (or local SQLite file for dev) with Drizzle ORM. Postgres via Supabase is a fine swap.
- **Validation:** Zod for all schemas (LLM output, API input).
- **LLM:** Any provider with JSON-schema structured output. Model name comes from env (`LLM_MODEL`). Use the strongest available model for generation and validation; cost is negligible at one user.
- **Retrieval:** Wikipedia APIs (endpoints below, verify before relying on them).

### Env vars

```
LLM_API_KEY=
LLM_MODEL=
APP_PASSCODE=
DATABASE_URL=
```

## 4. Project structure

```
/app
  page.tsx                  # topic input + recent topics
  quiz/[contentId]/page.tsx # quiz runner
  results/[attemptId]/page.tsx
  api/
    topic/resolve/route.ts
    content/generate/route.ts
    attempt/route.ts
    question/flag/route.ts
/lib
  wikipedia.ts              # search + extract fetchers
  llm.ts                    # provider wrapper, retries, structured output
  prompts/
    generate.ts
    validate.ts
  schemas.ts                # Zod schemas
  grading.ts                # pure functions, unit tested
  db/
    schema.ts
    client.ts
/tests
  grading.test.ts
  schemas.test.ts
/evals
  topics.json               # ~20 regression topics
  run.ts                    # generates + dumps output for eyeball review
```

## 5. Data model

```ts
// learner_id defaults to 1 everywhere; no auth in v0.

topic:    id, learner_id, name, wiki_title, wiki_page_id, last_studied_at
content:  id, topic_id, lesson_text, facts_json, source_url, model, created_at
question: id, content_id, stem, options_json (string[4]), correct_idx,
          explanation, fact_id, difficulty (1-5), flagged (bool), created_at
attempt:  id, learner_id, content_id, started_at, finished_at, score, n_questions
answer:   id, attempt_id, question_id, chosen_idx (null = "I don't know"),
          correct (bool), time_ms
```

Rules:
- Content is generated once per topic and reused. Regenerate only on explicit "refresh".
- `flagged = true` removes a question from rotation.
- `answer` rows are the foundation for spaced repetition and adaptive difficulty. Do not skip writing them.

## 6. API

| Route | Method | Input | Output |
|---|---|---|---|
| `/api/topic/resolve` | POST | `{ query }` | `{ candidates: [{ title, description, pageId }] }` |
| `/api/content/generate` | POST | `{ pageId, difficulty? }` | `{ contentId }` (cached if exists) |
| `/api/content/[id]` | GET | none | questions (without `correct_idx`) for the quiz |
| `/api/attempt` | POST | `{ contentId, answers: [{ questionId, chosenIdx, timeMs }] }` | `{ score, perQuestion: [{ correct, correctIdx, explanation }], lessonText }` |
| `/api/question/flag` | POST | `{ questionId, reason? }` | `{ ok }` |

All routes check the passcode (cookie set on a simple gate page). Never send `correct_idx` to the client before the attempt is submitted.

### Wikipedia endpoints (verify before use)

- Search: `https://en.wikipedia.org/w/rest.php/v1/search/title?q={q}&limit=5`
- Summary: `https://en.wikipedia.org/api/rest_v1/page/summary/{title}`
- Full plain text: `https://en.wikipedia.org/w/api.php?action=query&prop=extracts&explaintext=1&pageids={id}&format=json`
- On this day (future feature): `https://api.wikimedia.org/feed/v1/wikipedia/en/onthisday/all/{MM}/{DD}`

Send a descriptive `User-Agent` header per Wikimedia policy. Truncate long extracts to a token budget before sending to the LLM.

## 7. LLM pipeline

### 7.1 Generate (one structured-output call)

Input: page title, plain-text extract, difficulty target.

Output schema (Zod / JSON Schema):

```ts
{
  facts: [{ id: "f1", text: string }],          // 12 to 25 atomic facts extracted from the source
  lesson_text: string,                           // 250 to 400 words
  followups: string[],                           // 2 to 3 related topic titles
  questions: [{
    stem: string,
    options: [string, string, string, string],
    correct_idx: 0 | 1 | 2 | 3,
    explanation: string,                         // 1 to 2 sentences
    fact_id: string,                             // must exist in facts[]
    difficulty: 1 | 2 | 3 | 4 | 5
  }]                                             // 15 items
}
```

Prompt requirements:
- Use only the provided source text. No outside facts.
- Audience: bright 11 year old. Clear, engaging, not babyish. Explain unfamiliar terms inline.
- Favor causal and comparative questions ("why", "what was the result of", "which came first and why it mattered") over pure date or name recall. At most 2 of 10 served questions may be date-recall.
- Distractors must be plausible and unambiguously wrong given the source. No "all of the above" or "none of the above".
- Spread correct answers across positions A to D.
- Difficulty mix for the pool: roughly 20% level 2, 40% level 3, 30% level 4, 10% level 5 (tune after real use).
- Lesson text should cover the same facts the questions use and end with a short "if you want more" line linking the follow-up topics.

Post-generation checks in code (reject and retry once on failure):
- Zod parse succeeds.
- Every `fact_id` resolves.
- Exactly 4 options, all distinct, `correct_idx` in range.
- Pool size at least 12 after validation, else return "topic too thin" to the UI.

### 7.2 Validate (second call)

Input: facts + questions. Task: for each question, answer it using only the facts, and report whether (a) the key is supported, (b) exactly one option is correct, (c) distractors are plausible. Return `{ question_index, ok, issue? }`. Drop questions where `ok = false`.

### 7.3 Selecting 10 from the pool

- Exclude flagged questions.
- Prefer questions the kid has missed before (once spaced repetition exists).
- Otherwise: random with the difficulty mix above.

## 8. UI flow (no design yet, just screens)

1. **Gate:** passcode entry (once, then cookie).
2. **Home:** topic input, recent topics, (later) suggested topics.
3. **Disambiguation:** shown only if the topic resolves to multiple candidates.
4. **Loading:** progress states ("Finding sources", "Building your quiz"). Generation may take many seconds; consider streaming or optimistic loading.
5. **Quiz:** one question per screen, 4 options plus "I don't know", progress indicator, flag button.
6. **Results:** score, per-question review with explanations, then lesson text, then follow-up topic chips.

## 9. Design brief (Fortnite-inspired, original assets only)

Take the game-UI feel, not the IP. Do not use the name, logo, characters, or fonts. Suggested translation:

- **Palette:** saturated purple, electric blue, and yellow accents on a dark background, with high-contrast glow and gradient panels. Define as Tailwind theme tokens.
- **Type:** chunky, italic, uppercase display font for headings and buttons (choose an open-licensed one, e.g. from Google Fonts), clean sans for body text.
- **Shapes:** slightly angled or skewed panels and buttons, thick borders, drop shadows, tactile press animations.
- **Progression:** XP bar, levels, and a "battle pass" style track where each completed quiz fills tiers. Tier rewards can be cosmetic (themes, badges, titles) and unlocked purely from XP earned.
- **Rarity:** color-coded topic cards (common to legendary) based on quiz difficulty or score. Store as derived data, not a new table.
- **Feedback:** short celebratory banners on 9 or 10 out of 10 (write original copy, not game catchphrases), streak counter, quick sound effects (mutable, off by default).
- **Result framing:** avoid "you failed" language. Missed questions become "learn this" cards.

XP formula for v0 (tune freely): `xp = correct * 10 + perfect_bonus(50) + first_time_topic_bonus(20)`. Compute server-side from `attempt` data.

## 10. Milestones

1. **M1: Skeleton.** Next.js app, DB schema, passcode gate, static quiz UI with hardcoded questions, grading function with unit tests.
2. **M2: Retrieval.** Topic resolve + Wikipedia extract fetch.
3. **M3: Generation.** Generate + validate pipeline, Zod checks, persistence, cache reuse.
4. **M4: Full loop.** Quiz, grading endpoint, results, lesson text, attempt/answer storage, flag button.
5. **M5: Eval harness.** 20-topic regression set; run and read outputs after any prompt or model change.
6. **M6: Theme + XP.** Apply design brief, XP and levels.
7. **Later:** question-count selector (serve N from pool, no schema change), "today in history" (fetch feed, one LLM call to pick 3 kid-interesting events, cron pre-generation), personalized suggestions from `topic` and `answer` history, spaced repetition, adaptive difficulty, progress timeline.

## 11. Known risks (by severity)

1. **Wrong or ambiguous answer keys.** He will notice, or worse, learn it wrong. Mitigation: grounding via `fact_id`, validator pass, flag button.
2. **Wikipedia bias and gaps.** Contested topics inherit source framing. Acceptable for now; watch for it.
3. **Thin topics.** Obscure pages produce padded questions. Enforce minimum fact count and pool size.
4. **Ambiguous free text.** Handled by the disambiguation step.
5. **Latency.** Two sequential LLM calls plus retrieval. Cache aggressively; show progress.
6. **Difficulty miscalibration.** Defaults are guesses. Log `time_ms` and correctness, review after a week of use.
7. **Novelty decay.** One-off quizzes lose appeal. XP, streaks, and spaced repetition are the retention plan, so do not defer them indefinitely.

## 12. Counter-thesis

Generation is a commodity. A saved prompt in an existing chat tool gives roughly the same quiz. The app only justifies itself through the persistent learner model (history, spaced repetition, adaptive difficulty) and a UI he actually wants to open. Before investing past M4, run a manual week (you or a script generating quizzes) and check whether he asks for more. If he does not, better architecture will not fix that.

## 13. Open questions to settle during build

- Language: English only, or also his native language? (Changes retrieval source and prompts.)
- Should the kid see the difficulty level, or should it stay hidden?
- Reveal answers per question immediately, or only at the end? (Immediate feedback is better for learning; end-only is closer to a "real quiz". Default to immediate, make it a setting.)
