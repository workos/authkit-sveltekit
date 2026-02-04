<script lang="ts">
  import SignInButton from '$lib/components/SignInButton.svelte';

  let { data } = $props<{ data: import('./$types').PageData }>();
</script>

<div class="home-container">
  {#if data.user}
    <h1 class="title">Welcome back{data.user.firstName ? `, ${data.user.firstName}` : ''}</h1>
    <p class="subtitle">You are now authenticated into the application</p>
    <div class="actions">
      <a href="/account" class="button secondary">View account</a>
      <SignInButton user={data.user} large={true} />
    </div>
  {:else}
    <h1 class="title">AuthKit authentication example</h1>
    <p class="subtitle">Sign in to view your account details</p>
    <SignInButton user={null} large={true} />
  {/if}
</div>

<style>
  .home-container {
    display: flex;
    flex-direction: column;
    align-items: center;
    text-align: center;
    gap: var(--spacing-sm);
  }

  .actions {
    display: flex;
    align-items: center;
    gap: 0.75rem;
  }
</style>
