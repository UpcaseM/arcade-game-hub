import {
  ATTACHMENT_DEFS,
  DEFAULT_PLAYER_BASE_STATS,
  makeEmptyFinalStats,
  RARITY_MULTIPLIER,
  WEAPON_DEFS
} from "../data/gameData";
import type { FinalStats, WeaponInstance, UpgradeDef } from "../data/types";

export function collectModifiers(
  weapon: WeaponInstance,
  upgrades: UpgradeDef[],
  attachmentItemToDefId: Record<string, string>,
  attachmentsInBag = ATTACHMENT_DEFS
): FinalStats {
  const totals = makeEmptyFinalStats();

  const byId = Object.fromEntries(attachmentsInBag.map(def => [def.id, def]));

  const attachmentIds = Object.values(weapon.attachments || {});

  for (let index = 0; index < attachmentIds.length; index += 1) {
    const itemId = attachmentIds[index];

    if (!itemId) {
      continue;
    }

    const attachmentId = attachmentItemToDefId[itemId];
    const def = byId[attachmentId];

    if (!def) {
      continue;
    }

    for (let mod = 0; mod < def.modifiers.length; mod += 1) {
      const modifier = def.modifiers[mod];
      totals[modifier.stat] += modifier.value;
    }
  }

  for (let index = 0; index < upgrades.length; index += 1) {
    const upgrade = upgrades[index];

    for (let mod = 0; mod < upgrade.modifiers.length; mod += 1) {
      const modifier = upgrade.modifiers[mod];
      totals[modifier.stat] += modifier.value;
    }
  }

  return totals;
}

export function computeWeaponFinalStats(weapon: WeaponInstance, modifiers: FinalStats) {
  const def = WEAPON_DEFS.find(item => item.id === weapon.weaponId) || WEAPON_DEFS[0];
  const rarityMul = RARITY_MULTIPLIER[weapon.rarity] || 1;
  const levelMul = 1 + (weapon.level - 1) * 0.12;

  return {
    name: def.name,
    damage: def.damage * rarityMul * levelMul * (1 + modifiers.damageMul),
    fireRate: def.fireRate * (1 + modifiers.fireRateMul),
    projectileSpeed: def.projectileSpeed * (1 + modifiers.projectileSpeedMul),
    spreadDeg: Math.max(0, def.spreadDeg + modifiers.spreadDegAdd),
    magazineSize: Math.max(1, Math.round(def.magazineSize + modifiers.magazineSizeAdd)),
    reloadTimeMs: Math.max(280, def.reloadTimeMs * (1 + modifiers.reloadTimeMul)),
    rangePx: def.rangePx,
    pellets: def.pellets || 1
  };
}

export function computePlayerBaseFromModifiers(modifiers: FinalStats) {
  return {
    maxHp: DEFAULT_PLAYER_BASE_STATS.maxHp + modifiers.maxHpAdd,
    moveSpeed: DEFAULT_PLAYER_BASE_STATS.moveSpeed * (1 + modifiers.moveSpeedMul),
    pickupRange: DEFAULT_PLAYER_BASE_STATS.pickupRange * (1 + modifiers.pickupRangeMul),
    critChance: DEFAULT_PLAYER_BASE_STATS.critChance + modifiers.critChanceAdd,
    critDamage: DEFAULT_PLAYER_BASE_STATS.critDamage * (1 + modifiers.critDamageMul)
  };
}
