import { describe, expect, it } from 'vitest';
import { BOARD_COLS } from '../../data/gameData';
import { computeGameLayout, isMobileViewport } from './gameLayout';

describe('gameLayout', () => {
  it('detects portrait phone viewport as mobile', () => {
    expect(isMobileViewport(390, 844)).toBe(true);
  });

  it('keeps desktop viewport as non-mobile', () => {
    expect(isMobileViewport(1366, 768)).toBe(false);
  });

  it('expands board close to full width on portrait mobile', () => {
    const layout = computeGameLayout(390, 844);
    expect(layout.isMobile).toBe(true);
    expect(layout.isPortrait).toBe(true);
    expect(layout.boardWidth).toBeGreaterThanOrEqual(360);
    expect(layout.boardX).toBeGreaterThanOrEqual(0);
  });

  it('snaps board size to full cell units and scales pieces', () => {
    const layout = computeGameLayout(1000, 650);
    expect(layout.boardWidth % BOARD_COLS).toBe(0);
    expect(layout.pieceScale).toBeGreaterThan(0.9);
    expect(layout.pieceScale).toBeLessThanOrEqual(1.34);
  });
});
