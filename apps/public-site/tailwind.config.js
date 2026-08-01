/** @type {import('tailwindcss').Config} */
export default {
  content: ['./app/**/*.{js,ts,jsx,tsx}', './components/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#f0fdf9',
          100: '#e0f7f2',
          200: '#b6f0e3',
          300: '#7fe6cd',
          400: '#40d7b4',
          500: '#1bc2a0',
          600: '#0ea583',
          700: '#0c846d',
          800: '#0c6958',
          900: '#0b564a',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'sans-serif'],
      },
      boxShadow: {
        soft: '0 8px 30px rgba(0, 0, 0, 0.06)',
        card: '0 4px 20px rgba(0, 0, 0, 0.04)',
      },
      animation: {
        'float': 'float 6s ease-in-out infinite',
      },
      keyframes: {
        float: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-12px)' },
        },
      },
    },
  },
  plugins: [],
};
