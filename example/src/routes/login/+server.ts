import { authKit } from '@workos/authkit-sveltekit';
import { redirect } from '@sveltejs/kit';
import type { RequestHandler } from './$types.js';

export const GET: RequestHandler = async (event) => {
  const returnPathname = event.url.searchParams.get('returnPathname') || '/';
  const signInUrl = await authKit.getSignInUrl(event, { returnTo: returnPathname });
  throw redirect(302, signInUrl);
};
