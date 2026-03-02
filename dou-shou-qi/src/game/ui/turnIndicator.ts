import { GameState, PlayerTurn } from '../../data/types';
import { getPlayerIdentity } from './theme';

const PLAYER_LABEL: Record<PlayerTurn, string> = {
  player1: 'Player 1',
  player2: 'Player 2'
};

export interface TurnIndicatorMeta {
  mode: 'local' | 'online';
  localTurn: PlayerTurn;
  localName: string;
  remoteName: string;
}

export function formatTurnIndicator(state: GameState, meta: TurnIndicatorMeta): string {
  const currentTurn = state.currentTurn;
  const currentColor = state.playerColors[currentTurn];
  const sideText = currentColor ? getPlayerIdentity(currentColor).label : 'Side Unassigned';

  if (meta.mode === 'online') {
    const actor = currentTurn === meta.localTurn ? `${meta.localName} (You)` : meta.remoteName;
    return `Turn: ${actor} · ${sideText}`;
  }

  return `Turn: ${PLAYER_LABEL[currentTurn]} · ${sideText}`;
}
