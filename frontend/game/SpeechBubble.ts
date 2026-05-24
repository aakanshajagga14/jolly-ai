import Phaser from 'phaser';

type TailDirection = 'left' | 'right' | 'center';

export class SpeechBubble {
  private scene: Phaser.Scene;
  private container: Phaser.GameObjects.Container | null = null;
  private hideTimer: Phaser.Time.TimerEvent | null = null;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
  }

  show(x: number, y: number, message: string, tail: TailDirection, autoHideMs = 4500): void {
    this.hide();

    const padding = 10;
    const maxTextWidth = 210;

    const label = this.scene.add.text(0, 0, message, {
      fontFamily: '"Press Start 2P", monospace',
      fontSize: '7px',
      color: '#eaeaea',
      wordWrap: { width: maxTextWidth },
      lineSpacing: 6,
    });

    const boxWidth = label.width + padding * 2;
    const boxHeight = label.height + padding * 2;
    const boxLeft = -boxWidth / 2;
    const boxTop = -boxHeight;

    const graphics = this.scene.add.graphics();
    graphics.fillStyle(0x16213e, 0.95);
    graphics.fillRect(boxLeft, boxTop, boxWidth, boxHeight);
    graphics.lineStyle(2, 0xeaeaea, 1);
    graphics.strokeRect(boxLeft, boxTop, boxWidth, boxHeight);
    graphics.lineStyle(2, 0x4a6fa5, 1);
    graphics.strokeRect(boxLeft + 2, boxTop + 2, boxWidth - 4, boxHeight - 4);

    this.drawTail(graphics, boxLeft, boxTop, boxWidth, boxHeight, tail);

    label.setPosition(boxLeft + padding, boxTop + padding);

    this.container = this.scene.add.container(x, y, [graphics, label]);
    this.container.setDepth(100);

    if (autoHideMs > 0) {
      this.hideTimer = this.scene.time.delayedCall(autoHideMs, () => this.hide());
    }
  }

  hide(): void {
    this.hideTimer?.remove(false);
    this.hideTimer = null;
    this.container?.destroy(true);
    this.container = null;
  }

  private drawTail(
    graphics: Phaser.GameObjects.Graphics,
    boxLeft: number,
    boxTop: number,
    boxWidth: number,
    boxHeight: number,
    tail: TailDirection
  ): void {
    const bottom = boxTop + boxHeight;
    let tipX = 0;

    if (tail === 'left') {
      tipX = boxLeft + boxWidth * 0.25;
    } else if (tail === 'right') {
      tipX = boxLeft + boxWidth * 0.75;
    }

    graphics.fillStyle(0x16213e, 0.95);
    graphics.fillTriangle(tipX - 6, bottom, tipX + 6, bottom, tipX, bottom + 10);
    graphics.lineStyle(2, 0xeaeaea, 1);
    graphics.lineBetween(tipX - 6, bottom, tipX, bottom + 10);
    graphics.lineBetween(tipX + 6, bottom, tipX, bottom + 10);
  }
}
