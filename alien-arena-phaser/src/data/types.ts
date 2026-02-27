export type Rarity = "common" | "uncommon" | "rare" | "epic" | "legendary";
export type SlotType = "muzzle" | "magazine" | "optic" | "grip" | "stock" | "chip";

export interface StatModifier {
  stat:
    | "damageMul"
    | "fireRateMul"
    | "reloadTimeMul"
    | "critChanceAdd"
    | "critDamageMul"
    | "spreadDegAdd"
    | "magazineSizeAdd"
    | "projectileSpeedMul"
    | "moveSpeedMul"
    | "maxHpAdd"
    | "pickupRangeMul";
  value: number;
}

export interface WeaponDef {
  id: string;
  name: string;
  rarity: Rarity;
  baseLevel: number;
  damage: number;
  fireRate: number;
  projectileSpeed: number;
  spreadDeg: number;
  magazineSize: number;
  reloadTimeMs: number;
  rangePx: number;
  pellets?: number;
  attachmentSlots: SlotType[];
}

export interface AttachmentDef {
  id: string;
  name: string;
  slot: SlotType;
  rarity: Rarity;
  modifiers: StatModifier[];
}

export type EnemyBehavior = "chaser" | "ranged" | "swarm" | "charger";

export interface EnemyDef {
  id: string;
  name: string;
  hp: number;
  speed: number;
  contactDamage: number;
  expReward: number;
  behavior: EnemyBehavior;
  dropTableId: string;
  rangedDamage?: number;
  rangedCooldownMs?: number;
  chargeCooldownMs?: number;
}

export interface WaveSpawn {
  enemyId: string;
  count: number;
  intervalMs: number;
  startAtMs: number;
  spawnPattern: "edgeRandom" | "aroundPlayer" | "fixedPoints";
}

export interface LevelDef {
  id: string;
  name: string;
  description: string;
  mapKey: string;
  difficulty: 1 | 2 | 3 | 4 | 5;
  mapSize: {
    width: number;
    height: number;
  };
  durationSec: number;
  killTarget: number;
  waves: WaveSpawn[];
  reward: {
    credits: number;
    unlocks?: string[];
  };
}

export interface UpgradeDef {
  id: string;
  name: string;
  description: string;
  weight: number;
  modifiers: StatModifier[];
  healFlat?: number;
  onKillHealEvery?: number;
  onKillHealAmount?: number;
}

export interface DropEntry {
  type: "credits" | "material" | "xp" | "weapon" | "attachment";
  weight: number;
  min?: number;
  max?: number;
  materialId?: MaterialId;
  weaponPool?: string[];
  attachmentPool?: string[];
}

export type MaterialId = "scrap" | "alloy" | "core" | "quantum";

export interface CraftRecipe {
  id: string;
  name: string;
  description: string;
  type: "material" | "weaponFusion" | "rarityUpgrade";
  cost?: Array<{ materialId: MaterialId; qty: number }>;
  output?: Array<{ materialId: MaterialId; qty: number }>;
  minRarity?: Rarity;
  consumeCount?: number;
}

export interface WeaponInstance {
  instanceId: string;
  weaponId: string;
  level: number;
  rarity: Rarity;
  attachments: Partial<Record<SlotType, string>>;
}

export interface AttachmentItem {
  itemId: string;
  attachmentId: string;
  equippedTo: string | null;
}

export interface Inventory {
  materials: Record<MaterialId, number>;
  attachments: AttachmentItem[];
  weapons: WeaponInstance[];
  equippedWeaponId: string;
}

export interface SaveData {
  version: number;
  unlockedLevelIds: string[];
  credits: number;
  inventory: Inventory;
  options: {
    masterVolume: number;
  };
  stats: {
    runsCompleted: number;
    highestLevel: number;
    totalKills: number;
  };
}

export interface PlayerBaseStats {
  maxHp: number;
  moveSpeed: number;
  critChance: number;
  critDamage: number;
  pickupRange: number;
}

export interface FinalStats {
  damageMul: number;
  fireRateMul: number;
  reloadTimeMul: number;
  critChanceAdd: number;
  critDamageMul: number;
  spreadDegAdd: number;
  magazineSizeAdd: number;
  projectileSpeedMul: number;
  moveSpeedMul: number;
  maxHpAdd: number;
  pickupRangeMul: number;
}
