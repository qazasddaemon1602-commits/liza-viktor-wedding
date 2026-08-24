import type { GuestRegistrationScreenEvent } from './TrainArrivalScene';
import type { CarriageCallScreenEvent, ScreenPresentationEvent } from './screenEvents.realtime';

type AnnouncementScreenEvent = GuestRegistrationScreenEvent | CarriageCallScreenEvent;

export type ArrivalPresentation = {
  kind: 'arrival';
  event: GuestRegistrationScreenEvent;
  eventIds: [string];
  carriageIds: [string];
};

export type BoardingSummaryPresentation = {
  kind: 'boarding_summary';
  eventIds: string[];
  count: number;
  carriageIds: string[];
};

export type CarriageCallPresentation = {
  kind: 'carriage_call';
  event: CarriageCallScreenEvent;
  eventIds: [string];
};

export type AnnouncementPresentation =
  | ArrivalPresentation
  | BoardingSummaryPresentation
  | CarriageCallPresentation;

export type AnnouncementQueueState = {
  sessionKey: string;
  active: { presentation: AnnouncementPresentation } | null;
  pending: AnnouncementPresentation[];
  seenIds: string[];
  protected: boolean;
};

export type AnnouncementQueueAction =
  | { type: 'receive'; event: ScreenPresentationEvent }
  | { type: 'complete' }
  | { type: 'set_protected'; protected: boolean }
  | { type: 'reset_session'; sessionKey: string };

export function createAnnouncementQueueState(sessionKey = 'default'): AnnouncementQueueState {
  return { sessionKey, active: null, pending: [], seenIds: [], protected: false };
}

function presentationFor(event: AnnouncementScreenEvent): AnnouncementPresentation {
  if (event.kind === 'guest_registered') {
    return {
      kind: 'arrival',
      event,
      eventIds: [event.id],
      carriageIds: [event.payload.carriage.id],
    };
  }
  return { kind: 'carriage_call', event, eventIds: [event.id] };
}

function appendArrival(
  pending: AnnouncementPresentation[],
  event: GuestRegistrationScreenEvent,
): AnnouncementPresentation[] {
  const tail = pending.at(-1);
  if (tail?.kind === 'arrival') {
    return [
      ...pending.slice(0, -1),
      {
        kind: 'boarding_summary',
        eventIds: [tail.event.id, event.id],
        count: 2,
        carriageIds: [...new Set([tail.event.payload.carriage.id, event.payload.carriage.id])],
      },
    ];
  }
  if (tail?.kind === 'boarding_summary') {
    return [
      ...pending.slice(0, -1),
      {
        ...tail,
        eventIds: [...tail.eventIds, event.id],
        count: tail.count + 1,
        carriageIds: [...new Set([...tail.carriageIds, event.payload.carriage.id])],
      },
    ];
  }
  return [...pending, presentationFor(event)];
}

export function announcementQueueReducer(
  state: AnnouncementQueueState,
  action: AnnouncementQueueAction,
): AnnouncementQueueState {
  if (action.type === 'reset_session') return createAnnouncementQueueState(action.sessionKey);
  if (action.type === 'set_protected') {
    return action.protected
      ? { ...state, active: null, pending: [], protected: true }
      : { ...state, protected: false };
  }
  if (action.type === 'complete') {
    const [next, ...rest] = state.pending;
    return { ...state, active: next ? { presentation: next } : null, pending: rest };
  }

  if (action.event.kind === 'carriage_map_show') return state;

  if (state.seenIds.includes(action.event.id)) return state;
  const seenIds = [...state.seenIds, action.event.id];
  if (state.protected) return { ...state, seenIds };
  if (!state.active) {
    return { ...state, seenIds, active: { presentation: presentationFor(action.event) } };
  }
  const pending = action.event.kind === 'guest_registered'
    ? appendArrival(state.pending, action.event)
    : [...state.pending, presentationFor(action.event)];
  return { ...state, seenIds, pending };
}
