import { z } from "zod";

// --- Wikipedia Retrieval Schemas ---
export const WikipediaCandidateSchema = z.object({
  pageId: z.number(),
  title: z.string(),
  description: z.string(),
  thumbnailUrl: z.string().optional(),
});
export type WikipediaCandidate = z.infer<typeof WikipediaCandidateSchema>;

// --- LLM Generation Schemas ---
export const FactItemSchema = z.object({
  id: z.string(), // e.g. "f1", "f2"
  verbatim_quote: z.string().min(5), // Must be exact quote from Wikipedia extract
  fact_statement: z.string().min(10), // Kid-friendly statement
});
export type FactItem = z.infer<typeof FactItemSchema>;

export const RawQuestionSchema = z.object({
  stem: z.string().min(10),
  options: z.tuple([z.string(), z.string(), z.string(), z.string()]),
  correct_idx: z.union([z.literal(0), z.literal(1), z.literal(2), z.literal(3)]),
  explanation: z.string().min(10),
  fact_id: z.string(),
  difficulty: z.union([
    z.literal(1),
    z.literal(2),
    z.literal(3),
    z.literal(4),
    z.literal(5),
  ]),
  is_date_recall: z.boolean().default(false),
});
export type RawQuestion = z.infer<typeof RawQuestionSchema>;

export const GeneratorOutputSchema = z.object({
  facts: z.array(FactItemSchema).min(10).max(30),
  lesson_text: z.string().min(200),
  followups: z.array(z.string()).min(2).max(5),
  questions: z.array(RawQuestionSchema).min(12).max(20),
});
export type GeneratorOutput = z.infer<typeof GeneratorOutputSchema>;

// --- LLM Validation Schemas ---
export const ValidatorQuestionReportSchema = z.object({
  question_index: z.number(),
  ok: z.boolean(),
  issue: z.string().optional(),
});

export const ValidatorOutputSchema = z.object({
  evaluations: z.array(ValidatorQuestionReportSchema),
});
export type ValidatorOutput = z.infer<typeof ValidatorOutputSchema>;

// --- Client Quiz Projection Schemas (Anti-Cheat) ---
export const PublicQuizQuestionSchema = z.object({
  id: z.string(),
  stem: z.string(),
  options: z.tuple([z.string(), z.string(), z.string(), z.string()]),
  difficulty: z.number(),
});
export type PublicQuizQuestion = z.infer<typeof PublicQuizQuestionSchema>;

export const PublicQuizSessionSchema = z.object({
  attemptId: z.string(),
  contentId: z.string(),
  topicTitle: z.string(),
  totalQuestions: z.number(),
  questions: z.array(PublicQuizQuestionSchema),
});
export type PublicQuizSession = z.infer<typeof PublicQuizSessionSchema>;

// --- API Request/Response Schemas ---
export const ResolveTopicRequestSchema = z.object({
  query: z.string().min(2).max(100),
});

export const GenerateContentRequestSchema = z.object({
  pageId: z.number(),
  title: z.string(),
  difficulty: z.number().min(1).max(5).optional(),
  refresh: z.boolean().optional(),
});

export const SubmitAnswerRequestSchema = z.object({
  questionId: z.string(),
  chosenIdx: z.number().int().min(0).max(3).nullable(), // null = "I don't know"
  timeMs: z.number().nonnegative().default(0),
});

export const FlagQuestionRequestSchema = z.object({
  questionId: z.string(),
  reason: z.string().max(300).optional(),
});
