'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Trophy, Crown, Award } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

interface MotmAward {
  matchId: string;
  userId: string;
  userName: string;
  userAvatar: string | null;
  teamName: string | null;
  points: number;
  matchInfo: string;
  tournamentName: string | null;
  completedAt: string | null;
  homeTeamColor: string | null;
  awayTeamColor: string | null;
}

interface MatchAwardsScreenProps {
  onClose: () => void;
}

export default function MatchAwardsScreen({ onClose }: MatchAwardsScreenProps) {
  const [awards, setAwards] = useState<MotmAward[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchAwards = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/match-awards?limit=20');
      if (!res.ok) throw new Error('Failed to fetch');
      const data = await res.json();
      setAwards(data.awards || []);
    } catch (err) {
      console.error('Match awards fetch error:', err);
      setAwards([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAwards();
  }, [fetchAwards]);

  const formatTimeAgo = (dateStr: string | null) => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    if (diffMins < 60) return `${diffMins}m ago`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    const diffDays = Math.floor(diffHours / 24);
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  };

  return (
    <AnimatePresence>
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
                <Award className="w-4 h-4 text-white" />
              </div>
              <h1 className="text-base font-black tracking-wider text-warm-800">
                MATCH AWARDS
              </h1>
            </div>
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-full bg-warm-200 flex items-center justify-center text-warm-600 hover:bg-warm-300 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </header>

        {/* Awards List */}
        <div className="flex-1 overflow-y-auto px-4 py-3">
          {loading ? (
            <div className="flex flex-col gap-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-24 rounded-xl bg-warm-100 animate-pulse" />
              ))}
            </div>
          ) : awards.length > 0 ? (
            <motion.div
              className="flex flex-col gap-3"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
            >
              {awards.map((award, idx) => (
                <motion.div
                  key={`${award.matchId}-${award.userId}`}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: idx * 0.06 }}
                >
                  <Card className="bg-gradient-to-r from-brand-gold/10 to-brand-gold-dark/5 border-brand-gold/30 border py-0 gap-0 overflow-hidden">
                    <CardContent className="p-4">
                      <div className="flex items-center gap-3">
                        {/* Avatar */}
                        <div className="relative shrink-0">
                          <div className="w-14 h-14 rounded-full bg-warm-100 border-2 border-brand-gold/40 flex items-center justify-center overflow-hidden">
                            {award.userAvatar ? (
                              <img src={award.userAvatar} alt={award.userName} className="w-full h-full object-cover" />
                            ) : (
                              <span className="text-lg font-bold text-warm-500">
                                {award.userName.charAt(0).toUpperCase()}
                              </span>
                            )}
                          </div>
                          <div className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-brand-gold flex items-center justify-center">
                            <Crown className="w-3 h-3 text-white" />
                          </div>
                        </div>

                        {/* Info */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <Badge className="bg-brand-gold/20 text-brand-gold-dark text-[10px] font-semibold border-0 px-2 py-0.5">
                              <Trophy className="w-2.5 h-2.5 mr-0.5" />
                              Man of the Match
                            </Badge>
                          </div>
                          <p className="text-warm-800 font-bold text-sm mt-1 truncate">
                            {award.userName}
                          </p>
                          {award.teamName && (
                            <p className="text-warm-500 text-xs">{award.teamName}</p>
                          )}
                          <p className="text-warm-400 text-[11px] mt-0.5">
                            {award.matchInfo}
                          </p>
                          {award.tournamentName && (
                            <p className="text-warm-400 text-[10px]">
                              {award.tournamentName}
                            </p>
                          )}
                        </div>

                        {/* Points */}
                        <div className="text-right shrink-0">
                          <p className="text-brand-gold font-black text-base">
                            {award.points}
                          </p>
                          <p className="text-warm-400 text-[10px]">points</p>
                          <p className="text-warm-400 text-[10px] mt-1">
                            {formatTimeAgo(award.completedAt)}
                          </p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              ))}
            </motion.div>
          ) : (
            <div className="flex flex-col items-center justify-center py-16">
              <Award className="w-12 h-12 text-warm-300 mb-3" />
              <p className="text-warm-600 text-sm font-medium">No awards yet</p>
              <p className="text-warm-400 text-xs mt-1">
                Complete matches to see MOTM awards here
              </p>
            </div>
          )}
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
