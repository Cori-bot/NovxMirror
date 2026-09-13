import { app, nativeImage, type NativeImage } from 'electron';
import { existsSync, readFileSync, readdirSync, unlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

export function gstHwndFile(pid: number): string {
  return join(tmpdir(), `novx-hwnd-${String(pid)}.txt`);
}

export function readGstHwnd(pid: number): bigint | null {
  try {
    const raw = readFileSync(gstHwndFile(pid), 'utf8').trim();
    if (!raw) return null;
    const n = BigInt(raw);
    return n === 0n ? null : n;
  } catch {
    return null;
  }
}

export function gstAspectFile(pid: number): string {
  return join(tmpdir(), `novx-aspect-${String(pid)}.json`);
}

export function gstBoundsFile(pid: number): string {
  return join(tmpdir(), `novx-bounds-${String(pid)}.json`);
}

export function cleanupTempFiles(): void {
  try {
    const tmp = tmpdir();
    readdirSync(tmp)
      .filter((f) => /^novx-(hwnd|aspect|bounds)-/.test(f))
      .forEach((f) => {
        try {
          unlinkSync(join(tmp, f));
        } catch {
          // ignore
        }
      });
  } catch {
    // ignore
  }
}

function projectRoot(): string {
  return join(__dirname, '..', '..');
}

/**
 * On-disk `bin/` (UxPlay + GStreamer DLLs). Never an asar virtual path:
 * Electron `existsSync` succeeds inside asar, but Windows cannot spawn those exes.
 */
export function resolveNativeBinDir(): string | null {
  const candidates = app.isPackaged
    ? [join(process.resourcesPath, 'bin')]
    : [join(projectRoot(), 'bin')];
  for (const dir of candidates) {
    if (existsSync(join(dir, 'uxplay.exe'))) return dir;
  }
  return null;
}

export function resolveUxPlayBinary(): string | null {
  const dir = resolveNativeBinDir();
  return dir ? join(dir, 'uxplay.exe') : null;
}

export function getIcoPath(filename: string): string {
  if (app.isPackaged) {
    return join(process.resourcesPath, filename);
  }
  return join(projectRoot(), 'assets', filename);
}

/** Chemin absolu du .ico principal (préféré sous Windows pour BrowserWindow). */
export function getWindowIconPath(): string {
  const ico = getIcoPath('icon.ico');
  if (existsSync(ico)) return ico;
  const png = app.isPackaged
    ? join(process.resourcesPath, 'novx-logo-256-removebg.png')
    : join(projectRoot(), 'assets', 'novx-logo-256-removebg.png');
  return png;
}

function loadIcon(candidates: string[]): NativeImage | undefined {
  for (const path of candidates) {
    if (!existsSync(path)) continue;
    const image = nativeImage.createFromPath(path);
    if (!image.isEmpty()) return image;
  }
  return undefined;
}

/** Sous Windows, préférer le .ico embarqué (barre des tâches / exe). */
export function getMainWindowIcon(): NativeImage | undefined {
  const icoPath = getIcoPath('icon.ico');
  const pngPath = join(projectRoot(), 'assets', 'novx-logo-256-removebg.png');
  const packagedPng = app.isPackaged
    ? join(process.resourcesPath, 'novx-logo-256-removebg.png')
    : pngPath;

  // PNG d'abord : nativeImage gère mal certains multi-size ICO (png-to-ico),
  // ce qui laisse le logo Electron par défaut sur la fenêtre stats.
  if (process.platform === 'win32') {
    return loadIcon([packagedPng, pngPath, icoPath]);
  }
  return loadIcon([packagedPng, pngPath, icoPath]);
}

export function getTrayWindowIcon(): NativeImage {
  const icoPath = getIcoPath('tray-icon.ico');
  const fallbackIco = getIcoPath('icon.ico');
  const pngPath = join(projectRoot(), 'assets', 'novx-logo-32-removebg.png');
  const packagedPng = app.isPackaged
    ? join(process.resourcesPath, 'novx-logo-32-removebg.png')
    : pngPath;

  if (process.platform === 'win32') {
    return (
      loadIcon([packagedPng, pngPath, icoPath, fallbackIco]) ?? nativeImage.createEmpty()
    );
  }
  return loadIcon([packagedPng, pngPath, icoPath, fallbackIco]) ?? nativeImage.createEmpty();
}

export function getTrayMenuIcon(): NativeImage {
  const image = getTrayWindowIcon();
  if (image.isEmpty()) return image;
  return image.resize({ width: 16, height: 16, quality: 'best' });
}
