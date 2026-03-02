import { describe, expect, it } from 'vitest';
import { GameState } from '../data/types';
import { applyHostAction, cloneState } from './protocol';

function createState(): GameState {
  return {
    board: [
      [{ col: 0, row: 0, type: 'land' }, { col: 1, row: 0, type: 'land' }],
      [{ col: 0, row: 1, type: 'land' }, { col: 1, row: 1, type: 'land' }]
    ],
    animals: {
      a: { id: 'a', name: 'Cat', rank: 2, color: 'blue', col: 0, row: 0, hidden: false },
      b: { id: 'b', name: 'Dog', rank: 4, color: 'red', col: 1, row: 0, hidden: false }
    },
    currentTurn: 'player1',
    playerColors: { player1: 'blue', player2: 'red' },
    status: 'playing',
    lastAction: ''
  };
}

describe('protocol host authority', () => {
  it('rejects actions from wrong turn actor', () => {
    const state = createState();
    const result = applyHostAction(state, 'player2', { type: 'move', pieceId: 'b', targetCol: 1, targetRow: 1 });
    expect(result.success).toBe(false);
    expect(result.reason).toContain('turn');
  });

  it('applies valid move requests', () => {
    const state = createState();
    const result = applyHostAction(state, 'player1', { type: 'move', pieceId: 'a', targetCol: 0, targetRow: 1 });
    expect(result.success).toBe(true);
    expect(state.animals.a.row).toBe(1);
    expect(state.currentTurn).toBe('player2');
  });

  it('cloneState creates a detached snapshot', () => {
    const state = createState();
    const cloned = cloneState(state);
    cloned.animals.a.row = 1;
    expect(state.animals.a.row).toBe(0);
  });
});

