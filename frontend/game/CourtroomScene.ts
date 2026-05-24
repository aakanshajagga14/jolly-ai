import Phaser from 'phaser';
import type {
  AgentResponseMessage,
  AnimationCmdMessage,
  AnimationTarget,
  AnimationType,
  EventBus,
  SttFinalMessage,
} from '@/types';
import {
  CHARACTER_ANCHORS,
  COURTROOM_BG_KEY,
  COURTROOM_BG_PATH,
  GAME_HEIGHT,
  GAME_WIDTH,
  MARKER_COLORS,
} from '@/game/constants';
import { SpeechBubble } from '@/game/SpeechBubble';

type CharacterMarker = {
  ring: Phaser.GameObjects.Ellipse;
  homeX: number;
  homeY: number;
  state: AnimationType;
  bobTween: Phaser.Tweens.Tween | null;
  shakeTween: Phaser.Tweens.Tween | null;
  pulseTween: Phaser.Tweens.Tween | null;
};

export class CourtroomScene extends Phaser.Scene {
  private eventBus: EventBus | null = null;
  private sprites: Partial<Record<AnimationTarget, CharacterMarker>> = {};
  private bubbles: Partial<Record<AnimationTarget, SpeechBubble>> = {};
  private background: Phaser.GameObjects.Image | null = null;

  private onAnimationCmd = (msg: AnimationCmdMessage) => {
    this.transitionState(msg.target, msg.animation);
  };

  private onAgentResponse = (msg: AgentResponseMessage) => {
    const target: AnimationTarget = msg.speaker;
    const anchor = CHARACTER_ANCHORS[target];
    this.bubbles[target]?.show(anchor.bubble.x, anchor.bubble.y, msg.text, anchor.tail);
  };

  private onSttFinal = (msg: SttFinalMessage) => {
    const anchor = CHARACTER_ANCHORS.lawyer;
    this.bubbles.lawyer?.show(anchor.bubble.x, anchor.bubble.y, msg.text, anchor.tail);
  };

  constructor() {
    super({ key: 'CourtroomScene' });
  }

  init(data: { eventBus?: EventBus }): void {
    this.eventBus = data.eventBus ?? null;
  }

  preload(): void {
    this.load.image(COURTROOM_BG_KEY, COURTROOM_BG_PATH);
  }

  create(): void {
    const { width, height } = this.scale;

    // Center the background so overflow clips symmetrically on both sides
    this.background = this.add.image(width / 2, height / 2, COURTROOM_BG_KEY).setOrigin(0.5, 0.5);
    const scaleX = width  / this.background.width;
    const scaleY = height / this.background.height;
    this.background.setScale(Math.max(scaleX, scaleY));

    (['lawyer', 'witness', 'judge'] as AnimationTarget[]).forEach((target) => {
      const anchor = CHARACTER_ANCHORS[target];
      this.bubbles[target] = new SpeechBubble(this);
      this.sprites[target] = this.createMarker(anchor.x, anchor.y, MARKER_COLORS[target]);
    });

    this.cameras.main.setZoom(1);
    this.bindEventBus();
  }

  shutdown(): void {
    this.unbindEventBus();
    Object.values(this.sprites).forEach((sprite) => {
      if (!sprite) return;
      sprite.bobTween?.stop();
      sprite.shakeTween?.stop();
      sprite.pulseTween?.stop();
    });
    Object.values(this.bubbles).forEach((bubble) => bubble?.hide());
  }

  private bindEventBus(): void {
    this.eventBus?.on('animation_cmd', this.onAnimationCmd);
    this.eventBus?.on('agent_response', this.onAgentResponse);
    this.eventBus?.on('stt_final', this.onSttFinal);
  }

  private unbindEventBus(): void {
    this.eventBus?.off('animation_cmd', this.onAnimationCmd);
    this.eventBus?.off('agent_response', this.onAgentResponse);
    this.eventBus?.off('stt_final', this.onSttFinal);
  }

  private createMarker(x: number, y: number, color: number): CharacterMarker {
    const ring = this.add
      .ellipse(x, y - 40, 36, 50, color, 0)
      .setStrokeStyle(3, color, 0)
      .setDepth(50);

    return {
      ring,
      homeX: x,
      homeY: y - 40,
      state: 'idle',
      bobTween: null,
      shakeTween: null,
      pulseTween: null,
    };
  }

  private getMarker(target: AnimationTarget): CharacterMarker | undefined {
    return this.sprites[target];
  }

  private clearMotion(sprite: CharacterMarker): void {
    sprite.bobTween?.stop();
    sprite.bobTween = null;
    sprite.shakeTween?.stop();
    sprite.shakeTween = null;
    sprite.pulseTween?.stop();
    sprite.pulseTween = null;
    sprite.ring.setPosition(sprite.homeX, sprite.homeY);
    sprite.ring.setAlpha(0);
    sprite.ring.setStrokeStyle(3, sprite.ring.strokeColor, 0);
  }

  private transitionState(target: AnimationTarget, nextState: AnimationType): void {
    const sprite = this.getMarker(target);
    if (!sprite) return;

    if (sprite.state === nextState && nextState !== 'gavel-slam') {
      return;
    }

    sprite.state = nextState;
    this.clearMotion(sprite);

    if (nextState === 'idle') {
      this.bubbles[target]?.hide();
    }

    this.playStateAnimation(sprite, target, nextState);
  }

  private playStateAnimation(
    sprite: CharacterMarker,
    target: AnimationTarget,
    animation: AnimationType
  ): void {
    const color = MARKER_COLORS[target];

    switch (animation) {
      case 'idle':
        break;
      case 'talking':
        sprite.ring.setStrokeStyle(3, color, 0.85);
        sprite.pulseTween = this.tweens.add({
          targets: sprite.ring,
          alpha: { from: 0.35, to: 0.75 },
          duration: 300,
          yoyo: true,
          repeat: -1,
        });
        sprite.bobTween = this.tweens.add({
          targets: sprite.ring,
          y: sprite.homeY - 6,
          duration: 280,
          yoyo: true,
          repeat: -1,
          ease: 'Sine.easeInOut',
        });
        break;
      case 'stressed':
        sprite.ring.setStrokeStyle(3, color, 0.9);
        sprite.shakeTween = this.tweens.add({
          targets: sprite.ring,
          x: sprite.homeX + 4,
          duration: 60,
          yoyo: true,
          repeat: -1,
        });
        break;
      case 'very-stressed':
        sprite.ring.setStrokeStyle(4, 0xff0000, 1);
        sprite.shakeTween = this.tweens.add({
          targets: sprite.ring,
          x: sprite.homeX + 8,
          duration: 40,
          yoyo: true,
          repeat: -1,
        });
        break;
      case 'gavel-slam': {
        const judgeAnchor = CHARACTER_ANCHORS.judge;
        const gavel = this.add
          .rectangle(judgeAnchor.x + 40, judgeAnchor.y - 30, 14, 6, 0x8b5a2b)
          .setDepth(60);
        this.tweens.add({
          targets: gavel,
          y: judgeAnchor.y - 10,
          duration: 90,
          yoyo: true,
          ease: 'Quad.easeIn',
          onComplete: () => {
            gavel.destroy();
            sprite.state = 'idle';
          },
        });
        break;
      }
      case 'zoom-in': {
        const judgeAnchor = CHARACTER_ANCHORS.judge;
        this.cameras.main.pan(judgeAnchor.x, judgeAnchor.y, 400);
        this.cameras.main.zoomTo(1.35, 600);
        break;
      }
      case 'contempt': {
        const judgeAnchor = CHARACTER_ANCHORS.judge;
        sprite.state = 'contempt';
        this.cameras.main.pan(judgeAnchor.x, judgeAnchor.y, 400);
        this.cameras.main.zoomTo(1.5, 500);
        this.tweens.add({
          targets: sprite.ring,
          alpha: { from: 0.2, to: 1 },
          duration: 120,
          yoyo: true,
          repeat: 3,
          onYoyo: () => sprite.ring.setStrokeStyle(4, 0xff0000, 1),
          onComplete: () => sprite.ring.setStrokeStyle(3, color, 0),
        });
        break;
      }
    }
  }
}

export { GAME_WIDTH, GAME_HEIGHT };
