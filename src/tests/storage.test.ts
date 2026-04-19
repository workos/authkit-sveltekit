import { describe, it, expect } from 'vitest';
import { SvelteKitStorage } from '../server/adapters/storage.js';

const baseConfig = {
  clientId: 'client_test',
  apiKey: 'sk_test',
  redirectUri: 'https://app.example/auth/callback',
  cookiePassword: 'this-is-a-test-cookie-password-at-least-32chars',
};

function withHeader(header: string | undefined): Request {
  return new Request('https://app.example/', {
    headers: header ? { cookie: header } : {},
  });
}

describe('SvelteKitStorage.getCookie', () => {
  const storage = new SvelteKitStorage(baseConfig);

  it('returns the matching cookie value', async () => {
    const value = await storage.getCookie(withHeader('a=1; wos-auth-verifier=sealed; b=2'), 'wos-auth-verifier');
    expect(value).toBe('sealed');
  });

  it('returns null when the cookie is absent', async () => {
    const value = await storage.getCookie(withHeader('a=1; b=2'), 'wos-auth-verifier');
    expect(value).toBeNull();
  });

  it('returns null when the request has no cookie header', async () => {
    const value = await storage.getCookie(withHeader(undefined), 'wos-auth-verifier');
    expect(value).toBeNull();
  });

  it('URL-decodes the value', async () => {
    const value = await storage.getCookie(withHeader('wos-auth-verifier=a%20b%2Fc'), 'wos-auth-verifier');
    expect(value).toBe('a b/c');
  });
});

describe('SvelteKitStorage.getSession (inherited)', () => {
  const storage = new SvelteKitStorage(baseConfig);

  it('reads the session cookie from the request cookie header', async () => {
    // Default cookie name is `wos_session` unless overridden in config.
    const value = await storage.getSession(withHeader('wos_session=encrypted-session'));
    expect(value).toBe('encrypted-session');
  });

  it('returns null when the session cookie is absent', async () => {
    const value = await storage.getSession(withHeader('other=cookie'));
    expect(value).toBeNull();
  });
});
