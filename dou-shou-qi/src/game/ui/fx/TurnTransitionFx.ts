import Phaser from 'phaser';

export function showTurnTransition(
  scene: Phaser.Scene,
  text: string,
  color: string,
  reducedMotion: boolean
): void {
  const banner = scene.add.text(500, 620, text, {
    fontFamily: 'Arial',
    fontSize: '24px',
    color,
    backgroundColor: '#0f172a',
    padding: { x: 10, y: 4 }
  });
  banner.setOrigin(0.5);
  banner.setDepth(20);

  if (reducedMotion) {
    scene.tweens.add({
      targets: banner,
      alpha: 0,
      duration: 260,
      onComplete: () => banner.destroy()
    });
    return;
  }

  banner.setY(650);
  scene.tweens.add({
    targets: banner,
    y: 598,
    alpha: 1,
    duration: 140,
    ease: 'Back.easeOut'
  });
  scene.tweens.add({
    targets: banner,
    delay: 600,
    y: 560,
    alpha: 0,
    duration: 220,
    ease: 'Cubic.easeIn',
    onComplete: () => banner.destroy()
  });
}
