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
        sky: "#38d9f5",
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
        "slide-up": "slideUp 0.45s cubic-bezier(0.16, 1, 0.3, 1)",
        "bounce-in": "bounceIn 0.55s cubic-bezier(0.34, 1.56, 0.64, 1)",
        "scale-in": "scaleIn 0.3s cubic-bezier(0.16, 1, 0.3, 1)",
        "pulse-dot": "pulseDot 1.4s ease-in-out infinite",
        "float": "float 5s ease-in-out infinite",
        "shimmer": "shimmer 2s linear infinite",
      },
      keyframes: {
        fadeIn: { "0%": { opacity: "0" }, "100%": { opacity: "1" } },
        slideUp: { "0%": { transform: "translateY(20px)", opacity: "0" }, "100%": { transform: "translateY(0)", opacity: "1" } },
        bounceIn: {
          "0%": { transform: "scale(0.5)", opacity: "0" },
          "70%": { transform: "scale(1.05)" },
          "100%": { transform: "scale(1)", opacity: "1" },
        },
        scaleIn: { "0%": { transform: "scale(0.9)", opacity: "0" }, "100%": { transform: "scale(1)", opacity: "1" } },
        pulseDot: {
          "0%, 100%": { transform: "scale(1)", opacity: "0.4" },
          "50%": { transform: "scale(1.4)", opacity: "1" },
        },
        float: {
          "0%, 100%": { transform: "translateY(0px)" },
          "50%": { transform: "translateY(-16px)" },
        },
        shimmer: {
          "0%": { backgroundPosition: "-200% center" },
          "100%": { backgroundPosition: "200% center" },
        },
      },
    },
  },
  plugins: [],
};
