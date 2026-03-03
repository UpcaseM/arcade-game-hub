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
  sendCalls = 0;

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
    this.sendCalls += 1;
    return true;
  }

  destroy(): void {
    return;
  }

  emitOpen(): void {
    this.listener.onOpen?.();
  }

  emitMessage(message: NetMessage): void {
    this.listener.onMessage?.(message);
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
const createLobbyStoreMock = vi.fn(() => store);

vi.mock('./webrtcTransport', () => ({
  WebRtcManualTransport: MockTransport
}));

vi.mock('./lobbyStore', () => ({
  createLobbyStore: createLobbyStoreMock
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
    createLobbyStoreMock.mockClear();
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

  it('recovers guest join when duplicate click caused room reservation race', async () => {
    const { onlineSession } = await import('./onlineSession');

    store.getRoom
      .mockResolvedValueOnce({ ...mockRoom })
      .mockResolvedValueOnce({
        ...mockRoom,
        guestName: 'Bob',
        answerCode: 'answer-old',
        status: 'connected'
      });
    store.joinRoom.mockRejectedValueOnce(new Error('Room is no longer available.'));

    await onlineSession.joinRoom('Bob', 'room-1');

    expect(store.updateRoom).toHaveBeenCalledWith(
      'room-1',
      expect.objectContaining({
        guestName: 'Bob',
        status: 'connected'
      })
    );
    expect(onlineSession.getRole()).toBe('guest');
  });

  it('recovers guest join when provider returns non-standard claim error for same guest', async () => {
    const { onlineSession } = await import('./onlineSession');

    store.getRoom
      .mockResolvedValueOnce({ ...mockRoom })
      .mockResolvedValueOnce({
        ...mockRoom,
        guestName: 'Bob',
        answerCode: 'answer-existing',
        status: 'connected'
      });
    store.joinRoom.mockRejectedValueOnce(new Error('Room already claimed by this guest.'));

    await onlineSession.joinRoom('Bob', 'room-1');

    expect(store.updateRoom).toHaveBeenCalledWith(
      'room-1',
      expect.objectContaining({
        guestName: 'Bob',
        answerCode: 'answer-guest',
        status: 'connected'
      })
    );
    expect(onlineSession.getRole()).toBe('guest');
  });

  it('host reconnect bumps room version', async () => {
    const { onlineSession } = await import('./onlineSession');
    await onlineSession.hostRoom('Alice');

    await onlineSession.reconnectHost();

    const patch = store.updateRoom.mock.calls.at(-1)?.[1] as Partial<LobbyRoom>;
    expect((patch.version ?? 0) > mockRoom.version).toBe(true);
  });

  it('blocks action requests before match start and allows after lobbyStart', async () => {
    const { onlineSession } = await import('./onlineSession');
    await onlineSession.hostRoom('Alice');

    transportInstances.at(-1)?.emitOpen();
    const beforeStart = onlineSession.requestAction({ type: 'flip', pieceId: 'p1' });
    expect(beforeStart).toBe(false);

    transportInstances.at(-1)?.emitMessage({
      type: 'lobbyStart',
      payload: { roomId: 'room-1', seed: 42, version: 1 }
    });
    const afterStart = onlineSession.requestAction({ type: 'flip', pieceId: 'p1' });
    expect(afterStart).toBe(true);
  });

  it('reloads lobby provider store before list and host actions', async () => {
    const { onlineSession } = await import('./onlineSession');

    await onlineSession.listOpenRooms();
    await onlineSession.hostRoom('Alice');

    expect(createLobbyStoreMock.mock.calls.length).toBeGreaterThanOrEqual(3);
  });
});
