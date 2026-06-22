import { Menu, Tray, nativeImage, type MenuItemConstructorOptions } from 'electron';
import { state } from './state';
import { uxplay } from './uxplay-manager';
import { getScreenshotDirectory } from './settings';
import { checkBonjourService } from './bonjour';
import { getTrayWindowIcon, getTrayMenuIcon } from './paths';
import { resetVideoWindow, takeScreenshot, toggleVideoPinned } from './video-window';
import { quitApp } from './windows';
import type { Locale, ReceiverStatus } from './types';

interface TrayMessages {
  status: Record<ReceiverStatus, string>;
  show: string;
  reset: string;
  screenshot: string;
  pin: string;
  unpin: string;
  startReceiver: string;
  stopReceiver: string;
  quit: string;
}

const TRAY_MESSAGES: Record<Locale, TrayMessages> = {
  fr: {
    status: {
      stopped: 'Arrete',
      starting: 'Demarrage...',
      waiting: 'En attente',
      connected: 'Connecte',
      error: 'Erreur',
    },
    show: 'Afficher',
    reset: 'Reset',
    screenshot: 'Screenshot',
    pin: 'Epingler sur le dessus',
    unpin: 'Desepingler la fenetre',
    startReceiver: 'Demarrer le receiver',
    stopReceiver: 'Arreter le receiver',
    quit: 'Quitter',
  },
  en: {
    status: {
      stopped: 'Stopped',
      starting: 'Starting...',
      waiting: 'Waiting',
      connected: 'Connected',
      error: 'Error',
    },
    show: 'Show',
    reset: 'Reset',
    screenshot: 'Screenshot',
    pin: 'Pin on top',
    unpin: 'Unpin window',
    startReceiver: 'Start receiver',
    stopReceiver: 'Stop receiver',
    quit: 'Quit',
  },
  de: {
    status: {
      stopped: 'Gestoppt',
      starting: 'Startet...',
      waiting: 'Warten',
      connected: 'Verbunden',
      error: 'Fehler',
    },
    show: 'Anzeigen',
    reset: 'Reset',
    screenshot: 'Screenshot',
    pin: 'Immer im Vordergrund',
    unpin: 'Fenster loslosen',
    startReceiver: 'Receiver starten',
    stopReceiver: 'Receiver stoppen',
    quit: 'Beenden',
  },
};

function getTrayMessages(): TrayMessages {
  return TRAY_MESSAGES[state.currentLocale] ?? TRAY_MESSAGES.en;
}

export function createTray(onStartReceiver: () => void): void {
  let tray: Tray;
  try {
    tray = new Tray(getTrayWindowIcon());
  } catch {
    tray = new Tray(nativeImage.createEmpty());
  }
  state.tray = tray;

  updateTrayMenu(onStartReceiver);
  tray.setToolTip('NOVX Mirror');

  tray.on('click', () => {
    if (state.mainWindow) {
      if (state.mainWindow.isVisible()) state.mainWindow.focus();
      else state.mainWindow.show();
    }
  });
}

export function updateTrayMenu(onStartReceiver: () => void): void {
  if (!state.tray) return;
  const status = uxplay.getStatus();
  const t = getTrayMessages();
  const baseStatusLabel = t.status[status.status] ?? t.status.stopped;
  const trayStatusLabel =
    status.status === 'connected' && status.device
      ? `${baseStatusLabel} - ${status.device}`
      : baseStatusLabel;

  const isConnected = status.status === 'connected';
  const connectedItems: MenuItemConstructorOptions[] = isConnected
    ? [
        { type: 'separator' },
        { label: t.reset, click: () => resetVideoWindow() },
        {
          label: t.screenshot,
          click: () => takeScreenshot(getScreenshotDirectory()),
        },
        { label: state.videoIsPinned ? t.unpin : t.pin, click: toggleVideoPinned },
      ]
    : [];

  const menu = Menu.buildFromTemplate([
    { label: 'NOVX Mirror', enabled: false, icon: getTrayMenuIcon() },
    { label: trayStatusLabel, enabled: false },
    { type: 'separator' },
    {
      label: t.show,
      click: () => {
        if (state.mainWindow) {
          state.mainWindow.show();
          state.mainWindow.focus();
        }
      },
    },
    ...connectedItems,
    { type: 'separator' },
    {
      label: uxplay.isRunning() ? t.stopReceiver : t.startReceiver,
      click: () => {
        if (uxplay.isRunning()) {
          uxplay.stop();
        } else {
          checkBonjourService((running) => {
            if (!running) {
              if (state.mainWindow && !state.mainWindow.isDestroyed()) {
                state.mainWindow.show();
                state.mainWindow.focus();
                state.mainWindow.webContents.send('bonjour-missing');
              }
              return;
            }
            onStartReceiver();
          });
        }
      },
    },
    { type: 'separator' },
    {
      label: t.quit,
      click: () => {
        uxplay.stop();
        quitApp();
      },
    },
  ]);

  state.tray.setContextMenu(menu);
}
