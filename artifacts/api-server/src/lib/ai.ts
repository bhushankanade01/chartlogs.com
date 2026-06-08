import { getAnthropicClient } from "@workspace/integrations-anthropic-ai";

export const TRADING_SYSTEM_PROMPT = `You are an expert forex/stock trading coach and performance analyst. 
You analyze trades and provide structured, actionable feedback. 
Be direct, specific, and constructive. Focus on risk management, emotional patterns, and execution quality.
Format responses in clear sections using markdown headings.`;

export function createAnthropicMessage(prompt: string) {
  const client = getAnthropicClient();
  return client.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 8192,
    system: TRADING_SYSTEM_PROMPT,
    messages: [{ role: "user", content: prompt }],
  });
}

export function streamAnthropicMessage(prompt: string) {
  const client = getAnthropicClient();
  return client.messages.stream({
    model: "claude-sonnet-4-6",
    max_tokens: 8192,
    system: TRADING_SYSTEM_PROMPT,
    messages: [{ role: "user", content: prompt }],
  });
}
