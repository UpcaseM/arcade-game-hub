import { describe, expect, it, beforeEach } from 'vitest';
import { DEFAULT_UI_SETTINGS, loadUiSettings, saveUiSettings } from './settings';

class MemoryStorage {
  private readonly data = new Map<string, string>();

  getItem(key: string): string | null {
    return this.data.get(key) ?? null;
  }

  setItem(key: string, value: string): void {
    this.data.set(key, value);
  }

  clear(): void {
    this.data.clear();
  }
}

describe('ui settings', () => {
  const memoryStorage = new MemoryStorage();

  beforeEach(() => {
    memoryStorage.clear();
    Object.defineProperty(globalThis, 'localStorage', {
      configurable: true,
      value: memoryStorage
    });
  });

  it('loads defaults when nothing is saved', () => {
    expect(loadUiSettings()).toEqual(DEFAULT_UI_SETTINGS);
  });

  it('persists and reloads settings', () => {
    saveUiSettings({
      reducedMotion: true,
      colorAssist: false,
      musicVolume: 0.5,
      sfxVolume: 0.4,
      musicMuted: true,
      sfxMuted: false
    });
    expect(loadUiSettings()).toEqual({
      reducedMotion: true,
      colorAssist: false,
      musicVolume: 0.5,
      sfxVolume: 0.4,
      musicMuted: true,
      sfxMuted: false
    });
  });
});
