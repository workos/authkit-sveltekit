import { configure, createAuthService } from '@workos/authkit-session';
import { SvelteKitStorage } from './server/adapters/storage.js';
import type { AuthKitConfig } from './types.js';

type AuthKitInstance = ReturnType<typeof createAuthService<Request, Response>>;

let authKitInstance: AuthKitInstance | null = null;
let configuredConfig: AuthKitConfig | null = null;

const REQUIRED_CONFIG_FIELDS = [
  { key: 'clientId', envVar: 'WORKOS_CLIENT_ID' },
  { key: 'apiKey', envVar: 'WORKOS_API_KEY' },
  { key: 'redirectUri', envVar: 'WORKOS_REDIRECT_URI' },
  { key: 'cookiePassword', envVar: 'WORKOS_COOKIE_PASSWORD' },
] as const;

function validateConfig(config: AuthKitConfig): void {
  const missing = REQUIRED_CONFIG_FIELDS.filter((field) => !config[field.key as keyof AuthKitConfig]).map(
    (field) => field.envVar,
  );

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
        `export const handle = authKitHandle();`,
    );
  }

  if (config.cookiePassword.length < 32) {
    throw new Error(
      'cookiePassword must be at least 32 characters long.\n' +
        'Generate a secure password using: openssl rand -base64 24',
    );
  }
}

function initializeConfig(providedConfig?: AuthKitConfig): AuthKitConfig {
  if (providedConfig) {
    validateConfig(providedConfig);
    return providedConfig;
  }

  // Fall back to process.env for simple setups that skip `configureAuthKit`.
  const config: AuthKitConfig = {
    clientId: process.env.WORKOS_CLIENT_ID || '',
    apiKey: process.env.WORKOS_API_KEY || '',
    redirectUri: process.env.WORKOS_REDIRECT_URI || '',
    cookiePassword: process.env.WORKOS_COOKIE_PASSWORD || '',
  };

  validateConfig(config);
  return config;
}

function createAuthKitInstance(config: AuthKitConfig): AuthKitInstance {
  return createAuthService<Request, Response>({
    sessionStorageFactory: () => new SvelteKitStorage(config),
  });
}

export function getAuthKitInstance(): AuthKitInstance {
  if (!authKitInstance) {
    if (!configuredConfig) {
      configuredConfig = initializeConfig();
    }
    configure(configuredConfig);
    authKitInstance = createAuthKitInstance(configuredConfig);
  }
  return authKitInstance;
}

export function configureAuthKit(config: AuthKitConfig): void {
  configuredConfig = initializeConfig(config);
  configure(configuredConfig);
  authKitInstance = createAuthKitInstance(configuredConfig);
}
