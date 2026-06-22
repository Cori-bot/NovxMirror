import { app } from 'electron';
import { state } from './state';
import { loadSettings, DEFAULT_SETTINGS } from './settings';
import { checkBonjourService, getBonjourMessage } from './bonjour';
import { cleanupTempFiles } from './paths';
import { uxplay } from './uxplay-manager';
import { createMainWindow } from './windows';
import { createTray, updateTrayMenu } from './tray';
import { bindUxPlayEvents, registerIpcHandlers, startUxPlay } from './ipc';

app.setAppUserModelId('com.novx.mirror');

// Switches GPU/perf — DOIVENT être posés avant app.whenReady().
// On force le backend ANGLE Direct3D11 pour rester cohérent avec le pipeline
// GStreamer d3d11videosink (évite une 2e pile GPU et la contention/fallback),
// et on coupe des sous-systèmes Chromium media inutiles pour une UI locale.
// IMPORTANT : NE PAS appeler app.disableHardwareAcceleration() — cela forcerait
// le rendu software (CPU) et aggraverait la charge sans libérer le GPU.
app.commandLine.appendSwitch('use-angle', 'd3d11');
app.commandLine.appendSwitch('disable-features', 'HardwareMediaKeyHandling,MediaSessionService');

void app.whenReady().then(() => {
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
  uxplay.stop();
});

app.on('window-all-closed', () => {
  // Keep alive in tray on Windows
});

app.on('activate', () => {
  if (!state.mainWindow) createMainWindow();
  else state.mainWindow.show();
});
