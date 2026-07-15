/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        // SGH Crafts warm earthy palette (legacy numeric scale used by v1)
        // plus v2 semantic tokens (bg/surface/ink/inkMuted/primary/accent/
        // border/success/warning/error) per the showroom-inventory spec.
        brand: {
          50:  '#fdf8f3',
          100: '#f9edd9',
          200: '#f2d9b0',
          300: '#e8be7f',
          400: '#d99e4d',
          500: '#c4822a',
          600: '#a86820',
          700: '#8a5019',
          800: '#6b3d16',
          900: '#4f2d12',
          950: '#2e1809',
          // v2 semantic
          bg:       '#FAF8F4',
          surface:  '#FFFFFF',
          ink:      '#1A1815',
          inkMuted: '#6B6660',
          primary:  '#B8542A',
          accent:   '#9B7B3E',
          border:   '#E8E2D6',
          success:  '#3F6B47',
          warning:  '#C68A2E',
          error:    '#B83A2A',
        },
        wood: {
          50:  '#faf5f0',
          100: '#f0e4d4',
          200: '#ddc7a8',
          300: '#c7a07a',
          400: '#b07d52',
          500: '#96603a',
          600: '#7c4d2e',
          700: '#633c24',
          800: '#4d2e1c',
          900: '#382115',
        },
        sand: {
          50:  '#fefcf8',
          100: '#fdf5e8',
          200: '#f9e8c9',
          300: '#f3d49e',
          400: '#e8b96a',
          500: '#d99c3e',
          600: '#c07d28',
          700: '#9e621e',
          800: '#7c4c18',
          900: '#5c3812',
        },
        // Editorial Craft Palette
        linen: {
          50: '#FCFBF9',
          100: '#FAFAFA', // Main background
          200: '#F2EFE9', // Subtle borders/backgrounds
          300: '#E6E1D8',
          400: '#D4CEBF',
          500: '#C2B9A6',
          900: '#3D3831',
        },
        terracotta: {
          50: '#FDF7F6',
          100: '#FCECE9',
          200: '#F6D5CE',
          300: '#EBB4AA',
          400: '#DD8E81',
          500: '#C96555',
          600: '#A44A3F', // Primary accent
          700: '#873B32',
          800: '#71352E',
          900: '#5F312B',
        },
        espresso: {
          50: '#F6F5F5',
          100: '#EAE8E7',
          200: '#CCC7C5',
          300: '#A69E9A',
          400: '#7C726E',
          500: '#5E5552',
          600: '#48413E',
          700: '#383230',
          800: '#2A2624',
          900: '#2A1E1C', // Main text / headings
          950: '#1A1615',
        },
        sage: {
          50: '#F5F7F5',
          100: '#E6EAE5',
          200: '#CFD7CE',
          300: '#AEC0AC',
          400: '#8A9A86', // Muted success / accents
          500: '#6B7E68',
          600: '#536451',
          700: '#435142',
          800: '#384337',
          900: '#2F382F',
        },
        // Mapped Status colors using the new palette feel
        status: {
          draft:        '#A69E9A', // espresso-300
          pending:      '#C96555', // terracotta-500
          production:   '#6B7E68', // sage-500
          qc:           '#8A9A86', // sage-400
          polish:       '#A44A3F', // terracotta-600
          packaging:    '#7C726E', // espresso-400
          readytoship:  '#536451', // sage-600
          shipped:      '#383230', // espresso-700
          completed:    '#2F382F', // sage-900
          cancelled:    '#873B32', // terracotta-700
        },
      },
      fontFamily: {
        sans: ['Outfit', 'sans-serif'],
        serif: ['"Playfair Display"', 'serif'],
      },
      boxShadow: {
        'card': '0 2px 10px rgba(42, 30, 28, 0.03)',
        'card-hover': '0 10px 30px rgba(42, 30, 28, 0.06)',
      },
    },
  },
  plugins: [],
};
