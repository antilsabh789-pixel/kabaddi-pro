'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X, Calendar, Plus, ChevronRight, ChevronDown,
  Loader2, Trophy, Users, ArrowLeft, Crown,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useKabaddiStore } from '@/lib/store';
import { useToast } from '@/hooks/use-toast';
import PremiumLock from './PremiumLock';

// ─── Types ────────────────────────────────────────────────────────

interface SeasonScreenProps {
  onClose: () => void;
}

interface Season {
  id: string;
  name: string;
  year: number;
  startDate: string;
  description: string | null;
  status: 'upcoming' | 'active' | 'completed';
  teamCount: number;
  matchCount: number;
  teams: SeasonTeam[];
  matches: SeasonMatch[];
  sponsors: SeasonSponsor[];
}

interface SeasonTeam {
  id: string;
  name: string;
  shortName: string;
  wins: number;
  losses: number;
  draws: number;
  points: number;
}

interface SeasonMatch {
  id: string;
  homeTeam: string;
  awayTeam: string;
  homeScore: number;
  awayScore: number;
  status: string;
  date: string;
}

interface SeasonSponsor {
  id: string;
  name: string;
  tier: string;
}

// ─── Config ───────────────────────────────────────────────────────

const STATUS_CONFIG: Record<string, { label: string; bgColor: string; textColor: string }> = {
  upcoming: { label: 'Upcoming', bgColor: 'bg-blue-100', textColor: 'text-blue-700' },
  active: { label: 'Active', bgColor: 'bg-green-100', textColor: 'text-green-700' },
  completed: { label: 'Completed', bgColor: 'bg-warm-200', textColor: 'text-warm-600' },
};

// ─── Animation ────────────────────────────────────────────────────

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.06, delayChildren: 0.1 },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 14 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { type: 'spring' as const, damping: 20, stiffness: 200 },
  },
};

// ─── Component ────────────────────────────────────────────────────

export default function SeasonScreen({ onClose }: SeasonScreenProps) {
  const currentUser = useKabaddiStore((s) => s.currentUser);
  const isPremium = currentUser?.isPremium || false;
  const { toast } = useToast();

  const [seasons, setSeasons] = useState<Season[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [selectedSeason, setSelectedSeason] = useState<Season | null>(null);
  const [creating, setCreating] = useState(false);

  const [form, setForm] = useState({
    name: '',
    year: new Date().getFullYear().toString(),
    startDate: '',
    description: '',
  });

  // ─── Fetch seasons ────────────────────────────────────────────

  const fetchSeasons = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/seasons');
      if (res.ok) {
        const data = await res.json();
        setSeasons(data.seasons || []);
      } else {
        setSeasons([]);
      }
    } catch {
      setSeasons([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSeasons();
  }, [fetchSeasons]);

  // ─── Create Season ────────────────────────────────────────────

  const handleCreateSeason = async () => {
    if (!form.name.trim()) {
      toast({ title: 'Name required', variant: 'destructive' });
      return;
    }

    setCreating(true);
    try {
      const res = await fetch('/api/seasons', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: form.name,
          year: parseInt(form.year),
          startDate: form.startDate || undefined,
          description: form.description || undefined,
          userId: currentUser?.id,
        }),
      });

      if (res.ok) {
        toast({ title: 'Season Created!', description: `${form.name} is now set up` });
        setForm({ name: '', year: new Date().getFullYear().toString(), startDate: '', description: '' });
        setShowCreateForm(false);
        fetchSeasons();
      } else {
        const data = await res.json();
        toast({ title: 'Error', description: data.error || 'Failed to create season', variant: 'destructive' });
      }
    } catch {
      toast({ title: 'Error', description: 'Failed to create season', variant: 'destructive' });
    } finally {
      setCreating(false);
    }
  };

  // ─── Active Season ────────────────────────────────────────────

  const activeSeason = seasons.find((s) => s.status === 'active');

  // ─── Season Detail View ───────────────────────────────────────

  if (selectedSeason) {
    const season = selectedSeason;
    const statusConfig = STATUS_CONFIG[season.status] || STATUS_CONFIG.upcoming;
    const sortedTeams = [...season.teams].sort((a, b) => b.points - a.points);

    return (
      <motion.div
        initial={{ x: '100%' }}
        animate={{ x: 0 }}
        exit={{ x: '100%' }}
        transition={{ type: 'spring', damping: 28, stiffness: 300 }}
        className="fixed inset-0 z-50 bg-warm-50 overflow-y-auto"
      >
        {/* Header */}
        <div className="sticky top-0 z-10 bg-gradient-to-r from-brand-navy to-brand-navy-light">
          <div className="flex items-center justify-between px-4 py-4">
            <div className="flex items-center gap-2">
              <button
                onClick={() => setSelectedSeason(null)}
                className="p-2 rounded-full hover:bg-white/20 transition-colors"
              >
                <ArrowLeft className="w-5 h-5 text-white" />
              </button>
              <div>
                <h1 className="text-lg font-bold text-white">{season.name}</h1>
                <p className="text-[11px] text-white/60">{season.year}</p>
              </div>
            </div>
            <button onClick={onClose} className="p-2 rounded-full hover:bg-white/20 transition-colors">
              <X className="w-5 h-5 text-white" />
            </button>
          </div>
        </div>

        <div className="px-4 py-4 space-y-4">
          {/* Status & Stats */}
          <Card className="border-warm-200/60">
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-3">
                <Badge className={`${statusConfig.bgColor} ${statusConfig.textColor} text-[10px] font-bold border-0`}>
                  {statusConfig.label}
                </Badge>
                <div className="flex items-center gap-3 text-xs text-warm-500">
                  <span>{season.teamCount} Teams</span>
                  <span>{season.matchCount} Matches</span>
                </div>
              </div>
              {season.description && (
                <p className="text-xs text-warm-600 leading-relaxed">{season.description}</p>
              )}
            </CardContent>
          </Card>

          {/* Standings Table */}
          <Card className="border-warm-200/60">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-6 h-6 rounded-md bg-brand-gold/10 flex items-center justify-center">
                  <Trophy className="w-3.5 h-3.5 text-brand-gold" />
                </div>
                <h2 className="text-xs font-black tracking-wider text-warm-800">STANDINGS</h2>
              </div>

              {/* Table Header */}
              <div className="grid grid-cols-[2rem_1fr_2rem_2rem_2rem_2.5rem] gap-1 text-[9px] font-bold text-warm-500 uppercase tracking-wider mb-2 px-1">
                <span>#</span>
                <span>Team</span>
                <span>W</span>
                <span>L</span>
                <span>D</span>
                <span className="text-right">Pts</span>
              </div>

              <div className="space-y-1 max-h-64 overflow-y-auto custom-scrollbar">
                {sortedTeams.map((team, i) => (
                  <motion.div
                    key={team.id}
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.04 }}
                    className={`grid grid-cols-[2rem_1fr_2rem_2rem_2rem_2.5rem] gap-1 items-center p-2 rounded-lg text-xs ${
                      i === 0 ? 'bg-brand-gold/10 border border-brand-gold/20' :
                      i < 4 ? 'bg-warm-100/60' : 'bg-warm-50'
                    }`}
                  >
                    <span className="font-bold text-warm-500">{i + 1}</span>
                    <span className="font-semibold text-warm-800 truncate">{team.name}</span>
                    <span className="text-green-600 font-bold">{team.wins}</span>
                    <span className="text-brand-red font-bold">{team.losses}</span>
                    <span className="text-warm-500 font-bold">{team.draws}</span>
                    <span className="text-right font-black text-brand-navy">{team.points}</span>
                  </motion.div>
                ))}
              </div>

              {sortedTeams.length === 0 && (
                <p className="text-xs text-warm-400 text-center py-4">No teams added yet</p>
              )}
            </CardContent>
          </Card>

          {/* Add Team Button */}
          <Button
            variant="outline"
            className="w-full border-dashed border-brand-teal/40 text-brand-teal hover:bg-brand-teal/5 h-10"
          >
            <Plus className="w-4 h-4 mr-2" />
            Add Team to Season
          </Button>

          {/* Matches List */}
          <Card className="border-warm-200/60">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-6 h-6 rounded-md bg-brand-red/10 flex items-center justify-center">
                  <Calendar className="w-3.5 h-3.5 text-brand-red" />
                </div>
                <h2 className="text-xs font-black tracking-wider text-warm-800">MATCHES</h2>
              </div>

              <div className="space-y-2 max-h-64 overflow-y-auto custom-scrollbar">
                {season.matches.map((match, i) => (
                  <motion.div
                    key={match.id}
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.04 }}
                    className="flex items-center justify-between p-2.5 rounded-lg bg-warm-100/60"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-warm-800 truncate">
                        {match.homeTeam} vs {match.awayTeam}
                      </p>
                      <p className="text-[10px] text-warm-400">{match.date}</p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0 ml-2">
                      <span className="text-xs font-bold text-warm-700">
                        {match.homeScore}-{match.awayScore}
                      </span>
                      <Badge className={`text-[8px] font-bold border-0 ${
                        match.status === 'completed' ? 'bg-warm-200 text-warm-600' :
                        match.status === 'live' ? 'bg-brand-red/15 text-brand-red' :
                        'bg-brand-teal/15 text-brand-teal'
                      }`}>
                        {match.status}
                      </Badge>
                    </div>
                  </motion.div>
                ))}
              </div>

              {season.matches.length === 0 && (
                <p className="text-xs text-warm-400 text-center py-4">No matches scheduled yet</p>
              )}
            </CardContent>
          </Card>

          {/* Sponsors */}
          {season.sponsors.length > 0 && (
            <Card className="border-warm-200/60">
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-6 h-6 rounded-md bg-brand-gold/10 flex items-center justify-center">
                    <Crown className="w-3.5 h-3.5 text-brand-gold" />
                  </div>
                  <h2 className="text-xs font-black tracking-wider text-warm-800">SPONSORS</h2>
                </div>
                <div className="flex flex-wrap gap-2">
                  {season.sponsors.map((sponsor) => (
                    <Badge key={sponsor.id} className="bg-brand-gold/10 text-brand-gold-dark text-[10px] font-bold border-0">
                      {sponsor.name} ({sponsor.tier})
                    </Badge>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* YoY Comparison (Premium) */}
          <PremiumLock feature="Season Comparison">
            <Card className="border-warm-200/60">
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-6 h-6 rounded-md bg-brand-teal/10 flex items-center justify-center">
                    <Users className="w-3.5 h-3.5 text-brand-teal" />
                  </div>
                  <h2 className="text-xs font-black tracking-wider text-warm-800">YEAR-OVER-YEAR</h2>
                  <Badge className="bg-brand-teal/10 text-brand-teal text-[8px] font-bold border-0 ml-auto">
                    PRO
                  </Badge>
                </div>
                <p className="text-xs text-warm-500 text-center py-6">
                  Compare this season with previous seasons to track improvements and trends.
                </p>
              </CardContent>
            </Card>
          </PremiumLock>
        </div>
      </motion.div>
    );
  }

  // ─── Main Season List View ────────────────────────────────────

  return (
    <motion.div
      initial={{ y: '100%' }}
      animate={{ y: 0 }}
      exit={{ y: '100%' }}
      transition={{ type: 'spring', damping: 28, stiffness: 300 }}
      className="fixed inset-0 z-50 bg-warm-50 overflow-y-auto"
    >
      {/* ═══ Header ═══ */}
      <div className="sticky top-0 z-10 bg-gradient-to-r from-brand-navy to-brand-navy-light">
        <div className="flex items-center justify-between px-4 py-4">
          <div className="flex items-center gap-2">
            <Calendar className="w-5 h-5 text-white" />
            <h1 className="text-lg font-bold text-white">SEASONS</h1>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-full hover:bg-white/20 transition-colors"
          >
            <X className="w-5 h-5 text-white" />
          </button>
        </div>
      </div>

      {/* ═══ Content ═══ */}
      <div className="px-4 py-4">
        <motion.div
          className="space-y-4"
          variants={containerVariants}
          initial="hidden"
          animate="visible"
        >
          {/* Active Season Highlight */}
          {activeSeason && (
            <motion.div variants={itemVariants}>
              <button
                onClick={() => setSelectedSeason(activeSeason)}
                className="w-full"
              >
                <Card className="bg-gradient-to-r from-brand-teal/10 to-brand-teal/5 border-brand-teal/30 shadow-md hover:shadow-lg transition-shadow">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-brand-teal/20 flex items-center justify-center">
                          <Trophy className="w-5 h-5 text-brand-teal" />
                        </div>
                        <div className="text-left">
                          <p className="text-sm font-bold text-warm-800">{activeSeason.name}</p>
                          <p className="text-[10px] text-warm-500">{activeSeason.year} · {activeSeason.teamCount} teams</p>
                        </div>
                      </div>
                      <Badge className="bg-green-100 text-green-700 text-[9px] font-bold border-0">
                        ACTIVE
                      </Badge>
                    </div>
                  </CardContent>
                </Card>
              </button>
            </motion.div>
          )}

          {/* Create Season Button */}
          <motion.div variants={itemVariants}>
            <Button
              onClick={() => setShowCreateForm(!showCreateForm)}
              variant="outline"
              className="w-full border-dashed border-brand-teal/40 text-brand-teal hover:bg-brand-teal/5 h-10"
            >
              <Plus className="w-4 h-4 mr-2" />
              {showCreateForm ? 'Cancel' : 'Create Season'}
            </Button>
          </motion.div>

          {/* Create Season Form */}
          <AnimatePresence>
            {showCreateForm && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="overflow-hidden"
              >
                <Card className="border-brand-teal/20">
                  <CardContent className="p-4 space-y-3">
                    <h3 className="font-bold text-warm-800 text-sm">New Season</h3>
                    <Input
                      placeholder="Season name *"
                      value={form.name}
                      onChange={(e) => setForm({ ...form, name: e.target.value })}
                      className="bg-white border-warm-300"
                    />
                    <div className="grid grid-cols-2 gap-3">
                      <Input
                        placeholder="Year"
                        type="number"
                        value={form.year}
                        onChange={(e) => setForm({ ...form, year: e.target.value })}
                        className="bg-white border-warm-300"
                      />
                      <Input
                        placeholder="Start date"
                        type="date"
                        value={form.startDate}
                        onChange={(e) => setForm({ ...form, startDate: e.target.value })}
                        className="bg-white border-warm-300"
                      />
                    </div>
                    <Input
                      placeholder="Description (optional)"
                      value={form.description}
                      onChange={(e) => setForm({ ...form, description: e.target.value })}
                      className="bg-white border-warm-300"
                    />
                    <Button
                      onClick={handleCreateSeason}
                      disabled={creating}
                      className="w-full bg-brand-teal hover:bg-brand-teal-dark text-white"
                    >
                      {creating ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          Creating...
                        </>
                      ) : (
                        <>
                          <Plus className="w-4 h-4 mr-2" />
                          Create Season
                        </>
                      )}
                    </Button>
                  </CardContent>
                </Card>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Season List */}
          {loading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-20 bg-warm-100 rounded-xl animate-pulse" />
              ))}
            </div>
          ) : seasons.length === 0 ? (
            <motion.div variants={itemVariants}>
              <Card className="p-8 text-center border-warm-200">
                <div className="w-16 h-16 rounded-full bg-brand-navy/10 flex items-center justify-center mx-auto mb-4">
                  <Calendar className="w-8 h-8 text-brand-navy/40" />
                </div>
                <h3 className="text-warm-700 font-bold text-sm">No seasons yet</h3>
                <p className="text-warm-400 text-xs mt-1">Create your first season to get started!</p>
              </Card>
            </motion.div>
          ) : (
            <div className="space-y-3">
              {seasons.map((season, index) => {
                const statusConfig = STATUS_CONFIG[season.status] || STATUS_CONFIG.upcoming;

                return (
                  <motion.div
                    key={season.id}
                    variants={itemVariants}
                    initial={{ opacity: 0, y: 14 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.05 }}
                  >
                    <button
                      onClick={() => setSelectedSeason(season)}
                      className="w-full text-left"
                    >
                      <Card className="border-warm-200/60 hover:border-brand-navy/20 hover:shadow-md transition-all">
                        <CardContent className="p-4">
                          <div className="flex items-center justify-between">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-1">
                                <h4 className="text-sm font-bold text-warm-800 truncate">
                                  {season.name}
                                </h4>
                                <Badge className={`${statusConfig.bgColor} ${statusConfig.textColor} text-[9px] font-bold border-0`}>
                                  {statusConfig.label}
                                </Badge>
                              </div>
                              <p className="text-[11px] text-warm-500">
                                {season.year} · {season.teamCount} teams · {season.matchCount} matches
                              </p>
                            </div>
                            <ChevronRight className="w-4 h-4 text-warm-400 shrink-0 ml-2" />
                          </div>
                        </CardContent>
                      </Card>
                    </button>
                  </motion.div>
                );
              })}
            </div>
          )}
        </motion.div>
      </div>
    </motion.div>
  );
}
