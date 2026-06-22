import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './src/renderer/index.html',
    './src/renderer/src/**/*.{ts,tsx}',
  ],
  // Stratégie `variant` + tableau = seule forme typée valide pour plusieurs
  // sélecteurs en Tailwind v3 (la forme ['class', sel] n'accepte qu'UN sélecteur).
  // Note: l'app n'utilise aucune utilitaire `dark:` (thème géré via variables CSS
  // + [data-theme]), donc c'est surtout du futur-proofing/cohérence de type.
  darkMode: [
    'variant',
    ['&:is(.dark *)', '&:is([data-theme="dark"] *)', '&:is([data-theme="midnight"] *)'],
  ],
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
