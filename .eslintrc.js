module.exports = {
  root: true,

  env: {
    browser: false,
    node: true,
  },

  plugins: ['node'],

  extends: [
    'eslint:recommended',
    'plugin:prettier/recommended',
    'plugin:node/recommended',
  ],

  rules: {},

  overrides: [],
};
