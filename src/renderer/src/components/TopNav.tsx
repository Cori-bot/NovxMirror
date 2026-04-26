import { useAppStore } from '../store/app';
import { useT } from '../i18n/useT';

export function TopNav() {
  const t = useT();
  const activePanel = useAppStore((s) => s.activePanel);
  const setActivePanel = useAppStore((s) => s.setActivePanel);
  return (
    <div className="top-nav">
      <button
        className={`top-nav-btn${activePanel === 'home' ? ' active' : ''}`}
        onClick={() => setActivePanel('home')}
      >
        {t('nav.home')}
      </button>
      <button
        className={`top-nav-btn${activePanel === 'settings' ? ' active' : ''}`}
        onClick={() => setActivePanel('settings')}
      >
        {t('nav.settings')}
      </button>
    </div>
  );
}
