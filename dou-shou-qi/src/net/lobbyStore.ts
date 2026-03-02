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
  transportMode?: 'webrtc' | 'relay';
  hostRelay?: { seq: number; at: number; message: unknown };
  guestRelay?: { seq: number; at: number; message: unknown };
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
  transportMode?: 'webrtc' | 'relay';
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
const BUNDLED_CONFIG_GLOBAL = '__DOU_SHOU_QI_LOBBY_CONFIG__';
export const LOBBY_PROVIDER_FALLBACK_EVENT = 'dou-shou-qi:lobby-provider-fallback';

export type LobbyProviderConfig = {
  provider: 'firebase-rtdb';
  databaseUrl: string;
  authToken?: string;
  pollIntervalMs?: number;
};

type LocalOnlyConfig = {
  provider: 'local-only';
};

type StoredLobbyProviderConfig = LobbyProviderConfig | LocalOnlyConfig;
export type LobbyProviderConfigSource = 'local' | 'bundled' | 'none';

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

export function normalizeFirebaseDatabaseUrl(databaseUrl: string): string {
  const trimmed = databaseUrl.trim();
  if (!trimmed) {
    return '';
  }

  const withProtocol = /^[a-zA-Z][a-zA-Z\d+\-.]*:\/\//.test(trimmed) ? trimmed : `https://${trimmed}`;
  try {
    const parsed = new URL(withProtocol);
    parsed.pathname = '/';
    parsed.search = '';
    parsed.hash = '';
    return parsed.toString().replace(/\/$/, '');
  } catch {
    return trimmed
      .replace(/\/rooms(?:\.json)?$/i, '')
      .replace(/\/[^/]+\.json$/i, '')
      .replace(/\/+$/, '');
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
      transportMode: input.transportMode ?? 'webrtc',
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
      transportMode: input.transportMode ?? 'webrtc',
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
      throw new LobbyProviderHttpError(response.status);
    }

    return (await response.json()) as T;
  }
}

class LobbyProviderHttpError extends Error {
  constructor(readonly status: number) {
    super(`Lobby provider request failed (${status}).`);
    this.name = 'LobbyProviderHttpError';
  }
}

function dispatchLobbyFallbackSignal(): void {
  const fallbackEvent =
    typeof Event === 'function'
      ? new Event(LOBBY_PROVIDER_FALLBACK_EVENT)
      : ({ type: LOBBY_PROVIDER_FALLBACK_EVENT } as Event);
  window.dispatchEvent(fallbackEvent);
}

function shouldFallbackToLocal(error: unknown): boolean {
  if (error instanceof LobbyProviderHttpError) {
    return error.status >= 500;
  }

  const status = (error as { status?: unknown })?.status;
  if (typeof status === 'number') {
    return status >= 500;
  }

  const message = String(error ?? '');
  if (
    message.includes('Failed to fetch') ||
    message.includes('NetworkError') ||
    message.includes('Network request failed') ||
    message.includes('fetch failed') ||
    message.includes('Load failed')
  ) {
    return true;
  }

  return false;
}

class ResilientLobbyStore implements LobbyStore {
  private active: LobbyStore;
  private fallbackUsed = false;

  constructor(private readonly primary: LobbyStore, private readonly fallback: LobbyStore) {
    this.active = primary;
  }

  async createRoom(input: CreateRoomInput): Promise<LobbyRoom> {
    return this.withFallback((store) => store.createRoom(input));
  }

  async listOpenRooms(now?: number): Promise<LobbyRoomSummary[]> {
    return this.withFallback((store) => store.listOpenRooms(now));
  }

  async getRoom(roomId: string): Promise<LobbyRoom | null> {
    return this.withFallback((store) => store.getRoom(roomId));
  }

  async joinRoom(roomId: string, input: JoinRoomInput): Promise<LobbyRoom> {
    return this.withFallback((store) => store.joinRoom(roomId, input));
  }

  async updateRoom(roomId: string, patch: Partial<LobbyRoom>): Promise<LobbyRoom> {
    return this.withFallback((store) => store.updateRoom(roomId, patch));
  }

  watchRoom(roomId: string, onUpdate: (room: LobbyRoom | null) => void): () => void {
    let stopped = false;
    let pollTimer: number | null = null;

    const poll = async () => {
      if (stopped) {
        return;
      }
      try {
        onUpdate(await this.getRoom(roomId));
      } catch {
        onUpdate(null);
      }
      pollTimer = window.setTimeout(poll, 1200);
    };

    void poll();
    return () => {
      stopped = true;
      if (pollTimer !== null) {
        window.clearTimeout(pollTimer);
        pollTimer = null;
      }
    };
  }

  private async withFallback<T>(operation: (store: LobbyStore) => Promise<T>): Promise<T> {
    try {
      return await operation(this.active);
    } catch (error) {
      if (this.fallbackUsed || this.active !== this.primary || !shouldFallbackToLocal(error)) {
        throw error;
      }
      this.fallbackUsed = true;
      this.active = this.fallback;
      console.warn('[DouShouQi] Remote lobby unavailable; switching to local-only fallback.');
      dispatchLobbyFallbackSignal();
      return operation(this.active);
    }
  }
}

function parseStoredConfig(raw: string | null): StoredLobbyProviderConfig | null {
  const parsed = safeParse<StoredLobbyProviderConfig>(raw);
  if (!parsed) {
    return null;
  }
  if (parsed.provider === 'local-only') {
    return parsed;
  }
  if (parsed.provider === 'firebase-rtdb' && parsed.databaseUrl) {
    const normalizedUrl = normalizeFirebaseDatabaseUrl(parsed.databaseUrl);
    if (!normalizedUrl) {
      return null;
    }
    return {
      ...parsed,
      databaseUrl: normalizedUrl
    };
  }
  return null;
}

function loadBundledLobbyConfig(): LobbyProviderConfig | null {
  const bundled = (window as Window & { [BUNDLED_CONFIG_GLOBAL]?: unknown })[BUNDLED_CONFIG_GLOBAL];
  if (!bundled || typeof bundled !== 'object') {
    return null;
  }

  const parsed = bundled as Partial<LobbyProviderConfig>;
  if (parsed.provider !== 'firebase-rtdb' || !parsed.databaseUrl) {
    return null;
  }

  const normalizedUrl = normalizeFirebaseDatabaseUrl(parsed.databaseUrl);
  if (!normalizedUrl) {
    return null;
  }

  return {
    provider: 'firebase-rtdb',
    databaseUrl: normalizedUrl,
    authToken: parsed.authToken,
    pollIntervalMs: parsed.pollIntervalMs
  };
}

export function resolveLobbyProviderConfig(): { config: LobbyProviderConfig | null; source: LobbyProviderConfigSource } {
  const stored = parseStoredConfig(window.localStorage.getItem(CONFIG_KEY));
  if (stored?.provider === 'local-only') {
    return { config: null, source: 'none' };
  }
  if (stored?.provider === 'firebase-rtdb') {
    return { config: stored, source: 'local' };
  }

  const bundled = loadBundledLobbyConfig();
  if (bundled) {
    return { config: bundled, source: 'bundled' };
  }

  return { config: null, source: 'none' };
}

export function loadLobbyProviderConfig(): LobbyProviderConfig | null {
  return resolveLobbyProviderConfig().config;
}

export function saveLobbyProviderConfig(config: LobbyProviderConfig | null): void {
  if (!config) {
    window.localStorage.removeItem(CONFIG_KEY);
    return;
  }
  const normalizedUrl = normalizeFirebaseDatabaseUrl(config.databaseUrl);
  window.localStorage.setItem(CONFIG_KEY, JSON.stringify({
    ...config,
    databaseUrl: normalizedUrl
  }));
}

export function saveLocalOnlyLobbyConfig(): void {
  window.localStorage.setItem(CONFIG_KEY, JSON.stringify({ provider: 'local-only' as const }));
}

export function createLobbyStore(): LobbyStore {
  const config = loadLobbyProviderConfig();
  if (config?.provider === 'firebase-rtdb') {
    return new ResilientLobbyStore(
      new FirebaseLobbyStore(config.databaseUrl, config.authToken, config.pollIntervalMs),
      new LocalStorageLobbyStore()
    );
  }
  return new LocalStorageLobbyStore();
}

export const lobbyTtlMs = LOBBY_TTL_MS;
