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
import { applyHostAction, cloneState, OnlineActionRequest } from '../../net/protocol';
import { onlineSession } from '../../net/onlineSession';
import { AudioEngine } from '../audio/AudioEngine';
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

type SceneMode = 'local' | 'online';

export class DouShouQiGameScene extends Phaser.Scene {
  private gameState!: GameState;
  private boardGraphics!: Phaser.GameObjects.Graphics;
  private boardCue!: Phaser.GameObjects.Rectangle;
  private networkText!: Phaser.GameObjects.Text;

  private readonly pieceViews = new Map<string, PieceView>();
  private moveHintRects: Phaser.GameObjects.Rectangle[] = [];
  private moveHintDots: Phaser.GameObjects.Arc[] = [];

  private hudView!: HudView;
  private winOverlay!: WinOverlay;
  private settings!: UiSettings;
  private audio!: AudioEngine;

  private actionLocked = false;
  private selectionPulse?: Phaser.Tweens.Tween;
  private mode: SceneMode = 'local';
  private localTurn: PlayerTurn = 'player1';
  private awaitingSnapshot = false;

  constructor() {
    super('DouShouQiGameScene');
  }

  init(data: { mode?: SceneMode }): void {
    this.mode = data?.mode ?? 'local';
    this.settings = loadUiSettings();
    this.audio = new AudioEngine(this.settings);
    this.actionLocked = false;
    this.awaitingSnapshot = this.mode === 'online' && onlineSession.getRole() === 'guest';
    this.localTurn = this.mode === 'online' ? onlineSession.localTurn() : 'player1';
    this.gameState = createInitialGameState();
    if (this.awaitingSnapshot) {
      this.gameState.lastAction = 'Waiting for host snapshot...';
    }
  }

  create(): void {
    this.createBoard();
    this.createUI();
    this.syncPieceViewsToState();
    this.renderHud();
    this.setupInput();
    this.bindOnlineSession();
  }

  private createBoard(): void {
    this.boardGraphics = this.add.graphics();

    const width = BOARD_COLS * CELL_SIZE;
    const height = BOARD_ROWS * CELL_SIZE;

    this.boardGraphics.fillGradientStyle(0x0f172a, 0x111827, 0x1e293b, 0x0f172a, 1);
    this.boardGraphics.fillRect(BOARD_OFFSET_X - 14, BOARD_OFFSET_Y - 14, width + 28, height + 28);

    for (let row = 0; row < BOARD_ROWS; row += 1) {
      for (let col = 0; col < BOARD_COLS; col += 1) {
        const shade = (row + col) % 2 === 0 ? 0x0b1220 : 0x111d32;
        this.boardGraphics.fillStyle(shade, 1);
        this.boardGraphics.fillRect(BOARD_OFFSET_X + col * CELL_SIZE, BOARD_OFFSET_Y + row * CELL_SIZE, CELL_SIZE, CELL_SIZE);
      }
    }

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

    const backButton = this.add.text(24, 620, '< Back to Menu', {
      fontFamily: 'Arial',
      fontSize: '20px',
      color: '#3b82f6'
    });
    backButton.setInteractive({ useHandCursor: true });
    backButton.on('pointerdown', () => {
      onlineSession.setListener({});
      this.scene.start('DouShouQiMainMenuScene');
    });

    this.networkText = this.add.text(24, 646, '', {
      fontFamily: 'Arial',
      fontSize: '14px',
      color: '#94a3b8'
    });
  }

  private setupInput(): void {
    this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      this.audio.unlock();

      if (this.actionLocked || this.gameState.status !== 'playing' || this.awaitingSnapshot) {
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

  private bindOnlineSession(): void {
    if (this.mode !== 'online') {
      this.updateNetworkText();
      return;
    }

    onlineSession.setListener({
      onStatus: () => {
        this.updateNetworkText();
      },
      onMessage: (message) => {
        if (message.type === 'actionRequest' && onlineSession.getRole() === 'host') {
          const actorTurn = onlineSession.remoteTurn();
          const result = applyHostAction(this.gameState, actorTurn, message.payload);
          onlineSession.send({
            type: 'actionResult',
            payload: { accepted: result.success, reason: result.success ? undefined : result.reason }
          });
          if (result.success) {
            this.audio.play(message.payload.type === 'move' && result.capturedAnimal ? 'capture' : message.payload.type);
            this.afterStateMutation();
          }
          this.broadcastSnapshot();
        }

        if (message.type === 'actionResult' && !message.payload.accepted) {
          this.gameState.lastAction = message.payload.reason ?? 'Action rejected by host.';
          this.renderHud();
        }

        if (message.type === 'stateSnapshot' && onlineSession.getRole() === 'guest') {
          this.awaitingSnapshot = false;
          this.gameState = cloneState(message.payload.state);
          this.syncPieceViewsToState();
          this.renderHud();
          this.updateNetworkText(message.payload.hostName, message.payload.guestName);
        }
      }
    });

    this.updateNetworkText();
    if (onlineSession.getRole() === 'host' && onlineSession.getStatus() === 'connected') {
      this.broadcastSnapshot();
    }
  }

  private updateNetworkText(hostName?: string, guestName?: string): void {
    if (this.mode !== 'online') {
      this.networkText.setText('Local match');
      return;
    }

    const status = onlineSession.getStatus();
    const local = onlineSession.getLocalName();
    const remote = onlineSession.getRemoteName();
    const host = hostName ?? (onlineSession.getRole() === 'host' ? local : remote);
    const guest = guestName ?? (onlineSession.getRole() === 'guest' ? local : remote);
    this.networkText.setText(`Online ${status} | You: ${local} | Opponent: ${remote} | Host ${host} / Guest ${guest}`);
  }

  private broadcastSnapshot(): void {
    if (this.mode !== 'online' || onlineSession.getRole() !== 'host') {
      return;
    }
    onlineSession.sendSnapshot({
      state: cloneState(this.gameState),
      hostName: onlineSession.getLocalName(),
      guestName: onlineSession.getRemoteName()
    });
  }

  private async handleCellTap(col: number, row: number): Promise<void> {
    if (this.mode === 'online') {
      if (onlineSession.getStatus() !== 'connected') {
        this.gameState.lastAction = 'Connection not ready. Use Reconnect from menu.';
        this.renderHud();
        return;
      }
      if (this.gameState.currentTurn !== this.localTurn) {
        this.gameState.lastAction = 'Wait for opponent turn.';
        this.renderHud();
        return;
      }
    }

    const piece = getAnimalAtCell(this.gameState, col, row);

    if (piece?.hidden) {
      if (this.mode === 'online' && onlineSession.getRole() === 'guest') {
        onlineSession.requestAction({ type: 'flip', pieceId: piece.id });
        this.gameState.lastAction = 'Flip requested...';
        this.renderHud();
        return;
      }
      await this.handleFlip(piece);
      if (this.mode === 'online') {
        this.broadcastSnapshot();
      }
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
        if (this.mode === 'online') {
          this.broadcastSnapshot();
        }
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
    if (this.mode === 'online' && onlineSession.getRole() === 'guest') {
      return;
    }

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

    this.audio.play('flip');
    this.afterStateMutation();
    this.actionLocked = false;
  }

  private async handleMove(selectedPiece: Animal, targetCol: number, targetRow: number): Promise<boolean> {
    if (this.mode === 'online' && onlineSession.getRole() === 'guest') {
      const action: OnlineActionRequest = {
        type: 'move',
        pieceId: selectedPiece.id,
        targetCol,
        targetRow
      };
      const sent = onlineSession.requestAction(action);
      if (sent) {
        this.gameState.lastAction = 'Move requested...';
        this.renderHud();
      }
      return false;
    }

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
      this.audio.play('capture');
    } else {
      this.audio.play('move');
    }

    this.afterStateMutation();
    this.actionLocked = false;
    return true;
  }

  private afterStateMutation(): void {
    this.syncPieceViewsToState();
    this.renderHud();
    this.pulseBoardCue();
    this.showTurnCue();
    if (this.gameState.status !== 'playing') {
      this.audio.play('win');
      this.showResult();
    }
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
    this.hudView.update(this.gameState, {
      compact: true,
      mode: this.mode,
      localTurn: this.localTurn,
      localName: this.mode === 'online' ? onlineSession.getLocalName() : 'Local',
      remoteName: this.mode === 'online' ? onlineSession.getRemoteName() : 'Opponent',
      status: this.mode === 'online' ? onlineSession.getStatus() : 'offline'
    });
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
    flashCells(this, [{ col: 0, row: 0 }], this.cellCenter, identity?.primaryColor ?? 0x38bdf8, this.settings.reducedMotion);
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

