import Phaser from 'phaser';

export function startSelectionPulse(
  scene: Phaser.Scene,
  target: Phaser.GameObjects.Container,
  reducedMotion: boolean,
  baseScale = 1
): Phaser.Tweens.Tween | undefined {
  if (reducedMotion) {
    return undefined;
  }

  target.setScale(baseScale);
  return scene.tweens.add({
    targets: target,
    scale: baseScale * 1.06,
    duration: 330,
    ease: 'Sine.easeInOut',
    yoyo: true,
    repeat: -1
  });
}
