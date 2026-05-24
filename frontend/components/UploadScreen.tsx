'use client';

import { useCallback, useRef, useState } from 'react';
import type { CaseContext } from '@/types';
import { pollUploadStatus, uploadPdf } from '@/lib/uploadApi';

const MAX_BYTES = 20 * 1024 * 1024;

interface UploadScreenProps {
  onSuccess: (caseContext: CaseContext) => void;
}

export default function UploadScreen({ onSuccess }: UploadScreenProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [statusText, setStatusText] = useState('Harvey is analyzing your case...');

  const validateFile = (file: File): string | null => {
    if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) {
      return 'Only PDF files are accepted.';
    }
    if (file.size === 0) {
      return 'File is empty. Please upload a valid PDF.';
    }
    if (file.size > MAX_BYTES) {
      return 'File exceeds 20 MB limit.';
    }
    return null;
  };

  const processFile = useCallback(
    async (file: File) => {
      const validationError = validateFile(file);
      if (validationError) {
        setError(validationError);
        return;
      }

      setError(null);
      setLoading(true);
      setStatusText('Uploading case discovery PDF...');

      try {
        const { uploadId } = await uploadPdf(file);
        setStatusText('Harvey is analyzing your case...');
        const caseContext = await pollUploadStatus(uploadId);
        onSuccess(caseContext);
      } catch (uploadError) {
        const message =
          uploadError instanceof Error ? uploadError.message : 'Upload failed. Please retry.';
        setError(message);
      } finally {
        setLoading(false);
      }
    },
    [onSuccess]
  );

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) {
      void processFile(file);
    }
  };

  const onBrowse = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      void processFile(file);
    }
  };

  return (
    <div className="pixel-app flex items-center justify-center p-6">
      <div className="pixel-panel w-full max-w-lg p-8">
        <h1 className="pixel-title">JOLLY</h1>
        <p className="pixel-subtitle">Pixel-Art Legal Cross-Examination Simulator</p>

        {loading ? (
          <div className="text-center py-12">
            <p className="text-[8px] leading-loose mb-4">{statusText}</p>
            <p className="pixel-spinner text-[12px]">● ● ●</p>
          </div>
        ) : (
          <div
            className={`pixel-dropzone ${dragOver ? 'drag-over' : ''}`}
            onDragOver={(e) => {
              e.preventDefault();
              setDragOver(true);
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={onDrop}
            onClick={() => inputRef.current?.click()}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                inputRef.current?.click();
              }
            }}
          >
            <p className="text-[8px] leading-loose mb-4">DROP PDF HERE</p>
            <p className="text-[7px] text-[#888] leading-loose">or click to browse</p>
            <p className="text-[6px] text-[#666] mt-4 leading-loose">Max 20 MB · PDF only</p>
            <input
              ref={inputRef}
              type="file"
              accept="application/pdf,.pdf"
              className="hidden"
              onChange={onBrowse}
            />
          </div>
        )}

        {error && <p className="pixel-error">{error}</p>}
      </div>
    </div>
  );
}
