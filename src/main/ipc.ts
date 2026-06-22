import { app, desktopCapturer, dialog, ipcMain, session, shell, type OpenDialogOptions } from 'electron';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { state } from './state';
import { uxplay } from './uxplay-manager';
import { loadSettings, saveSettings, normalizeSettings, getScreenshotDirectory } from './settings';
import { checkBonjourService, installBonjour } from './bonjour';
import {
  applyNativeWindowTheme,
  canOpenExternalUrl,
  createVideoChrome,
  getVideoCropConfigForResolution,
  resetVideoWindow,
  takeScreenshot,
  syncVisibleGStreamer,
  startGStreamerWatcher,
  normalizeVideoAspect,
  persistVideoAspect,
} from './video-window';
import { emitThemeAndLocale, quitApp } from './windows';
import { updateTrayMenu } from './tray';
import { cleanupTempFiles } from './paths';
import { notifyDeviceConnected, notifyDeviceDisconnected } from './notifications';
import type { Settings, SettingsPayload } from './types';

// On annonce 4K à UxPlay pour ne jamais brider l'iPhone par notre handshake.
// L'iPhone négocie ce qu'il sait produire (typiquement 1920x1080); ce plafond
// haut sert juste à ne pas introduire de cap artificiel côté receiver.
const MAX_STREAM_WIDTH = 3840;
const MAX_STREAM_HEIGHT = 2160;

export function startUxPlay(settings: Settings, isAutoRestart = false): boolean {
  // Garde anti-double-lancement : autoStart (index.ts) et le handler IPC 'start'
  // appellent tous deux startUxPlay via checkBonjourService (async). Sans cette
  // garde, deux appels concurrents pouvaient relancer UxPlay (kill+respawn).
  if (uxplay.isRunning()) return true;
  const normalized = normalizeSettings(settings);
  const videoCrop = getVideoCropConfigForResolution(MAX_STREAM_WIDTH, MAX_STREAM_HEIGHT);
  return uxplay.start(
    {
      name: normalized.name,
      pin: normalized.pinEnabled ? normalized.pin : null,
      fps: normalized.fps,
      maxWidth: MAX_STREAM_WIDTH,
      maxHeight: MAX_STREAM_HEIGHT,
      audioEnabled: normalized.audioEnabled,
      videoCrop,
    },
    isAutoRestart,
  );
}

export function bindUxPlayEvents(): void {
  uxplay.on('restart-requested', () => {
    // Capture l'intention courante AVANT le check Bonjour async : si l'utilisateur
    // fait stop/start pendant ce délai, la génération change et on abandonne.
    const gen = uxplay.getRestartGeneration();
    checkBonjourService((running) => {
      if (uxplay.getRestartGeneration() !== gen || uxplay.isRunning()) return;
      if (running) {
        const settings = loadSettings();
        // isAutoRestart=true → ne PAS réinitialiser restartCount, sinon le cap de
        // 2 tentatives ne s'applique jamais (boucle de restart infinie).
        startUxPlay(settings, true);
      }
    });
  });

  uxplay.on('process-started', ({ pid }) => {
    if (pid != null) startGStreamerWatcher(pid, 3600);
  });

  uxplay.on('streaming-started', ({ pid, device }) => {
    if (pid != null) createVideoChrome(device ?? '', pid);
  });

  uxplay.on('video-resolution', ({ width, height }) => {
    if (!state.gstPid) return;
    const crop = uxplay.options.videoCrop ?? getVideoCropConfigForResolution(width, height);
    const cropW = Math.max(1, width - crop.left - crop.right);
    const cropH = Math.max(1, height - crop.top - crop.bottom);
    const previousAspect = state.streamAspect;
    const newLandscape = cropW > cropH;
    state.streamAspect = normalizeVideoAspect({ width: cropW, height: cropH });
    const previousRatio = previousAspect ? previousAspect.width / previousAspect.height : null;
    const nextRatio = state.streamAspect.width / state.streamAspect.height;
    const shouldResyncForAspect =
      previousRatio === null || Math.abs(previousRatio - nextRatio) > 0.0005;
    persistVideoAspect(state.gstPid, state.streamAspect);
    if (newLandscape !== state.streamIsLandscape || shouldResyncForAspect) {
      state.streamIsLandscape = newLandscape;
      if (state.streamResizeTimer) clearTimeout(state.streamResizeTimer);
      state.streamResizeTimer = setTimeout(() => {
        state.streamResizeTimer = null;
        if (state.gstPid) syncVisibleGStreamer(state.gstPid);
      }, 400);
    }
  });

  let lastConnectedDevice: string | null = null;

  uxplay.on('status', (data) => {
    if (state.mainWindow) state.mainWindow.webContents.send('status-update', data);
    updateTrayMenu(onStartReceiverFromTray);

    if (data.status === 'connected') {
      const device = data.device ?? null;
      const isNewDevice = device !== lastConnectedDevice;
      if (state.mainWindow && !state.mainWindow.isDestroyed() && state.mainWindow.isVisible()) {
        if (loadSettings().connectBehavior === 'hide') state.mainWindow.hide();
        // 'keep' → leave the window visible so the user sees the live stats panel
      }
      if (isNewDevice) {
        notifyDeviceConnected(device);
        lastConnectedDevice = device;
      }
    }

    if (data.status === 'waiting' || data.status === 'stopped') {
      if (lastConnectedDevice !== null) {
        notifyDeviceDisconnected();
        lastConnectedDevice = null;
      }
      if (state.streamResizeTimer) {
        clearTimeout(state.streamResizeTimer);
        state.streamResizeTimer = null;
      }
      state.streamAspect = null;
      state.streamIsLandscape = false;
      cleanupTempFiles();
      state.gstPid = null;
      state.videoIsPinned = false;
      state.currentDeviceName = '';
      state.gstWindowTitle = 'NovX Mirror';
      if (state.mainWindow && !state.mainWindow.isDestroyed()) state.mainWindow.show();
    }
  });

  uxplay.on('log', (entry) => {
    if (state.mainWindow) state.mainWindow.webContents.send('log-entry', entry);
  });

  uxplay.on('stream-stats', (stats) => {
    if (state.mainWindow && !state.mainWindow.isDestroyed()) {
      state.mainWindow.webContents.send('stream-stats', stats);
    }
  });

  uxplay.on('error', (msg) => {
    if (state.mainWindow) state.mainWindow.webContents.send('app-error', msg);
    updateTrayMenu(onStartReceiverFromTray);
  });

  uxplay.on('gst-error', (msg) => {
    if (/output window was closed/i.test(msg)) return;
    if (state.mainWindow) state.mainWindow.webContents.send('app-error', `GStreamer: ${msg}`);
  });

  uxplay.on('video-route-switch', () => {
    if (state.mainWindow && !state.mainWindow.isDestroyed()) {
      state.mainWindow.webContents.send('video-route-switch');
    }
  });
}

function onStartReceiverFromTray(): void {
  const s = loadSettings();
  startUxPlay(s);
}

export function registerIpcHandlers(): void {
  ipcMain.handle('get-status', () => uxplay.getStatus());

  ipcMain.handle(
    'start',
    () =>
      new Promise<boolean>((resolve) => {
        checkBonjourService((running) => {
          if (!running) {
            if (state.mainWindow && !state.mainWindow.isDestroyed()) {
              state.mainWindow.webContents.send('bonjour-missing');
            }
            resolve(false);
            return;
          }
          const settings = loadSettings();
          resolve(startUxPlay(settings));
        });
      }),
  );

  ipcMain.handle('stop', () => {
    uxplay.stop();
  });

  ipcMain.handle('get-settings', (): SettingsPayload => {
    const settings = loadSettings();
    const screenshotDirDefault = getScreenshotDirectory({ ...settings, screenshotDir: null });
    return {
      ...settings,
      screenshotDirDefault,
      screenshotDirDisplay: getScreenshotDirectory(settings),
    };
  });

  ipcMain.handle('save-settings', (_, settings: Settings) => {
    const normalized = normalizeSettings(settings);
    saveSettings(normalized);
    state.currentTheme = normalized.theme || state.currentTheme;
    state.currentLocale = normalized.locale || state.currentLocale;
    applyNativeWindowTheme(state.gstPid);
    emitThemeAndLocale();
    return true;
  });

  ipcMain.handle('apply-settings', (_, settings: Settings) => {
    const normalized = normalizeSettings(settings);
    saveSettings(normalized);
    state.currentTheme = normalized.theme || state.currentTheme;
    state.currentLocale = normalized.locale || state.currentLocale;
    applyNativeWindowTheme(state.gstPid);
    emitThemeAndLocale();
    if (uxplay.isRunning()) {
      uxplay.stop();
      setTimeout(() => startUxPlay(normalized), 500);
    }
    return true;
  });

  ipcMain.handle('choose-screenshot-directory', async (_, currentPath: unknown) => {
    const fallback =
      typeof currentPath === 'string' && currentPath.trim()
        ? currentPath.trim()
        : getScreenshotDirectory();
    const dialogOptions: OpenDialogOptions = {
      title: 'Choose screenshot folder',
      properties: ['openDirectory', 'createDirectory'],
      defaultPath: fallback,
    };
    const result = state.mainWindow
      ? await dialog.showOpenDialog(state.mainWindow, dialogOptions)
      : await dialog.showOpenDialog(dialogOptions);
    if (result.canceled || !result.filePaths.length) return null;
    return result.filePaths[0];
  });

  ipcMain.handle('get-logs', () => uxplay.getLogs());
  ipcMain.handle('get-stream-stats', () => uxplay.getStats());

  ipcMain.handle('open-external', (_, url: unknown) => {
    if (canOpenExternalUrl(url)) {
      void shell.openExternal(String(url));
      return true;
    }
    return false;
  });

  ipcMain.handle('get-version', () => app.getVersion());

  ipcMain.handle('open-bonjour-page', () => {
    void shell.openExternal('https://support.apple.com/en-us/106380');
    return true;
  });

  ipcMain.handle('install-bonjour', () => installBonjour());
  ipcMain.handle(
    'check-bonjour',
    () =>
      new Promise<{ running: boolean }>((resolve) => {
        checkBonjourService((running) => resolve({ running }));
      }),
  );

  ipcMain.handle('restart-app', () => {
    app.relaunch();
    app.exit(0);
  });

  ipcMain.on('window-minimize', () => state.mainWindow?.minimize());
  ipcMain.on('window-maximize', () => {
    if (state.mainWindow?.isMaximized()) state.mainWindow.unmaximize();
    else state.mainWindow?.maximize();
  });
  ipcMain.on('window-close', () => {
    const s = loadSettings();
    if (s.minimizeToTray) {
      state.mainWindow?.hide();
    } else {
      quitApp();
    }
  });

  ipcMain.on('tools-reset', () => resetVideoWindow());
  ipcMain.on('tools-screenshot', () => takeScreenshot(getScreenshotDirectory()));

  // Enregistrement d'écran : quand le renderer appelle getDisplayMedia(), on
  // route automatiquement la capture vers la FENÊTRE vidéo native (titrée
  // "NovX Mirror[ - device]"), sans afficher de sélecteur. Fallback écran entier
  // si la fenêtre n'est pas trouvée. Sur Windows 11 (Windows Graphics Capture),
  // la capture de la fenêtre d3d11 fonctionne. NB: les contenus protégés (DRM,
  // Snapchat/Insta) restent noirs — la protection est appliquée côté iOS.
  session.defaultSession.setDisplayMediaRequestHandler(
    (request, callback) => {
      desktopCapturer
        .getSources({ types: ['window', 'screen'] })
        .then((sources) => {
          const title = state.gstWindowTitle || 'NovX Mirror';
          const windowSrc =
            sources.find((s) => s.name === title) ??
            sources.find((s) => s.name.includes('NovX Mirror'));
          const screenSrc = sources.find((s) => s.id.startsWith('screen'));
          const chosen = windowSrc ?? screenSrc ?? sources[0];
          if (!chosen) {
            callback({});
            return;
          }
          // Audio loopback UNIQUEMENT si le renderer l'a demandé : ainsi le
          // retry « vidéo seule » (audio:false) ne tente pas un loopback qui
          // échoue ("Could not start audio source").
          callback(request.audioRequested ? { video: chosen, audio: 'loopback' } : { video: chosen });
        })
        .catch(() => callback({}));
    },
    { useSystemPicker: false },
  );

  ipcMain.handle('save-recording', (_, data: unknown): string | null => {
    if (!(data instanceof Uint8Array)) return null;
    const dir = getScreenshotDirectory();
    const stamp = new Date()
      .toISOString()
      .replace(/[:.]/g, '-')
      .replace('T', '_')
      .slice(0, 19);
    const file = join(dir, `NOVX-recording-${stamp}.webm`);
    try {
      mkdirSync(dir, { recursive: true });
      writeFileSync(file, Buffer.from(data));
      return file;
    } catch {
      return null;
    }
  });
}
