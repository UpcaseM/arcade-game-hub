import { describe, expect, it } from 'vitest';
import {
  BOARD_COLS,
  BOARD_ROWS,
  DEN_POSITIONS,
  INITIAL_ANIMALS,
  RIVER_POSITIONS,
  TRAP_POSITIONS_BLUE,
  TRAP_POSITIONS_RED,
  checkWinCondition,
  createInitialGameState,
  getValidMoves,
  isValidMove
} from './gameData';
import { Animal, GameState, PlayerColor } from './types';

function createEmptyState(): GameState {
  const state = createInitialGameState();
  state.animals = {};
  state.currentPlayer = 'blue';
  state.status = 'playing';
  return state;
}

function placeAnimal(
  state: GameState,
  id: string,
  name: string,
  rank: number,
  color: PlayerColor,
  col: number,
  row: number
): Animal {
  const animal: Animal = { id, name, rank, color, col, row };
  state.animals[id] = animal;
  return animal;
}

function toCoordSet(coords: { col: number; row: number }[]): Set<string> {
  return new Set(coords.map(({ col, row }) => `${col},${row}`));
}

describe('board configuration', () => {
  it('uses exactly the standard two-river coordinate set', () => {
    const state = createInitialGameState();
    const expected = toCoordSet(RIVER_POSITIONS);
    const actual = new Set<string>();

    for (let row = 0; row < BOARD_ROWS; row++) {
      for (let col = 0; col < BOARD_COLS; col++) {
        if (state.board[row][col].type === 'river') {
          actual.add(`${col},${row}`);
        }
      }
    }

    expect(actual).toEqual(expected);
    expect(actual.size).toBe(12);
  });

  it('uses standard den and trap coordinates', () => {
    const state = createInitialGameState();
    expect(state.board[DEN_POSITIONS.red.row][DEN_POSITIONS.red.col]).toMatchObject({ type: 'den', owner: 'red' });
    expect(state.board[DEN_POSITIONS.blue.row][DEN_POSITIONS.blue.col]).toMatchObject({ type: 'den', owner: 'blue' });

    for (const trap of TRAP_POSITIONS_RED) {
      expect(state.board[trap.row][trap.col]).toMatchObject({ type: 'trap', owner: 'red' });
    }

    for (const trap of TRAP_POSITIONS_BLUE) {
      expect(state.board[trap.row][trap.col]).toMatchObject({ type: 'trap', owner: 'blue' });
    }
  });

  it('uses the expected standard starting piece layout', () => {
    const expectedPositions: Record<string, string> = {
      'blue-elephant': '0,6',
      'blue-lion': '6,8',
      'blue-tiger': '0,8',
      'blue-leopard': '4,6',
      'blue-dog': '5,7',
      'blue-wolf': '2,6',
      'blue-cat': '1,7',
      'blue-mouse': '6,6',
      'red-elephant': '6,2',
      'red-lion': '0,0',
      'red-tiger': '6,0',
      'red-leopard': '2,2',
      'red-dog': '1,1',
      'red-wolf': '4,2',
      'red-cat': '5,1',
      'red-mouse': '0,2'
    };

    expect(INITIAL_ANIMALS).toHaveLength(16);
    for (const animal of INITIAL_ANIMALS) {
      expect(`${animal.col},${animal.row}`).toBe(expectedPositions[animal.id]);
    }
  });
});

describe('movement rules', () => {
  it('disallows non-mouse movement into river', () => {
    const state = createEmptyState();
    const dog = placeAnimal(state, 'blue-dog', 'Dog', 4, 'blue', 0, 3);
    expect(isValidMove(state, dog, 1, 3)).toBe(false);
  });

  it('allows mouse movement into river', () => {
    const state = createEmptyState();
    const mouse = placeAnimal(state, 'blue-mouse', 'Mouse', 1, 'blue', 0, 3);
    expect(isValidMove(state, mouse, 1, 3)).toBe(true);
  });

  it('disallows entering own den and allows entering opponent den', () => {
    const state = createEmptyState();
    const blueCat = placeAnimal(state, 'blue-cat', 'Cat', 2, 'blue', 3, 7);
    const redCat = placeAnimal(state, 'red-cat', 'Cat', 2, 'red', 3, 1);

    expect(isValidMove(state, blueCat, 3, 8)).toBe(false);
    expect(isValidMove(state, redCat, 3, 0)).toBe(false);

    expect(isValidMove(state, blueCat, 3, 6)).toBe(true);
    expect(isValidMove(state, redCat, 3, 2)).toBe(true);
  });

  it('enforces one-step orthogonal movement for normal moves', () => {
    const state = createEmptyState();
    const cat = placeAnimal(state, 'blue-cat', 'Cat', 2, 'blue', 3, 2);

    expect(isValidMove(state, cat, 4, 2)).toBe(true);
    expect(isValidMove(state, cat, 4, 3)).toBe(false);
    expect(isValidMove(state, cat, 3, 4)).toBe(false);
  });
});

describe('lion and tiger jump rules', () => {
  it('allows a horizontal lion jump when river path is clear', () => {
    const state = createEmptyState();
    const lion = placeAnimal(state, 'blue-lion', 'Lion', 7, 'blue', 0, 3);
    expect(isValidMove(state, lion, 3, 3)).toBe(true);
  });

  it('allows a vertical tiger jump when river path is clear', () => {
    const state = createEmptyState();
    const tiger = placeAnimal(state, 'blue-tiger', 'Tiger', 6, 'blue', 1, 2);
    expect(isValidMove(state, tiger, 1, 6)).toBe(true);
  });

  it.each([
    { blockerRow: 3 },
    { blockerRow: 4 },
    { blockerRow: 5 }
  ])('blocks jump when a mouse sits in crossed river square row $blockerRow', ({ blockerRow }) => {
    const state = createEmptyState();
    const tiger = placeAnimal(state, 'blue-tiger', 'Tiger', 6, 'blue', 1, 2);
    placeAnimal(state, `red-mouse-${blockerRow}`, 'Mouse', 1, 'red', 1, blockerRow);

    expect(isValidMove(state, tiger, 1, 6)).toBe(false);
  });

  it('disallows jump landing on own piece and allows legal jump capture', () => {
    const ownBlockedState = createEmptyState();
    const ownLion = placeAnimal(ownBlockedState, 'blue-lion', 'Lion', 7, 'blue', 0, 3);
    placeAnimal(ownBlockedState, 'blue-cat', 'Cat', 2, 'blue', 3, 3);
    expect(isValidMove(ownBlockedState, ownLion, 3, 3)).toBe(false);

    const captureState = createEmptyState();
    const captureLion = placeAnimal(captureState, 'blue-lion', 'Lion', 7, 'blue', 0, 3);
    placeAnimal(captureState, 'red-dog', 'Dog', 4, 'red', 3, 3);
    expect(isValidMove(captureState, captureLion, 3, 3)).toBe(true);
  });

  it('includes jump squares in generated valid moves', () => {
    const state = createEmptyState();
    const lion = placeAnimal(state, 'blue-lion', 'Lion', 7, 'blue', 0, 3);
    const moves = getValidMoves(state, lion);

    expect(moves).toContainEqual({ col: 3, row: 3 });
  });
});

describe('capture rules', () => {
  it('enforces base rank capture hierarchy', () => {
    const state = createEmptyState();
    const dog = placeAnimal(state, 'blue-dog', 'Dog', 4, 'blue', 2, 2);
    const wolf = placeAnimal(state, 'red-wolf', 'Wolf', 3, 'red', 3, 2);

    expect(isValidMove(state, dog, 3, 2)).toBe(true);
    expect(isValidMove(state, wolf, 2, 2)).toBe(false);

    const equalState = createEmptyState();
    const blueCat = placeAnimal(equalState, 'blue-cat', 'Cat', 2, 'blue', 2, 2);
    placeAnimal(equalState, 'red-cat', 'Cat', 2, 'red', 3, 2);
    expect(isValidMove(equalState, blueCat, 3, 2)).toBe(true);
  });

  it('allows mouse capture of elephant from land and blocks elephant capture of mouse', () => {
    const state = createEmptyState();
    const mouse = placeAnimal(state, 'blue-mouse', 'Mouse', 1, 'blue', 0, 0);
    const elephant = placeAnimal(state, 'red-elephant', 'Elephant', 8, 'red', 1, 0);

    expect(isValidMove(state, mouse, 1, 0)).toBe(true);
    expect(isValidMove(state, elephant, 0, 0)).toBe(false);
  });

  it('blocks river-to-land captures for mouse', () => {
    const state = createEmptyState();
    const mouse = placeAnimal(state, 'blue-mouse', 'Mouse', 1, 'blue', 1, 3);
    placeAnimal(state, 'red-elephant', 'Elephant', 8, 'red', 1, 2);

    expect(isValidMove(state, mouse, 1, 2)).toBe(false);
  });

  it('applies trap weakening for defender in attacker-owned trap', () => {
    const trapState = createEmptyState();
    const cat = placeAnimal(trapState, 'blue-cat', 'Cat', 2, 'blue', 2, 7);
    placeAnimal(trapState, 'red-elephant', 'Elephant', 8, 'red', 2, 8);
    expect(isValidMove(trapState, cat, 2, 8)).toBe(true);

    const normalState = createEmptyState();
    const normalCat = placeAnimal(normalState, 'blue-cat', 'Cat', 2, 'blue', 2, 7);
    placeAnimal(normalState, 'red-elephant', 'Elephant', 8, 'red', 2, 6);
    expect(isValidMove(normalState, normalCat, 2, 6)).toBe(false);
  });
});

describe('win conditions', () => {
  it('awards win for entering opponent den', () => {
    const state = createEmptyState();
    placeAnimal(state, 'blue-cat', 'Cat', 2, 'blue', 3, 0);
    placeAnimal(state, 'red-cat', 'Cat', 2, 'red', 0, 8);

    expect(checkWinCondition(state)).toBe('blue_won');
  });

  it('awards win when opponent has no pieces', () => {
    const state = createEmptyState();
    placeAnimal(state, 'blue-cat', 'Cat', 2, 'blue', 0, 0);

    expect(checkWinCondition(state)).toBe('blue_won');
  });
});
