import { AsyncLocalStorage } from 'node:async_hooks';
import type { RequestEvent } from '@sveltejs/kit';

/**
 * Per-request store populated by `authKitHandle` at the top of the
 * SvelteKit handle chain. Internal helpers (`getSignInUrl`,
 * `getSignUpUrl`) read the current `RequestEvent` from here so the
 * public API doesn't need to thread it through every call site — users
 * keep `authKit.getSignInUrl(options)` while the SDK still sets the
 * PKCE verifier cookie on `event.cookies` under the hood.
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
