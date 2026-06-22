/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        background: {
          light: '#F8FAFC',
          dark: '#0F172A',
        },
        surface: {
          light: '#FFFFFF',
          dark: '#1E293B',
        },
        primary: '#2563EB',
        secondary: '#6366F1',
        success: '#10B981',
        accent: '#8B5CF6',
        border: {
          light: '#E5E7EB',
          dark: '#334155',
        },
        text: {
          primary: {
            light: '#111827',
            dark: '#F9FAFB',
          },
          secondary: {
            light: '#6B7280',
            dark: '#9CA3AF',
          }
        }
      },
      fontFamily: {
        sans: ['Inter', 'sans-serif'],
      },
      boxShadow: {
        premium: '0 4px 30px rgba(0, 0, 0, 0.03)',
        'premium-hover': '0 10px 40px rgba(0, 0, 0, 0.08)',
        glass: '0 8px 32px 0 rgba(31, 38, 135, 0.07)',
      },
      backdropBlur: {
        xs: '2px',
      }
    },
  },
  plugins: [],
}
