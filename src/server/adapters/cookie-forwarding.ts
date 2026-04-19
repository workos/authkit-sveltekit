import type { RequestEvent } from '@sveltejs/kit';
import type { HeadersBag } from '@workos/authkit-session';

/**
 * Options accepted by SvelteKit's `cookies.set`. Kept as a local alias
 * rather than importing from `@sveltejs/kit` to avoid pulling the full
 * internal type graph for a narrow shape we only use to forward
 * attributes parsed out of a `Set-Cookie` header.
 */
export interface ParsedCookieOptions {
  path?: string;
  domain?: string;
  maxAge?: number;
  expires?: Date;
  httpOnly?: boolean;
  secure?: boolean;
  sameSite?: 'lax' | 'strict' | 'none';
  priority?: 'low' | 'medium' | 'high';
  partitioned?: boolean;
}

export interface ParsedSetCookie {
  name: string;
  value: string;
  options: ParsedCookieOptions;
}

/**
 * Parse a single `Set-Cookie` response header.
 *
 * Handles the attribute set we actually emit from authkit-session:
 * Path, Domain, Max-Age, Expires, HttpOnly, Secure, SameSite, Priority,
 * Partitioned. The cookie value is percent-decoded so downstream calls
 * to `event.cookies.set` (which re-encodes) don't double-encode.
 *
 * Intentionally does NOT use the `cookie` npm package — that parser is
 * for request-side `Cookie` headers and does not understand the
 * response-side attributes above.
 */
export function parseSetCookieHeader(raw: string): ParsedSetCookie {
  const parts = raw.split(';');
  const first = parts.shift() ?? '';
  const eq = first.indexOf('=');
  const name = (eq === -1 ? first : first.slice(0, eq)).trim();
  const rawValue = eq === -1 ? '' : first.slice(eq + 1).trim();
  const value = rawValue.includes('%') ? safeDecode(rawValue) : rawValue;

  const options: ParsedCookieOptions = {};

  for (const part of parts) {
    const trimmed = part.trim();
    if (!trimmed) continue;
    const equalsAt = trimmed.indexOf('=');
    const key = (equalsAt === -1 ? trimmed : trimmed.slice(0, equalsAt)).trim().toLowerCase();
    const val = equalsAt === -1 ? '' : trimmed.slice(equalsAt + 1).trim();

    switch (key) {
      case 'path':
        options.path = val;
        break;
      case 'domain':
        options.domain = val;
        break;
      case 'max-age': {
        const n = Number(val);
        if (Number.isFinite(n)) options.maxAge = n;
        break;
      }
      case 'expires': {
        const d = new Date(val);
        if (!Number.isNaN(d.getTime())) options.expires = d;
        break;
      }
      case 'httponly':
        options.httpOnly = true;
        break;
      case 'secure':
        options.secure = true;
        break;
      case 'samesite': {
        const lowered = val.toLowerCase();
        if (lowered === 'lax' || lowered === 'strict' || lowered === 'none') {
          options.sameSite = lowered;
        }
        break;
      }
      case 'priority': {
        const lowered = val.toLowerCase();
        if (lowered === 'low' || lowered === 'medium' || lowered === 'high') {
          options.priority = lowered;
        }
        break;
      }
      case 'partitioned':
        options.partitioned = true;
        break;
      default:
        break;
    }
  }

  return { name, value, options };
}

function safeDecode(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

/**
 * Forward `Set-Cookie` headers returned from an authkit-session call
 * onto the current `RequestEvent.cookies`. SvelteKit then folds those
 * cookies into the final response — this works whether the handler
 * returns a `Response` or throws `redirect(...)`.
 *
 * Reads from the response object (preferred, standard Web API) and
 * falls back to the `HeadersBag` when the library routed via headers
 * instead. Each `Set-Cookie` entry is applied individually via
 * `event.cookies.set` — no comma-join collapse.
 */
export function applyCookies(event: RequestEvent, mutated?: Response, headers?: HeadersBag): void {
  const setCookieValues: string[] = [];

  if (mutated) {
    setCookieValues.push(...mutated.headers.getSetCookie());
  }

  if (headers) {
    const sc = headers['Set-Cookie'] ?? headers['set-cookie'];
    if (Array.isArray(sc)) setCookieValues.push(...sc);
    else if (sc) setCookieValues.push(sc);
  }

  for (const raw of setCookieValues) {
    const parsed = parseSetCookieHeader(raw);
    // SvelteKit's `Cookies.set` requires `path: string`. authkit-session always
    // emits a Path attribute (see CookieSessionStorage.serializeCookie); the cast
    // reflects that invariant without polluting `ParsedCookieOptions`.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    event.cookies.set(parsed.name, parsed.value, parsed.options as any);
  }
}

/**
 * Append every entry of a `HeadersBag` onto a `Headers` object.
 *
 * `Set-Cookie` values that arrive as `string[]` MUST be appended one at
 * a time — never comma-joined, which is not a valid single HTTP header.
 */
export function appendHeaderBag(headers: Headers, bag?: HeadersBag): void {
  if (!bag) return;
  for (const [key, value] of Object.entries(bag)) {
    const values = Array.isArray(value) ? value : [value];
    for (const v of values) headers.append(key, v);
  }
}
