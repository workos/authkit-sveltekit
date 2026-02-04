<script lang="ts">
  import '../app.css';
  import { page } from '$app/stores';
  import SignInButton from '$lib/components/SignInButton.svelte';
  import Footer from '$lib/components/Footer.svelte';
  let { data, children } = $props<{ data: import('./$types').LayoutData; children: import('svelte').Snippet }>();
</script>

<div class="app-container">
  <div class="content-wrapper">
    <div class="main-content">
      <div class="card">
        <header>
          <nav>
            <a href="/" class="button secondary" class:active={$page.url.pathname === '/'}>Home</a>
            <a href="/account" class="button secondary" class:active={$page.url.pathname === '/account'}>Account</a>
          </nav>

          <SignInButton user={data.user} />
        </header>

        <main>
          {@render children()}
        </main>
      </div>
    </div>

    <Footer />
  </div>
</div>

<style>
  .app-container {
    min-height: 100vh;
    background-color: #f7f7f7;
  }

  .content-wrapper {
    display: flex;
    flex-direction: column;
    gap: 1.25rem;
    padding: 1.25rem;
    min-height: 100vh;
    max-width: 1200px;
    margin: 0 auto;
  }

  .main-content {
    flex: 1;
  }

  .card {
    height: 100%;
    display: flex;
    flex-direction: column;
  }

  header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 2rem;
  }

  nav {
    display: flex;
    gap: 1rem;
  }

  nav .button.active {
    background: var(--color-primary);
    color: var(--color-white);
  }

  main {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
  }
</style>
