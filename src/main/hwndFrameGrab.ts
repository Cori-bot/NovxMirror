import koffi from 'koffi';
import { recWarn } from './recordingLog';

const PW_RENDERFULLCONTENT = 2;
const SRCCOPY = 0x00cc0020;
const DIB_RGB_COLORS = 0;
const BI_RGB = 0;
const HALFTONE = 4;
const BLACKNESS = 0x00000042;

koffi.struct('RECT', {
  left: 'int32',
  top: 'int32',
  right: 'int32',
  bottom: 'int32',
});

koffi.struct('POINT', {
  x: 'int32',
  y: 'int32',
});

const BITMAPINFO = koffi.struct('BITMAPINFO', {
  biSize: 'uint32',
  biWidth: 'int32',
  biHeight: 'int32',
  biPlanes: 'uint16',
  biBitCount: 'uint16',
  biCompression: 'uint32',
  biSizeImage: 'uint32',
  biXPelsPerMeter: 'int32',
  biYPelsPerMeter: 'int32',
  biClrUsed: 'uint32',
  biClrImportant: 'uint32',
});

let api: {
  IsWindow: (hwnd: bigint) => number;
  GetClientRect: (hwnd: bigint, rect: unknown) => number;
  GetWindowRect: (hwnd: bigint, rect: unknown) => number;
  ClientToScreen: (hwnd: bigint, pt: unknown) => number;
  GetDC: (hwnd: bigint) => unknown;
  ReleaseDC: (hwnd: bigint, hdc: unknown) => number;
  PrintWindow: (hwnd: bigint, hdc: unknown, flags: number) => number;
  CreateCompatibleDC: (hdc: unknown) => unknown;
  DeleteDC: (hdc: unknown) => number;
  CreateDIBSection: (
    hdc: unknown,
    bmi: unknown,
    usage: number,
    bits: unknown[],
    section: null,
    offset: number,
  ) => unknown;
  SelectObject: (hdc: unknown, obj: unknown) => unknown;
  DeleteObject: (obj: unknown) => number;
  StretchBlt: (
    dst: unknown,
    x: number,
    y: number,
    w: number,
    h: number,
    src: unknown,
    sx: number,
    sy: number,
    sw: number,
    sh: number,
    rop: number,
  ) => number;
  SetStretchBltMode: (hdc: unknown, mode: number) => number;
  PatBlt: (hdc: unknown, x: number, y: number, w: number, h: number, rop: number) => number;
} | null = null;

let memcpy: ((dest: Buffer, src: unknown, n: number) => unknown) | null = null;

function bind(): typeof api {
  if (api) return api;
  const user32 = koffi.load('user32.dll');
  const gdi32 = koffi.load('gdi32.dll');
  const msvcrt = koffi.load('msvcrt.dll');
  memcpy = msvcrt.func('memcpy', 'void *', ['void *', 'void *', 'size_t']);
  api = {
    IsWindow: user32.func('__stdcall', 'IsWindow', 'int', ['uint64']),
    GetClientRect: user32.func('__stdcall', 'GetClientRect', 'int', ['uint64', '_Out_ RECT *']),
    GetWindowRect: user32.func('__stdcall', 'GetWindowRect', 'int', ['uint64', '_Out_ RECT *']),
    ClientToScreen: user32.func('__stdcall', 'ClientToScreen', 'int', ['uint64', '_Inout_ POINT *']),
    GetDC: user32.func('__stdcall', 'GetDC', 'void *', ['uint64']),
    ReleaseDC: user32.func('__stdcall', 'ReleaseDC', 'int', ['uint64', 'void *']),
    PrintWindow: user32.func('__stdcall', 'PrintWindow', 'int', ['uint64', 'void *', 'uint32']),
    CreateCompatibleDC: gdi32.func('__stdcall', 'CreateCompatibleDC', 'void *', ['void *']),
    DeleteDC: gdi32.func('__stdcall', 'DeleteDC', 'int', ['void *']),
    CreateDIBSection: gdi32.func('__stdcall', 'CreateDIBSection', 'void *', [
      'void *',
      koffi.pointer(BITMAPINFO),
      'uint32',
      '_Out_ void **',
      'void *',
      'uint32',
    ]),
    SelectObject: gdi32.func('__stdcall', 'SelectObject', 'void *', ['void *', 'void *']),
    DeleteObject: gdi32.func('__stdcall', 'DeleteObject', 'int', ['void *']),
    StretchBlt: gdi32.func('__stdcall', 'StretchBlt', 'int', [
      'void *',
      'int',
      'int',
      'int',
      'int',
      'void *',
      'int',
      'int',
      'int',
      'int',
      'uint32',
    ]),
    SetStretchBltMode: gdi32.func('__stdcall', 'SetStretchBltMode', 'int', ['void *', 'int']),
    PatBlt: gdi32.func('__stdcall', 'PatBlt', 'int', ['void *', 'int', 'int', 'int', 'int', 'uint32']),
  };
  return api;
}

export function even(n: number): number {
  return Math.max(2, Math.floor(n / 2) * 2);
}

export function getClientSize(hwnd: bigint): { width: number; height: number } | null {
  const win = bind();
  if (!win || !win.IsWindow(hwnd)) return null;
  const rect = { left: 0, top: 0, right: 0, bottom: 0 };
  if (!win.GetClientRect(hwnd, rect)) return null;
  const width = rect.right - rect.left;
  const height = rect.bottom - rect.top;
  if (width < 2 || height < 2) return null;
  return { width, height };
}

function windowLayout(hwnd: bigint): {
  winW: number;
  winH: number;
  cropX: number;
  cropY: number;
  cropW: number;
  cropH: number;
} | null {
  const win = bind();
  if (!win) return null;
  const window = { left: 0, top: 0, right: 0, bottom: 0 };
  const client = { left: 0, top: 0, right: 0, bottom: 0 };
  const pt = { x: 0, y: 0 };
  if (!win.GetWindowRect(hwnd, window) || !win.GetClientRect(hwnd, client) || !win.ClientToScreen(hwnd, pt)) {
    return null;
  }
  const winW = window.right - window.left;
  const winH = window.bottom - window.top;
  const cropW = client.right - client.left;
  const cropH = client.bottom - client.top;
  const cropX = Math.max(0, pt.x - window.left);
  const cropY = Math.max(0, pt.y - window.top);
  if (winW < 2 || winH < 2 || cropW < 2 || cropH < 2) return null;
  if (cropX + cropW > winW || cropY + cropH > winH) return null;
  return { winW, winH, cropX, cropY, cropW, cropH };
}

function makeBmi(width: number, height: number): object {
  return {
    biSize: 40,
    biWidth: width,
    biHeight: -height,
    biPlanes: 1,
    biBitCount: 32,
    biCompression: BI_RGB,
    biSizeImage: width * height * 4,
    biXPelsPerMeter: 0,
    biYPelsPerMeter: 0,
    biClrUsed: 0,
    biClrImportant: 0,
  };
}

function copyBits(ptr: unknown, bytes: number): Buffer | null {
  if (!ptr || !memcpy) return null;
  const buf = Buffer.allocUnsafe(bytes);
  try {
    memcpy(buf, ptr, bytes);
    return buf;
  } catch {
    return null;
  }
}

function letterbox(
  srcW: number,
  srcH: number,
  dstW: number,
  dstH: number,
): { x: number; y: number; w: number; h: number } {
  const scale = Math.min(dstW / srcW, dstH / srcH);
  const w = Math.max(1, Math.round(srcW * scale));
  const h = Math.max(1, Math.round(srcH * scale));
  return { x: Math.floor((dstW - w) / 2), y: Math.floor((dstH - h) / 2), w, h };
}

/**
 * PrintWindow(PW_RENDERFULLCONTENT) of the HWND, then crop the client area.
 * Follows moves and ignores windows stacked on top (unlike a desktop crop).
 */
export function grabHwndFrame(hwnd: bigint, outW: number, outH: number): Buffer | null {
  const win = bind();
  if (!win || !win.IsWindow(hwnd)) return null;
  const layout = windowLayout(hwnd);
  if (!layout) return null;

  const screenDc = win.GetDC(hwnd);
  if (!screenDc) return null;
  const srcDc = win.CreateCompatibleDC(screenDc);
  const dstDc = win.CreateCompatibleDC(screenDc);
  const srcBits: unknown[] = [null];
  const dstBits: unknown[] = [null];
  const srcDib = win.CreateDIBSection(
    screenDc,
    makeBmi(layout.winW, layout.winH),
    DIB_RGB_COLORS,
    srcBits,
    null,
    0,
  );
  const dstDib = win.CreateDIBSection(screenDc, makeBmi(outW, outH), DIB_RGB_COLORS, dstBits, null, 0);
  try {
    if (!srcDc || !dstDc || !srcDib || !dstDib) return null;
    win.SelectObject(srcDc, srcDib);
    win.SelectObject(dstDc, dstDib);
    let painted = win.PrintWindow(hwnd, srcDc, PW_RENDERFULLCONTENT);
    if (!painted) painted = win.PrintWindow(hwnd, srcDc, 0);
    if (!painted) return null;

    win.PatBlt(dstDc, 0, 0, outW, outH, BLACKNESS);
    win.SetStretchBltMode(dstDc, HALFTONE);
    if (layout.cropW === outW && layout.cropH === outH) {
      win.StretchBlt(
        dstDc,
        0,
        0,
        outW,
        outH,
        srcDc,
        layout.cropX,
        layout.cropY,
        layout.cropW,
        layout.cropH,
        SRCCOPY,
      );
    } else {
      const box = letterbox(layout.cropW, layout.cropH, outW, outH);
      win.StretchBlt(
        dstDc,
        box.x,
        box.y,
        box.w,
        box.h,
        srcDc,
        layout.cropX,
        layout.cropY,
        layout.cropW,
        layout.cropH,
        SRCCOPY,
      );
    }
    return copyBits(dstBits[0], outW * outH * 4);
  } finally {
    if (srcDib) win.DeleteObject(srcDib);
    if (dstDib) win.DeleteObject(dstDib);
    if (srcDc) win.DeleteDC(srcDc);
    if (dstDc) win.DeleteDC(dstDc);
    win.ReleaseDC(hwnd, screenDc);
  }
}

export function startHwndFramePump(opts: {
  hwnd: bigint;
  width: number;
  height: number;
  fps: number;
  write: (frame: Buffer) => boolean;
}): () => void {
  const interval = Math.max(16, Math.round(1000 / opts.fps));
  let stopped = false;
  let timer: ReturnType<typeof setTimeout> | null = null;
  let last: Buffer | null = null;
  let nextAt = Date.now();

  const tick = (): void => {
    if (stopped) return;
    const frame = grabHwndFrame(opts.hwnd, opts.width, opts.height) ?? last;
    if (frame) {
      last = frame;
      const ok = opts.write(frame);
      if (!ok) recWarn('ffmpeg stdin backpressure — drop frame');
    }
    nextAt += interval;
    timer = setTimeout(tick, Math.max(0, nextAt - Date.now()));
  };
  timer = setTimeout(tick, 0);
  return () => {
    stopped = true;
    if (timer) clearTimeout(timer);
  };
}
