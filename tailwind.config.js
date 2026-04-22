/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        "throne-gold":    "#f5a623",
        "throne-gold2":   "#fcd34d",
        "throne-dark":    "#08080f",
        "throne-card":    "#12121e",
        "throne-border":  "#1e1e35",
        "throne-surface": "#16162a",
        "throne-text":    "#e8ecf4",
        "throne-muted":   "#6b7280",
        "throne-success": "#22c55e",
        "throne-purple":  "#8b5cf6",
      },
      fontFamily: {
        cinzel: ["Cinzel", "serif"],
        mono:   ["JetBrains Mono", "monospace"],
      },
    },
  },
  plugins: [],
};
