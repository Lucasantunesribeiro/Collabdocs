/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        surface: '#1c1b1f',
        'surface-lowest': '#131218',
        'surface-low': '#1e1b26',
        'surface-container': '#221f29',
        'surface-high': '#2d2a33',
        'surface-highest': '#38353f',
        'on-surface': '#e6e1e5',
        'on-surface-variant': '#cac4d0',
        primary: '#335cff',
        'primary-dark': '#003fe5',
        'primary-container': '#001a71',
        'on-primary': '#ffffff',
        secondary: '#cbc2ff',
        'secondary-container': '#4a4279',
        'on-secondary': '#ffffff',
        outline: 'rgba(255,255,255,0.2)',
        'outline-variant': 'rgba(255,255,255,0.12)',
        error: '#f2b8b5',
        'error-container': '#8c1d18',
        success: '#6ef2a6',
        tertiary: '#efb8c8',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        display: ['Manrope', 'Inter', 'system-ui', 'sans-serif'],
      },
      backgroundImage: {
        'primary-gradient': 'linear-gradient(135deg, #003fe5, #335cff)',
        'surface-gradient': 'linear-gradient(135deg, rgba(51,92,255,0.15), rgba(203,194,255,0.05))',
      },
      backdropBlur: {
        glass: '20px',
      },
      animation: {
        'fade-in': 'fadeIn 0.3s ease-out',
        'slide-up': 'slideUp 0.4s cubic-bezier(0.16,1,0.3,1)',
        'sheet-up': 'sheetUp 0.4s cubic-bezier(0.16,1,0.3,1)',
      },
      keyframes: {
        fadeIn: { '0%': { opacity: '0' }, '100%': { opacity: '1' } },
        slideUp: { '0%': { opacity: '0', transform: 'translateY(16px)' }, '100%': { opacity: '1', transform: 'translateY(0)' } },
        sheetUp: { '0%': { transform: 'translateY(100%)' }, '100%': { transform: 'translateY(0)' } },
      },
    },
  },
  plugins: [],
}
