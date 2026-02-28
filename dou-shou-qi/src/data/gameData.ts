export const ANIMAL_NAMES = ["Elephant", "Lion", "Tiger", "Leopard", "Dog", "Wolf", "Cat", "Mouse"];
export const ANIMAL_RANKINGS = [8, 7, 6, 5, 4, 3, 2, 1];

export const BOARD_COLS = 7;
export const BOARD_ROWS = 9;
export const CELL_SIZE = 60;
export const BOARD_OFFSET_X = 100;
export const BOARD_OFFSET_Y = 80;

export const DEN_POSITIONS = {
  blue: { col: 3, row: 8 },
  red: { col: 3, row: 0 }
};

export const TRAP_POSITIONS_BLUE = [
  { col: 2, row: 7 }, { col: 3, row: 7 }, { col: 4, row: 7 }
];

export const TRAP_POSITIONS_RED = [
  { col: 2, row: 1 }, { col: 3, row: 1 }, { col: 4, row: 1 }
];

export const RIVER_POSITIONS = [
  { col: 1, row: 3 }, { col: 2, row: 3 }, { col: 3, row: 3 }, { col: 4, row: 3 }, { col: 5, row: 3 },
  { col: 1, row: 4 }, { col: 2, row: 4 }, { col: 3, row: 4 }, { col: 4, row: 4 }, { col: 5, row: 4 },
  { col: 1, row: 5 }, { col: 2, row: 5 }, { col: 3, row: 5 }, { col: 4, row: 5 }, { col: 5, row: 5 }
];

export const ANIMAL_SYMBOLS: Record<string, string> = {
  "Elephant": "🐘",
  "Lion": "🦁",
  "Tiger": "🐯",
  "Leopard": "🐆",
  "Dog": "🐕",
  "Wolf": "🐺",
  "Cat": "🐱",
  "Mouse": "🐹"
};

type Animal = {
  id: string;
  name: string;
  rank: number;
  color: string;
  col: number;
  row: number;
};

type BoardCell = {
  col: number;
  row: number;
  type: 'land' | 'river' | 'den' | 'trap';
  owner?: string;
};

export const INITIAL_BOARD: BoardCell[][] = [];
for (let row = 0; row < BOARD_ROWS; row++) {
  const boardRow: BoardCell[] = [];
  for (let col = 0; col < BOARD_COLS; col++) {
    let type: BoardCell['type'] = 'land';
    let owner: string | undefined;
    
    if (row === 0 && col === 3) {
      type = 'den';
      owner = 'red';
    } else if (row === 8 && col === 3) {
      type = 'den';
      owner = 'blue';
    } else if (
      (row === 1 && (col === 2 || col === 3 || col === 4)) ||
      (row === 7 && (col === 2 || col === 3 || col === 4))
    ) {
      type = 'trap';
      owner = row === 1 ? 'red' : 'blue';
    } else if (row >= 3 && row <= 5 && col >= 1 && col <= 5) {
      type = 'river';
    }
    
    boardRow.push({ col, row, type, owner });
  }
  INITIAL_BOARD.push(boardRow);
}

export const INITIAL_ANIMALS: Animal[] = [
  // Blue player (bottom, row 8)
  { id: 'blue-elephant', name: 'Elephant', rank: 8, color: 'blue', col: 5, row: 8 },
  { id: 'blue-lion', name: 'Lion', rank: 7, color: 'blue', col: 3, row: 8 },
  { id: 'blue-tiger', name: 'Tiger', rank: 6, color: 'blue', col: 1, row: 8 },
  { id: 'blue-leopard', name: 'Leopard', rank: 5, color: 'blue', col: 0, row: 6 },
  { id: 'blue-dog', name: 'Dog', rank: 4, color: 'blue', col: 6, row: 6 },
  { id: 'blue-wolf', name: 'Wolf', rank: 3, color: 'blue', col: 4, row: 6 },
  { id: 'blue-cat', name: 'Cat', rank: 2, color: 'blue', col: 2, row: 6 },
  { id: 'blue-mouse', name: 'Mouse', rank: 1, color: 'blue', col: 0, row: 8 },
  
  // Red player (top, row 0)
  { id: 'red-elephant', name: 'Elephant', rank: 8, color: 'red', col: 1, row: 0 },
  { id: 'red-lion', name: 'Lion', rank: 7, color: 'red', col: 3, row: 0 },
  { id: 'red-tiger', name: 'Tiger', rank: 6, color: 'red', col: 5, row: 0 },
  { id: 'red-leopard', name: 'Leopard', rank: 5, color: 'red', col: 6, row: 2 },
  { id: 'red-dog', name: 'Dog', rank: 4, color: 'red', col: 0, row: 2 },
  { id: 'red-wolf', name: 'Wolf', rank: 3, color: 'red', col: 2, row: 2 },
  { id: 'red-cat', name: 'Cat', rank: 2, color: 'red', col: 4, row: 2 },
  { id: 'red-mouse', name: 'Mouse', rank: 1, color: 'red', col: 6, row: 0 }
];

export type PlayerColor = 'blue' | 'red';
export type GameStatus = 'playing' | 'blue_won' | 'red_won' | 'blue_resigned' | 'red_resigned';

export interface GameState {
  board: BoardCell[][];
  animals: Record<string, Animal>;
  currentPlayer: PlayerColor;
  status: GameStatus;
  selectedAnimalId?: string;
  validMoves?: { col: number; row: number }[];
}

export function createInitialGameState(): GameState {
  const animals: Record<string, Animal> = {};
  INITIAL_ANIMALS.forEach(animal => {
    animals[animal.id] = animal;
  });
  
  return {
    board: INITIAL_BOARD,
    animals,
    currentPlayer: 'blue',
    status: 'playing',
    selectedAnimalId: undefined,
    validMoves: undefined
  };
}

export function isCellEmpty(gameState: GameState, col: number, row: number): boolean {
  return !Object.values(gameState.animals).some(animal => animal.col === col && animal.row === row);
}

export function getAnimalAtCell(gameState: GameState, col: number, row: number): Animal | undefined {
  return Object.values(gameState.animals).find(animal => animal.col === col && animal.row === row);
}

export function canCapture(attacker: Animal, defender: Animal): boolean {
  if (attacker.rank === 1 && defender.rank === 8) {
    return true; // Mouse can capture Elephant
  }
  if (attacker.rank === 8 && defender.rank === 1) {
    return false; // Elephant cannot capture Mouse (unless both in river)
  }
  if (attacker.rank === defender.rank) {
    return true; // Equal rank can capture
  }
  return attacker.rank > defender.rank; // Higher rank captures lower rank
}

export function isValidMove(gameState: GameState, animal: Animal, targetCol: number, targetRow: number): boolean {
  if (targetCol < 0 || targetCol >= BOARD_COLS || targetRow < 0 || targetRow >= BOARD_ROWS) {
    return false;
  }
  
  const currentCell = gameState.board[animal.row][animal.col];
  const targetCell = gameState.board[targetRow][targetCol];
  
  // Cannot move into own den
  if (targetCell.type === 'den' && targetCell.owner === animal.color) {
    return false;
  }
  
  // Check adjacency
  const colDiff = Math.abs(animal.col - targetCol);
  const rowDiff = Math.abs(animal.row - targetRow);
  
  if (colDiff + rowDiff !== 1) {
    return false; // Must move exactly one square orthogonally
  }
  
  // Check river rules
  if (targetCell.type === 'river') {
    if (animal.name !== 'Mouse') {
      return false; // Only Mouse can move on river
    }
  }
  
  // Check if target is occupied by own animal
  const targetAnimal = getAnimalAtCell(gameState, targetCol, targetRow);
  if (targetAnimal && targetAnimal.color === animal.color) {
    return false;
  }
  
  // Check capture rules
  if (targetAnimal) {
    if (!canCapture(animal, targetAnimal)) {
      return false;
    }
  }
  
  return true;
}

export function getValidMoves(gameState: GameState, animal: Animal): { col: number; row: number }[] {
  const moves: { col: number; row: number }[] = [];
  
  for (let col = animal.col - 1; col <= animal.col + 1; col++) {
    for (let row = animal.row - 1; row <= animal.row + 1; row++) {
      if ((col === animal.col && row === animal.row) ||
          (col !== animal.col && row !== animal.row)) {
        continue; // Skip current position and diagonal moves
      }
      
      if (isValidMove(gameState, animal, col, row)) {
        moves.push({ col, row });
      }
    }
  }
  
  return moves;
}

export function checkWinCondition(gameState: GameState): GameStatus {
  // Check if any animal reached opponent's den
  for (const animal of Object.values(gameState.animals)) {
    const denCell = gameState.board[animal.row][animal.col];
    if (denCell.type === 'den' && denCell.owner !== animal.color) {
      return animal.color === 'blue' ? 'blue_won' : 'red_won';
    }
  }
  
  // Check if any player has no animals left
  const animalCounts = { blue: 0, red: 0 };
  for (const animal of Object.values(gameState.animals)) {
    animalCounts[animal.color]++;
  }
  
  if (animalCounts.blue === 0) return 'red_won';
  if (animalCounts.red === 0) return 'blue_won';
  
  return 'playing';
}

export function switchPlayer(currentPlayer: PlayerColor): PlayerColor {
  return currentPlayer === 'blue' ? 'red' : 'blue';
}