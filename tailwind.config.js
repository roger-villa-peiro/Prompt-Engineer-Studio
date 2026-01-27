
/** @type {import('tailwindcss').Config} */
export default {
    content: [
        "./index.html",
        "./*.{js,ts,jsx,tsx}",
        "./components/**/*.{js,ts,jsx,tsx}",
        "./services/**/*.{js,ts,jsx,tsx}",
        "./utils/**/*.{js,ts,jsx,tsx}",
        "./config/**/*.{js,ts,jsx,tsx}",
    ],
    darkMode: 'class',
    theme: {
        extend: {
            colors: {
                // Neon Void Palette
                "background-dark": "#030712", // Deepest Gray/Blue
                "surface-dark": "#111827",    // Gray 900
                "surface-highlight": "#1f2937", // Gray 800

                // Glass variations
                "glass": "rgba(3, 7, 18, 0.7)",
                "glass-border": "rgba(255, 255, 255, 0.08)",
                "glass-hover": "rgba(3, 7, 18, 0.9)",

                // Vibrant Accents
                "primary": "#06b6d4", // Cyan 500 - Main Brand
                "primary-glow": "#22d3ee",
                "secondary": "#3b82f6", // Blue 500

                "neon-cyan": "#06b6d4", // Cyberpunk Cyan
                "neon-amber": "#f59e0b", // Amber 500 (Optimization)
                "neon-pink": "#ec4899", // Pink 500

                // Functional
                "success": "#10b981", // Emerald 500
                "warning": "#f59e0b", // Amber 500
                "danger": "#ef4444",  // Red 500

                // Text
                "text-primary": "#f3f4f6", // Gray 100
                "text-secondary": "#9ca3af", // Gray 400
                "text-tertiary": "#6b7280", // Gray 500
            },
            fontFamily: {
                sans: ['Inter', 'sans-serif'], // Clean body font
                mono: ['JetBrains Mono', 'monospace'],
                display: ['Space Grotesk', 'sans-serif'], // For headers
            },
            boxShadow: {
                'glass': '0 8px 32px 0 rgba(0, 0, 0, 0.5)',
            },
            animation: {
                'shimmer': 'shimmer 2s linear infinite',
            },
            keyframes: {
                shimmer: {
                    '0%': { backgroundPosition: '200% 0' },
                    '100%': { backgroundPosition: '-200% 0' }
                }
            }
        },
    },
    plugins: [],
}
