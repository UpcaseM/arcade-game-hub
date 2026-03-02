export interface UiSettings {
  reducedMotion: boolean;
  colorAssist: boolean;
  musicVolume: number;
  sfxVolume: number;
  musicMuted: boolean;
  sfxMuted: boolean;
}

const STORAGE_KEY = 'dou-shou-qi.ui-settings.v1';

export const DEFAULT_UI_SETTINGS: UiSettings = {
  reducedMotion: false,
  colorAssist: true,
  musicVolume: 0.35,
  sfxVolume: 0.8,
  musicMuted: false,
  sfxMuted: false
};

export function loadUiSettings(): UiSettings {
  const raw = globalThis.localStorage?.getItem(STORAGE_KEY);
  if (!raw) {
    return { ...DEFAULT_UI_SETTINGS };
  }

  try {
    const parsed = JSON.parse(raw) as Partial<UiSettings>;
    return {
      reducedMotion: parsed.reducedMotion ?? DEFAULT_UI_SETTINGS.reducedMotion,
      colorAssist: parsed.colorAssist ?? DEFAULT_UI_SETTINGS.colorAssist,
      musicVolume: parsed.musicVolume ?? DEFAULT_UI_SETTINGS.musicVolume,
      sfxVolume: parsed.sfxVolume ?? DEFAULT_UI_SETTINGS.sfxVolume,
      musicMuted: parsed.musicMuted ?? DEFAULT_UI_SETTINGS.musicMuted,
      sfxMuted: parsed.sfxMuted ?? DEFAULT_UI_SETTINGS.sfxMuted
    };
  } catch {
    return { ...DEFAULT_UI_SETTINGS };
  }
}

export function saveUiSettings(settings: UiSettings): void {
  globalThis.localStorage?.setItem(STORAGE_KEY, JSON.stringify(settings));
}
