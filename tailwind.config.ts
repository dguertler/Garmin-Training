import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // Readiness-Semantik
        prime:    { DEFAULT: '#10B981', light: '#6EE7B7', dark: '#059669' },
        moderate: { DEFAULT: '#F59E0B', light: '#FCD34D', dark: '#B45309' },
        low:      { DEFAULT: '#EF4444', light: '#FCA5A5', dark: '#B91C1C' },
        // UI-Interaktionsfarbe (getrennt von Ampelfarben)
        signal:   { DEFAULT: '#3B82F6', light: '#93C5FD', dark: '#1D4ED8' },
        // Oberflächen (tiefes, kühles Dunkel — Telemetrie-Ästhetik)
        surface: {
          DEFAULT: '#070A0F',   // page bg
          card:    '#0D1117',   // card bg
          lift:    '#141C28',   // elevated / hover states
          border:  '#1C2535',   // borders
          muted:   '#475A72',   // muted text
        },
        // Text
        ink:  '#C4D0E0',        // primary text (kühl-getönt)
        fade: '#4B5A6E',        // secondary text
      },
      fontFamily: {
        display: ['var(--font-display)', 'sans-serif'],
        data:    ['var(--font-data)',    'monospace'],
        body:    ['var(--font-body)',    'sans-serif'],
      },
    },
  },
  plugins: [],
}

export default config
