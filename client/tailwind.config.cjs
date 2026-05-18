/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#f1f8ff',
          100: '#dceeff',
          200: '#bfdfff',
          300: '#93c9ff',
          400: '#5cacff',
          500: '#368dff',
          600: '#1f6ff5',
          700: '#1958e1',
          800: '#1a47b6',
          900: '#1b3f8f'
        }
      }
    }
  },
  plugins: []
};
