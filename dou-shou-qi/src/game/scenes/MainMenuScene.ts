import Phaser from 'phaser';
import {
  LobbyRoomSummary,
  resolveLobbyProviderConfig,
  saveLobbyProviderConfig,
  saveLocalOnlyLobbyConfig
} from '../../net/lobbyStore';
import { onlineSession } from '../../net/onlineSession';
import { loadUiSettings, saveUiSettings } from '../ui/settings';
import { bindLegacyViewport } from '../ui/legacySceneViewport';

const ACTIVE_USER_KEY = 'arcade_active_user_v1';

type InputField = {
  container: Phaser.GameObjects.Container;
  box: Phaser.GameObjects.Rectangle;
  valueText: Phaser.GameObjects.Text;
  value: string;
  placeholder: string;
  secret: boolean;
  maxLength: number;
};

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

function trimDisplay(value: string, max = 60): string {
  return value.length <= max ? value : `${value.slice(0, max - 3)}...`;
}

export class DouShouQiMainMenuScene extends Phaser.Scene {
  private roomListTexts: Phaser.GameObjects.Text[] = [];
  private roomsContainer?: Phaser.GameObjects.Container;
  private allRooms: LobbyRoomSummary[] = [];
  private roomPage = 0;
  private readonly roomPageSize = 7;
  private prevRoomsButton?: Phaser.GameObjects.Text;
  private nextRoomsButton?: Phaser.GameObjects.Text;
  private roomPageText?: Phaser.GameObjects.Text;
  private defaultName = 'Guest';
  private focusedField: InputField | null = null;
  private detailsVisible = false;
  private nameField?: InputField;
  private hostPasswordField?: InputField;
  private joinPasswordField?: InputField;
  private providerUrlField?: InputField;
  private providerTokenField?: InputField;
  private providerText?: Phaser.GameObjects.Text;
  private toastText?: Phaser.GameObjects.Text;
  private toastTimer?: Phaser.Time.TimerEvent;
  private detailsToggleLabel?: Phaser.GameObjects.Text;
  private detailsObjects: Array<Phaser.GameObjects.Container | Phaser.GameObjects.Rectangle | Phaser.GameObjects.Text> = [];
  private joinInFlight = false;

  constructor() {
    super('DouShouQiMainMenuScene');
  }

  create(): void {
    bindLegacyViewport(this);

    const settings = loadUiSettings();
    this.defaultName = readHubIdentity();

    const resolvedProvider = resolveLobbyProviderConfig();

    this.add.rectangle(500, 325, 1000, 650, 0x112211, 1);
    this.add.rectangle(500, 325, 948, 590, 0x1d2e1b, 0.94).setStrokeStyle(2, 0x365f38, 1);
    this.add.rectangle(265, 355, 350, 458, 0x0f1f12, 0.38).setStrokeStyle(1, 0x365f38, 0.7);
    this.add.rectangle(724, 355, 534, 458, 0x0f1f12, 0.38).setStrokeStyle(1, 0x365f38, 0.7);

    this.add.text(500, 60, 'Dou Shou Qi', {
      fontSize: '48px',
      color: '#f0fdf4',
      fontFamily: 'Arial'
    }).setOrigin(0.5);
    this.add.text(500, 106, 'Forest Lobby + Local Mode', {
      fontSize: '19px',
      color: '#bbf7d0',
      fontFamily: 'Arial'
    }).setOrigin(0.5);

    this.add.text(82, 136, 'Quick Start', {
      fontFamily: 'Arial',
      fontSize: '24px',
      color: '#dcfce7'
    });
    this.nameField = this.createInputField(82, 166, 330, 'Player Name', this.defaultName);
    this.hostPasswordField = this.createInputField(82, 232, 330, 'Host Room Password (optional)', '', true);
    this.joinPasswordField = this.createInputField(82, 298, 330, 'Join Password (if room is locked)', '', true);

    this.makeActionButton(82, 364, 'Start Local Match', async () => {
      this.scene.start('DouShouQiGameScene', { mode: 'local' as const });
    });

    this.makeActionButton(82, 412, 'Host Room', async () => {
      const name = this.nameField?.value.trim() ?? '';
      if (!name) {
        this.showToast('Enter a player name first.');
        this.focusInput(this.nameField);
        return;
      }

      try {
        const room = await onlineSession.hostRoom(name, this.hostPasswordField?.value.trim() ?? '');
        this.scene.start('DouShouQiLobbyScene', { role: 'host', roomId: room.id });
      } catch (error) {
        this.showToast(`Create room failed: ${String(error)}`);
      }
    });

    this.makeActionButton(82, 460, 'Refresh Room List', async () => {
      await this.refreshRooms();
    });

    this.detailsToggleLabel = this.makeActionButton(82, 508, 'Show Details', async () => {
      this.setDetailsVisible(!this.detailsVisible);
    });

    this.makeActionButton(82, 556, 'Tutorial', async () => {
      this.scene.start('DouShouQiTutorialScene');
    });

    this.add.text(724, 142, 'Open Rooms', {
      fontFamily: 'Arial',
      fontSize: '34px',
      color: '#ecfdf5'
    }).setOrigin(0.5);

    this.add.text(724, 176, 'Host creates room. Guest taps Join with password only if locked.', {
      fontFamily: 'Arial',
      fontSize: '14px',
      color: '#bef264',
      wordWrap: { width: 480 },
      align: 'center'
    }).setOrigin(0.5);

    this.roomsContainer = this.add.container(464, 216);
    this.prevRoomsButton = this.makePageButton(520, 186, 'Prev', -1);
    this.nextRoomsButton = this.makePageButton(920, 186, 'Next', 1);
    this.roomPageText = this.add.text(724, 186, 'Page 1/1', {
      fontFamily: 'Arial',
      fontSize: '14px',
      color: '#bbf7d0'
    }).setOrigin(0.5);

    this.providerText = this.add.text(500, 627, '', {
      fontSize: '14px',
      color: '#a7f3d0',
      fontFamily: 'Arial'
    }).setOrigin(0.5);

    this.toastText = this.add.text(500, 28, '', {
      fontFamily: 'Arial',
      fontSize: '16px',
      color: '#fef9c3',
      backgroundColor: '#14532d',
      padding: { x: 8, y: 4 }
    }).setOrigin(0.5);
    this.toastText.setDepth(80);
    this.toastText.setVisible(false);

    const detailsBackdrop = this.add.rectangle(500, 325, 1000, 650, 0x000000, 0.72);
    detailsBackdrop.setDepth(60);
    detailsBackdrop.setInteractive();
    detailsBackdrop.on('pointerdown', () => {
      this.focusInput(null);
    });

    const detailsPanel = this.add.rectangle(500, 336, 760, 432, 0x122215, 0.98).setStrokeStyle(2, 0x4f774f, 1);
    detailsPanel.setDepth(61);

    const detailsTitle = this.add.text(500, 156, 'Details & Network Settings', {
      fontFamily: 'Arial',
      fontSize: '34px',
      color: '#dcfce7'
    }).setOrigin(0.5);
    detailsTitle.setDepth(62);

    const detailsHint = this.add.text(500, 194, 'Use this only when you need remote lobby provider or accessibility presets.', {
      fontFamily: 'Arial',
      fontSize: '15px',
      color: '#bbf7d0',
      wordWrap: { width: 690 },
      align: 'center'
    }).setOrigin(0.5);
    detailsHint.setDepth(62);

    this.providerUrlField = this.createInputField(
      186,
      220,
      628,
      'Lobby URL (Firebase RTDB)',
      resolvedProvider.config?.databaseUrl ?? ''
    );
    this.providerUrlField.container.setDepth(62);

    this.providerTokenField = this.createInputField(
      186,
      286,
      628,
      'Lobby Auth Token (optional)',
      resolvedProvider.config?.authToken ?? '',
      true,
      220
    );
    this.providerTokenField.container.setDepth(62);

    const saveProviderButton = this.makeDetailsButton(186, 354, 'Save Lobby Provider', async () => {
      const databaseUrl = this.providerUrlField?.value.trim() ?? '';
      if (!databaseUrl) {
        this.showToast('Lobby URL cannot be empty.');
        this.focusInput(this.providerUrlField);
        return;
      }
      saveLobbyProviderConfig({
        provider: 'firebase-rtdb',
        databaseUrl,
        authToken: this.providerTokenField?.value.trim() || undefined
      });
      this.showToast('Lobby provider saved for this browser.');
      this.updateProviderText();
    });
    saveProviderButton.setDepth(62);

    const localOnlyButton = this.makeDetailsButton(438, 354, 'Use Local Lobby Only', async () => {
      saveLocalOnlyLobbyConfig();
      this.showToast('Using local-browser fallback lobby only.');
      this.updateProviderText();
      await this.refreshRooms();
    });
    localOnlyButton.setDepth(62);

    const bundledButton = this.makeDetailsButton(186, 402, 'Use Bundled Lobby Config', async () => {
      saveLobbyProviderConfig(null);
      this.showToast('Using bundled lobby provider configuration.');
      const nextConfig = resolveLobbyProviderConfig();
      this.setInputValue(this.providerUrlField, nextConfig.config?.databaseUrl ?? '');
      this.setInputValue(this.providerTokenField, nextConfig.config?.authToken ?? '');
      this.updateProviderText();
      await this.refreshRooms();
    });
    bundledButton.setDepth(62);

    const closeDetailsButton = this.makeDetailsButton(438, 402, 'Back to Quick View', async () => {
      this.setDetailsVisible(false);
    });
    closeDetailsButton.setDepth(62);

    const reducedMotionButton = this.makeToggleButton(186, 470, () => `Reduced Motion: ${settings.reducedMotion ? 'On' : 'Off'}`, () => {
      settings.reducedMotion = !settings.reducedMotion;
      saveUiSettings(settings);
    });
    reducedMotionButton.setDepth(62);

    const colorAssistButton = this.makeToggleButton(438, 470, () => `Color Assist: ${settings.colorAssist ? 'On' : 'Off'}`, () => {
      settings.colorAssist = !settings.colorAssist;
      saveUiSettings(settings);
    });
    colorAssistButton.setDepth(62);
    this.add.existing(reducedMotionButton);
    this.add.existing(colorAssistButton);

    this.detailsObjects = [
      detailsBackdrop,
      detailsPanel,
      detailsTitle,
      detailsHint,
      this.providerUrlField.container,
      this.providerTokenField.container,
      saveProviderButton,
      localOnlyButton,
      bundledButton,
      closeDetailsButton,
      reducedMotionButton,
      colorAssistButton
    ];
    this.setDetailsVisible(false);

    this.input.keyboard?.on('keydown', (event: KeyboardEvent) => {
      this.handleKeyInput(event);
    });

    this.input.on('pointerdown', (_pointer: Phaser.Input.Pointer, currentlyOver: Phaser.GameObjects.GameObject[]) => {
      if (!currentlyOver.some((item) => item.getData('input-field') === true)) {
        this.focusInput(null);
      }
    });

    this.updateProviderText();
    void this.refreshRooms();
    this.focusInput(this.nameField);
  }

  private setDetailsVisible(visible: boolean): void {
    this.detailsVisible = visible;
    this.detailsObjects.forEach((item) => {
      item.setVisible(visible);
    });
    this.detailsToggleLabel?.setText(visible ? 'Hide Details' : 'Show Details');
    if (!visible) {
      this.focusInput(null);
    } else if (this.providerUrlField) {
      this.focusInput(this.providerUrlField);
    }
  }

  private createInputField(
    x: number,
    y: number,
    width: number,
    label: string,
    initialValue: string,
    secret = false,
    maxLength = 64
  ): InputField {
    const labelText = this.add.text(x, y, label, {
      fontFamily: 'Arial',
      fontSize: '15px',
      color: '#d1fae5'
    });

    const box = this.add.rectangle(x + width / 2, y + 38, width, 36, 0x0f1f12, 0.97);
    box.setStrokeStyle(2, 0x4d7c0f, 0.95);

    const valueText = this.add.text(x + 12, y + 26, '', {
      fontFamily: 'Arial',
      fontSize: '18px',
      color: '#f0fdf4'
    });

    const hitBox = this.add.rectangle(x + width / 2, y + 38, width, 36, 0xffffff, 0.001);
    hitBox.setInteractive({ useHandCursor: true });
    hitBox.setData('input-field', true);
    hitBox.on('pointerdown', () => {
      const field = hitBox.getData('field') as InputField;
      this.focusInput(field);
    });

    const container = this.add.container(0, 0, [labelText, box, valueText, hitBox]);

    const field: InputField = {
      container,
      box,
      valueText,
      value: initialValue,
      placeholder: 'Type here...',
      secret,
      maxLength
    };

    hitBox.setData('field', field);
    this.renderInputField(field);
    return field;
  }

  private renderInputField(field: InputField): void {
    const focused = this.focusedField === field;
    field.box.setStrokeStyle(2, focused ? 0x84cc16 : 0x4d7c0f, 0.95);

    const visibleValue = field.secret ? '*'.repeat(field.value.length) : field.value;
    if (visibleValue.length === 0) {
      field.valueText.setText(field.placeholder);
      field.valueText.setColor('#86a597');
      return;
    }

    const capped = visibleValue.length > 36 ? `${visibleValue.slice(0, 36)}...` : visibleValue;
    field.valueText.setText(focused ? `${capped}|` : capped);
    field.valueText.setColor('#f0fdf4');
  }

  private setInputValue(field: InputField | undefined, value: string): void {
    if (!field) {
      return;
    }
    field.value = value.slice(0, field.maxLength);
    this.renderInputField(field);
  }

  private focusInput(field: InputField | null | undefined): void {
    this.focusedField = field ?? null;
    [this.nameField, this.hostPasswordField, this.joinPasswordField, this.providerUrlField, this.providerTokenField]
      .filter((item): item is InputField => Boolean(item))
      .forEach((item) => this.renderInputField(item));
  }

  private handleKeyInput(event: KeyboardEvent): void {
    if (!this.focusedField) {
      return;
    }

    const field = this.focusedField;

    if (event.key === 'Backspace') {
      field.value = field.value.slice(0, -1);
      this.renderInputField(field);
      event.preventDefault();
      return;
    }

    if (event.key === 'Enter' || event.key === 'Tab') {
      this.focusInput(null);
      event.preventDefault();
      return;
    }

    if (event.key.length !== 1 || event.ctrlKey || event.metaKey || event.altKey) {
      return;
    }

    if (field.value.length >= field.maxLength) {
      return;
    }

    field.value += event.key;
    this.renderInputField(field);
    event.preventDefault();
  }

  private showToast(message: string): void {
    if (!this.toastText) {
      return;
    }
    this.toastText.setText(message);
    this.toastText.setVisible(true);
    this.toastTimer?.remove(false);
    this.toastTimer = this.time.delayedCall(2800, () => {
      this.toastText?.setVisible(false);
    });
  }

  private updateProviderText(): void {
    if (!this.providerText) {
      return;
    }

    const resolved = resolveLobbyProviderConfig();
    if (!resolved.config) {
      this.providerText.setText('Lobby Provider: Local browser fallback (same-device only)');
      return;
    }

    const source = resolved.source === 'local' ? 'saved in browser' : 'bundled default';
    this.providerText.setText(`Lobby Provider: Firebase (${source}) ${trimDisplay(resolved.config.databaseUrl, 54)}`);
  }

  private async refreshRooms(): Promise<void> {
    if (!this.roomsContainer) {
      return;
    }

    try {
      this.allRooms = await onlineSession.listOpenRooms();
      this.roomPage = 0;
      this.renderRoomsPage();
    } catch (error) {
      this.allRooms = [];
      this.roomPage = 0;
      this.renderRoomsPage();
      this.showToast(`Room refresh failed: ${String(error)}`);
    }
  }

  private renderRoomsPage(): void {
    this.roomListTexts.forEach((text) => text.destroy());
    this.roomListTexts = [];
    this.roomsContainer?.removeAll(true);

    if (!this.roomsContainer) {
      return;
    }

    const pageCount = Math.max(1, Math.ceil(this.allRooms.length / this.roomPageSize));
    this.roomPage = Phaser.Math.Clamp(this.roomPage, 0, pageCount - 1);
    const startIndex = this.roomPage * this.roomPageSize;
    const rooms = this.allRooms.slice(startIndex, startIndex + this.roomPageSize);
    this.roomPageText?.setText(`Page ${this.roomPage + 1}/${pageCount}`);

    if (this.prevRoomsButton) {
      this.prevRoomsButton.setVisible(pageCount > 1);
      this.prevRoomsButton.setAlpha(this.roomPage > 0 ? 1 : 0.5);
    }
    if (this.nextRoomsButton) {
      this.nextRoomsButton.setVisible(pageCount > 1);
      this.nextRoomsButton.setAlpha(this.roomPage < pageCount - 1 ? 1 : 0.5);
    }

    if (rooms.length === 0) {
      const emptyText = this.add.text(0, 0, 'No open rooms right now. Create one as host.', {
        fontFamily: 'Arial',
        fontSize: '18px',
        color: '#d1fae5',
        wordWrap: { width: 460 }
      });
      this.roomsContainer.add(emptyText);
      this.roomListTexts.push(emptyText);
      return;
    }

    rooms.forEach((room, index) => {
      const y = index * 54;
      const roomText = this.add.text(0, y, `${room.locked ? '[LOCK]' : '[OPEN]'} ${room.hostName}  ·  Room ${room.id}`, {
        fontFamily: 'Arial',
        fontSize: '17px',
        color: '#ecfdf5'
      });

      const joinButton = this.add.text(430, y - 2, 'Join', {
        fontFamily: 'Arial',
        fontSize: '17px',
        color: '#052e16',
        backgroundColor: '#86efac',
        padding: { x: 9, y: 4 }
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

  private makePageButton(x: number, y: number, label: string, delta: number): Phaser.GameObjects.Text {
    const button = this.add.text(x, y, label, {
      fontFamily: 'Arial',
      fontSize: '14px',
      color: '#052e16',
      backgroundColor: '#86efac',
      padding: { x: 8, y: 4 }
    }).setOrigin(0.5);

    button.setInteractive({ useHandCursor: true });
    button.on('pointerdown', () => {
      const pageCount = Math.max(1, Math.ceil(this.allRooms.length / this.roomPageSize));
      const nextPage = Phaser.Math.Clamp(this.roomPage + delta, 0, pageCount - 1);
      if (nextPage === this.roomPage) {
        return;
      }
      this.roomPage = nextPage;
      this.renderRoomsPage();
    });

    return button;
  }

  private async joinRoom(room: LobbyRoomSummary): Promise<void> {
    if (this.joinInFlight) {
      return;
    }

    const name = this.nameField?.value.trim() ?? '';
    if (!name) {
      this.showToast('Enter your player name before joining.');
      this.focusInput(this.nameField);
      return;
    }

    const password = this.joinPasswordField?.value.trim() ?? '';
    if (room.locked && !password) {
      this.showToast('This room is locked. Enter the Join Password field.');
      this.focusInput(this.joinPasswordField);
      return;
    }

    this.joinInFlight = true;
    try {
      await onlineSession.joinRoom(name, room.id, password);
      this.scene.start('DouShouQiLobbyScene', { role: 'guest', roomId: room.id });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const detail = message.includes('Room is no longer available')
        ? 'Room was just claimed. Refresh and pick another open room.'
        : message;
      this.showToast(`Join room failed: ${detail}`);
      await this.refreshRooms();
    } finally {
      this.joinInFlight = false;
    }
  }

  private makeActionButton(x: number, y: number, label: string, onClick: () => Promise<void>): Phaser.GameObjects.Text {
    const text = this.add.text(x, y, label, {
      fontFamily: 'Arial',
      fontSize: '21px',
      color: '#ecfdf5',
      backgroundColor: '#166534',
      padding: { x: 12, y: 7 }
    });
    text.setInteractive({ useHandCursor: true });
    text.on('pointerdown', () => {
      void onClick();
    });
    return text;
  }

  private makeDetailsButton(x: number, y: number, label: string, onClick: () => Promise<void>): Phaser.GameObjects.Text {
    const text = this.add.text(x, y, label, {
      fontFamily: 'Arial',
      fontSize: '20px',
      color: '#ecfdf5',
      backgroundColor: '#166534',
      padding: { x: 10, y: 6 }
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
