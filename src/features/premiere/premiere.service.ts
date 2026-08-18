export type PremiereRpcError = Error | { message?: string; code?: string } | null;
export type PremiereRpcClient = {
  rpc: (
    name: string,
    args: Record<string, unknown>,
  ) => PromiseLike<{ data: unknown; error: PremiereRpcError }>;
};

export type PremiereScreenState =
  | { status: 'idle' | 'black' | 'not_found'; serverNow: string }
  | {
      status: 'standby' | 'countdown' | 'playing' | 'paused';
      mediaUrl: string;
      durationSeconds: number;
      startAt: string | null;
      playbackAnchorAt: string | null;
      playbackOffsetSeconds: number;
      positionSeconds: number;
      countdownSeconds: number;
      countdownSoundEnabled: boolean;
      serverNow: string;
    };

export type OwnerPremiereControl =
  | {
      status: 'idle';
      configured: false;
      serverNow: string;
      countdownSoundEnabled: boolean;
      countdownSeconds: number;
    }
  | {
      status: 'idle' | 'standby' | 'countdown' | 'playing' | 'paused' | 'black';
      configured: true;
      mediaUrl: string;
      durationSeconds: number;
      startAt: string | null;
      playbackAnchorAt: string | null;
      playbackOffsetSeconds: number;
      positionSeconds: number;
      countdownSeconds: number;
      countdownSoundEnabled: boolean;
      serverNow: string;
    };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function fail(): never {
  throw new Error('Unexpected premiere response');
}

function throwRpcError(error: Exclude<PremiereRpcError, null>): never {
  if (error instanceof Error) throw error;
  const next = new Error(error.message || 'Premiere request failed');
  if (error.code) Object.assign(next, { code: error.code });
  throw next;
}

function date(value: unknown, nullable = false): string | null {
  if (nullable && value === null) return null;
  if (typeof value !== 'string' || Number.isNaN(Date.parse(value))) return fail();
  return value;
}

function number(value: unknown): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) return fail();
  return value;
}

function countdown(value: unknown): number {
  const parsed = number(value);
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > 60) return fail();
  return parsed;
}

function parseConfiguredState(data: Record<string, unknown>) {
  if (typeof data.mediaUrl !== 'string' || !data.mediaUrl) fail();
  if (typeof data.countdownSoundEnabled !== 'boolean') fail();
  const parsed = {
    mediaUrl: data.mediaUrl,
    durationSeconds: number(data.durationSeconds),
    startAt: date(data.startAt, true),
    playbackAnchorAt: date(data.playbackAnchorAt, true),
    playbackOffsetSeconds: number(data.playbackOffsetSeconds),
    positionSeconds: number(data.positionSeconds),
    countdownSeconds: countdown(data.countdownSeconds),
    countdownSoundEnabled: data.countdownSoundEnabled,
    serverNow: date(data.serverNow)!,
  };
  if (data.status === 'countdown' && parsed.startAt === null) fail();
  if (data.status === 'playing' && parsed.playbackAnchorAt === null) fail();
  return parsed;
}

export async function getPremiereScreenState(
  client: PremiereRpcClient,
  eventSlug: string,
): Promise<PremiereScreenState> {
  const { data, error } = await client.rpc('get_premiere_screen_state', { p_event_slug: eventSlug });
  if (error) throwRpcError(error);
  if (!isRecord(data) || typeof data.status !== 'string') fail();

  if (data.status === 'idle' || data.status === 'black' || data.status === 'not_found') {
    return { status: data.status, serverNow: date(data.serverNow)! };
  }
  if (data.status !== 'standby' && data.status !== 'countdown' && data.status !== 'playing' && data.status !== 'paused') fail();
  return { status: data.status, ...parseConfiguredState(data) };
}

export async function getOwnerPremiereControl(
  client: PremiereRpcClient,
  eventId: string,
): Promise<OwnerPremiereControl> {
  const { data, error } = await client.rpc('owner_get_premiere_control', { p_event_id: eventId });
  if (error) throwRpcError(error);
  if (!isRecord(data) || typeof data.status !== 'string' || typeof data.configured !== 'boolean') fail();

  if (data.configured === false) {
    if (data.status !== 'idle' || typeof data.countdownSoundEnabled !== 'boolean') fail();
    return {
      status: 'idle',
      configured: false,
      serverNow: date(data.serverNow)!,
      countdownSoundEnabled: data.countdownSoundEnabled,
      countdownSeconds: countdown(data.countdownSeconds),
    };
  }

  if (
    data.status !== 'idle' && data.status !== 'standby' && data.status !== 'countdown'
    && data.status !== 'playing' && data.status !== 'paused' && data.status !== 'black'
  ) fail();
  return { status: data.status, configured: true, ...parseConfiguredState(data) };
}

async function rpc(client: PremiereRpcClient, name: string, args: Record<string, unknown>): Promise<Record<string, unknown>> {
  const { data, error } = await client.rpc(name, args);
  if (error) throwRpcError(error);
  if (!isRecord(data) || typeof data.status !== 'string') fail();
  return data;
}

export async function setPremiereMedia(client: PremiereRpcClient, eventId: string, mediaUrl: string, durationSeconds: number) {
  return rpc(client, 'owner_set_premiere_media', { p_event_id: eventId, p_media_url: mediaUrl, p_duration_seconds: durationSeconds });
}

export async function setPremiereStandby(client: PremiereRpcClient, eventId: string) {
  return rpc(client, 'owner_set_premiere_standby', { p_event_id: eventId });
}

export async function startPremiere(client: PremiereRpcClient, eventId: string, countdownSeconds = 10) {
  return rpc(client, 'owner_start_premiere', { p_event_id: eventId, p_countdown_seconds: countdownSeconds });
}

export async function cancelPremiere(client: PremiereRpcClient, eventId: string) {
  return rpc(client, 'owner_cancel_premiere', { p_event_id: eventId });
}

export async function pausePremiere(client: PremiereRpcClient, eventId: string) {
  return rpc(client, 'owner_pause_premiere', { p_event_id: eventId });
}

export async function resumePremiere(client: PremiereRpcClient, eventId: string) {
  return rpc(client, 'owner_resume_premiere', { p_event_id: eventId });
}

export async function seekPremiere(client: PremiereRpcClient, eventId: string, positionSeconds: number) {
  return rpc(client, 'owner_seek_premiere', { p_event_id: eventId, p_position_seconds: positionSeconds });
}

export async function restartPremiere(client: PremiereRpcClient, eventId: string) {
  return rpc(client, 'owner_restart_premiere', { p_event_id: eventId });
}

export async function setPremiereBlack(client: PremiereRpcClient, eventId: string) {
  return rpc(client, 'owner_set_premiere_black', { p_event_id: eventId });
}

export async function returnMainScreen(client: PremiereRpcClient, eventId: string) {
  return rpc(client, 'owner_return_main_screen', { p_event_id: eventId });
}

export async function setPremiereCountdownSound(client: PremiereRpcClient, eventId: string, enabled: boolean) {
  return rpc(client, 'owner_set_premiere_countdown_sound', { p_event_id: eventId, p_enabled: enabled });
}
