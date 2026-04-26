import { Notification } from 'electron';
import { state } from './state';
import type { Locale } from './types';

const MESSAGES: Record<Locale, { connected: string; disconnected: string }> = {
  fr: {
    connected: 'Connecté à {{device}}',
    disconnected: 'Appareil déconnecté',
  },
  en: {
    connected: 'Connected to {{device}}',
    disconnected: 'Device disconnected',
  },
  de: {
    connected: 'Verbunden mit {{device}}',
    disconnected: 'Gerät getrennt',
  },
};

function tr(key: 'connected' | 'disconnected', vars: Record<string, string> = {}): string {
  const locale = state.currentLocale;
  const template = MESSAGES[locale]?.[key] ?? MESSAGES.en[key];
  return Object.entries(vars).reduce(
    (text, [name, value]) => text.replaceAll(`{{${name}}}`, value),
    template,
  );
}

function shouldNotify(): boolean {
  return Notification.isSupported();
}

export function notifyDeviceConnected(device: string | null): void {
  if (!shouldNotify()) return;
  const body = tr('connected', { device: device ?? '—' });
  new Notification({ title: 'NOVX Mirror', body, silent: false }).show();
}

export function notifyDeviceDisconnected(): void {
  if (!shouldNotify()) return;
  const body = tr('disconnected');
  new Notification({ title: 'NOVX Mirror', body, silent: true }).show();
}
