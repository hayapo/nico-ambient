export const SETTINGS_KEY = 'nicoAmbientSettings';

export type Settings = { enabled: boolean; brightness: number; spread: number };

export const NUMERIC_SETTINGS = {
  brightness: { min: 0, max: 100, step: 1, default: 65 },
  spread: { min: 0, max: 400, step: 1, default: 200 },
} as const;

function normalizeNumber(
  value: unknown,
  range: { min: number; max: number; default: number },
) {
  return typeof value === 'number' && Number.isFinite(value)
    ? Math.max(range.min, Math.min(range.max, value))
    : range.default;
}

export const normalizeSettings = (input: unknown = {}): Settings => {
  const value =
    input && typeof input === 'object' ? (input as Partial<Settings>) : {};
  return {
    enabled: typeof value.enabled === 'boolean' ? value.enabled : true,
    brightness: normalizeNumber(value.brightness, NUMERIC_SETTINGS.brightness),
    spread: normalizeNumber(value.spread, NUMERIC_SETTINGS.spread),
  };
};

export function createSettingsStore() {
  let settings = normalizeSettings();
  return {
    get: () => settings,
    set(value: unknown) {
      settings = normalizeSettings(value);
    },
    async load() {
      const result = await chrome.storage.local.get(SETTINGS_KEY);
      settings = normalizeSettings(result[SETTINGS_KEY]);
    },
    save: () => chrome.storage.local.set({ [SETTINGS_KEY]: settings }),
  };
}

export type SettingsStore = ReturnType<typeof createSettingsStore>;
