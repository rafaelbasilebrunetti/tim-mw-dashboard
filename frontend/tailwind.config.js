/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        base: "#0F1417",
        surface: "#171D21",
        line: "#262E33",
        ink: "#E8ECEE",
        muted: "#8B979E",
        accent: "#E8A23D",
        "track-done": "#4FB286",
        "track-planned": "#E8A23D",
        "track-pending": "#4A555C",
        "status-hold": "#E2574C",
      },
    },
  },
  plugins: [],
};
