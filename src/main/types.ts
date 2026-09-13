export type Theme = 'light' | 'dark' | 'midnight';
export type Locale = 'fr' | 'en' | 'de';
export type Resolution = '720p' | '1080p' | '1440p' | '4k';
export type Fps = 30 | 60;
export type ConnectBehavior = 'hide' | 'keep';

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

export type ReceiverStatus = 'stopped' | 'starting' | 'waiting' | 'connected' | 'error';

export interface StatusUpdate {
  status: ReceiverStatus;
  device?: string | null;
  connectedAt?: Date | null;
  name?: string;
  message?: string;
}

export interface VideoCrop {
  left: number;
  right: number;
  top: number;
  bottom: number;
}

export interface UxPlayOptions {
  name: string;
  pin: string | null;
  fps: Fps;
  maxWidth: number;
  maxHeight: number;
  audioEnabled: boolean;
  videoCrop: VideoCrop | null;
}

export interface VideoBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface VideoAspect {
  width: number;
  height: number;
}

export interface OverlayLayout {
  window: VideoBounds;
  content: VideoBounds;
}

export interface LogEntry {
  time: string;
  text: string;
}

export interface AppErrorPayload {
  message: string;
  type?: string;
}

export interface AppSuccessPayload {
  type: string;
  message?: string;
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

/** Chromium display-capture grant used by REC (see setDisplayMediaRequestHandler). */
export type RecordingCaptureMode = 'window' | 'screen' | 'window-silent' | 'loopback';

export type NativeRecordingStartResult = { ok: true } | { ok: false; error: string };

export type NativeRecordingStopResult = {
  path: string | null;
  hasAudio: boolean;
  error?: string;
};
