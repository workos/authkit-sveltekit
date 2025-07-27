import type { RequestEvent } from '@sveltejs/kit';
import { redirect } from '@sveltejs/kit';
import type { createAuthKitFactory } from '@workos/authkit-session';
import type { SignInOptions, AuthKitAuth } from '../types.js';

type AuthKitInstance = ReturnType<typeof createAuthKitFactory<Request, Response>>;

/**
 * Helper to add returnTo path to OAuth state parameter
 */
function addReturnToState(url: string, returnTo?: string): string {
  if (!returnTo) return url;
  
  const urlObj = new URL(url);
  const state = encodeURIComponent(
    Buffer.from(JSON.stringify({ returnPathname: returnTo })).toString('base64')
  );
  urlObj.searchParams.set('state', state);
  return urlObj.toString();
}

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
    // The authkit-session getSignInUrl returns a promise
    const url = await authKitInstance.getSignInUrl({
      organizationId: options?.organizationId,
      loginHint: options?.loginHint,
    });
    
    return addReturnToState(url, options?.returnTo);
  };
}

/**
 * Create getSignUpUrl helper
 */
export function createGetSignUpUrl(authKitInstance: AuthKitInstance) {
  return async (options?: SignInOptions) => {
    // The authkit-session getSignUpUrl returns a promise
    const url = await authKitInstance.getSignUpUrl({
      organizationId: options?.organizationId,
      loginHint: options?.loginHint,
    });
    
    return addReturnToState(url, options?.returnTo);
  };
}

/**
 * Create signOut helper
 */
export function createSignOut(authKitInstance: AuthKitInstance) {
  return async (event: RequestEvent) => {
    // Use authkit-session's signOut method
    const response = await authKitInstance.signOut(
      event.request,
      new Response(null, {
        status: 302,
        headers: {
          Location: '/',
        },
      })
    );

    return response;
  };
}

/**
 * Create switchOrganization helper
 */
export function createSwitchOrganization(authKitInstance: AuthKitInstance) {
  return async (event: RequestEvent, { organizationId }: { organizationId: string }) => {
    const auth = event.locals.auth as AuthKitAuth;

    if (!auth?.user) {
      throw new Error('User must be authenticated to switch organizations');
    }

    // Use the authkit-session switchToOrganization method
    const response = await authKitInstance.switchToOrganization(event.request, new Response(), organizationId);

    // Redirect to refresh the page with new organization context
    throw redirect(302, event.url.pathname);
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
        const result = await authKitInstance.handleCallback(
          new Request(url.toString()),
          new Response(),
          { code, state }
        );

        // Create response with redirect to the return path
        const response = new Response(null, {
          status: 302,
          headers: {
            Location: result.returnPathname,
          },
        });

        // Copy headers from the result response (which includes the session cookie)
        result.response.headers.forEach((value: string, key: string) => {
          response.headers.set(key, value);
        });

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
