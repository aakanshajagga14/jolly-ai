import type { AnimationTarget } from '@/types';

/**
 * Native game resolution.
 * Source image: 1024×558 px.  Scale factor applied by CourtroomScene: 540/558 = 0.9677.
 * All anchor/bubble coords below are in post-scale game space (960×540).
 */
export const GAME_WIDTH  = 960;
export const GAME_HEIGHT = 540;

/**
 * Character anchor points calibrated to the pixel-art courtroom image.
 *
 * Background is rendered centered (origin 0.5, 0.5) at game center (480, 270).
 * Rendered size: 1024×0.9677 = 990 wide, 558×0.9677 = 540 tall.
 * Horizontal overflow: (990-960)/2 = 15 px per side → image x-offset = −15 in game space.
 *
 * Conversion: game_x = image_x × 0.9677 − 15,  game_y = image_y × 0.9677
 *
 *   lawyer  — standing prosecution attorney, left table  image(256, 375) → game(233, 363)
 *   witness — seated person at right witness/defense desk image(716, 343) → game(678, 332)
 *   judge   — gray-haired judge at elevated center bench  image(513, 148) → game(481, 143)
 *
 * The ring ellipse is drawn at anchor.y − 40, placing it over the character's head/torso.
 * Speech bubbles appear above the character; tail direction indicates which side the speaker is on.
 */
export const CHARACTER_ANCHORS: Record<
  AnimationTarget,
  { x: number; y: number; bubble: { x: number; y: number }; tail: 'left' | 'right' | 'center' }
> = {
  lawyer:  { x: 233, y: 363, bubble: { x: 233, y: 242 }, tail: 'left'   },
  witness: { x: 678, y: 332, bubble: { x: 700, y: 227 }, tail: 'right'  },
  judge:   { x: 481, y: 143, bubble: { x: 481, y: 79  }, tail: 'center' },
};

export const MARKER_COLORS: Record<AnimationTarget, number> = {
  lawyer:  0x4a9eff, // blue  — prosecution
  witness: 0xff4a6e, // red   — witness under pressure
  judge:   0xf5c842, // gold  — presiding judge
};

export const COURTROOM_BG_KEY  = 'courtroom-bg';
export const COURTROOM_BG_PATH = '/assets/courtroom-bg.png';
