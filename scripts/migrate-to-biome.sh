#!/bin/bash

# Migrate from ESLint/Prettier to Biome
echo "🔄 Migrating from ESLint/Prettier to Biome..."

# Install Biome
echo "📦 Installing Biome..."
pnpm add -D @biomejs/biome@1.7.0

# Remove ESLint and Prettier
echo "🗑️ Removing ESLint and Prettier dependencies..."
pnpm remove eslint prettier @antfu/eslint-config @eslint-react/eslint-plugin @eslint/eslintrc @eslint/js @next/eslint-plugin-next @unocss/eslint-plugin eslint-config-next eslint-plugin-format eslint-plugin-next-on-pages eslint-plugin-react eslint-plugin-react-hooks eslint-plugin-react-refresh globals typescript-eslint

# Remove ESLint/Prettier config files
echo "🗑️ Removing ESLint/Prettier config files..."
rm -f .eslintrc.js .eslintrc.json eslint.config.js eslint.config.mjs .prettierrc .prettierrc.js .prettierrc.json

# Format the codebase with Biome
echo "✨ Formatting the codebase with Biome..."
npx @biomejs/biome format . --write

# Run Biome linter
echo "🔍 Running Biome linter..."
npx @biomejs/biome check .

echo "✅ Migration completed! You are now using Biome for linting and formatting."
echo "You can now run 'pnpm lint' to lint your code and 'pnpm format' to format it."
