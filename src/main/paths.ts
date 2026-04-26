import { app, nativeImage, type NativeImage } from 'electron';
import { existsSync, readdirSync, unlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

export function gstHwndFile(pid: number): string {
  return join(tmpdir(), `novx-hwnd-${String(pid)}.txt`);
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

export function getIcoPath(filename: string): string {
  if (app.isPackaged) {
    return join(process.resourcesPath, filename);
  }
  return join(projectRoot(), 'assets', filename);
}

export function getMainWindowIcon(): NativeImage | undefined {
  const pngPath = join(projectRoot(), 'assets', 'novx-logo-256-removebg.png');
  const icoPath = getIcoPath('icon.ico');
  const candidate = existsSync(pngPath) ? pngPath : icoPath;
  const image = nativeImage.createFromPath(candidate);
  return image.isEmpty() ? undefined : image;
}

export function getTrayWindowIcon(): NativeImage {
  const pngPath = join(projectRoot(), 'assets', 'novx-logo-32-removebg.png');
  const icoPath = getIcoPath('tray-icon.ico');
  const candidate = existsSync(pngPath) ? pngPath : icoPath;
  const image = nativeImage.createFromPath(candidate);
  return image.isEmpty() ? nativeImage.createEmpty() : image;
}

export function getTrayMenuIcon(): NativeImage {
  const image = getTrayWindowIcon();
  if (image.isEmpty()) return image;
  return image.resize({ width: 16, height: 16, quality: 'best' });
}
