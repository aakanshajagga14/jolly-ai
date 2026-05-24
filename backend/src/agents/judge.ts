import { GoogleGenerativeAI } from '@google/generative-ai';
import type { CaseContext, AgentState } from '../types';

export type JudgeRuling = 'none' | 'sustained' | 'overruled' | 'warning' | 'contempt';

export interface JudgeResponse {
  ruling: JudgeRuling;
  text: string;
}

function buildSystemPrompt(ctx: CaseContext): string {
  return `You are the Honorable Judge presiding over a live cross-examination hearing.

Case: ${ctx.caseId}
Background: ${ctx.summary}

You observe every exchange and react as a real judge would — sometimes silent, sometimes interjecting to maintain order, correct counsel, or comment on the proceedings.

ALWAYS begin your response with exactly one of these prefixes:

  (NONE)       — You have nothing to add this turn. Stay silent.
  (OVERRULED) <remark> — Objection overruled OR no objection but you make a brief judicial remark.
  (SUSTAINED) <ruling> — Objection sustained; the question was improper.
  (WARNING) <warning>  — Warn counsel for repeated misconduct or poor courtroom conduct.
  (CONTEMPT) <statement> — Extreme or repeated misconduct; session ends.

WHEN TO USE EACH:

No objection raised:
  - Use (NONE) roughly 55% of the time — let the exchange flow.
  - Use (OVERRULED) with a short authentic remark the other 45%, for example:
      "The witness will please answer the question directly."
      "Counsel, keep your questions focused on the relevant facts."
      "Noted. You may continue."
      "That is a proper line of questioning. Proceed."
      "The court reminds both parties to maintain decorum."
      "Witness, limit your answer to what was asked."
      "Counsel, please rephrase that for clarity."
  - Never repeat the same remark twice.

Witness objects:
  - Rule (SUSTAINED) if the objection is legally valid.
  - Rule (OVERRULED) if the question was proper.

Patience / streak escalation:
  - If patience ≤ 20 or sustained streak ≥ 3: lean toward (WARNING).
  - If patience ≤ 0 or pattern is egregious: use (CONTEMPT).

Style rules:
  - Keep every statement under 2 short sentences.
  - Be authoritative, dry, and measured — never emotional.
  - Never break character as the Judge.
  - Vary your language. Do not repeat phrases.`;
}

function parseRuling(text: string): JudgeRuling {
  if (/^\(CONTEMPT\)/i.test(text)) return 'contempt';
  if (/^\(WARNING\)/i.test(text)) return 'warning';
  if (/^\(SUSTAINED\)/i.test(text)) return 'sustained';
  if (/^\(NONE\)/i.test(text)) return 'none';
  return 'overruled';
}

export class JudgeAgent {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private chat: any = null;

  constructor(private readonly caseContext: CaseContext) {}

  private ensureChat(): void {
    if (this.chat) return;
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);
    const model = genAI.getGenerativeModel({
      model: process.env.GEMINI_MODEL ?? 'gemini-1.5-flash',
      systemInstruction: buildSystemPrompt(this.caseContext),
    });
    this.chat = model.startChat({ history: [] });
  }

  async rule(
    witnessObjection: string | undefined,
    lawyerQuestion: string,
    agentState: AgentState
  ): Promise<JudgeResponse> {
    this.ensureChat();

    const prompt = witnessObjection
      ? `[Patience: ${agentState.judgePatience}/100, sustained streak: ${agentState.sustainedObjectionsInARow}]\nWitness objects on grounds of: "${witnessObjection}"\nTo the lawyer's question: "${lawyerQuestion}"\nRule on this objection.`
      : `[Patience: ${agentState.judgePatience}/100, sustained streak: ${agentState.sustainedObjectionsInARow}]\nNo objection was raised. The lawyer just asked: "${lawyerQuestion}"\nDecide whether to interject with a judicial remark or stay silent.`;

    let raw: string;
    try {
      const result = await this.chat.sendMessage(prompt);
      raw = (result.response.text() as string).trim();
    } catch {
      raw = '(NONE)';
    }

    const ruling = parseRuling(raw);
    const text = raw.replace(/^\((?:SUSTAINED|OVERRULED|WARNING|CONTEMPT|NONE)\)\s*/i, '').trim();
    return { ruling, text };
  }
}
