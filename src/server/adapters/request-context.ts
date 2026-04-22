import { AsyncLocalStorage } from 'node:async_hooks';
import type { RequestEvent } from '@sveltejs/kit';

/**
 * Per-request store populated by `authKitHandle` at the top of the SvelteKit
 * handle chain. Internal helpers (`getSignInUrl`, `getSignUpUrl`) read the
 * current `RequestEvent` from here so the public API doesn't need to thread
 * it through every call site.
 *
 * We deliberately don't use `$app/server`'s `getRequestEvent` here because
 * `$app/*` is a SvelteKit virtual module that only exists inside the
 * consumer's build. When this package is externalized for SSR, leaving that
 * import in the published output can fail module resolution before any auth
 * code runs. Vendoring the request-context helper avoids that packaging issue.
 *
 * This is a slightly tighter runtime contract than SvelteKit's helper:
 * SvelteKit dynamically loads `AsyncLocalStorage` and falls back to a
 * synchronous store when ALS is unavailable, while this package requires ALS
 * to exist when the module is evaluated.
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
