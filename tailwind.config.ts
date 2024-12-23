import type { Config } from 'tailwindcss'

const tailwindConfig = {
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

      // Custom Backgrounds
      backgroundImage: {
        'magical-gradient': 'linear-gradient(to right, #9c4dcc, #6a1b9a)',
      },

      // Custom Shadows (example)
      boxShadow: {
        glow: '0 0 8px rgba(255, 255, 255, 0.5)',
      },

      // Custom Fonts
      fontFamily: {
        magical: ['serif'], // Replace with your chosen font
      },

      // Keyframes
      keyframes: {
        'creepy-text': {
          '0%': { transform: 'translateY(0)', opacity: '1' },
          '50%': { transform: 'translateY(-5px)', opacity: '0.5' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        'eye-shine': {
          '0%, 90%, 100%': { opacity: '1' },
          '95%': { opacity: '0.1' },
        },
        'fade-in': {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        'fade-in-up': {
          '0%': { opacity: '0', transform: 'translateY(10px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'flicker': {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.5' },
        },
        'float': {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-5px)' },
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
        'magical-glow': {
          '0%, 100%': {
            'text-shadow':
              '0 0 4px rgb(255,255,255,0.1), 0 0 8px rgb(255,255,255,0.1), 0 0 12px rgb(255,255,255,0.1)',
          },
          '50%': {
            'text-shadow':
              '0 0 8px rgb(255,255,255,0.2), 0 0 16px rgb(255,255,255,0.2), 0 0 20px rgb(255,255,255,0.2)',
          },
        },
        'pupil': {
          '0%, 100%': { transform: 'translateX(0)' },
          '15%': { transform: 'translateX(-1px)' },
          '85%': { transform: 'translateX(1px)' },
        },
        'pulse': {
          '0%, 100%': { transform: 'scale(1)' },
          '50%': { transform: 'scale(1.05)' },
        },
        'sparkle': {
          '0%, 100%': { opacity: '0.2', transform: 'scale(1)' },
          '50%': { opacity: '1', transform: 'scale(1.2)' },
        },
        'spooky-shake': {
          '0%, 100%': { transform: 'translateX(0)' },
          '25%': { transform: 'translateX(-5px)' },
          '50%': { transform: 'translateX(5px)' },
          '75%': { transform: 'translateX(-5px)' },
        },
      },

      // Animations
      animation: {
        'creepy-text': 'creepy-text 2s ease-in-out infinite',
        'eye-shine': 'eye-shine 3s infinite',
        'fade-in': 'fade-in 1s ease-in-out',
        'fade-in-up': 'fade-in-up 1s ease-in-out',
        'flicker': 'flicker 1s ease-in-out infinite',
        'float': 'float 3s ease-in-out infinite',
        'float-ghost': 'float-ghost 4s ease-in-out infinite',
        'ghost': 'ghost 3s ease-in-out infinite',
        'magical-glow': 'magical-glow 3s ease-in-out infinite',
        'pupil': 'pupil 3s infinite',
        'pulse': 'pulse 1s ease-in-out infinite',
        'sparkle': 'sparkle 2s ease-in-out infinite',
        'spooky-shake': 'spooky-shake 1s ease-in-out infinite',
        'spin-slow': 'spin 20s linear infinite',
      },

      // Transition Delays
      transitionDelay: {
        200: '200ms',
        500: '500ms',
      },
    },
  },
  plugins: [
  ],
} satisfies Config

export default tailwindConfig
