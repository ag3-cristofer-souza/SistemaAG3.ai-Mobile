import animate from "tailwindcss-animate";
import type { Config } from "tailwindcss";

const token = (name: string) => `hsl(var(--${name}))`;
const pair = (name: string) => ({
  DEFAULT: token(name),
  foreground: token(`${name}-foreground`),
});

// Mesmos nomes de cor do painel (SistemaAG3.ai-Frontend/tailwind.config.ts).
export default {
  darkMode: ["class"],
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        border: token("border"),
        input: token("input"),
        ring: token("ring"),
        background: token("background"),
        foreground: token("foreground"),
        primary: pair("primary"),
        secondary: pair("secondary"),
        destructive: pair("destructive"),
        success: pair("success"),
        warning: pair("warning"),
        muted: pair("muted"),
        accent: pair("accent"),
        card: pair("card"),
        brand: pair("brand"),
        chat: token("chat"),
        "bubble-out": token("bubble-out"),
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      boxShadow: {
        card: "0 1px 2px rgb(16 24 40 / 0.05), 0 1px 3px rgb(16 24 40 / 0.06)",
        float: "0 6px 20px rgb(16 24 40 / 0.12)",
      },
      spacing: {
        "safe-top": "env(safe-area-inset-top)",
        "safe-bottom": "env(safe-area-inset-bottom)",
      },
    },
  },
  plugins: [animate],
} satisfies Config;
