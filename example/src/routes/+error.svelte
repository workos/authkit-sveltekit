<script lang="ts">
	import { page } from '$app/stores';
</script>

<div class="error-container">
	<h1>{$page.status}</h1>
	<p>{$page.error?.message || 'An unexpected error occurred'}</p>
	
	{#if $page.status === 404}
		<a href="/" class="button primary">Go to homepage</a>
	{:else if $page.status === 401}
		<a href="/login" class="button primary">Sign in</a>
	{:else}
		<a href="/" class="button primary">Go to homepage</a>
	{/if}
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
		font-size: 3rem;
		font-weight: 800;
		margin: 0;
		color: var(--color-primary);
	}

	p {
		font-size: 1.25rem;
		color: var(--color-text-muted);
		margin: 0 0 var(--spacing-md) 0;
	}
</style>