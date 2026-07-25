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
  successfulReferrals?: number;
  referralEntriesUsed?: number;
  referralEntriesRemaining?: number;
  freeEntryAvailable?: boolean;
  hasUsedFreeEntry?: boolean;
  isPremiumUser?: boolean;
  premiumDirectEntryAvailable?: boolean;
  canParticipate?: boolean;
  blockReason?: '' | 'already_participated' | 'referral_or_premium_required' | 'payment_required';
  pastWinners: Array<{
    roundId?: string;
    roundNumber: number;
    rank: number;
    playerId: string;
    prize: string;
  }>;
}

export default function GiveawayScreen({ onClose, onOpenReferral, onUpgradeToPremium }: GiveawayScreenProps) {
  const currentUser = useKabaddiStore((s) => s.currentUser);
  const { toast } = useToast();
  const [status, setStatus] = useState<GiveawayStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [participating, setParticipating] = useState(false);
  const [timeLeft, setTimeLeft] = useState({ days: 0, hours: 0, minutes: 0, seconds: 0 });
  const [showAdminPanel, setShowAdminPanel] = useState(false);
  const [adminParticipants, setAdminParticipants] = useState<any[]>([]);
  const [adminLoading, setAdminLoading] = useState(false);
  // Participants from EVERY round (current + completed), grouped by round.
  // This is what makes the admin panel show all 15+ historical participants
  // instead of just the current active round (which may be empty after
  // winners were selected for the previous round).
  const [allRounds, setAllRounds] = useState<Array<{
    id: string;
    roundNumber: number;
    status: string;
    startDate: string;
    endDate: string;
    winnerIds: string[];
    participants: Array<{
      id: string;
      userId: string;
      playerCode: string;
      name: string;
      phone: string;
      isPremium: boolean;
      joinedAt: string;
      isWinner: boolean;
    }>;
  }>>([]);
  const [allRoundsTotal, setAllRoundsTotal] = useState<number>(0);
  const [allRoundsUnique, setAllRoundsUnique] = useState<number>(0);
  const [showAllRounds, setShowAllRounds] = useState(false);
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
        if (data.blockReason === 'referral_or_premium_required') {
          // Backend says: no free entry, no premium, no referral entries left.
          // Show the user the options (buy premium / refer a friend).
          toast({
            title: 'Need premium or a referral',
            description: data.error || 'Buy premium (₹2 for 1 day) or refer a friend to enter.',
            variant: 'default',
          });
        } else {
          toast({ title: 'Cannot participate', description: data.error, variant: 'destructive' });
        }
        return;
      }
      // Custom celebration message based on which entry path was used
      const entryFundedBy = data.entryFundedBy as 'free' | 'premium_direct' | 'referral' | undefined;
      const wasFreeEntry = status?.freeEntryAvailable;
      const wasPremium = entryFundedBy === 'premium_direct';
      toast({
        title: wasFreeEntry
          ? '🎉 FREE Entry Claimed!'
          : wasPremium
            ? '🎉 Premium Direct Entry!'
            : '🎉 You\'re in!',
        description: wasFreeEntry
          ? 'Your first entry is on us! Good luck — winners announced when the timer ends.'
          : wasPremium
            ? 'Premium members get free entry to every round. Good luck!'
            : 'Good luck! Winners announced when the timer ends.',
      });
      fetchStatus();
    } catch {
      toast({ title: 'Error', description: 'Failed to participate', variant: 'destructive' });
    } finally {
      setParticipating(false);
    }
  };

  // ─── Pay ₹2 entry fee via Cashfree ────────────────────────────
  // REMOVED: The ₹2 giveaway entry-fee flow was removed per user request.
  // All giveaway entries are now free (Free Entry / Premium Direct / Referral).
  // The ₹2 daily premium plan still exists in /api/payments/create-order for
  // users who want to BUY 1-day premium (which then grants Premium Direct
  // giveaway entry). The backend endpoints /api/giveaway/create-entry-order
  // and /verify-entry-payment are kept for backward compat but no longer
  // called from this UI.

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
      } else if (res.status === 403) {
        // Backend says this user is NOT an admin. The store's isAdmin flag
        // is stale (the DB record was changed). Clear it from the store so
        // the Admin button disappears and we don't keep showing "Access
        // Denied" every time they tap it. Show a friendly message instead.
        useKabaddiStore.getState().updateUser({ isAdmin: false });
        toast({
          title: 'Admin access removed',
          description: 'Your account no longer has admin privileges. The Admin panel is hidden.',
          variant: 'default',
        });
        setShowAdminPanel(false);
        return;
      } else {
        // The participants endpoint failed (likely a DB schema/table issue).
        // Call the diagnose endpoint to find out exactly what's wrong, so
        // we can show the user a useful error message instead of the
        // generic "Internal server error".
        let diagHint = data?.error || 'Internal server error';
        try {
          const diagRes = await fetch(`/api/giveaway/admin/diagnose?adminId=${currentUser.id}`);
          if (diagRes.ok) {
            const diagData = await diagRes.json();
            if (diagData?.failingCheck && diagData?.hint) {
              diagHint = `${diagData.failingCheck}: ${diagData.hint}`;
            }
          }
        } catch { /* ignore diag failures — keep the original error */ }

        toast({
          title: 'Could not load admin panel',
          description: diagHint,
          variant: 'destructive',
        });
        setShowAdminPanel(false);
        return;
      }

      // Fetch ALL participants across ALL rounds (current + completed).
      // This is the key fix for "admin shows 0 participants" — even if the
      // current active round has 0 participants, the admin can still see
      // every user who has ever entered the giveaway here.
      try {
        const allRes = await fetch(`/api/giveaway/admin/all-participants?adminId=${currentUser.id}`);
        if (allRes.ok) {
          const allData = await allRes.json();
          setAllRounds(allData.rounds || []);
          setAllRoundsTotal(allData.totalParticipants || 0);
          setAllRoundsUnique(allData.uniqueParticipants || 0);
        }
      } catch (allErr) {
        console.error('Failed to fetch all-round participants:', allErr);
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
    if (!currentUser?.id) return;

    setChangeSelected([]);
    setChangeLoading(true);
    setShowChangeWinners(true);

    try {
      // Refetch status to get the latest pastWinners WITH roundId
      const statusRes = await fetch('/api/giveaway/status');
      let roundId: string | null = null;
      let roundNumber: number | null = null;
      if (statusRes.ok) {
        const statusData = await statusRes.json();
        setStatus(statusData);
        if (statusData?.pastWinners?.length > 0) {
          roundId = statusData.pastWinners[0].roundId || null;
          roundNumber = statusData.pastWinners[0].roundNumber;
        }
      }

      // Fallback: if roundId is missing from pastWinners, try fetching
      // completed rounds via the pending-rounds endpoint (which queries
      // completed rounds directly from the DB)
      if (!roundId && roundNumber) {
        // Try fetching via admin pending-rounds (returns completed rounds without winners)
        // But the round we want HAS winners — so let's try a different approach:
        // Use the change-winners endpoint with a roundNumber-based lookup
        // Actually, the simplest fix: add a backend endpoint to find a round by number
        // For now, let's try fetching the round-participants with the round number
        // by first fetching all completed rounds
        try {
          const roundRes = await fetch(`/api/giveaway/admin/find-round?adminId=${currentUser.id}&roundNumber=${roundNumber}`);
          if (roundRes.ok) {
            const roundData = await roundRes.json();
            if (roundData?.round?.id) {
              roundId = roundData.round.id;
            }
          }
        } catch { /* try next fallback */ }
      }

      // If still no roundId, try the most recent completed round
      if (!roundId) {
        try {
          const roundRes = await fetch(`/api/giveaway/admin/find-round?adminId=${currentUser.id}&roundNumber=1`);
          if (roundRes.ok) {
            const roundData = await roundRes.json();
            if (roundData?.round?.id) {
              roundId = roundData.round.id;
            }
          }
        } catch { /* give up */ }
      }

      if (!roundId) {
        toast({ title: 'Cannot find round', description: 'No completed round found. Try restoring winners first.', variant: 'destructive' });
        setShowChangeWinners(false);
        setChangeLoading(false);
        return;
      }

      setChangeRoundId(roundId);

      // Fetch participants for this round
      const res = await fetch(`/api/giveaway/admin/round-participants?adminId=${currentUser.id}&roundId=${roundId}`);
      if (res.ok) {
        const data = await res.json();
        setChangeRoundParticipants(data.participants || []);
      } else {
        const errData = await res.json().catch(() => ({}));
        toast({ title: 'Failed to load participants', description: errData.error || 'Unknown error', variant: 'destructive' });
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
          {status?.round?.hasEnded ? (
            // Round timer has expired — show a clear "Waiting for Winners"
            // message instead of 00:00:00:00 which makes the giveaway look
            // "stopped" or broken. The round is still ACTIVE in the backend
            // (admin must call select-winners to close it), so users CAN
            // still participate.
            <div className="py-2">
              <div className="flex items-center justify-center gap-1.5 mb-2">
                <Clock className="w-4 h-4 text-amber-500" />
                <p className="text-xs font-bold text-amber-600 dark:text-amber-400 uppercase tracking-wider">
                  Round {status.round.roundNumber} · Waiting for Winners
                </p>
              </div>
              <p className="text-sm font-black text-warm-800 dark:text-warm-100">
                Timer ended — entries still open!
              </p>
              <p className="text-[11px] text-warm-500 dark:text-warm-400 mt-1">
                You can still enter this round until the admin draws 3 winners.
              </p>
            </div>
          ) : (
            <>
              <div className="flex items-center justify-center gap-1.5 mb-3">
                <Clock className="w-4 h-4 text-amber-500" />
                <p className="text-xs font-bold text-amber-600 dark:text-amber-400 uppercase tracking-wider">
                  Ends In
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
            </>
          )}
          <div className="mt-3 flex items-center justify-center gap-2 text-xs text-warm-500">
            <Users className="w-3.5 h-3.5" />
            <span className="font-bold">{status?.participantCount || 0}</span>
            <span>participating</span>
          </div>
        </Card>

        {/* ─── Participate Button — RIGHT BELOW TIMER (moved from bottom) ─── */}
        {!status?.hasParticipated ? (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-2"
          >
            <Button
              onClick={handleParticipate}
              disabled={participating || status?.canParticipate === false}
              className={
                // Premium users get a distinct AMBER ENTER button so they
                // immediately see their direct-entry perk. Everyone else
                // gets the standard brand-red participate button.
                status?.isPremiumUser
                  ? 'w-full h-16 bg-gradient-to-r from-amber-500 via-yellow-500 to-amber-600 hover:opacity-90 text-white font-black text-lg rounded-2xl shadow-xl shadow-amber-500/30 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 active:scale-[0.98] transition-transform'
                  : 'w-full h-16 bg-gradient-to-r from-brand-red via-brand-red-dark to-brand-red hover:opacity-90 text-white font-black text-lg rounded-2xl shadow-xl shadow-brand-red/30 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 active:scale-[0.98] transition-transform'
              }
            >
              {participating ? (
                <Loader2 className="w-6 h-6 animate-spin" />
              ) : status?.canParticipate === false ? (
                <>
                  <Lock className="w-6 h-6" />
                  Already Participated
                </>
              ) : status?.freeEntryAvailable ? (
                <>
                  <Gift className="w-6 h-6" />
                  Claim FREE Entry Now!
                </>
              ) : status?.isPremiumUser ? (
                <>
                  <Crown className="w-6 h-6" />
                  ENTER NOW — Free with Premium
                </>
              ) : status?.referralEntriesRemaining && status.referralEntriesRemaining > 0 ? (
                <>
                  <Gift className="w-6 h-6" />
                  Use Referral Entry
                </>
              ) : (
                <>
                  <Lock className="w-6 h-6" />
                  Need Premium or Referral
                </>
              )}
            </Button>
            {status?.canParticipate === false && (
              <p className="text-center text-[10px] text-warm-500">
                You already entered this round. Wait for the next round!
              </p>
            )}
            {status?.blockReason === 'referral_or_premium_required' && (
              <div className="rounded-xl bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800/40 p-3 text-center">
                <p className="text-[11px] text-amber-700 dark:text-amber-400 font-bold mb-1">
                  No free entry, no premium, no referral entries left.
                </p>
                <p className="text-[10px] text-amber-600 dark:text-amber-500/80">
                  Buy premium (₹2 for 1 day) for direct entry to every round — OR refer a friend to enter free.
                </p>
                {onOpenReferral && (
                  <Button
                    onClick={onOpenReferral}
                    size="sm"
                    variant="outline"
                    className="mt-2 h-8 text-[11px] border-amber-300 dark:border-amber-700 text-amber-700 dark:text-amber-400 hover:bg-amber-100 dark:hover:bg-amber-900/30"
                  >
                    <UserPlus className="w-3 h-3 mr-1" /> Refer a Friend
                  </Button>
                )}
              </div>
            )}
            {/* Entry-path badges — show user's current status */}
            {status?.canParticipate && (
              <div className="flex flex-wrap items-center justify-center gap-1.5">
                {status?.freeEntryAvailable && (
                  <span className="text-[9px] font-bold text-emerald-700 dark:text-emerald-400 bg-emerald-100 dark:bg-emerald-900/30 px-2 py-0.5 rounded-full">
                    FREE ENTRY
                  </span>
                )}
                {status?.isPremiumUser && (
                  <span className="text-[9px] font-bold text-amber-700 dark:text-amber-400 bg-amber-100 dark:bg-amber-900/30 px-2 py-0.5 rounded-full flex items-center gap-1">
                    <Crown className="w-2.5 h-2.5" /> PREMIUM DIRECT
                  </span>
                )}
                {!status?.freeEntryAvailable && !status?.isPremiumUser && (status?.referralEntriesRemaining ?? 0) > 0 && (
                  <span className="text-[9px] font-bold text-blue-700 dark:text-blue-400 bg-blue-100 dark:bg-blue-900/30 px-2 py-0.5 rounded-full">
                    REFERRAL · {status?.referralEntriesRemaining} left
                  </span>
                )}
              </div>
            )}

            {/* Always-on "Buy Premium" CTA — visible to all users so anyone can
                upgrade for direct giveaway entry, even if they have free/referral
                entries available. Tapping it calls onUpgradeToPremium (which
                opens PremiumUpgradeScreen in the parent). */}
            {!status?.isPremiumUser && onUpgradeToPremium && (
              <button
                type="button"
                onClick={onUpgradeToPremium}
                className="w-full mt-2 rounded-xl bg-gradient-to-r from-amber-500 to-yellow-600 hover:from-amber-600 hover:to-yellow-700 text-white text-[11px] font-black px-3 py-2 flex items-center justify-center gap-1.5 active:scale-[0.99] transition-transform"
              >
                <Crown className="w-3.5 h-3.5" />
                Get Premium — Direct Entry to Every Round
                <span className="ml-1 text-white/80 font-bold">from ₹2/day →</span>
              </button>
            )}
          </motion.div>
        ) : (
          <Card className="p-4 bg-green-50 dark:bg-green-900/20 border-green-300 dark:border-green-800 text-center">
            <Check className="w-6 h-6 text-green-500 mx-auto mb-1" />
            <p className="text-sm font-bold text-green-700 dark:text-green-400">You're participating!</p>
            <p className="text-[10px] text-green-600/80 dark:text-green-500/80 mt-0.5">
              Winners are selected randomly when the timer ends. Good luck!
            </p>
          </Card>
        )}

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
                onClick={() => handleSelectWinners()}
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

        {/* Prizes — with images + rank badges */}
        <div className="space-y-2">
          <h3 className="text-sm font-black text-warm-800 dark:text-warm-100 flex items-center gap-2 px-1">
            <Trophy className="w-4 h-4 text-brand-gold" />
            Prizes & Rankings
          </h3>
          {status?.prizes?.map((prize, i) => {
            // Image mapping — by prize name (robust to backend reordering),
            // with positional fallback. Order matches the backend PRIZES list:
            //   1st = 1kg Protein Powder     -> /giveaway/prize-protein.png
            //   2nd = Kabaddi Kit            -> /giveaway/prize-kit.png
            //   3rd = Shaker Water Bottle    -> /giveaway/prize-bottle.png
            const PRIZE_IMG_BY_NAME: Array<{ keys: string[]; img: string }> = [
              { keys: ['protein', 'powder', 'whey', 'mass'], img: '/giveaway/prize-protein.png' },
              { keys: ['kit', 'gear', 'equipment', 'jersey', 'guard'], img: '/giveaway/prize-kit.png' },
              { keys: ['bottle', 'shaker', 'shekher', 'sipper', 'flask'], img: '/giveaway/prize-bottle.png' },
              { keys: ['shoes', 'footwear', 'sneaker', 'boot'], img: '/giveaway/prize-shoes.png' },
            ];
            const FALLBACK_IMG = '/giveaway/prize-gift.png';
            const POSITIONAL_FALLBACK = [
              '/giveaway/prize-protein.png',
              '/giveaway/prize-kit.png',
              '/giveaway/prize-bottle.png',
            ];
            const prizeNameLower = (prize.name || '').toLowerCase();
            const nameMatch = PRIZE_IMG_BY_NAME.find((p) => p.keys.some((k) => prizeNameLower.includes(k)));
            const imgSrc = nameMatch?.img || POSITIONAL_FALLBACK[i] || FALLBACK_IMG;
            const rankEmoji = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i + 1}`;
            return (
              <motion.div key={i} initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.1 }}>
                <Card className={`p-3 flex items-center gap-3 ${
                  i === 0 ? 'bg-gradient-to-r from-yellow-50 to-amber-50 dark:from-yellow-900/20 dark:to-amber-900/10 border-yellow-300/50' :
                  i === 1 ? 'bg-gradient-to-r from-gray-50 to-slate-50 dark:from-gray-800/30 dark:to-slate-800/20 border-gray-300/50' :
                  i === 2 ? 'bg-gradient-to-r from-orange-50 to-amber-50 dark:from-orange-900/10 dark:to-amber-900/10 border-orange-300/50' :
                  'bg-white/50 dark:bg-warm-800/30 border-warm-200 dark:border-warm-700'
                }`}>
                  <div className={`shrink-0 w-8 h-8 rounded-full flex items-center justify-center font-black text-sm ${
                    i === 0 ? 'bg-yellow-400 text-white' : i === 1 ? 'bg-gray-400 text-white' : i === 2 ? 'bg-orange-400 text-white' : 'bg-warm-200 dark:bg-warm-700 text-warm-600 dark:text-warm-300'
                  }`}>
                    {rankEmoji}
                  </div>
                  <div className="w-14 h-14 rounded-xl overflow-hidden bg-white shadow-sm shrink-0 border border-warm-200/50 dark:border-warm-700/50">
                    <img src={imgSrc} alt={prize.name} className="w-full h-full object-cover" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[10px] font-bold text-warm-400 uppercase">
                      {i === 0 ? '1st Prize' : i === 1 ? '2nd Prize' : i === 2 ? '3rd Prize' : `${i + 1}th Prize`}
                    </p>
                    <p className="text-sm font-bold text-warm-800 dark:text-warm-100 truncate">{prize.name}</p>
                  </div>
                </Card>
              </motion.div>
            );
          })}
        </div>

        {/* Eligibility Card — Free Entry / Premium Direct / Referral entries */}
        {currentUser && (
          <Card className={`p-4 ${
            status?.freeEntryAvailable
              ? 'bg-gradient-to-br from-violet-50 to-fuchsia-50 dark:from-violet-900/20 dark:to-fuchsia-900/10 border-violet-300/50'
              : status?.isPremiumUser
              ? 'bg-gradient-to-br from-amber-50 to-yellow-50 dark:from-amber-900/20 dark:to-yellow-900/10 border-amber-300/50'
              : (status?.referralEntriesRemaining && status.referralEntriesRemaining > 0)
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
                    Your first giveaway entry is on us — no referral, no premium needed. Just tap below!
                  </p>
                </div>
              </div>
            ) : status?.isPremiumUser ? (
              /* PREMIUM DIRECT — paid-premium users get free direct entry to every round */
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-amber-400 to-yellow-500 flex items-center justify-center shrink-0">
                  <Crown className="w-5 h-5 text-white" />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-bold text-amber-700 dark:text-amber-300 flex items-center gap-1.5">
                    Premium Direct Entry
                    <Badge className="bg-amber-500/20 text-amber-700 dark:text-amber-300 text-[8px] font-bold px-1.5">PREMIUM</Badge>
                  </p>
                  <p className="text-[11px] text-amber-600/80 dark:text-amber-400/80 mt-0.5">
                    Premium members get free direct entry to every round — no referral needed.
                  </p>
                </div>
              </div>
            ) : (status?.referralEntriesRemaining && status.referralEntriesRemaining > 0) ? (
              /* User WITH remaining referral entries — referral path available */
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-emerald-400 to-teal-500 flex items-center justify-center shrink-0">
                  <UserPlus className="w-5 h-5 text-white" />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-bold text-emerald-700 dark:text-emerald-300">
                    {status.referralEntriesRemaining} giveaway {status.referralEntriesRemaining === 1 ? 'entry' : 'entries'} remaining
                  </p>
                  <p className="text-[11px] text-emerald-600/80 dark:text-emerald-400/80 mt-0.5">
                    Earned from {status.successfulReferrals} successful {status.successfulReferrals === 1 ? 'referral' : 'referrals'} · {status.referralEntriesUsed} used
                  </p>
                </div>
              </div>
            ) : (
              /* No free entry, no premium, no referral entries left — show options. */
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-red-400 to-orange-500 flex items-center justify-center shrink-0">
                    <Lock className="w-4 h-4 text-white" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-red-700 dark:text-red-400">
                      No entries left
                    </p>
                    <p className="text-[11px] text-red-600/80 dark:text-red-400/80 mt-0.5">
                      Buy premium (₹2 for 1 day) for direct entry to every round — OR refer a friend to enter free.
                    </p>
                  </div>
                </div>

                {/* Two equal-sized choice cards */}
                <div className="grid grid-cols-2 gap-2.5">
                  {/* Option A — Refer a Friend (FREE) */}
                  <button
                    type="button"
                    onClick={() => onOpenReferral?.()}
                    className="group relative overflow-hidden rounded-2xl p-3 text-left bg-gradient-to-br from-emerald-50 to-teal-50 dark:from-emerald-900/30 dark:to-teal-900/20 border-2 border-emerald-300/60 dark:border-emerald-700/50 hover:border-emerald-500 dark:hover:border-emerald-500 active:scale-[0.97] transition-all"
                  >
                    <div className="absolute top-1.5 right-1.5">
                      <Badge className="bg-emerald-500 text-white text-[8px] font-black px-1.5 py-0.5">FREE</Badge>
                    </div>
                    <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-emerald-400 to-teal-500 flex items-center justify-center shrink-0 mb-2">
                      <UserPlus className="w-5 h-5 text-white" />
                    </div>
                    <p className="text-xs font-black text-emerald-700 dark:text-emerald-300 leading-tight">
                      Refer a Friend
                    </p>
                    <p className="text-[10px] text-emerald-600/80 dark:text-emerald-400/80 mt-1 leading-snug">
                      Share your code. 1 successful referral = 1 free entry.
                    </p>
                  </button>

                  {/* Option B — Buy Premium (₹2 for 1 day) */}
                  <button
                    type="button"
                    onClick={() => onUpgradeToPremium?.()}
                    className="group relative overflow-hidden rounded-2xl p-3 text-left bg-gradient-to-br from-amber-50 to-yellow-50 dark:from-amber-900/30 dark:to-yellow-900/20 border-2 border-amber-300/60 dark:border-amber-700/50 hover:border-amber-500 dark:hover:border-amber-500 active:scale-[0.97] transition-all"
                  >
                    <div className="absolute top-1.5 right-1.5">
                      <Badge className="bg-amber-500 text-white text-[8px] font-black px-1.5 py-0.5">₹2</Badge>
                    </div>
                    <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-amber-400 to-yellow-500 flex items-center justify-center shrink-0 mb-2">
                      <Crown className="w-5 h-5 text-white" />
                    </div>
                    <p className="text-xs font-black text-amber-700 dark:text-amber-300 leading-tight">
                      Buy Premium
                    </p>
                    <p className="text-[10px] text-amber-600/80 dark:text-amber-400/80 mt-1 leading-snug">
                      ₹2 for 1 day = direct entry to every round while active.
                    </p>
                  </button>
                </div>

                <p className="text-center text-[10px] text-warm-500 dark:text-warm-400 font-bold tracking-wide">
                  ─── Choose Premium  <span className="text-warm-400">OR</span>  Choose Referral ───
                </p>
              </div>
            )}
          </Card>
        )}

        {/* (Participate button moved to top — below the timer) */}

        {/* Rules */}
        <Card className="p-4 bg-white dark:bg-warm-800/50">
          <h4 className="text-xs font-bold text-warm-700 dark:text-warm-300 mb-2 flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-brand-gold" />
            How It Works
          </h4>
          <div className="space-y-2 text-[11px] text-warm-500 dark:text-warm-400">
            <div className="p-2 rounded-lg bg-violet-50 dark:bg-violet-900/10 border border-violet-200 dark:border-violet-700/30">
              <p className="font-bold text-violet-700 dark:text-violet-400 text-xs mb-1">🎁 STEP 1 — Your First Entry is FREE</p>
              <p>Every new user gets 1 lifetime free entry — no referral, no premium. Just tap Participate!</p>
            </div>
            <div className="p-2 rounded-lg bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-700/30">
              <p className="font-bold text-amber-700 dark:text-amber-400 text-xs mb-1">👑 OPTION A — Premium Direct Entry</p>
              <p>Buy premium (₹2 for 1 day, or weekly/monthly/yearly/lifetime) and get free direct entry to every round while your premium is active.</p>
            </div>
            <div className="p-2 rounded-lg bg-brand-teal/10 border border-brand-teal/20">
              <p className="font-bold text-brand-teal-dark dark:text-brand-teal text-xs mb-1">🤝 OPTION B — Refer a Friend</p>
              <p>Share your referral code. Each successful referral = 1 free giveaway entry (across all rounds).</p>
            </div>
            <p>✅ 3 winners selected randomly every 15 days</p>
            <p>🔄 1 referral = 1 entry (used across all rounds — refer more to enter more!)</p>
            <p>🔒 Entry is locked in once you participate — even if the round ends later</p>
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
                    if (!confirm('Start a fresh giveaway round? This will end the current round and start a new one. Past rounds and winners are preserved.')) return;
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
                  🔄 Reset Giveaway (Start Fresh Round)
                </Button>

                {/* Force Start Next Round — picks up from where the last round ended.
                    Used when round is stuck in error state or timer shows 00:00:00:00. */}
                <Button
                  onClick={async () => {
                    if (!confirm('Force-start the NEXT round?\n\nThis will:\n• Mark the current round as completed (preserves participants)\n• Create a new round with the next round number\n• Set the timer to 15 days from now\n\nUse this when the current round is stuck or showing errors.')) return;
                    try {
                      const res = await fetch('/api/giveaway/admin/force-start-next-round', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ adminId: currentUser?.id }),
                      });
                      const data = await res.json();
                      if (res.ok) {
                        toast({
                          title: '✅ Next Round Started!',
                          description: data.message || `Round ${data.round?.roundNumber} started successfully.`,
                        });
                        fetchStatus();
                        handleAdminView();
                      } else {
                        toast({ title: 'Error', description: data.error, variant: 'destructive' });
                      }
                    } catch {
                      toast({ title: 'Error', description: 'Failed to start next round', variant: 'destructive' });
                    }
                  }}
                  variant="outline"
                  className="w-full border-blue-300 dark:border-blue-700 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-xl font-bold text-xs"
                >
                  ⏭ Force Start Next Round (recover from error)
                </Button>

                {/* Quick Restore Round 1 — winners + participants, pre-filled */}
                <Button
                  onClick={async () => {
                    if (!confirm('Restore Round 1 completely:\n\nWinners:\n🥇 KP1003 — 1kg Protein Powder\n🥈 KP1025 — Kabaddi Kit\n🥉 KP1017 — Shaker Water Bottle\n\nParticipants (19 players will be restored — they CANNOT enter Round 2 for free):\nKP1001, KP1003, KP1015, KP1025, KP1017 + 14 others\n\nTap OK to restore now.')) return;
                    try {
                      // Step 1: Restore winners
                      const res = await fetch('/api/giveaway/admin/restore-round', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                          adminId: currentUser?.id,
                          roundNumber: 1,
                          winnerPlayerCodes: ['KP1003', 'KP1025', 'KP1017'],
                        }),
                      });
                      const data = await res.json();
                      if (!res.ok) {
                        toast({ title: 'Restore winners failed', description: data.error, variant: 'destructive' });
                        return;
                      }

                      // Step 2: Get the round ID
                      const roundId = data.round?.id;
                      if (!roundId) {
                        toast({ title: 'Winners restored but could not restore participants', description: 'Round ID not found.', variant: 'destructive' });
                        fetchStatus();
                        setShowAdminPanel(false);
                        return;
                      }

                      // Step 3: Restore participants (all 19 known Round 1 participants)
                      const allParticipants = [
                        'KP1001', 'KP1003', 'KP1015', 'KP1025', 'KP1017'
                        // Add more participant codes here as they become known
                      ];
                      const partRes = await fetch('/api/giveaway/admin/restore-participants', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                          adminId: currentUser?.id,
                          roundId: roundId,
                          playerCodes: allParticipants,
                        }),
                      });
                      const partData = await partRes.json();

                      toast({
                        title: '✅ Round 1 Fully Restored!',
                        description: `Winners set. ${partData.created || 0} participants restored — they cannot enter Round 2 for free.`,
                      });
                      fetchStatus();
                      setShowAdminPanel(false);
                    } catch {
                      toast({ title: 'Restore failed', variant: 'destructive' });
                    }
                  }}
                  className="w-full bg-gradient-to-r from-amber-500 to-orange-500 text-white rounded-xl font-bold text-xs"
                >
                  🏆 Quick Restore Round 1 (Winners + Participants)
                </Button>

                {/* Restore participants only — for adding more participants to a round */}
                <Button
                  onClick={async () => {
                    const input = prompt(
                      'Restore participants for a round.\n\n' +
                      'Enter: round number, then player codes separated by commas.\n' +
                      'Example: 1, KP1001, KP1003, KP1015, KP1025, KP1017\n\n' +
                      'These players will be marked as having participated (cannot use free entry again).'
                    );
                    if (!input) return;
                    const parts = input.split(',').map(s => s.trim());
                    const roundNum = parts[0];
                    const codes = parts.slice(1);
                    if (!roundNum || codes.length === 0) {
                      toast({ title: 'Invalid input', variant: 'destructive' });
                      return;
                    }
                    try {
                      // Find the round ID
                      const findRes = await fetch(`/api/giveaway/admin/find-round?adminId=${currentUser?.id}&roundNumber=${roundNum}`);
                      const findData = await findRes.json();
                      if (!findRes.ok || !findData?.round?.id) {
                        toast({ title: 'Round not found', description: findData.error || `Round ${roundNum} not found`, variant: 'destructive' });
                        return;
                      }
                      // Restore participants
                      const partRes = await fetch('/api/giveaway/admin/restore-participants', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                          adminId: currentUser?.id,
                          roundId: findData.round.id,
                          playerCodes: codes,
                        }),
                      });
                      const partData = await partRes.json();
                      if (partRes.ok) {
                        toast({ title: '✅ Participants Restored!', description: partData.message });
                        fetchStatus();
                      } else {
                        toast({ title: 'Failed', description: partData.error, variant: 'destructive' });
                      }
                    } catch {
                      toast({ title: 'Failed', variant: 'destructive' });
                    }
                  }}
                  variant="outline"
                  className="w-full border-teal-300 dark:border-teal-700 text-teal-600 dark:text-teal-400 hover:bg-teal-50 dark:hover:bg-teal-900/20 rounded-xl font-bold text-xs"
                >
                  👥 Restore Participants (Block Free Entry)
                </Button>

                {/* Manual Restore — for other rounds */}
                <Button
                  onClick={async () => {
                    const codes = prompt(
                      'Restore a past round with winners.\n\n' +
                      'Enter: round number, then winner player codes separated by commas.\n' +
                      'Example: 2, KP1020, KP1030, KP1040\n\n' +
                      'First code = 1st prize, second = 2nd, third = 3rd.'
                    );
                    if (!codes) return;
                    const parts = codes.split(',').map(s => s.trim());
                    const roundNum = parts[0];
                    const winnerCodes = parts.slice(1);
                    if (!roundNum || winnerCodes.length === 0) {
                      toast({ title: 'Invalid input', description: 'Enter round number followed by player codes.', variant: 'destructive' });
                      return;
                    }
                    try {
                      const res = await fetch('/api/giveaway/admin/restore-round', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                          adminId: currentUser?.id,
                          roundNumber: roundNum,
                          winnerPlayerCodes: winnerCodes,
                        }),
                      });
                      const data = await res.json();
                      if (res.ok) {
                        toast({ title: '✅ Round Restored!', description: data.message });
                        fetchStatus();
                        setShowAdminPanel(false);
                      } else {
                        toast({ title: 'Restore failed', description: data.error, variant: 'destructive' });
                      }
                    } catch {
                      toast({ title: 'Restore failed', variant: 'destructive' });
                    }
                  }}
                  variant="outline"
                  className="w-full border-amber-300 dark:border-amber-700 text-amber-600 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-900/20 rounded-xl font-bold text-xs"
                >
                  📋 Restore Other Round (Manual)
                </Button>
              </div>
              <div className="overflow-y-auto flex-1">
                {adminLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="w-6 h-6 animate-spin text-brand-red" />
                  </div>
                ) : (
                  <>
                    {/* Tab switcher: Current Round vs All Rounds */}
                    <div className="flex border-b border-warm-200 dark:border-warm-700 sticky top-0 bg-white dark:bg-warm-800 z-10">
                      <button
                        onClick={() => setShowAllRounds(false)}
                        className={`flex-1 py-2.5 text-xs font-bold transition-colors ${
                          !showAllRounds
                            ? 'text-brand-red border-b-2 border-brand-red'
                            : 'text-warm-400 hover:text-warm-600'
                        }`}
                      >
                        Current Round ({adminParticipants.length})
                      </button>
                      <button
                        onClick={() => setShowAllRounds(true)}
                        className={`flex-1 py-2.5 text-xs font-bold transition-colors ${
                          showAllRounds
                            ? 'text-brand-red border-b-2 border-brand-red'
                            : 'text-warm-400 hover:text-warm-600'
                        }`}
                      >
                        All Rounds ({allRoundsTotal})
                      </button>
                    </div>

                    {!showAllRounds ? (
                      /* ─── Current Round participants (existing behavior) ─── */
                      adminParticipants.length === 0 ? (
                        <p className="text-center text-warm-400 text-sm py-8">
                          No participants in the current round yet.
                          <br />
                          <span className="text-[10px]">Switch to “All Rounds” to see everyone who has ever entered.</span>
                        </p>
                      ) : (
                        adminParticipants.map((p, i) => (
                          <div key={p.id} className="flex items-center gap-3 p-3 border-b border-warm-100 dark:border-warm-700/50">
                            <span className="text-xs font-mono text-warm-400 w-6">{i + 1}.</span>
                            <div className="flex-1">
                              <p className="text-sm font-bold text-warm-800 dark:text-warm-100">
                                {p.name || 'Unknown'} <span className="text-warm-400 font-normal">({p.playerCode})</span>
                              </p>
                              <p className="text-xs text-brand-teal">{p.phone}</p>
                              <p className="text-[9px] text-warm-400 mt-0.5">
                                Joined {new Date(p.joinedAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                              </p>
                            </div>
                            {p.isPremium && (
                              <Badge className="bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 text-[8px]">PAID</Badge>
                            )}
                          </div>
                        ))
                      )
                    ) : (
                      /* ─── All Rounds view (NEW — shows every participant from every round) ─── */
                      <>
                        {/* Summary card */}
                        <div className="m-3 p-3 rounded-xl bg-gradient-to-br from-brand-red/5 to-brand-teal/5 border border-warm-200 dark:border-warm-700">
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="text-[10px] uppercase tracking-wider text-warm-500 font-bold">Total Entries</p>
                              <p className="text-2xl font-black text-brand-red">{allRoundsTotal}</p>
                            </div>
                            <div className="text-right">
                              <p className="text-[10px] uppercase tracking-wider text-warm-500 font-bold">Unique Players</p>
                              <p className="text-2xl font-black text-brand-teal">{allRoundsUnique}</p>
                            </div>
                            <div className="text-right">
                              <p className="text-[10px] uppercase tracking-wider text-warm-500 font-bold">Rounds</p>
                              <p className="text-2xl font-black text-warm-700 dark:text-warm-200">{allRounds.length}</p>
                            </div>
                          </div>
                        </div>

                        {allRounds.length === 0 ? (
                          <p className="text-center text-warm-400 text-sm py-8">No giveaway rounds found.</p>
                        ) : (
                          allRounds.map((round) => (
                            <div key={round.id} className="border-b border-warm-200 dark:border-warm-700">
                              {/* Round header */}
                              <div className={`px-3 py-2 flex items-center justify-between ${
                                round.status === 'active'
                                  ? 'bg-emerald-50 dark:bg-emerald-900/20'
                                  : round.winnerIds.length > 0
                                    ? 'bg-warm-50 dark:bg-warm-700/30'
                                    : 'bg-amber-50 dark:bg-amber-900/20'
                              }`}>
                                <div>
                                  <p className="text-xs font-bold text-warm-800 dark:text-warm-100">
                                    Round {round.roundNumber}
                                    {round.status === 'active' && (
                                      <span className="ml-2 text-[9px] font-bold text-emerald-600 dark:text-emerald-400 uppercase">● Live</span>
                                    )}
                                    {round.status === 'completed' && round.winnerIds.length > 0 && (
                                      <span className="ml-2 text-[9px] font-bold text-warm-500 uppercase">✓ Completed</span>
                                    )}
                                    {round.status === 'completed' && round.winnerIds.length === 0 && (
                                      <span className="ml-2 text-[9px] font-bold text-amber-600 dark:text-amber-400 uppercase">⚠ No Winners</span>
                                    )}
                                  </p>
                                  <p className="text-[9px] text-warm-400">
                                    {round.participants.length} participant{round.participants.length !== 1 ? 's' : ''}
                                    {' · '}
                                    {new Date(round.startDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                                    {' → '}
                                    {new Date(round.endDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                                  </p>
                                </div>
                                {round.winnerIds.length > 0 && (
                                  <Badge className="bg-brand-gold/20 text-brand-gold text-[8px] shrink-0">
                                    <Trophy className="w-2.5 h-2.5 mr-0.5" />
                                    {round.winnerIds.length} winner{round.winnerIds.length !== 1 ? 's' : ''}
                                  </Badge>
                                )}
                              </div>

                              {/* Round participants */}
                              {round.participants.length === 0 ? (
                                <p className="text-center text-warm-400 text-[10px] py-3">No participants in this round</p>
                              ) : (
                                round.participants.map((p, i) => (
                                  <div key={p.id} className={`flex items-center gap-3 p-3 border-b border-warm-100 dark:border-warm-700/30 ${
                                    p.isWinner ? 'bg-amber-50/50 dark:bg-amber-900/10' : ''
                                  }`}>
                                    <span className="text-xs font-mono text-warm-400 w-6">{i + 1}.</span>
                                    <div className="flex-1 min-w-0">
                                      <p className="text-sm font-bold text-warm-800 dark:text-warm-100 truncate">
                                        {p.name || 'Unknown'}
                                        {p.isWinner && (
                                          <span className="ml-1.5 text-[9px] font-black text-amber-600 dark:text-amber-400">
                                            🏆 WINNER
                                          </span>
                                        )}
                                      </p>
                                      <p className="text-[10px] font-mono text-warm-500 dark:text-warm-400 truncate">
                                        {p.playerCode || '—'} · {p.phone || 'No phone'}
                                      </p>
                                      <p className="text-[9px] text-warm-400 mt-0.5">
                                        Joined {new Date(p.joinedAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                                      </p>
                                    </div>
                                    {p.isPremium && (
                                      <Badge className="bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 text-[8px] shrink-0">PAID</Badge>
                                    )}
                                  </div>
                                ))
                              )}
                            </div>
                          ))
                        )}
                      </>
                    )}
                  </>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
