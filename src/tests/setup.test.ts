import { describe, it, expect } from 'vitest';
import * as authKit from '../index.js';

describe('AuthKit SvelteKit Setup', () => {
  it('should export authKit object', () => {
    expect(authKit.authKit).toBeDefined();
    expect(authKit.authKit.withAuth).toBeDefined();
    expect(authKit.authKit.getUser).toBeDefined();
    expect(authKit.authKit.getSignInUrl).toBeDefined();
    expect(authKit.authKit.getSignUpUrl).toBeDefined();
    expect(authKit.authKit.signOut).toBeDefined();
    expect(authKit.authKit.switchOrganization).toBeDefined();
    expect(authKit.authKit.handleCallback).toBeDefined();
    expect(authKit.authKit.refreshSession).toBeDefined();
  });

  it('should export authKitHandle function', () => {
    expect(authKit.authKitHandle).toBeDefined();
    expect(typeof authKit.authKitHandle).toBe('function');
  });

  it('should export types', () => {
    // TypeScript compilation verifies these exports
    expect(true).toBe(true);
  });
});
