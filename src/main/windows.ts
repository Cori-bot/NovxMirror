import { app, BrowserWindow } from 'electron';
import { join } from 'node:path';
import { state } from './state';
import { loadSettings } from './settings';
import { getWindowIconPath } from './paths';
import { applyBrowserWindowIcon } from './win32Icon';

function applyMainWindowIcon(win: BrowserWindow): void {
  applyBrowserWindowIcon(win, getWindowIconPath());
}

export function createMainWindow(): BrowserWindow {
  const settings = loadSettings();
  const iconPath = getWindowIconPath();

  const win = new BrowserWindow({
    width: 960,
    height: 680,
    minWidth: 720,
    minHeight: 560,
    resizable: true,
    maximizable: true,
    frame: false,
    transparent: false,
    backgroundColor: '#0d1117',
    // Apply setAppDetails before first Show so Win11 does not pin the Electron atom.
    show: false,
    icon: iconPath,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      spellcheck: false,
      v8CacheOptions: 'bypassHeatCheck',
    },
  });

  state.mainWindow = win;

  // Interdire tout zoom dans la fenêtre (raccourcis clavier Ctrl+Plus/Minus/Zero/Wheel).
  win.webContents.on('did-finish-load', () => {
    applyMainWindowIcon(win);
    void win.webContents.setVisualZoomLevelLimits(1, 1);
    win.webContents.setZoomFactor(1);
  });

  win.webContents.on('before-input-event', (event, input) => {
    if (
      input.control &&
      (input.key === '+' ||
        input.key === '-' ||
        input.key === '=' ||
        input.key === '0' ||
        input.key === 'Add' ||
        input.key === 'Subtract')
    ) {
      event.preventDefault();
    }
  });

  // Official Electron taskbar API (must run before show).
  applyMainWindowIcon(win);

  win.on('ready-to-show', () => applyMainWindowIcon(win));
  win.on('show', () => applyMainWindowIcon(win));
  win.webContents.on('did-finish-load', () => applyMainWindowIcon(win));

  if (process.env['ELECTRON_RENDERER_URL']) {
    void win.loadURL(process.env['ELECTRON_RENDERER_URL']);
  } else {
    void win.loadFile(join(__dirname, '../renderer/index.html'));
  }

  if (!settings.startMinimized) win.show();

  win.on('close', (e) => {
    const s = loadSettings();
    if (s.minimizeToTray && !state.isQuitting) {
      e.preventDefault();
      win.hide();
    }
  });

  win.on('closed', () => {
    state.mainWindow = null;
  });

  return win;
}

export function emitThemeAndLocale(): void {
  if (state.mainWindow && !state.mainWindow.isDestroyed()) {
    state.mainWindow.webContents.send('theme-changed', state.currentTheme);
    state.mainWindow.webContents.send('locale-changed', state.currentLocale);
  }
}

export function quitApp(): void {
  state.isQuitting = true;
  app.quit();
}
