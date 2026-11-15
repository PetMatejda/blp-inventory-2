// Colours are CSS variables (RGB channels) defined in src/index.css:
// `:root` holds the dark theme, `html.light` the light one. Opacity
// modifiers (bg-primary/20) keep working through <alpha-value>.
const token = (name) => `rgb(var(--c-${name}) / <alpha-value>)`;

const TOKENS = [
  'background', 'card-bg',
  'surface-container', 'surface-container-low', 'surface-container-high',
  'surface-container-highest', 'surface-container-lowest', 'surface-variant', 'surface-bright',
  'primary', 'on-primary', 'primary-container', 'on-primary-container',
  'secondary', 'on-secondary', 'secondary-container', 'on-secondary-container',
  'tertiary', 'tertiary-container', 'on-tertiary-container',
  'error', 'on-error', 'error-container', 'on-error-container',
  'outline', 'outline-variant', 'on-surface', 'on-surface-variant',
];

/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      screens: {
        'xs': '400px',
      },
      colors: Object.fromEntries(TOKENS.map((name) => [name, token(name)])),
      fontFamily: {
        sans: ['Inter', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
      keyframes: {
        'sheet-up': {
          from: { transform: 'translateY(40%)', opacity: '0' },
          to: { transform: 'translateY(0)', opacity: '1' },
        },
        'fade-in': {
          from: { opacity: '0' },
          to: { opacity: '1' },
        },
      },
      animation: {
        'sheet-up': 'sheet-up 180ms cubic-bezier(0.2, 0.8, 0.2, 1)',
        'fade-in': 'fade-in 150ms ease-out',
      },
    },
  },
  plugins: [],
}
