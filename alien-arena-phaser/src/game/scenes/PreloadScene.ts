import Phaser from "phaser";

const ASSET_ROOT = "assets/game/kenney";
const ICON_ROOT = "assets/game/icons/lucide";

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

function generateCapsuleTexture(scene: Phaser.Scene, key: string, width: number, height: number, color: number): void {
  const g = scene.add.graphics();
  g.fillStyle(color, 1);
  g.fillRoundedRect(0, 0, width, height, Math.min(width, height) * 0.45);
  g.generateTexture(key, width, height);
  g.destroy();
}

function generateDiamondTexture(scene: Phaser.Scene, key: string, size: number, color: number): void {
  const half = size * 0.5;
  const g = scene.add.graphics();
  g.fillStyle(color, 1);
  g.beginPath();
  g.moveTo(half, 0);
  g.lineTo(size, half);
  g.lineTo(half, size);
  g.lineTo(0, half);
  g.closePath();
  g.fillPath();
  g.generateTexture(key, size, size);
  g.destroy();
}

export class PreloadScene extends Phaser.Scene {
  constructor() {
    super("PreloadScene");
  }

  preload(): void {
    this.load.image("bg_starfield", `${ASSET_ROOT}/background/bg_blue.png`);

    this.load.image("tex_player", `${ASSET_ROOT}/ships/player_main.png`);
    this.load.image("tex_bullet", `${ASSET_ROOT}/bullets/bullet_player.png`);
    this.load.image("tex_enemy_bullet", `${ASSET_ROOT}/bullets/bullet_enemy.png`);

    this.load.image("tex_enemy_crawler", `${ASSET_ROOT}/enemies/enemy_crawler.png`);
    this.load.image("tex_enemy_spitter", `${ASSET_ROOT}/enemies/enemy_spitter.png`);
    this.load.image("tex_enemy_swarmling", `${ASSET_ROOT}/enemies/enemy_swarmling.png`);
    this.load.image("tex_enemy_crusher", `${ASSET_ROOT}/enemies/enemy_crusher.png`);

    this.load.image("tex_pickup_xp", `${ASSET_ROOT}/pickups/pickup_xp.png`);
    this.load.image("tex_pickup_credits", `${ASSET_ROOT}/pickups/pickup_credits.png`);
    this.load.image("tex_pickup_material", `${ASSET_ROOT}/pickups/pickup_material.png`);
    this.load.image("tex_pickup_weapon", `${ASSET_ROOT}/pickups/pickup_weapon.png`);
    this.load.image("tex_pickup_attachment", `${ASSET_ROOT}/pickups/pickup_attachment.png`);

    this.load.image("fx_muzzle", `${ASSET_ROOT}/effects/muzzle_fire.png`);
    this.load.image("fx_hit", `${ASSET_ROOT}/effects/hit_spark.png`);
    this.load.image("fx_levelup", `${ASSET_ROOT}/effects/levelup_shield.png`);
    this.load.image("fx_explosion_a", `${ASSET_ROOT}/effects/explosion_a.png`);
    this.load.image("fx_explosion_b", `${ASSET_ROOT}/effects/explosion_b.png`);
    this.load.image("fx_explosion_c", `${ASSET_ROOT}/effects/explosion_c.png`);

    this.load.image("icon_up_pierce_rounds", `${ICON_ROOT}/crosshair.svg`);
    this.load.image("icon_up_warhead", `${ICON_ROOT}/bomb.svg`);
    this.load.image("icon_up_arc_chain", `${ICON_ROOT}/zap.svg`);
    this.load.image("icon_up_guidance", `${ICON_ROOT}/navigation.svg`);
    this.load.image("icon_up_overdrive", `${ICON_ROOT}/gauge.svg`);
    this.load.image("icon_up_phase_barrier", `${ICON_ROOT}/shield.svg`);
    this.load.image("icon_up_close_quarters", `${ICON_ROOT}/sword.svg`);
    this.load.image("icon_up_overcharge_core", `${ICON_ROOT}/cpu.svg`);
    this.load.image("icon_up_missile_pod", `${ICON_ROOT}/rocket.svg`);
    this.load.image("icon_up_super_weapon", `${ICON_ROOT}/star.svg`);
    this.load.image("icon_up_default", `${ICON_ROOT}/sparkles.svg`);
  }

  create(): void {
    if (!this.textures.exists("tex_player")) {
      generateArrowTexture(this, "tex_player", 0x6ff4df);
    }

    if (!this.textures.exists("tex_bullet")) {
      generateCircleTexture(this, "tex_bullet", 4, 0x79edff);
    }

    if (!this.textures.exists("tex_bullet_vulcan")) {
      generateCapsuleTexture(this, "tex_bullet_vulcan", 8, 14, 0x8ef3ff);
    }

    if (!this.textures.exists("tex_bullet_laser")) {
      generateCapsuleTexture(this, "tex_bullet_laser", 6, 24, 0xc7d8ff);
    }

    if (!this.textures.exists("tex_bullet_quantum")) {
      generateDiamondTexture(this, "tex_bullet_quantum", 14, 0xc9b4ff);
    }

    if (!this.textures.exists("tex_bullet_missile")) {
      generateCapsuleTexture(this, "tex_bullet_missile", 10, 18, 0xffbf8a);
    }

    if (!this.textures.exists("tex_bullet_super")) {
      generateDiamondTexture(this, "tex_bullet_super", 16, 0xfff0a8);
    }

    if (!this.textures.exists("tex_enemy_bullet")) {
      generateCircleTexture(this, "tex_enemy_bullet", 5, 0xff9a5d);
    }

    if (!this.textures.exists("tex_enemy_crawler")) {
      generateCircleTexture(this, "tex_enemy_crawler", 18, 0xff6b80);
    }

    if (!this.textures.exists("tex_enemy_spitter")) {
      generateCircleTexture(this, "tex_enemy_spitter", 18, 0xd784ff);
    }

    if (!this.textures.exists("tex_enemy_swarmling")) {
      generateCircleTexture(this, "tex_enemy_swarmling", 13, 0x7cfa67);
    }

    if (!this.textures.exists("tex_enemy_crusher")) {
      generateCircleTexture(this, "tex_enemy_crusher", 23, 0xe8a95a);
    }

    if (!this.textures.exists("tex_pickup_xp")) {
      generateCircleTexture(this, "tex_pickup_xp", 6, 0x5ad8ff);
    }

    if (!this.textures.exists("tex_pickup_credits")) {
      generateCircleTexture(this, "tex_pickup_credits", 8, 0xffd569);
    }

    if (!this.textures.exists("tex_pickup_material")) {
      generateCircleTexture(this, "tex_pickup_material", 8, 0x8fff8c);
    }

    if (!this.textures.exists("tex_pickup_weapon")) {
      generateCircleTexture(this, "tex_pickup_weapon", 9, 0xffa7ff);
    }

    if (!this.textures.exists("tex_pickup_attachment")) {
      generateCircleTexture(this, "tex_pickup_attachment", 9, 0xbfb8ff);
    }

    if (!this.textures.exists("fx_muzzle")) {
      generateCircleTexture(this, "fx_muzzle", 8, 0xffa45e);
    }

    if (!this.textures.exists("fx_hit")) {
      generateCircleTexture(this, "fx_hit", 9, 0xffef9a);
    }

    if (!this.textures.exists("fx_levelup")) {
      generateCircleTexture(this, "fx_levelup", 20, 0x83f4ff);
    }

    if (!this.textures.exists("fx_explosion_a")) {
      generateCircleTexture(this, "fx_explosion_a", 10, 0xffb86e);
    }

    if (!this.textures.exists("fx_explosion_b")) {
      generateCircleTexture(this, "fx_explosion_b", 13, 0xff7d63);
    }

    if (!this.textures.exists("fx_explosion_c")) {
      generateCircleTexture(this, "fx_explosion_c", 7, 0xfff3aa);
    }

    if (!this.textures.exists("icon_up_pierce_rounds")) {
      generateCircleTexture(this, "icon_up_pierce_rounds", 10, 0xdbeeff);
    }

    if (!this.textures.exists("icon_up_warhead")) {
      generateCircleTexture(this, "icon_up_warhead", 10, 0xffbe94);
    }

    if (!this.textures.exists("icon_up_arc_chain")) {
      generateCircleTexture(this, "icon_up_arc_chain", 10, 0xcfb7ff);
    }

    if (!this.textures.exists("icon_up_guidance")) {
      generateCircleTexture(this, "icon_up_guidance", 10, 0xa9ddff);
    }

    if (!this.textures.exists("icon_up_overdrive")) {
      generateCircleTexture(this, "icon_up_overdrive", 10, 0xffdf9c);
    }

    if (!this.textures.exists("icon_up_phase_barrier")) {
      generateCircleTexture(this, "icon_up_phase_barrier", 10, 0x95f5ff);
    }

    if (!this.textures.exists("icon_up_close_quarters")) {
      generateCircleTexture(this, "icon_up_close_quarters", 10, 0xffb1a0);
    }

    if (!this.textures.exists("icon_up_overcharge_core")) {
      generateCircleTexture(this, "icon_up_overcharge_core", 10, 0xfff1b7);
    }

    if (!this.textures.exists("icon_up_missile_pod")) {
      generateCircleTexture(this, "icon_up_missile_pod", 10, 0xffcf9f);
    }

    if (!this.textures.exists("icon_up_super_weapon")) {
      generateCircleTexture(this, "icon_up_super_weapon", 10, 0xfff0ab);
    }

    if (!this.textures.exists("icon_up_default")) {
      generateCircleTexture(this, "icon_up_default", 10, 0xc5e9ff);
    }

    this.scene.start("MainMenuScene");
  }
}
