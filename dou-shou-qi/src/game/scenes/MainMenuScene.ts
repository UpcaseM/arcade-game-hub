import Phaser from 'phaser';
import { LobbyRoomSummary, loadLobbyProviderConfig, saveLobbyProviderConfig } from '../../net/lobbyStore';
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
  private roomListTexts: Phaser.GameObjects.Text[] = [];
  private roomsContainer?: Phaser.GameObjects.Container;
  private defaultName = 'Guest';

  constructor() {
    super('DouShouQiMainMenuScene');
  }

  create(): void {
    const settings = loadUiSettings();
    this.defaultName = readHubIdentity();

    this.add.rectangle(500, 325, 1000, 650, 0x112211, 1);
    this.add.rectangle(500, 325, 948, 590, 0x1d2e1b, 0.94).setStrokeStyle(2, 0x365f38, 1);

    this.add.text(500, 64, 'Dou Shou Qi', {
      fontSize: '58px',
      color: '#f0fdf4',
      fontFamily: 'Arial'
    }).setOrigin(0.5);
    this.add.text(500, 112, 'Forest Lobby + Local Mode', {
      fontSize: '22px',
      color: '#bbf7d0',
      fontFamily: 'Arial'
    }).setOrigin(0.5);

    this.add.text(500, 150, `Identity: ${this.defaultName}`, {
      fontSize: '19px',
      color: '#d1fae5',
      fontFamily: 'Arial'
    }).setOrigin(0.5);

    this.makeActionButton(212, 210, 'Start Local Match', async () => {
      this.scene.start('DouShouQiGameScene', { mode: 'local' as const });
    });

    this.makeActionButton(212, 258, 'Host Room', async () => {
      const name = window.prompt('Your player name', this.defaultName)?.trim();
      if (!name) {
        return;
      }

      const roomPassword = window.prompt('Optional room password (leave blank for open room)', '')?.trim() ?? '';
      try {
        const room = await onlineSession.hostRoom(name, roomPassword);
        this.scene.start('DouShouQiLobbyScene', { role: 'host', roomId: room.id });
      } catch (error) {
        window.alert(`Create room failed: ${String(error)}`);
      }
    });

    this.makeActionButton(212, 306, 'Refresh Room List', async () => {
      await this.refreshRooms();
    });

    this.makeActionButton(212, 354, 'Set Firebase Lobby URL', async () => {
      const config = loadLobbyProviderConfig();
      const nextUrl = window.prompt('Firebase Realtime Database URL (https://<project>.firebaseio.com)', config?.databaseUrl ?? '');
      if (!nextUrl) {
        return;
      }

      const authToken = window.prompt('Optional Firebase auth token for locked rules', config?.authToken ?? '') ?? '';
      saveLobbyProviderConfig({
        provider: 'firebase-rtdb',
        databaseUrl: nextUrl.trim(),
        authToken: authToken.trim() || undefined
      });
      window.alert('Lobby provider saved. Re-open Host/Join flow if one is active.');
      this.scene.restart();
    });

    this.makeActionButton(212, 402, 'Use Local Lobby Only', async () => {
      saveLobbyProviderConfig(null);
      window.alert('Switched to local-browser lobby fallback.');
      this.scene.restart();
    });

    this.makeActionButton(212, 450, 'Tutorial', async () => {
      this.scene.start('DouShouQiTutorialScene');
    });

    this.add.text(660, 198, 'Open Rooms', {
      fontFamily: 'Arial',
      fontSize: '30px',
      color: '#ecfdf5'
    }).setOrigin(0.5);

    this.roomsContainer = this.add.container(430, 226);

    const reducedMotionButton = this.makeToggleButton(90, 560, () => `Reduced Motion: ${settings.reducedMotion ? 'On' : 'Off'}`, () => {
      settings.reducedMotion = !settings.reducedMotion;
      saveUiSettings(settings);
    });

    const colorAssistButton = this.makeToggleButton(90, 596, () => `Color Assist: ${settings.colorAssist ? 'On' : 'Off'}`, () => {
      settings.colorAssist = !settings.colorAssist;
      saveUiSettings(settings);
    });

    const musicMuteButton = this.makeToggleButton(390, 560, () => `Music Mute: ${settings.musicMuted ? 'On' : 'Off'}`, () => {
      settings.musicMuted = !settings.musicMuted;
      saveUiSettings(settings);
    });

    const sfxMuteButton = this.makeToggleButton(390, 596, () => `SFX Mute: ${settings.sfxMuted ? 'On' : 'Off'}`, () => {
      settings.sfxMuted = !settings.sfxMuted;
      saveUiSettings(settings);
    });

    const musicVolButton = this.makeToggleButton(640, 560, () => `Music Vol: ${Math.round(settings.musicVolume * 100)}%`, () => {
      settings.musicVolume = clampVolume(settings.musicVolume >= 1 ? 0 : settings.musicVolume + 0.1);
      saveUiSettings(settings);
    });

    const sfxVolButton = this.makeToggleButton(640, 596, () => `SFX Vol: ${Math.round(settings.sfxVolume * 100)}%`, () => {
      settings.sfxVolume = clampVolume(settings.sfxVolume >= 1 ? 0 : settings.sfxVolume + 0.1);
      saveUiSettings(settings);
    });

    this.add.existing(reducedMotionButton);
    this.add.existing(colorAssistButton);
    this.add.existing(musicMuteButton);
    this.add.existing(sfxMuteButton);
    this.add.existing(musicVolButton);
    this.add.existing(sfxVolButton);

    const config = loadLobbyProviderConfig();
    this.add.text(500, 630, config ? `Lobby Provider: Firebase (${config.databaseUrl})` : 'Lobby Provider: Local browser fallback (same-device only)', {
      fontSize: '14px',
      color: '#a7f3d0',
      fontFamily: 'Arial'
    }).setOrigin(0.5);

    void this.refreshRooms();
  }

  private async refreshRooms(): Promise<void> {
    if (!this.roomsContainer) {
      return;
    }

    try {
      const rooms = await onlineSession.listOpenRooms();
      this.renderRooms(rooms);
    } catch (error) {
      this.renderRooms([]);
      const text = this.add.text(430, 560, `Room refresh failed: ${String(error)}`, {
        fontFamily: 'Arial',
        fontSize: '14px',
        color: '#fecaca'
      });
      this.roomListTexts.push(text);
      this.time.delayedCall(2400, () => text.destroy());
    }
  }

  private renderRooms(rooms: LobbyRoomSummary[]): void {
    this.roomListTexts.forEach((text) => text.destroy());
    this.roomListTexts = [];
    this.roomsContainer?.removeAll(true);

    if (!this.roomsContainer) {
      return;
    }

    if (rooms.length === 0) {
      const emptyText = this.add.text(0, 0, 'No open rooms right now. Create one as host.', {
        fontFamily: 'Arial',
        fontSize: '20px',
        color: '#d1fae5',
        wordWrap: { width: 470 }
      });
      this.roomsContainer.add(emptyText);
      this.roomListTexts.push(emptyText);
      return;
    }

    rooms.slice(0, 7).forEach((room, index) => {
      const y = index * 54;
      const roomText = this.add.text(0, y, `${room.locked ? '🔒' : '🔓'} ${room.hostName}  ·  Room ${room.id}`, {
        fontFamily: 'Arial',
        fontSize: '19px',
        color: '#ecfdf5'
      });

      const joinButton = this.add.text(390, y, 'Join', {
        fontFamily: 'Arial',
        fontSize: '19px',
        color: '#052e16',
        backgroundColor: '#86efac',
        padding: { x: 10, y: 4 }
      });
      joinButton.setInteractive({ useHandCursor: true });
      joinButton.on('pointerdown', () => {
        void this.joinRoom(room);
      });

      this.roomsContainer?.add(roomText);
      this.roomsContainer?.add(joinButton);
      this.roomListTexts.push(roomText, joinButton);
    });
  }

  private async joinRoom(room: LobbyRoomSummary): Promise<void> {
    const name = window.prompt('Your player name', this.defaultName)?.trim();
    if (!name) {
      return;
    }

    let password = '';
    if (room.locked) {
      password = window.prompt('Room password', '')?.trim() ?? '';
      if (!password) {
        return;
      }
    }

    try {
      await onlineSession.joinRoom(name, room.id, password);
      this.scene.start('DouShouQiLobbyScene', { role: 'guest', roomId: room.id });
    } catch (error) {
      window.alert(`Join room failed: ${String(error)}`);
      await this.refreshRooms();
    }
  }

  private makeActionButton(x: number, y: number, label: string, onClick: () => Promise<void>): Phaser.GameObjects.Text {
    const text = this.add.text(x, y, label, {
      fontFamily: 'Arial',
      fontSize: '24px',
      color: '#ecfdf5',
      backgroundColor: '#166534',
      padding: { x: 12, y: 8 }
    });
    text.setInteractive({ useHandCursor: true });
    text.on('pointerdown', () => {
      void onClick();
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
      fontSize: '18px',
      color: '#14532d',
      backgroundColor: '#d1fae5',
      padding: { x: 8, y: 4 }
    });

    text.setInteractive({ useHandCursor: true });
    text.on('pointerdown', () => {
      onToggle();
      text.setText(getLabel());
    });

    return text;
  }
}
