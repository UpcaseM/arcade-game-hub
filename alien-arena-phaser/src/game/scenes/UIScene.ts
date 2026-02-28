import Phaser from "phaser";
import {
  EVENT_COMMAND_PAUSE_EXIT,
  EVENT_COMMAND_PAUSE_MAIN_MENU,
  EVENT_COMMAND_PAUSE_RESUME,
  EVENT_COMMAND_RESULT_LEVELS,
  EVENT_COMMAND_RESULT_MAIN_MENU,
  EVENT_COMMAND_RESULT_NEXT,
  EVENT_COMMAND_UPGRADE_PICK,
  EVENT_HIDE_RESULT,
  EVENT_HIDE_UPGRADE,
  EVENT_HUD_UPDATE,
  EVENT_PAUSE_SET,
  EVENT_SHOW_RESULT,
  EVENT_SHOW_UPGRADE
} from "../events";
import { getUpgradeVisual } from "../upgradeVisuals";

interface HudPayload {
  hp: number;
  maxHp: number;
  xp: number;
  xpToNext: number;
  level: number;
  kills: number;
  timeText: string;
  weaponName: string;
  weaponStatsText: string;
  ammoText: string;
  reloadText: string;
  missionText: string;
  objectiveText: string;
  creditsText: string;
  perkText: string;
}

interface UpgradeOption {
  id: string;
  name: string;
  description: string;
}

interface ResultPayload {
  title: string;
  summary: string;
  hasNext: boolean;
}

function makeButton(
  scene: Phaser.Scene,
  x: number,
  y: number,
  width: number,
  height: number,
  label: string,
  onClick: () => void,
  secondary = false
): Phaser.GameObjects.Container {
  const bg = scene.add
    .rectangle(0, 0, width, height, secondary ? 0x38537f : 0x3a6cd6, 0.95)
    .setStrokeStyle(1, 0xa9c8ff, 0.8);
  const text = scene.add
    .text(0, 0, label, {
      fontFamily: "Arial",
      fontSize: "20px",
      color: "#ffffff"
    })
    .setOrigin(0.5);

  const container = scene.add.container(x, y, [bg, text]).setSize(width, height).setInteractive({ useHandCursor: true });
  container.on("pointerover", () => bg.setFillStyle(secondary ? 0x4a6899 : 0x4f82ef, 1));
  container.on("pointerout", () => bg.setFillStyle(secondary ? 0x38537f : 0x3a6cd6, 0.95));
  container.on("pointerdown", onClick);
  return container;
}

export class UIScene extends Phaser.Scene {
  private hudTitle!: Phaser.GameObjects.Text;
  private hudMain!: Phaser.GameObjects.Text;
  private hudWeapon!: Phaser.GameObjects.Text;

  private pauseOverlay!: Phaser.GameObjects.Container;
  private upgradeOverlay!: Phaser.GameObjects.Container;
  private resultOverlay!: Phaser.GameObjects.Container;

  private upgradeCardContainer!: Phaser.GameObjects.Container;
  private resultTitle!: Phaser.GameObjects.Text;
  private resultSummary!: Phaser.GameObjects.Text;
  private resultNextBtn!: Phaser.GameObjects.Container;

  constructor() {
    super("UIScene");
  }

  create(): void {
    this.createHud();
    this.createPauseOverlay();
    this.createUpgradeOverlay();
    this.createResultOverlay();

    const events = this.game.events;
    events.on(EVENT_HUD_UPDATE, this.onHudUpdate, this);
    events.on(EVENT_PAUSE_SET, this.onPauseSet, this);
    events.on(EVENT_SHOW_UPGRADE, this.onShowUpgrade, this);
    events.on(EVENT_HIDE_UPGRADE, this.onHideUpgrade, this);
    events.on(EVENT_SHOW_RESULT, this.onShowResult, this);
    events.on(EVENT_HIDE_RESULT, this.onHideResult, this);

    this.events.on(Phaser.Scenes.Events.SHUTDOWN, () => {
      events.off(EVENT_HUD_UPDATE, this.onHudUpdate, this);
      events.off(EVENT_PAUSE_SET, this.onPauseSet, this);
      events.off(EVENT_SHOW_UPGRADE, this.onShowUpgrade, this);
      events.off(EVENT_HIDE_UPGRADE, this.onHideUpgrade, this);
      events.off(EVENT_SHOW_RESULT, this.onShowResult, this);
      events.off(EVENT_HIDE_RESULT, this.onHideResult, this);
    });
  }

  private createHud(): void {
    this.hudTitle = this.add.text(16, 12, "Mission", {
      fontFamily: "Arial",
      fontSize: "20px",
      color: "#e9f2ff",
      backgroundColor: "rgba(8, 17, 38, 0.65)"
    });

    this.hudMain = this.add.text(16, 44, "-", {
      fontFamily: "Arial",
      fontSize: "18px",
      color: "#cbddff",
      backgroundColor: "rgba(8, 17, 38, 0.65)",
      lineSpacing: 6
    });

    this.hudWeapon = this.add.text(this.scale.width - 16, 12, "Weapon", {
      fontFamily: "Arial",
      fontSize: "18px",
      color: "#dcf5ff",
      backgroundColor: "rgba(8, 17, 38, 0.65)",
      align: "right"
    }).setOrigin(1, 0);
  }

  private createPauseOverlay(): void {
    const dim = this.add.rectangle(this.scale.width * 0.5, this.scale.height * 0.5, this.scale.width, this.scale.height, 0x01050f, 0.66);
    const panel = this.add.rectangle(this.scale.width * 0.5, this.scale.height * 0.5, 460, 340, 0x0f1f43, 0.96)
      .setStrokeStyle(1, 0x8db8ff, 0.8);

    const title = this.add.text(this.scale.width * 0.5, this.scale.height * 0.5 - 92, "Paused", {
      fontFamily: "Arial Black",
      fontSize: "44px",
      color: "#f5f9ff"
    }).setOrigin(0.5);

    const desc = this.add.text(this.scale.width * 0.5, this.scale.height * 0.5 - 40, "ESC resume | I inventory | C crafting", {
      fontFamily: "Arial",
      fontSize: "20px",
      color: "#b6c9ec"
    }).setOrigin(0.5);

    const resume = makeButton(this, this.scale.width * 0.5, this.scale.height * 0.5 + 6, 220, 44, "Resume", () => {
      this.game.events.emit(EVENT_COMMAND_PAUSE_RESUME);
    });

    const exit = makeButton(this, this.scale.width * 0.5, this.scale.height * 0.5 + 62, 220, 44, "Back to Levels", () => {
      this.game.events.emit(EVENT_COMMAND_PAUSE_EXIT);
    }, true);

    const menu = makeButton(this, this.scale.width * 0.5, this.scale.height * 0.5 + 118, 220, 44, "Main Menu", () => {
      this.game.events.emit(EVENT_COMMAND_PAUSE_MAIN_MENU);
    }, true);

    this.pauseOverlay = this.add.container(0, 0, [dim, panel, title, desc, resume, exit, menu]);
    this.pauseOverlay.setVisible(false);
  }

  private createUpgradeOverlay(): void {
    const dim = this.add.rectangle(this.scale.width * 0.5, this.scale.height * 0.5, this.scale.width, this.scale.height, 0x01050f, 0.72);
    const panel = this.add.rectangle(this.scale.width * 0.5, this.scale.height * 0.5, 980, 400, 0x0e1f3f, 0.98)
      .setStrokeStyle(1, 0x8cb8ff, 0.8);
    const title = this.add.text(this.scale.width * 0.5, this.scale.height * 0.5 - 162, "Choose Upgrade", {
      fontFamily: "Arial Black",
      fontSize: "40px",
      color: "#f1f7ff"
    }).setOrigin(0.5);

    this.upgradeCardContainer = this.add.container(0, 0);

    this.upgradeOverlay = this.add.container(0, 0, [dim, panel, title, this.upgradeCardContainer]);
    this.upgradeOverlay.setVisible(false);
  }

  private createResultOverlay(): void {
    const dim = this.add.rectangle(this.scale.width * 0.5, this.scale.height * 0.5, this.scale.width, this.scale.height, 0x01050f, 0.72);
    const panel = this.add.rectangle(this.scale.width * 0.5, this.scale.height * 0.5, 680, 420, 0x0e1f3f, 0.98)
      .setStrokeStyle(1, 0x8cb8ff, 0.8);

    this.resultTitle = this.add.text(this.scale.width * 0.5, this.scale.height * 0.5 - 110, "Mission Complete", {
      fontFamily: "Arial Black",
      fontSize: "42px",
      color: "#f1f7ff"
    }).setOrigin(0.5);

    this.resultSummary = this.add.text(this.scale.width * 0.5, this.scale.height * 0.5 - 28, "", {
      fontFamily: "Arial",
      fontSize: "22px",
      color: "#c3d8ff",
      align: "center",
      wordWrap: { width: 560 }
    }).setOrigin(0.5);

    this.resultNextBtn = makeButton(this, this.scale.width * 0.5, this.scale.height * 0.5 + 68, 240, 46, "Next Mission", () => {
      this.game.events.emit(EVENT_COMMAND_RESULT_NEXT);
    });

    const toLevels = makeButton(this, this.scale.width * 0.5, this.scale.height * 0.5 + 126, 240, 46, "Back to Levels", () => {
      this.game.events.emit(EVENT_COMMAND_RESULT_LEVELS);
    }, true);

    const toMenu = makeButton(this, this.scale.width * 0.5, this.scale.height * 0.5 + 184, 240, 46, "Main Menu", () => {
      this.game.events.emit(EVENT_COMMAND_RESULT_MAIN_MENU);
    }, true);

    this.resultOverlay = this.add.container(0, 0, [dim, panel, this.resultTitle, this.resultSummary, this.resultNextBtn, toLevels, toMenu]);
    this.resultOverlay.setVisible(false);
  }

  private onHudUpdate(payload: HudPayload): void {
    this.hudTitle.setText(`${payload.missionText} | ${payload.objectiveText}`);
    this.hudMain.setText(
      `HP ${Math.ceil(payload.hp)}/${Math.ceil(payload.maxHp)}\nXP ${Math.floor(payload.xp)}/${payload.xpToNext}  Lv ${payload.level}\nKills ${payload.kills}  Time ${payload.timeText}  Credits ${payload.creditsText}`
    );

    this.hudWeapon.setText(
      `${payload.weaponName}\n${payload.weaponStatsText}\n${payload.ammoText}\n${payload.reloadText}\n${payload.perkText}`
    );
  }

  private onPauseSet(isPaused: boolean): void {
    this.pauseOverlay.setVisible(isPaused);
  }

  private onShowUpgrade(options: UpgradeOption[]): void {
    this.upgradeCardContainer.removeAll(true);

    const startX = this.scale.width * 0.5 - 300;

    for (let index = 0; index < options.length; index += 1) {
      const option = options[index];
      const x = startX + index * 300;
      const y = this.scale.height * 0.5 + 10;
      const visual = getUpgradeVisual(option.id);

      const cardBg = this.add.rectangle(x, y, 270, 230, visual.cardBg, 0.98).setStrokeStyle(1, visual.cardStroke, 0.88);
      const iconBg = this.add.circle(x, y - 96, 26, 0x0b1934, 0.84).setStrokeStyle(1, visual.cardStroke, 0.9);
      const icon = this.add.image(x, y - 96, visual.iconKey).setDisplaySize(26, 26).setTint(visual.tint).setAlpha(0.95);
      const chip = this.add.text(x, y - 126, visual.chipLabel, {
        fontFamily: "Arial Black",
        fontSize: "12px",
        color: "#e8f4ff"
      }).setOrigin(0.5);
      const title = this.add.text(x, y - 78, option.name, {
        fontFamily: "Arial",
        fontSize: "24px",
        color: "#f3f8ff",
        wordWrap: { width: 238 }
      }).setOrigin(0.5);
      const desc = this.add.text(x, y - 20, option.description, {
        fontFamily: "Arial",
        fontSize: "18px",
        color: "#c3d8ff",
        align: "center",
        wordWrap: { width: 230 }
      }).setOrigin(0.5);

      const btn = makeButton(this, x, y + 72, 170, 40, "Select", () => {
        this.game.events.emit(EVENT_COMMAND_UPGRADE_PICK, option.id);
      });

      this.upgradeCardContainer.add([cardBg, iconBg, icon, chip, title, desc, btn]);
    }

    this.upgradeOverlay.setVisible(true);
  }

  private onHideUpgrade(): void {
    this.upgradeOverlay.setVisible(false);
  }

  private onShowResult(payload: ResultPayload): void {
    this.resultTitle.setText(payload.title);
    this.resultSummary.setText(payload.summary);
    this.resultNextBtn.setVisible(payload.hasNext);
    this.resultOverlay.setVisible(true);
  }

  private onHideResult(): void {
    this.resultOverlay.setVisible(false);
  }
}
