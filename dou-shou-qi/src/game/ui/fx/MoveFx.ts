import Phaser from 'phaser';

function tweenPromise(scene: Phaser.Scene, config: Phaser.Types.Tweens.TweenBuilderConfig): Promise<void> {
  return new Promise((resolve) => {
    scene.tweens.add({
      ...config,
      onComplete: () => {
        config.onComplete?.(undefined as never, [] as never[]);
        resolve();
      }
    });
  });
}

export async function playMoveTween(
  scene: Phaser.Scene,
  target: Phaser.GameObjects.Container,
  x: number,
  y: number,
  reducedMotion: boolean
): Promise<void> {
  if (reducedMotion) {
    target.setPosition(x, y);
    return;
  }

  await tweenPromise(scene, {
    targets: target,
    x,
    y,
    duration: 190,
    ease: 'Cubic.easeOut'
  });
}

export function showMoveTrail(
  scene: Phaser.Scene,
  from: { x: number; y: number },
  to: { x: number; y: number },
  color: number,
  reducedMotion: boolean
): void {
  const trail = scene.add.graphics();
  trail.lineStyle(4, color, reducedMotion ? 0.35 : 0.5);
  trail.lineBetween(from.x, from.y, to.x, to.y);
  trail.setDepth(2);

  scene.tweens.add({
    targets: trail,
    alpha: 0,
    duration: reducedMotion ? 110 : 180,
    ease: 'Quad.easeOut',
    onComplete: () => trail.destroy()
  });
}
