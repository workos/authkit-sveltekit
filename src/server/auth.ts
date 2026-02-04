import type { RequestEvent } from '@sveltejs/kit';
import { redirect } from '@sveltejs/kit';
import type { createAuthService } from '@workos/authkit-session';
import type { SignInOptions, AuthKitAuth } from '../types.js';

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
 * Create getSignInUrl helper
 */
export function createGetSignInUrl(authKitInstance: AuthKitInstance) {
  return async (options?: SignInOptions) => {
    return authKitInstance.getSignInUrl({
      returnPathname: options?.returnTo,
      organizationId: options?.organizationId,
      loginHint: options?.loginHint,
    });
  };
}

/**
 * Create getSignUpUrl helper
 */
export function createGetSignUpUrl(authKitInstance: AuthKitInstance) {
  return async (options?: SignInOptions) => {
    return authKitInstance.getSignUpUrl({
      returnPathname: options?.returnTo,
      organizationId: options?.organizationId,
      loginHint: options?.loginHint,
    });
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
 * Create handleCallback helper for OAuth callback
 */
export function createHandleCallback(authKitInstance: AuthKitInstance) {
  return () => {
    return async ({ url }: RequestEvent) => {
      const code = url.searchParams.get('code');
      const state = url.searchParams.get('state') || undefined;
      const error = url.searchParams.get('error');

      // Handle OAuth errors
      if (error) {
        console.error('OAuth error:', error);
        const errorCode = error === 'access_denied' ? 'ACCESS_DENIED' : 'AUTH_ERROR';
        throw redirect(302, `/auth/error?code=${errorCode}`);
      }

      if (!code) {
        throw new Error('Missing authorization code');
      }

      try {
        // Use authkit-session's handleCallback
        const result = await authKitInstance.handleCallback(new Request(url.toString()), new Response(), {
          code,
          state,
        });

        // Create response with redirect to the return path
        const response = new Response(null, {
          status: 302,
          headers: {
            Location: result.returnPathname,
          },
        });

        // Apply session headers (may come from response object or headers bag)
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
        throw redirect(302, '/auth/error?code=AUTH_FAILED');
      }
    };
  };
}

/**
 * Create refreshSession helper
 * Note: Session refresh is handled automatically by authkit-session
 */
export function createRefreshSession(authKitInstance: AuthKitInstance) {
  return async (event: RequestEvent) => {
    // Session refresh is handled automatically by withAuth
    // This is a no-op but kept for API compatibility
    return true;
  };
}
