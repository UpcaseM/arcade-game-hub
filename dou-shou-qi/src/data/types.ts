export type PlayerColor = 'blue' | 'red';
export type GameStatus = 'playing' | 'blue_won' | 'red_won' | 'blue_resigned' | 'red_resigned';

export interface Animal {
  id: string;
  name: string;
  rank: number;
  color: PlayerColor;
  col: number;
  row: number;
}

export interface BoardCell {
  col: number;
  row: number;
  type: 'land' | 'river' | 'den' | 'trap';
  owner?: PlayerColor;
}

export interface GameState {
  board: BoardCell[][];
  animals: Record<string, Animal>;
  currentPlayer: PlayerColor;
  status: GameStatus;
  selectedAnimalId?: string;
  validMoves?: { col: number; row: number }[];
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
  winStatus?: GameStatus;
}