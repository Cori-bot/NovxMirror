import { useEffect, useState } from 'react';
import { useAppStore } from '../store/app';
import { useT } from '../i18n/useT';

export function ErrorBanner() {
  const t = useT();
  const errorMessage = useAppStore((s) => s.errorMessage);
  const errorDetails = useAppStore((s) => s.errorDetails);
  const hideError = useAppStore((s) => s.hideError);
  const [expanded, setExpanded] = useState(false);

  // Auto-masquage après 6s — suspendu tant que l'utilisateur a déplié les
  // détails (sinon le bandeau se ferme pendant qu'il les lit).
  useEffect(() => {
    if (!errorMessage || expanded) return;
    const id = setTimeout(hideError, 6000);
    return () => {
      clearTimeout(id);
    };
  }, [errorMessage, expanded, hideError]);

  // Chaque nouvelle erreur repart repliée.
  useEffect(() => {
    setExpanded(false);
  }, [errorMessage]);

  if (!errorMessage) return null;

  return (
    <div className="error-banner">
      <svg
        width={13}
        height={13}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
      >
        <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
        <line x1="12" y1="9" x2="12" y2="13" />
        <line x1="12" y1="17" x2="12.01" y2="17" />
      </svg>
      <span>{errorMessage}</span>
      {expanded && errorDetails ? <span className="error-details">{errorDetails}</span> : null}
      {errorDetails && errorDetails !== errorMessage ? (
        <button className="error-link" onClick={() => setExpanded((v) => !v)}>
          {t('error.details')}
        </button>
      ) : null}
      <button className="error-close" onClick={hideError} title={t('common.close')}>
        x
      </button>
    </div>
  );
}
