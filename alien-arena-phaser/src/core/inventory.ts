import { makeId } from "./ids";
import { CRAFT_RECIPES, RARITY_ORDER } from "../data/gameData";
import type { AttachmentItem, Inventory, MaterialId, Rarity, WeaponInstance } from "../data/types";

function rarityIndex(rarity: Rarity): number {
  return Math.max(0, RARITY_ORDER.indexOf(rarity));
}

export function addMaterial(inventory: Inventory, materialId: MaterialId, qty: number): void {
  inventory.materials[materialId] = (inventory.materials[materialId] || 0) + qty;
}

export function addWeapon(inventory: Inventory, weaponId: string, level: number, rarity: Rarity): WeaponInstance {
  const weapon: WeaponInstance = {
    instanceId: makeId("weapon"),
    weaponId,
    level,
    rarity,
    attachments: {}
  };

  inventory.weapons.push(weapon);
  return weapon;
}

export function addAttachment(inventory: Inventory, attachmentId: string): AttachmentItem {
  const item: AttachmentItem = {
    itemId: makeId("att"),
    attachmentId,
    equippedTo: null
  };

  inventory.attachments.push(item);
  return item;
}

export function syncAttachmentOwnership(inventory: Inventory): void {
  const known = new Map(inventory.attachments.map(item => [item.itemId, item]));

  for (let index = 0; index < inventory.attachments.length; index += 1) {
    inventory.attachments[index].equippedTo = null;
  }

  for (let weaponIndex = 0; weaponIndex < inventory.weapons.length; weaponIndex += 1) {
    const weapon = inventory.weapons[weaponIndex];
    const slots = Object.entries(weapon.attachments || {});

    for (let entryIndex = 0; entryIndex < slots.length; entryIndex += 1) {
      const [slot, itemId] = slots[entryIndex];
      const item = known.get(itemId);

      if (!item) {
        delete weapon.attachments[slot as keyof WeaponInstance["attachments"]];
        continue;
      }

      item.equippedTo = weapon.instanceId;
    }
  }
}

export function canCraft(inventory: Inventory, recipeId: string): boolean {
  const recipe = CRAFT_RECIPES.find(item => item.id === recipeId);

  if (!recipe) {
    return false;
  }

  if (recipe.type === "material") {
    return (recipe.cost || []).every(cost => (inventory.materials[cost.materialId] || 0) >= cost.qty);
  }

  if (recipe.type === "weaponFusion") {
    return findFusionCandidate(inventory, recipe.minRarity as Rarity, recipe.consumeCount || 3).length >= (recipe.consumeCount || 3);
  }

  if (recipe.type === "rarityUpgrade") {
    const weapon = inventory.weapons.find(entry => entry.instanceId === inventory.equippedWeaponId);

    if (!weapon || rarityIndex(weapon.rarity) >= rarityIndex("legendary")) {
      return false;
    }

    return (recipe.cost || []).every(cost => (inventory.materials[cost.materialId] || 0) >= cost.qty);
  }

  return false;
}

function findFusionCandidate(inventory: Inventory, rarity: Rarity, count: number): WeaponInstance[] {
  const buckets = new Map<string, WeaponInstance[]>();

  for (let index = 0; index < inventory.weapons.length; index += 1) {
    const weapon = inventory.weapons[index];

    if (weapon.rarity !== rarity) {
      continue;
    }

    const key = `${weapon.weaponId}:${weapon.level}:${weapon.rarity}`;

    if (!buckets.has(key)) {
      buckets.set(key, []);
    }

    buckets.get(key)!.push(weapon);
  }

  for (const bucket of buckets.values()) {
    if (bucket.length >= count) {
      return bucket;
    }
  }

  return [];
}

export function craft(inventory: Inventory, recipeId: string): string {
  const recipe = CRAFT_RECIPES.find(item => item.id === recipeId);

  if (!recipe) {
    return "Unknown recipe";
  }

  if (!canCraft(inventory, recipeId)) {
    return "Requirements not met";
  }

  if (recipe.type === "material") {
    for (let index = 0; index < (recipe.cost || []).length; index += 1) {
      const cost = recipe.cost![index];
      inventory.materials[cost.materialId] -= cost.qty;
    }

    for (let index = 0; index < (recipe.output || []).length; index += 1) {
      const out = recipe.output![index];
      inventory.materials[out.materialId] += out.qty;
    }

    return `Crafted ${recipe.name}`;
  }

  if (recipe.type === "weaponFusion") {
    const bucket = findFusionCandidate(inventory, recipe.minRarity as Rarity, recipe.consumeCount || 3);
    const consume = recipe.consumeCount || 3;
    const base = bucket[0];

    for (let index = 0; index < consume; index += 1) {
      const remove = bucket[index];
      const at = inventory.weapons.findIndex(weapon => weapon.instanceId === remove.instanceId);

      if (at >= 0) {
        inventory.weapons.splice(at, 1);
      }
    }

    const created = addWeapon(inventory, base.weaponId, base.level + 1, base.rarity);
    inventory.equippedWeaponId = created.instanceId;
    return `Fusion complete: ${created.weaponId} Lv.${created.level}`;
  }

  const equipped = inventory.weapons.find(entry => entry.instanceId === inventory.equippedWeaponId);

  for (let index = 0; index < (recipe.cost || []).length; index += 1) {
    const cost = recipe.cost![index];
    inventory.materials[cost.materialId] -= cost.qty;
  }

  if (equipped) {
    const next = RARITY_ORDER[rarityIndex(equipped.rarity) + 1] || equipped.rarity;
    equipped.rarity = next;
  }

  return `Rarity upgraded: ${equipped?.rarity || "unknown"}`;
}
