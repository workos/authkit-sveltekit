import type { RequestEvent } from '@sveltejs/kit';
import { redirect } from '@sveltejs/kit';
import type { createAuthService } from '@workos/authkit-session';
import { OAuthStateMismatchError, PKCECookieMissingError, SessionEncryptionError } from '@workos/authkit-session';
import type { SignInOptions, AuthKitAuth } from '../types.js';
import { deletePKCECookie, setPKCECookie } from './adapters/pkce-cookies.js';
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
 * `AsyncLocalStorage` populated by `authKitHandle`, so this function can
 * set the PKCE verifier cookie on `event.cookies` without requiring the
 * caller to pass `event` explicitly. The cookie binds the returned OAuth
 * `state` parameter to the subsequent callback — sending the URL without
 * the cookie will produce a `PKCECookieMissingError` on return.
 */
export function createGetSignInUrl(authKitInstance: AuthKitInstance) {
  return async (options?: SignInOptions): Promise<string> => {
    const event = getRequestEvent();
    const result = await authKitInstance.getSignInUrl({
      returnPathname: options?.returnTo,
      organizationId: options?.organizationId,
      loginHint: options?.loginHint,
    });
    setPKCECookie(event.cookies, result);
    return result.url;
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
    const result = await authKitInstance.getSignUpUrl({
      returnPathname: options?.returnTo,
      organizationId: options?.organizationId,
      loginHint: options?.loginHint,
    });
    setPKCECookie(event.cookies, result);
    return result.url;
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

    // Apply session clear headers
    if (headers) {
      Object.entries(headers).forEach(([key, value]) => {
        const headerValue = Array.isArray(value) ? value.join(', ') : value;
        response.headers.set(key, headerValue);
      });
    }

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

    if (headers) {
      Object.entries(headers).forEach(([key, value]) => {
        const headerValue = Array.isArray(value) ? value.join(', ') : value;
        response.headers.set(key, headerValue);
      });
    }

    return response;
  };
}

/**
 * Create handleCallback helper for OAuth callback.
 *
 * Reads the PKCE verifier cookie from the request, passes it to
 * `authkit-session` so the sealed state can be byte-compared before
 * decryption, and deletes the cookie on EVERY exit path (success,
 * OAuth-provider error, state mismatch, missing cookie, encryption
 * failure) so a stuck verifier never bleeds into the next sign-in.
 */
export function createHandleCallback(authKitInstance: AuthKitInstance) {
  return () => {
    return async (event: RequestEvent): Promise<Response> => {
      const { url, cookies } = event;
      const code = url.searchParams.get('code');
      const state = url.searchParams.get('state') || undefined;
      const oauthError = url.searchParams.get('error');
      const cookieOptions = authKitInstance.getPKCECookieOptions();

      function bail(errCode: string, status: 302 | 303 | 307 | 308 = 302): never {
        deletePKCECookie(cookies, cookieOptions);
        redirect(status, `/auth/error?code=${errCode}`);
      }

      if (oauthError) {
        console.error('OAuth error:', oauthError);
        bail(oauthError === 'access_denied' ? 'ACCESS_DENIED' : 'AUTH_ERROR');
      }

      if (!code) {
        bail('AUTH_FAILED');
      }

      const cookieValue = cookies.get(cookieOptions.name);

      try {
        const result = await authKitInstance.handleCallback(new Request(url.toString()), new Response(), {
          code,
          state,
          cookieValue,
        });

        // Single-use by design — delete the verifier on success too.
        deletePKCECookie(cookies, cookieOptions);

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

        if (result.response) {
          result.response.headers.forEach((value: string, key: string) => {
            response.headers.set(key, value);
          });
        }
        if (result.headers) {
          Object.entries(result.headers).forEach(([key, value]) => {
            const headerValue = Array.isArray(value) ? value.join(', ') : value;
            response.headers.set(key, headerValue);
          });
        }

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
        bail(errCode);
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
