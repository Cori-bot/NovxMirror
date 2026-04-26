export type Locale = 'fr' | 'en' | 'de';
export type Theme = 'light' | 'dark' | 'midnight';
export type Resolution = '720p' | '1080p' | '1440p' | '4k';
export type Fps = 30 | 60;
export type ConnectBehavior = 'hide' | 'keep';
export type ReceiverStatus = 'stopped' | 'starting' | 'waiting' | 'connected' | 'error';

export interface Settings {
  name: string;
  pin: string | null;
  pinEnabled: boolean;
  fps: Fps;
  resolution: Resolution;
  audioEnabled: boolean;
  screenshotDir: string | null;
  theme: Theme;
  locale: Locale;
  firstLaunch: boolean;
  autoStart: boolean;
  minimizeToTray: boolean;
  startMinimized: boolean;
  connectBehavior: ConnectBehavior;
}

export interface SettingsPayload extends Settings {
  screenshotDirDefault: string;
  screenshotDirDisplay: string;
}

export interface StatusUpdate {
  status: ReceiverStatus;
  device?: string | null;
  connectedAt?: Date | string | null;
  name?: string;
  message?: string;
}

export interface LogEntry {
  time: string;
  text: string;
}

export interface StreamStats {
  resolution: { width: number; height: number } | null;
  fps: number | null;
  codec: string | null;
  audio: boolean;
  bytesReceived: number | null;
  latencyMs: number | null;
  packetLoss: number | null;
}
