import { makeId } from "./ids";
import { DEFAULT_OPTIONS, SAVE_VERSION, WEAPON_DEFS } from "../data/gameData";
import type { SaveData } from "../data/types";

export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

const STORAGE_KEY = "alien_arena_save_v2";

function defaultSave(): SaveData {
  const starter = WEAPON_DEFS[0];
  const starterId = makeId("weapon");

  return {
    version: SAVE_VERSION,
    unlockedLevelIds: ["alpha_outpost"],
    credits: 120,
    inventory: {
      materials: {
        scrap: 16,
        alloy: 2,
        core: 0,
        quantum: 0
      },
      attachments: [],
      weapons: [
        {
          instanceId: starterId,
          weaponId: starter.id,
          level: starter.baseLevel,
          rarity: starter.rarity,
          attachments: {}
        }
      ],
      equippedWeaponId: starterId
    },
    options: { ...DEFAULT_OPTIONS },
    stats: {
      runsCompleted: 0,
      highestLevel: 1,
      totalKills: 0
    }
  };
}

function normalize(data: Partial<SaveData> | null | undefined): SaveData {
  const base = defaultSave();

  if (!data) {
    return base;
  }

  const merged: SaveData = {
    ...base,
    ...data,
    version: SAVE_VERSION,
    options: {
      ...base.options,
      ...(data.options || {})
    },
    stats: {
      ...base.stats,
      ...(data.stats || {})
    },
    inventory: {
      ...base.inventory,
      ...(data.inventory || {}),
      materials: {
        ...base.inventory.materials,
        ...(data.inventory?.materials || {})
      },
      attachments: Array.isArray(data.inventory?.attachments) ? data.inventory!.attachments : base.inventory.attachments,
      weapons:
        Array.isArray(data.inventory?.weapons) && data.inventory!.weapons.length > 0
          ? data.inventory!.weapons
          : base.inventory.weapons,
      equippedWeaponId: data.inventory?.equippedWeaponId || base.inventory.equippedWeaponId
    }
  };

  if (!Array.isArray(merged.unlockedLevelIds) || merged.unlockedLevelIds.length === 0) {
    merged.unlockedLevelIds = ["alpha_outpost"];
  }

  if (!merged.unlockedLevelIds.includes("alpha_outpost")) {
    merged.unlockedLevelIds.unshift("alpha_outpost");
  }

  const equippedValid = merged.inventory.weapons.some(weapon => weapon.instanceId === merged.inventory.equippedWeaponId);

  if (!equippedValid) {
    merged.inventory.equippedWeaponId = merged.inventory.weapons[0].instanceId;
  }

  for (let index = 0; index < merged.inventory.attachments.length; index += 1) {
    if (typeof merged.inventory.attachments[index].equippedTo === "undefined") {
      merged.inventory.attachments[index].equippedTo = null;
    }
  }

  return merged;
}

export class SaveService {
  constructor(private readonly storage: StorageLike) {}

  load(): SaveData {
    try {
      const raw = this.storage.getItem(STORAGE_KEY);

      if (!raw) {
        const created = defaultSave();
        this.save(created);
        return created;
      }

      const parsed = JSON.parse(raw) as Partial<SaveData>;
      const normalized = normalize(parsed);

      if (parsed.version !== SAVE_VERSION) {
        this.save(normalized);
      }

      return normalized;
    } catch {
      const created = defaultSave();
      this.save(created);
      return created;
    }
  }

  save(data: SaveData): SaveData {
    const normalized = normalize(data);
    this.storage.setItem(STORAGE_KEY, JSON.stringify(normalized));
    return normalized;
  }

  reset(): SaveData {
    const created = defaultSave();
    this.save(created);
    return created;
  }

  key(): string {
    return STORAGE_KEY;
  }
}

export function createBrowserSaveService(): SaveService {
  return new SaveService(window.localStorage);
}
