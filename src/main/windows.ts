import { app, BrowserWindow } from 'electron';
import { join } from 'node:path';
import { state } from './state';
import { loadSettings } from './settings';
import { getMainWindowIcon } from './paths';

export function createMainWindow(): BrowserWindow {
  const settings = loadSettings();

  const win = new BrowserWindow({
    width: 960,
    height: 680,
    minWidth: 640,
    minHeight: 560,
    resizable: true,
    maximizable: true,
    frame: false,
    transparent: false,
    backgroundColor: '#0d1117',
    show: !settings.startMinimized,
    icon: getMainWindowIcon(),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      // Perf : aucun champ texte significatif → pas de dictionnaire en RAM ni de
      // téléchargement de dico. Cache bytecode V8 sans attendre le seuil de
      // chaleur pour accélérer les démarrages suivants.
      spellcheck: false,
      v8CacheOptions: 'bypassHeatCheck',
    },
  });

  state.mainWindow = win;

  if (process.env['ELECTRON_RENDERER_URL']) {
    void win.loadURL(process.env['ELECTRON_RENDERER_URL']);
  } else {
    void win.loadFile(join(__dirname, '../renderer/index.html'));
  }

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
