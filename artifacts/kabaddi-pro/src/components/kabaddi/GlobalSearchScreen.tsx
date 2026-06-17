'use client';

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Search,
  X,
  Users,
  Trophy,
  Shield,
  Clock,
  ChevronRight,
  TrendingUp,
  Sparkles,
  ArrowLeft,
  Swords,
  Zap,
  BarChart3,
} from 'lucide-react';

// ─── Types ──────────────────────────────────────────────────────────

interface PlayerResult {
  id: string;
  name: string | null;
  playerCode: string | null;
  avatar: string | null;
  position: string | null;
  teamNames: string[];
  raidPoints?: number;
  tacklePoints?: number;
}

interface TeamResult {
  id: string;
  name: string;
  shortName: string | null;
  color: string | null;
  teamCode: string | null;
  memberCount?: number;
}

interface TournamentResult {
  id: string;
  name: string;
  type: string;
  status: string;
  tournamentCode: string | null;
}

interface MatchResult {
  id: string;
  homeTeamName: string;
  awayTeamName: string;
  homeTeamColor: string | null;
  awayTeamColor: string | null;
  homeTeamShort: string | null;
  awayTeamShort: string | null;
  homeScore: number;
  awayScore: number;
  status: string;
  date: string | null;
}

interface SearchResults {
  players: PlayerResult[];
  teams: TeamResult[];
  tournaments: TournamentResult[];
  matches: MatchResult[];
}

type FilterType = 'all' | 'players' | 'teams' | 'tournaments' | 'matches';

interface TrendingItem {
  label: string;
  type: 'player' | 'team' | 'tournament';
  icon: typeof TrendingUp;
}

interface GlobalSearchScreenProps {
  onClose: () => void;
  onNavigatePlayer?: (playerId: string) => void;
  onNavigateTeam?: (teamId: string) => void;
  onNavigateTournament?: (tournamentId: string) => void;
  onViewPlayer?: (userId: string) => void;
}

// ─── Debounce hook ──────────────────────────────────────────────────

function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedValue(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);

  return debouncedValue;
}

// ─── Constants ──────────────────────────────────────────────────────

const RECENT_SEARCHES_KEY = 'kabaddi-recent-searches';
const MAX_RECENT = 5;
const FILTER_OPTIONS: { key: FilterType; label: string; icon: typeof Search }[] = [
  { key: 'all', label: 'All', icon: Search },
  { key: 'players', label: 'Players', icon: Users },
  { key: 'teams', label: 'Teams', icon: Shield },
  { key: 'tournaments', label: 'Tournaments', icon: Trophy },
  { key: 'matches', label: 'Matches', icon: Swords },
];

const TRENDING_ITEMS: TrendingItem[] = [
  { label: 'Top Raiders', type: 'player', icon: Zap },
  { label: 'Pro Kabaddi', type: 'tournament', icon: Trophy },
  { label: 'Bengaluru Bulls', type: 'team', icon: Shield },
  { label: 'Defender', type: 'player', icon: BarChart3 },
  { label: 'Live Matches', type: 'tournament', icon: Swords },
];

// ─── Skeleton Components ────────────────────────────────────────────

function PlayerSkeleton() {
  return (
    <div className="flex items-center gap-3 p-2.5 rounded-xl animate-pulse">
      <div className="w-10 h-10 rounded-full bg-warm-200 dark:bg-warm-700" />
      <div className="flex-1 space-y-1.5">
        <div className="h-3 w-28 rounded bg-warm-200 dark:bg-warm-700" />
        <div className="h-2.5 w-20 rounded bg-warm-200 dark:bg-warm-700" />
      </div>
      <div className="w-4 h-4 rounded bg-warm-200 dark:bg-warm-700" />
    </div>
  );
}

function TeamSkeleton() {
  return (
    <div className="flex items-center gap-3 p-2.5 rounded-xl animate-pulse">
      <div className="w-10 h-10 rounded-xl bg-warm-200 dark:bg-warm-700" />
      <div className="flex-1 space-y-1.5">
        <div className="h-3 w-24 rounded bg-warm-200 dark:bg-warm-700" />
        <div className="h-2.5 w-16 rounded bg-warm-200 dark:bg-warm-700" />
      </div>
      <div className="w-4 h-4 rounded bg-warm-200 dark:bg-warm-700" />
    </div>
  );
}

function TournamentSkeleton() {
  return (
    <div className="flex items-center gap-3 p-2.5 rounded-xl animate-pulse">
      <div className="w-10 h-10 rounded-xl bg-warm-200 dark:bg-warm-700" />
      <div className="flex-1 space-y-1.5">
        <div className="h-3 w-32 rounded bg-warm-200 dark:bg-warm-700" />
        <div className="h-2.5 w-20 rounded bg-warm-200 dark:bg-warm-700" />
      </div>
      <div className="w-4 h-4 rounded bg-warm-200 dark:bg-warm-700" />
    </div>
  );
}

function MatchSkeleton() {
  return (
    <div className="flex items-center gap-3 p-2.5 rounded-xl animate-pulse">
      <div className="w-10 h-10 rounded-xl bg-warm-200 dark:bg-warm-700" />
      <div className="flex-1 space-y-1.5">
        <div className="h-3 w-36 rounded bg-warm-200 dark:bg-warm-700" />
        <div className="h-2.5 w-24 rounded bg-warm-200 dark:bg-warm-700" />
      </div>
    </div>
  );
}

function SearchSkeletons({ filter }: { filter: FilterType }) {
  return (
    <div className="space-y-4">
      {(filter === 'all' || filter === 'players') && (
        <div>
          <div className="flex items-center gap-2 mb-2.5">
            <div className="w-6 h-6 rounded-md bg-warm-200 dark:bg-warm-700 animate-pulse" />
            <div className="h-3 w-14 rounded bg-warm-200 dark:bg-warm-700 animate-pulse" />
          </div>
          <div className="space-y-1.5">
            <PlayerSkeleton />
            <PlayerSkeleton />
          </div>
        </div>
      )}
      {(filter === 'all' || filter === 'teams') && (
        <div>
          <div className="flex items-center gap-2 mb-2.5">
            <div className="w-6 h-6 rounded-md bg-warm-200 dark:bg-warm-700 animate-pulse" />
            <div className="h-3 w-12 rounded bg-warm-200 dark:bg-warm-700 animate-pulse" />
          </div>
          <div className="space-y-1.5">
            <TeamSkeleton />
            <TeamSkeleton />
          </div>
        </div>
      )}
      {(filter === 'all' || filter === 'tournaments') && (
        <div>
          <div className="flex items-center gap-2 mb-2.5">
            <div className="w-6 h-6 rounded-md bg-warm-200 dark:bg-warm-700 animate-pulse" />
            <div className="h-3 w-20 rounded bg-warm-200 dark:bg-warm-700 animate-pulse" />
          </div>
          <div className="space-y-1.5">
            <TournamentSkeleton />
            <TournamentSkeleton />
          </div>
        </div>
      )}
      {(filter === 'all' || filter === 'matches') && (
        <div>
          <div className="flex items-center gap-2 mb-2.5">
            <div className="w-6 h-6 rounded-md bg-warm-200 dark:bg-warm-700 animate-pulse" />
            <div className="h-3 w-16 rounded bg-warm-200 dark:bg-warm-700 animate-pulse" />
          </div>
          <div className="space-y-1.5">
            <MatchSkeleton />
            <MatchSkeleton />
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Component ──────────────────────────────────────────────────────

export default function GlobalSearchScreen({
  onClose,
  onNavigatePlayer,
  onNavigateTeam,
  onNavigateTournament,
  onViewPlayer,
}: GlobalSearchScreenProps) {
  const [query, setQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState<FilterType>('all');
  const [results, setResults] = useState<SearchResults | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  const [isFocused, setIsFocused] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const debouncedQuery = useDebounce(query, 300);

  // Load recent searches from localStorage
  useEffect(() => {
    try {
      const stored = localStorage.getItem(RECENT_SEARCHES_KEY);
      if (stored) {
        setRecentSearches(JSON.parse(stored));
      }
    } catch {
      // ignore
    }
  }, []);

  // Auto-focus input on mount
  useEffect(() => {
    const timer = setTimeout(() => {
      inputRef.current?.focus();
      setIsFocused(true);
    }, 100);
    return () => clearTimeout(timer);
  }, []);

  // Perform search when debounced query changes
  const performSearch = useCallback(async (q: string, type: FilterType) => {
    if (!q.trim()) {
      setResults(null);
      setIsSearching(false);
      return;
    }

    setIsSearching(true);
    try {
      const params = new URLSearchParams({ q: q.trim(), type });
      const res = await fetch(`/api/search?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        // Add matches array if not present
        setResults({
          players: data.players || [],
          teams: data.teams || [],
          tournaments: data.tournaments || [],
          matches: data.matches || [],
        });
      } else {
        setResults({ players: [], teams: [], tournaments: [], matches: [] });
      }
    } catch {
      setResults({ players: [], teams: [], tournaments: [], matches: [] });
    } finally {
      setIsSearching(false);
    }
  }, []);

  useEffect(() => {
    performSearch(debouncedQuery, activeFilter);
  }, [debouncedQuery, activeFilter, performSearch]);

  // Save recent search
  const saveRecentSearch = useCallback((term: string) => {
    if (!term.trim()) return;
    try {
      const stored = localStorage.getItem(RECENT_SEARCHES_KEY);
      const existing: string[] = stored ? JSON.parse(stored) : [];
      const updated = [term.trim(), ...existing.filter((s) => s !== term.trim())].slice(0, MAX_RECENT);
      localStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(updated));
      setRecentSearches(updated);
    } catch {
      // ignore
    }
  }, []);

  // Remove a single recent search
  const removeRecentSearch = useCallback((term: string) => {
    try {
      const stored = localStorage.getItem(RECENT_SEARCHES_KEY);
      const existing: string[] = stored ? JSON.parse(stored) : [];
      const updated = existing.filter((s) => s !== term);
      localStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(updated));
      setRecentSearches(updated);
    } catch {
      // ignore
    }
  }, []);

  // Clear all recent searches
  const clearRecentSearches = useCallback(() => {
    try {
      localStorage.removeItem(RECENT_SEARCHES_KEY);
      setRecentSearches([]);
    } catch {
      // ignore
    }
  }, []);

  // Handle submitting a search (enter key)
  const handleSubmit = () => {
    if (query.trim()) {
      saveRecentSearch(query.trim());
    }
  };

  // Total results count per category
  const counts = useMemo(() => ({
    all: results ? results.players.length + results.teams.length + results.tournaments.length + results.matches.length : 0,
    players: results?.players.length || 0,
    teams: results?.teams.length || 0,
    tournaments: results?.tournaments.length || 0,
    matches: results?.matches.length || 0,
  }), [results]);

  const hasQuery = query.trim().length > 0;
  const hasResults = counts.all > 0;

  // Position label helper
  function getPositionLabel(pos: string | null): string {
    if (!pos) return 'Player';
    switch (pos.toLowerCase()) {
      case 'raider': return 'Raider';
      case 'defender': return 'Defender';
      case 'all-rounder': return 'All-Rounder';
      default: return pos;
    }
  }

  // Position color helper
  function getPositionColor(pos: string | null): string {
    if (!pos) return 'text-warm-500 dark:text-warm-400';
    switch (pos.toLowerCase()) {
      case 'raider': return 'text-brand-red dark:text-brand-red-light';
      case 'defender': return 'text-brand-teal dark:text-brand-teal-light';
      case 'all-rounder': return 'text-brand-gold dark:text-brand-gold-light';
      default: return 'text-warm-500 dark:text-warm-400';
    }
  }

  // Status badge color for tournaments
  function getStatusStyle(status: string): { bg: string; text: string; label: string } {
    switch (status) {
      case 'ongoing':
        return { bg: 'bg-green-100 dark:bg-green-900/30', text: 'text-green-700 dark:text-green-400', label: 'Live' };
      case 'completed':
        return { bg: 'bg-warm-100 dark:bg-warm-800', text: 'text-warm-600 dark:text-warm-300', label: 'Completed' };
      case 'upcoming':
        return { bg: 'bg-blue-100 dark:bg-blue-900/30', text: 'text-blue-700 dark:text-blue-400', label: 'Upcoming' };
      default:
        return { bg: 'bg-warm-100 dark:bg-warm-800', text: 'text-warm-600 dark:text-warm-300', label: status };
    }
  }

  // Tournament type label
  function getTypeLabel(type: string): string {
    switch (type) {
      case 'knockout': return 'Knockout';
      case 'league': return 'League';
      case 'hybrid': return 'Hybrid';
      default: return type;
    }
  }

  // Match status label
  function getMatchStatusLabel(status: string): { label: string; color: string } {
    switch (status) {
      case 'live':
        return { label: 'LIVE', color: 'text-red-500 bg-red-500/10 border-red-500/20' };
      case 'completed':
        return { label: 'FT', color: 'text-warm-500 dark:text-warm-400 bg-warm-100 dark:bg-warm-800 border-warm-200 dark:border-warm-700' };
      case 'upcoming':
        return { label: 'Upcoming', color: 'text-blue-500 bg-blue-500/10 border-blue-500/20' };
      default:
        return { label: status, color: 'text-warm-500 bg-warm-100 dark:bg-warm-800 border-warm-200' };
    }
  }

  return (
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 z-50 flex flex-col"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.2 }}
      >
        {/* Backdrop */}
        <div className="overlay-backdrop absolute inset-0" onClick={onClose} />

        {/* Search content */}
        <motion.div
          className="relative z-10 flex flex-col bg-warm-50 dark:bg-warm-900 h-full max-h-screen"
          initial={{ y: -40, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: -40, opacity: 0 }}
          transition={{ type: 'spring', damping: 25, stiffness: 300 }}
        >
          {/* Search Header */}
          <div className="slide-in-top">
            <div className="px-4 pt-4 pb-3">
              <div className="flex items-center gap-3">
                <button
                  onClick={onClose}
                  className="p-2 rounded-full hover:bg-warm-100 dark:hover:bg-warm-800 transition-colors shrink-0"
                  aria-label="Close search"
                >
                  <ArrowLeft className="w-5 h-5 text-warm-700 dark:text-warm-200" />
                </button>

                <div className="flex-1 relative">
                  <Search className={`absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 transition-colors ${
                    isFocused ? 'text-brand-red dark:text-brand-red-light' : 'text-warm-400 dark:text-warm-500'
                  }`} />
                  <input
                    ref={inputRef}
                    type="text"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    onFocus={() => setIsFocused(true)}
                    onBlur={() => setIsFocused(false)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleSubmit();
                      if (e.key === 'Escape') onClose();
                    }}
                    placeholder="Search players, teams, tournaments..."
                    className={`input-search w-full pl-10 pr-10 py-3 rounded-2xl bg-warm-100 dark:bg-warm-800 border text-foreground placeholder:text-warm-400 dark:placeholder:text-warm-500 focus:outline-none focus:ring-2 text-sm font-medium transition-all ${
                      isFocused
                        ? 'border-brand-red/40 ring-brand-red/30 dark:border-brand-red-light/40 dark:ring-brand-red-light/30 shadow-lg shadow-brand-red/5'
                        : 'border-warm-200 dark:border-warm-700'
                    }`}
                  />
                  {query && (
                    <button
                      onClick={() => {
                        setQuery('');
                        setResults(null);
                        inputRef.current?.focus();
                      }}
                      className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded-full hover:bg-warm-200 dark:hover:bg-warm-700 transition-colors"
                      aria-label="Clear search"
                    >
                      <X className="w-4 h-4 text-warm-500 dark:text-warm-400" />
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Category Filter Pills */}
            <div className="px-4 pb-3 flex gap-2 overflow-x-auto custom-scrollbar">
              {FILTER_OPTIONS.map((opt) => {
                const Icon = opt.icon;
                const isActive = activeFilter === opt.key;
                const count = counts[opt.key];
                return (
                  <button
                    key={opt.key}
                    onClick={() => setActiveFilter(opt.key)}
                    className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-semibold transition-all whitespace-nowrap shrink-0 ${
                      isActive
                        ? 'bg-brand-red text-white shadow-md shadow-brand-red/25'
                        : 'bg-warm-100 dark:bg-warm-800 text-warm-600 dark:text-warm-300 hover:bg-warm-200 dark:hover:bg-warm-700'
                    }`}
                  >
                    <Icon className="w-3.5 h-3.5" />
                    {opt.label}
                    {hasQuery && count > 0 && (
                      <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
                        isActive
                          ? 'bg-white/20 text-white'
                          : 'bg-warm-200 dark:bg-warm-700 text-warm-500 dark:text-warm-400'
                      }`}>
                        {count}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            {/* Gradient divider */}
            <div className="h-px bg-gradient-to-r from-transparent via-brand-red/30 dark:via-brand-red-light/30 to-transparent" />
          </div>

          {/* Search Content */}
          <div className="flex-1 overflow-y-auto custom-scrollbar px-4 py-3">
            {/* No query state - show recent searches & trending */}
            {!hasQuery && (
              <div className="space-y-5">
                {/* Recent Searches */}
                {recentSearches.length > 0 && (
                  <div>
                    <div className="flex items-center justify-between mb-2.5">
                      <h3 className="text-xs font-bold text-warm-500 dark:text-warm-400 uppercase tracking-wider flex items-center gap-1.5">
                        <Clock className="w-3.5 h-3.5" />
                        Recent Searches
                      </h3>
                      <button
                        onClick={clearRecentSearches}
                        className="text-[10px] font-semibold text-brand-red dark:text-brand-red-light hover:underline"
                      >
                        Clear All
                      </button>
                    </div>
                    <div className="space-y-1">
                      {recentSearches.map((term, idx) => (
                        <motion.button
                          key={term}
                          initial={{ opacity: 0, x: -8 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: idx * 0.05 }}
                          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl bg-warm-100/50 dark:bg-warm-800/50 hover:bg-warm-100 dark:hover:bg-warm-800 border border-transparent hover:border-warm-200 dark:hover:border-warm-700 transition-all text-left group"
                          onClick={() => {
                            setQuery(term);
                            saveRecentSearch(term);
                          }}
                        >
                          <Clock className="w-4 h-4 text-warm-400 dark:text-warm-500 shrink-0" />
                          <span className="text-sm font-medium text-warm-700 dark:text-warm-200 flex-1">{term}</span>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              removeRecentSearch(term);
                            }}
                            className="opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded-full hover:bg-warm-200 dark:hover:bg-warm-700 shrink-0"
                            aria-label={`Remove ${term}`}
                          >
                            <X className="w-3 h-3 text-warm-400" />
                          </button>
                        </motion.button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Trending Searches */}
                <div>
                  <h3 className="text-xs font-bold text-warm-500 dark:text-warm-400 uppercase tracking-wider flex items-center gap-1.5 mb-2.5">
                    <TrendingUp className="w-3.5 h-3.5" />
                    Trending
                  </h3>
                  <div className="space-y-1">
                    {TRENDING_ITEMS.map((item, idx) => {
                      const Icon = item.icon;
                      return (
                        <motion.button
                          key={item.label}
                          initial={{ opacity: 0, x: -8 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: 0.05 + idx * 0.05 }}
                          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-warm-100 dark:hover:bg-warm-800 border border-transparent hover:border-warm-200 dark:hover:border-warm-700 transition-all text-left group"
                          onClick={() => {
                            setQuery(item.label);
                            saveRecentSearch(item.label);
                          }}
                        >
                          <div className="w-8 h-8 rounded-lg bg-brand-red/10 dark:bg-brand-red-light/10 flex items-center justify-center shrink-0">
                            <Icon className="w-4 h-4 text-brand-red dark:text-brand-red-light" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <span className="text-sm font-semibold text-warm-800 dark:text-warm-100">{item.label}</span>
                            <span className="text-[10px] text-warm-400 dark:text-warm-500 ml-2 capitalize">{item.type}</span>
                          </div>
                          <ChevronRight className="w-4 h-4 text-warm-300 dark:text-warm-600 group-hover:text-warm-500 dark:group-hover:text-warm-400 transition-colors shrink-0" />
                        </motion.button>
                      );
                    })}
                  </div>
                </div>

                {/* Empty illustration area */}
                <div className="flex flex-col items-center justify-center py-8 text-center">
                  <div className="w-16 h-16 rounded-2xl bg-warm-100 dark:bg-warm-800 flex items-center justify-center mb-4">
                    <Search className="w-7 h-7 text-warm-300 dark:text-warm-600" />
                  </div>
                  <p className="text-sm font-semibold text-warm-600 dark:text-warm-300">
                    Search Kabaddi Pro
                  </p>
                  <p className="text-xs text-warm-400 dark:text-warm-500 mt-1 max-w-[220px]">
                    Try searching for a player or team
                  </p>
                </div>
              </div>
            )}

            {/* Loading state with skeletons */}
            {hasQuery && isSearching && (
              <SearchSkeletons filter={activeFilter} />
            )}

            {/* Results */}
            {hasQuery && !isSearching && results && (
              <div className="space-y-5">
                {/* No results state */}
                {!hasResults && (
                  <div className="flex flex-col items-center justify-center py-16 text-center">
                    <div className="w-16 h-16 rounded-2xl bg-warm-100 dark:bg-warm-800 flex items-center justify-center mb-4">
                      <Search className="w-7 h-7 text-warm-300 dark:text-warm-600" />
                    </div>
                    <p className="text-sm font-semibold text-warm-700 dark:text-warm-200">
                      No results found
                    </p>
                    <p className="text-xs text-warm-400 dark:text-warm-500 mt-1 max-w-[240px]">
                      Try searching for a player or team
                    </p>
                  </div>
                )}

                {/* Players section */}
                {(activeFilter === 'all' || activeFilter === 'players') && results.players.length > 0 && (
                  <div>
                    <div className="flex items-center gap-2 mb-2.5">
                      <div className="w-6 h-6 rounded-md bg-brand-teal/10 dark:bg-brand-teal-light/15 flex items-center justify-center">
                        <Users className="w-3.5 h-3.5 text-brand-teal dark:text-brand-teal-light" />
                      </div>
                      <h3 className="text-xs font-bold text-warm-700 dark:text-warm-200 uppercase tracking-wider">
                        Players
                      </h3>
                      <span className="text-[10px] font-semibold text-warm-400 dark:text-warm-500 bg-warm-100 dark:bg-warm-800 px-1.5 py-0.5 rounded-full">
                        {results.players.length}
                      </span>
                    </div>
                    <div className="space-y-1.5">
                      {results.players.map((player, idx) => (
                        <motion.button
                          key={player.id}
                          className="w-full flex items-center gap-3 p-2.5 rounded-xl bg-warm-100/50 dark:bg-warm-800/50 hover:bg-warm-100 dark:hover:bg-warm-800 border-l-3 border-brand-teal border-t border-r border-b border-transparent hover:border-warm-200 dark:hover:border-warm-700 hover:border-l-brand-teal transition-all text-left group"
                          initial={{ opacity: 0, y: 8 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: idx * 0.03 }}
                          onClick={() => {
                            saveRecentSearch(query.trim());
                            if (onViewPlayer) {
                              onViewPlayer(player.id);
                            } else if (onNavigatePlayer) {
                              onNavigatePlayer(player.id);
                            }
                            onClose();
                          }}
                        >
                          {/* Avatar */}
                          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-brand-teal/20 to-brand-teal/5 dark:from-brand-teal-light/20 dark:to-brand-teal-light/5 border border-warm-200 dark:border-warm-700 flex items-center justify-center overflow-hidden shrink-0">
                            {player.avatar ? (
                              <img src={player.avatar} alt={player.name || ''} className="w-full h-full object-cover" />
                            ) : (
                              <span className="text-sm font-bold text-brand-teal dark:text-brand-teal-light">
                                {(player.name || '?').charAt(0).toUpperCase()}
                              </span>
                            )}
                          </div>

                          {/* Info */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1.5">
                              <span className="text-sm font-semibold text-warm-800 dark:text-warm-100 truncate">
                                {player.name || 'Unknown Player'}
                              </span>
                              {player.playerCode && (
                                <span className="search-highlight text-[10px] font-mono font-bold px-1 py-0.5 rounded">
                                  {player.playerCode}
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-1.5 mt-0.5">
                              <span className={`text-[10px] font-semibold ${getPositionColor(player.position)}`}>
                                {getPositionLabel(player.position)}
                              </span>
                              {player.teamNames.length > 0 && (
                                <>
                                  <span className="text-warm-300 dark:text-warm-600">·</span>
                                  <span className="text-[10px] text-warm-500 dark:text-warm-400 truncate">
                                    {player.teamNames.slice(0, 2).join(', ')}
                                  </span>
                                </>
                              )}
                            </div>
                            {/* Stats row */}
                            {(player.raidPoints !== undefined || player.tacklePoints !== undefined) && (
                              <div className="flex items-center gap-2 mt-1">
                                {player.raidPoints !== undefined && (
                                  <span className="text-[9px] font-bold text-brand-red dark:text-brand-red-light bg-brand-red/5 dark:bg-brand-red-light/5 px-1.5 py-0.5 rounded">
                                    {player.raidPoints} raid pts
                                  </span>
                                )}
                                {player.tacklePoints !== undefined && (
                                  <span className="text-[9px] font-bold text-brand-teal dark:text-brand-teal-light bg-brand-teal/5 dark:bg-brand-teal-light/5 px-1.5 py-0.5 rounded">
                                    {player.tacklePoints} tackle pts
                                  </span>
                                )}
                              </div>
                            )}
                          </div>

                          {/* Chevron */}
                          <ChevronRight className="w-4 h-4 text-warm-300 dark:text-warm-600 group-hover:text-warm-500 dark:group-hover:text-warm-400 transition-colors shrink-0" />
                        </motion.button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Teams section */}
                {(activeFilter === 'all' || activeFilter === 'teams') && results.teams.length > 0 && (
                  <div>
                    <div className="flex items-center gap-2 mb-2.5">
                      <div className="w-6 h-6 rounded-md bg-brand-red/10 dark:bg-brand-red-light/15 flex items-center justify-center">
                        <Shield className="w-3.5 h-3.5 text-brand-red dark:text-brand-red-light" />
                      </div>
                      <h3 className="text-xs font-bold text-warm-700 dark:text-warm-200 uppercase tracking-wider">
                        Teams
                      </h3>
                      <span className="text-[10px] font-semibold text-warm-400 dark:text-warm-500 bg-warm-100 dark:bg-warm-800 px-1.5 py-0.5 rounded-full">
                        {results.teams.length}
                      </span>
                    </div>
                    <div className="space-y-1.5">
                      {results.teams.map((team, idx) => (
                        <motion.button
                          key={team.id}
                          className="w-full flex items-center gap-3 p-2.5 rounded-xl bg-warm-100/50 dark:bg-warm-800/50 hover:bg-warm-100 dark:hover:bg-warm-800 border-l-3 border-t border-r border-b border-transparent hover:border-warm-200 dark:hover:border-warm-700 transition-all text-left group"
                          style={{ borderLeftColor: team.color || '#EF4444' }}
                          initial={{ opacity: 0, y: 8 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: idx * 0.03 }}
                          onClick={() => {
                            saveRecentSearch(query.trim());
                            if (onNavigateTeam) {
                              onNavigateTeam(team.id);
                            }
                            onClose();
                          }}
                        >
                          {/* Team color indicator */}
                          <div
                            className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 border border-warm-200 dark:border-warm-700 shadow-sm"
                            style={{ backgroundColor: team.color || '#64748B' }}
                          >
                            <span className="text-xs font-black text-white drop-shadow-sm">
                              {(team.shortName || team.name).substring(0, 2).toUpperCase()}
                            </span>
                          </div>

                          {/* Info */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1.5">
                              <span className="text-sm font-semibold text-warm-800 dark:text-warm-100 truncate">
                                {team.name}
                              </span>
                              {team.shortName && (
                                <span className="search-highlight text-[10px] font-bold px-1 py-0.5 rounded">
                                  {team.shortName}
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-1.5 mt-0.5">
                              {team.teamCode && (
                                <span className="text-[10px] text-warm-400 dark:text-warm-500 font-mono">
                                  {team.teamCode}
                                </span>
                              )}
                              {team.memberCount !== undefined && (
                                <>
                                  <span className="text-warm-300 dark:text-warm-600">·</span>
                                  <span className="text-[10px] text-warm-500 dark:text-warm-400">
                                    {team.memberCount} members
                                  </span>
                                </>
                              )}
                            </div>
                          </div>

                          {/* Chevron */}
                          <ChevronRight className="w-4 h-4 text-warm-300 dark:text-warm-600 group-hover:text-warm-500 dark:group-hover:text-warm-400 transition-colors shrink-0" />
                        </motion.button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Tournaments section */}
                {(activeFilter === 'all' || activeFilter === 'tournaments') && results.tournaments.length > 0 && (
                  <div>
                    <div className="flex items-center gap-2 mb-2.5">
                      <div className="w-6 h-6 rounded-md bg-brand-gold/10 dark:bg-brand-gold-light/15 flex items-center justify-center">
                        <Trophy className="w-3.5 h-3.5 text-brand-gold dark:text-brand-gold-light" />
                      </div>
                      <h3 className="text-xs font-bold text-warm-700 dark:text-warm-200 uppercase tracking-wider">
                        Tournaments
                      </h3>
                      <span className="text-[10px] font-semibold text-warm-400 dark:text-warm-500 bg-warm-100 dark:bg-warm-800 px-1.5 py-0.5 rounded-full">
                        {results.tournaments.length}
                      </span>
                    </div>
                    <div className="space-y-1.5">
                      {results.tournaments.map((tournament, idx) => {
                        const statusStyle = getStatusStyle(tournament.status);
                        return (
                          <motion.button
                            key={tournament.id}
                            className="w-full flex items-center gap-3 p-2.5 rounded-xl bg-warm-100/50 dark:bg-warm-800/50 hover:bg-warm-100 dark:hover:bg-warm-800 border-l-3 border-brand-gold border-t border-r border-b border-transparent hover:border-warm-200 dark:hover:border-warm-700 hover:border-l-brand-gold transition-all text-left group"
                            initial={{ opacity: 0, y: 8 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: idx * 0.03 }}
                            onClick={() => {
                              saveRecentSearch(query.trim());
                              if (onNavigateTournament) {
                                onNavigateTournament(tournament.id);
                              }
                              onClose();
                            }}
                          >
                            {/* Tournament icon */}
                            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-brand-gold/15 to-brand-gold/5 dark:from-brand-gold-light/15 dark:to-brand-gold-light/5 border border-warm-200 dark:border-warm-700 flex items-center justify-center shrink-0">
                              <Trophy className="w-5 h-5 text-brand-gold dark:text-brand-gold-light" />
                            </div>

                            {/* Info */}
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-1.5">
                                <span className="text-sm font-semibold text-warm-800 dark:text-warm-100 truncate">
                                  {tournament.name}
                                </span>
                              </div>
                              <div className="flex items-center gap-1.5 mt-0.5">
                                <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full border ${statusStyle.bg} ${statusStyle.text}`}>
                                  {statusStyle.label}
                                </span>
                                <span className="text-[10px] text-warm-400 dark:text-warm-500">
                                  {getTypeLabel(tournament.type)}
                                </span>
                                {tournament.tournamentCode && (
                                  <>
                                    <span className="text-warm-300 dark:text-warm-600">·</span>
                                    <span className="search-highlight text-[10px] font-mono font-bold px-1 py-0.5 rounded">
                                      {tournament.tournamentCode}
                                    </span>
                                  </>
                                )}
                              </div>
                            </div>

                            {/* Chevron */}
                            <ChevronRight className="w-4 h-4 text-warm-300 dark:text-warm-600 group-hover:text-warm-500 dark:group-hover:text-warm-400 transition-colors shrink-0" />
                          </motion.button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Matches section */}
                {(activeFilter === 'all' || activeFilter === 'matches') && results.matches.length > 0 && (
                  <div>
                    <div className="flex items-center gap-2 mb-2.5">
                      <div className="w-6 h-6 rounded-md bg-purple-500/10 dark:bg-purple-400/15 flex items-center justify-center">
                        <Swords className="w-3.5 h-3.5 text-purple-500 dark:text-purple-400" />
                      </div>
                      <h3 className="text-xs font-bold text-warm-700 dark:text-warm-200 uppercase tracking-wider">
                        Matches
                      </h3>
                      <span className="text-[10px] font-semibold text-warm-400 dark:text-warm-500 bg-warm-100 dark:bg-warm-800 px-1.5 py-0.5 rounded-full">
                        {results.matches.length}
                      </span>
                    </div>
                    <div className="space-y-1.5">
                      {results.matches.map((match, idx) => {
                        const statusInfo = getMatchStatusLabel(match.status);
                        return (
                          <motion.button
                            key={match.id}
                            className="w-full flex items-center gap-3 p-2.5 rounded-xl bg-warm-100/50 dark:bg-warm-800/50 hover:bg-warm-100 dark:hover:bg-warm-800 border-l-3 border-purple-500 border-t border-r border-b border-transparent hover:border-warm-200 dark:hover:border-warm-700 hover:border-l-purple-500 transition-all text-left group"
                            initial={{ opacity: 0, y: 8 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: idx * 0.03 }}
                            onClick={() => {
                              saveRecentSearch(query.trim());
                              onClose();
                            }}
                          >
                            {/* Match icon */}
                            <div className="flex items-center gap-0.5 shrink-0">
                              <div
                                className="w-5 h-8 rounded-l-md"
                                style={{ backgroundColor: match.homeTeamColor || '#64748B' }}
                              />
                              <div
                                className="w-5 h-8 rounded-r-md"
                                style={{ backgroundColor: match.awayTeamColor || '#64748B' }}
                              />
                            </div>

                            {/* Info */}
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-1.5">
                                <span className="text-sm font-semibold text-warm-800 dark:text-warm-100 truncate">
                                  {match.homeTeamShort || match.homeTeamName} vs {match.awayTeamShort || match.awayTeamName}
                                </span>
                              </div>
                              <div className="flex items-center gap-1.5 mt-0.5">
                                {match.status === 'completed' && (
                                  <span className="text-[10px] font-bold text-warm-700 dark:text-warm-200">
                                    {match.homeScore} - {match.awayScore}
                                  </span>
                                )}
                                <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full border ${statusInfo.color}`}>
                                  {statusInfo.label}
                                </span>
                                {match.date && (
                                  <>
                                    <span className="text-warm-300 dark:text-warm-600">·</span>
                                    <span className="text-[10px] text-warm-400 dark:text-warm-500">
                                      {match.date}
                                    </span>
                                  </>
                                )}
                              </div>
                            </div>

                            {/* Chevron */}
                            <ChevronRight className="w-4 h-4 text-warm-300 dark:text-warm-600 group-hover:text-warm-500 dark:group-hover:text-warm-400 transition-colors shrink-0" />
                          </motion.button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
