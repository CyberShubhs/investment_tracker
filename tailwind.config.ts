import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        bg: {
          base: "#070a0f",
          panel: "#0d121a",
          card: "#10161f",
          ring: "#1d2735",
        },
        accent: {
          DEFAULT: "#7cf5c0",
          dim: "#4dd6a4",
        },
        danger: "#ff6b6b",
        warn: "#f5b14d",
        muted: "#76839a",
      },
      fontFamily: {
        sans: ["var(--font-sans)", "ui-sans-serif", "system-ui", "sans-serif"],
        mono: ["var(--font-mono)", "ui-monospace", "SFMono-Regular", "monospace"],
      },
      boxShadow: {
        card: "0 1px 0 rgba(255,255,255,0.04) inset, 0 12px 32px rgba(0,0,0,0.4)",
        bar: "0 -8px 32px rgba(0,0,0,0.55)",
      },
    },
  },
  plugins: [],
};

export default config;
