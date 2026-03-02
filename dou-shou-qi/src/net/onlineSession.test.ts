import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { LobbyRoom } from './lobbyStore';
import type { NetMessage, OnlineRole } from './protocol';

type TransportListener = {
  onOpen?: () => void;
  onClose?: () => void;
  onMessage?: (message: NetMessage) => void;
};

const transportInstances: MockTransport[] = [];

class MockTransport {
  private readonly role: OnlineRole;
  private listener: TransportListener = {};

  constructor(role: OnlineRole) {
    this.role = role;
    transportInstances.push(this);
  }

  setListener(listener: TransportListener): void {
    this.listener = listener;
  }

  async createOffer(): Promise<string> {
    return `offer-${this.role}`;
  }

  async acceptOfferAndCreateAnswer(): Promise<string> {
    return `answer-${this.role}`;
  }

  async acceptAnswer(): Promise<void> {
    return;
  }

  send(): boolean {
    return true;
  }

  destroy(): void {
    return;
  }

  emitOpen(): void {
    this.listener.onOpen?.();
  }
}

const mockRoom: LobbyRoom = {
  id: 'room-1',
  hostName: 'Alice',
  guestName: undefined,
  locked: false,
  status: 'open',
  offerCode: 'offer-host',
  version: 1,
  createdAt: 1,
  updatedAt: 1,
  lastHeartbeat: 1
};

const store = {
  createRoom: vi.fn(async () => ({ ...mockRoom })),
  listOpenRooms: vi.fn(async () => []),
  getRoom: vi.fn(async () => ({ ...mockRoom })),
  joinRoom: vi.fn(async () => ({ ...mockRoom, guestName: 'Bob', answerCode: 'answer-guest', status: 'connected' as const })),
  updateRoom: vi.fn(async (_roomId: string, patch: Partial<LobbyRoom>) => ({ ...mockRoom, ...patch })),
  watchRoom: vi.fn(() => () => {})
};

vi.mock('./webrtcTransport', () => ({
  WebRtcManualTransport: MockTransport
}));

vi.mock('./lobbyStore', () => ({
  createLobbyStore: () => store
}));

describe('onlineSession lobby lifecycle', () => {
  beforeEach(() => {
    transportInstances.length = 0;
    store.createRoom.mockClear();
    store.listOpenRooms.mockClear();
    store.getRoom.mockClear();
    store.joinRoom.mockClear();
    store.updateRoom.mockClear();
    store.watchRoom.mockClear();
    vi.resetModules();
  });

  it('host creates a room and stays in signaling until channel opens', async () => {
    const { onlineSession } = await import('./onlineSession');

    const room = await onlineSession.hostRoom('Alice');

    expect(room.id).toBe('room-1');
    expect(onlineSession.getRole()).toBe('host');
    expect(onlineSession.getStatus()).toBe('signaling');
    expect(store.createRoom).toHaveBeenCalled();

    transportInstances.at(-1)?.emitOpen();
    expect(onlineSession.getStatus()).toBe('connected');
  });

  it('guest joins from listed room and preserves guest role on reconnect', async () => {
    const { onlineSession } = await import('./onlineSession');
    await onlineSession.joinRoom('Bob', 'room-1');

    await onlineSession.reconnectGuest();

    expect(onlineSession.getRole()).toBe('guest');
    expect(onlineSession.getStatus()).toBe('signaling');
    expect(store.updateRoom).toHaveBeenCalled();
  });

  it('host reconnect bumps room version', async () => {
    const { onlineSession } = await import('./onlineSession');
    await onlineSession.hostRoom('Alice');

    await onlineSession.reconnectHost();

    const patch = store.updateRoom.mock.calls.at(-1)?.[1] as Partial<LobbyRoom>;
    expect((patch.version ?? 0) > mockRoom.version).toBe(true);
  });
});
