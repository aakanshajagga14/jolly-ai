import { NextResponse } from 'next/server';
import { createUpload, processUpload } from '@/lib/server/uploadStore';

const MAX_BYTES = 20 * 1024 * 1024;

export async function POST(request: Request): Promise<NextResponse> {
  try {
    const formData = await request.formData();
    const file = formData.get('file');

    if (!(file instanceof File)) {
      return NextResponse.json({ message: 'No file provided.' }, { status: 400 });
    }

    if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) {
      return NextResponse.json({ message: 'Only PDF files are accepted.' }, { status: 400 });
    }

    if (file.size === 0) {
      return NextResponse.json({ message: 'File is empty.' }, { status: 400 });
    }

    if (file.size > MAX_BYTES) {
      return NextResponse.json({ message: 'File exceeds 20 MB limit.' }, { status: 400 });
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const record = createUpload(file.name);

    // Fire-and-forget — frontend polls /api/upload/:id/status
    void processUpload(record.uploadId, buffer);

    return NextResponse.json({ uploadId: record.uploadId });
  } catch {
    return NextResponse.json({ message: 'Upload failed.' }, { status: 500 });
  }
}
