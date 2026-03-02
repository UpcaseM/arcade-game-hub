import { describe, expect, it } from 'vitest';
import { LobbyRoom, isOpenRoom, lobbyTtlMs } from './lobbyStore';

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
