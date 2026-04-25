import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./hooks/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}"
  ],
  theme: {
    extend: {
      colors: {
        border: "hsl(var(--border))",
        foreground: "hsl(var(--foreground))",
        background: "hsl(var(--background))",
        muted: "hsl(var(--muted))",
        surface: "hsl(var(--surface))",
        accent: "var(--accent)",
        ember: "var(--ember)",
        ink: "var(--ink)"
      },
      boxShadow: {
        halo: "0 20px 80px rgba(232, 65, 66, 0.18)"
      },
      keyframes: {
        float: {
          "0%, 100%": { transform: "translateY(0px)" },
          "50%": { transform: "translateY(-6px)" }
        },
        gridPulse: {
          "0%, 100%": { opacity: "0.25" },
          "50%": { opacity: "0.45" }
        },
        fadeRise: {
          from: { opacity: "0", transform: "translateY(12px)" },
          to: { opacity: "1", transform: "translateY(0)" }
        }
      },
      animation: {
        float: "float 6s ease-in-out infinite",
        gridPulse: "gridPulse 8s ease-in-out infinite",
        fadeRise: "fadeRise 700ms ease-out both"
      }
    }
  },
  plugins: []
};

export default config;
