'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Plus, MapPin, Calendar, Users, ChevronDown, ChevronUp, Trophy, Crown,
  Lock, Loader2, Search, X, Copy, Check, Hash, UserPlus, Trash2, Swords,
  Sparkles, Timer, Filter, TrendingUp, Clock, Zap, CalendarDays, LayoutGrid,
  ChevronRight, Star, ArrowRight, CircleDot, Radio, Award, Target,
  Eye, Flame, Shield, Venus, Mars, BarChart3, Activity,
  ArrowRightLeft
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
  DialogDescription,
} from '@/components/ui/dialog';
import { useKabaddiStore } from '@/lib/store';
import Portal from '@/components/portal';
import { useToast } from '@/hooks/use-toast';
import { useBackButton } from '@/hooks/use-back-button';
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
  weightCategory?: string;
  teams: TeamInTournament[];
  matchCount: number;
  organizerId?: string;
}

// ─── Tournament Detail (fetched from API) ──────────────────────────

interface TournamentMatch {
  id: string;
  homeTeamId: string;
  awayTeamId: string;
  homeScore: number;
  awayScore: number;
  status: string;
  startedAt: string | null;
  completedAt: string | null;
  round?: number;
  position?: number;
}

interface TournamentPlayer {
  id: string;
  userId: string;
  name: string;
  avatar: string | null;
  teamId: string;
  raidPoints: number;
  tacklePoints: number;
  totalPoints: number;
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

/** Animated status indicator dot with enhanced glow */
function StatusIndicator({ status }: { status: string }) {
  const config = {
    ongoing: { color: 'bg-emerald-500', ring: 'ring-emerald-500/30', pulse: true, glow: 'shadow-emerald-500/50' },
    upcoming: { color: 'bg-amber-500', ring: 'ring-amber-500/30', pulse: false, glow: 'shadow-amber-500/50' },
    past: { color: 'bg-warm-400', ring: 'ring-warm-400/30', pulse: false, glow: 'shadow-warm-400/50' },
  }[status] || { color: 'bg-warm-400', ring: 'ring-warm-400/30', pulse: false, glow: 'shadow-warm-400/50' };

  return (
    <span className="relative flex h-3.5 w-3.5">
      {config.pulse && (
        <span className={`animate-ping absolute inline-flex h-full w-full rounded-full ${config.color} opacity-75`} />
      )}
      <span className={`relative inline-flex rounded-full h-3.5 w-3.5 ${config.color} ring-2 ${config.ring} shadow-lg ${config.glow}`} />
    </span>
  );
}

/** Match progress bar with enhanced gradient and label */
function MatchProgressBar({ completed, total }: { completed: number; total: number }) {
  const pct = total > 0 ? Math.round((completed / total) * 100) : 0;
  return (
    <div className="flex items-center gap-2 w-full">
      <div className="flex-1 h-2.5 bg-warm-200/60 dark:bg-warm-700/60 rounded-full overflow-hidden relative">
        {/* Animated background shimmer */}
        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent animate-[shimmer_3s_infinite]" />
        <motion.div
          className="h-full rounded-full bg-gradient-to-r from-brand-gold via-brand-gold-light to-brand-gold relative progress-shimmer"
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.8, ease: 'easeOut' }}
        >
          <div className="absolute inset-0 bg-gradient-to-b from-white/30 to-transparent rounded-full" />
        </motion.div>
      </div>
      <span className="text-[10px] font-bold text-warm-500 dark:text-warm-400 shrink-0 bg-warm-100 dark:bg-warm-700/50 px-1.5 py-0.5 rounded-md">
        {completed}/{total}
      </span>
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
        className="absolute inset-0 bg-gradient-to-r from-transparent via-white/8 to-transparent dark:via-white/5"
        animate={{ x: ['-100%', '200%'] }}
        transition={{ duration: 2, ease: 'linear' }}
      />
    </motion.div>
  );
}

/** Decorative kabaddi court pattern for backgrounds */
function KabaddiPattern() {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none opacity-[0.03] dark:opacity-[0.05]">
      {/* Court line patterns */}
      <div className="absolute top-1/2 left-0 right-0 h-px bg-brand-red" />
      <div className="absolute top-0 bottom-0 left-1/2 w-px bg-brand-red" />
      <div className="absolute top-[30%] left-0 right-0 h-px bg-brand-red" />
      <div className="absolute top-[70%] left-0 right-0 h-px bg-brand-red" />
      <div className="absolute top-0 bottom-0 left-[25%] w-px bg-brand-red" />
      <div className="absolute top-0 bottom-0 left-[75%] w-px bg-brand-red" />
      {/* Center circle */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-20 h-20 rounded-full border border-brand-red" />
      {/* Corner arcs */}
      <div className="absolute top-2 left-2 w-8 h-8 border-t-2 border-l-2 border-brand-red rounded-tl-lg" />
      <div className="absolute top-2 right-2 w-8 h-8 border-t-2 border-r-2 border-brand-red rounded-tr-lg" />
      <div className="absolute bottom-2 left-2 w-8 h-8 border-b-2 border-l-2 border-brand-red rounded-bl-lg" />
      <div className="absolute bottom-2 right-2 w-8 h-8 border-b-2 border-r-2 border-brand-red rounded-br-lg" />
    </div>
  );
}

/** Enhanced knockout bracket view with team colors */
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
        <div className="w-6 h-6 rounded-lg bg-gradient-to-br from-orange-500 to-orange-400 flex items-center justify-center shadow-lg shadow-orange-500/20">
          <Swords className="w-3.5 h-3.5 text-white" />
        </div>
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
                    <Badge className="bg-gradient-to-r from-brand-red to-brand-red-light text-white text-[10px] border-0 font-bold shadow-lg shadow-brand-red/20">
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
                              ? 'border-brand-red/50 bg-gradient-to-br from-brand-red/5 to-brand-red/10 dark:from-brand-red/10 dark:to-brand-red/20 ring-2 ring-brand-red/30 shadow-lg shadow-brand-red/10'
                              : isCompleted
                                ? 'border-warm-200 dark:border-warm-700 bg-white dark:bg-warm-800/50 shadow-sm'
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
                                <div className="w-6 h-6 rounded-lg flex items-center justify-center text-[9px] font-bold text-white shrink-0 shadow-sm" style={{ backgroundColor: team1.color }}>
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
                              <span className={`font-mono font-bold text-xs px-1.5 py-0.5 rounded ${match.winnerId === match.team1Id ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' : 'text-warm-500'}`}>
                                {match.team1Score}
                              </span>
                            )}
                          </div>
                          <div className="border-t border-warm-100 dark:border-warm-700/50 my-0.5 flex items-center justify-center">
                            <span className="text-[8px] text-warm-300 dark:text-warm-600 bg-warm-50 dark:bg-warm-800 px-1 rounded font-bold">VS</span>
                          </div>
                          {/* Team 2 */}
                          <div className={`flex items-center gap-2 py-1 ${match.winnerId === match.team2Id ? 'font-bold' : ''}`}>
                            {team2 ? (
                              <>
                                <div className="w-6 h-6 rounded-lg flex items-center justify-center text-[9px] font-bold text-white shrink-0 shadow-sm" style={{ backgroundColor: team2.color }}>
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
                              <span className={`font-mono font-bold text-xs px-1.5 py-0.5 rounded ${match.winnerId === match.team2Id ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' : 'text-warm-500'}`}>
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
                                <div className="w-6 h-6 rounded-lg flex items-center justify-center text-[9px] font-bold text-white shrink-0" style={{ backgroundColor: team1.color }}>
                                  {team1.shortName?.charAt(0) || team1.name.charAt(0)}
                                </div>
                                <span className="truncate text-warm-500 dark:text-warm-400">{team1.name}</span>
                              </>
                            ) : (
                              <span className="text-warm-400 italic">TBD</span>
                            )}
                          </div>
                          <div className="text-warm-300 dark:text-warm-600 text-center py-0.5 text-[10px] font-bold">VS</div>
                          <div className="flex items-center gap-2 py-0.5">
                            {team2 ? (
                              <>
                                <div className="w-6 h-6 rounded-lg flex items-center justify-center text-[9px] font-bold text-white shrink-0" style={{ backgroundColor: team2.color }}>
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
                <div className="w-16 h-16 mx-auto mb-3 rounded-2xl bg-warm-100 dark:bg-warm-800 flex items-center justify-center">
                  <Target className="w-8 h-8 text-warm-300 dark:text-warm-600" />
                </div>
                <p className="text-sm text-warm-400 dark:text-warm-500 font-medium">No bracket generated yet</p>
                <p className="text-[10px] text-warm-400 dark:text-warm-500 mt-1">Add teams and generate a bracket to see the tournament tree</p>
              </div>
            )}
          </div>
        </div>
      )}
    </motion.div>
  );
}

/** Enhanced skeleton loader with shimmer */
function SkeletonCard() {
  return (
    <div className="relative overflow-hidden rounded-2xl bg-white dark:bg-warm-800/50 border border-warm-200/60 dark:border-warm-700/60 shadow-sm">
      <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-gradient-to-b from-warm-200 to-warm-300 dark:from-warm-700 dark:to-warm-600 rounded-l-2xl" />
      <div className="p-4 pl-5 space-y-3">
        <div className="flex items-start justify-between">
          <div className="space-y-2 flex-1">
            <div className="h-4 w-3/4 rounded-lg bg-warm-200 dark:bg-warm-700" />
            <div className="flex gap-2">
              <div className="h-5 w-16 rounded-md bg-warm-100 dark:bg-warm-700/50" />
              <div className="h-5 w-20 rounded-md bg-warm-100 dark:bg-warm-700/50" />
            </div>
            <div className="h-3 w-1/2 rounded-lg bg-warm-100 dark:bg-warm-700/50" />
            <div className="h-3 w-2/3 rounded-lg bg-warm-100 dark:bg-warm-700/50" />
          </div>
          <div className="space-y-2">
            <div className="h-5 w-14 rounded-md bg-warm-200 dark:bg-warm-700" />
            <div className="flex gap-1.5">
              <div className="h-5 w-8 rounded-md bg-warm-100 dark:bg-warm-700/50" />
              <div className="h-5 w-8 rounded-md bg-warm-100 dark:bg-warm-700/50" />
            </div>
          </div>
        </div>
        <div className="flex items-center justify-between">
          <div className="flex -space-x-1.5">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="w-7 h-7 rounded-full bg-warm-200 dark:bg-warm-700 border-2 border-white dark:border-warm-800" />
            ))}
          </div>
          <div className="h-2.5 w-24 rounded-full bg-warm-200 dark:bg-warm-700" />
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

/** Enhanced beautiful empty state with illustration-style design */
function EmptyState({ content, onCta, isPremium }: { content: { icon: string; title: string; description: string; cta: string | null }; onCta: () => void; isPremium: boolean }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="py-6"
    >
      <Card className="p-8 text-center border-warm-200/60 dark:border-warm-700/60 bg-white dark:bg-warm-800/50 overflow-hidden relative">
        {/* Decorative background elements */}
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute top-0 left-0 w-32 h-32 rounded-full bg-brand-red/5 dark:bg-brand-red/10 blur-3xl -translate-x-1/2 -translate-y-1/2" />
          <div className="absolute bottom-0 right-0 w-40 h-40 rounded-full bg-brand-gold/5 dark:bg-brand-gold/10 blur-3xl translate-x-1/2 translate-y-1/2" />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-60 h-60 rounded-full bg-brand-teal/3 dark:bg-brand-teal/5 blur-3xl" />
        </div>
        <KabaddiPattern />

        <div className="relative">
          {/* Animated trophy/emoji with floating effect */}
          <motion.div
            animate={{ y: [0, -8, 0] }}
            transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
            className="inline-block mb-4"
          >
            <div className="text-6xl relative">
              {content.icon}
              <motion.div
                className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-12 h-2 bg-warm-800/5 dark:bg-warm-200/5 rounded-full blur-sm"
                animate={{ scale: [1, 0.8, 1] }}
                transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
              />
            </div>
          </motion.div>

          <motion.h3
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.2 }}
            className="text-warm-700 dark:text-warm-200 text-lg font-bold"
          >
            {content.title}
          </motion.h3>
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3 }}
            className="text-warm-400 dark:text-warm-500 text-sm mt-2 max-w-xs mx-auto leading-relaxed"
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
                className="mt-6 bg-gradient-to-r from-brand-red to-brand-red-light text-white rounded-xl font-bold shadow-lg shadow-brand-red/25 h-11 px-6"
              >
                <Plus className="w-4 h-4 mr-1.5" />
                {content.cta}
                <ArrowRight className="w-4 h-4 ml-1.5" />
              </Button>
            </motion.div>
          )}
          {!content.cta && isPremium && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
            >
              <Button
                onClick={onCta}
                className="mt-6 bg-gradient-to-r from-brand-gold-dark via-brand-gold to-brand-gold-light text-white rounded-xl font-bold shadow-lg shadow-brand-gold/25 h-11 px-6"
              >
                <Crown className="w-4 h-4 mr-1.5" />
                Create Tournament
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
  const isPremium = currentUser?.isPremium || currentUser?.isAdmin || false;

  const [statusFilter, setStatusFilter] = useState<'ongoing' | 'upcoming' | 'past'>('ongoing');
  const [genderFilter, setGenderFilter] = useState<'all' | 'male' | 'female'>('all');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [showUpgrade, setShowUpgrade] = useState(false);
  const [generatingBracket, setGeneratingBracket] = useState(false);

  // ─── Android Back Button Support ──────────────────────────────────
  useBackButton(showUpgrade, () => setShowUpgrade(false));
  useBackButton(createOpen, () => setCreateOpen(false));

  // ─── Tournament Transfer State ────────────────────────────────────
  const [transferDialogOpen, setTransferDialogOpen] = useState(false);
  const [transferTournament, setTransferTournament] = useState<Tournament | null>(null);
  const [transferCode, setTransferCode] = useState<string | null>(null);
  const [transferExpiry, setTransferExpiry] = useState<Date | null>(null);
  const [generatingTransfer, setGeneratingTransfer] = useState(false);

  // Receive tournament state
  const [receiveDialogOpen, setReceiveDialogOpen] = useState(false);
  const [receiveCode, setReceiveCode] = useState('');
  const [receiveValidating, setReceiveValidating] = useState(false);
  const [receiveError, setReceiveError] = useState<string | null>(null);
  const [receivePreview, setReceivePreview] = useState<any>(null);
  const [receiveClaiming, setReceiveClaiming] = useState(false);

  useBackButton(transferDialogOpen, () => { setTransferDialogOpen(false); setTransferCode(null); });
  useBackButton(receiveDialogOpen, () => { setReceiveDialogOpen(false); setReceiveCode(''); setReceiveError(null); setReceivePreview(null); });

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
    weightCategory: 'open',
    type: 'knockout',
  });
  // Weight category type for tournament: 'open' | 'weight'
  const [tournamentWeightType, setTournamentWeightType] = useState<'open' | 'weight'>('open');
  const [tournamentWeightInput, setTournamentWeightInput] = useState('');

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

  // Tournament detail data for expanded view
  const [tournamentMatches, setTournamentMatches] = useState<TournamentMatch[]>([]);
  const [topRaiders, setTopRaiders] = useState<TournamentPlayer[]>([]);
  const [topDefenders, setTopDefenders] = useState<TournamentPlayer[]>([]);
  const [detailLoading, setDetailLoading] = useState(false);

  // Fetch tournament detail when expanded
  useEffect(() => {
    if (expandedId) {
      const fetchDetail = async () => {
        setDetailLoading(true);
        try {
          const res = await fetch(`/api/tournaments/${expandedId}`);
          if (res.ok) {
            const data = await res.json();
            const t = data.tournament;
            // Extract matches
            if (t.matches) {
              setTournamentMatches(t.matches.map((m: Record<string, unknown>) => ({
                id: m.id as string,
                homeTeamId: m.homeTeamId as string,
                awayTeamId: m.awayTeamId as string,
                homeScore: (m.homeScore as number) || 0,
                awayScore: (m.awayScore as number) || 0,
                status: (m.status as string) || 'upcoming',
                startedAt: (m.startedAt as string) || null,
                completedAt: (m.completedAt as string) || null,
                round: (m.round as number) || undefined,
                position: (m.position as number) || undefined,
              })));
            }
            // Extract top scorers from team members
            const raiders: TournamentPlayer[] = [];
            const defenders: TournamentPlayer[] = [];
            const currentTournament = tournaments.find((tt) => tt.id === expandedId);
            if (t.entries) {
              for (const entry of t.entries) {
                if (entry.team?.members) {
                  for (const member of entry.team.members) {
                    if (member.user?.profile) {
                      const p = member.user.profile;
                      raiders.push({
                        id: p.id,
                        userId: member.user.id,
                        name: member.user.name || 'Unknown',
                        avatar: member.user.avatar,
                        teamId: entry.teamId,
                        raidPoints: p.raidPoints || 0,
                        tacklePoints: p.tacklePoints || 0,
                        totalPoints: p.totalPoints || 0,
                      });
                      defenders.push({
                        id: p.id,
                        userId: member.user.id,
                        name: member.user.name || 'Unknown',
                        avatar: member.user.avatar,
                        teamId: entry.teamId,
                        raidPoints: p.raidPoints || 0,
                        tacklePoints: p.tacklePoints || 0,
                        totalPoints: p.totalPoints || 0,
                      });
                    }
                  }
                }
              }
            }
            setTopRaiders(raiders.sort((a, b) => b.raidPoints - a.raidPoints).slice(0, 5));
            setTopDefenders(defenders.sort((a, b) => b.tacklePoints - a.tacklePoints).slice(0, 5));
          }
        } catch {
          // silently fail
        } finally {
          setDetailLoading(false);
        }
      };
      fetchDetail();
    } else {
      setTournamentMatches([]);
      setTopRaiders([]);
      setTopDefenders([]);
    }
  }, [expandedId, tournaments]);

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
        setTournaments((data.tournaments || []).map((t: Tournament) => ({ ...t, teams: t.teams ?? [] })));
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

  // ─── Tournament Transfer Handlers ─────────────────────────────────
  const handleGenerateTransfer = useCallback(async (tournament: Tournament) => {
    setTransferTournament(tournament);
    setTransferDialogOpen(true);
    setTransferCode(null);
    setGeneratingTransfer(true);
    try {
      const res = await fetch('/api/tournament-transfer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tournamentId: tournament.id,
          organizerUserId: currentUser?.id,
          organizerName: currentUser?.name,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast({ title: 'Error', description: data.error || 'Failed to generate code', variant: 'destructive' });
        setTransferDialogOpen(false);
        return;
      }
      setTransferCode(data.transferCode);
      setTransferExpiry(new Date(data.expiresAt));
    } catch {
      toast({ title: 'Error', description: 'Failed to generate transfer code', variant: 'destructive' });
      setTransferDialogOpen(false);
    } finally {
      setGeneratingTransfer(false);
    }
  }, [currentUser, toast]);

  const handleValidateReceiveCode = useCallback(async () => {
    if (!receiveCode.trim()) return;
    setReceiveValidating(true);
    setReceiveError(null);
    setReceivePreview(null);
    try {
      const res = await fetch(`/api/tournament-transfer?code=${receiveCode.trim().toUpperCase()}`);
      const data = await res.json();
      if (!res.ok) {
        setReceiveError(data.error || 'Invalid code');
        return;
      }
      setReceivePreview(data);
    } catch {
      setReceiveError('Failed to validate code');
    } finally {
      setReceiveValidating(false);
    }
  }, [receiveCode]);

  const handleClaimTournament = useCallback(async () => {
    if (!receivePreview || !currentUser?.id) return;
    setReceiveClaiming(true);
    try {
      const res = await fetch('/api/tournament-transfer/claim', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          transferCode: receivePreview.transferCode,
          newOrganizerId: currentUser.id,
          newOrganizerName: currentUser.name,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setReceiveError(data.error || 'Failed to claim tournament');
        return;
      }
      toast({ title: 'Tournament Received!', description: `You now manage "${data.tournament?.name || 'the tournament'}"` });
      setReceiveDialogOpen(false);
      setReceiveCode('');
      setReceivePreview(null);
      fetchTournaments();
    } catch {
      setReceiveError('Failed to claim tournament');
    } finally {
      setReceiveClaiming(false);
    }
  }, [receivePreview, currentUser, toast, fetchTournaments]);

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
          weightCategory: tournamentWeightType === 'open' ? 'open' : tournamentWeightInput.trim(),
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
    setNewTournament({ name: '', venue: '', gender: 'male', weightCategory: 'open', type: 'knockout' });
    setTournamentWeightType('open');
    setTournamentWeightInput('');
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

  // Tournament type badge styling with enhanced gradients
  const getTypeBadge = (type: string) => {
    switch (type) {
      case 'knockout':
        return { bg: 'bg-orange-500/10 dark:bg-orange-500/20', text: 'text-orange-600 dark:text-orange-400', icon: <Swords className="w-3 h-3" />, border: 'border-orange-500/30', gradient: 'from-orange-500 to-orange-400', gradientBg: 'bg-gradient-to-r from-orange-500 to-orange-400' };
      case 'league':
        return { bg: 'bg-emerald-500/10 dark:bg-emerald-500/20', text: 'text-emerald-600 dark:text-emerald-400', icon: <Trophy className="w-3 h-3" />, border: 'border-emerald-500/30', gradient: 'from-emerald-500 to-emerald-400', gradientBg: 'bg-gradient-to-r from-emerald-500 to-emerald-400' };
      case 'hybrid':
        return { bg: 'bg-purple-500/10 dark:bg-purple-500/20', text: 'text-purple-600 dark:text-purple-400', icon: <Sparkles className="w-3 h-3" />, border: 'border-purple-500/30', gradient: 'from-purple-500 to-purple-400', gradientBg: 'bg-gradient-to-r from-purple-500 to-purple-400' };
      default:
        return { bg: 'bg-warm-200 dark:bg-warm-700', text: 'text-warm-600 dark:text-warm-300', icon: <Trophy className="w-3 h-3" />, border: 'border-warm-400/30', gradient: 'from-warm-500 to-warm-400', gradientBg: 'bg-gradient-to-r from-warm-500 to-warm-400' };
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

  // Count active filters
  const activeFilterCount = (typeFilter !== 'all' ? 1 : 0) + (genderFilter !== 'all' ? 1 : 0);

  // Host tournament steps config
  const hostSteps = [
    { label: 'Details', icon: Trophy },
    { label: 'Format', icon: LayoutGrid },
    { label: 'Review', icon: Star },
  ];

  return (
    <div className="px-4 py-6 space-y-5">
      {/* Premium Upgrade Modal - rendered through Portal */}
      <Portal>
      {showUpgrade && (
        <PremiumUpgradeScreen
          onClose={() => setShowUpgrade(false)}
          feature="Host Tournaments"
        />
      )}
      </Portal>

      {/* ═══════════════════════════════════════════════════════════════════
          HEADER WITH DECORATIVE BANNER
          ═══════════════════════════════════════════════════════════════════ */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: 'easeOut' }}
        className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-brand-red via-brand-red-light to-brand-red-dark dark:from-brand-red-dark dark:via-brand-red dark:to-brand-red-light p-5 shadow-xl shadow-brand-red/20"
      >
        {/* Kabaddi court pattern overlay */}
        <KabaddiPattern />

        {/* Decorative floating elements */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <motion.div
            className="absolute top-3 right-6 text-white/10 text-5xl"
            animate={{ rotate: [0, 10, -10, 0], y: [0, -5, 0] }}
            transition={{ duration: 6, repeat: Infinity, ease: 'easeInOut' }}
          >
            🏆
          </motion.div>
          <motion.div
            className="absolute bottom-2 right-16 text-white/5 text-3xl"
            animate={{ y: [0, -3, 0] }}
            transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut', delay: 1 }}
          >
            ⚔️
          </motion.div>
          <div className="absolute -top-10 -left-10 w-32 h-32 rounded-full bg-white/5 blur-2xl" />
          <div className="absolute -bottom-8 -right-8 w-24 h-24 rounded-full bg-brand-gold/10 blur-2xl" />
        </div>

        <div className="relative flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2.5">
              <motion.div
                className="w-10 h-10 rounded-xl overflow-hidden shadow-lg ring-2 ring-white/20"
                animate={{ rotate: [0, -5, 5, 0] }}
                transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
              >
                <img
                  src="/app-icon.png"
                  alt="Kabaddi Pro"
                  className="w-full h-full object-cover"
                />
              </motion.div>
              <h1 className="text-xl font-extrabold text-white tracking-tight">
                Tournaments
              </h1>
            </div>
            <p className="text-white/70 text-xs mt-1 ml-[50px] font-medium">
              Find, join, or host kabaddi tournaments
            </p>
          </div>
          <motion.div whileTap={{ scale: 0.95 }}>
            <Button
              onClick={() => setReceiveDialogOpen(true)}
              className="rounded-xl h-11 px-4 font-bold text-sm bg-white/15 backdrop-blur-sm hover:bg-white/25 text-white border border-white/20 shadow-lg"
            >
              <ArrowRightLeft className="w-4 h-4 mr-1.5" />
              Receive
            </Button>
            <Button
              onClick={handleCreateClick}
              className={`rounded-xl h-11 px-5 font-bold text-sm ${
                isPremium
                  ? 'bg-white/20 backdrop-blur-sm hover:bg-white/30 text-white border border-white/30 shadow-lg'
                  : 'bg-gradient-to-r from-brand-gold-dark via-brand-gold to-brand-gold-light text-white hover:opacity-90 shadow-lg shadow-brand-gold/30 border border-brand-gold-light/30'
              }`}
            >
              {isPremium ? (
                <>
                  <Plus className="w-4 h-4 mr-1.5" />
                  Create
                </>
              ) : (
                <>
                  <motion.div
                    animate={{ rotate: [0, 15, -15, 0] }}
                    transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
                  >
                    <Crown className="w-4 h-4 mr-1.5" />
                  </motion.div>
                  Host
                  <Lock className="w-3 h-3 ml-1" />
                </>
              )}
            </Button>
          </motion.div>
        </div>
      </motion.div>

      {/* ═══════════════════════════════════════════════════════════════════
          HOST TOURNAMENT DIALOG (Step-by-step)
          ═══════════════════════════════════════════════════════════════════ */}
      <Dialog open={createOpen} onOpenChange={(open) => { if (!open) { setCreateOpen(false); setHostStep(0); } }}>
        <DialogContent className="bg-warm-50 dark:bg-warm-900 border-warm-300 dark:border-warm-700 max-w-md">
          <DialogHeader>
            <DialogTitle className="text-warm-800 dark:text-warm-100 flex items-center gap-2">
              Host Tournament
              <Badge className="bg-gradient-to-r from-brand-gold-dark to-brand-gold text-white text-[10px] border-0 shadow-sm shadow-brand-gold/20">
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
                    className={`w-9 h-9 rounded-xl flex items-center justify-center text-xs font-bold transition-all ${
                      isActive
                        ? 'bg-gradient-to-br from-brand-red to-brand-red-light text-white shadow-lg shadow-brand-red/30'
                        : isCompleted
                          ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/20'
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
          <div className="h-1.5 bg-warm-200 dark:bg-warm-700 rounded-full mb-4 overflow-hidden">
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
                      className={`p-3 rounded-xl border-2 text-sm font-bold transition-all flex items-center justify-center gap-2 ${
                        newTournament.gender === 'male'
                          ? 'border-brand-red bg-brand-red/5 text-brand-red shadow-sm shadow-brand-red/10'
                          : 'border-warm-200 dark:border-warm-700 text-warm-600 dark:text-warm-400 hover:border-warm-300 dark:hover:border-warm-600'
                      }`}
                    >
                      <Mars className="w-4 h-4" />
                      Boys
                    </button>
                    <button
                      onClick={() => setNewTournament({ ...newTournament, gender: 'female' })}
                      className={`p-3 rounded-xl border-2 text-sm font-bold transition-all flex items-center justify-center gap-2 ${
                        newTournament.gender === 'female'
                          ? 'border-pink-500 bg-pink-500/5 text-pink-600 dark:text-pink-400 shadow-sm shadow-pink-500/10'
                          : 'border-warm-200 dark:border-warm-700 text-warm-600 dark:text-warm-400 hover:border-warm-300 dark:hover:border-warm-600'
                      }`}
                    >
                      <Venus className="w-4 h-4" />
                      Girls
                    </button>
                  </div>
                </div>
                <div>
                  <label className="text-xs font-bold text-warm-600 dark:text-warm-300 mb-1.5 block flex items-center gap-1.5">
                    <span>⚖️</span> Weight Category
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={() => { setTournamentWeightType('open'); setTournamentWeightInput(''); }}
                      className={`p-3 rounded-xl border-2 text-xs font-bold transition-all flex flex-col items-center gap-1 ${
                        tournamentWeightType === 'open'
                          ? 'border-amber-500 bg-amber-500/5 text-amber-700 dark:text-amber-300 shadow-sm shadow-amber-500/10'
                          : 'border-warm-200 dark:border-warm-700 text-warm-600 dark:text-warm-400 hover:border-warm-300 dark:hover:border-warm-600'
                      }`}
                    >
                      <span className="text-lg leading-none">♾️</span>
                      Open
                      <span className="text-[9px] font-normal opacity-60">No restriction</span>
                    </button>
                    <button
                      onClick={() => setTournamentWeightType('weight')}
                      className={`p-3 rounded-xl border-2 text-xs font-bold transition-all flex flex-col items-center gap-1 ${
                        tournamentWeightType === 'weight'
                          ? 'border-amber-500 bg-amber-500/5 text-amber-700 dark:text-amber-300 shadow-sm shadow-amber-500/10'
                          : 'border-warm-200 dark:border-warm-700 text-warm-600 dark:text-warm-400 hover:border-warm-300 dark:hover:border-warm-600'
                      }`}
                    >
                      <span className="text-lg leading-none">⚖️</span>
                      Weight
                      <span className="text-[9px] font-normal opacity-60">Enter manually</span>
                    </button>
                  </div>
                  {tournamentWeightType === 'weight' && (
                    <div className="mt-2 relative">
                      <input
                        type="text"
                        placeholder="e.g. 65kg, 70kg, Below 80kg..."
                        value={tournamentWeightInput}
                        onChange={(e) => setTournamentWeightInput(e.target.value)}
                        className="w-full h-10 text-sm font-semibold bg-white dark:bg-warm-800/50 border-2 border-amber-200 dark:border-amber-800/40 focus:border-amber-500 rounded-xl pl-4 pr-10 outline-none"
                        maxLength={30}
                      />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-amber-500 text-sm">⚖️</span>
                    </div>
                  )}
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
                            ? `${badge.bg} ${badge.text} border-current shadow-sm`
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
                <div className="bg-white dark:bg-warm-800 rounded-xl border border-warm-200 dark:border-warm-700 overflow-hidden shadow-sm">
                  <div className={`h-2.5 bg-gradient-to-r ${getTypeBadge(newTournament.type).gradient}`} />
                  <div className="p-4 space-y-3">
                    <h3 className="font-bold text-warm-800 dark:text-warm-100">{newTournament.name || 'Untitled'}</h3>
                    <div className="space-y-2">
                      <div className="flex items-center gap-2 text-sm text-warm-600 dark:text-warm-300">
                        <MapPin className="w-3.5 h-3.5 text-warm-400" />
                        <span>{newTournament.venue || 'No venue'}</span>
                      </div>
                      <div className="flex items-center gap-2 text-sm text-warm-600 dark:text-warm-300">
                        {newTournament.gender === 'male' ? <Mars className="w-3.5 h-3.5 text-brand-red" /> : <Venus className="w-3.5 h-3.5 text-pink-500" />}
                        <span>{newTournament.gender === 'male' ? '♂ Boys' : '♀ Girls'}</span>
                      </div>
                      <div className="flex items-center gap-2 text-sm text-warm-600 dark:text-warm-300">
                        {getTypeBadge(newTournament.type).icon}
                        <span className="capitalize">{newTournament.type} Format</span>
                      </div>
                      <div className="flex items-center gap-2 text-sm text-warm-600 dark:text-warm-300">
                        <span className="text-sm">⚖️</span>
                        <span>{tournamentWeightType === 'open' ? '♾️ Open (No restriction)' : tournamentWeightInput.trim() || 'Not set'}</span>
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

      {/* ═══════════════════════════════════════════════════════════════════
          ENHANCED SEARCH BAR WITH ANIMATED FOCUS
          ═══════════════════════════════════════════════════════════════════ */}
      <div className="relative">
        <motion.div
          className="relative"
          animate={{ scale: searchFocused ? 1.02 : 1 }}
          transition={{ type: 'spring', stiffness: 300, damping: 25 }}
        >
          <motion.div
            className="absolute left-3 top-1/2 -translate-y-1/2"
            animate={{ scale: searchFocused ? 1.1 : 1, rotate: searchFocused ? -10 : 0 }}
            transition={{ type: 'spring', stiffness: 300 }}
          >
            <motion.div
              animate={searchFocused ? { scale: [1, 1.2, 1] } : { scale: 1 }}
              transition={searchFocused ? { duration: 1, repeat: Infinity, ease: 'easeInOut' } : {}}
            >
              <Search className={`w-4 h-4 transition-colors duration-300 ${searchFocused ? 'text-brand-red' : 'text-warm-400'}`} />
            </motion.div>
          </motion.div>
          <Input
            placeholder="Search by name or code (e.g. TC3001)..."
            value={tournamentSearch}
            onChange={(e) => setTournamentSearch(e.target.value)}
            onFocus={() => setSearchFocused(true)}
            onBlur={() => setTimeout(() => setSearchFocused(false), 200)}
            className={`pl-10 pr-9 h-12 bg-white dark:bg-warm-800 border-warm-200 dark:border-warm-700 rounded-2xl text-sm transition-all duration-300 ${
              searchFocused ? 'border-brand-red/50 ring-4 ring-brand-red/10 shadow-xl shadow-brand-red/5' : ''
            }`}
          />
          {tournamentSearch ? (
            <motion.button
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              onClick={() => setTournamentSearch('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 w-6 h-6 rounded-full bg-warm-200 dark:bg-warm-700 flex items-center justify-center text-warm-500 hover:bg-brand-red/10 hover:text-brand-red transition-colors clear-btn-spin"
            >
              <X className="w-3 h-3" />
            </motion.button>
          ) : (
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-mono text-warm-300 dark:text-warm-600 bg-warm-100 dark:bg-warm-700 px-1.5 py-0.5 rounded-md">
              /
            </span>
          )}
          {/* Animated focus border glow */}
          <motion.div
            className="absolute inset-0 rounded-2xl pointer-events-none"
            animate={{
              boxShadow: searchFocused ? '0 0 0 3px rgba(220, 38, 38, 0.1)' : '0 0 0 0px rgba(220, 38, 38, 0)',
            }}
            transition={{ duration: 0.3 }}
          />
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

      {/* ═══════════════════════════════════════════════════════════════════
          ENHANCED FILTER CHIPS AS TOGGLE PILLS
          ═══════════════════════════════════════════════════════════════════ */}
      <div className="space-y-2.5">
        {/* Type Filter Row */}
        <div className="flex gap-2 flex-wrap items-center">
          <motion.button
            onClick={() => setTypeFilter('all')}
            whileTap={{ scale: 0.95 }}
            className={`px-3.5 py-2 rounded-full text-xs font-bold transition-all duration-300 flex items-center gap-1.5 border ${
              typeFilter === 'all'
                ? 'bg-gradient-to-r from-warm-800 to-warm-700 dark:from-warm-200 dark:to-warm-300 text-white dark:text-warm-800 shadow-lg shadow-warm-800/10 dark:shadow-warm-200/10 border-transparent pill-bounce'
                : 'bg-warm-50 dark:bg-warm-800 text-warm-500 dark:text-warm-400 hover:bg-warm-100 dark:hover:bg-warm-700 border-warm-200 dark:border-warm-700'
            }`}
          >
            <Filter className="w-3 h-3" />
            All Types
          </motion.button>
          {(['knockout', 'league', 'hybrid'] as const).map((t) => {
            const badge = getTypeBadge(t);
            return (
              <motion.button
                key={t}
                onClick={() => setTypeFilter(t)}
                whileTap={{ scale: 0.95 }}
                className={`px-3.5 py-2 rounded-full text-xs font-bold capitalize transition-all duration-300 flex items-center gap-1.5 border ${
                  typeFilter === t
                    ? `bg-gradient-to-r ${badge.gradient} text-white shadow-lg border-transparent pill-bounce`
                    : 'bg-warm-50 dark:bg-warm-800 text-warm-500 dark:text-warm-400 hover:bg-warm-100 dark:hover:bg-warm-700 border-warm-200 dark:border-warm-700'
                }`}
              >
                {badge.icon}
                {t}
              </motion.button>
            );
          })}
          {/* Active filter count badge */}
          {activeFilterCount > 0 && (
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              className="w-6 h-6 rounded-full bg-brand-red text-white text-[10px] font-bold flex items-center justify-center shadow-lg shadow-brand-red/20"
            >
              {activeFilterCount}
            </motion.div>
          )}
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════════════════
          ENHANCED PREMIUM UPGRADE CARD WITH SHIMMER
          ═══════════════════════════════════════════════════════════════════ */}
      {!isPremium && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <Card
            className="p-0 bg-gradient-to-r from-brand-gold/15 via-brand-gold/5 to-brand-gold/15 dark:from-brand-gold/25 dark:via-brand-gold/10 dark:to-brand-gold/25 border border-brand-gold/30 cursor-pointer active:scale-[0.98] transition-transform overflow-hidden relative"
            onClick={() => setShowUpgrade(true)}
          >
            {/* Shimmer animation overlay */}
            <motion.div
              className="absolute inset-0 z-10 pointer-events-none"
              animate={{ x: ['-100%', '200%'] }}
              transition={{ duration: 3, repeat: Infinity, ease: 'linear' }}
            >
              <div className="w-1/3 h-full bg-gradient-to-r from-transparent via-brand-gold/15 to-transparent skew-x-12" />
            </motion.div>

            {/* Gradient overlay */}
            <div className="absolute inset-0 bg-gradient-to-br from-brand-gold/5 to-transparent pointer-events-none" />

            <div className="p-4 flex items-center gap-3 relative">
              <motion.div
                className="w-12 h-12 rounded-xl bg-gradient-to-br from-brand-gold/30 to-brand-gold-dark/30 flex items-center justify-center shrink-0 shadow-lg shadow-brand-gold/10 relative"
                animate={{ rotate: [0, 5, -5, 0] }}
                transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
              >
                <Crown className="w-6 h-6 text-brand-gold" />
                {/* Floating sparkle particles */}
                {[...Array(3)].map((_, si) => (
                  <motion.div
                    key={`sparkle-${si}`}
                    className="absolute w-1 h-1 rounded-full bg-brand-gold/60 sparkle-particle"
                    style={{
                      left: `${20 + si * 30}%`,
                      top: '0%',
                      animationDelay: `${si * 0.6}s`,
                    }}
                  />
                ))}
              </motion.div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-warm-800 dark:text-warm-100">Want to host your own tournament?</p>
                <p className="text-[11px] text-warm-500 dark:text-warm-400 mt-0.5">Upgrade to Premium to create and manage tournaments</p>
                {/* Feature bullets */}
                <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-1.5">
                  {['Create Tournaments', 'Add Teams', 'Generate Brackets', 'Track Scores'].map((feature) => (
                    <span key={feature} className="text-[9px] text-warm-500 dark:text-warm-400 flex items-center gap-0.5">
                      <Check className="w-2.5 h-2.5 text-brand-gold" />
                      {feature}
                    </span>
                  ))}
                </div>
              </div>
              <div className="shrink-0">
                <div className="px-3 py-2 rounded-xl bg-gradient-to-r from-brand-gold-dark to-brand-gold text-white font-bold text-xs flex items-center gap-1.5 shadow-lg shadow-brand-gold/20">
                  <Sparkles className="w-3 h-3" />
                  Upgrade
                </div>
              </div>
            </div>
          </Card>
        </motion.div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════
          ENHANCED STATUS TABS
          ═══════════════════════════════════════════════════════════════════ */}
      <div className="flex gap-1 bg-warm-100 dark:bg-warm-800 p-1.5 rounded-2xl">
        {(['ongoing', 'upcoming', 'past'] as const).map((s) => {
          const count = statusCounts[s];
          const tabConfig = {
            ongoing: { icon: <Radio className="w-3 h-3" />, activeColor: 'text-emerald-600 dark:text-emerald-400', gradient: 'from-emerald-500 to-emerald-400' },
            upcoming: { icon: <CalendarDays className="w-3 h-3" />, activeColor: 'text-amber-600 dark:text-amber-400', gradient: 'from-amber-500 to-amber-400' },
            past: { icon: <Award className="w-3 h-3" />, activeColor: 'text-warm-600 dark:text-warm-300', gradient: 'from-warm-500 to-warm-400' },
          }[s];
          const isActive = statusFilter === s;
          return (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`flex-1 px-3 py-2.5 rounded-xl text-sm font-bold capitalize transition-all duration-300 relative flex items-center justify-center gap-1.5 ${
                isActive
                  ? `bg-white dark:bg-warm-700 shadow-lg shadow-warm-800/5 dark:shadow-warm-900/20 ${tabConfig.activeColor}`
                  : 'text-warm-500 dark:text-warm-400 hover:text-warm-700 dark:hover:text-warm-300'
              }`}
            >
              {tabConfig.icon}
              <span>{s}</span>
              {count > 0 && (
                <span className={`text-[10px] font-bold rounded-full px-1.5 py-0.5 min-w-[18px] text-center ${
                  isActive
                    ? `bg-gradient-to-r ${tabConfig.gradient} text-white shadow-sm`
                    : 'bg-warm-200 dark:bg-warm-700 text-warm-500 dark:text-warm-400'
                }`}>
                  {count}
                </span>
              )}
              {isActive && (
                <motion.div
                  className="absolute bottom-0 left-1/4 right-1/4 h-0.5 rounded-full bg-gradient-to-r from-brand-red to-brand-red-light"
                  layoutId="statusIndicator"
                  transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                />
              )}
            </button>
          );
        })}
      </div>

      {/* ═══════════════════════════════════════════════════════════════════
          ENHANCED GENDER FILTER
          ═══════════════════════════════════════════════════════════════════ */}
      <div className="flex gap-2">
        {[
          { id: 'all' as const, label: 'All', icon: <Users className="w-3.5 h-3.5" /> },
          { id: 'male' as const, label: 'Boys', icon: <Mars className="w-3.5 h-3.5" /> },
          { id: 'female' as const, label: 'Girls', icon: <Venus className="w-3.5 h-3.5" /> },
        ].map((f) => (
          <motion.button
            key={f.id}
            onClick={() => setGenderFilter(f.id)}
            whileTap={{ scale: 0.95 }}
            className={`px-4 py-2 rounded-full text-xs font-bold transition-all duration-300 flex items-center gap-1.5 border ${
              genderFilter === f.id
                ? f.id === 'male'
                  ? 'bg-gradient-to-r from-brand-red to-brand-red-light text-white shadow-lg shadow-brand-red/20 border-transparent'
                  : f.id === 'female'
                    ? 'bg-gradient-to-r from-pink-500 to-pink-400 text-white shadow-lg shadow-pink-500/20 border-transparent'
                    : 'bg-gradient-to-r from-warm-800 to-warm-700 dark:from-warm-200 dark:to-warm-300 text-white dark:text-warm-800 shadow-lg border-transparent'
                : 'bg-warm-50 dark:bg-warm-800 text-warm-500 dark:text-warm-400 hover:bg-warm-100 dark:hover:bg-warm-700 border-warm-200 dark:border-warm-700'
            }`}
          >
            {f.icon}
            {f.label}
          </motion.button>
        ))}
      </div>

      {/* ═══════════════════════════════════════════════════════════════════
          ENHANCED TOURNAMENT CARDS
          ═══════════════════════════════════════════════════════════════════ */}
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
        <EmptyState content={getEmptyContent()} onCta={handleCreateClick} isPremium={isPremium} />
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
                <Card className="overflow-hidden border border-warm-200/80 dark:border-warm-700/80 bg-white dark:bg-warm-800/50 relative group hover:shadow-xl hover:shadow-warm-800/5 dark:hover:shadow-warm-900/20 transition-shadow duration-300 tournament-card-lift">
                  <ShimmerOverlay />

                  {/* Animated border gradient flow around card */}
                  <div className="absolute inset-0 rounded-2xl pointer-events-none z-0 overflow-hidden">
                    <div className="absolute inset-0 border-gradient-flow opacity-0 group-hover:opacity-30 transition-opacity duration-500" style={{ WebkitMask: 'linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)', WebkitMaskComposite: 'xor', maskComposite: 'exclude', padding: '1.5px', borderRadius: '16px' }} />
                  </div>

                  {/* Gradient Left Border with animated glow */}
                  <motion.div
                    className={`absolute left-0 top-0 bottom-0 w-1.5 bg-gradient-to-b ${statusGradient} rounded-l-2xl`}
                    whileHover={{ width: 3 }}
                    transition={{ duration: 0.2 }}
                  />

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

                        {/* Tournament Type Badge + Code Row */}
                        <div className="flex items-center gap-2 mt-2 flex-wrap">
                          {/* Format Type Badge with gradient */}
                          <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[9px] font-bold capitalize ${typeBadge.bg} ${typeBadge.text} border ${typeBadge.border} shadow-sm`}>
                            {typeBadge.icon}
                            {tournament.type}
                          </span>

                          {/* Gender Badge */}
                          <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[9px] font-bold ${
                            tournament.gender === 'male'
                              ? 'bg-brand-red/10 text-brand-red border border-brand-red/20'
                              : 'bg-pink-500/10 text-pink-600 dark:text-pink-400 border border-pink-500/20'
                          }`}>
                            {tournament.gender === 'male' ? <Mars className="w-3 h-3" /> : <Venus className="w-3 h-3" />}
                            {tournament.gender === 'male' ? 'Boys' : 'Girls'}
                          </span>

                          {/* Weight Category Badge */}
                          {tournament.weightCategory && (
                            <span className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[9px] font-bold bg-amber-500/10 text-amber-700 dark:text-amber-300 border border-amber-500/20">
                              ⚖️ {tournament.weightCategory === 'open' ? 'Open' : tournament.weightCategory}
                            </span>
                          )}

                          {/* Tournament Code */}
                          {tournament.tournamentCode && (
                            <div
                              className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-brand-teal/10 dark:bg-brand-teal/20 cursor-pointer hover:bg-brand-teal/20 transition-colors border border-brand-teal/20"
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
                        <div className="flex items-center gap-1 mt-2 text-xs text-warm-500 dark:text-warm-400">
                          <MapPin className="w-3 h-3 shrink-0 text-warm-400" />
                          <span className="truncate">{tournament.venue}</span>
                        </div>
                        <div className="flex items-center gap-1 mt-0.5 text-xs text-warm-500 dark:text-warm-400">
                          <Calendar className="w-3 h-3 shrink-0 text-warm-400" />
                          <span>{formatDate(tournament.startDate)}</span>
                        </div>
                      </div>

                      <div className="flex flex-col items-end gap-2 ml-3">
                        {/* Team Count & Match Count visual indicators */}
                        <div className="flex items-center gap-1.5">
                          {/* Team avatar stack with overlapping circles */}
                          <div className="flex avatar-stack">
                            {tournament.teams.slice(0, 4).map((team) => (
                              <div
                                key={team.id}
                                className="w-6 h-6 rounded-full flex items-center justify-center text-[8px] font-bold text-white shadow-sm shrink-0"
                                style={{ backgroundColor: team.color }}
                                title={team.name}
                              >
                                {team.shortName?.charAt(0) || team.name.charAt(0)}
                              </div>
                            ))}
                            {tournament.teams.length > 4 && (
                              <div className="w-6 h-6 rounded-full flex items-center justify-center text-[8px] font-bold bg-warm-200 dark:bg-warm-600 text-warm-600 dark:text-warm-300 shadow-sm shrink-0">
                                +{tournament.teams.length - 4}
                              </div>
                            )}
                          </div>
                          <div className="flex items-center gap-1 text-xs text-warm-600 dark:text-warm-300 bg-warm-100/80 dark:bg-warm-700/50 px-2 py-1 rounded-lg border border-warm-200/50 dark:border-warm-700/50">
                            <Users className="w-3 h-3 text-brand-teal" />
                            <span className="font-bold">{teamCount}</span>
                            <span className="text-warm-400 text-[9px]">teams</span>
                          </div>
                          {tournament.matchCount > 0 && (
                            <div className="flex items-center gap-1 text-xs text-warm-600 dark:text-warm-300 bg-warm-100/80 dark:bg-warm-700/50 px-2 py-1 rounded-lg border border-warm-200/50 dark:border-warm-700/50">
                              <Swords className="w-3 h-3 text-brand-red" />
                              <span className="font-bold">{tournament.matchCount}</span>
                              <span className="text-warm-400 text-[9px]">matches</span>
                            </div>
                          )}
                        </div>

                        {/* View button for quick access */}
                        <motion.button
                          whileTap={{ scale: 0.95 }}
                          onClick={(e) => {
                            e.stopPropagation();
                            setExpandedId(isExpanded ? null : tournament.id);
                          }}
                          className="px-3 py-1.5 rounded-lg bg-gradient-to-r from-brand-red to-brand-red-light text-white text-[10px] font-bold flex items-center gap-1 shadow-lg shadow-brand-red/15 hover:shadow-brand-red/25 transition-shadow"
                        >
                          <Eye className="w-3 h-3" />
                          {isExpanded ? 'Hide' : 'View'}
                        </motion.button>
                      </div>
                    </div>

                    {/* Team Avatars Row + Match Progress */}
                    <div className="flex items-center justify-between mt-3 gap-3">
                      <div className="flex items-center gap-1.5">
                        {/* Team logo/initial grid preview */}
                        <div className="flex -space-x-1.5">
                          {tournament.teams.slice(0, 5).map((team) => (
                            <motion.div
                              key={team.id}
                              whileHover={{ scale: 1.2, zIndex: 10 }}
                              className="w-7 h-7 rounded-full border-2 border-white dark:border-warm-800 flex items-center justify-center text-[8px] font-bold text-white shadow-sm"
                              style={{ backgroundColor: team.color }}
                              title={team.name}
                            >
                              {team.shortName?.charAt(0) || team.name.charAt(0)}
                            </motion.div>
                          ))}
                          {tournament.teams.length > 5 && (
                            <div className="w-7 h-7 rounded-full border-2 border-white dark:border-warm-800 bg-gradient-to-br from-warm-200 to-warm-300 dark:from-warm-600 dark:to-warm-700 flex items-center justify-center text-[8px] font-bold text-warm-600 dark:text-warm-300">
                              +{tournament.teams.length - 5}
                            </div>
                          )}
                        </div>
                        {tournament.teams.length === 0 && (
                          <span className="text-[10px] text-warm-400 dark:text-warm-500 italic">No teams yet</span>
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
                        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-amber-500/10 border border-amber-500/20">
                          <Flame className="w-3 h-3 text-amber-500" />
                          <span className="text-[10px] text-amber-600 dark:text-amber-400 font-bold">Upcoming</span>
                        </div>
                      ) : tournament.status === 'past' ? (
                        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-brand-gold/10 border border-brand-gold/20">
                          <Trophy className="w-3 h-3 text-brand-gold" />
                          <span className="text-[10px] text-brand-gold font-bold">Completed</span>
                        </div>
                      ) : null}

                      {/* Expand/Collapse Icon */}
                      <motion.div
                        animate={{ rotate: isExpanded ? 180 : 0 }}
                        transition={{ duration: 0.2 }}
                        className="p-1 rounded-md hover:bg-warm-100 dark:hover:bg-warm-700 transition-colors"
                      >
                        <ChevronDown className="w-4 h-4 text-warm-400" />
                      </motion.div>
                    </div>
                  </div>

                  {/* ═════════════════════════════════════════════════════════
                      EXPANDED DETAIL VIEW
                      ═════════════════════════════════════════════════════════ */}
                  <AnimatePresence>
                    {isExpanded && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.3, ease: 'easeInOut' }}
                        className="overflow-hidden"
                      >
                        <div className="border-t border-warm-200/80 dark:border-warm-700/80 p-4 bg-gradient-to-b from-warm-50 to-white dark:from-warm-800/40 dark:to-warm-800/20 space-y-4">
                          {/* Tournament Code Display */}
                          {tournament.tournamentCode && (
                            <div className="flex items-center justify-between bg-white dark:bg-warm-800 rounded-xl p-3 border border-warm-200 dark:border-warm-700 shadow-sm">
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
                                <Shield className="w-3 h-3" />
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
                              {tournament.organizerId === currentUser?.id && (
                                <Button
                                  onClick={() => handleGenerateTransfer(tournament)}
                                  variant="outline"
                                  size="sm"
                                  className="rounded-lg h-7 px-2.5 text-[10px] font-bold border-brand-gold text-brand-gold hover:bg-brand-gold/10"
                                >
                                  <ArrowRightLeft className="w-3 h-3 mr-1" />
                                  Handoff
                                </Button>
                              )}
                            </div>
                            <div className="space-y-1.5 max-h-64 overflow-y-auto">
                              {tournament.teams.map((team) => (
                                <div key={team.id} className="flex items-center gap-2.5 text-sm text-warm-700 dark:text-warm-300 group bg-white dark:bg-warm-800/50 rounded-lg px-3 py-2 border border-warm-100 dark:border-warm-700/50 hover:shadow-sm transition-shadow">
                                  <div
                                    className="w-7 h-7 rounded-lg shrink-0 flex items-center justify-center text-white text-[10px] font-bold shadow-sm"
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
                                    <span className="text-[10px] text-warm-500 dark:text-warm-400 font-medium bg-warm-50 dark:bg-warm-700/50 px-1.5 py-0.5 rounded">
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

                          {/* ═══════════════════════════════════════════════════
                              ENHANCED STANDINGS TABLE WITH VISUAL INDICATORS
                              ═══════════════════════════════════════════════════ */}
                          {tournament.teams.length > 0 && (
                            <div>
                              <h4 className="text-xs font-bold text-warm-500 dark:text-warm-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                                <TrendingUp className="w-3 h-3" />
                                Standings
                              </h4>
                              <div className="bg-white dark:bg-warm-800/50 rounded-xl border border-warm-100 dark:border-warm-700/50 overflow-hidden shadow-sm">
                                <div className="grid grid-cols-8 gap-1 text-[10px] text-warm-400 dark:text-warm-500 font-bold uppercase tracking-wider px-3 py-2.5 bg-warm-50 dark:bg-warm-800 border-b border-warm-100 dark:border-warm-700/50">
                                  <span className="col-span-3">Team</span>
                                  <span className="text-center">P</span>
                                  <span className="text-center">W</span>
                                  <span className="text-center">L</span>
                                  <span className="text-center">SD</span>
                                  <span className="text-center">Pts</span>
                                </div>
                                <div className="max-h-48 overflow-y-auto">
                                  {[...tournament.teams].sort((a, b) => b.points - a.points).map((team, idx) => {
                                    const isTopTeam = idx === 0;
                                    return (
                                      <motion.div
                                        key={team.id}
                                        className={`grid grid-cols-8 gap-1 text-warm-700 dark:text-warm-300 px-3 py-2.5 text-xs transition-colors hover:bg-warm-50 dark:hover:bg-warm-700/30 ${idx > 0 ? 'border-t border-warm-50 dark:border-warm-700/30' : ''} ${isTopTeam && team.points > 0 ? 'bg-brand-gold/5 dark:bg-brand-gold/5' : ''}`}
                                        initial={{ opacity: 0, x: -10 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        transition={{ delay: idx * 0.05, duration: 0.3 }}
                                        whileHover={{ backgroundColor: 'rgba(245, 158, 11, 0.05)', x: 2 }}
                                      >
                                        <span className="col-span-3 flex items-center gap-1.5 truncate">
                                          <span className={`text-[9px] font-bold w-4 text-center ${isTopTeam && team.points > 0 ? 'text-brand-gold' : 'text-warm-400 dark:text-warm-500'}`}>
                                            {isTopTeam && team.points > 0 ? '🥇' : idx + 1}
                                          </span>
                                          <div className="w-5 h-5 rounded shrink-0 shadow-sm" style={{ backgroundColor: team.color }} />
                                          <span className="truncate font-medium">{team.name}</span>
                                        </span>
                                        <span className="text-center font-medium">{team.played}</span>
                                        <span className="text-center font-medium text-emerald-600 dark:text-emerald-400">{team.won}</span>
                                        <span className="text-center font-medium">{team.lost}</span>
                                        <span className={`text-center font-medium ${team.scoreDiff > 0 ? 'text-emerald-600 dark:text-emerald-400' : team.scoreDiff < 0 ? 'text-brand-red' : ''}`}>
                                          {team.scoreDiff > 0 ? '+' : ''}{team.scoreDiff}
                                        </span>
                                        <span className="text-center font-bold">
                                          <span className={`inline-flex items-center justify-center w-6 h-5 rounded-md ${isTopTeam && team.points > 0 ? 'bg-brand-gold/20 text-brand-gold-dark dark:text-brand-gold' : 'bg-brand-red/10 text-brand-red'}`}>
                                            {team.points}
                                          </span>
                                        </span>
                                      </motion.div>
                                    );
                                  })}
                                </div>
                              </div>
                            </div>
                          )}

                          {/* ═══════════════════════════════════════════════════
                              STATS SUMMARY
                              ═══════════════════════════════════════════════════ */}
                          {tournamentMatches.length > 0 && (
                            <div>
                              <h4 className="text-xs font-bold text-warm-500 dark:text-warm-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                                <BarChart3 className="w-3 h-3" />
                                Stats Summary
                              </h4>
                              <div className="grid grid-cols-3 gap-2">
                                <div className="bg-white dark:bg-warm-800/50 rounded-xl border border-warm-100 dark:border-warm-700/50 p-3 text-center">
                                  <p className="text-[9px] text-warm-400 dark:text-warm-500 uppercase font-bold tracking-wider">Total Matches</p>
                                  <p className="text-xl font-black text-warm-800 dark:text-warm-100 mt-1">{tournamentMatches.length}</p>
                                </div>
                                <div className="bg-white dark:bg-warm-800/50 rounded-xl border border-warm-100 dark:border-warm-700/50 p-3 text-center">
                                  <p className="text-[9px] text-warm-400 dark:text-warm-500 uppercase font-bold tracking-wider">Total Points</p>
                                  <p className="text-xl font-black text-brand-red mt-1">
                                    {tournamentMatches.reduce((sum, m) => sum + m.homeScore + m.awayScore, 0)}
                                  </p>
                                </div>
                                <div className="bg-white dark:bg-warm-800/50 rounded-xl border border-warm-100 dark:border-warm-700/50 p-3 text-center">
                                  <p className="text-[9px] text-warm-400 dark:text-warm-500 uppercase font-bold tracking-wider">Avg Pts/Match</p>
                                  <p className="text-xl font-black text-brand-gold mt-1">
                                    {tournamentMatches.length > 0
                                      ? (tournamentMatches.reduce((sum, m) => sum + m.homeScore + m.awayScore, 0) / tournamentMatches.length).toFixed(1)
                                      : '0'}
                                  </p>
                                </div>
                              </div>
                            </div>
                          )}

                          {/* ═══════════════════════════════════════════════════
                              TOP SCORERS
                              ═══════════════════════════════════════════════════ */}
                          {(topRaiders.length > 0 || topDefenders.length > 0) && (
                            <div>
                              <h4 className="text-xs font-bold text-warm-500 dark:text-warm-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                                <Award className="w-3 h-3" />
                                Top Scorers
                              </h4>
                              <div className="grid grid-cols-2 gap-2">
                                {/* Top Raiders */}
                                {topRaiders.length > 0 && (
                                  <div className="bg-white dark:bg-warm-800/50 rounded-xl border border-warm-100 dark:border-warm-700/50 overflow-hidden">
                                    <div className="px-3 py-2 bg-gradient-to-r from-orange-50 to-orange-100/50 dark:from-orange-900/20 dark:to-orange-800/10 border-b border-warm-100 dark:border-warm-700/50">
                                      <div className="flex items-center gap-1.5">
                                        <Zap className="w-3 h-3 text-orange-500" />
                                        <span className="text-[9px] font-bold text-orange-600 dark:text-orange-400 uppercase tracking-wider">Top Raiders</span>
                                      </div>
                                    </div>
                                    <div className="divide-y divide-warm-50 dark:divide-warm-700/30">
                                      {topRaiders.map((player, idx) => {
                                        const team = tournament.teams.find(t => t.id === player.teamId);
                                        return (
                                          <motion.div
                                            key={player.id}
                                            className="flex items-center gap-2 px-3 py-2"
                                            initial={{ opacity: 0, x: -8 }}
                                            animate={{ opacity: 1, x: 0 }}
                                            transition={{ delay: idx * 0.05 }}
                                          >
                                            <span className={`text-[9px] font-bold w-4 text-center ${idx === 0 ? 'text-brand-gold' : 'text-warm-400 dark:text-warm-500'}`}>
                                              {idx + 1}
                                            </span>
                                            <div className="w-6 h-6 rounded-full bg-warm-100 dark:bg-warm-700 flex items-center justify-center text-[8px] font-bold text-warm-600 dark:text-warm-300 shrink-0">
                                              {player.name.charAt(0)}
                                            </div>
                                            <div className="flex-1 min-w-0">
                                              <p className="text-[11px] font-medium text-warm-800 dark:text-warm-200 truncate">{player.name}</p>
                                              {team && (
                                                <div className="flex items-center gap-1">
                                                  <div className="w-2 h-2 rounded-full" style={{ backgroundColor: team.color }} />
                                                  <span className="text-[8px] text-warm-400 dark:text-warm-500 truncate">{team.name}</span>
                                                </div>
                                              )}
                                            </div>
                                            <span className="text-xs font-black text-orange-500">{player.raidPoints}</span>
                                          </motion.div>
                                        );
                                      })}
                                    </div>
                                  </div>
                                )}
                                {/* Top Defenders */}
                                {topDefenders.length > 0 && (
                                  <div className="bg-white dark:bg-warm-800/50 rounded-xl border border-warm-100 dark:border-warm-700/50 overflow-hidden">
                                    <div className="px-3 py-2 bg-gradient-to-r from-teal-50 to-teal-100/50 dark:from-teal-900/20 dark:to-teal-800/10 border-b border-warm-100 dark:border-warm-700/50">
                                      <div className="flex items-center gap-1.5">
                                        <Shield className="w-3 h-3 text-teal-600" />
                                        <span className="text-[9px] font-bold text-teal-600 dark:text-teal-400 uppercase tracking-wider">Top Defenders</span>
                                      </div>
                                    </div>
                                    <div className="divide-y divide-warm-50 dark:divide-warm-700/30">
                                      {topDefenders.map((player, idx) => {
                                        const team = tournament.teams.find(t => t.id === player.teamId);
                                        return (
                                          <motion.div
                                            key={player.id}
                                            className="flex items-center gap-2 px-3 py-2"
                                            initial={{ opacity: 0, x: -8 }}
                                            animate={{ opacity: 1, x: 0 }}
                                            transition={{ delay: idx * 0.05 }}
                                          >
                                            <span className={`text-[9px] font-bold w-4 text-center ${idx === 0 ? 'text-brand-gold' : 'text-warm-400 dark:text-warm-500'}`}>
                                              {idx + 1}
                                            </span>
                                            <div className="w-6 h-6 rounded-full bg-warm-100 dark:bg-warm-700 flex items-center justify-center text-[8px] font-bold text-warm-600 dark:text-warm-300 shrink-0">
                                              {player.name.charAt(0)}
                                            </div>
                                            <div className="flex-1 min-w-0">
                                              <p className="text-[11px] font-medium text-warm-800 dark:text-warm-200 truncate">{player.name}</p>
                                              {team && (
                                                <div className="flex items-center gap-1">
                                                  <div className="w-2 h-2 rounded-full" style={{ backgroundColor: team.color }} />
                                                  <span className="text-[8px] text-warm-400 dark:text-warm-500 truncate">{team.name}</span>
                                                </div>
                                              )}
                                            </div>
                                            <span className="text-xs font-black text-teal-600 dark:text-teal-400">{player.tacklePoints}</span>
                                          </motion.div>
                                        );
                                      })}
                                    </div>
                                  </div>
                                )}
                              </div>
                            </div>
                          )}

                          {/* ═══════════════════════════════════════════════════
                              MATCH SCHEDULE (Calendar-Style)
                              ═══════════════════════════════════════════════════ */}
                          {tournamentMatches.length > 0 && (
                            <div>
                              <h4 className="text-xs font-bold text-warm-500 dark:text-warm-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                                <CalendarDays className="w-3 h-3" />
                                Match Schedule
                              </h4>
                              <div className="bg-white dark:bg-warm-800/50 rounded-xl border border-warm-100 dark:border-warm-700/50 overflow-hidden shadow-sm">
                                <div className="grid grid-cols-12 gap-1 text-[9px] text-warm-400 dark:text-warm-500 font-bold uppercase tracking-wider px-3 py-2 bg-warm-50 dark:bg-warm-800 border-b border-warm-100 dark:border-warm-700/50">
                                  <span className="col-span-1">#</span>
                                  <span className="col-span-5">Match</span>
                                  <span className="col-span-2 text-center">Score</span>
                                  <span className="col-span-2 text-center">Date</span>
                                  <span className="col-span-2 text-center">Status</span>
                                </div>
                                <div className="max-h-40 overflow-y-auto">
                                  {tournamentMatches.map((match, idx) => {
                                    const homeTeam = tournament.teams.find(t => t.id === match.homeTeamId);
                                    const awayTeam = tournament.teams.find(t => t.id === match.awayTeamId);
                                    const matchDate = match.startedAt
                                      ? new Date(match.startedAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })
                                      : '—';
                                    const statusColor = match.status === 'completed'
                                      ? 'text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/20'
                                      : match.status === 'live'
                                        ? 'text-brand-red bg-brand-red/10'
                                        : 'text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20';

                                    return (
                                      <motion.div
                                        key={match.id}
                                        className="grid grid-cols-12 gap-1 text-warm-700 dark:text-warm-300 px-3 py-2 text-[10px] transition-colors hover:bg-warm-50 dark:hover:bg-warm-700/30 border-t border-warm-50 dark:border-warm-700/30"
                                        initial={{ opacity: 0, y: 5 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        transition={{ delay: idx * 0.03 }}
                                      >
                                        <span className="col-span-1 font-mono text-warm-400 dark:text-warm-500">{idx + 1}</span>
                                        <span className="col-span-5 flex items-center gap-1 truncate">
                                          {homeTeam && (
                                            <div className="w-3 h-3 rounded-sm shrink-0" style={{ backgroundColor: homeTeam.color }} />
                                          )}
                                          <span className="truncate">{homeTeam?.shortName || homeTeam?.name || 'TBD'}</span>
                                          <span className="text-warm-300 dark:text-warm-600">vs</span>
                                          {awayTeam && (
                                            <div className="w-3 h-3 rounded-sm shrink-0" style={{ backgroundColor: awayTeam.color }} />
                                          )}
                                          <span className="truncate">{awayTeam?.shortName || awayTeam?.name || 'TBD'}</span>
                                        </span>
                                        <span className="col-span-2 text-center font-bold tabular-nums">
                                          {match.status === 'completed' || match.status === 'live'
                                            ? `${match.homeScore}-${match.awayScore}`
                                            : '—'}
                                        </span>
                                        <span className="col-span-2 text-center text-warm-400 dark:text-warm-500">{matchDate}</span>
                                        <span className={`col-span-2 text-center`}>
                                          <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[8px] font-bold capitalize ${statusColor}`}>
                                            {match.status === 'live' && (
                                              <span className="relative flex h-1.5 w-1.5 mr-1">
                                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-brand-red opacity-75" />
                                                <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-brand-red" />
                                              </span>
                                            )}
                                            {match.status}
                                          </span>
                                        </span>
                                      </motion.div>
                                    );
                                  })}
                                </div>
                              </div>
                            </div>
                          )}

                          {/* Generate Bracket Button (upcoming) */}
                          {tournament.status === 'upcoming' && tournament.teams.length >= 2 && (
                            <Button
                              onClick={() => handleGenerateBracket(tournament.id, tournament.teams.map(t => t.id))}
                              disabled={generatingBracket}
                              className="w-full bg-gradient-to-r from-brand-red to-brand-red-light hover:from-brand-red-dark hover:to-brand-red text-white rounded-xl h-11 text-xs font-bold shadow-lg shadow-brand-red/20"
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

      {/* ═══════════════════════════════════════════════════════════════════
          ADD TEAM DIALOG
          ═══════════════════════════════════════════════════════════════════ */}
      <Dialog open={!!addTeamDialogOpen} onOpenChange={(open) => { if (!open) setAddTeamDialogOpen(null); }}>
        <DialogContent className="bg-warm-50 dark:bg-warm-900 border-warm-300 dark:border-warm-700 max-h-[80vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="text-warm-800 dark:text-warm-100 flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-brand-teal/20 to-brand-teal/10 flex items-center justify-center">
                <UserPlus className="w-4 h-4 text-brand-teal" />
              </div>
              Add Teams
              {selectedTeamIds.length > 0 && (
                <Badge className="bg-gradient-to-r from-brand-teal to-brand-teal-light text-white text-[10px] border-0 shadow-sm">
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
                                ? 'bg-brand-teal/10 ring-2 ring-brand-teal/50 shadow-sm'
                                : 'hover:bg-warm-50 dark:hover:bg-warm-800 active:bg-warm-100 dark:active:bg-warm-700'
                          }`}
                        >
                          <div
                            className="w-9 h-9 rounded-lg flex items-center justify-center text-xs font-bold text-white overflow-hidden shrink-0 shadow-sm"
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
                            <Badge className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-[9px] border-0">In</Badge>
                          ) : isSelected ? (
                            <div className="w-6 h-6 rounded-full bg-gradient-to-r from-brand-teal to-brand-teal-light flex items-center justify-center shadow-sm">
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
              className="w-full bg-gradient-to-r from-brand-teal to-brand-teal-light hover:from-brand-teal-dark hover:to-brand-teal text-white rounded-xl font-bold shadow-lg shadow-brand-teal/20"
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

      {/* ═══════════════════════════════════════════════════════════════════
          REMOVE TEAM CONFIRMATION
          ═══════════════════════════════════════════════════════════════════ */}
      <Dialog open={!!removeTeamId} onOpenChange={(open) => { if (!open) setRemoveTeamId(null); }}>
        <DialogContent className="bg-warm-50 dark:bg-warm-900 border-warm-300 dark:border-warm-700">
          <DialogHeader>
            <DialogTitle className="text-warm-800 dark:text-warm-100 flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-brand-red/10 flex items-center justify-center">
                <Trash2 className="w-3.5 h-3.5 text-brand-red" />
              </div>
              Remove Team?
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-warm-600 dark:text-warm-300">
            This will remove the team and any upcoming matches involving them. This cannot be undone.
          </p>
          <div className="flex gap-2 mt-3">
            <Button
              variant="outline"
              onClick={() => setRemoveTeamId(null)}
              className="flex-1 rounded-xl font-bold"
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
              className="flex-1 bg-gradient-to-r from-brand-red to-brand-red-light hover:from-brand-red-dark hover:to-brand-red text-white rounded-xl font-bold shadow-lg shadow-brand-red/20"
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

      {/* ═══ Tournament Transfer (Handoff) Dialog ═══ */}
      <Dialog open={transferDialogOpen} onOpenChange={(open) => { if (!open) { setTransferDialogOpen(false); setTransferCode(null); } }}>
        <DialogContent className="bg-warm-50 dark:bg-warm-900 border-warm-300 dark:border-warm-700 max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-warm-800 dark:text-warm-100 flex items-center gap-2">
              <ArrowRightLeft className="w-4 h-4 text-brand-gold" />
              Tournament Handoff
            </DialogTitle>
            <DialogDescription className="text-warm-500 dark:text-warm-400">
              Share this code with the new organizer. They enter it via "Receive" to take over management of "{transferTournament?.name}".
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {generatingTransfer ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-8 h-8 animate-spin text-brand-gold" />
              </div>
            ) : transferCode ? (
              <>
                <div className="text-center bg-gradient-to-br from-brand-gold/10 to-amber-500/10 rounded-xl p-6 border border-brand-gold/20">
                  <p className="text-[10px] uppercase tracking-wider font-bold text-warm-400 mb-2">Transfer Code</p>
                  <p className="text-4xl font-black font-mono text-brand-gold tracking-[0.15em]">{transferCode}</p>
                  {transferExpiry && (
                    <p className="text-[10px] text-warm-400 mt-2">Expires at {transferExpiry.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}</p>
                  )}
                </div>
                <Button
                  onClick={() => {
                    navigator.clipboard.writeText(transferCode);
                    toast({ title: 'Copied!', description: 'Transfer code copied to clipboard' });
                  }}
                  className="w-full bg-gradient-to-r from-brand-gold to-amber-500 text-white rounded-xl font-bold"
                >
                  <Copy className="w-4 h-4 mr-1.5" />
                  Copy Code
                </Button>
              </>
            ) : (
              <p className="text-center text-warm-400 text-sm py-4">Failed to generate code. Please try again.</p>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* ═══ Receive Tournament Dialog ═══ */}
      <Dialog open={receiveDialogOpen} onOpenChange={(open) => { if (!open) { setReceiveDialogOpen(false); setReceiveCode(''); setReceiveError(null); setReceivePreview(null); } }}>
        <DialogContent className="bg-warm-50 dark:bg-warm-900 border-warm-300 dark:border-warm-700 max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-warm-800 dark:text-warm-100 flex items-center gap-2">
              <ArrowRightLeft className="w-4 h-4 text-brand-teal" />
              Receive Tournament
            </DialogTitle>
            <DialogDescription className="text-warm-500 dark:text-warm-400">
              Enter the transfer code shared by the current organizer to take over tournament management.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <Input
              placeholder="Enter 6-char code (e.g. AB3XY9)"
              value={receiveCode}
              onChange={(e) => { setReceiveCode(e.target.value.toUpperCase()); setReceiveError(null); setReceivePreview(null); }}
              maxLength={6}
              className="text-center text-lg font-mono font-bold tracking-[0.2em] h-12 bg-white dark:bg-warm-800 border-warm-300 dark:border-warm-600 rounded-xl"
            />
            {receiveError && (
              <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-3">
                <p className="text-xs text-red-600 dark:text-red-400 font-medium">{receiveError}</p>
              </div>
            )}
            {receivePreview && (
              <div className="bg-brand-teal/5 dark:bg-brand-teal/10 border border-brand-teal/20 rounded-xl p-4 space-y-2">
                <div className="flex items-center gap-2">
                  <Trophy className="w-4 h-4 text-brand-teal" />
                  <p className="text-sm font-bold text-warm-800 dark:text-warm-100">{receivePreview.tournament?.name}</p>
                </div>
                <div className="flex flex-wrap gap-2 text-[10px] text-warm-500 dark:text-warm-400">
                  {receivePreview.tournament?.type && <span className="bg-warm-100 dark:bg-warm-700 px-2 py-0.5 rounded-full capitalize">{receivePreview.tournament.type}</span>}
                  {receivePreview.tournament?.status && <span className="bg-warm-100 dark:bg-warm-700 px-2 py-0.5 rounded-full capitalize">{receivePreview.tournament.status}</span>}
                  {receivePreview.tournament?.venue && <span className="bg-warm-100 dark:bg-warm-700 px-2 py-0.5 rounded-full">{receivePreview.tournament.venue}</span>}
                </div>
                {receivePreview.organizerName && (
                  <p className="text-[10px] text-warm-400">Currently managed by: {receivePreview.organizerName}</p>
                )}
              </div>
            )}
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => { setReceiveDialogOpen(false); setReceiveCode(''); setReceiveError(null); setReceivePreview(null); }}
                className="flex-1 rounded-xl"
              >
                Cancel
              </Button>
              {!receivePreview ? (
                <Button
                  onClick={handleValidateReceiveCode}
                  disabled={!receiveCode.trim() || receiveValidating}
                  className="flex-1 bg-brand-teal hover:bg-brand-teal/90 text-white rounded-xl font-bold"
                >
                  {receiveValidating ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Validate'}
                </Button>
              ) : (
                <Button
                  onClick={handleClaimTournament}
                  disabled={receiveClaiming}
                  className="flex-1 bg-gradient-to-r from-brand-teal to-emerald-500 text-white rounded-xl font-bold"
                >
                  {receiveClaiming ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Claim Tournament'}
                </Button>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
