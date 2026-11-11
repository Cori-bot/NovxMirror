import { useEffect } from 'react';
import { useAppStore } from '../store/app';
import { useT, useTranslations } from '../i18n/useT';

export function PageOverlay() {
  const t = useT();
  const tr = useTranslations();
  const pageKey = useAppStore((s) => s.pageOverlay);
  const setPageOverlay = useAppStore((s) => s.setPageOverlay);

  useEffect(() => {
    if (!pageKey) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setPageOverlay(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [pageKey, setPageOverlay]);

  if (!pageKey) return null;
  const page = tr.pages[pageKey];

  return (
    <div
      className="page-overlay"
      onClick={(e) => e.target === e.currentTarget && setPageOverlay(null)}
    >
      <div className="page-dialog">
        <div className="page-header">
          <div className="page-title-wrap">
            <div className="page-kicker">NOVX Mirror</div>
            <div className="page-title">{page.title}</div>
          </div>
          <button
            className="icon-link-btn"
            title={t('common.close')}
            onClick={() => setPageOverlay(null)}
          >
            <svg
              width={14}
              height={14}
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.1"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M18 6L6 18" />
              <path d="M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="page-body">
          <div className="page-copy">{page.intro}</div>
          {page.sections.map((section, idx) => (
            <div className="page-section" key={idx}>
              <div className="page-section-title">{section.title}</div>
              <div className="page-section-text">{section.text}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
