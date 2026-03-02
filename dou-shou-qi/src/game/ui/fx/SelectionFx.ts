import Phaser from 'phaser';

export function startSelectionPulse(
  scene: Phaser.Scene,
  target: Phaser.GameObjects.Container,
  reducedMotion: boolean
): Phaser.Tweens.Tween | undefined {
  if (reducedMotion) {
    return undefined;
  }

  target.setScale(1);
  return scene.tweens.add({
    targets: target,
    scale: 1.06,
    duration: 330,
    ease: 'Sine.easeInOut',
    yoyo: true,
    repeat: -1
  });
}
