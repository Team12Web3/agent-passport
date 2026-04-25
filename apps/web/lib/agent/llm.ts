import "server-only";
import { openai } from "@ai-sdk/openai";

/**
 * Two-tier model picker.
 *
 *   cheapModel()    → everyday tasks (summarization, classification, extraction).
 *                     Defaults to OPENAI_MODEL_CHEAP, fallback "gpt-4o-mini".
 *
 *   complexModel()  → multi-step reasoning, planning, ambiguous tool selection.
 *                     Defaults to OPENAI_MODEL_COMPLEX, fallback "gpt-5-mini".
 *
 * Override either via env at deploy time — no code change needed when OpenAI
 * ships a cheaper option.
 */
export function cheapModel() {
  return openai(process.env.OPENAI_MODEL_CHEAP ?? "gpt-4o-mini");
}

export function complexModel() {
  return openai(process.env.OPENAI_MODEL_COMPLEX ?? "gpt-5-mini");
}
