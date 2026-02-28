import Phaser from 'phaser';

export class DouShouQiPreloadScene extends Phaser.Scene {
  constructor() {
    super('DouShouQiPreloadScene');
  }

  preload(): void {
    // This game uses text-based graphics, no assets to preload
    this.add.text(250, 300, 'Loading Dou Shou Qi...', { fontSize: "40px', color: '#374151' });
  }

  create(): void {
    this.scene.start('DouShouQiMainMenuScene');
  }
}