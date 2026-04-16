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

// CWE-601 sanitization lives in @workos/authkit-session >= 0.3.5; this SDK
// trusts that `returnPathname` is already a safe same-origin relative path
// and echoes it into the Location header. These tests verify the SDK's half
// of that contract: faithful passthrough + no accidental origin smuggling.
describe('handleCallback Location header', () => {
  it('echoes the sanitized returnPathname verbatim', async () => {
    const response = await runCallback('/dashboard?tab=settings');
    expect(response.headers.get('Location')).toBe('/dashboard?tab=settings');
  });

  it('preserves hash fragments for client-side routing / anchors', async () => {
    const response = await runCallback('/dashboard#billing');
    expect(response.headers.get('Location')).toBe('/dashboard#billing');
  });

  it('never attaches the request origin to the Location (proxy-safe)', async () => {
    // Regression guard: behind a proxy, event.url may carry an internal
    // backend host. The Location must stay relative so that host never
    // leaks into the redirect.
    const response = await runCallback('/dashboard', 'http://internal-backend.local:3000/auth/callback?code=a&state=b');
    const location = response.headers.get('Location')!;
    expect(location).toBe('/dashboard');
    expect(location).not.toContain('internal-backend.local');
  });
});
