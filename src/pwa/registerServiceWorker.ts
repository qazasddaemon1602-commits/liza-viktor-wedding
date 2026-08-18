export type ServiceWorkerRegistrar = {
  register: (
    scriptURL: string,
    options?: RegistrationOptions,
  ) => Promise<unknown>;
};

export async function registerWeddingServiceWorker(
  serviceWorker: ServiceWorkerRegistrar | null | undefined =
    typeof navigator !== 'undefined' && 'serviceWorker' in navigator
      ? navigator.serviceWorker
      : null,
): Promise<unknown | null> {
  if (!serviceWorker) return null;

  try {
    return await serviceWorker.register('/sw.js', { scope: '/' });
  } catch {
    return null;
  }
}
