import type { SessionEncryption } from '@workos/authkit-session';
import { seal as sealData, unseal as unsealData } from 'iron-webcrypto';

/**
 * Session encryption implementation for SvelteKit
 * Compatible with iron-session format for cookie encryption
 */
export class SvelteKitSessionEncryption implements SessionEncryption {
  private readonly versionDelimiter = '~';
  private readonly currentMajorVersion = 2;

  // Iron-webcrypto options matching iron-session defaults
  private readonly ironOptions = {
    encryption: {
      saltBits: 256,
      algorithm: 'aes-256-cbc' as const,
      iterations: 1,
      minPasswordlength: 32,
    },
    integrity: {
      saltBits: 256,
      algorithm: 'sha256' as const,
      iterations: 1,
      minPasswordlength: 32,
    },
    ttl: 0,
    timestampSkewSec: 60,
    localtimeOffsetMsec: 0,
  };

  /**
   * Parse a seal to extract version information
   */
  private parseSeal(seal: string): {
    sealWithoutVersion: string;
    tokenVersion: number | null;
  } {
    const [sealWithoutVersion = '', tokenVersionAsString] = seal.split(this.versionDelimiter);
    const tokenVersion = tokenVersionAsString == null ? null : parseInt(tokenVersionAsString, 10);
    return { sealWithoutVersion, tokenVersion };
  }

  /**
   * Encrypt session data using iron-webcrypto
   */
  async sealData(
    data: unknown,
    { password, ttl = 0 }: { password: string; ttl?: number }
  ): Promise<string> {
    // Format password as iron-session expects
    const passwordObj = {
      id: '1',
      secret: password,
    };

    // Seal the data
    const seal = await sealData(globalThis.crypto, data, passwordObj, {
      ...this.ironOptions,
      ttl: ttl * 1000, // Convert seconds to milliseconds
    });

    // Add version delimiter
    return `${seal}${this.versionDelimiter}${this.currentMajorVersion}`;
  }

  /**
   * Decrypt session data using iron-webcrypto
   */
  async unsealData<T = unknown>(
    encryptedData: string,
    { password }: { password: string }
  ): Promise<T> {
    // Parse the seal to extract version
    const { sealWithoutVersion, tokenVersion } = this.parseSeal(encryptedData);

    // Format password as a map like iron-session expects
    const passwordMap = { 1: password };

    // Unseal the data
    const data = await unsealData(
      globalThis.crypto,
      sealWithoutVersion,
      passwordMap,
      this.ironOptions
    );

    // Handle version differences if needed
    if (tokenVersion === 2) {
      return data as T;
    } else if (tokenVersion !== null) {
      // For older versions, extract the persistent property
      return { ...(data as any).persistent } as T;
    }

    return data as T;
  }
}

