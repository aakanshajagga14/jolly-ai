'use client';

import { useEffect, useRef } from 'react';
import type { EventBus } from '@/types';
import { ErrorBoundary } from '@/components/ErrorBoundary';

interface PhaserCanvasProps {
  eventBus: EventBus;
}

export default function PhaserCanvas({ eventBus }: PhaserCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) {
      return;
    }

    let cancelled = false;

    const boot = async () => {
      const { createPhaserGame, destroyPhaserGame } = await import('@/game/PhaserGame');
      if (cancelled) {
        return;
      }
      createPhaserGame(container, eventBus);
    };

    void boot();

    return () => {
      cancelled = true;
      void import('@/game/PhaserGame').then(({ destroyPhaserGame }) => destroyPhaserGame());
    };
  }, [eventBus]);

  return (
    <ErrorBoundary fallbackTitle="Canvas failed to load">
      <div ref={containerRef} className="phaser-host flex-1" />
    </ErrorBoundary>
  );
}
