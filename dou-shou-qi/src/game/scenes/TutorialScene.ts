import Phaser from 'phaser';
import { bindLegacyViewport } from '../ui/legacySceneViewport';

export class DouShouQiTutorialScene extends Phaser.Scene {
  constructor() {
    super('DouShouQiTutorialScene');
  }

  create(): void {
    bindLegacyViewport(this);

    this.add.text(230, 44, 'Dou Shou Qi - Flip Mode Rules', {
      fontSize: '38px',
      color: '#e2e8f0',
      fontFamily: 'Arial'
    });

    const tutorialText = [
      'Board & Start:',
      '- 4x4 board, all 16 pieces start face-down and randomly placed.',
      '- On your turn you may flip one hidden piece OR move one of your revealed pieces.',
      '',
      'Color Assignment:',
      '- The first flipped piece determines that player\'s color.',
      '- The other player gets the opposite color.',
      '',
      'Move & Capture:',
      '- Move exactly 1 step orthogonally (no diagonal moves).',
      '- You can only move your own revealed pieces.',
      '- Hidden pieces cannot be moved or captured until revealed.',
      '- Capture rule: higher rank captures lower rank; equal rank eliminates both pieces.',
      '- Special: Mouse can capture Elephant; Elephant cannot capture Mouse.',
      '',
      'Win:',
      '- Capture all opponent-color pieces, or',
      '- Opponent has no legal action (no hidden piece to flip and no legal move).',
      '',
      'Tip: In opening, flipping for information is often stronger than random movement.'
    ].join('\n');

    this.add.text(88, 110, tutorialText, {
      fontSize: '19px',
      color: '#cbd5e1',
      fontFamily: 'Arial',
      lineSpacing: 6
    });

    const backButton = this.add.text(430, 612, 'Back to Menu', {
      fontSize: '28px',
      color: '#0f172a',
      fontFamily: 'Arial',
      backgroundColor: '#93c5fd',
      padding: { x: 12, y: 8 }
    });
    backButton.setInteractive({ useHandCursor: true });
    backButton.on('pointerdown', () => this.scene.start('DouShouQiMainMenuScene'));
  }
}
