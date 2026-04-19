import type { RequestEvent } from '@sveltejs/kit';
import { redirect } from '@sveltejs/kit';
import type { createAuthService } from '@workos/authkit-session';
import type { AuthenticatedHandler, AuthKitAuth } from '../types.js';
import { applyCookies } from './adapters/cookie-forwarding.js';

type AuthKitInstance = ReturnType<typeof createAuthService<Request, Response>>;

/**
 * Creates a withAuth middleware function
 * Ensures the user is authenticated before running the handler
 */
export function createWithAuth(authKitInstance: AuthKitInstance) {
  return function withAuth<T>(handler: AuthenticatedHandler<T>): (event: RequestEvent) => Promise<T> {
    return async (event: RequestEvent) => {
      // Get auth from locals (populated by the handle hook)
      const auth = event.locals.auth as AuthKitAuth;

      // Check if user is authenticated
      if (!auth?.user) {
        // Mint the sign-in URL AND its PKCE verifier cookie in one pass
        // so the redirect carries the cookie that binds the OAuth
        // `state`. Cookies applied here are folded into the response
        // that SvelteKit emits for the thrown redirect.
        const {
          url,
          response: mutated,
          headers,
        } = await authKitInstance.createSignIn(new Response(), {
          returnPathname: event.url.pathname,
        });
        applyCookies(event, mutated, headers);

        // Redirect to sign-in
        throw redirect(302, url);
      }

      // User is authenticated, call the handler with auth context
      return handler({
        ...event,
        auth: auth as Required<AuthKitAuth>,
      });
    };
  };
}
