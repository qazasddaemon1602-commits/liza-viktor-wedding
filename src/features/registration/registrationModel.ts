export type RegistrationDraft = {
  firstName: string;
  lastName: string;
  affiliationType: string;
  affiliationDetail: string;
};

export type RegistrationErrors = Partial<
  Record<'firstName' | 'lastName' | 'affiliationType', string>
>;

function collapseWhitespace(value: string): string {
  return value.trim().replace(/\s+/g, ' ');
}

export function normalizeRegistration(draft: RegistrationDraft): RegistrationDraft {
  return {
    firstName: collapseWhitespace(draft.firstName),
    lastName: collapseWhitespace(draft.lastName),
    affiliationType: collapseWhitespace(draft.affiliationType),
    affiliationDetail: collapseWhitespace(draft.affiliationDetail),
  };
}

export function validateRegistration(draft: RegistrationDraft): RegistrationErrors {
  const normalized = normalizeRegistration(draft);
  const errors: RegistrationErrors = {};

  if (!normalized.firstName) errors.firstName = 'Введите имя';
  if (!normalized.lastName) errors.lastName = 'Введите фамилию';
  if (!normalized.affiliationType) {
    errors.affiliationType = 'Выберите, с кем вы сегодня';
  }

  return errors;
}

export function formatPublicGuestName(firstName: string, lastName: string): string {
  const normalizedFirstName = collapseWhitespace(firstName);
  const normalizedLastName = collapseWhitespace(lastName);
  if (!normalizedLastName) return normalizedFirstName;

  return `${normalizedFirstName} ${normalizedLastName[0].toLocaleUpperCase()}.`;
}

export function formatTicketNumber(sequence: number): string {
  const safeSequence = Math.max(0, Math.trunc(sequence));
  return `LV-${String(safeSequence).padStart(3, '0')}`;
}
