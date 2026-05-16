import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        bg: {
          base: "#07090d",
          panel: "#0e1218",
          card: "#131822",
          ring: "#1c2433",
        },
        accent: {
          DEFAULT: "#7cf5c0",
          dim: "#4dd6a4",
        },
        danger: "#ff6b6b",
        warn: "#f5b14d",
        muted: "#7a869a",
      },
      fontFamily: {
        sans: ["ui-sans-serif", "system-ui", "-apple-system", "Segoe UI", "Roboto", "sans-serif"],
      },
      boxShadow: {
        card: "0 1px 0 rgba(255,255,255,0.04) inset, 0 8px 24px rgba(0,0,0,0.35)",
      },
    },
  },
  plugins: [],
};

export default config;
