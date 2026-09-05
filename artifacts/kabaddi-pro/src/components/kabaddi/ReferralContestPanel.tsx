'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import {
  Clock,
  Trophy,
  Crown,
  Medal,
  Share2,
  Loader2,
  Users,
  Zap,
  Sparkles,
  LogIn,
  CheckCircle2,
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
  enteredAt?: string | null;
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
  hasEntered: boolean;
  enteredAt: string | null;
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
  const [entering, setEntering] = useState(false);
  // Previous winners of the OLD 15-day random-draw giveaway (Protein Powder /
  // Kabaddi Kit / Shaker Bottle). That giveaway has been retired, but we still
  // display its historical winners so they're not erased from the app.
  const [oldGiveawayWinners, setOldGiveawayWinners] = useState<Array<{
    roundNumber: number; rank: number; playerId: string; prize: string;
  }>>([]);

  // Compact pill-style tab switcher for the leaderboard / winners section.
  // 'leaderboard'       — current contest, all participants, rank-wise
  // 'contest-winners'   — past referral contest winners (Oats pack)
  // 'giveaway-winners'  — old 15-day random-draw winners (Protein/Kit/Bottle)
  const [lbTab, setLbTab] = useState<'leaderboard' | 'contest-winners' | 'giveaway-winners'>('leaderboard');

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

  // Fetch the old 15-day giveaway's past winners (one-time, fire and forget).
  // The /api/giveaway/status endpoint still exists in the backend and returns
  // { pastWinners: [{ roundNumber, rank, playerId, prize }] } where playerId
  // is actually the player's code (e.g. "KP1003").
  useEffect(() => {
    fetch('/api/giveaway/status')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.pastWinners?.length > 0) {
          setOldGiveawayWinners(data.pastWinners);
        }
      })
      .catch(() => { /* non-critical — just don't show old winners */ });
  }, []);

  // Enter the contest — creates a ReferralContestParticipant row
  const handleEnterContest = async () => {
    if (!currentUser?.id) return;
    setEntering(true);
    try {
      const res = await fetch('/api/referral-contest/enter', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: currentUser.id }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        toast({
          title: data.alreadyEntered
            ? (language === 'hi' ? 'आप पहले ही भाग ले चुके हैं' : 'You were already entered')
            : (language === 'hi' ? '🎉 कॉन्टेस्ट में आपका प्रवेश हो गया!' : '🎉 You\'re entered!'),
          description: data.alreadyEntered
            ? undefined
            : (language === 'hi'
                ? 'अब आपके रेफरल जीत की ओर गिने जाएंगे!'
                : 'Your referrals now count toward winning!'),
        });
        fetchStatus();
      } else {
        toast({
          title: language === 'hi' ? 'त्रुटि' : 'Error',
          description: data.error || (language === 'hi' ? 'प्रवेश विफल' : 'Failed to enter'),
          variant: 'destructive',
        });
      }
    } catch (err) {
      toast({
        title: language === 'hi' ? 'त्रुटि' : 'Error',
        description: language === 'hi' ? 'प्रवेश विफल' : 'Failed to enter',
        variant: 'destructive',
      });
    } finally {
      setEntering(false);
    }
  };

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
        <Trophy className="w-12 h-12 mx-auto text-purple-300 dark:text-purple-700 mb-3" />
        <p className="text-sm text-warm-500 mb-4">
          {language === 'hi' ? 'कॉन्टेस्ट लोड हो रहा है...' : 'Loading contest...'}
        </p>
        <Button
          onClick={() => {
            setLoading(true);
            fetchStatus();
          }}
          variant="outline"
          className="text-xs h-8"
        >
          {language === 'hi' ? 'पुनः प्रयास करें' : 'Retry'}
        </Button>
      </div>
    );
  }

  const { round, myRank, myReferralCount, leaderboard, pastWinners, totalParticipants } = status;

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

      {/* Entry / Your Stats — two states */}
      {!status.hasEntered ? (
        // User has NOT entered the contest yet — show big "Enter Contest" CTA
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
        >
          <Card className="p-5 border-2 border-dashed border-purple-400 dark:border-purple-700 bg-gradient-to-br from-purple-50 to-pink-50 dark:from-purple-900/30 dark:to-warm-800 text-center">
            <motion.div
              animate={{ y: [0, -4, 0] }}
              transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
              className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 mb-3 shadow-lg shadow-purple-500/30"
            >
              <LogIn className="w-7 h-7 text-white" />
            </motion.div>
            <h3 className="text-base font-black text-purple-700 dark:text-purple-300 mb-1">
              {language === 'hi' ? 'कॉन्टेस्ट में भाग लें!' : 'Enter the Contest!'}
            </h3>
            <p className="text-xs text-warm-600 dark:text-warm-300 mb-3">
              {language === 'hi'
                ? 'जब तक आप प्रवेश नहीं करते, आपके रेफरल जीत की ओर गिने नहीं जाएंगे। अभी प्रवेश करें और अपने रेफरल गिनना शुरू करें!'
                : 'Your referrals won\'t count toward winning until you enter. Tap below to enter and start counting your referrals!'}
            </p>
            <Button
              onClick={handleEnterContest}
              disabled={entering}
              className="w-full bg-gradient-to-r from-purple-500 to-pink-500 hover:opacity-90 text-white font-black text-sm h-12 rounded-xl shadow-lg"
            >
              {entering ? (
                <Loader2 className="w-5 h-5 animate-spin mr-2" />
              ) : (
                <Zap className="w-5 h-5 mr-2" />
              )}
              {entering
                ? (language === 'hi' ? 'प्रवेश हो रहा है...' : 'Entering...')
                : (language === 'hi' ? '🎯 कॉन्टेस्ट में प्रवेश करें' : '🎯 Enter Contest Now')}
            </Button>
            <p className="text-[10px] text-warm-500 dark:text-warm-400 mt-2">
              {language === 'hi'
                ? 'एक बार प्रवेश करने पर, आपके सभी रेफरल (इस राउंड की विंडो में) गिने जाएंगे।'
                : 'Once entered, all your referrals (within this round window) will be counted.'}
            </p>
          </Card>
        </motion.div>
      ) : (
        // User HAS entered — show their rank + referral count + share CTA
        <Card className="p-4 border-2 border-purple-200 dark:border-purple-900/50 bg-gradient-to-br from-purple-50 to-white dark:from-purple-900/20 dark:to-warm-800">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-green-500" />
              <h3 className="text-sm font-bold text-warm-800 dark:text-warm-100">
                {language === 'hi' ? 'आपकी रैंक' : 'Your Rank'}
              </h3>
            </div>
            <div className="flex items-center gap-2">
              {myRank !== null && myRank === 1 && (
                <Badge className="bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400 text-xs">
                  <Crown className="w-3 h-3 mr-1" />
                  {language === 'hi' ? 'लीड कर रहे हैं!' : 'Leading!'}
                </Badge>
              )}
              <Badge className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 text-[10px]">
                {language === 'hi' ? '✓ प्रवेशित' : '✓ Entered'}
              </Badge>
            </div>
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
                ? 'अभी 0 रेफरल — रेफरल कोड शेयर करके आगे बढ़ें!'
                : '0 referrals so far — share your code to climb the leaderboard!'}
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
      )}

      {/* ─── Tabbed Leaderboard / Winners section ────────────────────────
          Compact pill-style tabs to switch between:
            1. Leaderboard       — current contest, all participants, rank-wise
            2. Contest Winners   — past referral contest winners (Oats pack)
            3. Giveaway Winners  — old 15-day random-draw winners (Protein/Kit/Bottle)
          All three preserve full rank-wise ordering. No winners are ever removed. */}
      <div>
        {/* Small pill-style tab switcher */}
        <div className="flex gap-1 p-1 bg-warm-100 dark:bg-warm-800 rounded-lg mb-3">
          <button
            onClick={() => setLbTab('leaderboard')}
            className={`flex-1 py-1.5 px-2 rounded-md text-[11px] font-bold flex items-center justify-center gap-1 transition-all ${
              lbTab === 'leaderboard'
                ? 'bg-white dark:bg-warm-700 text-purple-600 dark:text-purple-300 shadow-sm'
                : 'text-warm-500 dark:text-warm-400'
            }`}
          >
            <Medal className="w-3 h-3" />
            {language === 'hi' ? 'लीडरबोर्ड' : 'Leaderboard'}
          </button>
          <button
            onClick={() => setLbTab('contest-winners')}
            className={`flex-1 py-1.5 px-2 rounded-md text-[11px] font-bold flex items-center justify-center gap-1 transition-all ${
              lbTab === 'contest-winners'
                ? 'bg-white dark:bg-warm-700 text-amber-600 dark:text-amber-300 shadow-sm'
                : 'text-warm-500 dark:text-warm-400'
            }`}
          >
            <Crown className="w-3 h-3" />
            {language === 'hi' ? 'विजेता' : 'Winners'}
          </button>
          <button
            onClick={() => setLbTab('giveaway-winners')}
            className={`flex-1 py-1.5 px-2 rounded-md text-[11px] font-bold flex items-center justify-center gap-1 transition-all ${
              lbTab === 'giveaway-winners'
                ? 'bg-white dark:bg-warm-700 text-orange-600 dark:text-orange-300 shadow-sm'
                : 'text-warm-500 dark:text-warm-400'
            }`}
          >
            <Trophy className="w-3 h-3" />
            {language === 'hi' ? 'पुराने गिवअवे' : 'Past Giveaway'}
          </button>
        </div>

        {/* ── Tab 1: Leaderboard — current contest, all participants, rank-wise ── */}
        {lbTab === 'leaderboard' && (
          <>
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] font-bold uppercase tracking-wide text-warm-500 flex items-center gap-1">
                <Medal className="w-3 h-3 text-amber-500" />
                {language === 'hi' ? 'वर्तमान राउंड' : 'Current Round'}
              </span>
              <span className="text-[10px] text-warm-500">
                {language === 'hi' ? `सभी भागीदार (${leaderboard.length})` : `All Participants (${leaderboard.length})`}
              </span>
            </div>

            {leaderboard.length === 0 ? (
              <Card className="p-6 text-center">
                <Users className="w-10 h-10 mx-auto text-warm-300 dark:text-warm-600 mb-2" />
                <p className="text-sm text-warm-500 dark:text-warm-400">
                  {language === 'hi'
                    ? 'अभी कोई भागीदार नहीं। पहले रेफरल शेयर करें और लीड करें!'
                    : 'No participants yet. Be the first to enter and lead!'}
                </p>
              </Card>
            ) : (
              <Card className="overflow-hidden p-0">
                {/* Column header */}
                <div className="flex items-center gap-2 px-3 py-1.5 bg-warm-100 dark:bg-warm-800/80 border-b border-warm-200 dark:border-warm-700 text-[9px] font-bold uppercase tracking-wide text-warm-500">
                  <span className="w-6 text-center">#</span>
                  <span className="flex-1">{language === 'hi' ? 'खिलाड़ी' : 'Player'}</span>
                  <span className="w-12 text-right">{language === 'hi' ? 'रेफरल' : 'Refs'}</span>
                </div>
                <div className="divide-y divide-warm-100 dark:divide-warm-800">
                  {leaderboard.map((entry, index) => {
                    const isMe = entry.userId === currentUser?.id;
                    const isTop3 = entry.rank <= 3;
                    return (
                      <div
                        key={entry.userId}
                        className={`flex items-center gap-2 px-3 py-1.5 transition-colors ${
                          isMe
                            ? 'bg-purple-50/70 dark:bg-purple-900/20'
                            : index % 2 === 1
                              ? 'bg-warm-50/50 dark:bg-warm-800/30'
                              : ''
                        }`}
                      >
                        {/* Rank */}
                        <span className={`w-6 text-center text-xs font-black ${
                          entry.rank === 1 ? 'text-yellow-500' :
                          entry.rank === 2 ? 'text-gray-400' :
                          entry.rank === 3 ? 'text-orange-500' :
                          'text-warm-500 dark:text-warm-400'
                        }`}>
                          {isTop3 ? (entry.rank === 1 ? '🥇' : entry.rank === 2 ? '🥈' : '🥉') : entry.rank}
                        </span>
                        {/* Avatar */}
                        <div className="shrink-0 w-6 h-6 rounded-full overflow-hidden bg-warm-200 dark:bg-warm-700 flex items-center justify-center text-[10px] font-bold text-warm-600 dark:text-warm-300">
                          {entry.avatar ? (
                            <img src={entry.avatar} alt={entry.name} className="w-full h-full object-cover" />
                          ) : (
                            entry.name?.charAt(0)?.toUpperCase() || '?'
                          )}
                        </div>
                        {/* Name + code */}
                        <div className="flex-1 min-w-0 flex items-center gap-1">
                          <span className="text-xs font-semibold text-warm-800 dark:text-warm-100 truncate">
                            {entry.name}
                          </span>
                          {isMe && (
                            <span className="text-[8px] font-bold px-1 rounded bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300 shrink-0">
                              YOU
                            </span>
                          )}
                          {entry.rank === 1 && <Crown className="w-3 h-3 text-yellow-500 shrink-0" />}
                          {entry.playerCode && (
                            <span className="text-[9px] text-warm-400 dark:text-warm-500 truncate">
                              {entry.playerCode}
                            </span>
                          )}
                        </div>
                        {/* Referral count */}
                        <span className="w-12 text-right text-sm font-black text-purple-600 dark:text-purple-400">
                          {entry.referralCount}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </Card>
            )}
          </>
        )}

        {/* ── Tab 2: Contest Winners — past referral contest winners (Oats), rank-wise ── */}
        {lbTab === 'contest-winners' && (
          <>
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] font-bold uppercase tracking-wide text-warm-500 flex items-center gap-1">
                <Crown className="w-3 h-3 text-amber-500" />
                {language === 'hi' ? 'रेफरल कॉन्टेस्ट विजेता' : 'Referral Contest Winners'}
              </span>
              <span className="text-[9px] text-warm-500">🥣 1kg Oats Pack</span>
            </div>
            {pastWinners.length === 0 ? (
              <Card className="p-6 text-center">
                <Crown className="w-10 h-10 mx-auto text-warm-300 dark:text-warm-600 mb-2" />
                <p className="text-sm text-warm-500 dark:text-warm-400">
                  {language === 'hi'
                    ? 'अभी कोई विजेता नहीं। पहला विजेता महीने के अंत में चुना जाएगा!'
                    : 'No winners yet. The first winner will be chosen at month end!'}
                </p>
              </Card>
            ) : (
              <Card className="overflow-hidden p-0">
                {/* Column header */}
                <div className="flex items-center gap-2 px-3 py-1.5 bg-warm-100 dark:bg-warm-800/80 border-b border-warm-200 dark:border-warm-700 text-[9px] font-bold uppercase tracking-wide text-warm-500">
                  <span className="w-6 text-center">#</span>
                  <span className="flex-1">{language === 'hi' ? 'खिलाड़ी' : 'Player'}</span>
                  <span className="w-16 text-right">{language === 'hi' ? 'रेफरल' : 'Refs'}</span>
                  <span className="w-12 text-right">{language === 'hi' ? 'राउंड' : 'Round'}</span>
                </div>
                <div className="divide-y divide-warm-100 dark:divide-warm-800">
                  {pastWinners.map((winner, idx) => (
                    <div
                      key={`${winner.roundNumber}-${winner.userId}`}
                      className="flex items-center gap-2 px-3 py-1.5 bg-gradient-to-r from-amber-50/60 to-transparent dark:from-amber-900/15"
                    >
                      <span className="w-6 text-center text-xs font-black text-yellow-500">
                        🥇
                      </span>
                      <div className="shrink-0 w-6 h-6 rounded-full overflow-hidden bg-amber-100 dark:bg-amber-900/40 flex items-center justify-center text-[10px] font-bold text-amber-700 dark:text-amber-300">
                        {winner.avatar ? (
                          <img src={winner.avatar} alt={winner.name} className="w-full h-full object-cover" />
                        ) : (
                          winner.name?.charAt(0)?.toUpperCase() || '?'
                        )}
                      </div>
                      <div className="flex-1 min-w-0 flex items-center gap-1">
                        <span className="text-xs font-bold text-warm-800 dark:text-warm-100 truncate">
                          {winner.name}
                        </span>
                        <Crown className="w-3 h-3 text-yellow-500 shrink-0" />
                        {winner.playerCode && (
                          <span className="text-[9px] text-warm-400 dark:text-warm-500">
                            {winner.playerCode}
                          </span>
                        )}
                      </div>
                      <span className="w-16 text-right text-xs font-black text-amber-600 dark:text-amber-400">
                        {winner.referralCount}
                      </span>
                      <span className="w-12 text-right text-[9px] text-warm-400 uppercase">
                        #{winner.roundNumber}
                      </span>
                    </div>
                  ))}
                </div>
              </Card>
            )}
          </>
        )}

        {/* ── Tab 3: Giveaway Winners — old 15-day random-draw (Protein/Kit/Bottle), rank-wise ── */}
        {lbTab === 'giveaway-winners' && (
          <>
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] font-bold uppercase tracking-wide text-warm-500 flex items-center gap-1">
                <Trophy className="w-3 h-3 text-amber-500" />
                {language === 'hi' ? 'पिछले गिवअवे विजेता' : 'Past Giveaway Winners'}
              </span>
              <span className="text-[9px] text-warm-500">
                {oldGiveawayWinners.length > 0
                  ? `${oldGiveawayWinners.length} ${language === 'hi' ? 'विजेता' : 'winners'}`
                  : '🎁 15-day draw'}
              </span>
            </div>
            {oldGiveawayWinners.length === 0 ? (
              <Card className="p-6 text-center">
                <Trophy className="w-10 h-10 mx-auto text-warm-300 dark:text-warm-600 mb-2" />
                <p className="text-sm text-warm-500 dark:text-warm-400">
                  {language === 'hi'
                    ? 'अभी कोई पुराने गिवअवे विजेता नहीं मिले।'
                    : 'No previous giveaway winners found.'}
                </p>
              </Card>
            ) : (
              <Card className="overflow-hidden p-0">
                {/* Column header */}
                <div className="flex items-center gap-2 px-3 py-1.5 bg-warm-100 dark:bg-warm-800/80 border-b border-warm-200 dark:border-warm-700 text-[9px] font-bold uppercase tracking-wide text-warm-500">
                  <span className="w-6 text-center">#</span>
                  <span className="w-20">{language === 'hi' ? 'खिलाड़ी' : 'Player'}</span>
                  <span className="flex-1">{language === 'hi' ? 'इनाम' : 'Prize'}</span>
                  <span className="w-12 text-right">{language === 'hi' ? 'राउंड' : 'Round'}</span>
                </div>
                <div className="divide-y divide-warm-100 dark:divide-warm-800">
                  {oldGiveawayWinners.map((w, idx) => (
                    <div
                      key={`old-${w.roundNumber}-${w.rank}-${idx}`}
                      className="flex items-center gap-2 px-3 py-1.5"
                    >
                      <span className="w-6 text-center text-xs font-black">
                        {w.rank === 1 ? '🥇' : w.rank === 2 ? '🥈' : w.rank === 3 ? '🥉' : `#${w.rank}`}
                      </span>
                      <span className="text-xs font-bold text-warm-800 dark:text-warm-100 font-mono w-20 truncate">
                        {w.playerId}
                      </span>
                      <span className="flex-1 text-[10px] text-warm-600 dark:text-warm-300 truncate">
                        {w.prize}
                      </span>
                      <span className="w-12 text-right text-[9px] text-warm-400 uppercase shrink-0">
                        #{w.roundNumber}
                      </span>
                    </div>
                  ))}
                </div>
              </Card>
            )}
          </>
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
