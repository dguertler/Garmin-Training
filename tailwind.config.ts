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
        // UI-Interaktionsfarbe — Electric Cyan (HUD-Energie, Garmin-Display-Ästhetik)
        signal:   { DEFAULT: '#00BFFF', light: '#7DDFF5', dark: '#0090CC' },
        // Oberflächen (tiefes Navy-Schwarz — Flight-Computer-Ästhetik)
        surface: {
          DEFAULT: '#060910',   // page bg
          card:    '#0B1220',   // card bg
          lift:    '#0F1929',   // elevated / hover states
          border:  '#172130',   // borders
          muted:   '#475A72',   // muted text
        },
        // Text
        ink:  '#BDD0E8',        // primary text (kühl-getönt)
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
