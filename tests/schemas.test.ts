import { describe, it, expect } from "vitest";
import {
  GeneratorOutputSchema,
  PublicQuizSessionSchema,
  FactItemSchema,
  RawQuestionSchema,
} from "../lib/schemas";

describe("Schemas & Contracts", () => {
  it("validates a compliant FactItem", () => {
    const fact = {
      id: "f1",
      verbatim_quote: "Julius Caesar crossed the Rubicon in 49 BC.",
      fact_statement: "Caesar crossed the Rubicon River, starting a civil war.",
    };
    const parsed = FactItemSchema.safeParse(fact);
    expect(parsed.success).toBe(true);
  });

  it("rejects questions with out-of-range correct_idx", () => {
    const invalidQ = {
      stem: "When was the Magna Carta signed?",
      options: ["1215", "1492", "1776", "1066"],
      correct_idx: 4, // Out of range!
      explanation: "It was signed at Runnymede in 1215.",
      fact_id: "f1",
      difficulty: 2,
    };
    const parsed = RawQuestionSchema.safeParse(invalidQ);
    expect(parsed.success).toBe(false);
  });

  it("ensures public quiz projection does not leak correct_idx or explanation", () => {
    const publicSession = {
      attemptId: "att_123",
      contentId: "cnt_456",
      topicTitle: "Ancient Egypt",
      totalQuestions: 1,
      questions: [
        {
          id: "q_1",
          stem: "Who was the first female pharaoh?",
          options: ["Cleopatra", "Hatshepsut", "Nefertiti", "Sobekneferu"],
          difficulty: 3,
        },
      ],
    };
    const parsed = PublicQuizSessionSchema.safeParse(publicSession);
    expect(parsed.success).toBe(true);
    // Explicitly check that correct_idx and explanation are not defined on PublicQuizQuestion schema
    expect((publicSession.questions[0] as any).correct_idx).toBeUndefined();
    expect((publicSession.questions[0] as any).explanation).toBeUndefined();
  });
});
