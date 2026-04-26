import { useEffect, useState } from 'react';

export function useTimer(connectedAt: Date | string | null | undefined): string {
  const [text, setText] = useState('00:00:00');

  useEffect(() => {
    if (!connectedAt) {
      setText('00:00:00');
      return;
    }
    const start = new Date(connectedAt).getTime();
    const tick = () => {
      const elapsed = Math.floor((Date.now() - start) / 1000);
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
  }, [connectedAt]);

  return text;
}
