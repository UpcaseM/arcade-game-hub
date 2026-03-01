export type PlayerColor = 'blue' | 'red';
export type PlayerTurn = 'player1' | 'player2';
export type GameStatus = 'playing' | 'blue_won' | 'red_won';

export interface Animal {
  id: string;
  name: string;
  rank: number;
  color: PlayerColor;
  col: number;
  row: number;
  hidden: boolean;
}

export interface BoardCell {
  col: number;
  row: number;
  type: 'land';
}

export interface GameState {
  board: BoardCell[][];
  animals: Record<string, Animal>;
  currentTurn: PlayerTurn;
  playerColors: {
    player1?: PlayerColor;
    player2?: PlayerColor;
  };
  status: GameStatus;
  selectedAnimalId?: string;
  validMoves?: { col: number; row: number }[];
  lastAction?: string;
}

export interface Move {
  fromCol: number;
  fromRow: number;
  toCol: number;
  toRow: number;
  capturedAnimalId?: string;
}

export interface GameOptions {
  showTutorial: boolean;
  soundEnabled: boolean;
}

export interface SaveData {
  version: number;
  gameState: GameState;
  options: GameOptions;
  stats: {
    gamesPlayed: number;
    gamesWon: number;
    gamesLost: number;
    animalsCaptured: number;
  };
}

export interface MoveResult {
  success: boolean;
  reason?: string;
  gameState: GameState;
  capturedAnimal?: Animal;
  flippedAnimal?: Animal;
  winStatus?: GameStatus;
}
