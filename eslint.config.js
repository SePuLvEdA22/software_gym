import js from '@eslint/js'
import tseslint from 'typescript-eslint'
import reactHooks from 'eslint-plugin-react-hooks'
import prettier from 'eslint-config-prettier'

export default tseslint.config(
  { ignores: ['dist', 'out', 'node_modules', '*.config.*'] },
  {
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    files: ['src/**/*.{ts,tsx}'],
    plugins: {
      'react-hooks': reactHooks,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      '@typescript-eslint/no-explicit-any': 'error',
      // ── Reglas promovidas a error (contador en 0 desde Fase 1) ──
      'no-empty': 'error',
      'no-useless-assignment': 'error',
      '@typescript-eslint/no-this-alias': 'error',
      '@typescript-eslint/no-require-imports': 'error',
      'react-hooks/immutability': 'error',
      // ── Deuda conocida: corregir gradualmente junto con tests de UI ──
      'react-hooks/set-state-in-effect': 'warn',
      'react-hooks/static-components': 'warn',
    },
  },
  prettier,
)
