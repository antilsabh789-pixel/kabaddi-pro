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
  Heart,
  Share2,
  MessageCircle,
  Plus,
  X,
  Send,
  Calendar,
  Crown,
  Shield,
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

// Enhanced feed types for local/community posts
type FeedType = 'match_result' | 'player_achievement' | 'tournament_update' | 'team_activity' | 'community_post';

interface CommunityPost {
  id: string;
  userId: string;
  userName: string;
  content: string;
  createdAt: number;
  likes: number;
  isLiked: boolean;
  type: FeedType;
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

function formatTimestampAgo(timestamp: number): string {
  const diff = Date.now() - timestamp;
  const seconds = Math.floor(diff / 1000);
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days === 1) return 'Yesterday';
  if (days < 7) return `${days}d ago`;
  return `${Math.floor(days / 7)}w ago`;
}

function parseMetadata(metadata: string | null): Record<string, unknown> | null {
  if (!metadata) return null;
  try {
    return JSON.parse(metadata);
  } catch {
    return null;
  }
}

// ─── Activity Type Config (enhanced) ──────────────────────────────

type ActivityType = 'match_completed' | 'tournament_joined' | 'achievement_unlocked' | 'player_milestone';

interface ActivityTypeConfig {
  icon: typeof Trophy;
  color: string;
  bgColor: string;
  borderColor: string;
  badgeBg: string;
  badgeText: string;
  label: string;
  leftBorderColor: string;
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
    leftBorderColor: 'border-l-brand-red',
  },
  achievement_unlocked: {
    icon: Award,
    color: 'text-brand-gold',
    bgColor: 'bg-brand-gold/5',
    borderColor: 'border-brand-gold/20',
    badgeBg: 'bg-brand-gold/15',
    badgeText: 'text-brand-gold-dark',
    label: 'Achievement',
    leftBorderColor: 'border-l-brand-gold',
  },
  tournament_joined: {
    icon: Flag,
    color: 'text-brand-teal',
    bgColor: 'bg-brand-teal/5',
    borderColor: 'border-brand-teal/20',
    badgeBg: 'bg-brand-teal/15',
    badgeText: 'text-brand-teal-dark',
    label: 'Tournament',
    leftBorderColor: 'border-l-brand-teal',
  },
  player_milestone: {
    icon: Milestone,
    color: 'text-brand-navy',
    bgColor: 'bg-brand-navy/5',
    borderColor: 'border-brand-navy/20',
    badgeBg: 'bg-brand-navy/15',
    badgeText: 'text-brand-navy',
    label: 'Milestone',
    leftBorderColor: 'border-l-purple-500',
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
    leftBorderColor: 'border-l-warm-400',
  };
}

// ─── Feed Type Config (new) ───────────────────────────────────────

interface FeedTypeConfig {
  icon: typeof Trophy;
  color: string;
  bgColor: string;
  borderColor: string;
  leftBorderColor: string;
  badgeBg: string;
  badgeText: string;
  label: string;
}

const FEED_TYPE_CONFIG: Record<FeedType, FeedTypeConfig> = {
  match_result: {
    icon: Trophy,
    color: 'text-red-500',
    bgColor: 'bg-red-500/5',
    borderColor: 'border-red-500/20',
    leftBorderColor: 'border-l-red-500',
    badgeBg: 'bg-red-500/15',
    badgeText: 'text-red-600',
    label: 'Match Result',
  },
  player_achievement: {
    icon: Award,
    color: 'text-amber-500',
    bgColor: 'bg-amber-500/5',
    borderColor: 'border-amber-500/20',
    leftBorderColor: 'border-l-amber-500',
    badgeBg: 'bg-amber-500/15',
    badgeText: 'text-amber-600',
    label: 'Achievement',
  },
  tournament_update: {
    icon: Flag,
    color: 'text-teal-500',
    bgColor: 'bg-teal-500/5',
    borderColor: 'border-teal-500/20',
    leftBorderColor: 'border-l-teal-500',
    badgeBg: 'bg-teal-500/15',
    badgeText: 'text-teal-600',
    label: 'Tournament',
  },
  team_activity: {
    icon: Users,
    color: 'text-purple-500',
    bgColor: 'bg-purple-500/5',
    borderColor: 'border-purple-500/20',
    leftBorderColor: 'border-l-purple-500',
    badgeBg: 'bg-purple-500/15',
    badgeText: 'text-purple-600',
    label: 'Team',
  },
  community_post: {
    icon: MessageCircle,
    color: 'text-blue-500',
    bgColor: 'bg-blue-500/5',
    borderColor: 'border-blue-500/20',
    leftBorderColor: 'border-l-blue-500',
    badgeBg: 'bg-blue-500/15',
    badgeText: 'text-blue-600',
    label: 'Community',
  },
};

// ─── Sample Data ──────────────────────────────────────────────────

const SAMPLE_FEED_ITEMS: CommunityPost[] = [
  {
    id: 'sample_1',
    userId: 'system',
    userName: 'Kabaddi Pro',
    content: '🔥 Match Result: Patna Pirates 42 - 38 Bengaluru Bulls! What a thriller! An incredible comeback by the Pirates in the second half.',
    createdAt: Date.now() - 2 * 60 * 60 * 1000,
    likes: 24,
    isLiked: false,
    type: 'match_result',
  },
  {
    id: 'sample_2',
    userId: 'system',
    userName: 'Kabaddi Pro',
    content: '🏆 Milestone Alert! Pardeep Narwal crosses 1500 raid points in PKL history! The Dubki King continues to reign supreme.',
    createdAt: Date.now() - 4 * 60 * 60 * 1000,
    likes: 56,
    isLiked: false,
    type: 'player_achievement',
  },
  {
    id: 'sample_3',
    userId: 'system',
    userName: 'Kabaddi Pro',
    content: '🏟️ New Tournament: "City Kabaddi Championship 2025" has been created! 16 teams, single elimination bracket. Register now!',
    createdAt: Date.now() - 6 * 60 * 60 * 1000,
    likes: 18,
    isLiked: false,
    type: 'tournament_update',
  },
  {
    id: 'sample_4',
    userId: 'system',
    userName: 'Kabaddi Pro',
    content: '👤 Team Update: Vikram Singh has been appointed as the new captain of the Mumbai Mahi Raiders.',
    createdAt: Date.now() - 12 * 60 * 60 * 1000,
    likes: 8,
    isLiked: false,
    type: 'team_activity',
  },
];

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
        className={`${sizeClasses} rounded-full bg-gradient-to-br from-brand-navy to-brand-navy-light flex items-center justify-center overflow-hidden ring-2 ring-warm-100 dark:ring-warm-800`}
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
        <div className="mt-2.5 p-3 rounded-lg bg-white/60 dark:bg-white/5 border border-warm-200/60 dark:border-warm-700/40">
          <div className="flex items-center justify-between gap-3">
            <div className={`flex-1 text-center ${winner === 'home' ? 'font-bold text-brand-red' : 'text-warm-600 dark:text-warm-400'}`}>
              <p className="text-xs truncate">{homeTeam}</p>
              <p className="text-xl font-black">{homeScore}</p>
            </div>
            <div className="flex flex-col items-center gap-0.5">
              <Swords className="w-4 h-4 text-warm-400" />
              <span className="text-[9px] text-warm-400 font-semibold uppercase">vs</span>
            </div>
            <div className={`flex-1 text-center ${winner === 'away' ? 'font-bold text-brand-red' : 'text-warm-600 dark:text-warm-400'}`}>
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
        <div className="mt-2.5 p-3 rounded-lg bg-white/60 dark:bg-white/5 border border-warm-200/60 dark:border-warm-700/40 flex items-center gap-2.5">
          <div className={`w-9 h-9 rounded-lg ${config.badgeBg} flex items-center justify-center shrink-0`}>
            <Flag className={`w-4 h-4 ${config.color}`} />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-warm-800 dark:text-warm-200 truncate">{tournamentName}</p>
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
        <div className="mt-2.5 p-3 rounded-lg bg-white/60 dark:bg-white/5 border border-warm-200/60 dark:border-warm-700/40 flex items-center gap-2.5">
          <div className={`w-9 h-9 rounded-lg ${config.badgeBg} flex items-center justify-center shrink-0 text-lg`}>
            {achievementIcon}
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-warm-800 dark:text-warm-200 truncate">{achievementName}</p>
            <p className="text-[11px] text-warm-400">New achievement unlocked!</p>
          </div>
        </div>
      );
    }

    case 'player_milestone': {
      const milestoneType = (meta?.milestoneType as string) || activity.title || 'Milestone';
      const milestoneValue = (meta?.milestoneValue as string | number) ?? null;

      return (
        <div className="mt-2.5 p-3 rounded-lg bg-white/60 dark:bg-white/5 border border-warm-200/60 dark:border-warm-700/40 flex items-center gap-2.5">
          <div className={`w-9 h-9 rounded-lg ${config.badgeBg} flex items-center justify-center shrink-0`}>
            <Milestone className={`w-4 h-4 ${config.color}`} />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-warm-800 dark:text-warm-200 truncate">{milestoneType}</p>
            {milestoneValue && (
              <p className="text-[11px] text-warm-400">Reached {String(milestoneValue)}</p>
            )}
          </div>
        </div>
      );
    }

    default:
      return activity.description ? (
        <p className="mt-1.5 text-xs text-warm-500 dark:text-warm-400 leading-relaxed">{activity.description}</p>
      ) : null;
  }
}

// ─── Feed Item Icons by Type ──────────────────────────────────────

function getFeedTypeIcon(type: FeedType): typeof Trophy {
  return FEED_TYPE_CONFIG[type].icon;
}

function getFeedTypeLabel(type: FeedType): string {
  return FEED_TYPE_CONFIG[type].label;
}

// ─── Enhanced Community Feed Card ─────────────────────────────────

function CommunityFeedCard({
  item,
  onLike,
  onShare,
  index,
}: {
  item: CommunityPost;
  onLike: (id: string) => void;
  onShare: (id: string) => void;
  index: number;
}) {
  const config = FEED_TYPE_CONFIG[item.type];
  const Icon = config.icon;

  return (
    <motion.div
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
        className={`${config.bgColor} ${config.borderColor} border-l-4 ${config.leftBorderColor} rounded-xl py-0 gap-0 overflow-hidden backdrop-blur-md bg-white/70 dark:bg-warm-900/70 shadow-sm hover:shadow-md transition-shadow`}
      >
        <CardContent className="p-4">
          {/* Header row */}
          <div className="flex items-start gap-3">
            <div className={`w-10 h-10 rounded-xl ${config.badgeBg} flex items-center justify-center shrink-0`}>
              <Icon className={`w-5 h-5 ${config.color}`} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5 flex-wrap">
                <p className="font-bold text-sm text-warm-800 dark:text-warm-200 truncate">
                  {item.userName}
                </p>
                <Badge className={`${config.badgeBg} ${config.badgeText} text-[9px] font-semibold border-0 px-1.5 py-0 h-4`}>
                  <Icon className="w-2.5 h-2.5 mr-0.5" />
                  {getFeedTypeLabel(item.type)}
                </Badge>
              </div>
              <p className="text-[10px] text-warm-400 dark:text-warm-500 mt-0.5">
                {formatTimestampAgo(item.createdAt)}
              </p>
            </div>
          </div>

          {/* Content */}
          <p className="mt-2.5 text-sm text-warm-700 dark:text-warm-300 leading-relaxed whitespace-pre-line">
            {item.content}
          </p>

          {/* Actions */}
          <div className="mt-3 flex items-center gap-4">
            <motion.button
              onClick={() => onLike(item.id)}
              className="flex items-center gap-1.5 group"
              whileTap={{ scale: 0.9 }}
            >
              <Heart
                className={`w-4 h-4 transition-colors ${
                  item.isLiked
                    ? 'text-red-500 fill-red-500'
                    : 'text-warm-400 group-hover:text-red-400'
                }`}
              />
              <span className={`text-xs font-medium ${item.isLiked ? 'text-red-500' : 'text-warm-500 dark:text-warm-400'}`}>
                {item.likes}
              </span>
            </motion.button>

            <button
              onClick={() => onShare(item.id)}
              className="flex items-center gap-1.5 text-warm-400 hover:text-brand-teal transition-colors"
            >
              <Share2 className="w-4 h-4" />
              <span className="text-xs font-medium text-warm-500 dark:text-warm-400">Share</span>
            </button>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}

// ─── Match Result Card (enhanced) ─────────────────────────────────

function MatchResultCard({
  activity,
  index,
}: {
  activity: Activity;
  index: number;
}) {
  const meta = parseMetadata(activity.metadata);
  const homeTeam = (meta?.homeTeam as string) || 'Team A';
  const awayTeam = (meta?.awayTeam as string) || 'Team B';
  const homeScore = (meta?.homeScore as number) ?? 0;
  const awayScore = (meta?.awayScore as number) ?? 0;
  const winner = (meta?.winner as string) || null;
  const topRaider = (meta?.topRaider as string) || null;
  const topDefender = (meta?.topDefender as string) || null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 16, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{
        delay: Math.min(index * 0.04, 0.4),
        type: 'spring',
        damping: 20,
        stiffness: 200,
      }}
    >
      <Card className="bg-red-500/5 border border-red-500/20 border-l-4 border-l-red-500 rounded-xl py-0 gap-0 overflow-hidden backdrop-blur-md bg-white/70 dark:bg-warm-900/70 shadow-sm hover:shadow-md transition-shadow">
        <CardContent className="p-4">
          <div className="flex items-center gap-2 mb-2.5">
            <div className="w-8 h-8 rounded-lg bg-red-500/15 flex items-center justify-center">
              <Trophy className="w-4 h-4 text-red-500" />
            </div>
            <Badge className="bg-red-500/15 text-red-600 dark:text-red-400 text-[9px] font-semibold border-0 px-1.5 py-0 h-4">
              Match Result
            </Badge>
            <span className="text-[10px] text-warm-400 ml-auto">
              {formatTimeAgo(activity.createdAt)}
            </span>
          </div>

          <div className="p-3 rounded-lg bg-white/60 dark:bg-white/5 border border-warm-200/60 dark:border-warm-700/40">
            <div className="flex items-center justify-between gap-3">
              <div className={`flex-1 text-center ${winner === 'home' ? 'font-bold text-red-500' : 'text-warm-600 dark:text-warm-400'}`}>
                <p className="text-xs truncate">{homeTeam}</p>
                <p className="text-xl font-black">{homeScore}</p>
              </div>
              <div className="flex flex-col items-center gap-0.5">
                <Swords className="w-4 h-4 text-warm-400" />
                <span className="text-[9px] text-warm-400 font-semibold uppercase">vs</span>
              </div>
              <div className={`flex-1 text-center ${winner === 'away' ? 'font-bold text-red-500' : 'text-warm-600 dark:text-warm-400'}`}>
                <p className="text-xs truncate">{awayTeam}</p>
                <p className="text-xl font-black">{awayScore}</p>
              </div>
            </div>
          </div>

          {/* Key stats */}
          {(topRaider || topDefender) && (
            <div className="mt-2 flex items-center gap-3 text-[10px] text-warm-500 dark:text-warm-400">
              {topRaider && (
                <span className="flex items-center gap-1">
                  <Swords className="w-3 h-3 text-amber-500" />
                  Top Raider: {topRaider}
                </span>
              )}
              {topDefender && (
                <span className="flex items-center gap-1">
                  <Shield className="w-3 h-3 text-teal-500" />
                  Top Defender: {topDefender}
                </span>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
}

// ─── Achievement Card (enhanced) ──────────────────────────────────

function AchievementCard({
  activity,
  index,
}: {
  activity: Activity;
  index: number;
}) {
  const meta = parseMetadata(activity.metadata);
  const achievementName = (meta?.achievementName as string) || activity.title || 'Achievement';
  const achievementIcon = (meta?.achievementIcon as string) || '🏆';
  const playerName = activity.userName || 'Player';

  return (
    <motion.div
      initial={{ opacity: 0, y: 16, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{
        delay: Math.min(index * 0.04, 0.4),
        type: 'spring',
        damping: 20,
        stiffness: 200,
      }}
    >
      <Card className="bg-amber-500/5 border border-amber-500/20 border-l-4 border-l-amber-500 rounded-xl py-0 gap-0 overflow-hidden backdrop-blur-md bg-white/70 dark:bg-warm-900/70 shadow-sm hover:shadow-md transition-shadow">
        <CardContent className="p-4">
          <div className="flex items-center gap-3">
            <motion.div
              className="w-12 h-12 rounded-xl bg-amber-500/15 flex items-center justify-center text-2xl shrink-0"
              animate={{ scale: [1, 1.05, 1] }}
              transition={{ duration: 2, repeat: Infinity }}
            >
              {achievementIcon}
            </motion.div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5">
                <Crown className="w-3.5 h-3.5 text-amber-500" />
                <Badge className="bg-amber-500/15 text-amber-600 dark:text-amber-400 text-[9px] font-semibold border-0 px-1.5 py-0 h-4">
                  Achievement
                </Badge>
              </div>
              <p className="text-sm font-bold text-warm-800 dark:text-warm-200 mt-1 truncate">
                {playerName}
              </p>
              <p className="text-xs text-warm-500 dark:text-warm-400">
                {achievementName}
              </p>
            </div>
            <span className="text-[10px] text-warm-400 shrink-0">
              {formatTimeAgo(activity.createdAt)}
            </span>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}

// ─── Skeleton Loaders ─────────────────────────────────────────────

function ActivitySkeleton() {
  return (
    <div className="rounded-xl bg-warm-100 dark:bg-warm-800 border border-warm-300 dark:border-warm-700 p-4 animate-pulse">
      <div className="flex items-center gap-3">
        <div className="w-11 h-11 rounded-full bg-warm-200 dark:bg-warm-700 shrink-0" />
        <div className="flex-1 space-y-2">
          <div className="h-3.5 w-32 rounded-full bg-warm-200 dark:bg-warm-700" />
          <div className="h-2.5 w-48 rounded-full bg-warm-200 dark:bg-warm-700" />
        </div>
        <div className="w-8 h-8 rounded-full bg-warm-200 dark:bg-warm-700 shrink-0" />
      </div>
      <div className="mt-3 h-16 rounded-lg bg-warm-200 dark:bg-warm-700" />
    </div>
  );
}

function SuggestedPlayerSkeleton() {
  return (
    <div className="flex items-center gap-3 py-2 animate-pulse">
      <div className="w-10 h-10 rounded-full bg-warm-200 dark:bg-warm-700 shrink-0" />
      <div className="flex-1 space-y-2">
        <div className="h-3 w-24 rounded-full bg-warm-200 dark:bg-warm-700" />
        <div className="h-2 w-16 rounded-full bg-warm-200 dark:bg-warm-700" />
      </div>
      <div className="w-16 h-7 rounded-full bg-warm-200 dark:bg-warm-700 shrink-0" />
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
          ? 'bg-warm-200 dark:bg-warm-700 text-warm-600 dark:text-warm-400 hover:bg-red-100 hover:text-brand-red'
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

// ─── Create Post Modal ────────────────────────────────────────────

function CreatePostModal({
  onClose,
  onPost,
}: {
  onClose: () => void;
  onPost: (content: string, type: FeedType) => void;
}) {
  const [content, setContent] = useState('');
  const [selectedType, setSelectedType] = useState<FeedType>('community_post');
  const MAX_CHARS = 280;
  const remaining = MAX_CHARS - content.length;

  const typeOptions: { value: FeedType; label: string; icon: typeof MessageCircle }[] = [
    { value: 'community_post', label: 'Post', icon: MessageCircle },
    { value: 'match_result', label: 'Match', icon: Trophy },
    { value: 'player_achievement', label: 'Achievement', icon: Award },
    { value: 'tournament_update', label: 'Tournament', icon: Flag },
    { value: 'team_activity', label: 'Team', icon: Users },
  ];

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[60] flex items-end justify-center bg-black/50 backdrop-blur-sm"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <motion.div
        initial={{ y: '100%' }}
        animate={{ y: 0 }}
        exit={{ y: '100%' }}
        transition={{ type: 'spring', damping: 28, stiffness: 300 }}
        className="w-full max-w-md bg-warm-50 dark:bg-warm-900 rounded-t-2xl shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Handle bar */}
        <div className="flex justify-center pt-3 pb-1">
          <div className="w-10 h-1 rounded-full bg-warm-300 dark:bg-warm-600" />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-4 py-2">
          <h3 className="text-base font-black text-warm-800 dark:text-warm-200">Create Post</h3>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-warm-200 dark:bg-warm-700 flex items-center justify-center text-warm-500 hover:bg-warm-300 dark:hover:bg-warm-600 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Post type selector */}
        <div className="px-4 pb-2">
          <div className="flex gap-1.5 overflow-x-auto custom-scrollbar pb-1">
            {typeOptions.map((opt) => (
              <button
                key={opt.value}
                onClick={() => setSelectedType(opt.value)}
                className={`flex items-center gap-1 px-3 py-1.5 rounded-full text-[11px] font-bold whitespace-nowrap transition-all ${
                  selectedType === opt.value
                    ? `${FEED_TYPE_CONFIG[opt.value].badgeBg} ${FEED_TYPE_CONFIG[opt.value].badgeText} shadow-sm`
                    : 'bg-warm-100 dark:bg-warm-800 text-warm-500 dark:text-warm-400 hover:bg-warm-200 dark:hover:bg-warm-700'
                }`}
              >
                <opt.icon className="w-3 h-3" />
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {/* Text area */}
        <div className="px-4 pb-3">
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value.slice(0, MAX_CHARS))}
            placeholder="What's happening in kabaddi?"
            className="w-full h-28 resize-none rounded-xl bg-white dark:bg-warm-800 border border-warm-200 dark:border-warm-700 p-3 text-sm text-warm-800 dark:text-warm-200 placeholder:text-warm-400 focus:outline-none focus:ring-2 focus:ring-brand-teal/40 focus:border-brand-teal transition-all"
            autoFocus
          />
          <div className="flex items-center justify-between mt-2">
            <span className={`text-[11px] font-medium ${remaining < 50 ? 'text-red-500' : 'text-warm-400'}`}>
              {remaining} characters left
            </span>
            <Button
              onClick={() => {
                if (content.trim()) {
                  onPost(content.trim(), selectedType);
                  onClose();
                }
              }}
              disabled={!content.trim()}
              size="sm"
              className="rounded-full bg-brand-teal hover:bg-brand-teal-dark text-white font-bold text-xs px-5 disabled:opacity-40"
            >
              <Send className="w-3.5 h-3.5 mr-1" />
              Post
            </Button>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}

// ─── Pull to Refresh Indicator ────────────────────────────────────

function PullToRefreshIndicator({ pulling, refreshing }: { pulling: boolean; refreshing: boolean }) {
  return (
    <AnimatePresence>
      {(pulling || refreshing) && (
        <motion.div
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: 40, opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          className="flex items-center justify-center overflow-hidden"
        >
          <motion.div
            animate={refreshing ? { rotate: 360 } : { rotate: pulling ? 180 : 0 }}
            transition={refreshing ? { duration: 0.8, repeat: Infinity, ease: 'linear' } : { duration: 0.3 }}
          >
            <RefreshCw className="w-5 h-5 text-brand-teal" />
          </motion.div>
          <span className="ml-2 text-xs text-warm-500 dark:text-warm-400 font-medium">
            {refreshing ? 'Refreshing...' : 'Pull to refresh'}
          </span>
        </motion.div>
      )}
    </AnimatePresence>
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

  // Community posts (local state)
  const [communityPosts, setCommunityPosts] = useState<CommunityPost[]>(SAMPLE_FEED_ITEMS);

  // Create post modal
  const [showCreatePost, setShowCreatePost] = useState(false);

  // Pull to refresh state
  const [pulling, setPulling] = useState(false);

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
        setPulling(false);
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

  // ─── Community Post Actions ─────────────────────────────────

  const handleCreatePost = useCallback((content: string, type: FeedType) => {
    const newPost: CommunityPost = {
      id: `post_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      userId: currentUser?.id || 'anonymous',
      userName: currentUser?.name || 'You',
      content,
      createdAt: Date.now(),
      likes: 0,
      isLiked: false,
      type,
    };
    setCommunityPosts((prev) => [newPost, ...prev]);
    toast({
      title: 'Post created!',
      description: 'Your post has been added to the feed',
    });
  }, [currentUser, toast]);

  const handleLikePost = useCallback((postId: string) => {
    setCommunityPosts((prev) =>
      prev.map((p) =>
        p.id === postId
          ? { ...p, isLiked: !p.isLiked, likes: p.isLiked ? p.likes - 1 : p.likes + 1 }
          : p
      )
    );
  }, []);

  const handleSharePost = useCallback((postId: string) => {
    void postId;
    toast({
      title: 'Link copied!',
      description: 'Post link has been copied to clipboard',
    });
  }, [toast]);

  // ─── Derived ────────────────────────────────────────────────

  const feedIsEmpty = !feedLoading && activities.length === 0 && communityPosts.length === 0;

  // ─── Render ─────────────────────────────────────────────────

  return (
    <motion.div
      initial={{ y: '100%' }}
      animate={{ y: 0 }}
      exit={{ y: '100%' }}
      transition={{ type: 'spring', damping: 28, stiffness: 300 }}
      className="fixed inset-0 z-50 bg-warm-50 dark:bg-warm-950 flex flex-col"
    >
      {/* ═══ Header ═══ */}
      <header className="sticky top-0 z-10 bg-warm-50/90 dark:bg-warm-950/90 backdrop-blur-md border-b border-warm-200/60 dark:border-warm-800/60">
        <div className="px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-full bg-warm-200 dark:bg-warm-800 flex items-center justify-center text-warm-600 dark:text-warm-400 hover:bg-warm-300 dark:hover:bg-warm-700 transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-brand-teal to-brand-teal-dark flex items-center justify-center">
                <Rss className="w-4 h-4 text-white" />
              </div>
              <h1 className="text-base font-black tracking-wider text-warm-800 dark:text-warm-200">
                SOCIAL FEED
              </h1>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                setPulling(true);
                fetchActivities(true);
              }}
              disabled={refreshing}
              className="w-8 h-8 rounded-full bg-warm-100 dark:bg-warm-800 flex items-center justify-center text-warm-500 dark:text-warm-400 hover:bg-warm-200 dark:hover:bg-warm-700 hover:text-warm-700 transition-colors disabled:opacity-50"
              aria-label="Refresh feed"
            >
              <RefreshCw
                className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`}
              />
            </button>
          </div>
        </div>
      </header>

      {/* ═══ Content ═══ */}
      <div className="flex-1 overflow-y-auto custom-scrollbar relative">
        <PullToRefreshIndicator pulling={pulling} refreshing={refreshing} />

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
                <div className="w-16 h-16 rounded-full bg-warm-100 dark:bg-warm-800 flex items-center justify-center mb-4">
                  <Rss className="w-8 h-8 text-warm-300 dark:text-warm-600" />
                </div>
                <p className="text-warm-700 dark:text-warm-300 font-bold text-sm">
                  No activity yet
                </p>
                <p className="text-warm-400 dark:text-warm-500 text-xs mt-1 text-center max-w-[260px]">
                  Follow players to see their updates, or create your first post!
                </p>
              </div>

              {/* Suggested Players Section */}
              <div className="mt-4">
                <div className="flex items-center gap-2 mb-3">
                  <Users className="w-4 h-4 text-brand-teal" />
                  <h2 className="text-sm font-bold text-warm-800 dark:text-warm-200">
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
                  <Card className="bg-warm-100 dark:bg-warm-800 border-warm-300 dark:border-warm-700 py-0 gap-0 overflow-hidden">
                    <CardContent className="p-0 divide-y divide-warm-200/60 dark:divide-warm-700/40">
                      {suggestedPlayers.map((player, index) => (
                        <motion.div
                          key={player.id}
                          initial={{ opacity: 0, x: -8 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: index * 0.05 }}
                          className="flex items-center gap-3 px-4 py-3 hover:bg-warm-50/50 dark:hover:bg-warm-700/30 transition-colors"
                        >
                          <PlayerAvatar
                            name={player.name}
                            avatar={player.avatar}
                            gender={player.gender}
                            size="sm"
                          />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1.5">
                              <p className="font-semibold text-sm text-warm-800 dark:text-warm-200 truncate">
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
                            <p className="text-[11px] text-warm-400 dark:text-warm-500 truncate">
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
                    <Users className="w-8 h-8 text-warm-300 dark:text-warm-600 mb-2" />
                    <p className="text-warm-400 dark:text-warm-500 text-xs text-center">
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
              className="px-4 py-3 pb-24"
            >
              {/* Community Posts Section */}
              {communityPosts.length > 0 && (
                <div className="mb-5">
                  <div className="flex items-center gap-2 mb-3">
                    <MessageCircle className="w-4 h-4 text-blue-500" />
                    <h2 className="text-sm font-bold text-warm-800 dark:text-warm-200">
                      Community Feed
                    </h2>
                  </div>
                  <div className="flex flex-col gap-3">
                    {communityPosts.map((post, index) => (
                      <CommunityFeedCard
                        key={post.id}
                        item={post}
                        onLike={handleLikePost}
                        onShare={handleSharePost}
                        index={index}
                      />
                    ))}
                  </div>
                </div>
              )}

              {/* Server Activity Cards */}
              {activities.length > 0 && (
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <Rss className="w-4 h-4 text-brand-teal" />
                    <h2 className="text-sm font-bold text-warm-800 dark:text-warm-200">
                      Activity
                    </h2>
                  </div>
                  <div className="flex flex-col gap-3">
                    {activities.map((activity, index) => {
                      // Use enhanced card types for specific activity types
                      if (activity.type === 'match_completed') {
                        return (
                          <MatchResultCard
                            key={activity.id}
                            activity={activity}
                            index={index}
                          />
                        );
                      }

                      if (activity.type === 'achievement_unlocked' || activity.type === 'player_milestone') {
                        return (
                          <AchievementCard
                            key={activity.id}
                            activity={activity}
                            index={index}
                          />
                        );
                      }

                      // Default card with type-specific left border
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
                            className={`${config.bgColor} ${config.borderColor} border-l-4 ${config.leftBorderColor} rounded-xl py-0 gap-0 overflow-hidden backdrop-blur-md bg-white/70 dark:bg-warm-900/70 shadow-sm hover:shadow-md transition-shadow`}
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
                                    <p className="font-bold text-sm text-warm-800 dark:text-warm-200 truncate">
                                      {getDisplayName(activity.userName)}
                                    </p>
                                    {isOwnActivity && (
                                      <Badge className="bg-brand-teal/15 text-brand-teal-dark dark:text-brand-teal text-[9px] font-semibold border-0 px-1.5 py-0 h-4">
                                        You
                                      </Badge>
                                    )}
                                  </div>
                                  {/* Activity description line */}
                                  <p className="text-xs text-warm-500 dark:text-warm-400 mt-0.5 leading-relaxed">
                                    {activity.description || activity.title}
                                  </p>
                                  <p className="text-[10px] text-warm-400 dark:text-warm-500 mt-1">
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
                        className="rounded-full border-warm-300 dark:border-warm-700 text-warm-600 dark:text-warm-400 hover:bg-warm-100 dark:hover:bg-warm-800 text-xs font-semibold"
                      >
                        Load More
                      </Button>
                    </div>
                  )}
                </div>
              )}

              {/* Suggested Players at bottom of feed */}
              {suggestedPlayers.length > 0 && (
                <div className="mt-6 mb-4">
                  <div className="flex items-center gap-2 mb-3">
                    <Users className="w-4 h-4 text-brand-teal" />
                    <h2 className="text-sm font-bold text-warm-800 dark:text-warm-200">
                      Suggested Players
                    </h2>
                  </div>

                  <Card className="bg-warm-100 dark:bg-warm-800 border-warm-300 dark:border-warm-700 py-0 gap-0 overflow-hidden">
                    <CardContent className="p-0 divide-y divide-warm-200/60 dark:divide-warm-700/40">
                      {suggestedPlayers.slice(0, 3).map((player, index) => (
                        <motion.div
                          key={player.id}
                          initial={{ opacity: 0, x: -8 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: 0.2 + index * 0.05 }}
                          className="flex items-center gap-3 px-4 py-2.5 hover:bg-warm-50/50 dark:hover:bg-warm-700/30 transition-colors"
                        >
                          <PlayerAvatar
                            name={player.name}
                            avatar={player.avatar}
                            gender={player.gender}
                            size="sm"
                          />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1.5">
                              <p className="font-semibold text-xs text-warm-800 dark:text-warm-200 truncate">
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

      {/* ═══ Floating Create Post Button ═══ */}
      <motion.button
        onClick={() => setShowCreatePost(true)}
        className="fixed bottom-6 right-6 z-40 w-14 h-14 rounded-full bg-brand-teal hover:bg-brand-teal-dark text-white shadow-lg shadow-brand-teal/30 flex items-center justify-center transition-colors"
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        transition={{ delay: 0.3, type: 'spring', damping: 15, stiffness: 300 }}
        aria-label="Create post"
      >
        <Plus className="w-6 h-6" />
      </motion.button>

      {/* ═══ Create Post Modal ═══ */}
      <AnimatePresence>
        {showCreatePost && (
          <CreatePostModal
            onClose={() => setShowCreatePost(false)}
            onPost={handleCreatePost}
          />
        )}
      </AnimatePresence>
    </motion.div>
  );
}
