import antfu from '@antfu/eslint-config'
import nextOnPages from 'eslint-plugin-next-on-pages'

// @ts-check
export default antfu({
  formatters: true,
  react: true,
  typescript: true,
  rules: {
    'no-console': 'off',
  },
  plugins: {
    'next-on-pages': nextOnPages,
  },
})
