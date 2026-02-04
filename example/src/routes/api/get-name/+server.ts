import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types.js';

export const GET: RequestHandler = async ({ locals }) => {
	const user = locals.auth.user!;
	return json({ 
		name: user.firstName || 'Unknown',
		email: user.email,
		id: user.id
	});
};
