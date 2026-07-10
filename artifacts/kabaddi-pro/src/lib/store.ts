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
  location?: string;
  position?: string;
  jerseyNumber?: number;
  email?: string;
  isPremium?: boolean;
  premiumExpiry?: string | null;
  premiumPlan?: string | null;
  isAdmin?: boolean;
  showCoachBadge?: boolean;
  createdAt?: number;
}

export interface MatchPlayer {
  id: string;
  name: string;
  phone?: string; // Phone number is the primary identifier for linking players to their accounts
  jerseyNumber?: number;
  playerCode?: string;
  team: 'home' | 'away';
  isCaptain?: boolean;
  isStarting?: boolean;
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
  | 'self_out'
  | 'technical_point'
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
  homeTeamLogo?: string | null;
  awayTeamLogo?: string | null;
  isLive: boolean;
  isPractice: boolean;
  gender?: string; // optional — no longer required (removed from UI)
  weightCategory?: string;
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
  /** Team ID that has a pending do-or-die raid. Null if no do-or-die is active. */
  doOrDieTeamId: string | null;
  homeTimeouts: number;
  awayTimeouts: number;
  homeOutPlayers: number;
  awayOutPlayers: number;
  homeOutPlayerIds: string[];
  awayOutPlayerIds: string[];
  liveStreamUrl?: string;

  // ─── Card & Disciplinary Module ─────────────────────────────────
  // Yellow-card suspensions: each entry tracks the player + the match-time
  // (in seconds) when they were suspended. The UI computes the 2-minute
  // countdown from this. When the countdown hits zero, the player can
  // re-enter at the next dead ball.
  yellowCardSuspensions: Array<{
    playerId: string;
    playerName: string;
    side: 'home' | 'away';
    suspendedAtMatchTime: number; // match.timer value when suspended
    released: boolean; // true once the scorer releases them back
  }>;
  // Red-card expulsions: player is permanently removed. The team's
  // max-on-court drops by 1 for the rest of the match.
  redCardExpulsions: Array<{
    playerId: string;
    playerName: string;
    side: 'home' | 'away';
  }>;
  // Green-card warnings: just logged, no point/suspension impact.
  greenCardWarnings: Array<{
    playerId: string;
    playerName: string;
    side: 'home' | 'away';
  }>;

  // ─── Dynamic Rule Scaling (P-based math) ────────────────────────
  // These are set at match creation based on the chosen format.
  // Defaults assume standard 7v7 rules but scale for custom formats.
  bonusEnabled: boolean;          // master toggle — false for small formats (2v2, 3v3)
  revivalEnabled: boolean;        // false = "No-Revival Mode" (points only, players stay on mat)
  allOutBonusPoints: number;      // default 2, customizable
  superTackleThreshold: number;   // default floor(P/2) — super tackle activates when defenders <= this
  bonusLineThreshold: number;     // default P-1 — bonus activates when defenders >= this
  // Asymmetric team support: each team can have a different starting P.
  // Defaults to playersPerSide for both teams when symmetry is used.
  homeStartingP: number;          // Team A's starting player count
  awayStartingP: number;          // Team B's starting player count
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
  matchId?: string; // for match_start/match_result notifications — used to open the scorecard
}

export type Language = 'en' | 'hi';

export type HomeData = Record<string, unknown> | null;

export type OnboardingPosition = 'raider' | 'defender' | 'all-rounder';
export type OnboardingWeightCategory = string; // 'open' or any manually entered weight like '65kg'

export interface OnboardingProfile {
  position: OnboardingPosition | null;
  weightCategory: OnboardingWeightCategory | null;
  selectedTeamId: string | null;
}

// Team management types
export type TeamFilter = 'my' | 'search';

export interface TeamManagementState {
  teamFilter: TeamFilter;
  teamSearch: string;
  selectedTeamId: string | null;
  teamDetailOpen: boolean;
}

export interface CoachAcademy {
  id: string;
  name: string;
  location: string;
  groundName: string;
  totalPlayers: number;
  rules: {
    sundayHoliday: boolean;
    practiceSchedule: 'one-time' | 'both-time';
    customRules: string[];
  };
  createdAt: number;
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
  tossMatchConfig: Omit<ActiveMatch, 'isLive' | 'currentHalf' | 'timer' | 'homeScore' | 'awayScore' | 'events' | 'raidQueue' | 'isDoOrDie' | 'doOrDieTeamId' | 'homeTimeouts' | 'awayTimeouts' | 'homeOutPlayers' | 'awayOutPlayers' | 'homeOutPlayerIds' | 'awayOutPlayerIds' | 'yellowCardSuspensions' | 'redCardExpulsions' | 'greenCardWarnings'> | null;

  // Home Data cache
  homeData: HomeData;

  // Notifications
  notifications: AppNotification[];

  // Language
  language: Language;

  // Dark mode (persisted in localStorage so the user's choice survives reloads)
  darkMode: boolean;
  setDarkMode: (dark: boolean) => void;
  toggleDarkMode: () => void;

  // Onboarding
  hasCompletedOnboarding: boolean;
  onboardingProfile: OnboardingProfile;

  // Team Management
  teamManagement: TeamManagementState;

  // Coach
  coachAcademies: CoachAcademy[];
  addCoachAcademy: (academy: Omit<CoachAcademy, 'id' | 'createdAt'>) => void;
  removeCoachAcademy: (id: string) => void;
  updateCoachAcademy: (id: string, data: Partial<CoachAcademy>) => void;

  // Actions
  login: (user: CurrentUser) => void;
  logout: () => void;
  setOnboarded: (value?: boolean) => void;
  updateUser: (data: Partial<CurrentUser>) => void;
  setActiveTab: (tab: TabId) => void;
  setHasSeenSplash: (value: boolean) => void;
  initiateToss: (matchConfig: Omit<ActiveMatch, 'isLive' | 'currentHalf' | 'timer' | 'homeScore' | 'awayScore' | 'events' | 'raidQueue' | 'isDoOrDie' | 'doOrDieTeamId' | 'homeTimeouts' | 'awayTimeouts' | 'homeOutPlayers' | 'awayOutPlayers' | 'homeOutPlayerIds' | 'awayOutPlayerIds' | 'yellowCardSuspensions' | 'redCardExpulsions' | 'greenCardWarnings'>) => void;
  cancelToss: () => void;
  startMatch: (match: Omit<ActiveMatch, 'isLive' | 'currentHalf' | 'timer' | 'homeScore' | 'awayScore' | 'events' | 'raidQueue' | 'isDoOrDie' | 'doOrDieTeamId' | 'homeTimeouts' | 'awayTimeouts' | 'homeOutPlayers' | 'awayOutPlayers' | 'homeOutPlayerIds' | 'awayOutPlayerIds' | 'yellowCardSuspensions' | 'redCardExpulsions' | 'greenCardWarnings'>, firstRaidTeam?: 'home' | 'away') => void;
  endMatch: () => void;
  updateScore: (team: 'home' | 'away', delta: number) => void;
  addEvent: (event: Omit<MatchEvent, 'id' | 'timestamp'>) => void;
  addBatchEvents: (events: Omit<MatchEvent, 'id' | 'timestamp'>[]) => void;
  undoLastEvent: () => void;
  undoLastRaid: () => void;
  addPlayerToMatch: (side: 'home' | 'away', player: MatchPlayer) => void;
  switchHalf: () => void;
  setTimer: (time: number) => void;
  setDoOrDie: (value: boolean, teamId?: string) => void;
  switchRaidQueue: () => void;
  callTimeout: (team: 'home' | 'away') => void;
  setOutPlayers: (team: 'home' | 'away', count: number) => void;
  // Card & Disciplinary actions
  issueGreenCard: (side: 'home' | 'away', playerId: string, playerName: string) => void;
  issueYellowCard: (side: 'home' | 'away', playerId: string, playerName: string) => void;
  releaseYellowCard: (playerId: string) => void;
  issueRedCard: (side: 'home' | 'away', playerId: string, playerName: string) => void;
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

  // Match transfer / handoff
  loadMatch: (match: ActiveMatch) => void;
}

/** Helper: determine which side a teamId belongs to in a match */
function getTeamSide(match: ActiveMatch, teamId: string): 'home' | 'away' {
  if (teamId === match.homeTeamId) return 'home';
  return 'away';
}

/** Helper: recalculate scores, out counts, and out player IDs from a list of events
 *  Implements proper Pro Kabaddi rules:
 *  - Revival: 1 point = 1 player revived from front of out queue (FIFO)
 *  - All-Out: AUTO-DETECTED when all 7 defenders are out → +2 bonus points + all revive
 *  - Tackle: Raider goes out, defending team revives 1 player per tackle point
 *  - Do-or-Die: AUTO-TRIGGERED after 2 consecutive empty raids → isDoOrDie + doOrDieTeamId
 *  - Super Raid: Single event with value 3+ (no separate raid_point needed)
 */
function recalculateFromEvents(match: ActiveMatch, events: MatchEvent[]) {
  let homeScore = 0;
  let awayScore = 0;
  let homeOutPlayerIds: string[] = [];
  let awayOutPlayerIds: string[] = [];

  const emptyRaidCount: Record<string, number> = {};

  const addPoints = (side: 'home' | 'away', pts: number) => {
    if (side === 'home') homeScore += pts;
    else awayScore += pts;
  };

  const revive = (side: 'home' | 'away', count: number) => {
    const outIds = side === 'home' ? homeOutPlayerIds : awayOutPlayerIds;
    const reviveCount = Math.min(count, outIds.length);
    const remaining = outIds.slice(reviveCount);
    if (side === 'home') homeOutPlayerIds = remaining;
    else awayOutPlayerIds = remaining;
  };

  const sendOut = (side: 'home' | 'away', playerId: string) => {
    const outIds = side === 'home' ? homeOutPlayerIds : awayOutPlayerIds;
    if (playerId && !outIds.includes(playerId)) {
      if (side === 'home') homeOutPlayerIds = [...outIds, playerId];
      else awayOutPlayerIds = [...outIds, playerId];
    }
  };

  const checkAllOut = (defendingSide: 'home' | 'away'): boolean => {
    const defendingLineup = defendingSide === 'home' ? match.homeLineup : match.awayLineup;
    const defendingOutIds = defendingSide === 'home' ? homeOutPlayerIds : awayOutPlayerIds;
    const activeCount = defendingLineup.slice(0, match.playersPerSide).length - defendingOutIds.length;
    if (activeCount <= 0 && defendingOutIds.length > 0) {
      if (defendingSide === 'home') homeOutPlayerIds = [];
      else awayOutPlayerIds = [];
      return true;
    }
    return false;
  };

  for (const evt of events) {
    const side = getTeamSide(match, evt.teamId);
    let details: Record<string, unknown> = {};
    try { details = evt.details ? JSON.parse(evt.details) : {}; } catch { /* skip */ }

    // ─── RAID POINT ───
    // NOTE: super_raid is a LABEL only (value=0) — it does NOT add points.
    // The points come from the raid_point event itself (1 per defender touched).
    if (evt.eventType === 'raid_point') {
      addPoints(side, evt.value);
      const defendingSide = side === 'home' ? 'away' : 'home';

      // MUTUAL OUT special case: when both teams have players out in the same
      // raid, the details object carries `mutualOut: true` plus `defendersOut`
      // (the count of defenders sent out) instead of an explicit touchedPlayerIds
      // list. We trust the count and revive the corresponding number of raiders.
      if (details.mutualOut === true) {
        const defendersOut = (details.defendersOut as number) || evt.value || 0;
        // We don't know which specific defenders were touched (the count came
        // from the UI's mutual-out picker), but we can still revive the right
        // number of raiders from the raiding team's out queue.
        revive(side, defendersOut);
        emptyRaidCount[evt.teamId] = 0;
      } else {
        // Standard raid point: send out each touched defender, revive N raiders.
        const touchedIds: string[] = (details.touchedPlayerIds as string[]) || [];
        for (const tid of touchedIds) { sendOut(defendingSide, tid); }
        revive(side, evt.value);
        emptyRaidCount[evt.teamId] = 0;
      }
      // NOTE: All-out bonus is NOT auto-added here. The LiveScoringScreen
      // pushes an explicit 'all_out' event when all defenders are eliminated,
      // and that event's handler below adds the bonus + clears the queue.
      // Auto-adding here would double-count the all-out bonus.
    }

    // ─── SUPER RAID (label only, value=0, no points) ───
    else if (evt.eventType === 'super_raid') {
      // Do nothing — super_raid is just a label for match history.
      // Points were already counted by the raid_point event.
    }

    // ─── BONUS POINT ───
    else if (evt.eventType === 'bonus_point') {
      addPoints(side, evt.value);
      revive(side, 1);
      emptyRaidCount[evt.teamId] = 0;
    }

    // ─── TACKLE / SUPER TACKLE ───
    else if (evt.eventType === 'tackle_point' || evt.eventType === 'super_tackle') {
      addPoints(side, evt.value);
      const raiderSide = side === 'home' ? 'away' : 'home';

      // MUTUAL OUT special case: when both teams have players out in the same
      // raid, the defending team's tackle_point event carries `mutualOut: true`
      // plus `raidersOut` (the count of raiding-team players sent out, INCLUDING
      // the raider). Standard tackle_point sends out 1 raider; mutual out sends
      // out N raiders and revives N defenders.
      if (details.mutualOut === true) {
        const raidersOut = (details.raidersOut as number) || evt.value || 1;
        const raiderId = (details.raiderId as string) || evt.playerId || '';
        if (raiderId) sendOut(raiderSide, raiderId);
        revive(side, raidersOut);
      } else {
        const raiderId = (details.raiderId as string) || evt.playerId;
        sendOut(raiderSide, raiderId || '');
        revive(side, evt.value);
      }
      emptyRaidCount[evt.teamId] = 0;
      // NOTE: All-out bonus is handled by the explicit 'all_out' event
      // pushed by LiveScoringScreen — NOT auto-added here to avoid double-counting.
    }

    // ─── SELF-OUT (raider or defender steps out of court) ───
    // details.selfOutSide tells us WHO stepped out: 'raider' or 'defender'
    // If raider steps out → defending team gets 1 point + raider goes to out queue
    // If defender steps out → raiding team gets 1 point + defender goes to out queue + 1 revival
    else if (evt.eventType === 'self_out') {
      const selfOutPlayerId = (details.selfOutPlayerId as string) || evt.playerId || '';
      const selfOutRole = (details.selfOutRole as string) || 'defender'; // 'raider' or 'defender'

      if (selfOutRole === 'raider') {
        // Raider stepped out → defending team scores
        // 'side' is the defending team (they get the point)
        addPoints(side, evt.value);
        // Raider goes to out queue (raider is from the OPPOSING team)
        const raiderSide = side === 'home' ? 'away' : 'home';
        sendOut(raiderSide, selfOutPlayerId);
        // Defending team revives 1 player
        revive(side, 1);
        // Reset empty raid counter for the raider's team (raid ended)
        const raiderTeamId = side === 'home' ? match.awayTeamId : match.homeTeamId;
        emptyRaidCount[raiderTeamId] = 0;
      } else {
        // Defender stepped out → raiding team scores (point already given
        // via technical_point event, so self_out has value=0 here).
        // We just send the defender to the out queue and revive a player.
        // 'side' is the raiding team.
        addPoints(side, evt.value); // value=0, no-op — point already given
        // Defender goes to out queue (defender is from the OPPOSING team)
        const defendingSide = side === 'home' ? 'away' : 'home';
        sendOut(defendingSide, selfOutPlayerId);
        // Raiding team revives 1 player
        revive(side, 1);
        // Do NOT reset empty raid counter — the raid CONTINUES.
        // The raider can still score more points or come back empty.
        // NOTE: All-out bonus is handled by the explicit 'all_out' event.
      }
    }

    // ─── DO-OR-DIE RAID (failed) ───
    else if (evt.eventType === 'do_or_die_raid') {
      addPoints(side, evt.value);
      const raiderId = (details.raiderId as string) || evt.playerId;
      const raiderSide = side === 'home' ? 'away' : 'home';
      sendOut(raiderSide, raiderId || '');
      revive(side, 1);
      const failedTeamId = side === 'home' ? match.awayTeamId : match.homeTeamId;
      emptyRaidCount[failedTeamId] = 0;
    }

    // ─── ALL OUT (manual trigger) ───
    else if (evt.eventType === 'all_out') {
      addPoints(side, evt.value);
      const eliminatedSide = side === 'home' ? 'away' : 'home';
      if (eliminatedSide === 'home') homeOutPlayerIds = [];
      else awayOutPlayerIds = [];
    }

    // ─── EMPTY RAID ───
    else if (evt.eventType === 'empty_raid') {
      emptyRaidCount[evt.teamId] = (emptyRaidCount[evt.teamId] || 0) + 1;
    }

    // ─── TECHNICAL POINT (by umpire) ───
    // Awards points without affecting outs, revivals, or raid queue.
    // Does NOT end a raid (it's awarded between raids or during stoppages).
    else if (evt.eventType === 'technical_point') {
      addPoints(side, evt.value);
    }

    // Non-scoring events (substitution, timeout, cards) don't affect score or outs
  }

  // ─── Auto Do-or-Die after 2 consecutive empty raids ───
  let isDoOrDie = false;
  let doOrDieTeamId: string | null = null;
  for (const [teamId, count] of Object.entries(emptyRaidCount)) {
    if (count >= 2) {
      isDoOrDie = true;
      doOrDieTeamId = teamId;
      break;
    }
  }

  return {
    homeScore,
    awayScore,
    homeOutPlayers: homeOutPlayerIds.length,
    awayOutPlayers: awayOutPlayerIds.length,
    homeOutPlayerIds,
    awayOutPlayerIds,
    isDoOrDie,
    doOrDieTeamId,
  };
}

/** Event types that constitute a complete raid and should flip the turn */
const RAID_ENDING_EVENT_TYPES: string[] = [
  'raid_point', 'tackle_point', 'super_tackle', 'empty_raid',
  'bonus_point', 'do_or_die_raid', 'super_raid', 'self_out',
];

/** Event types that do NOT flip the turn (non-raid events) */
const NON_RAID_EVENT_TYPES: string[] = [
  'all_out', 'substitution', 'timeout', 'yellow_card', 'red_card', 'green_card',
];

/**
 * Event types where the SCORING team is the DEFENDING team.
 * In these cases, the defending team scored (they made the tackle / raider failed do-or-die),
 * so they should raid NEXT — the turn goes to the SAME side that scored.
 *
 * For all other raid-ending events (raid_point, bonus_point, super_raid, empty_raid, self_out),
 * the scoring team is the RAIDING team, so the turn goes to the OPPOSITE side.
 */
const DEFENDING_TEAM_SCORES: Set<string> = new Set([
  'tackle_point',
  'super_tackle',
  'do_or_die_raid',
]);

/** Helper: determine raid queue from last raid-ending event */
function getRaidQueueFromEvents(match: ActiveMatch, events: MatchEvent[]): 'home' | 'away' {
  const lastRaidEvent = [...events].reverse().find(e => RAID_ENDING_EVENT_TYPES.includes(e.eventType));
  if (lastRaidEvent) {
    const side = getTeamSide(match, lastRaidEvent.teamId);

    // Self-out is special — the scoring team depends on WHO stepped out:
    //   - Raider self-out → defending team scored (teamId = defending) → they raid next
    //   - Defender self-out → raiding team scored (teamId = raiding) → defending team raids next
    // We check selfOutRole in the event details to determine this.
    if (lastRaidEvent.eventType === 'self_out') {
      let details: Record<string, unknown> = {};
      try { details = lastRaidEvent.details ? JSON.parse(lastRaidEvent.details) : {}; } catch { /* skip */ }
      const selfOutRole = details.selfOutRole as string;
      if (selfOutRole === 'raider') {
        // Raider self-out → defending team scored → they raid next
        return side;
      } else {
        // Defender self-out → raiding team scored BUT the raid CONTINUES.
        // The raider can still score more or come back empty.
        // Do NOT swap the turn — return the current raidQueue unchanged.
        return match.raidQueue;
      }
    }

    // If the defending team scored (tackle/super_tackle/do_or_die_raid),
    // THEY raid next — return the SAME side as the scoring team.
    if (DEFENDING_TEAM_SCORES.has(lastRaidEvent.eventType)) {
      return side;
    }
    // If the raiding team scored (touch points, bonus, super raid, etc.)
    // or it was an empty raid, the DEFENDING team raids next — return the OPPOSITE side.
    return side === 'home' ? 'away' : 'home';
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

      // Dark mode — defaults to false (light). The persisted value (if any) is
      // restored by zustand persist, and a useEffect in App.tsx applies the
      // `.dark` class to document.documentElement whenever darkMode changes.
      // We ALSO write a standalone localStorage key 'theme-mode' as a backup
      // in case zustand persist fails to hydrate correctly.
      darkMode: typeof localStorage !== 'undefined' && localStorage.getItem('theme-mode') === 'dark',
      setDarkMode: (dark) => {
        set({ darkMode: dark });
        // Apply the class immediately so the UI updates without waiting for re-render
        if (typeof document !== 'undefined') {
          if (dark) {
            document.documentElement.classList.add('dark');
          } else {
            document.documentElement.classList.remove('dark');
          }
        }
        // ALSO write a standalone localStorage key as a backup — this is
        // read by the inline script in index.html and eliminates any
        // dependency on zustand persist working correctly.
        if (typeof localStorage !== 'undefined') {
          try {
            localStorage.setItem('theme-mode', dark ? 'dark' : 'light');
          } catch (e) {
            // localStorage might be full or disabled — ignore
          }
        }
      },
      toggleDarkMode: () => {
        const next = !get().darkMode;
        get().setDarkMode(next);
      },

      // Onboarding
      hasCompletedOnboarding: false,
      onboardingProfile: {
        position: null,
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

      // Coach
      coachAcademies: [],
      addCoachAcademy: (academy) =>
        set((state) => ({
          coachAcademies: [
            ...state.coachAcademies,
            { ...academy, id: `coach_${Date.now()}`, createdAt: Date.now() },
          ],
        })),
      removeCoachAcademy: (id) =>
        set((state) => ({
          coachAcademies: state.coachAcademies.filter((a) => a.id !== id),
        })),
      updateCoachAcademy: (id, data) =>
        set((state) => ({
          coachAcademies: state.coachAcademies.map((a) =>
            a.id === id ? { ...a, ...data } : a
          ),
        })),

      // Actions
      login: (user) =>
        set({
          isAuthenticated: true,
          isOnboarded: !!(user.name),
          currentUser: { ...user, createdAt: user.createdAt || Date.now() },
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

      startMatch: (match, firstRaidTeam) => {
        // Create a live match record in the backend so it appears in the home
        // feed for players in the playing teams. Fire-and-forget — don't block
        // the UI. The returned match ID is stored on activeMatch.id so we can
        // PATCH updates (score changes) and mark it completed at the end.
        try {
          fetch('/api/matches/live', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              homeTeamName: match.homeTeam,
              awayTeamName: match.awayTeam,
              homeTeamColor: match.homeTeamColor,
              awayTeamColor: match.awayTeamColor,
              isPractice: match.isPractice,
              halfDuration: match.halfDuration,
              playersPerSide: match.playersPerSide,
              gender: match.gender,
              weightCategory: match.weightCategory,
            }),
          })
            .then((res) => res.ok ? res.json() : null)
            .then((data) => {
              if (data?.match?.id) {
                // Store the DB match ID on the active match so we can PATCH it later
                set((state) => ({
                  activeMatch: state.activeMatch ? { ...state.activeMatch, id: data.match.id } : null,
                }));
              }
            })
            .catch((err) => console.error('Failed to create live match:', err));
        } catch (e) {
          // Non-critical — don't fail match start if live record creation fails
          console.error('Live match create error:', e);
        }

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
            doOrDieTeamId: null,
            homeTimeouts: 0,
            awayTimeouts: 0,
            homeOutPlayers: 0,
            awayOutPlayers: 0,
            homeOutPlayerIds: [],
            awayOutPlayerIds: [],
            // Card & Disciplinary Module — start with empty arrays
            yellowCardSuspensions: [],
            redCardExpulsions: [],
            greenCardWarnings: [],
            // Dynamic Rule Scaling — use match-provided values or sensible defaults
            bonusEnabled: match.bonusEnabled ?? true,
            revivalEnabled: match.revivalEnabled ?? true,
            allOutBonusPoints: match.allOutBonusPoints ?? 2,
            superTackleThreshold: match.superTackleThreshold ?? Math.floor(match.playersPerSide / 2),
            bonusLineThreshold: match.bonusLineThreshold ?? Math.max(1, match.playersPerSide - 1),
            homeStartingP: match.homeStartingP ?? match.playersPerSide,
            awayStartingP: match.awayStartingP ?? match.playersPerSide,
          },
          activeTab: 'quick-score',
          showToss: false,
          tossMatchConfig: null,
        });
      },

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

          // Only flip raidQueue for raid-ending events.
          // Non-raid events (timeout, substitution, cards, standalone all_out)
          // should NOT change whose turn it is to raid.
          const isRaidEndingEvent = RAID_ENDING_EVENT_TYPES.includes(event.eventType);
          const raidQueue = isRaidEndingEvent
            ? getRaidQueueFromEvents(state.activeMatch, updatedEvents)
            : state.activeMatch.raidQueue;

          return {
            activeMatch: {
              ...state.activeMatch,
              events: updatedEvents,
              ...calculated,
              raidQueue,
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

      addPlayerToMatch: (side, player) =>
        set((state) => {
          if (!state.activeMatch) return {};
          const lineupKey = side === 'home' ? 'homeLineup' : 'awayLineup';
          return {
            activeMatch: {
              ...state.activeMatch,
              [lineupKey]: [...state.activeMatch[lineupKey], player],
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
              doOrDieTeamId: null,
            },
          };
        }),

      setTimer: (time) =>
        set((state) => {
          if (!state.activeMatch) return {};
          return { activeMatch: { ...state.activeMatch, timer: time } };
        }),

      setDoOrDie: (value, teamId?) =>
        set((state) => {
          if (!state.activeMatch) return {};
          return {
            activeMatch: {
              ...state.activeMatch,
              isDoOrDie: value,
              doOrDieTeamId: value ? (teamId || null) : null,
            },
          };
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

      // ─── Card & Disciplinary Module actions ─────────────────────────
      // Green card = formal warning, logged only, no game impact
      issueGreenCard: (side, playerId, playerName) =>
        set((state) => {
          if (!state.activeMatch) return {};
          return {
            activeMatch: {
              ...state.activeMatch,
              greenCardWarnings: [...state.activeMatch.greenCardWarnings, { playerId, playerName, side }],
            },
          };
        }),

      // Yellow card = 2-minute suspension. Player removed from mat, can't be revived,
      // 2-min countdown starts. Scorer releases them back when timer expires.
      issueYellowCard: (side, playerId, playerName) =>
        set((state) => {
          if (!state.activeMatch) return {};
          return {
            activeMatch: {
              ...state.activeMatch,
              yellowCardSuspensions: [...state.activeMatch.yellowCardSuspensions, {
                playerId,
                playerName,
                side,
                suspendedAtMatchTime: state.activeMatch.timer,
                released: false,
              }],
            },
          };
        }),

      // Release a yellow-carded player back onto the mat (after 2-min timer expires)
      releaseYellowCard: (playerId) =>
        set((state) => {
          if (!state.activeMatch) return {};
          return {
            activeMatch: {
              ...state.activeMatch,
              yellowCardSuspensions: state.activeMatch.yellowCardSuspensions.map(s =>
                s.playerId === playerId ? { ...s, released: true } : s
              ),
            },
          };
        }),

      // Red card = permanent expulsion. Player removed for rest of match.
      // Team's max-on-court drops by 1 (handled in UI by checking redCardExpulsions length).
      issueRedCard: (side, playerId, playerName) =>
        set((state) => {
          if (!state.activeMatch) return {};
          return {
            activeMatch: {
              ...state.activeMatch,
              redCardExpulsions: [...state.activeMatch.redCardExpulsions, { playerId, playerName, side }],
            },
          };
        }),

      fetchHomeData: async () => {
        try {
          const res = await fetch('/api/stats');
          if (!res.ok) return null;
          const data = await res.json();
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
                ...(state.onboardingProfile.position && { position: state.onboardingProfile.position }),
                ...(state.onboardingProfile.weightCategory && { weight: state.onboardingProfile.weightCategory }),
                createdAt: state.currentUser.createdAt || Date.now(),
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

      // Match transfer / handoff — load a match from a transfer
      loadMatch: (match) =>
        set({
          activeMatch: match,
          activeTab: 'quick-score' as TabId,
          showToss: false,
          tossMatchConfig: null,
        }),
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
        darkMode: state.darkMode,
        hasCompletedOnboarding: state.hasCompletedOnboarding,
        onboardingProfile: state.onboardingProfile,
        coachAcademies: state.coachAcademies,
        // CRITICAL: Persist the active match so closing the app doesn't lose
        // all scoring data. When the app reopens, the match is restored from
        // localStorage and the user sees a "Continue Match" prompt.
        activeMatch: state.activeMatch,
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
    case 'self_out':
      return 1;
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
