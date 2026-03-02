import Phaser from 'phaser';
import { LobbyRoom } from '../../net/lobbyStore';
import { onlineSession } from '../../net/onlineSession';

type LobbyRole = 'host' | 'guest';

export class DouShouQiLobbyScene extends Phaser.Scene {
  private role: LobbyRole = 'guest';
  private roomId = '';
  private titleText!: Phaser.GameObjects.Text;
  private roomText!: Phaser.GameObjects.Text;
  private statusText!: Phaser.GameObjects.Text;
  private networkText!: Phaser.GameObjects.Text;
  private startButton?: Phaser.GameObjects.Text;

  constructor() {
    super('DouShouQiLobbyScene');
  }

  init(data: { role?: LobbyRole; roomId?: string }): void {
    this.role = data?.role ?? 'guest';
    this.roomId = data?.roomId ?? onlineSession.getCurrentRoom()?.id ?? '';
  }

  create(): void {
    this.add.rectangle(500, 325, 1000, 650, 0x112110, 1);
    this.add.rectangle(500, 325, 940, 560, 0x1d2d1a, 0.95).setStrokeStyle(2, 0x4c7a48, 1);

    this.titleText = this.add.text(500, 80, this.role === 'host' ? 'Room Lobby (Host)' : 'Room Lobby (Guest)', {
      fontFamily: 'Arial',
      fontSize: '44px',
      color: '#ecfdf5'
    }).setOrigin(0.5);

    this.roomText = this.add.text(500, 132, '', {
      fontFamily: 'Arial',
      fontSize: '20px',
      color: '#bbf7d0'
    }).setOrigin(0.5);

    this.statusText = this.add.text(500, 188, '', {
      fontFamily: 'Arial',
      fontSize: '22px',
      color: '#e2e8f0',
      align: 'center'
    }).setOrigin(0.5);

    this.networkText = this.add.text(500, 240, '', {
      fontFamily: 'Arial',
      fontSize: '18px',
      color: '#cbd5e1',
      align: 'center'
    }).setOrigin(0.5);

    const leaveButton = this.makeButton(500, 530, 'Leave Lobby', '#14532d', () => {
      onlineSession.closeRoom();
      this.scene.start('DouShouQiMainMenuScene');
    });
    leaveButton.setOrigin(0.5);

    const reconnectButton = this.makeButton(500, 464, 'Reconnect Channel', '#0f766e', async () => {
      try {
        if (onlineSession.getRole() === 'host') {
          await onlineSession.reconnectHost();
        } else {
          await onlineSession.reconnectGuest();
        }
      } catch (error) {
        this.statusText.setText(`Reconnect failed: ${String(error)}`);
      }
    });
    reconnectButton.setOrigin(0.5);

    if (this.role === 'host') {
      this.startButton = this.makeButton(500, 396, 'Start Match', '#166534', async () => {
        try {
          const seed = await onlineSession.startMatch();
          this.scene.start('DouShouQiGameScene', { mode: 'online' as const, seed, started: true });
        } catch (error) {
          this.statusText.setText(`Cannot start: ${String(error)}`);
        }
      });
      this.startButton.setOrigin(0.5);
    }

    onlineSession.setListener({
      onStatus: () => {
        this.renderLobbyState(onlineSession.getCurrentRoom());
      },
      onRoom: (room) => {
        this.renderLobbyState(room);
      },
      onMatchStart: (seed) => {
        this.scene.start('DouShouQiGameScene', { mode: 'online' as const, seed, started: true });
      }
    });

    this.renderLobbyState(onlineSession.getCurrentRoom());
  }

  private renderLobbyState(room: LobbyRoom | null): void {
    if (!room) {
      const current = this.roomId ? `Room ${this.roomId}` : 'Room pending';
      this.roomText.setText(`${current} (syncing...)`);
      this.statusText.setText('Lobby sync is temporarily unavailable.\nWaiting for room update...');
      this.networkText.setText(`Channel: ${onlineSession.getStatus()} | You: ${onlineSession.getLocalName()} | Opponent: ${onlineSession.getRemoteName()}`);
      if (this.startButton) {
        this.startButton.setAlpha(0.45);
        this.startButton.disableInteractive();
      }
      return;
    }

    this.roomId = room.id;
    this.roomText.setText(`Room ${this.roomId}${room.locked ? '  |  Locked' : ''}`);

    const guest = room.guestName ? room.guestName : 'Waiting for guest';
    const canStart = this.role === 'host' && room.guestName && onlineSession.getStatus() === 'connected';
    this.statusText.setText([
      `Host: ${room.hostName}`,
      `Guest: ${guest}`,
      `Room status: ${room.status}`,
      canStart ? 'Guest connected. Host can start.' : 'Waiting for connection...'
    ].join('\n'));

    this.networkText.setText(`Channel: ${onlineSession.getStatus()} | You: ${onlineSession.getLocalName()} | Opponent: ${onlineSession.getRemoteName()}`);

    if (this.startButton) {
      this.startButton.setAlpha(canStart ? 1 : 0.45);
      this.startButton.disableInteractive();
      if (canStart) {
        this.startButton.setInteractive({ useHandCursor: true });
      }
    }
  }

  private makeButton(
    x: number,
    y: number,
    label: string,
    color: string,
    onClick: () => void | Promise<void>
  ): Phaser.GameObjects.Text {
    const button = this.add.text(x, y, label, {
      fontFamily: 'Arial',
      fontSize: '28px',
      color: '#f0fdf4',
      backgroundColor: color,
      padding: { x: 14, y: 9 }
    });
    button.setInteractive({ useHandCursor: true });
    button.on('pointerdown', () => {
      void onClick();
    });
    return button;
  }
}
