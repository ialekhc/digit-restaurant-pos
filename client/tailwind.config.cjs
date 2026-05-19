/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      fontFamily: {
        display: ['Poppins', 'sans-serif'],
        body: ['Nunito Sans', 'sans-serif']
      },
      colors: {
        brand: {
          50: '#fff7ed',
          100: '#ffedd5',
          200: '#fed7aa',
          300: '#fdba74',
          400: '#fb923c',
          500: '#f97316',
          600: '#ea580c',
          700: '#c2410c',
          800: '#9a3412',
          900: '#7c2d12'
        },
        aqua: {
          50: '#effcfa',
          100: '#d1f7f1',
          200: '#a8ede4',
          300: '#74dece',
          400: '#41c5b1',
          500: '#27ab97',
          600: '#1f8879',
          700: '#1e6d64',
          800: '#1d5751',
          900: '#1c4844'
        }
      }
    }
  },
  plugins: []
};
