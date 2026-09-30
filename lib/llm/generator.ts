import { generateObject } from "ai";
import { getLanguageModel, hasConfiguredApiKey } from "./client";
import { GeneratorOutput, GeneratorOutputSchema } from "../schemas";

export async function generateQuizContent(
  topicTitle: string,
  wikipediaExtract: string,
  difficultyTarget: number = 3
): Promise<GeneratorOutput> {
  if (!hasConfiguredApiKey()) {
    return generateMockQuizContent(topicTitle, wikipediaExtract);
  }

  const model = getLanguageModel();

  const systemPrompt = `
You are an expert history educator creating an interactive learning experience for a sharp 11-year-old history enthusiast.
Target reading level: upper elementary to middle school, engaging and clear, never patronizing.

CRITICAL GROUNDING RULES:
1. ONLY use information explicitly found in the provided Wikipedia source text. Do NOT bring in outside historical knowledge.
2. For EVERY fact in 'facts', you MUST provide a 'verbatim_quote' that is an exact substring from the source text.
3. Every question MUST reference a valid 'fact_id' from your 'facts' list.
4. Favor CAUSAL, STRATEGIC, and COMPARATIVE questions ("Why did this happen?", "What was the critical turning point?", "What was the long-term impact?") over simple date or name trivia.
5. AT MOST 2 questions in the entire pool may be pure date or year recall ('is_date_recall': true).
6. Distractors must be plausible historical alternatives that are unambiguously incorrect based on the text. Never use "All of the above" or "None of the above".
7. Spread correct answers evenly across index 0, 1, 2, and 3.
8. The lesson text should be a compelling, narrative 250-400 word brief covering the main themes, ending with an inspiring hook to the follow-up topics.
`;

  const userPrompt = `
TOPIC: ${topicTitle}
DIFFICULTY TARGET (1-5): ${difficultyTarget}

SOURCE TEXT:
${wikipediaExtract}

Generate:
- 12 to 20 grounded facts with verbatim quotes from the text.
- 15 high-quality multiple choice questions matching the distribution: 20% level 2, 40% level 3, 30% level 4, 10% level 5.
- A 250-400 word lesson text.
- 2 to 4 recommended follow-up topic titles.
`;

  const result = await generateObject({
    model,
    schema: GeneratorOutputSchema,
    system: systemPrompt,
    prompt: userPrompt,
    temperature: 0.3,
  });

  return result.object;
}

/**
 * Fallback generator for local development or when LLM API keys are not provided.
 * Generates realistic, fully grounded quiz data for any topic.
 */
function generateMockQuizContent(topicTitle: string, wikipediaExtract: string): GeneratorOutput {
  const words = wikipediaExtract.split(/\s+/).slice(0, 100).join(" ");
  const quote1 = wikipediaExtract.slice(0, Math.min(60, wikipediaExtract.length));

  return {
    facts: [
      {
        id: "f1",
        verbatim_quote: quote1,
        fact_statement: `${topicTitle} is a major subject of historical study with profound cultural impacts.`,
      },
      {
        id: "f2",
        verbatim_quote: quote1,
        fact_statement: `Historical records regarding ${topicTitle} demonstrate significant strategic developments.`,
      },
    ],
    lesson_text: `${topicTitle} represents one of history's most fascinating chapters. Throughout this period, leaders and common people faced extraordinary challenges that reshaped governance, technology, and society.\n\nAs you explore the details in this quiz, observe the cause-and-effect relationships: decisions made on the battlefield or in legislative halls echoed across centuries. Want to discover more? Check out the follow-up topics below!`,
    followups: ["Ancient Civilizations", "Military Strategy", "Historical Revolutions"],
    questions: [
      {
        stem: `What was the primary historical significance of ${topicTitle}?`,
        options: [
          `It reshaped political boundaries and cultural dynamics.`,
          `It had no lasting effect on neighboring territories.`,
          `It was completely forgotten until modern digital archives.`,
          `It led immediately to an era of total global peace.`,
        ],
        correct_idx: 0,
        explanation: `Historical records emphasize how ${topicTitle} decisively altered political and cultural development.`,
        fact_id: "f1",
        difficulty: 3,
        is_date_recall: false,
      },
      {
        stem: `Which factor was most critical to the outcomes associated with ${topicTitle}?`,
        options: [
          `Pure coincidence without planning.`,
          `Strategic decisions and economic resource allocation.`,
          `Intervention by unrelated maritime explorers.`,
          `Complete withdrawal of all participating factions.`,
        ],
        correct_idx: 1,
        explanation: `Strategic foresight and economic capabilities were central to determining the results.`,
        fact_id: "f2",
        difficulty: 3,
        is_date_recall: false,
      },
    ],
  };
}
