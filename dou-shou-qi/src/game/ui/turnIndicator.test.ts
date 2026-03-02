import { describe, expect, it } from 'vitest';
import { GameState } from '../../data/types';
import { formatTurnIndicator } from './turnIndicator';

function createState(): GameState {
  return {
    board: [
      [{ col: 0, row: 0, type: 'land' }, { col: 1, row: 0, type: 'land' }],
      [{ col: 0, row: 1, type: 'land' }, { col: 1, row: 1, type: 'land' }]
    ],
    animals: {},
    currentTurn: 'player1',
    playerColors: { player1: 'blue', player2: 'red' },
    status: 'playing'
  };
}

describe('turn indicator formatter', () => {
  it('shows local labels in local mode', () => {
    const text = formatTurnIndicator(createState(), {
      mode: 'local',
      localTurn: 'player1',
      localName: 'Alice',
      remoteName: 'Bob'
    });

    expect(text).toContain('Player 1');
    expect(text).toContain('Azure Side');
  });

  it('shows You for the active local online player', () => {
    const text = formatTurnIndicator(createState(), {
      mode: 'online',
      localTurn: 'player1',
      localName: 'Alice',
      remoteName: 'Bob'
    });

    expect(text).toContain('Alice (You)');
  });

  it('shows opponent when remote side is active', () => {
    const state = createState();
    state.currentTurn = 'player2';

    const text = formatTurnIndicator(state, {
      mode: 'online',
      localTurn: 'player1',
      localName: 'Alice',
      remoteName: 'Bob'
    });

    expect(text).toContain('Bob');
    expect(text).toContain('Crimson Side');
  });

  it('handles unassigned sides', () => {
    const state = createState();
    state.playerColors = {};

    const text = formatTurnIndicator(state, {
      mode: 'local',
      localTurn: 'player1',
      localName: 'Alice',
      remoteName: 'Bob'
    });

    expect(text).toContain('Side Unassigned');
  });
});
