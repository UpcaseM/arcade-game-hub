import Phaser from "phaser";
import { gameState } from "../../core/state";
import { LEVEL_DEFS } from "../../data/gameData";

export class LevelSelectScene extends Phaser.Scene {
  constructor() {
    super("LevelSelectScene");
  }

  create(): void {
    const { width } = this.scale;
    this.cameras.main.setBackgroundColor(0x07152b);

    this.add.text(width * 0.5, 62, "Level Select", {
      fontFamily: "Arial Black",
      fontSize: "44px",
      color: "#e8f2ff"
    }).setOrigin(0.5);

    this.add.text(width * 0.5, 108, "Complete each mission to unlock the next sector.", {
      fontFamily: "Arial",
      fontSize: "20px",
      color: "#9cb7e8"
    }).setOrigin(0.5);

    const startY = 170;
    const cardW = 520;
    const cardH = 92;

    for (let index = 0; index < LEVEL_DEFS.length; index += 1) {
      const level = LEVEL_DEFS[index];
      const unlocked = gameState.isUnlocked(level.id);
      const x = width * 0.5;
      const y = startY + index * (cardH + 14);

      const bg = this.add.rectangle(x, y, cardW, cardH, unlocked ? 0x173567 : 0x26334f, unlocked ? 0.94 : 0.5)
        .setStrokeStyle(1, unlocked ? 0x89b6ff : 0x5f6a81, 0.85)
        .setInteractive({ useHandCursor: unlocked });

      this.add.text(x - cardW * 0.45, y - 28, `${index + 1}. ${level.name}`, {
        fontFamily: "Arial",
        fontSize: "24px",
        color: unlocked ? "#f1f6ff" : "#8a93a5"
      });
      this.add.text(x - cardW * 0.45, y + 2, level.description, {
        fontFamily: "Arial",
        fontSize: "16px",
        color: unlocked ? "#b5caee" : "#6f7480"
      });
      this.add.text(x + cardW * 0.2, y + 22, unlocked ? `Target ${level.killTarget} | ${level.durationSec}s` : "Locked", {
        fontFamily: "Arial",
        fontSize: "16px",
        color: unlocked ? "#d6e7ff" : "#6f7480"
      });

      if (unlocked) {
        bg.on("pointerdown", () => {
          gameState.selectedLevelId = level.id;
          this.scene.start("GameScene");
        });
      }
    }

    const backBtn = this.add.rectangle(120, 50, 180, 42, 0x2a4d9e, 0.9)
      .setStrokeStyle(1, 0x8bb8ff, 0.8)
      .setInteractive({ useHandCursor: true });
    this.add.text(120, 50, "Back", {
      fontFamily: "Arial",
      fontSize: "20px",
      color: "#ffffff"
    }).setOrigin(0.5);

    backBtn.on("pointerdown", () => {
      this.scene.start("MainMenuScene");
    });
  }
}
