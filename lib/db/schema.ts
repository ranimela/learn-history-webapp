import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";
import { sql } from "drizzle-orm";

export const topics = sqliteTable("topics", {
  id: text("id").primaryKey(),
  learnerId: integer("learner_id").notNull().default(1),
  name: text("name").notNull(),
  wikiTitle: text("wiki_title").notNull(),
  wikiPageId: integer("wiki_page_id").notNull(),
  lastStudiedAt: text("last_studied_at"),
  createdAt: text("created_at")
    .notNull()
    .default(sql`CURRENT_TIMESTAMP`),
});

export const contents = sqliteTable("contents", {
  id: text("id").primaryKey(),
  topicId: text("topic_id")
    .notNull()
    .references(() => topics.id, { onDelete: "cascade" }),
  lessonText: text("lesson_text").notNull(),
  difficulty: integer("difficulty").notNull().default(2),
  factsJson: text("facts_json").notNull(), // JSON string: Array<{ id: string, verbatim_quote: string, fact_statement: string }>
  followupsJson: text("followups_json"), // JSON string: string[]
  sourceUrl: text("source_url").notNull(),
  model: text("model").notNull(),
  createdAt: text("created_at")
    .notNull()
    .default(sql`CURRENT_TIMESTAMP`),
});

export const questions = sqliteTable("questions", {
  id: text("id").primaryKey(),
  contentId: text("content_id")
    .notNull()
    .references(() => contents.id, { onDelete: "cascade" }),
  stem: text("stem").notNull(),
  optionsJson: text("options_json").notNull(), // JSON string: [string, string, string, string]
  correctIdx: integer("correct_idx").notNull(), // 0, 1, 2, or 3
  explanation: text("explanation").notNull(),
  factId: text("fact_id").notNull(),
  difficulty: integer("difficulty").notNull().default(3), // 1-5
  isDateRecall: integer("is_date_recall", { mode: "boolean" }).notNull().default(false),
  flagged: integer("flagged", { mode: "boolean" }).notNull().default(false),
  createdAt: text("created_at")
    .notNull()
    .default(sql`CURRENT_TIMESTAMP`),
});

export const attempts = sqliteTable("attempts", {
  id: text("id").primaryKey(),
  learnerId: integer("learner_id").notNull().default(1),
  contentId: text("content_id")
    .notNull()
    .references(() => contents.id, { onDelete: "cascade" }),
  startedAt: text("started_at")
    .notNull()
    .default(sql`CURRENT_TIMESTAMP`),
  finishedAt: text("finished_at"),
  score: integer("score").notNull().default(0),
  nQuestions: integer("n_questions").notNull().default(10),
  difficulty: integer("difficulty").notNull().default(2),
  totalXpEarned: integer("total_xp_earned").notNull().default(0),
});

export const answers = sqliteTable("answers", {
  id: text("id").primaryKey(),
  attemptId: text("attempt_id")
    .notNull()
    .references(() => attempts.id, { onDelete: "cascade" }),
  questionId: text("question_id")
    .notNull()
    .references(() => questions.id, { onDelete: "cascade" }),
  chosenIdx: integer("chosen_idx"), // null = "I don't know"
  correct: integer("correct", { mode: "boolean" }).notNull().default(false),
  timeMs: integer("time_ms").notNull().default(0),
  createdAt: text("created_at")
    .notNull()
    .default(sql`CURRENT_TIMESTAMP`),
});

export const generationJobs = sqliteTable("generation_jobs", {
  id: text("id").primaryKey(),
  topicId: text("topic_id"),
  wikiPageId: integer("wiki_page_id").notNull(),
  wikiTitle: text("wiki_title").notNull(),
  status: text("status").notNull().default("pending"), // 'pending' | 'fetching_source' | 'extracting_facts' | 'validating' | 'completed' | 'failed'
  progressPercent: integer("progress_percent").notNull().default(0),
  message: text("message"),
  error: text("error"),
  contentId: text("content_id"),
  createdAt: text("created_at")
    .notNull()
    .default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text("updated_at")
    .notNull()
    .default(sql`CURRENT_TIMESTAMP`),
});

export const learnerProfile = sqliteTable("learner_profile", {
  id: text("id").primaryKey(),
  learnerId: integer("learner_id").notNull().default(1).unique(),
  totalXp: integer("total_xp").notNull().default(0),
  level: integer("level").notNull().default(1),
  streakDays: integer("streak_days").notNull().default(0),
  lastActiveDate: text("last_active_date"),
  updatedAt: text("updated_at")
    .notNull()
    .default(sql`CURRENT_TIMESTAMP`),
});

export type Topic = typeof topics.$inferSelect;
export type Content = typeof contents.$inferSelect;
export type Question = typeof questions.$inferSelect;
export type Attempt = typeof attempts.$inferSelect;
export type Answer = typeof answers.$inferSelect;
export type GenerationJob = typeof generationJobs.$inferSelect;
export type LearnerProfile = typeof learnerProfile.$inferSelect;
