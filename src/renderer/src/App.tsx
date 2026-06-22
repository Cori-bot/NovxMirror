import { useEffect, useRef } from 'react';
import { Titlebar } from './components/Titlebar';
import { TopNav } from './components/TopNav';
import { HomePage } from './pages/HomePage';
import { SettingsPage } from './pages/SettingsPage';
import { ErrorBanner } from './components/ErrorBanner';
import { SuccessToast } from './components/SuccessToast';
import { Onboarding } from './components/Onboarding';
import { BonjourModal } from './components/BonjourModal';
import { PageOverlay } from './components/PageOverlay';
import { AppFooter } from './components/AppFooter';
import { useAppStore } from './store/app';
import { useSettingsStore } from './store/settings';
import { useT } from './i18n/useT';
import type { Locale, SettingsPayload, StatusUpdate, StreamStats, Theme } from './types';

function isReceiverErrorMessage(msg: string): boolean {
  return /gst|gstreamer|pipeline|d3d|window was closed|closed/i.test(msg);
}

export default function App() {
  const t = useT();
  const setStatus = useAppStore((s) => s.setStatus);
  const setLocale = useAppStore((s) => s.setLocale);
  const setTheme = useAppStore((s) => s.setTheme);
  const showToast = useAppStore((s) => s.showToast);
  const showError = useAppStore((s) => s.showError);
  const setBonjourMissing = useAppStore((s) => s.setBonjourMissing);
  const setLangPickerOpen = useAppStore((s) => s.setLangPickerOpen);
  const setVersion = useAppStore((s) => s.setVersion);
  const setStreamStats = useAppStore((s) => s.setStreamStats);
  const setSettings = useSettingsStore((s) => s.setSettings);
  const activePanel = useAppStore((s) => s.activePanel);

  const tRef = useRef(t);
  tRef.current = t;

  useEffect(() => {
    let unsubscribers: Array<() => void> = [];

    void Promise.all([
      window.airmirror.getStatus() as Promise<StatusUpdate>,
      window.airmirror.getSettings() as Promise<SettingsPayload>,
      window.airmirror.getVersion(),
    ]).then(([status, settings, version]) => {
      setSettings(settings);
      setTheme(settings.theme);
      setLocale(settings.locale);
      setStatus(status);
      setVersion(version);
      if (settings.firstLaunch !== false) {
        setLangPickerOpen(true);
      }
    });

    unsubscribers.push(window.airmirror.onStatus((data) => setStatus(data)));
    unsubscribers.push(
      window.airmirror.onStreamStats((stats: StreamStats) => setStreamStats(stats)),
    );
    unsubscribers.push(
      window.airmirror.onError((msg) => {
        let message = '';
        if (typeof msg === 'string') message = msg;
        else if (msg && typeof msg.message === 'string') message = msg.message;
        if (!message) return;
        const tt = tRef.current;
        const generic = isReceiverErrorMessage(message) ? tt('error.genericReceiver') : message;
        showError(generic, message);
      }),
    );
    unsubscribers.push(
      window.airmirror.onSuccess((payload) => {
        if (payload.type === 'screenshot-saved') {
          showToast(tRef.current('settings.screenshotSaved'));
        }
      }),
    );
    unsubscribers.push(window.airmirror.onThemeChanged((theme) => setTheme(theme as Theme)));
    unsubscribers.push(window.airmirror.onLocaleChanged((locale) => setLocale(locale as Locale)));
    unsubscribers.push(window.airmirror.onBonjourMissing(() => setBonjourMissing(true)));
    unsubscribers.push(
      window.airmirror.onVideoRouteSwitch(() => {
        const tt = tRef.current;
        showError(tt('error.videoRouteTitle'), tt('error.videoRouteDetail'));
      }),
    );

    return () => {
      unsubscribers.forEach((u) => u());
      unsubscribers = [];
    };
    // Init + listeners run exactly once. Translations are accessed via tRef so
    // changing locale doesn't refetch settings (which would reset firstLaunch).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <>
      <Titlebar />
      <div className="app">
        <TopNav />
        {activePanel === 'home' ? <HomePage /> : <SettingsPage />}
      </div>
      <SuccessToast />
      <ErrorBanner />
      <AppFooter />
      <PageOverlay />
      <Onboarding />
      <BonjourModal />
    </>
  );
}
