import { makeId } from "./ids";
import { ATTACHMENT_DEFS, DEFAULT_OPTIONS, RARITY_ORDER, SAVE_VERSION, WEAPON_DEFS } from "../data/gameData";
import type { AttachmentItem, SaveData, WeaponInstance } from "../data/types";

export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

const STORAGE_KEY = "alien_arena_save_v2";
const VALID_WEAPON_IDS = new Set(WEAPON_DEFS.map(item => item.id));
const VALID_ATTACHMENT_IDS = new Set(ATTACHMENT_DEFS.map(item => item.id));
const VALID_RARITIES = new Set(RARITY_ORDER);
const VALID_SLOTS = new Set(["muzzle", "magazine", "optic", "grip", "stock", "chip"]);

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

  const sanitizedWeapons: WeaponInstance[] = [];
  const weaponIds = new Set<string>();

  for (let index = 0; index < merged.inventory.weapons.length; index += 1) {
    const raw = merged.inventory.weapons[index] as Partial<WeaponInstance>;
    const weaponId = typeof raw?.weaponId === "string" ? raw.weaponId : "";

    if (!VALID_WEAPON_IDS.has(weaponId)) {
      continue;
    }

    const def = WEAPON_DEFS.find(item => item.id === weaponId) || WEAPON_DEFS[0];
    let instanceId = typeof raw.instanceId === "string" && raw.instanceId ? raw.instanceId : makeId("weapon");

    if (weaponIds.has(instanceId)) {
      instanceId = makeId("weapon");
    }

    weaponIds.add(instanceId);

    const rawLevel = Number(raw.level);
    const level = Number.isFinite(rawLevel) ? Math.max(1, Math.round(rawLevel)) : def.baseLevel;
    const rarity =
      typeof raw.rarity === "string" && VALID_RARITIES.has(raw.rarity as (typeof RARITY_ORDER)[number])
        ? (raw.rarity as (typeof RARITY_ORDER)[number])
        : def.rarity;

    const attachments: WeaponInstance["attachments"] = {};
    const rawAttachments = raw.attachments as Record<string, string> | undefined;

    if (rawAttachments && typeof rawAttachments === "object") {
      for (const [slot, itemId] of Object.entries(rawAttachments)) {
        if (!VALID_SLOTS.has(slot) || typeof itemId !== "string" || !itemId) {
          continue;
        }

        attachments[slot as keyof WeaponInstance["attachments"]] = itemId;
      }
    }

    sanitizedWeapons.push({
      instanceId,
      weaponId,
      level,
      rarity,
      attachments
    });
  }

  if (sanitizedWeapons.length === 0) {
    const starter = WEAPON_DEFS[0];
    sanitizedWeapons.push({
      instanceId: makeId("weapon"),
      weaponId: starter.id,
      level: starter.baseLevel,
      rarity: starter.rarity,
      attachments: {}
    });
  }

  const sanitizedAttachments: AttachmentItem[] = [];
  const attachmentIds = new Set<string>();

  for (let index = 0; index < merged.inventory.attachments.length; index += 1) {
    const raw = merged.inventory.attachments[index] as Partial<AttachmentItem>;
    const attachmentId = typeof raw?.attachmentId === "string" ? raw.attachmentId : "";

    if (!VALID_ATTACHMENT_IDS.has(attachmentId)) {
      continue;
    }

    let itemId = typeof raw.itemId === "string" && raw.itemId ? raw.itemId : makeId("att");

    if (attachmentIds.has(itemId)) {
      itemId = makeId("att");
    }

    attachmentIds.add(itemId);

    sanitizedAttachments.push({
      itemId,
      attachmentId,
      equippedTo: null
    });
  }

  const attachmentByItemId = new Map(sanitizedAttachments.map(item => [item.itemId, item]));

  for (let w = 0; w < sanitizedWeapons.length; w += 1) {
    const weapon = sanitizedWeapons[w];
    const slots = Object.entries(weapon.attachments || {});

    for (let s = 0; s < slots.length; s += 1) {
      const [slot, itemId] = slots[s];
      const attachment = attachmentByItemId.get(itemId);

      if (!attachment) {
        delete weapon.attachments[slot as keyof WeaponInstance["attachments"]];
        continue;
      }

      if (attachment.equippedTo && attachment.equippedTo !== weapon.instanceId) {
        delete weapon.attachments[slot as keyof WeaponInstance["attachments"]];
        continue;
      }

      attachment.equippedTo = weapon.instanceId;
    }
  }

  merged.inventory.weapons = sanitizedWeapons;
  merged.inventory.attachments = sanitizedAttachments;

  const equippedStillValid = merged.inventory.weapons.some(weapon => weapon.instanceId === merged.inventory.equippedWeaponId);

  if (!equippedStillValid) {
    merged.inventory.equippedWeaponId = merged.inventory.weapons[0].instanceId;
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
