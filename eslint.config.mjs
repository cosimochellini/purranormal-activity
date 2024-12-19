import antfu from '@antfu/eslint-config'
// @ts-check
export default antfu({
  formatters: true,
  react: true,
  typescript: true,
  rules: {
    'no-console': 'off',
  },
})
