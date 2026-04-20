import type { RequestEvent } from '@sveltejs/kit';

export function getRequestEvent(): RequestEvent {
  throw new Error('stub:$app/server — override via vi.mock in the test that needs it');
}
