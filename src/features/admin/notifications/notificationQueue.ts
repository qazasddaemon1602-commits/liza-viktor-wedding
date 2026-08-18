export type RegistrationNotice = {
  guestId: string;
  fullName: string;
  carriageLabel: string;
  carriageAccent: string;
  affiliationLabel: string;
  createdAt: string;
};

export function enqueueNotices(
  current: readonly RegistrationNotice[],
  incoming: readonly RegistrationNotice[],
): RegistrationNotice[] {
  const seen = new Set(current.map((item) => item.guestId));
  const next = [...current];

  for (const item of incoming) {
    if (seen.has(item.guestId)) continue;
    seen.add(item.guestId);
    next.push(item);
  }

  return next;
}
