import type { RequestEvent } from '@sveltejs/kit';
import { redirect } from '@sveltejs/kit';
import type { SignInOptions, AuthKitAuth } from '../types.js';
import { getWorkOS, getConfig } from '@workos/authkit-session';

/**
 * Create getUser helper
 */
export function createGetUser(authKitInstance: any) {
  return async (event: RequestEvent) => {
    const auth = event.locals.auth as AuthKitAuth;
    return auth?.user || null;
  };
}

/**
 * Create getSignInUrl helper
 */
export function createGetSignInUrl(authKitInstance: any) {
  return (options?: SignInOptions) => {
    const state = options?.returnTo ? btoa(JSON.stringify({ returnPathname: options.returnTo })) : undefined;

    return authKitInstance.getSignInUrl({
      redirectUri: process.env.WORKOS_REDIRECT_URI,
      organizationId: options?.organizationId,
      loginHint: options?.loginHint,
      state,
    });
  };
}

/**
 * Create getSignUpUrl helper
 */
export function createGetSignUpUrl(authKitInstance: any) {
  return (options?: SignInOptions) => {
    const state = options?.returnTo ? btoa(JSON.stringify({ returnPathname: options.returnTo })) : undefined;

    return authKitInstance.getSignUpUrl({
      redirectUri: process.env.WORKOS_REDIRECT_URI,
      organizationId: options?.organizationId,
      loginHint: options?.loginHint,
      state,
    });
  };
}

/**
 * Create signOut helper
 */
export function createSignOut(authKitInstance: any) {
  return async (event: RequestEvent) => {
    // Clear the session
    const response = new Response(null, {
      status: 302,
      headers: {
        Location: '/',
      },
    });

    // Clear session cookie
    const storage = new (await import('./adapters/storage.js')).SvelteKitStorage();
    return storage.clearSession(response);
  };
}

/**
 * Create switchOrganization helper
 */
export function createSwitchOrganization(authKitInstance: any) {
  return async (event: RequestEvent, { organizationId }: { organizationId: string }) => {
    const auth = event.locals.auth as AuthKitAuth;

    if (!auth?.user) {
      throw new Error('User must be authenticated to switch organizations');
    }

    // Use the authkit-session switchToOrganization method
    const response = await authKitInstance.switchToOrganization(event.request, new Response(), { organizationId });

    // Redirect to refresh the page with new organization context
    throw redirect(302, event.url.pathname);
  };
}

/**
 * Create handleCallback helper for OAuth callback
 */
export function createHandleCallback(authKitInstance: any) {
  return () => {
    return async ({ url }: RequestEvent) => {
      const code = url.searchParams.get('code');
      const state = url.searchParams.get('state');
      const error = url.searchParams.get('error');

      // Handle OAuth errors
      if (error) {
        console.error('OAuth error:', error);
        throw redirect(302, '/auth/error?message=' + encodeURIComponent(error));
      }

      if (!code) {
        throw new Error('Missing authorization code');
      }

      try {
        // Authenticate with WorkOS
        const workos = getWorkOS();
        const authResponse = await workos.userManagement.authenticateWithCode({
          code,
          clientId: getConfig('clientId'),
        });

        // Decode state to get return path
        let returnPath = '/';
        if (state) {
          try {
            const decoded = JSON.parse(atob(state));
            returnPath = decoded.returnPathname || '/';
          } catch {
            // Invalid state, use default
          }
        }

        // Create response with redirect
        let response = new Response(null, {
          status: 302,
          headers: {
            Location: returnPath,
          },
        });

        // Save the session
        const session = {
          accessToken: authResponse.accessToken,
          refreshToken: authResponse.refreshToken,
          user: authResponse.user,
          impersonator: authResponse.impersonator,
        };

        // Use authkit-session to save the session
        response = await authKitInstance.saveSession(response, session);

        return response;
      } catch (err) {
        console.error('Authentication error:', err);
        throw redirect(302, '/auth/error?message=Authentication+failed');
      }
    };
  };
}

/**
 * Create refreshSession helper
 */
export function createRefreshSession(authKitInstance: any) {
  return async (event: RequestEvent) => {
    const response = await authKitInstance.refreshSession(event.request, new Response());

    // Return whether refresh was successful
    return response.status === 200;
  };
}
