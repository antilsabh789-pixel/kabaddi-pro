'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
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
} from 'lucide-react';

// ─── Types ──────────────────────────────────────────────────────────

interface PlayerResult {
  id: string;
  name: string | null;
  playerCode: string | null;
  avatar: string | null;
  position: string | null;
  teamNames: string[];
}

interface TeamResult {
  id: string;
  name: string;
  shortName: string | null;
  color: string | null;
  teamCode: string | null;
}

interface TournamentResult {
  id: string;
  name: string;
  type: string;
  status: string;
  tournamentCode: string | null;
}

interface SearchResults {
  players: PlayerResult[];
  teams: TeamResult[];
  tournaments: TournamentResult[];
}

type FilterType = 'all' | 'players' | 'teams' | 'tournaments';

interface GlobalSearchScreenProps {
  onClose: () => void;
  onNavigatePlayer?: (playerId: string) => void;
  onNavigateTeam?: (teamId: string) => void;
  onNavigateTournament?: (tournamentId: string) => void;
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
const MAX_RECENT = 8;
const FILTER_OPTIONS: { key: FilterType; label: string; icon: typeof Search }[] = [
  { key: 'all', label: 'All', icon: Search },
  { key: 'players', label: 'Players', icon: Users },
  { key: 'teams', label: 'Teams', icon: Shield },
  { key: 'tournaments', label: 'Tournaments', icon: Trophy },
];

const SEARCH_SUGGESTIONS = [
  'Top Raiders',
  'Pro Kabaddi',
  'Tournament',
  'Defender',
];

// ─── Component ──────────────────────────────────────────────────────

export default function GlobalSearchScreen({
  onClose,
  onNavigatePlayer,
  onNavigateTeam,
  onNavigateTournament,
}: GlobalSearchScreenProps) {
  const [query, setQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState<FilterType>('all');
  const [results, setResults] = useState<SearchResults | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
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
        setResults(data);
      } else {
        setResults({ players: [], teams: [], tournaments: [] });
      }
    } catch {
      setResults({ players: [], teams: [], tournaments: [] });
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

  // Total results count
  const totalResults = results
    ? results.players.length + results.teams.length + results.tournaments.length
    : 0;

  const hasQuery = query.trim().length > 0;
  const hasResults = totalResults > 0;

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
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-warm-400 dark:text-warm-500" />
                  <input
                    ref={inputRef}
                    type="text"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleSubmit();
                      if (e.key === 'Escape') onClose();
                    }}
                    placeholder="Search players, teams, tournaments..."
                    className="input-search w-full pl-10 pr-10 py-2.5 rounded-xl bg-warm-100 dark:bg-warm-800 border border-warm-200 dark:border-warm-700 text-foreground placeholder:text-warm-400 dark:placeholder:text-warm-500 focus:outline-none focus:ring-2 focus:ring-brand-red/40 focus:border-brand-red/40 dark:focus:ring-brand-red-light/40 dark:focus:border-brand-red-light/40 text-sm font-medium transition-all"
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

            {/* Category Filters */}
            <div className="px-4 pb-3 flex gap-2 overflow-x-auto custom-scrollbar">
              {FILTER_OPTIONS.map((opt) => {
                const Icon = opt.icon;
                const isActive = activeFilter === opt.key;
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
                  </button>
                );
              })}
            </div>

            {/* Gradient divider */}
            <div className="h-px bg-gradient-to-r from-transparent via-brand-red/30 dark:via-brand-red-light/30 to-transparent" />
          </div>

          {/* Search Content */}
          <div className="flex-1 overflow-y-auto custom-scrollbar px-4 py-3">
            {/* No query state - show recent searches */}
            {!hasQuery && (
              <div className="space-y-4">
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
                    <div className="flex flex-wrap gap-2">
                      {recentSearches.map((term) => (
                        <div
                          key={term}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-warm-100 dark:bg-warm-800 border border-warm-200 dark:border-warm-700 group hover:border-brand-red/30 dark:hover:border-brand-red-light/30 transition-colors cursor-pointer"
                          onClick={() => {
                            setQuery(term);
                            saveRecentSearch(term);
                          }}
                        >
                          <span className="text-xs font-medium text-warm-700 dark:text-warm-200">{term}</span>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              removeRecentSearch(term);
                            }}
                            className="opacity-0 group-hover:opacity-100 transition-opacity p-0.5 rounded-full hover:bg-warm-200 dark:hover:bg-warm-700"
                            aria-label={`Remove ${term}`}
                          >
                            <X className="w-3 h-3 text-warm-400" />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Quick Suggestions */}
                <div>
                  <h3 className="text-xs font-bold text-warm-500 dark:text-warm-400 uppercase tracking-wider flex items-center gap-1.5 mb-2.5">
                    <Sparkles className="w-3.5 h-3.5" />
                    Try Searching
                  </h3>
                  <div className="flex flex-wrap gap-2">
                    {SEARCH_SUGGESTIONS.map((suggestion) => (
                      <button
                        key={suggestion}
                        onClick={() => {
                          setQuery(suggestion);
                          saveRecentSearch(suggestion);
                        }}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-brand-red/5 dark:bg-brand-red-light/10 border border-brand-red/15 dark:border-brand-red-light/20 hover:bg-brand-red/10 dark:hover:bg-brand-red-light/15 transition-colors"
                      >
                        <TrendingUp className="w-3 h-3 text-brand-red dark:text-brand-red-light" />
                        <span className="text-xs font-medium text-brand-red dark:text-brand-red-light">{suggestion}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Empty illustration area */}
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <div className="w-16 h-16 rounded-2xl bg-warm-100 dark:bg-warm-800 flex items-center justify-center mb-4">
                    <Search className="w-7 h-7 text-warm-300 dark:text-warm-600" />
                  </div>
                  <p className="text-sm font-semibold text-warm-600 dark:text-warm-300">
                    Search Kabaddi Pro
                  </p>
                  <p className="text-xs text-warm-400 dark:text-warm-500 mt-1 max-w-[220px]">
                    Find players, teams, and tournaments across the platform
                  </p>
                </div>
              </div>
            )}

            {/* Loading state */}
            {hasQuery && isSearching && (
              <div className="flex flex-col items-center justify-center py-16">
                <motion.div
                  className="w-8 h-8 border-2 border-brand-red border-t-transparent rounded-full"
                  animate={{ rotate: 360 }}
                  transition={{ duration: 0.8, repeat: Infinity, ease: 'linear' }}
                />
                <p className="text-xs text-warm-400 dark:text-warm-500 mt-3">Searching...</p>
              </div>
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
                      Try a different search term or browse by category
                    </p>
                    <div className="flex flex-wrap gap-2 mt-4 justify-center">
                      {SEARCH_SUGGESTIONS.map((suggestion) => (
                        <button
                          key={suggestion}
                          onClick={() => {
                            setQuery(suggestion);
                            saveRecentSearch(suggestion);
                          }}
                          className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-warm-100 dark:bg-warm-800 border border-warm-200 dark:border-warm-700 text-xs font-medium text-warm-600 dark:text-warm-300 hover:bg-warm-200 dark:hover:bg-warm-700 transition-colors"
                        >
                          <TrendingUp className="w-3 h-3" />
                          {suggestion}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Players section */}
                {results.players.length > 0 && (
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
                          className="w-full flex items-center gap-3 p-2.5 rounded-xl bg-warm-100/50 dark:bg-warm-800/50 hover:bg-warm-100 dark:hover:bg-warm-800 border border-transparent hover:border-warm-200 dark:hover:border-warm-700 transition-all text-left group"
                          initial={{ opacity: 0, y: 8 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: idx * 0.03 }}
                          onClick={() => {
                            saveRecentSearch(query.trim());
                            if (onNavigatePlayer) {
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
                              <span className="text-[10px] font-medium text-brand-teal dark:text-brand-teal-light">
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
                          </div>

                          {/* Chevron */}
                          <ChevronRight className="w-4 h-4 text-warm-300 dark:text-warm-600 group-hover:text-warm-500 dark:group-hover:text-warm-400 transition-colors shrink-0" />
                        </motion.button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Teams section */}
                {results.teams.length > 0 && (
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
                          className="w-full flex items-center gap-3 p-2.5 rounded-xl bg-warm-100/50 dark:bg-warm-800/50 hover:bg-warm-100 dark:hover:bg-warm-800 border border-transparent hover:border-warm-200 dark:hover:border-warm-700 transition-all text-left group"
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
                            className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 border border-warm-200 dark:border-warm-700"
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
                            {team.teamCode && (
                              <span className="text-[10px] text-warm-400 dark:text-warm-500 font-mono">
                                {team.teamCode}
                              </span>
                            )}
                          </div>

                          {/* Chevron */}
                          <ChevronRight className="w-4 h-4 text-warm-300 dark:text-warm-600 group-hover:text-warm-500 dark:group-hover:text-warm-400 transition-colors shrink-0" />
                        </motion.button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Tournaments section */}
                {results.tournaments.length > 0 && (
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
                            className="w-full flex items-center gap-3 p-2.5 rounded-xl bg-warm-100/50 dark:bg-warm-800/50 hover:bg-warm-100 dark:hover:bg-warm-800 border border-transparent hover:border-warm-200 dark:hover:border-warm-700 transition-all text-left group"
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
                                <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${statusStyle.bg} ${statusStyle.text}`}>
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
              </div>
            )}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
