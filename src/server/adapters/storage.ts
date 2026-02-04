import { parse } from 'cookie';
import { CookieSessionStorage } from '@workos/authkit-session';
import type { AuthKitConfig as UpstreamConfig } from '@workos/authkit-session';
import type { AuthKitConfig } from '../../types.js';

/**
 * SvelteKit-specific session storage adapter for AuthKit
 * Extends CookieSessionStorage for Web API Request/Response objects
 */
export class SvelteKitStorage extends CookieSessionStorage<Request, Response> {
  constructor(config: AuthKitConfig) {
    // CookieSessionStorage only uses cookie-related fields from config
    super(config as unknown as UpstreamConfig);
  }

  /**
   * Extract session data from request cookies
   */
  async getSession(request: Request): Promise<string | null> {
    const cookieHeader = request.headers.get('cookie');
    if (!cookieHeader) return null;

    const cookies = parse(cookieHeader);
    return cookies[this.cookieName] ?? null;
  }
}
