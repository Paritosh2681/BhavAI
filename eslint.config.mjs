import tseslint from 'typescript-eslint';

export default tseslint.config(
  {
    ignores: [
      '**/dist/**',
      '**/node_modules/**',
      'data/**',
      'scripts/**',
      '.agents/**',
    ],
  },
  ...tseslint.configs.recommended,
  {
    plugins: {
      'react-hooks': {
        rules: {
          'exhaustive-deps': { create: () => ({}) },
        },
      },
    },
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-namespace': 'off',
      '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
    },
  },
);

