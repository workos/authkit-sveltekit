import { authKit } from '@workos/authkit-sveltekit';
import type { RequestHandler } from './$types.js';

export const POST: RequestHandler = async (event) => {
	return authKit.signOut(event);
};
