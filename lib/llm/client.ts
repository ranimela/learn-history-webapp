import { createOpenAI } from "@ai-sdk/openai";
import { createGoogleGenerativeAI } from "@ai-sdk/google";

/**
 * Returns a configured AI language model based on environment variables.
 * Defaults to OpenAI gpt-4o-mini, with support for Google Gemini.
 */
export function getLanguageModel() {
  const provider = (process.env.LLM_PROVIDER || "openai").toLowerCase();
  const apiKey = process.env.LLM_API_KEY || "";
  const modelName = process.env.LLM_MODEL || (provider === "google" ? "gemini-1.5-flash" : "gpt-4o-mini");

  if (provider === "google") {
    const google = createGoogleGenerativeAI({ apiKey });
    return google(modelName);
  }

  // Default to OpenAI
  const openai = createOpenAI({ apiKey });
  return openai(modelName);
}

export function hasConfiguredApiKey(): boolean {
  return Boolean(process.env.LLM_API_KEY && process.env.LLM_API_KEY.trim() !== "" && process.env.LLM_API_KEY !== "your_api_key_here");
}
