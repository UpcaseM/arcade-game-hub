import Phaser from 'phaser';
import { ANIMAL_SYMBOLS } from '../../data/gameData';
import { Animal } from '../../data/types';
import { BadgeShape, NEUTRAL_COLORS, PlayerIdentity, PatternStyle } from './theme';

const PIECE_SIZE = 78;
const PIECE_BORDER = 3;

function drawBadge(g: Phaser.GameObjects.Graphics, shape: BadgeShape, color: number): void {
  g.clear();
  g.fillStyle(color, 1);
  if (shape === 'circle') {
    g.fillCircle(0, 0, 7);
  } else {
    g.fillPoints([
      { x: 0, y: -8 },
      { x: 8, y: 0 },
      { x: 0, y: 8 },
      { x: -8, y: 0 }
    ], true);
  }
}

function drawPattern(g: Phaser.GameObjects.Graphics, style: PatternStyle, color: number): void {
  g.clear();
  g.lineStyle(1, color, 0.28);
  if (style === 'dots') {
    for (let x = -24; x <= 24; x += 12) {
      for (let y = -24; y <= 24; y += 12) {
        g.fillStyle(color, 0.18);
        g.fillCircle(x, y, 1.8);
      }
    }
    return;
  }

  for (let i = -40; i <= 40; i += 8) {
    g.lineBetween(-32, i, i, -32);
    g.lineBetween(i, 32, 32, i);
  }
}

export class PieceView {
  readonly id: string;
  readonly container: Phaser.GameObjects.Container;

  private readonly frame: Phaser.GameObjects.Rectangle;
  private readonly pattern: Phaser.GameObjects.Graphics;
  private readonly symbol: Phaser.GameObjects.Text;
  private readonly badge: Phaser.GameObjects.Graphics;
  private readonly selectionRing: Phaser.GameObjects.Ellipse;
  private readonly hiddenMark: Phaser.GameObjects.Text;

  constructor(scene: Phaser.Scene, animal: Animal, x: number, y: number) {
    this.id = animal.id;
    this.container = scene.add.container(x, y);

    this.frame = scene.add.rectangle(0, 0, PIECE_SIZE, PIECE_SIZE, NEUTRAL_COLORS.hiddenPieceBg, 1);
    this.frame.setStrokeStyle(PIECE_BORDER, 0x64748b, 1);

    this.pattern = scene.add.graphics();

    this.symbol = scene.add.text(0, 0, '', {
      fontFamily: 'Arial',
      fontSize: '33px',
      color: '#f8fafc'
    });
    this.symbol.setOrigin(0.5);

    this.hiddenMark = scene.add.text(0, 1, '◆', {
      fontFamily: 'Arial',
      fontSize: '34px',
      color: NEUTRAL_COLORS.hiddenPieceText
    });
    this.hiddenMark.setOrigin(0.5);

    this.badge = scene.add.graphics();
    this.badge.setPosition(24, -24);

    this.selectionRing = scene.add.ellipse(0, 0, PIECE_SIZE + 14, PIECE_SIZE + 14);
    this.selectionRing.setStrokeStyle(2, 0xfacc15, 1);
    this.selectionRing.setVisible(false);

    this.container.add([
      this.selectionRing,
      this.frame,
      this.pattern,
      this.symbol,
      this.hiddenMark,
      this.badge
    ]);
    this.container.setDepth(4);
  }

  setPosition(x: number, y: number): void {
    this.container.setPosition(x, y);
  }

  getPosition(): { x: number; y: number } {
    return { x: this.container.x, y: this.container.y };
  }

  setSelected(selected: boolean): void {
    this.selectionRing.setVisible(selected);
  }

  setAlpha(alpha: number): void {
    this.container.setAlpha(alpha);
  }

  setScale(scale: number): void {
    this.container.setScale(scale);
  }

  setVisible(visible: boolean): void {
    this.container.setVisible(visible);
  }

  updateFromAnimal(animal: Animal, identity: PlayerIdentity | undefined, colorAssist: boolean): void {
    if (animal.hidden || !identity) {
      this.frame.setFillStyle(NEUTRAL_COLORS.hiddenPieceBg, 1);
      this.frame.setStrokeStyle(PIECE_BORDER, 0x64748b, 1);
      this.hiddenMark.setVisible(true);
      this.symbol.setVisible(false);
      this.badge.setVisible(false);
      this.pattern.clear();
      return;
    }

    this.hiddenMark.setVisible(false);
    this.symbol.setVisible(true);
    this.symbol.setText(ANIMAL_SYMBOLS[animal.name] ?? '?');
    this.symbol.setColor(identity.textColor);

    this.frame.setFillStyle(0x0f172a, 1);
    this.frame.setStrokeStyle(PIECE_BORDER, identity.primaryColor, 1);

    drawBadge(this.badge, identity.badgeShape, identity.accentColor);
    this.badge.setVisible(true);

    if (colorAssist) {
      drawPattern(this.pattern, identity.pattern, identity.primaryColor);
    } else {
      this.pattern.clear();
    }
  }

  destroy(): void {
    this.container.destroy(true);
  }
}
