import type { Config } from 'tailwindcss';

// SAARTHI design tokens. The palette is a calm government navy/indigo with a
// saffron accent and an India-green success tone — evoking the national identity
// without using the flag literally. Status colour semantics live in the
// StatusBadge component (Blueprint F.1) — never colour alone; always icon + text.
const config: Config = {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          DEFAULT: '#1e3a8a', // deep government indigo (trust)
          dark: '#172554',
          light: '#3b5bdb',
        },
        saffron: {
          DEFAULT: '#f59e0b',
          dark: '#d97706',
          light: '#fbbf24',
        },
        india: '#138808', // success / resolved
        ledger: '#0d9488', // integrity-shield teal
        ink: '#0f172a',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        telugu: ['"Noto Sans Telugu"', 'Inter', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        card: '0 1px 2px rgba(15,23,42,0.04), 0 8px 24px -12px rgba(30,58,138,0.18)',
        lift: '0 8px 30px -8px rgba(30,58,138,0.28)',
      },
      backgroundImage: {
        'gov-mesh':
          'radial-gradient(at 0% 0%, rgba(59,91,219,0.18) 0px, transparent 50%), radial-gradient(at 100% 0%, rgba(245,158,11,0.14) 0px, transparent 45%), radial-gradient(at 80% 100%, rgba(19,136,8,0.10) 0px, transparent 45%)',
      },
    },
  },
  plugins: [],
};

export default config;
