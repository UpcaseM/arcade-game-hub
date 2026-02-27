import { describe, expect, test } from "vitest";
import { RARITY_ORDER } from "../data/gameData";
import { canCraft, craft } from "../core/inventory";
import { SaveService, type StorageLike } from "../core/save";

function memoryStorage(): StorageLike {
  const store = new Map<string, string>();
  return {
    getItem: key => store.get(key) ?? null,
    setItem: (key, value) => {
      store.set(key, value);
    }
  };
}

describe("SaveService", () => {
  test("creates default save and persists", () => {
    const service = new SaveService(memoryStorage());
    const save = service.load();

    expect(save.unlockedLevelIds).toContain("alpha_outpost");
    expect(save.inventory.weapons.length).toBeGreaterThan(0);
    expect(save.inventory.equippedWeaponId).toBeTruthy();
  });

  test("sanitizes legacy invalid weapon/attachment records", () => {
    const storage = memoryStorage();
    const service = new SaveService(storage);

    storage.setItem(
      service.key(),
      JSON.stringify({
        version: 0,
        unlockedLevelIds: [],
        inventory: {
          materials: { scrap: 10, alloy: 0, core: 0, quantum: 0 },
          attachments: [
            { itemId: "att-1", attachmentId: "ghost_attachment", equippedTo: "w-1" },
            { itemId: "att-1", attachmentId: "muzzle_stabilizer", equippedTo: "w-1" }
          ],
          weapons: [
            { instanceId: "w-1", weaponId: "ghost_weapon", level: 3, rarity: "legendary", attachments: { muzzle: "att-1" } },
            { instanceId: "w-1", weaponId: "pulse_rifle", level: -4, rarity: "mythic", attachments: { muzzle: "att-1", unknown: "x" } }
          ],
          equippedWeaponId: "ghost_equipped"
        }
      })
    );

    const save = service.load();

    expect(save.unlockedLevelIds).toContain("alpha_outpost");
    expect(save.inventory.weapons.length).toBeGreaterThan(0);
    expect(save.inventory.weapons.every(weapon => weapon.weaponId !== "ghost_weapon")).toBe(true);
    expect(save.inventory.weapons.every(weapon => weapon.level >= 1)).toBe(true);
    expect(save.inventory.weapons.every(weapon => RARITY_ORDER.includes(weapon.rarity))).toBe(true);

    const weaponIds = new Set(save.inventory.weapons.map(weapon => weapon.instanceId));
    expect(weaponIds.has(save.inventory.equippedWeaponId)).toBe(true);
    expect(save.inventory.attachments.every(item => item.attachmentId !== "ghost_attachment")).toBe(true);
    expect(save.inventory.attachments.every(item => item.equippedTo === null || weaponIds.has(item.equippedTo))).toBe(true);
  });
});

describe("inventory crafting", () => {
  test("material recipe consumes and outputs correctly", () => {
    const service = new SaveService(memoryStorage());
    const save = service.load();

    save.inventory.materials.scrap = 24;
    save.inventory.materials.alloy = 0;

    expect(canCraft(save.inventory, "r_scrap_to_alloy")).toBe(true);

    const result = craft(save.inventory, "r_scrap_to_alloy");
    expect(result).toContain("Crafted");
    expect(save.inventory.materials.scrap).toBe(12);
    expect(save.inventory.materials.alloy).toBe(1);
  });
});
