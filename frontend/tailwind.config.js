/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Plus Jakarta Sans', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
      colors: {
        sky: {
          25:  '#f0f8ff',
          50:  '#e6f3ff',
          100: '#cce7ff',
          200: '#99cfff',
          300: '#66b7ff',
          400: '#339fff',
          500: '#0087ff',
          600: '#006fdb',
          700: '#0057b7',
        },
        slate: {
          50:  '#f8fafc',
          100: '#f1f5f9',
          200: '#e2e8f0',
          300: '#cbd5e1',
          400: '#94a3b8',
          500: '#64748b',
          600: '#475569',
          700: '#334155',
          800: '#1e293b',
        },
      },
      boxShadow: {
        card: '0 1px 3px 0 rgb(0 135 255 / 0.06), 0 1px 2px -1px rgb(0 135 255 / 0.06)',
        'card-hover': '0 4px 16px 0 rgb(0 135 255 / 0.12), 0 2px 4px -2px rgb(0 135 255 / 0.08)',
        'stat': '0 2px 8px 0 rgb(0 135 255 / 0.10)',
      },
    },
  },
  plugins: [],
}
