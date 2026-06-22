import { useEffect, useState } from 'react';

export function useTimer(connectedAt: Date | string | null | undefined): string {
  const [text, setText] = useState('00:00:00');

  // On dérive un timestamp PRIMITIF stable : la dépendance d'effet est un number,
  // pas l'identité d'un objet Date. Sans ça, passer un `new Date()` (ou un objet
  // recréé) relançait clearInterval/setInterval à chaque render et remettait le
  // chrono à zéro.
  const startMs = connectedAt ? new Date(connectedAt).getTime() : null;

  useEffect(() => {
    if (startMs === null || Number.isNaN(startMs)) {
      setText('00:00:00');
      return;
    }
    const tick = () => {
      const elapsed = Math.floor((Date.now() - startMs) / 1000);
      const h = String(Math.floor(elapsed / 3600)).padStart(2, '0');
      const m = String(Math.floor((elapsed % 3600) / 60)).padStart(2, '0');
      const s = String(elapsed % 60).padStart(2, '0');
      setText(`${h}:${m}:${s}`);
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => {
      clearInterval(id);
    };
  }, [startMs]);

  return text;
}
