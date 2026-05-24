// eslint-disable-next-line @typescript-eslint/no-require-imports
const pdfParse = require('pdf-parse') as (data: Buffer) => Promise<{ text: string; numpages: number }>;
import type { CaseContext } from '@/types';
import { analyzeDocument } from './harveyAnalyzer';

export type UploadRecordStatus = 'pending' | 'ready' | 'error';

export interface UploadRecord {
  uploadId: string;
  fileName: string;
  status: UploadRecordStatus;
  caseContext?: CaseContext;
  errorMessage?: string;
  createdAt: number;
}

const uploads = new Map<string, UploadRecord>();

export function createUpload(fileName: string): UploadRecord {
  const uploadId = crypto.randomUUID();
  const record: UploadRecord = {
    uploadId,
    fileName,
    status: 'pending',
    createdAt: Date.now(),
  };
  uploads.set(uploadId, record);
  return record;
}

export async function processUpload(uploadId: string, pdfBuffer: Buffer): Promise<void> {
  const record = uploads.get(uploadId);
  if (!record) return;

  console.log(`[Harvey] Starting analysis for "${record.fileName}" (${(pdfBuffer.length / 1024).toFixed(1)} KB)`);

  try {
    const parsed = await pdfParse(pdfBuffer);
    const text = parsed.text?.trim();
    console.log(`[Harvey] PDF parsed — ${parsed.numpages} pages, ${text?.length ?? 0} chars extracted`);

    if (!text || text.length < 50) {
      console.error('[Harvey] ERROR: No readable text found — likely a scanned image PDF');
      uploads.set(uploadId, {
        ...record,
        status: 'error',
        errorMessage:
          'Could not extract text from this PDF. It may be a scanned image. Please upload a text-based PDF.',
      });
      return;
    }

    console.log(`[Harvey] Sending text to Gemini (model: ${process.env.GEMINI_MODEL ?? 'gemini-1.5-flash'})…`);
    const caseContext = await analyzeDocument(text, record.fileName);
    console.log(`[Harvey] ✓ Analysis complete — caseId: ${caseContext.caseId}, facts: ${caseContext.keyFacts.length}, inconsistencies: ${caseContext.inconsistencies.length}`);
    uploads.set(uploadId, { ...record, status: 'ready', caseContext });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Harvey analysis failed.';
    console.error(`[Harvey] ERROR: ${msg}`);
    uploads.set(uploadId, { ...record, status: 'error', errorMessage: msg });
  }
}

export function getUpload(uploadId: string): UploadRecord | undefined {
  return uploads.get(uploadId);
}
