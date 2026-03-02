import { PlayerColor } from '../../data/types';

export type BadgeShape = 'circle' | 'diamond';
export type PatternStyle = 'dots' | 'stripes';

export interface PlayerIdentity {
  color: PlayerColor;
  label: string;
  shortLabel: string;
  primaryColor: number;
  accentColor: number;
  textColor: string;
  badgeShape: BadgeShape;
  pattern: PatternStyle;
}

const BLUE_IDENTITY: PlayerIdentity = {
  color: 'blue',
  label: 'Azure Side',
  shortLabel: 'AZR',
  primaryColor: 0x5ec4ff,
  accentColor: 0x38bdf8,
  textColor: '#e0f2fe',
  badgeShape: 'circle',
  pattern: 'dots'
};

const RED_IDENTITY: PlayerIdentity = {
  color: 'red',
  label: 'Crimson Side',
  shortLabel: 'CRM',
  primaryColor: 0xf87171,
  accentColor: 0xfb7185,
  textColor: '#fee2e2',
  badgeShape: 'diamond',
  pattern: 'stripes'
};

export const NEUTRAL_COLORS = {
  panelBg: 0x162417,
  panelBorder: 0x3f5b3c,
  textPrimary: '#ecfdf5',
  textSecondary: '#bbf7d0',
  boardBg: 0x2a3f24,
  boardLine: 0x49673f,
  boardOuter: 0x6b4f30,
  hiddenPieceBg: 0x425f3b,
  hiddenPieceText: '#f0fdf4'
} as const;

export function getPlayerIdentity(color: PlayerColor): PlayerIdentity {
  return color === 'blue' ? BLUE_IDENTITY : RED_IDENTITY;
}
