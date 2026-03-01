import { Animal, BoardCell } from './types';

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
  { col: 2, row: 8 }, { col: 3, row: 7 }, { col: 4, row: 8 }
];

export const TRAP_POSITIONS_RED = [
  { col: 2, row: 0 }, { col: 3, row: 1 }, { col: 4, row: 0 }
];

export const RIVER_POSITIONS = [
  { col: 1, row: 3 }, { col: 2, row: 3 }, { col: 4, row: 3 }, { col: 5, row: 3 },
  { col: 1, row: 4 }, { col: 2, row: 4 }, { col: 4, row: 4 }, { col: 5, row: 4 },
  { col: 1, row: 5 }, { col: 2, row: 5 }, { col: 4, row: 5 }, { col: 5, row: 5 }
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

const SPECIAL_CELL_TYPES: Record<string, { type: BoardCell['type']; owner?: 'blue' | 'red' }> = {
  [`${DEN_POSITIONS.red.col},${DEN_POSITIONS.red.row}`]: { type: 'den', owner: 'red' },
  [`${DEN_POSITIONS.blue.col},${DEN_POSITIONS.blue.row}`]: { type: 'den', owner: 'blue' }
};

for (const trap of TRAP_POSITIONS_RED) {
  SPECIAL_CELL_TYPES[`${trap.col},${trap.row}`] = { type: 'trap', owner: 'red' };
}

for (const trap of TRAP_POSITIONS_BLUE) {
  SPECIAL_CELL_TYPES[`${trap.col},${trap.row}`] = { type: 'trap', owner: 'blue' };
}

for (const river of RIVER_POSITIONS) {
  SPECIAL_CELL_TYPES[`${river.col},${river.row}`] = { type: 'river' };
}

function createInitialBoard(): BoardCell[][] {
  const board: BoardCell[][] = [];

  for (let row = 0; row < BOARD_ROWS; row++) {
    const boardRow: BoardCell[] = [];
    for (let col = 0; col < BOARD_COLS; col++) {
      const specialCell = SPECIAL_CELL_TYPES[`${col},${row}`];
      boardRow.push({
        col,
        row,
        type: specialCell?.type ?? 'land',
        owner: specialCell?.owner
      });
    }
    board.push(boardRow);
  }

  return board;
}

export const INITIAL_BOARD: BoardCell[][] = createInitialBoard();

export const INITIAL_ANIMALS: Animal[] = [
  // Blue player (bottom)
  { id: 'blue-elephant', name: 'Elephant', rank: 8, color: 'blue', col: 0, row: 6 },
  { id: 'blue-lion', name: 'Lion', rank: 7, color: 'blue', col: 6, row: 8 },
  { id: 'blue-tiger', name: 'Tiger', rank: 6, color: 'blue', col: 0, row: 8 },
  { id: 'blue-leopard', name: 'Leopard', rank: 5, color: 'blue', col: 4, row: 6 },
  { id: 'blue-dog', name: 'Dog', rank: 4, color: 'blue', col: 5, row: 7 },
  { id: 'blue-wolf', name: 'Wolf', rank: 3, color: 'blue', col: 2, row: 6 },
  { id: 'blue-cat', name: 'Cat', rank: 2, color: 'blue', col: 1, row: 7 },
  { id: 'blue-mouse', name: 'Mouse', rank: 1, color: 'blue', col: 6, row: 6 },

  // Red player (top)
  { id: 'red-elephant', name: 'Elephant', rank: 8, color: 'red', col: 6, row: 2 },
  { id: 'red-lion', name: 'Lion', rank: 7, color: 'red', col: 0, row: 0 },
  { id: 'red-tiger', name: 'Tiger', rank: 6, color: 'red', col: 6, row: 0 },
  { id: 'red-leopard', name: 'Leopard', rank: 5, color: 'red', col: 2, row: 2 },
  { id: 'red-dog', name: 'Dog', rank: 4, color: 'red', col: 1, row: 1 },
  { id: 'red-wolf', name: 'Wolf', rank: 3, color: 'red', col: 4, row: 2 },
  { id: 'red-cat', name: 'Cat', rank: 2, color: 'red', col: 5, row: 1 },
  { id: 'red-mouse', name: 'Mouse', rank: 1, color: 'red', col: 0, row: 2 }
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
    animals[animal.id] = { ...animal };
  });
  
  return {
    board: createInitialBoard(),
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

function isInOpponentTrap(gameState: GameState, animal: Animal): boolean {
  const cell = gameState.board[animal.row][animal.col];
  return cell.type === 'trap' && cell.owner !== animal.color;
}

function getEffectiveRank(gameState: GameState, animal: Animal): number {
  return isInOpponentTrap(gameState, animal) ? 0 : animal.rank;
}

export function canCapture(gameState: GameState, attacker: Animal, defender: Animal): boolean {
  const attackerCell = gameState.board[attacker.row][attacker.col];
  const defenderCell = gameState.board[defender.row][defender.col];
  const attackerInRiver = attackerCell.type === 'river';
  const defenderInRiver = defenderCell.type === 'river';

  if (attacker.color === defender.color) {
    return false;
  }

  if (attackerInRiver !== defenderInRiver) {
    return false;
  }

  if (defenderCell.type === 'trap' && defenderCell.owner === attacker.color) {
    return true;
  }

  if (attacker.name === 'Mouse' && defender.name === 'Elephant') {
    return !attackerInRiver;
  }

  if (attacker.name === 'Elephant' && defender.name === 'Mouse') {
    return false;
  }

  const attackerRank = getEffectiveRank(gameState, attacker);
  const defenderRank = getEffectiveRank(gameState, defender);

  return attackerRank >= defenderRank;
}

function isJumpMove(gameState: GameState, animal: Animal, targetCol: number, targetRow: number): boolean {
  if (animal.name !== 'Lion' && animal.name !== 'Tiger') {
    return false;
  }

  if (animal.col !== targetCol && animal.row !== targetRow) {
    return false;
  }

  const colStep = Math.sign(targetCol - animal.col);
  const rowStep = Math.sign(targetRow - animal.row);

  if (colStep === 0 && rowStep === 0) {
    return false;
  }

  let col = animal.col + colStep;
  let row = animal.row + rowStep;
  let crossedRiver = false;

  while (col !== targetCol || row !== targetRow) {
    const cell = gameState.board[row][col];
    if (cell.type !== 'river') {
      return false;
    }

    crossedRiver = true;

    const blockingAnimal = getAnimalAtCell(gameState, col, row);
    if (blockingAnimal?.name === 'Mouse') {
      return false;
    }

    col += colStep;
    row += rowStep;
  }

  return crossedRiver && gameState.board[targetRow][targetCol].type !== 'river';
}

export function isValidMove(gameState: GameState, animal: Animal, targetCol: number, targetRow: number): boolean {
  if (targetCol < 0 || targetCol >= BOARD_COLS || targetRow < 0 || targetRow >= BOARD_ROWS) {
    return false;
  }
  
  const targetCell = gameState.board[targetRow][targetCol];
  
  // Cannot move into own den
  if (targetCell.type === 'den' && targetCell.owner === animal.color) {
    return false;
  }
  
  const isAdjacent = Math.abs(animal.col - targetCol) + Math.abs(animal.row - targetRow) === 1;
  const isJump = isJumpMove(gameState, animal, targetCol, targetRow);

  if (!isAdjacent && !isJump) {
    return false;
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
    if (!canCapture(gameState, animal, targetAnimal)) {
      return false;
    }
  }
  
  return true;
}

export function getValidMoves(gameState: GameState, animal: Animal): { col: number; row: number }[] {
  const moves: { col: number; row: number }[] = [];

  for (let col = 0; col < BOARD_COLS; col++) {
    for (let row = 0; row < BOARD_ROWS; row++) {
      if (col === animal.col && row === animal.row) {
        continue;
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
