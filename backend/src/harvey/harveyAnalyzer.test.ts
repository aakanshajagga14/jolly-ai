import { parseCaseContext } from './harveyAnalyzer';

describe('parseCaseContext', () => {
  it('parses valid Gemini JSON response', () => {
    const raw = JSON.stringify({
      caseId: 'case-abc',
      summary: 'A theft case.',
      evidenceItems: [{ id: 'e1', description: 'CCTV', relevance: 'high' }],
      keyFacts: ['suspect seen at 9pm'],
      inconsistencies: [{ id: 'i1', description: 'lighting mismatch', involvedFacts: [] }],
    });
    const ctx = parseCaseContext(raw, 'abc.pdf');
    expect(ctx.caseId).toBe('case-abc');
    expect(ctx.evidenceItems).toHaveLength(1);
    expect(ctx.inconsistencies[0].id).toBe('i1');
  });

  it('falls back to filename-based caseId if missing', () => {
    const raw = JSON.stringify({
      summary: 'Case summary',
      evidenceItems: [],
      keyFacts: [],
      inconsistencies: [],
    });
    const ctx = parseCaseContext(raw, 'my-case.pdf');
    expect(ctx.caseId).toBe('case-my-case');
  });

  it('strips markdown code fences from Gemini response', () => {
    const raw = '```json\n{"caseId":"case-x","summary":"s","evidenceItems":[],"keyFacts":[],"inconsistencies":[]}\n```';
    const ctx = parseCaseContext(raw, 'x.pdf');
    expect(ctx.caseId).toBe('case-x');
  });

  it('throws on unparseable response', () => {
    expect(() => parseCaseContext('not json at all { broken', 'x.pdf')).toThrow();
  });
});
