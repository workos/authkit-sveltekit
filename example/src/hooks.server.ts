import { configureAuthKit, authKitHandle } from '@workos/authkit-sveltekit';
import { env } from '$env/dynamic/private';
import { redirect, type Handle } from '@sveltejs/kit';
import { sequence } from '@sveltejs/kit/hooks';
import { dev } from '$app/environment';

// Configure AuthKit with SvelteKit environment variables
configureAuthKit({
  clientId: env.WORKOS_CLIENT_ID,
  apiKey: env.WORKOS_API_KEY,
  redirectUri: env.WORKOS_REDIRECT_URI,
  cookiePassword: env.WORKOS_COOKIE_PASSWORD,
});

// Create the auth handle with debug based on environment
const authHandle = authKitHandle({
  debug: dev,
});

// Create a custom handle for protected routes
const protectedRoutesHandle: Handle = async ({ event, resolve }) => {
  const protectedPaths = ['/account', '/api/'] as const;
  // Guard on the resolved route id rather than the raw URL pathname.
  // SvelteKit decodes the pathname before matching routes, so a check
  // against event.url.pathname (which preserves percent-encoding) can be
  // bypassed with an encoded path such as /%61ccount while the router still
  // dispatches the protected /account route. event.route.id reflects the
  // matched route and is immune to encoding tricks.
  const routeId = event.route.id;
  const isProtectedRoute =
    routeId != null && protectedPaths.some((path) => routeId === path || routeId.startsWith(path));
  const isApiRoute = routeId != null && routeId.startsWith('/api/');

  if (isProtectedRoute && !event.locals.auth?.user) {
    // API routes should return 401
    if (isApiRoute) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // UI routes should redirect to login
    const returnPath = event.url.pathname + event.url.search;
    throw redirect(302, `/login?returnPathname=${encodeURIComponent(returnPath)}`);
  }

  return resolve(event);
};

// Combine both handles
export const handle = sequence(authHandle, protectedRoutesHandle);
