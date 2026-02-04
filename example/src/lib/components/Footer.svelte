<div class="footer-grid">
	<a href="https://workos.com/docs" target="_blank" rel="noreferrer" class="footer-card">
		<h4>Documentation</h4>
		<p>View integration guides and SDK documentation.</p>
	</a>

	<a href="https://workos.com/docs/reference" target="_blank" rel="noreferrer" class="footer-card">
		<h4>API Reference</h4>
		<p>Every WorkOS API method and endpoint documented.</p>
	</a>

	<a href="https://workos.com" target="_blank" rel="noreferrer" class="footer-card">
		<h4>WorkOS</h4>
		<p>Learn more about other WorkOS products.</p>
	</a>
</div>

<style>
	.footer-grid {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
		gap: 1.25rem;
	}

	.footer-card {
		background: var(--color-white);
		padding: var(--spacing-xl);
		border-radius: var(--radius-md);
		text-decoration: none;
		color: inherit;
		transition: all var(--transition-fast);
		border: 1px solid var(--color-border);
	}

	.footer-card:hover {
		transform: translateY(-2px);
		box-shadow: var(--shadow-md);
	}

	h4 {
		font-size: 1rem;
		font-weight: 600;
		margin: 0 0 0.25rem 0;
	}

	p {
		font-size: 0.875rem;
		color: var(--color-text-muted);
		margin: 0;
		line-height: 1.5;
	}

	@media (max-width: 640px) {
		.footer-grid {
			grid-template-columns: 1fr;
		}
	}
</style>
