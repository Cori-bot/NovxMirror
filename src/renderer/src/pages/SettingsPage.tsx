import { useEffect, useRef, useState } from 'react';
import { useSettingsStore } from '../store/settings';
import { useAppStore } from '../store/app';
import { useT } from '../i18n/useT';
import { Select } from '../components/Select';
import { Section } from '../components/Section';
import { ThemeChips } from '../components/ThemeChips';
import type { ConnectBehavior, Fps, Locale, Resolution, Settings, Theme } from '../types';

export function SettingsPage() {
  const t = useT();
  const settings = useSettingsStore((s) => s.settings);
  const setSettings = useSettingsStore((s) => s.setSettings);
  const setTheme = useAppStore((s) => s.setTheme);
  const setLocale = useAppStore((s) => s.setLocale);
  const showToast = useAppStore((s) => s.showToast);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [pinValue, setPinValue] = useState(settings?.pin ?? '');
  const [name, setName] = useState(settings?.name ?? 'NOVX Mirror');

  useEffect(() => {
    setPinValue(settings?.pin ?? '');
    setName(settings?.name ?? 'NOVX Mirror');
  }, [settings?.pin, settings?.name]);

  if (!settings) return null;

  const applyReceiverSettings = (next: Settings) => {
    if (next.pinEnabled && !/^\d{4}$/.test(next.pin ?? '')) return;
    void window.airmirror.applySettings(next).then(() => {
      showToast(t('settings.receiverRestarted'));
    });
  };

  const saveApplicationSettings = (next: Settings) => {
    void window.airmirror.saveSettings(next).then(() => {
      setTheme(next.theme);
      setLocale(next.locale);
    });
  };

  const updateReceiver = (patch: Partial<Settings>) => {
    const merged: Settings = { ...settings, ...patch };
    setSettings({ ...settings, ...patch });
    applyReceiverSettings(merged);
  };

  const updateApp = (patch: Partial<Settings>) => {
    const merged: Settings = { ...settings, ...patch };
    setSettings({ ...settings, ...patch });
    saveApplicationSettings(merged);
  };

  const debouncedReceiverUpdate = (patch: Partial<Settings>) => {
    setSettings({ ...settings, ...patch });
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      applyReceiverSettings({ ...settings, ...patch });
    }, 800);
  };

  const onChooseScreenshotDir = () => {
    void window.airmirror
      .chooseScreenshotDirectory(settings.screenshotDir ?? settings.screenshotDirDisplay ?? null)
      .then((selected) => {
        if (selected) updateApp({ screenshotDir: selected });
      });
  };

  const onResetScreenshotDir = () => {
    updateApp({ screenshotDir: null });
  };

  return (
    <div
      className={`panel${useAppStore.getState().activePanel === 'settings' ? ' active' : ''}`}
      id="panel-settings"
    >
      <div className="settings-form">
        <Section
          title={t('settings.receiverTitle')}
          subtitle={t('settings.receiverSub')}
          defaultOpen
        >
          <div className="setting-group">
            <label className="setting-label">
              <span>{t('settings.receiverName')}</span>
              <span className="hint">{t('settings.receiverNameHint')}</span>
            </label>
            <input
              type="text"
              className="setting-input"
              maxLength={30}
              placeholder="NOVX Mirror"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                debouncedReceiverUpdate({ name: e.target.value.trim() || 'NOVX Mirror' });
              }}
            />
          </div>

          <div className="setting-group">
            <label className="setting-label">{t('settings.maxResolution')}</label>
            <Select<Resolution>
              value={settings.resolution}
              onChange={(v) => updateReceiver({ resolution: v })}
              options={[
                { value: '1080p', label: t('settings.resolution.1080p') },
                { value: '1440p', label: t('settings.resolution.1440p') },
                { value: '4k', label: t('settings.resolution.4k') },
              ]}
            />
          </div>

          <div className="setting-group">
            <label className="setting-label">{t('settings.maxFps')}</label>
            <Select<Fps>
              value={settings.fps}
              onChange={(v) => updateReceiver({ fps: v })}
              options={[
                { value: 30, label: t('settings.fps.30') },
                { value: 60, label: t('settings.fps.60') },
              ]}
            />
          </div>

          <div className="setting-row">
            <div className="setting-row-info">
              <span className="setting-label">{t('settings.audio')}</span>
              <span className="hint">{t('settings.audioHint')}</span>
            </div>
            <label className="toggle">
              <input
                type="checkbox"
                checked={settings.audioEnabled}
                onChange={(e) => updateReceiver({ audioEnabled: e.target.checked })}
              />
              <span className="toggle-slider" />
            </label>
          </div>

          <div className="setting-row">
            <div className="setting-row-info">
              <span className="setting-label">{t('settings.pin')}</span>
              <span className="hint">{t('settings.pinHint')}</span>
            </div>
            <label className="toggle">
              <input
                type="checkbox"
                checked={settings.pinEnabled}
                onChange={(e) => updateReceiver({ pinEnabled: e.target.checked })}
              />
              <span className="toggle-slider" />
            </label>
          </div>

          {settings.pinEnabled ? (
            <div className="setting-group pin-group">
              <label className="setting-label">{t('settings.pinCode')}</label>
              <span className="hint">{t('settings.pinCodeHint')}</span>
              <input
                type="text"
                className="setting-input pin-input"
                maxLength={4}
                pattern="\d{4}"
                inputMode="numeric"
                placeholder="1234"
                value={pinValue}
                onChange={(e) => {
                  const v = e.target.value.replace(/\D/g, '');
                  setPinValue(v);
                  debouncedReceiverUpdate({ pin: v });
                }}
              />
            </div>
          ) : null}
        </Section>

        <Section title={t('settings.appTitle')} subtitle={t('settings.appSub')} defaultOpen>
          <div className="setting-group">
            <label className="setting-label">{t('settings.theme')}</label>
            <span className="hint">{t('settings.themeHint')}</span>
            <ThemeChips value={settings.theme} onChange={(v: Theme) => updateApp({ theme: v })} />
          </div>

          <div className="setting-group">
            <label className="setting-label">{t('settings.language')}</label>
            <span className="hint">{t('settings.languageHint')}</span>
            <Select<Locale>
              value={settings.locale}
              onChange={(v) => updateApp({ locale: v })}
              options={[
                { value: 'en', label: t('settings.languageEnglish') },
                { value: 'fr', label: t('settings.languageFrench') },
                { value: 'de', label: t('settings.languageGerman') },
              ]}
            />
          </div>

          <div className="setting-group">
            <label className="setting-label">{t('settings.screenshotFolder')}</label>
            <span className="hint">{t('settings.screenshotFolderHint')}</span>
            <input
              type="text"
              className="setting-input"
              readOnly
              value={settings.screenshotDirDisplay ?? settings.screenshotDir ?? ''}
            />
            <div className="setting-actions">
              <button type="button" className="link-btn" onClick={onChooseScreenshotDir}>
                {t('settings.screenshotFolderChoose')}
              </button>
              <button type="button" className="link-btn" onClick={onResetScreenshotDir}>
                {t('settings.screenshotFolderDefault')}
              </button>
            </div>
          </div>

          <div className="setting-row">
            <div className="setting-row-info">
              <span className="setting-label">{t('settings.autoStart')}</span>
              <span className="hint">{t('settings.autoStartHint')}</span>
            </div>
            <label className="toggle">
              <input
                type="checkbox"
                checked={settings.autoStart}
                onChange={(e) => updateApp({ autoStart: e.target.checked })}
              />
              <span className="toggle-slider" />
            </label>
          </div>

          <div className="setting-row">
            <div className="setting-row-info">
              <span className="setting-label">{t('settings.minimizeToTray')}</span>
              <span className="hint">{t('settings.minimizeToTrayHint')}</span>
            </div>
            <label className="toggle">
              <input
                type="checkbox"
                checked={settings.minimizeToTray}
                onChange={(e) => updateApp({ minimizeToTray: e.target.checked })}
              />
              <span className="toggle-slider" />
            </label>
          </div>

          <div className="setting-group">
            <label className="setting-label">{t('settings.connectBehavior')}</label>
            <span className="hint">{t('settings.connectBehaviorHint')}</span>
            <Select<ConnectBehavior>
              value={settings.connectBehavior}
              onChange={(v) => updateApp({ connectBehavior: v })}
              options={[
                { value: 'hide', label: t('settings.connectBehaviorHide') },
                { value: 'keep', label: t('settings.connectBehaviorKeep') },
              ]}
            />
          </div>

          <div className="settings-signoff">{t('settings.signoff')}</div>
        </Section>
      </div>
    </div>
  );
}
