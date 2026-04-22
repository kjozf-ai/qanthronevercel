/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        "throne-gold":  "#f5a623",
        "throne-gold2": "#fcd34d",
        "throne-dark":  "#08080f",
        "throne-card":  "#12121e",
        "throne-border":"#1e1e35",
      },
      fontFamily: {
        cinzel: ["Cinzel", "serif"],
        mono:   ["JetBrains Mono", "monospace"],
      },
    },
  },
  plugins: [],
};
