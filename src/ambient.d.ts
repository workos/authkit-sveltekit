import type { AuthKitAuth } from './types.js';

declare global {
  namespace App {
    interface Locals {
      auth: AuthKitAuth;
    }
  }
}

export {};
