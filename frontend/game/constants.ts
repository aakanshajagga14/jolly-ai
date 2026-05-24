import type { AnimationTarget } from '@/types';

/** Native game resolution — matches courtroom-bg.png aspect ratio */
export const GAME_WIDTH = 960;
export const GAME_HEIGHT = 540;

/** Character anchor points calibrated to courtroom-bg.png */
export const CHARACTER_ANCHORS: Record<
  AnimationTarget,
  { x: number; y: number; bubble: { x: number; y: number }; tail: 'left' | 'right' | 'center' }
> = {
  lawyer: { x: 228, y: 398, bubble: { x: 228, y: 290 }, tail: 'left' },
  witness: { x: 688, y: 322, bubble: { x: 710, y: 235 }, tail: 'right' },
  judge: { x: 478, y: 182, bubble: { x: 478, y: 108 }, tail: 'center' },
};

export const MARKER_COLORS: Record<AnimationTarget, number> = {
  lawyer: 0x0f3460,
  witness: 0xe94560,
  judge: 0xf5a623,
};

export const COURTROOM_BG_KEY = 'courtroom-bg';
export const COURTROOM_BG_PATH = '/assets/courtroom-bg.png';
