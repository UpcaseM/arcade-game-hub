import Phaser from 'phaser';
import { GameState, PlayerTurn } from '../../data/types';
import { NEUTRAL_COLORS, PlayerIdentity, getPlayerIdentity } from './theme';
import { formatTurnIndicator } from './turnIndicator';

const PLAYER_LABEL: Record<PlayerTurn, string> = {
  player1: 'Player 1',
  player2: 'Player 2'
};

interface HudMeta {
  compact: boolean;
  mode: 'local' | 'online';
  localTurn: PlayerTurn;
  localName: string;
  remoteName: string;
  status: string;
}

export interface HudLayoutConfig {
  sceneWidth: number;
  sceneHeight: number;
  isMobile: boolean;
  sidePadding: number;
  boardTop: number;
  boardBottom: number;
}

interface PlayerPanel {
  bg: Phaser.GameObjects.Rectangle;
  border: Phaser.GameObjects.Rectangle;
  title: Phaser.GameObjects.Text;
  side: Phaser.GameObjects.Text;
  badge: Phaser.GameObjects.Graphics;
  turnCaret: Phaser.GameObjects.Text;
}

function drawPanelBadge(panel: PlayerPanel, identity: PlayerIdentity | undefined): void {
  panel.badge.clear();
  panel.badge.fillStyle(identity?.accentColor ?? 0x64748b, 1);
  if (identity?.badgeShape === 'diamond') {
    panel.badge.fillPoints([
      { x: 0, y: -7 },
      { x: 7, y: 0 },
      { x: 0, y: 7 },
      { x: -7, y: 0 }
    ], true);
    return;
  }
  panel.badge.fillCircle(0, 0, 6);
}

export class HudView {
  private readonly panels: Record<PlayerTurn, PlayerPanel>;
  private readonly infoText: Phaser.GameObjects.Text;
  private readonly actionText: Phaser.GameObjects.Text;
  private readonly chipBg: Phaser.GameObjects.Rectangle;
  private readonly chipText: Phaser.GameObjects.Text;
  private readonly chipBadge: Phaser.GameObjects.Graphics;

  constructor(scene: Phaser.Scene) {
    this.panels = {
      player1: this.createPanel(scene, 'player1'),
      player2: this.createPanel(scene, 'player2')
    };

    this.infoText = scene.add.text(26, 98, '', {
      fontFamily: 'Arial',
      fontSize: '14px',
      color: '#bcd1f6'
    });
    this.infoText.setDepth(6);

    this.actionText = scene.add.text(26, 118, '', {
      fontFamily: 'Arial',
      fontSize: '14px',
      color: '#dbeafe',
      wordWrap: { width: 950 }
    });
    this.actionText.setDepth(6);

    this.chipBg = scene.add.rectangle(500, 96, 300, 40, 0x111827, 0.96);
    this.chipBg.setStrokeStyle(2, 0x475569, 1);
    this.chipBg.setDepth(6);

    this.chipText = scene.add.text(500, 96, '', {
      fontFamily: 'Arial',
      fontSize: '15px',
      color: '#e2e8f0'
    });
    this.chipText.setOrigin(0.5);
    this.chipText.setDepth(7);

    this.chipBadge = scene.add.graphics();
    this.chipBadge.setPosition(356, 96);
    this.chipBadge.setDepth(7);
  }

  setLayout(layout: HudLayoutConfig): void {
    const isMobile = layout.isMobile;
    const panelHeight = isMobile ? 42 : 50;
    const panelWidth = isMobile
      ? Math.max(120, Math.floor((layout.sceneWidth - layout.sidePadding * 3) / 2))
      : 248;

    const panelY = isMobile ? Math.max(8, Math.round(layout.sidePadding * 0.8)) : 18;
    const leftX = isMobile ? layout.sidePadding : 26;
    const rightX = isMobile ? layout.sceneWidth - layout.sidePadding - panelWidth : layout.sceneWidth - 26 - panelWidth;

    this.layoutPanel(this.panels.player1, leftX, panelY, panelWidth, panelHeight, isMobile);
    this.layoutPanel(this.panels.player2, rightX, panelY, panelWidth, panelHeight, isMobile);

    const chipWidth = isMobile
      ? Math.max(168, layout.sceneWidth - layout.sidePadding * 2)
      : Math.min(330, Math.max(280, Math.floor(layout.sceneWidth * 0.34)));
    const chipHeight = isMobile ? 32 : 40;
    const chipX = layout.sceneWidth / 2;
    const chipY = isMobile ? panelY + panelHeight + 18 : 96;

    this.chipBg.setPosition(chipX, chipY);
    this.chipBg.setDisplaySize(chipWidth, chipHeight);
    this.chipText.setPosition(chipX, chipY);
    this.chipText.setFontSize(isMobile ? 13 : 15);
    this.chipBadge.setPosition(chipX - chipWidth / 2 + 18, chipY);

    const infoX = layout.sidePadding;
    const infoY = isMobile ? chipY + 18 : 98;
    const infoWrap = isMobile ? layout.sceneWidth - layout.sidePadding * 2 : Math.max(320, layout.sceneWidth - 52);
    const showInfo = !isMobile || layout.sceneHeight >= 560;

    this.infoText.setVisible(showInfo);
    this.infoText.setPosition(infoX, infoY);
    this.infoText.setFontSize(isMobile ? 12 : 14);
    this.infoText.setWordWrapWidth(infoWrap);

    const actionX = layout.sidePadding;
    const actionY = isMobile
      ? Math.max(infoY + (showInfo ? 20 : 0), Math.min(layout.sceneHeight - 54, layout.boardBottom + 10))
      : 118;
    const actionWrap = isMobile ? layout.sceneWidth - layout.sidePadding * 2 : Math.max(320, layout.sceneWidth - 52);

    this.actionText.setPosition(actionX, actionY);
    this.actionText.setFontSize(isMobile ? 13 : 14);
    this.actionText.setWordWrapWidth(actionWrap);
  }

  update(gameState: GameState, meta: HudMeta): void {
    (['player1', 'player2'] as const).forEach((turn) => {
      const panel = this.panels[turn];
      const color = gameState.playerColors[turn];
      const identity = color ? getPlayerIdentity(color) : undefined;
      const isActive = gameState.currentTurn === turn;

      panel.bg.setFillStyle(isActive ? 0x1e293b : NEUTRAL_COLORS.panelBg, 0.94);
      panel.border.setStrokeStyle(2, identity?.primaryColor ?? NEUTRAL_COLORS.panelBorder, isActive ? 1 : 0.7);

      const name = meta.mode === 'online'
        ? (turn === meta.localTurn ? `${meta.localName} (You)` : meta.remoteName)
        : PLAYER_LABEL[turn];

      panel.title.setText(name);
      panel.side.setText(identity ? `${identity.shortLabel} ${identity.label}` : 'Unassigned');
      panel.side.setColor(identity?.textColor ?? NEUTRAL_COLORS.textSecondary);
      drawPanelBadge(panel, identity);
      panel.turnCaret.setVisible(isActive);
    });

    const blueLeft = Object.values(gameState.animals).filter((animal) => animal.color === 'blue' && !animal.hidden).length;
    const redLeft = Object.values(gameState.animals).filter((animal) => animal.color === 'red' && !animal.hidden).length;
    const hiddenLeft = Object.values(gameState.animals).filter((animal) => animal.hidden).length;

    this.infoText.setText(`Online: ${meta.status} | Blue ${blueLeft} | Red ${redLeft} | Hidden ${hiddenLeft}`);
    this.actionText.setText(gameState.lastAction ?? 'Flip to reveal information and claim a side.');

    const currentColor = gameState.playerColors[gameState.currentTurn];
    const currentIdentity = currentColor ? getPlayerIdentity(currentColor) : undefined;
    this.chipText.setText(formatTurnIndicator(gameState, {
      mode: meta.mode,
      localTurn: meta.localTurn,
      localName: meta.localName,
      remoteName: meta.remoteName
    }));
    this.chipBg.setStrokeStyle(2, currentIdentity?.primaryColor ?? 0x475569, 1);
    this.drawChipBadge(currentIdentity);
  }

  pulseTurnChip(scene: Phaser.Scene, reducedMotion: boolean): void {
    if (reducedMotion) {
      return;
    }
    this.chipBg.setScale(1);
    scene.tweens.add({
      targets: this.chipBg,
      scaleX: 1.04,
      scaleY: 1.04,
      duration: 120,
      yoyo: true,
      ease: 'Sine.easeOut'
    });
  }

  private createPanel(scene: Phaser.Scene, turn: PlayerTurn): PlayerPanel {
    const bg = scene.add.rectangle(0, 0, 248, 50, NEUTRAL_COLORS.panelBg, 0.94);
    bg.setOrigin(0);
    bg.setDepth(6);

    const border = scene.add.rectangle(0, 0, 248, 50);
    border.setOrigin(0);
    border.setStrokeStyle(2, NEUTRAL_COLORS.panelBorder, 0.7);
    border.setDepth(7);

    const title = scene.add.text(12, 7, PLAYER_LABEL[turn], {
      fontFamily: 'Arial',
      fontSize: '15px',
      color: NEUTRAL_COLORS.textPrimary
    });
    title.setDepth(8);

    const side = scene.add.text(12, 27, '', {
      fontFamily: 'Arial',
      fontSize: '11px',
      color: NEUTRAL_COLORS.textSecondary
    });
    side.setDepth(8);

    const badge = scene.add.graphics();
    badge.setPosition(228, 14);
    badge.setDepth(8);

    const turnCaret = scene.add.text(218, 26, '>', {
      fontFamily: 'Arial',
      fontSize: '18px',
      color: '#facc15'
    });
    turnCaret.setDepth(8);

    return { bg, border, title, side, badge, turnCaret };
  }

  private layoutPanel(
    panel: PlayerPanel,
    x: number,
    y: number,
    width: number,
    height: number,
    isMobile: boolean
  ): void {
    panel.bg.setPosition(x, y);
    panel.bg.setDisplaySize(width, height);

    panel.border.setPosition(x, y);
    panel.border.setDisplaySize(width, height);

    panel.title.setPosition(x + 10, y + (isMobile ? 5 : 7));
    panel.title.setFontSize(isMobile ? 13 : 15);

    panel.side.setPosition(x + 10, y + height - (isMobile ? 14 : 23));
    panel.side.setFontSize(isMobile ? 10 : 11);

    panel.badge.setPosition(x + width - 16, y + (isMobile ? 12 : 14));
    panel.turnCaret.setPosition(x + width - 24, y + height - (isMobile ? 19 : 24));
    panel.turnCaret.setFontSize(isMobile ? 16 : 18);
  }

  private drawChipBadge(identity: PlayerIdentity | undefined): void {
    this.chipBadge.clear();
    this.chipBadge.fillStyle(identity?.primaryColor ?? 0x94a3b8, 1);
    if (identity?.badgeShape === 'diamond') {
      this.chipBadge.fillPoints([
        { x: 0, y: -8 },
        { x: 8, y: 0 },
        { x: 0, y: 8 },
        { x: -8, y: 0 }
      ], true);
      return;
    }
    this.chipBadge.fillCircle(0, 0, 7);
  }
}
