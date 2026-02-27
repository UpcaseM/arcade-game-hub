import { describe, expect, test } from "vitest";
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
