import type { Handle } from '@sveltejs/kit';
import type { AuthKitHandleOptions, AuthKitAuth } from './types.js';
import type { createAuthService, AuthResult } from '@workos/authkit-session';
import { configureAuthKit } from './config.js';
import { appendHeaderBag } from './server/adapters/cookie-forwarding.js';
import { runWithRequestEvent } from './server/adapters/request-context.js';

type AuthKitInstance = ReturnType<typeof createAuthService<Request, Response>>;

function createAuthKitAuth(authResult: AuthResult): AuthKitAuth {
  if (!authResult.user) {
    return createEmptyAuth();
  }

  return {
    user: authResult.user,
    organizationId: authResult.claims?.org_id || null,
    role: authResult.claims?.role || null,
    permissions: authResult.claims?.permissions || [],
    sessionId: authResult.sessionId,
    impersonator: authResult.impersonator || null,
    accessToken: authResult.accessToken,
  };
}

function createEmptyAuth(): AuthKitAuth {
  return {
    user: null,
    organizationId: null,
    role: null,
    permissions: [],
    sessionId: undefined,
    impersonator: null,
  };
}

export function createAuthKitHandle(authKitInstance: AuthKitInstance): (options?: AuthKitHandleOptions) => Handle {
  return (options?: AuthKitHandleOptions) => {
    const { debug = false, onError, config } = options || {};

    // Apply any per-call override once at factory time — not inside the
    // request loop. `authKitHandle()` is typically invoked once per app
    // startup, so this runs exactly once.
    if (config) {
      configureAuthKit(config);
    }

    // Wrap the handle body in the per-request store so internal helpers
    // (getSignInUrl, getSignUpUrl) can read the current `RequestEvent` via
    // `getRequestEvent()` without the public API threading `event` through
    // every call site. Store is scoped to this request; subsequent hooks and
    // the final resolve() all see the same event.
    return async ({ event, resolve }) =>
      runWithRequestEvent(event, async () => {
        try {
          if (debug) {
            console.log('[AuthKit] Processing request:', event.url.pathname);
          }

          const { auth: authResult, refreshedSessionData } = await authKitInstance.withAuth(event.request);

          event.locals.auth = createAuthKitAuth(authResult);

          if (debug && authResult.user) {
            console.log('[AuthKit] User authenticated:', authResult.user.email);
          }

          const response = await resolve(event);

          if (refreshedSessionData) {
            const { headers } = await authKitInstance.saveSession(undefined, refreshedSessionData);
            appendHeaderBag(response.headers, headers);
          }

          return response;
        } catch (error) {
          if (debug) {
            console.error('[AuthKit] Error in handle:', error);
          }

          if (onError) {
            onError(error as Error);
          }

          event.locals.auth = createEmptyAuth();

          return resolve(event);
        }
      });
  };
}
