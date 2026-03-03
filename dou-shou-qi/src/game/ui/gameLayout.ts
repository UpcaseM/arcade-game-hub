import { BOARD_COLS, BOARD_ROWS, CELL_SIZE } from '../../data/gameData';

const MIN_CELL_SIZE = 56;

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export interface GameLayout {
  sceneWidth: number;
  sceneHeight: number;
  isMobile: boolean;
  isPortrait: boolean;
  sidePadding: number;
  topArea: number;
  bottomArea: number;
  boardX: number;
  boardY: number;
  boardWidth: number;
  boardHeight: number;
  cellSize: number;
  pieceScale: number;
  hintInset: number;
  hintDotRadius: number;
}

export function isMobileViewport(width: number, height: number): boolean {
  return width <= 860 || height > width;
}

export function computeGameLayout(sceneWidth: number, sceneHeight: number): GameLayout {
  const isPortrait = sceneHeight > sceneWidth;
  const isMobile = isMobileViewport(sceneWidth, sceneHeight);

  const sidePadding = isMobile ? Math.max(10, Math.round(sceneWidth * 0.03)) : 24;
  const topArea = isMobile ? (isPortrait ? 98 : 74) : 132;
  const bottomArea = isMobile ? (isPortrait ? 128 : 74) : 90;

  const maxBoardWidth = Math.max(MIN_CELL_SIZE * BOARD_COLS, sceneWidth - sidePadding * 2);
  const maxBoardHeight = Math.max(MIN_CELL_SIZE * BOARD_ROWS, sceneHeight - topArea - bottomArea);

  const desiredBoardSize = Math.min(maxBoardWidth, maxBoardHeight);
  const cellSize = Math.max(MIN_CELL_SIZE, Math.floor(desiredBoardSize / BOARD_COLS));
  const boardWidth = cellSize * BOARD_COLS;
  const boardHeight = cellSize * BOARD_ROWS;

  const boardX = Math.round((sceneWidth - boardWidth) / 2);
  const availableBoardTop = topArea;
  const availableBoardHeight = Math.max(boardHeight, sceneHeight - topArea - bottomArea);
  const boardY = Math.round(availableBoardTop + Math.max(0, (availableBoardHeight - boardHeight) / 2));

  return {
    sceneWidth,
    sceneHeight,
    isMobile,
    isPortrait,
    sidePadding,
    topArea,
    bottomArea,
    boardX,
    boardY,
    boardWidth,
    boardHeight,
    cellSize,
    pieceScale: clamp(cellSize / CELL_SIZE, 0.62, 1.34),
    hintInset: clamp(Math.round(cellSize * 0.13), 6, 20),
    hintDotRadius: clamp(Math.round(cellSize * 0.06), 4, 10)
  };
}
