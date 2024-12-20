import type { Config } from 'tailwindcss'

export default {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        'deep-purple': {
          900: '#1a1025',
          800: '#2D1B69',
        },
        'ghost-white': '#F8F8FF',
        'magical-glow': '#f0c4ff',
      },
      backgroundImage: {
        'magical-gradient': 'linear-gradient(to right, #9c4dcc, #6a1b9a)',
      },
      fontFamily: {
        magical: ['your-magical-font', 'serif'], // Replace with your chosen font
      },
      keyframes: {
        'float': {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-5px)' },
        },
        'eye-shine': {
          '0%, 90%, 100%': { opacity: '1' },
          '95%': { opacity: '0.1' },
        },
        'pupil': {
          '0%, 100%': { transform: 'translateX(0)' },
          '15%': { transform: 'translateX(-1px)' },
          '85%': { transform: 'translateX(1px)' },
        },
        'float-ghost': {
          '0%, 100%': {
            transform: 'translateY(0) translateX(0) rotate(0deg)',
            textShadow: '0 0 8px rgba(255, 255, 255, 0.5)',
          },
          '25%': {
            transform: 'translateY(-4px) translateX(2px) rotate(0.5deg)',
            textShadow: '0 0 12px rgba(255, 255, 255, 0.6)',
          },
          '75%': {
            transform: 'translateY(4px) translateX(-2px) rotate(-0.5deg)',
            textShadow: '0 0 6px rgba(255, 255, 255, 0.4)',
          },
        },
        'magical-glow': {
          '0%, 100%': {
            'text-shadow': '0 0 4px rgb(255,255,255,0.1), 0 0 8px rgb(255,255,255,0.1), 0 0 12px rgb(255,255,255,0.1)',
          },
          '50%': {
            'text-shadow': '0 0 8px rgb(255,255,255,0.2), 0 0 16px rgb(255,255,255,0.2), 0 0 20px rgb(255,255,255,0.2)',
          },
        },
        'ghost': {
          '0%, 100%': {
            opacity: '0.7',
            filter: 'blur(0.5px)',
          },
          '50%': {
            opacity: '0.9',
            filter: 'blur(0)',
          },
        },
        'sparkle': {
          '0%, 100%': { opacity: '0.2', transform: 'scale(1)' },
          '50%': { opacity: '1', transform: 'scale(1.2)' },
        },
      },
      animation: {
        'float': 'float 3s ease-in-out infinite',
        'eye-shine': 'eye-shine 3s infinite',
        'pupil': 'pupil 3s infinite',
        'float-ghost': 'float-ghost 4s ease-in-out infinite',
        'magical-glow': 'magical-glow 3s ease-in-out infinite',
        'ghost': 'ghost 3s ease-in-out infinite',
        'sparkle': 'sparkle 2s ease-in-out infinite',
      },
      transitionDelay: {
        200: '200ms',
        500: '500ms',
      },
    },
  },
  plugins: [],
} satisfies Config
