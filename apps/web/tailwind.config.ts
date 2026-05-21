import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: ["class"],
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./lib/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#0B0B0B",
        signal: "#FFD600",
        pulse: "#FF00CC",
        mist: "rgba(255,255,255,0.08)"
      },
      boxShadow: {
        glow: "0 0 60px rgba(255, 214, 0, 0.16)",
        pink: "0 0 40px rgba(255, 0, 204, 0.2)"
      },
      fontFamily: {
        sans: ["var(--font-geist)", "Inter", "system-ui", "sans-serif"]
      }
    }
  },
  plugins: []
};

export default config;
