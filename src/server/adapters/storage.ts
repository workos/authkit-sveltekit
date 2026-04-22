import { parse } from 'cookie';
import { CookieSessionStorage } from '@workos/authkit-session';
import type { AuthKitConfig as UpstreamConfig } from '@workos/authkit-session';
import type { AuthKitConfig } from '../../types.js';

/**
 * Adds `getCookie(request, name)` to the base CookieSessionStorage so the
 * library can read the PKCE verifier cookie via the same Web `Request`
 * abstraction it uses for the session cookie — no AsyncLocalStorage detour.
 */
export class SvelteKitStorage extends CookieSessionStorage<Request, Response> {
  constructor(config: AuthKitConfig) {
    super(config as unknown as UpstreamConfig);
  }

  async getCookie(request: Request, name: string): Promise<string | null> {
    const header = request.headers.get('cookie');
    if (!header) return null;
    const raw = parse(header)[name];
    if (raw == null) return null;
    try {
      return decodeURIComponent(raw);
    } catch {
      // Malformed percent-encoding — surface as miss rather than 500 the
      // request via an uncaught URIError. `cookie@1.x` does not decode by
      // default, so we own the decode (and its failure mode).
      return null;
    }
  }
}
