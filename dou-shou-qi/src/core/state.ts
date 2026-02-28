export const saveData = {
  version: 1,
  unlockedLevelIds: [],
  credits: 0,
  inventory: {
    materials: { scrap: 0, alloy: 0, core: 0, quantum: 0 },
    attachments: [],
    weapons: [],
    equippedWeaponId: null
  },
  options: {
    masterVolume: 0.6
  },
  stats: {
    runsCompleted: 0,
    highestLevel: 0,
    totalKills: 0,
    totalWins: 0
  }
};

export const gameState = {
  saveData,
  selectedLevelId: null as string | null,
  attachSaveService: () => {},
  setSave: () => {},
  persistSave: () => {},
  isUnlocked: (_id: string) => true
};