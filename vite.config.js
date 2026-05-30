import { defineConfig } from 'vite';
import wasm from 'vite-plugin-wasm';
import topLevelAwait from 'vite-plugin-top-level-await';

// A GitHub Pages project site is served from /<repo>/, so the asset base must
// match the repo name. Derive it from GITHUB_REPOSITORY (owner/repo) in CI so
// this keeps working across forks/renames; fall back to '/' for local dev and
// `vite preview`.
const repo = process.env.GITHUB_REPOSITORY?.split('/')[1];

export default defineConfig({
  base: process.env.GITHUB_ACTIONS && repo ? `/${repo}/` : '/',
  plugins: [wasm(), topLevelAwait()],
  build: { target: 'esnext' },
  optimizeDeps: {
    exclude: ['@matrix-org/matrix-sdk-crypto-wasm'],
  },
});
