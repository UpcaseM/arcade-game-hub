const AUTH_STORAGE_KEY = 'arcade_auth_store_v1';
const SESSION_STORAGE_KEY = 'arcade_auth_session_v1';
const ACTIVE_USER_STORAGE_KEY = 'arcade_active_user_v1';
const PBKDF2_ITERATIONS = 120000;
const DEFAULT_ADMIN = {
  username: 'admin',
  password: 'admin123',
  role: 'admin'
};

function nowIso() {
  return new Date().toISOString();
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function normalizeUsername(username) {
  return String(username ?? '')
    .trim()
    .toLowerCase();
}

function toBase64(buffer) {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary);
}

function fromBase64(value) {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

function randomSalt(cryptoApi) {
  const salt = new Uint8Array(16);
  cryptoApi.getRandomValues(salt);
  return toBase64(salt);
}

async function derivePasswordHash(cryptoApi, password, saltBase64, iterations = PBKDF2_ITERATIONS) {
  const encoder = new TextEncoder();
  const keyMaterial = await cryptoApi.subtle.importKey(
    'raw',
    encoder.encode(password),
    { name: 'PBKDF2' },
    false,
    ['deriveBits']
  );
  const bits = await cryptoApi.subtle.deriveBits(
    {
      name: 'PBKDF2',
      hash: 'SHA-256',
      salt: fromBase64(saltBase64),
      iterations
    },
    keyMaterial,
    256
  );
  return toBase64(bits);
}

function createId() {
  return `u_${Math.random().toString(36).slice(2, 10)}_${Date.now().toString(36)}`;
}

function validateUsernameInput(raw) {
  const username = normalizeUsername(raw);
  if (!username) {
    return { ok: false, reason: 'Username is required.' };
  }
  if (!/^[a-z0-9_-]{3,24}$/.test(username)) {
    return { ok: false, reason: 'Username must be 3-24 chars: a-z, 0-9, _ or -.' };
  }
  return { ok: true, username };
}

function validateRole(role) {
  if (role !== 'admin' && role !== 'player') {
    return { ok: false, reason: 'Role must be admin or player.' };
  }
  return { ok: true, role };
}

function validatePassword(password) {
  if (typeof password !== 'string' || password.length < 6) {
    return { ok: false, reason: 'Password must be at least 6 characters.' };
  }
  return { ok: true };
}

function ensureStoreShape(raw) {
  if (!raw || typeof raw !== 'object') {
    return null;
  }
  if (raw.version !== 1 || !Array.isArray(raw.users)) {
    return null;
  }
  return raw;
}

function publicUser(user) {
  return {
    id: user.id,
    username: user.username,
    role: user.role,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt
  };
}

export function createAuthService(options = {}) {
  const storage = options.storage ?? globalThis.localStorage;
  const cryptoApi = options.cryptoApi ?? globalThis.crypto;

  if (!storage) {
    throw new Error('Storage is unavailable.');
  }
  if (!cryptoApi?.subtle) {
    throw new Error('WebCrypto is unavailable.');
  }

  function readStore() {
    const raw = storage.getItem(AUTH_STORAGE_KEY);
    if (!raw) {
      return null;
    }
    try {
      return ensureStoreShape(JSON.parse(raw));
    } catch {
      return null;
    }
  }

  function writeStore(store) {
    storage.setItem(AUTH_STORAGE_KEY, JSON.stringify(store));
  }

  async function buildUser(usernameRaw, password, role) {
    const userValidation = validateUsernameInput(usernameRaw);
    if (!userValidation.ok) {
      return { ok: false, reason: userValidation.reason };
    }
    const roleValidation = validateRole(role);
    if (!roleValidation.ok) {
      return { ok: false, reason: roleValidation.reason };
    }
    const passwordValidation = validatePassword(password);
    if (!passwordValidation.ok) {
      return { ok: false, reason: passwordValidation.reason };
    }

    const salt = randomSalt(cryptoApi);
    const hash = await derivePasswordHash(cryptoApi, password, salt);
    const stamp = nowIso();

    return {
      ok: true,
      user: {
        id: createId(),
        username: userValidation.username,
        role: roleValidation.role,
        password: {
          salt,
          hash,
          iterations: PBKDF2_ITERATIONS
        },
        createdAt: stamp,
        updatedAt: stamp
      }
    };
  }

  async function ensureSeeded() {
    const existing = readStore();
    if (existing && existing.users.length > 0) {
      return clone(existing);
    }

    const seeded = await buildUser(DEFAULT_ADMIN.username, DEFAULT_ADMIN.password, DEFAULT_ADMIN.role);
    if (!seeded.ok) {
      throw new Error(seeded.reason ?? 'Failed to seed admin.');
    }

    const store = {
      version: 1,
      users: [seeded.user],
      createdAt: nowIso(),
      updatedAt: nowIso()
    };
    writeStore(store);
    return clone(store);
  }

  function listUsers() {
    const store = readStore();
    if (!store) {
      return [];
    }
    return store.users.map(publicUser);
  }

  function currentSession() {
    const raw = storage.getItem(SESSION_STORAGE_KEY);
    if (!raw) {
      return null;
    }
    try {
      const parsed = JSON.parse(raw);
      if (!parsed?.userId) {
        return null;
      }
      return parsed;
    } catch {
      return null;
    }
  }

  function getCurrentUser() {
    const store = readStore();
    const session = currentSession();
    if (!store || !session) {
      return null;
    }
    const user = store.users.find((entry) => entry.id === session.userId);
    return user ? publicUser(user) : null;
  }

  function setSessionForUser(user) {
    const session = {
      userId: user.id,
      username: user.username,
      role: user.role,
      at: nowIso()
    };
    storage.setItem(SESSION_STORAGE_KEY, JSON.stringify(session));
    storage.setItem(ACTIVE_USER_STORAGE_KEY, JSON.stringify({ username: user.username, role: user.role }));
    return session;
  }

  function clearSession() {
    storage.removeItem(SESSION_STORAGE_KEY);
    storage.removeItem(ACTIVE_USER_STORAGE_KEY);
  }

  async function verifyPassword(user, password) {
    const computed = await derivePasswordHash(
      cryptoApi,
      password,
      user.password.salt,
      user.password.iterations ?? PBKDF2_ITERATIONS
    );
    return computed === user.password.hash;
  }

  async function login(usernameRaw, password) {
    const usernameValidation = validateUsernameInput(usernameRaw);
    if (!usernameValidation.ok) {
      return { ok: false, reason: 'Invalid username or password.' };
    }

    const store = readStore();
    if (!store) {
      return { ok: false, reason: 'User store unavailable.' };
    }

    const user = store.users.find((entry) => entry.username === usernameValidation.username);
    if (!user) {
      return { ok: false, reason: 'Invalid username or password.' };
    }

    const valid = await verifyPassword(user, password);
    if (!valid) {
      return { ok: false, reason: 'Invalid username or password.' };
    }

    setSessionForUser(user);
    return { ok: true, user: publicUser(user) };
  }

  function logout() {
    clearSession();
    return { ok: true };
  }

  function requireAdmin() {
    const user = getCurrentUser();
    if (!user || user.role !== 'admin') {
      return { ok: false, reason: 'Admin privileges required.' };
    }
    return { ok: true, user };
  }

  async function createUser(payload) {
    const gate = requireAdmin();
    if (!gate.ok) {
      return gate;
    }

    const store = readStore();
    if (!store) {
      return { ok: false, reason: 'User store unavailable.' };
    }

    const built = await buildUser(payload.username, payload.password, payload.role);
    if (!built.ok) {
      return built;
    }

    const exists = store.users.some((entry) => entry.username === built.user.username);
    if (exists) {
      return { ok: false, reason: 'Username already exists.' };
    }

    store.users.push(built.user);
    store.updatedAt = nowIso();
    writeStore(store);
    return { ok: true, user: publicUser(built.user) };
  }

  async function updateUser(userId, payload) {
    const gate = requireAdmin();
    if (!gate.ok) {
      return gate;
    }

    const store = readStore();
    if (!store) {
      return { ok: false, reason: 'User store unavailable.' };
    }

    const user = store.users.find((entry) => entry.id === userId);
    if (!user) {
      return { ok: false, reason: 'User not found.' };
    }

    if (payload.role !== undefined) {
      const roleValidation = validateRole(payload.role);
      if (!roleValidation.ok) {
        return roleValidation;
      }
      if (user.role === 'admin' && roleValidation.role !== 'admin') {
        const adminCount = store.users.filter((entry) => entry.role === 'admin').length;
        if (adminCount <= 1) {
          return { ok: false, reason: 'Cannot demote the last admin.' };
        }
      }
      user.role = roleValidation.role;
    }

    if (payload.password !== undefined && payload.password !== '') {
      const passwordValidation = validatePassword(payload.password);
      if (!passwordValidation.ok) {
        return passwordValidation;
      }
      const salt = randomSalt(cryptoApi);
      user.password = {
        salt,
        hash: await derivePasswordHash(cryptoApi, payload.password, salt),
        iterations: PBKDF2_ITERATIONS
      };
    }

    user.updatedAt = nowIso();
    store.updatedAt = nowIso();
    writeStore(store);
    return { ok: true, user: publicUser(user) };
  }

  async function deleteUser(userId) {
    const gate = requireAdmin();
    if (!gate.ok) {
      return gate;
    }

    const store = readStore();
    if (!store) {
      return { ok: false, reason: 'User store unavailable.' };
    }

    const user = store.users.find((entry) => entry.id === userId);
    if (!user) {
      return { ok: false, reason: 'User not found.' };
    }
    if (user.role === 'admin') {
      const adminCount = store.users.filter((entry) => entry.role === 'admin').length;
      if (adminCount <= 1) {
        return { ok: false, reason: 'Cannot delete the last admin.' };
      }
    }

    const nextUsers = store.users.filter((entry) => entry.id !== userId);
    store.users = nextUsers;
    store.updatedAt = nowIso();
    writeStore(store);

    const session = currentSession();
    if (session?.userId === userId) {
      clearSession();
    }
    return { ok: true };
  }

  return {
    keys: {
      AUTH_STORAGE_KEY,
      SESSION_STORAGE_KEY,
      ACTIVE_USER_STORAGE_KEY
    },
    defaults: {
      adminUsername: DEFAULT_ADMIN.username,
      adminPassword: DEFAULT_ADMIN.password
    },
    ensureSeeded,
    listUsers,
    getCurrentUser,
    login,
    logout,
    createUser,
    updateUser,
    deleteUser
  };
}
