import type { Theme } from '../types';

interface ThemeChipsProps {
  value: Theme;
  onChange: (theme: Theme) => void;
}

interface ChipDef {
  value: Theme;
  label: string;
  preview: { bg: string; surface: string; accent: string };
}

const CHIPS: ChipDef[] = [
  {
    value: 'light',
    label: 'Light',
    preview: { bg: '#ffffff', surface: '#f0f0f0', accent: '#0066ff' },
  },
  {
    value: 'dark',
    label: 'Dark',
    preview: { bg: '#0a0a0a', surface: '#1f1f1f', accent: '#3b82f6' },
  },
  {
    value: 'midnight',
    label: 'Midnight',
    preview: { bg: '#050816', surface: '#121733', accent: '#6366f1' },
  },
];

export function ThemeChips({ value, onChange }: ThemeChipsProps) {
  return (
    <div className="theme-chips">
      {CHIPS.map((chip) => {
        const selected = chip.value === value;
        return (
          <button
            key={chip.value}
            type="button"
            className={`theme-chip${selected ? ' is-selected' : ''}`}
            onClick={() => onChange(chip.value)}
            aria-pressed={selected}
          >
            <div className="theme-chip-preview" style={{ background: chip.preview.bg }}>
              <div className="theme-chip-surface" style={{ background: chip.preview.surface }} />
              <div className="theme-chip-accent" style={{ background: chip.preview.accent }} />
            </div>
            <div className="theme-chip-label">{chip.label}</div>
            {selected ? (
              <svg
                className="theme-chip-check"
                width={14}
                height={14}
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.4"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <polyline points="20 6 9 17 4 12" />
              </svg>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}
