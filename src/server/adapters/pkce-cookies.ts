import type { Cookies } from '@sveltejs/kit';
import type { GetAuthorizationUrlResult, PKCECookieOptions } from '@workos/authkit-session';

/**
 * Write the PKCE verifier cookie to `event.cookies` using the options
 * produced by `getAuthorizationUrl`. SvelteKit folds `event.cookies` into
 * the final response, so this works whether the caller returns a Response
 * or throws a `redirect(...)`.
 */
export function setPKCECookie(
  cookies: Cookies,
  result: Pick<GetAuthorizationUrlResult, 'sealedState' | 'cookieOptions'>,
): void {
  const opts = result.cookieOptions;
  cookies.set(opts.name, result.sealedState, toSvelteKitCookieOptions(opts));
}

/**
 * Delete the PKCE verifier cookie. MUST be called on every exit path of the
 * callback handler (success AND failure) so a single bad callback can't
 * leave a stale verifier binding the next sign-in attempt.
 */
export function deletePKCECookie(cookies: Cookies, opts: PKCECookieOptions): void {
  cookies.delete(opts.name, {
    path: opts.path,
    ...(opts.domain ? { domain: opts.domain } : {}),
  });
}

function toSvelteKitCookieOptions(opts: PKCECookieOptions) {
  return {
    path: opts.path,
    httpOnly: opts.httpOnly,
    secure: opts.secure,
    sameSite: opts.sameSite,
    maxAge: opts.maxAge,
    ...(opts.domain ? { domain: opts.domain } : {}),
  };
}
