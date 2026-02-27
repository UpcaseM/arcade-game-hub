import { DEFAULT_OPTIONS, SAVE_VERSION, WEAPON_DEFS } from "./data.js";

const STORAGE_KEY = "alien_arena_save_v1";

function makeInstanceId(prefix = "item") {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

function clone(value) {
  if (typeof structuredClone === "function") {
    return structuredClone(value);
  }

  return JSON.parse(JSON.stringify(value));
}

function defaultInventory() {
  const starterDef = WEAPON_DEFS[0];
  const starterWeaponId = makeInstanceId("weapon");

  return {
    materials: {
      scrap: 16,
      alloy: 2,
      core: 0,
      quantum: 0
    },
    attachments: [],
    weapons: [
      {
        instanceId: starterWeaponId,
        weaponId: starterDef.id,
        level: starterDef.baseLevel,
        rarity: starterDef.rarity,
        attachments: {}
      }
    ],
    equippedWeaponId: starterWeaponId
  };
}

export function createInitialSaveData() {
  return {
    version: SAVE_VERSION,
    unlockedLevelIds: ["alpha_outpost"],
    credits: 120,
    inventory: defaultInventory(),
    options: clone(DEFAULT_OPTIONS),
    stats: {
      runsCompleted: 0,
      highestLevel: 1,
      totalKills: 0
    }
  };
}

function normalizeSave(raw) {
  const base = createInitialSaveData();

  if (!raw || typeof raw !== "object") {
    return base;
  }

  const next = {
    ...base,
    ...raw,
    options: {
      ...base.options,
      ...(raw.options || {})
    },
    stats: {
      ...base.stats,
      ...(raw.stats || {})
    }
  };

  if (!Array.isArray(next.unlockedLevelIds) || next.unlockedLevelIds.length === 0) {
    next.unlockedLevelIds = ["alpha_outpost"];
  }

  if (!next.unlockedLevelIds.includes("alpha_outpost")) {
    next.unlockedLevelIds.unshift("alpha_outpost");
  }

  if (!next.inventory || typeof next.inventory !== "object") {
    next.inventory = base.inventory;
  }

  next.inventory.materials = {
    ...base.inventory.materials,
    ...(next.inventory.materials || {})
  };

  if (!Array.isArray(next.inventory.attachments)) {
    next.inventory.attachments = [];
  }

  if (!Array.isArray(next.inventory.weapons) || next.inventory.weapons.length === 0) {
    next.inventory = base.inventory;
  }

  if (!next.inventory.equippedWeaponId || !next.inventory.weapons.some(w => w.instanceId === next.inventory.equippedWeaponId)) {
    next.inventory.equippedWeaponId = next.inventory.weapons[0]?.instanceId || base.inventory.equippedWeaponId;
  }

  next.version = SAVE_VERSION;

  return next;
}

export function loadSaveData() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);

    if (!raw) {
      const initial = createInitialSaveData();
      saveGameData(initial);
      return initial;
    }

    const parsed = JSON.parse(raw);
    const normalized = normalizeSave(parsed);

    if (parsed.version !== SAVE_VERSION) {
      saveGameData(normalized);
    }

    return normalized;
  } catch (error) {
    console.warn("Failed to load save, resetting.", error);
    const initial = createInitialSaveData();
    saveGameData(initial);
    return initial;
  }
}

export function saveGameData(data) {
  const normalized = normalizeSave(data);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(normalized));
  return normalized;
}

export function resetSaveData() {
  const initial = createInitialSaveData();
  saveGameData(initial);
  return initial;
}

export function getStorageKey() {
  return STORAGE_KEY;
}
