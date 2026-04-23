/**
 * Best-effort detection of a top-level document navigation.
 *
 * Used by `createWithAuth` to decide whether to write a PKCE verifier
 * cookie. Non-document requests (fetch/XHR/RSC/prefetch) can't follow
 * a cross-origin redirect to WorkOS, so a cookie write on those
 * requests is wasted and accumulates under the per-flow naming scheme
 * — which can blow past browser per-host cookie budgets into HTTP 431.
 *
 * Fails open: when signals are ambiguous or absent, treat the request
 * as a document. Worst case is one unneeded cookie bounded by the
 * 10-minute PKCE TTL.
 */
export function isDocumentRequest(headers: Headers): boolean {
  const dest = headers.get('sec-fetch-dest');
  if (dest) return dest === 'document';

  if (headers.get('x-requested-with')?.toLowerCase() === 'xmlhttprequest') {
    return false;
  }
  if (headers.get('purpose')?.toLowerCase() === 'prefetch') {
    return false;
  }

  const accept = headers.get('accept') ?? '';
  if (accept && !accept.includes('text/html') && !accept.includes('*/*')) {
    return false;
  }

  return true;
}
