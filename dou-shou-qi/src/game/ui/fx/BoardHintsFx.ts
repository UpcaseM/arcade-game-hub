import Phaser from 'phaser';

export function flashCells(
  scene: Phaser.Scene,
  cells: Array<{ col: number; row: number }>,
  cellToPoint: (col: number, row: number) => { x: number; y: number },
  color: number,
  reducedMotion: boolean
): void {
  const hold = reducedMotion ? 140 : 260;

  cells.forEach((cell) => {
    const point = cellToPoint(cell.col, cell.row);
    const marker = scene.add.rectangle(point.x, point.y, 84, 84, color, 0.14);
    marker.setStrokeStyle(2, color, 0.9);
    marker.setDepth(3);

    scene.tweens.add({
      targets: marker,
      alpha: 0,
      duration: hold,
      ease: 'Quad.easeOut',
      onComplete: () => marker.destroy()
    });
  });
}
