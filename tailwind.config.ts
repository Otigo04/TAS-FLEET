import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './lib/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    screens: {
      xs: '480px',
      sm: '640px',
      md: '768px',
      lg: '1024px',
      xl: '1280px',
      '2xl': '1536px',
    },
    extend: {
      colors: {
        surface: '#ffffff',
        ink: '#0f172a',
        muted: '#64748b',
        // Eine einzige, ruhige Corporate-Grün-Skala. emerald & teal werden
        // bewusst auf dieselbe Skala gelegt, damit Alt-Verläufe (from-emerald
        // → to-teal) flach erscheinen und der frühere Mehrfarb-Look verschwindet.
        accent: {
          DEFAULT: '#2f6a45',
          600: '#2f6a45',
          700: '#285639',
        },
        brand: {
          50: '#f1f6f3',
          100: '#dceae1',
          200: '#bcd6c6',
          300: '#93bca4',
          400: '#639d7d',
          500: '#437d5e',
          600: '#2f6a45',
          700: '#285639',
          800: '#234630',
          900: '#1e3a29',
        },
        emerald: {
          50: '#f1f6f3',
          100: '#dceae1',
          200: '#bcd6c6',
          300: '#93bca4',
          400: '#639d7d',
          500: '#437d5e',
          600: '#2f6a45',
          700: '#285639',
          800: '#234630',
          900: '#1e3a29',
        },
        teal: {
          accent: '#2f6a45',
          50: '#f1f6f3',
          100: '#dceae1',
          200: '#bcd6c6',
          300: '#93bca4',
          400: '#639d7d',
          500: '#437d5e',
          600: '#2f6a45',
          700: '#285639',
          800: '#234630',
          900: '#1e3a29',
        },
      },
      boxShadow: {
        card: '0 1px 2px rgba(15,23,42,0.05)',
        'card-hover': '0 1px 3px rgba(15,23,42,0.08)',
      },
      keyframes: {
        marquee: {
          '0%': { transform: 'translateX(0%)' },
          '100%': { transform: 'translateX(-50%)' },
        },
        fadeUp: {
          from: { opacity: '0', transform: 'translateY(4px)' },
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
