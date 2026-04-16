import { describe, it, expect, vi } from 'vitest';
import type { RequestEvent } from '@sveltejs/kit';
import { createHandleCallback } from '../server/auth.js';

type AuthKitInstance = Parameters<typeof createHandleCallback>[0];

function makeEvent(callbackUrl: string): RequestEvent {
  return {
    url: new URL(callbackUrl),
    request: new Request(callbackUrl),
  } as unknown as RequestEvent;
}

function makeInstance(returnPathname: string): AuthKitInstance {
  return {
    handleCallback: vi.fn().mockResolvedValue({
      returnPathname,
      response: new Response(),
      headers: {},
    }),
  } as unknown as AuthKitInstance;
}

const TRUSTED_ORIGIN = 'https://trusted.example.com';
const CALLBACK_URL = `${TRUSTED_ORIGIN}/auth/callback?code=abc&state=xyz`;

describe('handleCallback open-redirect protection (CWE-601)', () => {
  const attackPayloads: Array<[string, string]> = [
    ['absolute URL to evil host', 'https://evil.com/steal'],
    ['protocol-relative URL', '//evil.com/steal'],
    ['backslash smuggle', '/\\evil.com/path'],
    ['javascript: scheme', 'javascript:alert(1)'],
    ['empty string', ''],
    ['tab smuggling', '/\tevil.com'],
    ['newline smuggling', '/\nevil.com'],
  ];

  it.each(attackPayloads)('keeps %s on the trusted origin', async (_desc, returnPathname) => {
    const handler = createHandleCallback(makeInstance(returnPathname))();
    const response = await handler(makeEvent(CALLBACK_URL));

    const location = response.headers.get('Location')!;
    // Location must be relative (proxy-safe — browser resolves against the
    // public callback URL) and must not be a protocol-relative URL.
    expect(location.startsWith('/')).toBe(true);
    expect(location.startsWith('//')).toBe(false);

    const resolved = new URL(location, TRUSTED_ORIGIN);
    expect(resolved.origin).toBe(TRUSTED_ORIGIN);
    expect(resolved.host).not.toBe('evil.com');
  });

  it('preserves legitimate pathname + query', async () => {
    const handler = createHandleCallback(makeInstance('/dashboard?tab=settings'))();
    const response = await handler(makeEvent(CALLBACK_URL));

    expect(response.headers.get('Location')).toBe('/dashboard?tab=settings');
  });

  it('preserves hash fragments', async () => {
    const handler = createHandleCallback(makeInstance('/dashboard#billing'))();
    const response = await handler(makeEvent(CALLBACK_URL));

    expect(response.headers.get('Location')).toBe('/dashboard#billing');
  });

  it('emits a relative Location (safe behind proxies that do not rewrite event.url)', async () => {
    const handler = createHandleCallback(makeInstance('/dashboard'))();
    // Simulate a proxied request where event.url carries an internal backend
    // origin rather than the public one.
    const response = await handler(makeEvent('http://internal-backend.local:3000/auth/callback?code=a&state=b'));

    const location = response.headers.get('Location')!;
    expect(location).toBe('/dashboard');
    // Crucially, no backend host leaks into the Location header.
    expect(location).not.toContain('internal-backend.local');
  });
});
