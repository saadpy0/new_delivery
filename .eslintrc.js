module.exports = {
  root: true,
  extends: '@react-native',
  ignorePatterns: ['_pre_rn_backup/**', 'vendor/**'],
  rules: {
    'no-void': 'off',
    'react-hooks/exhaustive-deps': 'off',
    'react-native/no-inline-styles': 'off',
    'no-extra-boolean-cast': 'off',
    '@typescript-eslint/no-unused-vars': 'off',
    'no-bitwise': 'off',
  },
  overrides: [
    {
      files: ['jest.setup.js', '**/*.test.ts', '**/*.test.tsx'],
      env: {
        jest: true,
      },
    },
  ],
};
