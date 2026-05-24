import { GoogleGenerativeAI } from '@google/generative-ai';
import type { CaseContext, CoachingHint } from '../types';

const COACHING_TIMEOUT_MS = 2000;

function buildPrompt(
  question: string,
  ctx: CaseContext,
  phase: 'pre-turn' | 'post-turn'
): string {
  return `You are a legal strategist coaching a junior lawyer in a cross-examination.

Case context:
Summary: ${ctx.summary}
Key facts: ${ctx.keyFacts.join('; ')}
Known inconsistencies: ${ctx.inconsistencies.map((i) => i.description).join('; ')}

The lawyer ${phase === 'pre-turn' ? 'is about to ask' : 'just asked'}: "${question}"

Evaluate the strategic strength and respond ONLY with valid JSON (no markdown):
{"strength":"strong"|"moderate"|"weak","suggestion":"one sentence of coaching advice"}`;
}

export async function evaluateQuestion(
  question: string,
  caseContext: CaseContext,
  phase: 'pre-turn' | 'post-turn' = 'pre-turn'
): Promise<CoachingHint | null> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;

  try {
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({
      model: process.env.GEMINI_MODEL ?? 'gemini-1.5-flash',
    });

    const timeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('coaching timeout')), COACHING_TIMEOUT_MS)
    );

    const result = await Promise.race([
      model.generateContent(buildPrompt(question, caseContext, phase)),
      timeoutPromise,
    ]);

    const raw = result.response
      .text()
      .replace(/^```(?:json)?\s*/i, '')
      .replace(/\s*```\s*$/, '')
      .trim();

    const parsed = JSON.parse(raw) as { strength: CoachingHint['strength']; suggestion: string };
    return { strength: parsed.strength, suggestion: parsed.suggestion, phase };
  } catch {
    return null;
  }
}
