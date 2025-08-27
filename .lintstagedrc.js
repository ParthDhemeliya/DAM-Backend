module.exports = {
  // Lint and format TypeScript files
  '**/*.{ts,tsx}': ['eslint --fix', 'prettier --write'],
  // Format JavaScript files
  '**/*.{js,jsx}': ['eslint --fix', 'prettier --write'],
  // Format JSON, Markdown, and other files
  '**/*.{json,md,yml,yaml}': ['prettier --write'],
};
