import Anthropic from "@anthropic-ai/sdk";

export const AI_AVAILABLE = !!process.env.ANTHROPIC_API_KEY;

export const anthropic: Anthropic | null = AI_AVAILABLE
  ? new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
  : null;

export function getAnthropicClient(): Anthropic {
  if (!anthropic) {
    throw new Error("ANTHROPIC_API_KEY is not configured. Add it to your secrets to enable AI features.");
  }
  return anthropic;
}
