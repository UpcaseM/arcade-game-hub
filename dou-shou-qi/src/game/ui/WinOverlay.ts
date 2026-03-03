import Phaser from 'phaser';
import { PlayerIdentity } from './theme';

export class WinOverlay {
  private readonly scene: Phaser.Scene;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
  }

  show(options: {
    winnerText: string;
    summary: string;
    winnerIdentity?: PlayerIdentity;
    reducedMotion: boolean;
    onReplay: () => void;
    onMenu: () => void;
  }): void {
    const sceneWidth = this.scene.scale.width;
    const sceneHeight = this.scene.scale.height;
    const isMobile = sceneWidth <= 860 || sceneHeight > sceneWidth;

    const centerX = sceneWidth / 2;
    const centerY = sceneHeight / 2;
    const panelWidth = Math.min(500, sceneWidth - 32);
    const panelHeight = isMobile ? 250 : 260;

    const dimmer = this.scene.add.rectangle(centerX, centerY, sceneWidth, sceneHeight, 0x020617, 0.74);
    dimmer.setDepth(30);

    const panel = this.scene.add.rectangle(centerX, centerY + 8, panelWidth, panelHeight, 0x0f172a, 0.96);
    panel.setStrokeStyle(3, options.winnerIdentity?.primaryColor ?? 0x38bdf8, 1);
    panel.setDepth(31);

    const title = this.scene.add.text(centerX, centerY - 58, options.winnerText, {
      fontFamily: 'Arial',
      fontSize: isMobile ? '36px' : '44px',
      color: options.winnerIdentity?.textColor ?? '#e2e8f0',
      wordWrap: { width: panelWidth - 30 },
      align: 'center'
    });
    title.setOrigin(0.5);
    title.setDepth(32);

    const summary = this.scene.add.text(centerX, centerY - 10, options.summary, {
      fontFamily: 'Arial',
      fontSize: isMobile ? '16px' : '19px',
      color: '#cbd5e1',
      wordWrap: { width: panelWidth - 36 },
      align: 'center'
    });
    summary.setOrigin(0.5);
    summary.setDepth(32);

    const replay = this.scene.add.text(centerX, centerY + 42, 'Play Again', {
      fontFamily: 'Arial',
      fontSize: isMobile ? '26px' : '30px',
      color: '#f8fafc',
      backgroundColor: '#2563eb',
      padding: { x: 14, y: 8 }
    });
    replay.setOrigin(0.5);
    replay.setDepth(32);
    replay.setInteractive({ useHandCursor: true });
    replay.on('pointerdown', options.onReplay);

    const menu = this.scene.add.text(centerX, centerY + (isMobile ? 94 : 98), 'Back to Menu', {
      fontFamily: 'Arial',
      fontSize: isMobile ? '22px' : '24px',
      color: '#111827',
      backgroundColor: '#e2e8f0',
      padding: { x: 12, y: 7 }
    });
    menu.setOrigin(0.5);
    menu.setDepth(32);
    menu.setInteractive({ useHandCursor: true });
    menu.on('pointerdown', options.onMenu);

    if (options.reducedMotion) {
      return;
    }

    panel.setScale(0.9);
    panel.setAlpha(0);
    title.setAlpha(0);
    summary.setAlpha(0);
    replay.setAlpha(0);
    menu.setAlpha(0);

    this.scene.tweens.add({ targets: panel, scale: 1, alpha: 1, duration: 220, ease: 'Back.easeOut' });
    this.scene.tweens.add({ targets: [title, summary], alpha: 1, duration: 180, delay: 110 });
    this.scene.tweens.add({ targets: [replay, menu], alpha: 1, duration: 180, delay: 220 });
  }
}
