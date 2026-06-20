/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  // Safelist: classes geradas dinamicamente (cores dos métodos de jogador e métodos novos Lay 1x0/0x1)
  safelist: [
    {
      pattern: /(bg|text|ring)-(emerald|amber|blue|purple|rose|cyan|pink|fuchsia)-(50|100|300|400|700|800|950)/,
      variants: ['dark', 'hover'],
    },
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        ink: {
          50: '#f8fafc',
          100: '#f1f5f9',
          200: '#e2e8f0',
          300: '#cbd5e1',
          400: '#94a3b8',
          500: '#64748b',
          600: '#475569',
          700: '#334155',
          800: '#1e293b',
          900: '#0f172a',
          950: '#020617',
        },
      },
    },
  },
  plugins: [],
};
