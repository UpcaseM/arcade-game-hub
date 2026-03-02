import test from 'node:test';
import assert from 'node:assert/strict';
import { webcrypto } from 'node:crypto';
import { createAuthService } from '../auth.js';

if (!globalThis.btoa) {
  globalThis.btoa = (value) => Buffer.from(value, 'binary').toString('base64');
}
if (!globalThis.atob) {
  globalThis.atob = (value) => Buffer.from(value, 'base64').toString('binary');
}

class MemoryStorage {
  #data = new Map();

  getItem(key) {
    return this.#data.get(key) ?? null;
  }

  setItem(key, value) {
    this.#data.set(key, String(value));
  }

  removeItem(key) {
    this.#data.delete(key);
  }

  dump() {
    return new Map(this.#data);
  }
}

function createTestAuth() {
  const storage = new MemoryStorage();
  const auth = createAuthService({ storage, cryptoApi: webcrypto });
  return { auth, storage };
}

test('seeds default admin and stores hashed password only', async () => {
  const { auth, storage } = createTestAuth();
  await auth.ensureSeeded();
  const users = auth.listUsers();
  assert.equal(users.length, 1);
  assert.equal(users[0].username, 'admin');
  assert.equal(users[0].role, 'admin');

  const storeRaw = storage.getItem(auth.keys.AUTH_STORAGE_KEY);
  assert.ok(storeRaw);
  const parsed = JSON.parse(storeRaw);
  assert.equal(parsed.users[0].password.hash.includes('admin123'), false);
});

test('login/logout updates session user', async () => {
  const { auth } = createTestAuth();
  await auth.ensureSeeded();

  const bad = await auth.login('admin', 'wrong');
  assert.equal(bad.ok, false);

  const good = await auth.login('admin', 'admin123');
  assert.equal(good.ok, true);
  assert.equal(auth.getCurrentUser()?.username, 'admin');

  auth.logout();
  assert.equal(auth.getCurrentUser(), null);
});

test('admin CRUD enforces last-admin protection', async () => {
  const { auth } = createTestAuth();
  await auth.ensureSeeded();
  await auth.login('admin', 'admin123');

  const created = await auth.createUser({
    username: 'player01',
    password: 'player01pass',
    role: 'player'
  });
  assert.equal(created.ok, true);

  const updated = await auth.updateUser(created.user.id, {
    role: 'admin',
    password: 'newpass1'
  });
  assert.equal(updated.ok, true);

  const adminUser = auth.listUsers().find((user) => user.username === 'admin');
  const demoteLast = await auth.updateUser(adminUser.id, { role: 'player' });
  assert.equal(demoteLast.ok, true);

  const users = auth.listUsers();
  assert.equal(users.filter((user) => user.role === 'admin').length, 1);

  const deleteLastAdmin = await auth.deleteUser(
    users.find((user) => user.role === 'admin').id
  );
  assert.equal(deleteLastAdmin.ok, false);
});

