'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowLeft,
  RefreshCw,
  Trophy,
  Award,
  Flag,
  Milestone,
  UserPlus,
  UserCheck,
  Swords,
  Users,
  Rss,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useKabaddiStore } from '@/lib/store';
import { useToast } from '@/hooks/use-toast';

// ─── Types ────────────────────────────────────────────────────────

interface SocialFeedScreenProps {
  onClose: () => void;
}

interface Activity {
  id: string;
  userId: string;
  userName: string | null;
  userAvatar: string | null;
  userGender: string | null;
  type: string;
  title: string | null;
  description: string | null;
  matchId: string | null;
  tournamentId: string | null;
  metadata: string | null;
  createdAt: string;
}

interface SuggestedPlayer {
  id: string;
  name: string | null;
  avatar: string | null;
  phone: string;
  gender: string | null;
  isFollowing?: boolean;
}

// ─── Helpers ──────────────────────────────────────────────────────

function getInitial(name: string | null | undefined): string {
  if (!name) return '?';
  return name.trim().charAt(0).toUpperCase();
}

function getDisplayName(name: string | null | undefined): string {
  return name?.trim() || 'Unnamed Player';
}

function formatTimeAgo(dateStr: string): string {
  try {
    const diff = Date.now() - new Date(dateStr).getTime();
    const seconds = Math.floor(diff / 1000);
    if (seconds < 60) return 'just now';
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    if (days === 1) return 'Yesterday';
    if (days < 7) return `${days}d ago`;
    if (days < 30) return `${Math.floor(days / 7)}w ago`;
    const months = Math.floor(days / 30);
    return `${months}mo ago`;
  } catch {
    return '';
  }
}

function parseMetadata(metadata: string | null): Record<string, unknown> | null {
  if (!metadata) return null;
  try {
    return JSON.parse(metadata);
  } catch {
    return null;
  }
}

// ─── Activity Type Config ─────────────────────────────────────────

type ActivityType = 'match_completed' | 'tournament_joined' | 'achievement_unlocked' | 'player_milestone';

interface ActivityTypeConfig {
  icon: typeof Trophy;
  color: string;
  bgColor: string;
  borderColor: string;
  badgeBg: string;
  badgeText: string;
  label: string;
}

const ACTIVITY_CONFIG: Record<ActivityType, ActivityTypeConfig> = {
  match_completed: {
    icon: Trophy,
    color: 'text-brand-red',
    bgColor: 'bg-brand-red/5',
    borderColor: 'border-brand-red/20',
    badgeBg: 'bg-brand-red/15',
    badgeText: 'text-brand-red',
    label: 'Match',
  },
  achievement_unlocked: {
    icon: Award,
    color: 'text-brand-gold',
    bgColor: 'bg-brand-gold/5',
    borderColor: 'border-brand-gold/20',
    badgeBg: 'bg-brand-gold/15',
    badgeText: 'text-brand-gold-dark',
    label: 'Achievement',
  },
  tournament_joined: {
    icon: Flag,
    color: 'text-brand-teal',
    bgColor: 'bg-brand-teal/5',
    borderColor: 'border-brand-teal/20',
    badgeBg: 'bg-brand-teal/15',
    badgeText: 'text-brand-teal-dark',
    label: 'Tournament',
  },
  player_milestone: {
    icon: Milestone,
    color: 'text-brand-navy',
    bgColor: 'bg-brand-navy/5',
    borderColor: 'border-brand-navy/20',
    badgeBg: 'bg-brand-navy/15',
    badgeText: 'text-brand-navy',
    label: 'Milestone',
  },
};

function getActivityConfig(type: string): ActivityTypeConfig {
  return ACTIVITY_CONFIG[type as ActivityType] ?? {
    icon: Rss,
    color: 'text-warm-500',
    bgColor: 'bg-warm-100',
    borderColor: 'border-warm-300',
    badgeBg: 'bg-warm-200',
    badgeText: 'text-warm-600',
    label: 'Activity',
  };
}

// ─── Avatar Component ─────────────────────────────────────────────

function PlayerAvatar({
  name,
  avatar,
  gender,
  size = 'md',
}: {
  name: string | null;
  avatar: string | null;
  gender?: string | null;
  size?: 'sm' | 'md';
}) {
  const sizeClasses = size === 'sm' ? 'w-9 h-9 text-xs' : 'w-11 h-11 text-sm';

  return (
    <div className="relative shrink-0">
      <div
        className={`${sizeClasses} rounded-full bg-gradient-to-br from-brand-navy to-brand-navy-light flex items-center justify-center overflow-hidden ring-2 ring-warm-100`}
      >
        {avatar ? (
          <img
            src={avatar}
            alt={getDisplayName(name)}
            className="w-full h-full object-cover"
          />
        ) : (
          <span className="font-bold text-white">{getInitial(name)}</span>
        )}
      </div>
      {gender && (
        <span
          className={`absolute -bottom-0.5 -right-0.5 text-[10px] font-bold ${
            gender === 'male' ? 'text-brand-blue' : 'text-brand-red'
          }`}
        >
          {gender === 'male' ? '♂' : '♀'}
        </span>
      )}
    </div>
  );
}

// ─── Activity-Specific Content ────────────────────────────────────

function ActivityCardContent({ activity }: { activity: Activity }) {
  const config = getActivityConfig(activity.type);
  const meta = parseMetadata(activity.metadata);

  switch (activity.type) {
    case 'match_completed': {
      const homeTeam = (meta?.homeTeam as string) || 'Team A';
      const awayTeam = (meta?.awayTeam as string) || 'Team B';
      const homeScore = (meta?.homeScore as number) ?? 0;
      const awayScore = (meta?.awayScore as number) ?? 0;
      const winner = (meta?.winner as string) || null;

      return (
        <div className="mt-2.5 p-3 rounded-lg bg-white/60 border border-warm-200/60">
          <div className="flex items-center justify-between gap-3">
            <div className={`flex-1 text-center ${winner === 'home' ? 'font-bold text-brand-red' : 'text-warm-600'}`}>
              <p className="text-xs truncate">{homeTeam}</p>
              <p className="text-xl font-black">{homeScore}</p>
            </div>
            <div className="flex flex-col items-center gap-0.5">
              <Swords className="w-4 h-4 text-warm-400" />
              <span className="text-[9px] text-warm-400 font-semibold uppercase">vs</span>
            </div>
            <div className={`flex-1 text-center ${winner === 'away' ? 'font-bold text-brand-red' : 'text-warm-600'}`}>
              <p className="text-xs truncate">{awayTeam}</p>
              <p className="text-xl font-black">{awayScore}</p>
            </div>
          </div>
        </div>
      );
    }

    case 'tournament_joined': {
      const tournamentName = (meta?.tournamentName as string) || activity.title || 'Tournament';
      const teamCount = (meta?.teamCount as number) ?? null;

      return (
        <div className="mt-2.5 p-3 rounded-lg bg-white/60 border border-warm-200/60 flex items-center gap-2.5">
          <div className={`w-9 h-9 rounded-lg ${config.badgeBg} flex items-center justify-center shrink-0`}>
            <Flag className={`w-4 h-4 ${config.color}`} />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-warm-800 truncate">{tournamentName}</p>
            {teamCount && (
              <p className="text-[11px] text-warm-400">{teamCount} teams participating</p>
            )}
          </div>
        </div>
      );
    }

    case 'achievement_unlocked': {
      const achievementName = (meta?.achievementName as string) || activity.title || 'Achievement';
      const achievementIcon = (meta?.achievementIcon as string) || '🏆';

      return (
        <div className="mt-2.5 p-3 rounded-lg bg-white/60 border border-warm-200/60 flex items-center gap-2.5">
          <div className={`w-9 h-9 rounded-lg ${config.badgeBg} flex items-center justify-center shrink-0 text-lg`}>
            {achievementIcon}
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-warm-800 truncate">{achievementName}</p>
            <p className="text-[11px] text-warm-400">New achievement unlocked!</p>
          </div>
        </div>
      );
    }

    case 'player_milestone': {
      const milestoneType = (meta?.milestoneType as string) || activity.title || 'Milestone';
      const milestoneValue = (meta?.milestoneValue as string | number) ?? null;

      return (
        <div className="mt-2.5 p-3 rounded-lg bg-white/60 border border-warm-200/60 flex items-center gap-2.5">
          <div className={`w-9 h-9 rounded-lg ${config.badgeBg} flex items-center justify-center shrink-0`}>
            <Milestone className={`w-4 h-4 ${config.color}`} />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-warm-800 truncate">{milestoneType}</p>
            {milestoneValue && (
              <p className="text-[11px] text-warm-400">Reached {String(milestoneValue)}</p>
            )}
          </div>
        </div>
      );
    }

    default:
      return activity.description ? (
        <p className="mt-1.5 text-xs text-warm-500 leading-relaxed">{activity.description}</p>
      ) : null;
  }
}

// ─── Skeleton Loaders ─────────────────────────────────────────────

function ActivitySkeleton() {
  return (
    <div className="rounded-xl bg-warm-100 border border-warm-300 p-4 animate-pulse">
      <div className="flex items-center gap-3">
        <div className="w-11 h-11 rounded-full bg-warm-200 shrink-0" />
        <div className="flex-1 space-y-2">
          <div className="h-3.5 w-32 rounded-full bg-warm-200" />
          <div className="h-2.5 w-48 rounded-full bg-warm-200" />
        </div>
        <div className="w-8 h-8 rounded-full bg-warm-200 shrink-0" />
      </div>
      <div className="mt-3 h-16 rounded-lg bg-warm-200" />
    </div>
  );
}

function SuggestedPlayerSkeleton() {
  return (
    <div className="flex items-center gap-3 py-2 animate-pulse">
      <div className="w-10 h-10 rounded-full bg-warm-200 shrink-0" />
      <div className="flex-1 space-y-2">
        <div className="h-3 w-24 rounded-full bg-warm-200" />
        <div className="h-2 w-16 rounded-full bg-warm-200" />
      </div>
      <div className="w-16 h-7 rounded-full bg-warm-200 shrink-0" />
    </div>
  );
}

// ─── Follow Button (compact for suggestions) ──────────────────────

function SuggestionFollowButton({
  isFollowing,
  onToggle,
  loading,
}: {
  isFollowing: boolean;
  onToggle: () => void;
  loading: boolean;
}) {
  return (
    <button
      onClick={onToggle}
      disabled={loading}
      className={`h-7 px-3 rounded-full text-[11px] font-bold transition-all duration-200 flex items-center gap-1 shrink-0 ${
        isFollowing
          ? 'bg-warm-200 text-warm-600 hover:bg-red-100 hover:text-brand-red'
          : 'bg-brand-teal text-white hover:bg-brand-teal-dark shadow-sm'
      } ${loading ? 'opacity-60 cursor-not-allowed' : 'active:scale-95'}`}
    >
      {loading ? (
        <motion.div
          className="w-3 h-3 border-2 border-current border-t-transparent rounded-full"
          animate={{ rotate: 360 }}
          transition={{ duration: 0.6, repeat: Infinity, ease: 'linear' }}
        />
      ) : isFollowing ? (
        <>
          <UserCheck className="w-3 h-3" />
          <span>Following</span>
        </>
      ) : (
        <>
          <UserPlus className="w-3 h-3" />
          <span>Follow</span>
        </>
      )}
    </button>
  );
}

// ─── Main Component ───────────────────────────────────────────────

export default function SocialFeedScreen({ onClose }: SocialFeedScreenProps) {
  const currentUser = useKabaddiStore((s) => s.currentUser);
  const { toast } = useToast();

  // Activity feed state
  const [activities, setActivities] = useState<Activity[]>([]);
  const [feedLoading, setFeedLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(true);

  // Suggested players state
  const [suggestedPlayers, setSuggestedPlayers] = useState<SuggestedPlayer[]>([]);
  const [suggestedLoading, setSuggestedLoading] = useState(false);
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);

  // ─── Fetch Activities ───────────────────────────────────────

  const fetchActivities = useCallback(
    async (isRefresh = false) => {
      if (!currentUser) return;

      if (isRefresh) {
        setRefreshing(true);
      } else {
        setFeedLoading(true);
      }

      try {
        const params = new URLSearchParams({
          userId: currentUser.id,
          limit: '20',
          offset: isRefresh ? '0' : String(offset),
        });
        const res = await fetch(`/api/activities?${params}`);
        if (!res.ok) throw new Error('Failed to fetch');
        const data = await res.json();
        const newActivities: Activity[] = data.activities || [];

        if (isRefresh) {
          setActivities(newActivities);
          setOffset(0);
        } else {
          setActivities((prev) => [...prev, ...newActivities]);
        }
        setHasMore(newActivities.length === 20);
      } catch (err) {
        console.error('Activities fetch error:', err);
        if (isRefresh) setActivities([]);
      } finally {
        setFeedLoading(false);
        setRefreshing(false);
      }
    },
    [currentUser, offset]
  );

  // ─── Fetch Suggested Players ────────────────────────────────

  const fetchSuggestedPlayers = useCallback(async () => {
    if (!currentUser) return;
    setSuggestedLoading(true);
    try {
      const params = new URLSearchParams({
        userId: currentUser.id,
        type: 'search',
      });
      const res = await fetch(`/api/follow?${params}`);
      if (!res.ok) throw new Error('Failed to fetch');
      const data = await res.json();
      const players: SuggestedPlayer[] = (data.players || [])
        .filter((p: SuggestedPlayer) => !p.isFollowing && p.id !== currentUser.id)
        .slice(0, 5);
      setSuggestedPlayers(players);
    } catch (err) {
      console.error('Suggested players fetch error:', err);
      setSuggestedPlayers([]);
    } finally {
      setSuggestedLoading(false);
    }
  }, [currentUser]);

  // ─── Follow / Unfollow action ───────────────────────────────

  const handleFollowAction = async (
    targetId: string,
    isCurrentlyFollowing: boolean
  ) => {
    if (!currentUser || actionLoadingId) return;
    setActionLoadingId(targetId);
    try {
      const res = await fetch('/api/follow', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          followerId: currentUser.id,
          followingId: targetId,
          action: isCurrentlyFollowing ? 'unfollow' : 'follow',
        }),
      });
      if (!res.ok) throw new Error('Action failed');

      const nowFollowing = !isCurrentlyFollowing;

      // Update suggested players
      setSuggestedPlayers((prev) =>
        prev.map((p) =>
          p.id === targetId ? { ...p, isFollowing: nowFollowing } : p
        )
      );

      toast({
        title: nowFollowing ? 'Following!' : 'Unfollowed',
        description: nowFollowing
          ? 'You are now following this player'
          : 'You unfollowed this player',
      });

      // Refresh feed to show new followed user's activities
      if (nowFollowing) {
        fetchActivities(true);
      }
    } catch (err) {
      console.error('Follow action error:', err);
      toast({
        title: 'Error',
        description: 'Something went wrong. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setActionLoadingId(null);
    }
  };

  // ─── Load more ──────────────────────────────────────────────

  const loadMore = useCallback(() => {
    if (!hasMore || feedLoading) return;
    setOffset((prev) => prev + 20);
  }, [hasMore, feedLoading]);

  // ─── Effects ────────────────────────────────────────────────

  useEffect(() => {
    fetchActivities();
  }, [fetchActivities]);

  // Refetch when offset changes (load more)
  useEffect(() => {
    if (offset > 0) {
      fetchActivities();
    }
  }, [offset]);

  useEffect(() => {
    fetchSuggestedPlayers();
  }, [fetchSuggestedPlayers]);

  // ─── Derived ────────────────────────────────────────────────

  const feedIsEmpty = !feedLoading && activities.length === 0;

  // ─── Render ─────────────────────────────────────────────────

  return (
    <motion.div
      initial={{ y: '100%' }}
      animate={{ y: 0 }}
      exit={{ y: '100%' }}
      transition={{ type: 'spring', damping: 28, stiffness: 300 }}
      className="fixed inset-0 z-50 bg-warm-50 flex flex-col"
    >
      {/* ═══ Header ═══ */}
      <header className="sticky top-0 z-10 bg-warm-50/90 backdrop-blur-md border-b border-warm-200/60">
        <div className="px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-full bg-warm-200 flex items-center justify-center text-warm-600 hover:bg-warm-300 transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-brand-teal to-brand-teal-dark flex items-center justify-center">
                <Rss className="w-4 h-4 text-white" />
              </div>
              <h1 className="text-base font-black tracking-wider text-warm-800">
                SOCIAL FEED
              </h1>
            </div>
          </div>
          <button
            onClick={() => fetchActivities(true)}
            disabled={refreshing}
            className="w-8 h-8 rounded-full bg-warm-100 flex items-center justify-center text-warm-500 hover:bg-warm-200 hover:text-warm-700 transition-colors disabled:opacity-50"
            aria-label="Refresh feed"
          >
            <RefreshCw
              className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`}
            />
          </button>
        </div>
      </header>

      {/* ═══ Content ═══ */}
      <div className="flex-1 overflow-y-auto custom-scrollbar">
        <AnimatePresence mode="wait">
          {feedLoading ? (
            <motion.div
              key="loading"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="px-4 py-3 flex flex-col gap-3"
            >
              {[1, 2, 3, 4, 5].map((i) => (
                <ActivitySkeleton key={i} />
              ))}
            </motion.div>
          ) : feedIsEmpty ? (
            <motion.div
              key="empty"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="px-4 py-6"
            >
              {/* Empty State */}
              <div className="flex flex-col items-center justify-center py-10">
                <div className="w-16 h-16 rounded-full bg-warm-100 flex items-center justify-center mb-4">
                  <Rss className="w-8 h-8 text-warm-300" />
                </div>
                <p className="text-warm-700 font-bold text-sm">
                  No activity yet
                </p>
                <p className="text-warm-400 text-xs mt-1 text-center max-w-[260px]">
                  Follow players to see their updates!
                </p>
              </div>

              {/* Suggested Players Section */}
              <div className="mt-4">
                <div className="flex items-center gap-2 mb-3">
                  <Users className="w-4 h-4 text-brand-teal" />
                  <h2 className="text-sm font-bold text-warm-800">
                    Suggested Players
                  </h2>
                </div>

                {suggestedLoading ? (
                  <div className="space-y-1">
                    {[1, 2, 3, 4, 5].map((i) => (
                      <SuggestedPlayerSkeleton key={i} />
                    ))}
                  </div>
                ) : suggestedPlayers.length > 0 ? (
                  <Card className="bg-warm-100 border-warm-300 py-0 gap-0 overflow-hidden">
                    <CardContent className="p-0 divide-y divide-warm-200/60">
                      {suggestedPlayers.map((player, index) => (
                        <motion.div
                          key={player.id}
                          initial={{ opacity: 0, x: -8 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: index * 0.05 }}
                          className="flex items-center gap-3 px-4 py-3 hover:bg-warm-50/50 transition-colors"
                        >
                          <PlayerAvatar
                            name={player.name}
                            avatar={player.avatar}
                            gender={player.gender}
                            size="sm"
                          />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1.5">
                              <p className="font-semibold text-sm text-warm-800 truncate">
                                {getDisplayName(player.name)}
                              </p>
                              {player.gender && (
                                <span
                                  className={`text-[11px] font-semibold ${
                                    player.gender === 'male'
                                      ? 'text-brand-blue'
                                      : 'text-brand-red'
                                  }`}
                                >
                                  {player.gender === 'male' ? '♂' : '♀'}
                                </span>
                              )}
                            </div>
                            <p className="text-[11px] text-warm-400 truncate">
                              {player.phone}
                            </p>
                          </div>
                          <SuggestionFollowButton
                            isFollowing={!!player.isFollowing}
                            onToggle={() =>
                              handleFollowAction(
                                player.id,
                                !!player.isFollowing
                              )
                            }
                            loading={actionLoadingId === player.id}
                          />
                        </motion.div>
                      ))}
                    </CardContent>
                  </Card>
                ) : (
                  <div className="flex flex-col items-center py-8">
                    <Users className="w-8 h-8 text-warm-300 mb-2" />
                    <p className="text-warm-400 text-xs text-center">
                      No suggestions available right now
                    </p>
                  </div>
                )}
              </div>
            </motion.div>
          ) : (
            <motion.div
              key="feed"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="px-4 py-3"
            >
              {/* Activity Cards */}
              <div className="flex flex-col gap-3">
                {activities.map((activity, index) => {
                  const config = getActivityConfig(activity.type);
                  const Icon = config.icon;
                  const isOwnActivity = activity.userId === currentUser?.id;

                  return (
                    <motion.div
                      key={activity.id}
                      initial={{ opacity: 0, y: 16, scale: 0.97 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      transition={{
                        delay: Math.min(index * 0.04, 0.4),
                        type: 'spring',
                        damping: 20,
                        stiffness: 200,
                      }}
                    >
                      <Card
                        className={`${config.bgColor} ${config.borderColor} border rounded-xl py-0 gap-0 overflow-hidden`}
                      >
                        <CardContent className="p-4">
                          {/* Top row: avatar, name, timestamp, type icon */}
                          <div className="flex items-start gap-3">
                            <PlayerAvatar
                              name={activity.userName}
                              avatar={activity.userAvatar}
                              gender={activity.userGender}
                              size="sm"
                            />

                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <p className="font-bold text-sm text-warm-800 truncate">
                                  {getDisplayName(activity.userName)}
                                </p>
                                {isOwnActivity && (
                                  <Badge className="bg-brand-teal/15 text-brand-teal-dark text-[9px] font-semibold border-0 px-1.5 py-0 h-4">
                                    You
                                  </Badge>
                                )}
                              </div>
                              {/* Activity description line */}
                              <p className="text-xs text-warm-500 mt-0.5 leading-relaxed">
                                {activity.description || activity.title}
                              </p>
                              <p className="text-[10px] text-warm-400 mt-1">
                                {formatTimeAgo(activity.createdAt)}
                              </p>
                            </div>

                            {/* Activity type icon */}
                            <div
                              className={`w-9 h-9 rounded-lg ${config.badgeBg} flex items-center justify-center shrink-0`}
                            >
                              <Icon className={`w-4 h-4 ${config.color}`} />
                            </div>
                          </div>

                          {/* Activity-specific content */}
                          <ActivityCardContent activity={activity} />

                          {/* Activity type badge at bottom */}
                          <div className="mt-2.5 flex items-center gap-1.5">
                            <Badge
                              className={`${config.badgeBg} ${config.badgeText} text-[9px] font-semibold border-0 px-2 py-0 h-5`}
                            >
                              <Icon className="w-2.5 h-2.5" />
                              {config.label}
                            </Badge>
                          </div>
                        </CardContent>
                      </Card>
                    </motion.div>
                  );
                })}
              </div>

              {/* Load More */}
              {hasMore && (
                <div className="mt-4 flex justify-center">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={loadMore}
                    disabled={feedLoading}
                    className="rounded-full border-warm-300 text-warm-600 hover:bg-warm-100 text-xs font-semibold"
                  >
                    Load More
                  </Button>
                </div>
              )}

              {/* Suggested Players at bottom of feed */}
              {suggestedPlayers.length > 0 && (
                <div className="mt-6 mb-4">
                  <div className="flex items-center gap-2 mb-3">
                    <Users className="w-4 h-4 text-brand-teal" />
                    <h2 className="text-sm font-bold text-warm-800">
                      Suggested Players
                    </h2>
                  </div>

                  <Card className="bg-warm-100 border-warm-300 py-0 gap-0 overflow-hidden">
                    <CardContent className="p-0 divide-y divide-warm-200/60">
                      {suggestedPlayers.slice(0, 3).map((player, index) => (
                        <motion.div
                          key={player.id}
                          initial={{ opacity: 0, x: -8 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: 0.2 + index * 0.05 }}
                          className="flex items-center gap-3 px-4 py-2.5 hover:bg-warm-50/50 transition-colors"
                        >
                          <PlayerAvatar
                            name={player.name}
                            avatar={player.avatar}
                            gender={player.gender}
                            size="sm"
                          />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1.5">
                              <p className="font-semibold text-xs text-warm-800 truncate">
                                {getDisplayName(player.name)}
                              </p>
                              {player.gender && (
                                <span
                                  className={`text-[10px] font-semibold ${
                                    player.gender === 'male'
                                      ? 'text-brand-blue'
                                      : 'text-brand-red'
                                  }`}
                                >
                                  {player.gender === 'male' ? '♂' : '♀'}
                                </span>
                              )}
                            </div>
                          </div>
                          <SuggestionFollowButton
                            isFollowing={!!player.isFollowing}
                            onToggle={() =>
                              handleFollowAction(
                                player.id,
                                !!player.isFollowing
                              )
                            }
                            loading={actionLoadingId === player.id}
                          />
                        </motion.div>
                      ))}
                    </CardContent>
                  </Card>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}
