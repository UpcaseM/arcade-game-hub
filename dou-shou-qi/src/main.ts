import Phaser from "phaser";
import { DouShouQiPreloadScene } from "./game/scenes/PreloadScene";
import { DouShouQiMainMenuScene } from "./game/scenes/MainMenuScene";
import { DouShouQiGameScene } from "./game/scenes/GameScene";
import { DouShouQiTutorialScene } from "./game/scenes/TutorialScene";

const config: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  width: 1000,
  height: 650,
  parent: "game-container",
  scene: [
    DouShouQiPreloadScene,
    DouShouQiMainMenuScene,
    DouShouQiGameScene,
    DouShouQiTutorialScene
  ],
  physics: {
    default: "arcade",
    arcade: {
      gravity: { x: 0, y: 0 },
      debug: false
    }
  },
  input: {
    activePointers: 1
  }
};

export class DouShouQiGame extends Phaser.Game {
  constructor(config: Phaser.Types.Core.GameConfig) {
    super(config);
  }
}

let gameInstance: DouShouQiGame | null = null;

function bootDouShouQi() {
  if (gameInstance || !document.getElementById("game-container")) {
    return;
  }

  gameInstance = new DouShouQiGame(config);
}

if (document.readyState === "loading") {
  window.addEventListener("DOMContentLoaded", bootDouShouQi, { once: true });
} else {
  bootDouShouQi();
}
