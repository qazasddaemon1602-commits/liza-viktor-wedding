export type BunkerPhase =
  | 'emergency'
  | 'dossier_1'
  | 'dossier_2'
  | 'mission_a'
  | 'mission_b'
  | 'final'
  | 'completed';

export type BunkerMissionStage = 'mission_a' | 'mission_b';

export type GuestBunkerDossier = {
  profession: string;
  profile: string;
  health: string | null;
  hobby: string | null;
  baggage: string | null;
  hiddenFact: string | null;
};

export type GuestBunkerMission = {
  title: string;
  prompt: string;
  options: string[];
};

export type GuestBunkerTeamState = {
  carriageNumber: number;
  stage?: BunkerMissionStage;
  mission?: GuestBunkerMission;
  completed: boolean;
  attemptCount?: number;
  fragment: string | null;
};

export type GuestBunkerQuestState =
  | { status: 'idle' | 'not_found' | 'guest_not_found'; serverNow: string }
  | {
      status: 'active';
      phase: BunkerPhase;
      phaseStartedAt: string | null;
      startedAt: string;
      durationSeconds: number;
      remainingSeconds: number;
      serverNow: string;
      dossier: GuestBunkerDossier | null;
      team: GuestBunkerTeamState | null;
      final: { unlocked: boolean };
    };

export type OwnerBunkerTeamStage = {
  completed: boolean;
  attemptCount: number;
  hint: string | null;
};

export type OwnerBunkerTeamState = {
  carriageId: string;
  carriageNumber: number;
  label: string;
  missionA: OwnerBunkerTeamStage;
  missionB: OwnerBunkerTeamStage & { fragment: string | null };
};

export type OwnerBunkerQuestState =
  | {
      status: 'idle';
      phase: 'emergency';
      remainingSeconds: 0;
      teams: OwnerBunkerTeamState[];
      unlocked: false;
      serverNow: string;
    }
  | {
      status: 'active';
      phase: BunkerPhase;
      phaseStartedAt: string | null;
      startedAt: string;
      durationSeconds: number;
      remainingSeconds: number;
      soundEnabled: boolean;
      unlocked: boolean;
      teams: OwnerBunkerTeamState[];
      serverNow: string;
    };

export type SubmitBunkerMissionResult = {
  status: 'incorrect' | 'completed';
  stage: BunkerMissionStage;
  attemptCount?: number;
  successCopy?: string;
  fragment?: string | null;
};

export type SubmitBunkerFinalResult = {
  status: 'not_ready' | 'incorrect' | 'unlocked';
  unlocked: boolean;
};
