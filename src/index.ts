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
import type { AuthKitConfig, AuthKitAuth, AuthKitHandleOptions } from './types.js';

// Re-export types
export type { AuthKitAuth, AuthKitConfig } from './types.js';
export type { User, Organization, Impersonator } from '@workos-inc/node';

// Lazy initialization variables
let authKitInstance: ReturnType<typeof createAuthKitFactory<Request, Response>> | null = null;
let configuredConfig: AuthKitConfig | null = null;

// Initialize configuration from environment
function initializeConfig(providedConfig?: AuthKitConfig): AuthKitConfig {
  // If config is provided, use it directly
  if (providedConfig) {
    validateConfig(providedConfig);
    return providedConfig;
  }

  // Try to get environment variables
  // Note: This will only work in server-side contexts where process.env is available
  const config: AuthKitConfig = {
    clientId: process.env.WORKOS_CLIENT_ID || '',
    apiKey: process.env.WORKOS_API_KEY || '',
    redirectUri: process.env.WORKOS_REDIRECT_URI || '',
    cookiePassword: process.env.WORKOS_COOKIE_PASSWORD || ''
  };

  validateConfig(config);
  return config;
}

// Validate configuration
function validateConfig(config: AuthKitConfig): void {
  const missing = [];
  if (!config.clientId) missing.push('WORKOS_CLIENT_ID');
  if (!config.apiKey) missing.push('WORKOS_API_KEY');
  if (!config.redirectUri) missing.push('WORKOS_REDIRECT_URI');
  if (!config.cookiePassword) missing.push('WORKOS_COOKIE_PASSWORD');

  if (missing.length > 0) {
    throw new Error(
      `Missing required configuration: ${missing.join(', ')}\n` +
      `Please provide these values either through environment variables or by calling configureAuthKit().\n` +
      `For SvelteKit apps, configure in your hooks.server.ts:\n\n` +
      `import { configureAuthKit, authKitHandle } from '@workos/authkit-sveltekit';\n` +
      `import { env } from '$env/dynamic/private';\n\n` +
      `configureAuthKit({\n` +
      `  clientId: env.WORKOS_CLIENT_ID,\n` +
      `  apiKey: env.WORKOS_API_KEY,\n` +
      `  redirectUri: env.WORKOS_REDIRECT_URI,\n` +
      `  cookiePassword: env.WORKOS_COOKIE_PASSWORD\n` +
      `});\n\n` +
      `export const handle = authKitHandle();`
    );
  }

  if (config.cookiePassword.length < 32) {
    throw new Error(
      'cookiePassword must be at least 32 characters long.\n' +
      'Generate a secure password using: openssl rand -base64 24'
    );
  }
}

// Get or create the AuthKit instance
function getAuthKitInstance(): ReturnType<typeof createAuthKitFactory<Request, Response>> {
  if (!authKitInstance) {
    if (!configuredConfig) {
      // Try to initialize with environment variables
      configuredConfig = initializeConfig();
    }
    configure(configuredConfig);
    authKitInstance = createAuthKitFactory<Request, Response>({
      sessionStorageFactory: () => new SvelteKitStorage(configuredConfig!),
      sessionEncryptionFactory: () => new SvelteKitSessionEncryption()
    });
  }
  return authKitInstance;
}

// Export a configuration function for manual configuration
export function configureAuthKit(config: AuthKitConfig): void {
  configuredConfig = initializeConfig(config);
  configure(configuredConfig);
  authKitInstance = createAuthKitFactory<Request, Response>({
    sessionStorageFactory: () => new SvelteKitStorage(configuredConfig!),
    sessionEncryptionFactory: () => new SvelteKitSessionEncryption()
  });
}

// Export the main authKit object with lazy initialization
export const authKit = {
  withAuth: <T>(handler: import('./types.js').AuthenticatedHandler<T>) => 
    createWithAuth(getAuthKitInstance())(handler),
  getUser: (event: RequestEvent) => 
    createGetUser(getAuthKitInstance())(event),
  getSignInUrl: async (options?: import('./types.js').SignInOptions) => 
    createGetSignInUrl(getAuthKitInstance())(options),
  getSignUpUrl: async (options?: import('./types.js').SignInOptions) => 
    createGetSignUpUrl(getAuthKitInstance())(options),
  signOut: (event: RequestEvent) => 
    createSignOut(getAuthKitInstance())(event),
  switchOrganization: (event: RequestEvent, options: { organizationId: string }) => 
    createSwitchOrganization(getAuthKitInstance())(event, options),
  handleCallback: () => 
    createHandleCallback(getAuthKitInstance())(),
  refreshSession: (event: RequestEvent) => 
    createRefreshSession(getAuthKitInstance())(event)
};

// Export the handle function for hooks with lazy initialization
export const authKitHandle = (options?: AuthKitHandleOptions) => 
  createAuthKitHandle(getAuthKitInstance())(options);