import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm', 'cjs'],
  dts: true,
  splitting: false,
  sourcemap: true,
  clean: true,
  treeshake: true,
  // Preserve the `node:` namespace in published output instead of rewriting
  // it to a bare builtin import like `async_hooks`.
  removeNodeProtocol: false,
  noExternal: ['@workos/authkit-session', 'cookie'],
});
