import { existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import { recWarn } from './recordingLog';

const require = createRequire(import.meta.url);

const ASAR = 'app.asar';

/** `…/app.asar/x` → `…/app.asar.unpacked/x` : un binaire n'est pas exécutable depuis l'archive. */
function toUnpacked(p: string): string {
  const i = p.indexOf(ASAR);
  if (i === -1) return p;
  const after = p.slice(i + ASAR.length);
  if (after.startsWith('.unpacked')) return p;
  return `${p.slice(0, i)}${ASAR}.unpacked${after}`;
}

/** Resolves the unpacked ffmpeg-static binary (rawvideo HWND + libx264). */
export function resolveFfmpegPath(): string | null {
  try {
    const resolved: unknown = require('ffmpeg-static');
    if (typeof resolved === 'string') {
      const candidate = toUnpacked(resolved);
      if (existsSync(candidate)) return candidate;
      recWarn(`ffmpeg-static: binaire introuvable (${candidate})`);
    }
  } catch (err) {
    recWarn(`ffmpeg-static: ${err instanceof Error ? err.message : String(err)}`);
  }
  return null;
}
