import { ATTACHMENT_DEFS, LEVEL_DEFS, UPGRADE_DEFS, WEAPON_DEFS } from "../data/gameData";
import type { AttachmentDef, LevelDef, SaveData, UpgradeDef, WeaponDef } from "../data/types";
import type { SaveService } from "./save";

export interface RuntimeRunSummary {
  levelId: string;
  kills: number;
  victory: boolean;
  creditsEarned: number;
}

export class GameState {
  selectedLevelId = LEVEL_DEFS[0].id;
  saveData!: SaveData;
  private saveService: SaveService | null = null;
  activeUpgrades: UpgradeDef[] = [];
  lastRun: RuntimeRunSummary | null = null;

  readonly levelById = new Map<string, LevelDef>();
  readonly weaponById = new Map<string, WeaponDef>();
  readonly attachmentById = new Map<string, AttachmentDef>();
  readonly upgradeById = new Map<string, UpgradeDef>();

  constructor() {
    for (let index = 0; index < LEVEL_DEFS.length; index += 1) {
      this.levelById.set(LEVEL_DEFS[index].id, LEVEL_DEFS[index]);
    }

    for (let index = 0; index < WEAPON_DEFS.length; index += 1) {
      this.weaponById.set(WEAPON_DEFS[index].id, WEAPON_DEFS[index]);
    }

    for (let index = 0; index < ATTACHMENT_DEFS.length; index += 1) {
      this.attachmentById.set(ATTACHMENT_DEFS[index].id, ATTACHMENT_DEFS[index]);
    }

    for (let index = 0; index < UPGRADE_DEFS.length; index += 1) {
      this.upgradeById.set(UPGRADE_DEFS[index].id, UPGRADE_DEFS[index]);
    }
  }

  setSave(save: SaveData): void {
    this.saveData = save;
  }

  attachSaveService(service: SaveService): void {
    this.saveService = service;
  }

  persistSave(): void {
    if (!this.saveService) {
      return;
    }

    this.saveData = this.saveService.save(this.saveData);
  }

  getSelectedLevel(): LevelDef {
    return this.levelById.get(this.selectedLevelId) || LEVEL_DEFS[0];
  }

  isUnlocked(levelId: string): boolean {
    return this.saveData.unlockedLevelIds.includes(levelId);
  }

  unlock(levelId: string): void {
    if (!this.saveData.unlockedLevelIds.includes(levelId)) {
      this.saveData.unlockedLevelIds.push(levelId);
    }
  }
}

export const gameState = new GameState();
