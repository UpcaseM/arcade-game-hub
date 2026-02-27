import Phaser from "phaser";
import "./styles.css";
import { gameState } from "./core/state";
import { createBrowserSaveService } from "./core/save";
import { BootScene } from "./game/scenes/BootScene";
import { PreloadScene } from "./game/scenes/PreloadScene";
import { MainMenuScene } from "./game/scenes/MainMenuScene";
import { LevelSelectScene } from "./game/scenes/LevelSelectScene";
import { GameScene } from "./game/scenes/GameScene";
import { UIScene } from "./game/scenes/UIScene";
import { DomPanels } from "./game/ui/DomPanels";

const saveService = createBrowserSaveService();
const saveData = saveService.load();

gameState.attachSaveService(saveService);
gameState.setSave(saveData);

const config: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  parent: "app",
  backgroundColor: "#040914",
  width: 1280,
  height: 720,
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH
  },
  physics: {
    default: "arcade",
    arcade: {
      gravity: { y: 0, x: 0 },
      debug: false
    }
  },
  scene: [BootScene, PreloadScene, MainMenuScene, LevelSelectScene, GameScene, UIScene]
};

const game = new Phaser.Game(config);
const panels = new DomPanels(game.events);

window.addEventListener("beforeunload", () => {
  panels.destroy();
  game.destroy(true);
});
