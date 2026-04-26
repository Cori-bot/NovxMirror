import { exec } from 'node:child_process';
import { state } from './state';
import { loadSettings } from './settings';
import type { Locale } from './types';

const BONJOUR_MESSAGES: Record<'warning' | 'blocked', Record<Locale, string>> = {
  warning: {
    fr: 'Apple Bonjour est requis pour que ton iPhone trouve le receiver.',
    en: 'Apple Bonjour is required for your iPhone to find the receiver.',
    de: 'Apple Bonjour wird benötigt, damit dein iPhone den Receiver findet.',
  },
  blocked: {
    fr: "Apple Bonjour n'est pas installé. Le receiver ne peut pas démarrer.",
    en: 'Apple Bonjour is not installed. The receiver cannot start.',
    de: 'Apple Bonjour ist nicht installiert. Der Receiver kann nicht starten.',
  },
};

export function getBonjourMessage(type: 'warning' | 'blocked'): string {
  const locale = state.currentLocale || loadSettings().locale || 'en';
  return BONJOUR_MESSAGES[type][locale] || BONJOUR_MESSAGES[type].en;
}

type BonjourCallback = (running: boolean) => void;

function tryStart(name: string, cb: BonjourCallback): void {
  exec(`sc start "${name}"`, { windowsHide: true }, (err, stdout) => {
    if (err) {
      cb(false);
      return;
    }
    const out = (stdout || '').toUpperCase();
    cb(out.includes('RUNNING') || out.includes('START_PENDING'));
  });
}

function queryOne(name: string, cb: BonjourCallback): void {
  exec(`sc query "${name}"`, { windowsHide: true }, (err, stdout) => {
    if (err || !stdout) {
      cb(false);
      return;
    }
    if (stdout.includes('RUNNING')) {
      cb(true);
      return;
    }
    if (stdout.includes('STOPPED') || stdout.includes('START_PENDING')) {
      tryStart(name, cb);
      return;
    }
    cb(false);
  });
}

export function checkBonjourService(callback: BonjourCallback): void {
  queryOne('mDNSResponder', (found) => {
    if (found) {
      callback(true);
      return;
    }
    queryOne('Bonjour Service', (found2) => callback(found2));
  });
}

export function installBonjour(): Promise<{ success: boolean }> {
  return new Promise((resolve) => {
    exec(
      'winget install --id Apple.Bonjour --silent --accept-source-agreements --accept-package-agreements',
      { windowsHide: true, timeout: 120_000 },
      (err) => resolve({ success: !err }),
    );
  });
}
