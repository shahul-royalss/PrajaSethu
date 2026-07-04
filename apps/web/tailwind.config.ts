import type { Config } from 'tailwindcss';

// SAARTHI design system — "Calm command center".
// Deep institutional navy + a restrained antique-gold accent (the guide) + a cool
// canvas. Status colours are strictly functional (icon + label + colour, never
// colour alone). Mirrors the design tokens in app/console.css.
const config: Config = {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          DEFAULT: '#143071', // navy-700 — primary buttons / brand
          dark: '#0D2150', // navy-800
          light: '#2D5BD7', // royal — interactive blue
        },
        navy: {
          900: '#091633',
          800: '#0D2150',
          700: '#143071',
          600: '#1C3F8F',
        },
        royal: { DEFAULT: '#2D5BD7', soft: '#E8EEFC' },
        gold: { DEFAULT: '#CBA046', deep: '#A87C28', soft: '#F6EFDC' },
        // Legacy `saffron` token remapped to antique gold so existing classes stay cohesive.
        saffron: { DEFAULT: '#CBA046', dark: '#A87C28', light: '#E7C988' },
        india: '#0C9C6C', // success / resolved (functional "ok")
        ledger: '#0b7a8a', // integrity-badge teal
        canvas: '#EBEFF8',
        ink: '#0F1A33',
        muted: '#5A6B8C',
        faint: '#8B98B6',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        display: ['"Bricolage Grotesque"', 'Inter', 'system-ui', 'sans-serif'],
        mono: ['"IBM Plex Mono"', 'ui-monospace', 'monospace'],
        telugu: ['"Noto Sans Telugu"', 'Inter', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        card: '0 1px 2px rgba(13,27,73,.07), 0 1px 3px rgba(13,27,73,.05)',
        soft: '0 6px 20px rgba(13,27,73,.09)',
        lift: '0 16px 44px rgba(9,22,51,.18)',
      },
      borderRadius: {
        xl2: '14px',
        xl3: '22px',
      },
      backgroundImage: {
        'gov-mesh':
          'radial-gradient(at 0% 0%, rgba(45,91,215,0.16) 0px, transparent 50%), radial-gradient(at 100% 0%, rgba(203,160,70,0.14) 0px, transparent 45%), radial-gradient(at 80% 100%, rgba(20,48,113,0.10) 0px, transparent 45%)',
      },
    },
  },
  plugins: [],
};

export default config;
