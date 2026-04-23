import { describe, it, expect, vi } from 'vitest';
import { createWithAuth } from './middleware.js';

function buildAuthKit() {
  return {
    createSignIn: vi.fn().mockResolvedValue({
      url: 'https://auth.workos.com/sign-in',
      cookieName: 'wos-auth-verifier-00000000',
      response: new Response(),
      headers: { 'Set-Cookie': ['wos-auth-verifier-00000000=abc; Path=/'] },
    }),
    getSignInUrl: vi.fn().mockResolvedValue({
      url: 'https://auth.workos.com/sign-in',
      cookieName: 'wos-auth-verifier-00000000',
    }),
  } as unknown as Parameters<typeof createWithAuth>[0];
}

function event(headers: Record<string, string>) {
  return {
    url: new URL('https://app.example/protected'),
    request: new Request('https://app.example/protected', { headers }),
    locals: { auth: { user: null } },
  } as unknown as Parameters<ReturnType<ReturnType<typeof createWithAuth>>>[0];
}

describe('createWithAuth — document gating', () => {
  it('calls createSignIn (with cookie) for document requests', async () => {
    const ak = buildAuthKit();
    const withAuth = createWithAuth(ak);
    const handler = withAuth(async () => ({ ok: true }));

    await handler(event({ 'sec-fetch-dest': 'document' })).catch(() => null);
    expect(ak.createSignIn).toHaveBeenCalled();
    expect(ak.getSignInUrl).not.toHaveBeenCalled();
  });

  it('calls getSignInUrl (no cookie) for XHR requests', async () => {
    const ak = buildAuthKit();
    const withAuth = createWithAuth(ak);
    const handler = withAuth(async () => ({ ok: true }));

    await handler(event({ 'sec-fetch-dest': 'empty' })).catch(() => null);
    expect(ak.getSignInUrl).toHaveBeenCalled();
    expect(ak.createSignIn).not.toHaveBeenCalled();
  });
});
