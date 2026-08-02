/** @type {import('tailwindcss').Config} */
export default {
  content: ['./app/**/*.{js,ts,jsx,tsx}', './components/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#FFF1F1',
          100: '#FFDFE0',
          200: '#FFC2C4',
          300: '#FF9599',
          400: '#FA5D63',
          500: '#EF2B34',
          600: '#D11119',
          700: '#AE0E15',
          800: '#8A1015',
          900: '#5E0B0F',
        },
        ink: {
          900: '#0B0F19',
          700: '#374151',
          500: '#6B7280',
        },
        line: {
          200: '#E5E7EB',
        },
        surface: {
          0: '#FFFFFF',
          50: '#F9FAFB',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'sans-serif'],
      },
      boxShadow: {
        soft: '0 8px 30px rgba(0, 0, 0, 0.06)',
        card: '0 4px 20px rgba(0, 0, 0, 0.04)',
        cta: '0 8px 24px rgba(239, 43, 52, 0.28)',
      },
      animation: {
        float: 'float 6s ease-in-out infinite',
      },
      keyframes: {
        float: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-10px)' },
        },
      },
    },
  },
  plugins: [],
};
