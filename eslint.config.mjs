import globals from 'globals'
import {
  configs as standard
} from '@sequencemedia/eslint-config-standard'

export default [
  {
    ...standard.recommended,
    files: [
      '**/*.{mjs,cjs,mts,cts}'
    ],
    ignores: [
      'test'
    ],
    languageOptions: {
      ...standard.recommended.languageOptions,
      globals: {
        ...globals.node
      }
    }
  },
  {
    ...standard.recommended,
    files: [
      'test/**/*.{mjs,cjs}'
    ],
    languageOptions: {
      ...standard.recommended.languageOptions,
      globals: {
        ...globals.mocha
      }
    },
    rules: {
      'no-unused-expressions': 'off'
    }
  }
]
