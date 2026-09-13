import { app } from 'electron';
import { state } from './state';
import { loadSettings, DEFAULT_SETTINGS } from './settings';
import { checkBonjourService, getBonjourMessage } from './bonjour';
import { cleanupTempFiles } from './paths';
import { uxplay } from './uxplay-manager';
import { createMainWindow } from './windows';
import { createTray, updateTrayMenu } from './tray';
import { bindUxPlayEvents, registerIpcHandlers, startUxPlay } from './ipc';
import { abortNativeRecording } from './gstRecording';
import { novxAppUserModelId } from './win32Icon';
import { destroyVideoHost } from './videoHost';

// Product name for OS surfaces; package.json "name" is the npm id (novx-mirror).
app.setName('NOVX Mirror');

// Packaged AUMID must match electron-builder appId / NSIS shortcuts.
// Dev uses a distinct ID so `pnpm dev` (electron.exe + atom icon) does not
// poison the Windows 11 taskbar cache for the installed app.
// Use com.novx.mirror.app — legacy com.novx.mirror was poisoned by Start Menu Electron.lnk.
app.setAppUserModelId(novxAppUserModelId(app.isPackaged));

// Une seule instance : un 2e lancement (raccourci / menu Demarrer) focus la fenetre existante.
const gotSingleInstanceLock = app.requestSingleInstanceLock();
if (!gotSingleInstanceLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    const win = state.mainWindow;
    if (win && !win.isDestroyed()) {
      if (win.isMinimized()) win.restore();
      win.show();
      win.focus();
    } else {
      createMainWindow();
    }
  });
}

// Switches GPU/perf — DOIVENT être posés avant app.whenReady().
// On force le backend ANGLE Direct3D11 pour rester cohérent avec le pipeline
// GStreamer d3d11videosink (évite une 2e pile GPU et la contention/fallback),
// et on coupe des sous-systèmes Chromium media inutiles pour une UI locale.
// IMPORTANT : NE PAS appeler app.disableHardwareAcceleration() — cela forcerait
// le rendu software (CPU) et aggraverait la charge sans libérer le GPU.
app.commandLine.appendSwitch('use-angle', 'd3d11');
app.commandLine.appendSwitch('disable-features', 'HardwareMediaKeyHandling,MediaSessionService');

void app.whenReady().then(() => {
  if (!gotSingleInstanceLock) return;

  cleanupTempFiles();
  const startupSettings = loadSettings();
  state.currentTheme = startupSettings.theme || DEFAULT_SETTINGS.theme;
  state.currentLocale = startupSettings.locale || DEFAULT_SETTINGS.locale;

  createMainWindow();
  createTray(() => startUxPlay(loadSettings()));
  registerIpcHandlers();
  bindUxPlayEvents();
  updateTrayMenu(() => startUxPlay(loadSettings()));

  setTimeout(() => {
    checkBonjourService((running) => {
      if (!running && state.mainWindow && !state.mainWindow.isDestroyed()) {
        state.mainWindow.webContents.send('app-error', getBonjourMessage('warning'));
      }
    });
  }, 2500);

  if (startupSettings.autoStart) {
    setTimeout(() => {
      checkBonjourService((running) => {
        if (running) startUxPlay(startupSettings);
      });
    }, 800);
  }
});

app.on('before-quit', () => {
  state.isQuitting = true;
  abortNativeRecording();
  destroyVideoHost();
  uxplay.stop();
});

app.on('window-all-closed', () => {
  // Keep alive in tray on Windows
});

app.on('activate', () => {
  if (!state.mainWindow) createMainWindow();
  else state.mainWindow.show();
});
