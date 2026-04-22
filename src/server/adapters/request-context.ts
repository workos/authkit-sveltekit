import { AsyncLocalStorage } from 'node:async_hooks';
import type { RequestEvent } from '@sveltejs/kit';

/**
 * Per-request store populated by `authKitHandle` at the top of the SvelteKit
 * handle chain. Internal helpers (`getSignInUrl`, `getSignUpUrl`) read the
 * current `RequestEvent` from here so the public API doesn't need to thread
 * it through every call site.
 *
 * We deliberately don't use `$app/server`'s `getRequestEvent` here: `$app/*`
 * is a SvelteKit-resolved virtual module that only exists inside the
 * consumer's Vite build. When this package is externalized for SSR (the
 * default), Node's native resolver tries to load `$app/server` and throws
 * `ERR_MODULE_NOT_FOUND`. A vendored `AsyncLocalStorage` has no such
 * constraint and publishes cleanly.
 */
const requestEventStore = new AsyncLocalStorage<RequestEvent>();

export function runWithRequestEvent<T>(event: RequestEvent, fn: () => T): T {
  return requestEventStore.run(event, fn);
}

export function getRequestEvent(): RequestEvent {
  const event = requestEventStore.getStore();
  if (!event) {
    throw new Error(
      '[authkit-sveltekit] No active request context. Call this from inside a SvelteKit request (route handler, server load, action, endpoint) after registering `authKitHandle()` in hooks.server.ts.',
    );
  }
  return event;
}
