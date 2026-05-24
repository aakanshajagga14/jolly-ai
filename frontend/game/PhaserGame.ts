import Phaser from 'phaser';
import type { EventBus } from '@/types';
import { CourtroomScene, GAME_HEIGHT, GAME_WIDTH } from '@/game/CourtroomScene';

let gameInstance: Phaser.Game | null = null;

export function createPhaserGame(container: HTMLElement, eventBus: EventBus): Phaser.Game {
  destroyPhaserGame();

  gameInstance = new Phaser.Game({
    type: Phaser.AUTO,
    parent: container,
    width: GAME_WIDTH,
    height: GAME_HEIGHT,
    backgroundColor: '#1a1a2e',
    pixelArt: true,
    antialias: false,
    roundPixels: true,
    fps: { target: 30, forceSetTimeOut: false },
    scene: CourtroomScene,
    scale: {
      mode: Phaser.Scale.FIT,
      autoCenter: Phaser.Scale.CENTER_BOTH,
    },
    render: {
      pixelArt: true,
      antialias: false,
      roundPixels: true,
    },
    audio: { noAudio: true },
  });

  gameInstance.scene.start('CourtroomScene', { eventBus });

  container.querySelectorAll('canvas').forEach((canvas) => {
    canvas.style.imageRendering = 'pixelated';
    canvas.style.imageRendering = 'crisp-edges';
  });

  return gameInstance;
}

export function destroyPhaserGame(): void {
  if (gameInstance) {
    gameInstance.destroy(true);
    gameInstance = null;
  }
}
