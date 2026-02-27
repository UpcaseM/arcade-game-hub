import Phaser from "phaser";
import { gameState } from "../../core/state";
import { LEVEL_DEFS, MATERIAL_LABELS } from "../../data/gameData";

function makeButton(scene: Phaser.Scene, x: number, y: number, text: string, onClick: () => void): Phaser.GameObjects.Container {
  const bg = scene.add.rectangle(0, 0, 260, 42, 0x2a4d9e, 0.9).setStrokeStyle(1, 0x8bb8ff, 0.8);
  const label = scene.add.text(0, 0, text, {
    fontFamily: "Arial",
    fontSize: "18px",
    color: "#ffffff"
  }).setOrigin(0.5);

  const c = scene.add.container(x, y, [bg, label]).setSize(260, 42).setInteractive({ useHandCursor: true });

  c.on("pointerover", () => bg.setFillStyle(0x3f68ca, 1));
  c.on("pointerout", () => bg.setFillStyle(0x2a4d9e, 0.9));
  c.on("pointerdown", onClick);
  return c;
}

export class MainMenuScene extends Phaser.Scene {
  constructor() {
    super("MainMenuScene");
  }

  create(): void {
    const { width, height } = this.scale;

    this.cameras.main.setBackgroundColor(0x040a18);

    this.add.text(width * 0.5, 78, "ALIEN ARENA", {
      fontFamily: "Arial Black",
      fontSize: "52px",
      color: "#e8f1ff"
    }).setOrigin(0.5);

    this.add.text(width * 0.5, 130, "Phaser + TypeScript build", {
      fontFamily: "Arial",
      fontSize: "20px",
      color: "#9ab2e6"
    }).setOrigin(0.5);

    makeButton(this, width * 0.5, height * 0.52, "Continue Last Mission", () => {
      const unlocked = LEVEL_DEFS.filter(level => gameState.isUnlocked(level.id));
      const target = unlocked[unlocked.length - 1] || LEVEL_DEFS[0];
      gameState.selectedLevelId = target.id;
      this.scene.start("GameScene");
      this.scene.launch("UIScene");
    });

    makeButton(this, width * 0.5, height * 0.62, "Level Select", () => {
      this.scene.start("LevelSelectScene");
    });

    const save = gameState.saveData;
    this.add.text(70, height - 130, `Runs: ${save.stats.runsCompleted}`, {
      fontFamily: "Arial",
      fontSize: "20px",
      color: "#d9e8ff"
    });
    this.add.text(70, height - 100, `Total Kills: ${save.stats.totalKills}`, {
      fontFamily: "Arial",
      fontSize: "20px",
      color: "#d9e8ff"
    });
    this.add.text(70, height - 70, `Credits: ${save.credits}`, {
      fontFamily: "Arial",
      fontSize: "20px",
      color: "#d9e8ff"
    });

    const m = save.inventory.materials;
    this.add.text(width - 380, height - 95, `${MATERIAL_LABELS.scrap}: ${m.scrap}  ${MATERIAL_LABELS.alloy}: ${m.alloy}`, {
      fontFamily: "Arial",
      fontSize: "20px",
      color: "#b7ccf0"
    });
    this.add.text(width - 380, height - 65, `${MATERIAL_LABELS.core}: ${m.core}  ${MATERIAL_LABELS.quantum}: ${m.quantum}`, {
      fontFamily: "Arial",
      fontSize: "20px",
      color: "#b7ccf0"
    });
  }
}
