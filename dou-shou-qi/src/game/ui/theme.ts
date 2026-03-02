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
  primaryColor: 0x60a5fa,
  accentColor: 0x0ea5e9,
  textColor: '#dbeafe',
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
  panelBg: 0x111827,
  panelBorder: 0x334155,
  textPrimary: '#e2e8f0',
  textSecondary: '#94a3b8',
  boardBg: 0x0b1220,
  boardLine: 0x1e293b,
  boardOuter: 0x334155,
  hiddenPieceBg: 0x334155,
  hiddenPieceText: '#f8fafc'
} as const;

export function getPlayerIdentity(color: PlayerColor): PlayerIdentity {
  return color === 'blue' ? BLUE_IDENTITY : RED_IDENTITY;
}
