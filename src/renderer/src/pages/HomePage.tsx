import { useCallback } from 'react';
import logo from '../assets/novx-logo.svg';
import { useAppStore } from '../store/app';
import { useT } from '../i18n/useT';
import { StatsPanel } from '../components/StatsPanel';
import { RecordButton } from '../components/RecordButton';

export function HomePage() {
  const t = useT();
  const status = useAppStore((s) => s.status);
  const statusData = useAppStore((s) => s.statusData);
  const showError = useAppStore((s) => s.showError);

  const isConnected = status === 'connected' && Boolean(statusData.device);

  const onToggle = useCallback(() => {
    void (async () => {
      try {
        const live = (await window.airmirror.getStatus()) as { status?: string } | undefined;
        const next = live?.status ?? status;
        if (next === 'stopped' || next === 'error') {
          await window.airmirror.start();
        } else {
          await window.airmirror.stop();
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : t('error.genericReceiver');
        showError(message);
      }
    })();
  }, [status, showError, t]);

  const statusLabelMap = {
    stopped: { label: t('status.stopped.label'), sub: t('status.stopped.sub') },
    starting: { label: t('status.starting.label'), sub: t('status.starting.sub') },
    waiting: { label: t('status.waiting.label'), sub: t('status.waiting.sub') },
    connected: { label: t('status.connected.label'), sub: t('status.connected.sub') },
    error: { label: t('status.error.label'), sub: t('status.error.sub') },
  } as const;
  const statusInfo = statusLabelMap[status];
  const headlineLabel =
    status === 'connected' && statusData.device
      ? t('status.connected.withDevice', { device: statusData.device })
      : statusInfo.label;

  return (
    <div
      className={`panel${useAppStore.getState().activePanel === 'home' ? ' active' : ''}`}
      id="panel-home"
    >
      <div className={`home-body${isConnected ? ' has-stats' : ''}`}>
        <div className="home-center">
          <button
            className={`play-orb state-${status}`}
            title={t('toggle.title')}
            onClick={onToggle}
          >
            <div className={`home-icon state-${status}`}>
              <img src={logo} alt="NovX" width={52} height={52} />
            </div>
            <span className="orb-hover-hint" aria-hidden="true">
              <svg
                className="hint-play"
                width={22}
                height={22}
                viewBox="0 0 24 24"
                fill="currentColor"
              >
                <polygon points="6,3 20,12 6,21" />
              </svg>
              <svg
                className="hint-stop"
                width={20}
                height={20}
                viewBox="0 0 24 24"
                fill="currentColor"
              >
                <rect x="4" y="3" width="5" height="18" rx="2" />
                <rect x="15" y="3" width="5" height="18" rx="2" />
              </svg>
            </span>
          </button>

          <div className="home-status-group">
            <div className="launcher-state">{headlineLabel}</div>
            <div className="home-sub">{statusInfo.sub}</div>
          </div>

          {isConnected ? (
            <div className="action-strip">
              <button className="action-btn" onClick={() => window.airmirror.reset()}>
                <svg
                  width={13}
                  height={13}
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M21 12a9 9 0 1 1-2.64-6.36" />
                  <path d="M21 3v6h-6" />
                </svg>
                Reset
              </button>
              <button className="action-btn" onClick={() => window.airmirror.screenshot()}>
                <svg
                  width={13}
                  height={13}
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M4 7h4l2-2h4l2 2h4v12H4z" />
                  <circle cx="12" cy="13" r="3.5" />
                </svg>
                Screen
              </button>
              <RecordButton />
            </div>
          ) : null}
        </div>
        {isConnected ? <StatsPanel /> : null}
      </div>
    </div>
  );
}
