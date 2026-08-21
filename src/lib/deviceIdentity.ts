const STORAGE_KEY = 'lvw:device-key';

export function getOrCreateDeviceKey(): string {
  const existing = localStorage.getItem(STORAGE_KEY);
  if (existing) return existing;

  const randomPart = typeof crypto?.randomUUID === 'function'
    ? crypto.randomUUID()
    : `${Date.now()}_${Math.random().toString(36).slice(2)}`;
  const next = `lvw_${randomPart.replace(/-/g, '')}`;
  localStorage.setItem(STORAGE_KEY, next);
  return next;
}
