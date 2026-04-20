import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    alias: {
      // `$app/server` is a SvelteKit-resolved virtual module at runtime.
      // Tests that care override it with `vi.mock('$app/server', ...)`.
      '$app/server': fileURLToPath(new URL('./src/tests/stubs/app-server.ts', import.meta.url)),
    },
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: ['node_modules/', 'dist/'],
    },
  },
});
