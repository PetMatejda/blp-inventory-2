/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        background: '#10131a',
        'card-bg': '#1E293B',
        'surface-container': '#1d2027',
        'surface-container-high': '#272a31',
        'surface-container-highest': '#32353c',
        'surface-variant': '#32353c',
        primary: '#adc6ff',
        'primary-container': '#004395',
        'on-primary-container': '#d8e2ff',
        secondary: '#4edea3',
        'secondary-container': '#00a572',
        'on-secondary-container': '#e6fdf3',
        tertiary: '#ffb786',
        'tertiary-container': '#df7412',
        'on-tertiary-container': '#fff1e6',
        error: '#ffb4ab',
        'error-container': '#93000a',
        'on-error-container': '#ffdad6',
        outline: '#8c909f',
        'outline-variant': '#424754',
        'on-surface': '#e1e2ec',
        'on-surface-variant': '#c2c6d6',
      },
      fontFamily: {
        sans: ['Inter', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
    },
  },
  plugins: [],
}
