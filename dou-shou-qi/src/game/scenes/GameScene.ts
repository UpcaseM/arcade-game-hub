import Phaser from 'phaser';
import { createInitialGameState, GameState, PlayerColor, GameStatus, MoveResult, isValidMove, getValidMoves, checkWinCondition, switchPlayer } from '../data/gameData';

const ANIMAL_COLORS = {
  blue: '#3b82f6',
  red: '#ef4444'
};

const ANIMAL_ICONS: Record<string, string> = {
  'Elephant': '🐘',
  'Lion': '🦁',
  'Tiger': '🦅',
  'Leopard': '🐆',
  'Dog': '🐕',
  'Wolf': '🐺',
  'Cat': '🐱',
  'Mouse': '🐀'
};

const ANIMAL_RANKS: Record<string, number> = {
  'Elephant': 8,
  'Lion': 7,
  'Tiger': 6,
  'Leopard': 5,
  'Dog': 4,
  'Wolf': 3,
  'Cat': 2,
  'Mouse': 1
};

const CELL_SIZE = 60;
const BOARD_OFFSET_X = 100;
const BOARD_OFFSET_Y = 80;
const BOARD_COLS = 7;
const BOARD_ROWS = 9;

export class DouShouQiGameScene extends Phaser.Scene {
  private gameState: GameState;
  private boardGraphics: Phaser.GameObjects.Graphics;
  private animalSprites: Map<string, Phaser.GameObjects.Text>;
  private selectedAnimalId?: string;
  private validMoves?: { col: number; row: number }[];
  private lastMoveTime: number = 0;
  private moveCooldown: number = 300;
  private currentPlayerIndicator: Phaser.GameObjects.Text;
  private statusText: Phaser.GameObjects.Text;
  private scoreText: Phaser.GameObjects.Text;
  private moveHistory: string[] = [];

  constructor() {
    super('DouShouQiGameScene');
  }

  init(): void {
    this.gameState = createInitialGameState();
    this.animalSprites = new Map();
  }

  create(): void {
    this.createBoard();
    this.createAnimals();
    this.createUI();
    this.setupInput();
    this.updateGameStatus();
  }

  private createBoard(): void {
    this.boardGraphics = this.add.graphics();
    this.boardGraphics.lineStyle(2, 0x2d3748, 1);

    // Draw grid
    for (let row = 0; row <= BOARD_ROWS; row++) {
      const y = BOARD_OFFSET_Y + row * CELL_SIZE;
      this.boardGraphics.moveTo(BOARD_OFFSET_X, y);
      this.boardGraphics.lineTo(BOARD_OFFSET_X + BOARD_COLS * CELL_SIZE, y);
    }
    for (let col = 0; col <= BOARD_COLS; col++) {
      const x = BOARD_OFFSET_X + col * CELL_SIZE;
      this.boardGraphics.moveTo(x, BOARD_OFFSET_Y);
      this.boardGraphics.lineTo(x, BOARD_OFFSET_Y + BOARD_ROWS * CELL_SIZE);
    }
    this.boardGraphics.strokePath();

    // Draw special areas
    this.drawSpecialAreas();
  }

  private drawSpecialAreas(): void {
    const specialGraphics = this.add.graphics();

    // Draw dens
    const denPositions = [
      { col: 3, row: 0, color: 0x9ca3af }, // Red den
      { col: 3, row: 8, color: 0x9ca3af }  // Blue den
    ];

    denPositions.forEach(({ col, row, color }) => {
      specialGraphics.fillStyle(color, 0.3);
      specialGraphics.fillRect(
        BOARD_OFFSET_X + col * CELL_SIZE + 2,
        BOARD_OFFSET_Y + row * CELL_SIZE + 2,
        CELL_SIZE - 4,
        CELL_SIZE - 4
      );
    });

    // Draw traps
    const trapPositions = [
      { col: 2, row: 1 }, { col: 3, row: 1 }, { col: 4, row: 1 }, // Red traps
      { col: 2, row: 7 }, { col: 3, row: 7 }, { col: 4, row: 7 }  // Blue traps
    ];

    trapPositions.forEach(({ col, row }) => {
      specialGraphics.fillStyle(0x6b7280, 0.2);
      specialGraphics.fillRect(
        BOARD_OFFSET_X + col * CELL_SIZE + 2,
        BOARD_OFFSET_Y + row * CELL_SIZE + 2,
        CELL_SIZE - 4,
        CELL_SIZE - 4
      );
    });

    // Draw river
    for (let col = 1; col <= 5; col++) {
      for (let row = 3; row <= 5; row++) {
        specialGraphics.fillStyle(0x60a5fa, 0.1);
        specialGraphics.fillRect(
          BOARD_OFFSET_X + col * CELL_SIZE + 2,
          BOARD_OFFSET_Y + row * CELL_SIZE + 2,
          CELL_SIZE - 4,
          CELL_SIZE - 4
        );
      }
    }

    specialGraphics.setDepth(-1);
  }

  private createAnimals(): void {
    Object.values(this.gameState.animals).forEach(animal => {
      this.createAnimalSprite(animal);
    });
  }

  private createAnimalSprite(animal: Animal): void {
    const sprite = this.add.text(
      BOARD_OFFSET_X + animal.col * CELL_SIZE + CELL_SIZE / 2,
      BOARD_OFFSET_Y + animal.row * CELL_SIZE + CELL_SIZE / 2,
      ANIMAL_ICONS[animal.name],
      {
        fontSize: '32px',
        color: ANIMAL_COLORS[animal.color],
        fontFamily: 'Arial',
        backgroundColor: '#1f2937',
        padding: { x: 8, y: 4 }
      }
    );
    sprite.setOrigin(0.5);
    sprite.setDepth(1);
    this.animalSprites.set(animal.id, sprite);
  }

  private createUI(): void {
    this.currentPlayerIndicator = this.add.text(
      20, 20,
      `Current Player: ${this.gameState.currentPlayer}`,
      { fontSize: '18px', color: '#374151', fontFamily: 'Arial' }
    );

    this.statusText = this.add.text(
      20, 50,
      'Game Status: Playing',
      { fontSize: '16px', color: '#64748b', fontFamily: 'Arial' }
    );

    this.scoreText = this.add.text(
      20, 80,
      'Score: 0',
      { fontSize: '16px', color: '#64748b', fontFamily: 'Arial' }
    );

    const backButton = this.add.text(
      20, 680,
      '← Back to Menu',
      { fontSize: '18px', color: '#3b82f6', fontFamily: 'Arial' }
    );
    backButton.setInteractive();
    backButton.on('pointerdown', () => {
      this.scene.start('DouShouQiMainMenuScene');
    });
  }

  private setupInput(): void {
    this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      if (this.gameState.status !== 'playing') return;

      const col = Math.floor((pointer.x - BOARD_OFFSET_X) / CELL_SIZE);
      const row = Math.floor((pointer.y - BOARD_OFFSET_Y) / CELL_SIZE);

      if (col >= 0 && col < BOARD_COLS && row >= 0 && row < BOARD_ROWS) {
        this.handleBoardClick(col, row);
      }
    });
  }

  private handleBoardClick(col: number, row: number): void {
    const currentTime = Date.now();
    if (currentTime - this.lastMoveTime < this.moveCooldown) return;

    const animal = this.getAnimalAtCell(col, row);
    
    if (animal && animal.color === this.gameState.currentPlayer) {
      // Select animal
      this.selectAnimal(animal);
    } else if (this.selectedAnimalId) {
      // Try to move selected animal
      this.attemptMove(col, row);
    }
  }

  private selectAnimal(animal: Animal): void {
    this.selectedAnimalId = animal.id;
    this.validMoves = getValidMoves(this.gameState, animal);
    
    // Highlight valid moves
    this.validMoves.forEach(({ col, row }) => {
      const highlight = this.add.rectangle(
        BOARD_OFFSET_X + col * CELL_SIZE + CELL_SIZE / 2,
        BOARD_OFFSET_Y + row * CELL_SIZE + CELL_SIZE / 2,
        CELL_SIZE - 10,
        CELL_SIZE - 10,
        0x22c55e
      ).setOrigin(0.5).setAlpha(0.5);
      
      // Store highlight for later removal
      this.add.highlight = highlight;
    });
  }

  private attemptMove(targetCol: number, targetRow: number): void {
    const animal = this.gameState.animals[this.selectedAnimalId!];
    
    if (!animal) return;

    const result = this.makeMove(animal, targetCol, targetRow);
    
    if (result.success) {
      this.lastMoveTime = Date.now();
      this.clearHighlights();
      this.selectedAnimalId = undefined;
      this.validMoves = undefined;
      
      this.updateGameStatus();
      
      // Check for win condition
      const winStatus = checkWinCondition(this.gameState);
      if (winStatus !== 'playing') {
        this.gameState.status = winStatus;
        this.showWinMessage(winStatus);
      }
    } else {
      console.log('Invalid move:', result.reason);
    }
  }

  private makeMove(animal: Animal, targetCol: number, targetRow: number): MoveResult {
    if (!isValidMove(this.gameState, animal, targetCol, targetRow)) {
      return { success: false, reason: 'Invalid move', gameState: this.gameState };
    }

    const capturedAnimal = this.getAnimalAtCell(targetCol, targetRow);
    
    // Update animal position
    animal.col = targetCol;
    animal.row = targetRow;
    
    // Update game state
    this.gameState.animals[animal.id] = animal;
    this.gameState.currentPlayer = switchPlayer(this.gameState.currentPlayer);
    
    // Update sprite position
    const sprite = this.animalSprites.get(animal.id);
    if (sprite) {
      this.tweens.add({
        targets: sprite,
        x: BOARD_OFFSET_X + targetCol * CELL_SIZE + CELL_SIZE / 2,
        y: BOARD_OFFSET_Y + targetRow * CELL_SIZE + CELL_SIZE / 2,
        duration: 200,
        ease: 'Power2'
      });
    }
    
    // Handle capture
    if (capturedAnimal) {
      this.animalSprites.get(capturedAnimal.id)?.destroy();
      delete this.gameState.animals[capturedAnimal.id];
    }
    
    this.moveHistory.push(`${animal.name} moved to (${targetCol}, ${targetRow})`);
    
    return {
      success: true,
      gameState: this.gameState,
      capturedAnimal,
      winStatus: checkWinCondition(this.gameState)
    };
  }

  private getAnimalAtCell(col: number, row: number): Animal | undefined {
    return Object.values(this.gameState.animals).find(animal => animal.col === col && animal.row === row);
  }

  private clearHighlights(): void {
    this.children.each(child => {
      if (child.highlight) {
        child.highlight.destroy();
      }
    });
  }

  private updateGameStatus(): void {
    this.currentPlayerIndicator.setText(`Current Player: ${this.gameState.currentPlayer}`);
    this.statusText.setText(`Game Status: ${this.gameState.status}`);
  }

  private showWinMessage(status: GameStatus): void {
    const message = status === 'blue_won' ? 'Blue player wins!' : 
                    status === 'red_won' ? 'Red player wins!' : 'Game over';
    
    this.add.text(
      500, 325,
      message,
      { fontSize: '32px', color: '#10b981', fontFamily: 'Arial', backgroundColor: '#1f2937', padding: { x: 20, y: 10 } }
    ).setOrigin(0.5).setDepth(10);
    
    const restartButton = this.add.text(
      500, 375,
      'Play Again',
      { fontSize: '24px', color: '#3b82f6', fontFamily: 'Arial' }
    ).setOrigin(0.5).setInteractive();
    
    restartButton.on('pointerdown', () => {
      this.scene.restart();
    });
  }

  update(): void {
    // Handle game updates
  }

  resize(width: number, height: number): void {
    // Handle resize if needed
  }
}