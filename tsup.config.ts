import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm', 'cjs'],
  dts: true,
  splitting: false,
  sourcemap: true,
  clean: true,
  treeshake: true,
  // `$app/server` is a SvelteKit-resolved virtual module in the consumer's
  // Vite build — keep it external, don't try to bundle it.
  external: ['$app/server'],
  noExternal: ['@workos/authkit-session', 'cookie'],
});
