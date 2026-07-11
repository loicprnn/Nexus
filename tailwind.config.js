/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        bg: '#0A0A0A',
        card: '#0D1F0D', // fond de card vert sombre (identité verte globale)
        hover: '#0D2818', // survol / actif vert
        ticker: '#021A0E',
        border: '#0A3D2E', // bordures subtiles vertes
        primary: '#FFFFFF',
        secondary: '#8AA394', // gris légèrement verdâtre
        accent: '#10B981', // vert émeraude — couleur signature Nexus
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
