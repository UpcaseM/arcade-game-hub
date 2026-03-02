import { GameState, PlayerTurn } from '../data/types';
import { LobbyRoom, LobbyRoomSummary, createLobbyStore } from './lobbyStore';
import { NetMessage, OnlineActionRequest, OnlineRole } from './protocol';
import { WebRtcManualTransport } from './webrtcTransport';

export interface OnlineSnapshot {
  state: GameState;
  hostName: string;
  guestName: string;
}

export type SessionStatus = 'offline' | 'signaling' | 'connected' | 'disconnected';

type SessionListener = {
  onStatus?: (status: SessionStatus) => void;
  onMessage?: (message: NetMessage) => void;
  onRoom?: (room: LobbyRoom | null) => void;
  onMatchStart?: (seed: number) => void;
};

const HEARTBEAT_MS = 5000;

function generateSalt(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
}

async function sha256Hex(value: string): Promise<string> {
  const encoded = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest('SHA-256', encoded);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

async function derivePasswordHash(password: string, salt: string): Promise<string> {
  return sha256Hex(`${salt}:${password}`);
}

class OnlineSession {
  private transport: WebRtcManualTransport | null = null;
  private listener: SessionListener = {};
  private role: OnlineRole | null = null;
  private localName = 'Guest';
  private remoteName = 'Opponent';
  private status: SessionStatus = 'offline';
  private lobbyStore = createLobbyStore();
  private currentRoom: LobbyRoom | null = null;
  private roomWatchStop: (() => void) | null = null;
  private heartbeatTimer: number | null = null;
  private acceptedAnswerVersion: number | null = null;
  private matchStarted = false;

  setListener(listener: SessionListener): void {
    this.listener = listener;
  }

  getStatus(): SessionStatus {
    return this.status;
  }

  getRole(): OnlineRole | null {
    return this.role;
  }

  getLocalName(): string {
    return this.localName;
  }

  getRemoteName(): string {
    return this.remoteName;
  }

  getCurrentRoom(): LobbyRoom | null {
    return this.currentRoom;
  }

  hasMatchStarted(): boolean {
    return this.matchStarted;
  }

  localTurn(): PlayerTurn {
    return this.role === 'host' ? 'player1' : 'player2';
  }

  remoteTurn(): PlayerTurn {
    return this.role === 'host' ? 'player2' : 'player1';
  }

  reloadLobbyStore(): void {
    // Always re-resolve provider config from current browser storage/global config.
    this.lobbyStore = createLobbyStore();
  }

  async listOpenRooms(): Promise<LobbyRoomSummary[]> {
    this.reloadLobbyStore();
    return this.lobbyStore.listOpenRooms();
  }

  async hostRoom(localName: string, password?: string): Promise<LobbyRoom> {
    this.reset();
    this.reloadLobbyStore();
    this.localName = localName;
    this.remoteName = 'Waiting for guest';
    this.role = 'host';
    this.matchStarted = false;
    this.applyStatus('signaling');

    const transport = new WebRtcManualTransport('host');
    this.transport = transport;
    this.bindTransport(transport);
    const offerCode = await transport.createOffer();

    const trimmedPassword = password?.trim() ?? '';
    const locked = trimmedPassword.length > 0;
    const salt = locked ? generateSalt() : undefined;
    const passwordHash = locked && salt ? await derivePasswordHash(trimmedPassword, salt) : undefined;

    const room = await this.lobbyStore.createRoom({
      hostName: localName,
      offerCode,
      locked,
      passwordSalt: salt,
      passwordHash
    });

    this.currentRoom = room;
    this.acceptedAnswerVersion = null;
    this.startRoomWatch(room.id);
    this.startHeartbeat();
    return room;
  }

  async joinRoom(localName: string, roomId: string, password?: string): Promise<LobbyRoom> {
    this.reset();
    this.reloadLobbyStore();
    const room = await this.lobbyStore.getRoom(roomId);
    if (!room) {
      throw new Error('Room not found.');
    }

    if (room.locked) {
      const trimmedPassword = password?.trim() ?? '';
      if (!trimmedPassword || !room.passwordSalt || !room.passwordHash) {
        throw new Error('Room password is required.');
      }
      const hash = await derivePasswordHash(trimmedPassword, room.passwordSalt);
      if (hash !== room.passwordHash) {
        throw new Error('Invalid room password.');
      }
    }

    this.localName = localName;
    this.remoteName = room.hostName;
    this.role = 'guest';
    this.matchStarted = room.status === 'started';
    this.applyStatus('signaling');

    const transport = new WebRtcManualTransport('guest');
    this.transport = transport;
    this.bindTransport(transport);
    const answerCode = await transport.acceptOfferAndCreateAnswer(room.offerCode);

    const joined = await this.lobbyStore.joinRoom(room.id, {
      guestName: localName,
      answerCode
    });

    this.currentRoom = joined;
    this.startRoomWatch(room.id);
    this.startHeartbeat();
    return joined;
  }

  async startMatch(): Promise<number> {
    if (this.role !== 'host' || !this.currentRoom) {
      throw new Error('Only host can start match.');
    }
    if (this.status !== 'connected') {
      throw new Error('Guest is not connected yet.');
    }

    const seed = Math.floor(Math.random() * 2_147_483_647);
    const updated = await this.lobbyStore.updateRoom(this.currentRoom.id, {
      status: 'started',
      seed,
      updatedAt: Date.now(),
      lastHeartbeat: Date.now()
    });

    this.currentRoom = updated;
    this.matchStarted = true;
    this.send({ type: 'lobbyStart', payload: { roomId: updated.id, seed, version: updated.version } });
    return seed;
  }

  async reconnectHost(): Promise<string> {
    if (this.role !== 'host' || !this.currentRoom) {
      throw new Error('Reconnect host is only available in a hosted room.');
    }

    this.transport?.destroy();
    const transport = new WebRtcManualTransport('host');
    this.transport = transport;
    this.bindTransport(transport);
    this.applyStatus('signaling');
    const offerCode = await transport.createOffer();

    const updated = await this.lobbyStore.updateRoom(this.currentRoom.id, {
      offerCode,
      answerCode: undefined,
      version: this.currentRoom.version + 1,
      updatedAt: Date.now(),
      lastHeartbeat: Date.now()
    });

    this.currentRoom = updated;
    this.acceptedAnswerVersion = null;
    return offerCode;
  }

  async reconnectGuest(): Promise<string> {
    if (this.role !== 'guest' || !this.currentRoom) {
      throw new Error('Reconnect join is only available for guest role.');
    }

    const room = await this.lobbyStore.getRoom(this.currentRoom.id);
    if (!room) {
      throw new Error('Room no longer exists.');
    }

    this.transport?.destroy();
    const transport = new WebRtcManualTransport('guest');
    this.transport = transport;
    this.bindTransport(transport);
    this.applyStatus('signaling');
    const answerCode = await transport.acceptOfferAndCreateAnswer(room.offerCode);

    await this.lobbyStore.updateRoom(room.id, {
      answerCode,
      guestName: this.localName,
      updatedAt: Date.now(),
      lastHeartbeat: Date.now()
    });

    return answerCode;
  }

  send(message: NetMessage): boolean {
    if (!this.transport) {
      return false;
    }
    return this.transport.send(message);
  }

  requestAction(action: OnlineActionRequest): boolean {
    if (!this.matchStarted) {
      return false;
    }
    return this.send({ type: 'actionRequest', payload: action });
  }

  sendSnapshot(snapshot: OnlineSnapshot): boolean {
    return this.send({ type: 'stateSnapshot', payload: snapshot });
  }

  ping(): void {
    this.send({ type: 'ping', payload: { at: Date.now() } });
  }

  reset(): void {
    this.stopRoomWatch();
    this.stopHeartbeat();
    this.transport?.destroy();
    this.transport = null;
    this.role = null;
    this.currentRoom = null;
    this.matchStarted = false;
    this.applyStatus('offline');
  }

  closeRoom(): void {
    if (this.currentRoom && this.role === 'host') {
      void this.lobbyStore.updateRoom(this.currentRoom.id, {
        status: 'closed',
        updatedAt: Date.now(),
        lastHeartbeat: Date.now()
      });
    }
    this.reset();
  }

  private applyStatus(next: SessionStatus): void {
    this.status = next;
    this.listener.onStatus?.(next);
  }

  private bindTransport(transport: WebRtcManualTransport): void {
    transport.setListener({
      onOpen: () => {
        this.applyStatus('connected');
        this.send({ type: 'hello', payload: { name: this.localName, role: this.role ?? 'guest' } });
      },
      onClose: () => {
        this.applyStatus('disconnected');
      },
      onMessage: (message) => {
        if (message.type === 'hello') {
          this.remoteName = message.payload.name;
        }
        if (message.type === 'lobbyStart') {
          this.matchStarted = true;
          this.listener.onMatchStart?.(message.payload.seed);
        }
        if (message.type === 'ping') {
          this.send({ type: 'pong', payload: { at: message.payload.at } });
        }
        this.listener.onMessage?.(message);
      }
    });
  }

  private startRoomWatch(roomId: string): void {
    this.stopRoomWatch();
    this.roomWatchStop = this.lobbyStore.watchRoom(roomId, (room) => {
      this.currentRoom = room;
      if (room) {
        this.remoteName = this.role === 'host' ? (room.guestName ?? 'Waiting for guest') : room.hostName;
        if (room.status === 'started' && typeof room.seed === 'number' && !this.matchStarted) {
          this.matchStarted = true;
          this.listener.onMatchStart?.(room.seed);
        }
      }
      this.listener.onRoom?.(room);
      void this.consumeRoomUpdate(room);
    });
  }

  private stopRoomWatch(): void {
    this.roomWatchStop?.();
    this.roomWatchStop = null;
  }

  private startHeartbeat(): void {
    this.stopHeartbeat();
    this.heartbeatTimer = globalThis.setInterval(() => {
      if (!this.currentRoom || this.currentRoom.status === 'closed') {
        return;
      }
      void this.lobbyStore
        .updateRoom(this.currentRoom.id, {
          lastHeartbeat: Date.now(),
          updatedAt: Date.now()
        })
        .then((room) => {
          this.currentRoom = room;
        })
        .catch(() => {
          // Heartbeats are best-effort.
        });
    }, HEARTBEAT_MS);
  }

  private stopHeartbeat(): void {
    if (this.heartbeatTimer !== null) {
      globalThis.clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }

  private async consumeRoomUpdate(room: LobbyRoom | null): Promise<void> {
    if (!room || this.role !== 'host' || !this.transport) {
      return;
    }
    if (!room.answerCode || this.acceptedAnswerVersion === room.version) {
      return;
    }

    try {
      await this.transport.acceptAnswer(room.answerCode);
      this.acceptedAnswerVersion = room.version;
      if (room.status !== 'started') {
        const next = await this.lobbyStore.updateRoom(room.id, {
          status: 'connected',
          updatedAt: Date.now(),
          lastHeartbeat: Date.now()
        });
        this.currentRoom = next;
      }
    } catch {
      this.applyStatus('disconnected');
    }
  }
}

export const onlineSession = new OnlineSession();
