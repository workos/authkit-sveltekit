# AuthKit SDK for SvelteKit

The official WorkOS AuthKit SDK for SvelteKit applications. Provides seamless authentication with minimal setup.

## Features

- 🚀 **Quick Setup** - Get authenticated in under 5 minutes
- 🔒 **Secure by Default** - Session-based auth with encrypted cookies
- 🎯 **Type Safe** - Full TypeScript support with IntelliSense
- 🏗️ **SvelteKit Native** - Built for SvelteKit's architecture
- 🎨 **Flexible** - Easy to customize and extend
- 🐛 **Developer Friendly** - Clear errors and debug mode

## Installation

```bash
npm install @workos/authkit-sveltekit
```

## Quick Start

### 1. Set Environment Variables

Create a `.env` file in your project root:

```env
WORKOS_CLIENT_ID=client_01234567890123456789012345
WORKOS_API_KEY=sk_test_1234567890
WORKOS_REDIRECT_URI=http://localhost:5173/auth/callback
WORKOS_COOKIE_PASSWORD=your-secure-password-at-least-32-chars
```

> **Note**: Generate a secure password using `openssl rand -base64 24`

### 2. Update `app.d.ts`

```typescript
/// <reference types="@sveltejs/kit" />

declare global {
  namespace App {
    interface Locals {
      auth: import('@workos/authkit-sveltekit').AuthKitAuth;
    }
  }
}

export {};
```

### 3. Add to `hooks.server.ts`

```typescript
import { configureAuthKit, authKitHandle } from '@workos/authkit-sveltekit';
import { env } from '$env/dynamic/private';

// Configure AuthKit with SvelteKit's environment variables
configureAuthKit({
  clientId: env.WORKOS_CLIENT_ID,
  apiKey: env.WORKOS_API_KEY,
  redirectUri: env.WORKOS_REDIRECT_URI,
  cookiePassword: env.WORKOS_COOKIE_PASSWORD,
});

export const handle = authKitHandle();
```

> **Note**: For simpler setups where you're using `process.env`, you can skip the `configureAuthKit` call and the SDK will automatically read from `process.env`.

### 4. Create Callback Route

Create `src/routes/auth/callback/+server.ts`:

```typescript
import { authKit } from '@workos/authkit-sveltekit';

export const GET = authKit.handleCallback();
```

### 5. Protect Routes

In any `+page.server.ts`:

```typescript
import { authKit } from '@workos/authkit-sveltekit';

export const load = authKit.withAuth(async ({ auth }) => {
  // auth.user is guaranteed to exist
  return {
    user: auth.user,
    organizationId: auth.organizationId,
    role: auth.role,
    permissions: auth.permissions,
  };
});
```

## API Reference

### Authentication Helpers

#### `authKit.withAuth(handler)`

Protect a route or action, redirecting unauthenticated users to sign in.

```typescript
export const load = authKit.withAuth(async ({ auth, ...event }) => {
  // Your authenticated logic here
});
```

#### `authKit.getUser(event)`

Get the current user (nullable).

```typescript
export const load = async (event) => {
  const user = await authKit.getUser(event);
  return { user };
};
```

#### `authKit.getSignInUrl(options)`

Get the WorkOS sign-in URL.

```typescript
const signInUrl = authKit.getSignInUrl({
  returnTo: '/dashboard',
  organizationId: 'org_123', // optional
  loginHint: 'user@example.com', // optional
});
```

#### `authKit.getSignUpUrl(options)`

Get the WorkOS sign-up URL.

```typescript
const signUpUrl = authKit.getSignUpUrl({
  returnTo: '/dashboard',
  organizationId: 'org_123', // optional
  loginHint: 'user@example.com', // optional
});
```

#### `authKit.signOut(event)`

Sign out the current user.

```typescript
export const actions = {
  signout: async (event) => {
    return authKit.signOut(event);
  },
};
```

### Hooks

#### `authKitHandle(options)`

SvelteKit handle function that manages authentication.

```typescript
export const handle = authKitHandle({
  debug: true, // Enable debug logging
  onError: (error) => console.error('Auth error:', error),
});
```

## Configuration

```typescript
interface AuthKitConfig {
  clientId: string; // WorkOS Client ID
  apiKey: string; // WorkOS API Key
  redirectUri: string; // OAuth redirect URI
  cookiePassword: string; // Cookie encryption password (min 32 chars)
  cookieName?: string; // Custom cookie name (default: 'wos-session')
  cookieDomain?: string; // Cookie domain restriction
  cookieMaxAge?: number; // Cookie max age in seconds (default: 400 days)
}
```

### Environment Variables

AuthKit supports multiple ways to configure environment variables in SvelteKit:

#### Option 1: Using SvelteKit's `$env` (Recommended)

```typescript
// hooks.server.ts
import { configureAuthKit, authKitHandle } from '@workos/authkit-sveltekit';
import { env } from '$env/dynamic/private';

configureAuthKit({
  clientId: env.WORKOS_CLIENT_ID,
  apiKey: env.WORKOS_API_KEY,
  redirectUri: env.WORKOS_REDIRECT_URI,
  cookiePassword: env.WORKOS_COOKIE_PASSWORD,
});

export const handle = authKitHandle();
```

#### Option 2: Using Static Environment Variables

```typescript
// hooks.server.ts
import { configureAuthKit, authKitHandle } from '@workos/authkit-sveltekit';
import { WORKOS_CLIENT_ID, WORKOS_API_KEY, WORKOS_REDIRECT_URI, WORKOS_COOKIE_PASSWORD } from '$env/static/private';

configureAuthKit({
  clientId: WORKOS_CLIENT_ID,
  apiKey: WORKOS_API_KEY,
  redirectUri: WORKOS_REDIRECT_URI,
  cookiePassword: WORKOS_COOKIE_PASSWORD,
});

export const handle = authKitHandle();
```

#### Option 3: Automatic Configuration (Node.js environments)

If your environment supports `process.env`, the SDK will automatically read configuration:

```typescript
// hooks.server.ts
import { authKitHandle } from '@workos/authkit-sveltekit';

// No configureAuthKit needed - reads from process.env automatically
export const handle = authKitHandle();
```

## Advanced Usage

### Organization Switching

```typescript
export const actions = {
  switchOrg: async (event) => {
    const formData = await event.request.formData();
    const orgId = formData.get('organizationId') as string;

    return authKit.switchOrganization(event, { organizationId: orgId });
  },
};
```

### Custom Sign-in Page

```svelte
<script lang="ts">
  import { authKit } from '@workos/authkit-sveltekit';

  // Note: These methods are async and should be called server-side
  // For client-side, pass the URL from a server load function
</script>

<!-- Use URLs generated server-side -->
<a href={data.signInUrl}>Sign In</a>
<a href={data.signUpUrl}>Sign Up</a>
```

Server-side load function:

```typescript
// +page.server.ts
import { authKit } from '@workos/authkit-sveltekit';

export const load = async () => {
  return {
    signInUrl: await authKit.getSignInUrl({ returnTo: '/dashboard' }),
    signUpUrl: await authKit.getSignUpUrl({ returnTo: '/dashboard' }),
  };
};
```

### Form Actions

Protect form actions the same way as load functions:

```typescript
export const actions = {
  update: authKit.withAuth(async ({ auth, request }) => {
    const formData = await request.formData();
    // Process authenticated form submission
  }),
};
```

## TypeScript

The SDK is fully typed. Access auth data with type safety:

```typescript
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
  if (locals.auth.user) {
    // TypeScript knows user exists and its shape
    console.log(locals.auth.user.email);
    console.log(locals.auth.organizationId);
    console.log(locals.auth.role);
    console.log(locals.auth.permissions);
    console.log(locals.auth.accessToken);
  }
};
```

## Debugging

Enable debug mode to see detailed logs:

```typescript
export const handle = authKitHandle({ debug: true });
```

## Error Handling

The SDK provides clear error messages:

```
Missing required environment variables: WORKOS_CLIENT_ID, WORKOS_API_KEY
Please add them to your .env file. See https://github.com/workos/authkit-sveltekit#setup for details.
```

## License

MIT - see [LICENSE](LICENSE) for details.
