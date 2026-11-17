import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#0F2A2E",
        mist: "#EEF3F2",
        paper: "#FBFCFB",
        signal: "#0B6E6D",
        "signal-dark": "#095857",
        alert: "#9A3412",
        line: "#C9D6D4",
      },
      fontFamily: {
        display: ["var(--font-display)", "Georgia", "serif"],
        sans: ["var(--font-sans)", "system-ui", "sans-serif"],
      },
    },
  },
  plugins: [],
};
export default config;
