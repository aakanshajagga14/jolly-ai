'use client';

import { useCallback, useState } from 'react';
import UploadScreen from '@/components/UploadScreen';
import SessionScreen from '@/components/SessionScreen';
import SummaryScreen from '@/components/SummaryScreen';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import type { AppScreen, CaseContext, SessionSummary } from '@/types';

export default function JollyApp() {
  const [screen, setScreen] = useState<AppScreen>('upload');
  const [caseContext, setCaseContext] = useState<CaseContext | null>(null);
  const [summary, setSummary] = useState<SessionSummary | null>(null);
  const [resetKey, setResetKey] = useState(0);

  const handleUploadSuccess = useCallback((ctx: CaseContext) => {
    setCaseContext(ctx);
    setSummary(null);
    setScreen('session');
  }, []);

  const handleSessionEnd = useCallback((sessionSummary: SessionSummary) => {
    setSummary(sessionSummary);
    setScreen('summary');
  }, []);

  const handlePlayAgain = useCallback(() => {
    setCaseContext(null);
    setSummary(null);
    setScreen('upload');
    setResetKey((value) => value + 1);
  }, []);

  return (
    <ErrorBoundary
      key={resetKey}
      fallbackTitle="Jolly encountered an error"
      onReset={handlePlayAgain}
    >
      {screen === 'upload' && <UploadScreen onSuccess={handleUploadSuccess} />}

      {screen === 'session' && caseContext && (
        <SessionScreen caseContext={caseContext} onSessionEnd={handleSessionEnd} />
      )}

      {screen === 'summary' && summary && (
        <SummaryScreen summary={summary} onPlayAgain={handlePlayAgain} />
      )}
    </ErrorBoundary>
  );
}
