import type { Config } from "tailwindcss";

// Helper: convert hex to "r g b" so Tailwind opacity modifiers (bg-primary/10) work
function hexToRgb(hex: string): string {
  const h = hex.replace("#", "");
  const r = parseInt(h.substring(0, 2), 16);
  const g = parseInt(h.substring(2, 4), 16);
  const b = parseInt(h.substring(4, 6), 16);
  return `${r} ${g} ${b}`;
}

// ITGA Brand Palette — exact values from Flutter const.dart
const itga = {
  primary:    "#2AABAB", // cPrimary / cTeal
  primaryHov: "#239494",
  primaryLt:  "#E8F7F7",
  cyan:       "#5DCCC6", // cCyan — highlights, active
  magenta:    "#C62168", // cMagenta — likes, hearts, CTAs
  orange:     "#E87722", // cOrange — warnings, badges
  gold:       "#F5C040", // cGold — achievements, premium
  navy:       "#1B3A5C", // cNavy — headers, depth
  navyDark:   "#122840",
  green:      "#22C55E", // cGreen — repost, success (distinct from primary)
  red:        "#E53E3E", // cRed — error/danger
  blueTick:   "#1D9BF0", // cBlueTick — verified
  black:      "#0E0E0E", // cBlack
  mainText:   "#1B2838", // cMainText
  darkText:   "#4A5568", // cDarkText
  lightText:  "#8A95A5", // cLightText
  lightIcon:  "#AEB8C4", // cLightIcon
  lightBg:    "#F0F4F8", // cLightBg
  bg:         "#F5F7FA", // cBG
  darkBg:     "#1A1A2E", // cDarkBG / cBlackSheetBG
  border:     "#E2E8F0",
  borderLt:   "#F1F5F9",
};

const config: Config = {
  darkMode: "class",
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    screens: {
      sm: "640px",
      md: "768px",
      lg: "1024px",
      xl: "1200px",
      "2xl": "1536px",
    },
    extend: {
      colors: {
        primary: {
          DEFAULT: `rgb(${hexToRgb(itga.primary)} / <alpha-value>)`,
          hover:   itga.primaryHov,
          light:   itga.primaryLt,
        },
        cyan:    `rgb(${hexToRgb(itga.cyan)} / <alpha-value>)`,
        magenta: `rgb(${hexToRgb(itga.magenta)} / <alpha-value>)`,
        orange:  `rgb(${hexToRgb(itga.orange)} / <alpha-value>)`,
        gold:    `rgb(${hexToRgb(itga.gold)} / <alpha-value>)`,
        navy: {
          DEFAULT: `rgb(${hexToRgb(itga.navy)} / <alpha-value>)`,
          dark:    itga.navyDark,
        },
        red:       `rgb(${hexToRgb(itga.red)} / <alpha-value>)`,
        "blue-tick": itga.blueTick,

        background:  "rgb(var(--rgb-bg) / <alpha-value>)",
        "bg-light":  "rgb(var(--rgb-bg-light) / <alpha-value>)",
        "bg-dark":   "rgb(var(--rgb-bg-dark) / <alpha-value>)",
        card:        "rgb(var(--rgb-card) / <alpha-value>)",

        "text-main":  "rgb(var(--rgb-text-main) / <alpha-value>)",
        "text-dark":  "rgb(var(--rgb-text-dark) / <alpha-value>)",
        "text-light": "rgb(var(--rgb-text-light) / <alpha-value>)",

        border: {
          DEFAULT: "rgb(var(--rgb-border) / <alpha-value>)",
          light:   "rgb(var(--rgb-border-light) / <alpha-value>)",
        },

        "icon-light": "rgb(var(--rgb-icon-light) / <alpha-value>)",
        "itga-black": itga.black,
      },
      fontFamily: {
        sans: ["var(--font-inter)", "Inter", "system-ui", "-apple-system", "sans-serif"],
      },
      borderRadius: {
        "2xl": "16px",
        "3xl": "24px",
      },
    },
  },
  plugins: [],
};

export default config;
