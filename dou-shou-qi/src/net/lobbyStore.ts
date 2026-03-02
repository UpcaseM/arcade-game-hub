export type LobbyRoomStatus = 'open' | 'connected' | 'started' | 'closed';

export interface LobbyRoom {
  id: string;
  hostName: string;
  guestName?: string;
  locked: boolean;
  passwordSalt?: string;
  passwordHash?: string;
  status: LobbyRoomStatus;
  offerCode: string;
  answerCode?: string;
  seed?: number;
  version: number;
  createdAt: number;
  updatedAt: number;
  lastHeartbeat: number;
}

export interface LobbyRoomSummary {
  id: string;
  hostName: string;
  guestName?: string;
  locked: boolean;
  status: LobbyRoomStatus;
  updatedAt: number;
}

export interface CreateRoomInput {
  hostName: string;
  offerCode: string;
  locked: boolean;
  passwordSalt?: string;
  passwordHash?: string;
}

export interface JoinRoomInput {
  guestName: string;
  answerCode: string;
}

export interface LobbyStore {
  createRoom(input: CreateRoomInput): Promise<LobbyRoom>;
  listOpenRooms(now?: number): Promise<LobbyRoomSummary[]>;
  getRoom(roomId: string): Promise<LobbyRoom | null>;
  joinRoom(roomId: string, input: JoinRoomInput): Promise<LobbyRoom>;
  updateRoom(roomId: string, patch: Partial<LobbyRoom>): Promise<LobbyRoom>;
  watchRoom(roomId: string, onUpdate: (room: LobbyRoom | null) => void): () => void;
}

const LOBBY_TTL_MS = 120_000;
const LOCAL_ROOMS_KEY = 'dou_shou_qi_rooms_v1';
const CONFIG_KEY = 'dou_shou_qi_lobby_provider_v1';

type LobbyProviderConfig = {
  provider: 'firebase-rtdb';
  databaseUrl: string;
  authToken?: string;
  pollIntervalMs?: number;
};

function nowMs(): number {
  return Date.now();
}

function randomRoomId(): string {
  return `r-${Math.random().toString(36).slice(2, 8)}${Math.random().toString(36).slice(2, 6)}`;
}

function toSummary(room: LobbyRoom): LobbyRoomSummary {
  return {
    id: room.id,
    hostName: room.hostName,
    guestName: room.guestName,
    locked: room.locked,
    status: room.status,
    updatedAt: room.updatedAt
  };
}

function isRoomFresh(room: LobbyRoom, now: number): boolean {
  return now - room.lastHeartbeat <= LOBBY_TTL_MS;
}

export function isOpenRoom(room: LobbyRoom, now: number, ttlMs = LOBBY_TTL_MS): boolean {
  return room.status === 'open' && !room.guestName && now - room.lastHeartbeat <= ttlMs;
}

function isJoinableRoom(room: LobbyRoom, now: number): boolean {
  return room.status === 'open' && !room.guestName && isRoomFresh(room, now);
}

function sortNewestFirst(rooms: LobbyRoomSummary[]): LobbyRoomSummary[] {
  return rooms.sort((a, b) => b.updatedAt - a.updatedAt);
}

function safeParse<T>(raw: string | null): T | null {
  if (!raw) {
    return null;
  }
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

function readLocalRooms(): Record<string, LobbyRoom> {
  const parsed = safeParse<Record<string, LobbyRoom>>(window.localStorage.getItem(LOCAL_ROOMS_KEY));
  return parsed ?? {};
}

function writeLocalRooms(rooms: Record<string, LobbyRoom>): void {
  window.localStorage.setItem(LOCAL_ROOMS_KEY, JSON.stringify(rooms));
}

class LocalStorageLobbyStore implements LobbyStore {
  async createRoom(input: CreateRoomInput): Promise<LobbyRoom> {
    const room: LobbyRoom = {
      id: randomRoomId(),
      hostName: input.hostName,
      locked: input.locked,
      passwordSalt: input.passwordSalt,
      passwordHash: input.passwordHash,
      status: 'open',
      offerCode: input.offerCode,
      version: 1,
      createdAt: nowMs(),
      updatedAt: nowMs(),
      lastHeartbeat: nowMs()
    };

    const rooms = readLocalRooms();
    rooms[room.id] = room;
    writeLocalRooms(rooms);
    return room;
  }

  async listOpenRooms(now: number = nowMs()): Promise<LobbyRoomSummary[]> {
    const rooms = Object.values(readLocalRooms());
    return sortNewestFirst(rooms.filter((room) => isJoinableRoom(room, now)).map(toSummary));
  }

  async getRoom(roomId: string): Promise<LobbyRoom | null> {
    const room = readLocalRooms()[roomId];
    return room ?? null;
  }

  async joinRoom(roomId: string, input: JoinRoomInput): Promise<LobbyRoom> {
    const rooms = readLocalRooms();
    const room = rooms[roomId];
    if (!room) {
      throw new Error('Room not found.');
    }
    if (room.status !== 'open' || room.guestName) {
      throw new Error('Room is no longer available.');
    }

    room.guestName = input.guestName;
    room.answerCode = input.answerCode;
    room.status = 'connected';
    room.updatedAt = nowMs();
    room.lastHeartbeat = nowMs();
    rooms[roomId] = room;
    writeLocalRooms(rooms);
    return room;
  }

  async updateRoom(roomId: string, patch: Partial<LobbyRoom>): Promise<LobbyRoom> {
    const rooms = readLocalRooms();
    const room = rooms[roomId];
    if (!room) {
      throw new Error('Room not found.');
    }

    const merged: LobbyRoom = {
      ...room,
      ...patch,
      id: room.id,
      updatedAt: patch.updatedAt ?? nowMs(),
      lastHeartbeat: patch.lastHeartbeat ?? room.lastHeartbeat
    };
    rooms[roomId] = merged;
    writeLocalRooms(rooms);
    return merged;
  }

  watchRoom(roomId: string, onUpdate: (room: LobbyRoom | null) => void): () => void {
    let stopped = false;

    const poll = async () => {
      if (stopped) {
        return;
      }
      onUpdate(await this.getRoom(roomId));
      window.setTimeout(poll, 1200);
    };

    void poll();

    const onStorage = (event: StorageEvent) => {
      if (event.key === LOCAL_ROOMS_KEY) {
        void this.getRoom(roomId).then(onUpdate);
      }
    };
    window.addEventListener('storage', onStorage);

    return () => {
      stopped = true;
      window.removeEventListener('storage', onStorage);
    };
  }
}

class FirebaseLobbyStore implements LobbyStore {
  private readonly pollIntervalMs: number;

  constructor(private readonly databaseUrl: string, private readonly authToken?: string, pollIntervalMs = 1200) {
    this.pollIntervalMs = pollIntervalMs;
  }

  async createRoom(input: CreateRoomInput): Promise<LobbyRoom> {
    const room: LobbyRoom = {
      id: randomRoomId(),
      hostName: input.hostName,
      locked: input.locked,
      passwordSalt: input.passwordSalt,
      passwordHash: input.passwordHash,
      status: 'open',
      offerCode: input.offerCode,
      version: 1,
      createdAt: nowMs(),
      updatedAt: nowMs(),
      lastHeartbeat: nowMs()
    };

    await this.writeRoom(room.id, room);
    return room;
  }

  async listOpenRooms(now: number = nowMs()): Promise<LobbyRoomSummary[]> {
    const response = await this.fetchJson<Record<string, LobbyRoom> | null>('/rooms.json');
    const values = Object.values(response ?? {});
    return sortNewestFirst(values.filter((room) => isJoinableRoom(room, now)).map(toSummary));
  }

  async getRoom(roomId: string): Promise<LobbyRoom | null> {
    return this.fetchJson<LobbyRoom | null>(`/rooms/${roomId}.json`);
  }

  async joinRoom(roomId: string, input: JoinRoomInput): Promise<LobbyRoom> {
    const room = await this.getRoom(roomId);
    if (!room) {
      throw new Error('Room not found.');
    }
    if (room.status !== 'open' || room.guestName) {
      throw new Error('Room is no longer available.');
    }

    return this.updateRoom(roomId, {
      guestName: input.guestName,
      answerCode: input.answerCode,
      status: 'connected',
      updatedAt: nowMs(),
      lastHeartbeat: nowMs()
    });
  }

  async updateRoom(roomId: string, patch: Partial<LobbyRoom>): Promise<LobbyRoom> {
    const nextPatch = {
      ...patch,
      updatedAt: patch.updatedAt ?? nowMs()
    };
    await this.patchRoom(roomId, nextPatch);
    const room = await this.getRoom(roomId);
    if (!room) {
      throw new Error('Room not found after update.');
    }
    return room;
  }

  watchRoom(roomId: string, onUpdate: (room: LobbyRoom | null) => void): () => void {
    let stopped = false;

    const poll = async () => {
      if (stopped) {
        return;
      }
      onUpdate(await this.getRoom(roomId));
      window.setTimeout(poll, this.pollIntervalMs);
    };

    void poll();
    return () => {
      stopped = true;
    };
  }

  private async writeRoom(roomId: string, room: LobbyRoom): Promise<void> {
    await this.fetchJson(`/rooms/${roomId}.json`, {
      method: 'PUT',
      body: JSON.stringify(room)
    });
  }

  private async patchRoom(roomId: string, patch: Partial<LobbyRoom>): Promise<void> {
    await this.fetchJson(`/rooms/${roomId}.json`, {
      method: 'PATCH',
      body: JSON.stringify(patch)
    });
  }

  private async fetchJson<T>(path: string, init?: RequestInit): Promise<T> {
    const url = new URL(`${this.databaseUrl.replace(/\/$/, '')}${path}`);
    if (this.authToken) {
      url.searchParams.set('auth', this.authToken);
    }

    const response = await fetch(url.toString(), {
      ...init,
      headers: {
        'Content-Type': 'application/json',
        ...(init?.headers ?? {})
      }
    });

    if (!response.ok) {
      throw new Error(`Lobby provider request failed (${response.status}).`);
    }

    return (await response.json()) as T;
  }
}

export function loadLobbyProviderConfig(): LobbyProviderConfig | null {
  const parsed = safeParse<LobbyProviderConfig>(window.localStorage.getItem(CONFIG_KEY));
  if (!parsed || parsed.provider !== 'firebase-rtdb' || !parsed.databaseUrl) {
    return null;
  }
  return parsed;
}

export function saveLobbyProviderConfig(config: LobbyProviderConfig | null): void {
  if (!config) {
    window.localStorage.removeItem(CONFIG_KEY);
    return;
  }
  window.localStorage.setItem(CONFIG_KEY, JSON.stringify(config));
}

export function createLobbyStore(): LobbyStore {
  const config = loadLobbyProviderConfig();
  if (config?.provider === 'firebase-rtdb') {
    return new FirebaseLobbyStore(config.databaseUrl, config.authToken, config.pollIntervalMs);
  }
  return new LocalStorageLobbyStore();
}

export const lobbyTtlMs = LOBBY_TTL_MS;
