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
          50: '#eef5ff',
          100: '#d9e9ff',
          200: '#b8d7ff',
          300: '#86bcff',
          400: '#4d96ff',
          500: '#1f73f1',
          600: '#0b57d0',
          700: '#0847ad',
          800: '#0b3d8f',
          900: '#12346f'
        },
        secondary: {
          50: '#fff1f6',
          100: '#ffe3ee',
          200: '#ffc7dc',
          300: '#ff98bd',
          400: '#ff5f95',
          500: '#ff2b68',
          600: '#e21252',
          700: '#c0184f',
          800: '#9f1747',
          900: '#86163f'
        },
        aqua: {
          50: '#f4f7fb',
          100: '#e8eef7',
          200: '#ccd9ea',
          300: '#9fb8d5',
          400: '#6e93bd',
          500: '#4c759f',
          600: '#3a5d82',
          700: '#314c69',
          800: '#1c2b43',
          900: '#142238'
        }
      }
    }
  },
  plugins: []
};
