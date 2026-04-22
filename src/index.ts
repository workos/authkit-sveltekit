import type { RequestEvent } from '@sveltejs/kit';
import { configureAuthKit, getAuthKitInstance } from './config.js';
import { createAuthKitHandle } from './hooks.js';
import {
  createGetSignInUrl,
  createGetSignUpUrl,
  createGetUser,
  createHandleCallback,
  createRefreshSession,
  createSignOut,
  createSwitchOrganization,
} from './server/auth.js';
import { createWithAuth } from './server/middleware.js';
import type { AuthKitHandleOptions, AuthenticatedHandler, SignInOptions } from './types.js';

export type { AuthKitAuth, AuthKitConfig } from './types.js';
export type * from '@workos/authkit-session';
// Typed OAuth callback errors — re-exported so callers can distinguish
// state/cookie/encryption failures at the catch site.
export {
  AuthKitError,
  OAuthStateMismatchError,
  PKCECookieMissingError,
  SessionEncryptionError,
  TokenRefreshError,
  TokenValidationError,
} from '@workos/authkit-session';
export { configureAuthKit } from './config.js';

export const authKit = {
  withAuth: <T>(handler: AuthenticatedHandler<T>) => createWithAuth(getAuthKitInstance())(handler),
  getUser: (event: RequestEvent) => createGetUser(getAuthKitInstance())(event),
  // Mint a sign-in/up URL and set the PKCE verifier cookie on the active
  // RequestEvent. Must be called inside a request registered through
  // `authKitHandle()`. The cookie binds the OAuth `state` to the callback.
  getSignInUrl: (options?: SignInOptions) => createGetSignInUrl(getAuthKitInstance())(options),
  getSignUpUrl: (options?: SignInOptions) => createGetSignUpUrl(getAuthKitInstance())(options),
  signOut: (event: RequestEvent) => createSignOut(getAuthKitInstance())(event),
  switchOrganization: (event: RequestEvent, options: { organizationId: string }) =>
    createSwitchOrganization(getAuthKitInstance())(event, options),
  handleCallback: () => createHandleCallback(getAuthKitInstance())(),
  refreshSession: (event: RequestEvent) => createRefreshSession(getAuthKitInstance())(event),
};

export const authKitHandle = (options?: AuthKitHandleOptions) => createAuthKitHandle(getAuthKitInstance())(options);
