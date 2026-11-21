/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './lib/**/*.{js,ts,jsx,tsx,mdx}'
  ],
  theme: {
    extend: {
      colors: {
        canvas: '#FEF9EE',
        surface: '#FFFFFF',
        border: '#E7E2D8',
        ink: '#14201B',
        muted: '#5E6B64',
        faint: '#8A948E',
        primary: {
          DEFAULT: '#0E5A44',
          hover: '#0A4936',
          tint: '#E6F2EC'
        },
        accent: {
          saffron: '#E8890C',
          tint: '#FDF1DD'
        },
        danger: {
          DEFAULT: '#C0392B',
          tint: '#FBEAE7'
        },
        success: {
          DEFAULT: '#1B7F5C',
          tint: '#E6F2EC'
        },
        cat: {
          food: '#E8890C',
          groceries: '#5B8C3A',
          transport: '#3A6EA5',
          shopping: '#B04A7A',
          bills: '#6B6F7A',
          rent: '#8C5A3C',
          subscriptions: '#7A4FB0',
          health: '#C0392B',
          entertainment: '#D0A100',
          travel: '#1E8A8A',
          education: '#4A5FC1',
          income: '#1B7F5C',
          transfers: '#8A948E',
          other: '#A39E93'
        }
      },
      borderRadius: {
        card: '14px',
        control: '10px'
      },
      boxShadow: {
        card: '0 1px 2px rgba(20, 32, 27, 0.06)',
        lift: '0 4px 12px rgba(20, 32, 27, 0.08)'
      },
      fontFamily: {
        sans: ['var(--font-inter)', 'Inter', 'system-ui', 'sans-serif'],
        serif: ['var(--font-fraunces)', 'Fraunces', 'serif'],
        inter: ['var(--font-inter)', 'Inter', 'sans-serif'],
        fraunces: ['var(--font-fraunces)', 'Fraunces', 'serif']
      }
    }
  },
  plugins: []
};
