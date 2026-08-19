const YANDEX_PUBLIC_DOWNLOAD_ENDPOINT = 'https://cloud-api.yandex.net/v1/disk/public/resources/download';

function isYandexDiskPublicUrl(value: string) {
  try {
    const host = new URL(value).hostname.toLowerCase();
    return host === 'disk.yandex.ru' || host === 'disk.yandex.com' || host === 'yadi.sk';
  } catch {
    return false;
  }
}

type PublicDownloadResponse = {
  href?: unknown;
};

export async function resolvePremiereMediaUrl(
  source: string,
  fetchImpl: typeof fetch = fetch,
): Promise<string> {
  if (!isYandexDiskPublicUrl(source)) return source;

  const endpoint = new URL(YANDEX_PUBLIC_DOWNLOAD_ENDPOINT);
  endpoint.searchParams.set('public_key', source);

  const response = await fetchImpl(endpoint.toString(), { method: 'GET' });
  if (!response.ok) {
    throw new Error(`Yandex Disk media resolver failed with HTTP ${response.status}`);
  }

  const payload = await response.json() as PublicDownloadResponse;
  if (typeof payload.href !== 'string' || !/^https?:\/\//i.test(payload.href)) {
    throw new Error('Yandex Disk media resolver returned no direct href');
  }

  return payload.href;
}

export function needsPremiereMediaResolution(source: string) {
  return isYandexDiskPublicUrl(source);
}
