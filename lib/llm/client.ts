import { createOpenAI } from "@ai-sdk/openai";
import { createGoogleGenerativeAI } from "@ai-sdk/google";

/**
 * Returns a configured AI language model based on environment variables.
 * Defaults to Google Gemini (gemini-1.5-flash), with support for OpenAI.
 */
export function getLanguageModel() {
  const provider = (process.env.LLM_PROVIDER || "google").toLowerCase();
  const apiKey = process.env.LLM_API_KEY || process.env.GEMINI_API_KEY || "";
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
  const key = process.env.LLM_API_KEY || process.env.GEMINI_API_KEY || "";
  return Boolean(key && key.trim() !== "" && key !== "your_api_key_here");
}
