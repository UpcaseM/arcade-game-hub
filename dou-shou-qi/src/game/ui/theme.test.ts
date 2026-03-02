import { describe, expect, it } from 'vitest';
import { getPlayerIdentity } from './theme';

describe('player identity theme', () => {
  it('returns deterministic side mapping', () => {
    const blue = getPlayerIdentity('blue');
    const red = getPlayerIdentity('red');

    expect(blue.badgeShape).toBe('circle');
    expect(red.badgeShape).toBe('diamond');
    expect(blue.shortLabel).not.toBe(red.shortLabel);
  });
});
