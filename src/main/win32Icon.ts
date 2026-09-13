import koffi from 'koffi';
import { existsSync } from 'node:fs';
import { app, type BrowserWindow } from 'electron';

const WM_SETICON = 0x0080;
const IMAGE_ICON = 1;
const LR_LOADFROMFILE = 0x0000_0010;
const LR_SHARED = 0x0000_8000;
const GCLP_HICON = -14;
const GCLP_HICONSM = -34;
const ICON_SMALL = 0n;
const ICON_BIG = 1n;

/** Fresh AUMID — `com.novx.mirror` was poisoned by Start Menu Electron.lnk (pnpm dev). */
const PACKAGED_AUMID = 'com.novx.mirror.app';
const DEV_AUMID = 'com.novx.mirror.app.dev';
/** Legacy IDs to clear from Jump Lists / shortcuts on install. */
export const LEGACY_APP_USER_MODEL_IDS = ['com.novx.mirror', 'com.novx.mirror.dev'] as const;

type User32IconApi = {
  LoadImageW: (
    inst: null,
    name: string,
    type: number,
    cx: number,
    cy: number,
    fu: number,
  ) => bigint;
  SendMessageW: (hwnd: bigint, msg: number, w: bigint, l: bigint) => bigint;
  SetClassLongPtrW: (hwnd: bigint, index: number, value: bigint) => bigint;
};

let api: User32IconApi | null = null;
const taskbarDetailsDone = new WeakSet<BrowserWindow>();

function bind(): User32IconApi {
  if (api) return api;
  const user32 = koffi.load('user32.dll');
  api = {
    LoadImageW: user32.func('__stdcall', 'LoadImageW', 'uint64', [
      'void *',
      'str16',
      'uint32',
      'int',
      'int',
      'uint32',
    ]),
    SendMessageW: user32.func('__stdcall', 'SendMessageW', 'int64', [
      'uint64',
      'uint32',
      'uint64',
      'uint64',
    ]),
    SetClassLongPtrW: user32.func('__stdcall', 'SetClassLongPtrW', 'uint64', [
      'uint64',
      'int',
      'uint64',
    ]),
  };
  return api;
}

function asHandle(value: unknown): bigint {
  if (value == null || value === false) return 0n;
  if (typeof value === 'bigint') return value;
  if (typeof value === 'number' && Number.isFinite(value)) return BigInt(Math.trunc(value));
  if (typeof value === 'string' && value !== '') {
    try {
      return BigInt(value);
    } catch {
      return 0n;
    }
  }
  return 0n;
}

function isSet(handle: bigint): boolean {
  return handle !== 0n;
}

export function novxAppUserModelId(packaged: boolean): string {
  return packaged ? PACKAGED_AUMID : DEV_AUMID;
}

export function hwndFromNativeHandle(buf: Buffer): bigint {
  if (buf.length >= 8) return buf.readBigUInt64LE(0);
  if (buf.length >= 4) return BigInt(buf.readUInt32LE(0));
  return 0n;
}

function loadIcon(icoPath: string, cx: number, cy: number): bigint {
  return asHandle(
    bind().LoadImageW(null, icoPath, IMAGE_ICON, cx, cy, LR_LOADFROMFILE | LR_SHARED),
  );
}

/** Apply NOVX .ico to a native HWND (UxPlay / video host title + class icons). */
export function applyHwndIcon(hwnd: bigint, icoPath: string): boolean {
  if (process.platform !== 'win32' || !isSet(hwnd) || !existsSync(icoPath)) return false;
  try {
    const win = bind();
    const small = loadIcon(icoPath, 16, 16);
    let large = loadIcon(icoPath, 32, 32);
    if (!isSet(large)) large = loadIcon(icoPath, 48, 48);
    if (!isSet(small) && !isSet(large)) return false;
    if (isSet(small)) {
      win.SetClassLongPtrW(hwnd, GCLP_HICONSM, small);
      win.SendMessageW(hwnd, WM_SETICON, ICON_SMALL, small);
    }
    if (isSet(large)) {
      win.SetClassLongPtrW(hwnd, GCLP_HICON, large);
      win.SendMessageW(hwnd, WM_SETICON, ICON_BIG, large);
    }
    return true;
  } catch {
    return false;
  }
}

export type NovxAppDetails = {
  appId: string;
  appIconPath: string;
  relaunchCommand: string;
  relaunchDisplayName: string;
};

export function buildNovxAppDetails(icoPath: string): NovxAppDetails {
  const execPath = process.execPath;
  const quoted = execPath.includes(' ') ? `"${execPath}"` : execPath;
  return {
    appId: novxAppUserModelId(app.isPackaged),
    appIconPath: icoPath,
    relaunchCommand: quoted,
    relaunchDisplayName: 'NOVX Mirror',
  };
}

/**
 * Windows taskbar button: official Electron API (AppUserModelID + RelaunchIconResource).
 * @see https://www.electronjs.org/docs/latest/api/browser-window#winsetappdetailsoptions
 */
export function applyBrowserWindowIcon(win: BrowserWindow, icoPath: string): void {
  if (win.isDestroyed() || !existsSync(icoPath)) return;

  if (process.platform !== 'win32') {
    try {
      win.setIcon(icoPath);
    } catch {
      // ignore
    }
    return;
  }

  if (!taskbarDetailsDone.has(win)) {
    try {
      const details = buildNovxAppDetails(icoPath);
      win.setAppDetails({
        appId: details.appId,
        appIconPath: details.appIconPath,
        appIconIndex: 0,
        relaunchCommand: details.relaunchCommand,
        relaunchDisplayName: details.relaunchDisplayName,
      });
      taskbarDetailsDone.add(win);
    } catch {
      // ignore — still try HWND icon below
    }
  }

  try {
    applyHwndIcon(hwndFromNativeHandle(win.getNativeWindowHandle()), icoPath);
  } catch {
    // ignore
  }
}
