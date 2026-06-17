'use client';

import { useEffect, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Trophy, Users, Star, MapPin, ChevronRight, Flame, Crown, Zap, Loader2 } from 'lucide-react';
import { useKabaddiStore, type Language } from '@/lib/store';
import { t } from '@/lib/i18n';
import { useToast } from '@/hooks/use-toast';
import { mockPopularPlayers } from '@/lib/mockData';

interface PopularPlayer {
  rank: number;
  userId: string;
  name: string;
  avatar: string | null;
  playerCode: string | null;
  gender: string | null;
  position: string | null;
  overallRating: number;
  totalPoints: number;
  totalMatches: number;
  raidPoints: number;
  tacklePoints: number;
  followerCount: number;
  teamNames: string[];
  isFollowing: boolean;
}

// ─── Position Badge ──────────────────────────────────────────────
function PositionBadge({ position }: { position: string | null }) {
  if (!position) return null;
  const isRaider = position.includes('raider') || position.includes('both');
  const isDefender = position.includes('corner') || position.includes('cover');
  const isAllRounder = position === 'all-rounder';

  const label = isAllRounder
    ? 'AR'
    : isRaider
      ? 'R'
      : isDefender
        ? 'D'
        : 'P';

  const colorClass = isAllRounder
    ? 'bg-amber-500/20 text-amber-600 dark:text-amber-400 border-amber-500/30'
    : isRaider
      ? 'bg-red-500/20 text-red-600 dark:text-red-400 border-red-500/30'
      : isDefender
        ? 'bg-teal-500/20 text-teal-600 dark:text-teal-400 border-teal-500/30'
        : 'bg-warm-500/20 text-warm-600 dark:text-warm-400 border-warm-500/30';

  return (
    <span className={`text-[8px] font-bold px-1.5 py-0.5 rounded-full border ${colorClass}`}>
      {label}
    </span>
  );
}

// ─── Rank Badge ──────────────────────────────────────────────────
function RankBadge({ rank }: { rank: number }) {
  if (rank === 1) {
    return (
      <motion.div
        className="w-7 h-7 rounded-full bg-gradient-to-br from-yellow-400 to-amber-600 flex items-center justify-center shadow-lg shadow-amber-500/30"
        animate={{ scale: [1, 1.1, 1] }}
        transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
      >
        <Crown className="w-3.5 h-3.5 text-white" />
      </motion.div>
    );
  }
  if (rank === 2) {
    return (
      <div className="w-6 h-6 rounded-full bg-gradient-to-br from-gray-300 to-gray-500 flex items-center justify-center shadow-md">
        <span className="text-[9px] font-black text-white">2</span>
      </div>
    );
  }
  if (rank === 3) {
    return (
      <div className="w-6 h-6 rounded-full bg-gradient-to-br from-amber-600 to-amber-800 flex items-center justify-center shadow-md">
        <span className="text-[9px] font-black text-white">3</span>
      </div>
    );
  }
  return (
    <div className="w-6 h-6 rounded-full bg-warm-200 dark:bg-warm-700 flex items-center justify-center">
      <span className="text-[9px] font-bold text-warm-500 dark:text-warm-400">{rank}</span>
    </div>
  );
}

// ─── Follow Button ───────────────────────────────────────────────
function FollowButton({
  isFollowing,
  onToggle,
  loading,
}: {
  isFollowing: boolean;
  onToggle: () => void;
  loading: boolean;
}) {
  return (
    <motion.button
      onClick={(e) => {
        e.stopPropagation();
        onToggle();
      }}
      disabled={loading}
      className={`px-3 py-1.5 rounded-full text-[10px] font-bold transition-all duration-200 flex items-center gap-1 ${
        isFollowing
          ? 'bg-warm-200 dark:bg-warm-700 text-warm-500 dark:text-warm-400 border border-warm-300 dark:border-warm-600 hover:bg-red-50 hover:text-red-500 hover:border-red-300 dark:hover:bg-red-900/20 dark:hover:text-red-400 dark:hover:border-red-800'
          : 'bg-gradient-to-r from-brand-teal to-emerald-500 text-white shadow-sm shadow-brand-teal/20 hover:shadow-md hover:shadow-brand-teal/30'
      }`}
      whileTap={{ scale: 0.92 }}
    >
      {loading ? (
        <Loader2 className="w-3 h-3 animate-spin" />
      ) : isFollowing ? (
        'Following'
      ) : (
        <>
          <Users className="w-3 h-3" />
          Follow
        </>
      )}
    </motion.button>
  );
}

// ─── Main Component ──────────────────────────────────────────────
export default function PopularPlayersSection({ onViewProfile }: { onViewProfile?: (userId: string) => void }) {
  const { currentUser } = useKabaddiStore();
  const language = useKabaddiStore((s) => s.language) as Language;
  const { toast } = useToast();
  const [players, setPlayers] = useState<PopularPlayer[]>([]);
  const [loading, setLoading] = useState(true);
  const [followLoading, setFollowLoading] = useState<string | null>(null);

  useEffect(() => {
    async function fetchPlayers() {
      try {
        const userId = currentUser?.id || '';
        const res = await fetch(`/api/popular-players?limit=10&userId=${userId}`);
        // 404 = endpoint not mounted. 502 = Vite dev proxy can't reach api-server.
        // 503 = service unavailable. All mean "no backend" → use mock players.
        if (res.status === 404 || res.status === 502 || res.status === 503) {
          setPlayers(mockPopularPlayers(10).players as unknown as PopularPlayer[]);
          return;
        }
        if (res.ok) {
          const data = await res.json();
          setPlayers(data.players || []);
        }
      } catch (err) {
        console.error('Error fetching popular players:', err);
        // Last-resort fallback: still show mock data
        setPlayers(mockPopularPlayers(10).players as unknown as PopularPlayer[]);
      } finally {
        setLoading(false);
      }
    }
    fetchPlayers();
  }, [currentUser?.id]);

  const handleFollowToggle = useCallback(
    async (playerId: string, currentlyFollowing: boolean) => {
      if (!currentUser?.id) {
        toast({ title: 'Login required', description: 'Please login to follow players', variant: 'destructive' });
        return;
      }
      setFollowLoading(playerId);
      try {
        const res = await fetch('/api/follow', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            followerId: currentUser.id,
            followingId: playerId,
            action: currentlyFollowing ? 'unfollow' : 'follow',
          }),
        });

        if (res.ok) {
          const data = await res.json();
          setPlayers((prev) =>
            prev.map((p) =>
              p.userId === playerId
                ? {
                    ...p,
                    isFollowing: data.isFollowing,
                    followerCount: p.followerCount + (data.isFollowing ? 1 : -1),
                  }
                : p
            )
          );
          toast({
            title: data.isFollowing ? 'Following!' : 'Unfollowed',
            description: data.isFollowing
              ? 'You\'ll see their updates in your feed'
              : 'Removed from your following list',
          });
        }
      } catch {
        toast({ title: 'Error', description: 'Failed to update follow status', variant: 'destructive' });
      } finally {
        setFollowLoading(null);
      }
    },
    [currentUser?.id, toast]
  );

  // ─── Loading Skeleton ────────────────────────────────────────────
  if (loading) {
    return (
      <section className="px-4 mt-6">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className="h-5 w-32 bg-warm-200 dark:bg-warm-700 rounded animate-pulse" />
          </div>
        </div>
        <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide">
          {Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className="flex-shrink-0 w-[160px] bg-warm-100 dark:bg-warm-800/50 rounded-xl p-3 animate-pulse"
            >
              <div className="flex items-center gap-2 mb-2">
                <div className="w-10 h-10 bg-warm-200 dark:bg-warm-700 rounded-full" />
                <div className="space-y-1.5 flex-1">
                  <div className="h-3 w-16 bg-warm-200 dark:bg-warm-700 rounded" />
                  <div className="h-2 w-12 bg-warm-200 dark:bg-warm-700 rounded" />
                </div>
              </div>
              <div className="h-2 w-full bg-warm-200 dark:bg-warm-700 rounded mb-2" />
              <div className="h-6 w-16 bg-warm-200 dark:bg-warm-700 rounded-full" />
            </div>
          ))}
        </div>
      </section>
    );
  }

  if (players.length === 0) return null;

  return (
    <section className="px-4 mt-6">
      {/* Section Header */}
      <div className="flex items-center justify-between mb-3 section-header-decorated">
        <div className="flex items-center gap-2">
          <h3 className="text-base font-bold text-warm-800 dark:text-warm-100">
            {t('home.popularPlayers', language)}
          </h3>
          <Flame className="w-4 h-4 text-orange-500" />
        </div>
      </div>

      {/* Horizontal Scrollable Cards */}
      <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide -mx-4 px-4">
        <AnimatePresence mode="popLayout">
          {players.map((player, index) => (
            <motion.div
              key={player.userId}
              className="flex-shrink-0 w-[165px]"
              initial={{ opacity: 0, x: 30, scale: 0.95 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              transition={{ delay: index * 0.06, duration: 0.4, type: 'spring', damping: 20 }}
              layout
            >
              <div className={`relative rounded-xl p-3 border overflow-hidden transition-all duration-200 hover:shadow-lg group card-hover-lift cursor-pointer ${
                player.rank === 1
                  ? 'bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-900/20 dark:to-orange-900/10 border-amber-300/50 dark:border-amber-700/50'
                  : player.rank === 2
                    ? 'bg-gradient-to-br from-gray-50 to-slate-50 dark:from-gray-800/30 dark:to-slate-800/20 border-gray-300/50 dark:border-gray-600/50'
                    : player.rank === 3
                      ? 'bg-gradient-to-br from-orange-50 to-amber-50 dark:from-orange-900/10 dark:to-amber-900/10 border-orange-300/50 dark:border-orange-700/50'
                      : 'bg-warm-50 dark:bg-warm-800/50 border-warm-200 dark:border-warm-700'
              }`} onClick={() => onViewProfile?.(player.userId)}>
                {/* Rank indicator strip */}
                <div className={`absolute left-0 top-0 bottom-0 w-0.5 ${
                  player.rank === 1
                    ? 'bg-gradient-to-b from-yellow-400 to-amber-600'
                    : player.rank === 2
                      ? 'bg-gradient-to-b from-gray-300 to-gray-500'
                      : player.rank === 3
                        ? 'bg-gradient-to-b from-amber-600 to-amber-800'
                        : 'bg-gradient-to-b from-brand-teal to-brand-teal/40'
                }`} />

                {/* Top row: Rank + Follower count */}
                <div className="flex items-center justify-between mb-2">
                  <RankBadge rank={player.rank} />
                  <div className="flex items-center gap-1">
                    <Users className="w-3 h-3 text-warm-400" />
                    <span className="text-[9px] font-semibold text-warm-500 dark:text-warm-400">
                      {player.followerCount}
                    </span>
                  </div>
                </div>

                {/* Avatar + Name */}
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-10 h-10 rounded-full bg-warm-200 dark:bg-warm-700 flex items-center justify-center text-base overflow-hidden border-2 border-white dark:border-warm-600 shadow-sm shrink-0">
                    {player.avatar ? (
                      <img src={player.avatar} alt={player.name} className="w-full h-full object-cover" />
                    ) : (
                      <span>{player.gender === 'female' ? '👩' : '👨'}</span>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1">
                      <p className="text-xs font-bold text-warm-800 dark:text-warm-100 truncate">
                        {player.name}
                      </p>
                      <PositionBadge position={player.position} />
                    </div>
                    {player.teamNames.length > 0 && (
                      <p className="text-[9px] text-warm-400 dark:text-warm-500 truncate">
                        {player.teamNames[0]}
                      </p>
                    )}
                  </div>
                </div>

                {/* Score Stats */}
                <div className="flex items-center gap-2 mb-2.5">
                  <div className="flex items-center gap-1 bg-brand-teal/10 dark:bg-brand-teal/20 rounded-md px-1.5 py-0.5">
                    <Zap className="w-2.5 h-2.5 text-brand-teal" />
                    <span className="text-[9px] font-bold text-brand-teal">{player.totalPoints}</span>
                  </div>
                  <div className="flex items-center gap-1 bg-amber-500/10 dark:bg-amber-500/20 rounded-md px-1.5 py-0.5">
                    <Star className="w-2.5 h-2.5 text-amber-500" />
                    <span className="text-[9px] font-bold text-amber-600 dark:text-amber-400">
                      {player.overallRating > 0 ? player.overallRating.toFixed(1) : '–'}
                    </span>
                  </div>
                  <div className="flex items-center gap-1 bg-warm-200/60 dark:bg-warm-700/40 rounded-md px-1.5 py-0.5">
                    <Trophy className="w-2.5 h-2.5 text-warm-400" />
                    <span className="text-[9px] font-bold text-warm-500 dark:text-warm-400">{player.totalMatches}M</span>
                  </div>
                </div>

                {/* Follow Button */}
                <FollowButton
                  isFollowing={player.isFollowing}
                  onToggle={() => handleFollowToggle(player.userId, player.isFollowing)}
                  loading={followLoading === player.userId}
                />
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </section>
  );
}
