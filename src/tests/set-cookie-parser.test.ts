import { describe, it, expect } from 'vitest';
import { parseSetCookieHeader } from '../server/adapters/cookie-forwarding.js';

describe('parseSetCookieHeader', () => {
  it('parses a minimal name=value cookie', () => {
    const parsed = parseSetCookieHeader('wos=abc');
    expect(parsed).toEqual({ name: 'wos', value: 'abc', options: {} });
  });

  it('parses a full-attribute cookie', () => {
    const raw =
      'wos-auth-verifier=sealed-value; Path=/; Domain=example.com; Max-Age=600; ' +
      'Expires=Wed, 09 Jun 2027 10:18:14 GMT; HttpOnly; Secure; SameSite=Lax; Priority=High; Partitioned';
    const parsed = parseSetCookieHeader(raw);
    expect(parsed.name).toBe('wos-auth-verifier');
    expect(parsed.value).toBe('sealed-value');
    expect(parsed.options).toMatchObject({
      path: '/',
      domain: 'example.com',
      maxAge: 600,
      httpOnly: true,
      secure: true,
      sameSite: 'lax',
      priority: 'high',
      partitioned: true,
    });
    expect(parsed.options.expires).toBeInstanceOf(Date);
  });

  it('parses Max-Age=0 (delete) correctly', () => {
    const parsed = parseSetCookieHeader('wos=; Path=/; Max-Age=0');
    expect(parsed.value).toBe('');
    expect(parsed.options.maxAge).toBe(0);
    expect(parsed.options.path).toBe('/');
  });

  it('parses SameSite=None; Secure', () => {
    const parsed = parseSetCookieHeader('wos=x; Path=/; SameSite=None; Secure');
    expect(parsed.options.sameSite).toBe('none');
    expect(parsed.options.secure).toBe(true);
  });

  it('percent-decodes the cookie value', () => {
    const parsed = parseSetCookieHeader('wos=a%20b%2Fc; Path=/');
    expect(parsed.value).toBe('a b/c');
  });

  it('case-insensitively matches attribute keys', () => {
    const parsed = parseSetCookieHeader('wos=x; path=/; httponly; secure; samesite=strict');
    expect(parsed.options.path).toBe('/');
    expect(parsed.options.httpOnly).toBe(true);
    expect(parsed.options.secure).toBe(true);
    expect(parsed.options.sameSite).toBe('strict');
  });
});
