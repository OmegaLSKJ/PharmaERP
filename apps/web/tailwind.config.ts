import type { Config } from 'tailwindcss'
import baseConfig from '../../tailwind.config.js'

export default {
  ...baseConfig,
  content: ['./app/**/*.{ts,tsx}', '../../src/**/*.{ts,tsx}'],
} satisfies Config
