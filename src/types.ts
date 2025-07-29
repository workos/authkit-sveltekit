import type { RequestEvent } from '@sveltejs/kit';
import type { User, Impersonator } from '@workos/authkit-session';

/**
 * Configuration options for AuthKit SvelteKit integration
 */
export interface AuthKitConfig {
  /** WorkOS Client ID */
  clientId: string;
  /** WorkOS API Key */
  apiKey: string;
  /** OAuth redirect URI */
  redirectUri: string;
  /** Cookie encryption password (min 32 chars) */
  cookiePassword: string;
  /** Optional: Custom cookie name (default: 'wos-session') */
  cookieName?: string;
  /** Optional: Cookie domain restriction */
  cookieDomain?: string;
  /** Optional: Cookie max age in seconds (default: 400 days) */
  cookieMaxAge?: number;
}

/**
 * Authentication state available in event.locals.auth
 */
export interface AuthKitAuth {
  user: User | null;
  organizationId?: string | null;
  role?: string | null;
  permissions?: string[];
  sessionId?: string;
  impersonator?: Impersonator | null;
  accessToken?: string;
}

/**
 * Options for authKitHandle() function
 */
export interface AuthKitHandleOptions {
  /** Enable debug logging */
  debug?: boolean;
  /** Custom error handler */
  onError?: (error: Error) => void;
  /** Runtime configuration (overrides environment) */
  config?: AuthKitConfig;
}

/**
 * Options for sign-in/sign-up URL generation
 */
export interface SignInOptions {
  /** Path to redirect after authentication */
  returnTo?: string;
  /** Pre-select organization */
  organizationId?: string;
  /** Pre-fill email address */
  loginHint?: string;
}

/**
 * Handler function that requires authentication
 */
export type AuthenticatedHandler<T = unknown> = (
  event: RequestEvent & { auth: Required<AuthKitAuth> },
) => T | Promise<T>;
