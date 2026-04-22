import type { Cookies, RequestEvent } from '@sveltejs/kit';
import type { HeadersBag } from '@workos/authkit-session';
import * as setCookie from 'set-cookie-parser';

type SvelteKitCookieOptions = Parameters<Cookies['set']>[2];
type SameSite = 'lax' | 'strict' | 'none';
type Priority = 'low' | 'medium' | 'high';

// `set-cookie-parser`'s typings (DefinitelyTyped @2.x) predate `partitioned`
// and `priority`; v3 runtime populates them via the generic branch, so widen
// the parsed-cookie shape locally.
type ParsedCookie = setCookie.Cookie & {
  partitioned?: boolean;
  priority?: string;
};

function normalizeSameSite(value: string | undefined): SameSite | undefined {
  const lowered = value?.toLowerCase();
  return lowered === 'lax' || lowered === 'strict' || lowered === 'none' ? lowered : undefined;
}

function normalizePriority(value: string | undefined): Priority | undefined {
  const lowered = value?.toLowerCase();
  return lowered === 'low' || lowered === 'medium' || lowered === 'high' ? lowered : undefined;
}

function collectSetCookies(response?: Response, headers?: HeadersBag): string[] {
  if (response) {
    const fromResponse = response.headers.getSetCookie();
    if (fromResponse.length > 0) return fromResponse;
  }
  if (headers) {
    const sc = headers['Set-Cookie'] ?? headers['set-cookie'];
    if (Array.isArray(sc)) return sc;
    if (sc) return [sc];
  }
  return [];
}

/**
 * Forward `Set-Cookie` headers onto `event.cookies`. SvelteKit folds those
 * into the final response whether the handler returns a `Response` or throws
 * `redirect(...)`. `response` wins over `headers` when both carry cookies —
 * authkit-session only populates one at a time.
 */
export function applyCookies(event: RequestEvent, response?: Response, headers?: HeadersBag): void {
  for (const raw of collectSetCookies(response, headers)) {
    const parsed = setCookie.parseString(raw) as ParsedCookie;
    // authkit-session always emits a Path attribute (see
    // CookieSessionStorage.serializeCookie), so the SvelteKit `path: string`
    // invariant holds.
    const options: SvelteKitCookieOptions = {
      path: parsed.path ?? '/',
      domain: parsed.domain,
      maxAge: parsed.maxAge,
      expires: parsed.expires,
      httpOnly: parsed.httpOnly,
      secure: parsed.secure,
      sameSite: normalizeSameSite(parsed.sameSite),
      priority: normalizePriority(parsed.priority),
      partitioned: parsed.partitioned,
    };
    event.cookies.set(parsed.name, parsed.value, options);
  }
}

/**
 * `Set-Cookie` values in a `string[]` MUST be appended individually — never
 * comma-joined, which is not a valid single HTTP header.
 */
export function appendHeaderBag(headers: Headers, bag?: HeadersBag): void {
  if (!bag) return;
  for (const [key, value] of Object.entries(bag)) {
    const values = Array.isArray(value) ? value : [value];
    for (const v of values) headers.append(key, v);
  }
}
