import { describe, it, expect, vi } from 'vitest';
import type { RequestEvent } from '@sveltejs/kit';
import { createHandleCallback } from '../server/auth.js';

type AuthKitInstance = Parameters<typeof createHandleCallback>[0];

const TRUSTED_ORIGIN = 'https://trusted.example.com';
const CALLBACK_URL = `${TRUSTED_ORIGIN}/auth/callback?code=abc&state=xyz`;

async function runCallback(returnPathname: string, callbackUrl: string = CALLBACK_URL) {
  const instance = {
    handleCallback: vi.fn().mockResolvedValue({
      returnPathname,
      response: new Response(),
      headers: {},
    }),
  } as unknown as AuthKitInstance;
  const event = {
    url: new URL(callbackUrl),
    request: new Request(callbackUrl),
  } as unknown as RequestEvent;
  const handler = createHandleCallback(instance)();
  return handler(event);
}

describe('handleCallback open-redirect protection (CWE-601)', () => {
  it.each([
    ['absolute URL to evil host', 'https://evil.com/steal'],
    ['protocol-relative URL', '//evil.com/steal'],
    ['backslash smuggle', '/\\evil.com/path'],
    ['javascript: scheme', 'javascript:alert(1)'],
    ['empty string', ''],
    ['tab smuggling', '/\tevil.com'],
    ['newline smuggling', '/\nevil.com'],
  ])('keeps %s on the trusted origin', async (_desc, returnPathname) => {
    const response = await runCallback(returnPathname);
    const location = response.headers.get('Location')!;
    const resolved = new URL(location, TRUSTED_ORIGIN);
    expect(resolved.origin).toBe(TRUSTED_ORIGIN);
  });

  it('preserves legitimate pathname + query', async () => {
    const response = await runCallback('/dashboard?tab=settings');
    expect(response.headers.get('Location')).toBe('/dashboard?tab=settings');
  });

  it('preserves hash fragments', async () => {
    const response = await runCallback('/dashboard#billing');
    expect(response.headers.get('Location')).toBe('/dashboard#billing');
  });

  it('emits a relative Location (safe behind proxies that do not rewrite event.url)', async () => {
    // Simulate a proxied request where event.url carries an internal backend
    // origin rather than the public one — the Location must not leak it.
    const response = await runCallback('/dashboard', 'http://internal-backend.local:3000/auth/callback?code=a&state=b');
    const location = response.headers.get('Location')!;
    expect(location).toBe('/dashboard');
    expect(location).not.toContain('internal-backend.local');
  });
});
