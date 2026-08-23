export type RegistrationCarriageMapStatus = 'registration' | 'complete' | 'not_found';

export type RegistrationCarriageMapGuest = {
  id: string;
  initials: string;
  seatIndex: number;
};

export type RegistrationCarriageMapCarriage = {
  id: string;
  number: number;
  label: string;
  accentHex: string;
  visualMark: string;
  guests: RegistrationCarriageMapGuest[];
};

export type RegistrationCarriageMap = {
  status: RegistrationCarriageMapStatus;
  expectedGuestCount: number;
  registeredGuestCount: number;
  serverNow: string;
  unassignedCount: number;
  carriages: RegistrationCarriageMapCarriage[];
};

type CarriageMapRpcError = Error | { message?: string } | null;

export type CarriageMapRpcClient = {
  rpc: (name: string, args: Record<string, unknown>) => Promise<{
    data: unknown;
    error: CarriageMapRpcError;
  }>;
};

const ROOT_KEYS = [
  'status',
  'expectedGuestCount',
  'registeredGuestCount',
  'serverNow',
  'unassignedCount',
  'carriages',
] as const;
const CARRIAGE_KEYS = ['id', 'number', 'label', 'accentHex', 'visualMark', 'guests'] as const;
const GUEST_KEYS = ['id', 'initials', 'seatIndex'] as const;
const SAFE_INITIALS = /^\p{L}{1,2}$/u;
const SAFE_ACCENT = /^#[0-9a-f]{6}$/i;
const ISO_TIMESTAMP_WITH_TIMEZONE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,6})?(?:Z|[+-]\d{2}:\d{2})$/;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function hasOnlyKeys(value: Record<string, unknown>, allowedKeys: readonly string[]): boolean {
  const actualKeys = Object.keys(value);
  return actualKeys.length === allowedKeys.length
    && actualKeys.every((key) => allowedKeys.includes(key));
}

function isSafeString(value: unknown, maxLength: number): value is string {
  return typeof value === 'string'
    && value.length > 0
    && value.length <= maxLength
    && value.trim() === value;
}

function isNonNegativeInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;
}

function parseGuest(value: unknown, expectedSeatIndex: number): RegistrationCarriageMapGuest | null {
  if (!isRecord(value) || !hasOnlyKeys(value, GUEST_KEYS)) return null;
  if (
    !isSafeString(value.id, 128)
    || !isSafeString(value.initials, 2)
    || !SAFE_INITIALS.test(value.initials)
    || !Number.isSafeInteger(value.seatIndex)
    || (value.seatIndex as number) < 1
    || (value.seatIndex as number) > 40
    || value.seatIndex !== expectedSeatIndex
  ) {
    return null;
  }

  return {
    id: value.id,
    initials: value.initials,
    seatIndex: value.seatIndex as number,
  };
}

function parseCarriage(value: unknown): RegistrationCarriageMapCarriage | null {
  if (!isRecord(value) || !hasOnlyKeys(value, CARRIAGE_KEYS) || !Array.isArray(value.guests)) return null;
  if (
    !isSafeString(value.id, 128)
    || !Number.isSafeInteger(value.number)
    || (value.number as number) < 1
    || (value.number as number) > 99
    || !isSafeString(value.label, 80)
    || !isSafeString(value.accentHex, 7)
    || !SAFE_ACCENT.test(value.accentHex)
    || !isSafeString(value.visualMark, 12)
    || value.guests.length > 40
  ) {
    return null;
  }

  const guests = value.guests.map((guest, index) => parseGuest(guest, index + 1));
  if (guests.some((guest) => guest === null)) return null;

  return {
    id: value.id,
    number: value.number as number,
    label: value.label,
    accentHex: value.accentHex,
    visualMark: value.visualMark,
    guests: guests as RegistrationCarriageMapGuest[],
  };
}

export function parseRegistrationCarriageMap(value: unknown): RegistrationCarriageMap | null {
  if (!isRecord(value) || !hasOnlyKeys(value, ROOT_KEYS)) return null;
  if (
    value.status !== 'registration'
    && value.status !== 'complete'
    && value.status !== 'not_found'
  ) {
    return null;
  }
  if (
    !isNonNegativeInteger(value.expectedGuestCount)
    || !isNonNegativeInteger(value.registeredGuestCount)
    || !isNonNegativeInteger(value.unassignedCount)
    || value.unassignedCount > value.registeredGuestCount
    || !isSafeString(value.serverNow, 64)
    || !ISO_TIMESTAMP_WITH_TIMEZONE.test(value.serverNow)
    || !Number.isFinite(Date.parse(value.serverNow))
    || !Array.isArray(value.carriages)
  ) {
    return null;
  }

  const isNotFound = value.status === 'not_found';
  if (
    (isNotFound && value.carriages.length !== 0)
    || (!isNotFound && (value.carriages.length < 2 || value.carriages.length > 5))
  ) {
    return null;
  }

  const carriages = value.carriages.map(parseCarriage);
  if (carriages.some((carriage) => carriage === null)) return null;

  const parsedCarriages = carriages as RegistrationCarriageMapCarriage[];
  const carriageIds = new Set(parsedCarriages.map((carriage) => carriage.id));
  const carriageNumbers = new Set(parsedCarriages.map((carriage) => carriage.number));
  const guestIds = parsedCarriages.flatMap((carriage) => carriage.guests.map((guest) => guest.id));
  if (
    carriageIds.size !== parsedCarriages.length
    || carriageNumbers.size !== parsedCarriages.length
    || new Set(guestIds).size !== guestIds.length
  ) {
    return null;
  }

  const assignedCount = parsedCarriages.reduce(
    (total, carriage) => total + carriage.guests.length,
    0,
  );
  if (assignedCount + value.unassignedCount !== value.registeredGuestCount) return null;

  const completionTarget = Math.min(value.expectedGuestCount, 40);
  if (
    (isNotFound && (
      value.expectedGuestCount !== 0
      || value.registeredGuestCount !== 0
      || value.unassignedCount !== 0
    ))
    || (value.status === 'complete' && (
      completionTarget <= 0
      || value.registeredGuestCount < completionTarget
    ))
    || (value.status === 'registration' && (
      completionTarget > 0
      && value.registeredGuestCount >= completionTarget
    ))
  ) {
    return null;
  }

  return {
    status: value.status,
    expectedGuestCount: value.expectedGuestCount,
    registeredGuestCount: value.registeredGuestCount,
    serverNow: value.serverNow,
    unassignedCount: value.unassignedCount,
    carriages: parsedCarriages,
  };
}

export async function getRegistrationCarriageMap(
  client: CarriageMapRpcClient,
  eventSlug: string,
): Promise<RegistrationCarriageMap> {
  const { data, error } = await client.rpc('get_registration_carriage_map', {
    p_event_slug: eventSlug,
  });

  if (error) {
    if (error instanceof Error) throw error;
    throw new Error(error.message || 'Carriage map request failed');
  }

  const parsed = parseRegistrationCarriageMap(data);
  if (!parsed) throw new Error('Unexpected carriage map response');
  return parsed;
}
