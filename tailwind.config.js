/** @type {import('tailwindcss').Config} */
export default {
  darkMode: "class",
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        canvas: "#f4f7f6",
        ink: "#0f172a",
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "-apple-system", "Segoe UI", "sans-serif"],
      },
      boxShadow: {
        card: "0 1px 2px rgba(16,24,40,0.04), 0 12px 32px -18px rgba(16,24,40,0.20)",
        "card-hover":
          "0 2px 4px rgba(16,24,40,0.05), 0 22px 44px -22px rgba(13,148,136,0.45)",
      },
      keyframes: {
        "fade-slide": {
          "0%": { opacity: "0", transform: "translateY(6px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        flash: {
          "0%": { backgroundColor: "rgba(13,148,136,0.20)" },
          "100%": { backgroundColor: "transparent" },
        },
      },
      animation: {
        "fade-slide": "fade-slide 0.35s ease-out",
        flash: "flash 1.2s ease-out",
      },
    },
  },
  plugins: [],
};
