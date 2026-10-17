/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: ['class', '[data-theme="dark"]'],
  content: [
    "./src/**/*.{html,ts}",
  ],
  theme: {
    extend: {
      colors: {
        app: 'var(--bg-app)',
        surface: {
          DEFAULT: 'var(--bg-surface)',
          elevated: 'var(--bg-surface-elevated)',
          hover: 'var(--bg-surface-hover)',
        },
        border: {
          subtle: 'var(--border-subtle)',
          focus: 'var(--border-focus)',
        },
        content: {
          primary: 'var(--text-primary)',
          secondary: 'var(--text-secondary)',
          muted: 'var(--text-muted)',
        },
        badge: {
          high: {
            bg: 'var(--badge-high-bg)',
            text: 'var(--badge-high-text)',
          },
          med: {
            bg: 'var(--badge-med-bg)',
            text: 'var(--badge-med-text)',
          },
          low: {
            bg: 'var(--badge-low-bg)',
            text: 'var(--badge-low-text)',
          },
        },
        brand: {
          primary: 'var(--brand-primary)',
          hover: 'var(--brand-hover)',
        }
      },
      fontFamily: {
        sans: ['Inter', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif'],
        mono: ['JetBrains Mono', 'Menlo', 'Monaco', 'Consolas', 'Courier New', 'monospace'],
      }
    },
  },
  plugins: [],
}
