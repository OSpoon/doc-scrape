import antfu from '@antfu/eslint-config'

export default antfu({
  react: true,
  typescript: true,
  ignores: [
    'dist',
    'node_modules',
    'extension-env.d.ts',
  ],
  rules: {
    'antfu/top-level-function': 'off',
    'no-console': 'off',
    'node/prefer-global/process': 'off',
    'react-refresh/only-export-components': 'off',
    'ts/no-use-before-define': 'off',
  },
})
