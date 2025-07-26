import type { RequestEvent } from '@sveltejs/kit';
import { redirect } from '@sveltejs/kit';
import type { SignInOptions, AuthKitAuth } from '../types.js';

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
  return async (options?: SignInOptions) => {
    // The authkit-session getSignInUrl returns a promise
    const url = await authKitInstance.getSignInUrl({
      organizationId: options?.organizationId,
      loginHint: options?.loginHint,
    });
    
    // If we have a returnTo, we need to update the state in the URL
    if (options?.returnTo) {
      const urlObj = new URL(url);
      const state = btoa(JSON.stringify({ returnPathname: options.returnTo }));
      urlObj.searchParams.set('state', state);
      return urlObj.toString();
    }
    
    return url;
  };
}

/**
 * Create getSignUpUrl helper
 */
export function createGetSignUpUrl(authKitInstance: any) {
  return async (options?: SignInOptions) => {
    // The authkit-session getSignUpUrl returns a promise
    const url = await authKitInstance.getSignUpUrl({
      organizationId: options?.organizationId,
      loginHint: options?.loginHint,
    });
    
    // If we have a returnTo, we need to update the state in the URL
    if (options?.returnTo) {
      const urlObj = new URL(url);
      const state = btoa(JSON.stringify({ returnPathname: options.returnTo }));
      urlObj.searchParams.set('state', state);
      return urlObj.toString();
    }
    
    return url;
  };
}

/**
 * Create signOut helper
 */
export function createSignOut(authKitInstance: any) {
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
