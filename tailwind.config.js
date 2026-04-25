/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./app/**/*.{js,ts,jsx,tsx}", "./components/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ["var(--font-sans)"],
        mono: ["var(--font-mono)"]
      },
      colors: {
        bg: "var(--bg)",
        elev: "var(--bg-elev)",
        surface: "var(--surface)",
        border: "var(--border)",
        "border-strong": "var(--border-strong)",
        fg: "var(--fg)",
        muted: "var(--fg-muted)",
        subtle: "var(--fg-subtle)",
        faint: "var(--fg-faint)",
        accent: "var(--accent)"
      }
    }
  },
  plugins: []
};
