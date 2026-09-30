import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./lib/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        game: {
          bg: "#0d0f1d",
          surface: "#16192e",
          surfaceLight: "#1e223d",
          border: "#2d325a",
          purple: {
            DEFAULT: "#8b5cf6",
            dark: "#6d28d9",
            light: "#a78bfa",
          },
          blue: {
            DEFAULT: "#00d2ff",
            dark: "#0099cc",
            light: "#66e3ff",
          },
          yellow: {
            DEFAULT: "#ffe600",
            dark: "#e6cf00",
            light: "#fff066",
          },
          green: {
            DEFAULT: "#10b981",
            dark: "#059669",
          },
          red: {
            DEFAULT: "#f43f5e",
            dark: "#e11d48",
          },
          rarity: {
            common: "#94a3b8",
            uncommon: "#10b981",
            rare: "#0ea5e9",
            epic: "#a855f7",
            legendary: "#f59e0b",
          },
        },
      },
      fontFamily: {
        heading: ["Impact", "Arial Black", "sans-serif"],
        body: ["Inter", "system-ui", "sans-serif"],
      },
      boxShadow: {
        tactile: "0 6px 0 0 rgba(0, 0, 0, 0.4)",
        "tactile-active": "0 2px 0 0 rgba(0, 0, 0, 0.4)",
        "glow-purple": "0 0 20px -3px rgba(139, 92, 246, 0.5)",
        "glow-blue": "0 0 20px -3px rgba(0, 210, 255, 0.5)",
        "glow-yellow": "0 0 20px -3px rgba(255, 230, 0, 0.5)",
      },
      borderRadius: {
        game: "0.85rem",
      },
    },
  },
  plugins: [],
};

export default config;
