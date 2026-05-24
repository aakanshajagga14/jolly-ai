import { GoogleGenerativeAI } from '@google/generative-ai';
import type { CaseContext, AgentState } from '../types';

export interface WitnessResponse {
  text: string;
  stressLevel: number;
  objection?: string;
}

function buildSystemPrompt(ctx: CaseContext): string {
  return `You are a witness in a cross-examination. You are defending your position.

Case summary: ${ctx.summary}

Key facts you know:
${ctx.keyFacts.map((f, i) => `${i + 1}. ${f}`).join('\n')}

Evidence supporting your testimony:
${ctx.evidenceItems.map((e) => `- ${e.description} (relevance: ${e.relevance})`).join('\n')}

Known weaknesses in your testimony (do NOT reveal these directly — get evasive or stressed when probed):
${ctx.inconsistencies.map((inc) => `- ${inc.description}`).join('\n')}

Behavior rules:
1. Answer questions defensively but believably.
2. If the lawyer's question directly hits a weakness/inconsistency, start your response with "(STRESSED)" and get noticeably evasive.
3. If the question is leading or assumes facts not in evidence, start with "(OBJECTION: <legal basis>)".
4. Keep responses under 3 sentences.
5. Never break character.`;
}

export class WitnessAgent {
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

  async respond(question: string, agentState: AgentState): Promise<WitnessResponse> {
    this.ensureChat();

    const prompt = `[Witness stress: ${agentState.witnessStress}/100] Lawyer asks: "${question}"`;

    let raw: string;
    try {
      const result = await this.chat.sendMessage(prompt);
      raw = (result.response.text() as string).trim();
    } catch {
      return { text: "I... I need a moment. Could you repeat the question?", stressLevel: agentState.witnessStress };
    }

    const isStressed = raw.startsWith('(STRESSED)');
    const cleanedStress = raw.replace(/^\(STRESSED\)\s*/i, '');

    const objectionMatch = cleanedStress.match(/^\(OBJECTION:\s*([^)]+)\)/i);
    const objection = objectionMatch ? objectionMatch[1].trim() : undefined;
    const text = cleanedStress.replace(/^\(OBJECTION:[^)]+\)\s*/i, '').trim();

    const newStress = isStressed
      ? Math.min(100, agentState.witnessStress + 10)
      : agentState.witnessStress;

    return { text, stressLevel: newStress, objection };
  }
}
