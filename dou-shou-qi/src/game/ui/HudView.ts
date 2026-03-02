import Phaser from 'phaser';
import { GameState, PlayerTurn } from '../../data/types';
import { NEUTRAL_COLORS, PlayerIdentity, getPlayerIdentity } from './theme';
import { formatTurnIndicator } from './turnIndicator';

const PLAYER_LABEL: Record<PlayerTurn, string> = {
  player1: 'Player 1',
  player2: 'Player 2'
};
const HUD_PANEL_WIDTH = 248;
const HUD_PANEL_HEIGHT = 50;

interface HudMeta {
  compact: boolean;
  mode: 'local' | 'online';
  localTurn: PlayerTurn;
  localName: string;
  remoteName: string;
  status: string;
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
      player1: this.createPanel(scene, 26, 18, 'player1'),
      player2: this.createPanel(scene, 726, 18, 'player2')
    };

    this.infoText = scene.add.text(26, 98, '', {
      fontFamily: 'Arial',
      fontSize: '14px',
      color: '#bcd1f6'
    });

    this.actionText = scene.add.text(26, 118, '', {
      fontFamily: 'Arial',
      fontSize: '14px',
      color: '#dbeafe',
      wordWrap: { width: 950 }
    });

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

  private createPanel(scene: Phaser.Scene, x: number, y: number, turn: PlayerTurn): PlayerPanel {
    const panelWidth = HUD_PANEL_WIDTH;
    const panelHeight = HUD_PANEL_HEIGHT;
    const bg = scene.add.rectangle(x, y, panelWidth, panelHeight, NEUTRAL_COLORS.panelBg, 0.94);
    bg.setOrigin(0);
    bg.setDepth(6);

    const border = scene.add.rectangle(x, y, panelWidth, panelHeight);
    border.setOrigin(0);
    border.setStrokeStyle(2, NEUTRAL_COLORS.panelBorder, 0.7);
    border.setDepth(7);

    const title = scene.add.text(x + 12, y + 7, PLAYER_LABEL[turn], {
      fontFamily: 'Arial',
      fontSize: '15px',
      color: NEUTRAL_COLORS.textPrimary
    });
    title.setDepth(8);

    const side = scene.add.text(x + 12, y + 27, '', {
      fontFamily: 'Arial',
      fontSize: '11px',
      color: NEUTRAL_COLORS.textSecondary
    });
    side.setDepth(8);

    const badge = scene.add.graphics();
    badge.setPosition(x + panelWidth - 20, y + 14);
    badge.setDepth(8);

    const turnCaret = scene.add.text(x + panelWidth - 30, y + 26, '>', {
      fontFamily: 'Arial',
      fontSize: '18px',
      color: '#facc15'
    });
    turnCaret.setDepth(8);

    return { bg, border, title, side, badge, turnCaret };
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
