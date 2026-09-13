import koffi from 'koffi';
import { getIcoPath } from './paths';
import type { VideoBounds } from './types';
import { applyHwndIcon } from './win32Icon';

const WM_SIZE = 0x0005;
const WM_GETMINMAXINFO = 0x0024;
const WM_SIZING = 0x0214;
const WM_WINDOWPOSCHANGING = 0x0046;
const WM_SYSCOMMAND = 0x0112;
const WM_NCLBUTTONDBLCLK = 0x00a3;
const WM_DESTROY = 0x0002;
const SC_MAXIMIZE = 0xf030;
const SWP_NOSIZE = 0x0001;
const SWP_NOMOVE = 0x0002;
const SWP_NOZORDER = 0x0004;
const SWP_NOACTIVATE = 0x0010;
const SWP_FRAMECHANGED = 0x0020;
const SWP_SHOWWINDOW = 0x0040;
const GWL_STYLE = -16;
const GWL_EXSTYLE = -20;
const WS_CHILD = 0x40000000;
const WS_VISIBLE = 0x10000000;
const WS_CAPTION = 0x00c00000;
const WS_THICKFRAME = 0x00040000;
const WS_POPUP = 0x80000000;
const WS_SYSMENU = 0x00080000;
const WS_MINIMIZEBOX = 0x00020000;
const WS_MAXIMIZEBOX = 0x00010000;
const WS_CLIPCHILDREN = 0x02000000;
const WS_OVERLAPPEDWINDOW = 0x00cf0000;
const WS_EX_APPWINDOW = 0x00040000;
const WS_EX_TOOLWINDOW = 0x00000080;
const SW_SHOW = 5;
const SW_RESTORE = 9;
const BLACK_BRUSH = 4;
const IDC_ARROW = 32512;
const DWMWA_USE_IMMERSIVE_DARK_MODE = 20;
const HWND_TOPMOST = -1n;
const HWND_NOTOPMOST = -2n;
const ERROR_CLASS_ALREADY_EXISTS = 1410;
const CLASS_NAME = 'NovxMirrorVideoHost';
const WMSZ_LEFT = 1;
const WMSZ_RIGHT = 2;
const WMSZ_TOP = 3;
const WMSZ_TOPLEFT = 4;
const WMSZ_TOPRIGHT = 5;
const WMSZ_BOTTOM = 6;
const WMSZ_BOTTOMLEFT = 7;

const HOST_RECT = koffi.struct('HOST_RECT', {
  left: 'int32',
  top: 'int32',
  right: 'int32',
  bottom: 'int32',
});

koffi.struct('HOST_MINMAXINFO', {
  reservedX: 'int32',
  reservedY: 'int32',
  maxSizeX: 'int32',
  maxSizeY: 'int32',
  maxPosX: 'int32',
  maxPosY: 'int32',
  minTrackX: 'int32',
  minTrackY: 'int32',
  maxTrackX: 'int32',
  maxTrackY: 'int32',
});

koffi.struct('HOST_WINDOWPOS', {
  hwnd: 'uint64',
  hwndInsertAfter: 'uint64',
  x: 'int32',
  y: 'int32',
  cx: 'int32',
  cy: 'int32',
  flags: 'uint32',
});

const HOST_WNDCLASSEXW = koffi.struct('HOST_WNDCLASSEXW', {
  cbSize: 'uint32',
  style: 'uint32',
  lpfnWndProc: 'void *',
  cbClsExtra: 'int32',
  cbWndExtra: 'int32',
  hInstance: 'void *',
  hIcon: 'void *',
  hCursor: 'void *',
  hbrBackground: 'void *',
  lpszMenuName: 'void *',
  lpszClassName: 'void *',
  hIconSm: 'void *',
});

koffi.struct('HOST_MONITORINFO', {
  cbSize: 'uint32',
  monitorLeft: 'int32',
  monitorTop: 'int32',
  monitorRight: 'int32',
  monitorBottom: 'int32',
  workLeft: 'int32',
  workTop: 'int32',
  workRight: 'int32',
  workBottom: 'int32',
  dwFlags: 'uint32',
});

const WNDPROC = koffi.proto('__stdcall', 'int64', ['uint64', 'uint32', 'uint64', 'int64']);

let registeredProc: unknown = null;
let hostHwnd = 0n;
let childHwnd = 0n;
let targetRatio = 9 / 19.5;
let applying = false;
let classRegistered = false;

type Rect = { left: number; top: number; right: number; bottom: number };
type WindowPos = {
  hwnd: bigint | number;
  hwndInsertAfter: bigint | number;
  x: number;
  y: number;
  cx: number;
  cy: number;
  flags: number;
};
type MinMaxInfo = {
  reservedX: number;
  reservedY: number;
  maxSizeX: number;
  maxSizeY: number;
  maxPosX: number;
  maxPosY: number;
  minTrackX: number;
  minTrackY: number;
  maxTrackX: number;
  maxTrackY: number;
};

type HostApi = {
  CreateWindowExW: (
    ex: number,
    cls: string,
    title: string,
    style: number,
    x: number,
    y: number,
    w: number,
    h: number,
    parent: bigint,
    menu: bigint,
    inst: unknown,
    param: null,
  ) => bigint;
  DestroyWindow: (hwnd: bigint) => number;
  ShowWindow: (hwnd: bigint, cmd: number) => number;
  SetWindowPos: (
    hwnd: bigint,
    after: bigint,
    x: number,
    y: number,
    cx: number,
    cy: number,
    flags: number,
  ) => number;
  SetWindowTextW: (hwnd: bigint, title: string) => number;
  GetWindowRect: (hwnd: bigint, rect: unknown) => number;
  GetClientRect: (hwnd: bigint, rect: unknown) => number;
  SetParent: (child: bigint, parent: bigint) => bigint;
  GetWindowLongPtrW: (hwnd: bigint, index: number) => bigint;
  SetWindowLongPtrW: (hwnd: bigint, index: number, value: bigint) => bigint;
  DefWindowProcW: (hwnd: bigint, msg: number, w: bigint, l: bigint) => bigint;
  RegisterClassExW: (cls: unknown) => number;
  GetModuleHandleW: (name: null) => unknown;
  LoadCursorW: (inst: null, id: number) => unknown;
  LoadImageW: (
    inst: null,
    name: string,
    type: number,
    cx: number,
    cy: number,
    fu: number,
  ) => unknown;
  SendMessageW: (hwnd: bigint, msg: number, w: bigint, l: unknown) => bigint;
  GetStockObject: (i: number) => unknown;
  IsWindow: (hwnd: bigint) => number;
  IsZoomed: (hwnd: bigint) => number;
  MonitorFromWindow: (hwnd: bigint, flags: number) => unknown;
  GetMonitorInfoW: (mon: unknown, info: unknown) => number;
  DwmSetWindowAttribute: (hwnd: bigint, attr: number, val: unknown, size: number) => number;
  GetLastError: () => number;
};

let api: HostApi | null = null;

function asHwnd(value: bigint | number | null | undefined): bigint {
  if (value == null) return 0n;
  return typeof value === 'bigint' ? value : BigInt(value);
}

function asPtr(value: bigint | number): bigint {
  const n = typeof value === 'bigint' ? value : BigInt(value);
  return n < 0n ? n + 0x1_0000_0000_0000_0000n : n;
}

function logHost(message: string): void {
  console.error(`[videoHost] ${message}`);
}

function bind(): HostApi {
  if (api) return api;
  const user32 = koffi.load('user32.dll');
  const gdi32 = koffi.load('gdi32.dll');
  const kernel32 = koffi.load('kernel32.dll');
  const dwmapi = koffi.load('dwmapi.dll');
  api = {
    CreateWindowExW: user32.func('__stdcall', 'CreateWindowExW', 'uint64', [
      'uint32',
      'str16',
      'str16',
      'uint32',
      'int',
      'int',
      'int',
      'int',
      'uint64',
      'uint64',
      'void *',
      'void *',
    ]),
    DestroyWindow: user32.func('__stdcall', 'DestroyWindow', 'int', ['uint64']),
    ShowWindow: user32.func('__stdcall', 'ShowWindow', 'int', ['uint64', 'int']),
    SetWindowPos: user32.func('__stdcall', 'SetWindowPos', 'int', [
      'uint64',
      'int64',
      'int',
      'int',
      'int',
      'int',
      'uint32',
    ]),
    SetWindowTextW: user32.func('__stdcall', 'SetWindowTextW', 'int', ['uint64', 'str16']),
    GetWindowRect: user32.func('__stdcall', 'GetWindowRect', 'int', ['uint64', '_Out_ HOST_RECT *']),
    GetClientRect: user32.func('__stdcall', 'GetClientRect', 'int', ['uint64', '_Out_ HOST_RECT *']),
    SetParent: user32.func('__stdcall', 'SetParent', 'uint64', ['uint64', 'uint64']),
    GetWindowLongPtrW: user32.func('__stdcall', 'GetWindowLongPtrW', 'uint64', ['uint64', 'int']),
    SetWindowLongPtrW: user32.func('__stdcall', 'SetWindowLongPtrW', 'uint64', [
      'uint64',
      'int',
      'uint64',
    ]),
    DefWindowProcW: user32.func('__stdcall', 'DefWindowProcW', 'int64', [
      'uint64',
      'uint32',
      'uint64',
      'int64',
    ]),
    RegisterClassExW: user32.func('__stdcall', 'RegisterClassExW', 'uint16', [
      koffi.pointer(HOST_WNDCLASSEXW),
    ]),
    GetModuleHandleW: kernel32.func('__stdcall', 'GetModuleHandleW', 'void *', ['void *']),
    LoadCursorW: user32.func('__stdcall', 'LoadCursorW', 'void *', ['void *', 'uintptr']),
    LoadImageW: user32.func('__stdcall', 'LoadImageW', 'void *', [
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
      'void *',
    ]),
    GetStockObject: gdi32.func('__stdcall', 'GetStockObject', 'void *', ['int']),
    IsWindow: user32.func('__stdcall', 'IsWindow', 'int', ['uint64']),
    IsZoomed: user32.func('__stdcall', 'IsZoomed', 'int', ['uint64']),
    MonitorFromWindow: user32.func('__stdcall', 'MonitorFromWindow', 'void *', ['uint64', 'uint32']),
    GetMonitorInfoW: user32.func('__stdcall', 'GetMonitorInfoW', 'int', [
      'void *',
      '_Inout_ HOST_MONITORINFO *',
    ]),
    DwmSetWindowAttribute: dwmapi.func('__stdcall', 'DwmSetWindowAttribute', 'int', [
      'uint64',
      'uint32',
      'void *',
      'uint32',
    ]),
    GetLastError: kernel32.func('__stdcall', 'GetLastError', 'uint32', []),
  };
  return api;
}

function styleBits(hwnd: bigint, index: number): number {
  return Number(bind().GetWindowLongPtrW(hwnd, index) & 0xffffffffn);
}

function chromeDelta(hwnd: bigint): { ncW: number; ncH: number } {
  const win = bind();
  const wr: Rect = { left: 0, top: 0, right: 0, bottom: 0 };
  const cr: Rect = { left: 0, top: 0, right: 0, bottom: 0 };
  win.GetWindowRect(hwnd, wr);
  win.GetClientRect(hwnd, cr);
  return {
    ncW: Math.max(0, wr.right - wr.left - (cr.right - cr.left)),
    ncH: Math.max(0, wr.bottom - wr.top - (cr.bottom - cr.top)),
  };
}

function workArea(hwnd: bigint): Rect {
  const win = bind();
  const mi = {
    cbSize: 40,
    monitorLeft: 0,
    monitorTop: 0,
    monitorRight: 0,
    monitorBottom: 0,
    workLeft: 0,
    workTop: 0,
    workRight: 0,
    workBottom: 0,
    dwFlags: 0,
  };
  const mon = win.MonitorFromWindow(hwnd, 2);
  if (mon && win.GetMonitorInfoW(mon, mi)) {
    return { left: mi.workLeft, top: mi.workTop, right: mi.workRight, bottom: mi.workBottom };
  }
  return { left: 0, top: 0, right: 1920, bottom: 1080 };
}

function maxClientForRatio(hwnd: bigint): { w: number; h: number } {
  const work = workArea(hwnd);
  const maxW = Math.max(220, work.right - work.left - 16);
  const maxH = Math.max(240, work.bottom - work.top - 16);
  if (targetRatio >= 1) {
    let w = maxW;
    let h = Math.max(1, Math.round(w / targetRatio));
    if (h > maxH) {
      h = maxH;
      w = Math.max(1, Math.round(h * targetRatio));
    }
    return { w, h };
  }
  let h = maxH;
  let w = Math.max(1, Math.round(h * targetRatio));
  if (w > maxW) {
    w = maxW;
    h = Math.max(1, Math.round(w / targetRatio));
  }
  return { w, h };
}

function layoutChild(): void {
  if (!hostHwnd || !childHwnd) return;
  const win = bind();
  if (!win.IsWindow(hostHwnd) || !win.IsWindow(childHwnd)) return;
  const cr: Rect = { left: 0, top: 0, right: 0, bottom: 0 };
  win.GetClientRect(hostHwnd, cr);
  win.SetWindowPos(
    childHwnd,
    0n,
    0,
    0,
    Math.max(1, cr.right - cr.left),
    Math.max(1, cr.bottom - cr.top),
    SWP_NOZORDER | SWP_NOACTIVATE,
  );
}

function fitToWorkArea(hwnd: bigint): void {
  const win = bind();
  if (win.IsZoomed(hwnd)) win.ShowWindow(hwnd, SW_RESTORE);
  const { ncW, ncH } = chromeDelta(hwnd);
  const client = maxClientForRatio(hwnd);
  const work = workArea(hwnd);
  const outerW = client.w + ncW;
  const outerH = client.h + ncH;
  const x = work.left + Math.round((work.right - work.left - outerW) / 2);
  const y = work.top + Math.round((work.bottom - work.top - outerH) / 2);
  applying = true;
  win.SetWindowPos(hwnd, 0n, x, y, outerW, outerH, SWP_NOZORDER | SWP_NOACTIVATE);
  applying = false;
  layoutChild();
}

function constrainOuter(
  outerW: number,
  outerH: number,
  hwnd: bigint,
  driveWidth: boolean,
): { w: number; h: number } {
  const { ncW, ncH } = chromeDelta(hwnd);
  let clientW = Math.max(80, outerW - ncW);
  let clientH = Math.max(80, outerH - ncH);
  if (driveWidth) clientH = Math.max(80, Math.round(clientW / targetRatio));
  else clientW = Math.max(80, Math.round(clientH * targetRatio));
  const max = maxClientForRatio(hwnd);
  if (clientW > max.w || clientH > max.h) {
    clientW = max.w;
    clientH = max.h;
  }
  return { w: clientW + ncW, h: clientH + ncH };
}

function driveWidthForEdge(edge: number, proposed: Rect, current: Rect): boolean {
  if (edge === WMSZ_LEFT || edge === WMSZ_RIGHT) return true;
  if (edge === WMSZ_TOP || edge === WMSZ_BOTTOM) return false;
  const dW = Math.abs(proposed.right - proposed.left - (current.right - current.left));
  const dH = Math.abs(proposed.bottom - proposed.top - (current.bottom - current.top));
  return dW >= dH;
}

function applySizingRect(rect: Rect, edge: number, next: { w: number; h: number }): void {
  if (edge === WMSZ_LEFT || edge === WMSZ_TOPLEFT || edge === WMSZ_BOTTOMLEFT) {
    rect.left = rect.right - next.w;
  } else {
    rect.right = rect.left + next.w;
  }
  if (edge === WMSZ_TOP || edge === WMSZ_TOPLEFT || edge === WMSZ_TOPRIGHT) {
    rect.top = rect.bottom - next.h;
  } else {
    rect.bottom = rect.top + next.h;
  }
}

function wndProc(
  hwndRaw: bigint | number,
  msg: number,
  wParamRaw: bigint | number,
  lParamRaw: bigint | number,
): bigint {
  const win = bind();
  const hwnd = asHwnd(hwndRaw);
  const wParam = asHwnd(wParamRaw);
  const lParam = typeof lParamRaw === 'bigint' ? lParamRaw : BigInt(lParamRaw);
  try {
    if (msg === WM_SIZING && !applying) {
      const rect = koffi.decode(asPtr(lParam), HOST_RECT) as Rect;
      const current: Rect = { left: 0, top: 0, right: 0, bottom: 0 };
      win.GetWindowRect(hwnd, current);
      const edge = Number(wParam);
      const next = constrainOuter(
        rect.right - rect.left,
        rect.bottom - rect.top,
        hwnd,
        driveWidthForEdge(edge, rect, current),
      );
      applySizingRect(rect, edge, next);
      koffi.encode(asPtr(lParam), HOST_RECT, rect);
      return 1n;
    }
    if (msg === WM_WINDOWPOSCHANGING && !applying) {
      const pos = koffi.decode(asPtr(lParam), 'HOST_WINDOWPOS') as WindowPos;
      if ((pos.flags & SWP_NOSIZE) === 0 && pos.cx > 0 && pos.cy > 0) {
        const wr: Rect = { left: 0, top: 0, right: 0, bottom: 0 };
        win.GetWindowRect(hwnd, wr);
        const driveWidth =
          Math.abs(pos.cx - (wr.right - wr.left)) >= Math.abs(pos.cy - (wr.bottom - wr.top));
        const next = constrainOuter(pos.cx, pos.cy, hwnd, driveWidth);
        pos.cx = next.w;
        pos.cy = next.h;
        koffi.encode(asPtr(lParam), 'HOST_WINDOWPOS', pos);
      }
    }
    if (msg === WM_GETMINMAXINFO) {
      const info = koffi.decode(asPtr(lParam), 'HOST_MINMAXINFO') as MinMaxInfo;
      const { ncW, ncH } = chromeDelta(hwnd);
      const minClient =
        targetRatio >= 1
          ? { w: 240, h: Math.max(80, Math.round(240 / targetRatio)) }
          : { w: Math.max(80, Math.round(320 * targetRatio)), h: 320 };
      const max = maxClientForRatio(hwnd);
      info.minTrackX = minClient.w + ncW;
      info.minTrackY = minClient.h + ncH;
      info.maxTrackX = max.w + ncW;
      info.maxTrackY = max.h + ncH;
      koffi.encode(asPtr(lParam), 'HOST_MINMAXINFO', info);
      return 0n;
    }
    if (msg === WM_SYSCOMMAND && (Number(wParam) & 0xfff0) === SC_MAXIMIZE) {
      fitToWorkArea(hwnd);
      return 0n;
    }
    if (msg === WM_NCLBUTTONDBLCLK) {
      fitToWorkArea(hwnd);
      return 0n;
    }
    if (msg === WM_SIZE) {
      layoutChild();
    }
    if (msg === WM_DESTROY) {
      hostHwnd = 0n;
    }
  } catch (err) {
    logHost(`wndProc msg=${msg} ${err instanceof Error ? err.message : String(err)}`);
  }
  return win.DefWindowProcW(hwnd, msg, wParam, lParam);
}

function registerClass(): void {
  if (classRegistered) return;
  const win = bind();
  registeredProc = koffi.register(wndProc, koffi.pointer(WNDPROC));
  const inst = win.GetModuleHandleW(null);
  const classNameBuf = Buffer.from(`${CLASS_NAME}\0`, 'utf16le');
  const cls = {
    cbSize: koffi.sizeof(HOST_WNDCLASSEXW),
    style: 0x0003,
    lpfnWndProc: registeredProc,
    cbClsExtra: 0,
    cbWndExtra: 0,
    hInstance: inst,
    hIcon: null,
    hCursor: win.LoadCursorW(null, IDC_ARROW),
    hbrBackground: win.GetStockObject(BLACK_BRUSH),
    lpszMenuName: null,
    lpszClassName: classNameBuf,
    hIconSm: null,
  };
  const atom = win.RegisterClassExW(cls);
  if (!atom) {
    const gle = win.GetLastError();
    if (gle !== ERROR_CLASS_ALREADY_EXISTS) {
      throw new Error(`RegisterClassExW failed gle=${gle}`);
    }
  }
  classRegistered = true;
}

function applyIcons(hwnd: bigint): void {
  applyHwndIcon(hwnd, getIcoPath('icon.ico'));
}

function applyDarkTitle(hwnd: bigint): void {
  const win = bind();
  const dark = Buffer.alloc(4);
  dark.writeInt32LE(1, 0);
  try {
    win.DwmSetWindowAttribute(hwnd, DWMWA_USE_IMMERSIVE_DARK_MODE, dark, 4);
  } catch {
    // ignore
  }
}

export function setHostAspectRatio(ratio: number): void {
  if (ratio > 0.05) targetRatio = ratio;
}

export function getVideoHostHwnd(): bigint | null {
  return hostHwnd && bind().IsWindow(hostHwnd) ? hostHwnd : null;
}

export function setVideoHostPinned(pinned: boolean): boolean {
  const hwnd = getVideoHostHwnd();
  if (!hwnd) return false;
  bind().SetWindowPos(
    hwnd,
    pinned ? HWND_TOPMOST : HWND_NOTOPMOST,
    0,
    0,
    0,
    0,
    SWP_NOMOVE | SWP_NOSIZE | SWP_NOACTIVATE | SWP_SHOWWINDOW,
  );
  return true;
}

export function destroyVideoHost(): void {
  const win = bind();
  if (childHwnd && win.IsWindow(childHwnd)) {
    try {
      win.SetParent(childHwnd, 0n);
    } catch {
      // UxPlay may already have destroyed the HWND
    }
  }
  if (hostHwnd && win.IsWindow(hostHwnd)) {
    win.DestroyWindow(hostHwnd);
  }
  hostHwnd = 0n;
  childHwnd = 0n;
}

export function refitVideoHostInPlace(ratio: number): boolean {
  setHostAspectRatio(ratio);
  const hwnd = getVideoHostHwnd();
  if (!hwnd) return false;
  const win = bind();
  const wr: Rect = { left: 0, top: 0, right: 0, bottom: 0 };
  if (!win.GetWindowRect(hwnd, wr)) return false;
  const { ncW, ncH } = chromeDelta(hwnd);
  const work = workArea(hwnd);
  const maxW = Math.max(220, work.right - work.left - 16);
  const maxH = Math.max(240, work.bottom - work.top - 16);
  const clientW = Math.max(1, wr.right - wr.left - ncW);
  const clientH = Math.max(1, wr.bottom - wr.top - ncH);
  const base = Math.max(clientW, clientH);
  let tw: number;
  let th: number;
  if (ratio >= 1) {
    tw = Math.min(maxW, base);
    th = Math.max(1, Math.round(tw / ratio));
    if (th > maxH) {
      th = maxH;
      tw = Math.max(1, Math.round(th * ratio));
    }
  } else {
    th = Math.min(maxH, base);
    tw = Math.max(1, Math.round(th * ratio));
    if (tw > maxW) {
      tw = maxW;
      th = Math.max(1, Math.round(tw / ratio));
    }
  }
  const outerW = Math.max(120, tw + ncW);
  const outerH = Math.max(120, th + ncH);
  const cx = Math.round((wr.left + wr.right) / 2);
  const cy = Math.round((wr.top + wr.bottom) / 2);
  const nx = Math.max(work.left + 8, Math.min(cx - Math.round(outerW / 2), work.right - 8 - outerW));
  const ny = Math.max(work.top + 8, Math.min(cy - Math.round(outerH / 2), work.bottom - 8 - outerH));
  applying = true;
  win.SetWindowPos(hwnd, 0n, nx, ny, outerW, outerH, SWP_NOZORDER | SWP_NOACTIVATE);
  applying = false;
  layoutChild();
  return true;
}

export function placeVideoHost(bounds: VideoBounds, title: string, ratio: number): bigint {
  const win = bind();
  setHostAspectRatio(ratio);
  registerClass();
  if (!hostHwnd || !win.IsWindow(hostHwnd)) {
    hostHwnd = asHwnd(
      win.CreateWindowExW(
        WS_EX_APPWINDOW,
        CLASS_NAME,
        title,
        WS_OVERLAPPEDWINDOW | WS_CLIPCHILDREN,
        bounds.x,
        bounds.y,
        bounds.width,
        bounds.height,
        0n,
        0n,
        win.GetModuleHandleW(null),
        null,
      ),
    );
    if (!hostHwnd) {
      throw new Error(`CreateWindowExW failed gle=${win.GetLastError()}`);
    }
    applyIcons(hostHwnd);
    applyDarkTitle(hostHwnd);
  } else {
    win.SetWindowTextW(hostHwnd, title);
  }
  const next = constrainOuter(bounds.width, bounds.height, hostHwnd, targetRatio >= 1);
  applying = true;
  win.SetWindowPos(
    hostHwnd,
    0n,
    bounds.x,
    bounds.y,
    next.w,
    next.h,
    SWP_NOZORDER | SWP_SHOWWINDOW,
  );
  applying = false;
  win.ShowWindow(hostHwnd, SW_SHOW);
  layoutChild();
  return hostHwnd;
}

export function embedUxPlayInHost(child: bigint): void {
  const win = bind();
  if (!hostHwnd || !win.IsWindow(hostHwnd) || !win.IsWindow(child)) return;
  if (childHwnd === child && win.IsWindow(childHwnd)) {
    layoutChild();
    return;
  }
  let style = styleBits(child, GWL_STYLE);
  style &= ~(WS_POPUP | WS_CAPTION | WS_THICKFRAME | WS_SYSMENU | WS_MINIMIZEBOX | WS_MAXIMIZEBOX);
  style |= WS_CHILD | WS_VISIBLE;
  win.SetWindowLongPtrW(child, GWL_STYLE, BigInt(style >>> 0));
  let ex = styleBits(child, GWL_EXSTYLE);
  ex &= ~WS_EX_APPWINDOW;
  ex |= WS_EX_TOOLWINDOW;
  win.SetWindowLongPtrW(child, GWL_EXSTYLE, BigInt(ex >>> 0));
  win.SetParent(child, hostHwnd);
  childHwnd = child;
  win.SetWindowPos(
    child,
    0n,
    0,
    0,
    0,
    0,
    SWP_NOMOVE | SWP_NOSIZE | SWP_NOZORDER | SWP_FRAMECHANGED | SWP_SHOWWINDOW,
  );
  layoutChild();
}
