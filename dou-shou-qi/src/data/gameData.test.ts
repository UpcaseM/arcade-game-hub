import { describe, expect, it } from 'vitest';
import {
  BOARD_COLS,
  BOARD_ROWS,
  canCapture,
  checkWinCondition,
  createInitialGameState,
  flipAnimal,
  getValidMoves,
  hasAnyLegalAction,
  isValidMove,
  moveAnimal
} from './gameData';
import { Animal, GameState, PlayerColor } from './types';

function createEmptyState(): GameState {
  const state = createInitialGameState(() => 0.5);
  state.animals = {};
  state.currentTurn = 'player1';
  state.playerColors = { player1: 'blue', player2: 'red' };
  state.status = 'playing';
  state.selectedAnimalId = undefined;
  state.validMoves = undefined;
  state.lastAction = undefined;
  return state;
}

function placeAnimal(
  state: GameState,
  id: string,
  name: string,
  rank: number,
  color: PlayerColor,
  col: number,
  row: number,
  hidden = false
): Animal {
  const animal: Animal = { id, name, rank, color, col, row, hidden };
  state.animals[id] = animal;
  return animal;
}

describe('dark setup', () => {
  it('creates a 4x4 board with 16 hidden pieces in unique cells', () => {
    const state = createInitialGameState(() => 0.42);
    expect(state.board).toHaveLength(BOARD_ROWS);
    expect(state.board[0]).toHaveLength(BOARD_COLS);

    const animals = Object.values(state.animals);
    expect(animals).toHaveLength(16);
    expect(animals.every((a) => a.hidden)).toBe(true);

    const coordSet = new Set(animals.map((a) => `${a.col},${a.row}`));
    expect(coordSet.size).toBe(16);
  });

  it('first reveal assigns colors by flipped piece and switches turn', () => {
    const state = createInitialGameState(() => 0.11);
    const firstId = Object.keys(state.animals)[0];
    const firstColor = state.animals[firstId].color;

    const res = flipAnimal(state, firstId);
    expect(res.success).toBe(true);
    expect(state.playerColors.player1).toBe(firstColor);
    expect(state.playerColors.player2).toBe(firstColor === 'blue' ? 'red' : 'blue');
    expect(state.currentTurn).toBe('player2');
  });

  it('second reveal does not change assigned colors', () => {
    const state = createInitialGameState(() => 0.11);
    const ids = Object.keys(state.animals);

    flipAnimal(state, ids[0]);
    const assigned = { ...state.playerColors };
    flipAnimal(state, ids[1]);

    expect(state.playerColors).toEqual(assigned);
  });
});

describe('movement and capture', () => {
  it('does not allow moving hidden pieces', () => {
    const state = createEmptyState();
    const piece = placeAnimal(state, 'b-cat', 'Cat', 2, 'blue', 1, 1, true);
    expect(isValidMove(state, piece, 1, 2)).toBe(false);
  });

  it('allows one-step orthogonal move to empty cell', () => {
    const state = createEmptyState();
    const piece = placeAnimal(state, 'b-dog', 'Dog', 4, 'blue', 1, 1);
    expect(isValidMove(state, piece, 1, 2)).toBe(true);

    const result = moveAnimal(state, piece.id, 1, 2);
    expect(result.success).toBe(true);
    expect(state.animals[piece.id].col).toBe(1);
    expect(state.animals[piece.id].row).toBe(2);
    expect(state.currentTurn).toBe('player2');
  });

  it('blocks diagonal moves', () => {
    const state = createEmptyState();
    const piece = placeAnimal(state, 'b-wolf', 'Wolf', 3, 'blue', 1, 1);
    expect(isValidMove(state, piece, 2, 2)).toBe(false);
  });

  it('cannot capture a hidden piece', () => {
    const state = createEmptyState();
    const attacker = placeAnimal(state, 'b-lion', 'Lion', 7, 'blue', 1, 1);
    placeAnimal(state, 'r-cat', 'Cat', 2, 'red', 1, 2, true);

    expect(isValidMove(state, attacker, 1, 2)).toBe(false);
  });

  it('enforces rank capture for revealed enemy', () => {
    const state = createEmptyState();
    const attacker = placeAnimal(state, 'b-dog', 'Dog', 4, 'blue', 1, 1);
    placeAnimal(state, 'r-wolf', 'Wolf', 3, 'red', 1, 2);

    expect(isValidMove(state, attacker, 1, 2)).toBe(true);
  });

  it('blocks lower-rank capture on higher-rank piece', () => {
    const state = createEmptyState();
    const low = placeAnimal(state, 'b-cat', 'Cat', 2, 'blue', 1, 1);
    placeAnimal(state, 'r-tiger', 'Tiger', 6, 'red', 1, 2);

    expect(isValidMove(state, low, 1, 2)).toBe(false);
  });

  it('eliminates both pieces when same rank captures', () => {
    const state = createEmptyState();
    const attacker = placeAnimal(state, 'b-wolf', 'Wolf', 3, 'blue', 1, 1);
    const defender = placeAnimal(state, 'r-wolf', 'Wolf', 3, 'red', 1, 2);

    const result = moveAnimal(state, attacker.id, defender.col, defender.row);
    expect(result.success).toBe(true);
    expect(result.capturedAnimal?.id).toBe(defender.id);
    expect(state.animals[attacker.id]).toBeUndefined();
    expect(state.animals[defender.id]).toBeUndefined();
    expect(state.lastAction).toContain('traded');
  });

  it('applies mouse-elephant special capture rule', () => {
    const mouse = placeAnimal(createEmptyState(), 'b-mouse', 'Mouse', 1, 'blue', 0, 0);
    const elephant = placeAnimal(createEmptyState(), 'r-elephant', 'Elephant', 8, 'red', 0, 1);

    expect(canCapture(mouse, elephant)).toBe(true);
    expect(canCapture(elephant, mouse)).toBe(false);
  });

  it('returns valid orthogonal moves only', () => {
    const state = createEmptyState();
    const piece = placeAnimal(state, 'b-leopard', 'Leopard', 5, 'blue', 1, 1);
    const moves = getValidMoves(state, piece).map((m) => `${m.col},${m.row}`);

    expect(moves.sort()).toEqual(['0,1', '1,0', '1,2', '2,1']);
  });
});

describe('win conditions', () => {
  it('wins when one color has no remaining pieces', () => {
    const state = createEmptyState();
    placeAnimal(state, 'b-cat', 'Cat', 2, 'blue', 0, 0);
    expect(checkWinCondition(state)).toBe('blue_won');
  });

  it('wins when current turn has no legal action and no hidden pieces', () => {
    const state = createEmptyState();
    state.currentTurn = 'player1';

    // Blue has only one Elephant in corner.
    // Adjacent cells are occupied by red Mouse pieces.
    // Elephant cannot capture Mouse, so Player 1 has no legal action.
    placeAnimal(state, 'b-elephant', 'Elephant', 8, 'blue', 0, 0);
    placeAnimal(state, 'r-mouse-1', 'Mouse', 1, 'red', 1, 0);
    placeAnimal(state, 'r-mouse-2', 'Mouse', 1, 'red', 0, 1);

    expect(hasAnyLegalAction(state, 'player1')).toBe(false);
    expect(checkWinCondition(state)).toBe('red_won');
  });
});
