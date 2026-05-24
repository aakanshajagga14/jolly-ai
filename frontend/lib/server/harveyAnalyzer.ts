import { GoogleGenerativeAI } from '@google/generative-ai';
import type { CaseContext } from '@/types';

const HARVEY_PROMPT = `You are Harvey, a legal case analyst. Analyze the following case document text and return ONLY valid JSON (no markdown, no code fences) matching this exact structure:
{
  "caseId": "case-<short-slug>",
  "summary": "2-3 sentence case summary",
  "evidenceItems": [
    { "id": "ev-1", "description": "...", "relevance": "high|medium|low" }
  ],
  "keyFacts": ["fact 1", "fact 2"],
  "inconsistencies": [
    { "id": "inc-1", "description": "...", "involvedFacts": ["fact 1"] }
  ]
}

Document text:
`;

const ANALYSIS_TIMEOUT_MS = 30_000;

function parseCaseContext(rawJson: string, fileName: string): CaseContext {
  const cleaned = rawJson
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```\s*$/, '')
    .trim();

  let parsed: Partial<CaseContext>;
  try {
    parsed = JSON.parse(cleaned) as Partial<CaseContext>;
  } catch {
    throw new Error(`Harvey returned unparseable JSON: ${cleaned.slice(0, 200)}`);
  }

  const slug = fileName
    .replace(/\.pdf$/i, '')
    .replace(/\s+/g, '-')
    .toLowerCase();

  return {
    caseId: parsed.caseId ?? `case-${slug}`,
    summary: parsed.summary ?? '',
    evidenceItems: parsed.evidenceItems ?? [],
    keyFacts: parsed.keyFacts ?? [],
    inconsistencies: parsed.inconsistencies ?? [],
  };
}

export async function analyzeDocument(pdfText: string, fileName: string): Promise<CaseContext> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error('GEMINI_API_KEY is not set on the server');

  const model = process.env.GEMINI_MODEL ?? 'gemini-1.5-flash';
  const genAI = new GoogleGenerativeAI(apiKey);
  const gemini = genAI.getGenerativeModel({ model });

  const timeoutPromise = new Promise<never>((_, reject) =>
    setTimeout(
      () => reject(new Error('Harvey analysis timed out after 30s')),
      ANALYSIS_TIMEOUT_MS
    )
  );

  const analysisPromise = gemini
    .generateContent(HARVEY_PROMPT + pdfText)
    .then((result) => result.response.text());

  const rawJson = await Promise.race([analysisPromise, timeoutPromise]);
  return parseCaseContext(rawJson, fileName);
}
