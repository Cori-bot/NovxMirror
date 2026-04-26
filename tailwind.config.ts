import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './src/renderer/index.html',
    './src/renderer/freeze-overlay.html',
    './src/renderer/src/**/*.{ts,tsx}',
  ],
  darkMode: ['class', '[data-theme="dark"]', '[data-theme="midnight"]'],
  theme: {
    extend: {
      colors: {
        bg: 'var(--bg)',
        fg: 'var(--fg)',
        muted: 'var(--muted)',
        border: 'var(--border)',
        accent: 'var(--accent)',
        'accent-fg': 'var(--accent-fg)',
        surface: 'var(--surface)',
        'surface-2': 'var(--surface-2)',
        danger: 'var(--danger)',
      },
      fontFamily: {
        sans: ['Geist', 'system-ui', 'sans-serif'],
        mono: ['Geist Mono', 'ui-monospace', 'monospace'],
      },
    },
  },
  plugins: [],
};

export default config;
