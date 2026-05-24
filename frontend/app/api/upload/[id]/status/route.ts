import { NextResponse } from 'next/server';
import { getUpload } from '@/lib/server/uploadStore';

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const { id } = await context.params;
  const record = getUpload(id);

  if (!record) {
    return NextResponse.json({ message: 'Upload not found.' }, { status: 404 });
  }

  if (record.status === 'error') {
    return NextResponse.json({
      status: 'error',
      message: record.errorMessage ?? 'Analysis failed.',
    });
  }

  if (record.status === 'ready' && record.caseContext) {
    return NextResponse.json({
      status: 'ready',
      caseContext: record.caseContext,
    });
  }

  return NextResponse.json({ status: 'pending' });
}
