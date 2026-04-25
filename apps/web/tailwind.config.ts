import type { Config } from "tailwindcss";

export default {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./hooks/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ["var(--font-sans)"],
        mono: ["var(--font-mono)"],
      },
      colors: {
        bg: "var(--bg)",
        elev: "var(--bg-elev)",
        fg: "var(--fg)",
        muted: "var(--fg-muted)",
        subtle: "var(--fg-subtle)",
        faint: "var(--fg-faint)",
        accent: "var(--accent)",
      },
    },
  },
  plugins: [],
} satisfies Config;
