import type { PageServerLoad } from './$types.js';

export const load: PageServerLoad = async ({ locals }) => {
  return {
    user: locals.auth.user!,
    role: locals.auth.role,
    permissions: locals.auth.permissions,
  };
};
