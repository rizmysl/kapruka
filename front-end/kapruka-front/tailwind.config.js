import typography from '@tailwindcss/typography'

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
          orange: '#FF7A00',
          blue: '#002F6C',
          maroon: '#7A1C2C',
          maroonLight: '#FDF2F4',
        }
      }
    },
  },
  plugins: [typography],
}
