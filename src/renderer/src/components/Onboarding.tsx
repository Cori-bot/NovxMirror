import { useEffect, useState } from 'react';
import logo from '../assets/novx-logo.svg';
import { useAppStore } from '../store/app';
import { useSettingsStore } from '../store/settings';
import { useT } from '../i18n/useT';
import type { Locale } from '../types';

type Step = 'language' | 'name' | 'bonjour';

interface LangOption {
  value: Locale;
  label: string;
  native: string;
}

const LANGS: LangOption[] = [
  { value: 'en', label: 'English', native: 'Hello' },
  { value: 'fr', label: 'Français', native: 'Bonjour' },
  { value: 'de', label: 'Deutsch', native: 'Hallo' },
];

export function Onboarding() {
  const t = useT();
  const isOpen = useAppStore((s) => s.langPickerOpen);
  const setLangPickerOpen = useAppStore((s) => s.setLangPickerOpen);
  const setLocale = useAppStore((s) => s.setLocale);
  const settings = useSettingsStore((s) => s.settings);
  const setSettings = useSettingsStore((s) => s.setSettings);

  const [step, setStep] = useState<Step>('language');
  const [name, setName] = useState(settings?.name ?? 'NOVX Mirror');
  const [bonjourState, setBonjourState] = useState<
    'checking' | 'ok' | 'missing' | 'installing' | 'failed'
  >('checking');

  useEffect(() => {
    if (!isOpen) return;
    setStep('language');
    setName(settings?.name ?? 'NOVX Mirror');
    // intentionally only depend on `isOpen` — re-running on settings.name
    // would reset the wizard mid-flow when each step persists its choice.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen || step !== 'bonjour') return;
    setBonjourState('checking');
    void window.airmirror.checkBonjour().then((r) => {
      setBonjourState(r.running ? 'ok' : 'missing');
    });
  }, [isOpen, step]);

  if (!isOpen || !settings) return null;

  const pickLang = (locale: Locale) => {
    const next = { ...settings, locale };
    setSettings(next);
    setLocale(locale);
    void window.airmirror.saveSettings(next);
    setStep('name');
  };

  const confirmName = () => {
    if (!settings) return;
    const cleanedName = name.trim().slice(0, 30) || 'NOVX Mirror';
    const next = { ...settings, name: cleanedName };
    setSettings(next);
    void window.airmirror.saveSettings(next);
    setStep('bonjour');
  };

  const finish = (extras: Partial<typeof settings> = {}) => {
    if (!settings) return;
    const next = { ...settings, ...extras, firstLaunch: false };
    setSettings(next);
    setLangPickerOpen(false);
    void window.airmirror.saveSettings(next);
  };

  const installBonjour = () => {
    setBonjourState('installing');
    void window.airmirror.installBonjour().then((r) => {
      if (r.success) {
        setBonjourState('ok');
      } else {
        setBonjourState('failed');
      }
    });
  };

  return (
    <div className="onboarding-overlay">
      <div className="onboarding-dialog">
        <div className="onboarding-progress">
          <div
            className={`onboarding-dot${step === 'language' ? ' is-active' : step !== 'language' ? ' is-done' : ''}`}
          />
          <div
            className={`onboarding-dot${step === 'name' ? ' is-active' : step === 'bonjour' ? ' is-done' : ''}`}
          />
          <div className={`onboarding-dot${step === 'bonjour' ? ' is-active' : ''}`} />
        </div>

        <div className="onboarding-logo">
          <img src={logo} alt="NovX" width={32} height={32} />
          <span>NOVX Mirror</span>
        </div>

        {step === 'language' ? (
          <>
            <div className="onboarding-title">Choose your language</div>
            <div className="onboarding-sub">Choisissez votre langue · Sprache wählen</div>
            <div className="onboarding-options">
              {LANGS.map((lang) => (
                <button
                  key={lang.value}
                  className="onboarding-option-card"
                  onClick={() => pickLang(lang.value)}
                >
                  <span className="onboarding-option-native">{lang.native}</span>
                  <span className="onboarding-option-label">{lang.label}</span>
                </button>
              ))}
            </div>
          </>
        ) : null}

        {step === 'name' ? (
          <>
            <div className="onboarding-title">{t('settings.receiverName')}</div>
            <div className="onboarding-sub">{t('settings.receiverNameHint')}</div>
            <input
              type="text"
              className="onboarding-input"
              maxLength={30}
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') confirmName();
              }}
            />
            <div className="onboarding-actions">
              <button className="onboarding-btn ghost" onClick={() => setStep('language')}>
                {t('common.back')}
              </button>
              <button className="onboarding-btn primary" onClick={confirmName}>
                {t('common.apply')}
              </button>
            </div>
          </>
        ) : null}

        {step === 'bonjour' ? (
          <>
            <div className="onboarding-title">{t('bonjour.title')}</div>
            <div className="onboarding-sub">{t('bonjour.desc')}</div>

            <div className={`onboarding-status onboarding-status-${bonjourState}`}>
              {bonjourState === 'checking' ? (
                <>
                  <span className="onboarding-spinner" />
                  <span>…</span>
                </>
              ) : null}
              {bonjourState === 'ok' ? (
                <>
                  <svg
                    width={18}
                    height={18}
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.4"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                  <span>{t('bonjour.successTitle')}</span>
                </>
              ) : null}
              {bonjourState === 'missing' || bonjourState === 'failed' ? (
                <>
                  <svg
                    width={18}
                    height={18}
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <circle cx="12" cy="12" r="10" />
                    <line x1="12" y1="8" x2="12" y2="12" />
                    <line x1="12" y1="16" x2="12.01" y2="16" />
                  </svg>
                  <span>
                    {bonjourState === 'failed' ? t('bonjour.failed') : t('bonjour.title')}
                  </span>
                </>
              ) : null}
              {bonjourState === 'installing' ? (
                <>
                  <span className="onboarding-spinner" />
                  <span>{t('bonjour.installing')}</span>
                </>
              ) : null}
            </div>

            <div className="onboarding-actions">
              <button className="onboarding-btn ghost" onClick={() => setStep('name')}>
                {t('common.back')}
              </button>
              {bonjourState === 'missing' || bonjourState === 'failed' ? (
                <button className="onboarding-btn primary" onClick={installBonjour}>
                  {t('bonjour.cta')}
                </button>
              ) : (
                <button
                  className="onboarding-btn primary"
                  disabled={bonjourState === 'checking' || bonjourState === 'installing'}
                  onClick={() => finish()}
                >
                  {t('common.apply')}
                </button>
              )}
            </div>
            {bonjourState === 'missing' || bonjourState === 'failed' ? (
              <button className="onboarding-skip" onClick={() => finish()}>
                {t('bonjour.dismiss')}
              </button>
            ) : null}
          </>
        ) : null}
      </div>
    </div>
  );
}
