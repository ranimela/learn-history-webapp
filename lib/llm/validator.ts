import { generateObject } from "ai";
import { getLanguageModel, hasConfiguredApiKey } from "./client";
import { GeneratorOutput, RawQuestion, ValidatorOutputSchema } from "../schemas";

export interface ValidationResult {
  validFacts: GeneratorOutput["facts"];
  validQuestions: RawQuestion[];
  droppedQuestionsCount: number;
  unverifiedFactQuotes: string[];
}

/**
 * Validates generated content in two stages:
 * 1. Deterministic substring verification: Ensures each fact's verbatim_quote exists in the raw Wikipedia text.
 * 2. LLM question check: Ensures question stems are unambiguous and answer keys are supported.
 */
export async function validateQuizContent(
  generated: GeneratorOutput,
  rawWikipediaExtract: string
): Promise<ValidationResult> {
  const normalizedExtract = rawWikipediaExtract.toLowerCase();

  // Phase 1: Deterministic Code Grounding Check
  const validFactIds = new Set<string>();
  const validFacts: GeneratorOutput["facts"] = [];
  const unverifiedFactQuotes: string[] = [];

  for (const fact of generated.facts) {
    const normalizedQuote = fact.verbatim_quote.trim().toLowerCase();
    // Verify that the quote exists verbatim in the raw source
    if (normalizedExtract.includes(normalizedQuote)) {
      validFactIds.add(fact.id);
      validFacts.push(fact);
    } else {
      unverifiedFactQuotes.push(fact.verbatim_quote);
    }
  }

  // Filter out questions whose facts failed the deterministic grounding check
  let candidateQuestions = generated.questions.filter((q) => {
    // 1. Fact must be deterministically grounded
    if (!validFactIds.has(q.fact_id)) return false;
    // 2. Options must be exactly 4 unique choices
    const uniqueOptions = new Set(q.options.map((o) => o.trim().toLowerCase()));
    if (uniqueOptions.size !== 4) return false;
    // 3. Correct idx must be in bounds
    if (q.correct_idx < 0 || q.correct_idx > 3) return false;
    return true;
  });

  // Phase 2: LLM Distractor & Ambiguity Check (if API key is present)
  if (!hasConfiguredApiKey() || candidateQuestions.length === 0) {
    return {
      validFacts,
      validQuestions: candidateQuestions,
      droppedQuestionsCount: generated.questions.length - candidateQuestions.length,
      unverifiedFactQuotes,
    };
  }

  try {
    const model = getLanguageModel();
    const systemPrompt = `
You are a strict QA validator for history quiz questions.
You will be given a list of grounded facts and a set of candidate multiple-choice questions.

For each question:
1. Verify that the correct option is strictly supported by the associated fact.
2. Verify that there is ONLY ONE correct option among the 4 choices.
3. Verify that the distractors are clearly incorrect.
4. Mark 'ok: true' if the question passes, or 'ok: false' with an explanation of the flaw.
`;

    const userPrompt = `
FACTS:
${JSON.stringify(validFacts, null, 2)}

QUESTIONS TO AUDIT:
${JSON.stringify(
      candidateQuestions.map((q, idx) => ({
        index: idx,
        stem: q.stem,
        options: q.options,
        correct_idx: q.correct_idx,
        fact_id: q.fact_id,
      })),
      null,
      2
    )}
`;

    const audit = await generateObject({
      model,
      schema: ValidatorOutputSchema,
      system: systemPrompt,
      prompt: userPrompt,
      temperature: 0,
    });

    const approvedIndices = new Set(
      audit.object.evaluations.filter((e) => e.ok).map((e) => e.question_index)
    );

    const finalQuestions = candidateQuestions.filter((_, idx) => approvedIndices.has(idx));

    return {
      validFacts,
      validQuestions: finalQuestions,
      droppedQuestionsCount: generated.questions.length - finalQuestions.length,
      unverifiedFactQuotes,
    };
  } catch (err) {
    console.warn("LLM validator pass encountered error, falling back to deterministically verified questions:", err);
    return {
      validFacts,
      validQuestions: candidateQuestions,
      droppedQuestionsCount: generated.questions.length - candidateQuestions.length,
      unverifiedFactQuotes,
    };
  }
}
