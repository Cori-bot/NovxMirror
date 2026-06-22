import { useEffect, useState } from 'react';
import { useAppStore } from '../store/app';
import { useT, useTranslations } from '../i18n/useT';

export function BonjourModal() {
  const t = useT();
  const tr = useTranslations();
  const isOpen = useAppStore((s) => s.bonjourMissing);
  const setBonjourMissing = useAppStore((s) => s.setBonjourMissing);
  const [installing, setInstalling] = useState(false);
  const [phase, setPhase] = useState<'idle' | 'success' | 'failed'>('idle');
  const [countdown, setCountdown] = useState(3);

  // Compte à rebours avant redémarrage, piloté par un effet NETTOYABLE : si la
  // modale se ferme/démonte pendant le décompte, l'intervalle est clearé et
  // restartApp() n'est PAS appelé deux fois (ancien bug : setTimeout récursifs
  // jamais nettoyés + setState sur composant démonté).
  useEffect(() => {
    if (!isOpen || phase !== 'success') return;
    setCountdown(3);
    let n = 3;
    const id = setInterval(() => {
      n -= 1;
      setCountdown(n);
      if (n <= 0) {
        clearInterval(id);
        void window.airmirror.restartApp();
      }
    }, 1000);
    return () => {
      clearInterval(id);
    };
  }, [isOpen, phase]);

  if (!isOpen) return null;

  const onInstall = () => {
    setInstalling(true);
    setPhase('idle');
    void window.airmirror.installBonjour().then((result) => {
      setInstalling(false);
      setPhase(result.success ? 'success' : 'failed');
    });
  };

  const onAlt = () => {
    void window.airmirror.openBonjourPage();
  };

  const onDismiss = () => {
    setBonjourMissing(false);
    void window.airmirror.restartApp();
  };

  return (
    <div className="bonjour-overlay">
      <div className="bonjour-dialog">
        {phase === 'success' ? (
          <div className="bonjour-success-state">
            <div className="bonjour-success-icon">
              <svg
                width={22}
                height={22}
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <polyline points="20 6 9 17 4 12" />
              </svg>
            </div>
            <div className="bonjour-success-title">{tr.bonjour['successTitle']}</div>
            <div className="bonjour-success-countdown">
              {(tr.bonjour['successRestart'] ?? '').replace('{{n}}', String(countdown))}
            </div>
          </div>
        ) : (
          <>
            <div className="bonjour-icon-wrap">
              <svg
                width={26}
                height={26}
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M3.5 8.5a12 12 0 0 1 17 0" />
                <path d="M6.75 11.75a7.4 7.4 0 0 1 10.5 0" />
                <path d="M10 15a3 3 0 0 1 4 0" />
                <path d="M12 18.2l3.6 4.3H8.4L12 18.2Z" fill="currentColor" stroke="none" />
              </svg>
            </div>
            <div className="bonjour-title">{t('bonjour.title')}</div>
            <div className="bonjour-desc">{t('bonjour.desc')}</div>
            <button className="bonjour-cta" disabled={installing} onClick={onInstall}>
              {installing
                ? t('bonjour.installing')
                : phase === 'failed'
                  ? t('bonjour.failed')
                  : t('bonjour.cta')}
            </button>
            {phase === 'failed' ? <div className="bonjour-status">{t('bonjour.alt')}</div> : null}
            <button className="bonjour-link" onClick={onAlt}>
              {t('bonjour.alt')}
            </button>
            <button className="bonjour-dismiss" onClick={onDismiss}>
              {t('bonjour.dismiss')}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
