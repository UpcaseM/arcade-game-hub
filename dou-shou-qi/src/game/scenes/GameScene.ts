import Phaser from 'phaser';
import {
  BOARD_COLS,
  BOARD_OFFSET_X,
  BOARD_OFFSET_Y,
  BOARD_ROWS,
  CELL_SIZE,
  createInitialGameState,
  flipAnimal,
  getAnimalAtCell,
  getValidMoves,
  isOwnedByCurrentTurn,
  moveAnimal
} from '../../data/gameData';
import { Animal, GameState, PlayerTurn } from '../../data/types';
import { HudView } from '../ui/HudView';
import { PieceView } from '../ui/PieceView';
import { WinOverlay } from '../ui/WinOverlay';
import { flashCells } from '../ui/fx/BoardHintsFx';
import { playCaptureImpact } from '../ui/fx/CaptureFx';
import { playFlipReveal } from '../ui/fx/FlipFx';
import { playMoveTween, showMoveTrail } from '../ui/fx/MoveFx';
import { startSelectionPulse } from '../ui/fx/SelectionFx';
import { showTurnTransition } from '../ui/fx/TurnTransitionFx';
import { UiSettings, loadUiSettings } from '../ui/settings';
import { NEUTRAL_COLORS, getPlayerIdentity } from '../ui/theme';

const PLAYER_LABEL: Record<PlayerTurn, string> = {
  player1: 'Player 1',
  player2: 'Player 2'
};

export class DouShouQiGameScene extends Phaser.Scene {
  private gameState!: GameState;
  private boardGraphics!: Phaser.GameObjects.Graphics;
  private boardCue!: Phaser.GameObjects.Rectangle;

  private readonly pieceViews = new Map<string, PieceView>();
  private moveHintRects: Phaser.GameObjects.Rectangle[] = [];
  private moveHintDots: Phaser.GameObjects.Arc[] = [];

  private hudView!: HudView;
  private winOverlay!: WinOverlay;
  private settings!: UiSettings;

  private actionLocked = false;
  private selectionPulse?: Phaser.Tweens.Tween;

  constructor() {
    super('DouShouQiGameScene');
  }

  init(): void {
    this.gameState = createInitialGameState();
    this.settings = loadUiSettings();
    this.actionLocked = false;
  }

  create(): void {
    this.createBoard();
    this.createUI();
    this.syncPieceViewsToState();
    this.renderHud();
    this.setupInput();
  }

  private createBoard(): void {
    this.boardGraphics = this.add.graphics();

    const width = BOARD_COLS * CELL_SIZE;
    const height = BOARD_ROWS * CELL_SIZE;

    this.boardGraphics.fillStyle(NEUTRAL_COLORS.boardBg, 1);
    this.boardGraphics.fillRect(BOARD_OFFSET_X, BOARD_OFFSET_Y, width, height);

    this.boardGraphics.lineStyle(3, NEUTRAL_COLORS.boardOuter, 1);
    this.boardGraphics.strokeRect(BOARD_OFFSET_X, BOARD_OFFSET_Y, width, height);

    this.boardGraphics.lineStyle(2, NEUTRAL_COLORS.boardLine, 1);
    for (let r = 1; r < BOARD_ROWS; r += 1) {
      const y = BOARD_OFFSET_Y + r * CELL_SIZE;
      this.boardGraphics.lineBetween(BOARD_OFFSET_X, y, BOARD_OFFSET_X + width, y);
    }
    for (let c = 1; c < BOARD_COLS; c += 1) {
      const x = BOARD_OFFSET_X + c * CELL_SIZE;
      this.boardGraphics.lineBetween(x, BOARD_OFFSET_Y, x, BOARD_OFFSET_Y + height);
    }

    this.boardCue = this.add.rectangle(
      BOARD_OFFSET_X + width / 2,
      BOARD_OFFSET_Y + height / 2,
      width + 8,
      height + 8
    );
    this.boardCue.setStrokeStyle(3, 0xfacc15, 0);
    this.boardCue.setDepth(1);
  }

  private createUI(): void {
    this.hudView = new HudView(this);
    this.winOverlay = new WinOverlay(this);

    const assistText = this.settings.colorAssist ? 'Color-assist on' : 'Color-assist off';
    const motionText = this.settings.reducedMotion ? 'Reduced motion on' : 'Reduced motion off';

    this.add.text(24, 612, `${assistText} | ${motionText}`, {
      fontFamily: 'Arial',
      fontSize: '14px',
      color: '#94a3b8'
    });

    const backButton = this.add.text(24, 634, '← Back to Menu', {
      fontFamily: 'Arial',
      fontSize: '20px',
      color: '#3b82f6'
    });
    backButton.setInteractive({ useHandCursor: true });
    backButton.on('pointerdown', () => this.scene.start('DouShouQiMainMenuScene'));
  }

  private setupInput(): void {
    this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      if (this.actionLocked || this.gameState.status !== 'playing') {
        return;
      }

      const col = Math.floor((pointer.x - BOARD_OFFSET_X) / CELL_SIZE);
      const row = Math.floor((pointer.y - BOARD_OFFSET_Y) / CELL_SIZE);
      if (col < 0 || col >= BOARD_COLS || row < 0 || row >= BOARD_ROWS) {
        return;
      }

      void this.handleCellTap(col, row);
    });
  }

  private async handleCellTap(col: number, row: number): Promise<void> {
    const piece = getAnimalAtCell(this.gameState, col, row);

    if (piece?.hidden) {
      await this.handleFlip(piece);
      return;
    }

    const selectedId = this.gameState.selectedAnimalId;
    const selectedPiece = selectedId ? this.gameState.animals[selectedId] : undefined;

    if (selectedPiece) {
      if (piece?.id === selectedPiece.id) {
        this.clearSelection();
        return;
      }

      const moved = await this.handleMove(selectedPiece, col, row);
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

  private async handleFlip(piece: Animal): Promise<void> {
    this.actionLocked = true;

    const result = flipAnimal(this.gameState, piece.id);
    if (!result.success) {
      this.gameState.lastAction = result.reason;
      this.renderHud();
      this.actionLocked = false;
      return;
    }

    this.clearSelection();

    const view = this.pieceViews.get(piece.id);
    if (view) {
      await playFlipReveal(
        this,
        view.container,
        () => {
          const identity = result.flippedAnimal ? getPlayerIdentity(result.flippedAnimal.color) : undefined;
          view.updateFromAnimal(piece, identity, this.settings.colorAssist);
        },
        this.settings.reducedMotion
      );
    }

    this.syncPieceViewsToState();
    this.renderHud();

    flashCells(this, [{ col: piece.col, row: piece.row }], this.cellCenter, 0x38bdf8, this.settings.reducedMotion);
    this.pulseBoardCue();
    this.showTurnCue();

    if (result.winStatus && result.winStatus !== 'playing') {
      this.showResult();
    }

    this.actionLocked = false;
  }

  private async handleMove(selectedPiece: Animal, targetCol: number, targetRow: number): Promise<boolean> {
    const movingView = this.pieceViews.get(selectedPiece.id);
    if (!movingView) {
      return false;
    }

    const moverColor = this.gameState.playerColors[this.gameState.currentTurn];
    const fromCol = selectedPiece.col;
    const fromRow = selectedPiece.row;
    const fromPoint = this.cellCenter(fromCol, fromRow);
    const toPoint = this.cellCenter(targetCol, targetRow);

    const result = moveAnimal(this.gameState, selectedPiece.id, targetCol, targetRow);
    if (!result.success) {
      return false;
    }

    this.actionLocked = true;
    this.clearSelection();

    const trailColor = moverColor ? getPlayerIdentity(moverColor).primaryColor : 0x38bdf8;
    showMoveTrail(this, fromPoint, toPoint, trailColor, this.settings.reducedMotion);

    await playMoveTween(this, movingView.container, toPoint.x, toPoint.y, this.settings.reducedMotion);

    const capturedId = result.capturedAnimal?.id;
    if (capturedId) {
      const capturedView = this.pieceViews.get(capturedId);
      if (capturedView) {
        await playCaptureImpact(this, toPoint, capturedView.container, this.settings.reducedMotion);
      }
    }

    this.syncPieceViewsToState();
    this.renderHud();

    flashCells(
      this,
      [
        { col: fromCol, row: fromRow },
        { col: targetCol, row: targetRow }
      ],
      this.cellCenter,
      0xf59e0b,
      this.settings.reducedMotion
    );

    this.pulseBoardCue();
    this.showTurnCue();

    if (result.winStatus && result.winStatus !== 'playing') {
      this.showResult();
    }

    this.actionLocked = false;
    return true;
  }

  private selectPiece(piece: Animal): void {
    this.gameState.selectedAnimalId = piece.id;
    this.gameState.validMoves = getValidMoves(this.gameState, piece);
    this.renderMoveHints();
    this.updateSelectionVisuals();
  }

  private clearSelection(): void {
    this.gameState.selectedAnimalId = undefined;
    this.gameState.validMoves = undefined;
    this.clearMoveHints();
    this.updateSelectionVisuals();
    this.renderHud();
  }

  private updateSelectionVisuals(): void {
    const selectedId = this.gameState.selectedAnimalId;

    if (this.selectionPulse) {
      this.selectionPulse.stop();
      this.selectionPulse = undefined;
    }

    this.pieceViews.forEach((view, pieceId) => {
      const selected = selectedId === pieceId;
      view.setSelected(selected);
      if (!selected) {
        view.setScale(1);
        return;
      }

      this.selectionPulse = startSelectionPulse(this, view.container, this.settings.reducedMotion);
    });
  }

  private clearMoveHints(): void {
    this.moveHintRects.forEach((shape) => shape.destroy());
    this.moveHintDots.forEach((shape) => shape.destroy());
    this.moveHintRects = [];
    this.moveHintDots = [];
  }

  private renderMoveHints(): void {
    this.clearMoveHints();

    (this.gameState.validMoves ?? []).forEach(({ col, row }) => {
      const { x, y } = this.cellCenter(col, row);

      const cell = this.add.rectangle(x, y, CELL_SIZE - 14, CELL_SIZE - 14, 0x22c55e, 0.14);
      cell.setStrokeStyle(2, 0x4ade80, 0.92);
      cell.setDepth(2);

      const dot = this.add.circle(x, y, 6, 0x86efac, 0.95);
      dot.setDepth(3);

      this.moveHintRects.push(cell);
      this.moveHintDots.push(dot);
    });
  }

  private syncPieceViewsToState(): void {
    const activeIds = new Set(Object.keys(this.gameState.animals));

    this.pieceViews.forEach((view, id) => {
      if (!activeIds.has(id)) {
        view.destroy();
        this.pieceViews.delete(id);
      }
    });

    Object.values(this.gameState.animals).forEach((animal) => {
      const center = this.cellCenter(animal.col, animal.row);
      let view = this.pieceViews.get(animal.id);
      if (!view) {
        view = new PieceView(this, animal, center.x, center.y);
        this.pieceViews.set(animal.id, view);
      }

      const identity = animal.hidden ? undefined : getPlayerIdentity(animal.color);
      view.updateFromAnimal(animal, identity, this.settings.colorAssist);
      view.setPosition(center.x, center.y);
      view.setAlpha(1);
      view.setScale(1);
      view.setVisible(true);
    });

    this.updateSelectionVisuals();
    this.renderMoveHints();
  }

  private renderHud(): void {
    this.hudView.update(this.gameState);
  }

  private pulseBoardCue(): void {
    this.boardCue.setAlpha(0.85);
    this.boardCue.setStrokeStyle(3, 0xfacc15, 0.9);

    this.tweens.add({
      targets: this.boardCue,
      alpha: 0,
      duration: this.settings.reducedMotion ? 120 : 220,
      ease: 'Quad.easeOut'
    });

    this.hudView.pulseTurnChip(this, this.settings.reducedMotion);
  }

  private showTurnCue(): void {
    const color = this.gameState.playerColors[this.gameState.currentTurn];
    const identity = color ? getPlayerIdentity(color) : undefined;
    showTurnTransition(
      this,
      `${PLAYER_LABEL[this.gameState.currentTurn]} to act`,
      identity?.textColor ?? '#e2e8f0',
      this.settings.reducedMotion
    );
  }

  private showResult(): void {
    const winnerColor = this.gameState.status === 'blue_won' ? 'blue' : 'red';
    const winnerIdentity = getPlayerIdentity(winnerColor);
    const winnerText = `${winnerIdentity.label} wins`;

    const blueLeft = Object.values(this.gameState.animals).filter((animal) => animal.color === 'blue').length;
    const redLeft = Object.values(this.gameState.animals).filter((animal) => animal.color === 'red').length;

    this.winOverlay.show({
      winnerText,
      summary: `Pieces remaining - Blue ${blueLeft} | Red ${redLeft}`,
      winnerIdentity,
      reducedMotion: this.settings.reducedMotion,
      onReplay: () => this.scene.restart(),
      onMenu: () => this.scene.start('DouShouQiMainMenuScene')
    });
  }

  private cellCenter(col: number, row: number): { x: number; y: number } {
    return {
      x: BOARD_OFFSET_X + col * CELL_SIZE + CELL_SIZE / 2,
      y: BOARD_OFFSET_Y + row * CELL_SIZE + CELL_SIZE / 2
    };
  }
}
