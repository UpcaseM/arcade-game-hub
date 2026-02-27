import Phaser from "phaser";
import { AudioManager } from "../../core/audio";
import { craft, addAttachment, addMaterial, addWeapon, canCraft, syncAttachmentOwnership } from "../../core/inventory";
import { clamp, formatSeconds, smoothAngle } from "../../core/math";
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

const weaponById = Object.fromEntries(WEAPON_DEFS.map(item => [item.id, item]));
const attachmentById = Object.fromEntries(ATTACHMENT_DEFS.map(item => [item.id, item]));
const enemyById = Object.fromEntries(ENEMY_DEFS.map(item => [item.id, item]));
const levelById = Object.fromEntries(LEVEL_DEFS.map(item => [item.id, item]));
const upgradeById = Object.fromEntries(UPGRADE_DEFS.map(item => [item.id, item]));

function pickupTexture(type: PickupMeta["type"]): string {
  if (type === "xp") return "tex_pickup_xp";
  if (type === "credits") return "tex_pickup_credits";
  if (type === "material") return "tex_pickup_material";
  if (type === "weapon") return "tex_pickup_weapon";
  return "tex_pickup_attachment";
}

function enemyTexture(enemyId: string): string {
  if (enemyId === "spitter") return "tex_enemy_spitter";
  if (enemyId === "swarmling") return "tex_enemy_swarmling";
  if (enemyId === "crusher") return "tex_enemy_crusher";
  return "tex_enemy_crawler";
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

    this.syncLoadout();
    this.refreshDerivedStats();

    this.weaponAmmo = this.weaponStats.magazineSize;
    this.weaponCooldownMs = 0;
    this.weaponReloadMs = 0;

    this.audio.setVolume(gameState.saveData.options.masterVolume);

    this.bindCommands();
    this.ensureUiSceneActive();

    this.setupDone = true;
    this.refreshHud();
    this.emitInventory(false);
    this.emitCraft(false);

    this.input.once("pointerdown", () => {
      this.audio.ensureContext().then(() => this.audio.startBgm()).catch(() => {});
    });
  }

  private createArenaGrid(width: number, height: number): void {
    const g = this.add.graphics();
    g.fillStyle(0x020611, 1);
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
    this.player.setDepth(6);
    this.player.setCollideWorldBounds(true);
    this.player.setDamping(false);
    this.player.setDrag(1200, 1200);
    this.player.setMaxVelocity(320, 320);

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

    this.physics.add.overlap(this.pickups, this.player, pickupObj => {
      const pickup = pickupObj as Phaser.Physics.Arcade.Image;
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
    });
  }

  update(_time: number, delta: number): void {
    if (!this.setupDone || this.runEnded) {
      return;
    }

    this.handleHotkeys();

    if (this.pauseReason) {
      this.refreshHud();
      return;
    }

    this.elapsedMs += delta;
    this.playerIFrameMs = Math.max(0, this.playerIFrameMs - delta);

    this.processSpawns();
    this.updatePlayer(delta / 1000);
    this.updateWeapon(delta);
    this.updateBullets(delta);
    this.updateEnemies(delta);
    this.updatePickups(delta);

    this.checkLevelUpQueue();
    this.checkMissionResult();

    this.refreshHud();
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
  }

  private setPause(reason: PauseReason): void {
    this.pauseReason = reason;
    this.game.events.emit(EVENT_PAUSE_SET, reason === "pause");

    if (reason) {
      this.player.setAcceleration(0, 0);
      this.player.setVelocity(0, 0);
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

    const enemy = this.enemies.get(pos.x, pos.y, enemyTexture(enemyId)) as Phaser.Physics.Arcade.Image | null;

    if (!enemy) {
      return;
    }

    enemy.setActive(true).setVisible(true);
    enemy.setPosition(pos.x, pos.y);
    enemy.setDepth(4);
    if (enemy.body) {
      enemy.body.enable = true;
    }
    enemy.setVelocity(0, 0);

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

  private updatePlayer(deltaSec: number): void {
    let moveX = 0;
    let moveY = 0;

    if (this.keyW.isDown || this.keyUp.isDown) moveY -= 1;
    if (this.keyS.isDown || this.keyDown.isDown) moveY += 1;
    if (this.keyA.isDown || this.keyLeft.isDown) moveX -= 1;
    if (this.keyD.isDown || this.keyRight.isDown) moveX += 1;

    const len = Math.hypot(moveX, moveY);

    if (len > 0.001) {
      moveX /= len;
      moveY /= len;
    }

    const body = this.player.body as Phaser.Physics.Arcade.Body;
    const accel = this.playerMoveSpeed * 8;

    if (len > 0.001) {
      body.setAcceleration(moveX * accel, moveY * accel);
    } else {
      body.setAcceleration(0, 0);

      if (body.speed < 10) {
        body.setVelocity(0, 0);
      }
    }

    body.setMaxVelocity(this.playerMoveSpeed, this.playerMoveSpeed);

    const pointer = this.input.activePointer;
    const worldPoint = this.cameras.main.getWorldPoint(pointer.x, pointer.y);
    const targetAngle = Phaser.Math.Angle.Between(this.player.x, this.player.y, worldPoint.x, worldPoint.y);
    this.player.rotation = smoothAngle(this.player.rotation, targetAngle, deltaSec * 9.4);
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

    if (!this.input.activePointer.isDown || this.weaponCooldownMs > 0) {
      return;
    }

    const pellets = this.weaponStats.pellets;

    for (let index = 0; index < pellets; index += 1) {
      const bullet = this.playerBullets.get(this.player.x, this.player.y, "tex_bullet") as Phaser.Physics.Arcade.Image | null;

      if (!bullet) {
        break;
      }

      bullet.setActive(true).setVisible(true);
      bullet.body!.enable = true;
      bullet.setDepth(7);

      const spread = Phaser.Math.DegToRad(randomRange(-this.weaponStats.spreadDeg * 0.5, this.weaponStats.spreadDeg * 0.5));
      const angle = this.player.rotation + spread;

      bullet.setPosition(this.player.x + Math.cos(angle) * 22, this.player.y + Math.sin(angle) * 22);
      bullet.setVelocity(Math.cos(angle) * this.weaponStats.projectileSpeed, Math.sin(angle) * this.weaponStats.projectileSpeed);

      this.bulletMeta.set(bullet, {
        lifeMs: (this.weaponStats.rangePx / this.weaponStats.projectileSpeed) * 1000,
        damage: this.weaponStats.damage,
        critChance: this.playerCritChance,
        critDamage: this.playerCritDamage
      });
    }

    this.weaponAmmo -= 1;
    this.weaponCooldownMs = 1000 / this.weaponStats.fireRate;
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

      if (meta.lifeMs <= 0) {
        this.disableBodyObject(bullet);
      }
    }
  }

  private updateEnemies(deltaMs: number): void {
    const enemies = this.enemies.getChildren() as Phaser.Physics.Arcade.Image[];

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

      if (meta.hitFlashMs > 0) {
        meta.hitFlashMs -= deltaMs;
        enemy.setTint(0xffe28d);
      } else {
        enemy.clearTint();
      }

      if (distance <= 23 + (meta.def.id === "crusher" ? 8 : 0)) {
        this.damagePlayer(meta.def.contactDamage, meta.def.name);
      }
    }
  }

  private updatePickups(deltaMs: number): void {
    const pickups = this.pickups.getChildren() as Phaser.Physics.Arcade.Image[];

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

      const dx = this.player.x - pickup.x;
      const dy = this.player.y - pickup.y;
      const distance = Math.hypot(dx, dy) || 0.001;

      if (distance < this.playerPickupRange) {
        const pull = (1 - distance / this.playerPickupRange) * 340;
        pickup.setVelocity((dx / distance) * pull, (dy / distance) * pull);
      } else {
        pickup.setVelocity(pickup.body!.velocity.x * 0.94, pickup.body!.velocity.y * 0.94);
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

    this.disableBodyObject(bullet);

    const crit = Math.random() < bMeta.critChance;
    const amount = Math.max(1, Math.round(crit ? bMeta.damage * bMeta.critDamage : bMeta.damage));

    eMeta.hp -= amount;
    eMeta.hitFlashMs = 90;

    this.cameras.main.shake(crit ? 55 : 30, crit ? 0.004 : 0.002);
    this.audio.hit();

    if (eMeta.hp <= 0) {
      this.killEnemy(enemy, eMeta);
    }
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

    const speed = 390;
    bullet.setVelocity(Math.cos(angle) * speed, Math.sin(angle) * speed);

    this.bulletMeta.set(bullet, {
      lifeMs: 2800,
      damage,
      critChance: 0,
      critDamage: 1
    });
  }

  private killEnemy(enemy: Phaser.Physics.Arcade.Image, meta: EnemyMeta): void {
    this.disableBodyObject(enemy);
    this.kills += 1;
    gameState.saveData.stats.totalKills += 1;

    this.spawnDrop(meta, enemy.x, enemy.y);

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
        const rarity = this.rollRarity(weaponById[weaponId].rarity);
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
    const sprite = this.pickups.get(x, y, pickupTexture(meta.type)) as Phaser.Physics.Arcade.Image | null;

    if (!sprite) {
      return;
    }

    sprite.setActive(true).setVisible(true);
    sprite.body!.enable = true;
    sprite.setDepth(4);
    sprite.setPosition(x, y);
    sprite.setVelocity(randomRange(-38, 38), randomRange(-38, 38));

    this.pickupMeta.set(sprite, meta);
  }

  private collectPickup(pickup: Phaser.Physics.Arcade.Image): void {
    if (!pickup.active) {
      return;
    }

    const meta = this.pickupMeta.get(pickup);

    if (!meta) {
      this.disableBodyObject(pickup);
      return;
    }

    this.pickupMeta.delete(pickup);
    this.disableBodyObject(pickup);

    if (meta.type === "xp") {
      this.gainXp(meta.xp);
      this.audio.pickup();
      return;
    }

    let loadoutChanged = false;

    if (meta.type === "credits") {
      gameState.saveData.credits += meta.amount;
      this.runCreditsEarned += meta.amount;
      this.game.events.emit(EVENT_TOAST, `+${meta.amount} Credits`);
    } else if (meta.type === "material") {
      addMaterial(gameState.saveData.inventory, meta.materialId, meta.qty);
      this.runMaterialsEarned[meta.materialId] += meta.qty;
      this.game.events.emit(EVENT_TOAST, `+${meta.qty} ${MATERIAL_LABELS[meta.materialId]}`);
    } else if (meta.type === "weapon") {
      const weaponDef = weaponById[meta.weaponId];

      if (weaponDef) {
        addWeapon(gameState.saveData.inventory, meta.weaponId, meta.level, meta.rarity);
        loadoutChanged = true;
        this.game.events.emit(EVENT_TOAST, `Weapon found: ${weaponDef.name}`);
      } else {
        this.game.events.emit(EVENT_TOAST, `Skipped unknown weapon drop (${meta.weaponId}).`);
      }
    } else if (meta.type === "attachment") {
      const attachmentDef = attachmentById[meta.attachmentId];

      if (attachmentDef) {
        addAttachment(gameState.saveData.inventory, meta.attachmentId);
        loadoutChanged = true;
        this.game.events.emit(EVENT_TOAST, `Attachment found: ${attachmentDef.name}`);
      } else {
        this.game.events.emit(EVENT_TOAST, `Skipped unknown attachment drop (${meta.attachmentId}).`);
      }
    }

    syncAttachmentOwnership(gameState.saveData.inventory);
    gameState.persistSave();

    if (loadoutChanged) {
      this.syncLoadout();
      this.refreshDerivedStats();
    }

    this.emitInventory(this.pauseReason === "inventory");
    this.emitCraft(this.pauseReason === "craft");

    this.audio.pickup();
  }

  private gainXp(amount: number): void {
    this.playerXp += amount;

    while (this.playerXp >= this.playerXpToNext) {
      this.playerXp -= this.playerXpToNext;
      this.playerLevel += 1;
      this.playerXpToNext = getXpRequired(this.playerLevel);
      this.queuedLevelUps += 1;
      gameState.saveData.stats.highestLevel = Math.max(gameState.saveData.stats.highestLevel, this.playerLevel);
    }
  }

  private checkLevelUpQueue(): void {
    if (this.pauseReason || this.queuedLevelUps <= 0) {
      return;
    }

    this.queuedLevelUps -= 1;
    const choices = choiceWeighted(UPGRADE_DEFS, 3);

    if (choices.length === 0) {
      return;
    }

    this.ensureUiSceneActive();
    this.setPause("upgrade");
    this.game.events.emit(
      EVENT_SHOW_UPGRADE,
      choices.map(item => ({ id: item.id, name: item.name, description: item.description }))
    );
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
    this.pauseReason = "result";
    this.game.events.emit(EVENT_PAUSE_SET, false);
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

  private ensureUiSceneActive(): void {
    if (this.scene.isSleeping("UIScene")) {
      this.scene.wake("UIScene");
    }

    if (!this.scene.isActive("UIScene")) {
      this.scene.launch("UIScene");
    }

    this.scene.bringToTop("UIScene");
  }

  private emitInventory(visible: boolean): void {
    const inv = gameState.saveData.inventory;

    const weapons = inv.weapons.map(weapon => {
      const def = weaponById[weapon.weaponId];
      const slots = Object.entries(weapon.attachments || {})
        .map(([slot, itemId]) => {
          const item = inv.attachments.find(entry => entry.itemId === itemId);

          if (!item) {
            return `${slot}: empty`;
          }

          return `${slot}: ${attachmentById[item.attachmentId].name}`;
        })
        .join(" | ");

      return {
        instanceId: weapon.instanceId,
        title: `${def.name} (${weapon.rarity}) Lv.${weapon.level}${weapon.instanceId === inv.equippedWeaponId ? " [EQUIPPED]" : ""}`,
        details: slots || "No attachments",
        equipped: weapon.instanceId === inv.equippedWeaponId
      };
    });

    const attachments = inv.attachments.map(item => {
      const def = attachmentById[item.attachmentId];

      return {
        itemId: item.itemId,
        title: `${def.name} [${def.slot}] (${def.rarity})${
          item.equippedTo === inv.equippedWeaponId ? " [EQUIPPED]" : item.equippedTo ? " [OTHER]" : ""
        }`,
        details: def.modifiers.map(mod => `${mod.stat} ${mod.value > 0 ? "+" : ""}${mod.value}`).join(" | "),
        equippedToCurrent: item.equippedTo === inv.equippedWeaponId
      };
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

    this.game.events.emit(EVENT_HUD_UPDATE, {
      hp: this.playerHp,
      maxHp: this.playerMaxHp,
      xp: this.playerXp,
      xpToNext: this.playerXpToNext,
      level: this.playerLevel,
      kills: this.kills,
      timeText: formatSeconds(remaining),
      weaponName: `${weaponById[this.weapon.weaponId].name} (${this.weapon.rarity}) Lv.${this.weapon.level}`,
      weaponStatsText: `DMG ${this.weaponStats.damage.toFixed(0)} | Rate ${this.weaponStats.fireRate.toFixed(1)} | Mag ${this.weaponStats.magazineSize}`,
      ammoText: `Ammo ${this.weaponAmmo}/${this.weaponStats.magazineSize}`,
      reloadText: this.weaponReloadMs > 0 ? `Reload ${(this.weaponReloadMs / 1000).toFixed(1)}s` : "Ready",
      missionText: this.level.name,
      objectiveText: `Kills ${this.kills} / ${this.level.killTarget}`,
      creditsText: String(gameState.saveData.credits)
    });
  }

  private disableBodyObject<T extends Phaser.Physics.Arcade.Image>(obj: T): void {
    obj.setActive(false).setVisible(false);
    obj.body!.enable = false;
    obj.setVelocity(0, 0);
  }

  private onUpgradePick = (upgradeId: string): void => {
    if (this.pauseReason !== "upgrade") {
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
    this.setPause(null);
    this.game.events.emit(EVENT_HIDE_UPGRADE);
    this.game.events.emit(EVENT_TOAST, `Upgrade: ${upgrade.name}`);
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
    this.game.events.emit(EVENT_HIDE_RESULT);
    this.game.events.emit(EVENT_HIDE_UPGRADE);
    this.game.events.emit(EVENT_PAUSE_SET, false);
    this.emitInventory(false);
    this.emitCraft(false);
    this.scene.stop("UIScene");
    this.scene.start("LevelSelectScene");
  }

  private exitToMainMenu(): void {
    this.game.events.emit(EVENT_HIDE_RESULT);
    this.game.events.emit(EVENT_HIDE_UPGRADE);
    this.game.events.emit(EVENT_PAUSE_SET, false);
    this.emitInventory(false);
    this.emitCraft(false);
    this.scene.stop("UIScene");
    this.scene.start("MainMenuScene");
  }
}
