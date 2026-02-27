import type {
  AttachmentDef,
  CraftRecipe,
  EnemyDef,
  FinalStats,
  LevelDef,
  MaterialId,
  PlayerBaseStats,
  Rarity,
  UpgradeDef,
  WeaponDef
} from "./types";

export const RARITY_ORDER: Rarity[] = ["common", "uncommon", "rare", "epic", "legendary"];

export const RARITY_MULTIPLIER: Record<Rarity, number> = {
  common: 1,
  uncommon: 1.16,
  rare: 1.36,
  epic: 1.62,
  legendary: 1.95
};

export const MATERIAL_LABELS: Record<MaterialId, string> = {
  scrap: "Scrap",
  alloy: "Alloy",
  core: "Core",
  quantum: "Quantum"
};

export const DEFAULT_OPTIONS = {
  masterVolume: 0.6
};

export const SAVE_VERSION = 1;

export const DEFAULT_PLAYER_BASE_STATS: PlayerBaseStats = {
  maxHp: 120,
  moveSpeed: 240,
  critChance: 0.08,
  critDamage: 1.6,
  pickupRange: 110
};

export function makeEmptyFinalStats(): FinalStats {
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

export const WEAPON_DEFS: WeaponDef[] = [
  {
    id: "pulse_rifle",
    name: "Pulse Rifle",
    rarity: "common",
    baseLevel: 1,
    damage: 18,
    fireRate: 5.6,
    projectileSpeed: 620,
    spreadDeg: 4.5,
    magazineSize: 28,
    reloadTimeMs: 1300,
    rangePx: 740,
    attachmentSlots: ["muzzle", "magazine", "optic"]
  },
  {
    id: "nova_smg",
    name: "Nova SMG",
    rarity: "uncommon",
    baseLevel: 1,
    damage: 11,
    fireRate: 9.4,
    projectileSpeed: 560,
    spreadDeg: 7,
    magazineSize: 38,
    reloadTimeMs: 1450,
    rangePx: 620,
    attachmentSlots: ["muzzle", "magazine", "grip"]
  },
  {
    id: "arc_shotgun",
    name: "Arc Shotgun",
    rarity: "rare",
    baseLevel: 1,
    damage: 13,
    fireRate: 1.85,
    projectileSpeed: 520,
    spreadDeg: 18,
    magazineSize: 7,
    reloadTimeMs: 1750,
    rangePx: 420,
    pellets: 6,
    attachmentSlots: ["muzzle", "stock", "chip"]
  },
  {
    id: "rail_lancer",
    name: "Rail Lancer",
    rarity: "rare",
    baseLevel: 1,
    damage: 58,
    fireRate: 1.2,
    projectileSpeed: 980,
    spreadDeg: 2.2,
    magazineSize: 8,
    reloadTimeMs: 1800,
    rangePx: 1000,
    attachmentSlots: ["optic", "stock", "chip"]
  },
  {
    id: "plasma_carbine",
    name: "Plasma Carbine",
    rarity: "epic",
    baseLevel: 1,
    damage: 22,
    fireRate: 6.8,
    projectileSpeed: 690,
    spreadDeg: 5,
    magazineSize: 30,
    reloadTimeMs: 1350,
    rangePx: 790,
    attachmentSlots: ["muzzle", "magazine", "optic", "chip"]
  },
  {
    id: "void_blaster",
    name: "Void Blaster",
    rarity: "legendary",
    baseLevel: 1,
    damage: 34,
    fireRate: 4.7,
    projectileSpeed: 760,
    spreadDeg: 4,
    magazineSize: 24,
    reloadTimeMs: 1200,
    rangePx: 860,
    attachmentSlots: ["muzzle", "magazine", "optic", "grip", "stock", "chip"]
  }
];

export const ATTACHMENT_DEFS: AttachmentDef[] = [
  {
    id: "muzzle_stabilizer",
    name: "Muzzle Stabilizer",
    slot: "muzzle",
    rarity: "common",
    modifiers: [{ stat: "spreadDegAdd", value: -1.4 }]
  },
  {
    id: "muzzle_overclock",
    name: "Overclock Brake",
    slot: "muzzle",
    rarity: "rare",
    modifiers: [
      { stat: "fireRateMul", value: 0.12 },
      { stat: "spreadDegAdd", value: 0.7 }
    ]
  },
  {
    id: "mag_extended",
    name: "Extended Magazine",
    slot: "magazine",
    rarity: "uncommon",
    modifiers: [{ stat: "magazineSizeAdd", value: 10 }]
  },
  {
    id: "mag_quick",
    name: "Quick Loader",
    slot: "magazine",
    rarity: "rare",
    modifiers: [
      { stat: "reloadTimeMul", value: -0.18 },
      { stat: "magazineSizeAdd", value: -3 }
    ]
  },
  {
    id: "optic_holo",
    name: "Holo Sight",
    slot: "optic",
    rarity: "uncommon",
    modifiers: [{ stat: "critChanceAdd", value: 0.06 }]
  },
  {
    id: "optic_tracker",
    name: "Tracker Optic",
    slot: "optic",
    rarity: "rare",
    modifiers: [
      { stat: "critChanceAdd", value: 0.04 },
      { stat: "projectileSpeedMul", value: 0.12 }
    ]
  },
  {
    id: "grip_recoil",
    name: "Recoil Grip",
    slot: "grip",
    rarity: "common",
    modifiers: [
      { stat: "spreadDegAdd", value: -1.1 },
      { stat: "moveSpeedMul", value: -0.04 }
    ]
  },
  {
    id: "stock_rush",
    name: "Rush Stock",
    slot: "stock",
    rarity: "rare",
    modifiers: [
      { stat: "moveSpeedMul", value: 0.1 },
      { stat: "reloadTimeMul", value: -0.08 }
    ]
  },
  {
    id: "chip_vamp",
    name: "Leech Chip",
    slot: "chip",
    rarity: "epic",
    modifiers: [
      { stat: "damageMul", value: 0.1 },
      { stat: "maxHpAdd", value: 20 }
    ]
  },
  {
    id: "chip_focus",
    name: "Focus Chip",
    slot: "chip",
    rarity: "rare",
    modifiers: [
      { stat: "critChanceAdd", value: 0.08 },
      { stat: "critDamageMul", value: 0.2 }
    ]
  }
];

export const ENEMY_DEFS: EnemyDef[] = [
  {
    id: "crawler",
    name: "Crawler",
    hp: 58,
    speed: 108,
    contactDamage: 11,
    expReward: 12,
    behavior: "chaser",
    dropTableId: "basic"
  },
  {
    id: "spitter",
    name: "Spitter",
    hp: 84,
    speed: 72,
    contactDamage: 8,
    rangedDamage: 10,
    rangedCooldownMs: 2000,
    expReward: 18,
    behavior: "ranged",
    dropTableId: "advanced"
  },
  {
    id: "swarmling",
    name: "Swarmling",
    hp: 34,
    speed: 145,
    contactDamage: 7,
    expReward: 8,
    behavior: "swarm",
    dropTableId: "basic"
  },
  {
    id: "crusher",
    name: "Crusher",
    hp: 200,
    speed: 66,
    contactDamage: 20,
    expReward: 38,
    behavior: "charger",
    chargeCooldownMs: 3000,
    dropTableId: "elite"
  }
];

export const DROP_TABLES = {
  basic: [
    { type: "credits", weight: 35, min: 5, max: 16 },
    { type: "material", materialId: "scrap", weight: 30, min: 1, max: 3 },
    { type: "xp", weight: 100, min: 1, max: 1 },
    { type: "weapon", weight: 9, weaponPool: ["pulse_rifle", "nova_smg"] },
    { type: "attachment", weight: 8, attachmentPool: ["muzzle_stabilizer", "mag_extended", "grip_recoil"] }
  ],
  advanced: [
    { type: "credits", weight: 34, min: 10, max: 24 },
    { type: "material", materialId: "scrap", weight: 22, min: 2, max: 5 },
    { type: "material", materialId: "alloy", weight: 14, min: 1, max: 2 },
    { type: "xp", weight: 100, min: 1, max: 2 },
    { type: "weapon", weight: 12, weaponPool: ["plasma_carbine", "rail_lancer", "arc_shotgun"] },
    {
      type: "attachment",
      weight: 12,
      attachmentPool: ["muzzle_overclock", "mag_quick", "optic_holo", "optic_tracker", "stock_rush"]
    }
  ],
  elite: [
    { type: "credits", weight: 38, min: 22, max: 60 },
    { type: "material", materialId: "alloy", weight: 28, min: 1, max: 3 },
    { type: "material", materialId: "core", weight: 16, min: 1, max: 2 },
    { type: "xp", weight: 100, min: 2, max: 3 },
    { type: "weapon", weight: 16, weaponPool: ["void_blaster", "plasma_carbine", "rail_lancer"] },
    {
      type: "attachment",
      weight: 18,
      attachmentPool: ["chip_vamp", "chip_focus", "optic_tracker", "stock_rush", "mag_quick"]
    }
  ]
} as const;

export const UPGRADE_DEFS: UpgradeDef[] = [
  {
    id: "up_damage_1",
    name: "Photon Core",
    description: "Weapon damage +12%",
    weight: 13,
    modifiers: [{ stat: "damageMul", value: 0.12 }]
  },
  {
    id: "up_damage_2",
    name: "Refined Core",
    description: "Weapon damage +18%",
    weight: 8,
    modifiers: [{ stat: "damageMul", value: 0.18 }]
  },
  {
    id: "up_rate_1",
    name: "Rapid Trigger",
    description: "Fire rate +14%",
    weight: 12,
    modifiers: [{ stat: "fireRateMul", value: 0.14 }]
  },
  {
    id: "up_rate_2",
    name: "Overclock Trigger",
    description: "Fire rate +22%, spread +0.6",
    weight: 8,
    modifiers: [
      { stat: "fireRateMul", value: 0.22 },
      { stat: "spreadDegAdd", value: 0.6 }
    ]
  },
  {
    id: "up_reload",
    name: "Auto Loader",
    description: "Reload time -20%",
    weight: 10,
    modifiers: [{ stat: "reloadTimeMul", value: -0.2 }]
  },
  {
    id: "up_mag",
    name: "Ammo Belt",
    description: "Magazine +9",
    weight: 10,
    modifiers: [{ stat: "magazineSizeAdd", value: 9 }]
  },
  {
    id: "up_speed",
    name: "Kinetic Boots",
    description: "Move speed +12%",
    weight: 11,
    modifiers: [{ stat: "moveSpeedMul", value: 0.12 }]
  },
  {
    id: "up_hp",
    name: "Nano Plating",
    description: "Max HP +30 and heal 20",
    weight: 11,
    modifiers: [{ stat: "maxHpAdd", value: 30 }],
    healFlat: 20
  },
  {
    id: "up_crit_1",
    name: "Precision Matrix",
    description: "Crit chance +6%, crit damage +20%",
    weight: 8,
    modifiers: [
      { stat: "critChanceAdd", value: 0.06 },
      { stat: "critDamageMul", value: 0.2 }
    ]
  },
  {
    id: "up_pickup",
    name: "Magnetic Field",
    description: "Pickup range +30%",
    weight: 9,
    modifiers: [{ stat: "pickupRangeMul", value: 0.3 }]
  },
  {
    id: "up_bullet_speed",
    name: "Ion Propellant",
    description: "Projectile speed +20%",
    weight: 7,
    modifiers: [{ stat: "projectileSpeedMul", value: 0.2 }]
  },
  {
    id: "up_lifesteal",
    name: "Leech Protocol",
    description: "Gain 2 HP every 6 kills",
    weight: 5,
    modifiers: [],
    onKillHealEvery: 6,
    onKillHealAmount: 2
  }
];

export const CRAFT_RECIPES: CraftRecipe[] = [
  {
    id: "r_scrap_to_alloy",
    name: "Refine Alloy",
    description: "Convert 12 Scrap into 1 Alloy",
    type: "material",
    cost: [{ materialId: "scrap", qty: 12 }],
    output: [{ materialId: "alloy", qty: 1 }]
  },
  {
    id: "r_alloy_to_core",
    name: "Forge Core",
    description: "Convert 6 Alloy into 1 Core",
    type: "material",
    cost: [{ materialId: "alloy", qty: 6 }],
    output: [{ materialId: "core", qty: 1 }]
  },
  {
    id: "r_core_to_plasma",
    name: "Plasma Catalyst",
    description: "Convert 2 Core + 2 Alloy into 1 Quantum",
    type: "material",
    cost: [
      { materialId: "core", qty: 2 },
      { materialId: "alloy", qty: 2 }
    ],
    output: [{ materialId: "quantum", qty: 1 }]
  },
  {
    id: "r_fuse_common",
    name: "Fuse Common Weapon",
    description: "3 same common weapons -> +1 level",
    type: "weaponFusion",
    minRarity: "common",
    consumeCount: 3
  },
  {
    id: "r_fuse_uncommon",
    name: "Fuse Uncommon Weapon",
    description: "3 same uncommon weapons -> +1 level",
    type: "weaponFusion",
    minRarity: "uncommon",
    consumeCount: 3
  },
  {
    id: "r_weapon_rarity_up",
    name: "Rarity Upgrade",
    description: "Use 1 Core + 1 matching weapon to increase rarity",
    type: "rarityUpgrade",
    cost: [{ materialId: "core", qty: 1 }]
  }
];

export const LEVEL_DEFS: LevelDef[] = [
  {
    id: "alpha_outpost",
    name: "Alpha Outpost",
    description: "Scout mission on the frontier outpost.",
    mapKey: "arena_alpha",
    difficulty: 1,
    mapSize: { width: 2200, height: 1500 },
    durationSec: 90,
    killTarget: 58,
    waves: [
      { enemyId: "crawler", count: 20, intervalMs: 1400, startAtMs: 0, spawnPattern: "edgeRandom" },
      { enemyId: "swarmling", count: 16, intervalMs: 1600, startAtMs: 15000, spawnPattern: "edgeRandom" },
      { enemyId: "crawler", count: 22, intervalMs: 1200, startAtMs: 32000, spawnPattern: "edgeRandom" }
    ],
    reward: { credits: 90, unlocks: ["beta_crater"] }
  },
  {
    id: "beta_crater",
    name: "Beta Crater",
    description: "Unstable terrain with ranged mutants.",
    mapKey: "arena_beta",
    difficulty: 2,
    mapSize: { width: 2400, height: 1700 },
    durationSec: 95,
    killTarget: 76,
    waves: [
      { enemyId: "crawler", count: 24, intervalMs: 1200, startAtMs: 0, spawnPattern: "edgeRandom" },
      { enemyId: "spitter", count: 12, intervalMs: 2300, startAtMs: 9000, spawnPattern: "edgeRandom" },
      { enemyId: "swarmling", count: 26, intervalMs: 900, startAtMs: 26000, spawnPattern: "edgeRandom" },
      { enemyId: "spitter", count: 13, intervalMs: 2100, startAtMs: 42000, spawnPattern: "edgeRandom" }
    ],
    reward: { credits: 130, unlocks: ["gamma_relay"] }
  },
  {
    id: "gamma_relay",
    name: "Gamma Relay",
    description: "Defend relay station from elite assaults.",
    mapKey: "arena_gamma",
    difficulty: 3,
    mapSize: { width: 2500, height: 1800 },
    durationSec: 100,
    killTarget: 94,
    waves: [
      { enemyId: "crawler", count: 28, intervalMs: 1100, startAtMs: 0, spawnPattern: "edgeRandom" },
      { enemyId: "spitter", count: 18, intervalMs: 1800, startAtMs: 10000, spawnPattern: "edgeRandom" },
      { enemyId: "crusher", count: 8, intervalMs: 6000, startAtMs: 22000, spawnPattern: "edgeRandom" },
      { enemyId: "swarmling", count: 34, intervalMs: 820, startAtMs: 42000, spawnPattern: "edgeRandom" }
    ],
    reward: { credits: 170, unlocks: ["delta_hive"] }
  },
  {
    id: "delta_hive",
    name: "Delta Hive",
    description: "Dense hive activity. No safe corner.",
    mapKey: "arena_delta",
    difficulty: 4,
    mapSize: { width: 2700, height: 1900 },
    durationSec: 110,
    killTarget: 126,
    waves: [
      { enemyId: "swarmling", count: 46, intervalMs: 680, startAtMs: 0, spawnPattern: "edgeRandom" },
      { enemyId: "spitter", count: 21, intervalMs: 1500, startAtMs: 11000, spawnPattern: "edgeRandom" },
      { enemyId: "crusher", count: 12, intervalMs: 4200, startAtMs: 22000, spawnPattern: "edgeRandom" },
      { enemyId: "crawler", count: 44, intervalMs: 750, startAtMs: 42000, spawnPattern: "edgeRandom" }
    ],
    reward: { credits: 240, unlocks: ["omega_gate"] }
  },
  {
    id: "omega_gate",
    name: "Omega Gate",
    description: "Final breach. Survive impossible pressure.",
    mapKey: "arena_omega",
    difficulty: 5,
    mapSize: { width: 2900, height: 2000 },
    durationSec: 120,
    killTarget: 156,
    waves: [
      { enemyId: "swarmling", count: 60, intervalMs: 580, startAtMs: 0, spawnPattern: "edgeRandom" },
      { enemyId: "spitter", count: 28, intervalMs: 1200, startAtMs: 7000, spawnPattern: "edgeRandom" },
      { enemyId: "crusher", count: 18, intervalMs: 3500, startAtMs: 20000, spawnPattern: "edgeRandom" },
      { enemyId: "crawler", count: 56, intervalMs: 620, startAtMs: 42000, spawnPattern: "edgeRandom" }
    ],
    reward: { credits: 330 }
  }
];
