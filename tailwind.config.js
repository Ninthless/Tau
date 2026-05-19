/** @type {import('tailwindcss').Config} */
export default {
  content: ["./src/**/*.{ts,tsx}", "./index.html"],
  theme: {
    extend: {
      colors: {
        surface: "#1a1a1a",
        panel: "#242424",
        border: "#333333",
        accent: "#7c6af7",
      },
    },
  },
  plugins: [],
}
