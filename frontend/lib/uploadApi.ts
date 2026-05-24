import type {
  CaseContext,
  SessionStartRequest,
  SessionStartResponse,
  UploadResponse,
  UploadStatusResponse,
} from '@/types';

const POLL_INTERVAL_MS = 800;
const MAX_POLL_ATTEMPTS = 40;

export async function uploadPdf(file: File): Promise<UploadResponse> {
  const formData = new FormData();
  formData.append('file', file);

  const response = await fetch('/api/upload', {
    method: 'POST',
    body: formData,
  });

  if (!response.ok) {
    const body = (await response.json().catch(() => ({}))) as { message?: string };
    throw new Error(body.message ?? 'Upload failed.');
  }

  return response.json() as Promise<UploadResponse>;
}

export async function pollUploadStatus(uploadId: string): Promise<CaseContext> {
  for (let attempt = 0; attempt < MAX_POLL_ATTEMPTS; attempt += 1) {
    const response = await fetch(`/api/upload/${uploadId}/status`);

    if (!response.ok) {
      throw new Error('Failed to check upload status.');
    }

    const body = (await response.json()) as UploadStatusResponse;

    if (body.status === 'error') {
      throw new Error(body.message ?? 'Harvey could not analyze this PDF.');
    }

    if (body.status === 'ready' && body.caseContext) {
      return body.caseContext;
    }

    await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
  }

  throw new Error('Harvey analysis timed out. Please try again.');
}

export async function startSession(caseContext: CaseContext): Promise<SessionStartResponse> {
  const payload: SessionStartRequest = { caseContext };
  const response = await fetch('/api/session/start', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const body = (await response.json().catch(() => ({}))) as { message?: string };
    throw new Error(body.message ?? 'Failed to start session.');
  }

  return response.json() as Promise<SessionStartResponse>;
}
