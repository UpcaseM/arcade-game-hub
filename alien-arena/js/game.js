import {
  ATTACHMENT_DEFS,
  CRAFT_RECIPES,
  DEFAULT_OPTIONS,
  DEFAULT_PLAYER_BASE_STATS,
  DROP_TABLES,
  ENEMY_DEFS,
  LEVEL_DEFS,
  MATERIAL_LABELS,
  RARITY_MULTIPLIER,
  RARITY_ORDER,
  UPGRADE_DEFS,
  WEAPON_DEFS
} from "./data.js";
import { loadSaveData, resetSaveData, saveGameData } from "./save.js";

const TWO_PI = Math.PI * 2;

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function lerp(current, target, amount) {
  return current + (target - current) * amount;
}

function distSq(ax, ay, bx, by) {
  const dx = ax - bx;
  const dy = ay - by;
  return dx * dx + dy * dy;
}

function randomRange(min, max) {
  return min + Math.random() * (max - min);
}

function randomInt(min, max) {
  return Math.floor(randomRange(min, max + 1));
}

function angleWrap(value) {
  let angle = value;

  while (angle > Math.PI) {
    angle -= TWO_PI;
  }

  while (angle < -Math.PI) {
    angle += TWO_PI;
  }

  return angle;
}

function smoothAngle(current, target, maxDelta) {
  const delta = angleWrap(target - current);

  if (Math.abs(delta) <= maxDelta) {
    return target;
  }

  return current + Math.sign(delta) * maxDelta;
}

function formatPct(value) {
  return `${Math.round(value * 100)}%`;
}

function formatSeconds(totalSeconds) {
  const seconds = Math.max(0, Math.floor(totalSeconds));
  const mm = String(Math.floor(seconds / 60)).padStart(2, "0");
  const ss = String(seconds % 60).padStart(2, "0");
  return `${mm}:${ss}`;
}

function makeId(prefix) {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

function rarityIndex(rarity) {
  return Math.max(0, RARITY_ORDER.indexOf(rarity));
}

function createPool(size, factory) {
  return Array.from({ length: size }, () => factory());
}

function resetPool(pool, resetFn) {
  for (let index = 0; index < pool.length; index += 1) {
    resetFn(pool[index]);
  }
}

function acquireFromPool(pool) {
  for (let index = 0; index < pool.length; index += 1) {
    if (!pool[index].active) {
      return pool[index];
    }
  }

  return null;
}

function choiceWeighted(items, pickCount = 1) {
  const remaining = [...items];
  const picks = [];

  while (remaining.length > 0 && picks.length < pickCount) {
    let totalWeight = 0;

    for (let index = 0; index < remaining.length; index += 1) {
      totalWeight += Math.max(0.001, remaining[index].weight ?? 1);
    }

    let marker = Math.random() * totalWeight;
    let selectedIndex = remaining.length - 1;

    for (let index = 0; index < remaining.length; index += 1) {
      marker -= Math.max(0.001, remaining[index].weight ?? 1);

      if (marker <= 0) {
        selectedIndex = index;
        break;
      }
    }

    picks.push(remaining[selectedIndex]);
    remaining.splice(selectedIndex, 1);
  }

  return picks;
}

class AudioManager {
  constructor(volume = DEFAULT_OPTIONS.masterVolume) {
    this.masterVolume = clamp(volume, 0, 1);
    this.context = null;
    this.bgmOsc = null;
    this.bgmGain = null;
  }

  ensureContext() {
    if (!this.context) {
      this.context = new window.AudioContext();
    }

    if (this.context.state === "suspended") {
      return this.context.resume();
    }

    return Promise.resolve();
  }

  setVolume(volume) {
    this.masterVolume = clamp(volume, 0, 1);

    if (this.bgmGain) {
      this.bgmGain.gain.value = this.masterVolume * 0.08;
    }
  }

  beep(frequency, durationMs, type = "sine", gain = 0.06) {
    if (!this.context) {
      return;
    }

    const now = this.context.currentTime;
    const osc = this.context.createOscillator();
    const gainNode = this.context.createGain();

    osc.type = type;
    osc.frequency.value = frequency;

    gainNode.gain.setValueAtTime(0, now);
    gainNode.gain.linearRampToValueAtTime(gain * this.masterVolume, now + 0.008);
    gainNode.gain.exponentialRampToValueAtTime(0.0001, now + durationMs / 1000);

    osc.connect(gainNode);
    gainNode.connect(this.context.destination);
    osc.start(now);
    osc.stop(now + durationMs / 1000 + 0.02);
  }

  playShoot() {
    this.beep(340 + Math.random() * 70, 60, "square", 0.02);
  }

  playHit() {
    this.beep(180 + Math.random() * 40, 85, "triangle", 0.03);
  }

  playKill() {
    this.beep(140, 120, "sawtooth", 0.035);
  }

  playPickup() {
    this.beep(620, 90, "sine", 0.035);
  }

  playLevelUp() {
    this.beep(440, 120, "triangle", 0.04);
    this.beep(680, 180, "triangle", 0.03);
  }

  playCraft() {
    this.beep(520, 140, "square", 0.04);
  }

  startBgm() {
    if (!this.context || this.bgmOsc) {
      return;
    }

    this.bgmOsc = this.context.createOscillator();
    this.bgmGain = this.context.createGain();

    this.bgmOsc.type = "triangle";
    this.bgmOsc.frequency.value = 72;
    this.bgmGain.gain.value = this.masterVolume * 0.08;

    this.bgmOsc.connect(this.bgmGain);
    this.bgmGain.connect(this.context.destination);
    this.bgmOsc.start();
  }

  stopBgm() {
    if (!this.bgmOsc) {
      return;
    }

    this.bgmOsc.stop();
    this.bgmOsc.disconnect();
    this.bgmGain.disconnect();
    this.bgmOsc = null;
    this.bgmGain = null;
  }
}

const WEAPON_BY_ID = Object.fromEntries(WEAPON_DEFS.map(def => [def.id, def]));
const ATTACHMENT_BY_ID = Object.fromEntries(ATTACHMENT_DEFS.map(def => [def.id, def]));
const ENEMY_BY_ID = Object.fromEntries(ENEMY_DEFS.map(def => [def.id, def]));
const UPGRADE_BY_ID = Object.fromEntries(UPGRADE_DEFS.map(def => [def.id, def]));
const LEVEL_BY_ID = Object.fromEntries(LEVEL_DEFS.map(def => [def.id, def]));

function baseModifierTotals() {
  return {
    damageMul: 0,
    fireRateMul: 0,
    reloadTimeMul: 0,
    critChanceAdd: 0,
    critDamageMul: 0,
    spreadDegAdd: 0,
    magazineSizeAdd: 0,
    projectileSpeedMul: 0,
    moveSpeedMul: 0,
    maxHpAdd: 0,
    pickupRangeMul: 0
  };
}

export class AlienArenaGame {
  constructor(root) {
    this.root = root;
    this.canvas = root.querySelector("#gameCanvas");
    this.ctx = this.canvas.getContext("2d");

    this.refs = {
      screenMainMenu: root.querySelector("#screenMainMenu"),
      screenLevelSelect: root.querySelector("#screenLevelSelect"),
      screenGame: root.querySelector("#screenGame"),
      levelCards: root.querySelector("#levelCards"),
      btnContinue: root.querySelector("#btnContinue"),
      btnLevelSelect: root.querySelector("#btnLevelSelect"),
      btnBackMain: root.querySelector("#btnBackMain"),
      metaSummary: root.querySelector("#metaSummary"),
      resourceSummary: root.querySelector("#resourceSummary"),
      clearSaveBtn: root.querySelector("#clearSaveBtn"),
      hpBarFill: root.querySelector("#hpBarFill"),
      xpBarFill: root.querySelector("#xpBarFill"),
      hpText: root.querySelector("#hpText"),
      xpText: root.querySelector("#xpText"),
      playerLevelText: root.querySelector("#playerLevelText"),
      killsText: root.querySelector("#killsText"),
      timerText: root.querySelector("#timerText"),
      weaponNameText: root.querySelector("#weaponNameText"),
      weaponStatsText: root.querySelector("#weaponStatsText"),
      ammoText: root.querySelector("#ammoText"),
      reloadText: root.querySelector("#reloadText"),
      missionText: root.querySelector("#missionText"),
      objectiveText: root.querySelector("#objectiveText"),
      creditsText: root.querySelector("#creditsText"),
      inventoryPanel: root.querySelector("#inventoryPanel"),
      closeInventoryBtn: root.querySelector("#closeInventoryBtn"),
      inventoryCredits: root.querySelector("#inventoryCredits"),
      materialSummary: root.querySelector("#materialSummary"),
      weaponList: root.querySelector("#weaponList"),
      attachmentList: root.querySelector("#attachmentList"),
      craftPanel: root.querySelector("#craftPanel"),
      closeCraftBtn: root.querySelector("#closeCraftBtn"),
      craftRecipeList: root.querySelector("#craftRecipeList"),
      pauseOverlay: root.querySelector("#pauseOverlay"),
      btnResume: root.querySelector("#btnResume"),
      btnExitToLevels: root.querySelector("#btnExitToLevels"),
      volumeInput: root.querySelector("#volumeInput"),
      upgradeOverlay: root.querySelector("#upgradeOverlay"),
      upgradeCards: root.querySelector("#upgradeCards"),
      resultOverlay: root.querySelector("#resultOverlay"),
      resultTitle: root.querySelector("#resultTitle"),
      resultSummary: root.querySelector("#resultSummary"),
      btnNextMission: root.querySelector("#btnNextMission"),
      btnResultLevels: root.querySelector("#btnResultLevels"),
      toastRack: root.querySelector("#toastRack"),
      hitFlash: root.querySelector("#hitFlash")
    };

    this.currentScreen = "main";
    this.save = loadSaveData();
    this.audio = new AudioManager(this.save.options.masterVolume);

    this.mouse = {
      x: this.canvas.width / 2,
      y: this.canvas.height / 2,
      down: false
    };

    this.keys = new Set();
    this.pointerInsideCanvas = false;
    this.lastTimestamp = 0;
    this.animationFrame = null;
    this.hitStopMs = 0;

    this.pools = {
      bullets: createPool(420, () => ({ active: false })),
      enemyBullets: createPool(220, () => ({ active: false })),
      enemies: createPool(260, () => ({ active: false })),
      pickups: createPool(260, () => ({ active: false })),
      floatTexts: createPool(140, () => ({ active: false }))
    };

    this.run = null;
  }

  init() {
    this.syncAttachmentAssignments();
    this.persistSave();
    this.bindUiEvents();
    this.refreshMetaUi();
    this.renderLevelCards();
    this.showScreen("main");
    this.refs.volumeInput.value = String(this.save.options.masterVolume);
    this.loop(performance.now());
  }

  bindUiEvents() {
    this.refs.btnContinue.addEventListener("click", () => {
      const unlocked = this.getUnlockedLevels();
      const lastLevel = unlocked[unlocked.length - 1] || LEVEL_DEFS[0];
      this.startRun(lastLevel.id);
    });

    this.refs.btnLevelSelect.addEventListener("click", () => {
      this.renderLevelCards();
      this.showScreen("levels");
    });

    this.refs.btnBackMain.addEventListener("click", () => {
      this.showScreen("main");
    });

    this.refs.clearSaveBtn.addEventListener("click", () => {
      const accepted = window.confirm("Reset all Alien Arena progress? This cannot be undone.");

      if (!accepted) {
        return;
      }

      this.save = resetSaveData();
      this.refreshMetaUi();
      this.renderLevelCards();
      this.toast("Save reset.");
    });

    this.refs.closeInventoryBtn.addEventListener("click", () => this.toggleInventory(false));
    this.refs.closeCraftBtn.addEventListener("click", () => this.toggleCraft(false));

    this.refs.btnResume.addEventListener("click", () => this.setPauseReason(null));
    this.refs.btnExitToLevels.addEventListener("click", () => {
      this.exitRunToLevels();
    });

    this.refs.volumeInput.addEventListener("input", () => {
      const value = Number(this.refs.volumeInput.value);
      this.save.options.masterVolume = clamp(value, 0, 1);
      this.audio.setVolume(this.save.options.masterVolume);
      this.persistSave();
    });

    this.refs.btnResultLevels.addEventListener("click", () => {
      this.hideResultOverlay();
      this.showScreen("levels");
    });

    this.refs.btnNextMission.addEventListener("click", () => {
      if (this.run?.nextLevelId && this.isLevelUnlocked(this.run.nextLevelId)) {
        const nextLevelId = this.run.nextLevelId;
        this.hideResultOverlay();
        this.startRun(nextLevelId);
        return;
      }

      this.hideResultOverlay();
      this.showScreen("levels");
    });

    const toCanvasPos = event => {
      const rect = this.canvas.getBoundingClientRect();
      const sx = this.canvas.width / rect.width;
      const sy = this.canvas.height / rect.height;
      return {
        x: (event.clientX - rect.left) * sx,
        y: (event.clientY - rect.top) * sy
      };
    };

    this.canvas.addEventListener("mousemove", event => {
      const pos = toCanvasPos(event);
      this.mouse.x = pos.x;
      this.mouse.y = pos.y;
      this.pointerInsideCanvas = true;
    });

    this.canvas.addEventListener("mouseenter", () => {
      this.pointerInsideCanvas = true;
    });

    this.canvas.addEventListener("mouseleave", () => {
      this.pointerInsideCanvas = false;
    });

    this.canvas.addEventListener("mousedown", () => {
      this.mouse.down = true;
      this.audio.ensureContext().then(() => this.audio.startBgm()).catch(() => {});
    });

    window.addEventListener("mouseup", () => {
      this.mouse.down = false;
    });

    window.addEventListener("keydown", event => {
      if (event.repeat) {
        return;
      }

      this.keys.add(event.code);

      if (this.currentScreen !== "game" || !this.run) {
        return;
      }

      if (event.code === "Escape") {
        if (this.run.pauseReason === "upgrade" || this.run.pauseReason === "result") {
          return;
        }

        const next = this.run.pauseReason === "pause" ? null : "pause";
        this.setPauseReason(next);
        event.preventDefault();
        return;
      }

      if (event.code === "KeyI") {
        this.toggleInventory(!(this.run.pauseReason === "inventory"));
        event.preventDefault();
        return;
      }

      if (event.code === "KeyC") {
        this.toggleCraft(!(this.run.pauseReason === "craft"));
        event.preventDefault();
        return;
      }

      if (event.code === "F2") {
        this.grantXp(120);
        this.toast("Debug XP +120");
      }

      if (event.code === "F3") {
        this.grantDebugLoot();
      }
    });

    window.addEventListener("keyup", event => {
      this.keys.delete(event.code);
    });
  }

  showScreen(name) {
    this.currentScreen = name;

    this.refs.screenMainMenu.classList.toggle("screen-active", name === "main");
    this.refs.screenLevelSelect.classList.toggle("screen-active", name === "levels");
    this.refs.screenGame.classList.toggle("screen-active", name === "game");

    if (name !== "game") {
      this.refs.inventoryPanel.classList.add("hidden");
      this.refs.craftPanel.classList.add("hidden");
      this.refs.pauseOverlay.classList.add("hidden");
      this.refs.upgradeOverlay.classList.add("hidden");
    }
  }

  getUnlockedLevels() {
    return LEVEL_DEFS.filter(level => this.isLevelUnlocked(level.id));
  }

  isLevelUnlocked(levelId) {
    return this.save.unlockedLevelIds.includes(levelId);
  }

  syncAttachmentAssignments() {
    const bag = this.save.inventory.attachments || [];

    for (let index = 0; index < bag.length; index += 1) {
      if (typeof bag[index] !== "object" || !bag[index]) {
        continue;
      }

      bag[index].equippedTo = null;
    }

    const seen = new Set();

    for (let weaponIndex = 0; weaponIndex < this.save.inventory.weapons.length; weaponIndex += 1) {
      const weapon = this.save.inventory.weapons[weaponIndex];

      if (!weapon.attachments || typeof weapon.attachments !== "object") {
        weapon.attachments = {};
      }

      const entries = Object.entries(weapon.attachments);

      for (let entryIndex = 0; entryIndex < entries.length; entryIndex += 1) {
        const [slot, itemId] = entries[entryIndex];

        if (!itemId || seen.has(itemId)) {
          delete weapon.attachments[slot];
          continue;
        }

        const item = bag.find(candidate => candidate.itemId === itemId);

        if (!item) {
          delete weapon.attachments[slot];
          continue;
        }

        item.equippedTo = weapon.instanceId;
        seen.add(itemId);
      }
    }
  }

  renderLevelCards() {
    this.refs.levelCards.innerHTML = "";

    for (let index = 0; index < LEVEL_DEFS.length; index += 1) {
      const level = LEVEL_DEFS[index];
      const unlocked = this.isLevelUnlocked(level.id);

      const card = document.createElement("article");
      card.className = `level-card${unlocked ? "" : " locked"}`;

      const title = document.createElement("h3");
      title.textContent = `${index + 1}. ${level.name}`;
      card.appendChild(title);

      const description = document.createElement("p");
      description.textContent = level.description;
      card.appendChild(description);

      const details = document.createElement("p");
      details.textContent = `Difficulty ${level.difficulty} | Target ${level.killTarget} | ${level.durationSec}s`;
      card.appendChild(details);

      const startButton = document.createElement("button");
      startButton.type = "button";
      startButton.textContent = unlocked ? "Start Mission" : "Locked";
      startButton.disabled = !unlocked;

      if (!unlocked) {
        startButton.classList.add("secondary");
      }

      startButton.addEventListener("click", () => {
        this.startRun(level.id);
      });

      card.appendChild(startButton);
      this.refs.levelCards.appendChild(card);
    }
  }

  refreshMetaUi() {
    const highestUnlocked = this.getUnlockedLevels().at(-1);
    this.refs.metaSummary.textContent =
      `Runs ${this.save.stats.runsCompleted} | Total kills ${this.save.stats.totalKills} | Highest mission ${highestUnlocked?.name || "None"}`;

    const material = this.save.inventory.materials;
    this.refs.resourceSummary.innerHTML = `
      <li>Credits: ${this.save.credits}</li>
      <li>Scrap: ${material.scrap}</li>
      <li>Alloy: ${material.alloy}</li>
      <li>Core: ${material.core}</li>
      <li>Quantum: ${material.quantum}</li>
    `;
  }

  persistSave() {
    this.save = saveGameData(this.save);
  }

  startRun(levelId) {
    const level = LEVEL_BY_ID[levelId] || LEVEL_DEFS[0];
    this.audio.ensureContext().then(() => this.audio.startBgm()).catch(() => {});
    this.syncAttachmentAssignments();

    this.resetPools();

    const world = {
      width: level.mapSize.width,
      height: level.mapSize.height
    };

    const startX = world.width / 2;
    const startY = world.height / 2;

    const player = {
      x: startX,
      y: startY,
      vx: 0,
      vy: 0,
      angle: 0,
      hp: DEFAULT_PLAYER_BASE_STATS.maxHp,
      maxHp: DEFAULT_PLAYER_BASE_STATS.maxHp,
      iFrameMs: 0,
      xp: 0,
      xpToNext: this.getXpRequired(1),
      level: 1,
      moveSpeed: DEFAULT_PLAYER_BASE_STATS.moveSpeed,
      pickupRange: DEFAULT_PLAYER_BASE_STATS.pickupRange,
      critChance: DEFAULT_PLAYER_BASE_STATS.critChance,
      critDamage: DEFAULT_PLAYER_BASE_STATS.critDamage,
      killCount: 0,
      killHealCounter: 0,
      modifiers: baseModifierTotals(),
      upgradeIds: []
    };

    const weaponStats = this.computeFinalWeaponStats();

    const runtimeWaves = level.waves.map(wave => ({
      ...wave,
      spawned: 0,
      nextAtMs: wave.startAtMs
    }));

    this.run = {
      level,
      world,
      camera: {
        x: clamp(startX - this.canvas.width / 2, 0, world.width - this.canvas.width),
        y: clamp(startY - this.canvas.height / 2, 0, world.height - this.canvas.height),
        shakePower: 0,
        shakeX: 0,
        shakeY: 0
      },
      player,
      weaponStats,
      weaponState: {
        cooldownMs: 0,
        reloadMs: 0,
        ammo: weaponStats.magazineSize
      },
      elapsedMs: 0,
      kills: 0,
      pauseReason: null,
      waves: runtimeWaves,
      queuedLevelUps: 0,
      pendingUpgradeChoices: [],
      runCreditsEarned: 0,
      runMaterialsEarned: {
        scrap: 0,
        alloy: 0,
        core: 0,
        quantum: 0
      },
      flashMs: 0,
      resultShown: false,
      nextLevelId: null,
      starSeed: this.makeStars(world.width, world.height)
    };

    this.recomputePlayerDerivedStats();
    this.updateHud();
    this.renderInventory();
    this.renderCrafting();
    this.hideResultOverlay();
    this.setPauseReason(null);
    this.refs.upgradeOverlay.classList.add("hidden");
    this.showScreen("game");
  }

  makeStars(width, height) {
    const stars = [];

    for (let index = 0; index < 220; index += 1) {
      stars.push({
        x: Math.random() * width,
        y: Math.random() * height,
        size: randomRange(0.8, 2.2),
        alpha: randomRange(0.12, 0.45)
      });
    }

    return stars;
  }

  resetPools() {
    resetPool(this.pools.bullets, item => {
      item.active = false;
    });

    resetPool(this.pools.enemyBullets, item => {
      item.active = false;
    });

    resetPool(this.pools.enemies, item => {
      item.active = false;
    });

    resetPool(this.pools.pickups, item => {
      item.active = false;
    });

    resetPool(this.pools.floatTexts, item => {
      item.active = false;
    });
  }

  loop(timestamp) {
    const deltaMs = clamp(timestamp - this.lastTimestamp, 0, 50);
    const deltaSec = deltaMs / 1000;

    if (this.currentScreen === "game" && this.run) {
      this.update(deltaSec, deltaMs);
      this.render();
    }

    this.lastTimestamp = timestamp;
    this.animationFrame = window.requestAnimationFrame(next => this.loop(next));
  }

  update(deltaSec, deltaMs) {
    if (!this.run) {
      return;
    }

    if (this.hitStopMs > 0) {
      this.hitStopMs -= deltaMs;
      this.updateFloatTexts(deltaSec);
      this.updateFlash(deltaMs);
      this.updateCamera(deltaSec);
      this.updateHud();
      return;
    }

    if (this.run.pauseReason) {
      this.updateFlash(deltaMs);
      this.updateHud();
      return;
    }

    this.run.elapsedMs += deltaMs;

    this.updateWaveScheduler();
    this.updatePlayer(deltaSec, deltaMs);
    this.updateWeapon(deltaSec, deltaMs);
    this.updateBullets(deltaSec, this.pools.bullets, true);
    this.updateBullets(deltaSec, this.pools.enemyBullets, false);
    this.updateEnemies(deltaSec, deltaMs);
    this.updatePickups(deltaSec);
    this.updateFloatTexts(deltaSec);
    this.updateFlash(deltaMs);
    this.updateCamera(deltaSec);

    this.checkLevelUpState();
    this.checkMissionState();

    this.updateHud();
  }

  updatePlayer(deltaSec, deltaMs) {
    const player = this.run.player;
    const input = { x: 0, y: 0 };

    if (this.keys.has("KeyW") || this.keys.has("ArrowUp")) {
      input.y -= 1;
    }

    if (this.keys.has("KeyS") || this.keys.has("ArrowDown")) {
      input.y += 1;
    }

    if (this.keys.has("KeyA") || this.keys.has("ArrowLeft")) {
      input.x -= 1;
    }

    if (this.keys.has("KeyD") || this.keys.has("ArrowRight")) {
      input.x += 1;
    }

    let inputLen = Math.hypot(input.x, input.y);

    if (inputLen > 0.001) {
      input.x /= inputLen;
      input.y /= inputLen;
    }

    const targetVx = input.x * player.moveSpeed;
    const targetVy = input.y * player.moveSpeed;

    const smoothing = 1 - Math.exp(-deltaSec * 10);
    player.vx = lerp(player.vx, targetVx, smoothing);
    player.vy = lerp(player.vy, targetVy, smoothing);

    player.x = clamp(player.x + player.vx * deltaSec, 24, this.run.world.width - 24);
    player.y = clamp(player.y + player.vy * deltaSec, 24, this.run.world.height - 24);

    const mouseWorldX = this.run.camera.x + this.mouse.x;
    const mouseWorldY = this.run.camera.y + this.mouse.y;
    const targetAngle = Math.atan2(mouseWorldY - player.y, mouseWorldX - player.x);
    player.angle = smoothAngle(player.angle, targetAngle, deltaSec * 9.5);

    if (player.iFrameMs > 0) {
      player.iFrameMs = Math.max(0, player.iFrameMs - deltaMs);
    }
  }

  updateWeapon(_deltaSec, deltaMs) {
    const run = this.run;

    if (run.weaponState.cooldownMs > 0) {
      run.weaponState.cooldownMs -= deltaMs;
    }

    if (run.weaponState.reloadMs > 0) {
      run.weaponState.reloadMs -= deltaMs;

      if (run.weaponState.reloadMs <= 0) {
        run.weaponState.reloadMs = 0;
        run.weaponState.ammo = run.weaponStats.magazineSize;
      }

      return;
    }

    if (run.weaponState.ammo <= 0) {
      run.weaponState.reloadMs = run.weaponStats.reloadTimeMs;
      return;
    }

    if (!this.mouse.down) {
      return;
    }

    if (run.weaponState.cooldownMs > 0) {
      return;
    }

    this.firePlayerWeapon();
  }

  firePlayerWeapon() {
    const run = this.run;
    const player = run.player;
    const stats = run.weaponStats;

    const pellets = Math.max(1, stats.pellets || 1);

    for (let pellet = 0; pellet < pellets; pellet += 1) {
      const bullet = acquireFromPool(this.pools.bullets);

      if (!bullet) {
        break;
      }

      const spread = (randomRange(-stats.spreadDeg * 0.5, stats.spreadDeg * 0.5) * Math.PI) / 180;
      const angle = player.angle + spread;

      bullet.active = true;
      bullet.x = player.x + Math.cos(angle) * 24;
      bullet.y = player.y + Math.sin(angle) * 24;
      bullet.vx = Math.cos(angle) * stats.projectileSpeed;
      bullet.vy = Math.sin(angle) * stats.projectileSpeed;
      bullet.radius = 4;
      bullet.damage = stats.damage;
      bullet.critChance = player.critChance;
      bullet.critDamage = player.critDamage;
      bullet.lifeMs = (stats.rangePx / stats.projectileSpeed) * 1000;
      bullet.color = "#70efff";
    }

    run.weaponState.ammo -= 1;
    run.weaponState.cooldownMs = 1000 / stats.fireRate;

    this.audio.playShoot();
  }

  spawnEnemyProjectile(x, y, angle, speed, damage) {
    const bullet = acquireFromPool(this.pools.enemyBullets);

    if (!bullet) {
      return;
    }

    bullet.active = true;
    bullet.x = x;
    bullet.y = y;
    bullet.vx = Math.cos(angle) * speed;
    bullet.vy = Math.sin(angle) * speed;
    bullet.radius = 5;
    bullet.damage = damage;
    bullet.lifeMs = 3000;
    bullet.color = "#ff9752";
  }

  updateBullets(deltaSec, pool, friendly) {
    for (let index = 0; index < pool.length; index += 1) {
      const bullet = pool[index];

      if (!bullet.active) {
        continue;
      }

      bullet.x += bullet.vx * deltaSec;
      bullet.y += bullet.vy * deltaSec;
      bullet.lifeMs -= deltaSec * 1000;

      if (
        bullet.lifeMs <= 0 ||
        bullet.x < -120 ||
        bullet.y < -120 ||
        bullet.x > this.run.world.width + 120 ||
        bullet.y > this.run.world.height + 120
      ) {
        bullet.active = false;
        continue;
      }

      if (friendly) {
        this.collidePlayerBullet(bullet);
      } else {
        this.collideEnemyBullet(bullet);
      }
    }
  }

  collidePlayerBullet(bullet) {
    for (let index = 0; index < this.pools.enemies.length; index += 1) {
      const enemy = this.pools.enemies[index];

      if (!enemy.active) {
        continue;
      }

      const dx = enemy.x - bullet.x;
      const dy = enemy.y - bullet.y;

      if (Math.abs(dx) > 44 || Math.abs(dy) > 44) {
        continue;
      }

      const radius = enemy.radius + bullet.radius;

      if (dx * dx + dy * dy > radius * radius) {
        continue;
      }

      bullet.active = false;
      this.applyDamageToEnemy(enemy, bullet.damage, bullet.critChance, bullet.critDamage);
      return;
    }
  }

  collideEnemyBullet(bullet) {
    const player = this.run.player;

    if (player.iFrameMs > 0) {
      return;
    }

    const dx = player.x - bullet.x;
    const dy = player.y - bullet.y;
    const radius = 17 + bullet.radius;

    if (dx * dx + dy * dy > radius * radius) {
      return;
    }

    bullet.active = false;
    this.damagePlayer(bullet.damage, "Spitter shot");
  }

  updateEnemies(deltaSec, deltaMs) {
    const player = this.run.player;

    for (let index = 0; index < this.pools.enemies.length; index += 1) {
      const enemy = this.pools.enemies[index];

      if (!enemy.active) {
        continue;
      }

      const def = enemy.def;
      const toPlayerX = player.x - enemy.x;
      const toPlayerY = player.y - enemy.y;
      const distance = Math.hypot(toPlayerX, toPlayerY) || 0.001;
      const dirX = toPlayerX / distance;
      const dirY = toPlayerY / distance;

      let moveX = dirX;
      let moveY = dirY;
      let speedMul = 1;

      if (def.behavior === "ranged") {
        if (distance < 220) {
          moveX = -dirX;
          moveY = -dirY;
        } else if (distance < 330) {
          moveX = 0;
          moveY = 0;
        }

        enemy.attackCooldownMs -= deltaMs;

        if (enemy.attackCooldownMs <= 0 && distance < 620) {
          enemy.attackCooldownMs = def.rangedCooldownMs;
          this.spawnEnemyProjectile(enemy.x, enemy.y, Math.atan2(toPlayerY, toPlayerX), 390, def.rangedDamage);
        }
      }

      if (def.behavior === "charger") {
        enemy.chargeCooldownMs -= deltaMs;

        if (enemy.dashMs > 0) {
          enemy.dashMs -= deltaMs;
          moveX = enemy.dashDirX;
          moveY = enemy.dashDirY;
          speedMul = 2.8;
        } else if (enemy.chargeCooldownMs <= 0 && distance < 560) {
          enemy.chargeCooldownMs = def.chargeCooldownMs;
          enemy.dashMs = 420;
          enemy.dashDirX = dirX;
          enemy.dashDirY = dirY;
        }
      }

      if (def.behavior === "swarm") {
        speedMul = 1.15;
      }

      enemy.vx = moveX * def.speed * speedMul;
      enemy.vy = moveY * def.speed * speedMul;

      enemy.x += enemy.vx * deltaSec;
      enemy.y += enemy.vy * deltaSec;

      enemy.x = clamp(enemy.x, 18, this.run.world.width - 18);
      enemy.y = clamp(enemy.y, 18, this.run.world.height - 18);

      if (enemy.hitFlashMs > 0) {
        enemy.hitFlashMs = Math.max(0, enemy.hitFlashMs - deltaMs);
      }

      const hitRadius = enemy.radius + 14;

      if (player.iFrameMs <= 0 && distSq(enemy.x, enemy.y, player.x, player.y) <= hitRadius * hitRadius) {
        this.damagePlayer(def.contactDamage, def.name);
      }
    }
  }

  damagePlayer(amount, sourceName) {
    const run = this.run;
    const player = run.player;

    player.hp = Math.max(0, player.hp - amount);
    player.iFrameMs = 700;
    run.flashMs = 140;
    run.camera.shakePower = Math.min(18, run.camera.shakePower + 6);

    this.audio.playHit();
    this.spawnFloatText(player.x, player.y - 22, `-${Math.round(amount)} HP (${sourceName})`, "#ff9cae");

    if (player.hp <= 0) {
      this.endRun(false);
    }
  }

  applyDamageToEnemy(enemy, baseDamage, critChance, critDamageMul) {
    const isCrit = Math.random() < critChance;
    const amount = isCrit ? baseDamage * critDamageMul : baseDamage;
    const rounded = Math.max(1, Math.round(amount));

    enemy.hp -= rounded;
    enemy.hitFlashMs = 80;

    this.spawnFloatText(enemy.x, enemy.y - 16, isCrit ? `CRIT ${rounded}` : `${rounded}`, isCrit ? "#ffd569" : "#9ce6ff");
    this.run.camera.shakePower = Math.min(10, this.run.camera.shakePower + (isCrit ? 2 : 1));
    this.hitStopMs = Math.max(this.hitStopMs, isCrit ? 22 : 14);
    this.audio.playHit();

    if (enemy.hp <= 0) {
      this.killEnemy(enemy);
    }
  }

  killEnemy(enemy) {
    enemy.active = false;
    this.run.kills += 1;
    this.run.player.killCount += 1;
    this.save.stats.totalKills += 1;

    this.spawnDropFromEnemy(enemy);
    this.audio.playKill();

    const lifeStealUpgrade = this.run.player.upgradeIds
      .map(id => UPGRADE_BY_ID[id])
      .find(upgrade => upgrade?.onKillHealEvery);

    if (lifeStealUpgrade) {
      this.run.player.killHealCounter += 1;

      if (this.run.player.killHealCounter >= lifeStealUpgrade.onKillHealEvery) {
        this.run.player.killHealCounter = 0;
        this.run.player.hp = clamp(
          this.run.player.hp + lifeStealUpgrade.onKillHealAmount,
          0,
          this.run.player.maxHp
        );
      }
    }
  }

  spawnDropFromEnemy(enemy) {
    const table = DROP_TABLES[enemy.def.dropTableId] || DROP_TABLES.basic;

    for (let index = 0; index < table.length; index += 1) {
      const entry = table[index];

      if (entry.type === "xp") {
        const amount = randomInt(entry.min, entry.max);

        for (let orb = 0; orb < amount; orb += 1) {
          this.spawnPickup("xp", enemy.x + randomRange(-8, 8), enemy.y + randomRange(-8, 8), {
            xp: enemy.def.expReward
          });
        }

        continue;
      }

      if (Math.random() * 100 > entry.weight) {
        continue;
      }

      if (entry.type === "credits") {
        const amount = randomInt(entry.min, entry.max);
        this.spawnPickup("credits", enemy.x, enemy.y, { amount });
      } else if (entry.type === "material") {
        const qty = randomInt(entry.min, entry.max);
        this.spawnPickup("material", enemy.x, enemy.y, { materialId: entry.materialId, qty });
      } else if (entry.type === "weapon") {
        const weaponId = entry.weaponPool[randomInt(0, entry.weaponPool.length - 1)];
        const rarity = this.rollWeaponRarity(weaponId);

        this.spawnPickup("weapon", enemy.x, enemy.y, {
          weaponId,
          rarity,
          level: 1
        });
      } else if (entry.type === "attachment") {
        const attachmentId = entry.attachmentPool[randomInt(0, entry.attachmentPool.length - 1)];
        this.spawnPickup("attachment", enemy.x, enemy.y, {
          attachmentId
        });
      }
    }
  }

  rollWeaponRarity(weaponId) {
    const base = WEAPON_BY_ID[weaponId]?.rarity || "common";
    const roll = Math.random();
    const levelDifficulty = this.run.level.difficulty;

    const rarityBoost = levelDifficulty * 0.03;

    if (roll < 0.04 + rarityBoost && rarityIndex(base) < rarityIndex("legendary")) {
      return RARITY_ORDER[clamp(rarityIndex(base) + 2, 0, RARITY_ORDER.length - 1)];
    }

    if (roll < 0.18 + rarityBoost) {
      return RARITY_ORDER[clamp(rarityIndex(base) + 1, 0, RARITY_ORDER.length - 1)];
    }

    return base;
  }

  spawnPickup(type, x, y, payload) {
    const pickup = acquireFromPool(this.pools.pickups);

    if (!pickup) {
      return;
    }

    pickup.active = true;
    pickup.type = type;
    pickup.x = x;
    pickup.y = y;
    pickup.vx = randomRange(-40, 40);
    pickup.vy = randomRange(-40, 40);
    pickup.radius = type === "xp" ? 6 : 9;
    pickup.lifeMs = 24000;
    pickup.payload = payload;
  }

  updatePickups(deltaSec) {
    const player = this.run.player;

    for (let index = 0; index < this.pools.pickups.length; index += 1) {
      const pickup = this.pools.pickups[index];

      if (!pickup.active) {
        continue;
      }

      pickup.lifeMs -= deltaSec * 1000;

      if (pickup.lifeMs <= 0) {
        pickup.active = false;
        continue;
      }

      pickup.x += pickup.vx * deltaSec;
      pickup.y += pickup.vy * deltaSec;
      pickup.vx *= 0.92;
      pickup.vy *= 0.92;

      const dx = player.x - pickup.x;
      const dy = player.y - pickup.y;
      const dist = Math.hypot(dx, dy) || 0.001;

      if (dist < player.pickupRange) {
        const pull = (1 - dist / player.pickupRange) * 360;
        pickup.x += (dx / dist) * pull * deltaSec;
        pickup.y += (dy / dist) * pull * deltaSec;
      }

      if (dist <= pickup.radius + 15) {
        this.collectPickup(pickup);
      }
    }
  }

  collectPickup(pickup) {
    const payload = pickup.payload;
    pickup.active = false;

    if (pickup.type === "xp") {
      this.grantXp(payload.xp);
      this.audio.playPickup();
      return;
    }

    if (pickup.type === "credits") {
      this.save.credits += payload.amount;
      this.run.runCreditsEarned += payload.amount;
      this.toast(`+${payload.amount} Credits`);
    } else if (pickup.type === "material") {
      this.addMaterial(payload.materialId, payload.qty);
      this.run.runMaterialsEarned[payload.materialId] += payload.qty;
      this.toast(`+${payload.qty} ${MATERIAL_LABELS[payload.materialId]}`);
    } else if (pickup.type === "weapon") {
      this.addWeaponInstance(payload.weaponId, payload.level, payload.rarity);
      const def = WEAPON_BY_ID[payload.weaponId];
      this.toast(`Weapon found: ${def.name} (${payload.rarity})`);
    } else if (pickup.type === "attachment") {
      this.addAttachmentItem(payload.attachmentId);
      const def = ATTACHMENT_BY_ID[payload.attachmentId];
      this.toast(`Attachment found: ${def.name}`);
    }

    this.audio.playPickup();
    this.persistSave();
    this.renderInventory();
    this.renderCrafting();
    this.recomputePlayerDerivedStats();
  }

  addMaterial(materialId, qty) {
    this.save.inventory.materials[materialId] = (this.save.inventory.materials[materialId] || 0) + qty;
  }

  addWeaponInstance(weaponId, level = 1, rarity = WEAPON_BY_ID[weaponId].rarity) {
    this.save.inventory.weapons.push({
      instanceId: makeId("weapon"),
      weaponId,
      level,
      rarity,
      attachments: {}
    });
  }

  addAttachmentItem(attachmentId) {
    this.save.inventory.attachments.push({
      itemId: makeId("att"),
      attachmentId,
      equippedTo: null
    });
  }

  grantXp(amount) {
    const player = this.run.player;
    player.xp += amount;

    while (player.xp >= player.xpToNext) {
      player.xp -= player.xpToNext;
      player.level += 1;
      player.xpToNext = this.getXpRequired(player.level);
      this.run.queuedLevelUps += 1;
      this.save.stats.highestLevel = Math.max(this.save.stats.highestLevel, player.level);
    }
  }

  getXpRequired(level) {
    return Math.floor(48 + Math.pow(level - 1, 1.35) * 29);
  }

  checkLevelUpState() {
    if (this.run.pauseReason || this.run.queuedLevelUps <= 0) {
      return;
    }

    this.run.queuedLevelUps -= 1;
    this.showUpgradeChoices();
  }

  showUpgradeChoices() {
    const choices = choiceWeighted(UPGRADE_DEFS, 3);
    this.run.pendingUpgradeChoices = choices;
    this.refs.upgradeCards.innerHTML = "";

    for (let index = 0; index < choices.length; index += 1) {
      const upgrade = choices[index];
      const card = document.createElement("article");
      card.className = "upgrade-card";

      const title = document.createElement("h3");
      title.textContent = upgrade.name;
      card.appendChild(title);

      const text = document.createElement("p");
      text.textContent = upgrade.description;
      card.appendChild(text);

      const button = document.createElement("button");
      button.type = "button";
      button.textContent = "Select";
      button.addEventListener("click", () => {
        this.applyUpgrade(upgrade);
      });
      card.appendChild(button);

      this.refs.upgradeCards.appendChild(card);
    }

    this.setPauseReason("upgrade");
    this.refs.upgradeOverlay.classList.remove("hidden");
    this.audio.playLevelUp();
  }

  applyUpgrade(upgrade) {
    this.run.player.upgradeIds.push(upgrade.id);

    if (upgrade.healFlat) {
      this.run.player.hp = clamp(this.run.player.hp + upgrade.healFlat, 0, this.run.player.maxHp + 999);
    }

    this.refs.upgradeOverlay.classList.add("hidden");
    this.setPauseReason(null);
    this.recomputePlayerDerivedStats();
    this.toast(`Upgrade: ${upgrade.name}`);
  }

  updateWaveScheduler() {
    const elapsed = this.run.elapsedMs;

    for (let index = 0; index < this.run.waves.length; index += 1) {
      const wave = this.run.waves[index];

      while (wave.spawned < wave.count && elapsed >= wave.nextAtMs) {
        this.spawnEnemy(wave.enemyId, wave.spawnPattern);
        wave.spawned += 1;
        wave.nextAtMs += wave.intervalMs;
      }
    }
  }

  spawnEnemy(enemyId, pattern = "edgeRandom") {
    const def = ENEMY_BY_ID[enemyId] || ENEMY_DEFS[0];
    const enemy = acquireFromPool(this.pools.enemies);

    if (!enemy) {
      return;
    }

    let spawn = this.randomEdgeSpawnPoint();

    if (pattern === "aroundPlayer") {
      const angle = randomRange(0, TWO_PI);
      const distance = randomRange(420, 740);
      spawn = {
        x: clamp(this.run.player.x + Math.cos(angle) * distance, 24, this.run.world.width - 24),
        y: clamp(this.run.player.y + Math.sin(angle) * distance, 24, this.run.world.height - 24)
      };
    }

    enemy.active = true;
    enemy.id = makeId("enemy");
    enemy.def = def;
    enemy.x = spawn.x;
    enemy.y = spawn.y;
    enemy.vx = 0;
    enemy.vy = 0;
    enemy.maxHp = def.hp * (1 + this.run.level.difficulty * 0.08);
    enemy.hp = enemy.maxHp;
    enemy.radius = def.behavior === "crusher" ? 21 : def.behavior === "swarmling" ? 12 : 16;
    enemy.attackCooldownMs = def.rangedCooldownMs || 0;
    enemy.chargeCooldownMs = def.chargeCooldownMs || 0;
    enemy.dashMs = 0;
    enemy.dashDirX = 0;
    enemy.dashDirY = 0;
    enemy.hitFlashMs = 0;
  }

  randomEdgeSpawnPoint() {
    const side = randomInt(0, 3);
    const margin = 20;

    if (side === 0) {
      return { x: margin, y: randomRange(margin, this.run.world.height - margin) };
    }

    if (side === 1) {
      return { x: this.run.world.width - margin, y: randomRange(margin, this.run.world.height - margin) };
    }

    if (side === 2) {
      return { x: randomRange(margin, this.run.world.width - margin), y: margin };
    }

    return {
      x: randomRange(margin, this.run.world.width - margin),
      y: this.run.world.height - margin
    };
  }

  checkMissionState() {
    if (this.run.resultShown) {
      return;
    }

    const elapsedSec = this.run.elapsedMs / 1000;
    const level = this.run.level;

    const winsByKills = this.run.kills >= level.killTarget;
    const winsByTime = elapsedSec >= level.durationSec;

    if (winsByKills || winsByTime) {
      this.endRun(true);
    }
  }

  endRun(victory) {
    if (!this.run || this.run.resultShown) {
      return;
    }

    this.run.resultShown = true;
    this.run.pauseReason = "result";

    if (victory) {
      this.save.stats.runsCompleted += 1;
      this.save.credits += this.run.level.reward.credits;
      this.run.runCreditsEarned += this.run.level.reward.credits;

      const unlocks = this.run.level.reward.unlocks || [];

      for (let index = 0; index < unlocks.length; index += 1) {
        const levelId = unlocks[index];

        if (!this.save.unlockedLevelIds.includes(levelId)) {
          this.save.unlockedLevelIds.push(levelId);
        }
      }

      const levelIndex = LEVEL_DEFS.findIndex(level => level.id === this.run.level.id);
      const nextLevel = LEVEL_DEFS[levelIndex + 1];

      if (nextLevel) {
        this.run.nextLevelId = nextLevel.id;
      }

      this.refs.resultTitle.textContent = "Mission Complete";
      this.refs.resultSummary.textContent =
        `Kills ${this.run.kills} | Credits +${this.run.runCreditsEarned} | Materials +${Object.values(
          this.run.runMaterialsEarned
        ).reduce((acc, value) => acc + value, 0)}`;
    } else {
      this.refs.resultTitle.textContent = "Mission Failed";
      this.refs.resultSummary.textContent = `You were overrun. Kills ${this.run.kills}. Improve loadout and try again.`;
      this.run.nextLevelId = null;
    }

    this.persistSave();
    this.refreshMetaUi();
    this.renderLevelCards();

    this.refs.resultOverlay.classList.remove("hidden");
  }

  hideResultOverlay() {
    this.refs.resultOverlay.classList.add("hidden");
  }

  exitRunToLevels() {
    if (!this.run) {
      return;
    }

    this.setPauseReason(null);
    this.refs.upgradeOverlay.classList.add("hidden");
    this.refs.resultOverlay.classList.add("hidden");
    this.showScreen("levels");
    this.run = null;
  }

  setPauseReason(reason) {
    if (!this.run) {
      return;
    }

    this.run.pauseReason = reason;

    this.refs.pauseOverlay.classList.toggle("hidden", reason !== "pause");
    this.refs.inventoryPanel.classList.toggle("hidden", reason !== "inventory");
    this.refs.craftPanel.classList.toggle("hidden", reason !== "craft");
  }

  toggleInventory(forceOpen) {
    if (!this.run || this.run.pauseReason === "upgrade" || this.run.pauseReason === "result") {
      return;
    }

    if (forceOpen) {
      this.renderInventory();
      this.setPauseReason("inventory");
      return;
    }

    this.setPauseReason(null);
  }

  toggleCraft(forceOpen) {
    if (!this.run || this.run.pauseReason === "upgrade" || this.run.pauseReason === "result") {
      return;
    }

    if (forceOpen) {
      this.renderCrafting();
      this.setPauseReason("craft");
      return;
    }

    this.setPauseReason(null);
  }

  getEquippedWeapon() {
    if (!Array.isArray(this.save.inventory.weapons) || this.save.inventory.weapons.length === 0) {
      this.addWeaponInstance(WEAPON_DEFS[0].id, WEAPON_DEFS[0].baseLevel, WEAPON_DEFS[0].rarity);
      this.save.inventory.equippedWeaponId = this.save.inventory.weapons[0].instanceId;
    }

    const id = this.save.inventory.equippedWeaponId;
    const found = this.save.inventory.weapons.find(weapon => weapon.instanceId === id) || this.save.inventory.weapons[0];

    if (!this.save.inventory.equippedWeaponId || this.save.inventory.equippedWeaponId !== found.instanceId) {
      this.save.inventory.equippedWeaponId = found.instanceId;
    }

    return found;
  }

  recomputePlayerDerivedStats() {
    if (!this.run) {
      return;
    }

    const modifiers = this.collectModifiersFromLoadout();
    this.run.player.modifiers = modifiers;

    const previousMax = this.run.player.maxHp;

    this.run.player.maxHp = Math.round(DEFAULT_PLAYER_BASE_STATS.maxHp + modifiers.maxHpAdd);
    this.run.player.moveSpeed = DEFAULT_PLAYER_BASE_STATS.moveSpeed * (1 + modifiers.moveSpeedMul);
    this.run.player.pickupRange = DEFAULT_PLAYER_BASE_STATS.pickupRange * (1 + modifiers.pickupRangeMul);
    this.run.player.critChance = DEFAULT_PLAYER_BASE_STATS.critChance + modifiers.critChanceAdd;
    this.run.player.critDamage = DEFAULT_PLAYER_BASE_STATS.critDamage * (1 + modifiers.critDamageMul);

    if (this.run.player.maxHp > previousMax) {
      this.run.player.hp += this.run.player.maxHp - previousMax;
    }

    this.run.player.hp = clamp(this.run.player.hp, 0, this.run.player.maxHp);

    this.run.weaponStats = this.computeFinalWeaponStats();
    this.run.weaponState.ammo = clamp(this.run.weaponState.ammo, 0, this.run.weaponStats.magazineSize);
  }

  collectModifiersFromLoadout() {
    const totals = baseModifierTotals();

    const equipped = this.getEquippedWeapon();

    if (equipped?.attachments) {
      const attachmentItemIds = Object.values(equipped.attachments);

      for (let index = 0; index < attachmentItemIds.length; index += 1) {
        const itemId = attachmentItemIds[index];

        if (!itemId) {
          continue;
        }

        const item = this.findAttachmentItemById(itemId);

        if (!item) {
          continue;
        }

        const def = ATTACHMENT_BY_ID[item.attachmentId];

        if (!def) {
          continue;
        }

        for (let mod = 0; mod < def.modifiers.length; mod += 1) {
          const modifier = def.modifiers[mod];
          totals[modifier.stat] = (totals[modifier.stat] || 0) + modifier.value;
        }
      }
    }

    for (let index = 0; index < this.run.player.upgradeIds.length; index += 1) {
      const upgrade = UPGRADE_BY_ID[this.run.player.upgradeIds[index]];

      if (!upgrade) {
        continue;
      }

      for (let mod = 0; mod < upgrade.modifiers.length; mod += 1) {
        const modifier = upgrade.modifiers[mod];
        totals[modifier.stat] = (totals[modifier.stat] || 0) + modifier.value;
      }
    }

    return totals;
  }

  computeFinalWeaponStats() {
    const equipped = this.getEquippedWeapon();
    const def = WEAPON_BY_ID[equipped.weaponId] || WEAPON_DEFS[0];
    const levelMultiplier = 1 + (equipped.level - 1) * 0.12;
    const rarityMultiplier = RARITY_MULTIPLIER[equipped.rarity] || 1;

    const modifiers = this.run ? this.collectModifiersFromLoadout() : baseModifierTotals();

    const damage = def.damage * levelMultiplier * rarityMultiplier * (1 + modifiers.damageMul);
    const fireRate = def.fireRate * (1 + modifiers.fireRateMul);
    const spreadDeg = Math.max(0, def.spreadDeg + modifiers.spreadDegAdd);
    const reloadTimeMs = Math.max(280, def.reloadTimeMs * (1 + modifiers.reloadTimeMul));
    const magazineSize = Math.max(1, Math.round(def.magazineSize + modifiers.magazineSizeAdd));
    const projectileSpeed = def.projectileSpeed * (1 + modifiers.projectileSpeedMul);

    return {
      ...def,
      damage,
      fireRate,
      spreadDeg,
      reloadTimeMs,
      magazineSize,
      projectileSpeed,
      pellets: def.pellets || 1
    };
  }

  findAttachmentItemById(itemId) {
    return this.save.inventory.attachments.find(item => item.itemId === itemId) || null;
  }

  removeAttachmentFromWeaponByItemId(itemId) {
    for (let weaponIndex = 0; weaponIndex < this.save.inventory.weapons.length; weaponIndex += 1) {
      const weapon = this.save.inventory.weapons[weaponIndex];
      const entries = Object.entries(weapon.attachments || {});

      for (let entryIndex = 0; entryIndex < entries.length; entryIndex += 1) {
        const [slot, attachedItemId] = entries[entryIndex];

        if (attachedItemId !== itemId) {
          continue;
        }

        delete weapon.attachments[slot];
        return weapon;
      }
    }

    return null;
  }

  detachAttachmentItem(itemId) {
    const item = this.findAttachmentItemById(itemId);

    if (!item) {
      return;
    }

    this.removeAttachmentFromWeaponByItemId(itemId);
    item.equippedTo = null;

    this.persistSave();
    this.recomputePlayerDerivedStats();
    this.renderInventory();
    this.toast("Attachment detached");
  }

  renderInventory() {
    if (!this.run) {
      return;
    }

    this.syncAttachmentAssignments();
    const equipped = this.getEquippedWeapon();

    this.refs.inventoryCredits.textContent = `Credits: ${this.save.credits}`;
    this.refs.materialSummary.textContent = `Materials: Scrap ${this.save.inventory.materials.scrap} | Alloy ${
      this.save.inventory.materials.alloy
    } | Core ${this.save.inventory.materials.core} | Quantum ${this.save.inventory.materials.quantum}`;

    this.refs.weaponList.innerHTML = "";

    for (let index = 0; index < this.save.inventory.weapons.length; index += 1) {
      const weapon = this.save.inventory.weapons[index];
      const def = WEAPON_BY_ID[weapon.weaponId];
      const item = document.createElement("li");

      const name = document.createElement("strong");
      const marker = weapon.instanceId === equipped.instanceId ? " [EQUIPPED]" : "";
      name.textContent = `${def.name} (${weapon.rarity}) Lv.${weapon.level}${marker}`;
      item.appendChild(name);

      const slots = Object.entries(weapon.attachments || {})
        .map(([slot, itemId]) => {
          const att = this.findAttachmentItemById(itemId);

          if (!att) {
            return `${slot}: empty`;
          }

          const defn = ATTACHMENT_BY_ID[att.attachmentId];
          return `${slot}: ${defn.name}`;
        })
        .join(" | ");

      const details = document.createElement("p");
      details.textContent = slots || "No attachments";
      item.appendChild(details);

      const row = document.createElement("div");
      row.className = "menu-actions";

      const equipBtn = document.createElement("button");
      equipBtn.type = "button";
      equipBtn.textContent = weapon.instanceId === equipped.instanceId ? "Equipped" : "Equip";
      equipBtn.disabled = weapon.instanceId === equipped.instanceId;
      equipBtn.addEventListener("click", () => {
        this.save.inventory.equippedWeaponId = weapon.instanceId;
        this.persistSave();
        this.recomputePlayerDerivedStats();
        this.renderInventory();
      });
      row.appendChild(equipBtn);

      if (weapon.instanceId === equipped.instanceId && def.attachmentSlots.length > 0) {
        const detachBtn = document.createElement("button");
        detachBtn.type = "button";
        detachBtn.className = "secondary";
        detachBtn.textContent = "Detach All";
        detachBtn.addEventListener("click", () => {
          const itemIds = Object.values(weapon.attachments || {});

          for (let idx = 0; idx < itemIds.length; idx += 1) {
            const attachment = this.findAttachmentItemById(itemIds[idx]);

            if (attachment) {
              attachment.equippedTo = null;
            }
          }

          weapon.attachments = {};
          this.persistSave();
          this.recomputePlayerDerivedStats();
          this.renderInventory();
          this.renderCrafting();
        });
        row.appendChild(detachBtn);
      }

      item.appendChild(row);
      this.refs.weaponList.appendChild(item);
    }

    this.refs.attachmentList.innerHTML = "";

    for (let index = 0; index < this.save.inventory.attachments.length; index += 1) {
      const itemData = this.save.inventory.attachments[index];
      const def = ATTACHMENT_BY_ID[itemData.attachmentId];

      if (!def) {
        continue;
      }

      const li = document.createElement("li");
      const title = document.createElement("strong");
      const status = itemData.equippedTo
        ? itemData.equippedTo === equipped.instanceId
          ? "equipped"
          : "on another weapon"
        : "backpack";
      title.textContent = `${def.name} [${def.slot}] (${def.rarity}) - ${status}`;
      li.appendChild(title);

      const text = document.createElement("p");
      text.textContent = def.modifiers
        .map(mod => `${mod.stat} ${mod.value > 0 ? "+" : ""}${mod.stat.includes("Mul") ? formatPct(mod.value) : mod.value}`)
        .join(" | ");
      li.appendChild(text);

      const equipBtn = document.createElement("button");
      equipBtn.type = "button";
      equipBtn.textContent = itemData.equippedTo === equipped.instanceId ? "Detach" : "Equip to Current Weapon";
      equipBtn.addEventListener("click", () => {
        if (itemData.equippedTo === equipped.instanceId) {
          this.detachAttachmentItem(itemData.itemId);
          return;
        }

        this.equipAttachmentToCurrent(itemData.itemId);
      });
      li.appendChild(equipBtn);

      this.refs.attachmentList.appendChild(li);
    }
  }

  equipAttachmentToCurrent(itemId) {
    const weapon = this.getEquippedWeapon();
    const weaponDef = WEAPON_BY_ID[weapon.weaponId];
    const index = this.save.inventory.attachments.findIndex(item => item.itemId === itemId);

    if (index < 0) {
      return;
    }

    const attachmentItem = this.save.inventory.attachments[index];
    const attachmentDef = ATTACHMENT_BY_ID[attachmentItem.attachmentId];

    if (!weaponDef.attachmentSlots.includes(attachmentDef.slot)) {
      this.toast(`${weaponDef.name} has no ${attachmentDef.slot} slot`);
      return;
    }

    if (attachmentItem.equippedTo && attachmentItem.equippedTo !== weapon.instanceId) {
      this.removeAttachmentFromWeaponByItemId(attachmentItem.itemId);
      attachmentItem.equippedTo = null;
    }

    const currentSlotItemId = weapon.attachments?.[attachmentDef.slot];

    if (currentSlotItemId) {
      const oldAttachment = this.findAttachmentItemById(currentSlotItemId);

      if (oldAttachment) {
        oldAttachment.equippedTo = null;
      }
    }

    if (!weapon.attachments) {
      weapon.attachments = {};
    }

    weapon.attachments[attachmentDef.slot] = attachmentItem.itemId;
    attachmentItem.equippedTo = weapon.instanceId;

    this.persistSave();
    this.recomputePlayerDerivedStats();
    this.renderInventory();
    this.toast(`Equipped ${attachmentDef.name}`);
  }

  renderCrafting() {
    if (!this.run) {
      return;
    }

    this.refs.craftRecipeList.innerHTML = "";

    for (let index = 0; index < CRAFT_RECIPES.length; index += 1) {
      const recipe = CRAFT_RECIPES[index];
      const li = document.createElement("li");
      li.className = "recipe-item";

      const title = document.createElement("strong");
      title.textContent = recipe.name;
      li.appendChild(title);

      const desc = document.createElement("p");
      desc.textContent = recipe.description;
      li.appendChild(desc);

      const can = this.canCraftRecipe(recipe);
      const status = document.createElement("p");
      status.textContent = can ? "Ready" : "Missing requirements";
      li.appendChild(status);

      const button = document.createElement("button");
      button.type = "button";
      button.textContent = "Craft";
      button.disabled = !can;
      button.addEventListener("click", () => this.craftRecipe(recipe.id));
      li.appendChild(button);

      this.refs.craftRecipeList.appendChild(li);
    }
  }

  canCraftRecipe(recipe) {
    if (recipe.type === "material") {
      return recipe.cost.every(cost => (this.save.inventory.materials[cost.materialId] || 0) >= cost.qty);
    }

    if (recipe.type === "weaponFusion") {
      return Boolean(this.findFusionCandidate(recipe.minRarity, recipe.consumeCount));
    }

    if (recipe.type === "rarityUpgrade") {
      const equipped = this.getEquippedWeapon();

      if (!equipped) {
        return false;
      }

      if (rarityIndex(equipped.rarity) >= rarityIndex("legendary")) {
        return false;
      }

      return recipe.cost.every(cost => (this.save.inventory.materials[cost.materialId] || 0) >= cost.qty);
    }

    return false;
  }

  findFusionCandidate(rarity, count) {
    const map = new Map();

    for (let index = 0; index < this.save.inventory.weapons.length; index += 1) {
      const weapon = this.save.inventory.weapons[index];

      if (weapon.rarity !== rarity) {
        continue;
      }

      const key = `${weapon.weaponId}:${weapon.rarity}:${weapon.level}`;

      if (!map.has(key)) {
        map.set(key, []);
      }

      map.get(key).push(weapon);
    }

    for (const value of map.values()) {
      if (value.length >= count) {
        return value;
      }
    }

    return null;
  }

  craftRecipe(recipeId) {
    const recipe = CRAFT_RECIPES.find(item => item.id === recipeId);

    if (!recipe || !this.canCraftRecipe(recipe)) {
      return;
    }

    if (recipe.type === "material") {
      for (let index = 0; index < recipe.cost.length; index += 1) {
        const cost = recipe.cost[index];
        this.save.inventory.materials[cost.materialId] -= cost.qty;
      }

      for (let index = 0; index < recipe.output.length; index += 1) {
        const output = recipe.output[index];
        this.save.inventory.materials[output.materialId] += output.qty;
      }

      this.toast(`Crafted: ${recipe.name}`);
    } else if (recipe.type === "weaponFusion") {
      const candidate = this.findFusionCandidate(recipe.minRarity, recipe.consumeCount);

      if (!candidate) {
        return;
      }

      const base = candidate[0];

      for (let index = 0; index < recipe.consumeCount; index += 1) {
        const remove = candidate[index];
        const removeIndex = this.save.inventory.weapons.findIndex(weapon => weapon.instanceId === remove.instanceId);

        if (removeIndex >= 0) {
          this.save.inventory.weapons.splice(removeIndex, 1);
        }
      }

      const created = {
        instanceId: makeId("weapon"),
        weaponId: base.weaponId,
        level: base.level + 1,
        rarity: base.rarity,
        attachments: {}
      };

      this.save.inventory.weapons.push(created);
      this.save.inventory.equippedWeaponId = created.instanceId;

      this.toast(`Fusion success: ${WEAPON_BY_ID[created.weaponId].name} Lv.${created.level}`);
    } else if (recipe.type === "rarityUpgrade") {
      const weapon = this.getEquippedWeapon();

      for (let index = 0; index < recipe.cost.length; index += 1) {
        const cost = recipe.cost[index];
        this.save.inventory.materials[cost.materialId] -= cost.qty;
      }

      const nextRarity = RARITY_ORDER[rarityIndex(weapon.rarity) + 1];
      weapon.rarity = nextRarity || weapon.rarity;
      this.toast(`Rarity upgraded: ${WEAPON_BY_ID[weapon.weaponId].name} -> ${weapon.rarity}`);
    }

    this.audio.playCraft();
    this.persistSave();
    this.recomputePlayerDerivedStats();
    this.renderCrafting();
    this.renderInventory();
  }

  updateCamera(deltaSec) {
    const camera = this.run.camera;
    const player = this.run.player;

    const targetX = clamp(player.x - this.canvas.width / 2, 0, this.run.world.width - this.canvas.width);
    const targetY = clamp(player.y - this.canvas.height / 2, 0, this.run.world.height - this.canvas.height);

    camera.x = lerp(camera.x, targetX, 1 - Math.exp(-deltaSec * 6));
    camera.y = lerp(camera.y, targetY, 1 - Math.exp(-deltaSec * 6));

    camera.shakePower = Math.max(0, camera.shakePower - deltaSec * 24);

    if (camera.shakePower > 0.1) {
      camera.shakeX = randomRange(-camera.shakePower, camera.shakePower);
      camera.shakeY = randomRange(-camera.shakePower, camera.shakePower);
    } else {
      camera.shakeX = 0;
      camera.shakeY = 0;
    }
  }

  updateFloatTexts(deltaSec) {
    for (let index = 0; index < this.pools.floatTexts.length; index += 1) {
      const text = this.pools.floatTexts[index];

      if (!text.active) {
        continue;
      }

      text.lifeMs -= deltaSec * 1000;
      text.y += text.vy * deltaSec;

      if (text.lifeMs <= 0) {
        text.active = false;
      }
    }
  }

  spawnFloatText(x, y, text, color = "#ffffff") {
    const item = acquireFromPool(this.pools.floatTexts);

    if (!item) {
      return;
    }

    item.active = true;
    item.x = x;
    item.y = y;
    item.text = text;
    item.color = color;
    item.lifeMs = 760;
    item.maxLifeMs = 760;
    item.vy = -35;
  }

  updateFlash(deltaMs) {
    if (!this.run) {
      return;
    }

    this.run.flashMs = Math.max(0, this.run.flashMs - deltaMs);
    this.refs.hitFlash.style.opacity = this.run.flashMs > 0 ? String(this.run.flashMs / 180) : "0";
  }

  render() {
    const ctx = this.ctx;
    const run = this.run;
    const camera = run.camera;
    const offsetX = camera.shakeX;
    const offsetY = camera.shakeY;

    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    ctx.fillStyle = "#020816";
    ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

    ctx.save();
    ctx.translate(-camera.x + offsetX, -camera.y + offsetY);

    this.renderWorldBackground(ctx, run);
    this.renderPickups(ctx, run);
    this.renderBullets(ctx, this.pools.bullets);
    this.renderBullets(ctx, this.pools.enemyBullets);
    this.renderEnemies(ctx, run);
    this.renderPlayer(ctx, run);
    this.renderFloatTexts(ctx, run);

    ctx.restore();
  }

  renderWorldBackground(ctx, run) {
    const grid = 120;

    for (let index = 0; index < run.starSeed.length; index += 1) {
      const star = run.starSeed[index];
      ctx.fillStyle = `rgba(151, 199, 255, ${star.alpha})`;
      ctx.beginPath();
      ctx.arc(star.x, star.y, star.size, 0, TWO_PI);
      ctx.fill();
    }

    ctx.strokeStyle = "rgba(95, 131, 203, 0.12)";
    ctx.lineWidth = 1;

    for (let x = 0; x <= run.world.width; x += grid) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, run.world.height);
      ctx.stroke();
    }

    for (let y = 0; y <= run.world.height; y += grid) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(run.world.width, y);
      ctx.stroke();
    }

    ctx.strokeStyle = "rgba(129, 162, 227, 0.34)";
    ctx.lineWidth = 2;
    ctx.strokeRect(2, 2, run.world.width - 4, run.world.height - 4);
  }

  renderPlayer(ctx, run) {
    const player = run.player;
    const blink = player.iFrameMs > 0 && Math.floor(player.iFrameMs / 85) % 2 === 0;

    ctx.save();
    ctx.translate(player.x, player.y);
    ctx.rotate(player.angle);

    ctx.fillStyle = blink ? "#ff89a4" : "#7bf4df";
    ctx.beginPath();
    ctx.arc(0, 0, 14, 0, TWO_PI);
    ctx.fill();

    ctx.fillStyle = "#bffcff";
    ctx.beginPath();
    ctx.moveTo(20, 0);
    ctx.lineTo(6, -5);
    ctx.lineTo(6, 5);
    ctx.closePath();
    ctx.fill();

    ctx.restore();
  }

  renderEnemies(ctx) {
    for (let index = 0; index < this.pools.enemies.length; index += 1) {
      const enemy = this.pools.enemies[index];

      if (!enemy.active) {
        continue;
      }

      const ratio = clamp(enemy.hp / enemy.maxHp, 0, 1);

      if (enemy.def.behavior === "crusher") {
        ctx.fillStyle = enemy.hitFlashMs > 0 ? "#ffe084" : "#e49a4b";
      } else if (enemy.def.behavior === "ranged") {
        ctx.fillStyle = enemy.hitFlashMs > 0 ? "#ffe084" : "#d670ff";
      } else if (enemy.def.behavior === "swarm") {
        ctx.fillStyle = enemy.hitFlashMs > 0 ? "#ffe084" : "#7ff46f";
      } else {
        ctx.fillStyle = enemy.hitFlashMs > 0 ? "#ffe084" : "#ff6b7f";
      }

      ctx.beginPath();
      ctx.arc(enemy.x, enemy.y, enemy.radius, 0, TWO_PI);
      ctx.fill();

      const barWidth = enemy.radius * 2;
      const barX = enemy.x - enemy.radius;
      const barY = enemy.y - enemy.radius - 8;

      ctx.fillStyle = "rgba(10, 16, 35, 0.85)";
      ctx.fillRect(barX, barY, barWidth, 4);
      ctx.fillStyle = "#63f7d4";
      ctx.fillRect(barX, barY, barWidth * ratio, 4);
    }
  }

  renderBullets(ctx, pool) {
    for (let index = 0; index < pool.length; index += 1) {
      const bullet = pool[index];

      if (!bullet.active) {
        continue;
      }

      ctx.fillStyle = bullet.color;
      ctx.beginPath();
      ctx.arc(bullet.x, bullet.y, bullet.radius, 0, TWO_PI);
      ctx.fill();
    }
  }

  renderPickups(ctx) {
    for (let index = 0; index < this.pools.pickups.length; index += 1) {
      const pickup = this.pools.pickups[index];

      if (!pickup.active) {
        continue;
      }

      if (pickup.type === "xp") {
        ctx.fillStyle = "#57d9ff";
      } else if (pickup.type === "credits") {
        ctx.fillStyle = "#ffd566";
      } else if (pickup.type === "material") {
        ctx.fillStyle = "#96f992";
      } else if (pickup.type === "weapon") {
        ctx.fillStyle = "#ffa8fd";
      } else {
        ctx.fillStyle = "#b8b8ff";
      }

      ctx.beginPath();
      ctx.arc(pickup.x, pickup.y, pickup.radius, 0, TWO_PI);
      ctx.fill();
    }
  }

  renderFloatTexts(ctx) {
    ctx.font = "15px Space Grotesk, sans-serif";
    ctx.textAlign = "center";

    for (let index = 0; index < this.pools.floatTexts.length; index += 1) {
      const item = this.pools.floatTexts[index];

      if (!item.active) {
        continue;
      }

      const alpha = clamp(item.lifeMs / item.maxLifeMs, 0, 1);
      ctx.fillStyle = item.color;
      ctx.globalAlpha = alpha;
      ctx.fillText(item.text, item.x, item.y);
      ctx.globalAlpha = 1;
    }
  }

  updateHud() {
    if (!this.run) {
      return;
    }

    const player = this.run.player;
    const weapon = this.run.weaponStats;

    this.refs.hpBarFill.style.width = `${(player.hp / player.maxHp) * 100}%`;
    this.refs.hpText.textContent = `${Math.ceil(player.hp)} / ${player.maxHp}`;

    this.refs.xpBarFill.style.width = `${(player.xp / player.xpToNext) * 100}%`;
    this.refs.xpText.textContent = `${Math.floor(player.xp)} / ${player.xpToNext}`;

    this.refs.playerLevelText.textContent = String(player.level);
    this.refs.killsText.textContent = String(this.run.kills);
    this.refs.timerText.textContent = formatSeconds(this.run.elapsedMs / 1000);

    const equipped = this.getEquippedWeapon();
    const weaponDef = WEAPON_BY_ID[equipped.weaponId];

    this.refs.weaponNameText.textContent = `${weaponDef.name} (${equipped.rarity}) Lv.${equipped.level}`;
    this.refs.weaponStatsText.textContent = `DMG ${weapon.damage.toFixed(0)} | Rate ${weapon.fireRate.toFixed(
      1
    )} | Mag ${weapon.magazineSize}`;

    this.refs.ammoText.textContent = `Ammo ${this.run.weaponState.ammo}/${weapon.magazineSize}`;
    this.refs.reloadText.textContent =
      this.run.weaponState.reloadMs > 0
        ? `Reloading ${(this.run.weaponState.reloadMs / 1000).toFixed(1)}s`
        : "Ready";

    this.refs.missionText.textContent = this.run.level.name;
    this.refs.objectiveText.textContent = `Kills ${this.run.kills} / ${this.run.level.killTarget}`;
    this.refs.creditsText.textContent = `Credits ${this.save.credits}`;
  }

  toast(message) {
    const toast = document.createElement("div");
    toast.className = "toast";
    toast.textContent = message;
    this.refs.toastRack.appendChild(toast);

    window.setTimeout(() => {
      toast.remove();
    }, 2600);
  }

  grantDebugLoot() {
    this.addMaterial("scrap", 20);
    this.addMaterial("alloy", 6);
    this.addMaterial("core", 2);
    this.addWeaponInstance("plasma_carbine", 1, "rare");
    this.addAttachmentItem("chip_focus");
    this.addAttachmentItem("mag_quick");
    this.persistSave();
    this.renderInventory();
    this.renderCrafting();
    this.toast("Debug loot granted.");
  }
}
