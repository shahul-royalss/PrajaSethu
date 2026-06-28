import type { Config } from 'tailwindcss';

// Status colour semantics are centralised here (Blueprint F.1) and consumed via
// the StatusBadge component — never colour alone; always icon + text too.
const config: Config = {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          DEFAULT: '#0b5d52', // teal — the "bridge"/trust accent
          dark: '#08443c',
          light: '#0f766e',
        },
        ledger: '#0d9488', // integrity shield teal
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        telugu: ['"Noto Sans Telugu"', 'Inter', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
};

export default config;
