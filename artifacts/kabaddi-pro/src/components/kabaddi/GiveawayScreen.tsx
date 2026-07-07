'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Gift, Trophy, Users, Clock, Check, Loader2, X, Sparkles, Crown, UserPlus, Lock, Zap } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useKabaddiStore } from '@/lib/store';
import { useToast } from '@/hooks/use-toast';
import { useBackButton } from '@/hooks/use-back-button';

interface GiveawayScreenProps {
  onClose: () => void;
  onUpgradeToPremium?: () => void;
  onOpenReferral?: () => void;
}

interface Prize {
  rank: number;
  name: string;
  icon: string;
}

interface GiveawayStatus {
  round: {
    id: string;
    roundNumber: number;
    startDate: string;
    endDate: string;
    status: string;
    hasEnded?: boolean;
  };
  prizes: Prize[];
  participantCount: number;
  hasParticipated: boolean;
  // Eligibility info
  isPremiumActive?: boolean;
  successfulReferrals?: number;
  participationsUsed?: number;
  entriesRemaining?: number;
  freeEntryAvailable?: boolean;
  hasUsedFreeEntry?: boolean;
  canParticipate?: boolean;
  blockReason?: '' | 'already_participated' | 'no_referrals' | 'no_entries_remaining';
  pastWinners: Array<{
    roundId?: string;
    roundNumber: number;
    rank: number;
    playerId: string;
    prize: string;
  }>;
}

export default function GiveawayScreen({ onClose, onUpgradeToPremium, onOpenReferral }: GiveawayScreenProps) {
  const currentUser = useKabaddiStore((s) => s.currentUser);
  const { toast } = useToast();
  const [status, setStatus] = useState<GiveawayStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [participating, setParticipating] = useState(false);
  const [timeLeft, setTimeLeft] = useState({ days: 0, hours: 0, minutes: 0, seconds: 0 });
  const [showAdminPanel, setShowAdminPanel] = useState(false);
  const [adminParticipants, setAdminParticipants] = useState<any[]>([]);
  const [adminLoading, setAdminLoading] = useState(false);
  const [pendingRounds, setPendingRounds] = useState<Array<{
    id: string; roundNumber: number; endDate: string; participantCount: number;
  }>>([]);
  const [selectingRoundId, setSelectedRoundId] = useState<string | null>(null);
  const [selectingWinners, setSelectingWinners] = useState(false);
  // Manual winner selection
  const [manualMode, setManualMode] = useState(false);
  const [manualSelected, setManualSelected] = useState<string[]>([]); // user IDs
  const [manualRoundId, setManualRoundId] = useState<string | null>(null);

  useBackButton(true, onClose);

  const fetchStatus = useCallback(async () => {
    try {
      const res = await fetch(`/api/giveaway/status?userId=${currentUser?.id || ''}`);
      if (res.ok) {
        const data = await res.json();
        setStatus(data);
      }
    } catch (err) {
      console.error('Giveaway status error:', err);
    } finally {
      setLoading(false);
    }
  }, [currentUser?.id]);

  useEffect(() => {
    fetchStatus();
  }, [fetchStatus]);

  // Countdown timer
  useEffect(() => {
    if (!status?.round?.endDate) return;
    const updateTimer = () => {
      const now = Date.now();
      const end = new Date(status.round.endDate).getTime();
      const diff = end - now;
      if (diff <= 0) {
        setTimeLeft({ days: 0, hours: 0, minutes: 0, seconds: 0 });
        return;
      }
      const days = Math.floor(diff / (1000 * 60 * 60 * 24));
      const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((diff % (1000 * 60)) / 1000);
      setTimeLeft({ days, hours, minutes, seconds });
    };
    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, [status?.round?.endDate]);

  const handleParticipate = async () => {
    if (!currentUser?.id) return;
    setParticipating(true);
    try {
      const res = await fetch('/api/giveaway/participate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: currentUser.id }),
      });
      const data = await res.json();
      if (!res.ok) {
        // Show a more helpful toast with action button when user is blocked
        if (data.blockReason === 'no_referrals' || data.blockReason === 'no_entries_remaining') {
          toast({
            title: '⚠️ Referral or Premium Required',
            description: data.error,
            variant: 'destructive',
          });
        } else {
          toast({ title: 'Cannot participate', description: data.error, variant: 'destructive' });
        }
        return;
      }
      // Custom celebration message for free-entry users
      const wasFreeEntry = status?.freeEntryAvailable;
      toast({
        title: wasFreeEntry ? '🎉 FREE Entry Claimed!' : '🎉 You\'re in!',
        description: wasFreeEntry
          ? 'Your first entry is on us! Good luck — winners announced when the timer ends.'
          : 'Good luck! Winners announced when the timer ends.',
      });
      fetchStatus();
    } catch {
      toast({ title: 'Error', description: 'Failed to participate', variant: 'destructive' });
    } finally {
      setParticipating(false);
    }
  };

  const handleAdminView = async () => {
    if (!currentUser?.id) return;
    setShowAdminPanel(true);
    setAdminLoading(true);
    try {
      // Fetch current round participants
      const res = await fetch(`/api/giveaway/admin/participants?adminId=${currentUser.id}`);
      const data = await res.json();
      if (res.ok) {
        setAdminParticipants(data.participants || []);
      } else {
        toast({ title: 'Access Denied', description: data.error, variant: 'destructive' });
        setShowAdminPanel(false);
      }

      // Also fetch pending rounds (completed rounds without winners)
      const pendingRes = await fetch(`/api/giveaway/admin/pending-rounds?adminId=${currentUser.id}`);
      if (pendingRes.ok) {
        const pendingData = await pendingRes.json();
        setPendingRounds(pendingData.rounds || []);
      }
    } catch {
      toast({ title: 'Error', description: 'Failed to load admin data', variant: 'destructive' });
    } finally {
      setAdminLoading(false);
    }
  };

  const handleSelectWinners = async (roundId?: string) => {
    if (!currentUser?.id) return;
    if (!confirm(roundId
      ? 'Select 3 random winners for this past round? Winners will be shown in the Past Winners section.'
      : 'Select 3 random winners now? This will end the current round and start a new one.'
    )) return;

    const loadingId = roundId || 'current';
    setSelectedRoundId(loadingId);
    setSelectingWinners(true);
    try {
      const res = await fetch('/api/giveaway/admin/select-winners', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ adminId: currentUser.id, roundId: roundId || undefined }),
      });
      const data = await res.json();
      if (res.ok) {
        toast({ title: '🎉 Winners Selected!', description: 'Winners are now shown in the Past Winners section.' });
        fetchStatus();
        // Refresh pending rounds
        if (roundId) {
          setPendingRounds(prev => prev.filter(r => r.id !== roundId));
        }
        setShowAdminPanel(false);
      } else {
        toast({ title: 'Error', description: data.error, variant: 'destructive' });
      }
    } catch {
      toast({ title: 'Error', description: 'Failed to select winners', variant: 'destructive' });
    } finally {
      setSelectingWinners(false);
      setSelectedRoundId(null);
    }
  };

  // ─── Manual winner selection ─────────────────────────────────
  const toggleManualSelect = (userId: string) => {
    setManualSelected(prev => {
      if (prev.includes(userId)) return prev.filter(id => id !== userId);
      if (prev.length >= 3) {
        toast({ title: 'Max 3 winners', description: 'You can select up to 3 winners only.' });
        return prev;
      }
      return [...prev, userId];
    });
  };

  const handleManualSelectWinners = async () => {
    if (!currentUser?.id || manualSelected.length === 0) return;
    if (!confirm(`Set these ${manualSelected.length} player(s) as winners? This cannot be undone.`)) return;
    setSelectingWinners(true);
    try {
      const res = await fetch('/api/giveaway/admin/select-winners-manual', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          adminId: currentUser.id,
          winnerIds: manualSelected,
          roundId: manualRoundId || undefined,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        toast({ title: '🎉 Winners Set!', description: 'Your selected winners are now shown in Past Winners.' });
        fetchStatus();
        setManualMode(false);
        setManualSelected([]);
        setManualRoundId(null);
        setShowAdminPanel(false);
        // Refresh pending rounds
        if (manualRoundId) {
          setPendingRounds(prev => prev.filter(r => r.id !== manualRoundId));
        }
      } else {
        toast({ title: 'Error', description: data.error, variant: 'destructive' });
      }
    } catch {
      toast({ title: 'Error', description: 'Failed to set winners', variant: 'destructive' });
    } finally {
      setSelectingWinners(false);
    }
  };

  // Start manual selection for current round
  const startManualMode = () => {
    setManualMode(true);
    setManualSelected([]);
    setManualRoundId(null); // current active round
  };

  // Start manual selection for a past round
  const startManualModeForRound = (roundId: string) => {
    setManualMode(true);
    setManualSelected([]);
    setManualRoundId(roundId);
  };

  // ─── Change winners for a completed round ────────────────────
  const [showChangeWinners, setShowChangeWinners] = useState(false);
  const [changeRoundParticipants, setChangeRoundParticipants] = useState<any[]>([]);
  const [changeRoundId, setChangeRoundId] = useState<string | null>(null);
  const [changeSelected, setChangeSelected] = useState<string[]>([]);
  const [changeLoading, setChangeLoading] = useState(false);

  const handleChangeWinnersStart = async () => {
    if (!currentUser?.id || !status?.pastWinners?.length) return;
    // Get the roundId from the first past winner entry
    const roundId = status.pastWinners[0].roundId;
    if (!roundId) {
      toast({ title: 'Cannot find round ID', description: 'Please refresh and try again.', variant: 'destructive' });
      return;
    }

    setChangeRoundId(roundId);
    setChangeSelected([]);
    setChangeLoading(true);
    setShowChangeWinners(true);

    try {
      // Fetch participants for this round using the admin participants endpoint
      // We need a way to get participants for a specific past round.
      // The admin participants endpoint only returns the CURRENT round's participants.
      // Let's fetch all participants for this round directly.
      const res = await fetch(`/api/giveaway/admin/round-participants?adminId=${currentUser.id}&roundId=${roundId}`);
      if (res.ok) {
        const data = await res.json();
        setChangeRoundParticipants(data.participants || []);
      } else {
        toast({ title: 'Failed to load participants', variant: 'destructive' });
        setShowChangeWinners(false);
      }
    } catch {
      toast({ title: 'Failed to load participants', variant: 'destructive' });
      setShowChangeWinners(false);
    } finally {
      setChangeLoading(false);
    }
  };

  // Handle the actual change of winners
  const handleChangeWinnersConfirm = async () => {
    if (!currentUser?.id || !changeRoundId || changeSelected.length === 0) return;
    if (!confirm(`Change winners to ${changeSelected.length} player(s)? This will overwrite the current winners.`)) return;
    setChangeLoading(true);
    try {
      const res = await fetch('/api/giveaway/admin/change-winners', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          adminId: currentUser.id,
          roundId: changeRoundId,
          winnerIds: changeSelected,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        toast({ title: '✅ Winners Changed!', description: 'Past winners have been updated.' });
        fetchStatus();
        setShowChangeWinners(false);
        setChangeSelected([]);
        setChangeRoundId(null);
      } else {
        toast({ title: 'Error', description: data.error, variant: 'destructive' });
      }
    } catch {
      toast({ title: 'Error', description: 'Failed to change winners', variant: 'destructive' });
    } finally {
      setChangeLoading(false);
    }
  };

  if (loading) {
    return (
      <motion.div className="fixed inset-0 z-50 bg-warm-50 dark:bg-warm-900 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-brand-red" />
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ x: '100%' }}
      animate={{ x: 0 }}
      exit={{ x: '100%' }}
      transition={{ type: 'spring', damping: 25, stiffness: 300 }}
      className="fixed inset-0 z-50 bg-warm-50 dark:bg-warm-900 overflow-y-auto"
    >
      {/* Header */}
      <div className="sticky top-0 z-10 bg-gradient-to-r from-brand-red to-brand-red-dark px-4 py-3 flex items-center gap-3 shadow-lg">
        <button onClick={onClose} className="w-9 h-9 rounded-full bg-white/20 flex items-center justify-center">
          <X className="w-5 h-5 text-white" />
        </button>
        <div className="flex-1">
          <h1 className="text-white font-black text-lg flex items-center gap-2">
            <Gift className="w-5 h-5" />
            Kabaddi Pro Giveaway
          </h1>
          <p className="text-white/70 text-[10px]">Win amazing prizes every 15 days!</p>
        </div>
        {currentUser?.isAdmin && (
          <button
            onClick={handleAdminView}
            className="px-3 py-1.5 rounded-lg bg-white/20 text-white text-xs font-bold"
          >
            Admin
          </button>
        )}
      </div>

      <div className="p-4 space-y-4 max-w-md mx-auto pb-8">
        {/* Timer */}
        <Card className="p-5 bg-gradient-to-br from-amber-500/10 to-orange-500/10 border-amber-500/30 text-center">
          <div className="flex items-center justify-center gap-1.5 mb-3">
            <Clock className="w-4 h-4 text-amber-500" />
            <p className="text-xs font-bold text-amber-600 dark:text-amber-400 uppercase tracking-wider">
              {status?.round?.status === 'active' ? 'Ends In' : 'Round Ended'}
            </p>
          </div>
          <div className="flex items-center justify-center gap-3">
            {[
              { label: 'Days', value: timeLeft.days },
              { label: 'Hours', value: timeLeft.hours },
              { label: 'Mins', value: timeLeft.minutes },
              { label: 'Secs', value: timeLeft.seconds },
            ].map((t, i) => (
              <div key={i} className="text-center">
                <div className="w-14 h-14 rounded-xl bg-white dark:bg-warm-800 shadow-sm flex items-center justify-center">
                  <span className="text-xl font-black text-warm-800 dark:text-warm-100 font-mono">
                    {String(t.value).padStart(2, '0')}
                  </span>
                </div>
                <p className="text-[9px] font-bold text-warm-400 mt-1 uppercase">{t.label}</p>
              </div>
            ))}
          </div>
          <div className="mt-3 flex items-center justify-center gap-2 text-xs text-warm-500">
            <Users className="w-3.5 h-3.5" />
            <span className="font-bold">{status?.participantCount || 0}</span>
            <span>participating</span>
          </div>
        </Card>

        {/* Round Ended banner — shown when timer expired but winners not yet selected */}
        {status?.round?.hasEnded && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-2xl bg-gradient-to-r from-red-500 to-orange-500 p-4 shadow-lg shadow-red-500/20"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center shrink-0">
                <Trophy className="w-5 h-5 text-white" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-black text-white">Round {status.round.roundNumber} Ended!</p>
                <p className="text-xs text-white/80">
                  {currentUser?.isAdmin
                    ? 'Tap "Select Winners" in the admin panel to draw 3 winners and start the next round.'
                    : 'Winners will be announced soon. Stay tuned!'}
                </p>
              </div>
            </div>
            {currentUser?.isAdmin && (
              <button
                onClick={handleSelectWinners}
                disabled={selectingWinners}
                className="w-full mt-3 py-2.5 rounded-xl bg-white text-red-600 font-black text-sm hover:bg-white/90 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {selectingWinners ? (
                  <><Loader2 className="w-4 h-4 animate-spin" /> Selecting...</>
                ) : (
                  <><Trophy className="w-4 h-4" /> Select 3 Winners Now</>
                )}
              </button>
            )}
          </motion.div>
        )}

        {/* Free Entry Promo Banner — shown only for first-time users */}
        {status?.freeEntryAvailable && !status?.hasParticipated && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ type: 'spring', damping: 20, stiffness: 200 }}
            className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-violet-500 via-fuchsia-500 to-pink-500 p-4 shadow-lg shadow-violet-500/30"
          >
            <div className="absolute -right-4 -top-4 w-20 h-20 rounded-full bg-white/10 blur-xl" />
            <div className="absolute -left-2 -bottom-2 w-16 h-16 rounded-full bg-white/10 blur-xl" />
            <div className="relative flex items-center gap-3">
              <motion.div
                animate={{ rotate: [0, -10, 10, -5, 0] }}
                transition={{ duration: 2.5, repeat: Infinity, repeatDelay: 1 }}
                className="w-11 h-11 rounded-full bg-white/20 flex items-center justify-center shrink-0 backdrop-blur-sm"
              >
                <Gift className="w-6 h-6 text-white" />
              </motion.div>
              <div className="flex-1 text-white">
                <p className="text-sm font-black flex items-center gap-1.5">
                  1ST ENTRY FREE
                  <span className="text-[8px] bg-white/25 px-1.5 py-0.5 rounded-full font-bold">NO REFERRAL NEEDED</span>
                </p>
                <p className="text-[11px] text-white/85 mt-0.5 leading-snug">
                  New here? Your first giveaway entry is 100% free — no premium, no referral code, nothing. Just tap participate!
                </p>
              </div>
            </div>
          </motion.div>
        )}

        {/* Prizes */}
        <div className="space-y-2">
          <h3 className="text-sm font-black text-warm-800 dark:text-warm-100 flex items-center gap-2 px-1">
            <Trophy className="w-4 h-4 text-brand-gold" />
            Prizes
          </h3>
          {status?.prizes?.map((prize, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.1 }}
            >
              <Card className={`p-3 flex items-center gap-3 ${
                i === 0 ? 'bg-gradient-to-r from-yellow-50 to-amber-50 dark:from-yellow-900/20 dark:to-amber-900/10 border-yellow-300/50' :
                i === 1 ? 'bg-gradient-to-r from-gray-50 to-slate-50 dark:from-gray-800/30 dark:to-slate-800/20 border-gray-300/50' :
                'bg-gradient-to-r from-orange-50 to-amber-50 dark:from-orange-900/10 dark:to-amber-900/10 border-orange-300/50'
              }`}>
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-2xl shadow-sm ${
                  i === 0 ? 'bg-gradient-to-br from-yellow-400 to-amber-500' :
                  i === 1 ? 'bg-gradient-to-br from-gray-300 to-gray-400' :
                  'bg-gradient-to-br from-orange-400 to-amber-500'
                }`}>
                  {prize.icon}
                </div>
                <div className="flex-1">
                  <p className="text-[10px] font-bold text-warm-400 uppercase">
                    {i === 0 ? '1st Prize' : i === 1 ? '2nd Prize' : '3rd Prize'}
                  </p>
                  <p className="text-sm font-bold text-warm-800 dark:text-warm-100">{prize.name}</p>
                </div>
              </Card>
            </motion.div>
          ))}
        </div>

        {/* Eligibility Card — Free Entry / Premium / Referral Required */}
        {currentUser && (
          <Card className={`p-4 ${
            status?.freeEntryAvailable
              ? 'bg-gradient-to-br from-violet-50 to-fuchsia-50 dark:from-violet-900/20 dark:to-fuchsia-900/10 border-violet-300/50'
              : status?.isPremiumActive
              ? 'bg-gradient-to-br from-amber-50 to-yellow-50 dark:from-amber-900/20 dark:to-yellow-900/10 border-amber-300/50'
              : status?.entriesRemaining && status.entriesRemaining > 0
              ? 'bg-gradient-to-br from-emerald-50 to-teal-50 dark:from-emerald-900/20 dark:to-teal-900/10 border-emerald-300/50'
              : 'bg-gradient-to-br from-red-50 to-orange-50 dark:from-red-900/20 dark:to-orange-900/10 border-red-300/50'
          }`}>
            {/* FREE ENTRY available — first-time user, no requirements */}
            {status?.freeEntryAvailable ? (
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-violet-500 to-fuchsia-500 flex items-center justify-center shrink-0 animate-pulse">
                  <Gift className="w-5 h-5 text-white" />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-bold text-violet-700 dark:text-violet-300 flex items-center gap-1.5">
                    1 FREE Entry Available!
                    <Badge className="bg-violet-500/20 text-violet-700 dark:text-violet-300 text-[8px] font-bold px-1.5">FREE</Badge>
                  </p>
                  <p className="text-[11px] text-violet-600/80 dark:text-violet-400/80 mt-0.5">
                    Your first giveaway entry is on us — no premium, no referral needed. Just tap below!
                  </p>
                </div>
              </div>
            ) : status?.isPremiumActive ? (
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-amber-400 to-yellow-500 flex items-center justify-center shrink-0">
                  <Crown className="w-5 h-5 text-white" />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-bold text-amber-700 dark:text-amber-300 flex items-center gap-1.5">
                    Premium Member
                    <Badge className="bg-amber-500/20 text-amber-700 dark:text-amber-300 text-[8px] font-bold px-1.5">PRO</Badge>
                  </p>
                  <p className="text-[11px] text-amber-600/80 dark:text-amber-400/80 mt-0.5">
                    Free entry every round — no referral needed.
                  </p>
                </div>
              </div>
            ) : status?.entriesRemaining && status.entriesRemaining > 0 ? (
              /* Non-premium WITH remaining referral entries */
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-emerald-400 to-teal-500 flex items-center justify-center shrink-0">
                  <UserPlus className="w-5 h-5 text-white" />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-bold text-emerald-700 dark:text-emerald-300">
                    {status.entriesRemaining} giveaway {status.entriesRemaining === 1 ? 'entry' : 'entries'} remaining
                  </p>
                  <p className="text-[11px] text-emerald-600/80 dark:text-emerald-400/80 mt-0.5">
                    Earned from {status.successfulReferrals} successful {status.successfulReferrals === 1 ? 'referral' : 'referrals'} · {status.participationsUsed} used
                  </p>
                </div>
              </div>
            ) : (
              /* Non-premium WITH NO entries remaining — show upgrade/refer CTA */
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-red-400 to-orange-500 flex items-center justify-center shrink-0">
                    <Lock className="w-5 h-5 text-white" />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-bold text-red-700 dark:text-red-300">
                      {status?.blockReason === 'no_referrals'
                        ? 'Free entry used — refer a friend'
                        : 'All referral entries used'}
                    </p>
                    <p className="text-[11px] text-red-600/80 dark:text-red-400/80 mt-0.5">
                      {status?.blockReason === 'no_referrals'
                        ? 'Your free entry has been used. Refer a friend or upgrade to Premium to participate again.'
                        : `You've used all ${status?.successfulReferrals || 0} of your referral entries. Refer more friends or upgrade to Premium.`}
                    </p>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <Button
                    size="sm"
                    onClick={() => onOpenReferral?.()}
                    className="bg-gradient-to-r from-brand-teal to-brand-teal-dark hover:opacity-90 text-white h-9 text-xs"
                  >
                    <UserPlus className="w-3.5 h-3.5 mr-1" />
                    Refer a Friend
                  </Button>
                  <Button
                    size="sm"
                    onClick={() => onUpgradeToPremium?.()}
                    className="bg-gradient-to-r from-amber-500 to-yellow-500 hover:opacity-90 text-white h-9 text-xs"
                  >
                    <Crown className="w-3.5 h-3.5 mr-1" />
                    Go Premium
                  </Button>
                </div>
              </div>
            )}
          </Card>
        )}

        {/* Participate Button */}
        {!status?.hasParticipated ? (
          <Button
            onClick={handleParticipate}
            disabled={participating || status?.canParticipate === false}
            className="w-full h-14 bg-gradient-to-r from-brand-red to-brand-red-dark hover:opacity-90 text-white font-black text-base rounded-2xl shadow-lg shadow-brand-red/25 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {participating ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : status?.canParticipate === false ? (
              <>
                <Lock className="w-5 h-5 mr-2" />
                {status?.isPremiumActive ? 'Already Participated' : 'Refer a Friend or Go Premium'}
              </>
            ) : status?.freeEntryAvailable ? (
              <>
                <Gift className="w-5 h-5 mr-2" />
                Claim Your FREE Entry Now!
              </>
            ) : (
              <>
                <Gift className="w-5 h-5 mr-2" />
                {status?.isPremiumActive ? 'Participate Now — Free for Premium!' : 'Use 1 Referral Entry & Participate'}
              </>
            )}
          </Button>
        ) : (
          <Card className="p-4 bg-green-50 dark:bg-green-900/20 border-green-300 dark:border-green-800 text-center">
            <Check className="w-6 h-6 text-green-500 mx-auto mb-1" />
            <p className="text-sm font-bold text-green-700 dark:text-green-400">You're participating!</p>
            <p className="text-[10px] text-green-600/80 dark:text-green-500/80 mt-0.5">
              Winners are selected randomly when the timer ends. Good luck!
            </p>
          </Card>
        )}

        {/* Rules */}
        <Card className="p-4 bg-white dark:bg-warm-800/50">
          <h4 className="text-xs font-bold text-warm-700 dark:text-warm-300 mb-2 flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-brand-gold" />
            How It Works
          </h4>
          <div className="space-y-2 text-[11px] text-warm-500 dark:text-warm-400">
            <div className="p-2 rounded-lg bg-brand-teal/10 border border-brand-teal/20">
              <p className="font-bold text-brand-teal-dark dark:text-brand-teal text-xs mb-1">🤝 STEP 1 — Refer a Friend (REQUIRED for free users)</p>
              <p>Share your referral code with friends. When they sign up, you earn 1 giveaway entry + 7 days Premium FREE for both of you!</p>
            </div>
            <div className="p-2 rounded-lg bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-700/30">
              <p className="font-bold text-amber-700 dark:text-amber-400 text-xs mb-1">👑 OR — Buy Premium (₹2/day)</p>
              <p>Premium members get free entry every round — no referral needed!</p>
            </div>
            <p>✅ 3 winners selected randomly every 15 days</p>
            <p>🔄 1 referral = 1 entry (used across all rounds — refer more to enter more!)</p>
            <p>🔒 Entry is locked in even if premium expires</p>
            <p>🔒 Only player IDs shown for winners — privacy protected</p>
          </div>
        </Card>

        {/* Past Winners */}
        {status?.pastWinners && status.pastWinners.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center justify-between px-1">
              <h3 className="text-sm font-black text-warm-800 dark:text-warm-100 flex items-center gap-2">
                <Crown className="w-4 h-4 text-brand-gold" />
                Past Winners
              </h3>
              {currentUser?.isAdmin && (
                <button
                  onClick={() => {
                    // Enter change-winners mode: fetch participants for the round + show selection
                    handleChangeWinnersStart();
                  }}
                  className="text-[10px] font-bold text-brand-teal hover:underline"
                >
                  Change Winners
                </button>
              )}
            </div>
            {status.pastWinners.map((w, i) => (
              <div key={i} className="flex items-center gap-3 bg-white dark:bg-warm-800/50 rounded-xl p-2.5 border border-warm-100 dark:border-warm-700/50">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm ${
                  w.rank === 1 ? 'bg-yellow-100 text-yellow-600' :
                  w.rank === 2 ? 'bg-gray-100 text-gray-600' :
                  'bg-orange-100 text-orange-600'
                }`}>
                  {w.rank === 1 ? '🥇' : w.rank === 2 ? '🥈' : '🥉'}
                </div>
                <div className="flex-1">
                  <p className="text-xs font-bold text-warm-700 dark:text-warm-300">
                    Player ID: {w.playerId}
                  </p>
                  <p className="text-[10px] text-warm-400">Round {w.roundNumber} • {w.prize}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ═══ Change Winners Overlay ═══ */}
      {showChangeWinners && (
        <div className="fixed inset-0 z-[60] bg-black/70 backdrop-blur-sm flex items-end justify-center" onClick={() => { setShowChangeWinners(false); setChangeSelected([]); }}>
          <div className="w-full max-w-md bg-white dark:bg-warm-800 rounded-t-3xl p-5 pb-8 max-h-[80vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="w-10 h-1 bg-gray-400 rounded-full mx-auto mb-4" />
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-warm-800 dark:text-white flex items-center gap-2">
                <Trophy className="w-5 h-5 text-amber-500" />
                Change Winners
              </h3>
              <button onClick={() => { setShowChangeWinners(false); setChangeSelected([]); }} className="w-8 h-8 rounded-full bg-warm-100 dark:bg-warm-700 flex items-center justify-center">
                <X className="w-4 h-4 text-warm-500" />
              </button>
            </div>
            <p className="text-xs text-warm-400 mb-4">Tap to select new winners ({changeSelected.length}/3). Current winners will be replaced.</p>

            {changeLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-6 h-6 animate-spin text-amber-500" />
              </div>
            ) : changeRoundParticipants.length === 0 ? (
              <div className="text-center py-8">
                <Users className="w-10 h-10 text-warm-300 mx-auto mb-2" />
                <p className="text-sm text-warm-500">No participants found for this round</p>
              </div>
            ) : (
              <>
                <div className="max-h-60 overflow-y-auto space-y-1 mb-4">
                  {changeRoundParticipants.map((p) => {
                    const isSelected = changeSelected.includes(p.userId);
                    return (
                      <button
                        key={p.userId}
                        onClick={() => {
                          if (isSelected) {
                            setChangeSelected(prev => prev.filter(id => id !== p.userId));
                          } else if (changeSelected.length < 3) {
                            setChangeSelected(prev => [...prev, p.userId]);
                          } else {
                            toast({ title: 'Max 3 winners', description: 'You can select up to 3 winners only.' });
                          }
                        }}
                        className={`w-full flex items-center gap-2 p-2.5 rounded-lg text-left transition-all ${
                          isSelected ? 'bg-amber-500 text-white' : 'bg-warm-50 dark:bg-warm-700/50 hover:bg-amber-50 dark:hover:bg-amber-900/30'
                        }`}
                      >
                        <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 ${
                          isSelected ? 'border-white bg-white' : 'border-amber-400'
                        }`}>
                          {isSelected && <Check className="w-3 h-3 text-amber-500" strokeWidth={3} />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className={`text-xs font-bold truncate ${isSelected ? 'text-white' : 'text-warm-800 dark:text-warm-100'}`}>
                            {p.name || 'Unknown'}
                          </p>
                          <p className={`text-[9px] font-mono ${isSelected ? 'text-white/70' : 'text-warm-400'}`}>
                            {p.playerCode || '—'} · {p.phone ? `****${p.phone.slice(-4)}` : 'No phone'}
                          </p>
                        </div>
                        {isSelected && (
                          <span className="text-[9px] font-black text-white bg-white/20 px-1.5 py-0.5 rounded-full">
                            #{changeSelected.indexOf(p.userId) + 1}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>

                <Button
                  onClick={handleChangeWinnersConfirm}
                  disabled={changeSelected.length === 0 || changeLoading}
                  className="w-full bg-amber-500 hover:bg-amber-600 text-white rounded-xl font-bold"
                >
                  {changeLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : `✅ Change to ${changeSelected.length} Winner${changeSelected.length !== 1 ? 's' : ''}`}
                </Button>
              </>
            )}
          </div>
        </div>
      )}

      {/* Admin Panel Modal */}
      <AnimatePresence>
        {showAdminPanel && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[60] bg-black/60 flex items-end sm:items-center justify-center p-4"
            onClick={(e) => { if (e.target === e.currentTarget) setShowAdminPanel(false); }}
          >
            <motion.div
              initial={{ y: 60, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 60, opacity: 0 }}
              className="bg-white dark:bg-warm-800 rounded-2xl shadow-2xl max-w-md w-full max-h-[80vh] overflow-hidden flex flex-col"
            >
              <div className="p-4 border-b border-warm-200 dark:border-warm-700 flex items-center justify-between">
                <h3 className="font-bold text-warm-800 dark:text-warm-100">Admin: Participants</h3>
                <button onClick={() => setShowAdminPanel(false)} className="w-8 h-8 rounded-full bg-warm-100 dark:bg-warm-700 flex items-center justify-center">
                  <X className="w-4 h-4 text-warm-500" />
                </button>
              </div>
              <div className="p-3 border-b border-warm-200 dark:border-warm-700 space-y-2">
                {/* Pending rounds (past completed rounds without winners) */}
                {pendingRounds.length > 0 && (
                  <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl p-3 space-y-2">
                    <p className="text-xs font-bold text-amber-700 dark:text-amber-400 flex items-center gap-1">
                      <Trophy className="w-3.5 h-3.5" />
                      Past Rounds Without Winners
                    </p>
                    {pendingRounds.map(r => (
                      <div key={r.id} className="flex items-center justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-bold text-warm-700 dark:text-warm-200">Round {r.roundNumber}</p>
                          <p className="text-[10px] text-warm-400">
                            {r.participantCount} participants · Ended {new Date(r.endDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                          </p>
                        </div>
                        <button
                          onClick={() => handleSelectWinners(r.id)}
                          disabled={selectingWinners && selectingRoundId === r.id}
                          className="px-3 py-1.5 rounded-lg bg-amber-500 text-white text-xs font-bold hover:bg-amber-600 disabled:opacity-50 shrink-0 flex items-center gap-1"
                        >
                          {selectingWinners && selectingRoundId === r.id ? (
                            <Loader2 className="w-3 h-3 animate-spin" />
                          ) : (
                            <Trophy className="w-3 h-3" />
                          )}
                          Select
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                <Button
                  onClick={() => handleSelectWinners()}
                  disabled={selectingWinners || adminParticipants.length < 3 || manualMode}
                  className="w-full bg-gradient-to-r from-brand-red to-brand-red-dark text-white rounded-xl font-bold"
                >
                  {selectingWinners && !selectingRoundId ? <Loader2 className="w-4 h-4 animate-spin" /> : '🎲 Select 3 Random Winners'}
                </Button>

                {/* Manual Select toggle */}
                {!manualMode ? (
                  <Button
                    onClick={startManualMode}
                    disabled={adminParticipants.length === 0 || selectingWinners}
                    variant="outline"
                    className="w-full border-brand-teal text-brand-teal hover:bg-brand-teal/5 rounded-xl font-bold"
                  >
                    <Check className="w-4 h-4 mr-1" /> Choose Winners Manually
                  </Button>
                ) : (
                  <div className="bg-teal-50 dark:bg-teal-900/20 border border-teal-200 dark:border-teal-800 rounded-xl p-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <p className="text-xs font-bold text-teal-700 dark:text-teal-400">
                        ✋ Manual Mode — Tap to select ({manualSelected.length}/3)
                      </p>
                      <button
                        onClick={() => { setManualMode(false); setManualSelected([]); }}
                        className="text-[10px] text-warm-400 hover:text-warm-600"
                      >
                        Cancel
                      </button>
                    </div>

                    {/* Participant list for selection */}
                    <div className="max-h-48 overflow-y-auto space-y-1">
                      {adminParticipants.map((p) => {
                        const isSelected = manualSelected.includes(p.userId);
                        return (
                          <button
                            key={p.userId}
                            onClick={() => toggleManualSelect(p.userId)}
                            className={`w-full flex items-center gap-2 p-2 rounded-lg text-left transition-all ${
                              isSelected
                                ? 'bg-teal-500 text-white'
                                : 'bg-white dark:bg-warm-700 hover:bg-teal-50 dark:hover:bg-teal-900/30'
                            }`}
                          >
                            <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 ${
                              isSelected ? 'border-white bg-white' : 'border-teal-400'
                            }`}>
                              {isSelected && <Check className="w-3 h-3 text-teal-500" strokeWidth={3} />}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className={`text-xs font-bold truncate ${isSelected ? 'text-white' : 'text-warm-800 dark:text-warm-100'}`}>
                                {p.name || 'Unknown'}
                              </p>
                              <p className={`text-[9px] font-mono ${isSelected ? 'text-white/70' : 'text-warm-400'}`}>
                                {p.playerCode || '—'} · {p.phone ? `****${p.phone.slice(-4)}` : 'No phone'}
                              </p>
                            </div>
                            {isSelected && (
                              <span className="text-[9px] font-black text-white bg-white/20 px-1.5 py-0.5 rounded-full">
                                #{manualSelected.indexOf(p.userId) + 1}
                              </span>
                            )}
                          </button>
                        );
                      })}
                    </div>

                    {/* Confirm button */}
                    <Button
                      onClick={handleManualSelectWinners}
                      disabled={manualSelected.length === 0 || selectingWinners}
                      className="w-full bg-teal-500 hover:bg-teal-600 text-white rounded-xl font-bold"
                    >
                      {selectingWinners ? <Loader2 className="w-4 h-4 animate-spin" /> : `✅ Set ${manualSelected.length} Winner${manualSelected.length !== 1 ? 's' : ''}`}
                    </Button>
                  </div>
                )}
                {adminParticipants.length < 3 && (
                  <p className="text-[10px] text-amber-500 text-center">Need at least 3 participants to select winners</p>
                )}
                <Button
                  onClick={async () => {
                    if (!confirm('Reset giveaway? This will delete ALL participants and start a fresh Round 1 with 15-day countdown.')) return;
                    try {
                      const res = await fetch('/api/giveaway/admin/reset', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ adminId: currentUser?.id }),
                      });
                      if (res.ok) {
                        toast({ title: '✅ Giveaway Reset!', description: 'Fresh Round 1 started with 0 participants' });
                        fetchStatus();
                        handleAdminView();
                      } else {
                        const data = await res.json();
                        toast({ title: 'Error', description: data.error, variant: 'destructive' });
                      }
                    } catch {
                      toast({ title: 'Error', description: 'Failed to reset giveaway', variant: 'destructive' });
                    }
                  }}
                  variant="outline"
                  className="w-full border-red-300 dark:border-red-700 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-xl font-bold text-xs"
                >
                  🔄 Reset Giveaway (Start Fresh)
                </Button>
              </div>
              <div className="overflow-y-auto flex-1">
                {adminLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="w-6 h-6 animate-spin text-brand-red" />
                  </div>
                ) : adminParticipants.length === 0 ? (
                  <p className="text-center text-warm-400 text-sm py-8">No participants yet</p>
                ) : (
                  adminParticipants.map((p, i) => (
                    <div key={p.id} className="flex items-center gap-3 p-3 border-b border-warm-100 dark:border-warm-700/50">
                      <span className="text-xs font-mono text-warm-400 w-6">{i + 1}.</span>
                      <div className="flex-1">
                        <p className="text-sm font-bold text-warm-800 dark:text-warm-100">
                          {p.name || 'Unknown'} <span className="text-warm-400 font-normal">({p.playerCode})</span>
                        </p>
                        <p className="text-xs text-brand-teal">{p.phone}</p>
                      </div>
                      {p.isPremium && (
                        <Badge className="bg-brand-gold/20 text-brand-gold text-[8px]">PRO</Badge>
                      )}
                    </div>
                  ))
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
