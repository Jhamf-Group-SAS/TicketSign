/** @type {import('tailwindcss').Config} */
export default {
    darkMode: 'class',
    content: [
        "./index.html",
        "./src/**/*.{js,ts,jsx,tsx}",
    ],
    theme: {
        extend: {
            fontFamily: {
                sans: ['Inter', 'system-ui', 'sans-serif'],
                display: ['Inter', 'system-ui', 'sans-serif'],
            },
            boxShadow: {
                'sm': '0 1px 3px rgba(0,0,0,.07)',
                'md': '0 4px 12px rgba(0,0,0,.09)',
                'primary': '0 2px 8px rgba(6,149,196,.35)',
                'glow': '0 0 15px -3px rgba(6, 149, 196, 0.3)',
                'focus': '0 0 0 3px rgba(6,149,196,.12)',
                'premium': '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
            },
            backgroundImage: {
                'gradient-primary': 'linear-gradient(135deg, #0695c4, #0578a0)',
            },
            borderRadius: {
                'xl': '12px',
                '2xl': '16px',
            },
            colors: {
                primary: {
                    50: 'var(--primary-50)',
                    100: '#E0F2FE',
                    200: '#BAE6FD',
                    300: '#7DD3FC',
                    400: '#38BDF8',
                    500: '#0695c4', // Base corporate color
                    600: '#0578a0',
                    700: '#0369A1',
                    800: '#075985',
                    900: '#0C4A6E',
                    950: '#082F49',
                    DEFAULT: 'var(--bg-primary)',
                },
                secondary: {
                    DEFAULT: 'var(--bg-secondary)',
                },
                tertiary: {
                    DEFAULT: 'var(--bg-tertiary)',
                },
                color: {
                    DEFAULT: 'rgb(var(--border-rgb) / <alpha-value>)',
                },
                text: {
                    primary: 'var(--text-primary)',
                    secondary: 'var(--text-secondary)',
                    muted: 'var(--text-muted)',
                },
                slate: {
                    50: 'var(--neutral-50)',
                    100: 'var(--neutral-100)',
                    200: 'var(--neutral-200)',
                    300: '#CBD5E1',
                    400: '#94A3B8',
                    500: '#64748B',
                    600: '#475569',
                    700: '#334155',
                    800: '#1e293b',
                    900: '#0F172A',
                    950: '#0B1220',
                },
                success: '#22c55e',
                warning: '#f59e0b',
                danger: '#ef4444',
                orange: {
                    500: '#f97316'
                },
                purple: {
                    500: '#8b5cf6'
                }
            },
            spacing: {
                '18': '4.5rem',
                '72': '18rem',
            }
        },
    },
    plugins: [],
}
