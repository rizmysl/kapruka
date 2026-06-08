import typography from '@tailwindcss/typography'

/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Plus Jakarta Sans', 'Inter', 'system-ui', '-apple-system', 'sans-serif'],
        serif: ['Cormorant Garamond', 'Georgia', 'serif'],
        script: ['Great Vibes', 'cursive'],
      },
      colors: {
        brand: {
          purple: '#402970',
          'purple-light': '#6A4C9C',
          'purple-dark': '#2E1C52',
          'purple-accent': '#A17BD9',
          orange: '#402970',
          'orange-light': '#6A4C9C',
          blue: '#002F6C',
          'blue-light': '#0A4A9C',
          maroon: '#7A1C2C',
          maroonLight: '#FDF2F4',
        },
        dark: {
          bg: '#0B0F1A',
          surface: '#141925',
          card: '#1A2035',
          border: '#252D44',
          text: '#E2E8F0',
          muted: '#8892A8',
        }
      },
      animation: {
        'glow-pulse': 'glow-pulse 2s ease-in-out infinite alternate',
        'gradient-shift': 'gradient-shift 3s ease infinite',
        'float': 'float 3s ease-in-out infinite',
      },
      keyframes: {
        'glow-pulse': {
          '0%': { boxShadow: '0 0 5px rgba(64, 41, 112, 0.2)' },
          '100%': { boxShadow: '0 0 20px rgba(64, 41, 112, 0.5)' },
        },
        'gradient-shift': {
          '0%, 100%': { backgroundPosition: '0% 50%' },
          '50%': { backgroundPosition: '100% 50%' },
        },
        'float': {
          '0%, 100%': { transform: 'translateY(0px)' },
          '50%': { transform: 'translateY(-6px)' },
        },
      },
      backgroundSize: {
        '200%': '200% 200%',
      },
    },
  },
  plugins: [typography],
}
