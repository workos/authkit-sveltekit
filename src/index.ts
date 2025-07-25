import { configure, createAuthKitFactory } from '@workos/authkit-session';
import type { RequestEvent, Handle } from '@sveltejs/kit';
import { SvelteKitStorage } from './server/adapters/storage.js';
import { SvelteKitSessionEncryption } from './server/adapters/encryption.js';
import { createAuthKitHandle } from './hooks.js';
import { createWithAuth } from './server/middleware.js';
import {
  createGetUser,
  createGetSignInUrl,
  createGetSignUpUrl,
  createSignOut,
  createSwitchOrganization,
  createHandleCallback,
  createRefreshSession
} from './server/auth.js';
import type { AuthKitConfig, AuthKitAuth } from './types.js';

// Re-export types
export type { AuthKitAuth, AuthKitConfig } from './types.js';
export type { User, Organization, Impersonator } from '@workos-inc/node';

// Initialize configuration from environment
function initializeConfig(): AuthKitConfig {
  const config: AuthKitConfig = {
    clientId: process.env.WORKOS_CLIENT_ID || '',
    apiKey: process.env.WORKOS_API_KEY || '',
    redirectUri: process.env.WORKOS_REDIRECT_URI || '',
    cookiePassword: process.env.WORKOS_COOKIE_PASSWORD || ''
  };

  // Validate required configuration
  const missing = [];
  if (!config.clientId) missing.push('WORKOS_CLIENT_ID');
  if (!config.apiKey) missing.push('WORKOS_API_KEY');
  if (!config.redirectUri) missing.push('WORKOS_REDIRECT_URI');
  if (!config.cookiePassword) missing.push('WORKOS_COOKIE_PASSWORD');

  if (missing.length > 0) {
    throw new Error(
      `Missing required environment variables: ${missing.join(', ')}\n` +
      `Please add them to your .env file. See https://github.com/workos/authkit-sveltekit#setup for details.`
    );
  }

  if (config.cookiePassword.length < 32) {
    throw new Error(
      'WORKOS_COOKIE_PASSWORD must be at least 32 characters long.\n' +
      'Generate a secure password using: openssl rand -base64 24'
    );
  }

  return config;
}

// Create the AuthKit instance
const config = initializeConfig();
configure(config);

const authKitInstance = createAuthKitFactory<Request, Response>({
  sessionStorageFactory: () => new SvelteKitStorage(config),
  sessionEncryptionFactory: () => new SvelteKitSessionEncryption()
});

// Export the main authKit object with all methods
export const authKit = {
  withAuth: createWithAuth(authKitInstance),
  getUser: createGetUser(authKitInstance),
  getSignInUrl: createGetSignInUrl(authKitInstance),
  getSignUpUrl: createGetSignUpUrl(authKitInstance),
  signOut: createSignOut(authKitInstance),
  switchOrganization: createSwitchOrganization(authKitInstance),
  handleCallback: createHandleCallback(authKitInstance),
  refreshSession: createRefreshSession(authKitInstance)
};

// Export the handle function for hooks
export const authKitHandle = createAuthKitHandle(authKitInstance);