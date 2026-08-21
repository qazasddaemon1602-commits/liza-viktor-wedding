export function isOwnerSessionExpired(error: unknown): boolean {
  if (typeof error !== 'object' || error === null) return false;
  const candidate = error as { code?: unknown; message?: unknown; status?: unknown };
  const code = String(candidate.code ?? '').toLowerCase();
  const message = String(candidate.message ?? '').toLowerCase();
  const status = Number(candidate.status);

  return status === 401
    || code === 'pgrst301'
    || code === 'refresh_token_not_found'
    || code === 'bad_jwt'
    || message.includes('owner authentication required')
    || message.includes('auth session missing')
    || message.includes('jwt expired');
}
