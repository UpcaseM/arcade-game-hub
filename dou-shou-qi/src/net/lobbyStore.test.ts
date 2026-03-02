import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { LobbyRoom, createLobbyStore, isOpenRoom, lobbyTtlMs, normalizeFirebaseDatabaseUrl, saveLobbyProviderConfig } from './lobbyStore';

function room(partial: Partial<LobbyRoom>): LobbyRoom {
  return {
    id: 'room-1',
    hostName: 'Host',
    locked: false,
    status: 'open',
    offerCode: 'offer',
    version: 1,
    createdAt: 100,
    updatedAt: 100,
    lastHeartbeat: 100,
    ...partial
  };
}

describe('lobby room filters', () => {
  it('keeps open rooms with fresh heartbeat', () => {
    const target = room({ lastHeartbeat: 1_000 });
    expect(isOpenRoom(target, 1_000 + lobbyTtlMs - 1)).toBe(true);
  });

  it('drops stale rooms by ttl', () => {
    const stale = room({ lastHeartbeat: 1_000 });
    expect(isOpenRoom(stale, 1_000 + lobbyTtlMs + 1)).toBe(false);
  });

  it('drops occupied rooms from open listing', () => {
    const occupied = room({ guestName: 'Guest' });
    expect(isOpenRoom(occupied, 110)).toBe(false);
  });
});

describe('normalizeFirebaseDatabaseUrl', () => {
  it('strips room path and json suffix', () => {
    expect(normalizeFirebaseDatabaseUrl('https://demo-default-rtdb.firebaseio.com/rooms.json')).toBe(
      'https://demo-default-rtdb.firebaseio.com'
    );
  });

  it('adds https when protocol is missing', () => {
    expect(normalizeFirebaseDatabaseUrl('demo-default-rtdb.firebaseio.com/rooms')).toBe(
      'https://demo-default-rtdb.firebaseio.com'
    );
  });
});

describe('resilient lobby fallback', () => {
  beforeEach(() => {
    const state = new Map<string, string>();
    const localStorageMock = {
      getItem: (key: string) => state.get(key) ?? null,
      setItem: (key: string, value: string) => {
        state.set(key, value);
      },
      removeItem: (key: string) => {
        state.delete(key);
      },
      clear: () => {
        state.clear();
      }
    };
    vi.stubGlobal('window', {
      localStorage: localStorageMock,
      setTimeout: globalThis.setTimeout.bind(globalThis),
      clearTimeout: globalThis.clearTimeout.bind(globalThis),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn()
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('falls back to local store on network-like fetch errors and stays on fallback', async () => {
    saveLobbyProviderConfig({
      provider: 'firebase-rtdb',
      databaseUrl: 'https://demo-default-rtdb.firebaseio.com'
    });

    const fetchMock = vi.fn().mockRejectedValue(new Error('Failed to fetch'));
    vi.stubGlobal('fetch', fetchMock);
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    const store = createLobbyStore();
    await expect(store.listOpenRooms()).resolves.toEqual([]);
    await expect(store.createRoom({ hostName: 'Host', offerCode: 'offer', locked: false })).resolves.toMatchObject({
      hostName: 'Host',
      status: 'open'
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(warnSpy).toHaveBeenCalledWith('[DouShouQi] Remote lobby unavailable; switching to local-only fallback.');
    warnSpy.mockRestore();
  });

  it('does not fallback on non-network errors', async () => {
    saveLobbyProviderConfig({
      provider: 'firebase-rtdb',
      databaseUrl: 'https://demo-default-rtdb.firebaseio.com'
    });

    const fetchMock = vi.fn().mockRejectedValue(new Error('forbidden'));
    vi.stubGlobal('fetch', fetchMock);
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    const store = createLobbyStore();
    await expect(store.listOpenRooms()).rejects.toThrow('forbidden');
    await expect(store.listOpenRooms()).rejects.toThrow('forbidden');

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(warnSpy).not.toHaveBeenCalled();
    warnSpy.mockRestore();
  });
});
