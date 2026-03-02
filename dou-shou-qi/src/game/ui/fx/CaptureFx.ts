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

export async function playCaptureImpact(
  scene: Phaser.Scene,
  at: { x: number; y: number },
  capturedTarget: Phaser.GameObjects.Container,
  reducedMotion: boolean
): Promise<void> {
  const burst = scene.add.circle(at.x, at.y, 8, 0xfbbf24, 0.35);
  burst.setStrokeStyle(2, 0xf59e0b, 0.9);
  burst.setDepth(5);

  scene.tweens.add({
    targets: burst,
    radius: reducedMotion ? 24 : 34,
    alpha: 0,
    duration: reducedMotion ? 120 : 180,
    onComplete: () => burst.destroy()
  });

  if (reducedMotion) {
    capturedTarget.setVisible(false);
    return;
  }

  await tweenPromise(scene, {
    targets: capturedTarget,
    scale: 0.3,
    alpha: 0,
    duration: 140,
    ease: 'Quad.easeIn'
  });
}
