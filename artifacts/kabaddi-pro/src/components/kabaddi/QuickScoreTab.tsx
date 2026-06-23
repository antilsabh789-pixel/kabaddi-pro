'use client';

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ChevronLeft, ChevronRight, Plus, X, Search, UserPlus, Database, Check, Clock, Users, Swords, Play, GripVertical, Shield, Zap, Settings,
  AlertTriangle, Sparkles, Eye, Info, ChevronDown, ArrowLeftRight, Crown, Radio,
} from 'lucide-react';
import { useKabaddiStore, type MatchPlayer } from '@/lib/store';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import ScorerTransferScreen from './ScorerTransferScreen';

interface UserTeam {
  id: string;
  name: string;
  shortName: string | null;
  color: string | null;
  members?: DbPlayer[];
}

interface MatchConfig {
  weightCategory: string;
  halfDuration: number;
  playersPerSide: number;
  homeTeam: string;
  awayTeam: string;
  homeTeamColor: string;
  awayTeamColor: string;
  homeLineup: MatchPlayer[];
  awayLineup: MatchPlayer[];
  liveStreamUrl: string;
}

// ─── Weight Category Config ─────────────────────────────────────
// Only 2 options: "Open" (no restriction) or "Weight" (enter manually)
// Weight values are stored as-is (e.g. "65kg", "70kg")

const STEPS = ['Settings', 'Teams', 'Lineup', 'Start'];
const STEP_ICONS = [Settings, Swords, Shield, Play];

const MAX_SQUAD_SIZE = 12; // 7 starting + 5 substitutes

interface DbPlayer {
  id: string;
  name: string | null;
  phone: string | null;
  playerCode: string | null;
  avatar: string | null;
  gender?: string | null;
  profile?: {
    position: string | null;
    jerseyNumber: number | null;
    overallRating: number;
    totalPoints?: number;
    raidPoints?: number;
    tacklePoints?: number;
    totalRaids?: number;
    successfulRaids?: number;
  } | null;
}

// ─── Position Balance Config ────────────────────────────────────

const POSITION_BALANCE: Record<number, { raiders: number; defenders: number; allRounders: number }> = {
  5: { raiders: 1, defenders: 3, allRounders: 1 },
  6: { raiders: 2, defenders: 3, allRounders: 1 },
  7: { raiders: 2, defenders: 3, allRounders: 2 },
  8: { raiders: 2, defenders: 4, allRounders: 2 },
  9: { raiders: 3, defenders: 4, allRounders: 2 },
  10: { raiders: 3, defenders: 5, allRounders: 2 },
  11: { raiders: 3, defenders: 5, allRounders: 3 },
  12: { raiders: 4, defenders: 5, allRounders: 3 },
};

function getPositionCategory(position: string | null): 'raider' | 'defender' | 'all-rounder' | 'unknown' {
  if (!position) return 'unknown';
  const p = position.toLowerCase();
  if (p.includes('raider')) return 'raider';
  if (p.includes('defend') || p.includes('corner') || p.includes('cover')) return 'defender';
  if (p.includes('all')) return 'all-rounder';
  return 'unknown';
}

// ─── Lineup Validation Component ────────────────────────────────

function LineupValidation({ lineup, playersPerSide, teamName }: {
  lineup: MatchPlayer[];
  playersPerSide: number;
  teamName: string;
}) {
  const warnings: { message: string; severity: 'error' | 'warning' | 'info' }[] = [];

  if (lineup.length === 0) {
    warnings.push({ message: 'No players added', severity: 'error' });
  } else if (lineup.length < playersPerSide) {
    warnings.push({
      message: `${lineup.length}/${playersPerSide} players — need ${playersPerSide - lineup.length} more`,
      severity: 'warning',
    });
  } else if (lineup.length > playersPerSide) {
    warnings.push({
      message: `${lineup.length} players — ${lineup.length - playersPerSide} extra`,
      severity: 'info',
    });
  }

  // Position balance check (only if we have position data from DB)
  const balance = POSITION_BALANCE[playersPerSide];
  // Note: position data might not be available for quick-added players
  // We check this based on the allPlayers data which is in parent scope

  if (warnings.length === 0) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: -5 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-1.5"
    >
      {warnings.map((w, i) => (
        <div
          key={i}
          className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium ${
            w.severity === 'error'
              ? 'bg-brand-red/10 text-brand-red dark:bg-brand-red/15'
              : w.severity === 'warning'
                ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400 dark:bg-amber-500/15'
                : 'bg-blue-500/10 text-blue-600 dark:text-blue-400 dark:bg-blue-500/15'
          }`}
        >
          <AlertTriangle className={`w-3.5 h-3.5 shrink-0 ${w.severity === 'info' ? 'hidden' : ''}`} />
          <Info className={`w-3.5 h-3.5 shrink-0 ${w.severity !== 'info' ? 'hidden' : ''}`} />
          <span>{teamName}: {w.message}</span>
        </div>
      ))}
    </motion.div>
  );
}

// ─── Player Stats Tooltip ───────────────────────────────────────

function PlayerStatsTooltip({ player, allPlayers }: { player: DbPlayer; allPlayers: DbPlayer[] }) {
  const dbPlayer = allPlayers.find(p => p.id === player.id);
  const profile = dbPlayer?.profile;

  if (!profile || !profile.totalPoints) return null;

  const raidSuccessRate = profile.totalRaids && profile.totalRaids > 0
    ? Math.round(((profile.successfulRaids || 0) / profile.totalRaids) * 100)
    : 0;

  return (
    <div className="absolute z-30 bottom-full left-0 mb-1 p-2 bg-white dark:bg-warm-800 border border-warm-200 dark:border-warm-600 rounded-lg shadow-lg text-[10px] min-w-[140px]">
      <div className="space-y-1">
        <div className="flex justify-between">
          <span className="text-warm-500 dark:text-warm-400">Total Pts</span>
          <span className="font-bold text-brand-navy dark:text-brand-navy-light">{profile.totalPoints}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-warm-500 dark:text-warm-400">Raid Pts</span>
          <span className="font-bold text-brand-red">{profile.raidPoints || 0}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-warm-500 dark:text-warm-400">Tackle Pts</span>
          <span className="font-bold text-brand-teal">{profile.tacklePoints || 0}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-warm-500 dark:text-warm-400">Raid Success</span>
          <span className="font-bold text-brand-gold">{raidSuccessRate}%</span>
        </div>
      </div>
      {/* Tooltip arrow */}
      <div className="absolute -bottom-1 left-4 w-2 h-2 bg-white dark:bg-warm-800 border-r border-b border-warm-200 dark:border-warm-600 rotate-45" />
    </div>
  );
}

// ─── Formation Visualization ────────────────────────────────────

function FormationVisualization({ lineup, teamColor, teamName, side }: {
  lineup: MatchPlayer[];
  teamColor: string;
  teamName: string;
  side: 'left' | 'right';
}) {
  const maxDisplay = Math.min(lineup.length, 7);
  const displayPlayers = lineup.slice(0, maxDisplay);

  return (
    <div className="flex-1 relative">
      {/* Team header */}
      <div className="text-center mb-2">
        <div
          className="w-10 h-10 rounded-xl mx-auto flex items-center justify-center text-white font-black text-sm shadow-md"
          style={{ backgroundColor: teamColor }}
        >
          {teamName.charAt(0).toUpperCase()}
        </div>
        <p className="text-[10px] font-bold text-warm-600 dark:text-warm-300 mt-1 truncate max-w-[80px] mx-auto">
          {teamName}
        </p>
      </div>

      {/* Formation layout */}
      <div className="relative bg-warm-100/40 dark:bg-warm-700/20 rounded-xl p-2 min-h-[90px]">
        {/* Court half line */}
        <div className={`absolute top-1/2 left-0 right-0 h-px bg-warm-200 dark:bg-warm-600 ${
          side === 'left' ? 'bg-gradient-to-r from-transparent to-warm-200 dark:to-warm-600' : 'bg-gradient-to-l from-transparent to-warm-200 dark:to-warm-600'
        }`} />

        {/* Players in formation */}
        <div className="grid grid-cols-3 gap-1 place-items-center">
          {displayPlayers.map((player, i) => {
            // Simple formation: top row = defenders, middle = all-rounders, bottom = raiders
            return (
              <motion.div
                key={player.id}
                initial={{ scale: 0, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ delay: i * 0.05, type: 'spring', stiffness: 300, damping: 20 }}
                className="flex flex-col items-center"
              >
                <div
                  className="w-7 h-7 rounded-full flex items-center justify-center text-white text-[8px] font-bold shadow-sm"
                  style={{ backgroundColor: teamColor }}
                >
                  {player.jerseyNumber || i + 1}
                </div>
                <span className="text-[7px] text-warm-400 dark:text-warm-500 mt-0.5 truncate max-w-[32px]">
                  {player.name.split(' ')[0]}
                </span>
              </motion.div>
            );
          })}
          {/* Empty slots */}
          {Array.from({ length: Math.max(0, 7 - displayPlayers.length) }).map((_, i) => (
            <div key={`empty-${i}`} className="flex flex-col items-center">
              <div className="w-7 h-7 rounded-full border-2 border-dashed border-warm-200 dark:border-warm-600 flex items-center justify-center">
                <span className="text-[8px] text-warm-300 dark:text-warm-600">?</span>
              </div>
              <span className="text-[7px] text-warm-300 dark:text-warm-600 mt-0.5">Empty</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Team Picker Modal ──────────────────────────────────────────
function TeamPickerModal({
  title,
  userTeams,
  onSelect,
  onClose,
  onSearch,
}: {
  title: string;
  userTeams: UserTeam[];
  onSelect: (team: UserTeam | { id: string; name: string; shortName: string | null; color: string | null; teamCode: string | null }) => void;
  onClose: () => void;
  onSearch: (query: string) => Promise<Array<{ id: string; name: string; shortName: string | null; color: string | null; teamCode: string | null; memberCount?: number }>>;
}) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Array<{ id: string; name: string; shortName: string | null; color: string | null; teamCode: string | null; memberCount?: number }>>([]);
  const [searching, setSearching] = useState(false);

  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      return;
    }
    const timer = setTimeout(async () => {
      setSearching(true);
      try {
        const r = await onSearch(query);
        setResults(r);
      } catch { /* ignore */ }
      finally { setSearching(false); }
    }, 300);
    return () => clearTimeout(timer);
  }, [query, onSearch]);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[60] bg-black/50 flex items-end sm:items-center justify-center"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <motion.div
        initial={{ y: '100%' }}
        animate={{ y: 0 }}
        exit={{ y: '100%' }}
        transition={{ type: 'spring', damping: 25, stiffness: 300 }}
        className="w-full max-w-md bg-white dark:bg-warm-800 rounded-t-2xl sm:rounded-2xl p-4 max-h-[80vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-lg font-bold text-warm-800 dark:text-warm-100">{title}</h3>
          <button onClick={onClose} className="w-8 h-8 rounded-full bg-warm-100 dark:bg-warm-700 flex items-center justify-center">
            <X className="w-4 h-4 text-warm-500" />
          </button>
        </div>

        {/* Search */}
        <div className="relative mb-3">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-warm-400" />
          <input
            type="text"
            placeholder="Search by name or team code..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="w-full h-10 pl-10 pr-4 rounded-xl bg-warm-50 dark:bg-warm-700 border border-warm-200 dark:border-warm-600 text-sm text-warm-800 dark:text-warm-100"
          />
        </div>

        {/* My Teams section (shown when no search query) */}
        {!query.trim() && userTeams.length > 0 && (
          <div className="mb-3">
            <p className="text-xs font-bold text-warm-500 uppercase tracking-wider mb-2">My Teams</p>
            {userTeams.map(team => (
              <button
                key={team.id}
                onClick={() => onSelect(team)}
                className="w-full flex items-center gap-3 p-3 rounded-xl bg-warm-50 dark:bg-warm-700/50 hover:bg-warm-100 dark:hover:bg-warm-700 transition-colors mb-1.5"
              >
                <div className="w-10 h-10 rounded-xl flex items-center justify-center text-white font-black text-sm" style={{ backgroundColor: team.color || '#DC2626' }}>
                  {team.shortName || team.name.charAt(0)}
                </div>
                <span className="flex-1 text-left text-sm font-bold text-warm-800 dark:text-warm-100">{team.name}</span>
              </button>
            ))}
          </div>
        )}

        {/* Search results */}
        {query.trim() && (
          <div>
            <p className="text-xs font-bold text-warm-500 uppercase tracking-wider mb-2">
              {searching ? 'Searching...' : `Results (${results.length})`}
            </p>
            {results.map(team => (
              <button
                key={team.id}
                onClick={() => onSelect({
                  id: team.id,
                  name: team.name,
                  shortName: team.shortName,
                  color: team.color,
                  teamCode: team.teamCode,
                })}
                className="w-full flex items-center gap-3 p-3 rounded-xl bg-warm-50 dark:bg-warm-700/50 hover:bg-warm-100 dark:hover:bg-warm-700 transition-colors mb-1.5"
              >
                <div className="w-10 h-10 rounded-xl flex items-center justify-center text-white font-black text-sm" style={{ backgroundColor: team.color || '#1E293B' }}>
                  {team.shortName || team.name.charAt(0)}
                </div>
                <div className="flex-1 text-left">
                  <p className="text-sm font-bold text-warm-800 dark:text-warm-100">{team.name}</p>
                  {team.teamCode && <p className="text-[10px] text-warm-400 font-mono">{team.teamCode}</p>}
                </div>
                {team.memberCount !== undefined && (
                  <span className="text-[10px] text-warm-400">{team.memberCount} players</span>
                )}
              </button>
            ))}
            {!searching && results.length === 0 && (
              <p className="text-center text-warm-400 text-sm py-4">No teams found</p>
            )}
          </div>
        )}
      </motion.div>
    </motion.div>
  );
}

// ─── Main Component ─────────────────────────────────────────────

export default function QuickScoreTab() {
  const { initiateToss, currentUser } = useKabaddiStore();
  const [step, setStep] = useState(0);
  const [config, setConfig] = useState<MatchConfig>({
        weightCategory: '',
    halfDuration: 10,
    playersPerSide: 7,
    homeTeam: '',
    awayTeam: '',
    homeTeamColor: '#DC2626',
    awayTeamColor: '#1E293B',
    homeLineup: [],
    awayLineup: [],
    liveStreamUrl: '',
  });
  // Weight category type: 'open' | 'weight' — if 'weight', user enters manually
  const [weightType, setWeightType] = useState<'open' | 'weight'>('open');
  const [weightInput, setWeightInput] = useState('');
  const [playerSearch, setPlayerSearch] = useState('');
  const [activeLineupTeam, setActiveLineupTeam] = useState<'home' | 'away'>('home');
  const [searchResults, setSearchResults] = useState<DbPlayer[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [allPlayers, setAllPlayers] = useState<DbPlayer[]>([]);
  const [showReceiveTransfer, setShowReceiveTransfer] = useState(false);
  const playerInputRef = useRef<HTMLDivElement>(null);
  const [userTeams, setUserTeams] = useState<UserTeam[]>([]);
  const [homeTeamSuggestions, setHomeTeamSuggestions] = useState<UserTeam[]>([]);
  const [awayTeamSuggestions, setAwayTeamSuggestions] = useState<UserTeam[]>([]);
  const [showHomeSuggestions, setShowHomeSuggestions] = useState(false);
  const [showAwaySuggestions, setShowAwaySuggestions] = useState(false);
  const [homeTeamId, setHomeTeamId] = useState<string | null>(null);
  const [awayTeamId, setAwayTeamId] = useState<string | null>(null);
  const [teamMembers, setTeamMembers] = useState<DbPlayer[]>([]);
  const teamInputRef = useRef<HTMLDivElement>(null);
  const [hoveredPlayer, setHoveredPlayer] = useState<string | null>(null);
  const [homePlaying7, setHomePlaying7] = useState<Set<string>>(new Set());
  const [awayPlaying7, setAwayPlaying7] = useState<Set<string>>(new Set());
  const [homeCaptain, setHomeCaptain] = useState<string | null>(null);
  const [awayCaptain, setAwayCaptain] = useState<string | null>(null);

  // Team setup state — both teams treated equally (Team A / Team B)
  const [homeTeamCode, setHomeTeamCode] = useState('');
  const [awayTeamCode, setAwayTeamCode] = useState('');
  const [homeTeamSearchResults, setHomeTeamSearchResults] = useState<Array<{
    id: string; name: string; shortName: string | null; teamCode: string | null; color: string | null; memberCount: number;
  }>>([]);
  const [awayTeamSearchResults, setAwayTeamSearchResults] = useState<Array<{
    id: string; name: string; shortName: string | null; teamCode: string | null; color: string | null; memberCount: number;
  }>>([]);
  const [isSearchingHomeTeam, setIsSearchingHomeTeam] = useState(false);
  const [isSearchingAwayTeam, setIsSearchingAwayTeam] = useState(false);
  const [showCreateTeamFor, setShowCreateTeamFor] = useState<'home' | 'away' | null>(null);
  const [newTeamName, setNewTeamName] = useState('');
  const [newTeamColor, setNewTeamColor] = useState('#DC2626');
  const [isCreatingTeam, setIsCreatingTeam] = useState(false);
  // Team roster for auto-populating lineup
  const [homeTeamRoster, setHomeTeamRoster] = useState<DbPlayer[]>([]);
  const [awayTeamRoster, setAwayTeamRoster] = useState<DbPlayer[]>([]);

  // Close team/player suggestions when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (teamInputRef.current && !teamInputRef.current.contains(e.target as Node)) {
        setShowHomeSuggestions(false);
        setShowAwaySuggestions(false);
      }
      if (playerInputRef.current && !playerInputRef.current.contains(e.target as Node)) {
        setShowSuggestions(false);
        setHoveredPlayer(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Fetch all players on mount for instant filtering
  useEffect(() => {
    const fetchAllPlayers = async () => {
      try {
        const res = await fetch('/api/players?limit=100');
        if (res.ok) {
          const data = await res.json();
          setAllPlayers(data.players || []);
        }
      } catch {
        // silently fail
      }
    };
    fetchAllPlayers();
  }, []);

  // Fetch user's teams for suggestions
  useEffect(() => {
    if (!currentUser?.id) return;
    const fetchUserTeams = async () => {
      try {
        // Pass userId + filter=my so the backend returns ONLY teams this user is a member of
        const res = await fetch(`/api/teams?userId=${encodeURIComponent(currentUser.id)}&filter=my`);
        if (res.ok) {
          const data = await res.json();
          const teams: UserTeam[] = (data.teams || []).map((team: Record<string, unknown>) => ({
            id: team.id as string,
            name: team.name as string,
            shortName: team.shortName as string | null,
            color: team.color as string | null,
          }));
          setUserTeams(teams);
        }
      } catch {
        // silently fail
      }
    };
    fetchUserTeams();
  }, [currentUser?.id]);

  // Filter team suggestions based on input
  useEffect(() => {
    const query = config.homeTeam.toLowerCase().trim();
    if (query.length > 0) {
      const filtered = userTeams.filter(t =>
        t.name.toLowerCase().includes(query)
      );
      setHomeTeamSuggestions(filtered);
    } else {
      setHomeTeamSuggestions(userTeams);
    }
  }, [config.homeTeam, userTeams]);

  useEffect(() => {
    const query = config.awayTeam.toLowerCase().trim();
    if (query.length > 0) {
      const filtered = userTeams.filter(t =>
        t.name.toLowerCase().includes(query)
      );
      setAwayTeamSuggestions(filtered);
    } else {
      setAwayTeamSuggestions(userTeams);
    }
  }, [config.awayTeam, userTeams]);

  const selectHomeTeamSuggestion = async (team: UserTeam) => {
    await selectTeam(team, 'home');
  };

  const selectAwayTeamSuggestion = async (team: UserTeam) => {
    await selectTeam(team, 'away');
  };

  // Fetch team members when teams are selected
  useEffect(() => {
    const fetchTeamMembers = async () => {
      const idsToFetch: string[] = [];
      if (homeTeamId) idsToFetch.push(homeTeamId);
      if (awayTeamId) idsToFetch.push(awayTeamId);
      if (idsToFetch.length === 0) { setTeamMembers([]); return; }

      try {
        const members: DbPlayer[] = [];
        for (const tid of idsToFetch) {
          const res = await fetch(`/api/teams/${tid}`);
          if (res.ok) {
            const data = await res.json();
            if (data.members) {
              data.members.forEach((m: { user: DbPlayer }) => {
                if (m.user && !members.some(p => p.id === m.user.id)) {
                  members.push(m.user);
                }
              });
            }
          }
        }
        setTeamMembers(members);
      } catch {
        // silently fail
      }
    };
    fetchTeamMembers();
  }, [homeTeamId, awayTeamId]);

  // Search team by team code (debounced) — works for both Team A & Team B
  useEffect(() => {
    if (!homeTeamCode.trim() || homeTeamCode.trim().length < 2) {
      setHomeTeamSearchResults([]);
    } else {
      const timer = setTimeout(async () => {
        setIsSearchingHomeTeam(true);
        try {
          const res = await fetch(`/api/teams/search?teamCode=${encodeURIComponent(homeTeamCode.trim())}&limit=5`);
          if (res.ok) {
            const data = await res.json();
            setHomeTeamSearchResults((data.teams || []).map((t: Record<string, unknown>) => ({
              id: t.id as string, name: t.name as string, shortName: t.shortName as string | null,
              teamCode: t.teamCode as string | null, color: t.color as string | null, memberCount: t.memberCount as number,
            })));
          }
        } catch { /* ignore */ }
        finally { setIsSearchingHomeTeam(false); }
      }, 300);
      return () => clearTimeout(timer);
    }
  
    return undefined;}, [homeTeamCode]);

  useEffect(() => {
    if (!awayTeamCode.trim() || awayTeamCode.trim().length < 2) {
      setAwayTeamSearchResults([]);
    } else {
      const timer = setTimeout(async () => {
        setIsSearchingAwayTeam(true);
        try {
          const res = await fetch(`/api/teams/search?teamCode=${encodeURIComponent(awayTeamCode.trim())}&limit=5`);
          if (res.ok) {
            const data = await res.json();
            setAwayTeamSearchResults((data.teams || []).map((t: Record<string, unknown>) => ({
              id: t.id as string, name: t.name as string, shortName: t.shortName as string | null,
              teamCode: t.teamCode as string | null, color: t.color as string | null, memberCount: t.memberCount as number,
            })));
          }
        } catch { /* ignore */ }
        finally { setIsSearchingAwayTeam(false); }
      }, 300);
      return () => clearTimeout(timer);
    }
  
    return undefined;}, [awayTeamCode]);

  // Select a team (works for both home/away) — fetches roster and auto-populates lineup
  const selectTeam = async (team: UserTeam | { id: string; name: string; shortName: string | null; teamCode: string | null; color: string | null; memberCount?: number }, side: 'home' | 'away') => {
    const teamColor = team.color || (side === 'home' ? config.homeTeamColor : config.awayTeamColor);
    if (side === 'home') {
      setConfig(prev => ({ ...prev, homeTeam: team.name, homeTeamColor: teamColor }));
      setHomeTeamId(team.id);
      setHomeTeamCode((team as { teamCode?: string | null }).teamCode || '');
      setHomeTeamSearchResults([]);
      setShowHomeSuggestions(false);
    } else {
      setConfig(prev => ({ ...prev, awayTeam: team.name, awayTeamColor: teamColor }));
      setAwayTeamId(team.id);
      setAwayTeamCode((team as { teamCode?: string | null }).teamCode || '');
      setAwayTeamSearchResults([]);
      setShowAwaySuggestions(false);
    }
    // Fetch team roster
    try {
      const res = await fetch(`/api/teams/${team.id}`);
      if (res.ok) {
        const data = await res.json();
        const roster: DbPlayer[] = (data.team?.members || []).map((m: { user: DbPlayer; isCaptain: boolean }) => m.user).filter(Boolean);
        if (side === 'home') {
          setHomeTeamRoster(roster);
        } else {
          setAwayTeamRoster(roster);
        }
        // NOTE: We do NOT auto-populate the lineup anymore. The user manually
        // selects squad members in Step 3 (Lineup) by tapping players.
        // The roster is stored in homeTeamRoster/awayTeamRoster for display.
        // Reset lineup and playing7 for this side in case the user previously
        // selected a different team.
        if (side === 'home') {
          setConfig(prev => ({ ...prev, homeLineup: [] }));
          setHomePlaying7(new Set());
          setHomeCaptain(null);
        } else {
          setConfig(prev => ({ ...prev, awayLineup: [] }));
          setAwayPlaying7(new Set());
          setAwayCaptain(null);
        }
      }
    } catch { /* ignore */ }
  };

  // Create a new team and select it for the given side
  const handleCreateTeam = async (side: 'home' | 'away') => {
    if (!newTeamName.trim() || newTeamName.trim().length < 3) return;
    setIsCreatingTeam(true);
    try {
      const res = await fetch('/api/teams', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newTeamName.trim(),
          color: newTeamColor,
          captainId: currentUser?.id,
          memberIds: currentUser?.id ? [currentUser.id] : [],
        }),
      });
      if (res.ok) {
        const data = await res.json();
        const newTeam: UserTeam = {
          id: data.team.id,
          name: data.team.name,
          shortName: data.team.shortName,
          color: data.team.color,
          members: [],
        };
        setUserTeams(prev => [...prev, newTeam]);
        await selectTeam(newTeam, side);
        setShowCreateTeamFor(null);
        setNewTeamName('');
        setNewTeamColor('#DC2626');
      }
    } catch { /* ignore */ }
    setIsCreatingTeam(false);
  };

  const canNext = () => {
    switch (step) {
      case 0: return (weightType === 'open' || (weightType === 'weight' && weightInput.trim() !== '')) && config.halfDuration >= 1 && config.playersPerSide >= 1;
      case 1: return config.homeTeam !== '' && config.awayTeam !== '';
      case 2: return config.homeLineup.length >= config.playersPerSide && config.awayLineup.length >= config.playersPerSide && homePlaying7.size >= config.playersPerSide && awayPlaying7.size >= config.playersPerSide;
      case 3: return true;
      default: return false;
    }
  };

  const handleNext = () => {
    // The button is already disabled when canNext() is false, but we keep the
    // guard as a safety net.  Using functional setStep avoids stale-closure issues
    // if the click fires during a batched re-render.
    if (step < STEPS.length - 1 && canNext()) {
      setStep(s => s + 1);
    }
  };

  const handlePrev = () => {
    if (step > 0) {
      setStep(step - 1);
    }
  };

  const handleStart = () => {
    const markLineup = (lineup: MatchPlayer[], playing7: Set<string>, captainId: string | null) =>
      lineup.map(p => ({
        ...p,
        isStarting: playing7.has(p.id),
        isCaptain: p.id === captainId,
      }));
    initiateToss({
      id: `match_${Date.now()}`,
      homeTeamId: homeTeamId || `home_${Date.now()}`,
      awayTeamId: awayTeamId || `away_${Date.now()}`,
      homeTeam: config.homeTeam,
      awayTeam: config.awayTeam,
      homeTeamColor: config.homeTeamColor,
      awayTeamColor: config.awayTeamColor,
      isPractice: true,
            weightCategory: weightType === 'open' ? 'open' : weightInput.trim(),
      halfDuration: config.halfDuration,
      playersPerSide: config.playersPerSide,
      homeLineup: markLineup(config.homeLineup, homePlaying7, homeCaptain),
      awayLineup: markLineup(config.awayLineup, awayPlaying7, awayCaptain),
      liveStreamUrl: config.liveStreamUrl || undefined,
      // Dynamic Rule Scaling — defaults based on playersPerSide (P)
      // For 7v7: bonusEnabled=true, revivalEnabled=true, allOutBonusPoints=2,
      //          superTackleThreshold=3 (floor(7/2)), bonusLineThreshold=6 (7-1)
      // For 4v4: superTackleThreshold=2, bonusLineThreshold=3
      // For 3v3: bonusEnabled=false (court too empty for bonus line)
      bonusEnabled: config.playersPerSide >= 4,
      revivalEnabled: true,
      allOutBonusPoints: 2,
      superTackleThreshold: Math.floor(config.playersPerSide / 2),
      bonusLineThreshold: Math.max(1, config.playersPerSide - 1),
      homeStartingP: config.playersPerSide,
      awayStartingP: config.playersPerSide,
    });
  };

  const addQuickPlayer = (team: 'home' | 'away') => {
    const input = playerSearch.trim();
    if (!input) return;
    const lineup = team === 'home' ? config.homeLineup : config.awayLineup;
    const maxSquad = config.playersPerSide + 5;
    if (lineup.length >= maxSquad) return; // Squad limit reached

    // Determine if input is a phone number (mostly digits)
    const isPhoneInput = /^[\d+\-() ]+$/.test(input) && input.replace(/[^\d]/g, '').length >= 6;

    // Check if phone number already exists in squad
    if (isPhoneInput) {
      const phoneExists = [...config.homeLineup, ...config.awayLineup].some(p => p.phone === input);
      if (phoneExists) return; // Already added with this phone
    }

    const newPlayer: MatchPlayer = {
      id: `phone_${isPhoneInput ? input.replace(/[^\d+]/g, '') : Date.now()}_${Math.random().toString(36).slice(2, 5)}`,
      name: isPhoneInput ? `Player ${input.slice(-4)}` : input, // Use last 4 digits if phone input
      phone: isPhoneInput ? input : undefined,
      jerseyNumber: lineup.length + 1,
      team,
    };
    setConfig({
      ...config,
      [team === 'home' ? 'homeLineup' : 'awayLineup']: [...lineup, newPlayer],
    });
    setPlayerSearch('');
    setSearchResults([]);
    setShowSuggestions(false);
  };

  // Highlight matching text in suggestions
  const highlightMatch = (text: string, query: string) => {
    if (!query.trim()) return text;
    const regex = new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
    const parts = text.split(regex);
    return parts.map((part, i) =>
      regex.test(part) ? (
        <span key={i} className="text-brand-red font-bold">{part}</span>
      ) : (
        <span key={i}>{part}</span>
      )
    );
  };

  const removePlayer = (team: 'home' | 'away', playerId: string) => {
    const lineup = team === 'home' ? config.homeLineup : config.awayLineup;
    setConfig({
      ...config,
      [team === 'home' ? 'homeLineup' : 'awayLineup']: lineup.filter((p) => p.id !== playerId),
    });
  };

  // Local filter for instant results - only shows team members by default, others by phone/ID only
  const getLocalFiltered = useCallback((query: string): DbPlayer[] => {
    if (!query.trim()) {
      // When no search query, ONLY show team members (don't suggest random players)
      return teamMembers.slice(0, 20);
    }
    const q = query.toLowerCase().trim();
    // Only search by phone number or player ID (not by name)
    const teamResults = teamMembers.filter(p =>
      (p.playerCode && p.playerCode.toLowerCase().includes(q)) ||
      (p.phone && p.phone.includes(q))
    );
    // Only search other players if user types 2+ chars (explicit search)
    if (query.trim().length < 2) {
      return teamResults.slice(0, 20);
    }
    // Only find other players by phone/ID (not by name)
    const otherResults = allPlayers.filter(p =>
      !teamMembers.some(tm => tm.id === p.id) && (
        (p.playerCode && p.playerCode.toLowerCase().includes(q)) ||
        (p.phone && p.phone.includes(q))
      )
    );
    return [...teamResults, ...otherResults].slice(0, 20);
  }, [allPlayers, teamMembers]);

  // Search existing players from DB (server-side for more results)
  const searchPlayers = useCallback(async (query: string) => {
    if (query.length < 1) {
      setSearchResults(getLocalFiltered(''));
      return;
    }
    // Show local results immediately
    const localResults = getLocalFiltered(query);
    setSearchResults(localResults);

    // Also fetch from server for more comprehensive results
    if (query.length >= 2) {
      setIsSearching(true);
      try {
        const res = await fetch(`/api/players?search=${encodeURIComponent(query)}&searchBy=phone_code`);
        if (res.ok) {
          const data = await res.json();
          const serverPlayers: DbPlayer[] = data.players || [];
          // Merge: server results first, then local-only results
          const serverIds = new Set(serverPlayers.map(p => p.id));
          const merged = [...serverPlayers, ...localResults.filter(p => !serverIds.has(p.id))].slice(0, 20);
          setSearchResults(merged);
        }
      } catch {
        // Keep local results on error
      } finally {
        setIsSearching(false);
      }
    }
  }, [getLocalFiltered]);

  // Debounce server search, but local filter is instant
  useEffect(() => {
    const timer = setTimeout(() => {
      if (showSuggestions && playerSearch.length >= 2) {
        searchPlayers(playerSearch);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [playerSearch, showSuggestions, searchPlayers]);

  // Instant local filter on every keystroke
  useEffect(() => {
    if (showSuggestions) {
      setSearchResults(getLocalFiltered(playerSearch));
    }
  }, [playerSearch, showSuggestions, getLocalFiltered]);

  const addDbPlayer = (dbPlayer: DbPlayer) => {
    const lineup = activeLineupTeam === 'home' ? config.homeLineup : config.awayLineup;
    const maxSquad = config.playersPerSide + 5;
    // Check if already added (by ID or phone number — one phone per player)
    const alreadyAdded = [...config.homeLineup, ...config.awayLineup].some(p => p.id === dbPlayer.id || (dbPlayer.phone && p.phone === dbPlayer.phone));
    if (alreadyAdded) return;
    // Check squad limit
    if (lineup.length >= maxSquad) return;
    const newPlayer: MatchPlayer = {
      id: dbPlayer.id,
      name: dbPlayer.name || 'Unknown',
      phone: dbPlayer.phone || undefined,
      jerseyNumber: dbPlayer.profile?.jerseyNumber || lineup.length + 1,
      playerCode: dbPlayer.playerCode || undefined,
      team: activeLineupTeam,
    };
    setConfig({
      ...config,
      [activeLineupTeam === 'home' ? 'homeLineup' : 'awayLineup']: [...lineup, newPlayer],
    });
    setPlayerSearch('');
    setSearchResults([]);
    setShowSuggestions(false);
  };

  // ─── Lineup validation summary ──────────────────────────────────

  const lineupWarnings = useMemo(() => {
    const warnings: { team: 'home' | 'away'; message: string; severity: 'error' | 'warning' | 'info' }[] = [];

    const validateTeam = (lineup: MatchPlayer[], team: 'home' | 'away', teamName: string) => {
      if (lineup.length === 0) {
        warnings.push({ team, message: `${teamName}: No players added`, severity: 'error' });
        return;
      }
      if (lineup.length < config.playersPerSide) {
        warnings.push({
          team,
          message: `${teamName}: ${lineup.length}/${config.playersPerSide} players`,
          severity: 'warning',
        });
      }

      // Position balance
      const positions = lineup.map(p => {
        const dbP = allPlayers.find(ap => ap.id === p.id);
        return getPositionCategory(dbP?.profile?.position || null);
      });

      const balance = POSITION_BALANCE[config.playersPerSide];
      const raiderCount = positions.filter(p => p === 'raider').length;
      const defenderCount = positions.filter(p => p === 'defender').length;

      if (balance && raiderCount < balance.raiders && lineup.length >= config.playersPerSide) {
        warnings.push({
          team,
          message: `${teamName}: Only ${raiderCount} raider(s) — recommended ${balance.raiders}`,
          severity: 'info',
        });
      }
      if (balance && defenderCount < balance.defenders && lineup.length >= config.playersPerSide) {
        warnings.push({
          team,
          message: `${teamName}: Only ${defenderCount} defender(s) — recommended ${balance.defenders}`,
          severity: 'info',
        });
      }
    };

    validateTeam(config.homeLineup, 'home', config.homeTeam || 'Team A');
    validateTeam(config.awayLineup, 'away', config.awayTeam || 'Team B');

    return warnings;
  }, [config.homeLineup, config.awayLineup, config.playersPerSide, config.homeTeam, config.awayTeam, allPlayers]);

  const teamColors = [
    '#DC2626', '#1E293B', '#14B8A6', '#475569', '#9333EA',
    '#F97316', '#06B6D4', '#EC4899', '#84CC16', '#6366F1',
  ];

  // Position icon mapping
  const getPositionIcon = (position: string | null) => {
    if (!position) return null;
    const p = position.toLowerCase();
    if (p.includes('raider')) return <Zap className="w-3 h-3" />;
    if (p.includes('defend') || p.includes('corner') || p.includes('cover')) return <Shield className="w-3 h-3" />;
    if (p.includes('all')) return <Swords className="w-3 h-3" />;
    return null;
  };

  // ─── Position color for lineup display ──────────────────────────
  const getPositionColor = (position: string | null) => {
    if (!position) return 'bg-warm-400 dark:bg-warm-500';
    const p = position.toLowerCase();
    if (p.includes('raider')) return 'bg-brand-red';
    if (p.includes('defend') || p.includes('corner') || p.includes('cover')) return 'bg-brand-teal';
    if (p.includes('all')) return 'bg-brand-gold';
    return 'bg-warm-400 dark:bg-warm-500';
  };

  return (
    <div className="px-4 py-6 space-y-5">
      {/* Step Progress Indicator - Enhanced with gradient progress, pulse, animated labels, and step counter */}
      <div className="relative px-2 py-3">
        {/* Step counter badge */}
        <div className="flex items-center justify-center mb-2">
          <motion.div
            key={`step-counter-${step}`}
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: 'spring', stiffness: 300, damping: 20 }}
            className="step-counter"
          >
            Step {step + 1} / {STEPS.length}
          </motion.div>
        </div>
        {/* Background track line with shimmer */}
        <div className="absolute top-[22px] left-6 right-6 h-[3px] bg-warm-200 dark:bg-warm-700 rounded-full overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-warm-300/50 dark:via-warm-600/30 to-transparent animate-[shimmer_4s_ease-in-out_infinite]" />
        </div>
        {/* Animated gradient progress fill */}
        <motion.div
          className="absolute top-[22px] left-6 h-[3px] rounded-full overflow-hidden"
          style={{
            background: 'linear-gradient(90deg, #DC2626, #F59E0B, #14B8A6, #DC2626)',
            backgroundSize: '200% 100%',
          }}
          initial={{ width: 0 }}
          animate={{ width: `${(step / (STEPS.length - 1)) * (100 - 8)}%`, backgroundPosition: ['0% 0%', '100% 0%'] }}
          transition={{ width: { duration: 0.6, ease: 'easeInOut' }, backgroundPosition: { duration: 3, repeat: Infinity, ease: 'linear' } }}
        >
          {/* Shine sweep on progress line */}
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/40 to-transparent animate-[shimmer_2s_ease-in-out_infinite]" />
        </motion.div>
        <div className="flex items-start justify-between relative">
          {STEPS.map((label, i) => {
            const StepIcon = STEP_ICONS[i];
            const isCompleted = i < step;
            const isCurrent = i === step;
            const isFuture = i > step;
            return (
              <div key={label} className="flex flex-col items-center gap-2 z-10">
                <motion.div
                  className={`relative w-10 h-10 rounded-full flex items-center justify-center shrink-0 transition-all duration-500 ${
                    isCompleted
                      ? 'bg-gradient-to-br from-brand-red to-brand-red-dark text-white shadow-lg shadow-brand-red/40'
                      : isCurrent
                        ? 'bg-gradient-to-br from-brand-red to-brand-gold text-white shadow-xl shadow-brand-red/50'
                        : 'bg-warm-100 dark:bg-warm-800 text-warm-300 dark:text-warm-600'
                  }`}
                  animate={isCurrent ? {
                    scale: [1, 1.08, 1],
                    boxShadow: [
                      '0 0 0 0 rgba(220, 38, 38, 0.4)',
                      '0 0 0 10px rgba(220, 38, 38, 0)',
                      '0 0 0 0 rgba(220, 38, 38, 0)',
                    ],
                  } : {}}
                  transition={isCurrent ? { duration: 2, repeat: Infinity, ease: 'easeInOut' } : {}}
                  initial={{ scale: 0.8, opacity: 0 }}
                  whileInView={{ scale: 1, opacity: 1 }}
                >
                  {/* Double glow ring for current step */}
                  {isCurrent && (
                    <>
                      <motion.div
                        className="absolute inset-0 rounded-full border-2 border-brand-red/30"
                        animate={{ scale: [1, 1.5, 1], opacity: [0.6, 0, 0.6] }}
                        transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
                      />
                      <motion.div
                        className="absolute inset-0 rounded-full border border-brand-gold/20"
                        animate={{ scale: [1, 1.8, 1], opacity: [0.4, 0, 0.4] }}
                        transition={{ duration: 2.5, repeat: Infinity, ease: 'easeInOut', delay: 0.3 }}
                      />
                    </>
                  )}
                  {/* Selection ring animation on completed */}
                  {isCompleted && (
                    <motion.div
                      className="absolute -inset-1 rounded-full border-2 border-brand-gold/40"
                      initial={{ scale: 0.8, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      transition={{ type: 'spring', stiffness: 300, damping: 20 }}
                    />
                  )}
                  {isCompleted ? (
                    <motion.div
                      initial={{ scale: 0, rotate: -180 }}
                      animate={{ scale: 1, rotate: 0 }}
                      transition={{ type: 'spring', stiffness: 400, damping: 15 }}
                    >
                      <Check className="w-4.5 h-4.5" />
                    </motion.div>
                  ) : (
                    <StepIcon className={`w-4 h-4 ${isFuture ? 'opacity-40' : ''}`} />
                  )}
                </motion.div>
                {/* Animated step label with fade transition */}
                <motion.span
                  key={`label-${i}-${isCurrent ? 'active' : isCompleted ? 'done' : 'future'}`}
                  initial={{ y: 4, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  transition={{ duration: 0.3, delay: i * 0.05 }}
                  className={`text-[9px] font-bold tracking-wide transition-colors duration-300 ${
                    isCompleted ? 'text-brand-red' :
                    isCurrent ? 'gradient-text' :
                    'text-warm-300 dark:text-warm-600'
                  }`}
                >
                  {label}
                </motion.span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Step Content */}
      <AnimatePresence mode="wait">
        <motion.div
          key={step}
          initial={{ opacity: 0, x: 24, scale: 0.98 }}
          animate={{ opacity: 1, x: 0, scale: 1 }}
          exit={{ opacity: 0, x: -24, scale: 0.98 }}
          transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
          className="min-h-[400px]"
        >
          {step === 0 && (
            <div className="space-y-5">
              <div className="text-center">
                <h2 className="text-xl font-bold text-warm-800 dark:text-warm-100">Match Settings</h2>
                <p className="text-sm text-warm-500 dark:text-warm-400 mt-1">Set up your match format</p>
              </div>

              {/* Weight Category */}
              <div className="space-y-3">
                <label className="text-sm font-bold text-warm-700 dark:text-warm-300">Weight Category</label>
                <div className="flex gap-2">
                  <button
                    onClick={() => { setWeightType('open'); setWeightInput(''); }}
                    className={`flex-1 py-3 rounded-xl font-bold text-sm transition-all ${
                      weightType === 'open'
                        ? 'bg-brand-teal text-white shadow-md'
                        : 'bg-warm-100 dark:bg-warm-700 text-warm-600 dark:text-warm-300'
                    }`}
                  >
                    ♾️ Open
                  </button>
                  <button
                    onClick={() => setWeightType('weight')}
                    className={`flex-1 py-3 rounded-xl font-bold text-sm transition-all ${
                      weightType === 'weight'
                        ? 'bg-brand-teal text-white shadow-md'
                        : 'bg-warm-100 dark:bg-warm-700 text-warm-600 dark:text-warm-300'
                    }`}
                  >
                    ⚖️ Custom
                  </button>
                </div>
                {weightType === 'weight' && (
                  <input
                    type="text"
                    placeholder="e.g. 65kg, Below 70kg"
                    value={weightInput}
                    onChange={(e) => setWeightInput(e.target.value)}
                    className="w-full h-12 px-4 rounded-xl bg-warm-50 dark:bg-warm-800 border border-warm-200 dark:border-warm-600 text-sm text-warm-800 dark:text-warm-100"
                  />
                )}
              </div>

              {/* Half Duration */}
              <div className="space-y-2">
                <label className="text-sm font-bold text-warm-700 dark:text-warm-300">Half Duration (minutes)</label>
                <div className="flex gap-2">
                  {[10, 15, 20, 25, 30].map(d => (
                    <button
                      key={d}
                      onClick={() => setConfig(prev => ({ ...prev, halfDuration: d }))}
                      className={`flex-1 py-2.5 rounded-xl font-bold text-sm transition-all ${
                        config.halfDuration === d
                          ? 'bg-brand-red text-white shadow-md'
                          : 'bg-warm-100 dark:bg-warm-700 text-warm-600 dark:text-warm-300'
                      }`}
                    >
                      {d}
                    </button>
                  ))}
                </div>
              </div>

              {/* Players Per Side */}
              <div className="space-y-2">
                <label className="text-sm font-bold text-warm-700 dark:text-warm-300">Players Per Side</label>
                <div className="flex gap-2">
                  {[3, 5, 7].map(p => (
                    <button
                      key={p}
                      onClick={() => setConfig(prev => ({ ...prev, playersPerSide: p }))}
                      className={`flex-1 py-2.5 rounded-xl font-bold text-sm transition-all ${
                        config.playersPerSide === p
                          ? 'bg-brand-red text-white shadow-md'
                          : 'bg-warm-100 dark:bg-warm-700 text-warm-600 dark:text-warm-300'
                      }`}
                    >
                      {p}v{p}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}


          {step === 1 && (
            <div className="flex flex-col items-center justify-center min-h-[60vh] py-6">
              {/* Title */}
              <h2 className="text-2xl font-black text-warm-800 dark:text-warm-100 mb-8">Select Teams</h2>

              {/* Team A */}
              <div className="flex flex-col items-center gap-3 mb-4">
                {config.homeTeam ? (
                  <button
                    onClick={() => {
                      setConfig(prev => ({ ...prev, homeTeam: '', homeLineup: [], homeTeamColor: '#DC2626' }));
                      setHomeTeamId(null);
                      setHomeTeamCode('');
                    }}
                    className="w-24 h-24 rounded-2xl flex flex-col items-center justify-center shadow-lg relative overflow-hidden"
                    style={{ backgroundColor: config.homeTeamColor }}
                  >
                    <span className="text-white font-black text-lg text-center px-1 truncate max-w-full">{config.homeTeam}</span>
                    <span className="text-white/60 text-[10px] mt-1">tap to change</span>
                  </button>
                ) : (
                  <button
                    onClick={() => {
                      setShowHomeSuggestions(true);
                      // Focus the search
                    }}
                    className="w-24 h-24 rounded-full bg-warm-800 dark:bg-warm-700 flex items-center justify-center shadow-lg hover:scale-105 transition-transform"
                  >
                    <Plus className="w-10 h-10 text-white" />
                  </button>
                )}
                <button
                  onClick={() => setShowHomeSuggestions(true)}
                  className="px-6 py-2.5 rounded-xl bg-brand-teal text-white font-bold text-sm hover:bg-brand-teal-dark transition-colors"
                >
                  {config.homeTeam ? 'Team A Selected' : 'Select Team A'}
                </button>
              </div>

              {/* VS Divider */}
              <div className="my-2 flex items-center justify-center">
                <div className="w-12 h-12 rounded-xl bg-warm-100 dark:bg-warm-700 flex items-center justify-center">
                  <span className="text-warm-500 dark:text-warm-300 font-black text-sm">VS</span>
                </div>
              </div>

              {/* Team B */}
              <div className="flex flex-col items-center gap-3 mt-4">
                {config.awayTeam ? (
                  <button
                    onClick={() => {
                      setConfig(prev => ({ ...prev, awayTeam: '', awayLineup: [], awayTeamColor: '#1E293B' }));
                      setAwayTeamId(null);
                      setAwayTeamCode('');
                    }}
                    className="w-24 h-24 rounded-2xl flex flex-col items-center justify-center shadow-lg relative overflow-hidden"
                    style={{ backgroundColor: config.awayTeamColor }}
                  >
                    <span className="text-white font-black text-lg text-center px-1 truncate max-w-full">{config.awayTeam}</span>
                    <span className="text-white/60 text-[10px] mt-1">tap to change</span>
                  </button>
                ) : (
                  <button
                    onClick={() => setShowAwaySuggestions(true)}
                    className="w-24 h-24 rounded-full bg-warm-800 dark:bg-warm-700 flex items-center justify-center shadow-lg hover:scale-105 transition-transform"
                  >
                    <Plus className="w-10 h-10 text-white" />
                  </button>
                )}
                <button
                  onClick={() => setShowAwaySuggestions(true)}
                  className="px-6 py-2.5 rounded-xl bg-brand-teal text-white font-bold text-sm hover:bg-brand-teal-dark transition-colors"
                >
                  {config.awayTeam ? 'Team B Selected' : 'Select Team B'}
                </button>
              </div>

              {/* Team code input (optional — for joining by code) */}
              <div className="mt-8 w-full max-w-xs">
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="Enter team code (e.g. KT2001)"
                    value={homeTeamCode}
                    onChange={(e) => setHomeTeamCode(e.target.value.toUpperCase())}
                    className="flex-1 h-10 px-3 rounded-xl bg-warm-50 dark:bg-warm-800 border border-warm-200 dark:border-warm-600 text-sm text-warm-800 dark:text-warm-100 uppercase font-mono"
                    maxLength={10}
                  />
                  <button
                    onClick={() => {
                      if (homeTeamCode.trim()) {
                        // Search by team code
                        fetch(`/api/teams/search?teamCode=${encodeURIComponent(homeTeamCode.trim())}&limit=1`)
                          .then(res => res.json())
                          .then(data => {
                            if (data.teams && data.teams.length > 0) {
                              const t = data.teams[0];
                              selectTeam({ id: t.id, name: t.name, shortName: t.shortName, color: t.color, teamCode: t.teamCode }, 'home');
                            } else {
                              toast({ title: 'Team not found', description: 'No team with that code', variant: 'destructive' });
                            }
                          });
                      }
                    }}
                    className="px-4 h-10 rounded-xl bg-brand-teal text-white font-bold text-sm hover:bg-brand-teal-dark"
                  >
                    Find
                  </button>
                </div>
              </div>

              {/* Team picker modals */}
              <AnimatePresence>
                {showHomeSuggestions && (
                  <TeamPickerModal
                    title="Select Team A"
                    userTeams={userTeams}
                    onSelect={(team) => {
                      selectTeam(team, 'home');
                      setShowHomeSuggestions(false);
                    }}
                    onClose={() => setShowHomeSuggestions(false)}
                    onSearch={async (query) => {
                      const res = await fetch(`/api/teams/search?q=${encodeURIComponent(query)}&limit=10`);
                      if (res.ok) {
                        const data = await res.json();
                        return data.teams || [];
                      }
                      return [];
                    }}
                  />
                )}
              </AnimatePresence>
              <AnimatePresence>
                {showAwaySuggestions && (
                  <TeamPickerModal
                    title="Select Team B"
                    userTeams={userTeams}
                    onSelect={(team) => {
                      selectTeam(team, 'away');
                      setShowAwaySuggestions(false);
                    }}
                    onClose={() => setShowAwaySuggestions(false)}
                    onSearch={async (query) => {
                      const res = await fetch(`/api/teams/search?q=${encodeURIComponent(query)}&limit=10`);
                      if (res.ok) {
                        const data = await res.json();
                        return data.teams || [];
                      }
                      return [];
                    }}
                  />
                )}
              </AnimatePresence>
            </div>
          )}


          {step === 2 && (
            <div className="space-y-4 pb-6">
              {/* Header */}
              <div className="text-center">
                <h2 className="text-xl font-bold text-warm-800 dark:text-warm-100">Select Playing Players</h2>
                <p className="text-sm text-warm-500 dark:text-warm-400 mt-1">
                  Tap players from your team roster to add them to the playing lineup
                </p>
              </div>

              {/* Team Toggle */}
              <div className="flex gap-2 p-1 bg-warm-100 dark:bg-warm-800 rounded-xl">
                <button
                  onClick={() => setActiveLineupTeam('home')}
                  className={`flex-1 py-2.5 rounded-lg text-sm font-bold transition-all duration-200 ${
                    activeLineupTeam === 'home'
                      ? 'text-white shadow-md'
                      : 'text-warm-500 dark:text-warm-400'
                  }`}
                  style={activeLineupTeam === 'home' ? { backgroundColor: config.homeTeamColor } : {}}
                >
                  {config.homeTeam || 'Team A'} ({config.homeLineup.length})
                </button>
                <button
                  onClick={() => setActiveLineupTeam('away')}
                  className={`flex-1 py-2.5 rounded-lg text-sm font-bold transition-all duration-200 ${
                    activeLineupTeam === 'away'
                      ? 'text-white shadow-md'
                      : 'text-warm-500 dark:text-warm-400'
                  }`}
                  style={activeLineupTeam === 'away' ? { backgroundColor: config.awayTeamColor } : {}}
                >
                  {config.awayTeam || 'Team B'} ({config.awayLineup.length})
                </button>
              </div>

              {/* Player Selection — CricHeroes style */}
              {(() => {
                const teamColor = activeLineupTeam === 'home' ? config.homeTeamColor : config.awayTeamColor;
                const roster = activeLineupTeam === 'home' ? homeTeamRoster : awayTeamRoster;
                const lineup = activeLineupTeam === 'home' ? config.homeLineup : config.awayLineup;
                const lineupIds = new Set(lineup.map(p => p.id));
                const playingSet = activeLineupTeam === 'home' ? homePlaying7 : awayPlaying7;

                // Toggle a player in/out of the lineup
                const togglePlayer = (player: DbPlayer) => {
                  const currentLineup = activeLineupTeam === 'home' ? config.homeLineup : config.awayLineup;
                  const alreadyIn = currentLineup.some(p => p.id === player.id);

                  if (alreadyIn) {
                    // Remove from lineup
                    const newLineup = currentLineup.filter(p => p.id !== player.id);
                    setConfig({
                      ...config,
                      [activeLineupTeam === 'home' ? 'homeLineup' : 'awayLineup']: newLineup,
                    });
                    // Also remove from playing7
                    if (activeLineupTeam === 'home') {
                      const newPlaying = new Set(homePlaying7);
                      newPlaying.delete(player.id);
                      setHomePlaying7(newPlaying);
                    } else {
                      const newPlaying = new Set(awayPlaying7);
                      newPlaying.delete(player.id);
                      setAwayPlaying7(newPlaying);
                    }
                  } else {
                    // Add to lineup
                    const newPlayer: MatchPlayer = {
                      id: player.id,
                      name: player.name || 'Unknown',
                      phone: player.phone || undefined,
                      jerseyNumber: player.profile?.jerseyNumber || currentLineup.length + 1,
                      playerCode: player.playerCode || undefined,
                      team: activeLineupTeam,
                    };
                    const newLineup = [...currentLineup, newPlayer];
                    setConfig({
                      ...config,
                      [activeLineupTeam === 'home' ? 'homeLineup' : 'awayLineup']: newLineup,
                    });
                    // Auto-mark as playing if we still need starting players
                    const currentPlaying = activeLineupTeam === 'home' ? homePlaying7 : awayPlaying7;
                    if (currentPlaying.size < config.playersPerSide) {
                      if (activeLineupTeam === 'home') {
                        const newPlaying = new Set(homePlaying7);
                        newPlaying.add(player.id);
                        setHomePlaying7(newPlaying);
                      } else {
                        const newPlaying = new Set(awayPlaying7);
                        newPlaying.add(player.id);
                        setAwayPlaying7(newPlaying);
                      }
                    }
                  }
                };

                if (roster.length === 0) {
                  return (
                    <div className="w-full text-center py-10">
                      <div className="w-14 h-14 rounded-2xl bg-warm-100 dark:bg-warm-800 mx-auto flex items-center justify-center mb-3">
                        <UserPlus className="w-6 h-6 text-warm-300 dark:text-warm-600" />
                      </div>
                      <p className="text-warm-400 dark:text-warm-500 text-sm font-medium">No team members found</p>
                      <p className="text-warm-300 dark:text-warm-600 text-xs mt-0.5">
                        Go back to Step 2 and select a team with registered players
                      </p>
                    </div>
                  );
                }

                return (
                  <>
                    {/* Playing counter */}
                    <div className="flex items-center justify-between px-3 py-2 bg-warm-50 dark:bg-warm-800/50 rounded-xl">
                      <span className="text-xs font-bold text-warm-600 dark:text-warm-300">
                        Playing: {playingSet.size}/{config.playersPerSide} · Squad: {lineup.length}
                      </span>
                      <span className="text-[10px] text-warm-400">
                        {playingSet.size >= config.playersPerSide ? 'Ready!' : `Need ${config.playersPerSide - playingSet.size} more`}
                      </span>
                    </div>

                    {/* Selected players first (green cards) */}
                    {lineup.length > 0 && (
                      <div className="space-y-1.5">
                        <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider px-1">
                          Selected ({lineup.length})
                        </span>
                        {lineup.map((player) => {
                          const isPlaying = playingSet.has(player.id);
                          return (
                            <motion.button
                              key={player.id}
                              whileTap={{ scale: 0.97 }}
                              onClick={() => {
                                const rosterPlayer = roster.find(p => p.id === player.id);
                                if (rosterPlayer) togglePlayer(rosterPlayer);
                              }}
                              className={`flex items-center gap-3 p-3 rounded-xl border-2 transition-all duration-200 text-left w-full ${
                                isPlaying
                                  ? 'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-500 dark:border-emerald-600 shadow-sm'
                                  : 'bg-amber-50 dark:bg-amber-900/20 border-amber-400 dark:border-amber-600'
                              }`}
                            >
                              <div
                                className={`w-10 h-10 rounded-xl flex items-center justify-center text-white font-black text-sm shrink-0 shadow-sm ${
                                  isPlaying ? 'bg-emerald-500' : 'bg-amber-500'
                                }`}
                              >
                                {player.jerseyNumber || '?'}
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className={`text-sm font-bold truncate ${
                                  isPlaying ? 'text-emerald-700 dark:text-emerald-300' : 'text-amber-700 dark:text-amber-300'
                                }`}>
                                  {player.name}
                                </p>
                                <span className={`text-[9px] font-bold uppercase tracking-wider ${
                                  isPlaying ? 'text-emerald-500' : 'text-amber-500'
                                }`}>
                                  {isPlaying ? 'PLAYING' : 'SUBSTITUTE'}
                                </span>
                              </div>
                              {/* Tap to remove — shows X when selected */}
                              <div className="w-6 h-6 rounded-full bg-red-500/20 flex items-center justify-center shrink-0">
                                <X className="w-3.5 h-3.5 text-red-500" />
                              </div>
                            </motion.button>
                          );
                        })}
                      </div>
                    )}

                    {/* Available players from roster (not yet selected) */}
                    <div className="space-y-1.5">
                      <span className="text-[10px] font-bold text-warm-400 uppercase tracking-wider px-1">
                        Available ({roster.filter(p => !lineupIds.has(p.id)).length})
                      </span>
                      {roster.filter(p => !lineupIds.has(p.id)).map((player) => {
                        const position = player.profile?.position || null;
                        return (
                          <motion.button
                            key={player.id}
                            whileTap={{ scale: 0.97 }}
                            onClick={() => togglePlayer(player)}
                            className="flex items-center gap-3 p-3 rounded-xl border-2 border-warm-200 dark:border-warm-700 bg-white dark:bg-warm-800/70 hover:border-warm-300 dark:hover:border-warm-600 transition-all duration-200 text-left w-full"
                          >
                            <div
                              className="w-10 h-10 rounded-xl flex items-center justify-center text-white font-black text-sm shrink-0 shadow-sm"
                              style={{ backgroundColor: teamColor }}
                            >
                              {player.profile?.jerseyNumber || '+'}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-bold text-warm-800 dark:text-warm-100 truncate">
                                {player.name || 'Unknown'}
                              </p>
                              <div className="flex items-center gap-1.5 mt-0.5">
                                {player.playerCode && (
                                  <span className="text-[10px] text-warm-400 font-mono">{player.playerCode}</span>
                                )}
                                {position && (
                                  <span className={`text-[8px] font-bold px-1.5 py-0.5 rounded-full ${
                                    position === 'raider' ? 'bg-brand-red/10 text-brand-red' :
                                    position === 'defender' ? 'bg-brand-teal/10 text-brand-teal' :
                                    position === 'all-rounder' ? 'bg-brand-gold/10 text-brand-gold-dark dark:text-brand-gold' :
                                    'bg-warm-100 dark:bg-warm-700 text-warm-500 dark:text-warm-400'
                                  }`}>
                                    {position}
                                  </span>
                                )}
                              </div>
                            </div>
                            {/* Plus icon — tap to add */}
                            <div className="w-6 h-6 rounded-full bg-emerald-500/20 flex items-center justify-center shrink-0">
                              <Plus className="w-3.5 h-3.5 text-emerald-500" />
                            </div>
                          </motion.button>
                        );
                      })}
                    </div>

                    {roster.filter(p => !lineupIds.has(p.id)).length === 0 && lineup.length > 0 && (
                      <p className="text-center text-[10px] text-warm-400 py-2">
                        All team members selected! Tap any selected player above to remove them.
                      </p>
                    )}
                  </>
                );
              })()}
            </div>
          )}


          {step === 3 && (
            <div className="space-y-3 pb-6">
              <div className="text-center">
                <h2 className="text-xl font-bold text-warm-800 dark:text-warm-100">Match Formation</h2>
                <p className="text-sm text-warm-500 dark:text-warm-400 mt-1">Review your teams before starting</p>
              </div>

              {/* ═══ VERTICAL KABADDI COURT ═══ */}
              <div className="relative mx-auto max-w-sm">
                {/* Court container */}
                <div
                  className="relative rounded-xl overflow-hidden border-2"
                  style={{ borderColor: '#3b82f6', aspectRatio: '0.6' }}
                >
                  {/* Team A (Home) — top half */}
                  <div
                    className="absolute top-0 left-0 right-0 h-1/2 flex flex-col items-center justify-around py-3"
                    style={{ backgroundColor: `${config.homeTeamColor}15` }}
                  >
                    {/* Team A name */}
                    <div className="text-center mb-1">
                      <span className="text-xs font-black" style={{ color: config.homeTeamColor }}>
                        {config.homeTeam || 'Team A'}
                      </span>
                    </div>
                    {/* Players row 1 (3 players) */}
                    <div className="flex justify-around w-full px-4">
                      {config.homeLineup.slice(0, 3).map((player, i) => (
                        <div key={player.id} className="flex flex-col items-center gap-0.5">
                          <div
                            className="w-9 h-9 rounded-full flex items-center justify-center text-white font-black text-[10px] border-2 border-white shadow-sm"
                            style={{ backgroundColor: config.homeTeamColor }}
                          >
                            {player.jerseyNumber || '?'}
                          </div>
                          <span className="text-[7px] font-bold text-warm-700 dark:text-warm-300 truncate max-w-[40px]">
                            {player.name?.split(' ')[0]}
                          </span>
                        </div>
                      ))}
                    </div>
                    {/* Players row 2 (4 players) */}
                    <div className="flex justify-around w-full px-6">
                      {config.homeLineup.slice(3, 7).map((player, i) => (
                        <div key={player.id} className="flex flex-col items-center gap-0.5">
                          <div
                            className="w-9 h-9 rounded-full flex items-center justify-center text-white font-black text-[10px] border-2 border-white shadow-sm"
                            style={{ backgroundColor: config.homeTeamColor }}
                          >
                            {player.jerseyNumber || '?'}
                          </div>
                          <span className="text-[7px] font-bold text-warm-700 dark:text-warm-300 truncate max-w-[36px]">
                            {player.name?.split(' ')[0]}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Center line */}
                  <div className="absolute top-1/2 left-0 right-0 h-0.5 bg-red-500 z-10" />
                  {/* Center circle */}
                  <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-12 h-12 rounded-full border-2 border-blue-500 z-10" />

                  {/* Team B (Away) — bottom half */}
                  <div
                    className="absolute bottom-0 left-0 right-0 h-1/2 flex flex-col items-center justify-around py-3"
                    style={{ backgroundColor: `${config.awayTeamColor}15` }}
                  >
                    {/* Players row 2 (4 players) */}
                    <div className="flex justify-around w-full px-6">
                      {config.awayLineup.slice(3, 7).map((player, i) => (
                        <div key={player.id} className="flex flex-col items-center gap-0.5">
                          <div
                            className="w-9 h-9 rounded-full flex items-center justify-center text-white font-black text-[10px] border-2 border-white shadow-sm"
                            style={{ backgroundColor: config.awayTeamColor }}
                          >
                            {player.jerseyNumber || '?'}
                          </div>
                          <span className="text-[7px] font-bold text-warm-700 dark:text-warm-300 truncate max-w-[36px]">
                            {player.name?.split(' ')[0]}
                          </span>
                        </div>
                      ))}
                    </div>
                    {/* Players row 1 (3 players) */}
                    <div className="flex justify-around w-full px-4">
                      {config.awayLineup.slice(0, 3).map((player, i) => (
                        <div key={player.id} className="flex flex-col items-center gap-0.5">
                          <div
                            className="w-9 h-9 rounded-full flex items-center justify-center text-white font-black text-[10px] border-2 border-white shadow-sm"
                            style={{ backgroundColor: config.awayTeamColor }}
                          >
                            {player.jerseyNumber || '?'}
                          </div>
                          <span className="text-[7px] font-bold text-warm-700 dark:text-warm-300 truncate max-w-[40px]">
                            {player.name?.split(' ')[0]}
                          </span>
                        </div>
                      ))}
                    </div>
                    {/* Team B name */}
                    <div className="text-center mt-1">
                      <span className="text-xs font-black" style={{ color: config.awayTeamColor }}>
                        {config.awayTeam || 'Team B'}
                      </span>
                    </div>
                  </div>

                  {/* Lobby strips (left and right) */}
                  <div className="absolute top-0 bottom-0 left-0 w-3 border-r border-blue-400/50 bg-warm-100/30 dark:bg-warm-700/30" />
                  <div className="absolute top-0 bottom-0 right-0 w-3 border-l border-blue-400/50 bg-warm-100/30 dark:bg-warm-700/30" />
                </div>

                {/* Substitutes below court */}
                <div className="flex justify-between mt-2 px-2">
                  <div className="text-center">
                    <span className="text-[9px] font-bold text-warm-500">
                      {config.homeLineup.length > 7 ? `${config.homeLineup.length - 7} subs` : 'No subs'}
                    </span>
                  </div>
                  <div className="text-center">
                    <span className="text-[9px] font-bold text-warm-500">
                      {config.awayLineup.length > 7 ? `${config.awayLineup.length - 7} subs` : 'No subs'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Match info badges */}
              <div className="flex items-center justify-center gap-2 flex-wrap">
                <span className={`px-3 py-1 rounded-full text-xs font-bold ${
                  config.gender === 'male'
                    ? 'bg-blue-500/15 text-blue-600 dark:text-blue-400'
                    : 'bg-red-500/15 text-red-600 dark:text-red-400'
                }`}>
                  {config.gender === 'male' ? '♂ Boys' : '♀ Girls'}
                </span>
                <span className="px-3 py-1 rounded-full text-xs font-bold bg-amber-500/15 text-amber-700 dark:text-amber-300">
                  {weightType === 'open' ? '♾️ Open' : `⚖️ ${weightInput}`}
                </span>
                <span className="px-3 py-1 rounded-full text-xs font-bold bg-brand-teal/15 text-brand-teal">
                  ⏱ {config.halfDuration} min halves
                </span>
                <span className="px-3 py-1 rounded-full text-xs font-bold bg-brand-red/15 text-brand-red">
                  {config.playersPerSide}v{config.playersPerSide}
                </span>
              </div>

              {/* Start Match Button */}
              <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }} className="relative">
                <Button
                  onClick={handleStartToss}
                  className="w-full h-14 bg-gradient-to-r from-brand-red to-brand-red-dark hover:opacity-90 text-white font-black text-base rounded-2xl shadow-lg shadow-brand-red/25 flex items-center justify-center gap-2"
                >
                  <Shield className="w-5 h-5" />
                  Start Match — Go to Toss
                </Button>
              </motion.div>
            </div>
          )}

        </motion.div>
      </AnimatePresence>

      {/* Navigation */}
      {step < STEPS.length - 1 && (
        <div className="flex items-center gap-3 pt-4">
          {step > 0 && (
            <Button
              onClick={handlePrev}
              variant="outline"
              className="rounded-xl h-12 border-warm-200 dark:border-warm-700 dark:text-warm-300 dark:hover:bg-warm-800"
            >
              <ChevronLeft className="w-4 h-4 mr-1" />
              Back
            </Button>
          )}
          <Button
            onClick={handleNext}
            disabled={!canNext()}
            className="flex-1 h-12 bg-gradient-to-r from-brand-red to-brand-red-light hover:from-brand-red-dark hover:to-brand-red text-white rounded-xl font-bold shadow-lg shadow-brand-red/20 disabled:opacity-50 disabled:shadow-none"
          >
            Next
            <ChevronRight className="w-4 h-4 ml-1" />
          </Button>
        </div>
      )}

      {/* Receive Match Handoff */}
      {step === 0 && (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="mt-6"
        >
          <button
            onClick={() => setShowReceiveTransfer(true)}
            className="w-full flex items-center gap-3 p-3.5 rounded-2xl border-2 border-dashed border-teal-300 dark:border-teal-600/50 bg-teal-50/50 dark:bg-teal-900/10 hover:bg-teal-100/60 dark:hover:bg-teal-900/20 transition-all group"
          >
            <div className="w-10 h-10 rounded-xl bg-teal-100 dark:bg-teal-800/40 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
              <Database className="w-5 h-5 text-teal-600 dark:text-teal-400" />
            </div>
            <div className="text-left flex-1">
              <p className="text-sm font-bold text-teal-700 dark:text-teal-300">Receive Match Handoff</p>
              <p className="text-[10px] text-teal-500 dark:text-teal-400/70">Take over live scoring from another device</p>
            </div>
            <ChevronRight className="w-4 h-4 text-teal-400" />
          </button>
        </motion.div>
      )}

      {/* Scorer Transfer Overlay */}
      {showReceiveTransfer && (
        <ScorerTransferScreen
          onClose={() => setShowReceiveTransfer(false)}
          activeMatch={null}
        />
      )}
    </div>
  );
}
