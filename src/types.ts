import type { User, Organization, Impersonator } from '@workos-inc/node';

export interface AuthKitConfig {
  clientId: string;
  apiKey: string;
  redirectUri: string;
  cookiePassword: string;
  cookieName?: string;
  cookieDomain?: string;
  cookieMaxAge?: number;
}

export interface AuthKitAuth {
  user: User | null;
  organization?: Organization | null;
  role?: string | null;
  permissions?: string[];
  sessionId?: string;
  impersonator?: Impersonator | null;
  accessToken?: string;
}

export interface AuthKitHandleOptions {
  debug?: boolean;
  onError?: (error: Error) => void;
}

export interface SignInOptions {
  returnTo?: string;
  organizationId?: string;
  loginHint?: string;
}

export type AuthenticatedHandler<T = unknown> = (
  event: import('@sveltejs/kit').RequestEvent & { auth: Required<AuthKitAuth> }
) => T | Promise<T>;