'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronLeft, ChevronRight, Plus, X, Search, UserPlus, Database } from 'lucide-react';
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

  return (
    <div className="px-4 py-6 space-y-5">
      {/* Step Indicator */}
      <div className="flex items-center gap-1">
        {STEPS.map((label, i) => (
          <div key={label} className="flex-1 flex flex-col items-center gap-1">
            <div
              className={`h-1 w-full rounded-full transition-all duration-300 ${
                i <= step ? 'bg-brand-red' : 'bg-warm-300'
              }`}
            />
            <span
              className={`text-[9px] font-medium ${
                i <= step ? 'text-brand-red' : 'text-warm-400'
              }`}
            >
              {label}
            </span>
          </div>
        ))}
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
            <div className="space-y-4">
              <h2 className="text-lg font-bold text-warm-800">Select Gender</h2>
              <div className="grid grid-cols-2 gap-4">
                <button
                  onClick={() => setConfig({ ...config, gender: 'male' })}
                  className={`p-8 rounded-2xl border-2 transition-all duration-200 flex flex-col items-center gap-3 ${
                    config.gender === 'male'
                      ? 'border-brand-blue bg-brand-blue/10'
                      : 'border-warm-300 bg-white'
                  }`}
                >
                  <span className="text-5xl">♂</span>
                  <span className={`font-bold text-lg ${config.gender === 'male' ? 'text-brand-blue' : 'text-warm-600'}`}>
                    Boys
                  </span>
                </button>
                <button
                  onClick={() => setConfig({ ...config, gender: 'female' })}
                  className={`p-8 rounded-2xl border-2 transition-all duration-200 flex flex-col items-center gap-3 ${
                    config.gender === 'female'
                      ? 'border-brand-red bg-brand-red/10'
                      : 'border-warm-300 bg-white'
                  }`}
                >
                  <span className="text-5xl">♀</span>
                  <span className={`font-bold text-lg ${config.gender === 'female' ? 'text-brand-red' : 'text-warm-600'}`}>
                    Girls
                  </span>
                </button>
              </div>
            </div>
          )}

          {step === 1 && (
            <div className="space-y-6">
              <h2 className="text-lg font-bold text-warm-800">Match Settings</h2>

              {/* Practice Match Indicator */}
              <div className="bg-brand-green/10 border border-brand-green/20 rounded-xl p-3 flex items-center gap-2">
                <span className="text-lg">🏋️</span>
                <div>
                  <p className="text-sm font-semibold text-brand-green">Practice Match</p>
                  <p className="text-[10px] text-warm-500">Quick Score is for practice. Tournament matches are scored via Tournaments tab.</p>
                </div>
              </div>

              {/* Half Duration */}
              <div>
                <label className="text-sm font-medium text-warm-700 mb-2 block">
                  Half Duration: {config.halfDuration} min
                </label>
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => setConfig({ ...config, halfDuration: Math.max(1, config.halfDuration - 1) })}
                    className="w-10 h-10 rounded-xl bg-warm-200 flex items-center justify-center text-warm-700 active:bg-warm-300 transition-colors"
                  >
                    -
                  </button>
                  <div className="flex-1 relative">
                    <input
                      type="range"
                      min={1}
                      max={20}
                      step={1}
                      value={config.halfDuration}
                      onChange={(e) => setConfig({ ...config, halfDuration: parseInt(e.target.value) })}
                      className="w-full h-2 bg-warm-200 rounded-xl appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-5 [&::-webkit-slider-thumb]:h-5 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-brand-red [&::-webkit-slider-thumb]:shadow-md [&::-webkit-slider-thumb]:cursor-pointer [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-white"
                    />
                  </div>
                  <button
                    onClick={() => setConfig({ ...config, halfDuration: Math.min(20, config.halfDuration + 1) })}
                    className="w-10 h-10 rounded-xl bg-warm-200 flex items-center justify-center text-warm-700 active:bg-warm-300 transition-colors"
                  >
                    +
                  </button>
                </div>
                <div className="flex justify-between text-xs text-warm-400 mt-1">
                  <span>1 min</span>
                  <span>20 min</span>
                </div>
              </div>

              {/* Players Per Side */}
              <div>
                <label className="text-sm font-medium text-warm-700 mb-2 block">
                  Players Per Side: {config.playersPerSide}
                </label>
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => setConfig({ ...config, playersPerSide: Math.max(1, config.playersPerSide - 1) })}
                    className="w-10 h-10 rounded-xl bg-warm-200 flex items-center justify-center text-warm-700"
                  >
                    -
                  </button>
                  <div className="flex-1 bg-warm-200 rounded-xl h-2">
                    <div
                      className="bg-brand-red rounded-xl h-2 transition-all duration-200"
                      style={{ width: `${((config.playersPerSide - 1) / 11) * 100}%` }}
                    />
                  </div>
                  <button
                    onClick={() => setConfig({ ...config, playersPerSide: Math.min(12, config.playersPerSide + 1) })}
                    className="w-10 h-10 rounded-xl bg-warm-200 flex items-center justify-center text-warm-700"
                  >
                    +
                  </button>
                </div>
                <div className="flex justify-between text-xs text-warm-400 mt-1">
                  <span>1</span>
                  <span>12</span>
                </div>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-5" ref={teamInputRef}>
              <h2 className="text-lg font-bold text-warm-800">Team Setup</h2>

              {/* Home Team */}
              <div className="space-y-3">
                <label className="text-sm font-medium text-warm-700">Team A</label>
                <div className="relative">
                  <Input
                    placeholder="Enter team name"
                    value={config.homeTeam}
                    onChange={(e) => {
                      setConfig({ ...config, homeTeam: e.target.value });
                      setShowHomeSuggestions(true);
                    }}
                    onFocus={() => setShowHomeSuggestions(true)}
                    className="h-11 bg-white border-warm-300 rounded-xl"
                    style={{ borderColor: config.homeTeamColor }}
                  />
                  {/* Team Suggestions Dropdown */}
                  {showHomeSuggestions && homeTeamSuggestions.length > 0 && (
                    <div className="absolute z-20 top-12 left-0 right-0 bg-white border border-warm-200 rounded-xl shadow-lg max-h-36 overflow-y-auto">
                      <div className="px-3 py-1.5 text-[10px] font-semibold text-warm-400 uppercase tracking-wider border-b border-warm-100">
                        Your Teams
                      </div>
                      {homeTeamSuggestions.map((team) => (
                        <button
                          key={team.id}
                          onClick={() => selectHomeTeamSuggestion(team)}
                          className="w-full flex items-center gap-2.5 px-3 py-2 text-left hover:bg-warm-50 transition-colors"
                        >
                          <div
                            className="w-7 h-7 rounded-lg flex items-center justify-center text-white text-xs font-bold shrink-0"
                            style={{ backgroundColor: team.color || '#DC2626' }}
                          >
                            {team.shortName ? team.shortName.slice(0, 2) : team.name.charAt(0).toUpperCase()}
                          </div>
                          <span className="text-sm text-warm-800 font-medium">{team.name}</span>
                          {team.shortName && (
                            <span className="text-[10px] text-warm-400 font-mono ml-auto">{team.shortName}</span>
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
                      className={`w-8 h-8 rounded-full transition-all ${
                        config.homeTeamColor === color ? 'ring-2 ring-offset-2 ring-warm-400 scale-110' : ''
                      }`}
                      style={{ backgroundColor: color }}
                    />
                  ))}
                </div>
              </div>

              {/* Away Team */}
              <div className="space-y-3">
                <label className="text-sm font-medium text-warm-700">Team B</label>
                <div className="relative">
                  <Input
                    placeholder="Enter team name"
                    value={config.awayTeam}
                    onChange={(e) => {
                      setConfig({ ...config, awayTeam: e.target.value });
                      setShowAwaySuggestions(true);
                    }}
                    onFocus={() => setShowAwaySuggestions(true)}
                    className="h-11 bg-white border-warm-300 rounded-xl"
                    style={{ borderColor: config.awayTeamColor }}
                  />
                  {/* Team Suggestions Dropdown */}
                  {showAwaySuggestions && awayTeamSuggestions.length > 0 && (
                    <div className="absolute z-20 top-12 left-0 right-0 bg-white border border-warm-200 rounded-xl shadow-lg max-h-36 overflow-y-auto">
                      <div className="px-3 py-1.5 text-[10px] font-semibold text-warm-400 uppercase tracking-wider border-b border-warm-100">
                        Your Teams
                      </div>
                      {awayTeamSuggestions.map((team) => (
                        <button
                          key={team.id}
                          onClick={() => selectAwayTeamSuggestion(team)}
                          className="w-full flex items-center gap-2.5 px-3 py-2 text-left hover:bg-warm-50 transition-colors"
                        >
                          <div
                            className="w-7 h-7 rounded-lg flex items-center justify-center text-white text-xs font-bold shrink-0"
                            style={{ backgroundColor: team.color || '#1E293B' }}
                          >
                            {team.shortName ? team.shortName.slice(0, 2) : team.name.charAt(0).toUpperCase()}
                          </div>
                          <span className="text-sm text-warm-800 font-medium">{team.name}</span>
                          {team.shortName && (
                            <span className="text-[10px] text-warm-400 font-mono ml-auto">{team.shortName}</span>
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
                      className={`w-8 h-8 rounded-full transition-all ${
                        config.awayTeamColor === color ? 'ring-2 ring-offset-2 ring-warm-400 scale-110' : ''
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
              <h2 className="text-lg font-bold text-warm-800">Add Players</h2>

              {/* Team Toggle */}
              <div className="flex gap-2">
                <button
                  onClick={() => setActiveLineupTeam('home')}
                  className={`flex-1 py-2 rounded-xl text-sm font-medium transition-all ${
                    activeLineupTeam === 'home'
                      ? 'text-white'
                      : 'bg-warm-200 text-warm-600'
                  }`}
                  style={activeLineupTeam === 'home' ? { backgroundColor: config.homeTeamColor } : {}}
                >
                  {config.homeTeam || 'Team A'} ({config.homeLineup.length})
                </button>
                <button
                  onClick={() => setActiveLineupTeam('away')}
                  className={`flex-1 py-2 rounded-xl text-sm font-medium transition-all ${
                    activeLineupTeam === 'away'
                      ? 'text-white'
                      : 'bg-warm-200 text-warm-600'
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
                    className="pl-9 pr-9 h-11 bg-white border-warm-300 rounded-xl text-sm"
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
                  <div className="bg-white border border-warm-200 rounded-xl shadow-lg max-h-56 overflow-y-auto divide-y divide-warm-100">
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
                                ? 'opacity-50 cursor-not-allowed bg-warm-50'
                                : 'hover:bg-warm-50 active:bg-warm-100'
                            }`}
                          >
                            <div className="w-9 h-9 rounded-full bg-warm-200 flex items-center justify-center text-xs font-bold text-warm-600 overflow-hidden shrink-0">
                              {p.avatar ? (
                                <img src={p.avatar} alt={p.name || ''} className="w-full h-full object-cover" />
                              ) : (
                                (p.name || '?').charAt(0).toUpperCase()
                              )}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-warm-800 truncate">
                                {highlightMatch(p.name || 'Unknown', playerSearch)}
                              </p>
                              <div className="flex items-center gap-2">
                                {p.playerCode && (
                                  <span className="text-[10px] font-mono font-semibold text-brand-teal bg-brand-teal/10 px-1.5 py-0.5 rounded">
                                    {highlightMatch(p.playerCode, playerSearch)}
                                  </span>
                                )}
                                {p.phone && (
                                  <span className="text-[10px] text-warm-400">{p.phone}</span>
                                )}
                                {p.profile?.position && (
                                  <span className="text-[10px] text-warm-500 bg-warm-100 px-1.5 py-0.5 rounded">
                                    {p.profile.position}
                                  </span>
                                )}
                              </div>
                            </div>
                            {alreadyAdded ? (
                              <Badge className="bg-brand-green/10 text-brand-green text-[9px] border-0">Added</Badge>
                            ) : (
                              <div className="w-7 h-7 rounded-full bg-brand-teal/10 flex items-center justify-center">
                                <Plus className="w-3.5 h-3.5 text-brand-teal" />
                              </div>
                            )}
                          </button>
                        );
                      })
                    ) : !isSearching && playerSearch.trim() ? (
                      <div className="px-3 py-4 text-center">
                        <p className="text-sm text-warm-500">No player found for &quot;{playerSearch}&quot;</p>
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
                        <Database className="w-6 h-6 text-warm-300 mx-auto mb-1" />
                        <p className="text-xs text-warm-400">No players in database yet</p>
                        <p className="text-[10px] text-warm-400">Type a name to quick-add a new player</p>
                      </div>
                    ) : null}

                    {/* Quick add option when there are results but no exact match */}
                    {searchResults.length > 0 && playerSearch.trim() && !searchResults.some(
                      p => p.name?.toLowerCase() === playerSearch.trim().toLowerCase()
                    ) && (
                      <button
                        onClick={() => addQuickPlayer(activeLineupTeam)}
                        className="w-full flex items-center gap-3 p-3 text-left hover:bg-brand-red/5 active:bg-brand-red/10 transition-colors border-t-2 border-dashed border-warm-200"
                      >
                        <div className="w-9 h-9 rounded-full bg-brand-red/10 flex items-center justify-center shrink-0">
                          <UserPlus className="w-4 h-4 text-brand-red" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-brand-red">
                            Quick add &quot;{playerSearch.trim()}&quot;
                          </p>
                          <p className="text-[10px] text-warm-400">Add as new player (not in database)</p>
                        </div>
                      </button>
                    )}
                  </div>
                )}
              </div>

              {/* Player Tokens */}
              <div className="flex flex-wrap gap-2 min-h-[60px]">
                {(activeLineupTeam === 'home' ? config.homeLineup : config.awayLineup).length === 0 ? (
                  <div className="w-full text-center py-8 text-warm-400 text-sm">
                    No players added yet
                  </div>
                ) : (
                  (activeLineupTeam === 'home' ? config.homeLineup : config.awayLineup).map((player) => (
                    <motion.div
                      key={player.id}
                      initial={{ scale: 0.8, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      className="flex items-center gap-1.5 bg-warm-200 rounded-full px-3 py-1.5"
                    >
                      <span
                        className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold text-white"
                        style={{
                          backgroundColor:
                            activeLineupTeam === 'home' ? config.homeTeamColor : config.awayTeamColor,
                        }}
                      >
                        {player.jerseyNumber}
                      </span>
                      <span className="text-sm text-warm-700">{player.name}</span>
                      {player.playerCode && (
                        <span className="text-[9px] font-mono text-brand-teal bg-brand-teal/10 px-1 rounded">
                          {player.playerCode}
                        </span>
                      )}
                      <button
                        onClick={() => removePlayer(activeLineupTeam, player.id)}
                        className="ml-1 text-warm-400 hover:text-brand-red"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </motion.div>
                  ))
                )}
              </div>
            </div>
          )}

          {step === 4 && (
            <div className="space-y-5">
              <h2 className="text-lg font-bold text-warm-800">Match Summary</h2>

              <div className="bg-white rounded-2xl border border-warm-300 p-5 space-y-4">
                <div className="text-center">
                  <span
                    className={`inline-block px-3 py-1 rounded-full text-xs font-medium ${
                      config.gender === 'male'
                        ? 'bg-brand-blue/10 text-brand-blue'
                        : 'bg-brand-red/10 text-brand-red'
                    }`}
                  >
                    {config.gender === 'male' ? '♂ Boys Match' : '♀ Girls Match'}
                  </span>
                </div>

                <div className="flex items-center justify-between">
                  <div className="text-center flex-1">
                    <div
                      className="w-14 h-14 rounded-full mx-auto flex items-center justify-center text-white font-bold text-lg"
                      style={{ backgroundColor: config.homeTeamColor }}
                    >
                      {config.homeTeam.charAt(0).toUpperCase()}
                    </div>
                    <div className="font-bold text-warm-800 mt-2">{config.homeTeam}</div>
                    <div className="text-xs text-warm-500">{config.homeLineup.length} players</div>
                  </div>
                  <div className="text-warm-400 font-bold text-lg">VS</div>
                  <div className="text-center flex-1">
                    <div
                      className="w-14 h-14 rounded-full mx-auto flex items-center justify-center text-white font-bold text-lg"
                      style={{ backgroundColor: config.awayTeamColor }}
                    >
                      {config.awayTeam.charAt(0).toUpperCase()}
                    </div>
                    <div className="font-bold text-warm-800 mt-2">{config.awayTeam}</div>
                    <div className="text-xs text-warm-500">{config.awayLineup.length} players</div>
                  </div>
                </div>

                <div className="border-t border-warm-200 pt-3 space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-warm-500">Format</span>
                    <span className="text-warm-800 font-medium">
                      {config.playersPerSide}v{config.playersPerSide} · {config.halfDuration}min
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-warm-500">Type</span>
                    <span className="text-warm-800 font-medium">
                      🏋️ Practice
                    </span>
                  </div>
                </div>
              </div>

              <Button
                onClick={handleStart}
                className="w-full h-14 bg-brand-red hover:bg-brand-red-dark text-white rounded-2xl font-bold text-lg shadow-lg shadow-brand-red/30"
              >
                🏐 Start Match!
              </Button>
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
              className="rounded-xl h-11 border-warm-300"
            >
              <ChevronLeft className="w-4 h-4 mr-1" />
              Back
            </Button>
          )}
          <Button
            onClick={handleNext}
            disabled={!canNext()}
            className="flex-1 h-11 bg-brand-red hover:bg-brand-red-dark text-white rounded-xl font-semibold"
          >
            Next
            <ChevronRight className="w-4 h-4 ml-1" />
          </Button>
        </div>
      )}
    </div>
  );
}
