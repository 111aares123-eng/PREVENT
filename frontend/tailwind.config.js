/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        risk: {
          critical: "#dc2626", // Red-600
          high: "#ea580c",     // Orange-600 / Red
          medium: "#d97706",   // Amber-600
          low: "#16a34a",      // Green-600
        },
        slate: {
          850: "#151e2e",
          950: "#0b0f19"
        }
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'BlinkMacSystemFont', 'sans-serif'],
        mono: ['JetBrains Mono', 'Fira Code', 'monospace']
      }
    },
  },
  plugins: [],
}
