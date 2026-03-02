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

export async function playFlipReveal(
  scene: Phaser.Scene,
  target: Phaser.GameObjects.Container,
  onReveal: () => void,
  reducedMotion: boolean
): Promise<void> {
  if (reducedMotion) {
    onReveal();
    return;
  }

  await tweenPromise(scene, {
    targets: target,
    scaleX: 0,
    duration: 110,
    ease: 'Cubic.easeIn'
  });

  onReveal();

  await tweenPromise(scene, {
    targets: target,
    scaleX: 1,
    duration: 120,
    ease: 'Cubic.easeOut'
  });
}
