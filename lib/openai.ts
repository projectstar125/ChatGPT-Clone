import OpenAI from 'openai';
export const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY, timeout: 120_000, maxRetries: 2 });
export const MODEL = process.env.OPENAI_MODEL || 'gpt-4o-mini';
export function calculateCost(inputTokens: number, outputTokens: number) {
  const inputRate = Number(process.env.INPUT_PRICE_PER_MILLION ?? '0.15');
  const outputRate = Number(process.env.OUTPUT_PRICE_PER_MILLION ?? '0.60');
  if (![inputRate, outputRate].every((n) => Number.isFinite(n) && n >= 0)) throw new Error('Invalid token pricing configuration');
  return (inputTokens * inputRate + outputTokens * outputRate) / 1_000_000;
}
