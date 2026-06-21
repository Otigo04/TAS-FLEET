import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './lib/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        surface: '#ffffff',
        ink: '#0b1220',
        muted: '#51607a',
        accent: {
          DEFAULT: '#059669',
          600: '#047857',
        },
        teal: {
          accent: '#0d9488',
        },
      },
      boxShadow: {
        card: '0 1px 2px rgba(11,18,32,0.04), 0 12px 32px -22px rgba(11,18,32,0.45)',
        'card-hover': '0 1px 2px rgba(11,18,32,0.05), 0 20px 44px -24px rgba(11,18,32,0.5)',
      },
      keyframes: {
        marquee: {
          '0%': { transform: 'translateX(0%)' },
          '100%': { transform: 'translateX(-50%)' },
        },
        fadeUp: {
          from: { opacity: '0', transform: 'translateY(10px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        scaleIn: {
          from: { opacity: '0', transform: 'scale(0.96)' },
          to: { opacity: '1', transform: 'scale(1)' },
        },
      },
      animation: {
        marquee: 'marquee 25s linear infinite',
        'fade-up': 'fadeUp 0.45s cubic-bezier(0.22,1,0.36,1) both',
        'scale-in': 'scaleIn 0.3s cubic-bezier(0.22,1,0.36,1) both',
      },
    },
  },
  plugins: [],
}

export default config
