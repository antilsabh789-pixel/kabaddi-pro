'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Plus, MapPin, Calendar, Users, ChevronDown, ChevronUp, Trophy, Crown,
  Lock, Loader2, Search, X, Copy, Check, Hash, UserPlus, Trash2, Swords,
  Sparkles, Timer, Filter, TrendingUp, Clock, Zap, CalendarDays, LayoutGrid,
  ChevronRight, Star, ArrowRight, CircleDot, Radio, Award, Target
} from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useKabaddiStore } from '@/lib/store';
import { useToast } from '@/hooks/use-toast';
import PremiumUpgradeScreen from './PremiumUpgradeScreen';

interface TeamInTournament {
  id: string;
  name: string;
  shortName?: string;
  teamCode?: string;
  color: string;
  logo?: string;
  played: number;
  won: number;
  lost: number;
  drawn: number;
  scoreDiff: number;
  points: number;
}

interface Tournament {
  id: string;
  name: string;
  tournamentCode?: string;
  type: string;
  venue: string;
  startDate: string | null;
  endDate: string | null;
  status: string;
  gender: string;
  teams: TeamInTournament[];
  matchCount: number;
  organizerId?: string;
}

interface DbTeam {
  id: string;
  name: string;
  shortName: string | null;
  teamCode: string | null;
  color: string | null;
  logo: string | null;
}

// ─── Bracket Match for visual bracket view ─────────────────────────────
interface BracketMatch {
  id: string;
  round: number;
  position: number;
  team1Id: string | null;
  team2Id: string | null;
  team1Score: number | null;
  team2Score: number | null;
  winnerId: string | null;
  status: string;
}

// ─── Sub-components ────────────────────────────────────────────────────

/** Animated status indicator dot */
function StatusIndicator({ status }: { status: string }) {
  const config = {
    ongoing: { color: 'bg-emerald-500', ring: 'ring-emerald-500/30', pulse: true },
    upcoming: { color: 'bg-amber-500', ring: 'ring-amber-500/30', pulse: false },
    past: { color: 'bg-warm-400', ring: 'ring-warm-400/30', pulse: false },
  }[status] || { color: 'bg-warm-400', ring: 'ring-warm-400/30', pulse: false };

  return (
    <span className="relative flex h-3 w-3">
      {config.pulse && (
        <span className={`animate-ping absolute inline-flex h-full w-full rounded-full ${config.color} opacity-75`} />
      )}
      <span className={`relative inline-flex rounded-full h-3 w-3 ${config.color} ring-2 ${config.ring}`} />
    </span>
  );
}

/** Match progress bar */
function MatchProgressBar({ completed, total }: { completed: number; total: number }) {
  const pct = total > 0 ? Math.round((completed / total) * 100) : 0;
  return (
    <div className="flex items-center gap-2 w-full">
      <div className="flex-1 h-2 bg-warm-200 dark:bg-warm-700 rounded-full overflow-hidden">
        <motion.div
          className="h-full rounded-full bg-gradient-to-r from-brand-gold to-brand-gold-light"
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.8, ease: 'easeOut' }}
        />
      </div>
      <span className="text-[10px] font-bold text-warm-500 dark:text-warm-400 shrink-0">{completed}/{total}</span>
    </div>
  );
}

/** Shimmer overlay for hover effect */
function ShimmerOverlay() {
  return (
    <motion.div
      className="absolute inset-0 pointer-events-none z-10 overflow-hidden rounded-2xl"
      initial={{ opacity: 0 }}
      whileHover={{ opacity: 1 }}
    >
      <motion.div
        className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent dark:via-white/5"
        animate={{ x: ['-100%', '200%'] }}
        transition={{ duration: 2, ease: 'linear' }}
      />
    </motion.div>
  );
}

/** Knockout bracket view */
function BracketView({ tournament }: { tournament: Tournament }) {
  const [bracketMatches, setBracketMatches] = useState<BracketMatch[]>([]);
  const [loadingBracket, setLoadingBracket] = useState(false);

  useEffect(() => {
    const fetchBracket = async () => {
      setLoadingBracket(true);
      try {
        const res = await fetch(`/api/tournaments/${tournament.id}/matches`);
        if (res.ok) {
          const data = await res.json();
          const matches: BracketMatch[] = (data.matches || []).map((m: Record<string, unknown>) => ({
            id: m.id as string,
            round: (m.round as number) || 1,
            position: (m.position as number) || 0,
            team1Id: (m.team1Id as string) || null,
            team2Id: (m.team2Id as string) || null,
            team1Score: (m.team1Score as number) ?? null,
            team2Score: (m.team2Score as number) ?? null,
            winnerId: (m.winnerId as string) || null,
            status: (m.status as string) || 'scheduled',
          }));
          setBracketMatches(matches);
        }
      } catch {
        // silently fail
      } finally {
        setLoadingBracket(false);
      }
    };
    fetchBracket();
  }, [tournament.id]);

  const teamsMap = new Map(tournament.teams.map(t => [t.id, t]));

  // Group matches by round
  const rounds = new Map<number, BracketMatch[]>();
  bracketMatches.forEach(m => {
    const list = rounds.get(m.round) || [];
    list.push(m);
    rounds.set(m.round, list);
  });
  const sortedRounds = Array.from(rounds.entries()).sort((a, b) => a[0] - b[0]);

  // If knockout with no matches yet, show placeholder bracket
  const showPlaceholder = bracketMatches.length === 0 && !loadingBracket;

  // Generate placeholder bracket based on team count
  const generatePlaceholderRounds = () => {
    const teamCount = tournament.teams.length;
    if (teamCount < 2) return [];
    const roundsCount = Math.ceil(Math.log2(teamCount));
    const result: { round: number; matches: { team1: string | null; team2: string | null }[] }[] = [];
    let currentMatches = Math.floor(teamCount / 2);

    for (let r = 1; r <= roundsCount; r++) {
      const matches = [];
      for (let m = 0; m < currentMatches; m++) {
        const team1Idx = m * 2;
        const team2Idx = m * 2 + 1;
        matches.push({
          team1: tournament.teams[team1Idx]?.id || null,
          team2: team2Idx < tournament.teams.length ? tournament.teams[team2Idx]?.id || null : null,
        });
      }
      result.push({ round: r, matches });
      currentMatches = Math.ceil(currentMatches / 2);
    }
    return result;
  };

  const placeholderRounds = showPlaceholder ? generatePlaceholderRounds() : [];

  const getRoundName = (round: number, totalRounds: number) => {
    if (round === totalRounds) return 'Final';
    if (round === totalRounds - 1) return 'Semi-Final';
    if (round === totalRounds - 2) return 'Quarter-Final';
    return `Round ${round}`;
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: 'easeOut' }}
    >
      <div className="flex items-center gap-2 mb-3">
        <Swords className="w-4 h-4 text-brand-red" />
        <h4 className="text-xs font-bold text-warm-500 dark:text-warm-400 uppercase tracking-wider">
          {tournament.type === 'knockout' ? 'Knockout Bracket' : tournament.type === 'league' ? 'League Fixtures' : 'Tournament Bracket'}
        </h4>
      </div>

      {loadingBracket ? (
        <div className="flex items-center justify-center py-8 gap-2">
          <Loader2 className="w-5 h-5 animate-spin text-brand-red" />
          <span className="text-sm text-warm-400">Loading bracket...</span>
        </div>
      ) : (
        <div className="overflow-x-auto pb-2 -mx-1">
          <div className="flex gap-6 min-w-max px-1">
            {/* Real bracket from API data */}
            {sortedRounds.length > 0 ? sortedRounds.map(([roundNum, matches], rIdx) => {
              const totalRounds = sortedRounds.length;
              return (
                <motion.div
                  key={roundNum}
                  className="flex flex-col gap-3 min-w-[180px]"
                  initial={{ opacity: 0, x: 30 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: rIdx * 0.15, duration: 0.4 }}
                >
                  <div className="text-center">
                    <Badge className="bg-brand-red/10 text-brand-red text-[10px] border-0 font-bold">
                      {getRoundName(roundNum, totalRounds)}
                    </Badge>
                  </div>
                  <div className="flex flex-col justify-around flex-1 gap-2">
                    {matches.sort((a, b) => a.position - b.position).map((match) => {
                      const team1 = match.team1Id ? teamsMap.get(match.team1Id) : null;
                      const team2 = match.team2Id ? teamsMap.get(match.team2Id) : null;
                      const isLive = match.status === 'live' || match.status === 'ongoing';
                      const isCompleted = match.status === 'completed';
                      return (
                        <motion.div
                          key={match.id}
                          className={`rounded-xl border p-2.5 text-xs transition-all ${
                            isLive
                              ? 'border-brand-red bg-brand-red/5 dark:bg-brand-red/10 ring-1 ring-brand-red/30'
                              : isCompleted
                                ? 'border-warm-200 dark:border-warm-700 bg-white dark:bg-warm-800/50'
                                : 'border-warm-200 dark:border-warm-700 bg-white dark:bg-warm-800/30'
                          }`}
                          initial={{ opacity: 0, scale: 0.9 }}
                          animate={{ opacity: 1, scale: 1 }}
                          transition={{ delay: rIdx * 0.1 + 0.1 }}
                        >
                          {isLive && (
                            <div className="flex items-center gap-1 mb-1">
                              <Radio className="w-2.5 h-2.5 text-brand-red animate-pulse" />
                              <span className="text-[9px] font-bold text-brand-red uppercase">Live</span>
                            </div>
                          )}
                          {/* Team 1 */}
                          <div className={`flex items-center gap-2 py-1 ${match.winnerId === match.team1Id ? 'font-bold' : ''}`}>
                            {team1 ? (
                              <>
                                <div className="w-5 h-5 rounded-md flex items-center justify-center text-[8px] font-bold text-white shrink-0" style={{ backgroundColor: team1.color }}>
                                  {team1.shortName?.charAt(0) || team1.name.charAt(0)}
                                </div>
                                <span className={`truncate flex-1 ${match.winnerId === match.team1Id ? 'text-warm-800 dark:text-warm-100' : 'text-warm-600 dark:text-warm-300'}`}>
                                  {team1.name}
                                </span>
                              </>
                            ) : (
                              <span className="text-warm-400 italic">TBD</span>
                            )}
                            {match.team1Score !== null && (
                              <span className={`font-mono font-bold ${match.winnerId === match.team1Id ? 'text-brand-green' : 'text-warm-500'}`}>
                                {match.team1Score}
                              </span>
                            )}
                          </div>
                          <div className="border-t border-warm-100 dark:border-warm-700/50 my-0.5" />
                          {/* Team 2 */}
                          <div className={`flex items-center gap-2 py-1 ${match.winnerId === match.team2Id ? 'font-bold' : ''}`}>
                            {team2 ? (
                              <>
                                <div className="w-5 h-5 rounded-md flex items-center justify-center text-[8px] font-bold text-white shrink-0" style={{ backgroundColor: team2.color }}>
                                  {team2.shortName?.charAt(0) || team2.name.charAt(0)}
                                </div>
                                <span className={`truncate flex-1 ${match.winnerId === match.team2Id ? 'text-warm-800 dark:text-warm-100' : 'text-warm-600 dark:text-warm-300'}`}>
                                  {team2.name}
                                </span>
                              </>
                            ) : (
                              <span className="text-warm-400 italic">TBD</span>
                            )}
                            {match.team2Score !== null && (
                              <span className={`font-mono font-bold ${match.winnerId === match.team2Id ? 'text-brand-green' : 'text-warm-500'}`}>
                                {match.team2Score}
                              </span>
                            )}
                          </div>
                          {match.winnerId && (
                            <div className="flex items-center gap-1 mt-1 pt-1 border-t border-warm-100 dark:border-warm-700/30">
                              <Trophy className="w-2.5 h-2.5 text-brand-gold" />
                              <span className="text-[9px] text-brand-gold font-bold">
                                {teamsMap.get(match.winnerId)?.name || 'Winner'}
                              </span>
                            </div>
                          )}
                        </motion.div>
                      );
                    })}
                  </div>
                </motion.div>
              );
            }) : null}

            {/* Placeholder bracket */}
            {placeholderRounds.length > 0 ? placeholderRounds.map((round, rIdx) => {
              const totalRounds = placeholderRounds.length;
              return (
                <motion.div
                  key={`placeholder-${round.round}`}
                  className="flex flex-col gap-3 min-w-[160px]"
                  initial={{ opacity: 0, x: 30 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: rIdx * 0.15, duration: 0.4 }}
                >
                  <div className="text-center">
                    <Badge className="bg-warm-200 dark:bg-warm-700 text-warm-500 dark:text-warm-400 text-[10px] border-0 font-bold">
                      {getRoundName(round.round, totalRounds)}
                    </Badge>
                  </div>
                  <div className="flex flex-col justify-around flex-1 gap-2">
                    {round.matches.map((match, mIdx) => {
                      const team1 = match.team1 ? teamsMap.get(match.team1) : null;
                      const team2 = match.team2 ? teamsMap.get(match.team2) : null;
                      return (
                        <div key={mIdx} className="rounded-xl border border-dashed border-warm-300 dark:border-warm-600 p-2.5 text-xs bg-warm-50 dark:bg-warm-800/20">
                          <div className="flex items-center gap-2 py-0.5">
                            {team1 ? (
                              <>
                                <div className="w-5 h-5 rounded-md flex items-center justify-center text-[8px] font-bold text-white shrink-0" style={{ backgroundColor: team1.color }}>
                                  {team1.shortName?.charAt(0) || team1.name.charAt(0)}
                                </div>
                                <span className="truncate text-warm-500 dark:text-warm-400">{team1.name}</span>
                              </>
                            ) : (
                              <span className="text-warm-400 italic">TBD</span>
                            )}
                          </div>
                          <div className="text-warm-300 dark:text-warm-600 text-center py-0.5 text-[10px]">VS</div>
                          <div className="flex items-center gap-2 py-0.5">
                            {team2 ? (
                              <>
                                <div className="w-5 h-5 rounded-md flex items-center justify-center text-[8px] font-bold text-white shrink-0" style={{ backgroundColor: team2.color }}>
                                  {team2.shortName?.charAt(0) || team2.name.charAt(0)}
                                </div>
                                <span className="truncate text-warm-500 dark:text-warm-400">{team2.name}</span>
                              </>
                            ) : (
                              <span className="text-warm-400 italic">BYE</span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </motion.div>
              );
            }) : null}

            {/* No data at all */}
            {sortedRounds.length === 0 && placeholderRounds.length === 0 && !loadingBracket && (
              <div className="text-center py-6 w-full">
                <Target className="w-8 h-8 text-warm-300 dark:text-warm-600 mx-auto mb-2" />
                <p className="text-sm text-warm-400 dark:text-warm-500">No bracket generated yet</p>
                <p className="text-[10px] text-warm-400 dark:text-warm-500 mt-1">Add teams and generate a bracket to see the tournament tree</p>
              </div>
            )}
          </div>
        </div>
      )}
    </motion.div>
  );
}

/** Skeleton loader with shimmer */
function SkeletonCard() {
  return (
    <div className="relative overflow-hidden rounded-2xl bg-white dark:bg-warm-800/50 border border-warm-200 dark:border-warm-700">
      <div className="absolute left-0 top-0 bottom-0 w-1 bg-warm-200 dark:bg-warm-700" />
      <div className="p-4 space-y-3">
        <div className="flex items-start justify-between">
          <div className="space-y-2 flex-1">
            <div className="h-4 w-3/4 rounded-lg bg-warm-200 dark:bg-warm-700" />
            <div className="h-3 w-1/2 rounded-lg bg-warm-100 dark:bg-warm-700/50" />
            <div className="h-3 w-2/3 rounded-lg bg-warm-100 dark:bg-warm-700/50" />
          </div>
          <div className="h-6 w-14 rounded-md bg-warm-200 dark:bg-warm-700" />
        </div>
        <div className="flex items-center justify-between">
          <div className="flex -space-x-1.5">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="w-7 h-7 rounded-full bg-warm-200 dark:bg-warm-700 border-2 border-white dark:border-warm-800" />
            ))}
          </div>
          <div className="h-2 w-20 rounded-full bg-warm-200 dark:bg-warm-700" />
        </div>
      </div>
      {/* Shimmer effect */}
      <div className="absolute inset-0">
        <motion.div
          className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 dark:via-white/5 to-transparent"
          animate={{ x: ['-100%', '200%'] }}
          transition={{ duration: 1.5, repeat: Infinity, ease: 'linear' }}
        />
      </div>
    </div>
  );
}

/** Beautiful empty state */
function EmptyState({ content, onCta }: { content: { icon: string; title: string; description: string; cta: string | null }; onCta: () => void }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="py-8"
    >
      <Card className="p-8 text-center border-warm-200 dark:border-warm-700 bg-white dark:bg-warm-800/50 overflow-hidden relative">
        {/* Decorative background */}
        <div className="absolute inset-0 opacity-5 dark:opacity-10">
          <div className="absolute top-4 left-4 w-16 h-16 rounded-full bg-brand-red blur-2xl" />
          <div className="absolute bottom-4 right-4 w-20 h-20 rounded-full bg-brand-gold blur-2xl" />
        </div>
        <div className="relative">
          <motion.div
            animate={{ y: [0, -6, 0] }}
            transition={{ duration: 2.5, repeat: Infinity, ease: 'easeInOut' }}
            className="text-6xl mb-4 inline-block"
          >
            {content.icon}
          </motion.div>
          <motion.h3
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.2 }}
            className="text-warm-700 dark:text-warm-200 text-base font-bold"
          >
            {content.title}
          </motion.h3>
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3 }}
            className="text-warm-400 dark:text-warm-500 text-sm mt-1.5 max-w-xs mx-auto"
          >
            {content.description}
          </motion.p>
          {content.cta && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
            >
              <Button
                onClick={onCta}
                className="mt-5 bg-gradient-to-r from-brand-red to-brand-red-light text-white rounded-xl font-bold shadow-lg shadow-brand-red/20"
              >
                <Plus className="w-4 h-4 mr-1.5" />
                {content.cta}
                <ArrowRight className="w-4 h-4 ml-1.5" />
              </Button>
            </motion.div>
          )}
        </div>
      </Card>
    </motion.div>
  );
}

// ─── Main Component ────────────────────────────────────────────────────

export default function TournamentsTab() {
  const { currentUser } = useKabaddiStore();
  const { toast } = useToast();
  const isPremium = currentUser?.isPremium || false;

  const [statusFilter, setStatusFilter] = useState<'ongoing' | 'upcoming' | 'past'>('ongoing');
  const [genderFilter, setGenderFilter] = useState<'all' | 'male' | 'female'>('all');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [showUpgrade, setShowUpgrade] = useState(false);
  const [generatingBracket, setGeneratingBracket] = useState(false);

  // Tournament search by code
  const [tournamentSearch, setTournamentSearch] = useState('');
  const [searchFocused, setSearchFocused] = useState(false);
  const [recentSearches, setRecentSearches] = useState<string[]>([]);

  // Host tournament step
  const [hostStep, setHostStep] = useState(0);

  // New tournament form
  const [newTournament, setNewTournament] = useState({
    name: '',
    venue: '',
    gender: 'male',
    type: 'knockout',
  });

  // Add teams to tournament
  const [addTeamDialogOpen, setAddTeamDialogOpen] = useState<string | null>(null);
  const [teamSearch, setTeamSearch] = useState('');
  const [teamSearchResults, setTeamSearchResults] = useState<DbTeam[]>([]);
  const [isSearchingTeams, setIsSearchingTeams] = useState(false);
  const [allTeams, setAllTeams] = useState<DbTeam[]>([]);
  const [selectedTeamIds, setSelectedTeamIds] = useState<string[]>([]);
  const [addingTeams, setAddingTeams] = useState(false);
  const teamInputRef = useRef<HTMLDivElement>(null);

  // Remove team confirmation
  const [removeTeamId, setRemoveTeamId] = useState<string | null>(null);
  const [removingTeam, setRemovingTeam] = useState(false);

  // Copy code feedback
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  useEffect(() => {
    fetchTournaments();
  }, [statusFilter, genderFilter]);

  // Fetch all teams on mount for instant filtering
  useEffect(() => {
    const fetchAllTeams = async () => {
      try {
        const res = await fetch('/api/teams?limit=100');
        if (res.ok) {
          const data = await res.json();
          setAllTeams(data.teams || []);
        }
      } catch {
        // silently fail
      }
    };
    fetchAllTeams();
  }, []);

  // Load recent searches from localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem('tournament-recent-searches');
      if (saved) setRecentSearches(JSON.parse(saved));
    } catch {
      // ignore
    }
  }, []);

  // Close team suggestions when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (teamInputRef.current && !teamInputRef.current.contains(e.target as Node)) {
        setTeamSearchResults([]);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const fetchTournaments = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (statusFilter) params.set('status', statusFilter);
      if (genderFilter && genderFilter !== 'all') params.set('gender', genderFilter);
      if (tournamentSearch.trim()) params.set('search', tournamentSearch.trim());

      const res = await fetch(`/api/tournaments?${params}`);
      if (res.ok) {
        const data = await res.json();
        setTournaments(data.tournaments || []);
      }
    } catch {
      setTournaments([]);
    } finally {
      setLoading(false);
    }
  }, [statusFilter, genderFilter, tournamentSearch]);

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchTournaments();
    }, 300);
    return () => clearTimeout(timer);
  }, [tournamentSearch]);

  const handleCreateClick = () => {
    if (!isPremium) {
      setShowUpgrade(true);
      return;
    }
    setHostStep(0);
    setCreateOpen(true);
  };

  const handleCreateTournament = async () => {
    try {
      const res = await fetch('/api/tournaments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...newTournament,
          organizerId: currentUser?.id,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        toast({
          title: 'Tournament Created!',
          description: `Code: ${data.tournament?.tournamentCode || 'N/A'}`,
        });
        setCreateOpen(false);
        setHostStep(0);
        fetchTournaments();
      } else {
        const data = await res.json();
        toast({ title: 'Error', description: data.error, variant: 'destructive' });
      }
    } catch {
      toast({ title: 'Error', description: 'Failed to create tournament', variant: 'destructive' });
    }
    setNewTournament({ name: '', venue: '', gender: 'male', type: 'knockout' });
  };

  const handleGenerateBracket = async (tournamentId: string, teamIds: string[]) => {
    setGeneratingBracket(true);
    try {
      const res = await fetch('/api/tournaments/generate-bracket', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tournamentId, teamIds }),
      });
      if (res.ok) {
        const data = await res.json();
        toast({
          title: 'Bracket Generated!',
          description: `${data.matchCount} matches scheduled`,
        });
        fetchTournaments();
      } else {
        const data = await res.json();
        toast({ title: 'Error', description: data.error || 'Failed to generate bracket', variant: 'destructive' });
      }
    } catch {
      toast({ title: 'Error', description: 'Failed to generate bracket', variant: 'destructive' });
    } finally {
      setGeneratingBracket(false);
    }
  };

  // Search teams for adding to tournament
  const getFilteredTeams = useCallback((query: string): DbTeam[] => {
    if (!query.trim()) return allTeams.slice(0, 20);
    const q = query.toLowerCase().trim();
    return allTeams.filter(t =>
      t.name.toLowerCase().includes(q) ||
      (t.teamCode && t.teamCode.toLowerCase().includes(q)) ||
      (t.shortName && t.shortName.toLowerCase().includes(q))
    ).slice(0, 20);
  }, [allTeams]);

  useEffect(() => {
    if (!addTeamDialogOpen) return;
    const timer = setTimeout(async () => {
      const localResults = getFilteredTeams(teamSearch);
      setTeamSearchResults(localResults);

      if (teamSearch.length >= 2) {
        setIsSearchingTeams(true);
        try {
          const res = await fetch(`/api/teams?search=${encodeURIComponent(teamSearch)}`);
          if (res.ok) {
            const data = await res.json();
            const serverTeams: DbTeam[] = data.teams || [];
            const serverIds = new Set(serverTeams.map(t => t.id));
            const merged = [...serverTeams, ...localResults.filter(t => !serverIds.has(t.id))].slice(0, 20);
            setTeamSearchResults(merged);
          }
        } catch {
          // keep local results
        } finally {
          setIsSearchingTeams(false);
        }
      }
    }, 200);
    return () => clearTimeout(timer);
  }, [teamSearch, addTeamDialogOpen, getFilteredTeams]);

  const openAddTeamDialog = (tournamentId: string) => {
    const tournament = tournaments.find(t => t.id === tournamentId);
    setSelectedTeamIds([]);
    setTeamSearch('');
    setTeamSearchResults(getFilteredTeams(''));
    setAddTeamDialogOpen(tournamentId);
  };

  const handleAddTeams = async () => {
    if (!addTeamDialogOpen || selectedTeamIds.length === 0) return;
    setAddingTeams(true);
    try {
      const res = await fetch(`/api/tournaments/${addTeamDialogOpen}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ addTeamIds: selectedTeamIds }),
      });
      if (res.ok) {
        const data = await res.json();
        toast({
          title: 'Teams Added!',
          description: data.message || `${selectedTeamIds.length} team(s) added to tournament`,
        });
        setAddTeamDialogOpen(null);
        setSelectedTeamIds([]);
        fetchTournaments();
      } else {
        const data = await res.json();
        toast({ title: 'Error', description: data.error, variant: 'destructive' });
      }
    } catch {
      toast({ title: 'Error', description: 'Failed to add teams', variant: 'destructive' });
    } finally {
      setAddingTeams(false);
    }
  };

  const handleRemoveTeam = async (tournamentId: string, teamId: string) => {
    setRemovingTeam(true);
    try {
      const res = await fetch(`/api/tournaments/${tournamentId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ removeTeamIds: [teamId] }),
      });
      if (res.ok) {
        toast({ title: 'Team Removed', description: 'Team removed from tournament' });
        setRemoveTeamId(null);
        fetchTournaments();
      } else {
        const data = await res.json();
        toast({ title: 'Error', description: data.error, variant: 'destructive' });
      }
    } catch {
      toast({ title: 'Error', description: 'Failed to remove team', variant: 'destructive' });
    } finally {
      setRemovingTeam(false);
    }
  };

  const copyToClipboard = async (code: string) => {
    try {
      await navigator.clipboard.writeText(code);
      setCopiedCode(code);
      toast({ title: 'Copied!', description: `Code ${code} copied to clipboard` });
      setTimeout(() => setCopiedCode(null), 2000);
    } catch {
      // fallback
    }
  };

  const handleSearchSubmit = (query: string) => {
    if (!query.trim()) return;
    setRecentSearches(prev => {
      const updated = [query, ...prev.filter(s => s !== query)].slice(0, 5);
      try { localStorage.setItem('tournament-recent-searches', JSON.stringify(updated)); } catch { /* ignore */ }
      return updated;
    });
    setTournamentSearch(query);
    setSearchFocused(false);
  };

  const filteredTournaments = tournaments.filter((t) => {
    if (t.status !== statusFilter) return false;
    if (genderFilter !== 'all' && t.gender !== genderFilter) return false;
    if (typeFilter !== 'all' && t.type !== typeFilter) return false;
    return true;
  });

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

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return 'TBD';
    try {
      const date = new Date(dateStr);
      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    } catch {
      return dateStr;
    }
  };

  // Tournament type badge styling
  const getTypeBadge = (type: string) => {
    switch (type) {
      case 'knockout':
        return { bg: 'bg-orange-500/10 dark:bg-orange-500/20', text: 'text-orange-600 dark:text-orange-400', icon: <Swords className="w-3 h-3" />, border: 'border-orange-500/30', gradient: 'from-orange-500 to-orange-400' };
      case 'league':
        return { bg: 'bg-emerald-500/10 dark:bg-emerald-500/20', text: 'text-emerald-600 dark:text-emerald-400', icon: <Trophy className="w-3 h-3" />, border: 'border-emerald-500/30', gradient: 'from-emerald-500 to-emerald-400' };
      case 'hybrid':
        return { bg: 'bg-purple-500/10 dark:bg-purple-500/20', text: 'text-purple-600 dark:text-purple-400', icon: <Sparkles className="w-3 h-3" />, border: 'border-purple-500/30', gradient: 'from-purple-500 to-purple-400' };
      default:
        return { bg: 'bg-warm-200 dark:bg-warm-700', text: 'text-warm-600 dark:text-warm-300', icon: <Trophy className="w-3 h-3" />, border: 'border-warm-400/30', gradient: 'from-warm-500 to-warm-400' };
    }
  };

  // Status-based gradient for left border
  const getStatusGradient = (status: string) => {
    switch (status) {
      case 'ongoing': return 'from-emerald-500 to-emerald-400';
      case 'upcoming': return 'from-amber-500 to-amber-400';
      case 'past': return 'from-warm-400 to-warm-300';
      default: return 'from-warm-400 to-warm-300';
    }
  };

  // Empty state content based on filter
  const getEmptyContent = () => {
    if (tournamentSearch.trim()) {
      return {
        icon: '🔍',
        title: 'No results found',
        description: `Try searching by tournament code like "TC3001"`,
        cta: null,
      };
    }
    switch (statusFilter) {
      case 'ongoing':
        return {
          icon: '🏟️',
          title: 'No ongoing tournaments right now',
          description: 'Check back later or create your own tournament',
          cta: isPremium ? 'Create Tournament' : null,
        };
      case 'upcoming':
        return {
          icon: '📅',
          title: 'No upcoming tournaments',
          description: 'Be the first to host one!',
          cta: isPremium ? 'Host Tournament' : null,
        };
      case 'past':
        return {
          icon: '🏆',
          title: 'No past tournaments yet',
          description: 'Completed tournaments will appear here',
          cta: null,
        };
      default:
        return {
          icon: '🏆',
          title: 'No tournaments found',
          description: '',
          cta: null,
        };
    }
  };

  // Count tournaments by status
  const statusCounts = {
    ongoing: tournaments.filter(t => t.status === 'ongoing').length,
    upcoming: tournaments.filter(t => t.status === 'upcoming').length,
    past: tournaments.filter(t => t.status === 'past').length,
  };

  // Host tournament steps config
  const hostSteps = [
    { label: 'Details', icon: Trophy },
    { label: 'Format', icon: LayoutGrid },
    { label: 'Review', icon: Star },
  ];

  return (
    <div className="px-4 py-6 space-y-5">
      {/* Premium Upgrade Modal */}
      {showUpgrade && (
        <PremiumUpgradeScreen
          onClose={() => setShowUpgrade(false)}
          feature="Host Tournaments"
        />
      )}

      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-warm-800 dark:text-warm-100 flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-brand-gold/20 flex items-center justify-center">
            <Trophy className="w-4 h-4 text-brand-gold" />
          </div>
          Tournaments
        </h1>
        <motion.div whileTap={{ scale: 0.95 }}>
          <Button
            onClick={handleCreateClick}
            className={`rounded-xl h-10 px-4 font-bold ${
              isPremium
                ? 'bg-gradient-to-r from-brand-red to-brand-red-light hover:from-brand-red-dark hover:to-brand-red text-white shadow-lg shadow-brand-red/20'
                : 'bg-gradient-to-r from-brand-gold-dark via-brand-gold to-brand-gold-light text-white hover:opacity-90 shadow-lg shadow-brand-gold/20'
            }`}
          >
            {isPremium ? (
              <>
                <Plus className="w-4 h-4 mr-1" />
                Create
              </>
            ) : (
              <>
                <Crown className="w-4 h-4 mr-1" />
                Host
                <Lock className="w-3 h-3 ml-1" />
              </>
            )}
          </Button>
        </motion.div>
      </div>

      {/* ─── Host Tournament Dialog (Step-by-step) ─────────────────── */}
      <Dialog open={createOpen} onOpenChange={(open) => { if (!open) { setCreateOpen(false); setHostStep(0); } }}>
        <DialogContent className="bg-warm-50 dark:bg-warm-900 border-warm-300 dark:border-warm-700 max-w-md">
          <DialogHeader>
            <DialogTitle className="text-warm-800 dark:text-warm-100 flex items-center gap-2">
              Host Tournament
              <Badge className="bg-brand-gold/20 text-brand-gold text-[10px] border-0">
                <Crown className="w-3 h-3 mr-1" />
                PRO
              </Badge>
            </DialogTitle>
          </DialogHeader>

          {/* Step Progress Indicator */}
          <div className="flex items-center gap-2 mb-4">
            {hostSteps.map((step, idx) => {
              const StepIcon = step.icon;
              const isActive = idx === hostStep;
              const isCompleted = idx < hostStep;
              return (
                <div key={idx} className="flex-1 flex flex-col items-center gap-1">
                  <motion.div
                    className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
                      isActive
                        ? 'bg-brand-red text-white shadow-lg shadow-brand-red/30'
                        : isCompleted
                          ? 'bg-brand-green text-white'
                          : 'bg-warm-200 dark:bg-warm-700 text-warm-500 dark:text-warm-400'
                    }`}
                    animate={{ scale: isActive ? 1.1 : 1 }}
                    transition={{ type: 'spring', stiffness: 300 }}
                  >
                    {isCompleted ? <Check className="w-4 h-4" /> : <StepIcon className="w-3.5 h-3.5" />}
                  </motion.div>
                  <span className={`text-[10px] font-bold ${isActive ? 'text-brand-red' : 'text-warm-400 dark:text-warm-500'}`}>
                    {step.label}
                  </span>
                </div>
              );
            })}
          </div>

          {/* Progress bar */}
          <div className="h-1 bg-warm-200 dark:bg-warm-700 rounded-full mb-4 overflow-hidden">
            <motion.div
              className="h-full bg-gradient-to-r from-brand-red to-brand-red-light rounded-full"
              animate={{ width: `${((hostStep + 1) / hostSteps.length) * 100}%` }}
              transition={{ duration: 0.3 }}
            />
          </div>

          <AnimatePresence mode="wait">
            {/* Step 1: Details */}
            {hostStep === 0 && (
              <motion.div
                key="step-0"
                initial={{ opacity: 0, x: 30 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -30 }}
                transition={{ duration: 0.2 }}
                className="space-y-4"
              >
                <div>
                  <label className="text-xs font-bold text-warm-600 dark:text-warm-300 mb-1.5 block">Tournament Name</label>
                  <Input
                    placeholder="e.g. Inter-School Kabaddi Championship"
                    value={newTournament.name}
                    onChange={(e) => setNewTournament({ ...newTournament, name: e.target.value })}
                    className="bg-white dark:bg-warm-800 border-warm-300 dark:border-warm-700 rounded-xl"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-warm-600 dark:text-warm-300 mb-1.5 block">Venue</label>
                  <Input
                    placeholder="e.g. City Sports Arena"
                    value={newTournament.venue}
                    onChange={(e) => setNewTournament({ ...newTournament, venue: e.target.value })}
                    className="bg-white dark:bg-warm-800 border-warm-300 dark:border-warm-700 rounded-xl"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-warm-600 dark:text-warm-300 mb-1.5 block">Category</label>
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      onClick={() => setNewTournament({ ...newTournament, gender: 'male' })}
                      className={`p-3 rounded-xl border-2 text-sm font-bold transition-all ${
                        newTournament.gender === 'male'
                          ? 'border-brand-red bg-brand-red/5 text-brand-red'
                          : 'border-warm-200 dark:border-warm-700 text-warm-600 dark:text-warm-400 hover:border-warm-300 dark:hover:border-warm-600'
                      }`}
                    >
                      ♂ Boys
                    </button>
                    <button
                      onClick={() => setNewTournament({ ...newTournament, gender: 'female' })}
                      className={`p-3 rounded-xl border-2 text-sm font-bold transition-all ${
                        newTournament.gender === 'female'
                          ? 'border-brand-red bg-brand-red/5 text-brand-red'
                          : 'border-warm-200 dark:border-warm-700 text-warm-600 dark:text-warm-400 hover:border-warm-300 dark:hover:border-warm-600'
                      }`}
                    >
                      ♀ Girls
                    </button>
                  </div>
                </div>
                <Button
                  onClick={() => setHostStep(1)}
                  disabled={!newTournament.name || !newTournament.venue}
                  className="w-full bg-gradient-to-r from-brand-red to-brand-red-light hover:from-brand-red-dark hover:to-brand-red text-white rounded-xl font-bold"
                >
                  Next: Choose Format
                  <ChevronRight className="w-4 h-4 ml-1" />
                </Button>
              </motion.div>
            )}

            {/* Step 2: Format */}
            {hostStep === 1 && (
              <motion.div
                key="step-1"
                initial={{ opacity: 0, x: 30 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -30 }}
                transition={{ duration: 0.2 }}
                className="space-y-4"
              >
                <label className="text-xs font-bold text-warm-600 dark:text-warm-300 mb-1.5 block">Tournament Format</label>
                <div className="space-y-2">
                  {(['knockout', 'league', 'hybrid'] as const).map((t) => {
                    const badge = getTypeBadge(t);
                    const descriptions: Record<string, string> = {
                      knockout: 'Single elimination — lose and you\'re out!',
                      league: 'Round-robin — every team plays each other',
                      hybrid: 'League + Knockout — best of both worlds',
                    };
                    return (
                      <button
                        key={t}
                        onClick={() => setNewTournament({ ...newTournament, type: t })}
                        className={`w-full p-3 rounded-xl border-2 text-left flex items-center gap-3 transition-all ${
                          newTournament.type === t
                            ? `${badge.bg} ${badge.text} border-current`
                            : 'border-warm-200 dark:border-warm-700 text-warm-600 dark:text-warm-400 hover:border-warm-300 dark:hover:border-warm-600'
                        }`}
                      >
                        <div className={`w-10 h-10 rounded-xl ${badge.bg} flex items-center justify-center shrink-0`}>
                          {badge.icon}
                        </div>
                        <div>
                          <p className="font-bold text-sm capitalize">{t}</p>
                          <p className="text-[10px] opacity-70">{descriptions[t]}</p>
                        </div>
                        {newTournament.type === t && (
                          <motion.div
                            initial={{ scale: 0 }}
                            animate={{ scale: 1 }}
                            className="ml-auto w-5 h-5 rounded-full bg-current flex items-center justify-center"
                          >
                            <Check className="w-3 h-3 text-white" style={{ color: 'white' }} />
                          </motion.div>
                        )}
                      </button>
                    );
                  })}
                </div>
                <div className="bg-warm-100 dark:bg-warm-800 rounded-xl p-3 text-center">
                  <p className="text-xs text-warm-500 dark:text-warm-400">A unique tournament code will be auto-generated</p>
                  <p className="text-[10px] text-warm-400 dark:text-warm-500">Share this code so others can easily find &amp; join</p>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    onClick={() => setHostStep(0)}
                    className="flex-1 rounded-xl font-bold"
                  >
                    Back
                  </Button>
                  <Button
                    onClick={() => setHostStep(2)}
                    className="flex-1 bg-gradient-to-r from-brand-red to-brand-red-light hover:from-brand-red-dark hover:to-brand-red text-white rounded-xl font-bold"
                  >
                    Next: Review
                    <ChevronRight className="w-4 h-4 ml-1" />
                  </Button>
                </div>
              </motion.div>
            )}

            {/* Step 3: Review */}
            {hostStep === 2 && (
              <motion.div
                key="step-2"
                initial={{ opacity: 0, x: 30 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -30 }}
                transition={{ duration: 0.2 }}
                className="space-y-4"
              >
                <div className="bg-white dark:bg-warm-800 rounded-xl border border-warm-200 dark:border-warm-700 overflow-hidden">
                  <div className={`h-2 bg-gradient-to-r ${getTypeBadge(newTournament.type).gradient}`} />
                  <div className="p-4 space-y-3">
                    <h3 className="font-bold text-warm-800 dark:text-warm-100">{newTournament.name || 'Untitled'}</h3>
                    <div className="space-y-2">
                      <div className="flex items-center gap-2 text-sm text-warm-600 dark:text-warm-300">
                        <MapPin className="w-3.5 h-3.5 text-warm-400" />
                        <span>{newTournament.venue || 'No venue'}</span>
                      </div>
                      <div className="flex items-center gap-2 text-sm text-warm-600 dark:text-warm-300">
                        <Users className="w-3.5 h-3.5 text-warm-400" />
                        <span>{newTournament.gender === 'male' ? '♂ Boys' : '♀ Girls'}</span>
                      </div>
                      <div className="flex items-center gap-2 text-sm text-warm-600 dark:text-warm-300">
                        {getTypeBadge(newTournament.type).icon}
                        <span className="capitalize">{newTournament.type} Format</span>
                      </div>
                    </div>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    onClick={() => setHostStep(1)}
                    className="flex-1 rounded-xl font-bold"
                  >
                    Back
                  </Button>
                  <Button
                    onClick={handleCreateTournament}
                    disabled={!newTournament.name}
                    className="flex-1 bg-gradient-to-r from-brand-red to-brand-red-light hover:from-brand-red-dark hover:to-brand-red text-white rounded-xl font-bold shadow-lg shadow-brand-red/20"
                  >
                    <Trophy className="w-4 h-4 mr-1" />
                    Create Tournament
                  </Button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </DialogContent>
      </Dialog>

      {/* ─── Search Bar with Expansion ──────────────────────────────── */}
      <div className="relative">
        <motion.div
          className="relative"
          animate={{ scale: searchFocused ? 1.02 : 1 }}
          transition={{ type: 'spring', stiffness: 300, damping: 25 }}
        >
          <Search className={`absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 transition-colors ${searchFocused ? 'text-brand-red' : 'text-warm-400'}`} />
          <Input
            placeholder="Search by name or code (e.g. TC3001)..."
            value={tournamentSearch}
            onChange={(e) => setTournamentSearch(e.target.value)}
            onFocus={() => setSearchFocused(true)}
            onBlur={() => setTimeout(() => setSearchFocused(false), 200)}
            className={`pl-9 pr-9 h-11 bg-white dark:bg-warm-800 border-warm-200 dark:border-warm-700 rounded-xl text-sm transition-all ${
              searchFocused ? 'border-brand-red/50 ring-2 ring-brand-red/20 shadow-lg shadow-brand-red/5' : ''
            }`}
          />
          {tournamentSearch ? (
            <button
              onClick={() => setTournamentSearch('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-warm-400 hover:text-warm-600"
            >
              <X className="w-4 h-4" />
            </button>
          ) : (
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-mono text-warm-300 dark:text-warm-600 bg-warm-100 dark:bg-warm-700 px-1.5 py-0.5 rounded">
              /
            </span>
          )}
        </motion.div>

        {/* Search suggestions / recent searches */}
        <AnimatePresence>
          {searchFocused && !tournamentSearch.trim() && recentSearches.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: -5, height: 0 }}
              animate={{ opacity: 1, y: 0, height: 'auto' }}
              exit={{ opacity: 0, y: -5, height: 0 }}
              className="absolute z-20 top-full mt-1 left-0 right-0 bg-white dark:bg-warm-800 rounded-xl border border-warm-200 dark:border-warm-700 shadow-xl overflow-hidden"
            >
              <div className="p-2">
                <div className="flex items-center justify-between px-2 py-1">
                  <span className="text-[10px] font-bold text-warm-400 dark:text-warm-500 uppercase tracking-wider">Recent Searches</span>
                  <button
                    onClick={() => { setRecentSearches([]); try { localStorage.removeItem('tournament-recent-searches'); } catch { /* ignore */ } }}
                    className="text-[10px] text-brand-red font-bold hover:underline"
                  >
                    Clear
                  </button>
                </div>
                {recentSearches.map((search, i) => (
                  <button
                    key={i}
                    onClick={() => handleSearchSubmit(search)}
                    className="w-full flex items-center gap-2 px-2 py-2 rounded-lg text-sm text-warm-700 dark:text-warm-300 hover:bg-warm-50 dark:hover:bg-warm-700 transition-colors"
                  >
                    <Clock className="w-3.5 h-3.5 text-warm-400" />
                    <span className="flex-1 text-left">{search}</span>
                    <ArrowRight className="w-3 h-3 text-warm-300" />
                  </button>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* ─── Filter Chips ───────────────────────────────────────────── */}
      <div className="flex gap-2 flex-wrap">
        <button
          onClick={() => setTypeFilter('all')}
          className={`px-3 py-1.5 rounded-full text-xs font-bold transition-all duration-200 flex items-center gap-1 ${
            typeFilter === 'all'
              ? 'bg-warm-800 dark:bg-warm-200 text-white dark:text-warm-800 shadow-sm'
              : 'bg-warm-100 dark:bg-warm-800 text-warm-500 dark:text-warm-400 hover:bg-warm-200 dark:hover:bg-warm-700'
          }`}
        >
          <Filter className="w-3 h-3" />
          All Types
        </button>
        {(['knockout', 'league', 'hybrid'] as const).map((t) => {
          const badge = getTypeBadge(t);
          return (
            <button
              key={t}
              onClick={() => setTypeFilter(t)}
              className={`px-3 py-1.5 rounded-full text-xs font-bold capitalize transition-all duration-200 flex items-center gap-1 ${
                typeFilter === t
                  ? `${badge.bg} ${badge.text} ring-1 ring-current shadow-sm`
                  : 'bg-warm-100 dark:bg-warm-800 text-warm-500 dark:text-warm-400 hover:bg-warm-200 dark:hover:bg-warm-700'
              }`}
            >
              {badge.icon}
              {t}
            </button>
          );
        })}
      </div>

      {/* Premium hint for non-premium users */}
      {!isPremium && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <Card
            className="p-4 bg-gradient-to-r from-brand-gold/10 via-brand-gold/5 to-brand-gold/10 dark:from-brand-gold/20 dark:via-brand-gold/10 dark:to-brand-gold/20 border border-brand-gold/30 cursor-pointer active:scale-[0.98] transition-transform overflow-hidden relative"
            onClick={() => setShowUpgrade(true)}
          >
            <motion.div
              className="absolute inset-0 bg-gradient-to-r from-transparent via-brand-gold/10 to-transparent"
              animate={{ x: ['-100%', '200%'] }}
              transition={{ duration: 3, repeat: Infinity, ease: 'linear' }}
            />
            <div className="flex items-center gap-3 relative">
              <div className="w-10 h-10 rounded-xl bg-brand-gold/20 flex items-center justify-center shrink-0">
                <Crown className="w-5 h-5 text-brand-gold" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-warm-800 dark:text-warm-100">Want to host your own tournament?</p>
                <p className="text-[11px] text-warm-500 dark:text-warm-400">Upgrade to Premium to create and manage tournaments</p>
              </div>
              <div className="shrink-0">
                <div className="px-3 py-1.5 rounded-lg bg-brand-gold/20 text-brand-gold font-bold text-xs flex items-center gap-1">
                  <Sparkles className="w-3 h-3" />
                  Upgrade
                </div>
              </div>
            </div>
          </Card>
        </motion.div>
      )}

      {/* ─── Status Tabs (Enhanced) ─────────────────────────────────── */}
      <div className="flex gap-1 bg-warm-100 dark:bg-warm-800 p-1 rounded-xl">
        {(['ongoing', 'upcoming', 'past'] as const).map((s) => {
          const count = statusCounts[s];
          const tabConfig = {
            ongoing: { icon: <Radio className="w-3 h-3" />, activeColor: 'text-emerald-600 dark:text-emerald-400' },
            upcoming: { icon: <CalendarDays className="w-3 h-3" />, activeColor: 'text-amber-600 dark:text-amber-400' },
            past: { icon: <Award className="w-3 h-3" />, activeColor: 'text-warm-600 dark:text-warm-300' },
          }[s];
          const isActive = statusFilter === s;
          return (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`flex-1 px-3 py-2 rounded-lg text-sm font-bold capitalize transition-all duration-200 relative flex items-center justify-center gap-1.5 ${
                isActive
                  ? `bg-white dark:bg-warm-700 shadow-sm ${tabConfig.activeColor}`
                  : 'text-warm-500 dark:text-warm-400 hover:text-warm-700 dark:hover:text-warm-300'
              }`}
            >
              {tabConfig.icon}
              <span>{s}</span>
              {count > 0 && (
                <span className={`text-[10px] font-bold rounded-full px-1.5 py-0.5 min-w-[18px] text-center ${
                  isActive
                    ? 'bg-brand-red/10 text-brand-red'
                    : 'bg-warm-200 dark:bg-warm-700 text-warm-500 dark:text-warm-400'
                }`}>
                  {count}
                </span>
              )}
              {isActive && (
                <motion.div
                  className="absolute bottom-0 left-1/4 right-1/4 h-0.5 bg-brand-red rounded-full"
                  layoutId="statusIndicator"
                  transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                />
              )}
            </button>
          );
        })}
      </div>

      {/* ─── Gender Filter (Enhanced) ───────────────────────────────── */}
      <div className="flex gap-2">
        {[
          { id: 'all' as const, label: 'All', icon: <Users className="w-3 h-3" /> },
          { id: 'male' as const, label: '♂ Boys', icon: <span className="text-xs">♂</span> },
          { id: 'female' as const, label: '♀ Girls', icon: <span className="text-xs">♀</span> },
        ].map((f) => (
          <button
            key={f.id}
            onClick={() => setGenderFilter(f.id)}
            className={`px-4 py-1.5 rounded-full text-xs font-bold transition-all duration-200 flex items-center gap-1.5 ${
              genderFilter === f.id
                ? f.id === 'male'
                  ? 'bg-brand-red/10 text-brand-red ring-1 ring-brand-red/30'
                  : f.id === 'female'
                    ? 'bg-pink-500/10 text-pink-600 dark:text-pink-400 ring-1 ring-pink-500/30'
                    : 'bg-warm-800 dark:bg-warm-200 text-white dark:text-warm-800'
                : 'bg-warm-100 dark:bg-warm-800 text-warm-500 dark:text-warm-400 hover:bg-warm-200 dark:hover:bg-warm-700'
            }`}
          >
            {f.icon}
            {f.label}
          </button>
        ))}
      </div>

      {/* ─── Tournament Cards ────────────────────────────────────────── */}
      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.1 }}
            >
              <SkeletonCard />
            </motion.div>
          ))}
        </div>
      ) : filteredTournaments.length === 0 ? (
        <EmptyState content={getEmptyContent()} onCta={handleCreateClick} />
      ) : (
        <div className="space-y-3">
          {filteredTournaments.map((tournament, i) => {
            const typeBadge = getTypeBadge(tournament.type);
            const teamCount = tournament.teams.length;
            const statusGradient = getStatusGradient(tournament.status);
            const completedMatches = tournament.teams.reduce((sum, t) => sum + t.won + t.lost + t.drawn, 0) / 2;
            const isExpanded = expandedId === tournament.id;

            return (
              <motion.div
                key={tournament.id}
                initial={{ opacity: 0, y: 20, scale: 0.97 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ delay: i * 0.07, duration: 0.35, ease: 'easeOut' }}
                layout
              >
                <Card className="overflow-hidden border border-warm-200 dark:border-warm-700 bg-white dark:bg-warm-800/50 relative group">
                  <ShimmerOverlay />

                  {/* Gradient Left Border */}
                  <div className={`absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-b ${statusGradient}`} />

                  <div
                    className="p-4 pl-5 cursor-pointer"
                    onClick={() => setExpandedId(isExpanded ? null : tournament.id)}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1 min-w-0">
                        {/* Title Row with Status */}
                        <div className="flex items-center gap-2">
                          <StatusIndicator status={tournament.status} />
                          <h3 className="font-bold text-warm-800 dark:text-warm-100 text-sm truncate">
                            {tournament.name}
                          </h3>
                        </div>

                        {/* Tournament Code Badge + Type Badge Row */}
                        <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                          {/* Format Type Badge */}
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[9px] font-bold capitalize ${typeBadge.bg} ${typeBadge.text} border ${typeBadge.border}`}>
                            {typeBadge.icon}
                            {tournament.type}
                          </span>

                          {/* Tournament Code */}
                          {tournament.tournamentCode && (
                            <div
                              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-brand-teal/10 dark:bg-brand-teal/20 cursor-pointer hover:bg-brand-teal/20 transition-colors"
                              onClick={(e) => {
                                e.stopPropagation();
                                copyToClipboard(tournament.tournamentCode!);
                              }}
                            >
                              <Hash className="w-3 h-3 text-brand-teal" />
                              <span className="text-[10px] font-mono font-bold text-brand-teal">
                                {tournament.tournamentCode}
                              </span>
                              {copiedCode === tournament.tournamentCode ? (
                                <Check className="w-3 h-3 text-brand-green" />
                              ) : (
                                <Copy className="w-3 h-3 text-brand-teal/60" />
                              )}
                            </div>
                          )}
                        </div>

                        {/* Venue & Date */}
                        <div className="flex items-center gap-1 mt-1.5 text-xs text-warm-500 dark:text-warm-400">
                          <MapPin className="w-3 h-3 shrink-0" />
                          <span className="truncate">{tournament.venue}</span>
                        </div>
                        <div className="flex items-center gap-1 mt-0.5 text-xs text-warm-500 dark:text-warm-400">
                          <Calendar className="w-3 h-3 shrink-0" />
                          <span>{formatDate(tournament.startDate)}</span>
                        </div>
                      </div>

                      <div className="flex flex-col items-end gap-1.5 ml-3">
                        {/* Gender Badge */}
                        <Badge
                          variant="secondary"
                          className={`text-[10px] font-bold ${
                            tournament.gender === 'male'
                              ? 'bg-brand-red/10 text-brand-red'
                              : 'bg-pink-500/10 text-pink-600 dark:text-pink-400'
                          }`}
                        >
                          {tournament.gender === 'male' ? '♂ Boys' : '♀ Girls'}
                        </Badge>
                        {/* Team Count Badge with Icon */}
                        <div className="flex items-center gap-1.5">
                          <div className="flex items-center gap-1 text-xs text-warm-600 dark:text-warm-300 bg-warm-100 dark:bg-warm-700 px-2 py-0.5 rounded-md">
                            <Users className="w-3 h-3" />
                            <span className="font-bold">{teamCount}</span>
                          </div>
                          {tournament.matchCount > 0 && (
                            <div className="flex items-center gap-1 text-xs text-warm-600 dark:text-warm-300 bg-warm-100 dark:bg-warm-700 px-2 py-0.5 rounded-md">
                              <Swords className="w-3 h-3" />
                              <span className="font-bold">{tournament.matchCount}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Team Avatars Row + Match Progress */}
                    <div className="flex items-center justify-between mt-3 gap-3">
                      <div className="flex -space-x-1.5">
                        {tournament.teams.slice(0, 5).map((team) => (
                          <div
                            key={team.id}
                            className="w-7 h-7 rounded-full border-2 border-white dark:border-warm-800 flex items-center justify-center text-[8px] font-bold text-white shadow-sm"
                            style={{ backgroundColor: team.color }}
                          >
                            {team.shortName?.charAt(0) || team.name.charAt(0)}
                          </div>
                        ))}
                        {tournament.teams.length > 5 && (
                          <div className="w-7 h-7 rounded-full border-2 border-white dark:border-warm-800 bg-warm-200 dark:bg-warm-600 flex items-center justify-center text-[8px] font-bold text-warm-600 dark:text-warm-300">
                            +{tournament.teams.length - 5}
                          </div>
                        )}
                      </div>

                      {/* Match progress bar for ongoing tournaments */}
                      {tournament.status === 'ongoing' && tournament.matchCount > 0 ? (
                        <div className="flex items-center gap-2 flex-1 max-w-[160px]">
                          <MatchProgressBar
                            completed={Math.round(completedMatches)}
                            total={tournament.matchCount}
                          />
                        </div>
                      ) : tournament.status === 'upcoming' ? (
                        <div className="flex items-center gap-1">
                          <Zap className="w-3 h-3 text-amber-500" />
                          <span className="text-[10px] text-amber-600 dark:text-amber-400 font-bold">Upcoming</span>
                        </div>
                      ) : tournament.status === 'past' ? (
                        <div className="flex items-center gap-1">
                          <Trophy className="w-3 h-3 text-brand-gold" />
                          <span className="text-[10px] text-brand-gold font-bold">Completed</span>
                        </div>
                      ) : null}

                      {/* Expand/Collapse Icon */}
                      <motion.div
                        animate={{ rotate: isExpanded ? 180 : 0 }}
                        transition={{ duration: 0.2 }}
                      >
                        <ChevronDown className="w-4 h-4 text-warm-400" />
                      </motion.div>
                    </div>
                  </div>

                  {/* ─── Expanded Detail View ──────────────────────────── */}
                  <AnimatePresence>
                    {isExpanded && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.3, ease: 'easeInOut' }}
                        className="overflow-hidden"
                      >
                        <div className="border-t border-warm-200 dark:border-warm-700 p-4 bg-warm-50 dark:bg-warm-800/30 space-y-4">
                          {/* Tournament Code Display */}
                          {tournament.tournamentCode && (
                            <div className="flex items-center justify-between bg-white dark:bg-warm-800 rounded-xl p-3 border border-warm-200 dark:border-warm-700">
                              <div>
                                <p className="text-[10px] text-warm-400 dark:text-warm-500 uppercase font-semibold tracking-wider">Tournament Code</p>
                                <p className="text-lg font-mono font-bold text-brand-teal">{tournament.tournamentCode}</p>
                              </div>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => copyToClipboard(tournament.tournamentCode!)}
                                className="rounded-lg text-xs"
                              >
                                {copiedCode === tournament.tournamentCode ? (
                                  <><Check className="w-3 h-3 mr-1" /> Copied</>
                                ) : (
                                  <><Copy className="w-3 h-3 mr-1" /> Copy</>
                                )}
                              </Button>
                            </div>
                          )}

                          {/* ─── Bracket View for Knockout Tournaments ──── */}
                          {tournament.type === 'knockout' && (
                            <BracketView tournament={tournament} />
                          )}

                          {/* Teams List */}
                          <div>
                            <div className="flex items-center justify-between mb-2">
                              <h4 className="text-xs font-bold text-warm-500 dark:text-warm-400 uppercase tracking-wider flex items-center gap-1.5">
                                <Users className="w-3 h-3" />
                                Teams ({tournament.teams.length})
                              </h4>
                              <Button
                                onClick={() => openAddTeamDialog(tournament.id)}
                                variant="outline"
                                size="sm"
                                className="rounded-lg h-7 px-2.5 text-[10px] font-bold border-brand-teal text-brand-teal hover:bg-brand-teal/10"
                              >
                                <Plus className="w-3 h-3 mr-1" />
                                Add Team
                              </Button>
                            </div>
                            <div className="space-y-1.5 max-h-64 overflow-y-auto">
                              {tournament.teams.map((team) => (
                                <div key={team.id} className="flex items-center gap-2.5 text-sm text-warm-700 dark:text-warm-300 group bg-white dark:bg-warm-800/50 rounded-lg px-3 py-2 border border-warm-100 dark:border-warm-700/50">
                                  <div
                                    className="w-6 h-6 rounded-lg shrink-0 flex items-center justify-center text-white text-[10px] font-bold"
                                    style={{ backgroundColor: team.color }}
                                  >
                                    {team.shortName?.charAt(0) || team.name.charAt(0)}
                                  </div>
                                  <span className="flex-1 truncate font-medium">{team.name}</span>
                                  {team.teamCode && (
                                    <span className="text-[9px] font-mono font-semibold text-brand-teal bg-brand-teal/10 px-1.5 py-0.5 rounded">
                                      {team.teamCode}
                                    </span>
                                  )}
                                  {team.played > 0 && (
                                    <span className="text-[10px] text-warm-500 dark:text-warm-400 font-medium">
                                      P{team.played} W{team.won} Pts{team.points}
                                    </span>
                                  )}
                                  {(tournament.status === 'upcoming' || tournament.status === 'ongoing') && (
                                    <button
                                      onClick={() => setRemoveTeamId(team.id)}
                                      className="opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded-md hover:bg-brand-red/10 text-warm-400 hover:text-brand-red"
                                    >
                                      <Trash2 className="w-3 h-3" />
                                    </button>
                                  )}
                                </div>
                              ))}
                              {tournament.teams.length === 0 && (
                                <p className="text-xs text-warm-400 dark:text-warm-500 text-center py-3">No teams yet. Add teams to get started.</p>
                              )}
                            </div>
                          </div>

                          <div className="flex items-center gap-2 text-xs text-warm-500 dark:text-warm-400 bg-warm-100 dark:bg-warm-700/50 rounded-lg px-3 py-2">
                            <Timer className="w-3.5 h-3.5" />
                            <span className="font-medium">{tournament.matchCount} matches scheduled</span>
                          </div>

                          {/* Standings Table */}
                          {tournament.teams.length > 0 && (
                            <div>
                              <h4 className="text-xs font-bold text-warm-500 dark:text-warm-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                                <TrendingUp className="w-3 h-3" />
                                Standings
                              </h4>
                              <div className="bg-white dark:bg-warm-800/50 rounded-xl border border-warm-100 dark:border-warm-700/50 overflow-hidden">
                                <div className="grid grid-cols-8 gap-1 text-[10px] text-warm-400 dark:text-warm-500 font-bold uppercase tracking-wider px-3 py-2 bg-warm-50 dark:bg-warm-800 border-b border-warm-100 dark:border-warm-700/50">
                                  <span className="col-span-3">Team</span>
                                  <span className="text-center">P</span>
                                  <span className="text-center">W</span>
                                  <span className="text-center">L</span>
                                  <span className="text-center">SD</span>
                                  <span className="text-center">Pts</span>
                                </div>
                                <div className="max-h-48 overflow-y-auto">
                                  {[...tournament.teams].sort((a, b) => b.points - a.points).map((team, idx) => (
                                    <div key={team.id} className={`grid grid-cols-8 gap-1 text-warm-700 dark:text-warm-300 px-3 py-2 text-xs ${idx > 0 ? 'border-t border-warm-50 dark:border-warm-700/30' : ''}`}>
                                      <span className="col-span-3 flex items-center gap-1.5 truncate">
                                        <span className="text-[9px] text-warm-400 dark:text-warm-500 font-bold w-3">{idx + 1}</span>
                                        <div className="w-4 h-4 rounded shrink-0" style={{ backgroundColor: team.color }} />
                                        <span className="truncate font-medium">{team.name}</span>
                                      </span>
                                      <span className="text-center">{team.played}</span>
                                      <span className="text-center font-medium text-brand-green">{team.won}</span>
                                      <span className="text-center">{team.lost}</span>
                                      <span className="text-center">{team.scoreDiff > 0 ? '+' : ''}{team.scoreDiff}</span>
                                      <span className="text-center font-bold text-brand-red">{team.points}</span>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            </div>
                          )}

                          {/* Generate Bracket Button (upcoming) */}
                          {tournament.status === 'upcoming' && tournament.teams.length >= 2 && (
                            <Button
                              onClick={() => handleGenerateBracket(tournament.id, tournament.teams.map(t => t.id))}
                              disabled={generatingBracket}
                              className="w-full bg-gradient-to-r from-brand-red to-brand-red-light hover:from-brand-red-dark hover:to-brand-red text-white rounded-xl h-10 text-xs font-bold shadow-lg shadow-brand-red/20"
                            >
                              {generatingBracket ? (
                                <><Loader2 className="w-3 h-3 mr-1 animate-spin" /> Generating...</>
                              ) : (
                                <><Swords className="w-3 h-3 mr-1" /> Generate Bracket &amp; Start</>
                              )}
                            </Button>
                          )}
                          {tournament.status === 'upcoming' && tournament.teams.length < 2 && (
                            <div className="bg-brand-gold/10 dark:bg-brand-gold/20 border border-brand-gold/20 dark:border-brand-gold/30 rounded-xl p-3 text-center">
                              <p className="text-xs text-warm-600 dark:text-warm-300 font-medium">Add at least 2 teams to generate bracket</p>
                            </div>
                          )}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </Card>
              </motion.div>
            );
          })}
        </div>
      )}

      {/* ─── Add Team Dialog ──────────────────────────────────────────── */}
      <Dialog open={!!addTeamDialogOpen} onOpenChange={(open) => { if (!open) setAddTeamDialogOpen(null); }}>
        <DialogContent className="bg-warm-50 dark:bg-warm-900 border-warm-300 dark:border-warm-700 max-h-[80vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="text-warm-800 dark:text-warm-100 flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-brand-teal/10 flex items-center justify-center">
                <UserPlus className="w-4 h-4 text-brand-teal" />
              </div>
              Add Teams
              {selectedTeamIds.length > 0 && (
                <Badge className="bg-brand-teal/20 text-brand-teal text-[10px] border-0">
                  {selectedTeamIds.length} selected
                </Badge>
              )}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 mt-2 flex-1 overflow-hidden flex flex-col" ref={teamInputRef}>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-warm-400" />
              <Input
                placeholder="Search by team name or code (e.g. KT2001)..."
                value={teamSearch}
                onChange={(e) => setTeamSearch(e.target.value)}
                className="pl-9 pr-9 h-10 bg-white dark:bg-warm-800 border-warm-200 dark:border-warm-700 rounded-xl text-sm"
                autoFocus
              />
              {teamSearch && (
                <button
                  onClick={() => { setTeamSearch(''); setTeamSearchResults(getFilteredTeams('')); }}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-warm-400 hover:text-warm-600"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>

            <div className="flex-1 overflow-y-auto min-h-0">
              {isSearchingTeams && (
                <div className="px-3 py-2 flex items-center gap-2">
                  <div className="w-3 h-3 border-2 border-brand-teal border-t-transparent rounded-full animate-spin" />
                  <span className="text-xs text-warm-400">Searching...</span>
                </div>
              )}

              {(() => {
                const currentTournament = tournaments.find(t => t.id === addTeamDialogOpen);
                const existingTeamIds = new Set(currentTournament?.teams.map(t => t.id) || []);
                return teamSearchResults.length > 0 ? (
                  <div className="space-y-1">
                    {teamSearchResults.map(team => {
                      const isAlreadyIn = existingTeamIds.has(team.id);
                      const isSelected = selectedTeamIds.includes(team.id);
                      return (
                        <button
                          key={team.id}
                          onClick={() => {
                            if (isAlreadyIn) return;
                            setSelectedTeamIds(prev =>
                              isSelected
                                ? prev.filter(id => id !== team.id)
                                : [...prev, team.id]
                            );
                          }}
                          disabled={isAlreadyIn}
                          className={`w-full flex items-center gap-3 p-2.5 rounded-xl text-left transition-all ${
                            isAlreadyIn
                              ? 'opacity-50 cursor-not-allowed bg-warm-100 dark:bg-warm-800'
                              : isSelected
                                ? 'bg-brand-teal/10 ring-1 ring-brand-teal'
                                : 'hover:bg-warm-50 dark:hover:bg-warm-800 active:bg-warm-100 dark:active:bg-warm-700'
                          }`}
                        >
                          <div
                            className="w-9 h-9 rounded-lg flex items-center justify-center text-xs font-bold text-white overflow-hidden shrink-0"
                            style={{ backgroundColor: team.color || '#475569' }}
                          >
                            {team.shortName?.charAt(0) || team.name.charAt(0)}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-warm-800 dark:text-warm-200 truncate">
                              {highlightMatch(team.name, teamSearch)}
                            </p>
                            <div className="flex items-center gap-2">
                              {team.teamCode && (
                                <span className="text-[10px] font-mono font-semibold text-brand-teal bg-brand-teal/10 px-1.5 py-0.5 rounded">
                                  {highlightMatch(team.teamCode, teamSearch)}
                                </span>
                              )}
                              {team.shortName && (
                                <span className="text-[10px] text-warm-400 dark:text-warm-500">{team.shortName}</span>
                              )}
                            </div>
                          </div>
                          {isAlreadyIn ? (
                            <Badge className="bg-brand-green/10 text-brand-green text-[9px] border-0">In</Badge>
                          ) : isSelected ? (
                            <div className="w-6 h-6 rounded-full bg-brand-teal flex items-center justify-center">
                              <Check className="w-3.5 h-3.5 text-white" />
                            </div>
                          ) : (
                            <div className="w-6 h-6 rounded-full border-2 border-warm-300 dark:border-warm-600" />
                          )}
                        </button>
                      );
                    })}
                  </div>
                ) : !isSearchingTeams && teamSearch.trim() ? (
                  <div className="px-3 py-6 text-center">
                    <p className="text-sm text-warm-500 dark:text-warm-400">No teams found for &quot;{teamSearch}&quot;</p>
                    <p className="text-[10px] text-warm-400 dark:text-warm-500 mt-1">Create a team first from Team Management</p>
                  </div>
                ) : !teamSearch.trim() && allTeams.length === 0 ? (
                  <div className="px-3 py-6 text-center">
                    <p className="text-xs text-warm-400 dark:text-warm-500">No teams in database yet</p>
                  </div>
                ) : null;
              })()}
            </div>

            {selectedTeamIds.length > 0 && (
              <div className="flex flex-wrap gap-1.5 pt-2 border-t border-warm-200 dark:border-warm-700">
                {selectedTeamIds.map(teamId => {
                  const team = allTeams.find(t => t.id === teamId);
                  return team ? (
                    <Badge
                      key={teamId}
                      className="bg-brand-teal/10 text-brand-teal text-xs border-0 pr-1 gap-1"
                    >
                      {team.name}
                      <button
                        onClick={() => setSelectedTeamIds(prev => prev.filter(id => id !== teamId))}
                        className="hover:text-brand-red"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </Badge>
                  ) : null;
                })}
              </div>
            )}

            <Button
              onClick={handleAddTeams}
              disabled={selectedTeamIds.length === 0 || addingTeams}
              className="w-full bg-gradient-to-r from-brand-teal to-teal-400 hover:from-brand-teal/90 hover:to-teal-500 text-white rounded-xl font-bold shadow-lg shadow-brand-teal/20"
            >
              {addingTeams ? (
                <><Loader2 className="w-4 h-4 mr-1 animate-spin" /> Adding...</>
              ) : (
                <><Plus className="w-4 h-4 mr-1" /> Add {selectedTeamIds.length} Team{selectedTeamIds.length !== 1 ? 's' : ''}</>
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ─── Remove Team Confirmation ─────────────────────────────────── */}
      <Dialog open={!!removeTeamId} onOpenChange={(open) => { if (!open) setRemoveTeamId(null); }}>
        <DialogContent className="bg-warm-50 dark:bg-warm-900 border-warm-300 dark:border-warm-700">
          <DialogHeader>
            <DialogTitle className="text-warm-800 dark:text-warm-100">Remove Team?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-warm-600 dark:text-warm-300">
            This will remove the team and any upcoming matches involving them. This cannot be undone.
          </p>
          <div className="flex gap-2 mt-3">
            <Button
              variant="outline"
              onClick={() => setRemoveTeamId(null)}
              className="flex-1 rounded-xl"
            >
              Cancel
            </Button>
            <Button
              onClick={() => {
                if (expandedId && removeTeamId) {
                  handleRemoveTeam(expandedId, removeTeamId);
                }
              }}
              disabled={removingTeam}
              className="flex-1 bg-brand-red hover:bg-brand-red-dark text-white rounded-xl"
            >
              {removingTeam ? (
                <><Loader2 className="w-4 h-4 mr-1 animate-spin" /> Removing...</>
              ) : (
                'Remove'
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
