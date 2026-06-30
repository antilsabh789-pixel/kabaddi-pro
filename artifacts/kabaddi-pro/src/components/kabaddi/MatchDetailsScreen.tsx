'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Trophy, X, Clock, Shield, Swords, Crown, Share2,
  Calendar, Zap, MapPin, Sparkles, Play, Flame,
  Target, Lock, AlertCircle, Users, Timer, Trash2,
  Star, Medal, ChevronRight, TrendingUp,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useKabaddiStore } from '@/lib/store';
import { useToast } from '@/hooks/use-toast';

// ─── Types ───────────────────────────────────────────────────────────────────

interface MatchTeam {
  id: string;
  name: string;
  shortName?: string;
  color?: string;
  logo?: string | null;
}

interface MatchEventDB {
  id: string;
  matchId: string;
  teamId: string;
  playerId?: string;
  playerPhone?: string | null;
  eventType: string;
  value: number;
  details?: string;
  half: number;
  timestamp: string;
}

interface MotmUser {
  id: string;
  name: string;
  avatar?: string;
}

interface MatchData {
  id: string;
  homeTeamId: string;
  awayTeamId: string;
  homeScore: number;
  awayScore: number;
  homeTeam: MatchTeam;
  awayTeam: MatchTeam;
  events: MatchEventDB[];
  scorers: { id: string; matchId: string; userId: string; user: { id: string; name: string; avatar?: string } }[];
  motmUser: MotmUser | null;
  tournament: { id: string; name: string } | null;
  status: string;
  gender?: string | null;
  startedAt: string | null;
  completedAt: string | null;
  halfDuration: number;
  playersPerSide: number;
  isPractice: boolean;
  venue?: string | null;
  ground?: { id: string; name: string; address?: string; city?: string } | null;
  weightCategory?: string | null;
}

interface MatchDetailsScreenProps {
  matchId: string;
  onClose: () => void;
  onViewPlayer?: (userId: string) => void;
}

const EVENT_META: Record<string, { icon: typeof Zap; label: string; isRaid: boolean; isTackle: boolean; color: string }> = {
  raid_point:       { icon: Zap,        label: 'Raid Point',     isRaid: true,  isTackle: false, color: 'text-orange-500' },
  bonus_point:      { icon: Target,     label: 'Bonus Point',    isRaid: true,  isTackle: false, color: 'text-amber-500' },
  tackle_point:     { icon: Shield,     label: 'Tackle Point',   isRaid: false, isTackle: true,  color: 'text-blue-500' },
  super_raid:       { icon: Flame,      label: 'Super Raid',     isRaid: true,  isTackle: false, color: 'text-red-500' },
  super_tackle:     { icon: Lock,       label: 'Super Tackle',   isRaid: false, isTackle: true,  color: 'text-purple-500' },
  do_or_die_raid:   { icon: Zap,        label: 'Do-or-Die',      isRaid: true,  isTackle: false, color: 'text-red-600' },
  all_out:          { icon: Flame,      label: 'All Out',        isRaid: false, isTackle: false, color: 'text-red-500' },
  timeout:          { icon: Clock,      label: 'Timeout',        isRaid: false, isTackle: false, color: 'text-gray-500' },
  yellow_card:      { icon: AlertCircle,label: 'Yellow Card',    isRaid: false, isTackle: false, color: 'text-yellow-500' },
  red_card:         { icon: AlertCircle,label: 'Red Card',       isRaid: false, isTackle: false, color: 'text-red-600' },
  empty_raid:       { icon: Clock,      label: 'Empty Raid',     isRaid: true,  isTackle: false, color: 'text-gray-400' },
};

type TabId = 'awards' | 'scorecard' | 'commentary' | 'summary';

// ════════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ════════════════════════════════════════════════════════════════════════════

export default function MatchDetailsScreen({ matchId, onClose, onViewPlayer }: MatchDetailsScreenProps) {
  const currentUser = useKabaddiStore((s) => s.currentUser);
  const { toast } = useToast();
  const [match, setMatch] = useState<MatchData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState<TabId>('awards');
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // ── Fetch match ────────────────────────────────────────────────────────────
  const fetchMatch = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/matches/${encodeURIComponent(matchId)}`);
      if (!res.ok) throw new Error('Match not found');
      const data = await res.json();
      setMatch(data.match as MatchData);
    } catch (err) {
      console.error('Match details fetch error:', err);
      setError('Failed to load match details');
    } finally {
      setLoading(false);
    }
  }, [matchId]);

  useEffect(() => { fetchMatch(); }, [fetchMatch]);

  // ── Delete match ───────────────────────────────────────────────────────────
  const canDeleteMatch = !!(currentUser?.id && match?.scorers?.some((s) => s.userId === currentUser.id));

  const handleDeleteMatch = async () => {
    if (!currentUser?.id || !matchId) return;
    setDeleting(true);
    try {
      const res = await fetch('/api/matches', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ matchId, userId: currentUser.id }),
      });
      const data = await res.json();
      if (!res.ok) { toast({ title: 'Delete failed', description: data.error, variant: 'destructive' }); return; }
      toast({ title: 'Match Deleted', description: 'Player stats have been reversed.' });
      onClose();
    } catch { toast({ title: 'Delete failed', variant: 'destructive' }); }
    finally { setDeleting(false); setDeleteConfirm(false); }
  };

  // ── Player aggregation ─────────────────────────────────────────────────────
  const playerMap = useCallback(() => {
    if (!match) return { players: {} as Record<string, { id: string; name: string; teamId: string; raidPoints: number; tacklePoints: number; bonusPoints: number; totalPoints: number; raids: number; tackles: number; superTackles: number }> , topRaiders: [] as any[], topDefenders: [] as any[] };
    const players: Record<string, { id: string; name: string; teamId: string; raidPoints: number; tacklePoints: number; bonusPoints: number; totalPoints: number; raids: number; tackles: number; superTackles: number }> = {};
    const scorerNames: Record<string, string> = {};
    for (const s of match.scorers) scorerNames[s.userId] = s.user.name;

    for (const evt of match.events) {
      const pid = evt.playerId;
      if (!pid) continue;
      if (!players[pid]) players[pid] = { id: pid, name: scorerNames[pid] || pid.slice(0, 6), teamId: evt.teamId, raidPoints: 0, tacklePoints: 0, bonusPoints: 0, totalPoints: 0, raids: 0, tackles: 0, superTackles: 0 };
      const p = players[pid];
      const val = evt.value || 0;
      const meta = EVENT_META[evt.eventType];
      if (!meta) continue;
      if (meta.isRaid) { p.raids += 1; if (evt.eventType === 'bonus_point') p.bonusPoints += val; else p.raidPoints += val; }
      if (meta.isTackle) { p.tackles += 1; p.tacklePoints += val; if (evt.eventType === 'super_tackle') p.superTackles += 1; }
      p.totalPoints += val;
    }
    const topRaiders = Object.values(players).filter(p => p.raidPoints + p.bonusPoints > 0).sort((a, b) => (b.raidPoints + b.bonusPoints) - (a.raidPoints + a.bonusPoints));
    const topDefenders = Object.values(players).filter(p => p.tacklePoints > 0).sort((a, b) => b.tacklePoints - a.tacklePoints);
    return { players, topRaiders, topDefenders };
  }, [match]);

  const { players, topRaiders, topDefenders } = playerMap();
  const motm = match?.motmUser ? players[match.motmUser.id] : null;
  const bestRaider = topRaiders[0] || null;
  const bestDefender = topDefenders[0] || null;

  // ── Team stats ─────────────────────────────────────────────────────────────
  const teamStats = useCallback(() => {
    if (!match) return null;
    let hRaid = 0, aRaid = 0, hTackle = 0, aTackle = 0, hBonus = 0, aBonus = 0, hAllOut = 0, aAllOut = 0;
    for (const evt of match.events) {
      const isHome = evt.teamId === match.homeTeamId;
      const meta = EVENT_META[evt.eventType]; if (!meta) continue;
      if (evt.eventType === 'raid_point' || evt.eventType === 'super_raid' || evt.eventType === 'do_or_die_raid') { if (isHome) hRaid += evt.value; else aRaid += evt.value; }
      else if (evt.eventType === 'bonus_point') { if (isHome) hBonus += evt.value; else aBonus += evt.value; }
      else if (meta.isTackle) { if (isHome) hTackle += evt.value; else aTackle += evt.value; }
      else if (evt.eventType === 'all_out') { if (isHome) hAllOut += evt.value; else aAllOut += evt.value; }
    }
    return { hRaid, aRaid, hTackle, aTackle, hBonus, aBonus, hAllOut, aAllOut };
  }, [match]);

  const ts = teamStats();

  // ── Loading ────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="fixed inset-0 z-50 bg-warm-50 dark:bg-warm-900 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-4 border-brand-red/30 border-t-brand-red rounded-full animate-spin" />
          <p className="text-sm text-warm-500">Loading match...</p>
        </div>
      </div>
    );
  }

  if (error || !match) {
    return (
      <div className="fixed inset-0 z-50 bg-warm-50 dark:bg-warm-900 flex flex-col items-center justify-center p-6">
        <AlertCircle className="w-12 h-12 text-brand-red mb-3" />
        <p className="text-sm font-bold text-warm-800 dark:text-warm-100 mb-1">{error || 'Match not found'}</p>
        <Button onClick={onClose} className="mt-4">Go Back</Button>
      </div>
    );
  }

  const homeWon = match.homeScore > match.awayScore;
  const isDraw = match.homeScore === match.awayScore;
  const resultText = isDraw ? 'Match Drawn' : `${homeWon ? match.homeTeam.name : match.awayTeam.name} won by ${Math.abs(match.homeScore - match.awayScore)} pt${Math.abs(match.homeScore - match.awayScore) !== 1 ? 's' : ''}`;
  const matchDate = new Date(match.completedAt || match.startedAt || new Date()).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });

  const tabs: { id: TabId; label: string; icon: typeof Trophy }[] = [
    { id: 'awards', label: 'Awards', icon: Crown },
    { id: 'scorecard', label: 'Scorecard', icon: Swords },
    { id: 'commentary', label: 'Commentary', icon: Play },
    { id: 'summary', label: 'Summary', icon: TrendingUp },
  ];

  return (
    <div className="fixed inset-0 z-50 bg-warm-50 dark:bg-warm-900 flex flex-col">
      {/* ═══ HEADER ═══ */}
      <header className="sticky top-0 z-10 bg-warm-50/90 dark:bg-warm-900/90 backdrop-blur-md border-b border-warm-200/60 dark:border-warm-700/60">
        <div className="px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-brand-red to-brand-red-dark flex items-center justify-center">
              <Swords className="w-4 h-4 text-white" />
            </div>
            <h1 className="text-sm font-black tracking-wider text-warm-800 dark:text-warm-100">MATCH DETAILS</h1>
          </div>
          <div className="flex items-center gap-2">
            {canDeleteMatch && !deleteConfirm && (
              <button onClick={() => setDeleteConfirm(true)} className="px-3 py-1.5 rounded-lg bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 text-xs font-bold hover:bg-red-200 flex items-center gap-1">
                <Trash2 className="w-3.5 h-3.5" /> Delete
              </button>
            )}
            <button onClick={onClose} className="w-8 h-8 rounded-full bg-warm-200 dark:bg-warm-700 flex items-center justify-center text-warm-600 dark:text-warm-300 hover:bg-warm-300">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
        {deleteConfirm && (
          <div className="px-4 py-3 bg-red-50 dark:bg-red-900/20 border-t border-red-200 dark:border-red-800">
            <p className="text-xs font-bold text-red-700 dark:text-red-400 mb-2">⚠️ Delete this match? This will reverse all player stats. This cannot be undone.</p>
            <div className="flex gap-2">
              <button onClick={() => setDeleteConfirm(false)} disabled={deleting} className="flex-1 py-2 rounded-lg border border-warm-300 dark:border-warm-600 text-warm-600 font-semibold text-xs">Cancel</button>
              <button onClick={handleDeleteMatch} disabled={deleting} className="flex-1 py-2 rounded-lg bg-red-500 hover:bg-red-600 text-white font-bold text-xs disabled:opacity-50">{deleting ? 'Deleting...' : 'Yes, Delete'}</button>
            </div>
          </div>
        )}

        {/* Score banner */}
        <div className="px-4 pb-3">
          <div className="flex items-center justify-between">
            {/* Home team */}
            <div className="flex-1 text-center">
              <div className="w-12 h-12 mx-auto rounded-xl flex items-center justify-center text-white font-black text-lg mb-1" style={{ backgroundColor: match.homeTeam.color || '#DC2626' }}>
                {match.homeTeam.shortName?.charAt(0) || match.homeTeam.name.charAt(0)}
              </div>
              <p className={`text-xs font-bold truncate ${homeWon ? 'text-warm-800 dark:text-warm-100' : 'text-warm-500'}`}>{match.homeTeam.name}</p>
            </div>
            {/* Score */}
            <div className="flex items-center gap-2 px-4">
              <span className={`text-3xl font-black ${homeWon ? 'text-emerald-600 dark:text-emerald-400' : 'text-warm-500'}`}>{match.homeScore}</span>
              <span className="text-sm text-warm-400">-</span>
              <span className={`text-3xl font-black ${!homeWon && !isDraw ? 'text-emerald-600 dark:text-emerald-400' : 'text-warm-500'}`}>{match.awayScore}</span>
            </div>
            {/* Away team */}
            <div className="flex-1 text-center">
              <div className="w-12 h-12 mx-auto rounded-xl flex items-center justify-center text-white font-black text-lg mb-1" style={{ backgroundColor: match.awayTeam.color || '#1E293B' }}>
                {match.awayTeam.shortName?.charAt(0) || match.awayTeam.name.charAt(0)}
              </div>
              <p className={`text-xs font-bold truncate ${!homeWon && !isDraw ? 'text-warm-800 dark:text-warm-100' : 'text-warm-500'}`}>{match.awayTeam.name}</p>
            </div>
          </div>
          <p className="text-center text-[10px] font-semibold text-warm-500 dark:text-warm-400 mt-2">{resultText}</p>
        </div>

        {/* Tabs */}
        <div className="flex border-t border-warm-200/60 dark:border-warm-700/60">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex-1 flex items-center justify-center gap-1 py-2.5 text-xs font-bold transition-colors ${
                  activeTab === tab.id
                    ? 'text-brand-red border-b-2 border-brand-red'
                    : 'text-warm-400 hover:text-warm-600'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                {tab.label}
              </button>
            );
          })}
        </div>
      </header>

      {/* ═══ CONTENT ═══ */}
      <div className="flex-1 overflow-y-auto custom-scrollbar">
        <AnimatePresence mode="wait">
          {/* ─── AWARDS TAB ─── */}
          {activeTab === 'awards' && (
            <motion.div key="awards" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="p-4 space-y-4 pb-8">
              {/* Player of the Match */}
              <AwardCard
                title="Player of the Match"
                icon={Crown}
                gradient="from-amber-400 to-yellow-500"
                player={motm ? { name: match.motmUser?.name || motm.name, points: motm.totalPoints, raids: motm.raids, tackles: motm.tackles } : null}
                badge="MOTM"
                onViewPlayer={onViewPlayer}
                playerId={match.motmUser?.id}
              />

              {/* Raider of the Match */}
              <AwardCard
                title="Raider of the Match"
                icon={Zap}
                gradient="from-orange-400 to-red-500"
                player={bestRaider ? { name: bestRaider.name, points: bestRaider.raidPoints + bestRaider.bonusPoints, raids: bestRaider.raids, tackles: 0 } : null}
                badge="RAIDER"
                onViewPlayer={onViewPlayer}
                playerId={bestRaider?.id}
              />

              {/* Defender of the Match */}
              <AwardCard
                title="Defender of the Match"
                icon={Shield}
                gradient="from-blue-400 to-indigo-500"
                player={bestDefender ? { name: bestDefender.name, points: bestDefender.tacklePoints, raids: 0, tackles: bestDefender.tackles } : null}
                badge="DEFENDER"
                onViewPlayer={onViewPlayer}
                playerId={bestDefender?.id}
              />

              {/* No awards state */}
              {!motm && !bestRaider && !bestDefender && (
                <div className="text-center py-12">
                  <Trophy className="w-12 h-12 text-warm-300 dark:text-warm-600 mx-auto mb-3" />
                  <p className="text-sm font-bold text-warm-500">No awards available</p>
                  <p className="text-xs text-warm-400 mt-1">Player awards appear here after the match is scored.</p>
                </div>
              )}
            </motion.div>
          )}

          {/* ─── SCORECARD TAB ─── */}
          {activeTab === 'scorecard' && (
            <motion.div key="scorecard" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="p-4 space-y-4 pb-8">
              {/* Team stats summary */}
              {ts && (
                <Card className="overflow-hidden border-warm-200 dark:border-warm-700">
                  <div className="grid grid-cols-4 text-center text-[9px] font-bold uppercase text-warm-400 border-b border-warm-100 dark:border-warm-700">
                    <div className="py-2 text-left pl-3">Stat</div>
                    <div className="py-2" style={{ color: match.homeTeam.color || '#DC2626' }}>{match.homeTeam.shortName || match.homeTeam.name.slice(0,3)}</div>
                    <div className="py-2" style={{ color: match.awayTeam.color || '#1E293B' }}>{match.awayTeam.shortName || match.awayTeam.name.slice(0,3)}</div>
                    <div className="py-2 text-right pr-3">Stat</div>
                  </div>
                  {[
                    { label: 'Raid Pts', home: ts.hRaid, away: ts.aRaid },
                    { label: 'Tackle Pts', home: ts.hTackle, away: ts.aTackle },
                    { label: 'Bonus Pts', home: ts.hBonus, away: ts.aBonus },
                    { label: 'All Out Pts', home: ts.hAllOut, away: ts.aAllOut },
                    { label: 'Total', home: match.homeScore, away: match.awayScore },
                  ].map((row) => (
                    <div key={row.label} className="grid grid-cols-4 text-center text-xs border-b border-warm-50 dark:border-warm-700/50 last:border-0">
                      <div className="py-2 text-left pl-3 text-warm-500 font-semibold">{row.label}</div>
                      <div className={`py-2 font-black ${row.home > row.away ? 'text-emerald-600' : 'text-warm-600 dark:text-warm-300'}`}>{row.home}</div>
                      <div className={`py-2 font-black ${row.away > row.home ? 'text-emerald-600' : 'text-warm-600 dark:text-warm-300'}`}>{row.away}</div>
                      <div className="py-2 text-right pr-3 text-warm-500 font-semibold">{row.label}</div>
                    </div>
                  ))}
                </Card>
              )}

              {/* Home team players */}
              <PlayerScorecard teamName={match.homeTeam.name} teamColor={match.homeTeam.color || '#DC2626'} players={Object.values(players).filter(p => p.teamId === match.homeTeamId)} onViewPlayer={onViewPlayer} />

              {/* Away team players */}
              <PlayerScorecard teamName={match.awayTeam.name} teamColor={match.awayTeam.color || '#1E293B'} players={Object.values(players).filter(p => p.teamId === match.awayTeamId)} onViewPlayer={onViewPlayer} />

              {Object.keys(players).length === 0 && (
                <div className="text-center py-8">
                  <Users className="w-10 h-10 text-warm-300 mx-auto mb-2" />
                  <p className="text-sm text-warm-500">No player data available</p>
                </div>
              )}
            </motion.div>
          )}

          {/* ─── COMMENTARY TAB ─── */}
          {activeTab === 'commentary' && (
            <motion.div key="commentary" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="p-4 pb-8">
              {match.events.length === 0 ? (
                <div className="text-center py-8">
                  <Play className="w-10 h-10 text-warm-300 mx-auto mb-2" />
                  <p className="text-sm text-warm-500">No commentary available</p>
                </div>
              ) : (
                <div className="space-y-1">
                  {/* Reverse events so latest is at top */}
                  {[...match.events].reverse().map((evt, idx) => {
                    const meta = EVENT_META[evt.eventType];
                    if (!meta) return null;
                    const Icon = meta.icon;
                    const isHome = evt.teamId === match.homeTeamId;
                    const teamName = isHome ? match.homeTeam.shortName || match.homeTeam.name : match.awayTeam.shortName || match.awayTeam.name;
                    const scorerName = match.scorers.find(s => s.userId === evt.playerId)?.user?.name || evt.playerId?.slice(0, 6) || '';
                    const time = new Date(evt.timestamp).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' });

                    return (
                      <motion.div
                        key={evt.id}
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: Math.min(idx * 0.02, 0.5) }}
                        className={`flex items-center gap-3 p-2.5 rounded-lg ${isHome ? 'bg-red-50/50 dark:bg-red-900/10' : 'bg-blue-50/50 dark:bg-blue-900/10'}`}
                      >
                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${isHome ? 'bg-red-100 dark:bg-red-900/30' : 'bg-blue-100 dark:bg-blue-900/30'}`}>
                          <Icon className={`w-4 h-4 ${meta.color}`} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-bold text-warm-800 dark:text-warm-100">
                            {meta.label}{evt.value > 0 ? ` (+${evt.value})` : ''}
                          </p>
                          <p className="text-[10px] text-warm-500 dark:text-warm-400 truncate">
                            {scorerName && `${scorerName} · `}{teamName} · Half {evt.half}
                          </p>
                        </div>
                        <span className="text-[9px] text-warm-400 font-mono shrink-0">{time}</span>
                      </motion.div>
                    );
                  })}
                </div>
              )}
            </motion.div>
          )}

          {/* ─── SUMMARY TAB ─── */}
          {activeTab === 'summary' && (
            <motion.div key="summary" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="p-4 space-y-3 pb-8">
              {/* Match info */}
              <Card className="p-4 border-warm-200 dark:border-warm-700">
                <h3 className="text-xs font-black uppercase tracking-wider text-warm-500 mb-3">Match Info</h3>
                <div className="space-y-2 text-xs">
                  <InfoRow icon={Calendar} label="Date" value={matchDate} />
                  <InfoRow icon={Trophy} label="Type" value={match.tournament?.name || (match.isPractice ? 'Practice Match' : 'Tournament Match')} />
                  <InfoRow icon={Users} label="Format" value={`${match.playersPerSide}-a-side · ${match.halfDuration} min halves`} />
                  {match.gender && <InfoRow icon={Users} label="Category" value={match.gender} />}
                  {match.weightCategory && <InfoRow icon={Shield} label="Weight" value={match.weightCategory} />}
                  {match.ground?.name && <InfoRow icon={MapPin} label="Venue" value={`${match.ground.name}${match.ground.city ? ', ' + match.ground.city : ''}`} />}
                </div>
              </Card>

              {/* Result */}
              <Card className="p-4 bg-gradient-to-br from-amber-50 to-yellow-50 dark:from-amber-900/20 dark:to-yellow-900/10 border-amber-200 dark:border-amber-800">
                <h3 className="text-xs font-black uppercase tracking-wider text-amber-600 mb-2">Result</h3>
                <p className="text-sm font-bold text-warm-800 dark:text-warm-100">{resultText}</p>
                <div className="flex items-center justify-between mt-3 text-xs">
                  <span style={{ color: match.homeTeam.color || '#DC2626' }} className="font-bold">{match.homeTeam.name}</span>
                  <span className="font-black text-lg">{match.homeScore} - {match.awayScore}</span>
                  <span style={{ color: match.awayTeam.color || '#1E293B' }} className="font-bold">{match.awayTeam.name}</span>
                </div>
              </Card>

              {/* Scored by */}
              {match.scorers.length > 0 && (
                <Card className="p-4 border-warm-200 dark:border-warm-700">
                  <h3 className="text-xs font-black uppercase tracking-wider text-warm-500 mb-2">Scored By</h3>
                  <div className="flex flex-wrap gap-2">
                    {match.scorers.map(s => (
                      <div key={s.id} className="flex items-center gap-2 bg-warm-100 dark:bg-warm-800 rounded-full pr-3 pl-1 py-1">
                        <div className="w-6 h-6 rounded-full bg-brand-teal flex items-center justify-center text-white text-[10px] font-bold">
                          {s.user.name?.charAt(0) || '?'}
                        </div>
                        <span className="text-xs font-semibold text-warm-700 dark:text-warm-200">{s.user.name}</span>
                      </div>
                    ))}
                  </div>
                </Card>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// SUB-COMPONENTS
// ════════════════════════════════════════════════════════════════════════════

function AwardCard({ title, icon: Icon, gradient, player, badge, onViewPlayer, playerId }: {
  title: string;
  icon: typeof Crown;
  gradient: string;
  player: { name: string; points: number; raids: number; tackles: number } | null;
  badge: string;
  onViewPlayer?: (userId: string) => void;
  playerId?: string;
}) {
  if (!player) {
    return (
      <Card className="p-4 border-warm-200 dark:border-warm-700 opacity-60">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-warm-100 dark:bg-warm-700 flex items-center justify-center">
            <Icon className="w-6 h-6 text-warm-400" />
          </div>
          <div>
            <p className="text-xs font-bold text-warm-400 uppercase tracking-wider">{title}</p>
            <p className="text-sm text-warm-400">Not available</p>
          </div>
        </div>
      </Card>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      onClick={() => playerId && onViewPlayer?.(playerId)}
      className={`relative overflow-hidden rounded-2xl border-2 ${playerId && onViewPlayer ? 'cursor-pointer' : ''}`}
    >
      {/* Gradient background */}
      <div className={`absolute inset-0 bg-gradient-to-br ${gradient} opacity-10`} />

      <div className="relative p-4">
        <div className="flex items-center gap-3">
          {/* Icon badge */}
          <div className={`w-14 h-14 rounded-2xl bg-gradient-to-br ${gradient} flex items-center justify-center shadow-lg shrink-0`}>
            <Icon className="w-7 h-7 text-white" />
          </div>

          {/* Player info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-0.5">
              <p className="text-[10px] font-black uppercase tracking-wider text-warm-500">{title}</p>
              <span className={`text-[8px] font-black text-white bg-gradient-to-r ${gradient} px-1.5 py-0.5 rounded-full`}>{badge}</span>
            </div>
            <p className="text-base font-black text-warm-800 dark:text-warm-100 truncate">{player.name}</p>
            <div className="flex items-center gap-3 mt-1">
              <span className="text-xs font-bold text-warm-600 dark:text-warm-300 flex items-center gap-0.5">
                <Star className="w-3 h-3 text-amber-500" /> {player.points} pts
              </span>
              {player.raids > 0 && (
                <span className="text-[10px] text-warm-500 flex items-center gap-0.5">
                  <Zap className="w-2.5 h-2.5" /> {player.raids} raids
                </span>
              )}
              {player.tackles > 0 && (
                <span className="text-[10px] text-warm-500 flex items-center gap-0.5">
                  <Shield className="w-2.5 h-2.5" /> {player.tackles} tackles
                </span>
              )}
            </div>
          </div>

          {/* Chevron if clickable */}
          {playerId && onViewPlayer && (
            <ChevronRight className="w-5 h-5 text-warm-400 shrink-0" />
          )}
        </div>
      </div>
    </motion.div>
  );
}

function PlayerScorecard({ teamName, teamColor, players, onViewPlayer }: {
  teamName: string;
  teamColor: string;
  players: Array<{ id: string; name: string; raidPoints: number; tacklePoints: number; bonusPoints: number; totalPoints: number; raids: number; tackles: number; superTackles: number }>;
  onViewPlayer?: (userId: string) => void;
}) {
  const sorted = [...players].sort((a, b) => b.totalPoints - a.totalPoints);

  return (
    <Card className="overflow-hidden border-warm-200 dark:border-warm-700">
      {/* Team header */}
      <div className="flex items-center gap-2 px-3 py-2.5" style={{ backgroundColor: `${teamColor}15` }}>
        <div className="w-5 h-5 rounded-md flex items-center justify-center text-white text-[10px] font-black" style={{ backgroundColor: teamColor }}>
          {teamName.charAt(0)}
        </div>
        <span className="text-sm font-black" style={{ color: teamColor }}>{teamName}</span>
        <span className="text-[10px] text-warm-400 ml-auto">{sorted.length} players</span>
      </div>

      {/* Column headers */}
      <div className="grid grid-cols-12 gap-1 px-3 py-1.5 text-[8px] font-bold uppercase text-warm-400 border-b border-warm-100 dark:border-warm-700/50">
        <div className="col-span-4">Player</div>
        <div className="col-span-2 text-center">Raid</div>
        <div className="col-span-2 text-center">Tkl</div>
        <div className="col-span-2 text-center">Bonus</div>
        <div className="col-span-2 text-center font-black text-warm-600">Pts</div>
      </div>

      {/* Players */}
      {sorted.length === 0 ? (
        <p className="text-center text-[10px] text-warm-400 py-4">No player data</p>
      ) : (
        sorted.map((p) => (
          <div
            key={p.id}
            onClick={() => onViewPlayer?.(p.id)}
            className={`grid grid-cols-12 gap-1 px-3 py-2 text-xs border-b border-warm-50 dark:border-warm-700/30 last:border-0 ${onViewPlayer ? 'cursor-pointer hover:bg-warm-50 dark:hover:bg-warm-700/30' : ''}`}
          >
            <div className="col-span-4 font-semibold text-warm-800 dark:text-warm-100 truncate">{p.name}</div>
            <div className="col-span-2 text-center text-warm-600 dark:text-warm-300">{p.raidPoints}</div>
            <div className="col-span-2 text-center text-warm-600 dark:text-warm-300">{p.tacklePoints}</div>
            <div className="col-span-2 text-center text-amber-500">{p.bonusPoints}</div>
            <div className="col-span-2 text-center font-black text-warm-800 dark:text-warm-100">{p.totalPoints}</div>
          </div>
        ))
      )}
    </Card>
  );
}

function InfoRow({ icon: Icon, label, value }: { icon: typeof Calendar; label: string; value: string }) {
  return (
    <div className="flex items-center gap-2">
      <Icon className="w-3.5 h-3.5 text-warm-400 shrink-0" />
      <span className="text-warm-500 font-semibold w-20">{label}</span>
      <span className="text-warm-800 dark:text-warm-100 font-medium flex-1">{value}</span>
    </div>
  );
}
