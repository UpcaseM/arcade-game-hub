import Phaser from 'phaser';
import { onlineSession } from '../../net/onlineSession';
import { loadUiSettings, saveUiSettings } from '../ui/settings';

const ACTIVE_USER_KEY = 'arcade_active_user_v1';

function readHubIdentity(): string {
  try {
    const raw = localStorage.getItem(ACTIVE_USER_KEY);
    if (!raw) {
      return 'Guest';
    }
    const parsed = JSON.parse(raw) as { username?: string };
    return parsed.username || 'Guest';
  } catch {
    return 'Guest';
  }
}

function clampVolume(value: number): number {
  return Math.max(0, Math.min(1, Number(value.toFixed(2))));
}

export class DouShouQiMainMenuScene extends Phaser.Scene {
  constructor() {
    super('DouShouQiMainMenuScene');
  }

  create(): void {
    const settings = loadUiSettings();
    const defaultName = readHubIdentity();

    this.add.rectangle(500, 325, 1000, 650, 0x0b1426, 1);
    this.add.text(500, 84, 'Dou Shou Qi', { fontSize: '62px', color: '#e2e8f0', fontFamily: 'Arial' }).setOrigin(0.5);
    this.add.text(500, 134, 'Online MVP + Local Mode', { fontSize: '23px', color: '#93c5fd', fontFamily: 'Arial' }).setOrigin(0.5);

    this.add.text(500, 186, `Identity: ${defaultName}`, { fontSize: '20px', color: '#cbd5e1', fontFamily: 'Arial' }).setOrigin(0.5);

    this.makeActionButton(500, 242, 'Start Local Match', () => {
      this.scene.start('DouShouQiGameScene', { mode: 'local' as const });
    });

    this.makeActionButton(500, 290, 'Host Online Room', async () => {
      const name = window.prompt('Your player name', defaultName)?.trim();
      if (!name) {
        return;
      }

      try {
        const offer = await onlineSession.host(name);
        window.prompt('Share this OFFER code with opponent', offer);
        const answer = window.prompt('Paste ANSWER code from opponent');
        if (!answer) {
          return;
        }
        await onlineSession.hostAcceptAnswer(answer.trim());
        window.alert('Waiting for peer data channel to open...');
        this.scene.start('DouShouQiGameScene', { mode: 'online' as const });
      } catch (error) {
        window.alert(`Host setup failed: ${String(error)}`);
      }
    });

    this.makeActionButton(500, 338, 'Join Online Room', async () => {
      const name = window.prompt('Your player name', defaultName)?.trim();
      if (!name) {
        return;
      }
      const offer = window.prompt('Paste OFFER code from host');
      if (!offer) {
        return;
      }
      try {
        const answer = await onlineSession.join(name, offer.trim());
        window.prompt('Send this ANSWER code back to host', answer);
        window.alert('Waiting for host data channel...');
        this.scene.start('DouShouQiGameScene', { mode: 'online' as const });
      } catch (error) {
        window.alert(`Join failed: ${String(error)}`);
      }
    });

    const reconnectLabel = onlineSession.getStatus() === 'disconnected' ? 'Reconnect Session' : 'Reset Online Session';
    this.makeActionButton(500, 386, reconnectLabel, () => {
      onlineSession.reset();
      window.alert('Online session reset.');
    });

    this.add.text(500, 440, 'Settings', { fontFamily: 'Arial', fontSize: '26px', color: '#f8fafc' }).setOrigin(0.5);

    const reducedMotionButton = this.makeToggleButton(280, 474, () => `Reduced Motion: ${settings.reducedMotion ? 'On' : 'Off'}`, () => {
      settings.reducedMotion = !settings.reducedMotion;
      saveUiSettings(settings);
    });

    const colorAssistButton = this.makeToggleButton(280, 512, () => `Color Assist: ${settings.colorAssist ? 'On' : 'Off'}`, () => {
      settings.colorAssist = !settings.colorAssist;
      saveUiSettings(settings);
    });

    const musicMuteButton = this.makeToggleButton(280, 550, () => `Music Mute: ${settings.musicMuted ? 'On' : 'Off'}`, () => {
      settings.musicMuted = !settings.musicMuted;
      saveUiSettings(settings);
    });

    const sfxMuteButton = this.makeToggleButton(280, 588, () => `SFX Mute: ${settings.sfxMuted ? 'On' : 'Off'}`, () => {
      settings.sfxMuted = !settings.sfxMuted;
      saveUiSettings(settings);
    });

    const musicVolButton = this.makeToggleButton(560, 474, () => `Music Vol: ${Math.round(settings.musicVolume * 100)}%`, () => {
      settings.musicVolume = clampVolume(settings.musicVolume >= 1 ? 0 : settings.musicVolume + 0.1);
      saveUiSettings(settings);
    });

    const sfxVolButton = this.makeToggleButton(560, 512, () => `SFX Vol: ${Math.round(settings.sfxVolume * 100)}%`, () => {
      settings.sfxVolume = clampVolume(settings.sfxVolume >= 1 ? 0 : settings.sfxVolume + 0.1);
      saveUiSettings(settings);
    });

    this.add.existing(reducedMotionButton);
    this.add.existing(colorAssistButton);
    this.add.existing(musicMuteButton);
    this.add.existing(sfxMuteButton);
    this.add.existing(musicVolButton);
    this.add.existing(sfxVolButton);

    this.add.text(500, 625, 'No backend: manual signaling + STUN only (some networks may fail).', {
      fontSize: '14px',
      color: '#94a3b8',
      fontFamily: 'Arial'
    }).setOrigin(0.5);
  }

  private makeActionButton(x: number, y: number, label: string, onClick: () => void): Phaser.GameObjects.Text {
    const text = this.add.text(x, y, label, {
      fontFamily: 'Arial',
      fontSize: '26px',
      color: '#f8fafc',
      backgroundColor: '#1d4ed8',
      padding: { x: 12, y: 8 }
    });
    text.setOrigin(0.5);
    text.setInteractive({ useHandCursor: true });
    text.on('pointerdown', () => {
      onClick();
    });
    return text;
  }

  private makeToggleButton(
    x: number,
    y: number,
    getLabel: () => string,
    onToggle: () => void
  ): Phaser.GameObjects.Text {
    const text = this.add.text(x, y, getLabel(), {
      fontFamily: 'Arial',
      fontSize: '20px',
      color: '#1d4ed8',
      backgroundColor: '#dbeafe',
      padding: { x: 8, y: 5 }
    });

    text.setInteractive({ useHandCursor: true });
    text.on('pointerdown', () => {
      onToggle();
      text.setText(getLabel());
    });

    return text;
  }
}

