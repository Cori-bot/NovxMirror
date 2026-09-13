import { existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import { recWarn } from './recordingLog';

const require = createRequire(import.meta.url);

/** Resolves the unpacked ffmpeg-static binary (rawvideo HWND + libx264). */
export function resolveFfmpegPath(): string | null {
  try {
    const resolved: unknown = require('ffmpeg-static');
    if (typeof resolved === 'string' && existsSync(resolved)) return resolved;
  } catch (err) {
    recWarn(`ffmpeg-static: ${err instanceof Error ? err.message : String(err)}`);
  }
  return null;
}
