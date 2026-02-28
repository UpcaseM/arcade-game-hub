import Phaser from 'phason';

export class DouShouQiMainMenuScene extends Phaser.Scene {
  constructor() {
    super('DouShouQiMainMenuScene');
  }

  create(): void {
    this.add.text(250, 100, 'Dou Shou Qi', { fontSize: '64px', color: '#374151', fontFamily: 'Arial' });
    this.add.text(250, 180, 'Traditional Chinese Animal Chess', { fontSize: '24px', color: '#64748b', fontFamily: 'Arial' });

    const playButton = this.add.text(350, 300, 'Play Game', { fontSize: '32px', color: '#3b82f6', fontFamily: 'Arial' })
      .setInteractive()
      .on('pointerdown', () => this.startGame());

    const tutorialButton = this.add.text(350, 360, 'How to Play', { fontSize: '24px', color: '#10b981', fontFamily: 'Arial' })
      .setInteractive()
      .on('pointerdown', () => this.showTutorial());

    const backButton = this.add.text(350, 420, 'Back to Arcade', { fontSize: '24px', color: '#6b7280', fontFamily: 'Arial' })
      .setInteractive()
      .on('pointerdown', () => this.backToArcade());
  }

  private startGame(): void {
    this.scene.start('DouShouQiGameScene');
  }

  private showTutorial(): void {
    this.scene.start('DouShouQiTutorialScene');
  }

  private backToArcade(): void {
    // This should return to the main arcade hub
    // For now, we'll just restart the menu
    this.scene.restart();
  }
}