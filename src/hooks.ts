import type { Handle } from '@sveltejs/kit';
import type { AuthKitHandleOptions, AuthKitAuth } from './types.js';
import type { createAuthService, AuthResult } from '@workos/authkit-session';

type AuthKitInstance = ReturnType<typeof createAuthService<Request, Response>>;

/**
 * Create AuthKitAuth object from authkit-session result
 */
function createAuthKitAuth(authResult: AuthResult): AuthKitAuth {
  // AuthResult is a discriminated union - check user first
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

/**
 * Create empty auth state
 */
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

/**
 * Creates a SvelteKit handle function for AuthKit
 * Automatically manages sessions and populates event.locals.auth
 */
export function createAuthKitHandle(authKitInstance: AuthKitInstance): (options?: AuthKitHandleOptions) => Handle {
  return (options?: AuthKitHandleOptions) => {
    const { debug = false, onError, config } = options || {};

    return async ({ event, resolve }) => {
      // If config is provided, reconfigure the instance
      if (config) {
        const { configureAuthKit } = await import('./index.js');
        configureAuthKit(config);
      }
      try {
        // Log debug info
        if (debug) {
          console.log('[AuthKit] Processing request:', event.url.pathname);
        }

        // Get authentication info for this request
        const { auth: authResult, refreshedSessionData } = await authKitInstance.withAuth(event.request);

        // Populate locals with auth data
        event.locals.auth = createAuthKitAuth(authResult);

        if (debug && authResult.user) {
          console.log('[AuthKit] User authenticated:', authResult.user.email);
        }

        // Continue with the request
        const response = await resolve(event);

        // If session was refreshed, save the new session data
        if (refreshedSessionData) {
          const { headers } = await authKitInstance.saveSession(undefined, refreshedSessionData);
          if (headers) {
            Object.entries(headers).forEach(([key, value]) => {
              const headerValue = Array.isArray(value) ? value.join(', ') : value;
              response.headers.set(key, headerValue);
            });
          }
        }

        return response;
      } catch (error) {
        if (debug) {
          console.error('[AuthKit] Error in handle:', error);
        }

        if (onError) {
          onError(error as Error);
        }

        // Set empty auth state on error
        event.locals.auth = createEmptyAuth();

        return resolve(event);
      }
    };
  };
}
