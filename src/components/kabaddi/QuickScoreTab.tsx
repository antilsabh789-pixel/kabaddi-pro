'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronLeft, ChevronRight, Plus, X, Search, UserPlus, Database, Check, Clock, Users, Swords, Play, GripVertical, Shield, Zap } from 'lucide-react';
import { useKabaddiStore, type MatchPlayer } from '@/lib/store';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';

interface UserTeam {
  id: string;
  name: string;
  shortName: string | null;
  color: string | null;
}

interface MatchConfig {
  gender: string;
  halfDuration: number;
  playersPerSide: number;
  homeTeam: string;
  awayTeam: string;
  homeTeamColor: string;
  awayTeamColor: string;
  homeLineup: MatchPlayer[];
  awayLineup: MatchPlayer[];
}

// Removed 'Type' step - Quick Score is always practice
const STEPS = ['Gender', 'Settings', 'Teams', 'Lineup', 'Start'];
const STEP_ICONS = [Users, Clock, Swords, Shield, Play];

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
  } | null;
}

export default function QuickScoreTab() {
  const { initiateToss, currentUser } = useKabaddiStore();
  const [step, setStep] = useState(0);
  const [config, setConfig] = useState<MatchConfig>({
    gender: '',
    halfDuration: 20,
    playersPerSide: 7,
    homeTeam: '',
    awayTeam: '',
    homeTeamColor: '#DC2626',
    awayTeamColor: '#1E293B',
    homeLineup: [],
    awayLineup: [],
  });
  const [playerSearch, setPlayerSearch] = useState('');
  const [activeLineupTeam, setActiveLineupTeam] = useState<'home' | 'away'>('home');
  const [searchResults, setSearchResults] = useState<DbPlayer[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [allPlayers, setAllPlayers] = useState<DbPlayer[]>([]);
  const playerInputRef = useRef<HTMLDivElement>(null);
  const [userTeams, setUserTeams] = useState<UserTeam[]>([]);
  const [homeTeamSuggestions, setHomeTeamSuggestions] = useState<UserTeam[]>([]);
  const [awayTeamSuggestions, setAwayTeamSuggestions] = useState<UserTeam[]>([]);
  const [showHomeSuggestions, setShowHomeSuggestions] = useState(false);
  const [showAwaySuggestions, setShowAwaySuggestions] = useState(false);
  const teamInputRef = useRef<HTMLDivElement>(null);

  // Close team/player suggestions when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (teamInputRef.current && !teamInputRef.current.contains(e.target as Node)) {
        setShowHomeSuggestions(false);
        setShowAwaySuggestions(false);
      }
      if (playerInputRef.current && !playerInputRef.current.contains(e.target as Node)) {
        setShowSuggestions(false);
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
        const res = await fetch('/api/teams');
        if (res.ok) {
          const data = await res.json();
          const teams: UserTeam[] = (data.teams || [])
            .filter((team: any) =>
              team.members?.some((m: any) => m.userId === currentUser.id)
            )
            .map((team: any) => ({
              id: team.id,
              name: team.name,
              shortName: team.shortName,
              color: team.color,
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

  const selectHomeTeamSuggestion = (team: UserTeam) => {
    setConfig({
      ...config,
      homeTeam: team.name,
      homeTeamColor: team.color || config.homeTeamColor,
    });
    setShowHomeSuggestions(false);
  };

  const selectAwayTeamSuggestion = (team: UserTeam) => {
    setConfig({
      ...config,
      awayTeam: team.name,
      awayTeamColor: team.color || config.awayTeamColor,
    });
    setShowAwaySuggestions(false);
  };

  const canNext = () => {
    switch (step) {
      case 0: return config.gender !== '';
      case 1: return config.halfDuration >= 1 && config.playersPerSide >= 1;
      case 2: return config.homeTeam !== '' && config.awayTeam !== '';
      case 3: return config.homeLineup.length > 0 && config.awayLineup.length > 0;
      case 4: return true;
      default: return false;
    }
  };

  const handleNext = () => {
    if (step < 4 && canNext()) setStep(step + 1);
  };

  const handlePrev = () => {
    if (step > 0) setStep(step - 1);
  };

  const handleStart = () => {
    initiateToss({
      id: `match_${Date.now()}`,
      homeTeamId: `home_${Date.now()}`,
      awayTeamId: `away_${Date.now()}`,
      homeTeam: config.homeTeam,
      awayTeam: config.awayTeam,
      homeTeamColor: config.homeTeamColor,
      awayTeamColor: config.awayTeamColor,
      isPractice: true, // Quick Score is always practice
      gender: config.gender,
      halfDuration: config.halfDuration,
      playersPerSide: config.playersPerSide,
      homeLineup: config.homeLineup,
      awayLineup: config.awayLineup,
    });
  };

  const addQuickPlayer = (team: 'home' | 'away') => {
    const name = playerSearch.trim();
    if (!name) return;
    const lineup = team === 'home' ? config.homeLineup : config.awayLineup;
    const newPlayer: MatchPlayer = {
      id: `p_${Date.now()}_${Math.random().toString(36).slice(2, 5)}`,
      name,
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

  // Local filter for instant results
  const getLocalFiltered = useCallback((query: string): DbPlayer[] => {
    if (!query.trim()) return allPlayers.slice(0, 20);
    const q = query.toLowerCase().trim();
    return allPlayers.filter(p =>
      (p.name && p.name.toLowerCase().includes(q)) ||
      (p.playerCode && p.playerCode.toLowerCase().includes(q)) ||
      (p.phone && p.phone.includes(q))
    ).slice(0, 20);
  }, [allPlayers]);

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
        const res = await fetch(`/api/players?search=${encodeURIComponent(query)}`);
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
    // Check if already added
    const alreadyAdded = [...config.homeLineup, ...config.awayLineup].some(p => p.id === dbPlayer.id);
    if (alreadyAdded) return;
    const newPlayer: MatchPlayer = {
      id: dbPlayer.id,
      name: dbPlayer.name || 'Unknown',
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

  return (
    <div className="px-4 py-6 space-y-5">
      {/* Step Progress Indicator */}
      <div className="flex items-center justify-between px-1">
        {STEPS.map((label, i) => {
          const StepIcon = STEP_ICONS[i];
          const isCompleted = i < step;
          const isCurrent = i === step;
          return (
            <div key={label} className="flex flex-col items-center gap-1.5 flex-1">
              <div className="flex items-center w-full">
                {i > 0 && (
                  <div className={`flex-1 h-0.5 rounded-full transition-all duration-500 ${
                    i <= step ? 'bg-brand-red' : 'bg-warm-200 dark:bg-warm-700'
                  }`} />
                )}
                <motion.div
                  className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 transition-all duration-300 ${
                    isCompleted
                      ? 'bg-brand-red text-white shadow-md shadow-brand-red/30'
                      : isCurrent
                        ? 'bg-brand-red/15 text-brand-red ring-2 ring-brand-red/30'
                        : 'bg-warm-100 dark:bg-warm-800 text-warm-400 dark:text-warm-500'
                  }`}
                  animate={isCurrent ? { scale: [1, 1.1, 1] } : {}}
                  transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
                >
                  {isCompleted ? (
                    <Check className="w-4 h-4" />
                  ) : (
                    <StepIcon className="w-3.5 h-3.5" />
                  )}
                </motion.div>
                {i < STEPS.length - 1 && (
                  <div className={`flex-1 h-0.5 rounded-full transition-all duration-500 ${
                    i < step ? 'bg-brand-red' : 'bg-warm-200 dark:bg-warm-700'
                  }`} />
                )}
              </div>
              <span className={`text-[9px] font-semibold tracking-wide ${
                isCompleted || isCurrent ? 'text-brand-red' : 'text-warm-400 dark:text-warm-500'
              }`}>
                {label}
              </span>
            </div>
          );
        })}
      </div>

      {/* Step Content */}
      <AnimatePresence mode="wait">
        <motion.div
          key={step}
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -20 }}
          transition={{ duration: 0.2 }}
          className="min-h-[400px]"
        >
          {step === 0 && (
            <div className="space-y-5">
              <div className="text-center">
                <h2 className="text-xl font-bold text-warm-800 dark:text-warm-100">Select Category</h2>
                <p className="text-sm text-warm-500 dark:text-warm-400 mt-1">Choose the match category to get started</p>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <motion.button
                  onClick={() => setConfig({ ...config, gender: 'male' })}
                  whileTap={{ scale: 0.97 }}
                  whileHover={{ scale: 1.02 }}
                  className={`relative p-6 rounded-2xl border-2 transition-all duration-300 flex flex-col items-center gap-3 overflow-hidden ${
                    config.gender === 'male'
                      ? 'border-blue-500 bg-gradient-to-br from-blue-500/20 to-blue-600/10 shadow-lg shadow-blue-500/20'
                      : 'border-warm-200 dark:border-warm-700 bg-white dark:bg-warm-800/50 hover:border-blue-300'
                  }`}
                >
                  {config.gender === 'male' && (
                    <motion.div
                      className="absolute inset-0 bg-gradient-to-br from-blue-500/10 to-transparent"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                    />
                  )}
                  <div className={`w-16 h-16 rounded-2xl flex items-center justify-center relative ${
                    config.gender === 'male'
                      ? 'bg-gradient-to-br from-blue-500 to-blue-600 shadow-md'
                      : 'bg-blue-50 dark:bg-blue-900/30'
                  }`}>
                    <span className="text-3xl">♂</span>
                  </div>
                  <span className={`font-bold text-lg relative ${config.gender === 'male' ? 'text-blue-600 dark:text-blue-400' : 'text-warm-600 dark:text-warm-300'}`}>
                    Boys
                  </span>
                  {config.gender === 'male' && (
                    <motion.div
                      className="absolute top-2 right-2"
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      transition={{ type: 'spring', stiffness: 500, damping: 15 }}
                    >
                      <div className="w-5 h-5 rounded-full bg-blue-500 flex items-center justify-center">
                        <Check className="w-3 h-3 text-white" />
                      </div>
                    </motion.div>
                  )}
                </motion.button>
                <motion.button
                  onClick={() => setConfig({ ...config, gender: 'female' })}
                  whileTap={{ scale: 0.97 }}
                  whileHover={{ scale: 1.02 }}
                  className={`relative p-6 rounded-2xl border-2 transition-all duration-300 flex flex-col items-center gap-3 overflow-hidden ${
                    config.gender === 'female'
                      ? 'border-red-500 bg-gradient-to-br from-red-500/20 to-red-600/10 shadow-lg shadow-red-500/20'
                      : 'border-warm-200 dark:border-warm-700 bg-white dark:bg-warm-800/50 hover:border-red-300'
                  }`}
                >
                  {config.gender === 'female' && (
                    <motion.div
                      className="absolute inset-0 bg-gradient-to-br from-red-500/10 to-transparent"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                    />
                  )}
                  <div className={`w-16 h-16 rounded-2xl flex items-center justify-center relative ${
                    config.gender === 'female'
                      ? 'bg-gradient-to-br from-red-500 to-red-600 shadow-md'
                      : 'bg-red-50 dark:bg-red-900/30'
                  }`}>
                    <span className="text-3xl">♀</span>
                  </div>
                  <span className={`font-bold text-lg relative ${config.gender === 'female' ? 'text-red-600 dark:text-red-400' : 'text-warm-600 dark:text-warm-300'}`}>
                    Girls
                  </span>
                  {config.gender === 'female' && (
                    <motion.div
                      className="absolute top-2 right-2"
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      transition={{ type: 'spring', stiffness: 500, damping: 15 }}
                    >
                      <div className="w-5 h-5 rounded-full bg-red-500 flex items-center justify-center">
                        <Check className="w-3 h-3 text-white" />
                      </div>
                    </motion.div>
                  )}
                </motion.button>
              </div>
            </div>
          )}

          {step === 1 && (
            <div className="space-y-6">
              <div className="text-center">
                <h2 className="text-xl font-bold text-warm-800 dark:text-warm-100">Match Settings</h2>
                <p className="text-sm text-warm-500 dark:text-warm-400 mt-1">Configure your practice match</p>
              </div>

              {/* Practice Match Indicator */}
              <motion.div
                initial={{ opacity: 0, y: -5 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-gradient-to-r from-emerald-50 to-teal-50 dark:from-emerald-900/20 dark:to-teal-900/20 border border-emerald-200 dark:border-emerald-800/30 rounded-2xl p-4 flex items-center gap-3"
              >
                <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center shrink-0">
                  <span className="text-xl">🏋️</span>
                </div>
                <div>
                  <p className="text-sm font-bold text-emerald-700 dark:text-emerald-400">Practice Match</p>
                  <p className="text-[11px] text-emerald-600/70 dark:text-emerald-400/60">Quick Score is for practice. Tournament matches are scored via Tournaments tab.</p>
                </div>
              </motion.div>

              {/* Half Duration */}
              <motion.div
                initial={{ opacity: 0, y: 5 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
                className="bg-white dark:bg-warm-800/50 border border-warm-200 dark:border-warm-700 rounded-2xl p-5"
              >
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-8 h-8 rounded-lg bg-brand-red/10 flex items-center justify-center">
                    <Clock className="w-4 h-4 text-brand-red" />
                  </div>
                  <div>
                    <label className="text-sm font-bold text-warm-800 dark:text-warm-100">
                      Half Duration
                    </label>
                    <p className="text-[10px] text-warm-400 dark:text-warm-500">Each half lasts this many minutes</p>
                  </div>
                  <span className="ml-auto text-2xl font-black text-brand-red">{config.halfDuration}</span>
                  <span className="text-sm text-warm-400 dark:text-warm-500 -ml-1">min</span>
                </div>
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => setConfig({ ...config, halfDuration: Math.max(1, config.halfDuration - 1) })}
                    className="w-10 h-10 rounded-xl bg-warm-100 dark:bg-warm-700 flex items-center justify-center text-warm-700 dark:text-warm-200 active:bg-warm-200 dark:active:bg-warm-600 transition-colors font-bold text-lg"
                  >
                    −
                  </button>
                  <div className="flex-1 relative h-2">
                    <div className="absolute inset-0 bg-warm-100 dark:bg-warm-700 rounded-full" />
                    <div
                      className="absolute left-0 top-0 h-full bg-gradient-to-r from-brand-red to-brand-red-light rounded-full transition-all duration-200"
                      style={{ width: `${((config.halfDuration - 1) / 19) * 100}%` }}
                    />
                  </div>
                  <button
                    onClick={() => setConfig({ ...config, halfDuration: Math.min(20, config.halfDuration + 1) })}
                    className="w-10 h-10 rounded-xl bg-warm-100 dark:bg-warm-700 flex items-center justify-center text-warm-700 dark:text-warm-200 active:bg-warm-200 dark:active:bg-warm-600 transition-colors font-bold text-lg"
                  >
                    +
                  </button>
                </div>
                <div className="flex justify-between text-[10px] text-warm-400 dark:text-warm-500 mt-2 px-1">
                  <span>1 min</span>
                  <span>10 min</span>
                  <span>20 min</span>
                </div>
              </motion.div>

              {/* Players Per Side */}
              <motion.div
                initial={{ opacity: 0, y: 5 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                className="bg-white dark:bg-warm-800/50 border border-warm-200 dark:border-warm-700 rounded-2xl p-5"
              >
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-8 h-8 rounded-lg bg-brand-teal/10 flex items-center justify-center">
                    <Users className="w-4 h-4 text-brand-teal" />
                  </div>
                  <div>
                    <label className="text-sm font-bold text-warm-800 dark:text-warm-100">
                      Players Per Side
                    </label>
                    <p className="text-[10px] text-warm-400 dark:text-warm-500">Standard kabaddi is 7 players</p>
                  </div>
                  <span className="ml-auto text-2xl font-black text-brand-teal">{config.playersPerSide}</span>
                </div>
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => setConfig({ ...config, playersPerSide: Math.max(1, config.playersPerSide - 1) })}
                    className="w-10 h-10 rounded-xl bg-warm-100 dark:bg-warm-700 flex items-center justify-center text-warm-700 dark:text-warm-200 active:bg-warm-200 dark:active:bg-warm-600 transition-colors font-bold text-lg"
                  >
                    −
                  </button>
                  <div className="flex-1 relative h-2">
                    <div className="absolute inset-0 bg-warm-100 dark:bg-warm-700 rounded-full" />
                    <div
                      className="absolute left-0 top-0 h-full bg-gradient-to-r from-brand-teal to-teal-400 rounded-full transition-all duration-200"
                      style={{ width: `${((config.playersPerSide - 1) / 11) * 100}%` }}
                    />
                  </div>
                  <button
                    onClick={() => setConfig({ ...config, playersPerSide: Math.min(12, config.playersPerSide + 1) })}
                    className="w-10 h-10 rounded-xl bg-warm-100 dark:bg-warm-700 flex items-center justify-center text-warm-700 dark:text-warm-200 active:bg-warm-200 dark:active:bg-warm-600 transition-colors font-bold text-lg"
                  >
                    +
                  </button>
                </div>
                <div className="flex justify-between text-[10px] text-warm-400 dark:text-warm-500 mt-2 px-1">
                  <span>1</span>
                  <span>7 (Standard)</span>
                  <span>12</span>
                </div>
              </motion.div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-5" ref={teamInputRef}>
              <div className="text-center">
                <h2 className="text-xl font-bold text-warm-800 dark:text-warm-100">Team Setup</h2>
                <p className="text-sm text-warm-500 dark:text-warm-400 mt-1">Name and customize both teams</p>
              </div>

              {/* Home Team */}
              <div className="space-y-3">
                <label className="text-sm font-bold text-warm-700 dark:text-warm-300 flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: config.homeTeamColor }} />
                  Team A
                </label>
                <div className="relative">
                  <Input
                    placeholder="Enter team name"
                    value={config.homeTeam}
                    onChange={(e) => {
                      setConfig({ ...config, homeTeam: e.target.value });
                      setShowHomeSuggestions(true);
                    }}
                    onFocus={() => setShowHomeSuggestions(true)}
                    className="h-12 bg-white dark:bg-warm-800 border-warm-200 dark:border-warm-700 rounded-xl text-sm font-medium pl-4"
                    style={{ borderColor: config.homeTeamColor, borderWidth: '2px' }}
                  />
                  {config.homeTeam && (
                    <div
                      className="absolute right-3 top-1/2 -translate-y-1/2 w-7 h-7 rounded-lg flex items-center justify-center text-white font-bold text-xs"
                      style={{ backgroundColor: config.homeTeamColor }}
                    >
                      {config.homeTeam.charAt(0).toUpperCase()}
                    </div>
                  )}
                  {/* Team Suggestions Dropdown */}
                  {showHomeSuggestions && homeTeamSuggestions.length > 0 && (
                    <div className="absolute z-20 top-14 left-0 right-0 bg-white dark:bg-warm-800 border border-warm-200 dark:border-warm-700 rounded-xl shadow-xl max-h-36 overflow-y-auto">
                      <div className="px-3 py-1.5 text-[10px] font-semibold text-warm-400 dark:text-warm-500 uppercase tracking-wider border-b border-warm-100 dark:border-warm-700">
                        Your Teams
                      </div>
                      {homeTeamSuggestions.map((team) => (
                        <button
                          key={team.id}
                          onClick={() => selectHomeTeamSuggestion(team)}
                          className="w-full flex items-center gap-2.5 px-3 py-2.5 text-left hover:bg-warm-50 dark:hover:bg-warm-700/50 transition-colors"
                        >
                          <div
                            className="w-8 h-8 rounded-lg flex items-center justify-center text-white text-xs font-bold shrink-0"
                            style={{ backgroundColor: team.color || '#DC2626' }}
                          >
                            {team.shortName ? team.shortName.slice(0, 2) : team.name.charAt(0).toUpperCase()}
                          </div>
                          <span className="text-sm text-warm-800 dark:text-warm-200 font-medium">{team.name}</span>
                          {team.shortName && (
                            <span className="text-[10px] text-warm-400 dark:text-warm-500 font-mono ml-auto">{team.shortName}</span>
                          )}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                <div className="flex gap-2 flex-wrap">
                  {teamColors.map((color) => (
                    <button
                      key={color}
                      onClick={() => setConfig({ ...config, homeTeamColor: color })}
                      className={`w-8 h-8 rounded-full transition-all duration-200 ${
                        config.homeTeamColor === color ? 'ring-2 ring-offset-2 ring-warm-400 dark:ring-offset-warm-900 scale-110' : 'hover:scale-105'
                      }`}
                      style={{ backgroundColor: color }}
                    />
                  ))}
                </div>
              </div>

              {/* VS Indicator */}
              <div className="flex items-center justify-center py-2">
                <div className="flex items-center gap-3 w-full">
                  <div className="flex-1 h-px bg-gradient-to-r from-transparent via-warm-300 dark:via-warm-600 to-transparent" />
                  <motion.div
                    className="w-10 h-10 rounded-full bg-gradient-to-br from-warm-100 to-warm-200 dark:from-warm-700 dark:to-warm-800 flex items-center justify-center border-2 border-warm-300 dark:border-warm-600"
                    animate={{ rotate: [0, 5, -5, 0] }}
                    transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
                  >
                    <Swords className="w-4 h-4 text-warm-500 dark:text-warm-400" />
                  </motion.div>
                  <div className="flex-1 h-px bg-gradient-to-r from-transparent via-warm-300 dark:via-warm-600 to-transparent" />
                </div>
              </div>

              {/* Away Team */}
              <div className="space-y-3">
                <label className="text-sm font-bold text-warm-700 dark:text-warm-300 flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: config.awayTeamColor }} />
                  Team B
                </label>
                <div className="relative">
                  <Input
                    placeholder="Enter team name"
                    value={config.awayTeam}
                    onChange={(e) => {
                      setConfig({ ...config, awayTeam: e.target.value });
                      setShowAwaySuggestions(true);
                    }}
                    onFocus={() => setShowAwaySuggestions(true)}
                    className="h-12 bg-white dark:bg-warm-800 border-warm-200 dark:border-warm-700 rounded-xl text-sm font-medium pl-4"
                    style={{ borderColor: config.awayTeamColor, borderWidth: '2px' }}
                  />
                  {config.awayTeam && (
                    <div
                      className="absolute right-3 top-1/2 -translate-y-1/2 w-7 h-7 rounded-lg flex items-center justify-center text-white font-bold text-xs"
                      style={{ backgroundColor: config.awayTeamColor }}
                    >
                      {config.awayTeam.charAt(0).toUpperCase()}
                    </div>
                  )}
                  {/* Team Suggestions Dropdown */}
                  {showAwaySuggestions && awayTeamSuggestions.length > 0 && (
                    <div className="absolute z-20 top-14 left-0 right-0 bg-white dark:bg-warm-800 border border-warm-200 dark:border-warm-700 rounded-xl shadow-xl max-h-36 overflow-y-auto">
                      <div className="px-3 py-1.5 text-[10px] font-semibold text-warm-400 dark:text-warm-500 uppercase tracking-wider border-b border-warm-100 dark:border-warm-700">
                        Your Teams
                      </div>
                      {awayTeamSuggestions.map((team) => (
                        <button
                          key={team.id}
                          onClick={() => selectAwayTeamSuggestion(team)}
                          className="w-full flex items-center gap-2.5 px-3 py-2.5 text-left hover:bg-warm-50 dark:hover:bg-warm-700/50 transition-colors"
                        >
                          <div
                            className="w-8 h-8 rounded-lg flex items-center justify-center text-white text-xs font-bold shrink-0"
                            style={{ backgroundColor: team.color || '#1E293B' }}
                          >
                            {team.shortName ? team.shortName.slice(0, 2) : team.name.charAt(0).toUpperCase()}
                          </div>
                          <span className="text-sm text-warm-800 dark:text-warm-200 font-medium">{team.name}</span>
                          {team.shortName && (
                            <span className="text-[10px] text-warm-400 dark:text-warm-500 font-mono ml-auto">{team.shortName}</span>
                          )}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                <div className="flex gap-2 flex-wrap">
                  {teamColors.map((color) => (
                    <button
                      key={`away-${color}`}
                      onClick={() => setConfig({ ...config, awayTeamColor: color })}
                      className={`w-8 h-8 rounded-full transition-all duration-200 ${
                        config.awayTeamColor === color ? 'ring-2 ring-offset-2 ring-warm-400 dark:ring-offset-warm-900 scale-110' : 'hover:scale-105'
                      }`}
                      style={{ backgroundColor: color }}
                    />
                  ))}
                </div>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-4">
              <div className="text-center">
                <h2 className="text-xl font-bold text-warm-800 dark:text-warm-100">Add Players</h2>
                <p className="text-sm text-warm-500 dark:text-warm-400 mt-1">Search or quick-add players to each team</p>
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

              {/* Unified Search Input with Suggestions */}
              <div className="space-y-2" ref={playerInputRef}>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-warm-400" />
                  <Input
                    placeholder="Search by name, ID code, or phone..."
                    value={playerSearch}
                    onChange={(e) => {
                      setPlayerSearch(e.target.value);
                      setShowSuggestions(true);
                    }}
                    onFocus={() => {
                      setShowSuggestions(true);
                      // Show all players on focus if search is empty
                      if (!playerSearch.trim()) {
                        setSearchResults(getLocalFiltered(''));
                      }
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && playerSearch.trim()) {
                        // If exact match found in results, add it
                        const exactMatch = searchResults.find(
                          p => p.name?.toLowerCase() === playerSearch.trim().toLowerCase()
                        );
                        if (exactMatch) {
                          addDbPlayer(exactMatch);
                        } else {
                          // Quick add a new player by name
                          addQuickPlayer(activeLineupTeam);
                        }
                      }
                      if (e.key === 'Escape') {
                        setShowSuggestions(false);
                      }
                    }}
                    className="pl-9 pr-9 h-12 bg-white dark:bg-warm-800 border-warm-200 dark:border-warm-700 rounded-xl text-sm"
                    autoFocus
                  />
                  {playerSearch && (
                    <button
                      onClick={() => {
                        setPlayerSearch('');
                        setSearchResults([]);
                        setShowSuggestions(false);
                      }}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-warm-400 hover:text-warm-600"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </div>

                {/* Suggestions Dropdown */}
                {showSuggestions && (
                  <div className="bg-white dark:bg-warm-800 border border-warm-200 dark:border-warm-700 rounded-xl shadow-xl max-h-56 overflow-y-auto divide-y divide-warm-100 dark:divide-warm-700">
                    {/* Searching indicator */}
                    {isSearching && (
                      <div className="px-3 py-2 flex items-center gap-2">
                        <div className="w-3 h-3 border-2 border-brand-teal border-t-transparent rounded-full animate-spin" />
                        <span className="text-xs text-warm-400">Searching more...</span>
                      </div>
                    )}

                    {/* Player Suggestions */}
                    {searchResults.length > 0 ? (
                      searchResults.map((p) => {
                        const alreadyAdded = [...config.homeLineup, ...config.awayLineup].some(lp => lp.id === p.id);
                        return (
                          <button
                            key={p.id}
                            onClick={() => !alreadyAdded && addDbPlayer(p)}
                            disabled={alreadyAdded}
                            className={`w-full flex items-center gap-3 p-3 text-left transition-colors ${
                              alreadyAdded
                                ? 'opacity-50 cursor-not-allowed bg-warm-50 dark:bg-warm-800/50'
                                : 'hover:bg-warm-50 dark:hover:bg-warm-700/50 active:bg-warm-100 dark:active:bg-warm-700'
                            }`}
                          >
                            <div className="w-10 h-10 rounded-xl bg-warm-100 dark:bg-warm-700 flex items-center justify-center text-xs font-bold text-warm-600 dark:text-warm-300 overflow-hidden shrink-0 relative">
                              {p.avatar ? (
                                <img src={p.avatar} alt={p.name || ''} className="w-full h-full object-cover" />
                              ) : (
                                (p.name || '?').charAt(0).toUpperCase()
                              )}
                              {p.profile?.position && (
                                <div className="absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full bg-brand-teal/20 flex items-center justify-center text-brand-teal">
                                  {getPositionIcon(p.profile.position)}
                                </div>
                              )}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-warm-800 dark:text-warm-200 truncate">
                                {highlightMatch(p.name || 'Unknown', playerSearch)}
                              </p>
                              <div className="flex items-center gap-2">
                                {p.playerCode && (
                                  <span className="text-[10px] font-mono font-semibold text-brand-teal bg-brand-teal/10 px-1.5 py-0.5 rounded">
                                    {highlightMatch(p.playerCode, playerSearch)}
                                  </span>
                                )}
                                {p.phone && (
                                  <span className="text-[10px] text-warm-400 dark:text-warm-500">{p.phone}</span>
                                )}
                                {p.profile?.position && (
                                  <span className="text-[10px] text-warm-500 dark:text-warm-400 bg-warm-100 dark:bg-warm-700 px-1.5 py-0.5 rounded capitalize">
                                    {p.profile.position}
                                  </span>
                                )}
                              </div>
                            </div>
                            {alreadyAdded ? (
                              <Badge className="bg-brand-green/10 text-brand-green text-[9px] border-0">Added</Badge>
                            ) : (
                              <div className="w-8 h-8 rounded-full bg-brand-teal/10 flex items-center justify-center">
                                <Plus className="w-4 h-4 text-brand-teal" />
                              </div>
                            )}
                          </button>
                        );
                      })
                    ) : !isSearching && playerSearch.trim() ? (
                      <div className="px-3 py-4 text-center">
                        <p className="text-sm text-warm-500 dark:text-warm-400">No player found for &quot;{playerSearch}&quot;</p>
                        <button
                          onClick={() => addQuickPlayer(activeLineupTeam)}
                          className="mt-2 inline-flex items-center gap-1.5 text-sm font-medium text-brand-red hover:text-brand-red-dark"
                        >
                          <UserPlus className="w-3.5 h-3.5" />
                          Quick add &quot;{playerSearch.trim()}&quot;
                        </button>
                      </div>
                    ) : !playerSearch.trim() && allPlayers.length === 0 ? (
                      <div className="px-3 py-4 text-center">
                        <Database className="w-6 h-6 text-warm-300 dark:text-warm-600 mx-auto mb-1" />
                        <p className="text-xs text-warm-400 dark:text-warm-500">No players in database yet</p>
                        <p className="text-[10px] text-warm-400 dark:text-warm-500">Type a name to quick-add a new player</p>
                      </div>
                    ) : null}

                    {/* Quick add option when there are results but no exact match */}
                    {searchResults.length > 0 && playerSearch.trim() && !searchResults.some(
                      p => p.name?.toLowerCase() === playerSearch.trim().toLowerCase()
                    ) && (
                      <button
                        onClick={() => addQuickPlayer(activeLineupTeam)}
                        className="w-full flex items-center gap-3 p-3 text-left hover:bg-brand-red/5 dark:hover:bg-brand-red/10 active:bg-brand-red/10 transition-colors border-t-2 border-dashed border-warm-200 dark:border-warm-700"
                      >
                        <div className="w-10 h-10 rounded-xl bg-brand-red/10 flex items-center justify-center shrink-0">
                          <UserPlus className="w-4 h-4 text-brand-red" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-brand-red">
                            Quick add &quot;{playerSearch.trim()}&quot;
                          </p>
                          <p className="text-[10px] text-warm-400 dark:text-warm-500">Add as new player (not in database)</p>
                        </div>
                      </button>
                    )}
                  </div>
                )}
              </div>

              {/* Player Cards */}
              <div className="space-y-2 min-h-[60px]">
                {(activeLineupTeam === 'home' ? config.homeLineup : config.awayLineup).length === 0 ? (
                  <div className="w-full text-center py-10">
                    <div className="w-12 h-12 rounded-full bg-warm-100 dark:bg-warm-800 mx-auto flex items-center justify-center mb-2">
                      <UserPlus className="w-5 h-5 text-warm-300 dark:text-warm-600" />
                    </div>
                    <p className="text-warm-400 dark:text-warm-500 text-sm font-medium">No players added yet</p>
                    <p className="text-warm-300 dark:text-warm-600 text-xs mt-0.5">Search or type a name above to add</p>
                  </div>
                ) : (
                  (activeLineupTeam === 'home' ? config.homeLineup : config.awayLineup).map((player, idx) => (
                    <motion.div
                      key={player.id}
                      initial={{ scale: 0.9, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      className="flex items-center gap-3 bg-white dark:bg-warm-800/70 border border-warm-200 dark:border-warm-700 rounded-xl p-3 shadow-sm"
                    >
                      <div className="text-warm-300 dark:text-warm-600">
                        <GripVertical className="w-4 h-4" />
                      </div>
                      <span
                        className="w-7 h-7 rounded-lg flex items-center justify-center text-[10px] font-bold text-white shrink-0"
                        style={{
                          backgroundColor:
                            activeLineupTeam === 'home' ? config.homeTeamColor : config.awayTeamColor,
                        }}
                      >
                        {player.jerseyNumber}
                      </span>
                      <div className="flex-1 min-w-0">
                        <span className="text-sm font-medium text-warm-800 dark:text-warm-200">{player.name}</span>
                        {player.playerCode && (
                          <span className="text-[9px] font-mono text-brand-teal bg-brand-teal/10 px-1 rounded ml-1.5">
                            {player.playerCode}
                          </span>
                        )}
                      </div>
                      <span className="text-[10px] text-warm-400 dark:text-warm-500 font-medium">#{idx + 1}</span>
                      <button
                        onClick={() => removePlayer(activeLineupTeam, player.id)}
                        className="w-6 h-6 rounded-full flex items-center justify-center text-warm-400 hover:text-brand-red hover:bg-brand-red/10 transition-colors"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </motion.div>
                  ))
                )}
              </div>
            </div>
          )}

          {step === 4 && (
            <div className="space-y-5">
              <div className="text-center">
                <h2 className="text-xl font-bold text-warm-800 dark:text-warm-100">Match Preview</h2>
                <p className="text-sm text-warm-500 dark:text-warm-400 mt-1">Review your match setup before starting</p>
              </div>

              {/* Match Preview Card */}
              <div className="bg-white dark:bg-warm-800/50 rounded-2xl border border-warm-200 dark:border-warm-700 overflow-hidden shadow-sm">
                {/* Gender Badge Header */}
                <div className={`py-2 px-4 text-center ${
                  config.gender === 'male'
                    ? 'bg-gradient-to-r from-blue-500/10 to-blue-600/5 dark:from-blue-500/20 dark:to-blue-600/10'
                    : 'bg-gradient-to-r from-red-500/10 to-red-600/5 dark:from-red-500/20 dark:to-red-600/10'
                }`}>
                  <span className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold ${
                    config.gender === 'male'
                      ? 'bg-blue-500/20 text-blue-600 dark:text-blue-400'
                      : 'bg-red-500/20 text-red-600 dark:text-red-400'
                  }`}>
                    {config.gender === 'male' ? '♂ Boys Match' : '♀ Girls Match'}
                  </span>
                </div>

                {/* Teams Face Off */}
                <div className="p-6">
                  <div className="flex items-center justify-between">
                    <div className="text-center flex-1">
                      <motion.div
                        className="w-16 h-16 rounded-2xl mx-auto flex items-center justify-center text-white font-black text-xl shadow-lg"
                        style={{ backgroundColor: config.homeTeamColor }}
                        initial={{ x: -20, opacity: 0 }}
                        animate={{ x: 0, opacity: 1 }}
                        transition={{ delay: 0.1 }}
                      >
                        {config.homeTeam.charAt(0).toUpperCase()}
                      </motion.div>
                      <motion.div
                        className="font-bold text-warm-800 dark:text-warm-100 mt-2 text-sm"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: 0.2 }}
                      >
                        {config.homeTeam}
                      </motion.div>
                      <div className="text-xs text-warm-500 dark:text-warm-400 mt-0.5">{config.homeLineup.length} players</div>
                      {/* Lineup Summary */}
                      <div className="flex flex-wrap gap-1 mt-2 justify-center">
                        {config.homeLineup.slice(0, 5).map((p) => (
                          <span
                            key={p.id}
                            className="text-[9px] px-1.5 py-0.5 rounded-full bg-warm-100 dark:bg-warm-700 text-warm-600 dark:text-warm-300 font-medium"
                          >
                            #{p.jerseyNumber} {p.name.split(' ')[0]}
                          </span>
                        ))}
                        {config.homeLineup.length > 5 && (
                          <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-warm-100 dark:bg-warm-700 text-warm-500">
                            +{config.homeLineup.length - 5}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex flex-col items-center px-3">
                      <motion.div
                        className="w-12 h-12 rounded-full bg-gradient-to-br from-warm-100 to-warm-200 dark:from-warm-700 dark:to-warm-800 flex items-center justify-center border-2 border-warm-300 dark:border-warm-600"
                        animate={{ scale: [1, 1.1, 1] }}
                        transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
                      >
                        <span className="text-warm-600 dark:text-warm-300 font-black text-sm">VS</span>
                      </motion.div>
                    </div>

                    <div className="text-center flex-1">
                      <motion.div
                        className="w-16 h-16 rounded-2xl mx-auto flex items-center justify-center text-white font-black text-xl shadow-lg"
                        style={{ backgroundColor: config.awayTeamColor }}
                        initial={{ x: 20, opacity: 0 }}
                        animate={{ x: 0, opacity: 1 }}
                        transition={{ delay: 0.1 }}
                      >
                        {config.awayTeam.charAt(0).toUpperCase()}
                      </motion.div>
                      <motion.div
                        className="font-bold text-warm-800 dark:text-warm-100 mt-2 text-sm"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: 0.2 }}
                      >
                        {config.awayTeam}
                      </motion.div>
                      <div className="text-xs text-warm-500 dark:text-warm-400 mt-0.5">{config.awayLineup.length} players</div>
                      {/* Lineup Summary */}
                      <div className="flex flex-wrap gap-1 mt-2 justify-center">
                        {config.awayLineup.slice(0, 5).map((p) => (
                          <span
                            key={p.id}
                            className="text-[9px] px-1.5 py-0.5 rounded-full bg-warm-100 dark:bg-warm-700 text-warm-600 dark:text-warm-300 font-medium"
                          >
                            #{p.jerseyNumber} {p.name.split(' ')[0]}
                          </span>
                        ))}
                        {config.awayLineup.length > 5 && (
                          <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-warm-100 dark:bg-warm-700 text-warm-500">
                            +{config.awayLineup.length - 5}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Match Info */}
                <div className="border-t border-warm-200 dark:border-warm-700 px-5 py-4 space-y-2.5 bg-warm-50/50 dark:bg-warm-800/30">
                  <div className="flex justify-between text-sm">
                    <span className="text-warm-500 dark:text-warm-400">Format</span>
                    <span className="text-warm-800 dark:text-warm-200 font-bold">
                      {config.playersPerSide}v{config.playersPerSide} &middot; {config.halfDuration}min halves
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-warm-500 dark:text-warm-400">Type</span>
                    <span className="text-warm-800 dark:text-warm-200 font-bold">
                      🏋️ Practice
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-warm-500 dark:text-warm-400">Category</span>
                    <span className={`font-bold ${config.gender === 'male' ? 'text-blue-600 dark:text-blue-400' : 'text-red-600 dark:text-red-400'}`}>
                      {config.gender === 'male' ? '♂ Boys' : '♀ Girls'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Start Match Button */}
              <motion.div
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
              >
                <Button
                  onClick={handleStart}
                  className="w-full h-14 bg-gradient-to-r from-brand-red to-brand-red-light hover:from-brand-red-dark hover:to-brand-red text-white rounded-2xl font-bold text-lg shadow-xl shadow-brand-red/30 relative overflow-hidden"
                >
                  <motion.div
                    className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent"
                    animate={{ x: ['-100%', '200%'] }}
                    transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
                  />
                  <span className="relative flex items-center gap-2">
                    <Play className="w-5 h-5" />
                    Start Match!
                  </span>
                </Button>
              </motion.div>
            </div>
          )}
        </motion.div>
      </AnimatePresence>

      {/* Navigation */}
      {step < 4 && (
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
    </div>
  );
}
