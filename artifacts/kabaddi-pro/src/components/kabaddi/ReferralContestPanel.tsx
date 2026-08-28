'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Clock,
  Trophy,
  Crown,
  Medal,
  Share2,
  Loader2,
  Users,
  Zap,
  Award,
  TrendingUp,
  Sparkles,
  X,
} from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useKabaddiStore } from '@/lib/store';
import { useToast } from '@/hooks/use-toast';

// ─── Types ────────────────────────────────────────────────────────

interface ReferralContestPanelProps {
  onClose: () => void;
  onOpenReferral?: () => void;
}

interface ContestRound {
  id: string;
  roundNumber: number;
  startDate: string;
  endDate: string;
  status: string;
  hasEnded: boolean;
  prize: string;
  durationDays: number;
}

interface LeaderboardEntry {
  userId: string;
  name: string;
  avatar: string | null;
  playerCode: string | null;
  referralCount: number;
  rank: number;
}

interface PastWinner {
  roundNumber: number;
  userId: string;
  name: string;
  avatar: string | null;
  playerCode: string | null;
  referralCount: number;
  prize: string;
}

interface ContestStatus {
  round: ContestRound;
  myRank: number | null;
  myReferralCount: number;
  leaderboard: LeaderboardEntry[];
  pastWinners: PastWinner[];
  totalParticipants: number;
}

// ─── Helper: countdown timer ──────────────────────────────────────

function useCountdown(endDate: string | null) {
  const [timeLeft, setTimeLeft] = useState({ days: 0, hours: 0, minutes: 0, seconds: 0 });
  useEffect(() => {
    if (!endDate) return;
    const update = () => {
      const diff = new Date(endDate).getTime() - Date.now();
      if (diff <= 0) {
        setTimeLeft({ days: 0, hours: 0, minutes: 0, seconds: 0 });
        return;
      }
      setTimeLeft({
        days: Math.floor(diff / (1000 * 60 * 60 * 24)),
        hours: Math.floor((diff / (1000 * 60 * 60)) % 24),
        minutes: Math.floor((diff / (1000 * 60)) % 60),
        seconds: Math.floor((diff / 1000) % 60),
      });
    };
    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, [endDate]);
  return timeLeft;
}

// ─── Component ────────────────────────────────────────────────────

export default function ReferralContestPanel({ onClose, onOpenReferral }: ReferralContestPanelProps) {
  const currentUser = useKabaddiStore((s) => s.currentUser);
  const language = useKabaddiStore((s) => s.language);
  const { toast } = useToast();
  const [status, setStatus] = useState<ContestStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [adminLoading, setAdminLoading] = useState(false);

  const timeLeft = useCountdown(status?.round?.endDate || null);

  const fetchStatus = useCallback(async () => {
    try {
      const res = await fetch(`/api/referral-contest/status?userId=${currentUser?.id || ''}`);
      if (res.ok) {
        const data = await res.json();
        setStatus(data);
      }
    } catch (err) {
      console.error('Referral contest status error:', err);
    } finally {
      setLoading(false);
    }
  }, [currentUser?.id]);

  useEffect(() => {
    fetchStatus();
  }, [fetchStatus]);

  // Admin: select winners
  const handleAdminSelectWinners = async () => {
    if (!currentUser?.isAdmin) return;
    setAdminLoading(true);
    try {
      const res = await fetch('/api/referral-contest/admin/select-winners', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ adminId: currentUser.id }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        toast({
          title: '🎉 Winner Selected!',
          description: `${data.winner.name} won ${data.prize} with ${data.winner.referralCount} referrals`,
        });
        fetchStatus();
      } else {
        toast({ title: 'Error', description: data.error || 'Failed to select winner', variant: 'destructive' });
      }
    } catch (err) {
      toast({ title: 'Error', description: 'Failed to select winner', variant: 'destructive' });
    } finally {
      setAdminLoading(false);
    }
  };

  const handleAdminForceNext = async () => {
    if (!currentUser?.isAdmin) return;
    setAdminLoading(true);
    try {
      const res = await fetch('/api/referral-contest/admin/force-start-next-round', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ adminId: currentUser.id }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        toast({
          title: 'Round Rolled',
          description: `Completed round ${data.completedRound}, started round ${data.nextRound}`,
        });
        fetchStatus();
      } else {
        toast({ title: 'Error', description: data.error || 'Failed', variant: 'destructive' });
      }
    } finally {
      setAdminLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-purple-500" />
      </div>
    );
  }

  if (!status) {
    return (
      <div className="p-6 text-center">
        <p className="text-sm text-warm-500">
          {language === 'hi' ? 'कोई सक्रिय कॉन्टेस्ट नहीं मिला' : 'No active contest found'}
        </p>
      </div>
    );
  }

  const { round, myRank, myReferralCount, leaderboard, pastWinners, totalParticipants } = status;

  // Get medal color for rank
  const getMedalColor = (rank: number) => {
    if (rank === 1) return 'from-yellow-400 to-amber-500';
    if (rank === 2) return 'from-gray-300 to-gray-400';
    if (rank === 3) return 'from-orange-400 to-amber-700';
    return 'from-warm-200 to-warm-300';
  };

  const isUserInTop10 = leaderboard.some((e) => e.userId === currentUser?.id);

  return (
    <div className="p-4 space-y-4 max-w-md mx-auto pb-8">
      {/* Hero / Prize Card */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <Card className="overflow-hidden border-2 border-purple-300 dark:border-purple-800/50">
          {/* Top banner with prize */}
          <div className="bg-gradient-to-br from-purple-600 via-pink-600 to-orange-500 p-5 text-center text-white">
            <motion.div
              animate={{ rotate: [0, -10, 10, 0] }}
              transition={{ duration: 2, repeat: Infinity, repeatDelay: 3 }}
              className="inline-block mb-2"
            >
              <Trophy className="w-12 h-12 mx-auto" />
            </motion.div>
            <h2 className="text-xl font-black mb-1">🎯 Referral Contest</h2>
            <p className="text-xs opacity-90 mb-3">
              {language === 'hi' ? 'हर महीने · 30 दिन' : 'Every month · 30 days'}
            </p>
            <div className="inline-block bg-white/20 backdrop-blur-sm rounded-xl px-4 py-2">
              <p className="text-[10px] uppercase tracking-wide opacity-80">
                {language === 'hi' ? 'इनाम' : 'Prize'}
              </p>
              <p className="text-lg font-bold">🥣 1kg Oats Pack</p>
              <p className="text-[10px] opacity-90">High Protein · Chocolate</p>
            </div>
          </div>
          {/* Round info */}
          <div className="p-3 bg-white dark:bg-warm-800 text-center">
            <p className="text-xs text-warm-500 dark:text-warm-400">
              {language === 'hi' ? 'राउंड' : 'Round'} #{round.roundNumber}
              {round.hasEnded && (
                <span className="ml-2 text-amber-600 dark:text-amber-400 font-semibold">
                  · {language === 'hi' ? 'विजेता की घोषणा लंबित' : 'Awaiting winner'}
                </span>
              )}
            </p>
          </div>
        </Card>
      </motion.div>

      {/* Countdown Timer */}
      <Card className="p-4 bg-gradient-to-br from-purple-500/10 to-pink-500/10 border-purple-500/30 text-center">
        <div className="flex items-center justify-center gap-1.5 mb-2">
          <Clock className="w-4 h-4 text-purple-500" />
          <p className="text-xs font-bold text-purple-600 dark:text-purple-400 uppercase tracking-wider">
            {round.hasEnded
              ? (language === 'hi' ? 'राउंड समाप्त' : 'Round Ended')
              : (language === 'hi' ? 'अगला राउंड शुरू होने में' : 'Next Round Starts In')}
          </p>
        </div>
        {!round.hasEnded && (
          <div className="grid grid-cols-4 gap-2">
            {[
              { label: language === 'hi' ? 'दिन' : 'Days', value: timeLeft.days },
              { label: language === 'hi' ? 'घंटे' : 'Hrs', value: timeLeft.hours },
              { label: language === 'hi' ? 'मिनट' : 'Min', value: timeLeft.minutes },
              { label: language === 'hi' ? 'सेकंड' : 'Sec', value: timeLeft.seconds },
            ].map((unit) => (
              <div key={unit.label} className="bg-white dark:bg-warm-800 rounded-lg p-2 shadow-sm">
                <div className="text-lg font-black text-purple-600 dark:text-purple-400">
                  {String(unit.value).padStart(2, '0')}
                </div>
                <div className="text-[9px] text-warm-500 uppercase tracking-wide">
                  {unit.label}
                </div>
              </div>
            ))}
          </div>
        )}
        <div className="mt-3 flex items-center justify-center gap-3 text-xs">
          <span className="flex items-center gap-1 text-warm-500 dark:text-warm-400">
            <Users className="w-3 h-3" />
            {totalParticipants} {language === 'hi' ? 'भागीदार' : 'participants'}
          </span>
        </div>
      </Card>

      {/* Your Stats */}
      <Card className="p-4 border-2 border-purple-200 dark:border-purple-900/50 bg-gradient-to-br from-purple-50 to-white dark:from-purple-900/20 dark:to-warm-800">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-purple-500" />
            <h3 className="text-sm font-bold text-warm-800 dark:text-warm-100">
              {language === 'hi' ? 'आपकी रैंक' : 'Your Rank'}
            </h3>
          </div>
          {myRank !== null && myRank === 1 && (
            <Badge className="bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400 text-xs">
              <Crown className="w-3 h-3 mr-1" />
              {language === 'hi' ? 'लीड कर रहे हैं!' : 'Leading!'}
            </Badge>
          )}
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-white dark:bg-warm-800 rounded-xl p-3 text-center">
            <p className="text-[10px] uppercase tracking-wide text-warm-500">
              {language === 'hi' ? 'रैंक' : 'Rank'}
            </p>
            <p className="text-2xl font-black text-purple-600 dark:text-purple-400">
              {myRank !== null ? `#${myRank}` : '—'}
            </p>
          </div>
          <div className="bg-white dark:bg-warm-800 rounded-xl p-3 text-center">
            <p className="text-[10px] uppercase tracking-wide text-warm-500">
              {language === 'hi' ? 'रेफरल' : 'Referrals'}
            </p>
            <p className="text-2xl font-black text-pink-600 dark:text-pink-400">
              {myReferralCount}
            </p>
          </div>
        </div>
        {myReferralCount === 0 && (
          <p className="text-[10px] text-warm-500 dark:text-warm-400 text-center mt-2">
            {language === 'hi'
              ? 'रेफरल शेयर करके भाग लें!'
              : 'Share your referral code to participate!'}
          </p>
        )}
        {/* CTA: Share referral */}
        <Button
          onClick={() => onOpenReferral?.()}
          className="w-full mt-3 bg-gradient-to-r from-purple-500 to-pink-500 hover:opacity-90 text-white font-semibold text-sm h-10"
        >
          <Share2 className="w-4 h-4 mr-1.5" />
          {language === 'hi' ? 'रेफरल कोड शेयर करें' : 'Share Referral Code'}
        </Button>
      </Card>

      {/* Leaderboard */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-bold text-warm-800 dark:text-warm-100 flex items-center gap-2">
            <Medal className="w-4 h-4 text-amber-500" />
            {language === 'hi' ? 'लीडरबोर्ड' : 'Leaderboard'}
          </h3>
          <span className="text-xs text-warm-500">
            {language === 'hi' ? 'टॉप 10' : 'Top 10'}
          </span>
        </div>

        {leaderboard.length === 0 ? (
          <Card className="p-6 text-center">
            <Users className="w-10 h-10 mx-auto text-warm-300 dark:text-warm-600 mb-2" />
            <p className="text-sm text-warm-500 dark:text-warm-400">
              {language === 'hi'
                ? 'अभी कोई रेफरल नहीं हुआ। पहले रेफरल शेयर करें और लीड करें!'
                : 'No referrals yet. Be the first to share and lead!'}
            </p>
          </Card>
        ) : (
          <div className="space-y-2">
            <AnimatePresence>
              {leaderboard.map((entry, index) => {
                const isMe = entry.userId === currentUser?.id;
                const isTop3 = entry.rank <= 3;
                return (
                  <motion.div
                    key={entry.userId}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.04 }}
                  >
                    <Card className={`p-3 flex items-center gap-3 transition-all ${
                      isMe
                        ? 'border-2 border-purple-400 dark:border-purple-600 bg-purple-50/50 dark:bg-purple-900/20'
                        : 'border-warm-200 dark:border-warm-700'
                    }`}>
                      {/* Rank */}
                      <div className={`shrink-0 w-10 h-10 rounded-full flex items-center justify-center font-black text-sm bg-gradient-to-br ${getMedalColor(entry.rank)} ${entry.rank <= 3 ? 'text-white shadow-md' : 'text-warm-700 dark:text-warm-200'}`}>
                        {entry.rank}
                      </div>
                      {/* Avatar */}
                      <div className="shrink-0 w-9 h-9 rounded-full overflow-hidden bg-warm-200 dark:bg-warm-700 flex items-center justify-center text-sm font-bold text-warm-600 dark:text-warm-300">
                        {entry.avatar ? (
                          <img src={entry.avatar} alt={entry.name} className="w-full h-full object-cover" />
                        ) : (
                          entry.name?.charAt(0)?.toUpperCase() || '?'
                        )}
                      </div>
                      {/* Name + playerCode */}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-warm-800 dark:text-warm-100 truncate flex items-center gap-1">
                          {entry.name}
                          {isMe && (
                            <Badge className="text-[8px] bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300">
                              YOU
                            </Badge>
                          )}
                          {entry.rank === 1 && (
                            <Crown className="w-3 h-3 text-yellow-500" />
                          )}
                        </p>
                        {entry.playerCode && (
                          <p className="text-[10px] text-warm-500 dark:text-warm-400">
                            {entry.playerCode}
                          </p>
                        )}
                      </div>
                      {/* Referral count */}
                      <div className="text-right shrink-0">
                        <p className="text-lg font-black text-purple-600 dark:text-purple-400">
                          {entry.referralCount}
                        </p>
                        <p className="text-[9px] text-warm-500 uppercase">
                          {language === 'hi' ? 'रेफरल' : 'referrals'}
                        </p>
                      </div>
                    </Card>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>
        )}

        {/* Show user's position if outside top 10 */}
        {!isUserInTop10 && myRank !== null && myReferralCount > 0 && (
          <Card className="mt-3 p-3 flex items-center gap-3 border-2 border-dashed border-purple-300 dark:border-purple-700 bg-purple-50/30 dark:bg-purple-900/10">
            <div className="shrink-0 w-10 h-10 rounded-full flex items-center justify-center font-black text-sm bg-warm-200 dark:bg-warm-700 text-warm-700 dark:text-warm-200">
              {myRank}
            </div>
            <div className="flex-1">
              <p className="text-sm font-semibold text-warm-800 dark:text-warm-100">
                {language === 'hi' ? 'आप' : 'You'} · {currentUser?.name || ''}
              </p>
              <p className="text-[10px] text-warm-500">
                {language === 'hi' ? 'टॉप 10 से बाहर' : 'Outside top 10'}
              </p>
            </div>
            <div className="text-right">
              <p className="text-lg font-black text-purple-600 dark:text-purple-400">
                {myReferralCount}
              </p>
              <p className="text-[9px] text-warm-500 uppercase">
                {language === 'hi' ? 'रेफरल' : 'referrals'}
              </p>
            </div>
          </Card>
        )}
      </div>

      {/* How It Works */}
      <Card className="p-4 bg-gradient-to-br from-blue-50 to-warm-50 dark:from-blue-900/20 dark:to-warm-800 border-blue-200 dark:border-blue-800">
        <div className="flex items-center gap-2 mb-3">
          <Sparkles className="w-4 h-4 text-blue-500" />
          <h3 className="text-sm font-bold text-warm-800 dark:text-warm-100">
            {language === 'hi' ? 'कैसे काम करता है' : 'How It Works'}
          </h3>
        </div>
        <ol className="space-y-2 text-xs text-warm-600 dark:text-warm-300">
          <li className="flex gap-2">
            <span className="font-bold text-blue-500">1.</span>
            <span>
              {language === 'hi'
                ? 'अपना रेफरल कोड दोस्तों को शेयर करें।'
                : 'Share your referral code with friends.'}
            </span>
          </li>
          <li className="flex gap-2">
            <span className="font-bold text-blue-500">2.</span>
            <span>
              {language === 'hi'
                ? 'जब वे साइन अप करते हैं, आपका रेफरल काउंट बढ़ता है।'
                : 'When they sign up, your referral count goes up.'}
            </span>
          </li>
          <li className="flex gap-2">
            <span className="font-bold text-blue-500">3.</span>
            <span>
              {language === 'hi'
                ? 'महीने के अंत में सबसे ज्यादा रेफरल करने वाला खिलाड़ी जीतता है।'
                : 'At month end, the player with the most referrals wins.'}
            </span>
          </li>
          <li className="flex gap-2">
            <span className="font-bold text-blue-500">4.</span>
            <span>
              {language === 'hi'
                ? 'कॉन्टेस्ट हर 30 दिन में रीसेट होता है।'
                : 'Contest resets every 30 days.'}
            </span>
          </li>
        </ol>
      </Card>

      {/* Past Winners */}
      {pastWinners.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-3">
            <Award className="w-4 h-4 text-amber-500" />
            <h3 className="text-sm font-bold text-warm-800 dark:text-warm-100">
              {language === 'hi' ? 'पिछले विजेता' : 'Past Winners'}
            </h3>
          </div>
          <div className="space-y-2">
            {pastWinners.map((winner, idx) => (
              <Card key={`${winner.roundNumber}-${winner.userId}`} className="p-3 flex items-center gap-3 bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-900/20 dark:to-warm-800 border-amber-200 dark:border-amber-800/50">
                <div className="shrink-0 w-10 h-10 rounded-full bg-gradient-to-br from-yellow-400 to-amber-500 flex items-center justify-center text-white shadow-md">
                  <Crown className="w-5 h-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-warm-800 dark:text-warm-100 truncate">
                    {winner.name}
                  </p>
                  <p className="text-[10px] text-warm-500 dark:text-warm-400">
                    {language === 'hi' ? 'राउंड' : 'Round'} #{winner.roundNumber}
                    {winner.playerCode && ` · ${winner.playerCode}`}
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-sm font-black text-amber-600 dark:text-amber-400">
                    {winner.referralCount}
                  </p>
                  <p className="text-[9px] text-warm-500 uppercase">
                    {language === 'hi' ? 'रेफरल' : 'referrals'}
                  </p>
                </div>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Admin Panel */}
      {currentUser?.isAdmin && (
        <Card className="p-4 border-2 border-red-300 dark:border-red-800/50 bg-red-50/50 dark:bg-red-900/10">
          <div className="flex items-center gap-2 mb-3">
            <Zap className="w-4 h-4 text-red-500" />
            <h3 className="text-sm font-bold text-red-700 dark:text-red-400">
              {language === 'hi' ? 'एडमिन पैनल' : 'Admin Panel'}
            </h3>
          </div>
          <div className="space-y-2">
            <Button
              onClick={handleAdminSelectWinners}
              disabled={adminLoading || round.hasEnded}
              className="w-full bg-red-500 hover:bg-red-600 text-white text-xs h-9"
            >
              {adminLoading ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Crown className="w-4 h-4 mr-1" />}
              {language === 'hi' ? 'विजेता चुनें (टॉप रेफरर)' : 'Select Winner (Top Referrer)'}
            </Button>
            <Button
              onClick={handleAdminForceNext}
              disabled={adminLoading}
              variant="outline"
              className="w-full text-xs h-9 border-red-300 dark:border-red-700 text-red-600 dark:text-red-400"
            >
              {language === 'hi' ? 'अगला राउंड बलपूर्वक शुरू करें' : 'Force Start Next Round'}
            </Button>
          </div>
          <p className="text-[10px] text-warm-500 dark:text-warm-400 mt-2">
            {language === 'hi'
              ? 'नोट: विजेता चुनने से वर्तमान राउंड समाप्त हो जाएगा और नया राउंड शुरू होगा।'
              : 'Note: Selecting winner will end the current round and start a new one.'}
          </p>
        </Card>
      )}
    </div>
  );
}
