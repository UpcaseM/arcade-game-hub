export function getXpRequired(level: number): number {
  return Math.floor(48 + Math.pow(level - 1, 1.35) * 29);
}
