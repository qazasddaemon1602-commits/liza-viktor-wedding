export type CarriageSummary = {
  id: string;
  number: number;
  label: string;
  accentHex: string;
  visualMark: string;
};

export type RegisteredGuest = {
  id: string;
  firstName: string;
  lastName: string;
  affiliationType: string;
  affiliationDetail: string;
  ticketNumber: string;
  carriage: CarriageSummary;
};
