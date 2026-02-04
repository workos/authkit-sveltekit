<script lang="ts">
  import { page } from '$app/stores';

  const errorMessages = {
    ACCESS_DENIED: 'Access was denied. Please try again or contact support.',
    AUTH_ERROR: 'An authentication error occurred. Please try again.',
    AUTH_FAILED: 'Authentication failed. Please try again.',
    DEFAULT: 'An error occurred during authentication.',
  } as const;

  $: errorCode = $page.url.searchParams.get('code') || 'DEFAULT';
  $: errorMessage = errorMessages[errorCode as keyof typeof errorMessages] || errorMessages.DEFAULT;
</script>

<div class="error-container">
  <h1>Authentication Error</h1>
  <p>{errorMessage}</p>
  <a href="/login" class="button primary">Try Again</a>
</div>

<style>
  .error-container {
    display: flex;
    flex-direction: column;
    align-items: center;
    text-align: center;
    gap: var(--spacing-md);
  }

  h1 {
    font-size: 2rem;
    font-weight: 800;
    margin: 0;
    color: var(--color-error);
  }

  p {
    font-size: 1.25rem;
    color: var(--color-text-muted);
    margin: 0 0 var(--spacing-md) 0;
  }
</style>
