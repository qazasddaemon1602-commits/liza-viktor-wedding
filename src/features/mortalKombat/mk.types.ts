export type MkTournamentState = 'registration' | 'draw_ready' | 'active' | 'complete';
export type MkRegistrationStatus = 'active' | 'waitlist' | 'withdrawn';
export type MkRound = 'r16' | 'qf' | 'sf' | 'final';
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
      maxPlayers: 16;
      ownRegistrationStatus: MkRegistrationStatus | null;
      waitlistPosition: number | null;
      players: MkPlayer[];
      matches: MkMatch[];
      championGuestId: string | null;
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
      maxPlayers: 16;
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
  maxPlayers: 16;
  waitlistPosition: number | null;
};
