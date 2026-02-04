# AuthKit SvelteKit

The AuthKit library for SvelteKit provides convenient helpers for authentication and session management using WorkOS & AuthKit with SvelteKit.

[![npm version](https://badge.fury.io/js/@workos-inc%2Fauthkit-sveltekit.svg)](https://www.npmjs.com/package/@workos-inc/authkit-sveltekit)
[![TypeScript](https://img.shields.io/badge/TypeScript-ready-blue.svg)](https://www.typescriptlang.org/)

## ✨ Features

- **🚀 5-minute setup** - Complete authentication in 3 files
- **🔒 Secure by default** - Production-ready security settings
- **📱 Platform agnostic** - Works on Node.js, Cloudflare Workers, Vercel Edge
- **🎯 Type-safe** - Full TypeScript support with auto-completion
- **⚡ Zero config** - Works with environment variables out of the box
- **🧩 SvelteKit native** - Feels like a built-in SvelteKit feature

## Installation

Install the package with:

```bash
npm install @workos-inc/authkit-sveltekit
```

or

```bash
yarn add @workos-inc/authkit-sveltekit
```

## Pre-flight

Make sure the following values are present in your `.env` environment variables file. The client ID and API key can be found in the [WorkOS dashboard](https://dashboard.workos.com), and the redirect URI can also be configured there.

```bash
WORKOS_CLIENT_ID="client_..." # retrieved from the WorkOS dashboard
WORKOS_API_KEY="sk_test_..." # retrieved from the WorkOS dashboard
WORKOS_COOKIE_PASSWORD="<your password>" # generate a secure password here
WORKOS_REDIRECT_URI="http://localhost:5173/callback" # configured in the WorkOS dashboard
```

`WORKOS_COOKIE_PASSWORD` is the private key used to encrypt the session cookie. It has to be at least 32 characters long. You can use the [1Password generator](https://1password.com/password-generator/) or the `openssl` library to generate a strong password via the command line:

```bash
openssl rand -base64 32
```

### Optional configuration

Certain environment variables are optional and can be used to debug or configure cookie settings.

| Environment Variable     | Default Value         | Description                                                                        |
| ------------------------ | --------------------- | ---------------------------------------------------------------------------------- |
| `WORKOS_COOKIE_MAX_AGE`  | `34560000` (400 days) | Maximum age of the cookie in seconds                                               |
| `WORKOS_COOKIE_DOMAIN`   | None                  | Domain for the cookie. When empty, the cookie is only valid for the current domain |
| `WORKOS_COOKIE_NAME`     | `'workos_session'`    | Name of the session cookie                                                         |
| `WORKOS_COOKIE_SAMESITE` | `'lax'`               | SameSite attribute for cookies. Options: `'lax'`, `'strict'`, or `'none'`          |

Example usage:

```bash
WORKOS_COOKIE_MAX_AGE='600'
WORKOS_COOKIE_DOMAIN='example.com'
WORKOS_COOKIE_NAME='my-auth-cookie'
```

> [!WARNING]
> Setting `WORKOS_COOKIE_SAMESITE='none'` allows cookies to be sent in cross-origin contexts (like iframes), but reduces protection against CSRF attacks. This setting forces cookies to be secure (HTTPS only) and should only be used when absolutely necessary for your application architecture.

> [!TIP]
> `WORKOS_COOKIE_DOMAIN` can be used to share WorkOS sessions between apps/domains. Note: The `WORKOS_COOKIE_PASSWORD` would need to be the same across apps/domains. Not needed for most use cases.

## Setup

### 1. Configure authentication hook

Create or update your `src/hooks.server.ts` file:

```typescript
import { createAuthKitHandle } from '@workos-inc/authkit-sveltekit';

export const handle = createAuthKitHandle();
```

For advanced configuration:

```typescript
import { createAuthKitHandle } from '@workos-inc/authkit-sveltekit';

export const handle = createAuthKitHandle({
  protectedPaths: ['/dashboard', '/admin'],
  excludePaths: ['/login', '/logout', '/callback', '/public'],
  loginPath: '/auth/signin',
});
```

### 2. Add type safety

Add the following to your `src/app.d.ts` file:

```typescript
import type { AuthLocals } from '@workos-inc/authkit-sveltekit';

declare global {
  namespace App {
    interface Locals extends AuthLocals {}
    // ... your other type definitions
  }
}

export {};
```

### 3. Add authentication routes

#### Login route

Create `src/routes/login/+server.ts`:

```typescript
export { GET } from '@workos-inc/authkit-sveltekit/login';
```

For custom configuration:

```typescript
import { loginHandler } from '@workos-inc/authkit-sveltekit';

export const GET = loginHandler({
  screenHint: 'sign-in', // or 'sign-up'
});
```

#### Logout route

Create `src/routes/logout/+server.ts`:

```typescript
export { POST } from '@workos-inc/authkit-sveltekit/logout';
```

#### Callback route

Create `src/routes/callback/+server.ts`:

```typescript
export { GET } from '@workos-inc/authkit-sveltekit/callback';
```

For custom success handling:

```typescript
import { callbackHandler } from '@workos-inc/authkit-sveltekit';

export const GET = callbackHandler({
  onSuccess: async (user, session) => {
    // Custom logic after successful authentication
    console.log(`User ${user.email} signed in`);
  },
});
```

## Usage

### Get the current user in server components

Use the authentication data that's automatically populated in `locals`:

```svelte
<!-- src/routes/+page.svelte -->
<script>
  import { page } from '$app/stores';

  $: user = $page.data.user;
</script>

{#if user}
  <h1>Welcome back, {user.firstName}!</h1>
  <form method="POST" action="/logout">
    <button type="submit">Sign Out</button>
  </form>
{:else}
  <a href="/login">Sign In</a>
{/if}
```

In your `+layout.server.ts`:

```typescript
import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = async ({ locals }) => {
  return {
    user: locals.user,
  };
};
```

### Using pre-built components

AuthKit SvelteKit provides ready-to-use Svelte components:

```svelte
<script>
  import { SignInButton, SignOutButton, UserProfile } from '@workos-inc/authkit-sveltekit/components';
  import { page } from '$app/stores';

  $: user = $page.data.user;
</script>

{#if user}
  <UserProfile {user} />
  <SignOutButton />
{:else}
  <SignInButton screenHint="sign-up">Create Account</SignInButton>
{/if}
```

#### Component customization

```svelte
<!-- Custom sign-in button -->
<SignInButton screenHint="sign-up" class="btn btn-primary">Create Your Account</SignInButton>

<!-- User profile with custom template -->
<UserProfile {user} let:user>
  <div class="profile">
    <img src={user.profilePictureUrl} alt="Profile" />
    <span>{user.firstName} {user.lastName}</span>
    <small>{user.email}</small>
  </div>
</UserProfile>
```

### Reactive stores

Use reactive stores for client-side authentication state:

```svelte
<script>
  import { authUser, isAuthenticated } from '@workos-inc/authkit-sveltekit/stores';
</script>

{#if $isAuthenticated}
  <p>Welcome back, {$authUser.firstName}!</p>
{:else}
  <p>Please sign in to continue.</p>
{/if}
```

### Protecting pages

#### Server-side protection

Use `requireAuth` to protect page load functions:

```typescript
// src/routes/dashboard/+page.server.ts
import { requireAuth } from '@workos-inc/authkit-sveltekit';

export const load = requireAuth(async ({ locals }) => {
  // locals.user is guaranteed to exist and fully typed
  return {
    user: locals.user,
    dashboardData: await fetchDashboardData(locals.user.id),
  };
});
```

#### API route protection

Protect API endpoints with `withAuth`:

```typescript
// src/routes/api/user/+server.ts
import { json } from '@sveltejs/kit';
import { withAuth } from '@workos-inc/authkit-sveltekit';

export const GET = withAuth(async ({ locals }) => {
  return json({
    user: locals.user,
    timestamp: new Date().toISOString(),
  });
});
```

### Advanced configuration

#### Custom handle options

```typescript
// src/hooks.server.ts
import { createAuthKitHandle } from '@workos-inc/authkit-sveltekit';

export const handle = createAuthKitHandle({
  protectedPaths: ['/dashboard', '/admin'],
  excludePaths: ['/login', '/logout', '/callback', '/api/public'],
  loginPath: '/auth/signin',
  populateLocals: true,
});
```

#### Environment-based configuration

```typescript
// src/hooks.server.ts
import { createAuthKitHandle, loadAuthKitEnv } from '@workos-inc/authkit-sveltekit';

const config = loadAuthKitEnv(); // Loads from WORKOS_* environment variables

export const handle = createAuthKitHandle({
  ...config,
  protectedPaths: ['/dashboard'],
});
```

### Organization support

Access organization data through locals:

```typescript
// src/routes/dashboard/+page.server.ts
export const load = requireAuth(async ({ locals }) => {
  const { user, organizationId, role, permissions } = locals;

  return {
    user,
    organization: organizationId ? await getOrganization(organizationId) : null,
    userRole: role,
    userPermissions: permissions,
  };
});
```

### Refreshing sessions

Refresh user sessions to get the latest data:

```svelte
<script>
  import { invalidateAll } from '$app/navigation';

  async function refreshSession() {
    // Trigger a refresh of all load functions
    await invalidateAll();
  }
</script>

<button on:click={refreshSession}>Refresh Session</button>
```

### Error handling

Handle authentication errors gracefully:

```typescript
// src/routes/api/protected/+server.ts
import { json, error } from '@sveltejs/kit';
import { withAuth } from '@workos-inc/authkit-sveltekit';

export const GET = withAuth(async ({ locals }) => {
  try {
    const data = await fetchSensitiveData(locals.user.id);
    return json(data);
  } catch (err) {
    console.error('API error:', err);
    throw error(500, 'Failed to fetch data');
  }
});
```

## Deployment

### Vercel

Add environment variables to your Vercel deployment:

```bash
vercel env add WORKOS_CLIENT_ID
vercel env add WORKOS_API_KEY
vercel env add WORKOS_REDIRECT_URI
vercel env add WORKOS_COOKIE_PASSWORD
```

### Cloudflare Pages

Add to your `wrangler.toml`:

```toml
[vars]
WORKOS_CLIENT_ID = "your_client_id"
WORKOS_REDIRECT_URI = "https://your-app.pages.dev/callback"

# Add secrets using wrangler
# npx wrangler secret put WORKOS_API_KEY
# npx wrangler secret put WORKOS_COOKIE_PASSWORD
```

### Netlify

Add environment variables in your Netlify dashboard or `netlify.toml`:

```toml
[build.environment]
WORKOS_CLIENT_ID = "your_client_id"
WORKOS_REDIRECT_URI = "https://your-app.netlify.app/callback"
```

### Docker

```dockerfile
# In your Dockerfile
ENV WORKOS_CLIENT_ID=your_client_id
ENV WORKOS_REDIRECT_URI=https://your-app.com/callback
```

## Advanced usage

### Custom authentication flows

For advanced use cases, you can access the underlying session manager:

```typescript
import { getSessionManager } from '@workos-inc/authkit-sveltekit';

// In a server-side context
const sessionManager = getSessionManager();
const authResult = await sessionManager.withAuth(request);
```

### Direct WorkOS client access

Access the WorkOS client directly for advanced operations:

```typescript
import { getWorkOS } from '@workos-inc/authkit-ssr';

const workos = getWorkOS();
const organizations = await workos.organizations.listOrganizations({
  limit: 10,
});
```

### Custom session storage

Implement custom session storage for special deployment needs:

```typescript
import { createSvelteKitAuthKit, SvelteKitStorage } from '@workos-inc/authkit-sveltekit';

class CustomStorage extends SvelteKitStorage {
  // Override storage methods for custom behavior
}

const sessionManager = createSvelteKitAuthKit({
  storage: new CustomStorage(config),
});
```

## API Reference

### Types

```typescript
// Re-exported from @workos-inc/node
export type { User, Impersonator } from '@workos-inc/node';

// Re-exported from @workos-inc/authkit-ssr
export type { AuthResult, Session } from '@workos-inc/authkit-ssr';

// SvelteKit-specific types
export interface AuthLocals {
  user: User | null;
  sessionId?: string;
  organizationId?: string;
  role?: string;
  permissions?: string[];
  impersonator?: Impersonator;
  accessToken?: string;
}
```

### Functions

| Function                          | Description                             |
| --------------------------------- | --------------------------------------- |
| `createAuthKitHandle(options?)`   | Creates SvelteKit handle function       |
| `requireAuth(loadFn, loginPath?)` | Wraps load functions to require auth    |
| `withAuth(handler)`               | Wraps API handlers to require auth      |
| `loadAuthKitEnv(prefix?)`         | Loads config from environment variables |

### Components

| Component       | Props                                  | Description               |
| --------------- | -------------------------------------- | ------------------------- |
| `SignInButton`  | `screenHint?, returnPathname?, class?` | Pre-built sign-in button  |
| `SignOutButton` | `returnTo?, class?`                    | Pre-built sign-out button |
| `UserProfile`   | `user, children?`                      | User profile display      |

### Stores

| Store                 | Type                             | Description           |
| --------------------- | -------------------------------- | --------------------- |
| `authUser`            | `Readable<User \| null>`         | Current user state    |
| `isAuthenticated`     | `Readable<boolean>`              | Authentication status |
| `userOrganizations`   | `Readable<Organization[]>`       | User's organizations  |
| `currentOrganization` | `Readable<Organization \| null>` | Current organization  |

## Examples

Check out our examples for different use cases:

- [**Minimal Setup**](./examples/minimal) - Get started in 5 minutes
- [**Organizations**](./examples/with-organizations) - Multi-tenant applications
- [**Role-based Access**](./examples/with-roles) - Permission-based routing
- [**Cloudflare Pages**](./examples/cloudflare-pages) - Edge deployment

## Migration

### From manual implementation

If you're migrating from a manual WorkOS implementation:

1. Replace your custom hooks.server.ts with `createAuthKitHandle()`
2. Replace manual route handlers with the provided exports
3. Update your app.d.ts to extend `AuthLocals`
4. Replace manual session checks with `requireAuth` and `withAuth`

### Configuration mapping

| Old Pattern               | New Pattern                                                 |
| ------------------------- | ----------------------------------------------------------- |
| Custom session management | `createAuthKitHandle()`                                     |
| Manual login routes       | `export { GET } from '@workos-inc/authkit-sveltekit/login'` |
| Custom auth checks        | `requireAuth()`, `withAuth()`                               |
| Manual user state         | `$page.data.user`, stores                                   |

## Troubleshooting

### Common issues

#### "SessionManager not initialized" error

- Ensure all environment variables are set correctly
- Verify `WORKOS_COOKIE_PASSWORD` is 32+ characters
- Restart your development server after adding environment variables

#### Authentication redirects not working

- Check that `WORKOS_REDIRECT_URI` matches your callback route exactly
- Ensure the callback route (`/callback/+server.ts`) is properly configured
- Verify the redirect URI is configured in your WorkOS dashboard

#### TypeScript errors

- Ensure you've extended `AuthLocals` in your `app.d.ts` file
- Restart your TypeScript language server
- Check that you're importing types from the correct paths

#### Cookies not being set

- Verify your application is running on the same domain as configured
- Check cookie security settings in production vs development
- Ensure `WORKOS_COOKIE_DOMAIN` is correctly configured if set

### Debug mode

Enable debug logging to troubleshoot issues:

```typescript
// src/hooks.server.ts
import { createAuthKitHandle } from '@workos-inc/authkit-sveltekit';

export const handle = createAuthKitHandle({
  debug: true, // Enable debug logs
});
```

### Getting help

- [Documentation](https://workos.com/docs)
- [GitHub Issues](https://github.com/workos/authkit-sveltekit/issues)
- [WorkOS Support](https://workos.com/support)
- [Community Discord](https://discord.gg/workos)

## Contributing

We welcome contributions! Please see our [Contributing Guide](CONTRIBUTING.md) for details.

## License

MIT © [WorkOS](https://workos.com)
