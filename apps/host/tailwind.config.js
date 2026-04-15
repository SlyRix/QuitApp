/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      opacity: { 6: "0.06", 8: "0.08", 12: "0.12", 15: "0.15" },
      colors: {
        background: "#07080f",
        surface: "#0d1018",
        "surface-2": "#131822",
        "surface-3": "#1a2230",
        accent: "#b8ff35",
        "accent-hover": "#c9ff5a",
        "accent-dim": "rgba(184,255,53,0.12)",
        coral: "#ff4d6d",
        "coral-dim": "rgba(255,77,109,0.15)",
        sky: "#38d9f5",
        "sky-dim": "rgba(56,217,245,0.12)",
        gold: "#ffd426",
        success: "#00d483",
        error: "#ff4d6d",
        warning: "#ffd426",
        "text-primary": "#e2e8f8",
        "text-secondary": "#6879a0",
        "text-muted": "#3d4d6a",
      },
      fontFamily: {
        sans: ["DM Sans", "system-ui", "sans-serif"],
        display: ["Bricolage Grotesque", "system-ui", "sans-serif"],
        mono: ["JetBrains Mono", "monospace"],
      },
      animation: {
        "fade-in": "fadeIn 0.3s ease-out",
        "slide-up": "slideUp 0.4s cubic-bezier(0.16, 1, 0.3, 1)",
        "scale-in": "scaleIn 0.3s cubic-bezier(0.16, 1, 0.3, 1)",
        "pulse-ring": "pulseRing 2s ease-in-out infinite",
        "float": "float 6s ease-in-out infinite",
        "float-delay": "float 8s ease-in-out 2s infinite",
      },
      keyframes: {
        fadeIn: { "0%": { opacity: "0" }, "100%": { opacity: "1" } },
        slideUp: { "0%": { transform: "translateY(16px)", opacity: "0" }, "100%": { transform: "translateY(0)", opacity: "1" } },
        scaleIn: { "0%": { transform: "scale(0.94)", opacity: "0" }, "100%": { transform: "scale(1)", opacity: "1" } },
        pulseRing: {
          "0%, 100%": { boxShadow: "0 0 0 0 rgba(184,255,53,0.35)" },
          "50%": { boxShadow: "0 0 0 14px rgba(184,255,53,0)" },
        },
        float: {
          "0%, 100%": { transform: "translateY(0px) rotate(0deg)" },
          "50%": { transform: "translateY(-24px) rotate(4deg)" },
        },
      },
      boxShadow: {
        "glow-accent": "0 0 40px rgba(184,255,53,0.18), 0 0 80px rgba(184,255,53,0.08)",
        "glow-coral": "0 0 30px rgba(255,77,109,0.25)",
        "card": "0 2px 12px rgba(0,0,0,0.5)",
        "card-hover": "0 8px 32px rgba(0,0,0,0.6), 0 0 0 1px rgba(184,255,53,0.2)",
      },
    },
  },
  plugins: [],
};
