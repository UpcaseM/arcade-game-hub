import Phaser from "phaser";
import { AudioManager } from "../../core/audio";
import { craft, addAttachment, addMaterial, addWeapon, canCraft, syncAttachmentOwnership } from "../../core/inventory";
import { clamp, distSq, formatSeconds, smoothAngle } from "../../core/math";
import { SeededRng, randomInt, randomRange } from "../../core/random";
import { gameState } from "../../core/state";
import { computePlayerBaseFromModifiers, computeWeaponFinalStats, collectModifiers } from "../../core/stats";
import { WaveScheduler } from "../../core/waveScheduler";
import { choiceWeighted } from "../../core/weighted";
import { getXpRequired } from "../../core/xp";
import {
  ATTACHMENT_DEFS,
  CRAFT_RECIPES,
  DROP_TABLES,
  ENEMY_DEFS,
  LEVEL_DEFS,
  MATERIAL_LABELS,
  UPGRADE_DEFS,
  WEAPON_DEFS
} from "../../data/gameData";
import type { EnemyDef, MaterialId, UpgradeDef, WeaponInstance } from "../../data/types";
import {
  EVENT_COMMAND_CLOSE_CRAFT,
  EVENT_COMMAND_CLOSE_INVENTORY,
  EVENT_COMMAND_CRAFT,
  EVENT_COMMAND_DETACH_ATTACHMENT,
  EVENT_COMMAND_EQUIP_ATTACHMENT,
  EVENT_COMMAND_EQUIP_WEAPON,
  EVENT_COMMAND_PAUSE_EXIT,
  EVENT_COMMAND_PAUSE_MAIN_MENU,
  EVENT_COMMAND_PAUSE_RESUME,
  EVENT_COMMAND_RESULT_LEVELS,
  EVENT_COMMAND_RESULT_MAIN_MENU,
  EVENT_COMMAND_RESULT_NEXT,
  EVENT_COMMAND_UPGRADE_PICK,
  EVENT_CRAFT_REFRESH,
  EVENT_HIDE_RESULT,
  EVENT_HIDE_UPGRADE,
  EVENT_HUD_UPDATE,
  EVENT_INVENTORY_REFRESH,
  EVENT_PAUSE_SET,
  EVENT_SHOW_RESULT,
  EVENT_SHOW_UPGRADE,
  EVENT_TOAST
} from "../events";

type PauseReason = null | "pause" | "upgrade" | "inventory" | "craft" | "result";

type BulletMeta = {
  lifeMs: number;
  damage: number;
  critChance: number;
  critDamage: number;
  trailTickMs: number;
  trailIntervalMs: number;
  trailTint: number;
  trailScale: number;
  impactTint: number;
  impactCritTint: number;
  impactScale: number;
  pierceLeft: number;
  splashRadius: number;
  splashDamageMul: number;
  homingStrength: number;
  homingTickMs: number;
  knockback: number;
  chainChance: number;
  chainDamageMul: number;
  isPlayerBullet: boolean;
  sourceWeaponId: string;
  splitLeft: number;
};

type EnemyMeta = {
  def: EnemyDef;
  hp: number;
  maxHp: number;
  attackCooldownMs: number;
  chargeCooldownMs: number;
  dashMs: number;
  dashX: number;
  dashY: number;
  hitFlashMs: number;
};

type PickupMeta =
  | { type: "xp"; xp: number; lifeMs: number }
  | { type: "credits"; amount: number; lifeMs: number }
  | { type: "material"; materialId: MaterialId; qty: number; lifeMs: number }
  | { type: "weapon"; weaponId: string; level: number; rarity: WeaponInstance["rarity"]; lifeMs: number }
  | { type: "attachment"; attachmentId: string; lifeMs: number };

type EnemyVisualMeta = {
  key: string;
  scale: number;
  bodySize: number;
  hitFxScale: number;
};

type PickupVisualMeta = {
  key: string;
  scale: number;
  bodySize: number;
};

type WeaponFxProfile = {
  bulletScaleMul: number;
  bulletBodyMul: number;
  bulletTint: number;
  bulletBlendMode: Phaser.BlendModes;
  trailTint: number;
  trailScale: number;
  trailIntervalMs: number;
  muzzleTint: number;
  muzzleScaleMul: number;
  impactTint: number;
  impactCritTint: number;
  impactScaleMul: number;
};

type CombatPerks = {
  pierce: number;
  splashRadius: number;
  splashDamageMul: number;
  homingStrength: number;
  chainChance: number;
  chainDamageMul: number;
  overdriveRateMul: number;
  knockbackMul: number;
};

type CoreUpgradeStacks = {
  pierce: number;
  warhead: number;
  arc: number;
  guidance: number;
  overdrive: number;
  closeQuarters: number;
  overcharge: number;
  total: number;
};

type SingularityMeta = {
  x: number;
  y: number;
  lifeMs: number;
  radius: number;
  pull: number;
  tickMs: number;
  damage: number;
  tint: number;
};

const weaponById = Object.fromEntries(WEAPON_DEFS.map(item => [item.id, item]));
const attachmentById = Object.fromEntries(ATTACHMENT_DEFS.map(item => [item.id, item]));
const enemyById = Object.fromEntries(ENEMY_DEFS.map(item => [item.id, item]));
const levelById = Object.fromEntries(LEVEL_DEFS.map(item => [item.id, item]));
const upgradeById = Object.fromEntries(UPGRADE_DEFS.map(item => [item.id, item]));

const PLAYER_SCALE = 0.56;
const PLAYER_BODY_SIZE = 32;
const PLAYER_FORWARD_OFFSET = 28;
const PLAYER_FORWARD_ROTATION_OFFSET = -Math.PI / 2;

const PLAYER_BULLET_SCALE = 0.68;
const PLAYER_BULLET_BODY_SIZE = 8;
const ENEMY_BULLET_SCALE = 0.72;
const ENEMY_BULLET_BODY_SIZE = 8;

const ENEMY_VISUALS: Record<string, EnemyVisualMeta> = {
  crawler: { key: "tex_enemy_crawler", scale: 0.62, bodySize: 32, hitFxScale: 0.5 },
  spitter: { key: "tex_enemy_spitter", scale: 0.62, bodySize: 32, hitFxScale: 0.52 },
  swarmling: { key: "tex_enemy_swarmling", scale: 0.52, bodySize: 24, hitFxScale: 0.4 },
  crusher: { key: "tex_enemy_crusher", scale: 0.4, bodySize: 46, hitFxScale: 0.72 }
};

const PICKUP_VISUALS: Record<PickupMeta["type"], PickupVisualMeta> = {
  xp: { key: "tex_pickup_xp", scale: 0.64, bodySize: 16 },
  credits: { key: "tex_pickup_credits", scale: 0.66, bodySize: 16 },
  material: { key: "tex_pickup_material", scale: 0.66, bodySize: 16 },
  weapon: { key: "tex_pickup_weapon", scale: 0.7, bodySize: 18 },
  attachment: { key: "tex_pickup_attachment", scale: 0.7, bodySize: 18 }
};

function pickupVisual(type: PickupMeta["type"]): PickupVisualMeta {
  return PICKUP_VISUALS[type];
}

function enemyVisual(enemyId: string): EnemyVisualMeta {
  return ENEMY_VISUALS[enemyId] || ENEMY_VISUALS.crawler;
}

function weaponFxProfile(weaponId: string): WeaponFxProfile {
  if (weaponId === "tempest_minigun") {
    return {
      bulletScaleMul: 0.78,
      bulletBodyMul: 0.82,
      bulletTint: 0x9bffcf,
      bulletBlendMode: Phaser.BlendModes.ADD,
      trailTint: 0x6cf9bf,
      trailScale: 0.22,
      trailIntervalMs: 26,
      muzzleTint: 0xadffd6,
      muzzleScaleMul: 0.78,
      impactTint: 0x9dffd5,
      impactCritTint: 0xe6fff2,
      impactScaleMul: 0.78
    };
  }

  if (weaponId === "nova_smg") {
    return {
      bulletScaleMul: 0.88,
      bulletBodyMul: 0.9,
      bulletTint: 0x97ffc8,
      bulletBlendMode: Phaser.BlendModes.ADD,
      trailTint: 0x68f7b3,
      trailScale: 0.24,
      trailIntervalMs: 36,
      muzzleTint: 0xa4ffcd,
      muzzleScaleMul: 0.84,
      impactTint: 0x9fffd0,
      impactCritTint: 0xffffff,
      impactScaleMul: 0.85
    };
  }

  if (weaponId === "arc_shotgun") {
    return {
      bulletScaleMul: 1.08,
      bulletBodyMul: 1.12,
      bulletTint: 0xffd987,
      bulletBlendMode: Phaser.BlendModes.ADD,
      trailTint: 0xffc56f,
      trailScale: 0.3,
      trailIntervalMs: 58,
      muzzleTint: 0xffbf76,
      muzzleScaleMul: 1.15,
      impactTint: 0xffd58f,
      impactCritTint: 0xfff3d4,
      impactScaleMul: 1.2
    };
  }

  if (weaponId === "rail_lancer") {
    return {
      bulletScaleMul: 1.34,
      bulletBodyMul: 1.26,
      bulletTint: 0xb9cbff,
      bulletBlendMode: Phaser.BlendModes.SCREEN,
      trailTint: 0x91b2ff,
      trailScale: 0.38,
      trailIntervalMs: 22,
      muzzleTint: 0xb7c9ff,
      muzzleScaleMul: 1.34,
      impactTint: 0xc8d6ff,
      impactCritTint: 0xffffff,
      impactScaleMul: 1.45
    };
  }

  if (weaponId === "plasma_carbine") {
    return {
      bulletScaleMul: 1.02,
      bulletBodyMul: 1.02,
      bulletTint: 0x81fff5,
      bulletBlendMode: Phaser.BlendModes.ADD,
      trailTint: 0x66f7f0,
      trailScale: 0.32,
      trailIntervalMs: 34,
      muzzleTint: 0x8ffff8,
      muzzleScaleMul: 1.06,
      impactTint: 0x9bfff5,
      impactCritTint: 0xd9fff9,
      impactScaleMul: 1.2
    };
  }

  if (weaponId === "seeker_launcher") {
    return {
      bulletScaleMul: 1.18,
      bulletBodyMul: 1.2,
      bulletTint: 0xffb38f,
      bulletBlendMode: Phaser.BlendModes.ADD,
      trailTint: 0xff9d78,
      trailScale: 0.34,
      trailIntervalMs: 40,
      muzzleTint: 0xffbf98,
      muzzleScaleMul: 1.24,
      impactTint: 0xffc0a0,
      impactCritTint: 0xffeadb,
      impactScaleMul: 1.34
    };
  }

  if (weaponId === "quantum_splitter") {
    return {
      bulletScaleMul: 1.06,
      bulletBodyMul: 1.04,
      bulletTint: 0xb2a0ff,
      bulletBlendMode: Phaser.BlendModes.ADD,
      trailTint: 0xa48bff,
      trailScale: 0.32,
      trailIntervalMs: 30,
      muzzleTint: 0xc6b4ff,
      muzzleScaleMul: 1.14,
      impactTint: 0xc6b0ff,
      impactCritTint: 0xf0e7ff,
      impactScaleMul: 1.24
    };
  }

  if (weaponId === "sunlance_cannon") {
    return {
      bulletScaleMul: 1.42,
      bulletBodyMul: 1.32,
      bulletTint: 0xffdf9b,
      bulletBlendMode: Phaser.BlendModes.SCREEN,
      trailTint: 0xffd18a,
      trailScale: 0.4,
      trailIntervalMs: 18,
      muzzleTint: 0xffe3aa,
      muzzleScaleMul: 1.5,
      impactTint: 0xffe0b2,
      impactCritTint: 0xfff2d7,
      impactScaleMul: 1.58
    };
  }

  if (weaponId === "void_blaster") {
    return {
      bulletScaleMul: 1.18,
      bulletBodyMul: 1.12,
      bulletTint: 0xe1a3ff,
      bulletBlendMode: Phaser.BlendModes.ADD,
      trailTint: 0xd18bff,
      trailScale: 0.36,
      trailIntervalMs: 32,
      muzzleTint: 0xf0b7ff,
      muzzleScaleMul: 1.22,
      impactTint: 0xe2afff,
      impactCritTint: 0xffdcff,
      impactScaleMul: 1.34
    };
  }

  return {
    bulletScaleMul: 1,
    bulletBodyMul: 1,
    bulletTint: 0x8aeaff,
    bulletBlendMode: Phaser.BlendModes.ADD,
    trailTint: 0x73dcff,
    trailScale: 0.28,
    trailIntervalMs: 46,
    muzzleTint: 0x8ef2ff,
    muzzleScaleMul: 1,
    impactTint: 0xa3f2ff,
    impactCritTint: 0xe8ffff,
    impactScaleMul: 1
  };
}

function emptyCombatPerks(): CombatPerks {
  return {
    pierce: 0,
    splashRadius: 0,
    splashDamageMul: 0,
    homingStrength: 0,
    chainChance: 0,
    chainDamageMul: 0,
    overdriveRateMul: 0,
    knockbackMul: 1
  };
}

export class GameScene extends Phaser.Scene {
  private audio = new AudioManager();

  private level = LEVEL_DEFS[0];
  private scheduler!: WaveScheduler;
  private rng = new SeededRng(Date.now());

  private player!: Phaser.Physics.Arcade.Image;
  private playerHp = 0;
  private playerMaxHp = 0;
  private playerXp = 0;
  private playerXpToNext = 0;
  private playerLevel = 1;
  private playerMoveSpeed = 0;
  private playerPickupRange = 0;
  private playerCritChance = 0;
  private playerCritDamage = 0;
  private playerIFrameMs = 0;
  private killHealCounter = 0;

  private activeUpgradeIds: string[] = [];
  private activeUpgrades: UpgradeDef[] = [];

  private elapsedMs = 0;
  private kills = 0;
  private pauseReason: PauseReason = null;
  private queuedLevelUps = 0;

  private weapon!: WeaponInstance;
  private weaponStats!: ReturnType<typeof computeWeaponFinalStats>;
  private weaponAmmo = 0;
  private weaponCooldownMs = 0;
  private weaponReloadMs = 0;
  private triggerHoldMs = 0;
  private combatPerks: CombatPerks = emptyCombatPerks();

  private playerBullets!: Phaser.Physics.Arcade.Group;
  private enemyBullets!: Phaser.Physics.Arcade.Group;
  private enemies!: Phaser.Physics.Arcade.Group;
  private pickups!: Phaser.Physics.Arcade.Group;

  private bulletMeta = new Map<Phaser.Physics.Arcade.Image, BulletMeta>();
  private enemyMeta = new Map<Phaser.Physics.Arcade.Image, EnemyMeta>();
  private pickupMeta = new Map<Phaser.Physics.Arcade.Image, PickupMeta>();

  private keyW!: Phaser.Input.Keyboard.Key;
  private keyA!: Phaser.Input.Keyboard.Key;
  private keyS!: Phaser.Input.Keyboard.Key;
  private keyD!: Phaser.Input.Keyboard.Key;
  private keyUp!: Phaser.Input.Keyboard.Key;
  private keyDown!: Phaser.Input.Keyboard.Key;
  private keyLeft!: Phaser.Input.Keyboard.Key;
  private keyRight!: Phaser.Input.Keyboard.Key;
  private keyEsc!: Phaser.Input.Keyboard.Key;
  private keyI!: Phaser.Input.Keyboard.Key;
  private keyC!: Phaser.Input.Keyboard.Key;
  private keyF2!: Phaser.Input.Keyboard.Key;
  private keyF3!: Phaser.Input.Keyboard.Key;
  private keyF4!: Phaser.Input.Keyboard.Key;
  private keyF5!: Phaser.Input.Keyboard.Key;
  private keyF6!: Phaser.Input.Keyboard.Key;
  private keyF7!: Phaser.Input.Keyboard.Key;
  private keyF8!: Phaser.Input.Keyboard.Key;

  private qaMode = false;
  private qaOverlay?: Phaser.GameObjects.Text;
  private inputStallMs = 0;
  private rawUp = false;
  private rawDown = false;
  private rawLeft = false;
  private rawRight = false;
  private autoPausedByVisibility = false;

  private pendingUpgradeOptions: Array<{ id: string; name: string; description: string }> | null = null;
  private upgradeUiLastEmitMs = 0;
  private upgradePauseStartedMs = 0;
  private debugEvents: string[] = [];
  private qaPickupCount = 0;
  private qaLastPickupType = "-";
  private qaAutoMove = false;
  private qaAutoDirX = 1;
  private qaAutoDirY = 0;
  private qaAutoNextTurnMs = 0;
  private qaAutoStallMs = 0;
  private moveIntentX = 0;
  private moveIntentY = 0;
  private lastPlayerX = 0;
  private lastPlayerY = 0;
  private motionStallMs = 0;
  private pickupUpdateTick = 0;
  private enemyUpdateTick = 0;

  private saveDirty = false;
  private saveLastFlushMs = 0;

  private runEnded = false;
  private nextLevelId: string | null = null;
  private runCreditsEarned = 0;
  private runMaterialsEarned: Record<MaterialId, number> = {
    scrap: 0,
    alloy: 0,
    core: 0,
    quantum: 0
  };

  private setupDone = false;
  private singularities: SingularityMeta[] = [];
  private upgradeAuraPulseMs = 0;

  constructor() {
    super("GameScene");
  }

  create(): void {
    this.level = levelById[gameState.selectedLevelId] || LEVEL_DEFS[0];
    this.scheduler = new WaveScheduler(this.level.waves);
    this.rng = new SeededRng(Date.now());

    syncAttachmentOwnership(gameState.saveData.inventory);

    this.cameras.main.setBackgroundColor(0x030814);

    const world = this.level.mapSize;
    this.physics.world.setBounds(0, 0, world.width, world.height);
    this.cameras.main.setBounds(0, 0, world.width, world.height);

    this.createArenaGrid(world.width, world.height);

    this.createGroups();
    this.physics.world.resume();
    this.createPlayer(world.width * 0.5, world.height * 0.5);
    this.createCollisions();
    this.createInput();

    this.activeUpgradeIds = [];
    this.activeUpgrades = [];

    this.playerXp = 0;
    this.playerLevel = 1;
    this.playerXpToNext = getXpRequired(1);
    this.elapsedMs = 0;
    this.kills = 0;
    this.queuedLevelUps = 0;
    this.pauseReason = null;
    this.runEnded = false;
    this.nextLevelId = null;
    this.runCreditsEarned = 0;
    this.runMaterialsEarned = { scrap: 0, alloy: 0, core: 0, quantum: 0 };
    this.saveDirty = false;
    this.saveLastFlushMs = this.time.now;
    this.inputStallMs = 0;
    this.pendingUpgradeOptions = null;
    this.upgradeUiLastEmitMs = 0;
    this.upgradePauseStartedMs = 0;
    this.debugEvents = [];
    this.qaPickupCount = 0;
    this.qaLastPickupType = "-";
    this.qaAutoMove = false;
    this.qaAutoDirX = 1;
    this.qaAutoDirY = 0;
    this.qaAutoNextTurnMs = 0;
    this.qaAutoStallMs = 0;
    this.moveIntentX = 0;
    this.moveIntentY = 0;
    this.lastPlayerX = world.width * 0.5;
    this.lastPlayerY = world.height * 0.5;
    this.motionStallMs = 0;
    this.pickupUpdateTick = 0;
    this.enemyUpdateTick = 0;
    this.rawUp = false;
    this.rawDown = false;
    this.rawLeft = false;
    this.rawRight = false;
    this.autoPausedByVisibility = false;
    this.singularities = [];
    this.upgradeAuraPulseMs = 0;

    this.syncLoadout();
    this.refreshDerivedStats();

    this.weaponAmmo = this.weaponStats.magazineSize;
    this.weaponCooldownMs = 0;
    this.weaponReloadMs = 0;
    this.triggerHoldMs = 0;

    this.audio.setVolume(gameState.saveData.options.masterVolume);

    this.bindCommands();
    this.ensureUiSceneActive();
    this.initQaMode();
    this.prepareKeyboardFocus();

    this.setupDone = true;
    this.refreshHud();
    this.emitInventory(false);
    this.emitCraft(false);

    this.input.once("pointerdown", () => {
      this.audio.ensureContext().then(() => this.audio.startBgm()).catch(() => {});
    });
  }

  private createArenaGrid(width: number, height: number): void {
    const bg = this.add.tileSprite(0, 0, width, height, "bg_starfield");
    bg.setOrigin(0, 0);
    bg.setScrollFactor(1);
    bg.setDepth(-20);
    bg.setAlpha(0.4);
    bg.setTint(0x84b7ff);

    const g = this.add.graphics();
    g.fillStyle(0x020611, 0.78);
    g.fillRect(0, 0, width, height);

    g.lineStyle(1, 0x2f4f86, 0.18);

    for (let x = 0; x <= width; x += 120) {
      g.moveTo(x, 0);
      g.lineTo(x, height);
    }

    for (let y = 0; y <= height; y += 120) {
      g.moveTo(0, y);
      g.lineTo(width, y);
    }

    g.strokePath();
    g.lineStyle(2, 0x7498db, 0.38);
    g.strokeRect(1, 1, width - 2, height - 2);
  }

  private createGroups(): void {
    this.playerBullets = this.physics.add.group({
      classType: Phaser.Physics.Arcade.Image,
      maxSize: 500,
      runChildUpdate: false
    });

    this.enemyBullets = this.physics.add.group({
      classType: Phaser.Physics.Arcade.Image,
      maxSize: 260,
      runChildUpdate: false
    });

    this.enemies = this.physics.add.group({
      classType: Phaser.Physics.Arcade.Image,
      maxSize: 320,
      runChildUpdate: false
    });

    this.pickups = this.physics.add.group({
      classType: Phaser.Physics.Arcade.Image,
      maxSize: 320,
      runChildUpdate: false
    });
  }

  private createPlayer(x: number, y: number): void {
    this.player = this.physics.add.image(x, y, "tex_player");
    this.player.setScale(PLAYER_SCALE);
    this.player.setDepth(6);
    this.player.setCollideWorldBounds(true);
    this.player.setDamping(false);
    this.player.setDrag(0, 0);
    this.player.setMaxVelocity(320, 320);
    this.player.setOrigin(0.5, 0.5);

    const body = this.player.body as Phaser.Physics.Arcade.Body;
    body.setSize(PLAYER_BODY_SIZE, PLAYER_BODY_SIZE, true);
    body.setBounce(0, 0);

    this.cameras.main.startFollow(this.player, true, 0.11, 0.11);
  }

  private createCollisions(): void {
    this.physics.add.overlap(this.playerBullets, this.enemies, (bulletObj, enemyObj) => {
      const bullet = bulletObj as Phaser.Physics.Arcade.Image;
      const enemy = enemyObj as Phaser.Physics.Arcade.Image;
      this.handlePlayerBulletEnemyHit(bullet, enemy);
    });

    this.physics.add.overlap(this.enemyBullets, this.player, bulletObj => {
      const bullet = bulletObj as Phaser.Physics.Arcade.Image;
      this.handleEnemyBulletPlayerHit(bullet);
    });

    this.physics.add.overlap(this.pickups, this.player, (objA, objB) => {
      const candidateA = objA as Phaser.Physics.Arcade.Image;
      const candidateB = objB as Phaser.Physics.Arcade.Image;
      const pickup = this.pickupMeta.has(candidateA) ? candidateA : this.pickupMeta.has(candidateB) ? candidateB : null;

      if (!pickup) {
        this.pushDebugEvent("pickup:resolve-miss");
        return;
      }

      this.collectPickup(pickup);
    });
  }

  private createInput(): void {
    const keyboard = this.input.keyboard;

    this.keyW = keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.W);
    this.keyA = keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.A);
    this.keyS = keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.S);
    this.keyD = keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.D);
    this.keyUp = keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.UP);
    this.keyDown = keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.DOWN);
    this.keyLeft = keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.LEFT);
    this.keyRight = keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.RIGHT);

    this.keyEsc = keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.ESC);
    this.keyI = keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.I);
    this.keyC = keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.C);
    this.keyF2 = keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.F2);
    this.keyF3 = keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.F3);
    this.keyF4 = keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.F4);
    this.keyF5 = keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.F5);
    this.keyF6 = keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.F6);
    this.keyF7 = keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.F7);
    this.keyF8 = keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.F8);
  }

  private bindCommands(): void {
    const events = this.game.events;

    events.on(EVENT_COMMAND_UPGRADE_PICK, this.onUpgradePick, this);
    events.on(EVENT_COMMAND_PAUSE_RESUME, this.onPauseResume, this);
    events.on(EVENT_COMMAND_PAUSE_EXIT, this.onPauseExit, this);
    events.on(EVENT_COMMAND_PAUSE_MAIN_MENU, this.onPauseMainMenu, this);

    events.on(EVENT_COMMAND_EQUIP_WEAPON, this.onEquipWeapon, this);
    events.on(EVENT_COMMAND_EQUIP_ATTACHMENT, this.onEquipAttachment, this);
    events.on(EVENT_COMMAND_DETACH_ATTACHMENT, this.onDetachAttachment, this);
    events.on(EVENT_COMMAND_CRAFT, this.onCraft, this);
    events.on(EVENT_COMMAND_CLOSE_INVENTORY, this.onCloseInventory, this);
    events.on(EVENT_COMMAND_CLOSE_CRAFT, this.onCloseCraft, this);

    events.on(EVENT_COMMAND_RESULT_NEXT, this.onResultNext, this);
    events.on(EVENT_COMMAND_RESULT_LEVELS, this.onResultLevels, this);
    events.on(EVENT_COMMAND_RESULT_MAIN_MENU, this.onResultMainMenu, this);

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      events.off(EVENT_COMMAND_UPGRADE_PICK, this.onUpgradePick, this);
      events.off(EVENT_COMMAND_PAUSE_RESUME, this.onPauseResume, this);
      events.off(EVENT_COMMAND_PAUSE_EXIT, this.onPauseExit, this);
      events.off(EVENT_COMMAND_PAUSE_MAIN_MENU, this.onPauseMainMenu, this);

      events.off(EVENT_COMMAND_EQUIP_WEAPON, this.onEquipWeapon, this);
      events.off(EVENT_COMMAND_EQUIP_ATTACHMENT, this.onEquipAttachment, this);
      events.off(EVENT_COMMAND_DETACH_ATTACHMENT, this.onDetachAttachment, this);
      events.off(EVENT_COMMAND_CRAFT, this.onCraft, this);
      events.off(EVENT_COMMAND_CLOSE_INVENTORY, this.onCloseInventory, this);
      events.off(EVENT_COMMAND_CLOSE_CRAFT, this.onCloseCraft, this);

      events.off(EVENT_COMMAND_RESULT_NEXT, this.onResultNext, this);
      events.off(EVENT_COMMAND_RESULT_LEVELS, this.onResultLevels, this);
      events.off(EVENT_COMMAND_RESULT_MAIN_MENU, this.onResultMainMenu, this);
      this.input.off("pointerdown", this.handlePointerFocus, this);
      this.input.keyboard?.off("keydown", this.onKeyboardDown, this);
      window.removeEventListener("blur", this.onWindowBlur);
      window.removeEventListener("focus", this.onWindowFocus);
      window.removeEventListener("keydown", this.onWindowKeyDownCapture);
      window.removeEventListener("keyup", this.onWindowKeyUpCapture);
      document.removeEventListener("visibilitychange", this.onVisibilityChange);
      this.flushPendingSave(true);
      this.qaOverlay?.destroy();
      this.qaOverlay = undefined;
    });
  }

  update(_time: number, delta: number): void {
    if (!this.setupDone || this.runEnded) {
      return;
    }

    const stepMs = Math.min(delta, 50);

    if (this.input.keyboard && !this.input.keyboard.enabled) {
      this.input.keyboard.enabled = true;
    }

    this.updateQaAutoPilot(stepMs);
    this.handleHotkeys();

    if (this.pauseReason) {
      this.maintainUpgradeOverlay();
      this.refreshHud();
      this.flushPendingSave();
      this.updateQaOverlay(stepMs);
      return;
    }

    this.elapsedMs += stepMs;
    this.playerIFrameMs = Math.max(0, this.playerIFrameMs - stepMs);

    this.processSpawns();
    this.updatePlayer(stepMs);
    this.updateWeapon(stepMs);
    this.updateBullets(stepMs);
    this.updateEnemies(stepMs);
    this.updateSingularities(stepMs);
    this.updatePickups(stepMs);
    this.updateUpgradeAuraFx(stepMs);
    this.guardMotionStall(stepMs);

    this.checkLevelUpQueue();
    this.checkMissionResult();

    this.refreshHud();
    this.flushPendingSave();
    this.updateQaOverlay(stepMs);
  }

  private handleHotkeys(): void {
    if (Phaser.Input.Keyboard.JustDown(this.keyEsc)) {
      if (this.pauseReason === "upgrade" || this.pauseReason === "result") {
        return;
      }

      if (this.pauseReason === "pause") {
        this.setPause(null);
      } else {
        this.setPause("pause");
      }
    }

    if (Phaser.Input.Keyboard.JustDown(this.keyI)) {
      if (this.pauseReason === "upgrade" || this.pauseReason === "result") {
        return;
      }

      if (this.pauseReason === "inventory") {
        this.setPause(null);
        this.emitInventory(false);
      } else {
        this.setPause("inventory");
        this.emitInventory(true);
      }
    }

    if (Phaser.Input.Keyboard.JustDown(this.keyC)) {
      if (this.pauseReason === "upgrade" || this.pauseReason === "result") {
        return;
      }

      if (this.pauseReason === "craft") {
        this.setPause(null);
        this.emitCraft(false);
      } else {
        this.setPause("craft");
        this.emitCraft(true);
      }
    }

    if (Phaser.Input.Keyboard.JustDown(this.keyF2)) {
      this.gainXp(120);
      this.game.events.emit(EVENT_TOAST, "Debug XP +120");
    }

    if (Phaser.Input.Keyboard.JustDown(this.keyF3)) {
      addMaterial(gameState.saveData.inventory, "scrap", 20);
      addMaterial(gameState.saveData.inventory, "alloy", 6);
      addMaterial(gameState.saveData.inventory, "core", 2);
      addAttachment(gameState.saveData.inventory, "chip_focus");
      addWeapon(gameState.saveData.inventory, "plasma_carbine", 1, "rare");
      syncAttachmentOwnership(gameState.saveData.inventory);
      gameState.persistSave();
      this.syncLoadout();
      this.refreshDerivedStats();
      this.emitInventory(this.pauseReason === "inventory");
      this.emitCraft(this.pauseReason === "craft");
      this.game.events.emit(EVENT_TOAST, "Debug loot granted.");
    }

    if (Phaser.Input.Keyboard.JustDown(this.keyF4)) {
      this.spawnQaStressDrops();
      this.game.events.emit(EVENT_TOAST, "QA: spawned stress drop cluster");
    }

    if (Phaser.Input.Keyboard.JustDown(this.keyF5)) {
      this.qaForceCollectBurst();
      this.game.events.emit(EVENT_TOAST, "QA forced pickup burst");
    }

    if (Phaser.Input.Keyboard.JustDown(this.keyF6)) {
      this.setQaAutoMove(!this.qaAutoMove);
    }

    if (Phaser.Input.Keyboard.JustDown(this.keyF7)) {
      this.forceUnstick("hotkey");
      this.game.events.emit(EVENT_TOAST, "QA unstick executed");
    }

    if (Phaser.Input.Keyboard.JustDown(this.keyF8)) {
      this.dumpQaSnapshot();
    }
  }

  private setPause(reason: PauseReason): void {
    this.pauseReason = reason;
    this.pushDebugEvent(`pause:${reason || "none"}`);
    this.game.events.emit(EVENT_PAUSE_SET, reason === "pause");

    if (reason) {
      this.physics.world.pause();
      this.triggerHoldMs = 0;
      this.player.setAcceleration(0, 0);
      this.player.setVelocity(0, 0);
    } else {
      this.physics.world.resume();
    }

    if (reason !== "inventory") {
      this.emitInventory(false);
    }

    if (reason !== "craft") {
      this.emitCraft(false);
    }
  }

  private processSpawns(): void {
    const events = this.scheduler.advance(this.elapsedMs);

    for (let index = 0; index < events.length; index += 1) {
      const event = events[index];
      this.spawnEnemy(event.enemyId, event.spawnPattern);
    }
  }

  private spawnEnemy(enemyId: string, pattern: "edgeRandom" | "aroundPlayer" | "fixedPoints"): void {
    const def = enemyById[enemyId] || ENEMY_DEFS[0];
    const pos = this.getSpawnPoint(pattern);
    const visual = enemyVisual(enemyId);
    const enemy = this.enemies.get(pos.x, pos.y, visual.key) as Phaser.Physics.Arcade.Image | null;

    if (!enemy) {
      return;
    }

    enemy.setActive(true).setVisible(true);
    enemy.setTexture(visual.key);
    enemy.setScale(visual.scale);
    enemy.setPosition(pos.x, pos.y);
    enemy.setDepth(4);
    enemy.setAngle(0);
    enemy.clearTint();
    if (enemy.body) {
      enemy.body.enable = true;
    }
    enemy.setVelocity(0, 0);
    const body = enemy.body as Phaser.Physics.Arcade.Body;
    body.setSize(visual.bodySize, visual.bodySize, true);

    const hp = def.hp * (1 + this.level.difficulty * 0.08);

    this.enemyMeta.set(enemy, {
      def,
      hp,
      maxHp: hp,
      attackCooldownMs: def.rangedCooldownMs || 0,
      chargeCooldownMs: def.chargeCooldownMs || 0,
      dashMs: 0,
      dashX: 0,
      dashY: 0,
      hitFlashMs: 0
    });
  }

  private getSpawnPoint(pattern: "edgeRandom" | "aroundPlayer" | "fixedPoints") {
    const width = this.level.mapSize.width;
    const height = this.level.mapSize.height;
    const margin = 30;

    if (pattern === "aroundPlayer") {
      const angle = randomRange(0, Math.PI * 2);
      const distance = randomRange(420, 720);
      return {
        x: clamp(this.player.x + Math.cos(angle) * distance, margin, width - margin),
        y: clamp(this.player.y + Math.sin(angle) * distance, margin, height - margin)
      };
    }

    const side = randomInt(0, 3);

    if (side === 0) return { x: margin, y: randomRange(margin, height - margin) };
    if (side === 1) return { x: width - margin, y: randomRange(margin, height - margin) };
    if (side === 2) return { x: randomRange(margin, width - margin), y: margin };

    return { x: randomRange(margin, width - margin), y: height - margin };
  }

  private updatePlayer(deltaMs: number): void {
    let moveX = 0;
    let moveY = 0;

    if (this.qaAutoMove && !this.pauseReason) {
      moveX = this.qaAutoDirX;
      moveY = this.qaAutoDirY;
    } else {
      if (this.keyW.isDown || this.keyUp.isDown || this.rawUp) moveY -= 1;
      if (this.keyS.isDown || this.keyDown.isDown || this.rawDown) moveY += 1;
      if (this.keyA.isDown || this.keyLeft.isDown || this.rawLeft) moveX -= 1;
      if (this.keyD.isDown || this.keyRight.isDown || this.rawRight) moveX += 1;
    }

    const len = Math.hypot(moveX, moveY);

    if (len > 0.001) {
      moveX /= len;
      moveY /= len;
    }

    this.moveIntentX = moveX;
    this.moveIntentY = moveY;

    const width = this.level.mapSize.width;
    const height = this.level.mapSize.height;
    const dt = deltaMs / 1000;
    const speed = this.playerMoveSpeed;

    if (len > 0.001) {
      const nextX = this.player.x + moveX * speed * dt;
      const nextY = this.player.y + moveY * speed * dt;
      this.player.setPosition(clamp(nextX, 20, width - 20), clamp(nextY, 20, height - 20));
      this.player.setVelocity(moveX * speed, moveY * speed);
    } else {
      this.player.setVelocity(0, 0);
    }

    const body = this.player.body as Phaser.Physics.Arcade.Body;
    body.setAcceleration(0, 0);
    body.setMaxVelocity(this.playerMoveSpeed, this.playerMoveSpeed);

    const pointer = this.input.activePointer;
    const worldPoint = this.cameras.main.getWorldPoint(pointer.x, pointer.y);
    const targetAngle = Phaser.Math.Angle.Between(this.player.x, this.player.y, worldPoint.x, worldPoint.y);
    this.player.rotation = smoothAngle(this.player.rotation, targetAngle - PLAYER_FORWARD_ROTATION_OFFSET, 0.2);
  }

  private updateWeapon(deltaMs: number): void {
    if (this.weaponCooldownMs > 0) {
      this.weaponCooldownMs -= deltaMs;
    }

    if (this.weaponReloadMs > 0) {
      this.weaponReloadMs -= deltaMs;

      if (this.weaponReloadMs <= 0) {
        this.weaponReloadMs = 0;
        this.weaponAmmo = this.weaponStats.magazineSize;
      }

      return;
    }

    if (this.weaponAmmo <= 0) {
      this.weaponReloadMs = this.weaponStats.reloadTimeMs;
      return;
    }

    const pointerDown = this.input.activePointer.isDown;

    if (pointerDown) {
      this.triggerHoldMs = Math.min(2600, this.triggerHoldMs + deltaMs);
    } else {
      this.triggerHoldMs = Math.max(0, this.triggerHoldMs - deltaMs * 2.7);
    }

    if (!pointerDown || this.weaponCooldownMs > 0) {
      return;
    }

    const sourceWeaponId = this.weapon.weaponId;
    const pellets = this.weaponStats.pellets;
    const fx = weaponFxProfile(sourceWeaponId);
    const stacks = this.getCoreUpgradeStacks();
    const baseAimAngle = this.player.rotation + PLAYER_FORWARD_ROTATION_OFFSET;
    const overdriveHeat = clamp(this.triggerHoldMs / 2200, 0, 1);
    const holdRateMul = 1 + this.combatPerks.overdriveRateMul * overdriveHeat;
    const dynamicSpreadMul = this.weapon.weaponId === "tempest_minigun" ? 1 + clamp(this.triggerHoldMs / 2400, 0, 1) * 0.28 : 1;
    const spreadBase = this.weaponStats.spreadDeg * dynamicSpreadMul;
    const visualScaleMul = 1 + stacks.warhead * 0.08 + stacks.overcharge * 0.04;
    const visualBodyMul = 1 + stacks.warhead * 0.06 + stacks.pierce * 0.03;
    const visualTrailScale = fx.trailScale * (1 + stacks.guidance * 0.12 + stacks.arc * 0.08);
    const visualTrailInterval = Math.max(12, fx.trailIntervalMs - stacks.guidance * 4 - stacks.pierce * 2);
    const visualImpactScale = fx.impactScaleMul * (1 + stacks.warhead * 0.14 + stacks.arc * 0.08);

    const shotTint =
      stacks.warhead >= Math.max(stacks.arc, stacks.guidance) && stacks.warhead > 0
        ? 0xffbe98
        : stacks.arc >= stacks.guidance && stacks.arc > 0
          ? 0xd2b6ff
          : stacks.guidance > 0
            ? 0xa3e3ff
            : fx.bulletTint;
    const muzzleTint = overdriveHeat > 0.58 || stacks.overdrive > 0 ? 0xffd38d : shotTint;
    const impactTint = stacks.warhead > 0 ? 0xffc8a3 : fx.impactTint;
    const impactCritTint = stacks.arc > 0 ? 0xf2e5ff : fx.impactCritTint;
    const muzzleScaleMul = fx.muzzleScaleMul * (1 + stacks.overdrive * 0.05 + overdriveHeat * 0.22);
    const bulletBlendMode =
      stacks.arc > 0 && fx.bulletBlendMode === Phaser.BlendModes.ADD ? Phaser.BlendModes.SCREEN : fx.bulletBlendMode;

    for (let index = 0; index < pellets; index += 1) {
      const bullet = this.playerBullets.get(this.player.x, this.player.y, "tex_bullet") as Phaser.Physics.Arcade.Image | null;

      if (!bullet) {
        break;
      }

      bullet.setActive(true).setVisible(true);
      bullet.body!.enable = true;
      bullet.setDepth(7);
      bullet.setScale(PLAYER_BULLET_SCALE * fx.bulletScaleMul * visualScaleMul);
      bullet.setBlendMode(bulletBlendMode);
      bullet.clearTint();
      bullet.setTint(shotTint);
      const body = bullet.body as Phaser.Physics.Arcade.Body;
      body.setSize(
        Math.round(PLAYER_BULLET_BODY_SIZE * fx.bulletBodyMul * visualBodyMul),
        Math.round(PLAYER_BULLET_BODY_SIZE * fx.bulletBodyMul * visualBodyMul),
        true
      );

      const spread = Phaser.Math.DegToRad(randomRange(-spreadBase * 0.5, spreadBase * 0.5));
      const angle = baseAimAngle + spread;

      bullet.setRotation(angle - PLAYER_FORWARD_ROTATION_OFFSET);
      bullet.setPosition(this.player.x + Math.cos(angle) * PLAYER_FORWARD_OFFSET, this.player.y + Math.sin(angle) * PLAYER_FORWARD_OFFSET);
      bullet.setVelocity(Math.cos(angle) * this.weaponStats.projectileSpeed, Math.sin(angle) * this.weaponStats.projectileSpeed);
      this.spawnMuzzleFlash(
        this.player.x + Math.cos(angle) * (PLAYER_FORWARD_OFFSET - 4),
        this.player.y + Math.sin(angle) * (PLAYER_FORWARD_OFFSET - 4),
        angle,
        muzzleTint,
        muzzleScaleMul
      );

      if ((stacks.overdrive > 0 || stacks.warhead > 0) && Math.random() < 0.35) {
        const offset = randomRange(8, 16);
        this.spawnMuzzleFlash(
          this.player.x + Math.cos(angle) * (PLAYER_FORWARD_OFFSET - offset),
          this.player.y + Math.sin(angle) * (PLAYER_FORWARD_OFFSET - offset),
          angle + randomRange(-0.08, 0.08),
          muzzleTint,
          muzzleScaleMul * 0.72
        );
      }

      const quantumSplitBonus = sourceWeaponId === "quantum_splitter" && this.getUpgradeStack("up_arc_chain") >= 2 ? 1 : 0;

      this.bulletMeta.set(bullet, {
        lifeMs: (this.weaponStats.rangePx / this.weaponStats.projectileSpeed) * 1000,
        damage: this.weaponStats.damage,
        critChance: this.playerCritChance,
        critDamage: this.playerCritDamage,
        trailTickMs: randomRange(0, visualTrailInterval),
        trailIntervalMs: visualTrailInterval,
        trailTint: shotTint !== fx.bulletTint ? shotTint : fx.trailTint,
        trailScale: visualTrailScale,
        impactTint,
        impactCritTint,
        impactScale: visualImpactScale,
        pierceLeft: this.combatPerks.pierce,
        splashRadius: this.combatPerks.splashRadius,
        splashDamageMul: this.combatPerks.splashDamageMul,
        homingStrength: this.combatPerks.homingStrength,
        homingTickMs: randomRange(0, 90),
        knockback: 46 * this.combatPerks.knockbackMul,
        chainChance: this.combatPerks.chainChance,
        chainDamageMul: this.combatPerks.chainDamageMul,
        isPlayerBullet: true,
        sourceWeaponId,
        splitLeft: sourceWeaponId === "quantum_splitter" ? 1 + quantumSplitBonus : 0
      });
    }

    if (sourceWeaponId === "sunlance_cannon") {
      this.fireSunlanceBeam(baseAimAngle, this.weaponStats.damage * 0.68);
    }

    this.weaponAmmo -= 1;
    this.weaponCooldownMs = 1000 / (this.weaponStats.fireRate * holdRateMul);
    this.audio.shoot();
  }

  private updateBullets(deltaMs: number): void {
    const playerBullets = this.playerBullets.getChildren() as Phaser.Physics.Arcade.Image[];

    for (let index = 0; index < playerBullets.length; index += 1) {
      const bullet = playerBullets[index];

      if (!bullet.active) {
        continue;
      }

      const meta = this.bulletMeta.get(bullet);

      if (!meta) {
        this.disableBodyObject(bullet);
        continue;
      }

      meta.lifeMs -= deltaMs;
      this.updatePlayerBulletSteering(bullet, meta, deltaMs);
      this.updateBulletTrailFx(bullet, meta, deltaMs);

      if (this.isOutsideWorld(bullet.x, bullet.y, 72)) {
        this.disableBodyObject(bullet);
        continue;
      }

      if (meta.lifeMs <= 0) {
        this.disableBodyObject(bullet);
      }
    }

    const enemyBullets = this.enemyBullets.getChildren() as Phaser.Physics.Arcade.Image[];

    for (let index = 0; index < enemyBullets.length; index += 1) {
      const bullet = enemyBullets[index];

      if (!bullet.active) {
        continue;
      }

      const meta = this.bulletMeta.get(bullet);

      if (!meta) {
        this.disableBodyObject(bullet);
        continue;
      }

      meta.lifeMs -= deltaMs;
      this.updateBulletTrailFx(bullet, meta, deltaMs);

      if (this.isOutsideWorld(bullet.x, bullet.y, 72)) {
        this.disableBodyObject(bullet);
        continue;
      }

      if (meta.lifeMs <= 0) {
        this.disableBodyObject(bullet);
      }
    }
  }

  private updatePlayerBulletSteering(bullet: Phaser.Physics.Arcade.Image, meta: BulletMeta, deltaMs: number): void {
    if (!meta.isPlayerBullet || meta.homingStrength <= 0 || !bullet.body) {
      return;
    }

    meta.homingTickMs -= deltaMs;

    if (meta.homingTickMs > 0) {
      return;
    }

    meta.homingTickMs += 70;

    const target = this.findNearestEnemy(bullet.x, bullet.y, 520);

    if (!target) {
      return;
    }

    const body = bullet.body as Phaser.Physics.Arcade.Body;
    const speed = Math.max(180, body.speed || this.weaponStats.projectileSpeed);
    const desiredAngle = Phaser.Math.Angle.Between(bullet.x, bullet.y, target.x, target.y);
    const currentAngle = Math.atan2(body.velocity.y, body.velocity.x);
    const turn = clamp(meta.homingStrength * 0.5, 0.04, 0.36);
    const nextAngle = Phaser.Math.Angle.RotateTo(currentAngle, desiredAngle, turn);

    body.setVelocity(Math.cos(nextAngle) * speed, Math.sin(nextAngle) * speed);
    bullet.setRotation(nextAngle - PLAYER_FORWARD_ROTATION_OFFSET);
  }

  private findNearestEnemy(x: number, y: number, maxRange: number): Phaser.Physics.Arcade.Image | null {
    const enemies = this.enemies.getChildren() as Phaser.Physics.Arcade.Image[];
    const maxRangeSq = maxRange * maxRange;
    let best: Phaser.Physics.Arcade.Image | null = null;
    let bestSq = maxRangeSq;

    for (let index = 0; index < enemies.length; index += 1) {
      const enemy = enemies[index];

      if (!enemy.active) {
        continue;
      }

      const sq = distSq(x, y, enemy.x, enemy.y);

      if (sq >= bestSq) {
        continue;
      }

      best = enemy;
      bestSq = sq;
    }

    return best;
  }

  private isOutsideWorld(x: number, y: number, padding = 0): boolean {
    return (
      x < -padding ||
      y < -padding ||
      x > this.level.mapSize.width + padding ||
      y > this.level.mapSize.height + padding
    );
  }

  private isInsideCamera(x: number, y: number, padding = 0): boolean {
    const view = this.cameras.main.worldView;
    return (
      x >= view.x - padding &&
      y >= view.y - padding &&
      x <= view.right + padding &&
      y <= view.bottom + padding
    );
  }

  private updateEnemies(deltaMs: number): void {
    const enemies = this.enemies.getChildren() as Phaser.Physics.Arcade.Image[];
    const stride = enemies.length > 180 ? 3 : enemies.length > 100 ? 2 : 1;
    this.enemyUpdateTick = (this.enemyUpdateTick + 1) % stride;

    for (let index = 0; index < enemies.length; index += 1) {
      const enemy = enemies[index];

      if (!enemy.active) {
        continue;
      }

      const meta = this.enemyMeta.get(enemy);

      if (!meta) {
        this.disableBodyObject(enemy);
        continue;
      }

      if (stride > 1 && index % stride !== this.enemyUpdateTick) {
        if (meta.hitFlashMs > 0) {
          meta.hitFlashMs -= deltaMs;
          enemy.setTint(0xffe28d);
        } else {
          enemy.clearTint();
        }
        continue;
      }

      const dx = this.player.x - enemy.x;
      const dy = this.player.y - enemy.y;
      const distance = Math.hypot(dx, dy) || 0.001;
      let dirX = dx / distance;
      let dirY = dy / distance;
      let speedMul = 1;

      if (meta.def.behavior === "ranged") {
        if (distance < 220) {
          dirX = -dirX;
          dirY = -dirY;
        } else if (distance < 320) {
          dirX = 0;
          dirY = 0;
        }

        meta.attackCooldownMs -= deltaMs;

        if (meta.attackCooldownMs <= 0 && distance < 620) {
          meta.attackCooldownMs = meta.def.rangedCooldownMs || 1800;
          this.spawnEnemyBullet(enemy.x, enemy.y, Math.atan2(dy, dx), meta.def.rangedDamage || 10);
        }
      }

      if (meta.def.behavior === "charger") {
        meta.chargeCooldownMs -= deltaMs;

        if (meta.dashMs > 0) {
          meta.dashMs -= deltaMs;
          dirX = meta.dashX;
          dirY = meta.dashY;
          speedMul = 2.7;
        } else if (meta.chargeCooldownMs <= 0 && distance < 560) {
          meta.chargeCooldownMs = meta.def.chargeCooldownMs || 2800;
          meta.dashMs = 430;
          meta.dashX = dirX;
          meta.dashY = dirY;
        }
      }

      if (meta.def.behavior === "swarm") {
        speedMul = 1.15;
      }

      const speed = meta.def.speed * speedMul;
      enemy.setVelocity(dirX * speed, dirY * speed);
      const facing = Math.atan2(dirY, dirX) - PLAYER_FORWARD_ROTATION_OFFSET;
      enemy.rotation = smoothAngle(enemy.rotation, facing, 0.16);

      if (meta.hitFlashMs > 0) {
        meta.hitFlashMs -= deltaMs;
        enemy.setTint(0xffe28d);
      } else {
        enemy.clearTint();
      }

      const contactRadius = 14 + enemyVisual(meta.def.id).bodySize * 0.44;

      if (distance <= contactRadius) {
        this.damagePlayer(meta.def.contactDamage, meta.def.name);
      }
    }
  }

  private updatePickups(deltaMs: number): void {
    const pickups = this.pickups.getChildren() as Phaser.Physics.Arcade.Image[];
    const pickupRangeSq = this.playerPickupRange * this.playerPickupRange;
    const stride = pickups.length > 180 ? 3 : pickups.length > 90 ? 2 : 1;
    this.pickupUpdateTick = (this.pickupUpdateTick + 1) % stride;

    for (let index = 0; index < pickups.length; index += 1) {
      const pickup = pickups[index];

      if (!pickup.active) {
        continue;
      }

      const meta = this.pickupMeta.get(pickup);

      if (!meta) {
        this.disableBodyObject(pickup);
        continue;
      }

      meta.lifeMs -= deltaMs;

      if (meta.lifeMs <= 0) {
        this.disableBodyObject(pickup);
        continue;
      }

      if (stride > 1 && index % stride !== this.pickupUpdateTick) {
        continue;
      }

      const dx = this.player.x - pickup.x;
      const dy = this.player.y - pickup.y;
      const dSq = distSq(this.player.x, this.player.y, pickup.x, pickup.y);

      if (dSq < pickupRangeSq) {
        const distance = Math.sqrt(Math.max(dSq, 0.001));
        const pull = (1 - distance / this.playerPickupRange) * 340;
        pickup.setVelocity((dx / distance) * pull, (dy / distance) * pull);
      }
    }
  }

  private handlePlayerBulletEnemyHit(bullet: Phaser.Physics.Arcade.Image, enemy: Phaser.Physics.Arcade.Image): void {
    if (!bullet.active || !enemy.active) {
      return;
    }

    const bMeta = this.bulletMeta.get(bullet);
    const eMeta = this.enemyMeta.get(enemy);

    if (!bMeta || !eMeta) {
      return;
    }

    const crit = Math.random() < bMeta.critChance;
    const amount = Math.max(1, Math.round(crit ? bMeta.damage * bMeta.critDamage : bMeta.damage));
    const body = bullet.body as Phaser.Physics.Arcade.Body | null;
    const hitAngle = body ? Math.atan2(body.velocity.y, body.velocity.x) : this.player.rotation + PLAYER_FORWARD_ROTATION_OFFSET;
    const splitCount = bMeta.sourceWeaponId === "quantum_splitter" ? bMeta.splitLeft : 0;

    eMeta.hp -= amount;
    eMeta.hitFlashMs = 90;
    this.spawnHitFx(
      enemy.x,
      enemy.y,
      enemyVisual(eMeta.def.id).hitFxScale * bMeta.impactScale,
      crit,
      crit ? bMeta.impactCritTint : bMeta.impactTint
    );

    if (body) {
      const speed = Math.max(80, body.speed || 80);
      const nx = body.velocity.x / speed;
      const ny = body.velocity.y / speed;
      const eBody = enemy.body as Phaser.Physics.Arcade.Body | undefined;

      if (eBody) {
        const push = bMeta.knockback;
        eBody.setVelocity(eBody.velocity.x + nx * push, eBody.velocity.y + ny * push);
      }

      if (bMeta.pierceLeft > 0) {
        bMeta.pierceLeft -= 1;
        bullet.setPosition(bullet.x + nx * 12, bullet.y + ny * 12);
      } else {
        this.disableBodyObject(bullet);
      }
    } else {
      this.disableBodyObject(bullet);
    }

    if (bMeta.splashRadius > 0 && bMeta.splashDamageMul > 0) {
      this.applySplashDamage(enemy.x, enemy.y, bMeta.splashRadius, amount * bMeta.splashDamageMul, enemy);
    }

    if (crit && bMeta.chainChance > 0 && Math.random() < bMeta.chainChance) {
      this.applyChainDamage(enemy, amount * bMeta.chainDamageMul, bMeta.impactCritTint);
    }

    if (splitCount > 0) {
      bMeta.splitLeft = 0;
      this.spawnSplitProjectiles(enemy.x, enemy.y, hitAngle, bMeta, splitCount);
    }

    if (bMeta.sourceWeaponId === "seeker_launcher") {
      this.spawnSeekerShards(enemy.x, enemy.y, hitAngle, bMeta);
    }

    this.cameras.main.shake(crit ? 55 : 30, crit ? 0.004 : 0.002);
    this.audio.hit();

    if (eMeta.hp <= 0) {
      this.killEnemy(enemy, eMeta, bMeta);
    }
  }

  private applySplashDamage(x: number, y: number, radius: number, baseDamage: number, exclude: Phaser.Physics.Arcade.Image): void {
    const enemies = this.enemies.getChildren() as Phaser.Physics.Arcade.Image[];
    const radiusSq = radius * radius;
    const warheadStacks = this.getUpgradeStack("up_warhead");

    if (this.isInsideCamera(x, y, radius * 0.7)) {
      const ring = this.add.image(x, y, "fx_levelup");
      ring.setDepth(7);
      ring.setBlendMode(Phaser.BlendModes.ADD);
      ring.setTint(warheadStacks > 0 ? 0xffbe95 : 0xffcfa8);
      ring.setScale(Math.max(0.24, radius / 220));
      ring.setAlpha(0.48);
      this.tweens.add({
        targets: ring,
        alpha: 0,
        scaleX: ring.scaleX * 1.7,
        scaleY: ring.scaleY * 1.7,
        duration: 150,
        ease: "Quad.Out",
        onComplete: () => ring.destroy()
      });
    }

    for (let index = 0; index < enemies.length; index += 1) {
      const enemy = enemies[index];

      if (!enemy.active || enemy === exclude) {
        continue;
      }

      const eMeta = this.enemyMeta.get(enemy);

      if (!eMeta) {
        continue;
      }

      const sq = distSq(x, y, enemy.x, enemy.y);

      if (sq > radiusSq) {
        continue;
      }

      const dist = Math.sqrt(Math.max(sq, 0.001));
      const falloff = 1 - dist / radius;
      const amount = Math.max(1, Math.round(baseDamage * (0.45 + falloff * 0.55)));
      eMeta.hp -= amount;
      eMeta.hitFlashMs = 70;
      this.spawnHitFx(enemy.x, enemy.y, enemyVisual(eMeta.def.id).hitFxScale * 0.8, false, 0xffb89a);

      if (eMeta.hp <= 0) {
        this.killEnemy(enemy, eMeta);
      }
    }
  }

  private applyChainDamage(source: Phaser.Physics.Arcade.Image, baseDamage: number, tint: number): void {
    const enemies = this.enemies.getChildren() as Phaser.Physics.Arcade.Image[];
    const sourceMeta = this.enemyMeta.get(source);
    const chainTargets: Array<{ enemy: Phaser.Physics.Arcade.Image; sq: number }> = [];
    const maxRangeSq = 340 * 340;
    const arcStacks = this.getUpgradeStack("up_arc_chain");
    const beamWidth = 2 + arcStacks * 0.75;

    if (!sourceMeta) {
      return;
    }

    for (let index = 0; index < enemies.length; index += 1) {
      const enemy = enemies[index];

      if (!enemy.active || enemy === source) {
        continue;
      }

      const eMeta = this.enemyMeta.get(enemy);

      if (!eMeta) {
        continue;
      }

      const sq = distSq(source.x, source.y, enemy.x, enemy.y);

      if (sq > maxRangeSq) {
        continue;
      }

      chainTargets.push({ enemy, sq });
    }

    chainTargets.sort((a, b) => a.sq - b.sq);
    const count = Math.min(this.weapon.weaponId === "quantum_splitter" ? 3 : 2, chainTargets.length);

    for (let index = 0; index < count; index += 1) {
      const target = chainTargets[index].enemy;
      const tMeta = this.enemyMeta.get(target);

      if (!tMeta || !target.active) {
        continue;
      }

      const amount = Math.max(1, Math.round(baseDamage * (0.92 - index * 0.18)));
      tMeta.hp -= amount;
      tMeta.hitFlashMs = 90;
      this.spawnHitFx(target.x, target.y, enemyVisual(tMeta.def.id).hitFxScale * 0.9, false, tint);
      this.spawnChainBeamFx(source.x, source.y, target.x, target.y, tint, beamWidth);

      if (tMeta.hp <= 0) {
        this.killEnemy(target, tMeta);
      }
    }
  }

  private spawnChainBeamFx(x0: number, y0: number, x1: number, y1: number, tint: number, width = 2): void {
    if (!this.isInsideCamera((x0 + x1) * 0.5, (y0 + y1) * 0.5, 96)) {
      return;
    }

    const line = this.add.graphics();
    line.setDepth(8);
    line.lineStyle(width, tint, 0.95);
    line.beginPath();
    line.moveTo(x0, y0);
    const mx = (x0 + x1) * 0.5 + randomRange(-14, 14);
    const my = (y0 + y1) * 0.5 + randomRange(-14, 14);
    line.lineTo(mx, my);
    line.lineTo(x1, y1);
    line.strokePath();
    this.tweens.add({
      targets: line,
      alpha: 0,
      duration: 100,
      ease: "Linear",
      onComplete: () => line.destroy()
    });
  }

  private spawnPlayerDerivedBullet(
    x: number,
    y: number,
    angle: number,
    speed: number,
    lifeMs: number,
    damage: number,
    baseMeta: BulletMeta,
    sourceWeaponId: string,
    splitLeft = 0,
    homingBoost = 0
  ): void {
    const bullet = this.playerBullets.get(x, y, "tex_bullet") as Phaser.Physics.Arcade.Image | null;

    if (!bullet) {
      return;
    }

    const fx = weaponFxProfile(sourceWeaponId);
    bullet.setActive(true).setVisible(true);
    bullet.body!.enable = true;
    bullet.setDepth(7);
    bullet.setScale(PLAYER_BULLET_SCALE * fx.bulletScaleMul * 0.9);
    bullet.setBlendMode(fx.bulletBlendMode);
    bullet.clearTint();
    bullet.setTint(fx.bulletTint);
    bullet.setRotation(angle - PLAYER_FORWARD_ROTATION_OFFSET);
    bullet.setPosition(x, y);
    bullet.setVelocity(Math.cos(angle) * speed, Math.sin(angle) * speed);

    const body = bullet.body as Phaser.Physics.Arcade.Body;
    const bodySize = Math.max(5, Math.round(PLAYER_BULLET_BODY_SIZE * fx.bulletBodyMul * 0.9));
    body.setSize(bodySize, bodySize, true);

    this.bulletMeta.set(bullet, {
      lifeMs,
      damage,
      critChance: baseMeta.critChance * 0.7,
      critDamage: baseMeta.critDamage,
      trailTickMs: randomRange(0, fx.trailIntervalMs),
      trailIntervalMs: fx.trailIntervalMs,
      trailTint: fx.trailTint,
      trailScale: fx.trailScale * 0.9,
      impactTint: fx.impactTint,
      impactCritTint: fx.impactCritTint,
      impactScale: fx.impactScaleMul * 0.92,
      pierceLeft: Math.max(0, baseMeta.pierceLeft - 1),
      splashRadius: Math.max(0, baseMeta.splashRadius - 10),
      splashDamageMul: baseMeta.splashDamageMul * 0.72,
      homingStrength: Math.max(0, baseMeta.homingStrength + homingBoost),
      homingTickMs: randomRange(20, 90),
      knockback: baseMeta.knockback * 0.74,
      chainChance: baseMeta.chainChance * 0.65,
      chainDamageMul: baseMeta.chainDamageMul * 0.75,
      isPlayerBullet: true,
      sourceWeaponId,
      splitLeft
    });
  }

  private spawnSplitProjectiles(x: number, y: number, angle: number, baseMeta: BulletMeta, splitCount = 1): void {
    const speed = this.weaponStats.projectileSpeed * 0.88;
    const lifeMs = Math.max(320, baseMeta.lifeMs * 0.72);
    const damage = baseMeta.damage * 0.58;
    const spread = splitCount >= 2 ? 0.4 : 0.31;
    this.spawnPlayerDerivedBullet(x, y, angle - spread, speed, lifeMs, damage, baseMeta, baseMeta.sourceWeaponId, 0, 0.06);
    this.spawnPlayerDerivedBullet(x, y, angle + spread, speed, lifeMs, damage, baseMeta, baseMeta.sourceWeaponId, 0, 0.06);
    if (splitCount >= 2) {
      this.spawnPlayerDerivedBullet(x, y, angle, speed * 1.03, lifeMs * 0.9, damage * 0.85, baseMeta, baseMeta.sourceWeaponId, 0, 0.08);
    }
    this.spawnHitFx(x, y, 0.78, false, 0xc8b8ff);
  }

  private spawnSeekerShards(x: number, y: number, angle: number, baseMeta: BulletMeta): void {
    const speed = this.weaponStats.projectileSpeed * 0.82;
    const lifeMs = Math.max(380, baseMeta.lifeMs * 0.62);
    const damage = baseMeta.damage * 0.42;
    this.spawnPlayerDerivedBullet(x, y, angle - 0.24, speed, lifeMs, damage, baseMeta, "seeker_launcher", 0, 0.18);
    this.spawnPlayerDerivedBullet(x, y, angle + 0.24, speed, lifeMs, damage, baseMeta, "seeker_launcher", 0, 0.18);
    this.spawnHitFx(x, y, 0.92, false, 0xffc59d);
  }

  private fireSunlanceBeam(angle: number, baseDamage: number): void {
    const x0 = this.player.x;
    const y0 = this.player.y;
    const range = this.weaponStats.rangePx * 1.25;
    const x1 = x0 + Math.cos(angle) * range;
    const y1 = y0 + Math.sin(angle) * range;

    if (this.isInsideCamera((x0 + x1) * 0.5, (y0 + y1) * 0.5, 180)) {
      const beam = this.add.graphics();
      beam.setDepth(8);
      beam.lineStyle(6, 0xffdd9f, 0.92);
      beam.beginPath();
      beam.moveTo(x0, y0);
      beam.lineTo(x1, y1);
      beam.strokePath();
      beam.lineStyle(2, 0xfff4ce, 0.96);
      beam.beginPath();
      beam.moveTo(x0, y0);
      beam.lineTo(x1, y1);
      beam.strokePath();
      this.tweens.add({
        targets: beam,
        alpha: 0,
        duration: 120,
        ease: "Linear",
        onComplete: () => beam.destroy()
      });
    }

    const enemies = this.enemies.getChildren() as Phaser.Physics.Arcade.Image[];

    for (let index = 0; index < enemies.length; index += 1) {
      const enemy = enemies[index];

      if (!enemy.active) {
        continue;
      }

      const eMeta = this.enemyMeta.get(enemy);

      if (!eMeta) {
        continue;
      }

      const info = this.pointToSegmentInfo(enemy.x, enemy.y, x0, y0, x1, y1);
      const thickness = 16 + enemyVisual(eMeta.def.id).bodySize * 0.34;

      if (info.distSq > thickness * thickness) {
        continue;
      }

      const falloff = 1 - info.t * 0.22;
      const amount = Math.max(1, Math.round(baseDamage * falloff));
      eMeta.hp -= amount;
      eMeta.hitFlashMs = 120;
      this.spawnHitFx(enemy.x, enemy.y, enemyVisual(eMeta.def.id).hitFxScale * 1.2, true, 0xffe6bf);

      const eBody = enemy.body as Phaser.Physics.Arcade.Body | undefined;
      if (eBody) {
        eBody.setVelocity(eBody.velocity.x + Math.cos(angle) * 140, eBody.velocity.y + Math.sin(angle) * 140);
      }

      if (eMeta.hp <= 0) {
        this.killEnemy(enemy, eMeta);
      }
    }
  }

  private spawnVoidSingularity(x: number, y: number, tint: number): void {
    this.singularities.push({
      x,
      y,
      lifeMs: 1320,
      radius: 220,
      pull: 210,
      tickMs: 90,
      damage: 6,
      tint
    });

    if (this.singularities.length > 7) {
      this.singularities.shift();
    }

    this.spawnHitFx(x, y, 1.12, true, tint);
  }

  private updateSingularities(deltaMs: number): void {
    if (this.singularities.length === 0) {
      return;
    }

    const enemies = this.enemies.getChildren() as Phaser.Physics.Arcade.Image[];

    for (let s = this.singularities.length - 1; s >= 0; s -= 1) {
      const field = this.singularities[s];
      field.lifeMs -= deltaMs;
      field.tickMs -= deltaMs;

      if (field.tickMs <= 0) {
        field.tickMs += 90;

        if (this.isInsideCamera(field.x, field.y, field.radius * 0.6)) {
          const ring = this.add.image(field.x, field.y, "fx_levelup");
          ring.setDepth(7);
          ring.setBlendMode(Phaser.BlendModes.ADD);
          ring.setTint(field.tint);
          ring.setScale(0.18);
          ring.setAlpha(0.5);
          this.tweens.add({
            targets: ring,
            alpha: 0,
            scaleX: 0.9,
            scaleY: 0.9,
            duration: 160,
            ease: "Quad.Out",
            onComplete: () => ring.destroy()
          });
        }

        const radiusSq = field.radius * field.radius;

        for (let index = 0; index < enemies.length; index += 1) {
          const enemy = enemies[index];

          if (!enemy.active) {
            continue;
          }

          const eMeta = this.enemyMeta.get(enemy);

          if (!eMeta) {
            continue;
          }

          const sq = distSq(field.x, field.y, enemy.x, enemy.y);

          if (sq > radiusSq) {
            continue;
          }

          const dist = Math.sqrt(Math.max(sq, 0.001));
          const nx = (field.x - enemy.x) / dist;
          const ny = (field.y - enemy.y) / dist;
          const factor = 1 - dist / field.radius;

          const eBody = enemy.body as Phaser.Physics.Arcade.Body | undefined;
          if (eBody) {
            const p = field.pull * factor;
            eBody.setVelocity(eBody.velocity.x + nx * p, eBody.velocity.y + ny * p);
          }

          const amount = Math.max(1, Math.round(field.damage * (0.5 + factor * 0.8)));
          eMeta.hp -= amount;
          eMeta.hitFlashMs = 70;

          if (eMeta.hp <= 0) {
            this.killEnemy(enemy, eMeta);
          }
        }
      }

      if (field.lifeMs <= 0) {
        this.singularities.splice(s, 1);
      }
    }
  }

  private pointToSegmentInfo(px: number, py: number, x0: number, y0: number, x1: number, y1: number): { distSq: number; t: number } {
    const vx = x1 - x0;
    const vy = y1 - y0;
    const wx = px - x0;
    const wy = py - y0;
    const vv = vx * vx + vy * vy || 0.0001;
    const t = clamp((wx * vx + wy * vy) / vv, 0, 1);
    const cx = x0 + vx * t;
    const cy = y0 + vy * t;
    return { distSq: distSq(px, py, cx, cy), t };
  }

  private handleEnemyBulletPlayerHit(bullet: Phaser.Physics.Arcade.Image): void {
    if (!bullet.active) {
      return;
    }

    const meta = this.bulletMeta.get(bullet);

    if (!meta) {
      this.disableBodyObject(bullet);
      return;
    }

    this.disableBodyObject(bullet);
    this.spawnHitFx(this.player.x, this.player.y, meta.impactScale, false, meta.impactTint);
    this.damagePlayer(meta.damage, "spitter");
  }

  private spawnEnemyBullet(x: number, y: number, angle: number, damage: number): void {
    const bullet = this.enemyBullets.get(x, y, "tex_enemy_bullet") as Phaser.Physics.Arcade.Image | null;

    if (!bullet) {
      return;
    }

    bullet.setActive(true).setVisible(true);
    bullet.body!.enable = true;
    bullet.setPosition(x, y);
    bullet.setDepth(6);
    bullet.setScale(ENEMY_BULLET_SCALE);
    bullet.setBlendMode(Phaser.BlendModes.ADD);
    bullet.clearTint();
    bullet.setTint(0xffad7a);
    bullet.setRotation(angle - PLAYER_FORWARD_ROTATION_OFFSET);
    const body = bullet.body as Phaser.Physics.Arcade.Body;
    body.setSize(ENEMY_BULLET_BODY_SIZE, ENEMY_BULLET_BODY_SIZE, true);

    const speed = 390;
    bullet.setVelocity(Math.cos(angle) * speed, Math.sin(angle) * speed);

    this.bulletMeta.set(bullet, {
      lifeMs: 2800,
      damage,
      critChance: 0,
      critDamage: 1,
      trailTickMs: randomRange(0, 70),
      trailIntervalMs: 70,
      trailTint: 0xff9f7a,
      trailScale: 0.22,
      impactTint: 0xffaf91,
      impactCritTint: 0xffddcb,
      impactScale: 0.85,
      pierceLeft: 0,
      splashRadius: 0,
      splashDamageMul: 0,
      homingStrength: 0,
      homingTickMs: 0,
      knockback: 0,
      chainChance: 0,
      chainDamageMul: 0,
      isPlayerBullet: false,
      sourceWeaponId: "enemy_bullet",
      splitLeft: 0
    });
  }

  private killEnemy(enemy: Phaser.Physics.Arcade.Image, meta: EnemyMeta, killerMeta?: BulletMeta): void {
    const ex = enemy.x;
    const ey = enemy.y;
    const visual = enemyVisual(meta.def.id);
    this.spawnExplosionFx(ex, ey, visual.hitFxScale * (meta.def.id === "crusher" ? 2.1 : 1.6));

    if (killerMeta?.isPlayerBullet && killerMeta.sourceWeaponId === "void_blaster" && Math.random() < 0.26) {
      this.spawnVoidSingularity(ex, ey, killerMeta.impactCritTint);
    }

    this.disableBodyObject(enemy);
    this.kills += 1;
    gameState.saveData.stats.totalKills += 1;

    this.spawnDrop(meta, ex, ey);

    const leech = this.activeUpgrades.find(item => item.onKillHealEvery && item.onKillHealAmount);

    if (leech) {
      this.killHealCounter += 1;

      if (this.killHealCounter >= (leech.onKillHealEvery || 9999)) {
        this.killHealCounter = 0;
        this.playerHp = clamp(this.playerHp + (leech.onKillHealAmount || 0), 0, this.playerMaxHp);
      }
    }
  }

  private spawnDrop(meta: EnemyMeta, x: number, y: number): void {
    const table = DROP_TABLES[meta.def.dropTableId as keyof typeof DROP_TABLES] || DROP_TABLES.basic;

    for (let index = 0; index < table.length; index += 1) {
      const entry = table[index];

      if (entry.type === "xp") {
        const count = randomInt(entry.min || 1, entry.max || 1);

        for (let orb = 0; orb < count; orb += 1) {
          this.spawnPickup({ type: "xp", xp: meta.def.expReward, lifeMs: 24000 }, x + randomRange(-10, 10), y + randomRange(-10, 10));
        }

        continue;
      }

      if (Math.random() * 100 > entry.weight) {
        continue;
      }

      if (entry.type === "credits") {
        const amount = randomInt(entry.min || 1, entry.max || 1);
        this.spawnPickup({ type: "credits", amount, lifeMs: 24000 }, x, y);
      } else if (entry.type === "material") {
        const qty = randomInt(entry.min || 1, entry.max || 1);
        this.spawnPickup({ type: "material", materialId: entry.materialId as MaterialId, qty, lifeMs: 24000 }, x, y);
      } else if (entry.type === "weapon") {
        const pool = entry.weaponPool || ["pulse_rifle"];
        const weaponId = pool[this.rng.int(0, pool.length - 1)];
        const weaponDef = weaponById[weaponId] || WEAPON_DEFS[0];
        const rarity = this.rollRarity(weaponDef.rarity);
        this.spawnPickup({ type: "weapon", weaponId, level: 1, rarity, lifeMs: 24000 }, x, y);
      } else if (entry.type === "attachment") {
        const pool = entry.attachmentPool || ["muzzle_stabilizer"];
        const attachmentId = pool[this.rng.int(0, pool.length - 1)];
        this.spawnPickup({ type: "attachment", attachmentId, lifeMs: 24000 }, x, y);
      }
    }
  }

  private rollRarity(base: WeaponInstance["rarity"]): WeaponInstance["rarity"] {
    const order = ["common", "uncommon", "rare", "epic", "legendary"] as const;
    const baseIdx = Math.max(0, order.indexOf(base));
    const bonus = this.level.difficulty * 0.03;
    const roll = Math.random();

    if (roll < 0.04 + bonus && baseIdx + 2 < order.length) {
      return order[baseIdx + 2];
    }

    if (roll < 0.18 + bonus && baseIdx + 1 < order.length) {
      return order[baseIdx + 1];
    }

    return base;
  }

  private spawnPickup(meta: PickupMeta, x: number, y: number): void {
    const activePickups = this.pickups.countActive(true);

    if (activePickups >= 320) {
      return;
    }

    if (
      activePickups >= 250 &&
      (meta.type === "xp" || meta.type === "credits" || meta.type === "material")
    ) {
      return;
    }

    const visual = pickupVisual(meta.type);
    const sprite = this.pickups.get(x, y, visual.key) as Phaser.Physics.Arcade.Image | null;

    if (!sprite) {
      return;
    }

    sprite.setActive(true).setVisible(true);
    sprite.setTexture(visual.key);
    sprite.setScale(visual.scale);
    sprite.body!.enable = true;
    sprite.setDepth(4);
    sprite.setPosition(x, y);
    sprite.setVelocity(randomRange(-38, 38), randomRange(-38, 38));
    sprite.setAngularVelocity(randomRange(-140, 140));
    const body = sprite.body as Phaser.Physics.Arcade.Body;
    body.setSize(visual.bodySize, visual.bodySize, true);

    this.pickupMeta.set(sprite, meta);
  }

  private updateBulletTrailFx(bullet: Phaser.Physics.Arcade.Image, meta: BulletMeta, deltaMs: number): void {
    meta.trailTickMs -= deltaMs;

    if (meta.trailTickMs > 0) {
      return;
    }

    meta.trailTickMs += meta.trailIntervalMs;

    if (!this.isInsideCamera(bullet.x, bullet.y, 84)) {
      return;
    }

    const trail = this.add.image(bullet.x, bullet.y, "fx_hit");
    trail.setDepth(6);
    trail.setBlendMode(Phaser.BlendModes.ADD);
    trail.setTint(meta.trailTint);
    trail.setScale(meta.trailScale * randomRange(0.85, 1.2));
    trail.setAlpha(0.75);

    this.tweens.add({
      targets: trail,
      alpha: 0,
      scaleX: trail.scaleX * 1.8,
      scaleY: trail.scaleY * 1.8,
      duration: 120,
      ease: "Quad.Out",
      onComplete: () => trail.destroy()
    });
  }

  private spawnMuzzleFlash(x: number, y: number, angle: number, tint = 0xffca7d, scaleMul = 1): void {
    if (!this.isInsideCamera(x, y, 80)) {
      return;
    }

    const fx = this.add.image(x, y, "fx_muzzle");
    fx.setDepth(8);
    fx.setBlendMode(Phaser.BlendModes.ADD);
    fx.setRotation(angle - PLAYER_FORWARD_ROTATION_OFFSET);
    fx.setScale(randomRange(0.66, 0.92) * scaleMul);
    fx.setTint(tint);
    fx.setAlpha(0.95);

    this.tweens.add({
      targets: fx,
      alpha: 0,
      scaleX: fx.scaleX * 1.6,
      scaleY: fx.scaleY * 0.9,
      duration: 90,
      ease: "Quad.Out",
      onComplete: () => fx.destroy()
    });
  }

  private spawnHitFx(x: number, y: number, size = 0.5, critical = false, tint?: number): void {
    if (!this.isInsideCamera(x, y, 120)) {
      return;
    }

    const fx = this.add.image(x, y, "fx_hit");
    fx.setDepth(8);
    fx.setBlendMode(Phaser.BlendModes.ADD);
    fx.setTint(tint ?? (critical ? 0xfff7b3 : 0x9deeff));
    fx.setScale(Math.max(0.25, size * randomRange(0.8, 1.2)));
    fx.setRotation(randomRange(0, Math.PI * 2));
    fx.setAlpha(0.92);

    this.tweens.add({
      targets: fx,
      alpha: 0,
      scaleX: fx.scaleX * 2.2,
      scaleY: fx.scaleY * 2.2,
      duration: critical ? 210 : 150,
      ease: "Sine.Out",
      onComplete: () => fx.destroy()
    });
  }

  private spawnExplosionFx(x: number, y: number, size = 0.9): void {
    if (!this.isInsideCamera(x, y, 180)) {
      return;
    }

    const keys = ["fx_explosion_a", "fx_explosion_b", "fx_explosion_c"];
    const primary = this.add.image(x, y, keys[this.rng.int(0, keys.length - 1)]);
    primary.setDepth(7);
    primary.setBlendMode(Phaser.BlendModes.ADD);
    primary.setScale(size * randomRange(0.85, 1.15));
    primary.setRotation(randomRange(0, Math.PI * 2));
    primary.setAlpha(0.94);
    primary.setTint(0xffd18c);

    this.tweens.add({
      targets: primary,
      alpha: 0,
      scaleX: primary.scaleX * 2.2,
      scaleY: primary.scaleY * 2.2,
      duration: 220,
      ease: "Cubic.Out",
      onComplete: () => primary.destroy()
    });

    const secondary = this.add.image(x + randomRange(-8, 8), y + randomRange(-8, 8), "fx_hit");
    secondary.setDepth(7);
    secondary.setBlendMode(Phaser.BlendModes.ADD);
    secondary.setScale(size * randomRange(0.55, 0.95));
    secondary.setRotation(randomRange(0, Math.PI * 2));
    secondary.setTint(0xfff4c4);

    this.tweens.add({
      targets: secondary,
      alpha: 0,
      scaleX: secondary.scaleX * 2.4,
      scaleY: secondary.scaleY * 2.4,
      duration: 180,
      ease: "Quad.Out",
      onComplete: () => secondary.destroy()
    });
  }

  private spawnPickupCollectFx(x: number, y: number, type: PickupMeta["type"]): void {
    const tintByType: Record<PickupMeta["type"], number> = {
      xp: 0x6bd6ff,
      credits: 0xffdd66,
      material: 0x86ff95,
      weapon: 0xff9bf0,
      attachment: 0xc2b8ff
    };

    const fx = this.add.image(x, y, "fx_hit");
    fx.setDepth(7);
    fx.setBlendMode(Phaser.BlendModes.ADD);
    fx.setTint(tintByType[type]);
    fx.setScale(0.4);
    fx.setAlpha(0.95);

    this.tweens.add({
      targets: fx,
      alpha: 0,
      scaleX: 1.4,
      scaleY: 1.4,
      duration: 180,
      ease: "Quad.Out",
      onComplete: () => fx.destroy()
    });

    if (type === "weapon" || type === "attachment") {
      const ring = this.add.image(x, y, "fx_levelup");
      ring.setDepth(8);
      ring.setBlendMode(Phaser.BlendModes.ADD);
      ring.setTint(tintByType[type]);
      ring.setScale(0.16);
      ring.setAlpha(0.88);

      this.tweens.add({
        targets: ring,
        alpha: 0,
        scaleX: 0.9,
        scaleY: 0.9,
        duration: 260,
        ease: "Sine.Out",
        onComplete: () => ring.destroy()
      });
    }
  }

  private spawnLevelUpFx(): void {
    const shield = this.add.image(this.player.x, this.player.y, "fx_levelup");
    shield.setDepth(9);
    shield.setBlendMode(Phaser.BlendModes.ADD);
    shield.setAlpha(0.86);
    shield.setScale(0.12);
    shield.setTint(0x8ff5ff);

    this.tweens.add({
      targets: shield,
      alpha: 0,
      scaleX: 1.25,
      scaleY: 1.25,
      duration: 420,
      ease: "Cubic.Out",
      onComplete: () => shield.destroy()
    });

    for (let i = 0; i < 7; i += 1) {
      const angle = (Math.PI * 2 * i) / 7;
      const spark = this.add.image(this.player.x + Math.cos(angle) * 18, this.player.y + Math.sin(angle) * 18, "fx_hit");
      spark.setDepth(9);
      spark.setBlendMode(Phaser.BlendModes.ADD);
      spark.setTint(0xb9f6ff);
      spark.setScale(0.2);

      this.tweens.add({
        targets: spark,
        x: this.player.x + Math.cos(angle) * randomRange(48, 72),
        y: this.player.y + Math.sin(angle) * randomRange(48, 72),
        alpha: 0,
        scaleX: randomRange(0.4, 0.7),
        scaleY: randomRange(0.4, 0.7),
        duration: 360,
        ease: "Sine.Out",
        onComplete: () => spark.destroy()
      });
    }
  }

  private spawnUpgradeApplyFx(upgrade: UpgradeDef): void {
    const id = upgrade.id;
    let tint = 0x8ff5ff;
    let ringScale = 1.2;
    let sparkCount = 8;
    let sparkDist = 84;

    if (id.startsWith("up_damage")) {
      tint = 0xff9a86;
      ringScale = 1.3;
      sparkCount = 10;
    } else if (id.startsWith("up_rate")) {
      tint = 0xffc586;
      ringScale = 1.24;
      sparkCount = 12;
    } else if (id === "up_reload" || id === "up_mag") {
      tint = 0x9bd0ff;
      sparkCount = 9;
    } else if (id === "up_speed") {
      tint = 0x95ffb3;
      ringScale = 1.35;
      sparkCount = 10;
      sparkDist = 100;
    } else if (id === "up_hp") {
      tint = 0x8af4ff;
      ringScale = 1.45;
      sparkCount = 14;
      sparkDist = 112;
    } else if (id.startsWith("up_crit")) {
      tint = 0xe1a3ff;
      ringScale = 1.3;
      sparkCount = 11;
    } else if (id === "up_pickup") {
      tint = 0x97ffda;
      ringScale = 1.34;
      sparkCount = 10;
    } else if (id === "up_bullet_speed") {
      tint = 0xa5b8ff;
      ringScale = 1.36;
      sparkCount = 12;
      sparkDist = 102;
    } else if (id === "up_lifesteal") {
      tint = 0xff95af;
      ringScale = 1.28;
      sparkCount = 10;
    } else if (id === "up_pierce_rounds") {
      tint = 0xd9ecff;
      ringScale = 1.32;
      sparkCount = 11;
      sparkDist = 108;
    } else if (id === "up_warhead") {
      tint = 0xffbe8e;
      ringScale = 1.4;
      sparkCount = 13;
      sparkDist = 118;
    } else if (id === "up_arc_chain") {
      tint = 0xceb3ff;
      ringScale = 1.33;
      sparkCount = 12;
    } else if (id === "up_guidance") {
      tint = 0x9cd7ff;
      ringScale = 1.28;
      sparkCount = 10;
    } else if (id === "up_overdrive") {
      tint = 0xffd891;
      ringScale = 1.35;
      sparkCount = 12;
      sparkDist = 112;
    } else if (id === "up_phase_barrier") {
      tint = 0x93f7ff;
      ringScale = 1.48;
      sparkCount = 15;
      sparkDist = 120;
    } else if (id === "up_close_quarters") {
      tint = 0xffad99;
      ringScale = 1.32;
      sparkCount = 11;
    } else if (id === "up_overcharge_core") {
      tint = 0xfff3b2;
      ringScale = 1.38;
      sparkCount = 13;
      sparkDist = 112;
    }

    const ring = this.add.image(this.player.x, this.player.y, "fx_levelup");
    ring.setDepth(9);
    ring.setBlendMode(Phaser.BlendModes.ADD);
    ring.setTint(tint);
    ring.setScale(0.16);
    ring.setAlpha(0.9);

    this.tweens.add({
      targets: ring,
      alpha: 0,
      scaleX: ringScale,
      scaleY: ringScale,
      duration: 360,
      ease: "Cubic.Out",
      onComplete: () => ring.destroy()
    });

    for (let i = 0; i < sparkCount; i += 1) {
      const angle = (Math.PI * 2 * i) / sparkCount + randomRange(-0.08, 0.08);
      const spark = this.add.image(this.player.x, this.player.y, "fx_hit");
      spark.setDepth(10);
      spark.setBlendMode(Phaser.BlendModes.ADD);
      spark.setTint(tint);
      spark.setScale(randomRange(0.2, 0.34));
      spark.setRotation(angle);

      this.tweens.add({
        targets: spark,
        x: this.player.x + Math.cos(angle) * randomRange(sparkDist * 0.64, sparkDist),
        y: this.player.y + Math.sin(angle) * randomRange(sparkDist * 0.64, sparkDist),
        alpha: 0,
        scaleX: spark.scaleX * 1.6,
        scaleY: spark.scaleY * 1.6,
        duration: randomInt(240, 420),
        ease: "Sine.Out",
        onComplete: () => spark.destroy()
      });
    }

    if (id === "up_speed" || id === "up_bullet_speed" || id === "up_overdrive" || id === "up_guidance") {
      for (let i = 0; i < 5; i += 1) {
        const ang = randomRange(0, Math.PI * 2);
        this.spawnMuzzleFlash(this.player.x + Math.cos(ang) * 18, this.player.y + Math.sin(ang) * 18, ang, tint, 0.92);
      }
    }
  }

  private spawnWeaponSwapFx(weaponId: string): void {
    const fx = weaponFxProfile(weaponId);
    const ring = this.add.image(this.player.x, this.player.y, "fx_levelup");
    ring.setDepth(9);
    ring.setBlendMode(Phaser.BlendModes.ADD);
    ring.setTint(fx.impactTint);
    ring.setScale(0.1);
    ring.setAlpha(0.92);

    this.tweens.add({
      targets: ring,
      alpha: 0,
      scaleX: 1.05,
      scaleY: 1.05,
      duration: 280,
      ease: "Cubic.Out",
      onComplete: () => ring.destroy()
    });

    for (let i = 0; i < 6; i += 1) {
      const angle = this.player.rotation + PLAYER_FORWARD_ROTATION_OFFSET + (Math.PI * 2 * i) / 6;
      this.spawnMuzzleFlash(this.player.x + Math.cos(angle) * 12, this.player.y + Math.sin(angle) * 12, angle, fx.muzzleTint, 0.78);
    }
  }

  private collectPickup(pickup: Phaser.Physics.Arcade.Image): void {
    if (!pickup.active) {
      return;
    }

    try {
      const meta = this.pickupMeta.get(pickup);

      if (!meta) {
        this.pushDebugEvent("pickup:unknown-meta");
        return;
      }

      this.pickupMeta.delete(pickup);
      this.spawnPickupCollectFx(pickup.x, pickup.y, meta.type);
      this.disableBodyObject(pickup);
      this.qaPickupCount += 1;
      this.qaLastPickupType = meta.type;
      this.pushDebugEvent(`pickup:${meta.type}`);

      if (meta.type === "xp") {
        this.gainXp(meta.xp);
        this.audio.pickup();
        return;
      }

      let loadoutChanged = false;

      if (meta.type === "credits") {
        gameState.saveData.credits += meta.amount;
        this.runCreditsEarned += meta.amount;
        this.markSaveDirty();
        this.game.events.emit(EVENT_TOAST, `+${meta.amount} Credits`);
      } else if (meta.type === "material") {
        addMaterial(gameState.saveData.inventory, meta.materialId, meta.qty);
        this.runMaterialsEarned[meta.materialId] += meta.qty;
        this.markSaveDirty();
        this.game.events.emit(EVENT_TOAST, `+${meta.qty} ${MATERIAL_LABELS[meta.materialId]}`);
      } else if (meta.type === "weapon") {
        const weaponDef = weaponById[meta.weaponId];

        if (weaponDef) {
          addWeapon(gameState.saveData.inventory, meta.weaponId, meta.level, meta.rarity);
          loadoutChanged = true;
          this.markSaveDirty();
          this.game.events.emit(EVENT_TOAST, `Weapon found: ${weaponDef.name}`);
        } else {
          this.game.events.emit(EVENT_TOAST, `Skipped unknown weapon drop (${meta.weaponId}).`);
        }
      } else if (meta.type === "attachment") {
        const attachmentDef = attachmentById[meta.attachmentId];

        if (attachmentDef) {
          addAttachment(gameState.saveData.inventory, meta.attachmentId);
          loadoutChanged = true;
          this.markSaveDirty();
          this.game.events.emit(EVENT_TOAST, `Attachment found: ${attachmentDef.name}`);
        } else {
          this.game.events.emit(EVENT_TOAST, `Skipped unknown attachment drop (${meta.attachmentId}).`);
        }
      }

      syncAttachmentOwnership(gameState.saveData.inventory);

      if (loadoutChanged) {
        this.syncLoadout();
        this.refreshDerivedStats();
      }

      this.emitInventory(this.pauseReason === "inventory");
      this.emitCraft(this.pauseReason === "craft");

      this.audio.pickup();
    } catch (error) {
      this.pushDebugEvent("pickup:error");
      console.error("[AlienArena] collectPickup failed", error);
      this.game.events.emit(EVENT_TOAST, "Pickup handled with warning. Continuing run.");
    }
  }

  private gainXp(amount: number): void {
    this.playerXp += amount;

    while (this.playerXp >= this.playerXpToNext) {
      this.playerXp -= this.playerXpToNext;
      this.playerLevel += 1;
      this.playerXpToNext = getXpRequired(this.playerLevel);
      this.queuedLevelUps += 1;
      gameState.saveData.stats.highestLevel = Math.max(gameState.saveData.stats.highestLevel, this.playerLevel);
      this.markSaveDirty();
    }
  }

  private buildUpgradeChoices(count = 3): UpgradeDef[] {
    const offense = UPGRADE_DEFS.filter(item =>
      item.id.startsWith("up_damage") ||
      item.id.startsWith("up_rate") ||
      item.id === "up_bullet_speed" ||
      item.id === "up_pierce_rounds" ||
      item.id === "up_warhead" ||
      item.id === "up_arc_chain" ||
      item.id === "up_overdrive" ||
      item.id === "up_close_quarters" ||
      item.id === "up_overcharge_core"
    );
    const defense = UPGRADE_DEFS.filter(item =>
      item.id === "up_hp" ||
      item.id === "up_lifesteal" ||
      item.id === "up_phase_barrier"
    );
    const utility = UPGRADE_DEFS.filter(item =>
      item.id === "up_speed" ||
      item.id === "up_pickup" ||
      item.id === "up_reload" ||
      item.id === "up_mag" ||
      item.id === "up_guidance" ||
      item.id.startsWith("up_crit")
    );

    const picked: UpgradeDef[] = [];
    const pickedIds = new Set<string>();

    const takeOne = (pool: UpgradeDef[]): void => {
      const candidates = pool.filter(item => !pickedIds.has(item.id));

      if (candidates.length === 0) {
        return;
      }

      const choice = choiceWeighted(candidates, 1)[0];

      if (!choice) {
        return;
      }

      picked.push(choice);
      pickedIds.add(choice.id);
    };

    takeOne(offense);
    takeOne(defense.length > 0 && Math.random() < 0.55 ? defense : utility);

    let guard = 0;
    while (picked.length < count && guard < 24) {
      guard += 1;
      takeOne(UPGRADE_DEFS);
    }

    return picked.slice(0, count);
  }

  private checkLevelUpQueue(): void {
    if (this.pauseReason || this.queuedLevelUps <= 0) {
      return;
    }

    this.queuedLevelUps -= 1;
    const choices = this.buildUpgradeChoices(3);

    if (choices.length === 0) {
      return;
    }

    this.pendingUpgradeOptions = choices.map(item => ({ id: item.id, name: item.name, description: item.description }));
    this.pushDebugEvent("upgrade:show");
    this.spawnLevelUpFx();
    this.emitUpgradeOverlay();
    this.setPause("upgrade");
    this.upgradePauseStartedMs = this.time.now;
    this.game.events.emit(EVENT_TOAST, "Level up: choose an upgrade");
    this.audio.levelUp();
  }

  private checkMissionResult(): void {
    if (this.playerHp <= 0) {
      this.endRun(false);
      return;
    }

    if (this.kills >= this.level.killTarget || this.elapsedMs / 1000 >= this.level.durationSec) {
      this.endRun(true);
    }
  }

  private endRun(victory: boolean): void {
    if (this.runEnded) {
      return;
    }

    this.runEnded = true;
    this.setPause("result");
    this.pendingUpgradeOptions = null;
    this.upgradePauseStartedMs = 0;
    this.emitInventory(false);
    this.emitCraft(false);

    if (victory) {
      gameState.saveData.stats.runsCompleted += 1;
      gameState.saveData.credits += this.level.reward.credits;
      this.runCreditsEarned += this.level.reward.credits;

      const unlocks = this.level.reward.unlocks || [];

      for (let index = 0; index < unlocks.length; index += 1) {
        gameState.unlock(unlocks[index]);
      }

      const levelIndex = LEVEL_DEFS.findIndex(item => item.id === this.level.id);
      this.nextLevelId = LEVEL_DEFS[levelIndex + 1]?.id || null;

      this.game.events.emit(EVENT_SHOW_RESULT, {
        title: "Mission Complete",
        summary: `Kills ${this.kills} | Credits +${this.runCreditsEarned} | Materials +${
          this.runMaterialsEarned.scrap + this.runMaterialsEarned.alloy + this.runMaterialsEarned.core + this.runMaterialsEarned.quantum
        }`,
        hasNext: this.nextLevelId !== null && gameState.isUnlocked(this.nextLevelId)
      });
    } else {
      this.nextLevelId = null;
      this.game.events.emit(EVENT_SHOW_RESULT, {
        title: "Mission Failed",
        summary: `You were overrun. Kills ${this.kills}. Improve your build and retry.`,
        hasNext: false
      });
    }

    gameState.lastRun = {
      levelId: this.level.id,
      kills: this.kills,
      victory,
      creditsEarned: this.runCreditsEarned
    };

    gameState.persistSave();
    this.saveDirty = false;
    this.saveLastFlushMs = this.time.now;
  }

  private damagePlayer(amount: number, source: string): void {
    if (this.playerIFrameMs > 0 || this.runEnded) {
      return;
    }

    this.playerHp = Math.max(0, this.playerHp - amount);
    this.playerIFrameMs = 700;
    this.cameras.main.shake(80, 0.005);
    this.game.events.emit(EVENT_TOAST, `-${Math.round(amount)} HP (${source})`);
    this.audio.hit();
  }

  private syncLoadout(): void {
    const inv = gameState.saveData.inventory;
    syncAttachmentOwnership(inv);

    if (inv.weapons.length === 0) {
      const starter = WEAPON_DEFS[0];
      inv.weapons.push({
        instanceId: `weapon_fallback_${Date.now()}`,
        weaponId: starter.id,
        level: starter.baseLevel,
        rarity: starter.rarity,
        attachments: {}
      });
      this.markSaveDirty();
    }

    this.weapon = inv.weapons.find(item => item.instanceId === inv.equippedWeaponId) || inv.weapons[0];
    inv.equippedWeaponId = this.weapon.instanceId;
  }

  private refreshDerivedStats(): void {
    const itemToDef: Record<string, string> = {};

    for (let index = 0; index < gameState.saveData.inventory.attachments.length; index += 1) {
      const item = gameState.saveData.inventory.attachments[index];
      itemToDef[item.itemId] = item.attachmentId;
    }

    for (let weaponIndex = 0; weaponIndex < gameState.saveData.inventory.weapons.length; weaponIndex += 1) {
      const weapon = gameState.saveData.inventory.weapons[weaponIndex];
      const slots = Object.entries(weapon.attachments || {});

      for (let entryIndex = 0; entryIndex < slots.length; entryIndex += 1) {
        const [_, itemId] = slots[entryIndex];
        const attachmentItem = gameState.saveData.inventory.attachments.find(item => item.itemId === itemId);

        if (attachmentItem) {
          itemToDef[itemId] = attachmentItem.attachmentId;
        }
      }
    }

    const modifiers = collectModifiers(this.weapon, this.activeUpgrades, itemToDef);
    this.weaponStats = computeWeaponFinalStats(this.weapon, modifiers);
    this.recomputeCombatPerks();

    const playerDerived = computePlayerBaseFromModifiers(modifiers);
    const previousMax = this.playerMaxHp || playerDerived.maxHp;

    this.playerMaxHp = playerDerived.maxHp;
    this.playerMoveSpeed = playerDerived.moveSpeed;
    this.playerPickupRange = playerDerived.pickupRange;
    this.playerCritChance = playerDerived.critChance;
    this.playerCritDamage = playerDerived.critDamage;

    if (this.playerHp === 0) {
      this.playerHp = this.playerMaxHp;
    } else if (this.playerMaxHp > previousMax) {
      this.playerHp += this.playerMaxHp - previousMax;
    }

    this.playerHp = clamp(this.playerHp, 0, this.playerMaxHp);
    this.weaponAmmo = clamp(this.weaponAmmo, 0, this.weaponStats.magazineSize);

    if (this.player?.body) {
      this.player.setMaxVelocity(this.playerMoveSpeed, this.playerMoveSpeed);
    }
  }

  private getUpgradeStack(id: string): number {
    let count = 0;

    for (let index = 0; index < this.activeUpgradeIds.length; index += 1) {
      if (this.activeUpgradeIds[index] === id) {
        count += 1;
      }
    }

    return count;
  }

  private getCoreUpgradeStacks(): CoreUpgradeStacks {
    const stacks: CoreUpgradeStacks = {
      pierce: this.getUpgradeStack("up_pierce_rounds"),
      warhead: this.getUpgradeStack("up_warhead"),
      arc: this.getUpgradeStack("up_arc_chain"),
      guidance: this.getUpgradeStack("up_guidance"),
      overdrive: this.getUpgradeStack("up_overdrive"),
      closeQuarters: this.getUpgradeStack("up_close_quarters"),
      overcharge: this.getUpgradeStack("up_overcharge_core"),
      total: 0
    };

    stacks.total =
      stacks.pierce +
      stacks.warhead +
      stacks.arc +
      stacks.guidance +
      stacks.overdrive +
      stacks.closeQuarters +
      stacks.overcharge;

    return stacks;
  }

  private getPrimaryAuraTint(stacks: CoreUpgradeStacks): number {
    if (stacks.warhead >= stacks.arc && stacks.warhead >= stacks.guidance && stacks.warhead >= stacks.overdrive) {
      return 0xffb58f;
    }

    if (stacks.arc >= stacks.guidance && stacks.arc >= stacks.overdrive) {
      return 0xd7b3ff;
    }

    if (stacks.guidance >= stacks.overdrive) {
      return 0x9fd6ff;
    }

    if (stacks.overdrive > 0) {
      return 0xffdb98;
    }

    return 0x9df1ff;
  }

  private getPerkSummaryText(): string {
    const stacks = this.getCoreUpgradeStacks();
    const parts: string[] = [];

    if (stacks.pierce > 0) parts.push(`P${stacks.pierce}`);
    if (stacks.warhead > 0) parts.push(`W${stacks.warhead}`);
    if (stacks.arc > 0) parts.push(`A${stacks.arc}`);
    if (stacks.guidance > 0) parts.push(`G${stacks.guidance}`);
    if (stacks.overdrive > 0) parts.push(`O${stacks.overdrive}`);

    if (parts.length === 0) {
      return "Perks -";
    }

    return `Perks ${parts.join("  ")}`;
  }

  private updateUpgradeAuraFx(deltaMs: number): void {
    const stacks = this.getCoreUpgradeStacks();

    if (stacks.total <= 0 || this.pauseReason || this.runEnded) {
      return;
    }

    this.upgradeAuraPulseMs -= deltaMs;

    if (this.upgradeAuraPulseMs > 0) {
      return;
    }

    const overdriveBoost = stacks.overdrive > 0 ? clamp(this.triggerHoldMs / 2200, 0, 1) : 0;
    const interval = Math.max(110, 360 - stacks.total * 24 - overdriveBoost * 130);
    this.upgradeAuraPulseMs = interval;

    const tint = this.getPrimaryAuraTint(stacks);
    const radius = 26 + stacks.total * 3;

    const ring = this.add.image(this.player.x, this.player.y, "fx_levelup");
    ring.setDepth(8);
    ring.setBlendMode(Phaser.BlendModes.ADD);
    ring.setTint(tint);
    ring.setScale(0.18 + stacks.total * 0.01);
    ring.setAlpha(0.48 + overdriveBoost * 0.24);

    this.tweens.add({
      targets: ring,
      alpha: 0,
      scaleX: 0.72 + stacks.total * 0.02,
      scaleY: 0.72 + stacks.total * 0.02,
      duration: 210,
      ease: "Quad.Out",
      onComplete: () => ring.destroy()
    });

    const sparkCount = Math.min(12, 3 + stacks.total);
    for (let index = 0; index < sparkCount; index += 1) {
      const angle = randomRange(0, Math.PI * 2);
      const spark = this.add.image(this.player.x + Math.cos(angle) * 14, this.player.y + Math.sin(angle) * 14, "fx_hit");
      spark.setDepth(8);
      spark.setBlendMode(Phaser.BlendModes.ADD);
      spark.setTint(tint);
      spark.setScale(randomRange(0.14, 0.24));
      spark.setAlpha(0.85);

      this.tweens.add({
        targets: spark,
        x: this.player.x + Math.cos(angle) * randomRange(radius * 0.9, radius * 1.4),
        y: this.player.y + Math.sin(angle) * randomRange(radius * 0.9, radius * 1.4),
        alpha: 0,
        scaleX: spark.scaleX * 1.8,
        scaleY: spark.scaleY * 1.8,
        duration: randomInt(140, 260),
        ease: "Sine.Out",
        onComplete: () => spark.destroy()
      });
    }
  }

  private recomputeCombatPerks(): void {
    const perks = emptyCombatPerks();

    if (this.weapon.weaponId === "rail_lancer") {
      perks.pierce += 2;
      perks.knockbackMul += 0.55;
    } else if (this.weapon.weaponId === "plasma_carbine") {
      perks.splashRadius += 46;
      perks.splashDamageMul += 0.3;
    } else if (this.weapon.weaponId === "void_blaster") {
      perks.homingStrength += 0.18;
      perks.chainChance += 0.2;
      perks.chainDamageMul += 0.28;
    } else if (this.weapon.weaponId === "arc_shotgun") {
      perks.knockbackMul += 0.72;
      perks.splashRadius += 22;
      perks.splashDamageMul += 0.16;
    } else if (this.weapon.weaponId === "tempest_minigun") {
      perks.overdriveRateMul += 0.28;
      perks.knockbackMul += 0.08;
    } else if (this.weapon.weaponId === "seeker_launcher") {
      perks.homingStrength += 0.36;
      perks.splashRadius += 52;
      perks.splashDamageMul += 0.52;
    } else if (this.weapon.weaponId === "quantum_splitter") {
      perks.chainChance += 0.16;
      perks.chainDamageMul += 0.22;
    } else if (this.weapon.weaponId === "sunlance_cannon") {
      perks.pierce += 3;
      perks.knockbackMul += 0.85;
      perks.chainChance += 0.12;
      perks.chainDamageMul += 0.2;
    }

    const pierceStacks = this.getUpgradeStack("up_pierce_rounds");
    const warheadStacks = this.getUpgradeStack("up_warhead");
    const arcStacks = this.getUpgradeStack("up_arc_chain");
    const guidanceStacks = this.getUpgradeStack("up_guidance");
    const overdriveStacks = this.getUpgradeStack("up_overdrive");
    const closeQuarterStacks = this.getUpgradeStack("up_close_quarters");
    const overchargeStacks = this.getUpgradeStack("up_overcharge_core");

    if (pierceStacks > 0) {
      perks.pierce += Math.min(4, pierceStacks);
    }

    if (warheadStacks > 0) {
      perks.splashRadius += 30 + Math.max(0, warheadStacks - 1) * 18;
      perks.splashDamageMul += 0.24 + Math.max(0, warheadStacks - 1) * 0.14;
    }

    if (arcStacks > 0) {
      perks.chainChance += 0.16 + Math.max(0, arcStacks - 1) * 0.12;
      perks.chainDamageMul += 0.2 + Math.max(0, arcStacks - 1) * 0.1;
    }

    if (guidanceStacks > 0) {
      perks.homingStrength += 0.14 + Math.max(0, guidanceStacks - 1) * 0.1;
    }

    if (overdriveStacks > 0) {
      perks.overdriveRateMul += 0.18 + Math.max(0, overdriveStacks - 1) * 0.12;
    }

    if (closeQuarterStacks > 0) {
      perks.knockbackMul += closeQuarterStacks * 0.16;
    }

    if (overchargeStacks > 0) {
      perks.chainDamageMul += overchargeStacks * 0.08;
      perks.splashDamageMul += overchargeStacks * 0.05;
    }

    perks.pierce = Math.round(clamp(perks.pierce, 0, 8));
    perks.splashRadius = clamp(perks.splashRadius, 0, 220);
    perks.splashDamageMul = clamp(perks.splashDamageMul, 0, 1.2);
    perks.homingStrength = clamp(perks.homingStrength, 0, 0.95);
    perks.chainChance = clamp(perks.chainChance, 0, 0.8);
    perks.chainDamageMul = clamp(perks.chainDamageMul, 0, 1.1);
    perks.overdriveRateMul = clamp(perks.overdriveRateMul, 0, 0.9);
    perks.knockbackMul = clamp(perks.knockbackMul, 0.75, 2.8);

    this.combatPerks = perks;
  }

  private ensureUiSceneActive(): void {
    if (this.scene.isSleeping("UIScene")) {
      this.scene.wake("UIScene");
    }

    if (!this.scene.isActive("UIScene")) {
      this.scene.launch("UIScene");
    }

    this.scene.bringToTop("UIScene");
  }

  private prepareKeyboardFocus(): void {
    const canvas = this.game.canvas as HTMLCanvasElement | null;

    if (canvas && !canvas.hasAttribute("tabindex")) {
      canvas.setAttribute("tabindex", "0");
    }

    this.handlePointerFocus();
    this.input.on("pointerdown", this.handlePointerFocus, this);
    this.input.keyboard?.on("keydown", this.onKeyboardDown, this);
    window.addEventListener("blur", this.onWindowBlur);
    window.addEventListener("focus", this.onWindowFocus);
    window.addEventListener("keydown", this.onWindowKeyDownCapture);
    window.addEventListener("keyup", this.onWindowKeyUpCapture);
    document.addEventListener("visibilitychange", this.onVisibilityChange);
  }

  private handlePointerFocus(): void {
    const canvas = this.game.canvas as HTMLCanvasElement | null;

    if (canvas) {
      canvas.focus();
    }

    if (this.input.keyboard && !this.input.keyboard.enabled) {
      this.input.keyboard.enabled = true;
    }

    this.pushDebugEvent("focus:canvas");
  }

  private onKeyboardDown(event: KeyboardEvent): void {
    if (!this.qaMode) {
      return;
    }

    this.pushDebugEvent(`kd:${event.code}`);
  }

  private onWindowKeyDownCapture = (event: KeyboardEvent): void => {
    this.applyRawKey(event.code, true);
  };

  private onWindowKeyUpCapture = (event: KeyboardEvent): void => {
    this.applyRawKey(event.code, false);
  };

  private applyRawKey(code: string, isDown: boolean): void {
    if (code === "KeyW" || code === "ArrowUp") this.rawUp = isDown;
    if (code === "KeyS" || code === "ArrowDown") this.rawDown = isDown;
    if (code === "KeyA" || code === "ArrowLeft") this.rawLeft = isDown;
    if (code === "KeyD" || code === "ArrowRight") this.rawRight = isDown;
  }

  private onWindowBlur = (): void => {
    this.rawUp = false;
    this.rawDown = false;
    this.rawLeft = false;
    this.rawRight = false;
    this.pushDebugEvent("window:blur");
  };

  private onWindowFocus = (): void => {
    this.pushDebugEvent("window:focus");
    this.handlePointerFocus();
  };

  private onVisibilityChange = (): void => {
    if (typeof document === "undefined") {
      return;
    }

    if (document.hidden) {
      this.rawUp = false;
      this.rawDown = false;
      this.rawLeft = false;
      this.rawRight = false;

      if (!this.pauseReason && !this.runEnded) {
        this.autoPausedByVisibility = true;
        this.setPause("pause");
        this.pushDebugEvent("autoPause:hidden");
      }

      return;
    }

    this.handlePointerFocus();

    if (this.autoPausedByVisibility && this.pauseReason === "pause") {
      this.setPause(null);
      this.pushDebugEvent("autoResume:visible");
    }

    this.autoPausedByVisibility = false;
  };

  private emitUpgradeOverlay(): void {
    if (!this.pendingUpgradeOptions || this.pendingUpgradeOptions.length === 0) {
      return;
    }

    this.ensureUiSceneActive();
    this.game.events.emit(EVENT_SHOW_UPGRADE, this.pendingUpgradeOptions);
    this.upgradeUiLastEmitMs = this.time.now;
  }

  private maintainUpgradeOverlay(): void {
    if (this.pauseReason !== "upgrade" || !this.pendingUpgradeOptions) {
      return;
    }

    if (this.time.now - this.upgradeUiLastEmitMs < 900) {
      if (this.upgradePauseStartedMs > 0 && this.time.now - this.upgradePauseStartedMs > 7000) {
        this.applyUpgradeChoice(this.pendingUpgradeOptions[0]?.id, true);
      }
      return;
    }

    this.emitUpgradeOverlay();

    if (this.upgradePauseStartedMs > 0 && this.time.now - this.upgradePauseStartedMs > 7000) {
      this.applyUpgradeChoice(this.pendingUpgradeOptions[0]?.id, true);
    }
  }

  private updateQaAutoPilot(deltaMs: number): void {
    if (!this.qaMode || !this.qaAutoMove || !this.player?.body || this.pauseReason || this.runEnded) {
      return;
    }

    if (this.time.now >= this.qaAutoNextTurnMs) {
      const dirs = [
        { x: 1, y: 0 },
        { x: -1, y: 0 },
        { x: 0, y: 1 },
        { x: 0, y: -1 },
        { x: 1, y: 1 },
        { x: -1, y: 1 },
        { x: 1, y: -1 },
        { x: -1, y: -1 }
      ];
      const next = dirs[this.rng.int(0, dirs.length - 1)];
      const length = Math.hypot(next.x, next.y) || 1;
      this.qaAutoDirX = next.x / length;
      this.qaAutoDirY = next.y / length;
      this.qaAutoNextTurnMs = this.time.now + randomInt(900, 1700);
      this.pushDebugEvent(`auto:dir(${this.qaAutoDirX.toFixed(2)},${this.qaAutoDirY.toFixed(2)})`);
    }

    const body = this.player.body as Phaser.Physics.Arcade.Body;
    const blocked = body.blocked.left || body.blocked.right || body.blocked.up || body.blocked.down;

    if (!blocked && this.playerMoveSpeed > 0 && body.speed < 6) {
      this.qaAutoStallMs += deltaMs;
    } else {
      this.qaAutoStallMs = 0;
    }

    if (this.qaAutoStallMs > 1400) {
      this.pushDebugEvent("auto:stall");
      this.dumpQaSnapshot();
      this.forceUnstick("auto-stall");
      this.qaAutoStallMs = 0;
    }
  }

  private guardMotionStall(deltaMs: number): void {
    if (!this.player?.body || this.pauseReason || this.runEnded) {
      this.motionStallMs = 0;
      this.lastPlayerX = this.player?.x ?? this.lastPlayerX;
      this.lastPlayerY = this.player?.y ?? this.lastPlayerY;
      return;
    }

    const body = this.player.body as Phaser.Physics.Arcade.Body;
    const intended = Math.hypot(this.moveIntentX, this.moveIntentY) > 0.01 || this.qaAutoMove;
    const movedSq = distSq(this.player.x, this.player.y, this.lastPlayerX, this.lastPlayerY);

    if (intended && body.speed > 60 && movedSq < 0.25) {
      this.motionStallMs += deltaMs;
    } else {
      this.motionStallMs = 0;
    }

    this.lastPlayerX = this.player.x;
    this.lastPlayerY = this.player.y;

    if (this.motionStallMs < 650) {
      return;
    }

    const width = this.level.mapSize.width;
    const height = this.level.mapSize.height;
    const nudgeX = this.player.x + this.moveIntentX * 14;
    const nudgeY = this.player.y + this.moveIntentY * 14;

    this.player.setPosition(clamp(nudgeX, 20, width - 20), clamp(nudgeY, 20, height - 20));
    this.player.setVelocity(this.moveIntentX * this.playerMoveSpeed, this.moveIntentY * this.playerMoveSpeed);
    this.motionStallMs = 0;
    this.pushDebugEvent("guard:nudge");
  }

  private setQaAutoMove(enabled: boolean): void {
    this.qaAutoMove = enabled;
    this.qaAutoStallMs = 0;
    this.qaAutoNextTurnMs = 0;
    this.pushDebugEvent(`auto:${enabled ? "on" : "off"}`);
    this.game.events.emit(EVENT_TOAST, `QA auto-move ${enabled ? "ON" : "OFF"}`);
  }

  private forceUnstick(source: string): void {
    if (!this.player?.body) {
      return;
    }

    this.handlePointerFocus();
    this.pendingUpgradeOptions = null;
    this.upgradePauseStartedMs = 0;

    if (this.pauseReason && this.pauseReason !== "result") {
      this.setPause(null);
    }

    this.game.events.emit(EVENT_HIDE_UPGRADE);
    this.game.events.emit(EVENT_PAUSE_SET, false);

    const body = this.player.body as Phaser.Physics.Arcade.Body;
    body.enable = true;
    this.player.setActive(true).setVisible(true);
    this.player.setVelocity(0, 0);
    this.player.setAcceleration(0, 0);
    this.player.setCollideWorldBounds(true);

    this.pushDebugEvent(`unstick:${source}`);
  }

  private initQaMode(): void {
    const params = new URLSearchParams(window.location.search);
    this.qaMode = params.has("qa");

    if (!this.qaMode) {
      return;
    }

    this.qaOverlay = this.add.text(14, this.scale.height - 14, "", {
      fontFamily: "Arial",
      fontSize: "16px",
      color: "#ffdd87",
      backgroundColor: "rgba(8, 18, 40, 0.72)",
      padding: { x: 8, y: 6 }
    });
    this.qaOverlay.setOrigin(0, 1);
    this.qaOverlay.setScrollFactor(0);
    this.qaOverlay.setDepth(1000);
    this.qaOverlay.setText("QA MODE | F4 drops | F5 forceCollect | F6 auto | F7 unstick | F8 snapshot");
    this.pushDebugEvent("qa:on");
    this.installQaApi();

    if (params.get("qaAuto") === "1") {
      this.setQaAutoMove(true);
    }
  }

  private updateQaOverlay(deltaMs: number): void {
    if (!this.qaMode || !this.qaOverlay || !this.player?.body) {
      return;
    }

    const body = this.player.body as Phaser.Physics.Arcade.Body;
    const phaserInputActive =
      this.keyW.isDown ||
      this.keyA.isDown ||
      this.keyS.isDown ||
      this.keyD.isDown ||
      this.keyUp.isDown ||
      this.keyLeft.isDown ||
      this.keyDown.isDown ||
      this.keyRight.isDown;
    const rawInputActive = this.rawUp || this.rawDown || this.rawLeft || this.rawRight;
    const keyInputActive = phaserInputActive || rawInputActive;
    const inputActive = keyInputActive || this.qaAutoMove;
    const blocked = body.blocked.left || body.blocked.right || body.blocked.up || body.blocked.down;
    const keyboardEnabled = this.input.keyboard?.enabled ?? false;
    const focusDoc = typeof document !== "undefined" ? document.hasFocus() : false;
    const focusCanvas = typeof document !== "undefined" ? document.activeElement === this.game.canvas : false;

    if (inputActive && !this.pauseReason && !blocked && body.speed < 6) {
      this.inputStallMs += deltaMs;
    } else {
      this.inputStallMs = 0;
    }

    const stallTag = this.inputStallMs > 1300 ? " STALL?" : "";
    this.qaOverlay.setText(
      [
        "QA MODE | F4 drops | F5 forceCollect | F6 auto | F7 unstick | F8 snapshot",
        `pause=${this.pauseReason || "none"} speed=${body.speed.toFixed(1)} moveStat=${this.playerMoveSpeed.toFixed(1)} input(phaser/raw/eff)=${phaserInputActive ? "1" : "0"}/${rawInputActive ? "1" : "0"}/${inputActive ? "1" : "0"}${stallTag}`,
        `auto=${this.qaAutoMove ? "1" : "0"} pickup=${this.qaLastPickupType}:${this.qaPickupCount}`,
        `kb=${keyboardEnabled ? "1" : "0"} focus(doc/canvas)=${focusDoc ? "1" : "0"}/${focusCanvas ? "1" : "0"}`,
        `pos=(${this.player.x.toFixed(0)},${this.player.y.toFixed(0)}) v=(${body.velocity.x.toFixed(0)},${body.velocity.y.toFixed(0)})`,
        `enemies=${this.enemies.countActive(true)} pickups=${this.pickups.countActive(true)} bullets=${
          this.playerBullets.countActive(true) + this.enemyBullets.countActive(true)
        }`,
        `saveDirty=${this.saveDirty ? "1" : "0"} events=${this.debugEvents.slice(-2).join(" | ")}`
      ].join("\n")
    );
  }

  private spawnQaStressDrops(count = 60): void {
    for (let index = 0; index < count; index += 1) {
      const x = this.player.x + randomRange(-120, 120);
      const y = this.player.y + randomRange(-120, 120);

      if (index % 3 === 0) {
        this.spawnPickup({ type: "xp", xp: 10, lifeMs: 10000 }, x, y);
      } else if (index % 3 === 1) {
        this.spawnPickup({ type: "credits", amount: 4, lifeMs: 10000 }, x, y);
      } else {
        this.spawnPickup({ type: "material", materialId: "scrap", qty: 1, lifeMs: 10000 }, x, y);
      }
    }
  }

  private qaForceCollectBurst(): void {
    const burst: PickupMeta[] = [
      { type: "credits", amount: 9, lifeMs: 1000 },
      { type: "material", materialId: "scrap", qty: 2, lifeMs: 1000 },
      { type: "material", materialId: "alloy", qty: 1, lifeMs: 1000 },
      { type: "xp", xp: 20, lifeMs: 1000 }
    ];

    for (let i = 0; i < burst.length; i += 1) {
      const visual = pickupVisual(burst[i].type);
      const pickup = this.pickups.get(this.player.x, this.player.y, visual.key) as Phaser.Physics.Arcade.Image | null;

      if (!pickup) {
        continue;
      }

      pickup.setActive(true).setVisible(true);
      pickup.setTexture(visual.key);
      pickup.setScale(visual.scale);
      pickup.body!.enable = true;
      pickup.setDepth(4);
      pickup.setPosition(this.player.x, this.player.y);
      pickup.setVelocity(0, 0);
      pickup.setAngularVelocity(0);
      const body = pickup.body as Phaser.Physics.Arcade.Body;
      body.setSize(visual.bodySize, visual.bodySize, true);
      this.pickupMeta.set(pickup, burst[i]);
      this.collectPickup(pickup);
    }

    this.pushDebugEvent("qa:forceCollect");
  }

  private markSaveDirty(): void {
    this.saveDirty = true;
  }

  private flushPendingSave(force = false): void {
    if (!this.saveDirty) {
      return;
    }

    const now = this.time.now;

    if (!force && now - this.saveLastFlushMs < 900) {
      return;
    }

    gameState.persistSave();
    this.saveDirty = false;
    this.saveLastFlushMs = now;
  }

  private pushDebugEvent(message: string): void {
    if (!this.qaMode) {
      return;
    }

    const stamp = `${Math.floor(this.time.now)}`;
    this.debugEvents.push(`${stamp}:${message}`);

    if (this.debugEvents.length > 30) {
      this.debugEvents.splice(0, this.debugEvents.length - 30);
    }
  }

  private dumpQaSnapshot(): void {
    if (!this.qaMode || !this.player?.body) {
      return;
    }

    const body = this.player.body as Phaser.Physics.Arcade.Body;
    const snapshot = {
      at: new Date().toISOString(),
      pause: this.pauseReason || "none",
      runEnded: this.runEnded,
      hp: this.playerHp,
      moveStat: this.playerMoveSpeed,
      autoMove: this.qaAutoMove,
      autoDir: { x: this.qaAutoDirX, y: this.qaAutoDirY },
      pickup: { count: this.qaPickupCount, lastType: this.qaLastPickupType },
      body: {
        x: this.player.x,
        y: this.player.y,
        vx: body.velocity.x,
        vy: body.velocity.y,
        speed: body.speed,
        enabled: body.enable
      },
      input: {
        w: this.keyW.isDown,
        a: this.keyA.isDown,
        s: this.keyS.isDown,
        d: this.keyD.isDown,
        up: this.keyUp.isDown,
        down: this.keyDown.isDown,
        left: this.keyLeft.isDown,
        right: this.keyRight.isDown,
        rawUp: this.rawUp,
        rawDown: this.rawDown,
        rawLeft: this.rawLeft,
        rawRight: this.rawRight
      },
      motionGuard: {
        intentX: this.moveIntentX,
        intentY: this.moveIntentY,
        stallMs: this.motionStallMs
      },
      focus: {
        keyboardEnabled: this.input.keyboard?.enabled ?? false,
        documentFocused: typeof document !== "undefined" ? document.hasFocus() : false,
        canvasFocused: typeof document !== "undefined" ? document.activeElement === this.game.canvas : false
      },
      counts: {
        enemies: this.enemies.countActive(true),
        pickups: this.pickups.countActive(true),
        bullets: this.playerBullets.countActive(true) + this.enemyBullets.countActive(true)
      },
      recentEvents: [...this.debugEvents]
    };

    (window as { __alienArenaQaSnapshot?: unknown }).__alienArenaQaSnapshot = snapshot;
    console.log("[AlienArena QA] snapshot", snapshot);
    this.pushDebugEvent("snapshot");
    this.game.events.emit(EVENT_TOAST, "QA snapshot dumped to console");
  }

  private installQaApi(): void {
    if (!this.qaMode) {
      return;
    }

    const api = {
      snapshot: (): void => this.dumpQaSnapshot(),
      spawnDrops: (count = 90): void => this.spawnQaStressDrops(count),
      forceCollect: (): void => this.qaForceCollectBurst(),
      autoMove: (enabled = true): void => this.setQaAutoMove(Boolean(enabled)),
      unstick: (): void => this.forceUnstick("api"),
      events: (): string[] => [...this.debugEvents]
    };

    (window as unknown as { __alienArenaQa?: typeof api }).__alienArenaQa = api;
    this.pushDebugEvent("api:ready");
  }

  private emitInventory(visible: boolean): void {
    if (!visible) {
      this.game.events.emit(EVENT_INVENTORY_REFRESH, {
        visible: false,
        credits: gameState.saveData.credits,
        materialsText: "",
        weapons: [],
        attachments: []
      });
      return;
    }

    const inv = gameState.saveData.inventory;

    const weapons = inv.weapons.flatMap(weapon => {
      const def = weaponById[weapon.weaponId];

      if (!def) {
        return [];
      }

      const slots = Object.entries(weapon.attachments || {})
        .map(([slot, itemId]) => {
          const item = inv.attachments.find(entry => entry.itemId === itemId);

          if (!item) {
            return `${slot}: empty`;
          }

          const attachmentDef = attachmentById[item.attachmentId];
          return `${slot}: ${attachmentDef ? attachmentDef.name : "unknown"}`;
        })
        .join(" | ");

      return [{
        instanceId: weapon.instanceId,
        title: `${def.name} (${weapon.rarity}) Lv.${weapon.level}${weapon.instanceId === inv.equippedWeaponId ? " [EQUIPPED]" : ""}`,
        details: slots || "No attachments",
        equipped: weapon.instanceId === inv.equippedWeaponId
      }];
    });

    const attachments = inv.attachments.flatMap(item => {
      const def = attachmentById[item.attachmentId];

      if (!def) {
        return [];
      }

      return [{
        itemId: item.itemId,
        title: `${def.name} [${def.slot}] (${def.rarity})${
          item.equippedTo === inv.equippedWeaponId ? " [EQUIPPED]" : item.equippedTo ? " [OTHER]" : ""
        }`,
        details: def.modifiers.map(mod => `${mod.stat} ${mod.value > 0 ? "+" : ""}${mod.value}`).join(" | "),
        equippedToCurrent: item.equippedTo === inv.equippedWeaponId
      }];
    });

    const m = inv.materials;

    this.game.events.emit(EVENT_INVENTORY_REFRESH, {
      visible,
      credits: gameState.saveData.credits,
      materialsText: `Materials: Scrap ${m.scrap} | Alloy ${m.alloy} | Core ${m.core} | Quantum ${m.quantum}`,
      weapons,
      attachments
    });
  }

  private emitCraft(visible: boolean): void {
    this.game.events.emit(EVENT_CRAFT_REFRESH, {
      visible,
      recipes: CRAFT_RECIPES.map(recipe => ({
        id: recipe.id,
        name: recipe.name,
        description: recipe.description,
        canCraft: canCraft(gameState.saveData.inventory, recipe.id)
      }))
    });
  }

  private refreshHud(): void {
    const remaining = Math.max(0, this.level.durationSec - this.elapsedMs / 1000);
    const weaponDef = weaponById[this.weapon.weaponId] || WEAPON_DEFS[0];

    this.game.events.emit(EVENT_HUD_UPDATE, {
      hp: this.playerHp,
      maxHp: this.playerMaxHp,
      xp: this.playerXp,
      xpToNext: this.playerXpToNext,
      level: this.playerLevel,
      kills: this.kills,
      timeText: formatSeconds(remaining),
      weaponName: `${weaponDef.name} (${this.weapon.rarity}) Lv.${this.weapon.level}`,
      weaponStatsText: `DMG ${this.weaponStats.damage.toFixed(0)} | Rate ${this.weaponStats.fireRate.toFixed(1)} | Mag ${this.weaponStats.magazineSize}`,
      ammoText: `Ammo ${this.weaponAmmo}/${this.weaponStats.magazineSize}`,
      reloadText: this.weaponReloadMs > 0 ? `Reload ${(this.weaponReloadMs / 1000).toFixed(1)}s` : "Ready",
      missionText: this.level.name,
      objectiveText: `Kills ${this.kills} / ${this.level.killTarget}`,
      creditsText: String(gameState.saveData.credits),
      perkText: this.getPerkSummaryText()
    });
  }

  private disableBodyObject<T extends Phaser.Physics.Arcade.Image>(obj: T): void {
    if (obj === this.player) {
      this.pushDebugEvent("guard:disable-player-blocked");
      return;
    }

    obj.setActive(false).setVisible(false);
    obj.body!.enable = false;
    obj.setVelocity(0, 0);
  }

  private applyUpgradeChoice(upgradeId: string | undefined, auto = false): void {
    if (this.pauseReason !== "upgrade") {
      return;
    }

    if (!upgradeId) {
      return;
    }

    const upgrade = upgradeById[upgradeId];

    if (!upgrade) {
      return;
    }

    this.activeUpgradeIds.push(upgrade.id);
    this.activeUpgrades.push(upgrade);

    if (upgrade.healFlat) {
      this.playerHp = clamp(this.playerHp + upgrade.healFlat, 0, this.playerMaxHp);
    }

    this.refreshDerivedStats();
    this.spawnUpgradeApplyFx(upgrade);
    this.upgradeAuraPulseMs = 0;
    this.pendingUpgradeOptions = null;
    this.upgradePauseStartedMs = 0;
    this.setPause(null);
    this.game.events.emit(EVENT_HIDE_UPGRADE);
    this.pushDebugEvent(`upgrade:pick:${upgrade.id}${auto ? ":auto" : ""}`);
    const stackCount = this.getUpgradeStack(upgrade.id);
    const prefix = auto ? "Auto upgrade" : "Upgrade";
    this.game.events.emit(EVENT_TOAST, `${prefix} x${stackCount}: ${upgrade.name}`);
  }

  private onUpgradePick = (upgradeId: string): void => {
    this.applyUpgradeChoice(upgradeId, false);
  };

  private onPauseResume = (): void => {
    if (this.pauseReason === "pause") {
      this.setPause(null);
    }
  };

  private onPauseExit = (): void => {
    this.exitToLevels();
  };

  private onPauseMainMenu = (): void => {
    this.exitToMainMenu();
  };

  private onEquipWeapon = (instanceId: string): void => {
    gameState.saveData.inventory.equippedWeaponId = instanceId;
    this.syncLoadout();
    this.refreshDerivedStats();
    this.spawnWeaponSwapFx(this.weapon.weaponId);
    gameState.persistSave();
    this.emitInventory(true);
  };

  private onEquipAttachment = (itemId: string): void => {
    const inv = gameState.saveData.inventory;
    const item = inv.attachments.find(entry => entry.itemId === itemId);

    if (!item) {
      return;
    }

    const def = attachmentById[item.attachmentId];
    const weapon = this.weapon;
    const weaponDef = weaponById[weapon.weaponId];

    if (!weaponDef.attachmentSlots.includes(def.slot)) {
      this.game.events.emit(EVENT_TOAST, `${weaponDef.name} has no ${def.slot} slot.`);
      return;
    }

    if (item.equippedTo && item.equippedTo !== weapon.instanceId) {
      const from = inv.weapons.find(entry => entry.instanceId === item.equippedTo);

      if (from) {
        const entries = Object.entries(from.attachments || {});

        for (let index = 0; index < entries.length; index += 1) {
          if (entries[index][1] === item.itemId) {
            delete from.attachments[entries[index][0] as keyof WeaponInstance["attachments"]];
          }
        }
      }
    }

    const currentItemId = weapon.attachments[def.slot];

    if (currentItemId) {
      const current = inv.attachments.find(entry => entry.itemId === currentItemId);

      if (current) {
        current.equippedTo = null;
      }
    }

    weapon.attachments[def.slot] = item.itemId;
    item.equippedTo = weapon.instanceId;

    syncAttachmentOwnership(inv);
    this.refreshDerivedStats();
    gameState.persistSave();

    this.emitInventory(true);
    this.emitCraft(this.pauseReason === "craft");

    this.game.events.emit(EVENT_TOAST, `Equipped ${def.name}`);
  };

  private onDetachAttachment = (itemId: string): void => {
    const inv = gameState.saveData.inventory;

    for (let w = 0; w < inv.weapons.length; w += 1) {
      const weapon = inv.weapons[w];
      const entries = Object.entries(weapon.attachments || {});

      for (let e = 0; e < entries.length; e += 1) {
        const [slot, attached] = entries[e];

        if (attached !== itemId) {
          continue;
        }

        delete weapon.attachments[slot as keyof WeaponInstance["attachments"]];
      }
    }

    const item = inv.attachments.find(entry => entry.itemId === itemId);

    if (item) {
      item.equippedTo = null;
    }

    syncAttachmentOwnership(inv);
    this.refreshDerivedStats();
    gameState.persistSave();

    this.emitInventory(true);
    this.emitCraft(this.pauseReason === "craft");
  };

  private onCraft = (recipeId: string): void => {
    const result = craft(gameState.saveData.inventory, recipeId);

    syncAttachmentOwnership(gameState.saveData.inventory);
    this.syncLoadout();
    this.refreshDerivedStats();
    gameState.persistSave();

    this.emitInventory(this.pauseReason === "inventory");
    this.emitCraft(true);

    this.game.events.emit(EVENT_TOAST, result);
  };

  private onCloseInventory = (): void => {
    if (this.pauseReason === "inventory") {
      this.setPause(null);
      this.emitInventory(false);
    }
  };

  private onCloseCraft = (): void => {
    if (this.pauseReason === "craft") {
      this.setPause(null);
      this.emitCraft(false);
    }
  };

  private onResultNext = (): void => {
    if (!this.runEnded || !this.nextLevelId) {
      return;
    }

    this.flushPendingSave(true);
    this.game.events.emit(EVENT_HIDE_RESULT);
    gameState.selectedLevelId = this.nextLevelId;
    this.scene.restart();
  };

  private onResultLevels = (): void => {
    this.exitToLevels();
  };

  private onResultMainMenu = (): void => {
    this.exitToMainMenu();
  };

  private exitToLevels(): void {
    this.flushPendingSave(true);
    this.pendingUpgradeOptions = null;
    this.upgradePauseStartedMs = 0;
    this.game.events.emit(EVENT_HIDE_RESULT);
    this.game.events.emit(EVENT_HIDE_UPGRADE);
    this.game.events.emit(EVENT_PAUSE_SET, false);
    this.emitInventory(false);
    this.emitCraft(false);
    this.scene.stop("UIScene");
    this.scene.start("LevelSelectScene");
  }

  private exitToMainMenu(): void {
    this.flushPendingSave(true);
    this.pendingUpgradeOptions = null;
    this.upgradePauseStartedMs = 0;
    this.game.events.emit(EVENT_HIDE_RESULT);
    this.game.events.emit(EVENT_HIDE_UPGRADE);
    this.game.events.emit(EVENT_PAUSE_SET, false);
    this.emitInventory(false);
    this.emitCraft(false);
    this.scene.stop("UIScene");
    this.scene.start("MainMenuScene");
  }
}
