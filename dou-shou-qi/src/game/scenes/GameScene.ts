import Phaser from 'phaser';
import {
  ANIMAL_SYMBOLS,
  BOARD_COLS,
  BOARD_OFFSET_X,
  BOARD_OFFSET_Y,
  BOARD_ROWS,
  CELL_SIZE,
  createInitialGameState,
  flipAnimal,
  getAnimalAtCell,
  getCurrentPlayerColor,
  getValidMoves,
  isOwnedByCurrentTurn,
  moveAnimal
} from '../../data/gameData';
import { Animal, GameState } from '../../data/types';

const COLOR_HEX = {
  blue: '#60a5fa',
  red: '#f87171'
} as const;

const PLAYER_LABEL = {
  player1: 'Player 1',
  player2: 'Player 2'
} as const;

export class DouShouQiGameScene extends Phaser.Scene {
  private gameState!: GameState;
  private boardGraphics!: Phaser.GameObjects.Graphics;
  private pieceSprites: Map<string, Phaser.GameObjects.Text> = new Map();
  private highlightRects: Phaser.GameObjects.Rectangle[] = [];

  private turnText!: Phaser.GameObjects.Text;
  private roleText!: Phaser.GameObjects.Text;
  private infoText!: Phaser.GameObjects.Text;
  private actionText!: Phaser.GameObjects.Text;

  constructor() {
    super('DouShouQiGameScene');
  }

  init(): void {
    this.gameState = createInitialGameState();
  }

  create(): void {
    this.createBoard();
    this.createUI();
    this.renderPieces();
    this.renderHud();
    this.setupInput();
  }

  private createBoard(): void {
    this.boardGraphics = this.add.graphics();

    const width = BOARD_COLS * CELL_SIZE;
    const height = BOARD_ROWS * CELL_SIZE;

    this.boardGraphics.fillStyle(0x0b1220, 1);
    this.boardGraphics.fillRect(BOARD_OFFSET_X, BOARD_OFFSET_Y, width, height);

    this.boardGraphics.lineStyle(3, 0x334155, 1);
    this.boardGraphics.strokeRect(BOARD_OFFSET_X, BOARD_OFFSET_Y, width, height);

    this.boardGraphics.lineStyle(2, 0x1e293b, 1);
    for (let r = 1; r < BOARD_ROWS; r += 1) {
      const y = BOARD_OFFSET_Y + r * CELL_SIZE;
      this.boardGraphics.lineBetween(BOARD_OFFSET_X, y, BOARD_OFFSET_X + width, y);
    }
    for (let c = 1; c < BOARD_COLS; c += 1) {
      const x = BOARD_OFFSET_X + c * CELL_SIZE;
      this.boardGraphics.lineBetween(x, BOARD_OFFSET_Y, x, BOARD_OFFSET_Y + height);
    }
  }

  private createUI(): void {
    this.turnText = this.add.text(24, 24, '', {
      fontSize: '22px',
      color: '#e2e8f0',
      fontFamily: 'Arial'
    });

    this.roleText = this.add.text(24, 56, '', {
      fontSize: '18px',
      color: '#94a3b8',
      fontFamily: 'Arial'
    });

    this.infoText = this.add.text(24, 86, '', {
      fontSize: '16px',
      color: '#cbd5e1',
      fontFamily: 'Arial'
    });

    this.actionText = this.add.text(24, 116, '', {
      fontSize: '15px',
      color: '#93c5fd',
      fontFamily: 'Arial'
    });

    const backButton = this.add.text(24, 640, '← Back to Menu', {
      fontSize: '20px',
      color: '#3b82f6',
      fontFamily: 'Arial'
    });
    backButton.setInteractive({ useHandCursor: true });
    backButton.on('pointerdown', () => this.scene.start('DouShouQiMainMenuScene'));
  }

  private setupInput(): void {
    this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      if (this.gameState.status !== 'playing') {
        return;
      }

      const col = Math.floor((pointer.x - BOARD_OFFSET_X) / CELL_SIZE);
      const row = Math.floor((pointer.y - BOARD_OFFSET_Y) / CELL_SIZE);
      if (col < 0 || col >= BOARD_COLS || row < 0 || row >= BOARD_ROWS) {
        return;
      }

      this.handleCellTap(col, row);
    });
  }

  private handleCellTap(col: number, row: number): void {
    const piece = getAnimalAtCell(this.gameState, col, row);

    if (piece?.hidden) {
      this.handleFlip(piece);
      return;
    }

    const selectedId = this.gameState.selectedAnimalId;
    const selectedPiece = selectedId ? this.gameState.animals[selectedId] : undefined;

    if (selectedPiece) {
      if (piece?.id === selectedPiece.id) {
        this.clearSelection();
        return;
      }

      const moved = this.handleMove(selectedPiece, col, row);
      if (moved) {
        return;
      }

      if (piece && isOwnedByCurrentTurn(this.gameState, piece)) {
        this.selectPiece(piece);
      } else {
        this.clearSelection();
      }
      return;
    }

    if (piece && isOwnedByCurrentTurn(this.gameState, piece)) {
      this.selectPiece(piece);
    }
  }

  private handleFlip(piece: Animal): void {
    const result = flipAnimal(this.gameState, piece.id);
    if (!result.success) {
      this.gameState.lastAction = result.reason;
      this.renderHud();
      return;
    }

    this.clearSelection();
    this.renderPieces();
    this.renderHud();

    if (result.winStatus && result.winStatus !== 'playing') {
      this.showResult();
    }
  }

  private handleMove(selectedPiece: Animal, targetCol: number, targetRow: number): boolean {
    const result = moveAnimal(this.gameState, selectedPiece.id, targetCol, targetRow);
    if (!result.success) {
      return false;
    }

    this.clearSelection();
    this.renderPieces();
    this.renderHud();

    if (result.winStatus && result.winStatus !== 'playing') {
      this.showResult();
    }

    return true;
  }

  private selectPiece(piece: Animal): void {
    this.gameState.selectedAnimalId = piece.id;
    this.gameState.validMoves = getValidMoves(this.gameState, piece);
    this.renderPieces();
    this.renderHighlights();
  }

  private clearSelection(): void {
    this.gameState.selectedAnimalId = undefined;
    this.gameState.validMoves = undefined;
    this.clearHighlights();
    this.renderPieces();
    this.renderHud();
  }

  private clearHighlights(): void {
    this.highlightRects.forEach((rect) => rect.destroy());
    this.highlightRects = [];
  }

  private renderHighlights(): void {
    this.clearHighlights();
    const moves = this.gameState.validMoves ?? [];

    moves.forEach(({ col, row }) => {
      const rect = this.add.rectangle(
        BOARD_OFFSET_X + col * CELL_SIZE + CELL_SIZE / 2,
        BOARD_OFFSET_Y + row * CELL_SIZE + CELL_SIZE / 2,
        CELL_SIZE - 16,
        CELL_SIZE - 16,
        0x22c55e,
        0.24
      );
      rect.setStrokeStyle(2, 0x22c55e, 0.9);
      this.highlightRects.push(rect);
    });
  }

  private renderPieces(): void {
    this.pieceSprites.forEach((sprite) => sprite.destroy());
    this.pieceSprites.clear();

    Object.values(this.gameState.animals).forEach((piece) => {
      const isSelected = this.gameState.selectedAnimalId === piece.id;
      const label = piece.hidden ? '◆' : ANIMAL_SYMBOLS[piece.name] ?? '●';

      const sprite = this.add.text(
        BOARD_OFFSET_X + piece.col * CELL_SIZE + CELL_SIZE / 2,
        BOARD_OFFSET_Y + piece.row * CELL_SIZE + CELL_SIZE / 2,
        label,
        {
          fontSize: piece.hidden ? '40px' : '38px',
          color: piece.hidden ? '#e2e8f0' : COLOR_HEX[piece.color],
          fontFamily: 'Arial',
          backgroundColor: piece.hidden ? '#334155' : '#0f172a',
          padding: { x: 12, y: 8 }
        }
      );

      sprite.setOrigin(0.5);
      sprite.setDepth(2);

      if (isSelected) {
        sprite.setStroke('#facc15', 3);
      }

      this.pieceSprites.set(piece.id, sprite);
    });

    this.renderHighlights();
  }

  private renderHud(): void {
    const currentColor = getCurrentPlayerColor(this.gameState);
    const p1Color = this.gameState.playerColors.player1;
    const p2Color = this.gameState.playerColors.player2;

    this.turnText.setText(`Turn: ${PLAYER_LABEL[this.gameState.currentTurn]}`);

    if (!p1Color || !p2Color) {
      this.roleText.setText('Opening phase: flip any face-down piece to assign colors');
    } else {
      this.roleText.setText(`Player 1 = ${p1Color.toUpperCase()}  |  Player 2 = ${p2Color.toUpperCase()}`);
    }

    const blueLeft = Object.values(this.gameState.animals).filter((a) => a.color === 'blue').length;
    const redLeft = Object.values(this.gameState.animals).filter((a) => a.color === 'red').length;
    const hiddenLeft = Object.values(this.gameState.animals).filter((a) => a.hidden).length;

    const phaseHint = currentColor
      ? `Current side: ${currentColor.toUpperCase()} | Blue: ${blueLeft}  Red: ${redLeft}  Hidden: ${hiddenLeft}`
      : `Blue: ${blueLeft}  Red: ${redLeft}  Hidden: ${hiddenLeft}`;

    this.infoText.setText(phaseHint);
    this.actionText.setText(this.gameState.lastAction ?? 'Tip: Flip first, then move your own revealed pieces.');
  }

  private showResult(): void {
    const winner = this.gameState.status === 'blue_won' ? 'BLUE wins!' : 'RED wins!';

    const panel = this.add.rectangle(500, 340, 460, 220, 0x0f172a, 0.94);
    panel.setStrokeStyle(3, 0x38bdf8, 0.8);
    panel.setDepth(20);

    const title = this.add.text(500, 290, winner, {
      fontSize: '42px',
      color: '#22d3ee',
      fontFamily: 'Arial'
    });
    title.setOrigin(0.5);
    title.setDepth(21);

    const replay = this.add.text(500, 350, 'Play Again', {
      fontSize: '30px',
      color: '#f8fafc',
      fontFamily: 'Arial',
      backgroundColor: '#2563eb',
      padding: { x: 14, y: 8 }
    });
    replay.setOrigin(0.5);
    replay.setDepth(21);
    replay.setInteractive({ useHandCursor: true });
    replay.on('pointerdown', () => this.scene.restart());

    const menu = this.add.text(500, 402, 'Back to Menu', {
      fontSize: '24px',
      color: '#0f172a',
      fontFamily: 'Arial',
      backgroundColor: '#e2e8f0',
      padding: { x: 10, y: 6 }
    });
    menu.setOrigin(0.5);
    menu.setDepth(21);
    menu.setInteractive({ useHandCursor: true });
    menu.on('pointerdown', () => this.scene.start('DouShouQiMainMenuScene'));
  }
}
