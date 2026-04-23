import type { RequestEvent } from '@sveltejs/kit';
import { redirect } from '@sveltejs/kit';
import type { createAuthService } from '@workos/authkit-session';
import type { AuthenticatedHandler, AuthKitAuth } from '../types.js';
import { applyCookies } from './adapters/cookie-forwarding.js';
import { isDocumentRequest } from './adapters/isDocumentRequest.js';

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

      if (!auth?.user) {
        if (isDocumentRequest(event.request.headers)) {
          // Mint sign-in URL + verifier cookie together so the redirect
          // SvelteKit emits for the thrown `redirect(302, url)` already
          // carries the cookie that binds the OAuth `state`.
          const { url, response, headers } = await authKitInstance.createSignIn(new Response(), {
            returnPathname: event.url.pathname,
          });
          applyCookies(event, response, headers);
          throw redirect(302, url);
        }

        // Non-document request (fetch/XHR/RSC/prefetch). Browsers won't
        // follow the cross-origin redirect to WorkOS from these, so a PKCE
        // cookie write is wasted and — under per-flow naming — contributes
        // to cookie-header bloat. The next real navigation from this client
        // hits this branch with isDocumentRequest === true and gets the
        // cookie then.
        const { url } = await authKitInstance.getSignInUrl({
          returnPathname: event.url.pathname,
        });
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
