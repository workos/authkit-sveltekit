import { describe, it, expect } from 'vitest';
import { isDocumentRequest } from './isDocumentRequest.js';

function h(entries: Record<string, string>): Headers {
  return new Headers(entries);
}

describe('isDocumentRequest', () => {
  it('returns true when Sec-Fetch-Dest is "document"', () => {
    expect(isDocumentRequest(h({ 'sec-fetch-dest': 'document' }))).toBe(true);
  });

  it('returns false when Sec-Fetch-Dest is anything other than "document"', () => {
    expect(isDocumentRequest(h({ 'sec-fetch-dest': 'empty' }))).toBe(false);
    expect(isDocumentRequest(h({ 'sec-fetch-dest': 'script' }))).toBe(false);
    expect(isDocumentRequest(h({ 'sec-fetch-dest': 'iframe' }))).toBe(false);
  });

  it('returns false for XMLHttpRequest even without Sec-Fetch-Dest', () => {
    expect(isDocumentRequest(h({ 'x-requested-with': 'XMLHttpRequest' }))).toBe(false);
    expect(isDocumentRequest(h({ 'x-requested-with': 'xmlhttprequest' }))).toBe(false);
  });

  it('returns false for prefetch requests', () => {
    expect(isDocumentRequest(h({ purpose: 'prefetch' }))).toBe(false);
    expect(isDocumentRequest(h({ purpose: 'Prefetch' }))).toBe(false);
  });

  it('returns false when Accept does not include text/html or */*', () => {
    expect(isDocumentRequest(h({ accept: 'application/json' }))).toBe(false);
  });

  it('returns true when Accept includes text/html', () => {
    expect(
      isDocumentRequest(h({ accept: 'text/html,application/xhtml+xml' })),
    ).toBe(true);
  });

  it('returns true when Accept is */*', () => {
    expect(isDocumentRequest(h({ accept: '*/*' }))).toBe(true);
  });

  it('returns true for an empty header bag (fail-open)', () => {
    expect(isDocumentRequest(h({}))).toBe(true);
  });
});
