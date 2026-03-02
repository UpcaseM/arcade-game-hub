export interface UiSettings {
  reducedMotion: boolean;
  colorAssist: boolean;
  sound: boolean;
}

const STORAGE_KEY = 'dou-shou-qi.ui-settings.v1';

export const DEFAULT_UI_SETTINGS: UiSettings = {
  reducedMotion: false,
  colorAssist: true,
  sound: false
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
      sound: parsed.sound ?? DEFAULT_UI_SETTINGS.sound
    };
  } catch {
    return { ...DEFAULT_UI_SETTINGS };
  }
}

export function saveUiSettings(settings: UiSettings): void {
  globalThis.localStorage?.setItem(STORAGE_KEY, JSON.stringify(settings));
}
