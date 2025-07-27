import type { RequestEvent } from '@sveltejs/kit';
import { configure, createAuthKitFactory } from '@workos/authkit-session';
import { createAuthKitHandle } from './hooks.js';
import { SvelteKitSessionEncryption } from './server/adapters/encryption.js';
import { SvelteKitStorage } from './server/adapters/storage.js';
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
import type { AuthKitConfig, AuthKitHandleOptions, AuthenticatedHandler, SignInOptions } from './types.js';

type AuthKitInstance = ReturnType<typeof createAuthKitFactory<Request, Response>>;

// Re-export types
export type { AuthKitAuth, AuthKitConfig } from './types.js';
// Re-export all types from authkit-session that users might need
export type * from '@workos/authkit-session';

// Lazy initialization variables
let authKitInstance: AuthKitInstance | null = null;
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
    cookiePassword: process.env.WORKOS_COOKIE_PASSWORD || '',
  };

  validateConfig(config);
  return config;
}

// Configuration validation helpers
const REQUIRED_CONFIG_FIELDS = [
  { key: 'clientId', envVar: 'WORKOS_CLIENT_ID' },
  { key: 'apiKey', envVar: 'WORKOS_API_KEY' },
  { key: 'redirectUri', envVar: 'WORKOS_REDIRECT_URI' },
  { key: 'cookiePassword', envVar: 'WORKOS_COOKIE_PASSWORD' },
] as const;

function validateConfig(config: AuthKitConfig): void {
  const missing = REQUIRED_CONFIG_FIELDS
    .filter(field => !config[field.key as keyof AuthKitConfig])
    .map(field => field.envVar);

  if (missing.length > 0) {
    throw new Error(
      `Missing required configuration: ${missing.join(', ')}\n\n` +
      `Configure in your hooks.server.ts:\n\n` +
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

// Create AuthKit instance with the given configuration
function createAuthKitInstance(config: AuthKitConfig): AuthKitInstance {
  return createAuthKitFactory<Request, Response>({
    sessionStorageFactory: () => new SvelteKitStorage(config),
    sessionEncryptionFactory: () => new SvelteKitSessionEncryption(),
  });
}

// Get or create the AuthKit instance
function getAuthKitInstance(): AuthKitInstance {
  if (!authKitInstance) {
    if (!configuredConfig) {
      // Try to initialize with environment variables
      configuredConfig = initializeConfig();
    }
    configure(configuredConfig);
    authKitInstance = createAuthKitInstance(configuredConfig);
  }
  return authKitInstance;
}

// Export a configuration function for manual configuration
export function configureAuthKit(config: AuthKitConfig): void {
  configuredConfig = initializeConfig(config);
  configure(configuredConfig);
  authKitInstance = createAuthKitInstance(configuredConfig);
}

// Export the main authKit object with lazy initialization
export const authKit = {
  withAuth: <T>(handler: AuthenticatedHandler<T>) => createWithAuth(getAuthKitInstance())(handler),
  getUser: (event: RequestEvent) => createGetUser(getAuthKitInstance())(event),
  getSignInUrl: async (options?: SignInOptions) =>
    createGetSignInUrl(getAuthKitInstance())(options),
  getSignUpUrl: async (options?: SignInOptions) =>
    createGetSignUpUrl(getAuthKitInstance())(options),
  signOut: (event: RequestEvent) => createSignOut(getAuthKitInstance())(event),
  switchOrganization: (event: RequestEvent, options: { organizationId: string }) =>
    createSwitchOrganization(getAuthKitInstance())(event, options),
  handleCallback: () => createHandleCallback(getAuthKitInstance())(),
  refreshSession: (event: RequestEvent) => createRefreshSession(getAuthKitInstance())(event),
};

// Export the handle function for hooks with lazy initialization
export const authKitHandle = (options?: AuthKitHandleOptions) => createAuthKitHandle(getAuthKitInstance())(options);

