import { createInitialGameState, flipAnimal, moveAnimal } from '../data/gameData';
import { GameState, MoveResult, PlayerTurn } from '../data/types';

export type OnlineRole = 'host' | 'guest';

export type OnlineActionRequest =
  | { type: 'flip'; pieceId: string }
  | { type: 'move'; pieceId: string; targetCol: number; targetRow: number };

export interface OnlineIdentity {
  name: string;
  role: OnlineRole;
}

export type NetMessage =
  | { type: 'hello'; payload: OnlineIdentity }
  | { type: 'actionRequest'; payload: OnlineActionRequest }
  | { type: 'actionResult'; payload: { accepted: boolean; reason?: string } }
  | { type: 'stateSnapshot'; payload: { state: GameState; hostName: string; guestName: string } }
  | { type: 'ping'; payload: { at: number } }
  | { type: 'pong'; payload: { at: number } };

export function cloneState(state: GameState): GameState {
  return JSON.parse(JSON.stringify(state)) as GameState;
}

export function createOnlineInitialState(seedRandom?: () => number): GameState {
  return createInitialGameState(seedRandom ?? Math.random);
}

export function applyHostAction(
  state: GameState,
  actorTurn: PlayerTurn,
  request: OnlineActionRequest
): MoveResult {
  if (state.currentTurn !== actorTurn) {
    return { success: false, reason: 'Not your turn.', gameState: state };
  }

  if (request.type === 'flip') {
    return flipAnimal(state, request.pieceId);
  }

  return moveAnimal(state, request.pieceId, request.targetCol, request.targetRow);
}

