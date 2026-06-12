'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowLeft,
  Search,
  Users,
  UserPlus,
  UserCheck,
  UserX,
  Sparkles,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { useKabaddiStore } from '@/lib/store';
import { useToast } from '@/hooks/use-toast';

// ─── Types ────────────────────────────────────────────────────────

interface FollowScreenProps {
  onClose: () => void;
}

type TabId = 'search' | 'followers' | 'following';

interface PlayerResult {
  id: string;
  name: string | null;
  avatar: string | null;
  phone: string;
  gender: string | null;
  isFollowing?: boolean;
}

interface FollowerEntry {
  id: string;
  name: string | null;
  avatar: string | null;
  phone: string;
  gender: string | null;
  followedAt: string;
}

// ─── Helpers ──────────────────────────────────────────────────────

function getInitial(name: string | null | undefined): string {
  if (!name) return '?';
  return name.trim().charAt(0).toUpperCase();
}

function getDisplayName(name: string | null | undefined): string {
  return name?.trim() || 'Unnamed Player';
}

function timeAgo(dateStr: string): string {
  try {
    const diff = Date.now() - new Date(dateStr).getTime();
    const seconds = Math.floor(diff / 1000);
    if (seconds < 60) return 'just now';
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    if (days < 30) return `${days}d ago`;
    const months = Math.floor(days / 30);
    return `${months}mo ago`;
  } catch {
    return '';
  }
}

// ─── Avatar Component ─────────────────────────────────────────────

function PlayerAvatar({
  name,
  avatar,
  size = 'md',
}: {
  name: string | null;
  avatar: string | null;
  size?: 'sm' | 'md' | 'lg';
}) {
  const sizeClasses = {
    sm: 'w-9 h-9 text-xs',
    md: 'w-11 h-11 text-sm',
    lg: 'w-14 h-14 text-base',
  };

  return (
    <div
      className={`${sizeClasses[size]} rounded-full bg-gradient-to-br from-brand-navy to-brand-navy-light flex items-center justify-center overflow-hidden shrink-0 ring-2 ring-warm-100`}
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
  );
}

// ─── Gender Icon ──────────────────────────────────────────────────

function GenderIcon({ gender }: { gender: string | null }) {
  if (!gender) return null;
  if (gender === 'male') {
    return (
      <span className="text-brand-blue text-sm font-semibold" title="Male">
        ♂
      </span>
    );
  }
  if (gender === 'female') {
    return (
      <span className="text-brand-red text-sm font-semibold" title="Female">
        ♀
      </span>
    );
  }
  return null;
}

// ─── Follow Button ────────────────────────────────────────────────

function FollowButton({
  isFollowing,
  onToggle,
  loading,
  size = 'sm',
}: {
  isFollowing: boolean;
  onToggle: () => void;
  loading: boolean;
  size?: 'sm' | 'md';
}) {
  const sizeClasses = size === 'sm' ? 'h-7 px-3 text-[11px]' : 'h-9 px-4 text-xs';

  return (
    <button
      onClick={onToggle}
      disabled={loading}
      className={`${sizeClasses} rounded-full font-bold transition-all duration-200 flex items-center gap-1 shrink-0 ${
        isFollowing
          ? 'bg-warm-200 text-warm-600 hover:bg-red-100 hover:text-brand-red'
          : 'bg-brand-teal text-white hover:bg-brand-teal-dark shadow-sm'
      } ${loading ? 'opacity-60 cursor-not-allowed' : 'active:scale-95'}`}
    >
      {loading ? (
        <motion.div
          className="w-3.5 h-3.5 border-2 border-current border-t-transparent rounded-full"
          animate={{ rotate: 360 }}
          transition={{ duration: 0.6, repeat: Infinity, ease: 'linear' }}
        />
      ) : isFollowing ? (
        <>
          <UserCheck className="w-3.5 h-3.5" />
          <span>Following</span>
        </>
      ) : (
        <>
          <UserPlus className="w-3.5 h-3.5" />
          <span>Follow</span>
        </>
      )}
    </button>
  );
}

// ─── Skeleton Loader ──────────────────────────────────────────────

function PlayerSkeleton() {
  return (
    <div className="flex items-center gap-3 p-3">
      <div className="w-11 h-11 rounded-full bg-warm-200 animate-pulse shrink-0" />
      <div className="flex-1 min-w-0 space-y-2">
        <div className="h-3.5 w-28 rounded-full bg-warm-200 animate-pulse" />
        <div className="h-2.5 w-20 rounded-full bg-warm-100 animate-pulse" />
      </div>
      <div className="w-20 h-7 rounded-full bg-warm-200 animate-pulse shrink-0" />
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────

export default function FollowScreen({ onClose }: FollowScreenProps) {
  const currentUser = useKabaddiStore((s) => s.currentUser);
  const { toast } = useToast();

  // Tab state
  const [activeTab, setActiveTab] = useState<TabId>('search');

  // Counts
  const [followerCount, setFollowerCount] = useState(0);
  const [followingCount, setFollowingCount] = useState(0);
  const [countsLoading, setCountsLoading] = useState(true);

  // Search
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<PlayerResult[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);

  // Followers
  const [followers, setFollowers] = useState<FollowerEntry[]>([]);
  const [followersLoading, setFollowersLoading] = useState(false);

  // Following
  const [following, setFollowing] = useState<FollowerEntry[]>([]);
  const [followingLoading, setFollowingLoading] = useState(false);

  // Follow/Unfollow action loading per player
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);

  // Track which users the current user is following (for followers tab)
  const [followedIds, setFollowedIds] = useState<Set<string>>(new Set());

  // ─── Fetch counts ───────────────────────────────────────────

  const fetchCounts = useCallback(async () => {
    if (!currentUser) return;
    setCountsLoading(true);
    try {
      const res = await fetch(
        `/api/follow?userId=${currentUser.id}&type=counts`
      );
      if (!res.ok) throw new Error('Failed to fetch counts');
      const data = await res.json();
      setFollowerCount(data.followerCount || 0);
      setFollowingCount(data.followingCount || 0);
    } catch (err) {
      console.error('Fetch counts error:', err);
    } finally {
      setCountsLoading(false);
    }
  }, [currentUser]);

  // ─── Search players ─────────────────────────────────────────

  const searchPlayers = useCallback(
    async (query: string) => {
      if (!currentUser) return;
      setSearchLoading(true);
      try {
        const params = new URLSearchParams({
          userId: currentUser.id,
          type: 'search',
          search: query,
        });
        const res = await fetch(`/api/follow?${params}`);
        if (!res.ok) throw new Error('Search failed');
        const data = await res.json();
        setSearchResults(data.players || []);
      } catch (err) {
        console.error('Search players error:', err);
        setSearchResults([]);
      } finally {
        setSearchLoading(false);
      }
    },
    [currentUser]
  );

  // ─── Fetch followers ────────────────────────────────────────

  const fetchFollowers = useCallback(async () => {
    if (!currentUser) return;
    setFollowersLoading(true);
    try {
      const res = await fetch(
        `/api/follow?userId=${currentUser.id}&type=followers`
      );
      if (!res.ok) throw new Error('Failed to fetch followers');
      const data = await res.json();
      const list: FollowerEntry[] = data.followers || [];
      setFollowers(list);
      // Check which followers the current user is following back
      if (list.length > 0) {
        const checkRes = await fetch(
          `/api/follow?userId=${currentUser.id}&type=search&search=`
        );
        if (checkRes.ok) {
          const checkData = await checkRes.json();
          const followingSet = new Set<string>(
            (checkData.players || [])
              .filter((p: PlayerResult) => p.isFollowing)
              .map((p: PlayerResult) => p.id)
          );
          setFollowedIds(followingSet);
        }
      }
    } catch (err) {
      console.error('Fetch followers error:', err);
      setFollowers([]);
    } finally {
      setFollowersLoading(false);
    }
  }, [currentUser]);

  // ─── Fetch following ────────────────────────────────────────

  const fetchFollowing = useCallback(async () => {
    if (!currentUser) return;
    setFollowingLoading(true);
    try {
      const res = await fetch(
        `/api/follow?userId=${currentUser.id}&type=following`
      );
      if (!res.ok) throw new Error('Failed to fetch following');
      const data = await res.json();
      setFollowing(data.following || []);
    } catch (err) {
      console.error('Fetch following error:', err);
      setFollowing([]);
    } finally {
      setFollowingLoading(false);
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
      const data = await res.json();

      // Optimistically update UI
      const nowFollowing = !isCurrentlyFollowing;

      // Update search results
      setSearchResults((prev) =>
        prev.map((p) =>
          p.id === targetId ? { ...p, isFollowing: nowFollowing } : p
        )
      );

      // Update followed IDs set (for followers tab)
      setFollowedIds((prev) => {
        const next = new Set(prev);
        if (nowFollowing) next.add(targetId);
        else next.delete(targetId);
        return next;
      });

      // Refresh counts
      fetchCounts();

      // If on following tab and we unfollowed, remove from list
      if (!nowFollowing && activeTab === 'following') {
        setFollowing((prev) => prev.filter((f) => f.id !== targetId));
      }

      // If on following tab and we followed someone from followers tab, refresh
      if (nowFollowing && activeTab === 'following') {
        fetchFollowing();
      }

      toast({
        title: nowFollowing ? 'Following!' : 'Unfollowed',
        description: nowFollowing
          ? 'You are now following this player'
          : 'You unfollowed this player',
      });
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

  // ─── Initial fetch ──────────────────────────────────────────

  useEffect(() => {
    fetchCounts();
  }, [fetchCounts]);

  // ─── Search with debounce ───────────────────────────────────

  useEffect(() => {
    if (activeTab !== 'search' || !currentUser) return;
    const timer = setTimeout(() => {
      searchPlayers(searchQuery);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery, activeTab, currentUser, searchPlayers]);

  // ─── Tab change fetch ──────────────────────────────────────

  useEffect(() => {
    if (activeTab === 'followers') {
      fetchFollowers();
    } else if (activeTab === 'following') {
      fetchFollowing();
    }
  }, [activeTab, fetchFollowers, fetchFollowing]);

  // ─── Tab config ─────────────────────────────────────────────

  const TABS: { id: TabId; label: string; icon: typeof Search }[] = [
    { id: 'search', label: 'Search', icon: Search },
    { id: 'followers', label: 'Followers', icon: Users },
    { id: 'following', label: 'Following', icon: UserCheck },
  ];

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
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-brand-red to-brand-red-dark flex items-center justify-center">
                <Sparkles className="w-4 h-4 text-white" />
              </div>
              <h1 className="text-base font-black tracking-wider text-warm-800">
                FOLLOW &amp; CONNECT
              </h1>
            </div>
          </div>
          <div className="flex items-center gap-3 text-xs font-semibold">
            {!countsLoading && (
              <>
                <span className="text-warm-500">
                  <span className="text-warm-800">{followerCount}</span>{' '}
                  {followerCount === 1 ? 'follower' : 'followers'}
                </span>
                <span className="text-warm-300">·</span>
                <span className="text-warm-500">
                  <span className="text-warm-800">{followingCount}</span>{' '}
                  following
                </span>
              </>
            )}
          </div>
        </div>

        {/* Tab Pills */}
        <div className="flex gap-1.5 px-4 pb-3">
          {TABS.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-bold transition-all whitespace-nowrap ${
                  isActive
                    ? 'bg-gradient-to-r from-brand-red to-brand-red-dark text-white shadow-sm'
                    : 'bg-warm-100 text-warm-500 hover:bg-warm-200'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                {tab.label}
              </button>
            );
          })}
        </div>
      </header>

      {/* ═══ Content ═══ */}
      <div className="flex-1 overflow-y-auto custom-scrollbar">
        <AnimatePresence mode="wait">
          {/* ─── Search Tab ─── */}
          {activeTab === 'search' && (
            <motion.div
              key="search"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.2 }}
              className="px-4 py-3 space-y-3"
            >
              {/* Search Input */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-warm-400" />
                <Input
                  placeholder="Search players by name or phone..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="h-11 pl-10 pr-4 bg-white border-warm-200 rounded-xl text-warm-800 placeholder:text-warm-400 focus:ring-brand-red/20 focus:border-brand-red/40"
                />
              </div>

              {/* Search Results */}
              {searchLoading ? (
                <div className="space-y-1">
                  {[1, 2, 3, 4, 5].map((i) => (
                    <PlayerSkeleton key={i} />
                  ))}
                </div>
              ) : searchResults.length > 0 ? (
                <Card className="border-warm-200 py-0 gap-0 overflow-hidden">
                  <CardContent className="p-0 divide-y divide-warm-100">
                    {searchResults.map((player, index) => (
                      <motion.div
                        key={player.id}
                        initial={{ opacity: 0, x: -8 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: index * 0.04 }}
                        className="flex items-center gap-3 p-3 hover:bg-warm-50/50 transition-colors"
                      >
                        <PlayerAvatar
                          name={player.name}
                          avatar={player.avatar}
                        />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5">
                            <p className="font-semibold text-sm text-warm-800 truncate">
                              {getDisplayName(player.name)}
                            </p>
                            <GenderIcon gender={player.gender} />
                          </div>
                          <p className="text-xs text-warm-400 truncate">
                            {player.phone}
                          </p>
                        </div>
                        <FollowButton
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
              ) : searchQuery.trim() ? (
                <div className="flex flex-col items-center justify-center py-16">
                  <div className="w-16 h-16 rounded-full bg-warm-100 flex items-center justify-center mb-4">
                    <Search className="w-8 h-8 text-warm-300" />
                  </div>
                  <p className="text-warm-600 font-semibold text-sm">
                    No players found
                  </p>
                  <p className="text-warm-400 text-xs mt-1 text-center max-w-[240px]">
                    Try searching with a different name or phone number
                  </p>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-16">
                  <div className="w-16 h-16 rounded-full bg-warm-100 flex items-center justify-center mb-4">
                    <UserPlus className="w-8 h-8 text-warm-300" />
                  </div>
                  <p className="text-warm-600 font-semibold text-sm">
                    Find Players to Follow
                  </p>
                  <p className="text-warm-400 text-xs mt-1 text-center max-w-[240px]">
                    Search by name or phone to discover and follow other Kabaddi
                    players
                  </p>
                </div>
              )}
            </motion.div>
          )}

          {/* ─── Followers Tab ─── */}
          {activeTab === 'followers' && (
            <motion.div
              key="followers"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.2 }}
              className="px-4 py-3 space-y-3"
            >
              {/* Follower count header */}
              <div className="flex items-center justify-between">
                <h3 className="font-bold text-warm-800 flex items-center gap-2 text-sm">
                  <Users className="w-4 h-4 text-brand-teal" />
                  {followerCount} {followerCount === 1 ? 'Follower' : 'Followers'}
                </h3>
              </div>

              {followersLoading ? (
                <div className="space-y-1">
                  {[1, 2, 3, 4, 5].map((i) => (
                    <PlayerSkeleton key={i} />
                  ))}
                </div>
              ) : followers.length > 0 ? (
                <Card className="border-warm-200 py-0 gap-0 overflow-hidden">
                  <CardContent className="p-0 divide-y divide-warm-100">
                    {followers.map((follower, index) => {
                      const isFollowedBack = followedIds.has(follower.id);
                      return (
                        <motion.div
                          key={follower.id}
                          initial={{ opacity: 0, x: -8 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: index * 0.04 }}
                          className="flex items-center gap-3 p-3 hover:bg-warm-50/50 transition-colors"
                        >
                          <PlayerAvatar
                            name={follower.name}
                            avatar={follower.avatar}
                          />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1.5">
                              <p className="font-semibold text-sm text-warm-800 truncate">
                                {getDisplayName(follower.name)}
                              </p>
                              <GenderIcon gender={follower.gender} />
                            </div>
                            <p className="text-xs text-warm-400">
                              Followed you {timeAgo(follower.followedAt)}
                            </p>
                          </div>
                          <FollowButton
                            isFollowing={isFollowedBack}
                            onToggle={() =>
                              handleFollowAction(follower.id, isFollowedBack)
                            }
                            loading={actionLoadingId === follower.id}
                          />
                        </motion.div>
                      );
                    })}
                  </CardContent>
                </Card>
              ) : (
                <div className="flex flex-col items-center justify-center py-16">
                  <div className="w-16 h-16 rounded-full bg-warm-100 flex items-center justify-center mb-4">
                    <Users className="w-8 h-8 text-warm-300" />
                  </div>
                  <p className="text-warm-600 font-semibold text-sm">
                    No Followers Yet
                  </p>
                  <p className="text-warm-400 text-xs mt-1 text-center max-w-[240px]">
                    When players follow you, they&apos;ll appear here. Share your
                    profile to get more followers!
                  </p>
                </div>
              )}
            </motion.div>
          )}

          {/* ─── Following Tab ─── */}
          {activeTab === 'following' && (
            <motion.div
              key="following"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.2 }}
              className="px-4 py-3 space-y-3"
            >
              {/* Following count header */}
              <div className="flex items-center justify-between">
                <h3 className="font-bold text-warm-800 flex items-center gap-2 text-sm">
                  <UserCheck className="w-4 h-4 text-brand-teal" />
                  {followingCount} Following
                </h3>
              </div>

              {followingLoading ? (
                <div className="space-y-1">
                  {[1, 2, 3, 4, 5].map((i) => (
                    <PlayerSkeleton key={i} />
                  ))}
                </div>
              ) : following.length > 0 ? (
                <Card className="border-warm-200 py-0 gap-0 overflow-hidden">
                  <CardContent className="p-0 divide-y divide-warm-100">
                    {following.map((person, index) => (
                      <motion.div
                        key={person.id}
                        initial={{ opacity: 0, x: -8 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: index * 0.04 }}
                        className="flex items-center gap-3 p-3 hover:bg-warm-50/50 transition-colors"
                      >
                        <PlayerAvatar
                          name={person.name}
                          avatar={person.avatar}
                        />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5">
                            <p className="font-semibold text-sm text-warm-800 truncate">
                              {getDisplayName(person.name)}
                            </p>
                            <GenderIcon gender={person.gender} />
                          </div>
                          <p className="text-xs text-warm-400">
                            Following since {timeAgo(person.followedAt)}
                          </p>
                        </div>
                        <FollowButton
                          isFollowing={true}
                          onToggle={() =>
                            handleFollowAction(person.id, true)
                          }
                          loading={actionLoadingId === person.id}
                        />
                      </motion.div>
                    ))}
                  </CardContent>
                </Card>
              ) : (
                <div className="flex flex-col items-center justify-center py-16">
                  <div className="w-16 h-16 rounded-full bg-warm-100 flex items-center justify-center mb-4">
                    <UserX className="w-8 h-8 text-warm-300" />
                  </div>
                  <p className="text-warm-600 font-semibold text-sm">
                    Not Following Anyone
                  </p>
                  <p className="text-warm-400 text-xs mt-1 text-center max-w-[240px]">
                    Use the Search tab to find and follow other Kabaddi players
                  </p>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}
