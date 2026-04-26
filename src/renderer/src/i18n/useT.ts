import { useCallback } from 'react';
import { TRANSLATIONS, type Translations } from './translations';
import { useAppStore } from '../store/app';
import type { Locale } from '../types';

function getTranslations(locale: Locale): Translations {
  return TRANSLATIONS[locale] ?? TRANSLATIONS.en;
}

function getValue(obj: unknown, path: string[]): unknown {
  return path.reduce<unknown>((acc, part) => {
    if (acc && typeof acc === 'object' && part in (acc as Record<string, unknown>)) {
      return (acc as Record<string, unknown>)[part];
    }
    return undefined;
  }, obj);
}

export function useT() {
  const locale = useAppStore((s) => s.locale);

  return useCallback(
    (key: string, vars: Record<string, string | number> = {}): string => {
      const value = getValue(getTranslations(locale), key.split('.'));
      if (typeof value !== 'string') return key;
      return Object.entries(vars).reduce(
        (text, [name, replacement]) => text.replaceAll(`{{${name}}}`, String(replacement)),
        value,
      );
    },
    [locale],
  );
}

export function useTranslations(): Translations {
  const locale = useAppStore((s) => s.locale);
  return getTranslations(locale);
}
