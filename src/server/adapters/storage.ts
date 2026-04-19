import { CookieSessionStorage } from '@workos/authkit-session';
import type { AuthKitConfig as UpstreamConfig } from '@workos/authkit-session';
import type { AuthKitConfig } from '../../types.js';

/**
 * SvelteKit-specific session storage adapter for AuthKit.
 *
 * Inherits `getSession` from `CookieSessionStorage` — that base class
 * parses the `Cookie` header the same way we need to here, so the
 * override is not required. We only add the `getCookie(request, name)`
 * method that the library calls to read the PKCE verifier cookie.
 */
export class SvelteKitStorage extends CookieSessionStorage<Request, Response> {
  constructor(config: AuthKitConfig) {
    // CookieSessionStorage only uses cookie-related fields from config
    super(config as unknown as UpstreamConfig);
  }

  /**
   * Read a named cookie from a `Request`'s `Cookie` header.
   *
   * Kept pure against the Web `Request` object (no detour through
   * `event.cookies` via AsyncLocalStorage) so this storage adapter stays
   * consistent with its generic parameters. Returns `null` on miss per
   * the `SessionStorage.getCookie` contract.
   */
  async getCookie(request: Request, name: string): Promise<string | null> {
    const header = request.headers.get('cookie');
    if (!header) return null;
    const prefix = `${name}=`;
    const match = header
      .split(';')
      .map((part) => part.trim())
      .find((part) => part.startsWith(prefix));
    if (!match) return null;
    return decodeURIComponent(match.slice(prefix.length));
  }
}
