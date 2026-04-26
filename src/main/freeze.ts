import { BrowserWindow } from 'electron';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { state } from './state';
import {
  captureNativeWindowImage,
  getNativeOverlayLayout,
  syncVisibleGStreamer,
} from './video-window';
import type { OverlayLayout } from './types';

export function createFreezeOverlay(imagePath: string, layout: OverlayLayout): void {
  if (state.freezeWindow && !state.freezeWindow.isDestroyed()) {
    state.freezeWindow.close();
  }
  const win = new BrowserWindow({
    x: layout.window.x,
    y: layout.window.y,
    width: layout.window.width,
    height: layout.window.height,
    frame: false,
    transparent: true,
    resizable: false,
    movable: false,
    minimizable: false,
    maximizable: false,
    fullscreenable: false,
    show: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    hasShadow: false,
    webPreferences: {
      preload: join(__dirname, '../preload/freeze.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });
  state.freezeWindow = win;

  if (process.env['ELECTRON_RENDERER_URL']) {
    void win.loadURL(`${process.env['ELECTRON_RENDERER_URL']}/freeze-overlay.html`);
  } else {
    void win.loadFile(join(__dirname, '../renderer/freeze-overlay.html'));
  }

  win.webContents.once('did-finish-load', () => {
    if (!state.freezeWindow || state.freezeWindow.isDestroyed()) return;
    state.freezeWindow.setAlwaysOnTop(true, 'screen-saver');
    state.freezeWindow.setIgnoreMouseEvents(true, { forward: true });
    state.freezeWindow.webContents.send('freeze-layout', layout.content);
    state.freezeWindow.webContents.send('freeze-image', imagePath);
    state.freezeWindow.show();
  });
  win.on('closed', () => {
    state.freezeWindow = null;
  });
}

export function closeFreezeOverlay(): void {
  if (state.freezeWindow && !state.freezeWindow.isDestroyed()) {
    state.freezeWindow.close();
    state.freezeWindow = null;
  }
}

function setFreezeState(frozen: boolean): void {
  state.isFrozen = frozen;
}

export function startNativeFollow(): void {
  if (state.nativeFollowTimer) return;
  state.nativeFollowTimer = setInterval(() => {
    if (!state.gstPid || !state.isFrozen || !state.freezeWindow || state.freezeWindow.isDestroyed())
      return;
    getNativeOverlayLayout(state.gstPid, (layout) => {
      if (!layout || !state.freezeWindow || state.freezeWindow.isDestroyed()) return;
      state.freezeWindow.setBounds(layout.window);
      state.freezeWindow.webContents.send('freeze-layout', layout.content);
    });
  }, 90);
}

export function stopNativeFollow(): void {
  if (!state.nativeFollowTimer) return;
  clearInterval(state.nativeFollowTimer);
  state.nativeFollowTimer = null;
}

export function toggleFreeze(): void {
  if (!state.gstPid) return;
  if (state.isFrozen) {
    closeFreezeOverlay();
    setFreezeState(false);
    stopNativeFollow();
    syncVisibleGStreamer(state.gstPid);
    return;
  }
  const freezePath = join(tmpdir(), `novx-freeze-${String(state.gstPid)}.png`);
  captureNativeWindowImage(state.gstPid, freezePath, (err) => {
    if (err || !state.gstPid) return;
    state.lastFreezeImage = freezePath;
    getNativeOverlayLayout(state.gstPid, (layout) => {
      if (!layout) return;
      createFreezeOverlay(freezePath, layout);
      setFreezeState(true);
      startNativeFollow();
    });
  });
}

export function closeFreezeForReset(): void {
  closeFreezeOverlay();
  setFreezeState(false);
}
