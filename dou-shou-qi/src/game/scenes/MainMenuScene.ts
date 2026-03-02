import Phaser from 'phaser';
import { loadUiSettings, saveUiSettings } from '../ui/settings';

export class DouShouQiMainMenuScene extends Phaser.Scene {
  constructor() {
    super('DouShouQiMainMenuScene');
  }

  create(): void {
    const settings = loadUiSettings();

    this.add.text(210, 90, 'Dou Shou Qi', { fontSize: '64px', color: '#374151', fontFamily: 'Arial' });
    this.add.text(250, 170, 'Flip Mode / Dark Start', { fontSize: '28px', color: '#64748b', fontFamily: 'Arial' });

    this.add.text(322, 238, 'UX Options', {
      fontFamily: 'Arial',
      fontSize: '26px',
      color: '#0f172a'
    });

    const reducedMotionButton = this.makeToggleButton(278, 272, () => `Reduced Motion: ${settings.reducedMotion ? 'On' : 'Off'}`, () => {
      settings.reducedMotion = !settings.reducedMotion;
      saveUiSettings(settings);
    });

    const colorAssistButton = this.makeToggleButton(278, 312, () => `Color Assist: ${settings.colorAssist ? 'On' : 'Off'}`, () => {
      settings.colorAssist = !settings.colorAssist;
      saveUiSettings(settings);
    });

    const soundButton = this.makeToggleButton(278, 352, () => `Sound: ${settings.sound ? 'On' : 'Off'}`, () => {
      settings.sound = !settings.sound;
      saveUiSettings(settings);
    });

    this.add.existing(reducedMotionButton);
    this.add.existing(colorAssistButton);
    this.add.existing(soundButton);

    this.add.text(334, 414, 'Start Match', { fontSize: '32px', color: '#3b82f6', fontFamily: 'Arial' })
      .setInteractive()
      .on('pointerdown', () => this.startGame());

    this.add.text(338, 476, 'Rules & Tips', { fontSize: '24px', color: '#10b981', fontFamily: 'Arial' })
      .setInteractive()
      .on('pointerdown', () => this.showTutorial());

    this.add.text(350, 540, 'Back to Arcade', { fontSize: '24px', color: '#6b7280', fontFamily: 'Arial' })
      .setInteractive()
      .on('pointerdown', () => this.backToArcade());
  }

  private makeToggleButton(
    x: number,
    y: number,
    getLabel: () => string,
    onToggle: () => void
  ): Phaser.GameObjects.Text {
    const text = this.add.text(x, y, getLabel(), {
      fontFamily: 'Arial',
      fontSize: '21px',
      color: '#1d4ed8',
      backgroundColor: '#dbeafe',
      padding: { x: 8, y: 4 }
    });

    text.setInteractive({ useHandCursor: true });
    text.on('pointerdown', () => {
      onToggle();
      text.setText(getLabel());
    });

    return text;
  }

  private startGame(): void {
    this.scene.start('DouShouQiGameScene');
  }

  private showTutorial(): void {
    this.scene.start('DouShouQiTutorialScene');
  }

  private backToArcade(): void {
    this.scene.restart();
  }
}
