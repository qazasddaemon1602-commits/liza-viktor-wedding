import { describe, expect, it } from 'vitest';
import { needsPremiereMediaResolution, resolvePremiereMediaUrl } from './premiereMedia';

describe('premiere media resolver', () => {
  it('resolves a public Yandex Disk link to the direct download href', async () => {
    const source = 'https://disk.yandex.ru/i/ogOrvj98Qk7bXQ';
    const direct = 'https://downloader.disk.yandex.ru/disk/example.mp4';
    let requestedUrl = '';
    let requestedMethod = '';

    const fetchImpl = (async (input: RequestInfo | URL, init?: RequestInit) => {
      requestedUrl = String(input);
      requestedMethod = init?.method ?? 'GET';
      return new Response(JSON.stringify({ href: direct }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }) as typeof fetch;

    await expect(resolvePremiereMediaUrl(source, fetchImpl)).resolves.toBe(direct);

    const endpoint = new URL(requestedUrl);
    expect(endpoint.origin).toBe('https://cloud-api.yandex.net');
    expect(endpoint.pathname).toBe('/v1/disk/public/resources/download');
    expect(endpoint.searchParams.get('public_key')).toBe(source);
    expect(requestedMethod).toBe('GET');
  });

  it('does not resolve a normal direct media URL', async () => {
    const source = 'https://cdn.example.com/premiere.mp4';
    let called = false;
    const fetchImpl = (async () => {
      called = true;
      throw new Error('fetch must not run for direct media');
    }) as typeof fetch;

    await expect(resolvePremiereMediaUrl(source, fetchImpl)).resolves.toBe(source);
    expect(called).toBe(false);
    expect(needsPremiereMediaResolution(source)).toBe(false);
  });

  it('rejects a successful response that contains no direct href', async () => {
    const fetchImpl = (async () => new Response(JSON.stringify({}), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })) as typeof fetch;

    await expect(resolvePremiereMediaUrl(
      'https://disk.yandex.ru/i/example',
      fetchImpl,
    )).rejects.toThrow('returned no direct href');
  });

  it('recognizes supported Yandex public-link hosts', () => {
    expect(needsPremiereMediaResolution('https://disk.yandex.ru/i/file')).toBe(true);
    expect(needsPremiereMediaResolution('https://disk.yandex.com/i/file')).toBe(true);
    expect(needsPremiereMediaResolution('https://yadi.sk/i/file')).toBe(true);
  });
});
