<script lang="ts">
  let { data } = $props<{ data: import('./$types').PageData }>();

  let userFields = $derived(
    data.user
      ? [
          ['First name', data.user.firstName],
          ['Last name', data.user.lastName],
          ['Email', data.user.email],
          ...(data.role ? [['Role', data.role]] : []),
          ...(data.permissions?.length ? [['Permissions', data.permissions.join(', ')]] : []),
          ['Id', data.user.id],
        ].filter((field) => Boolean(field[1]))
      : [],
  );
</script>

<div class="account-container">
  <div class="text-center">
    <h1 class="title">Account details</h1>
    <p class="subtitle">Below are your account details</p>
  </div>

  {#if userFields.length > 0}
    <div class="fields">
      {#each userFields as [label, value]}
        <label class="field">
          <span class="label">{label}</span>
          <input type="text" value={String(value)} readonly />
        </label>
      {/each}
    </div>
  {/if}
</div>

<style>
  .account-container {
    display: flex;
    flex-direction: column;
    gap: var(--spacing-sm);
    max-width: 400px;
    width: 100%;
    margin: 0 auto;
  }

  .fields {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
    margin-top: var(--spacing-xl);
  }

  .field {
    display: flex;
    align-items: center;
    gap: var(--spacing-lg);
  }

  .label {
    font-weight: 700;
    font-size: 0.875rem;
    min-width: 100px;
    text-align: right;
  }

  .field input {
    flex: 1;
  }
</style>
