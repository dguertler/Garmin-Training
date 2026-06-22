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
        // Readiness-Farben
        prime:    { DEFAULT: '#22c55e', light: '#86efac', dark: '#15803d' },
        moderate: { DEFAULT: '#f59e0b', light: '#fcd34d', dark: '#b45309' },
        low:      { DEFAULT: '#ef4444', light: '#fca5a5', dark: '#b91c1c' },
        // Dashboard-Hintergründe (Dark Mode)
        surface: {
          DEFAULT: '#0f172a',   // page bg
          card:    '#1e293b',   // card bg
          border:  '#334155',   // borders
          muted:   '#475569',   // muted text
        },
      },
    },
  },
  plugins: [],
}

export default config
