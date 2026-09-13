import { app, shell } from 'electron';
import { existsSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { getWindowIconPath } from './paths';
import { novxAppUserModelId } from './win32Icon';

const SHORTCUT_NAME = 'NOVX Mirror.lnk';

export type CreateShortcutsResult = {
  ok: boolean;
  desktop: boolean;
  startMenu: boolean;
  desktopPath: string | null;
  startMenuPath: string | null;
};

function shortcutDetails(): Electron.ShortcutDetails {
  const target = process.execPath;
  const icon = getWindowIconPath();
  return {
    target,
    cwd: dirname(target),
    description: 'NOVX Mirror',
    icon: existsSync(icon) ? icon : target,
    iconIndex: 0,
    appUserModelId: novxAppUserModelId(app.isPackaged),
  };
}

function writeLink(linkPath: string): boolean {
  try {
    mkdirSync(dirname(linkPath), { recursive: true });
    return shell.writeShortcutLink(linkPath, 'create', shortcutDetails());
  } catch {
    return false;
  }
}

export function desktopShortcutPath(): string {
  return join(app.getPath('desktop'), SHORTCUT_NAME);
}

export function startMenuShortcutPath(): string {
  return join(
    app.getPath('appData'),
    'Microsoft',
    'Windows',
    'Start Menu',
    'Programs',
    SHORTCUT_NAME,
  );
}

/** Crée / met à jour les raccourcis Bureau + Menu Démarrer (Windows). */
export function createNovxShortcuts(): CreateShortcutsResult {
  if (process.platform !== 'win32') {
    return {
      ok: false,
      desktop: false,
      startMenu: false,
      desktopPath: null,
      startMenuPath: null,
    };
  }

  const desktopPath = desktopShortcutPath();
  const startMenuPath = startMenuShortcutPath();
  const desktop = writeLink(desktopPath);
  const startMenu = writeLink(startMenuPath);

  return {
    ok: desktop || startMenu,
    desktop,
    startMenu,
    desktopPath: desktop ? desktopPath : null,
    startMenuPath: startMenu ? startMenuPath : null,
  };
}
