import { Animal, BoardCell, GameState, GameStatus, MoveResult, PlayerColor, PlayerTurn } from './types';

export const BOARD_COLS = 4;
export const BOARD_ROWS = 4;
export const CELL_SIZE = 110;
export const BOARD_OFFSET_X = 290;
export const BOARD_OFFSET_Y = 110;

export const ANIMAL_NAMES = ['Elephant', 'Lion', 'Tiger', 'Leopard', 'Dog', 'Wolf', 'Cat', 'Mouse'];
export const ANIMAL_RANKINGS = [8, 7, 6, 5, 4, 3, 2, 1];

export const ANIMAL_SYMBOLS: Record<string, string> = {
  Elephant: '🐘',
  Lion: '🦁',
  Tiger: '🐯',
  Leopard: '🐆',
  Dog: '🐕',
  Wolf: '🐺',
  Cat: '🐱',
  Mouse: '🐭'
};

const ANIMAL_DEFS = ANIMAL_NAMES.map((name, idx) => ({
  name,
  rank: ANIMAL_RANKINGS[idx]
}));

const DIRECTIONS = [
  { dc: 1, dr: 0 },
  { dc: -1, dr: 0 },
  { dc: 0, dr: 1 },
  { dc: 0, dr: -1 }
];

function otherColor(color: PlayerColor): PlayerColor {
  return color === 'blue' ? 'red' : 'blue';
}

function allCoords(): Array<{ col: number; row: number }> {
  const coords: Array<{ col: number; row: number }> = [];
  for (let row = 0; row < BOARD_ROWS; row += 1) {
    for (let col = 0; col < BOARD_COLS; col += 1) {
      coords.push({ col, row });
    }
  }
  return coords;
}

function shuffleInPlace<T>(arr: T[], randomFn: () => number): void {
  for (let i = arr.length - 1; i > 0; i -= 1) {
    const j = Math.floor(randomFn() * (i + 1));
    const tmp = arr[i];
    arr[i] = arr[j];
    arr[j] = tmp;
  }
}

function createInitialBoard(): BoardCell[][] {
  const board: BoardCell[][] = [];
  for (let row = 0; row < BOARD_ROWS; row += 1) {
    const line: BoardCell[] = [];
    for (let col = 0; col < BOARD_COLS; col += 1) {
      line.push({ col, row, type: 'land' });
    }
    board.push(line);
  }
  return board;
}

function makeInitialAnimals(randomFn: () => number): Animal[] {
  const positions = allCoords();
  shuffleInPlace(positions, randomFn);

  const animals: Animal[] = [];
  let posIdx = 0;

  for (const color of ['blue', 'red'] as const) {
    ANIMAL_DEFS.forEach((def, idx) => {
      const pos = positions[posIdx];
      posIdx += 1;
      animals.push({
        id: `${color}-${def.name.toLowerCase()}-${idx + 1}`,
        name: def.name,
        rank: def.rank,
        color,
        col: pos.col,
        row: pos.row,
        hidden: true
      });
    });
  }

  return animals;
}

export function createInitialGameState(randomFn: () => number = Math.random): GameState {
  const animals: Record<string, Animal> = {};
  makeInitialAnimals(randomFn).forEach((animal) => {
    animals[animal.id] = { ...animal };
  });

  return {
    board: createInitialBoard(),
    animals,
    currentTurn: 'player1',
    playerColors: {},
    status: 'playing',
    selectedAnimalId: undefined,
    validMoves: undefined,
    lastAction: 'Game started: all pieces face-down'
  };
}

export function switchPlayer(turn: PlayerTurn): PlayerTurn {
  return turn === 'player1' ? 'player2' : 'player1';
}

export function getAnimalAtCell(gameState: GameState, col: number, row: number): Animal | undefined {
  return Object.values(gameState.animals).find((animal) => animal.col === col && animal.row === row);
}

export function isCellEmpty(gameState: GameState, col: number, row: number): boolean {
  return !getAnimalAtCell(gameState, col, row);
}

export function getCurrentPlayerColor(gameState: GameState): PlayerColor | undefined {
  return gameState.playerColors[gameState.currentTurn];
}

export function isOwnedByCurrentTurn(gameState: GameState, animal: Animal): boolean {
  const currentColor = getCurrentPlayerColor(gameState);
  if (!currentColor) {
    return false;
  }
  return !animal.hidden && animal.color === currentColor;
}

function assignColorsFromFirstReveal(gameState: GameState, flipped: Animal): void {
  if (gameState.playerColors.player1 || gameState.playerColors.player2) {
    return;
  }
  const own = flipped.color;
  const opp = otherColor(own);
  gameState.playerColors[gameState.currentTurn] = own;
  gameState.playerColors[switchPlayer(gameState.currentTurn)] = opp;
}

function isAdjacent(fromCol: number, fromRow: number, toCol: number, toRow: number): boolean {
  return Math.abs(fromCol - toCol) + Math.abs(fromRow - toRow) === 1;
}

export function canCapture(attacker: Animal, defender: Animal): boolean {
  if (attacker.color === defender.color) {
    return false;
  }

  // Dark Dou Shou Qi special rule: Elephant cannot capture Mouse; Mouse can capture Elephant.
  if (attacker.name === 'Elephant' && defender.name === 'Mouse') {
    return false;
  }
  if (attacker.name === 'Mouse' && defender.name === 'Elephant') {
    return true;
  }

  return attacker.rank >= defender.rank;
}

export function isValidMove(gameState: GameState, animal: Animal, targetCol: number, targetRow: number): boolean {
  if (gameState.status !== 'playing') {
    return false;
  }
  if (targetCol < 0 || targetCol >= BOARD_COLS || targetRow < 0 || targetRow >= BOARD_ROWS) {
    return false;
  }
  if (animal.hidden) {
    return false;
  }
  if (!isOwnedByCurrentTurn(gameState, animal)) {
    return false;
  }
  if (!isAdjacent(animal.col, animal.row, targetCol, targetRow)) {
    return false;
  }

  const target = getAnimalAtCell(gameState, targetCol, targetRow);
  if (!target) {
    return true;
  }
  if (target.hidden) {
    return false;
  }
  if (target.color === animal.color) {
    return false;
  }
  return canCapture(animal, target);
}

export function getValidMoves(gameState: GameState, animal: Animal): Array<{ col: number; row: number }> {
  const moves: Array<{ col: number; row: number }> = [];
  DIRECTIONS.forEach(({ dc, dr }) => {
    const col = animal.col + dc;
    const row = animal.row + dr;
    if (isValidMove(gameState, animal, col, row)) {
      moves.push({ col, row });
    }
  });
  return moves;
}

export function hasHiddenPieces(gameState: GameState): boolean {
  return Object.values(gameState.animals).some((animal) => animal.hidden);
}

export function hasAnyLegalAction(gameState: GameState, turn: PlayerTurn): boolean {
  if (gameState.status !== 'playing') {
    return false;
  }

  // If there is any hidden piece, current turn can always choose to flip.
  if (hasHiddenPieces(gameState)) {
    return true;
  }

  const color = gameState.playerColors[turn];
  if (!color) {
    return false;
  }

  for (const animal of Object.values(gameState.animals)) {
    if (animal.hidden || animal.color !== color) {
      continue;
    }
    if (getValidMoves(gameState, animal).length > 0) {
      return true;
    }
  }

  return false;
}

export function checkWinCondition(gameState: GameState): GameStatus {
  let blueCount = 0;
  let redCount = 0;

  Object.values(gameState.animals).forEach((animal) => {
    if (animal.color === 'blue') {
      blueCount += 1;
    } else {
      redCount += 1;
    }
  });

  if (blueCount === 0) {
    return 'red_won';
  }
  if (redCount === 0) {
    return 'blue_won';
  }

  if (gameState.playerColors.player1 && gameState.playerColors.player2 && !hasAnyLegalAction(gameState, gameState.currentTurn)) {
    const winnerColor = gameState.playerColors[switchPlayer(gameState.currentTurn)];
    if (winnerColor === 'blue') {
      return 'blue_won';
    }
    if (winnerColor === 'red') {
      return 'red_won';
    }
  }

  return 'playing';
}

export function flipAnimal(gameState: GameState, animalId: string): MoveResult {
  const animal = gameState.animals[animalId];
  if (!animal) {
    return { success: false, reason: 'Piece not found', gameState };
  }
  if (gameState.status !== 'playing') {
    return { success: false, reason: 'Game already ended', gameState };
  }
  if (!animal.hidden) {
    return { success: false, reason: 'Piece already revealed', gameState };
  }

  animal.hidden = false;
  assignColorsFromFirstReveal(gameState, animal);
  gameState.selectedAnimalId = undefined;
  gameState.validMoves = undefined;
  gameState.lastAction = `${gameState.currentTurn} flipped ${animal.name} (${animal.color})`;

  gameState.currentTurn = switchPlayer(gameState.currentTurn);
  gameState.status = checkWinCondition(gameState);

  return {
    success: true,
    gameState,
    flippedAnimal: animal,
    winStatus: gameState.status !== 'playing' ? gameState.status : undefined
  };
}

export function moveAnimal(gameState: GameState, animalId: string, targetCol: number, targetRow: number): MoveResult {
  const animal = gameState.animals[animalId];
  if (!animal) {
    return { success: false, reason: 'Piece not found', gameState };
  }
  if (!isValidMove(gameState, animal, targetCol, targetRow)) {
    return { success: false, reason: 'Invalid move', gameState };
  }

  const captured = getAnimalAtCell(gameState, targetCol, targetRow);
  if (captured) {
    delete gameState.animals[captured.id];
  }

  animal.col = targetCol;
  animal.row = targetRow;

  gameState.selectedAnimalId = undefined;
  gameState.validMoves = undefined;
  gameState.lastAction = captured
    ? `${gameState.currentTurn} captured ${captured.name} with ${animal.name}`
    : `${gameState.currentTurn} moved ${animal.name}`;

  gameState.currentTurn = switchPlayer(gameState.currentTurn);
  gameState.status = checkWinCondition(gameState);

  return {
    success: true,
    gameState,
    capturedAnimal: captured,
    winStatus: gameState.status !== 'playing' ? gameState.status : undefined
  };
}
