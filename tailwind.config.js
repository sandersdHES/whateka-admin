/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['"Plus Jakarta Sans"', 'system-ui', 'sans-serif'],
      },
      colors: {
        brand: {
          cyan: '#00B8D9',
          orange: '#FF6F61',
          green: '#97C45F',
          yellow: '#F6AE2D',
          brown: '#926335',
        },
        surface: {
          DEFAULT: '#F8FAFB',
          dark: '#0F172A',
          darker: '#0B1220',
          sidebar: '#111827',
        },
      },
      boxShadow: {
        soft: '0 4px 24px -6px rgba(15, 23, 42, 0.08)',
      },
    },
  },
  plugins: [],
};
