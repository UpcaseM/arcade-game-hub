import Phaser from 'phaser';

export const LEGACY_SCENE_WIDTH = 1000;
export const LEGACY_SCENE_HEIGHT = 650;

function applyLegacyViewport(scene: Phaser.Scene): void {
  const camera = scene.cameras.main;
  const viewportWidth = scene.scale.width;
  const viewportHeight = scene.scale.height;

  const scale = Math.min(viewportWidth / LEGACY_SCENE_WIDTH, viewportHeight / LEGACY_SCENE_HEIGHT);
  const width = Math.round(LEGACY_SCENE_WIDTH * scale);
  const height = Math.round(LEGACY_SCENE_HEIGHT * scale);
  const x = Math.round((viewportWidth - width) / 2);
  const y = Math.round((viewportHeight - height) / 2);

  camera.setViewport(x, y, width, height);
  camera.setZoom(scale);
  camera.centerOn(LEGACY_SCENE_WIDTH / 2, LEGACY_SCENE_HEIGHT / 2);
}

export function bindLegacyViewport(scene: Phaser.Scene): void {
  const onResize = () => {
    applyLegacyViewport(scene);
  };

  onResize();
  scene.scale.on('resize', onResize);
  scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
    scene.scale.off('resize', onResize);
  });
}
