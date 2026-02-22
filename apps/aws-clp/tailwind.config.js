/** @type {import('tailwindcss').Config} */
module.exports = {
  // NativeWind 4.x uses the content array to find class names
  content: ['./src/**/*.{js,jsx,ts,tsx}', './App.{js,jsx,ts,tsx}'],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      colors: {
        // AWS Brand Colors
        aws: {
          orange: '#FF9900',
          squid: '#232F3E',
          smile: '#37475A',
          anchor: '#146EB4',
          cosmos: '#1D3557',
        },
        // App-specific colors
        primary: {
          50: '#fff7ed',
          100: '#ffedd5',
          200: '#fed7aa',
          300: '#fdba74',
          400: '#fb923c',
          500: '#FF9900', // AWS Orange
          600: '#ea580c',
          700: '#c2410c',
          800: '#9a3412',
          900: '#7c2d12',
        },
        secondary: {
          50: '#f8fafc',
          100: '#f1f5f9',
          200: '#e2e8f0',
          300: '#cbd5e1',
          400: '#94a3b8',
          500: '#64748b',
          600: '#475569',
          700: '#334155',
          800: '#1e293b',
          900: '#232F3E', // AWS Squid Ink
        },
        // Semantic colors
        success: {
          light: '#86efac',
          DEFAULT: '#22c55e',
          dark: '#15803d',
        },
        warning: {
          light: '#fde047',
          DEFAULT: '#eab308',
          dark: '#a16207',
        },
        error: {
          light: '#fca5a5',
          DEFAULT: '#ef4444',
          dark: '#b91c1c',
        },
        // Exam status colors
        correct: '#22c55e',
        incorrect: '#ef4444',
        flagged: '#eab308',
        unanswered: '#94a3b8',
      },
      fontFamily: {
        sans: ['System'], // Use system font for React Native
      },
      spacing: {
        // Screen-safe spacing (accounts for notches, status bars)
        'safe-top': 'env(safe-area-inset-top)',
        'safe-bottom': 'env(safe-area-inset-bottom)',
        'safe-left': 'env(safe-area-inset-left)',
        'safe-right': 'env(safe-area-inset-right)',
      },
      borderRadius: {
        card: '12px',
        button: '8px',
      },
    },
  },
  plugins: [],
};
