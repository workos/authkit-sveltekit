import type { Handle, RequestEvent } from '@sveltejs/kit';
import type { AuthKitHandleOptions, AuthKitAuth } from './types.js';

/**
 * Creates a SvelteKit handle function for AuthKit
 * Automatically manages sessions and populates event.locals.auth
 */
export function createAuthKitHandle(
  authKitInstance: any
): (options?: AuthKitHandleOptions) => Handle {
  return (options?: AuthKitHandleOptions) => {
    const { debug = false, onError } = options || {};

    return async ({ event, resolve }) => {
      try {
        // Log debug info
        if (debug) {
          console.log('[AuthKit] Processing request:', event.url.pathname);
        }

        // Get authentication info for this request
        const authResult = await authKitInstance.withAuth(event.request);
        
        // Populate locals with auth data
        event.locals.auth = {
          user: authResult.user || null,
          organization: authResult.claims?.org_id ? { id: authResult.claims.org_id } : null,
          role: authResult.claims?.role || null,
          permissions: authResult.claims?.permissions || [],
          sessionId: authResult.sessionId,
          impersonator: authResult.impersonator || null,
          accessToken: authResult.accessToken
        } as AuthKitAuth;

        if (debug && authResult.user) {
          console.log('[AuthKit] User authenticated:', authResult.user.email);
        }

        // Continue with the request
        const response = await resolve(event);

        // Handle session refresh if needed
        if (authResult.refreshToken && authResult.accessToken) {
          // Session was refreshed, save the new session
          return await authKitInstance.saveSession(
            response,
            await authKitInstance.sealData(
              {
                accessToken: authResult.accessToken,
                refreshToken: authResult.refreshToken,
                user: authResult.user,
                impersonator: authResult.impersonator
              },
              { password: process.env.WORKOS_COOKIE_PASSWORD! }
            )
          );
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
        event.locals.auth = {
          user: null,
          organization: null,
          role: null,
          permissions: [],
          sessionId: undefined,
          impersonator: null
        } as AuthKitAuth;

        return resolve(event);
      }
    };
  };
}