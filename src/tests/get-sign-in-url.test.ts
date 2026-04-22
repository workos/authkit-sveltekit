import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Cookies, RequestEvent } from '@sveltejs/kit';
import { createGetSignInUrl, createGetSignUpUrl } from '../server/auth.js';

type AuthKitInstance = Parameters<typeof createGetSignInUrl>[0];

const PKCE_COOKIE_NAME = 'wos-auth-verifier';

const getRequestEventMock = vi.hoisted(() => vi.fn<() => RequestEvent>());

vi.mock('../server/adapters/request-context.js', () => ({
  getRequestEvent: getRequestEventMock,
}));

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
  beforeEach(() => {
    getRequestEventMock.mockReset();
  });

  it('returns the URL and sets the PKCE verifier cookie on the active request', async () => {
    const { cookies, setCalls } = mockCookies();
    getRequestEventMock.mockReturnValue(makeEvent(cookies));
    const instance = makeInstance('createSignIn');

    const url = await createGetSignInUrl(instance)({ returnTo: '/dashboard' });

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
    getRequestEventMock.mockReturnValue(makeEvent(cookies));
    const instance = makeInstance('createSignUp');

    await createGetSignUpUrl(instance)({ returnTo: '/welcome' });

    expect(setCalls).toHaveLength(1);
    expect(setCalls[0].name).toBe(PKCE_COOKIE_NAME);
  });

  it('propagates the error thrown by getRequestEvent outside a request context', async () => {
    getRequestEventMock.mockImplementation(() => {
      throw new Error('Can only read the current request event inside ...');
    });
    const instance = makeInstance('createSignIn');

    await expect(createGetSignInUrl(instance)()).rejects.toThrow(/Can only read the current request event/);
  });
});
