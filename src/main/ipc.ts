import { app, dialog, ipcMain, shell } from 'electron';
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
  resolutionToDimensions,
  normalizeVideoAspect,
  persistVideoAspect,
} from './video-window';
import {
  closeFreezeForReset,
  closeFreezeOverlay,
  startNativeFollow,
  stopNativeFollow,
} from './freeze';
import { emitThemeAndLocale, quitApp } from './windows';
import { updateTrayMenu } from './tray';
import { cleanupTempFiles } from './paths';
import { notifyDeviceConnected, notifyDeviceDisconnected } from './notifications';
import type { Settings, SettingsPayload } from './types';

export function startUxPlay(settings: Settings): boolean {
  const normalized = normalizeSettings(settings);
  const dim = resolutionToDimensions(normalized.resolution);
  const videoCrop = getVideoCropConfigForResolution(dim.w, dim.h);
  return uxplay.start({
    name: normalized.name,
    pin: normalized.pinEnabled ? normalized.pin : null,
    fps: normalized.fps,
    maxWidth: dim.w,
    maxHeight: dim.h,
    audioEnabled: normalized.audioEnabled,
    videoCrop,
  });
}

export function bindUxPlayEvents(): void {
  uxplay.on('restart-requested', () => {
    checkBonjourService((running) => {
      if (running) {
        const settings = loadSettings();
        startUxPlay(settings);
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
      closeFreezeOverlay();
      stopNativeFollow();
      state.isFrozen = false;
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
}

function onStartReceiverFromTray(): void {
  const s = loadSettings();
  startUxPlay(s);
}

// suppress unused
void startNativeFollow;

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
    const result = await dialog.showOpenDialog(state.mainWindow ?? undefined, {
      title: 'Choose screenshot folder',
      properties: ['openDirectory', 'createDirectory'],
      defaultPath: fallback,
    });
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

  ipcMain.on('video-reset-window', () => resetVideoWindow(closeFreezeForReset));
  ipcMain.on('tools-reset', () => resetVideoWindow(closeFreezeForReset));
  ipcMain.on('tools-screenshot', () => takeScreenshot(getScreenshotDirectory()));
  ipcMain.on('freeze-set-interactive', (_, interactive: boolean) => {
    if (!state.freezeWindow || state.freezeWindow.isDestroyed()) return;
    state.freezeWindow.setIgnoreMouseEvents(!interactive, { forward: true });
  });
}
