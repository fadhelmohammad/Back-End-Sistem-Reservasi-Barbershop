import { FlatCompat } from '@eslint/eslintrc';

const compat = new FlatCompat({
    baseDirectory: __dirname,
});

export default [
    ...compat.extends('eslint:recommended'),
    ...compat.extends('plugin:node/recommended'),
    ...compat.extends('plugin:prettier/recommended'),
    ...compat.plugins('prettier'),
    ...compat.env({
        node: true,
        es2021: true,
    }),
    ...compat.parserOptions({
        ecmaVersion: 12,
        sourceType: 'module',
    }),
    {
        rules: {
            'prettier/prettier': 'error',
            'no-unused-vars': 'warn',
            'no-console': 'off',
            // Tambahkan aturan lain sesuai kebutuhan
        },
    },
];