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
type TransportMode = 'webrtc' | 'relay';
type RelayEnvelope = { seq: number; at: number; from: OnlineRole; message: NetMessage };

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
  private transportMode: TransportMode = 'webrtc';
  private relayOutSeq = 0;
  private seenHostRelaySeq = 0;
  private seenGuestRelaySeq = 0;

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
    this.transportMode = 'webrtc';

    let offerCode = '';
    try {
      const transport = new WebRtcManualTransport('host');
      this.transport = transport;
      this.bindTransport(transport);
      offerCode = await transport.createOffer();
    } catch {
      // Some devices fail WebRTC init in browser internals; fall back to room relay.
      this.transport?.destroy();
      this.transport = null;
      this.transportMode = 'relay';
      this.applyStatus('signaling');
    }

    const trimmedPassword = password?.trim() ?? '';
    const locked = trimmedPassword.length > 0;
    const salt = locked ? generateSalt() : undefined;
    const passwordHash = locked && salt ? await derivePasswordHash(trimmedPassword, salt) : undefined;

    const room = await this.lobbyStore.createRoom({
      hostName: localName,
      offerCode,
      locked,
      passwordSalt: salt,
      passwordHash,
      transportMode: this.transportMode
    });

    this.currentRoom = room;
    this.acceptedAnswerVersion = null;
    this.relayOutSeq = 0;
    this.seenHostRelaySeq = 0;
    this.seenGuestRelaySeq = 0;
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
    this.transportMode = room.transportMode ?? 'webrtc';

    let answerCode: string | undefined;
    let relayJoin = this.transportMode === 'relay';
    if (!relayJoin) {
      try {
        const transport = new WebRtcManualTransport('guest');
        this.transport = transport;
        this.bindTransport(transport);
        answerCode = await transport.acceptOfferAndCreateAnswer(room.offerCode);
      } catch {
        this.transport?.destroy();
        this.transport = null;
        this.transportMode = 'relay';
        relayJoin = true;
      }
    }

    let joined: LobbyRoom;
    if (relayJoin) {
      const existing = await this.lobbyStore.getRoom(room.id);
      if (!existing || existing.status === 'closed' || (existing.guestName && existing.guestName !== localName)) {
        throw new Error('Room is no longer available.');
      }

      joined = await this.lobbyStore.updateRoom(room.id, {
        guestName: localName,
        status: existing.status === 'started' ? 'started' : 'connected',
        transportMode: 'relay',
        updatedAt: Date.now(),
        lastHeartbeat: Date.now()
      });
      this.applyStatus('connected');
    } else {
      try {
        joined = await this.lobbyStore.joinRoom(room.id, {
          guestName: localName,
          answerCode: answerCode ?? ''
        });
      } catch (error) {
        const existing = await this.lobbyStore.getRoom(room.id);
        if (!existing || existing.status === 'closed' || (existing.guestName && existing.guestName !== localName)) {
          throw error;
        }

        // Recover from duplicate/late join races even when provider errors use non-standard wording.
        joined = await this.lobbyStore.updateRoom(room.id, {
          guestName: localName,
          answerCode: answerCode ?? existing.answerCode,
          status: existing.status === 'started' ? 'started' : 'connected',
          updatedAt: Date.now(),
          lastHeartbeat: Date.now()
        });
      }
    }

    this.currentRoom = joined;
    this.relayOutSeq = 0;
    this.seenHostRelaySeq = 0;
    this.seenGuestRelaySeq = 0;
    this.startRoomWatch(room.id);
    this.startHeartbeat();
    if (this.transportMode === 'relay') {
      this.send({ type: 'hello', payload: { name: this.localName, role: 'guest' } });
    }
    return joined;
  }

  async startMatch(): Promise<number> {
    if (this.role !== 'host' || !this.currentRoom) {
      throw new Error('Only host can start match.');
    }
    if (this.transportMode === 'relay') {
      if (!this.currentRoom.guestName) {
        throw new Error('Guest has not joined yet.');
      }
    } else if (this.status !== 'connected') {
      throw new Error('Guest is not connected yet.');
    }

    const seed = Math.floor(Math.random() * 2_147_483_647);
    const updated = await this.lobbyStore.updateRoom(this.currentRoom.id, {
      status: 'started',
      seed,
      transportMode: this.transportMode,
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
    if (this.transportMode === 'relay') {
      await this.lobbyStore.updateRoom(this.currentRoom.id, {
        transportMode: 'relay',
        updatedAt: Date.now(),
        lastHeartbeat: Date.now()
      });
      this.applyStatus(this.currentRoom.guestName ? 'connected' : 'signaling');
      return 'relay-mode';
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
    if (this.transportMode === 'relay') {
      await this.lobbyStore.updateRoom(this.currentRoom.id, {
        guestName: this.localName,
        transportMode: 'relay',
        updatedAt: Date.now(),
        lastHeartbeat: Date.now()
      });
      this.applyStatus('connected');
      return 'relay-mode';
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
    if (this.transportMode === 'relay' || !this.transport) {
      this.sendRelayMessage(message);
      return true;
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

  private sendRelayMessage(message: NetMessage): void {
    if (!this.currentRoom || !this.role) {
      return;
    }

    this.relayOutSeq += 1;
    const relay: RelayEnvelope = {
      seq: this.relayOutSeq,
      at: Date.now(),
      from: this.role,
      message
    };
    const patch = this.role === 'host' ? { hostRelay: relay } : { guestRelay: relay };

    void this.lobbyStore
      .updateRoom(this.currentRoom.id, {
        ...patch,
        transportMode: 'relay',
        updatedAt: Date.now(),
        lastHeartbeat: Date.now()
      })
      .then((room) => {
        this.currentRoom = room;
      })
      .catch(() => {
        // Relay transport is best-effort through room polling.
      });
  }

  reset(): void {
    this.stopRoomWatch();
    this.stopHeartbeat();
    this.transport?.destroy();
    this.transport = null;
    this.role = null;
    this.currentRoom = null;
    this.matchStarted = false;
    this.transportMode = 'webrtc';
    this.relayOutSeq = 0;
    this.seenHostRelaySeq = 0;
    this.seenGuestRelaySeq = 0;
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
        this.handleInboundMessage(message);
      }
    });
  }

  private handleInboundMessage(message: NetMessage): void {
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

  private startRoomWatch(roomId: string): void {
    this.stopRoomWatch();
    this.roomWatchStop = this.lobbyStore.watchRoom(roomId, (room) => {
      this.currentRoom = room;
      if (room) {
        if (room.transportMode === 'relay') {
          this.transportMode = 'relay';
          this.transport?.destroy();
          this.transport = null;
        }
        this.remoteName = this.role === 'host' ? (room.guestName ?? 'Waiting for guest') : room.hostName;
        if (this.transportMode === 'relay') {
          if (this.role === 'host') {
            this.applyStatus(room.guestName ? 'connected' : 'signaling');
          } else if (this.role === 'guest') {
            this.applyStatus('connected');
          }
        }
        if (room.status === 'started' && typeof room.seed === 'number' && !this.matchStarted) {
          this.matchStarted = true;
          this.listener.onMatchStart?.(room.seed);
        }
        this.consumeRelayUpdate(room);
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

  private consumeRelayUpdate(room: LobbyRoom): void {
    if (this.transportMode !== 'relay' || !this.role) {
      return;
    }

    const incoming = this.role === 'host' ? room.guestRelay : room.hostRelay;
    if (!incoming || typeof incoming.seq !== 'number') {
      return;
    }

    if (this.role === 'host') {
      if (incoming.seq <= this.seenGuestRelaySeq) {
        return;
      }
      this.seenGuestRelaySeq = incoming.seq;
    } else {
      if (incoming.seq <= this.seenHostRelaySeq) {
        return;
      }
      this.seenHostRelaySeq = incoming.seq;
    }

    const relayMessage = this.parseRelayMessage(incoming.message);
    if (!relayMessage) {
      return;
    }
    this.handleInboundMessage(relayMessage);
  }

  private parseRelayMessage(payload: unknown): NetMessage | null {
    if (!payload || typeof payload !== 'object') {
      return null;
    }
    const maybeMessage = payload as Partial<NetMessage>;
    if (typeof maybeMessage.type !== 'string') {
      return null;
    }
    return payload as NetMessage;
  }

  private async consumeRoomUpdate(room: LobbyRoom | null): Promise<void> {
    if (!room) {
      return;
    }
    if (room.transportMode === 'relay') {
      this.transportMode = 'relay';
      return;
    }
    if (this.role !== 'host' || !this.transport) {
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
