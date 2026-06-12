import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

// Types
export interface CurrentUser {
  id: string;
  phone: string;
  playerCode?: string;
  name?: string;
  role: string;
  avatar?: string;
  gender?: string;
  weight?: string;
  practiceGround?: string;
  email?: string;
  isPremium?: boolean;
  isAdmin?: boolean;
}

export interface MatchPlayer {
  id: string;
  name: string;
  jerseyNumber?: number;
  playerCode?: string;
  team: 'home' | 'away';
}

export interface MatchEvent {
  id: string;
  matchId?: string;
  teamId: string;
  playerId?: string;
  eventType: EventType;
  value: number;
  details?: string;
  half: number;
  playerName?: string;
  timestamp: number;
}

export type EventType =
  | 'raid_point'
  | 'bonus_point'
  | 'tackle_point'
  | 'super_raid'
  | 'super_tackle'
  | 'do_or_die_raid'
  | 'all_out'
  | 'empty_raid'
  | 'substitution'
  | 'timeout'
  | 'yellow_card'
  | 'red_card'
  | 'green_card';

export interface ActiveMatch {
  id?: string;
  homeTeamId: string;
  awayTeamId: string;
  homeTeam: string;
  awayTeam: string;
  homeTeamColor: string;
  awayTeamColor: string;
  isLive: boolean;
  isPractice: boolean;
  gender: string;
  halfDuration: number;
  playersPerSide: number;
  currentHalf: number;
  timer: number;
  homeScore: number;
  awayScore: number;
  events: MatchEvent[];
  homeLineup: MatchPlayer[];
  awayLineup: MatchPlayer[];
  raidQueue: 'home' | 'away';
  isDoOrDie: boolean;
  homeTimeouts: number;
  awayTimeouts: number;
  homeOutPlayers: number;
  awayOutPlayers: number;
  homeOutPlayerIds: string[];
  awayOutPlayerIds: string[];
}

export type TabId = 'home' | 'tournaments' | 'quick-score' | 'profile';

// Notification types
export type NotificationType = 'match_start' | 'match_result' | 'achievement' | 'premium' | 'general';

export interface AppNotification {
  id: string;
  type: NotificationType;
  title: string;
  description: string;
  timestamp: number;
  read: boolean;
}

export type Language = 'en' | 'hi';

export type HomeData = Record<string, unknown> | null;

export type OnboardingPosition = 'raider' | 'defender' | 'all-rounder';
export type OnboardingExperience = 'beginner' | 'intermediate' | 'advanced';
export type OnboardingWeightCategory = 'below-60' | '60-70' | '70-80' | '80-90' | 'above-90';

export interface OnboardingProfile {
  position: OnboardingPosition | null;
  experience: OnboardingExperience | null;
  weightCategory: OnboardingWeightCategory | null;
  selectedTeamId: string | null;
}

// Team management types
export type TeamFilter = 'my' | 'all';

export interface TeamManagementState {
  teamFilter: TeamFilter;
  teamSearch: string;
  selectedTeamId: string | null;
  teamDetailOpen: boolean;
}

interface KabaddiState {
  // Auth
  isAuthenticated: boolean;
  isOnboarded: boolean;
  currentUser: CurrentUser | null;
  hasSeenSplash: boolean;

  // Navigation
  activeTab: TabId;

  // Active Match
  activeMatch: ActiveMatch | null;

  // Toss State
  showToss: boolean;
  tossMatchConfig: Omit<ActiveMatch, 'isLive' | 'currentHalf' | 'timer' | 'homeScore' | 'awayScore' | 'events' | 'raidQueue' | 'isDoOrDie' | 'homeTimeouts' | 'awayTimeouts' | 'homeOutPlayers' | 'awayOutPlayers' | 'homeOutPlayerIds' | 'awayOutPlayerIds'> | null;

  // Home Data cache
  homeData: HomeData;

  // Notifications
  notifications: AppNotification[];

  // Language
  language: Language;

  // Onboarding
  hasCompletedOnboarding: boolean;
  onboardingProfile: OnboardingProfile;

  // Team Management
  teamManagement: TeamManagementState;

  // Actions
  login: (user: CurrentUser) => void;
  logout: () => void;
  setOnboarded: (value?: boolean) => void;
  updateUser: (data: Partial<CurrentUser>) => void;
  setActiveTab: (tab: TabId) => void;
  setHasSeenSplash: (value: boolean) => void;
  initiateToss: (matchConfig: Omit<ActiveMatch, 'isLive' | 'currentHalf' | 'timer' | 'homeScore' | 'awayScore' | 'events' | 'raidQueue' | 'isDoOrDie' | 'homeTimeouts' | 'awayTimeouts' | 'homeOutPlayers' | 'awayOutPlayers' | 'homeOutPlayerIds' | 'awayOutPlayerIds'>) => void;
  cancelToss: () => void;
  startMatch: (match: Omit<ActiveMatch, 'isLive' | 'currentHalf' | 'timer' | 'homeScore' | 'awayScore' | 'events' | 'raidQueue' | 'isDoOrDie' | 'homeTimeouts' | 'awayTimeouts' | 'homeOutPlayers' | 'awayOutPlayers' | 'homeOutPlayerIds' | 'awayOutPlayerIds'>, firstRaidTeam?: 'home' | 'away') => void;
  endMatch: () => void;
  updateScore: (team: 'home' | 'away', delta: number) => void;
  addEvent: (event: Omit<MatchEvent, 'id' | 'timestamp'>) => void;
  addBatchEvents: (events: Omit<MatchEvent, 'id' | 'timestamp'>[]) => void;
  undoLastEvent: () => void;
  undoLastRaid: () => void;
  switchHalf: () => void;
  setTimer: (time: number) => void;
  setDoOrDie: (value: boolean) => void;
  switchRaidQueue: () => void;
  callTimeout: (team: 'home' | 'away') => void;
  setOutPlayers: (team: 'home' | 'away', count: number) => void;
  fetchHomeData: () => Promise<HomeData>;

  // Notification actions
  addNotification: (notification: Omit<AppNotification, 'id' | 'timestamp' | 'read'>) => void;
  markNotificationRead: (id: string) => void;
  markAllRead: () => void;
  clearNotifications: () => void;

  // Language action
  setLanguage: (lang: Language) => void;

  // Onboarding actions
  setHasCompletedOnboarding: (value: boolean) => void;
  setOnboardingProfile: (profile: Partial<OnboardingProfile>) => void;
  completeOnboarding: () => void;

  // Team management actions
  setTeamFilter: (filter: TeamFilter) => void;
  setTeamSearch: (search: string) => void;
  setSelectedTeamId: (teamId: string | null) => void;
  setTeamDetailOpen: (open: boolean) => void;
}

/** Helper: determine which side a teamId belongs to in a match */
function getTeamSide(match: ActiveMatch, teamId: string): 'home' | 'away' {
  if (teamId === match.homeTeamId) return 'home';
  return 'away';
}

/** Helper: recalculate scores, out counts, and out player IDs from a list of events */
function recalculateFromEvents(match: ActiveMatch, events: MatchEvent[]) {
  let homeScore = 0;
  let awayScore = 0;
  let homeOutPlayers = 0;
  let awayOutPlayers = 0;
  let homeOutPlayerIds: string[] = [];
  let awayOutPlayerIds: string[] = [];

  for (const evt of events) {
    const side = getTeamSide(match, evt.teamId);
    const points = evt.value;
    if (side === 'home') {
      homeScore += points;
    } else {
      awayScore += points;
    }

    // Count-based out tracking (backward compat)
    if (evt.eventType === 'tackle_point' || evt.eventType === 'super_tackle') {
      if (side === 'home') {
        awayOutPlayers = Math.min(match.playersPerSide, awayOutPlayers + 1);
      } else {
        homeOutPlayers = Math.min(match.playersPerSide, homeOutPlayers + 1);
      }
    }
    if (evt.eventType === 'raid_point' || evt.eventType === 'bonus_point') {
      if (side === 'home') {
        homeOutPlayers = Math.max(0, homeOutPlayers - 1);
      } else {
        awayOutPlayers = Math.max(0, awayOutPlayers - 1);
      }
    }
    if (evt.eventType === 'all_out') {
      if (side === 'home') {
        awayOutPlayers = 0;
      } else {
        homeOutPlayers = 0;
      }
    }

    // ID-based out tracking
    let details: Record<string, unknown> = {};
    try { details = evt.details ? JSON.parse(evt.details) : {}; } catch { /* skip */ }

    if (evt.eventType === 'raid_point') {
      const touchedIds: string[] = (details.touchedPlayerIds as string[]) || [];
      if (side === 'home') {
        // Home team scored raid → away defenders go out
        for (const tid of touchedIds) {
          if (!awayOutPlayerIds.includes(tid)) {
            awayOutPlayerIds = [...awayOutPlayerIds, tid];
          }
        }
        // Home team revives players (first-out-first-in)
        const reviveCount = Math.min(evt.value, homeOutPlayerIds.length);
        if (reviveCount > 0) {
          homeOutPlayerIds = homeOutPlayerIds.slice(reviveCount);
        }
      } else {
        // Away team scored raid → home defenders go out
        for (const tid of touchedIds) {
          if (!homeOutPlayerIds.includes(tid)) {
            homeOutPlayerIds = [...homeOutPlayerIds, tid];
          }
        }
        const reviveCount = Math.min(evt.value, awayOutPlayerIds.length);
        if (reviveCount > 0) {
          awayOutPlayerIds = awayOutPlayerIds.slice(reviveCount);
        }
      }
    }

    if (evt.eventType === 'bonus_point') {
      // One out player from scoring team revives
      if (side === 'home' && homeOutPlayerIds.length > 0) {
        homeOutPlayerIds = homeOutPlayerIds.slice(1);
      } else if (side === 'away' && awayOutPlayerIds.length > 0) {
        awayOutPlayerIds = awayOutPlayerIds.slice(1);
      }
    }

    if (evt.eventType === 'tackle_point' || evt.eventType === 'super_tackle') {
      // Raider goes out. The tackle is scored by the DEFENDING team.
      // So the raider is from the OPPOSING team.
      const raiderId = (details.raiderId as string) || evt.playerId;
      if (side === 'home' && raiderId) {
        // Home team scored tackle → away raider was caught → away raider goes out
        if (!awayOutPlayerIds.includes(raiderId)) {
          awayOutPlayerIds = [...awayOutPlayerIds, raiderId];
        }
      } else if (side === 'away' && raiderId) {
        // Away team scored tackle → home raider was caught → home raider goes out
        if (!homeOutPlayerIds.includes(raiderId)) {
          homeOutPlayerIds = [...homeOutPlayerIds, raiderId];
        }
      }
    }

    if (evt.eventType === 'all_out') {
      if (side === 'home') {
        awayOutPlayerIds = [];
      } else {
        homeOutPlayerIds = [];
      }
    }
  }

  return { homeScore, awayScore, homeOutPlayers, awayOutPlayers, homeOutPlayerIds, awayOutPlayerIds };
}

/** Helper: determine raid queue from last raid event */
function getRaidQueueFromEvents(match: ActiveMatch, events: MatchEvent[]): 'home' | 'away' {
  const raidEventTypes = ['raid_point', 'tackle_point', 'super_tackle', 'empty_raid', 'bonus_point', 'do_or_die_raid'];
  const lastRaidEvent = [...events].reverse().find(e => raidEventTypes.includes(e.eventType));
  if (lastRaidEvent) {
    return getTeamSide(match, lastRaidEvent.teamId) === 'home' ? 'away' : 'home';
  }
  return match.raidQueue;
}

export const useKabaddiStore = create<KabaddiState>()(
  persist(
    (set, get) => ({
      // Auth initial state
      isAuthenticated: false,
      isOnboarded: false,
      currentUser: null,
      hasSeenSplash: false,

      // Navigation initial state
      activeTab: 'home' as TabId,

      // Active match initial state
      activeMatch: null,

      // Toss initial state
      showToss: false,
      tossMatchConfig: null,

      // Home data cache
      homeData: null,

      // Notifications
      notifications: [],

      // Language
      language: 'en' as Language,

      // Onboarding
      hasCompletedOnboarding: false,
      onboardingProfile: {
        position: null,
        experience: null,
        weightCategory: null,
        selectedTeamId: null,
      },

      // Team Management
      teamManagement: {
        teamFilter: 'my' as TeamFilter,
        teamSearch: '',
        selectedTeamId: null,
        teamDetailOpen: false,
      },

      // Actions
      login: (user) =>
        set({
          isAuthenticated: true,
          isOnboarded: !!(user.name && user.gender),
          currentUser: user,
        }),

      logout: () =>
        set({
          isAuthenticated: false,
          isOnboarded: false,
          currentUser: null,
          activeMatch: null,
          activeTab: 'home' as TabId,
          homeData: null,
        }),

      setOnboarded: (value = true) =>
        set({ isOnboarded: value }),

      updateUser: (data) =>
        set((state) => ({
          currentUser: state.currentUser
            ? { ...state.currentUser, ...data }
            : null,
        })),

      setActiveTab: (tab) => set({ activeTab: tab }),

      setHasSeenSplash: (value: boolean) => set({ hasSeenSplash: value }),

      initiateToss: (matchConfig) =>
        set({
          showToss: true,
          tossMatchConfig: matchConfig,
        }),

      cancelToss: () =>
        set({
          showToss: false,
          tossMatchConfig: null,
        }),

      startMatch: (match, firstRaidTeam) =>
        set({
          activeMatch: {
            ...match,
            isLive: true,
            currentHalf: 1,
            timer: match.halfDuration * 60,
            homeScore: 0,
            awayScore: 0,
            events: [],
            raidQueue: firstRaidTeam || 'home',
            isDoOrDie: false,
            homeTimeouts: 0,
            awayTimeouts: 0,
            homeOutPlayers: 0,
            awayOutPlayers: 0,
            homeOutPlayerIds: [],
            awayOutPlayerIds: [],
          },
          activeTab: 'quick-score',
          showToss: false,
          tossMatchConfig: null,
        }),

      endMatch: () => set({ activeMatch: null }),

      updateScore: (team, delta) =>
        set((state) => {
          if (!state.activeMatch) return {};
          return {
            activeMatch: {
              ...state.activeMatch,
              homeScore:
                team === 'home'
                  ? Math.max(0, state.activeMatch.homeScore + delta)
                  : state.activeMatch.homeScore,
              awayScore:
                team === 'away'
                  ? Math.max(0, state.activeMatch.awayScore + delta)
                  : state.activeMatch.awayScore,
            },
          };
        }),

      addEvent: (event) =>
        set((state) => {
          if (!state.activeMatch) return {};
          const newEvent: MatchEvent = {
            ...event,
            id: `evt_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
            timestamp: Date.now(),
          };
          const updatedEvents = [...state.activeMatch.events, newEvent];

          const calculated = recalculateFromEvents(state.activeMatch, updatedEvents);
          const side = getTeamSide(state.activeMatch, event.teamId);

          return {
            activeMatch: {
              ...state.activeMatch,
              events: updatedEvents,
              ...calculated,
              raidQueue: side === 'home' ? 'away' : 'home',
            },
          };
        }),

      addBatchEvents: (events) =>
        set((state) => {
          if (!state.activeMatch || events.length === 0) return {};
          const newEvents: MatchEvent[] = events.map((e, i) => ({
            ...e,
            id: `evt_${Date.now()}_${i}_${Math.random().toString(36).slice(2, 7)}`,
            timestamp: Date.now() + i,
          }));
          const updatedEvents = [...state.activeMatch.events, ...newEvents];

          const calculated = recalculateFromEvents(state.activeMatch, updatedEvents);
          const raidQueue = getRaidQueueFromEvents(state.activeMatch, updatedEvents);

          return {
            activeMatch: {
              ...state.activeMatch,
              events: updatedEvents,
              ...calculated,
              raidQueue,
            },
          };
        }),

      undoLastEvent: () =>
        set((state) => {
          if (!state.activeMatch || state.activeMatch.events.length === 0) return {};
          const events = [...state.activeMatch.events];
          events.pop();

          const calculated = recalculateFromEvents(state.activeMatch, events);
          const raidQueue = getRaidQueueFromEvents(state.activeMatch, events);

          return {
            activeMatch: {
              ...state.activeMatch,
              events,
              ...calculated,
              raidQueue,
            },
          };
        }),

      undoLastRaid: () =>
        set((state) => {
          if (!state.activeMatch || state.activeMatch.events.length === 0) return {};

          // Remove events until we've removed a complete "raid" (all events with same timestamp prefix)
          // A raid batch has events with the same second in timestamp
          const events = [...state.activeMatch.events];
          if (events.length === 0) return {};

          // Find the timestamp of the last event
          const lastTimestamp = events[events.length - 1].timestamp;
          // Remove all events that have the same timestamp (within 5ms for batch events)
          while (events.length > 0 && Math.abs(events[events.length - 1].timestamp - lastTimestamp) < 10) {
            events.pop();
          }

          const calculated = recalculateFromEvents(state.activeMatch, events);
          const raidQueue = getRaidQueueFromEvents(state.activeMatch, events);

          return {
            activeMatch: {
              ...state.activeMatch,
              events,
              ...calculated,
              raidQueue,
            },
          };
        }),

      switchHalf: () =>
        set((state) => {
          if (!state.activeMatch) return {};
          const newHalf = state.activeMatch.currentHalf === 1 ? 2 : 1;
          return {
            activeMatch: {
              ...state.activeMatch,
              currentHalf: newHalf,
              timer: state.activeMatch.halfDuration * 60,
              isDoOrDie: false,
            },
          };
        }),

      setTimer: (time) =>
        set((state) => {
          if (!state.activeMatch) return {};
          return { activeMatch: { ...state.activeMatch, timer: time } };
        }),

      setDoOrDie: (value) =>
        set((state) => {
          if (!state.activeMatch) return {};
          return { activeMatch: { ...state.activeMatch, isDoOrDie: value } };
        }),

      switchRaidQueue: () =>
        set((state) => {
          if (!state.activeMatch) return {};
          return {
            activeMatch: {
              ...state.activeMatch,
              raidQueue: state.activeMatch.raidQueue === 'home' ? 'away' : 'home',
            },
          };
        }),

      callTimeout: (team) =>
        set((state) => {
          if (!state.activeMatch) return {};
          return {
            activeMatch: {
              ...state.activeMatch,
              homeTimeouts:
                team === 'home'
                  ? state.activeMatch.homeTimeouts + 1
                  : state.activeMatch.homeTimeouts,
              awayTimeouts:
                team === 'away'
                  ? state.activeMatch.awayTimeouts + 1
                  : state.activeMatch.awayTimeouts,
            },
          };
        }),

      setOutPlayers: (team, count) =>
        set((state) => {
          if (!state.activeMatch) return {};
          return {
            activeMatch: {
              ...state.activeMatch,
              homeOutPlayers: team === 'home' ? count : state.activeMatch.homeOutPlayers,
              awayOutPlayers: team === 'away' ? count : state.activeMatch.awayOutPlayers,
            },
          };
        }),

      fetchHomeData: async () => {
        try {
          const res = await fetch('/api/stats');
          if (!res.ok) throw new Error('Failed to fetch stats');

          const data = await res.json();

          // Cache in store
          set({ homeData: data });
          return data;
        } catch (err) {
          console.error('fetchHomeData error:', err);
          return null;
        }
      },

      // Notification actions
      addNotification: (notification) =>
        set((state) => ({
          notifications: [
            {
              ...notification,
              id: `notif_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
              timestamp: Date.now(),
              read: false,
            },
            ...state.notifications,
          ].slice(0, 50), // Keep max 50 notifications
        })),

      markNotificationRead: (id) =>
        set((state) => ({
          notifications: state.notifications.map((n) =>
            n.id === id ? { ...n, read: true } : n
          ),
        })),

      markAllRead: () =>
        set((state) => ({
          notifications: state.notifications.map((n) => ({ ...n, read: true })),
        })),

      clearNotifications: () => set({ notifications: [] }),

      setLanguage: (lang) => set({ language: lang }),

      // Onboarding actions
      setHasCompletedOnboarding: (value) => set({ hasCompletedOnboarding: value }),

      setOnboardingProfile: (profile) =>
        set((state) => ({
          onboardingProfile: { ...state.onboardingProfile, ...profile },
        })),

      completeOnboarding: () =>
        set((state) => ({
          hasCompletedOnboarding: true,
          currentUser: state.currentUser
            ? {
                ...state.currentUser,
                ...(state.onboardingProfile.position && { role: state.onboardingProfile.position }),
                ...(state.onboardingProfile.weightCategory && { weight: state.onboardingProfile.weightCategory }),
              }
            : null,
        })),

      // Team management actions
      setTeamFilter: (filter) =>
        set((state) => ({
          teamManagement: { ...state.teamManagement, teamFilter: filter },
        })),

      setTeamSearch: (search) =>
        set((state) => ({
          teamManagement: { ...state.teamManagement, teamSearch: search },
        })),

      setSelectedTeamId: (teamId) =>
        set((state) => ({
          teamManagement: { ...state.teamManagement, selectedTeamId: teamId },
        })),

      setTeamDetailOpen: (open) =>
        set((state) => ({
          teamManagement: { ...state.teamManagement, teamDetailOpen: open },
        })),
    }),
    {
      name: 'kabaddi-pro-storage',
      storage: createJSONStorage(() => localStorage),
      // Only persist auth-related fields and notifications
      partialize: (state) => ({
        isAuthenticated: state.isAuthenticated,
        isOnboarded: state.isOnboarded,
        currentUser: state.currentUser,
        hasSeenSplash: state.hasSeenSplash,
        notifications: state.notifications,
        language: state.language,
        hasCompletedOnboarding: state.hasCompletedOnboarding,
        onboardingProfile: state.onboardingProfile,
      }),
    }
  )
);

export function getEventPoints(eventType: EventType): number {
  switch (eventType) {
    case 'raid_point':
      return 1;
    case 'bonus_point':
      return 1;
    case 'tackle_point':
      return 1;
    case 'super_raid':
      return 1;
    case 'super_tackle':
      return 1;
    case 'do_or_die_raid':
      return 1;
    case 'all_out':
      return 2;
    case 'empty_raid':
      return 0;
    case 'substitution':
    case 'timeout':
    case 'yellow_card':
    case 'red_card':
    case 'green_card':
      return 0;
    default:
      return 0;
  }
}
