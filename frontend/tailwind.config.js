/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          blue: {
            DEFAULT: '#2563EB',
            light: '#EFF6FF',
            dark: '#1D4ED8',
          },
          green: {
            DEFAULT: '#10B981',
            light: '#ECFDF5',
            dark: '#047857',
          },
          orange: {
            DEFAULT: '#F97316',
            light: '#FFF7ED',
            dark: '#C2410C',
          },
          purple: {
            DEFAULT: '#8B5CF6',
            light: '#F5F3FF',
            dark: '#6D28D9',
          },
          cyan: {
            DEFAULT: '#06B6D4',
            light: '#ECFEFF',
            dark: '#0E7490',
          },
        }
      },
      fontFamily: {
        sans: ['Inter', 'Outfit', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        premium: '0 10px 30px -5px rgba(0, 0, 0, 0.05), 0 5px 15px -3px rgba(0, 0, 0, 0.02)',
        glow: '0 0 20px 2px rgba(37, 99, 235, 0.15)',
        glass: '0 8px 32px 0 rgba(31, 38, 135, 0.06)',
      }
    },
  },
  plugins: [],
}
