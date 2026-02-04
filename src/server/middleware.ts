import type { RequestEvent } from '@sveltejs/kit';
import { redirect } from '@sveltejs/kit';
import type { createAuthService } from '@workos/authkit-session';
import type { AuthenticatedHandler, AuthKitAuth } from '../types.js';

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
        // Get the sign-in URL with return path
        const signInUrl = await authKitInstance.getSignInUrl({
          returnPathname: event.url.pathname,
        });

        // Redirect to sign-in
        throw redirect(302, signInUrl);
      }

      // User is authenticated, call the handler with auth context
      return handler({
        ...event,
        auth: auth as Required<AuthKitAuth>,
      });
    };
  };
}
