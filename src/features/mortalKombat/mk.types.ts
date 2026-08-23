export type MkTournamentState = 'registration' | 'draw_ready' | 'active' | 'complete';
export type MkRegistrationStatus = 'active' | 'waitlist' | 'withdrawn';
export const MK_MAX_PLAYERS = 16 as const;
export const MK_ROUNDS = ['r16', 'qf', 'sf', 'final'] as const;
export type MkRound = typeof MK_ROUNDS[number];
export const MK_ROUND_LABELS: Record<MkRound, string> = {
  r16: '1/8 ФИНАЛА',
  qf: '1/4 ФИНАЛА',
  sf: '1/2 ФИНАЛА',
  final: 'ФИНАЛ',
};
export type MkMatchStatus = 'pending' | 'ready' | 'complete';

export type MkPlayer = {
  registrationId: string;
  guestId: string;
  displayName: string;
  seed: number | null;
};

export type MkMatch = {
  id: string;
  matchKey: string;
  round: MkRound;
  position: number;
  player1GuestId: string | null;
  player2GuestId: string | null;
  winnerGuestId: string | null;
  status: MkMatchStatus;
  current: boolean;
};

export type MkTournamentProjection =
  | { status: 'idle' | 'not_found' }
  | {
      status: 'active';
      tournamentId: string;
      state: MkTournamentState;
      activeCount: number;
      maxPlayers: typeof MK_MAX_PLAYERS;
      ownRegistrationStatus: MkRegistrationStatus | null;
      waitlistPosition: number | null;
      players: MkPlayer[];
      matches: MkMatch[];
      championGuestId: string | null;
      presentOnMainScreen: boolean;
    };

export type MkOwnerRegistration = MkPlayer & {
  status: MkRegistrationStatus;
  registeredAt: string;
};

export type MkOwnerControl =
  | { status: 'idle' }
  | {
      status: 'owner';
      tournamentId: string;
      state: MkTournamentState;
      activeCount: number;
      waitlistCount: number;
      maxPlayers: typeof MK_MAX_PLAYERS;
      registrations: MkOwnerRegistration[];
      matches: MkMatch[];
      championGuestId: string | null;
    };

export type BracketMatch = {
  matchKey: string;
  round: MkRound;
  position: number;
  player1GuestId: string | null;
  player2GuestId: string | null;
};

export type MkJoinResult = {
  status: 'joined' | 'already_joined';
  registrationStatus: 'active' | 'waitlist';
  activeCount: number;
  maxPlayers: typeof MK_MAX_PLAYERS;
  waitlistPosition: number | null;
};

