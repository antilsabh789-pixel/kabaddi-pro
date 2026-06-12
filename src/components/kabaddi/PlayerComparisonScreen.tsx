'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X, Swords, Shield, Search, Crown, BarChart3, Zap, Award, Star,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';

// ─── Types ────────────────────────────────────────────────────────

interface PlayerProfile {
  id: string;
  userId: string;
  totalRaids: number;
  successfulRaids: number;
  totalTackles: number;
  successfulTackles: number;
  bonusPoints: number;
  superTackles: number;
  overallRating: number;
  position: string | null;
  jerseyNumber: number | null;
  user: {
    id: string;
    name: string;
    avatar: string | null;
    phone: string;
  };
}

interface PlayerComparisonScreenProps {
  onClose: () => void;
}

// ─── Helpers ──────────────────────────────────────────────────────

function getInitials(name: string | null | undefined): string {
  if (!name) return '?';
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
  return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
}

function getDisplayName(name: string | null | undefined): string {
  return name?.trim() || 'Unnamed Player';
}

// ─── Stat row component ──────────────────────────────────────────

function StatRow({ label, valueA, valueB, format }: {
  label: string;
  valueA: number;
  valueB: number;
  format?: (v: number) => string;
}) {
  const displayA = format ? format(valueA) : valueA.toString();
  const displayB = format ? format(valueB) : valueB.toString();
  const maxVal = Math.max(valueA, valueB, 1);
  const pctA = (valueA / maxVal) * 100;
  const pctB = (valueB / maxVal) * 100;
  const winnerA = valueA > valueB;
  const winnerB = valueB > valueA;

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-xs">
        <span className={`font-bold ${winnerA ? 'text-brand-teal' : 'text-warm-700'}`}>{displayA}</span>
        <span className="text-warm-500 font-medium">{label}</span>
        <span className={`font-bold ${winnerB ? 'text-brand-gold' : 'text-warm-700'}`}>{displayB}</span>
      </div>
      <div className="flex gap-1">
        <div className="flex-1 bg-warm-100 rounded-full h-2 overflow-hidden">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${pctA}%` }}
            transition={{ duration: 0.6, ease: 'easeOut' }}
            className="h-full bg-brand-teal rounded-full"
          />
        </div>
        <div className="flex-1 bg-warm-100 rounded-full h-2 overflow-hidden flex justify-end">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${pctB}%` }}
            transition={{ duration: 0.6, ease: 'easeOut' }}
            className="h-full bg-brand-gold rounded-full"
          />
        </div>
      </div>
    </div>
  );
}

// ─── Component ────────────────────────────────────────────────────

export default function PlayerComparisonScreen({ onClose }: PlayerComparisonScreenProps) {
  const { toast } = useToast();

  const [playerA, setPlayerA] = useState<PlayerProfile | null>(null);
  const [playerB, setPlayerB] = useState<PlayerProfile | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<PlayerProfile[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [selectingSlot, setSelectingSlot] = useState<'A' | 'B' | null>(null);

  // ─── Search players ──────────────────────────────────────────

  const searchPlayers = useCallback(async (query: string) => {
    if (!query.trim()) {
      setSearchResults([]);
      return;
    }
    setSearchLoading(true);
    try {
      const res = await fetch(`/api/players?search=${encodeURIComponent(query)}`);
      if (!res.ok) throw new Error('Search failed');
      const data = await res.json();
      setSearchResults(data.players || []);
    } catch {
      setSearchResults([]);
    } finally {
      setSearchLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (selectingSlot) searchPlayers(searchQuery);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery, selectingSlot, searchPlayers]);

  // ─── Load player profile ─────────────────────────────────────

  const loadPlayer = async (userId: string): Promise<PlayerProfile | null> => {
    try {
      const res = await fetch(`/api/players/${userId}`);
      if (!res.ok) return null;
      const data = await res.json();
      return data.profile as PlayerProfile;
    } catch {
      return null;
    }
  };

  const handleSelectPlayer = async (userId: string, name: string) => {
    const profile = await loadPlayer(userId);
    if (!profile) {
      toast({ title: 'Error', description: 'Could not load player data', variant: 'destructive' });
      return;
    }

    if (selectingSlot === 'A') {
      setPlayerA(profile);
    } else {
      setPlayerB(profile);
    }

    setSelectingSlot(null);
    setSearchQuery('');
    setSearchResults([]);
  };

  // ─── Both selected ────────────────────────────────────────────

  const bothSelected = playerA && playerB;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 bg-warm-50 flex flex-col"
    >
      {/* Header */}
      <header className="sticky top-0 z-10 bg-warm-50/90 backdrop-blur-md border-b border-warm-200/60">
        <div className="px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-brand-gold to-brand-gold-dark flex items-center justify-center">
              <BarChart3 className="w-4 h-4 text-white" />
            </div>
            <h1 className="text-base font-black tracking-wider text-warm-800">
              COMPARE
            </h1>
            <Badge className="bg-brand-gold/20 text-brand-gold text-[9px] border-0 font-bold">
              <Crown className="w-2.5 h-2.5 mr-0.5" />
              PRO
            </Badge>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-warm-200 flex items-center justify-center text-warm-600 hover:bg-warm-300 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* Content */}
      <div className="flex-1 overflow-y-auto custom-scrollbar px-4 py-4 space-y-4">
        {/* Player Selection Cards */}
        <div className="grid grid-cols-2 gap-3">
          {/* Player A */}
          <Card
            className="p-3 cursor-pointer hover:border-brand-teal/30 transition-colors border-2 border-dashed"
            onClick={() => setSelectingSlot('A')}
          >
            {playerA ? (
              <div className="flex flex-col items-center gap-2">
                <div className="w-12 h-12 rounded-full bg-brand-teal/10 border-2 border-brand-teal flex items-center justify-center overflow-hidden">
                  {playerA.user.avatar ? (
                    <img src={playerA.user.avatar} alt={playerA.user.name} className="w-full h-full object-cover" />
                  ) : (
                    <span className="text-brand-teal font-bold">{getInitials(playerA.user.name)}</span>
                  )}
                </div>
                <p className="text-xs font-bold text-warm-800 truncate text-center">{getDisplayName(playerA.user.name)}</p>
                <Badge className="bg-brand-teal/10 text-brand-teal text-[9px] border-0">A</Badge>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-4 gap-2">
                <div className="w-10 h-10 rounded-full bg-brand-teal/10 flex items-center justify-center">
                  <Search className="w-5 h-5 text-brand-teal" />
                </div>
                <p className="text-[10px] text-warm-500 text-center">Select Player A</p>
              </div>
            )}
          </Card>

          {/* Player B */}
          <Card
            className="p-3 cursor-pointer hover:border-brand-gold/30 transition-colors border-2 border-dashed"
            onClick={() => setSelectingSlot('B')}
          >
            {playerB ? (
              <div className="flex flex-col items-center gap-2">
                <div className="w-12 h-12 rounded-full bg-brand-gold/10 border-2 border-brand-gold flex items-center justify-center overflow-hidden">
                  {playerB.user.avatar ? (
                    <img src={playerB.user.avatar} alt={playerB.user.name} className="w-full h-full object-cover" />
                  ) : (
                    <span className="text-brand-gold font-bold">{getInitials(playerB.user.name)}</span>
                  )}
                </div>
                <p className="text-xs font-bold text-warm-800 truncate text-center">{getDisplayName(playerB.user.name)}</p>
                <Badge className="bg-brand-gold/10 text-brand-gold text-[9px] border-0">B</Badge>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-4 gap-2">
                <div className="w-10 h-10 rounded-full bg-brand-gold/10 flex items-center justify-center">
                  <Search className="w-5 h-5 text-brand-gold" />
                </div>
                <p className="text-[10px] text-warm-500 text-center">Select Player B</p>
              </div>
            )}
          </Card>
        </div>

        {/* VS badge */}
        {bothSelected && (
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: 'spring', damping: 10, stiffness: 200 }}
            className="flex justify-center -my-1"
          >
            <div className="w-10 h-10 rounded-full bg-brand-red flex items-center justify-center shadow-lg">
              <span className="text-white font-black text-xs">VS</span>
            </div>
          </motion.div>
        )}

        {/* Comparison Stats */}
        {bothSelected && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.1 }}
          >
            <Card className="p-4 space-y-4">
              <h3 className="text-sm font-black tracking-wider text-warm-700 flex items-center gap-2">
                <BarChart3 className="w-4 h-4 text-warm-400" />
                HEAD TO HEAD
              </h3>

              {/* Color legend */}
              <div className="flex items-center justify-center gap-4 text-[10px]">
                <div className="flex items-center gap-1.5">
                  <div className="w-3 h-3 rounded-full bg-brand-teal" />
                  <span className="text-warm-600 font-medium">{getDisplayName(playerA.user.name)}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-3 h-3 rounded-full bg-brand-gold" />
                  <span className="text-warm-600 font-medium">{getDisplayName(playerB.user.name)}</span>
                </div>
              </div>

              <StatRow label="Overall Rating" valueA={playerA.overallRating} valueB={playerB.overallRating} format={(v) => v.toFixed(1)} />
              <StatRow label="Raid Points" valueA={playerA.successfulRaids + playerA.bonusPoints} valueB={playerB.successfulRaids + playerB.bonusPoints} />
              <StatRow label="Successful Raids" valueA={playerA.successfulRaids} valueB={playerB.successfulRaids} />
              <StatRow label="Total Raids" valueA={playerA.totalRaids} valueB={playerB.totalRaids} />
              <StatRow label="Raid Success %" valueA={playerA.totalRaids > 0 ? Math.round((playerA.successfulRaids / playerA.totalRaids) * 100) : 0} valueB={playerB.totalRaids > 0 ? Math.round((playerB.successfulRaids / playerB.totalRaids) * 100) : 0} format={(v) => `${v}%`} />
              <StatRow label="Tackle Points" valueA={playerA.successfulTackles} valueB={playerB.successfulTackles} />
              <StatRow label="Total Tackles" valueA={playerA.totalTackles} valueB={playerB.totalTackles} />
              <StatRow label="Tackle Success %" valueA={playerA.totalTackles > 0 ? Math.round((playerA.successfulTackles / playerA.totalTackles) * 100) : 0} valueB={playerB.totalTackles > 0 ? Math.round((playerB.successfulTackles / playerB.totalTackles) * 100) : 0} format={(v) => `${v}%`} />
              <StatRow label="Bonus Points" valueA={playerA.bonusPoints} valueB={playerB.bonusPoints} />
              <StatRow label="Super Tackles" valueA={playerA.superTackles} valueB={playerB.superTackles} />

              {/* Verdict */}
              <div className="mt-4 p-3 rounded-xl bg-warm-100 text-center">
                <p className="text-[10px] text-warm-500 font-medium uppercase tracking-wide">Verdict</p>
                <p className="text-sm font-bold text-warm-800 mt-1">
                  {playerA.overallRating > playerB.overallRating
                    ? `${getDisplayName(playerA.user.name)} leads by ${(playerA.overallRating - playerB.overallRating).toFixed(1)} pts`
                    : playerB.overallRating > playerA.overallRating
                      ? `${getDisplayName(playerB.user.name)} leads by ${(playerB.overallRating - playerA.overallRating).toFixed(1)} pts`
                      : 'Both players are evenly matched!'}
                </p>
              </div>
            </Card>
          </motion.div>
        )}

        {/* Empty state */}
        {!bothSelected && !selectingSlot && (
          <div className="flex flex-col items-center justify-center py-10">
            <div className="w-16 h-16 rounded-full bg-warm-200 flex items-center justify-center mb-4">
              <Swords className="w-8 h-8 text-warm-400" />
            </div>
            <p className="text-warm-700 font-bold">Compare Players</p>
            <p className="text-warm-400 text-sm mt-1 text-center max-w-[240px]">
              Select two players above to compare their stats head-to-head
            </p>
          </div>
        )}
      </div>

      {/* Player Selection Overlay */}
      <AnimatePresence>
        {selectingSlot && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className="absolute inset-0 bg-warm-50 z-20 flex flex-col"
          >
            {/* Search header */}
            <div className="px-4 py-3 border-b border-warm-200/60 bg-warm-50">
              <div className="flex items-center gap-3">
                <button
                  onClick={() => {
                    setSelectingSlot(null);
                    setSearchQuery('');
                    setSearchResults([]);
                  }}
                  className="w-8 h-8 rounded-full bg-warm-200 flex items-center justify-center text-warm-600 hover:bg-warm-300 transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
                <div className="flex-1">
                  <Input
                    placeholder={`Search for Player ${selectingSlot}...`}
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="bg-white border-warm-300 rounded-xl h-9"
                    autoFocus
                  />
                </div>
              </div>
              <p className="text-[10px] text-warm-500 mt-2 ml-11">
                Selecting Player {selectingSlot === 'A' ? (
                  <span className="text-brand-teal font-bold">A</span>
                ) : (
                  <span className="text-brand-gold font-bold">B</span>
                )}
              </p>
            </div>

            {/* Results */}
            <div className="flex-1 overflow-y-auto custom-scrollbar px-4 py-3 space-y-2">
              {searchLoading ? (
                <div className="flex items-center justify-center py-8">
                  <div className="w-8 h-8 border-2 border-warm-300 border-t-brand-teal rounded-full animate-spin" />
                </div>
              ) : searchResults.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-10">
                  <Search className="w-10 h-10 text-warm-300 mb-2" />
                  <p className="text-warm-500 text-sm">
                    {searchQuery ? 'No players found' : 'Type to search players'}
                  </p>
                </div>
              ) : (
                searchResults.map((player) => (
                  <Card
                    key={player.id}
                    className="p-3 cursor-pointer hover:border-brand-teal/30 transition-colors active:scale-[0.98]"
                    onClick={() => handleSelectPlayer(player.userId, getDisplayName(player.user.name))}
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-warm-200 flex items-center justify-center overflow-hidden">
                        {player.user.avatar ? (
                          <img src={player.user.avatar} alt={player.user.name} className="w-full h-full object-cover" />
                        ) : (
                          <span className="text-warm-600 font-bold text-sm">{getInitials(player.user.name)}</span>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-warm-800 truncate">{getDisplayName(player.user.name)}</p>
                        <p className="text-[10px] text-warm-500">
                          Rating: {player.overallRating.toFixed(1)} · Raids: {player.successfulRaids} · Tackles: {player.successfulTackles}
                        </p>
                      </div>
                      <Zap className="w-4 h-4 text-warm-300" />
                    </div>
                  </Card>
                ))
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
