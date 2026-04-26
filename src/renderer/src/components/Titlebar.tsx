import logo from '../assets/novx-logo.svg';
import { useT } from '../i18n/useT';

export function Titlebar() {
  const t = useT();
  return (
    <div className="titlebar" id="titlebar">
      <div className="titlebar-logo">
        <img src={logo} alt="NovX" width={16} height={16} />
        <span>NOVX Mirror</span>
      </div>

      <div className="titlebar-controls">
        <button
          className="ctrl-btn minimize"
          title={t('titlebar.minimize')}
          onClick={() => window.airmirror.minimizeWindow()}
        >
          <svg width={10} height={1} viewBox="0 0 10 1">
            <rect width="10" height="1.5" fill="currentColor" rx="1" />
          </svg>
        </button>
        <button
          className="ctrl-btn close"
          title={t('titlebar.close')}
          onClick={() => window.airmirror.closeWindow()}
        >
          <svg width={10} height={10} viewBox="0 0 10 10">
            <line
              x1="1"
              y1="1"
              x2="9"
              y2="9"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
            />
            <line
              x1="9"
              y1="1"
              x2="1"
              y2="9"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
            />
          </svg>
        </button>
      </div>
    </div>
  );
}
