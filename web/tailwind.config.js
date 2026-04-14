/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      /**
       * Tailwind v3 spacing scale omits several values that exist in v4's
       * full 0.25rem grid. These additions make v3 behave equivalently for
       * the values used in the marketing page components:
       *
       *  - 18 (4.5rem)  →  used in `sm:pb-18`  (hero section bottom padding)
       *  - 30 (7.5rem)  →  used in `top-30`    (dishes section background orb)
       */
      spacing: {
        '18': '4.5rem',
        '30': '7.5rem',
      },
      /**
       * Tailwind v3 minWidth does not include the spacing scale by default.
       * In v4, `min-w-{n}` uses spacing automatically.
       *
       *  - 6 (1.5rem)  →  used in `min-w-6`  (cart item-count badge)
       */
      minWidth: {
        '6': '1.5rem',
      },
    },
  },
  plugins: [],
}
