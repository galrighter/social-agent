import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        poker: {
          bg: "#042b18",
          bg2: "#06391f",
          bg3: "#0b4a29",
          green: "#0b5a2a",
          dark: "#063a1e",
          success: "#147a35",
          red: "#a12a2a",
          bordeaux: "#8f2c24",
          brown: "#8a6616",
          brown2: "#a77a18",
          gold: "#d9b45a",
          goldBorder: "#d6b35a",
          cream: "#f5e7b8",
          panel: "#fffdf4",
          panel2: "#f8f5e8",
          text: "#102015",
        },
      },
      fontFamily: {
        sans: ["system-ui", "Segoe UI", "Arial", "sans-serif"],
      },
      maxWidth: {
        dashboard: "1400px",
      },
    },
  },
  plugins: [],
};

export default config;
