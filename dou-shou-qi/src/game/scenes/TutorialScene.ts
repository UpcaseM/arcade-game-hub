import Phaser from 'phaser';

export class DouShouQiTutorialScene extends Phaser.Scene {
  constructor() {
    super('DouShouQiTutorialScene');
  }

  create(): void {
    this.add.text(250, 50, 'How to Play Dou Shou Qi', { fontSize: '40px', color: '#374151', fontFamily: 'Arial' });

    const tutorialText = `
    Objective:
    - Move any of your animals into the opponent's den to win
    - Or capture all of your opponent's animals

    Animal Ranks (Strongest to Weakest):
    1. Elephant (🐘) - Rank 8
    2. Lion (🦁) - Rank 7
    3. Tiger (🦅) - Rank 6
    4. Leopard (🐆) - Rank 5
    5. Dog (🐕) - Rank 4
    6. Wolf (🐺) - Rank 3
    7. Cat (🐱) - Rank 2
    8. Mouse (🐀) - Rank 1

    Movement Rules:
    - All pieces move one square orthogonally (up, down, left, right)
    - Pieces cannot move diagonally
    - Pieces cannot move into their own den
    - Pieces capture opponent's pieces of equal or lower rank

    Special Rules:
    - Mouse: Only animal that can move on river squares, can capture Elephant
    - Lion/Tiger: Can jump over rivers horizontally or vertically
    - Traps: Any animal can capture a higher-ranked animal in opponent's trap
    `;

    this.add.text(100, 120, tutorialText, { fontSize: "16px', color: '#4b5563', fontFamily: 'Arial', lineSpacing: 4 });

    const backButton = this.add.text(350, 500, 'Back to Menu', { fontSize: '28px', color: '#3b82f6', fontFamily: 'Arial' })
      .setInteractive()
      .on('pointerdown', () => this.backToMenu());
  }

  private backToMenu(): void {
    this.scene.start('DouShouQiMainMenuScene');
  }
}