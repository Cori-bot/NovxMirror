import { useState, type ReactNode } from 'react';

interface SectionProps {
  title: string;
  subtitle?: string;
  children: ReactNode;
  defaultOpen?: boolean;
}

export function Section({ title, subtitle, children, defaultOpen = true }: SectionProps) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className={`novx-section${open ? ' is-open' : ''}`}>
      <button
        type="button"
        className="novx-section-header"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        <div className="novx-section-text">
          <div className="novx-section-title">{title}</div>
          {subtitle ? <div className="novx-section-sub">{subtitle}</div> : null}
        </div>
        <svg
          className="novx-section-chevron"
          width={14}
          height={14}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.4"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>
      {open ? <div className="novx-section-body">{children}</div> : null}
    </div>
  );
}
