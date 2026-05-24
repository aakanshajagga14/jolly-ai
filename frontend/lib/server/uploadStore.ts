import type { CaseContext } from '@/types';
import { MOCK_CASE_CONTEXT } from '@/lib/mockData';

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

  setTimeout(() => {
    const current = uploads.get(uploadId);
    if (!current || current.status !== 'pending') return;
    uploads.set(uploadId, {
      ...current,
      status: 'ready',
      caseContext: {
        ...MOCK_CASE_CONTEXT,
        caseId: `case-${fileName.replace(/\.pdf$/i, '')}`,
      },
    });
  }, 2000);

  return record;
}

export function getUpload(uploadId: string): UploadRecord | undefined {
  return uploads.get(uploadId);
}
