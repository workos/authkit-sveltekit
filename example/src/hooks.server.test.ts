import { describe, expect, it, vi } from 'vitest';
import type { RequestEvent } from '@sveltejs/kit';

vi.mock('$env/dynamic/private', () => ({
  env: {
    WORKOS_CLIENT_ID: 'client-id',
    WORKOS_API_KEY: 'api-key',
    WORKOS_REDIRECT_URI: 'https://example.test/callback',
    WORKOS_COOKIE_PASSWORD: 'cookie-password',
  },
}));

vi.mock('$app/environment', () => ({ dev: false }));

vi.mock('@workos/authkit-sveltekit', () => ({
  configureAuthKit: vi.fn(),
  authKitHandle: vi.fn(() => vi.fn()),
}));

import { protectedRoutesHandle } from './hooks.server.js';

function eventFor({
  pathname,
  routeId,
  authenticated = false,
}: {
  pathname: string;
  routeId: string | null;
  authenticated?: boolean;
}): RequestEvent {
  const url = new URL(`https://example.test${pathname}`);

  return {
    url,
    route: { id: routeId },
    locals: authenticated ? { auth: { user: { id: 'user_01' } } } : {},
  } as RequestEvent;
}

async function runRoute(options: Parameters<typeof eventFor>[0]) {
  const event = eventFor(options);
  const resolve = vi.fn(async () => new Response('resolved'));

  const result = protectedRoutesHandle({ event, resolve } as Parameters<typeof protectedRoutesHandle>[0]);

  return { result, resolve };
}

describe('example protectedRoutesHandle', () => {
  it.each([
    ['/account', '/account'],
    ['/%61ccount', '/account'],
  ])('redirects unauthenticated account requests for %s', async (pathname, routeId) => {
    const { result, resolve } = await runRoute({ pathname, routeId });

    await expect(result).rejects.toMatchObject({
      status: 302,
      location: `/login?returnPathname=${encodeURIComponent(pathname)}`,
    });
    expect(resolve).not.toHaveBeenCalled();
  });

  it.each([
    ['/api/get-name', '/api/get-name'],
    ['/%61pi/get-name', '/api/get-name'],
  ])('returns 401 for unauthenticated API requests for %s', async (pathname, routeId) => {
    const { result, resolve } = await runRoute({ pathname, routeId });
    const response = await result;

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({ error: 'Unauthorized' });
    expect(resolve).not.toHaveBeenCalled();
  });

  it.each([
    ['/account', '/account'],
    ['/api/get-name', '/api/get-name'],
  ])('resolves authenticated protected requests for %s', async (pathname, routeId) => {
    const { result, resolve } = await runRoute({ pathname, routeId, authenticated: true });

    await expect(result).resolves.toMatchObject({ status: 200 });
    expect(resolve).toHaveBeenCalledTimes(1);
  });

  it.each([
    ['/', '/'],
    ['/login', '/login'],
    ['/not-a-route', null],
  ])('resolves public and unmatched requests for %s', async (pathname, routeId) => {
    const { result, resolve } = await runRoute({ pathname, routeId });

    await expect(result).resolves.toMatchObject({ status: 200 });
    expect(resolve).toHaveBeenCalledTimes(1);
  });
});
