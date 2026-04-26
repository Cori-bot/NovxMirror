import { useEffect } from 'react';
import { useAppStore } from '../store/app';

export function SuccessToast() {
  const toast = useAppStore((s) => s.toast);
  const hideToast = useAppStore((s) => s.hideToast);

  useEffect(() => {
    if (!toast) return;
    const id = setTimeout(hideToast, 3000);
    return () => {
      clearTimeout(id);
    };
  }, [toast, hideToast]);

  if (!toast) return null;

  return (
    <div className="success-toast">
      <svg
        width={14}
        height={14}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <polyline points="20 6 9 17 4 12" />
      </svg>
      <span>{toast}</span>
    </div>
  );
}
