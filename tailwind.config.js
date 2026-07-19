/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        bg: '#E8E8E4', // gris clair chaud (fond global — contraste avec les cards blanches)
        card: '#FFFFFF', // cards blanc pur
        hover: '#F0EFEA', // survol clair
        ticker: '#FFFFFF',
        border: '#E8E8E0', // bordures claires
        primary: '#0A0A0A', // texte primaire
        secondary: '#888880', // texte secondaire
        accent: '#F97316', // orange — couleur signature Nexus (thème clair)
        up: '#22C55E',
        down: '#EF4444',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'monospace'],
      },
      borderRadius: {
        card: '16px',
      },
      borderWidth: {
        hairline: '0.5px',
      },
    },
  },
  plugins: [],
}
