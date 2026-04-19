import { describe, it, expect, vi } from 'vitest';
import type { Cookies, RequestEvent } from '@sveltejs/kit';
import { createGetSignInUrl, createGetSignUpUrl } from '../server/auth.js';
import { runWithRequestEvent } from '../server/adapters/request-context.js';

type AuthKitInstance = Parameters<typeof createGetSignInUrl>[0];

const PKCE_COOKIE_NAME = 'wos-auth-verifier';

function mockCookies() {
  const setCalls: Array<{ name: string; value: string; opts: Record<string, unknown> }> = [];
  const cookies = {
    get: () => undefined,
    getAll: () => [],
    set: (name: string, value: string, opts: Record<string, unknown>) => {
      setCalls.push({ name, value, opts });
    },
    delete: () => {},
    serialize: () => '',
  } as unknown as Cookies;
  return { cookies, setCalls };
}

function makeInstance(
  method: 'createSignIn' | 'createSignUp',
  setCookieValue = `${PKCE_COOKIE_NAME}=sealed-verifier; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=600`,
): AuthKitInstance {
  return {
    [method]: vi.fn().mockResolvedValue({
      url: 'https://workos.example/authorize?state=sealed',
      headers: { 'Set-Cookie': setCookieValue },
    }),
  } as unknown as AuthKitInstance;
}

function makeEvent(cookies: Cookies): RequestEvent {
  return {
    url: new URL('https://app.example/login'),
    request: new Request('https://app.example/login'),
    cookies,
  } as unknown as RequestEvent;
}

describe('getSignInUrl / getSignUpUrl', () => {
  it('returns the URL and sets the PKCE verifier cookie on the active request', async () => {
    const { cookies, setCalls } = mockCookies();
    const event = makeEvent(cookies);
    const instance = makeInstance('createSignIn');

    const url = await runWithRequestEvent(event, () => createGetSignInUrl(instance)({ returnTo: '/dashboard' }));

    expect(url).toBe('https://workos.example/authorize?state=sealed');
    expect(setCalls).toHaveLength(1);
    expect(setCalls[0]).toMatchObject({
      name: PKCE_COOKIE_NAME,
      value: 'sealed-verifier',
      opts: {
        path: '/',
        httpOnly: true,
        secure: true,
        sameSite: 'lax',
        maxAge: 600,
      },
    });
  });

  it('sets the cookie for getSignUpUrl too', async () => {
    const { cookies, setCalls } = mockCookies();
    const event = makeEvent(cookies);
    const instance = makeInstance('createSignUp');

    await runWithRequestEvent(event, () => createGetSignUpUrl(instance)({ returnTo: '/welcome' }));

    expect(setCalls).toHaveLength(1);
    expect(setCalls[0].name).toBe(PKCE_COOKIE_NAME);
  });

  it('throws a clear error when called outside a request context', async () => {
    const instance = makeInstance('createSignIn');

    await expect(createGetSignInUrl(instance)()).rejects.toThrow(/No active request context/);
  });
});
