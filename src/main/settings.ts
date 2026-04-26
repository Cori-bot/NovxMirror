import { app, safeStorage } from 'electron';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, isAbsolute } from 'node:path';
import type { ConnectBehavior, Fps, Locale, Resolution, Settings, Theme } from './types';

const USER_DATA = join(app.getPath('appData'), 'airmirror');
const SETTINGS_FILE = join(USER_DATA, 'settings.json');

const SETTINGS_SCHEMA_VERSION = 2;

export const DEFAULT_SETTINGS: Settings = {
  name: 'NOVX Mirror',
  pin: null,
  pinEnabled: false,
  fps: 60,
  resolution: '1080p',
  audioEnabled: true,
  screenshotDir: null,
  theme: 'dark',
  locale: 'en',
  firstLaunch: true,
  autoStart: true,
  minimizeToTray: true,
  startMinimized: false,
  connectBehavior: 'hide',
};

// AirPlay mirroring from iPhone négocie au max 1920x1080 quel que soit le -s annoncé.
// Garder d'autres valeurs trompait l'utilisateur (cf. 120fps debunk).
const VALID_RESOLUTIONS: ReadonlySet<Resolution> = new Set(['1080p']);
const VALID_FPS: ReadonlySet<Fps> = new Set([30, 60]);
const VALID_THEMES: ReadonlySet<Theme> = new Set(['light', 'dark', 'midnight']);
const VALID_LOCALES: ReadonlySet<Locale> = new Set(['fr', 'en', 'de']);
const VALID_CONNECT_BEHAVIORS: ReadonlySet<ConnectBehavior> = new Set(['hide', 'keep']);
const MAX_RECEIVER_NAME_LENGTH = 30;
const MAX_SCREENSHOT_PATH_LENGTH = 260;

function asString(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

function normalizeReceiverName(value: unknown): string {
  const cleaned = asString(value)
    .replace(/[\r\n\t]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, MAX_RECEIVER_NAME_LENGTH);
  return cleaned || DEFAULT_SETTINGS.name;
}

function encryptSettingSecret(value: unknown): string | null {
  const secret = asString(value).trim();
  if (!secret) return null;
  try {
    if (safeStorage.isEncryptionAvailable()) {
      return safeStorage.encryptString(secret).toString('base64');
    }
  } catch {
    // ignore
  }
  return null;
}

function decryptSettingSecret(value: unknown): string | null {
  const encoded = asString(value).trim();
  if (!encoded) return null;
  try {
    if (safeStorage.isEncryptionAvailable()) {
      return safeStorage.decryptString(Buffer.from(encoded, 'base64'));
    }
  } catch {
    // ignore
  }
  return null;
}

interface NormalizeOptions {
  allowLegacy720p?: boolean;
}

export function normalizeSettings(input: unknown = {}, options: NormalizeOptions = {}): Settings {
  const source =
    input && typeof input === 'object' && !Array.isArray(input)
      ? (input as Record<string, unknown>)
      : {};
  const allowedResolutions: ReadonlySet<Resolution> = options.allowLegacy720p
    ? new Set<Resolution>(['720p', '1080p', '1440p', '4k'])
    : VALID_RESOLUTIONS;

  const pinRaw = asString(source['pin']).trim();
  const pin = /^\d{4}$/.test(pinRaw) ? pinRaw : null;
  const pinEnabled = !!source['pinEnabled'] && !!pin;

  let screenshotDir: string | null = asString(source['screenshotDir']).trim();
  if (
    !screenshotDir ||
    screenshotDir.length > MAX_SCREENSHOT_PATH_LENGTH ||
    !isAbsolute(screenshotDir)
  ) {
    screenshotDir = null;
  }

  const fpsCandidate = Number(source['fps']);
  const resolutionCandidate = asString(source['resolution']).toLowerCase() as Resolution;
  const themeCandidate = asString(source['theme']) as Theme;
  const localeCandidate = asString(source['locale']) as Locale;

  return {
    ...DEFAULT_SETTINGS,
    name: normalizeReceiverName(source['name']),
    pinEnabled,
    pin: pinEnabled ? pin : null,
    fps: VALID_FPS.has(fpsCandidate as Fps) ? (fpsCandidate as Fps) : DEFAULT_SETTINGS.fps,
    resolution: allowedResolutions.has(resolutionCandidate)
      ? resolutionCandidate
      : DEFAULT_SETTINGS.resolution,
    audioEnabled: source['audioEnabled'] !== false,
    screenshotDir,
    theme: VALID_THEMES.has(themeCandidate) ? themeCandidate : DEFAULT_SETTINGS.theme,
    locale: VALID_LOCALES.has(localeCandidate) ? localeCandidate : DEFAULT_SETTINGS.locale,
    firstLaunch:
      typeof source['firstLaunch'] === 'boolean'
        ? source['firstLaunch']
        : DEFAULT_SETTINGS.firstLaunch,
    autoStart:
      typeof source['autoStart'] === 'boolean' ? source['autoStart'] : DEFAULT_SETTINGS.autoStart,
    minimizeToTray:
      typeof source['minimizeToTray'] === 'boolean'
        ? source['minimizeToTray']
        : DEFAULT_SETTINGS.minimizeToTray,
    startMinimized:
      typeof source['startMinimized'] === 'boolean'
        ? source['startMinimized']
        : DEFAULT_SETTINGS.startMinimized,
    connectBehavior: VALID_CONNECT_BEHAVIORS.has(
      asString(source['connectBehavior']) as ConnectBehavior,
    )
      ? (asString(source['connectBehavior']) as ConnectBehavior)
      : DEFAULT_SETTINGS.connectBehavior,
  };
}

export function loadSettings(): Settings {
  try {
    if (existsSync(SETTINGS_FILE)) {
      const raw = JSON.parse(readFileSync(SETTINGS_FILE, 'utf8')) as Record<string, unknown>;
      const decryptedPin = decryptSettingSecret(raw['pinEncrypted']);
      const legacyPinRaw = asString(raw['pin']).trim();
      const legacyPin = /^\d{4}$/.test(legacyPinRaw) ? legacyPinRaw : null;
      const isLegacy = raw['schemaVersion'] !== SETTINGS_SCHEMA_VERSION;
      const normalized = normalizeSettings(
        {
          ...raw,
          pin: decryptedPin ?? legacyPin,
          // Re-trigger the language picker once for users coming from the old app.
          firstLaunch: isLegacy ? true : raw['firstLaunch'],
        },
        { allowLegacy720p: true },
      );
      if (legacyPin || 'pin' in raw || isLegacy) {
        saveSettings(normalized);
      }
      return normalized;
    }
  } catch {
    // fall through
  }
  return { ...DEFAULT_SETTINGS };
}

export function saveSettings(settings: Settings): void {
  const normalized = normalizeSettings(settings);
  mkdirSync(USER_DATA, { recursive: true });
  const persisted = {
    ...normalized,
    pin: undefined,
    pinEncrypted: normalized.pinEnabled ? encryptSettingSecret(normalized.pin) : null,
    schemaVersion: SETTINGS_SCHEMA_VERSION,
  };
  writeFileSync(SETTINGS_FILE, JSON.stringify(persisted, null, 2));
}

export function getScreenshotDirectory(settings: Settings = loadSettings()): string {
  const configured = (settings.screenshotDir ?? '').trim();
  if (configured) return configured;
  return join(app.getPath('pictures'), 'NovX Mirror');
}
