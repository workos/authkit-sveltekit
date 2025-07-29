import { parse, serialize } from 'cookie';
import type { SessionStorage } from '@workos/authkit-session';
import type { AuthKitConfig } from '../../types.js';

/**
 * SvelteKit-specific session storage adapter for AuthKit
 * Implements SessionStorage interface for Web API Request/Response objects
 */
interface CookieOptions {
  path: string;
  httpOnly: boolean;
  secure: boolean;
  sameSite: 'lax' | 'strict' | 'none';
  maxAge: number;
  domain?: string;
}

export class SvelteKitStorage implements SessionStorage<Request, Response> {
  private cookieName = 'wos-session';
  private cookieOptions: CookieOptions = {
    path: '/',
    httpOnly: true,
    secure: true,
    sameSite: 'lax' as const,
    maxAge: 60 * 60 * 24 * 400, // 400 days
  };

  constructor(config?: Partial<AuthKitConfig>) {
    if (config?.cookieName) {
      this.cookieName = config.cookieName;
    }
    if (config?.cookieMaxAge) {
      this.cookieOptions.maxAge = config.cookieMaxAge;
    }
    if (config?.cookieDomain) {
      this.cookieOptions.domain = config.cookieDomain;
    }
  }

  /**
   * Extract session data from request cookies
   */
  async getSession(request: Request): Promise<string | null> {
    const cookieHeader = request.headers.get('cookie');
    if (!cookieHeader) return null;

    const cookies = parse(cookieHeader);
    return cookies[this.cookieName] || null;
  }

  /**
   * Save session data to response cookies
   * Creates a new Response with session cookie set
   */
  async saveSession(response: Response, sessionData: string): Promise<Response> {
    const newResponse = new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers: new Headers(response.headers),
    });

    const cookie = serialize(this.cookieName, sessionData, this.cookieOptions);
    newResponse.headers.append('Set-Cookie', cookie);
    return newResponse;
  }

  /**
   * Clear session cookie from response
   * Creates a new Response with expired session cookie
   */
  async clearSession(response: Response): Promise<Response> {
    const newResponse = new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers: new Headers(response.headers),
    });

    const cookie = serialize(this.cookieName, '', {
      ...this.cookieOptions,
      maxAge: 0,
      expires: new Date(0),
    });

    newResponse.headers.append('Set-Cookie', cookie);
    return newResponse;
  }
}
