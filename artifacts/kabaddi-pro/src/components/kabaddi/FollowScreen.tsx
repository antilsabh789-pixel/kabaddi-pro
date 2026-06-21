'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowLeft,
  Search,
  Users,
  UserPlus,
  UserCheck,
  UserX,
  Sparkles,
  Eye,
  Shield,
  Swords,
  Star,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { useKabaddiStore } from '@/lib/store';
import { useToast } from '@/hooks/use-toast';

// ─── Types ────────────────────────────────────────────────────────

interface FollowScreenProps {
  onClose: () => void;
}

type TabId = 'followers' | 'following' | 'search';

interface PlayerResult {
  id: string;
  name: string | null;
  avatar: string | null;
  phone: string;
  gender: string | null;
  playerCode?: string;
  isFollowing?: boolean;
  profile?: {
    position: string | null;
    overallRating: number;
    totalPoints: number;
    totalMatches: number;
  } | null;
}

interface FollowerEntry {
  id: string;
  name: string | null;
  avatar: string | null;
  phone: string;
  gender: string | null;
  followedAt: string;
  playerCode?: string;
  profile?: {
    position: string | null;
    overallRating: number;
    totalPoints: number;
    totalMatches: number;
  } | null;
}

// ─── Helpers ──────────────────────────────────────────────────────

function getInitial(name: string | null | undefined): string {
  if (!name) return '?';
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
  return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
}

function getDisplayName(name: string | null | undefined): string {
  return name?.trim() || 'Unnamed Player';
}

function getPositionLabel(position: string | null | undefined): string {
  if (!position) return '';
  const map: Record<string, string> = {
    raider: 'Raider',
    defender: 'Defender',
    'all-rounder': 'All-Rounder',
  };
  return map[position] || position;
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

// ─── Gradient palettes for avatar backgrounds ────────────────────

const AVATAR_GRADIENTS = [
  'from-brand-red to-brand-red-dark',
  'from-brand-teal to-brand-teal-dark',
  'from-brand-navy to-brand-navy-light',
  'from-brand-gold to-brand-gold-dark',
  'from-purple-500 to-purple-700',
  'from-pink-500 to-pink-700',
  'from-emerald-500 to-emerald-700',
  'from-cyan-500 to-cyan-700',
];

function getAvatarGradient(id: string): string {
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = (hash * 31 + id.charCodeAt(i)) | 0;
  }
  return AVATAR_GRADIENTS[Math.abs(hash) % AVATAR_GRADIENTS.length];
}

// ─── Avatar Component ─────────────────────────────────────────────

function PlayerAvatar({
  name,
  avatar,
  userId,
  size = 'md',
}: {
  name: string | null;
  avatar: string | null;
  userId: string;
  size?: 'sm' | 'md' | 'lg';
}) {
  const sizeClasses = {
    sm: 'w-9 h-9 text-xs',
    md: 'w-11 h-11 text-sm',
    lg: 'w-14 h-14 text-base',
  };

  const gradient = getAvatarGradient(userId);

  return (
    <div
      className={`${sizeClasses[size]} rounded-full bg-gradient-to-br ${gradient} flex items-center justify-center overflow-hidden shrink-0 ring-2 ring-white/50 dark:ring-warm-200/30 shadow-sm`}
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
      <span className="text-brand-navy text-sm font-semibold" title="Male">
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
    <motion.button
      onClick={onToggle}
      disabled={loading}
      whileTap={{ scale: 0.92 }}
      className={`${sizeClasses} rounded-full font-bold transition-all duration-200 flex items-center gap-1 shrink-0 ${
        isFollowing
          ? 'bg-warm-200/60 dark:bg-warm-200/30 text-warm-600 dark:text-warm-400 border border-warm-300/50 dark:border-warm-200/20 hover:bg-red-100 dark:hover:bg-red-900/30 hover:text-brand-red dark:hover:text-brand-red-light hover:border-brand-red/30'
          : 'bg-gradient-to-r from-brand-teal to-brand-teal-dark text-white shadow-sm shadow-brand-teal/20 hover:shadow-md hover:shadow-brand-teal/30'
      } ${loading ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer'}`}
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
    </motion.button>
  );
}

// ─── Skeleton Loader ──────────────────────────────────────────────

function PlayerSkeleton() {
  return (
    <div className="flex items-center gap-3 p-3">
      <div className="w-11 h-11 rounded-full bg-warm-200 dark:bg-warm-200/30 animate-pulse shrink-0" />
      <div className="flex-1 min-w-0 space-y-2">
        <div className="h-3.5 w-28 rounded-full bg-warm-200 dark:bg-warm-200/30 animate-pulse" />
        <div className="h-2.5 w-20 rounded-full bg-warm-100 dark:bg-warm-200/20 animate-pulse" />
      </div>
      <div className="w-20 h-7 rounded-full bg-warm-200 dark:bg-warm-200/30 animate-pulse shrink-0" />
    </div>
  );
}

// ─── Empty State Component ────────────────────────────────────────

function EmptyState({
  icon: Icon,
  title,
  description,
}: {
  icon: typeof Users;
  title: string;
  description: string;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="flex flex-col items-center justify-center py-16"
    >
      <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-warm-100 to-warm-200/50 dark:from-warm-200/20 dark:to-warm-200/10 flex items-center justify-center mb-4">
        <Icon className="w-10 h-10 text-warm-300 dark:text-warm-400" />
      </div>
      <p className="text-warm-700 dark:text-warm-600 font-bold text-sm">{title}</p>
      <p className="text-warm-400 dark:text-warm-500 text-xs mt-1 text-center max-w-[240px]">
        {description}
      </p>
    </motion.div>
  );
}

// ─── Main Component ───────────────────────────────────────────────

export default function FollowScreen({ onClose }: FollowScreenProps) {
  const currentUser = useKabaddiStore((s) => s.currentUser);
  const { toast } = useToast();

  // Tab state
  const [activeTab, setActiveTab] = useState<TabId>('followers');

  // Counts
  const [followerCount, setFollowerCount] = useState(0);
  const [followingCount, setFollowingCount] = useState(0);
  const [countsLoading, setCountsLoading] = useState(true);

  // Search within tabs
  const [filterQuery, setFilterQuery] = useState('');

  // Followers
  const [followers, setFollowers] = useState<FollowerEntry[]>([]);
  const [followersLoading, setFollowersLoading] = useState(false);

  // Following
  const [following, setFollowing] = useState<FollowerEntry[]>([]);
  const [followingLoading, setFollowingLoading] = useState(false);

  // Suggested players
  const [suggested, setSuggested] = useState<PlayerResult[]>([]);
  const [suggestedLoading, setSuggestedLoading] = useState(false);

  // Search players (by phone or name)
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<PlayerResult[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searched, setSearched] = useState(false);

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

  // ─── Fetch suggested players ────────────────────────────────

  const fetchSuggested = useCallback(async () => {
    if (!currentUser) return;
    setSuggestedLoading(true);
    try {
      const res = await fetch(
        `/api/players?limit=5`
      );
      if (!res.ok) throw new Error('Failed to fetch suggested');
      const data = await res.json();
      const players: PlayerResult[] = (data.players || [])
        .filter((p: PlayerResult) => p.id !== currentUser.id)
        .slice(0, 5);

      // Check which ones are already following
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
        const filteredSuggested = players.filter((p: PlayerResult) => !followingSet.has(p.id));
        setSuggested(filteredSuggested.map((p: PlayerResult) => ({ ...p, isFollowing: false })));
      } else {
        setSuggested(players.map((p: PlayerResult) => ({ ...p, isFollowing: false })));
      }
    } catch (err) {
      console.error('Fetch suggested error:', err);
      setSuggested([]);
    } finally {
      setSuggestedLoading(false);
    }
  }, [currentUser]);

  // ─── Search players by phone or name ─────────────────────────

  const handleSearch = useCallback(async (query: string) => {
    if (!query.trim() || query.trim().length < 3) {
      setSearchResults([]);
      setSearched(false);
      return;
    }
    setSearchLoading(true);
    setSearched(true);
    try {
      // Normalize the query — if it's all digits, treat as phone number
      const trimmed = query.trim();
      const isPhoneSearch = /^\+?\d{6,}$/.test(trimmed);

      const params = new URLSearchParams();
      params.set('search', trimmed);
      params.set('limit', '20');
      if (currentUser?.id) params.set('userId', currentUser.id);

      const res = await fetch(`/api/players?${params.toString()}`);
      if (!res.ok) throw new Error('Search failed');
      const data = await res.json();
      let players: PlayerResult[] = data.players || [];

      // If searching by phone, also try exact phone match
      if (isPhoneSearch) {
        const phoneVal = trimmed.replace(/\D/g, '');
        const phoneVariants = [phoneVal, `+91${phoneVal}`, `+${phoneVal}`];
        const exact = players.find(p => phoneVariants.includes(p.phone));
        if (exact) {
          // Move exact match to top
          players = [exact, ...players.filter(p => p.id !== exact.id)];
        }
      }

      // Mark isFollowing based on followedIds
      const followingSet = new Set(following.map(f => f.id));
      players = players.map(p => ({
        ...p,
        isFollowing: followingSet.has(p.id),
      }));

      setSearchResults(players);
    } catch (err) {
      console.error('Search error:', err);
      setSearchResults([]);
    } finally {
      setSearchLoading(false);
    }
  }, [currentUser?.id, following]);

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => {
      if (searchQuery.trim()) {
        handleSearch(searchQuery);
      } else {
        setSearchResults([]);
        setSearched(false);
      }
    }, 400);
    return () => clearTimeout(timer);
  }, [searchQuery, handleSearch]);

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

      const nowFollowing = !isCurrentlyFollowing;

      // Update suggested
      setSuggested((prev) =>
        prev.map((p) =>
          p.id === targetId ? { ...p, isFollowing: nowFollowing } : p
        ).filter((p) => !nowFollowing || p.id !== targetId)
      );

      // Update followed IDs set
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

      // If on following tab and we followed someone, refresh
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
    fetchSuggested();
  }, [fetchCounts, fetchSuggested]);

  // ─── Tab change fetch ──────────────────────────────────────

  useEffect(() => {
    if (activeTab === 'followers') {
      fetchFollowers();
    } else if (activeTab === 'following') {
      fetchFollowing();
    }
  }, [activeTab, fetchFollowers, fetchFollowing]);

  // ─── Filtered lists ────────────────────────────────────────

  const filteredFollowers = useMemo(() => {
    if (!filterQuery.trim()) return followers;
    const q = filterQuery.toLowerCase();
    return followers.filter(
      (f) =>
        (f.name && f.name.toLowerCase().includes(q)) ||
        (f.playerCode && f.playerCode.toLowerCase().includes(q))
    );
  }, [followers, filterQuery]);

  const filteredFollowing = useMemo(() => {
    if (!filterQuery.trim()) return following;
    const q = filterQuery.toLowerCase();
    return following.filter(
      (f) =>
        (f.name && f.name.toLowerCase().includes(q)) ||
        (f.playerCode && f.playerCode.toLowerCase().includes(q))
    );
  }, [following, filterQuery]);

  // ─── Tab config ─────────────────────────────────────────────

  const TABS: { id: TabId; label: string; icon: typeof Users; count: number | undefined }[] = [
    { id: 'followers', label: 'Followers', icon: Users, count: followerCount },
    { id: 'following', label: 'Following', icon: UserCheck, count: followingCount },
    { id: 'search', label: 'Search', icon: Search, count: undefined },
  ];

  // ─── Render ─────────────────────────────────────────────────

  return (
    <motion.div
      initial={{ y: '100%' }}
      animate={{ y: 0 }}
      exit={{ y: '100%' }}
      transition={{ type: 'spring', damping: 28, stiffness: 300 }}
      className="fixed inset-0 z-50 bg-warm-50 dark:bg-warm-50 flex flex-col"
    >
      {/* ═══ Header ═══ */}
      <header className="sticky top-0 z-10 bg-warm-50/90 dark:bg-warm-50/90 backdrop-blur-md border-b border-warm-200/60 dark:border-warm-200/20">
        <div className="px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-full bg-warm-200 dark:bg-warm-200/50 flex items-center justify-center text-warm-600 dark:text-warm-500 hover:bg-warm-300 dark:hover:bg-warm-200/60 transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-brand-red to-brand-red-dark flex items-center justify-center">
                <Sparkles className="w-4 h-4 text-white" />
              </div>
              <h1 className="text-base font-black tracking-wider text-warm-800 dark:text-warm-700">
                CONNECT
              </h1>
            </div>
          </div>
          <div className="flex items-center gap-3 text-xs font-semibold">
            {!countsLoading && (
              <>
                <span className="text-warm-500 dark:text-warm-400">
                  <span className="text-warm-800 dark:text-warm-700">{followerCount}</span>{' '}
                  {followerCount === 1 ? 'follower' : 'followers'}
                </span>
                <span className="text-warm-300 dark:text-warm-400">·</span>
                <span className="text-warm-500 dark:text-warm-400">
                  <span className="text-warm-800 dark:text-warm-700">{followingCount}</span>{' '}
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
                onClick={() => {
                  setActiveTab(tab.id);
                  setFilterQuery('');
                }}
                className={`relative flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-bold transition-all whitespace-nowrap ${
                  isActive
                    ? 'bg-gradient-to-r from-brand-red to-brand-red-dark text-white shadow-sm shadow-brand-red/20'
                    : 'bg-warm-100 dark:bg-warm-200/20 text-warm-500 dark:text-warm-400 hover:bg-warm-200 dark:hover:bg-warm-200/30'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                {tab.label}
                <span className={`ml-0.5 min-w-[18px] h-[18px] rounded-full flex items-center justify-center text-[9px] font-bold ${
                  isActive
                    ? 'bg-white/25 text-white'
                    : 'bg-warm-200 dark:bg-warm-200/40 text-warm-500 dark:text-warm-400'
                }`}>
                  {tab.count}
                </span>
              </button>
            );
          })}
        </div>
      </header>

      {/* ═══ Content ═══ */}
      <div className="flex-1 overflow-y-auto custom-scrollbar">
        <AnimatePresence mode="wait">
          {/* ─── Followers Tab ─── */}
          {activeTab === 'followers' && (
            <motion.div
              key="followers"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              transition={{ duration: 0.25 }}
              className="px-4 py-3 space-y-4"
            >
              {/* Search within followers */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-warm-400 dark:text-warm-500" />
                <Input
                  placeholder="Search followers..."
                  value={filterQuery}
                  onChange={(e) => setFilterQuery(e.target.value)}
                  className="h-10 pl-10 pr-4 bg-white dark:bg-warm-100 border-warm-200 dark:border-warm-200/20 rounded-xl text-warm-800 dark:text-warm-700 placeholder:text-warm-400 dark:placeholder:text-warm-500 focus:ring-brand-red/20 focus:border-brand-red/40"
                />
              </div>

              {followersLoading ? (
                <div className="space-y-1">
                  {[1, 2, 3, 4, 5].map((i) => (
                    <PlayerSkeleton key={i} />
                  ))}
                </div>
              ) : filteredFollowers.length > 0 ? (
                <Card className="border-warm-200/50 dark:border-warm-200/20 py-0 gap-0 overflow-hidden bg-white/70 dark:bg-warm-100/70 backdrop-blur-sm">
                  <CardContent className="p-0 divide-y divide-warm-100 dark:divide-warm-200/20">
                    {filteredFollowers.map((follower, index) => {
                      const isFollowedBack = followedIds.has(follower.id);
                      return (
                        <motion.div
                          key={follower.id}
                          initial={{ opacity: 0, x: -12 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: index * 0.04, duration: 0.25 }}
                          className="flex items-center gap-3 p-3 hover:bg-warm-50/80 dark:hover:bg-warm-200/10 transition-colors"
                        >
                          <PlayerAvatar
                            name={follower.name}
                            avatar={follower.avatar}
                            userId={follower.id}
                          />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1.5">
                              <p className="font-semibold text-sm text-warm-800 dark:text-warm-700 truncate">
                                {getDisplayName(follower.name)}
                              </p>
                              <GenderIcon gender={follower.gender} />
                            </div>
                            <div className="flex items-center gap-1.5 text-xs text-warm-400 dark:text-warm-500">
                              <span>Followed you {timeAgo(follower.followedAt)}</span>
                            </div>
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
                <EmptyState
                  icon={Users}
                  title={filterQuery ? 'No matching followers' : 'No Followers Yet'}
                  description={
                    filterQuery
                      ? 'Try a different search term'
                      : "When players follow you, they'll appear here. Share your profile to get more followers!"
                  }
                />
              )}

              {/* ═══ Suggested Players Section ═══ */}
              <div className="pt-2">
                <div className="flex items-center gap-2 mb-3">
                  <Star className="w-4 h-4 text-brand-gold" />
                  <h3 className="font-bold text-sm text-warm-800 dark:text-warm-700">
                    Suggested for You
                  </h3>
                </div>

                {suggestedLoading ? (
                  <div className="space-y-1">
                    {[1, 2, 3].map((i) => (
                      <PlayerSkeleton key={i} />
                    ))}
                  </div>
                ) : suggested.length > 0 ? (
                  <Card className="border-warm-200/50 dark:border-warm-200/20 py-0 gap-0 overflow-hidden bg-white/70 dark:bg-warm-100/70 backdrop-blur-sm">
                    <CardContent className="p-0 divide-y divide-warm-100 dark:divide-warm-200/20">
                      {suggested.map((player, index) => (
                        <motion.div
                          key={player.id}
                          initial={{ opacity: 0, x: -12 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: index * 0.06, duration: 0.25 }}
                          className="flex items-center gap-3 p-3 hover:bg-warm-50/80 dark:hover:bg-warm-200/10 transition-colors"
                        >
                          <PlayerAvatar
                            name={player.name}
                            avatar={player.avatar}
                            userId={player.id}
                          />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1.5">
                              <p className="font-semibold text-sm text-warm-800 dark:text-warm-700 truncate">
                                {getDisplayName(player.name)}
                              </p>
                              {player.playerCode && (
                                <Badge className="bg-warm-200/50 dark:bg-warm-200/20 text-warm-500 dark:text-warm-400 text-[8px] border-0 font-mono">
                                  {player.playerCode}
                                </Badge>
                              )}
                            </div>
                            <div className="flex items-center gap-2 text-[10px] text-warm-400 dark:text-warm-500">
                              {player.profile?.position && (
                                <span className="flex items-center gap-0.5">
                                  <Shield className="w-2.5 h-2.5" />
                                  {getPositionLabel(player.profile.position)}
                                </span>
                              )}
                              {player.profile?.totalMatches !== undefined && player.profile.totalMatches > 0 && (
                                <span>{player.profile.totalMatches} matches</span>
                              )}
                              {player.profile?.totalPoints !== undefined && player.profile.totalPoints > 0 && (
                                <span>{player.profile.totalPoints} pts</span>
                              )}
                            </div>
                          </div>
                          <FollowButton
                            isFollowing={!!player.isFollowing}
                            onToggle={() =>
                              handleFollowAction(player.id, !!player.isFollowing)
                            }
                            loading={actionLoadingId === player.id}
                          />
                        </motion.div>
                      ))}
                    </CardContent>
                  </Card>
                ) : (
                  <div className="text-center py-6">
                    <p className="text-xs text-warm-400 dark:text-warm-500">No suggestions available</p>
                  </div>
                )}
              </div>
            </motion.div>
          )}

          {/* ─── Following Tab ─── */}
          {activeTab === 'following' && (
            <motion.div
              key="following"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.25 }}
              className="px-4 py-3 space-y-4"
            >
              {/* Search within following */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-warm-400 dark:text-warm-500" />
                <Input
                  placeholder="Search following..."
                  value={filterQuery}
                  onChange={(e) => setFilterQuery(e.target.value)}
                  className="h-10 pl-10 pr-4 bg-white dark:bg-warm-100 border-warm-200 dark:border-warm-200/20 rounded-xl text-warm-800 dark:text-warm-700 placeholder:text-warm-400 dark:placeholder:text-warm-500 focus:ring-brand-teal/20 focus:border-brand-teal/40"
                />
              </div>

              {/* Following count header */}
              <div className="flex items-center justify-between">
                <h3 className="font-bold text-warm-800 dark:text-warm-700 flex items-center gap-2 text-sm">
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
              ) : filteredFollowing.length > 0 ? (
                <Card className="border-warm-200/50 dark:border-warm-200/20 py-0 gap-0 overflow-hidden bg-white/70 dark:bg-warm-100/70 backdrop-blur-sm">
                  <CardContent className="p-0 divide-y divide-warm-100 dark:divide-warm-200/20">
                    {filteredFollowing.map((person, index) => (
                      <motion.div
                        key={person.id}
                        initial={{ opacity: 0, x: 12 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: index * 0.04, duration: 0.25 }}
                        className="flex items-center gap-3 p-3 hover:bg-warm-50/80 dark:hover:bg-warm-200/10 transition-colors"
                      >
                        <PlayerAvatar
                          name={person.name}
                          avatar={person.avatar}
                          userId={person.id}
                        />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5">
                            <p className="font-semibold text-sm text-warm-800 dark:text-warm-700 truncate">
                              {getDisplayName(person.name)}
                            </p>
                            <GenderIcon gender={person.gender} />
                          </div>
                          <div className="flex items-center gap-1.5 text-xs text-warm-400 dark:text-warm-500">
                            <span>Following since {timeAgo(person.followedAt)}</span>
                          </div>
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
                <EmptyState
                  icon={UserX}
                  title={filterQuery ? 'No matching results' : 'Not Following Anyone'}
                  description={
                    filterQuery
                      ? 'Try a different search term'
                      : 'Check the Followers tab for suggestions to follow other Kabaddi players'
                  }
                />
              )}

              {/* ═══ Suggested Players Section ═══ */}
              <div className="pt-2">
                <div className="flex items-center gap-2 mb-3">
                  <Star className="w-4 h-4 text-brand-gold" />
                  <h3 className="font-bold text-sm text-warm-800 dark:text-warm-700">
                    Suggested for You
                  </h3>
                </div>

                {suggestedLoading ? (
                  <div className="space-y-1">
                    {[1, 2, 3].map((i) => (
                      <PlayerSkeleton key={i} />
                    ))}
                  </div>
                ) : suggested.length > 0 ? (
                  <Card className="border-warm-200/50 dark:border-warm-200/20 py-0 gap-0 overflow-hidden bg-white/70 dark:bg-warm-100/70 backdrop-blur-sm">
                    <CardContent className="p-0 divide-y divide-warm-100 dark:divide-warm-200/20">
                      {suggested.map((player, index) => (
                        <motion.div
                          key={player.id}
                          initial={{ opacity: 0, x: 12 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: index * 0.06, duration: 0.25 }}
                          className="flex items-center gap-3 p-3 hover:bg-warm-50/80 dark:hover:bg-warm-200/10 transition-colors"
                        >
                          <PlayerAvatar
                            name={player.name}
                            avatar={player.avatar}
                            userId={player.id}
                          />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1.5">
                              <p className="font-semibold text-sm text-warm-800 dark:text-warm-700 truncate">
                                {getDisplayName(player.name)}
                              </p>
                              {player.playerCode && (
                                <Badge className="bg-warm-200/50 dark:bg-warm-200/20 text-warm-500 dark:text-warm-400 text-[8px] border-0 font-mono">
                                  {player.playerCode}
                                </Badge>
                              )}
                            </div>
                            <div className="flex items-center gap-2 text-[10px] text-warm-400 dark:text-warm-500">
                              {player.profile?.position && (
                                <span className="flex items-center gap-0.5">
                                  <Shield className="w-2.5 h-2.5" />
                                  {getPositionLabel(player.profile.position)}
                                </span>
                              )}
                              {player.profile?.totalMatches !== undefined && player.profile.totalMatches > 0 && (
                                <span>{player.profile.totalMatches} matches</span>
                              )}
                              {player.profile?.totalPoints !== undefined && player.profile.totalPoints > 0 && (
                                <span>{player.profile.totalPoints} pts</span>
                              )}
                            </div>
                          </div>
                          <FollowButton
                            isFollowing={!!player.isFollowing}
                            onToggle={() =>
                              handleFollowAction(player.id, !!player.isFollowing)
                            }
                            loading={actionLoadingId === player.id}
                          />
                        </motion.div>
                      ))}
                    </CardContent>
                  </Card>
                ) : (
                  <div className="text-center py-6">
                    <p className="text-xs text-warm-400 dark:text-warm-500">No suggestions available</p>
                  </div>
                )}
              </div>
            </motion.div>
          )}

          {/* ═══════════════════════════════════════════════════
              SEARCH TAB — Search players by phone or name
              ═══════════════════════════════════════════════════ */}
          {activeTab === 'search' && (
            <motion.div
              key="search-tab"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-3"
            >
              {/* Search input */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-warm-400 dark:text-warm-500" />
                <Input
                  placeholder="Search by name or phone number..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9 h-11 bg-white dark:bg-warm-800 border-warm-200 dark:border-warm-600 rounded-xl text-warm-800 dark:text-warm-100"
                />
              </div>

              {/* Search results */}
              {searchLoading ? (
                <div className="space-y-1">
                  {[1, 2, 3].map((i) => (
                    <PlayerSkeleton key={i} />
                  ))}
                </div>
              ) : searched && searchResults.length > 0 ? (
                <Card>
                  <CardContent className="p-0">
                    <div className="px-3 py-2 border-b border-warm-100 dark:border-warm-700/50">
                      <p className="text-[10px] font-bold text-warm-400 uppercase tracking-wider">
                        {searchResults.length} player{searchResults.length > 1 ? 's' : ''} found
                      </p>
                    </div>
                    {searchResults.map((player, index) => (
                      <motion.div
                        key={player.id}
                        initial={{ opacity: 0, x: 12 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: index * 0.04, duration: 0.25 }}
                        className="flex items-center gap-3 p-3 hover:bg-warm-50/80 dark:hover:bg-warm-200/10 transition-colors"
                      >
                        <PlayerAvatar
                          name={player.name}
                          avatar={player.avatar}
                          userId={player.id}
                        />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5">
                            <p className="font-semibold text-sm text-warm-800 dark:text-warm-700 truncate">
                              {getDisplayName(player.name)}
                            </p>
                            <GenderIcon gender={player.gender} />
                          </div>
                          <div className="flex items-center gap-1.5 text-xs text-warm-400 dark:text-warm-500">
                            {player.playerCode && (
                              <span className="font-mono">{player.playerCode}</span>
                            )}
                            {player.profile?.position && (
                              <>
                                <span>•</span>
                                <span>{getPositionLabel(player.profile.position)}</span>
                              </>
                            )}
                            {player.profile?.overallRating ? (
                              <>
                                <span>•</span>
                                <span className="flex items-center gap-0.5">
                                  <Star className="w-2.5 h-2.5 text-brand-gold" />
                                  {player.profile.overallRating.toFixed(1)}
                                </span>
                              </>
                            ) : null}
                          </div>
                        </div>
                        <FollowButton
                          isFollowing={!!player.isFollowing}
                          onToggle={() =>
                            handleFollowAction(player.id, !!player.isFollowing)
                          }
                          loading={actionLoadingId === player.id}
                        />
                      </motion.div>
                    ))}
                  </CardContent>
                </Card>
              ) : searched && searchResults.length === 0 ? (
                <EmptyState
                  icon={UserX}
                  title="No players found"
                  description="Try searching with a different name or phone number. Make sure the player has registered on Kabaddi Pro."
                />
              ) : (
                <div className="text-center py-12 px-4">
                  <div className="w-16 h-16 rounded-2xl bg-brand-teal/10 flex items-center justify-center mx-auto mb-3">
                    <Search className="w-8 h-8 text-brand-teal" />
                  </div>
                  <p className="text-sm font-bold text-warm-700 dark:text-warm-300 mb-1">
                    Find Players to Follow
                  </p>
                  <p className="text-xs text-warm-400 dark:text-warm-500 max-w-[250px] mx-auto">
                    Search by name (e.g. "Arjun") or phone number (e.g. "9876543210") to find and follow kabaddi players.
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
