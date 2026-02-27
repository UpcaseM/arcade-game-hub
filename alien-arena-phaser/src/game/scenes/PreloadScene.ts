import Phaser from "phaser";

function generateCircleTexture(scene: Phaser.Scene, key: string, radius: number, color: number): void {
  const g = scene.add.graphics();
  g.fillStyle(color, 1);
  g.fillCircle(radius, radius, radius);
  g.generateTexture(key, radius * 2, radius * 2);
  g.destroy();
}

function generateArrowTexture(scene: Phaser.Scene, key: string, color: number): void {
  const g = scene.add.graphics();
  g.fillStyle(color, 1);
  g.fillTriangle(40, 20, 0, 0, 0, 40);
  g.generateTexture(key, 40, 40);
  g.destroy();
}

export class PreloadScene extends Phaser.Scene {
  constructor() {
    super("PreloadScene");
  }

  create(): void {
    generateArrowTexture(this, "tex_player", 0x6ff4df);
    generateCircleTexture(this, "tex_bullet", 4, 0x79edff);
    generateCircleTexture(this, "tex_enemy_bullet", 5, 0xff9a5d);

    generateCircleTexture(this, "tex_enemy_crawler", 18, 0xff6b80);
    generateCircleTexture(this, "tex_enemy_spitter", 18, 0xd784ff);
    generateCircleTexture(this, "tex_enemy_swarmling", 13, 0x7cfa67);
    generateCircleTexture(this, "tex_enemy_crusher", 23, 0xe8a95a);

    generateCircleTexture(this, "tex_pickup_xp", 6, 0x5ad8ff);
    generateCircleTexture(this, "tex_pickup_credits", 8, 0xffd569);
    generateCircleTexture(this, "tex_pickup_material", 8, 0x8fff8c);
    generateCircleTexture(this, "tex_pickup_weapon", 9, 0xffa7ff);
    generateCircleTexture(this, "tex_pickup_attachment", 9, 0xbfb8ff);

    this.scene.start("MainMenuScene");
  }
}
