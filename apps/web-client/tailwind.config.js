/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#fff1f1',
          100: '#ffe0e1',
          200: '#ffc7c9',
          300: '#ffa0a4',
          400: '#ff6970',
          500: '#EF2B34',
          600: '#d11119',
          700: '#b00d14',
          800: '#910f15',
          900: '#781217',
        },
      },
      fontFamily: {
        sans: [
          'Inter',
          'system-ui',
          '-apple-system',
          'BlinkMacSystemFont',
          'Segoe UI',
          'sans-serif',
        ],
      },
      boxShadow: {
        soft: '0 8px 30px rgba(0, 0, 0, 0.06)',
        card: '0 4px 20px rgba(0, 0, 0, 0.04)',
      },
    },
  },
  plugins: [],
};
