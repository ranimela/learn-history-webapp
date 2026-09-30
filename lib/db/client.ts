import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import * as schema from "./schema";

const url = process.env.DATABASE_URL || "file:./local.db";
const authToken = process.env.DATABASE_AUTH_TOKEN;

export const client = createClient({
  url,
  authToken,
});

export const db = drizzle(client, { schema });

/**
 * Initializes database tables if they do not already exist.
 * Essential for local development and self-contained zero-config startup.
 */
export async function ensureTablesExist(): Promise<void> {
  await client.execute(`
    CREATE TABLE IF NOT EXISTS topics (
      id TEXT PRIMARY KEY,
      learner_id INTEGER NOT NULL DEFAULT 1,
      name TEXT NOT NULL,
      wiki_title TEXT NOT NULL,
      wiki_page_id INTEGER NOT NULL,
      last_studied_at TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
  `);

  await client.execute(`
    CREATE TABLE IF NOT EXISTS contents (
      id TEXT PRIMARY KEY,
      topic_id TEXT NOT NULL REFERENCES topics(id) ON DELETE CASCADE,
      lesson_text TEXT NOT NULL,
      facts_json TEXT NOT NULL,
      followups_json TEXT,
      source_url TEXT NOT NULL,
      model TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
  `);

  await client.execute(`
    CREATE TABLE IF NOT EXISTS questions (
      id TEXT PRIMARY KEY,
      content_id TEXT NOT NULL REFERENCES contents(id) ON DELETE CASCADE,
      stem TEXT NOT NULL,
      options_json TEXT NOT NULL,
      correct_idx INTEGER NOT NULL,
      explanation TEXT NOT NULL,
      fact_id TEXT NOT NULL,
      difficulty INTEGER NOT NULL DEFAULT 3,
      is_date_recall INTEGER NOT NULL DEFAULT 0,
      flagged INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
  `);

  await client.execute(`
    CREATE TABLE IF NOT EXISTS attempts (
      id TEXT PRIMARY KEY,
      learner_id INTEGER NOT NULL DEFAULT 1,
      content_id TEXT NOT NULL REFERENCES contents(id) ON DELETE CASCADE,
      started_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      finished_at TEXT,
      score INTEGER NOT NULL DEFAULT 0,
      n_questions INTEGER NOT NULL DEFAULT 10,
      difficulty INTEGER NOT NULL DEFAULT 2,
      total_xp_earned INTEGER NOT NULL DEFAULT 0
    );
  `);

  try {
    await client.execute(`ALTER TABLE attempts ADD COLUMN difficulty INTEGER NOT NULL DEFAULT 2;`);
  } catch {
    // Ignore if column already exists
  }

  await client.execute(`
    CREATE TABLE IF NOT EXISTS answers (
      id TEXT PRIMARY KEY,
      attempt_id TEXT NOT NULL REFERENCES attempts(id) ON DELETE CASCADE,
      question_id TEXT NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
      chosen_idx INTEGER,
      correct INTEGER NOT NULL DEFAULT 0,
      time_ms INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
  `);

  await client.execute(`
    CREATE TABLE IF NOT EXISTS generation_jobs (
      id TEXT PRIMARY KEY,
      topic_id TEXT,
      wiki_page_id INTEGER NOT NULL,
      wiki_title TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      progress_percent INTEGER NOT NULL DEFAULT 0,
      message TEXT,
      error TEXT,
      content_id TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
  `);

  await client.execute(`
    CREATE TABLE IF NOT EXISTS learner_profile (
      id TEXT PRIMARY KEY,
      learner_id INTEGER NOT NULL DEFAULT 1 UNIQUE,
      total_xp INTEGER NOT NULL DEFAULT 0,
      level INTEGER NOT NULL DEFAULT 1,
      streak_days INTEGER NOT NULL DEFAULT 0,
      last_active_date TEXT,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
  `);
}
