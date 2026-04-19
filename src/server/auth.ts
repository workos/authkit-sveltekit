import type { RequestEvent } from '@sveltejs/kit';
import { redirect } from '@sveltejs/kit';
import type { createAuthService } from '@workos/authkit-session';
import { OAuthStateMismatchError, PKCECookieMissingError, SessionEncryptionError } from '@workos/authkit-session';
import type { SignInOptions, AuthKitAuth } from '../types.js';
import { applyCookies, appendHeaderBag } from './adapters/cookie-forwarding.js';
import { getRequestEvent } from './adapters/request-context.js';

type AuthKitInstance = ReturnType<typeof createAuthService<Request, Response>>;

/**
 * Create getUser helper
 */
export function createGetUser(_authKitInstance: AuthKitInstance) {
  return async (event: RequestEvent) => {
    const auth = event.locals.auth as AuthKitAuth;
    return auth?.user || null;
  };
}

/**
 * Create getSignInUrl helper.
 *
 * Reads the current `RequestEvent` from the per-request
 * `AsyncLocalStorage` populated by `authKitHandle`, so this function
 * can set the PKCE verifier cookie on `event.cookies` without requiring
 * the caller to pass `event` explicitly. The cookie binds the returned
 * OAuth `state` parameter to the subsequent callback — sending the URL
 * without the cookie will produce a `PKCECookieMissingError` on return.
 */
export function createGetSignInUrl(authKitInstance: AuthKitInstance) {
  return async (options?: SignInOptions): Promise<string> => {
    const event = getRequestEvent();
    const {
      url,
      response: mutated,
      headers,
    } = await authKitInstance.createSignIn(new Response(), {
      returnPathname: options?.returnTo,
      organizationId: options?.organizationId,
      loginHint: options?.loginHint,
    });
    applyCookies(event, mutated, headers);
    return url;
  };
}

/**
 * Create getSignUpUrl helper.
 *
 * See `createGetSignInUrl` for the cookie contract — identical here.
 */
export function createGetSignUpUrl(authKitInstance: AuthKitInstance) {
  return async (options?: SignInOptions): Promise<string> => {
    const event = getRequestEvent();
    const {
      url,
      response: mutated,
      headers,
    } = await authKitInstance.createSignUp(new Response(), {
      returnPathname: options?.returnTo,
      organizationId: options?.organizationId,
      loginHint: options?.loginHint,
    });
    applyCookies(event, mutated, headers);
    return url;
  };
}

/**
 * Create signOut helper
 */
export function createSignOut(authKitInstance: AuthKitInstance) {
  return async (event: RequestEvent) => {
    const auth = event.locals.auth as AuthKitAuth;

    if (!auth?.sessionId) {
      // No session to sign out from, just redirect home
      throw redirect(302, '/');
    }

    // Use authkit-session's signOut method (returns logoutUrl and clear headers)
    const { logoutUrl, headers } = await authKitInstance.signOut(auth.sessionId);

    // Create response with redirect to WorkOS logout URL
    const response = new Response(null, {
      status: 302,
      headers: {
        Location: logoutUrl,
      },
    });

    // Apply session clear headers — must append every Set-Cookie entry
    // individually, never comma-join (not a valid single HTTP header).
    appendHeaderBag(response.headers, headers);

    return response;
  };
}

/**
 * Create switchOrganization helper
 */
export function createSwitchOrganization(authKitInstance: AuthKitInstance) {
  return async (event: RequestEvent, { organizationId }: { organizationId: string }) => {
    // Get the current session
    const session = await authKitInstance.getSession(event.request);

    if (!session) {
      throw new Error('User must be authenticated to switch organizations');
    }

    // Use authkit-session's switchOrganization method
    const { encryptedSession } = await authKitInstance.switchOrganization(session, organizationId);

    // Save the new session and redirect
    const { headers } = await authKitInstance.saveSession(undefined, encryptedSession);

    // Create response with redirect and session headers
    const response = new Response(null, {
      status: 302,
      headers: {
        Location: event.url.pathname,
      },
    });

    // Apply session headers — must append every Set-Cookie entry
    // individually, never comma-join (not a valid single HTTP header).
    appendHeaderBag(response.headers, headers);

    return response;
  };
}

/**
 * Create handleCallback helper for OAuth callback.
 *
 * Reads the PKCE verifier cookie via the storage adapter, passes it to
 * `authkit-session` so the sealed state can be byte-compared before
 * decryption, and clears the cookie on EVERY exit path (success,
 * OAuth-provider error, state mismatch, missing cookie, encryption
 * failure) so a stuck verifier never bleeds into the next sign-in.
 *
 * The returned `Response` is constructed manually (not via SvelteKit's
 * throwing `redirect()`) so `Set-Cookie` headers for the verifier
 * delete attach cleanly to the redirect itself.
 */
export function createHandleCallback(authKitInstance: AuthKitInstance) {
  return () => {
    return async (event: RequestEvent): Promise<Response> => {
      const { url, request } = event;
      const code = url.searchParams.get('code');
      const state = url.searchParams.get('state') || undefined;
      const oauthError = url.searchParams.get('error');

      // Build an error-redirect Response carrying `clearPendingVerifier`'s
      // Set-Cookie. Using a manual Response instead of `redirect()` keeps
      // the verifier-delete attached to this exact response.
      const bail = async (errCode: string, status: 302 | 303 | 307 | 308 = 302): Promise<Response> => {
        const { headers: deleteHeaders } = await authKitInstance.clearPendingVerifier(new Response());
        const response = new Response(null, {
          status,
          headers: { Location: `/auth/error?code=${errCode}` },
        });
        appendHeaderBag(response.headers, deleteHeaders);
        return response;
      };

      if (oauthError) {
        console.error('OAuth error:', oauthError);
        return bail(oauthError === 'access_denied' ? 'ACCESS_DENIED' : 'AUTH_ERROR');
      }

      if (!code) {
        return bail('AUTH_FAILED');
      }

      try {
        const result = await authKitInstance.handleCallback(request, new Response(), {
          code,
          state,
        });

        // authkit-session guarantees `returnPathname` is a safe same-origin
        // relative path (CWE-601 protection lives at the library boundary,
        // see @workos/authkit-session). Emitting it as-is keeps the
        // Location relative, which is also the correct behavior behind
        // proxies that don't reconstruct `event.url`'s origin.
        const response = new Response(null, {
          status: 302,
          headers: {
            Location: result.returnPathname,
          },
        });

        // Forward Set-Cookie headers — append each, never set-collapse.
        if (result.response) {
          result.response.headers.forEach((value: string, key: string) => {
            response.headers.append(key, value);
          });
        }
        appendHeaderBag(response.headers, result.headers);

        return response;
      } catch (err) {
        console.error('Authentication error:', err);
        const errCode =
          err instanceof OAuthStateMismatchError
            ? 'STATE_MISMATCH'
            : err instanceof PKCECookieMissingError
              ? 'PKCE_COOKIE_MISSING'
              : err instanceof SessionEncryptionError
                ? 'SESSION_ENCRYPTION_FAILED'
                : 'AUTH_FAILED';
        return bail(errCode);
      }
    };
  };
}

/**
 * Create refreshSession helper
 * Note: Session refresh is handled automatically by authkit-session
 */
export function createRefreshSession(_authKitInstance: AuthKitInstance) {
  return async (_event: RequestEvent) => {
    // Session refresh is handled automatically by withAuth
    // This is a no-op but kept for API compatibility
    return true;
  };
}
