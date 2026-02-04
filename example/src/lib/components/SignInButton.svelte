<script lang="ts">
  import type { User } from '@workos/authkit-sveltekit';

  let { user = null, large = false } = $props<{ user: User | null; large?: boolean }>();
</script>

{#if user}
  <form method="POST" action="/logout">
    <button type="submit" class="button primary" class:large>Sign Out</button>
  </form>
{:else}
  <a href="/login" class="button primary" class:large>
    Sign In{#if large}
      with AuthKit{/if}
  </a>
{/if}

<style>
  form {
    display: inline-block;
  }
</style>
