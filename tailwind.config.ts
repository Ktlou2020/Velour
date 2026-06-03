import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        black: {
          DEFAULT: "#0A0A0F",
          50: "#1A1A2E",
          100: "#16213E",
          200: "#0F3460",
        },
        crimson: {
          DEFAULT: "#DC143C",
          50: "#FFF0F3",
          100: "#FFD6DF",
          200: "#FFB3C1",
          300: "#FF85A1",
          400: "#FF4D6D",
          500: "#DC143C",
          600: "#C1121F",
          700: "#9D0208",
          800: "#6A040F",
          900: "#370617",
          950: "#1A0007",
        },
        gold: {
          DEFAULT: "#D4AF37",
          50: "#FDFAEF",
          100: "#FAF2C8",
          200: "#F5E48F",
          300: "#EDD150",
          400: "#E2BE2A",
          500: "#D4AF37",
          600: "#B8941E",
          700: "#9A7A14",
          800: "#7E6214",
          900: "#6B5016",
          950: "#3E2D09",
        },
      },
      fontFamily: {
        serif: ["Playfair Display", "Georgia", "serif"],
        sans: ["Inter", "system-ui", "sans-serif"],
      },
      animation: {
        float: "float 6s ease-in-out infinite",
        shimmer: "shimmer 2.5s linear infinite",
        gradientShift: "gradientShift 8s ease infinite",
        onlinePulse: "onlinePulse 2s ease-in-out infinite",
        fadeIn: "fadeIn 0.5s ease-out forwards",
        slideUp: "slideUp 0.5s ease-out forwards",
        spin: "spin 1s linear infinite",
      },
      keyframes: {
        float: {
          "0%, 100%": { transform: "translateY(0px)" },
          "50%": { transform: "translateY(-20px)" },
        },
        shimmer: {
          "0%": { backgroundPosition: "-200% 0" },
          "100%": { backgroundPosition: "200% 0" },
        },
        gradientShift: {
          "0%, 100%": { backgroundPosition: "0% 50%" },
          "50%": { backgroundPosition: "100% 50%" },
        },
        onlinePulse: {
          "0%, 100%": { opacity: "1", transform: "scale(1)" },
          "50%": { opacity: "0.5", transform: "scale(1.3)" },
        },
        fadeIn: {
          from: { opacity: "0" },
          to: { opacity: "1" },
        },
        slideUp: {
          from: { opacity: "0", transform: "translateY(20px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
      },
      backgroundImage: {
        "gradient-radial": "radial-gradient(var(--tw-gradient-stops))",
        "gradient-crimson-gold":
          "linear-gradient(135deg, #DC143C 0%, #D4AF37 100%)",
        "gradient-dark": "linear-gradient(135deg, #0A0A0F 0%, #1A1A2E 100%)",
      },
      backdropBlur: {
        xs: "2px",
      },
      boxShadow: {
        crimson: "0 0 20px rgba(220, 20, 60, 0.4)",
        gold: "0 0 20px rgba(212, 175, 55, 0.4)",
        glass: "0 8px 32px 0 rgba(0, 0, 0, 0.37)",
      },
    },
  },
  plugins: [],
};

export default config;
