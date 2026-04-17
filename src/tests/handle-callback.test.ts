import { describe, it, expect, vi } from 'vitest';
import type { Cookies, RequestEvent } from '@sveltejs/kit';
import { OAuthStateMismatchError, PKCECookieMissingError, SessionEncryptionError } from '@workos/authkit-session';
import { createHandleCallback } from '../server/auth.js';

type AuthKitInstance = Parameters<typeof createHandleCallback>[0];

const TRUSTED_ORIGIN = 'https://trusted.example.com';
const CALLBACK_URL = `${TRUSTED_ORIGIN}/auth/callback?code=abc&state=xyz`;
const PKCE_COOKIE_NAME = 'wos-auth-verifier';

interface MockCookies extends Cookies {
  _get: (name: string) => string | undefined;
  _deleteCalls: Array<{ name: string; opts: Record<string, unknown> }>;
}

function mockCookies(initial: Record<string, string> = {}): MockCookies {
  const store = new Map(Object.entries(initial));
  const deleteCalls: Array<{ name: string; opts: Record<string, unknown> }> = [];
  return {
    get: (name: string) => store.get(name),
    getAll: () => Array.from(store.entries()).map(([name, value]) => ({ name, value })),
    set: () => {},
    delete: (name: string, opts: Record<string, unknown>) => {
      store.delete(name);
      deleteCalls.push({ name, opts });
    },
    serialize: () => '',
    _get: (name: string) => store.get(name),
    _deleteCalls: deleteCalls,
  } as MockCookies;
}

function makeInstance(overrides: Partial<AuthKitInstance> = {}): AuthKitInstance {
  return {
    handleCallback: vi.fn().mockResolvedValue({
      returnPathname: '/dashboard',
      response: new Response(),
      headers: {},
    }),
    getPKCECookieOptions: vi.fn().mockReturnValue({
      name: PKCE_COOKIE_NAME,
      path: '/',
      httpOnly: true,
      secure: true,
      sameSite: 'lax',
      maxAge: 600,
    }),
    ...overrides,
  } as unknown as AuthKitInstance;
}

function makeEvent(instance: AuthKitInstance, cookies: MockCookies, callbackUrl: string = CALLBACK_URL): RequestEvent {
  return {
    url: new URL(callbackUrl),
    request: new Request(callbackUrl),
    cookies,
  } as unknown as RequestEvent;
}

async function runCallback(
  options: {
    returnPathname?: string;
    callbackUrl?: string;
    cookie?: string;
    handleCallbackImpl?: ReturnType<typeof vi.fn>;
  } = {},
) {
  const handleCallbackImpl =
    options.handleCallbackImpl ??
    vi.fn().mockResolvedValue({
      returnPathname: options.returnPathname ?? '/dashboard',
      response: new Response(),
      headers: {},
    });
  const instance = makeInstance({ handleCallback: handleCallbackImpl });
  const cookies = mockCookies(options.cookie === undefined ? {} : { [PKCE_COOKIE_NAME]: options.cookie });
  const event = makeEvent(instance, cookies, options.callbackUrl);
  const handler = createHandleCallback(instance)();

  let response: Response | undefined;
  let thrown: unknown;
  try {
    response = await handler(event);
  } catch (err) {
    thrown = err;
  }

  return { response, thrown, instance, cookies, handleCallbackImpl };
}

// SvelteKit `redirect(...)` throws an object with `{ status, location }`.
function isRedirect(thrown: unknown): thrown is { status: number; location: string } {
  return typeof thrown === 'object' && thrown !== null && 'status' in thrown && 'location' in thrown;
}

describe('handleCallback', () => {
  describe('Location header (CWE-601 passthrough)', () => {
    it('echoes the sanitized returnPathname verbatim', async () => {
      const { response } = await runCallback({
        returnPathname: '/dashboard?tab=settings',
        cookie: 'sealed-value',
      });
      expect(response?.headers.get('Location')).toBe('/dashboard?tab=settings');
    });

    it('preserves hash fragments for client-side routing / anchors', async () => {
      const { response } = await runCallback({
        returnPathname: '/dashboard#billing',
        cookie: 'sealed-value',
      });
      expect(response?.headers.get('Location')).toBe('/dashboard#billing');
    });

    it('never attaches the request origin to the Location (proxy-safe)', async () => {
      const { response } = await runCallback({
        returnPathname: '/dashboard',
        cookie: 'sealed-value',
        callbackUrl: 'http://internal-backend.local:3000/auth/callback?code=a&state=b',
      });
      const location = response?.headers.get('Location')!;
      expect(location).toBe('/dashboard');
      expect(location).not.toContain('internal-backend.local');
    });
  });

  describe('PKCE cookie handling', () => {
    it('reads the PKCE cookie and passes it to authkit-session', async () => {
      const { handleCallbackImpl } = await runCallback({ cookie: 'sealed-value' });
      expect(handleCallbackImpl).toHaveBeenCalledTimes(1);
      const [, , opts] = handleCallbackImpl.mock.calls[0];
      expect(opts).toMatchObject({
        code: 'abc',
        state: 'xyz',
        cookieValue: 'sealed-value',
      });
    });

    it('passes cookieValue=undefined when the cookie is absent', async () => {
      const { handleCallbackImpl } = await runCallback({
        cookie: undefined,
        handleCallbackImpl: vi.fn().mockRejectedValue(new PKCECookieMissingError('missing')),
      });
      const [, , opts] = handleCallbackImpl.mock.calls[0];
      expect(opts.cookieValue).toBeUndefined();
    });

    it('deletes the verifier cookie on successful callback (single-use)', async () => {
      const { cookies } = await runCallback({ cookie: 'sealed-value' });
      expect(cookies._deleteCalls).toHaveLength(1);
      expect(cookies._deleteCalls[0]).toMatchObject({ name: PKCE_COOKIE_NAME });
    });

    it('deletes the verifier cookie on state mismatch', async () => {
      const { cookies, thrown } = await runCallback({
        cookie: 'sealed-value',
        handleCallbackImpl: vi.fn().mockRejectedValue(new OAuthStateMismatchError('mismatch')),
      });
      expect(cookies._deleteCalls).toHaveLength(1);
      expect(isRedirect(thrown)).toBe(true);
      if (isRedirect(thrown)) {
        expect(thrown.location).toContain('code=STATE_MISMATCH');
      }
    });

    it('deletes the verifier cookie on PKCECookieMissingError', async () => {
      const { cookies, thrown } = await runCallback({
        cookie: undefined,
        handleCallbackImpl: vi.fn().mockRejectedValue(new PKCECookieMissingError('missing')),
      });
      expect(cookies._deleteCalls).toHaveLength(1);
      expect(isRedirect(thrown)).toBe(true);
      if (isRedirect(thrown)) {
        expect(thrown.location).toContain('code=PKCE_COOKIE_MISSING');
      }
    });

    it('deletes the verifier cookie on SessionEncryptionError', async () => {
      const { cookies, thrown } = await runCallback({
        cookie: 'sealed-value',
        handleCallbackImpl: vi.fn().mockRejectedValue(new SessionEncryptionError('bad seal')),
      });
      expect(cookies._deleteCalls).toHaveLength(1);
      expect(isRedirect(thrown)).toBe(true);
      if (isRedirect(thrown)) {
        expect(thrown.location).toContain('code=SESSION_ENCRYPTION_FAILED');
      }
    });

    it('deletes the verifier cookie on generic authentication failure', async () => {
      const { cookies, thrown } = await runCallback({
        cookie: 'sealed-value',
        handleCallbackImpl: vi.fn().mockRejectedValue(new Error('boom')),
      });
      expect(cookies._deleteCalls).toHaveLength(1);
      expect(isRedirect(thrown)).toBe(true);
      if (isRedirect(thrown)) {
        expect(thrown.location).toContain('code=AUTH_FAILED');
      }
    });

    it('deletes the verifier cookie when code is missing', async () => {
      const instance = makeInstance();
      const cookies = mockCookies({ [PKCE_COOKIE_NAME]: 'sealed-value' });
      const event = makeEvent(instance, cookies, `${TRUSTED_ORIGIN}/auth/callback`);
      const handler = createHandleCallback(instance)();

      let thrown: unknown;
      try {
        await handler(event);
      } catch (err) {
        thrown = err;
      }

      expect(cookies._deleteCalls).toHaveLength(1);
      expect(isRedirect(thrown)).toBe(true);
      if (isRedirect(thrown)) {
        expect(thrown.location).toContain('code=AUTH_FAILED');
      }
    });

    it('deletes the verifier cookie on OAuth provider error', async () => {
      const instance = makeInstance();
      const cookies = mockCookies({ [PKCE_COOKIE_NAME]: 'sealed-value' });
      const event = makeEvent(instance, cookies, `${TRUSTED_ORIGIN}/auth/callback?error=access_denied`);
      const handler = createHandleCallback(instance)();

      let thrown: unknown;
      try {
        await handler(event);
      } catch (err) {
        thrown = err;
      }

      expect(cookies._deleteCalls).toHaveLength(1);
      expect(isRedirect(thrown)).toBe(true);
      if (isRedirect(thrown)) {
        expect(thrown.location).toContain('code=ACCESS_DENIED');
      }
    });
  });
});
