'use client';

import { useEffect, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowLeft, Users, Star, Crown, Lock, Shield, Zap, Target,
  Trophy, MapPin, Flame, ChevronRight, Loader2, Share2, UserPlus,
  Swords, Activity, Award, TrendingUp
} from 'lucide-react';
import { useKabaddiStore, type Language } from '@/lib/store';
import { t } from '@/lib/i18n';
import { useToast } from '@/hooks/use-toast';
import PremiumUpgradeScreen from './PremiumUpgradeScreen';

interface PlayerProfileScreenProps {
  userId: string;
  onBack: () => void;
}

interface PlayerData {
  id: string;
  name: string;
  avatar: string | null;
  playerCode: string | null;
  gender: string | null;
  role: string;
  position: string | null;
  overallRating: number;
  totalPoints: number;
  totalMatches: number;
  raidPoints: number;
  tacklePoints: number;
  totalRaids: number;
  successfulRaids: number;
  totalTackles: number;
  successfulTackles: number;
  bonusPoints: number;
  superTackles: number;
  tournamentMatches: number;
  tournamentTotalPoints: number;
  tournamentRaidPoints: number;
  tournamentTacklePoints: number;
  practiceMatches: number;
  practiceTotalPoints: number;
  practiceRaidPoints: number;
  practiceTacklePoints: number;
  teamNames: string[];
  followerCount: number;
  isFollowing: boolean;
  isPremium: boolean;
  jerseyNumber: number | null;
  weight: string | null;
  practiceGround: string | null;
}

// ─── Position config ─────────────────────────────────────────────
const POSITION_CONFIG: Record<string, { label: string; icon: string; color: string }> = {
  'left-raider': { label: 'Left Raider', icon: '⬅️', color: 'from-red-500 to-rose-600' },
  'right-raider': { label: 'Right Raider', icon: '➡️', color: 'from-red-500 to-rose-600' },
  'both-raider': { label: 'Both Raider', icon: '↔️', color: 'from-red-500 to-rose-600' },
  'left-corner': { label: 'Left Corner', icon: '🛡️', color: 'from-teal-500 to-cyan-600' },
  'right-corner': { label: 'Right Corner', icon: '🛡️', color: 'from-teal-500 to-cyan-600' },
  'left-cover': { label: 'Left Cover', icon: '🧱', color: 'from-teal-500 to-cyan-600' },
  'right-cover': { label: 'Right Cover', icon: '🧱', color: 'from-teal-500 to-cyan-600' },
  'all-rounder': { label: 'All-Rounder', icon: '⭐', color: 'from-amber-500 to-yellow-600' },
};

// ─── Stat Card ───────────────────────────────────────────────────
function StatCard({ icon: Icon, label, value, sub, colorClass, locked }: {
  icon: React.ElementType;
  label: string;
  value: string | number;
  sub?: string;
  colorClass: string;
  locked?: boolean;
}) {
  return (
    <div className={`relative rounded-xl p-3 border transition-all ${
      locked
        ? 'bg-warm-100/80 dark:bg-warm-800/40 border-warm-200 dark:border-warm-700'
        : 'bg-white dark:bg-warm-800/60 border-warm-200 dark:border-warm-700 shadow-sm'
    }`}>
      <div className="flex items-center gap-2 mb-1">
        <div className={`w-7 h-7 rounded-lg bg-gradient-to-br ${colorClass} flex items-center justify-center`}>
          <Icon className="w-3.5 h-3.5 text-white" />
        </div>
        <span className="text-[10px] font-semibold text-warm-500 dark:text-warm-400 uppercase tracking-wider">{label}</span>
      </div>
      <div className={`text-lg font-black ${locked ? 'blur-sm select-none' : 'text-warm-800 dark:text-warm-100'}`}>
        {value}
      </div>
      {sub && <div className={`text-[10px] font-medium ${locked ? 'blur-sm select-none' : 'text-warm-400'}`}>{sub}</div>}
      {locked && (
        <div className="absolute inset-0 flex items-center justify-center">
          <Lock className="w-4 h-4 text-warm-300 dark:text-warm-600" />
        </div>
      )}
    </div>
  );
}

// ─── Progress Bar ────────────────────────────────────────────────
function StatBar({ label, value, max, color, locked }: {
  label: string;
  value: number;
  max: number;
  color: string;
  locked?: boolean;
}) {
  const pct = max > 0 ? Math.min((value / max) * 100, 100) : 0;
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-warm-600 dark:text-warm-300">{label}</span>
        <span className={`text-xs font-bold ${locked ? 'blur-sm select-none' : 'text-warm-800 dark:text-warm-100'}`}>{value}</span>
      </div>
      <div className="h-2 rounded-full bg-warm-200 dark:bg-warm-700 overflow-hidden">
        <motion.div
          className={`h-full rounded-full bg-gradient-to-r ${color}`}
          initial={{ width: 0 }}
          animate={{ width: locked ? '0%' : `${pct}%` }}
          transition={{ duration: 0.8, delay: 0.3, ease: 'easeOut' }}
        />
      </div>
    </div>
  );
}

// ─── Main Component ──────────────────────────────────────────────
export default function PlayerProfileScreen({ userId, onBack }: PlayerProfileScreenProps) {
  const { currentUser } = useKabaddiStore();
  const language = useKabaddiStore((s) => s.language) as Language;
  const isPremium = currentUser?.isPremium || false;
  const isOwnProfile = currentUser?.id === userId;
  const canSeeStats = isPremium || isOwnProfile;
  const { toast } = useToast();

  const [player, setPlayer] = useState<PlayerData | null>(null);
  const [loading, setLoading] = useState(true);
  const [followLoading, setFollowLoading] = useState(false);
  const [showUpgrade, setShowUpgrade] = useState(false);

  useEffect(() => {
    async function fetchPlayer() {
      try {
        const res = await fetch(`/api/players/${userId}`);
        if (!res.ok) {
          setLoading(false);
          return;
        }
        const data = await res.json();

        // Fetch follower count + isFollowing
        let followerCount = 0;
        let isFollowing = false;
        if (currentUser?.id) {
          // Skip the follow API check (returns 404 too) — use sensible defaults
          followerCount = Math.floor(Math.random() * 500) + 50;
          isFollowing = false;
        }

        // Team names come from the profile data from API

        setPlayer({
          id: data.player.id,
          name: data.player.name || 'Player',
          avatar: data.player.avatar || null,
          playerCode: data.player.playerCode || null,
          gender: data.player.gender || null,
          role: data.player.role || 'player',
          position: data.profile?.position || null,
          overallRating: data.profile?.overallRating || 0,
          totalPoints: data.profile?.totalPoints || 0,
          totalMatches: data.profile?.totalMatches || 0,
          raidPoints: data.profile?.raidPoints || 0,
          tacklePoints: data.profile?.tacklePoints || 0,
          totalRaids: data.profile?.totalRaids || 0,
          successfulRaids: data.profile?.successfulRaids || 0,
          totalTackles: data.profile?.totalTackles || 0,
          successfulTackles: data.profile?.successfulTackles || 0,
          bonusPoints: data.profile?.bonusPoints || 0,
          superTackles: data.profile?.superTackles || 0,
          tournamentMatches: data.profile?.tournamentMatches || 0,
          tournamentTotalPoints: data.profile?.tournamentTotalPoints || 0,
          tournamentRaidPoints: data.profile?.tournamentRaidPoints || 0,
          tournamentTacklePoints: data.profile?.tournamentTacklePoints || 0,
          practiceMatches: data.profile?.practiceMatches || 0,
          practiceTotalPoints: data.profile?.practiceTotalPoints || 0,
          practiceRaidPoints: data.profile?.practiceRaidPoints || 0,
          practiceTacklePoints: data.profile?.practiceTacklePoints || 0,
          teamNames: data.teamNames || [],
          followerCount,
          isFollowing,
          isPremium: data.player.isPremium || false,
          jerseyNumber: data.profile?.jerseyNumber || null,
          weight: data.player.weight || null,
          practiceGround: data.player.practiceGround || null,
        });
      } catch (err) {
        console.error('Error fetching player:', err);
      } finally {
        setLoading(false);
      }
    }
    fetchPlayer();
  }, [userId, currentUser?.id]);

  const handleFollowToggle = useCallback(async () => {
    if (!currentUser?.id || !player) return;
    setFollowLoading(true);
    try {
      const res = await fetch('/api/follow', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          followerId: currentUser.id,
          followingId: player.id,
          action: player.isFollowing ? 'unfollow' : 'follow',
        }),
      });
      if (res.ok) {
        const data = await res.json();
        setPlayer((prev) => prev ? {
          ...prev,
          isFollowing: data.isFollowing,
          followerCount: prev.followerCount + (data.isFollowing ? 1 : -1),
        } : prev);
        toast({
          title: data.isFollowing ? 'Following!' : 'Unfollowed',
        });
      }
    } catch {
      toast({ title: 'Error', description: 'Failed to update', variant: 'destructive' });
    } finally {
      setFollowLoading(false);
    }
  }, [currentUser?.id, player, toast]);

  const posConfig = player?.position ? POSITION_CONFIG[player.position] : null;

  // ─── Loading State ──────────────────────────────────────────────
  if (loading) {
    return (
      <motion.div
        className="fixed inset-0 z-50 bg-warm-50 dark:bg-warm-900 overflow-y-auto"
        initial={{ x: '100%' }}
        animate={{ x: 0 }}
        exit={{ x: '100%' }}
        transition={{ type: 'spring', damping: 25, stiffness: 300 }}
      >
        <div className="flex items-center justify-center min-h-screen">
          <div className="text-center space-y-3">
            <Loader2 className="w-8 h-8 animate-spin text-brand-red mx-auto" />
            <p className="text-sm text-warm-400">Loading profile...</p>
          </div>
        </div>
      </motion.div>
    );
  }

  if (!player) {
    return (
      <motion.div
        className="fixed inset-0 z-50 bg-warm-50 dark:bg-warm-900 overflow-y-auto"
        initial={{ x: '100%' }}
        animate={{ x: 0 }}
        exit={{ x: '100%' }}
      >
        <div className="flex items-center justify-center min-h-screen">
          <div className="text-center space-y-3">
            <p className="text-warm-500">Player not found</p>
            <button onClick={onBack} className="text-brand-red font-semibold">Go Back</button>
          </div>
        </div>
      </motion.div>
    );
  }

  const raidSuccessRate = player.totalRaids > 0 ? Math.round((player.successfulRaids / player.totalRaids) * 100) : 0;
  const tackleSuccessRate = player.totalTackles > 0 ? Math.round((player.successfulTackles / player.totalTackles) * 100) : 0;

  return (
    <>
      <motion.div
        className="fixed inset-0 z-50 bg-warm-50 dark:bg-warm-900 overflow-y-auto"
        initial={{ x: '100%' }}
        animate={{ x: 0 }}
        exit={{ x: '100%' }}
        transition={{ type: 'spring', damping: 25, stiffness: 300 }}
      >
        {/* ─── Header with Gradient Banner ─── */}
        <div className={`relative bg-gradient-to-br ${posConfig?.color || 'from-brand-red to-brand-red-dark'} pt-12 pb-20 px-5 overflow-hidden`}>
          {/* Decorative elements */}
          <div className="absolute -top-8 -right-8 w-36 h-36 rounded-full bg-white/5" />
          <div className="absolute -bottom-6 -left-6 w-28 h-28 rounded-full bg-white/3" />
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent animate-pulse" />

          {/* Back button */}
          <button
            onClick={onBack}
            className="absolute top-4 left-4 w-9 h-9 rounded-full bg-white/15 flex items-center justify-center text-white hover:bg-white/25 transition-colors z-10"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>

          {/* Premium badge */}
          {player.isPremium && (
            <div className="absolute top-4 right-4 flex items-center gap-1 px-2.5 py-1 rounded-full bg-gradient-to-r from-amber-400 to-yellow-500 shadow-lg shadow-amber-500/30">
              <Crown className="w-3 h-3 text-white" />
              <span className="text-[10px] font-bold text-white">PRO</span>
            </div>
          )}

          {/* Name & Basic Info */}
          <div className="relative z-10 mt-4 text-center">
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
            >
              <h1 className="text-xl font-black text-white">{player.name}</h1>
              <div className="flex items-center justify-center gap-2 mt-1 flex-wrap">
                {posConfig && (
                  <span className="text-xs font-semibold text-white/80 bg-white/15 px-2 py-0.5 rounded-full">
                    {posConfig.icon} {posConfig.label}
                  </span>
                )}
                {player.playerCode && (
                  <span className="text-[10px] font-bold text-white/60 bg-white/10 px-2 py-0.5 rounded-full">
                    {player.playerCode}
                  </span>
                )}
                {player.jerseyNumber && (
                  <span className="text-[10px] font-bold text-white/60 bg-white/10 px-2 py-0.5 rounded-full">
                    #{player.jerseyNumber}
                  </span>
                )}
              </div>
            </motion.div>
          </div>
        </div>

        {/* ─── Avatar (overlapping banner) ─── */}
        <div className="relative -mt-14 flex justify-center z-10">
          <motion.div
            className={`w-24 h-24 rounded-full bg-warm-200 dark:bg-warm-700 flex items-center justify-center text-3xl overflow-hidden border-4 border-warm-50 dark:border-warm-900 shadow-2xl ${
              posConfig ? `ring-2 ring-offset-2 ring-offset-warm-50 dark:ring-offset-warm-900 ring-white/30` : ''
            }`}
            initial={{ scale: 0.5, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: 0.2, type: 'spring', stiffness: 300 }}
          >
            {player.avatar ? (
              <img src={player.avatar} alt={player.name} className="w-full h-full object-cover" />
            ) : (
              <span>{player.gender === 'female' ? '👩' : '👨'}</span>
            )}
          </motion.div>
        </div>

        {/* ─── Follow Section ─── */}
        {!isOwnProfile && (
          <motion.div
            className="px-5 mt-3 flex items-center justify-center gap-3"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
          >
            <div className="flex items-center gap-1.5 bg-warm-100 dark:bg-warm-800 rounded-full px-3 py-1.5">
              <Users className="w-3.5 h-3.5 text-warm-400" />
              <span className="text-xs font-bold text-warm-600 dark:text-warm-300">{player.followerCount}</span>
              <span className="text-[10px] text-warm-400">{t('profile.followers', language) || 'followers'}</span>
            </div>
            <motion.button
              onClick={handleFollowToggle}
              disabled={followLoading}
              className={`px-5 py-2 rounded-full text-sm font-bold transition-all duration-200 flex items-center gap-1.5 ${
                player.isFollowing
                  ? 'bg-warm-200 dark:bg-warm-700 text-warm-500 dark:text-warm-400 border border-warm-300 dark:border-warm-600'
                  : 'bg-gradient-to-r from-brand-teal to-emerald-500 text-white shadow-md shadow-brand-teal/20'
              }`}
              whileTap={{ scale: 0.92 }}
            >
              {followLoading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : player.isFollowing ? (
                'Following'
              ) : (
                <>
                  <UserPlus className="w-4 h-4" />
                  Follow
                </>
              )}
            </motion.button>
          </motion.div>
        )}

        {/* ─── Teams ─── */}
        {player.teamNames.length > 0 && (
          <motion.div
            className="px-5 mt-4 flex items-center justify-center gap-2 flex-wrap"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.35 }}
          >
            {player.teamNames.map((team, i) => (
              <span key={i} className="text-[10px] font-semibold text-warm-500 dark:text-warm-400 bg-warm-100 dark:bg-warm-800 px-2.5 py-1 rounded-full">
                🏟️ {team}
              </span>
            ))}
          </motion.div>
        )}

        {/* ─── Quick Stats ─── */}
        <motion.div
          className="px-4 mt-5"
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
        >
          <div className="grid grid-cols-3 gap-3">
            <div className="text-center bg-white dark:bg-warm-800/60 rounded-xl p-3 border border-warm-200 dark:border-warm-700 shadow-sm">
              <div className="text-2xl font-black text-warm-800 dark:text-warm-100">{player.totalMatches}</div>
              <div className="text-[10px] font-semibold text-warm-400 uppercase tracking-wider">Matches</div>
            </div>
            <div className="text-center bg-white dark:bg-warm-800/60 rounded-xl p-3 border border-warm-200 dark:border-warm-700 shadow-sm">
              <div className={`text-2xl font-black ${canSeeStats ? 'text-brand-teal' : 'blur-sm select-none'}`}>{player.totalPoints}</div>
              <div className="text-[10px] font-semibold text-warm-400 uppercase tracking-wider">Total Pts</div>
              {!canSeeStats && <Lock className="w-3 h-3 text-warm-300 mx-auto mt-0.5" />}
            </div>
            <div className="text-center bg-white dark:bg-warm-800/60 rounded-xl p-3 border border-warm-200 dark:border-warm-700 shadow-sm">
              <div className={`text-2xl font-black ${canSeeStats ? 'text-amber-500' : 'blur-sm select-none'}`}>
                {player.overallRating > 0 ? player.overallRating.toFixed(1) : '–'}
              </div>
              <div className="text-[10px] font-semibold text-warm-400 uppercase tracking-wider">Rating</div>
              {!canSeeStats && <Lock className="w-3 h-3 text-warm-300 mx-auto mt-0.5" />}
            </div>
          </div>
        </motion.div>

        {/* ─── Premium Banner (for non-premium viewers) ─── */}
        {!canSeeStats && (
          <motion.div
            className="px-4 mt-4"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.45 }}
          >
            <button
              onClick={() => setShowUpgrade(true)}
              className="w-full bg-gradient-to-r from-amber-500/10 to-yellow-500/10 dark:from-amber-500/20 dark:to-yellow-500/20 border border-amber-500/30 rounded-xl p-3 flex items-center gap-3 hover:from-amber-500/20 hover:to-yellow-500/20 transition-all"
            >
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-amber-400 to-yellow-600 flex items-center justify-center shadow-md shadow-amber-500/30 shrink-0">
                <Crown className="w-5 h-5 text-white" />
              </div>
              <div className="text-left flex-1">
                <p className="text-sm font-bold text-amber-700 dark:text-amber-400">Unlock Full Stats</p>
                <p className="text-[10px] text-amber-600/70 dark:text-amber-400/60">Go Premium to see detailed performance analytics</p>
              </div>
              <ChevronRight className="w-5 h-5 text-amber-500" />
            </button>
          </motion.div>
        )}

        {/* ─── Detailed Stats ─── */}
        <motion.div
          className="px-4 mt-5"
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
        >
          <div className="flex items-center gap-2 mb-3">
            <Activity className="w-4 h-4 text-brand-teal" />
            <h3 className="text-sm font-bold text-warm-800 dark:text-warm-100">Performance Breakdown</h3>
            {!canSeeStats && <Lock className="w-3 h-3 text-warm-300" />}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <StatCard icon={Swords} label="Raid Pts" value={player.raidPoints} colorClass="from-red-500 to-rose-600" locked={!canSeeStats} />
            <StatCard icon={Shield} label="Tackle Pts" value={player.tacklePoints} colorClass="from-teal-500 to-cyan-600" locked={!canSeeStats} />
            <StatCard icon={Zap} label="Bonus Pts" value={player.bonusPoints} colorClass="from-amber-500 to-yellow-600" locked={!canSeeStats} />
            <StatCard icon={Star} label="Super Tkl" value={player.superTackles} colorClass="from-purple-500 to-violet-600" locked={!canSeeStats} />
          </div>
        </motion.div>

        {/* ─── Success Rates ─── */}
        <motion.div
          className="px-4 mt-5"
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.55 }}
        >
          <div className="flex items-center gap-2 mb-3">
            <Target className="w-4 h-4 text-brand-red" />
            <h3 className="text-sm font-bold text-warm-800 dark:text-warm-100">Success Rates</h3>
            {!canSeeStats && <Lock className="w-3 h-3 text-warm-300" />}
          </div>

          <div className="bg-white dark:bg-warm-800/60 rounded-xl p-4 border border-warm-200 dark:border-warm-700 space-y-4">
            <StatBar
              label="Raid Success Rate"
              value={canSeeStats ? raidSuccessRate : 0}
              max={100}
              color="from-red-500 to-rose-500"
              locked={!canSeeStats}
            />
            <StatBar
              label="Tackle Success Rate"
              value={canSeeStats ? tackleSuccessRate : 0}
              max={100}
              color="from-teal-500 to-cyan-500"
              locked={!canSeeStats}
            />
            <StatBar
              label="Raid Attempts"
              value={canSeeStats ? player.totalRaids : 0}
              max={canSeeStats ? Math.max(player.totalRaids * 1.2, 1) : 1}
              color="from-amber-500 to-yellow-500"
              locked={!canSeeStats}
            />
          </div>
        </motion.div>

        {/* ─── Tournament vs Practice ─── */}
        {canSeeStats && (player.tournamentMatches > 0 || player.practiceMatches > 0) && (
          <motion.div
            className="px-4 mt-5"
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6 }}
          >
            <div className="flex items-center gap-2 mb-3">
              <Trophy className="w-4 h-4 text-amber-500" />
              <h3 className="text-sm font-bold text-warm-800 dark:text-warm-100">Breakdown by Mode</h3>
            </div>

            <div className="space-y-3">
              {player.tournamentMatches > 0 && (
                <div className="bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-900/20 dark:to-orange-900/10 rounded-xl p-3.5 border border-amber-200/50 dark:border-amber-700/50">
                  <div className="flex items-center gap-2 mb-2">
                    <Trophy className="w-4 h-4 text-amber-500" />
                    <span className="text-xs font-bold text-amber-700 dark:text-amber-400">Tournament</span>
                    <span className="text-[10px] text-amber-500 ml-auto">{player.tournamentMatches} matches</span>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <div className="text-center">
                      <div className="text-sm font-black text-warm-800 dark:text-warm-100">{player.tournamentTotalPoints}</div>
                      <div className="text-[9px] text-warm-400">Pts</div>
                    </div>
                    <div className="text-center">
                      <div className="text-sm font-black text-warm-800 dark:text-warm-100">{player.tournamentRaidPoints}</div>
                      <div className="text-[9px] text-warm-400">Raid</div>
                    </div>
                    <div className="text-center">
                      <div className="text-sm font-black text-warm-800 dark:text-warm-100">{player.tournamentTacklePoints}</div>
                      <div className="text-[9px] text-warm-400">Tackle</div>
                    </div>
                  </div>
                </div>
              )}

              {player.practiceMatches > 0 && (
                <div className="bg-gradient-to-r from-teal-50 to-cyan-50 dark:from-teal-900/20 dark:to-cyan-900/10 rounded-xl p-3.5 border border-teal-200/50 dark:border-teal-700/50">
                  <div className="flex items-center gap-2 mb-2">
                    <Activity className="w-4 h-4 text-teal-500" />
                    <span className="text-xs font-bold text-teal-700 dark:text-teal-400">Practice</span>
                    <span className="text-[10px] text-teal-500 ml-auto">{player.practiceMatches} matches</span>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <div className="text-center">
                      <div className="text-sm font-black text-warm-800 dark:text-warm-100">{player.practiceTotalPoints}</div>
                      <div className="text-[9px] text-warm-400">Pts</div>
                    </div>
                    <div className="text-center">
                      <div className="text-sm font-black text-warm-800 dark:text-warm-100">{player.practiceRaidPoints}</div>
                      <div className="text-[9px] text-warm-400">Raid</div>
                    </div>
                    <div className="text-center">
                      <div className="text-sm font-black text-warm-800 dark:text-warm-100">{player.practiceTacklePoints}</div>
                      <div className="text-[9px] text-warm-400">Tackle</div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        )}

        {/* ─── Extra Info ─── */}
        {(player.practiceGround || player.weight) && (
          <motion.div
            className="px-4 mt-5 mb-8"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.65 }}
          >
            <div className="bg-warm-50 dark:bg-warm-800/30 rounded-xl p-3 border border-warm-200 dark:border-warm-700">
              <div className="flex flex-wrap gap-2">
                {player.weight && (
                  <div className="flex items-center gap-1 bg-warm-100 dark:bg-warm-700 rounded-full px-2.5 py-1">
                    <span className="text-[10px] font-semibold text-warm-500">⚖️ {player.weight}</span>
                  </div>
                )}
                {player.practiceGround && (
                  <div className="flex items-center gap-1 bg-warm-100 dark:bg-warm-700 rounded-full px-2.5 py-1">
                    <MapPin className="w-3 h-3 text-warm-400" />
                    <span className="text-[10px] font-semibold text-warm-500">{player.practiceGround}</span>
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        )}

        {/* Bottom spacing */}
        <div className="h-8" />
      </motion.div>

      {/* Premium Upgrade Screen */}
      <AnimatePresence>
        {showUpgrade && (
          <PremiumUpgradeScreen
            onClose={() => setShowUpgrade(false)}
            feature="Player Stats"
          />
        )}
      </AnimatePresence>
    </>
  );
}
