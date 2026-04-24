import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { RequestEvent } from '@sveltejs/kit';
import {
  getPKCECookieNameForState,
  OAuthStateMismatchError,
  PKCECookieMissingError,
  SessionEncryptionError,
} from '@workos/authkit-session';
import { createHandleCallback } from '../server/auth.js';

type AuthKitInstance = Parameters<typeof createHandleCallback>[0];

const TRUSTED_ORIGIN = 'https://trusted.example.com';
const STATE = 'xyz';
const CALLBACK_URL = `${TRUSTED_ORIGIN}/auth/callback?code=abc&state=${STATE}`;

const verifierDeleteFor = (state: string) => `${getPKCECookieNameForState(state)}=; Path=/; Max-Age=0`;
const VERIFIER_DELETE = verifierDeleteFor(STATE);
const SESSION_COOKIE = 'wos-session=sealed-session; Path=/; HttpOnly; Secure; SameSite=Lax';

function makeInstance(overrides: Partial<AuthKitInstance> = {}): AuthKitInstance {
  return {
    handleCallback: vi.fn().mockResolvedValue({
      returnPathname: '/dashboard',
      response: undefined,
      headers: { 'Set-Cookie': [SESSION_COOKIE, VERIFIER_DELETE] },
    }),
    clearPendingVerifier: vi.fn().mockResolvedValue({
      response: undefined,
      headers: { 'Set-Cookie': VERIFIER_DELETE },
    }),
    ...overrides,
  } as unknown as AuthKitInstance;
}

function makeEvent(callbackUrl: string = CALLBACK_URL): RequestEvent {
  return {
    url: new URL(callbackUrl),
    request: new Request(callbackUrl),
    cookies: {
      get: () => undefined,
      getAll: () => [],
      set: () => {},
      delete: () => {},
      serialize: () => '',
    },
  } as unknown as RequestEvent;
}

async function runCallback(
  options: {
    returnPathname?: string;
    callbackUrl?: string;
    handleCallbackImpl?: ReturnType<typeof vi.fn>;
    clearImpl?: ReturnType<typeof vi.fn>;
  } = {},
) {
  const handleCallbackImpl =
    options.handleCallbackImpl ??
    vi.fn().mockResolvedValue({
      returnPathname: options.returnPathname ?? '/dashboard',
      response: undefined,
      headers: { 'Set-Cookie': [SESSION_COOKIE, VERIFIER_DELETE] },
    });
  const clearImpl =
    options.clearImpl ?? vi.fn().mockResolvedValue({ response: undefined, headers: { 'Set-Cookie': VERIFIER_DELETE } });
  const instance = makeInstance({
    handleCallback: handleCallbackImpl,
    clearPendingVerifier: clearImpl,
  } as Partial<AuthKitInstance>);
  const event = makeEvent(options.callbackUrl);
  const handler = createHandleCallback(instance)();

  const response = await handler(event);

  return { response, instance, handleCallbackImpl, clearImpl };
}

describe('handleCallback', () => {
  describe('Location header (CWE-601 passthrough)', () => {
    it('echoes the sanitized returnPathname verbatim', async () => {
      const { response } = await runCallback({ returnPathname: '/dashboard?tab=settings' });
      expect(response.status).toBe(302);
      expect(response.headers.get('Location')).toBe('/dashboard?tab=settings');
    });

    it('preserves hash fragments for client-side routing / anchors', async () => {
      const { response } = await runCallback({ returnPathname: '/dashboard#billing' });
      expect(response.headers.get('Location')).toBe('/dashboard#billing');
    });

    it('never attaches the request origin to the Location (proxy-safe)', async () => {
      const { response } = await runCallback({
        returnPathname: '/dashboard',
        callbackUrl: 'http://internal-backend.local:3000/auth/callback?code=a&state=b',
      });
      const location = response.headers.get('Location')!;
      expect(location).toBe('/dashboard');
      expect(location).not.toContain('internal-backend.local');
    });
  });

  describe('Success path Set-Cookie forwarding', () => {
    it('passes code/state to handleCallback', async () => {
      const { handleCallbackImpl } = await runCallback();
      expect(handleCallbackImpl).toHaveBeenCalledTimes(1);
      const [, , opts] = handleCallbackImpl.mock.calls[0];
      expect(opts).toMatchObject({ code: 'abc', state: 'xyz' });
    });

    it('emits session + verifier-delete as separate Set-Cookie entries', async () => {
      const { response } = await runCallback();
      const cookies = response.headers.getSetCookie();
      expect(cookies).toHaveLength(2);
      expect(cookies[0]).toBe(SESSION_COOKIE);
      expect(cookies[1]).toBe(VERIFIER_DELETE);
    });
  });

  describe('Bail paths clear the verifier', () => {
    // Handler logs to console.error on bail paths (load-bearing for prod ops).
    // Silence here so the suite stays readable; functional assertions below
    // prove the bail path fired.
    let errorSpy: ReturnType<typeof vi.spyOn>;
    beforeEach(() => {
      errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    });
    afterEach(() => {
      errorSpy.mockRestore();
    });

    it('state mismatch → Response with verifier-delete only', async () => {
      const { response, clearImpl } = await runCallback({
        handleCallbackImpl: vi.fn().mockRejectedValue(new OAuthStateMismatchError('mismatch')),
      });
      expect(response.status).toBe(302);
      expect(response.headers.get('Location')).toBe('/auth/error?code=STATE_MISMATCH');
      expect(clearImpl).toHaveBeenCalledTimes(1);
      expect(response.headers.getSetCookie()).toEqual([VERIFIER_DELETE]);
    });

    it('PKCECookieMissingError → PKCE_COOKIE_MISSING', async () => {
      const { response } = await runCallback({
        handleCallbackImpl: vi.fn().mockRejectedValue(new PKCECookieMissingError('missing')),
      });
      expect(response.headers.get('Location')).toBe('/auth/error?code=PKCE_COOKIE_MISSING');
      expect(response.headers.getSetCookie()).toEqual([VERIFIER_DELETE]);
    });

    it('SessionEncryptionError → SESSION_ENCRYPTION_FAILED', async () => {
      const { response } = await runCallback({
        handleCallbackImpl: vi.fn().mockRejectedValue(new SessionEncryptionError('bad seal')),
      });
      expect(response.headers.get('Location')).toBe('/auth/error?code=SESSION_ENCRYPTION_FAILED');
      expect(response.headers.getSetCookie()).toEqual([VERIFIER_DELETE]);
    });

    it('generic error → AUTH_FAILED', async () => {
      const { response } = await runCallback({
        handleCallbackImpl: vi.fn().mockRejectedValue(new Error('boom')),
      });
      expect(response.headers.get('Location')).toBe('/auth/error?code=AUTH_FAILED');
      expect(response.headers.getSetCookie()).toEqual([VERIFIER_DELETE]);
    });

    it('thrown handleCallback + no state → redirect without touching clearPendingVerifier', async () => {
      const clearImpl = vi.fn();
      const { response } = await runCallback({
        callbackUrl: `${TRUSTED_ORIGIN}/auth/callback?code=abc`,
        handleCallbackImpl: vi.fn().mockRejectedValue(new OAuthStateMismatchError('mismatch')),
        clearImpl,
      });
      expect(response.headers.get('Location')).toBe('/auth/error?code=STATE_MISMATCH');
      expect(response.headers.getSetCookie()).toEqual([]);
      expect(clearImpl).not.toHaveBeenCalled();
    });

    it('clearPendingVerifier rejection does not swallow the redirect', async () => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const { response } = await runCallback({
        handleCallbackImpl: vi.fn().mockRejectedValue(new OAuthStateMismatchError('mismatch')),
        clearImpl: vi.fn().mockRejectedValue(new Error('storage offline')),
      });
      expect(response.status).toBe(302);
      expect(response.headers.get('Location')).toBe('/auth/error?code=STATE_MISMATCH');
      expect(response.headers.getSetCookie()).toEqual([]);
      expect(warnSpy).toHaveBeenCalled();
      warnSpy.mockRestore();
    });

    const URL_LEVEL_BAIL_CASES = [
      { label: 'missing ?code=', query: '', code: 'AUTH_FAILED' },
      { label: '?error=access_denied', query: '?error=access_denied', code: 'ACCESS_DENIED' },
      { label: '?error=other', query: '?error=unexpected', code: 'AUTH_ERROR' },
    ];

    describe.each(URL_LEVEL_BAIL_CASES)('$label', ({ query, code }) => {
      it(`no state → ${code}, no Set-Cookie`, async () => {
        const { response, instance } = await runCallback({
          callbackUrl: `${TRUSTED_ORIGIN}/auth/callback${query}`,
        });
        expect(response.headers.get('Location')).toBe(`/auth/error?code=${code}`);
        expect(response.headers.getSetCookie()).toEqual([]);
        expect(instance.handleCallback as ReturnType<typeof vi.fn>).not.toHaveBeenCalled();
        expect(instance.clearPendingVerifier as ReturnType<typeof vi.fn>).not.toHaveBeenCalled();
      });

      it(`state present → ${code}, per-flow verifier delete`, async () => {
        const sealedState = `sealed-${code}`;
        const expectedDelete = verifierDeleteFor(sealedState);
        const separator = query ? '&' : '?';
        const { response, clearImpl } = await runCallback({
          callbackUrl: `${TRUSTED_ORIGIN}/auth/callback${query}${separator}state=${sealedState}`,
          clearImpl: vi.fn().mockResolvedValue({
            response: undefined,
            headers: { 'Set-Cookie': expectedDelete },
          }),
        });
        expect(response.headers.get('Location')).toBe(`/auth/error?code=${code}`);
        expect(clearImpl).toHaveBeenCalledTimes(1);
        expect(clearImpl.mock.calls[0][1]).toMatchObject({ state: sealedState });
        expect(response.headers.getSetCookie()).toEqual([expectedDelete]);
      });
    });
  });
});
