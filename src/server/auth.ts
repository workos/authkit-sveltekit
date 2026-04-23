import type { RequestEvent } from '@sveltejs/kit';
import { redirect } from '@sveltejs/kit';
import type { createAuthService } from '@workos/authkit-session';
import { OAuthStateMismatchError, PKCECookieMissingError, SessionEncryptionError } from '@workos/authkit-session';
import type { SignInOptions, AuthKitAuth } from '../types.js';
import { applyCookies, appendHeaderBag } from './adapters/cookie-forwarding.js';
import { getRequestEvent } from './adapters/request-context.js';

type AuthKitInstance = ReturnType<typeof createAuthService<Request, Response>>;

export const AuthErrorCode = {
  AccessDenied: 'ACCESS_DENIED',
  AuthError: 'AUTH_ERROR',
  AuthFailed: 'AUTH_FAILED',
  StateMismatch: 'STATE_MISMATCH',
  PkceCookieMissing: 'PKCE_COOKIE_MISSING',
  SessionEncryptionFailed: 'SESSION_ENCRYPTION_FAILED',
} as const;
export type AuthErrorCode = (typeof AuthErrorCode)[keyof typeof AuthErrorCode];

export function createGetUser(_authKitInstance: AuthKitInstance) {
  return async (event: RequestEvent) => {
    const auth = event.locals.auth as AuthKitAuth;
    return auth?.user || null;
  };
}

type CreateAuthUrlMethod = 'createSignIn' | 'createSignUp';

function createGetAuthUrl(authKitInstance: AuthKitInstance, method: CreateAuthUrlMethod) {
  return async (options?: SignInOptions): Promise<string> => {
    const event = getRequestEvent();
    const { url, response, headers } = await authKitInstance[method](new Response(), {
      returnPathname: options?.returnTo,
      organizationId: options?.organizationId,
      loginHint: options?.loginHint,
    });
    applyCookies(event, response, headers);
    return url;
  };
}

export function createGetSignInUrl(authKitInstance: AuthKitInstance) {
  return createGetAuthUrl(authKitInstance, 'createSignIn');
}

export function createGetSignUpUrl(authKitInstance: AuthKitInstance) {
  return createGetAuthUrl(authKitInstance, 'createSignUp');
}

export function createSignOut(authKitInstance: AuthKitInstance) {
  return async (event: RequestEvent) => {
    const auth = event.locals.auth as AuthKitAuth;

    if (!auth?.sessionId) {
      throw redirect(302, '/');
    }

    const { logoutUrl, headers } = await authKitInstance.signOut(auth.sessionId);

    const response = new Response(null, {
      status: 302,
      headers: {
        Location: logoutUrl,
      },
    });

    appendHeaderBag(response.headers, headers);

    return response;
  };
}

export function createSwitchOrganization(authKitInstance: AuthKitInstance) {
  return async (event: RequestEvent, { organizationId }: { organizationId: string }) => {
    const session = await authKitInstance.getSession(event.request);

    if (!session) {
      throw new Error('User must be authenticated to switch organizations');
    }

    const { encryptedSession } = await authKitInstance.switchOrganization(session, organizationId);
    const { headers } = await authKitInstance.saveSession(undefined, encryptedSession);

    const response = new Response(null, {
      status: 302,
      headers: {
        Location: event.url.pathname,
      },
    });

    appendHeaderBag(response.headers, headers);

    return response;
  };
}

/**
 * Build an OAuth callback handler. The returned `Response` is constructed
 * manually (not via SvelteKit's throwing `redirect()`) so per-flow
 * verifier-delete `Set-Cookie` headers attach to this exact response on
 * success and on bail paths where URL `state` is present. Bails without
 * `state` skip the delete — there is no deterministic cookie name to target
 * — and rely on the 10-minute PKCE TTL to clean up orphans.
 */
export function createHandleCallback(authKitInstance: AuthKitInstance) {
  return () => {
    return async (event: RequestEvent): Promise<Response> => {
      const { url, request } = event;
      const code = url.searchParams.get('code');
      const state = url.searchParams.get('state') || undefined;
      const oauthError = url.searchParams.get('error');

      const bail = async (errCode: AuthErrorCode): Promise<Response> => {
        const response = new Response(null, {
          status: 302,
          headers: { Location: `/auth/error?code=${errCode}` },
        });

        if (state) {
          const { headers: deleteHeaders } = await authKitInstance.clearPendingVerifier(new Response(), {
            state,
          });
          appendHeaderBag(response.headers, deleteHeaders);
        }

        return response;
      };

      if (oauthError) {
        console.error('OAuth error:', oauthError);
        return bail(oauthError === 'access_denied' ? AuthErrorCode.AccessDenied : AuthErrorCode.AuthError);
      }

      if (!code) {
        return bail(AuthErrorCode.AuthFailed);
      }

      try {
        const result = await authKitInstance.handleCallback(request, new Response(), {
          code,
          state,
        });

        // authkit-session guarantees returnPathname is a safe same-origin
        // relative path (CWE-601 protection); emit verbatim so the Location
        // stays relative and works behind proxies that don't reconstruct origin.
        const response = new Response(null, {
          status: 302,
          headers: {
            Location: result.returnPathname,
          },
        });

        // Only forward Set-Cookie from the response stub — authkit-session
        // currently only writes cookies onto it, but iterating all headers
        // would clobber our Location if that ever changes.
        if (result.response) {
          for (const cookie of result.response.headers.getSetCookie()) {
            response.headers.append('Set-Cookie', cookie);
          }
        }
        appendHeaderBag(response.headers, result.headers);

        return response;
      } catch (err) {
        console.error('Authentication error:', err);
        const errCode =
          err instanceof OAuthStateMismatchError
            ? AuthErrorCode.StateMismatch
            : err instanceof PKCECookieMissingError
              ? AuthErrorCode.PkceCookieMissing
              : err instanceof SessionEncryptionError
                ? AuthErrorCode.SessionEncryptionFailed
                : AuthErrorCode.AuthFailed;
        return bail(errCode);
      }
    };
  };
}

export function createRefreshSession(_authKitInstance: AuthKitInstance) {
  return async (_event: RequestEvent) => {
    // No-op: refresh is handled inside withAuth. Kept for public API compatibility.
    return true;
  };
}
