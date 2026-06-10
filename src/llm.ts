// agentpack — LLM provider selection. One ChatOpenAI-compatible client,
// resolved from whichever key is present: OpenAI, Gemini, or Groq.
import { ChatOpenAI } from "@langchain/openai";

export function makeModel(modelOverride?: string): ChatOpenAI {
  if (process.env.OPENAI_API_KEY) {
    return new ChatOpenAI({
      model: modelOverride || process.env.AGENTPACK_MODEL || "gpt-4o-mini",
      temperature: 0,
    });
  }
  if (process.env.GEMINI_API_KEY) {
    return new ChatOpenAI({
      model: modelOverride || process.env.AGENTPACK_MODEL || "gemini-2.5-flash",
      temperature: 0,
      apiKey: process.env.GEMINI_API_KEY,
      configuration: { baseURL: "https://generativelanguage.googleapis.com/v1beta/openai/" },
    });
  }
  if (process.env.GROQ_API_KEY) {
    return new ChatOpenAI({
      model: modelOverride || process.env.AGENTPACK_MODEL || "llama-3.3-70b-versatile",
      temperature: 0,
      apiKey: process.env.GROQ_API_KEY,
      configuration: { baseURL: "https://api.groq.com/openai/v1" },
    });
  }
  throw new Error("[agentpack] no LLM key found — set OPENAI_API_KEY, GEMINI_API_KEY, or GROQ_API_KEY");
}

/** Model tiering: the supervisor needs planning discipline (don't stop until
 * every checklist part is done), so it can run a stronger model; specialists
 * are latency-sensitive tool-callers and stay on the fast tier. */
export function makeSupervisorModel(): ChatOpenAI {
  if (process.env.AGENTPACK_SUPERVISOR_MODEL) return makeModel(process.env.AGENTPACK_SUPERVISOR_MODEL);
  if (!process.env.OPENAI_API_KEY && process.env.GEMINI_API_KEY) return makeModel("gemini-2.5-pro");
  return makeModel();
}

export function hasLlmKey(): boolean {
  return Boolean(process.env.OPENAI_API_KEY || process.env.GEMINI_API_KEY || process.env.GROQ_API_KEY);
}
