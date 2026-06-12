'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Trophy,
  Bell,
  Shield,
  Star,
  Zap,
  Calendar,
  Swords,
  Crown,
  Lock,
  BarChart3,
  Award,
  Share2,
  Clock,
  ChevronRight,
  BellOff,
  Users,
  Rss,
  Sparkles,
  Activity,
  MapPin,
  Gift,
  Play,
  Brain,
  Radio,
  Download,
  Vote,
  Briefcase,
  Copy,
  Check,
  Target,
  Flame,
  TrendingUp,
  RefreshCw,
  ArrowDown,
  BookOpen,
  Search,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useKabaddiStore } from '@/lib/store';
import { useToast } from '@/hooks/use-toast';
import PremiumUpgradeScreen from './PremiumUpgradeScreen';
import LeaderboardScreen from './LeaderboardScreen';
import MatchAwardsScreen from './MatchAwardsScreen';
import NotificationPanel from './NotificationPanel';
import ShareScorecard from './ShareScorecard';
import MatchDetailsScreen from './MatchDetailsScreen';
import FollowScreen from './FollowScreen';
import SocialFeedScreen from './SocialFeedScreen';
import MatchHighlightsScreen from './MatchHighlightsScreen';
import AdvancedStatsScreen from './AdvancedStatsScreen';
import AchievementsScreen from './AchievementsScreen';
import TeamComparisonScreen from './TeamComparisonScreen';
import GroundsScreen from './GroundsScreen';
import MatchReplayScreen from './MatchReplayScreen';
import AIInsightsScreen from './AIInsightsScreen';
import BroadcastScreen from './BroadcastScreen';
import DataExportScreen from './DataExportScreen';
import SeasonScreen from './SeasonScreen';
import PollsScreen from './PollsScreen';
import SponsorScreen from './SponsorScreen';
import PlayerStatsScreen from './PlayerStatsScreen';
import StreaksRecordsScreen from './StreaksRecordsScreen';
import MatchPredictionScreen from './MatchPredictionScreen';
import KabaddiRulesScreen from './KabaddiRulesScreen';
import GlobalSearchScreen from './GlobalSearchScreen';
import MatchHistoryScreen from './MatchHistoryScreen';
import LiveCommentaryTicker, { toCommentaryMatchInfo, type CommentaryMatchInfo } from './LiveCommentaryTicker';
import { matchNotification, welcomeBackNotification } from '@/lib/notifications';

// ─── Types ──────────────────────────────────────────────────────────

interface TeamBasic {
  id: string;
  name: string;
  shortName: string | null;
  color: string | null;
  logo?: string | null;
}

interface LiveMatch {
  id: string;
  homeScore: number;
  awayScore: number;
  half: number;
  status: string;
  gender?: string | null;
  homeTeam: TeamBasic;
  awayTeam: TeamBasic;
  tournament: { id: string; name: string } | null;
}

interface CompletedMatch {
  id: string;
  homeScore: number;
  awayScore: number;
  half: number;
  status: string;
  gender?: string | null;
  homeTeam: {
    id: string;
    name: string;
    shortName: string | null;
    color: string | null;
  };
  awayTeam: {
    id: string;
    name: string;
    shortName: string | null;
    color: string | null;
  };
  tournament: { id: string; name: string } | null;
  startedAt: string | null;
  completedAt: string | null;
}

interface UpcomingMatch {
  id: string;
  homeScore: number;
  awayScore: number;
  half: number;
  status: string;
  gender?: string | null;
  homeTeam: {
    id: string;
    name: string;
    shortName: string | null;
    color: string | null;
  };
  awayTeam: {
    id: string;
    name: string;
    shortName: string | null;
    color: string | null;
  };
  tournament: { id: string; name: string } | null;
  startedAt: string | null;
  completedAt: string | null;
}

interface MotmAward {
  matchId: string;
  userId: string;
  userName: string;
  userAvatar: string | null;
  points: number;
  matchInfo: string;
  tournamentName: string | null;
  completedAt: string | null;
}

interface AwardPlayer {
  title: string;
  name: string;
  team: string;
  stat: string;
  statLabel: string;
  icon: typeof Star;
  gradient: string;
  borderAccent: string;
  iconColor: string;
  badgeBg: string;
  playerId?: string;
}

interface StatsData {
  stats: {
    totalMatches: number;
    totalPlayers: number;
    totalTournaments: number;
    totalTeams: number;
    liveMatchCount: number;
    completedMatchCount: number;
    upcomingMatchCount: number;
  };
  liveMatches: LiveMatch[];
  recentMatches: CompletedMatch[];
  upcomingMatches: UpcomingMatch[];
  topRaiders: {
    id: string;
    userId: string;
    totalRaids: number;
    successfulRaids: number;
    bonusPoints: number;
    user: { id: string; name: string; avatar: string | null };
  }[];
  topDefenders: {
    id: string;
    userId: string;
    totalTackles: number;
    successfulTackles: number;
    superTackles: number;
    user: { id: string; name: string; avatar: string | null };
  }[];
  recentMotmAwards: MotmAward[];
}

// ─── Animation Variants ────────────────────────────────────────────

const cardHover = {
  rest: { scale: 1 },
  hover: { scale: 1.02, transition: { duration: 0.2 } },
};

const stagger = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.08 },
  },
};

const fadeUp = {
  hidden: { opacity: 0, y: 16 },
  show: { opacity: 1, y: 0, transition: { duration: 0.4 } },
};

// ─── Helpers ────────────────────────────────────────────────────────

function getTimeGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good Morning';
  if (hour < 17) return 'Good Afternoon';
  return 'Good Evening';
}

function getTimeEmoji(): string {
  const hour = new Date().getHours();
  if (hour < 12) return '🌅';
  if (hour < 17) return '☀️';
  return '🌙';
}

// ─── Animated Counter ───────────────────────────────────────────────

function AnimatedCounter({ target, duration = 1200 }: { target: number; duration?: number }) {
  const [count, setCount] = useState(0);
  const prevTarget = useRef(target);

  useEffect(() => {
    if (prevTarget.current === target && count !== 0) return;
    prevTarget.current = target;

    let start = 0;
    const startTime = performance.now();

    function step(currentTime: number) {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);
      // ease-out cubic
      const eased = 1 - Math.pow(1 - progress, 3);
      const current = Math.round(eased * target);
      setCount(current);
      if (progress < 1) {
        requestAnimationFrame(step);
      }
    }

    requestAnimationFrame(step);
  }, [target, duration]);

  return <span>{count}</span>;
}

// ─── Number Ticker (for live match scores) ──────────────────────────

function NumberTicker({ value }: { value: number }) {
  const prevValue = useRef(value);
  const [animating, setAnimating] = useState(false);

  useEffect(() => {
    if (prevValue.current !== value) {
      prevValue.current = value;
      const t1 = setTimeout(() => setAnimating(true), 0);
      const t2 = setTimeout(() => setAnimating(false), 400);
      return () => { clearTimeout(t1); clearTimeout(t2); };
    }
  }, [value]);

  return (
    <span className={animating ? 'number-ticker' : ''} key={`${value}-${animating}`}>
      {value}
    </span>
  );
}

// ─── Confetti Particles (subtle, on score) ─────────────────────────

function ConfettiParticles({ trigger }: { trigger: number }) {
  const [particles, setParticles] = useState<Array<{ id: number; x: number; color: string; delay: number }>>([]);
  const prevTrigger = useRef(trigger);

  useEffect(() => {
    if (prevTrigger.current !== trigger) {
      prevTrigger.current = trigger;
      const colors = ['#DC2626', '#F59E0B', '#14B8A6', '#1E293B', '#FBBF24'];
      const newParticles = Array.from({ length: 6 }, (_, i) => ({
        id: Date.now() + i,
        x: 30 + Math.random() * 40,
        color: colors[Math.floor(Math.random() * colors.length)],
        delay: i * 0.05,
      }));
      const t1 = setTimeout(() => setParticles(newParticles), 0);
      const t2 = setTimeout(() => setParticles([]), 900);
      return () => { clearTimeout(t1); clearTimeout(t2); };
    }
  }, [trigger]);

  return (
    <>
      {particles.map((p) => (
        <div
          key={p.id}
          className="absolute w-1.5 h-1.5 rounded-full confetti-particle pointer-events-none z-20"
          style={{
            left: `${p.x}%`,
            top: '20%',
            backgroundColor: p.color,
            animationDelay: `${p.delay}s`,
          }}
        />
      ))}
    </>
  );
}

// ─── Skeleton Components ───────────────────────────────────────────

function LiveMatchSkeleton() {
  return (
    <Card className="bg-warm-100 dark:bg-warm-800 border-warm-300 dark:border-warm-700 py-0 gap-0 overflow-hidden">
      <CardContent className="p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="h-5 w-14 rounded-full bg-warm-200 animate-pulse" />
          <div className="h-4 w-16 rounded bg-warm-200 animate-pulse" />
        </div>
        <div className="flex items-center justify-between">
          <div className="flex flex-col items-center gap-1 flex-1">
            <div className="w-10 h-10 rounded-full bg-warm-200 animate-pulse" />
            <div className="h-3 w-16 rounded bg-warm-200 animate-pulse" />
          </div>
          <div className="flex items-center gap-3 px-4">
            <div className="h-7 w-7 rounded bg-warm-200 animate-pulse" />
            <div className="h-4 w-4 rounded bg-warm-200 animate-pulse" />
            <div className="h-7 w-7 rounded bg-warm-200 animate-pulse" />
          </div>
          <div className="flex flex-col items-center gap-1 flex-1">
            <div className="w-10 h-10 rounded-full bg-warm-200 animate-pulse" />
            <div className="h-3 w-16 rounded bg-warm-200 animate-pulse" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function AwardSkeleton() {
  return (
    <Card className="bg-warm-100 dark:bg-warm-800 border-warm-300 dark:border-warm-700 border py-0 gap-0 overflow-hidden">
      <CardContent className="p-4">
        <div className="flex items-center gap-3">
          <div className="w-14 h-14 rounded-full bg-warm-200 animate-pulse shrink-0" />
          <div className="flex-1 space-y-2">
            <div className="h-4 w-24 rounded bg-warm-200 animate-pulse" />
            <div className="h-3 w-20 rounded bg-warm-200 animate-pulse" />
          </div>
          <div className="space-y-2">
            <div className="h-5 w-10 rounded bg-warm-200 animate-pulse" />
            <div className="h-3 w-14 rounded bg-warm-200 animate-pulse" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Countdown Timer ────────────────────────────────────────────────

function CountdownTimer({ targetDate }: { targetDate: string | null }) {
  const [timeLeft, setTimeLeft] = useState<{ d: number; h: number; m: number; s: number } | null>(null);
  const [expired, setExpired] = useState(!targetDate);

  useEffect(() => {
    if (!targetDate) {
      return;
    }

    function calculate() {
      const diff = Math.max(0, new Date(targetDate).getTime() - Date.now());
      if (diff === 0) {
        setExpired(true);
        setTimeLeft({ d: 0, h: 0, m: 0, s: 0 });
        return true;
      }
      setExpired(false);
      setTimeLeft({
        d: Math.floor(diff / 86400000),
        h: Math.floor((diff % 86400000) / 3600000),
        m: Math.floor((diff % 3600000) / 60000),
        s: Math.floor((diff % 60000) / 1000),
      });
      return false;
    }

    const done = calculate();
    if (done) return;

    const id = setInterval(() => {
      const finished = calculate();
      if (finished) clearInterval(id);
    }, 1000);

    return () => clearInterval(id);
  }, [targetDate]);

  if (expired) {
    return (
      <motion.div
        className="flex items-center justify-center gap-1.5 py-1"
        animate={{ opacity: [1, 0.5, 1] }}
        transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut' }}
      >
        <span className="text-xs font-bold text-brand-red dark:text-brand-red-light">Starting Soon!</span>
        <Zap className="w-3 h-3 text-brand-red dark:text-brand-red-light" />
      </motion.div>
    );
  }

  if (!timeLeft) return null;

  const units = [
    { value: timeLeft.d, label: 'D' },
    { value: timeLeft.h, label: 'H' },
    { value: timeLeft.m, label: 'M' },
    { value: timeLeft.s, label: 'S' },
  ];

  return (
    <div className="flex items-center justify-center gap-1.5">
      {units.map((unit, idx) => (
        <div key={unit.label} className="flex items-center gap-1.5">
          <div className="flex flex-col items-center">
            <motion.div
              className="w-9 h-9 rounded-md bg-warm-800/80 dark:bg-warm-100/90 flex items-center justify-center shadow-sm"
              key={`${unit.label}-${unit.value}`}
              initial={{ rotateX: -90, opacity: 0 }}
              animate={{ rotateX: 0, opacity: 1 }}
              transition={{ duration: 0.3, ease: 'easeOut' }}
            >
              <span className="text-sm font-black text-white dark:text-warm-900 tabular-nums">
                {String(unit.value).padStart(2, '0')}
              </span>
            </motion.div>
            <span className="text-[8px] font-semibold text-warm-500 dark:text-warm-400 mt-0.5">
              {unit.label}
            </span>
          </div>
          {idx < units.length - 1 && (
            <span className="text-warm-400 dark:text-warm-500 font-bold text-xs mb-3">:</span>
          )}
        </div>
      ))}
    </div>
  );
}

// ─── Component ─────────────────────────────────────────────────────

type GenderFilter = 'all' | 'boys' | 'girls';

export default function HomeTab() {
  const currentUser = useKabaddiStore((s) => s.currentUser);
  const fetchHomeData = useKabaddiStore((s) => s.fetchHomeData);
  const homeData = useKabaddiStore((s) => s.homeData);
  const addNotification = useKabaddiStore((s) => s.addNotification);
  const notifications = useKabaddiStore((s) => s.notifications);
  const activeMatch = useKabaddiStore((s) => s.activeMatch);
  const { toast } = useToast();

  const isPremium = currentUser?.isPremium || false;
  const [liveMatches, setLiveMatches] = useState<LiveMatch[]>([]);
  const [recentMatches, setRecentMatches] = useState<CompletedMatch[]>([]);
  const [upcomingMatches, setUpcomingMatches] = useState<UpcomingMatch[]>([]);
  const [awardPlayers, setAwardPlayers] = useState<AwardPlayer[]>([]);
  const [motmAwards, setMotmAwards] = useState<MotmAward[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [genderFilter, setGenderFilter] = useState<GenderFilter>('all');
  const [showUpgrade, setShowUpgrade] = useState(false);
  const [upgradeFeature, setUpgradeFeature] = useState('Player Stats');
  const [showLeaderboard, setShowLeaderboard] = useState(false);
  const [showAwards, setShowAwards] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [showShareScorecard, setShowShareScorecard] = useState(false);
  const [shareMatchData, setShareMatchData] = useState<CompletedMatch | null>(null);
  const [showMatchDetails, setShowMatchDetails] = useState(false);
  const [selectedMatchId, setSelectedMatchId] = useState<string | null>(null);
  const [showFollow, setShowFollow] = useState(false);
  const [showSocialFeed, setShowSocialFeed] = useState(false);
  const [showHighlights, setShowHighlights] = useState(false);
  const [highlightsMatchId, setHighlightsMatchId] = useState<string | null>(null);
  const [showAdvancedStats, setShowAdvancedStats] = useState(false);
  const [statsUserId, setStatsUserId] = useState<string | null>(null);
  const [showAchievements, setShowAchievements] = useState(false);
  const [showComparison, setShowComparison] = useState(false);
  const [showGrounds, setShowGrounds] = useState(false);
  const [showReplay, setShowReplay] = useState(false);
  const [replayMatchId, setReplayMatchId] = useState<string | null>(null);
  const [showAIInsights, setShowAIInsights] = useState(false);
  const [showBroadcast, setShowBroadcast] = useState(false);
  const [broadcastMatchId, setBroadcastMatchId] = useState<string | null>(null);
  const [showDataExport, setShowDataExport] = useState(false);
  const [showSeason, setShowSeason] = useState(false);
  const [showPolls, setShowPolls] = useState(false);
  const [showPredictions, setShowPredictions] = useState(false);
  const [showSponsors, setShowSponsors] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);
  const [showStats, setShowStats] = useState(false);
  const [showRules, setShowRules] = useState(false);
  const [showStreaks, setShowStreaks] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const [showMatchHistory, setShowMatchHistory] = useState(false);

  // ─── Pull-to-Refresh State ───
  const [pullDistance, setPullDistance] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const touchStartY = useRef(0);
  const pullThreshold = 80;

  const unreadNotificationCount = notifications.filter((n) => !n.read).length;

  const buildAwardPlayers = useCallback(
    (topRaiders: StatsData['topRaiders'], topDefenders: StatsData['topDefenders']): AwardPlayer[] => {
      const awards: AwardPlayer[] = [];

      if (topRaiders.length > 0) {
        const raider = topRaiders[0];
        const raidPoints = raider.successfulRaids + raider.bonusPoints;
        awards.push({
          title: 'Top Raider',
          name: raider.user.name,
          team: `${raidPoints} Raid Points`,
          stat: raidPoints.toString(),
          statLabel: 'raid points',
          icon: Swords,
          gradient: 'from-brand-gold/20 to-brand-gold-dark/10',
          borderAccent: 'border-brand-gold/30',
          iconColor: 'text-brand-gold',
          badgeBg: 'bg-brand-gold/20 text-brand-gold-dark',
          playerId: raider.userId,
        });
      }

      if (topDefenders.length > 0) {
        const defender = topDefenders[0];
        awards.push({
          title: 'Top Defender',
          name: defender.user.name,
          team: `${defender.successfulTackles} Tackle Points`,
          stat: defender.successfulTackles.toString(),
          statLabel: 'tackle points',
          icon: Shield,
          gradient: 'from-brand-red/20 to-brand-red-dark/10',
          borderAccent: 'border-brand-red/30',
          iconColor: 'text-brand-red',
          badgeBg: 'bg-brand-red/20 text-brand-red-light',
          playerId: defender.userId,
        });
      }

      return awards;
    },
    []
  );

  useEffect(() => {
    let cancelled = false;

    async function loadHomeData() {
      setLoading(true);
      setError(null);

      try {
        // Use the store's fetchHomeData which caches the result
        let data: StatsData | null = homeData as StatsData | null;

        if (!data) {
          data = (await fetchHomeData()) as StatsData | null;
        }

        if (cancelled || !data) return;

        // Live matches from stats API
        const matches: LiveMatch[] = Array.isArray(data.liveMatches)
          ? data.liveMatches
          : [];
        setLiveMatches(matches);

        // Recent completed matches
        const recent: CompletedMatch[] = Array.isArray(data.recentMatches)
          ? data.recentMatches
          : [];
        setRecentMatches(recent);

        // Upcoming matches
        const upcoming: UpcomingMatch[] = Array.isArray(data.upcomingMatches)
          ? data.upcomingMatches
          : [];
        setUpcomingMatches(upcoming);

        // Awards from top raiders/defenders
        const topRaiders = Array.isArray(data.topRaiders) ? data.topRaiders : [];
        const topDefenders = Array.isArray(data.topDefenders)
          ? data.topDefenders
          : [];
        setAwardPlayers(buildAwardPlayers(topRaiders, topDefenders));

        // MOTM awards
        const motm = Array.isArray(data.recentMotmAwards) ? data.recentMotmAwards : [];
        setMotmAwards(motm);
      } catch (err) {
        console.error('Failed to load home data:', err);
        setError('Failed to load data. Pull down to retry.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadHomeData();

    return () => {
      cancelled = true;
    };
  }, [fetchHomeData, homeData, buildAwardPlayers]);

  // Welcome back notification (once per session)
  useEffect(() => {
    if (!currentUser?.name) return;

    const existingTypes = new Set(notifications.map((n) => n.type));

    // Only generate if no notifications at all
    if (notifications.length === 0) {
      addNotification(welcomeBackNotification(currentUser.name));
    }

    // Upcoming match notification
    if (upcomingMatches.length > 0 && !existingTypes.has('match_start')) {
      const nextMatch = upcomingMatches[0];
      addNotification({
        type: 'match_start',
        title: 'Match Starting Soon',
        description: `${nextMatch.homeTeam.name} vs ${nextMatch.awayTeam.name} is coming up!`,
      });
    }

    // Achievement notification for returning users
    if (notifications.length > 2 && !existingTypes.has('achievement')) {
      addNotification({
        type: 'achievement',
        title: 'Dedicated Player',
        description: 'You\'ve been consistently active! Keep going for more achievements.',
      });
    }
  }, [currentUser?.name, upcomingMatches.length]);

  const handleMatchClick = (match: LiveMatch) => {
    toast({
      title: `${match.homeTeam.name} vs ${match.awayTeam.name}`,
      description: `Score: ${match.homeScore} - ${match.awayScore} | ${match.half === 1 ? '1st' : '2nd'} Half`,
    });
  };

  const handleRecentMatchClick = (match: CompletedMatch) => {
    setSelectedMatchId(match.id);
    setShowMatchDetails(true);
  };

  const handleShareClick = (match: CompletedMatch) => {
    setShareMatchData(match);
    setShowShareScorecard(true);
  };

  const handleAwardClick = (player: AwardPlayer) => {
    if (!isPremium) {
      setUpgradeFeature('Player Stats');
      setShowUpgrade(true);
      return;
    }
    toast({
      title: `${player.name}`,
      description: `${player.title} — ${player.stat} ${player.statLabel}`,
    });
  };

  const handleCopyPlayerCode = () => {
    if (currentUser?.playerCode) {
      navigator.clipboard.writeText(currentUser.playerCode);
      setCopiedCode(true);
      toast({ title: 'Copied!', description: `Player code ${currentUser.playerCode} copied` });
      setTimeout(() => setCopiedCode(false), 2000);
    }
  };

  const handleRetry = () => {
    useKabaddiStore.setState({ homeData: null });
    setLoading(true);
    setError(null);
    fetchHomeData()
      .then((data) => {
        if (data) {
          const matches: LiveMatch[] = Array.isArray(data.liveMatches)
            ? data.liveMatches
            : [];
          setLiveMatches(matches);
          const recent: CompletedMatch[] = Array.isArray(data.recentMatches)
            ? data.recentMatches
            : [];
          setRecentMatches(recent);
          const upcoming: UpcomingMatch[] = Array.isArray(data.upcomingMatches)
            ? data.upcomingMatches
            : [];
          setUpcomingMatches(upcoming);
          const topRaiders = Array.isArray(data.topRaiders) ? data.topRaiders : [];
          const topDefenders = Array.isArray(data.topDefenders)
            ? data.topDefenders
            : [];
          setAwardPlayers(buildAwardPlayers(topRaiders, topDefenders));
          const motm = Array.isArray(data.recentMotmAwards) ? data.recentMotmAwards : [];
          setMotmAwards(motm);
        }
      })
      .catch(() => setError('Failed to load data. Pull down to retry.'))
      .finally(() => setLoading(false));
  };

  // ─── Pull-to-Refresh Handlers ───
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if (isRefreshing) return;
    touchStartY.current = e.touches[0].clientY;
  }, [isRefreshing]);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (isRefreshing) return;
    const diff = e.touches[0].clientY - touchStartY.current;
    if (diff > 0) {
      // Apply rubber-band effect: distance grows slower as you pull more
      const rubberBanded = diff * 0.4;
      setPullDistance(Math.min(rubberBanded, pullThreshold * 1.8));
    }
  }, [isRefreshing, pullThreshold]);

  const handleTouchEnd = useCallback(() => {
    if (isRefreshing) return;
    if (pullDistance >= pullThreshold) {
      // Trigger refresh
      setIsRefreshing(true);
      setPullDistance(pullThreshold);

      useKabaddiStore.setState({ homeData: null });
      fetchHomeData()
        .then((data) => {
          if (data) {
            const matches: LiveMatch[] = Array.isArray(data.liveMatches)
              ? data.liveMatches
              : [];
            setLiveMatches(matches);
            const recent: CompletedMatch[] = Array.isArray(data.recentMatches)
              ? data.recentMatches
              : [];
            setRecentMatches(recent);
            const upcoming: UpcomingMatch[] = Array.isArray(data.upcomingMatches)
              ? data.upcomingMatches
              : [];
            setUpcomingMatches(upcoming);
            const topRaiders = Array.isArray(data.topRaiders) ? data.topRaiders : [];
            const topDefenders = Array.isArray(data.topDefenders)
              ? data.topDefenders
              : [];
            setAwardPlayers(buildAwardPlayers(topRaiders, topDefenders));
            const motm = Array.isArray(data.recentMotmAwards) ? data.recentMotmAwards : [];
            setMotmAwards(motm);
            toast({ title: 'Refreshed!', description: 'Data updated successfully' });
          }
        })
        .catch(() => {
          setError('Failed to refresh data.');
        })
        .finally(() => {
          setIsRefreshing(false);
          setPullDistance(0);
        });
    } else {
      // Snap back without refreshing
      setPullDistance(0);
    }
  }, [isRefreshing, pullDistance, pullThreshold, fetchHomeData, buildAwardPlayers, toast]);

  // Progress for the pull indicator (0 to 1)
  const pullProgress = Math.min(pullDistance / pullThreshold, 1);
  const isPastThreshold = pullDistance >= pullThreshold;

  const getTeamShortName = (team: TeamBasic | CompletedMatch['homeTeam'] | UpcomingMatch['homeTeam']): string => {
    if ('shortName' in team && team.shortName) return team.shortName;
    return team.name
      .split(' ')
      .map((w) => w[0])
      .join('')
      .toUpperCase()
      .slice(0, 3);
  };

  const halfLabel = (half: number): string => {
    return half === 1 ? '1st Half' : '2nd Half';
  };

  const formatTimeAgo = (dateStr: string | null) => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    if (diffMins < 60) return `${diffMins}m ago`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    const diffDays = Math.floor(diffHours / 24);
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return 'TBD';
    return new Date(dateStr).toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  // Filter live matches by gender
  const filteredMatches = liveMatches.filter((match) => {
    if (genderFilter === 'all') return true;
    if (genderFilter === 'boys') return match.gender?.toLowerCase() === 'male' || match.gender?.toLowerCase() === 'boys';
    if (genderFilter === 'girls') return match.gender?.toLowerCase() === 'female' || match.gender?.toLowerCase() === 'girls';
    return true;
  });

  // Gender icon for greeting
  const genderIcon = currentUser?.gender?.toLowerCase() === 'female' || currentUser?.gender?.toLowerCase() === 'girls'
    ? '♀'
    : '♂';

  // Compute stats values for banner
  const statsData = homeData as StatsData | null;
  const raidPts = awardPlayers.length > 0 ? parseInt(awardPlayers[0]?.stat ?? '0', 10) : 0;
  const tacklePts = awardPlayers.length > 1 ? parseInt(awardPlayers[1]?.stat ?? '0', 10) : 0;
  const totalMatches = statsData?.stats?.totalMatches ?? 0;

  return (
    <div
      className="min-h-screen bg-warm-50 dark:bg-warm-900 pb-6"
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      {/* ─── Pull-to-Refresh Indicator ─── */}
      <AnimatePresence>
        {(pullDistance > 0 || isRefreshing) && (
          <motion.div
            className="flex flex-col items-center justify-center py-3 overflow-hidden"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: Math.max(pullDistance * 0.6, isRefreshing ? 48 : 0), opacity: pullDistance > 0 || isRefreshing ? 1 : 0 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
          >
            <div className="flex flex-col items-center gap-1">
              {/* Animated icon */}
              {isRefreshing ? (
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                >
                  <RefreshCw className="w-5 h-5 text-brand-red" />
                </motion.div>
              ) : (
                <motion.div
                  animate={{
                    rotate: isPastThreshold ? 180 : pullProgress * 180,
                    scale: isPastThreshold ? 1.1 : 1,
                  }}
                  transition={{ type: 'spring', stiffness: 400, damping: 20 }}
                >
                  <ArrowDown className="w-5 h-5 text-brand-red" />
                </motion.div>
              )}
              {/* Progress arc / indicator */}
              {!isRefreshing && (
                <div className="relative w-8 h-8">
                  <svg className="w-8 h-8 -rotate-90" viewBox="0 0 32 32">
                    <circle
                      cx="16" cy="16" r="13"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.5"
                      className="text-warm-200 dark:text-warm-700"
                    />
                    <circle
                      cx="16" cy="16" r="13"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.5"
                      strokeLinecap="round"
                      className="text-brand-red"
                      strokeDasharray={`${pullProgress * 81.68} 81.68`}
                    />
                  </svg>
                </div>
              )}
              <span className="text-[10px] font-semibold text-brand-red">
                {isRefreshing
                  ? 'Refreshing...'
                  : isPastThreshold
                    ? 'Release to refresh'
                    : 'Pull to refresh'}
              </span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Overlays */}
      {showUpgrade && (
        <PremiumUpgradeScreen
          onClose={() => setShowUpgrade(false)}
          feature={upgradeFeature}
        />
      )}
      {showLeaderboard && (
        <LeaderboardScreen onClose={() => setShowLeaderboard(false)} />
      )}
      {showAwards && (
        <MatchAwardsScreen onClose={() => setShowAwards(false)} />
      )}
      {showNotifications && (
        <NotificationPanel
          onClose={() => setShowNotifications(false)}
          onNavigate={(screen) => {
            setShowNotifications(false);
            switch (screen) {
              case 'match-details':
                break;
              case 'achievements':
                setShowAchievements(true);
                break;
              case 'premium':
                setUpgradeFeature('Premium Features');
                setShowUpgrade(true);
                break;
            }
          }}
        />
      )}
      {showShareScorecard && shareMatchData && (
        <ShareScorecard
          onClose={() => {
            setShowShareScorecard(false);
            setShareMatchData(null);
          }}
          matchData={{
            homeTeam: shareMatchData.homeTeam.name,
            awayTeam: shareMatchData.awayTeam.name,
            homeScore: shareMatchData.homeScore,
            awayScore: shareMatchData.awayScore,
            homeTeamColor: shareMatchData.homeTeam.color || '#DC2626',
            awayTeamColor: shareMatchData.awayTeam.color || '#1E293B',
            tournament: shareMatchData.tournament?.name,
            date: shareMatchData.completedAt,
            gender: shareMatchData.gender,
          }}
        />
      )}
      {showMatchDetails && selectedMatchId && (
        <MatchDetailsScreen
          matchId={selectedMatchId}
          onClose={() => {
            setShowMatchDetails(false);
            setSelectedMatchId(null);
          }}
        />
      )}
      {showFollow && (
        <FollowScreen onClose={() => setShowFollow(false)} />
      )}
      {showSocialFeed && (
        <SocialFeedScreen onClose={() => setShowSocialFeed(false)} />
      )}
      {showHighlights && highlightsMatchId && (
        <MatchHighlightsScreen
          matchId={highlightsMatchId}
          onClose={() => {
            setShowHighlights(false);
            setHighlightsMatchId(null);
          }}
        />
      )}
      {showAdvancedStats && statsUserId && (
        <AdvancedStatsScreen
          userId={statsUserId}
          onClose={() => {
            setShowAdvancedStats(false);
            setStatsUserId(null);
          }}
        />
      )}
      {showStreaks && (
        <StreaksRecordsScreen onClose={() => setShowStreaks(false)} />
      )}
      {showAchievements && (
        <AchievementsScreen onClose={() => setShowAchievements(false)} />
      )}
      {showComparison && (
        <TeamComparisonScreen onClose={() => setShowComparison(false)} />
      )}
      {showGrounds && (
        <GroundsScreen onClose={() => setShowGrounds(false)} />
      )}
      {showReplay && replayMatchId && (
        <MatchReplayScreen
          matchId={replayMatchId}
          onClose={() => {
            setShowReplay(false);
            setReplayMatchId(null);
          }}
        />
      )}
      {showAIInsights && (
        <AIInsightsScreen onClose={() => setShowAIInsights(false)} />
      )}
      {showBroadcast && broadcastMatchId && (
        <BroadcastScreen
          matchId={broadcastMatchId}
          onClose={() => {
            setShowBroadcast(false);
            setBroadcastMatchId(null);
          }}
        />
      )}
      {showDataExport && (
        <DataExportScreen onClose={() => setShowDataExport(false)} />
      )}
      {showSeason && (
        <SeasonScreen onClose={() => setShowSeason(false)} />
      )}
      {showPolls && (
        <PollsScreen onClose={() => setShowPolls(false)} />
      )}
      {showPredictions && (
        <MatchPredictionScreen onClose={() => setShowPredictions(false)} />
      )}
      {showSponsors && (
        <SponsorScreen onClose={() => setShowSponsors(false)} />
      )}
      {showStats && currentUser?.id && (
        <PlayerStatsScreen userId={currentUser.id} onClose={() => setShowStats(false)} />
      )}
      {showRules && (
        <KabaddiRulesScreen onClose={() => setShowRules(false)} />
      )}

      {/* ─── Global Search Overlay ─── */}
      {showSearch && (
        <GlobalSearchScreen
          onClose={() => setShowSearch(false)}
        />
      )}
      {showMatchHistory && (
        <MatchHistoryScreen
          onClose={() => setShowMatchHistory(false)}
        />
      )}

      {/* ─── Header ─── */}
      <header className="sticky top-0 z-30 bg-warm-50/90 dark:bg-warm-900/90 backdrop-blur-md header-gradient-border">
        <div className="px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            {/* Logo with animated glow */}
            <div className="relative">
              <div className="absolute inset-0 rounded-lg bg-brand-red/30 blur-md animate-pulse" />
              <div className="relative w-9 h-9 rounded-lg bg-gradient-to-br from-brand-red via-brand-red-dark to-brand-navy flex items-center justify-center shadow-lg shadow-brand-red/30">
                <Trophy className="w-4.5 h-4.5 text-white" />
              </div>
            </div>
            <h1 className="text-base font-black tracking-wider">
              <span className="bg-gradient-to-r from-brand-red via-brand-red-light to-brand-gold bg-clip-text text-transparent">
                KABADDI
              </span>{' '}
              <span className="bg-gradient-to-r from-brand-gold via-brand-gold-light to-brand-gold bg-clip-text text-transparent">
                PRO
              </span>
            </h1>
            {isPremium && (
              <Badge className="bg-gradient-to-r from-brand-gold to-brand-gold-dark text-white text-[9px] border-0 font-bold px-1.5 py-0 relative overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent animate-[shimmer_3s_ease-in-out_infinite]" />
                <Crown className="w-2.5 h-2.5 mr-0.5" />
                PRO
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-2">
            {!isPremium && (
              <button
                onClick={() => {
                  setUpgradeFeature('Premium Features');
                  setShowUpgrade(true);
                }}
                className="flex items-center gap-1 px-2.5 py-1.5 rounded-full bg-gradient-to-r from-brand-gold-dark via-brand-gold to-brand-gold-light text-white text-[10px] font-bold shadow-md shadow-brand-gold/30 active:scale-95 transition-transform relative overflow-hidden"
              >
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent animate-[shimmer_2.5s_ease-in-out_infinite]" />
                <Crown className="w-3 h-3 relative z-10" />
                <span className="relative z-10">PRO</span>
              </button>
            )}
            <button
              onClick={() => setShowSearch(true)}
              className="p-2 rounded-full hover:bg-warm-100 dark:hover:bg-warm-800 transition-colors search-focus-ring focus:outline-none"
              aria-label="Search"
            >
              <Search className="w-5 h-5 text-warm-700 dark:text-warm-200" />
            </button>
            <button
              onClick={() => setShowNotifications(true)}
              className="relative p-2 rounded-full hover:bg-warm-100 dark:hover:bg-warm-800 transition-colors"
            >
              {unreadNotificationCount > 0 ? (
                <Bell className="w-5 h-5 text-warm-700 dark:text-warm-200" />
              ) : (
                <BellOff className="w-5 h-5 text-warm-400" />
              )}
              {unreadNotificationCount > 0 && (
                <motion.span
                  key={unreadNotificationCount}
                  initial={{ scale: 0.5 }}
                  animate={{ scale: 1 }}
                  transition={{ type: 'spring', damping: 12, stiffness: 280 }}
                  className="absolute top-0.5 right-0.5 flex items-center justify-center min-w-[16px] h-4 rounded-full bg-brand-red text-white text-[9px] font-bold px-1 badge-smooth-bounce"
                >
                  {unreadNotificationCount > 9 ? '9+' : unreadNotificationCount}
                </motion.span>
              )}
            </button>
          </div>
        </div>
      </header>

      {/* ─── Greeting ─── */}
      <div className="px-4 pt-4 pb-2">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-warm-500 dark:text-warm-400 text-xs font-medium uppercase tracking-wider flex items-center gap-1.5">
              <span>{getTimeEmoji()}</span>
              <span>{getTimeGreeting()}</span>
            </p>
            <h2 className="text-xl font-bold text-warm-800 dark:text-warm-100 mt-0.5">
              {currentUser?.name ?? 'Player'}{' '}
              <span className="text-base align-middle">
                {currentUser?.gender && (
                  <span className={currentUser.gender.toLowerCase() === 'female' || currentUser.gender.toLowerCase() === 'girls'
                    ? 'text-brand-red'
                    : 'text-brand-blue dark:text-brand-teal'
                  }>
                    {genderIcon}
                  </span>
                )}
              </span>
            </h2>
          </div>
          {/* Player Code */}
          {currentUser?.playerCode && (
            <motion.button
              onClick={handleCopyPlayerCode}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-warm-100 dark:bg-warm-800 border border-warm-200 dark:border-warm-700 hover:border-brand-gold/40 transition-colors active:scale-95"
              whileTap={{ scale: 0.95 }}
            >
              <span className="text-[10px] font-mono font-bold text-warm-500 dark:text-warm-400">{currentUser.playerCode}</span>
              {copiedCode ? (
                <Check className="w-3 h-3 text-emerald-500" />
              ) : (
                <Copy className="w-3 h-3 text-warm-400" />
              )}
            </motion.button>
          )}
        </div>
      </div>

      {/* ─── Quick Stats Banner ─── */}
      <div className="px-4 mt-2">
        <div className="bg-gradient-to-r from-brand-red via-brand-red-dark to-brand-navy rounded-2xl p-5 shadow-xl shadow-brand-red/25 overflow-hidden relative">
          {/* Decorative elements */}
          <div className="absolute -top-6 -right-6 w-24 h-24 rounded-full bg-white/10" />
          <div className="absolute -bottom-4 -left-4 w-20 h-20 rounded-full bg-white/5" />
          <div className="absolute top-2 right-20 w-8 h-8 rounded-full bg-white/5" />
          {/* Shimmer overlay */}
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent animate-[shimmer_4s_ease-in-out_infinite]" />
          <div className="relative z-10">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-md bg-white/10 flex items-center justify-center">
                  <Shield className="w-3.5 h-3.5 text-yellow-300" />
                </div>
                <span className="text-white/70 text-[10px] font-bold uppercase tracking-widest">Your Stats</span>
              </div>
              {currentUser?.playerCode && (
                <div className="px-2.5 py-1 rounded-md bg-white/10 border border-white/10">
                  <span className="text-white/80 text-[10px] font-mono font-bold">{currentUser.playerCode}</span>
                </div>
              )}
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="text-center">
                <div className="flex items-center justify-center gap-1">
                  <Swords className="w-3 h-3 text-brand-gold-light" />
                </div>
                <div className="text-2xl font-black text-white mt-1">
                  <AnimatedCounter target={raidPts} />
                </div>
                <div className="text-[9px] text-white/60 font-medium uppercase mt-0.5">Raid Pts</div>
              </div>
              <div className="text-center border-x border-white/10">
                <div className="flex items-center justify-center gap-1">
                  <Target className="w-3 h-3 text-brand-gold-light" />
                </div>
                <div className="text-2xl font-black text-white mt-1">
                  <AnimatedCounter target={tacklePts} />
                </div>
                <div className="text-[9px] text-white/60 font-medium uppercase mt-0.5">Tackle Pts</div>
              </div>
              <div className="text-center">
                <div className="flex items-center justify-center gap-1">
                  <Flame className="w-3 h-3 text-brand-gold-light" />
                </div>
                <div className="text-2xl font-black text-white mt-1">
                  <AnimatedCounter target={totalMatches} />
                </div>
                <div className="text-[9px] text-white/60 font-medium uppercase mt-0.5">Matches</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ─── Error State ─── */}
      {error && (
        <section className="px-4 mt-4">
          <Card className="bg-brand-red/20 border-brand-red/30 py-0 gap-0">
            <CardContent className="p-4 flex items-center gap-3">
              <Zap className="w-5 h-5 text-brand-red shrink-0" />
              <p className="text-warm-700 dark:text-warm-300 text-sm flex-1">{error}</p>
              <Button
                variant="outline"
                size="sm"
                onClick={handleRetry}
                className="text-brand-red border-brand-red/30 hover:bg-brand-red/20 text-xs"
              >
                Retry
              </Button>
            </CardContent>
          </Card>
        </section>
      )}

      {/* ─── Live Matches (FREE) ─── */}
      <section className="px-4 mt-5">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <h3 className="text-base font-bold text-warm-800 dark:text-warm-100">
              Live Matches
            </h3>
            <span className="relative flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-brand-red-light opacity-75" />
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-brand-red" />
            </span>
            <Badge className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-[9px] border-0 font-semibold">
              FREE
            </Badge>
          </div>
        </div>

        {/* Gender Filter Toggles */}
        <div className="flex items-center gap-2 mb-3">
          <button
            onClick={() => setGenderFilter('all')}
            className={`px-3.5 py-1.5 rounded-full text-xs font-semibold gender-pill ${
              genderFilter === 'all'
                ? 'bg-warm-800 dark:bg-warm-100 text-warm-50 dark:text-warm-900 shadow-sm'
                : 'bg-warm-100 dark:bg-warm-800 text-warm-600 dark:text-warm-400 hover:bg-warm-200 dark:hover:bg-warm-700'
            }`}
          >
            All
          </button>
          <button
            onClick={() => setGenderFilter('boys')}
            className={`px-3.5 py-1.5 rounded-full text-xs font-semibold gender-pill ${
              genderFilter === 'boys'
                ? 'bg-brand-blue text-white shadow-sm'
                : 'bg-brand-blue/10 text-brand-blue dark:text-brand-navy-light hover:bg-brand-blue/20'
            }`}
          >
            ♂ Boys
          </button>
          <button
            onClick={() => setGenderFilter('girls')}
            className={`px-3.5 py-1.5 rounded-full text-xs font-semibold gender-pill ${
              genderFilter === 'girls'
                ? 'bg-brand-red text-white shadow-sm'
                : 'bg-brand-red/10 text-brand-red hover:bg-brand-red/20'
            }`}
          >
            ♀ Girls
          </button>
        </div>

        <AnimatePresence mode="wait">
          {loading ? (
            <motion.div
              key="loading"
              className="flex flex-col gap-3"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <LiveMatchSkeleton />
              <LiveMatchSkeleton />
            </motion.div>
          ) : filteredMatches.length > 0 ? (
            <motion.div
              key="matches"
              className="flex flex-col gap-3"
              variants={stagger}
              initial="hidden"
              animate="show"
            >
              {filteredMatches.map((match) => (
                <motion.div key={match.id} variants={fadeUp}>
                  <motion.div
                    variants={cardHover}
                    initial="rest"
                    whileHover="hover"
                    whileTap={{ scale: 0.98 }}
                  >
                    <Card
                      className="bg-warm-100 dark:bg-warm-800 border-warm-300 dark:border-warm-700 cursor-pointer hover:border-brand-red/30 dark:hover:border-brand-red/30 transition-all duration-200 py-0 gap-0 overflow-hidden relative"
                      onClick={() => handleMatchClick(match)}
                    >
                      {/* Team color gradient strip at top */}
                      <div
                        className="h-1.5 w-full"
                        style={{
                          background: `linear-gradient(90deg, ${match.homeTeam.color || '#DC2626'}, ${match.awayTeam.color || '#1E293B'})`,
                        }}
                      />
                      <CardContent className="p-4 relative">
                        {/* Confetti on score change */}
                        <ConfettiParticles trigger={match.homeScore + match.awayScore} />
                        <div className="flex items-center justify-between mb-3">
                          <div className="flex items-center gap-2">
                            <Badge
                              variant="secondary"
                              className="bg-brand-red/20 text-brand-red text-[10px] font-semibold border-0 px-2 py-0.5 flex items-center gap-1 live-double-ring"
                            >
                              <span className="relative flex h-1.5 w-1.5">
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-brand-red-light opacity-75" />
                                <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-brand-red" />
                              </span>
                              LIVE
                            </Badge>
                            {match.gender && (
                              <Badge
                                variant="secondary"
                                className={`text-[10px] font-semibold border-0 px-2 py-0.5 ${
                                  match.gender.toLowerCase() === 'female' || match.gender.toLowerCase() === 'girls'
                                    ? 'bg-brand-red/15 text-brand-red'
                                    : 'bg-brand-blue/15 text-brand-blue dark:text-brand-navy-light'
                                }`}
                              >
                                {match.gender.toLowerCase() === 'female' || match.gender.toLowerCase() === 'girls'
                                  ? '♀ Girls Match'
                                  : '♂ Boys Match'}
                              </Badge>
                            )}
                          </div>
                          <span className="text-xs text-warm-500 dark:text-warm-400 font-medium">
                            {halfLabel(match.half)}
                          </span>
                        </div>
                        <div className="flex items-center justify-between">
                          <div className="flex flex-col items-center gap-1 flex-1">
                            <div
                              className="w-10 h-10 rounded-full bg-warm-50 dark:bg-warm-700 flex items-center justify-center text-xs font-bold text-warm-800 dark:text-warm-100 shadow-sm"
                              style={{
                                borderColor: match.homeTeam.color || '#DC2626',
                                borderWidth: 2,
                              }}
                            >
                              {getTeamShortName(match.homeTeam)}
                            </div>
                            <span className="text-xs text-warm-600 dark:text-warm-400 text-center leading-tight">
                              {match.homeTeam.name}
                            </span>
                          </div>
                          <div className="flex items-center gap-3 px-4">
                            <span className="text-2xl font-black text-warm-800 dark:text-warm-100 tabular-nums">
                              <NumberTicker value={match.homeScore} />
                            </span>
                            <span className="text-warm-400 text-sm font-medium">
                              vs
                            </span>
                            <span className="text-2xl font-black text-warm-800 dark:text-warm-100 tabular-nums">
                              <NumberTicker value={match.awayScore} />
                            </span>
                          </div>
                          <div className="flex flex-col items-center gap-1 flex-1">
                            <div
                              className="w-10 h-10 rounded-full bg-warm-50 dark:bg-warm-700 flex items-center justify-center text-xs font-bold text-warm-800 dark:text-warm-100 shadow-sm"
                              style={{
                                borderColor: match.awayTeam.color || '#DC2626',
                                borderWidth: 2,
                              }}
                            >
                              {getTeamShortName(match.awayTeam)}
                            </div>
                            <span className="text-xs text-warm-600 dark:text-warm-400 text-center leading-tight">
                              {match.awayTeam.name}
                            </span>
                          </div>
                        </div>
                        {match.tournament && (
                          <p className="text-[10px] text-warm-500 dark:text-warm-400 text-center mt-2">
                            {match.tournament.name}
                          </p>
                        )}
                      </CardContent>
                      {/* Live Commentary Ticker */}
                      <LiveCommentaryTicker
                        mode="compact"
                        events={
                          activeMatch && activeMatch.id === match.id
                            ? activeMatch.events
                            : []
                        }
                        match={
                          activeMatch && activeMatch.id === match.id
                            ? toCommentaryMatchInfo(activeMatch)
                            : {
                                homeTeamId: match.homeTeam.id,
                                awayTeamId: match.awayTeam.id,
                                homeTeam: match.homeTeam.name,
                                awayTeam: match.awayTeam.name,
                                homeTeamColor: match.homeTeam.color ?? '#DC2626',
                                awayTeamColor: match.awayTeam.color ?? '#1E293B',
                              }
                        }
                        onExpand={() => handleMatchClick(match)}
                      />
                    </Card>
                  </motion.div>
                </motion.div>
              ))}
            </motion.div>
          ) : (
            <motion.div
              key="empty"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
            >
              <Card className="bg-warm-100 dark:bg-warm-800 border-warm-300 dark:border-warm-700 py-0 gap-0 overflow-hidden">
                <CardContent className="flex flex-col items-center justify-center py-10 px-4">
                  <div className="relative mb-4">
                    <div className="w-16 h-16 rounded-full bg-warm-200 dark:bg-warm-700 flex items-center justify-center">
                      <Radio className="w-8 h-8 text-warm-400 dark:text-warm-500" />
                    </div>
                    <div className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-warm-300 dark:bg-warm-600 flex items-center justify-center">
                      <span className="text-[8px]">💤</span>
                    </div>
                  </div>
                  <p className="text-warm-700 dark:text-warm-200 text-sm font-bold">
                    {genderFilter !== 'all'
                      ? `No live ${genderFilter} matches right now`
                      : 'No Live Matches'}
                  </p>
                  <p className="text-warm-500 dark:text-warm-400 text-xs mt-1 text-center">
                    Matches will appear here when they go live
                  </p>
                  <Button
                    variant="outline"
                    size="sm"
                    className="mt-4 text-brand-red border-brand-red/30 hover:bg-brand-red/10 text-xs font-semibold"
                    onClick={() => {
                      // Navigate to quick score via store
                      toast({ title: 'Start Scoring', description: 'Go to the Quick Score tab to start a match!' });
                    }}
                  >
                    <Play className="w-3 h-3 mr-1" />
                    Start Scoring
                  </Button>
                </CardContent>
              </Card>
            </motion.div>
          )}
        </AnimatePresence>
      </section>

      {/* ─── Recent Results / Match History ─── */}
      {!loading && recentMatches.length > 0 && (
        <section className="px-4 mt-6">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <h3 className="text-base font-bold text-warm-800 dark:text-warm-100">Recent Results</h3>
              <Clock className="w-4 h-4 text-warm-400" />
            </div>
          </div>
          <motion.div
            className="flex flex-col gap-3"
            variants={stagger}
            initial="hidden"
            animate="show"
          >
            {recentMatches.slice(0, 5).map((match) => {
              const isHomeWin = match.homeScore > match.awayScore;
              const isDraw = match.homeScore === match.awayScore;
              return (
                <motion.div key={match.id} variants={fadeUp}>
                  <Card
                    className="bg-warm-100 dark:bg-warm-800 border-warm-300 dark:border-warm-700 cursor-pointer hover:border-warm-200 dark:hover:border-warm-600 transition-all duration-200 py-0 gap-0 overflow-hidden"
                    onClick={() => handleRecentMatchClick(match)}
                  >
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between mb-2">
                        <Badge className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-[10px] font-semibold border-0 px-2 py-0.5">
                          ✓ COMPLETED
                        </Badge>
                        <span className="text-[10px] text-warm-400 dark:text-warm-500">
                          {formatTimeAgo(match.completedAt)}
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 flex-1 min-w-0">
                          <div
                            className="w-8 h-8 rounded-full flex items-center justify-center text-[10px] font-bold text-white shrink-0 shadow-sm"
                            style={{ backgroundColor: match.homeTeam.color || '#DC2626' }}
                          >
                            {getTeamShortName(match.homeTeam)}
                          </div>
                          <span className={`text-sm font-semibold truncate ${isHomeWin && !isDraw ? 'text-warm-800 dark:text-warm-100' : 'text-warm-500 dark:text-warm-400'}`}>
                            {match.homeTeam.name}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 px-3">
                          <span className={`text-lg font-black ${isHomeWin && !isDraw ? 'text-warm-800 dark:text-warm-100' : 'text-warm-500 dark:text-warm-400'}`}>
                            {match.homeScore}
                          </span>
                          <span className="text-warm-400 text-xs">-</span>
                          <span className={`text-lg font-black ${!isHomeWin && !isDraw ? 'text-warm-800 dark:text-warm-100' : 'text-warm-500 dark:text-warm-400'}`}>
                            {match.awayScore}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 flex-1 min-w-0 justify-end">
                          <span className={`text-sm font-semibold truncate ${!isHomeWin && !isDraw ? 'text-warm-800 dark:text-warm-100' : 'text-warm-500 dark:text-warm-400'}`}>
                            {match.awayTeam.name}
                          </span>
                          <div
                            className="w-8 h-8 rounded-full flex items-center justify-center text-[10px] font-bold text-white shrink-0 shadow-sm"
                            style={{ backgroundColor: match.awayTeam.color || '#1E293B' }}
                          >
                            {getTeamShortName(match.awayTeam)}
                          </div>
                        </div>
                      </div>
                      {match.tournament && (
                        <p className="text-[10px] text-warm-400 dark:text-warm-500 text-center mt-2">
                          {match.tournament.name}
                        </p>
                      )}
                      {/* Share button */}
                      <div className="flex justify-end mt-2">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleShareClick(match);
                          }}
                          className="p-1.5 rounded-lg hover:bg-warm-200 dark:hover:bg-warm-700 transition-colors text-warm-400 hover:text-brand-teal"
                        >
                          <Share2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              );
            })}
          </motion.div>
        </section>
      )}

      {/* ─── Upcoming Matches ─── */}
      {!loading && upcomingMatches.length > 0 && (
        <section className="px-4 mt-6">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <h3 className="text-base font-bold text-warm-800 dark:text-warm-100">Upcoming Matches</h3>
              <Calendar className="w-4 h-4 text-brand-teal" />
            </div>
          </div>
          <motion.div
            className="flex flex-col gap-3"
            variants={stagger}
            initial="hidden"
            animate="show"
          >
            {upcomingMatches.slice(0, 5).map((match) => {
              const isFemale = match.gender?.toLowerCase() === 'female' || match.gender?.toLowerCase() === 'girls';
              const gradientFrom = match.homeTeam.color || '#DC2626';
              const gradientTo = match.awayTeam.color || '#1E293B';
              return (
                <motion.div key={match.id} variants={fadeUp}>
                  <Card className="py-0 gap-0 overflow-hidden relative border-0">
                    {/* Gradient background layer */}
                    <div
                      className="absolute inset-0 opacity-[0.07] dark:opacity-[0.12]"
                      style={{
                        background: `linear-gradient(135deg, ${gradientFrom}, ${gradientTo})`,
                      }}
                    />
                    <CardContent className="p-4 relative z-10">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-1.5">
                          <Badge className="bg-brand-teal/10 text-brand-teal text-[10px] font-semibold border-0 px-2 py-0.5">
                            📅 UPCOMING
                          </Badge>
                          {match.gender && (
                            <Badge
                              className={`text-[9px] font-bold border-0 px-1.5 py-0.5 ${
                                isFemale
                                  ? 'bg-pink-100 text-pink-600 dark:bg-pink-900/30 dark:text-pink-400'
                                  : 'bg-sky-100 text-sky-600 dark:bg-sky-900/30 dark:text-sky-400'
                              }`}
                            >
                              {isFemale ? '♀' : '♂'}
                            </Badge>
                          )}
                        </div>
                        <span className="text-[10px] text-warm-400 dark:text-warm-500">
                          {formatDate(match.startedAt)}
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 flex-1 min-w-0">
                          <div
                            className="w-8 h-8 rounded-full flex items-center justify-center text-[10px] font-bold text-white shrink-0 shadow-sm ring-2 ring-white/30"
                            style={{ backgroundColor: match.homeTeam.color || '#DC2626' }}
                          >
                            {getTeamShortName(match.homeTeam)}
                          </div>
                          <span className="text-sm font-semibold text-warm-700 dark:text-warm-300 truncate">
                            {match.homeTeam.name}
                          </span>
                        </div>
                        <span className="text-warm-400 text-xs font-medium px-2">vs</span>
                        <div className="flex items-center gap-2 flex-1 min-w-0 justify-end">
                          <span className="text-sm font-semibold text-warm-700 dark:text-warm-300 truncate">
                            {match.awayTeam.name}
                          </span>
                          <div
                            className="w-8 h-8 rounded-full flex items-center justify-center text-[10px] font-bold text-white shrink-0 shadow-sm ring-2 ring-white/30"
                            style={{ backgroundColor: match.awayTeam.color || '#1E293B' }}
                          >
                            {getTeamShortName(match.awayTeam)}
                          </div>
                        </div>
                      </div>
                      {/* Venue info */}
                      {(match.tournament || match.startedAt) && (
                        <div className="flex items-center justify-center gap-1 mt-2">
                          <MapPin className="w-3 h-3 text-warm-400 dark:text-warm-500" />
                          <p className="text-[10px] text-warm-400 dark:text-warm-500">
                            {match.tournament?.name || 'Kabaddi Arena'}
                          </p>
                        </div>
                      )}
                      {/* Countdown Timer */}
                      <div className="mt-3 py-2 px-3 rounded-lg bg-warm-50/80 dark:bg-warm-900/50 border border-warm-200/60 dark:border-warm-700/40">
                        <CountdownTimer targetDate={match.startedAt} />
                      </div>
                      <div className="flex justify-end mt-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 text-[11px] text-brand-teal hover:text-brand-teal-dark hover:bg-brand-teal/10 px-2"
                          onClick={() => {
                            addNotification({
                              type: 'general',
                              title: 'Reminder Set',
                              description: `${match.homeTeam.name} vs ${match.awayTeam.name} - ${formatDate(match.startedAt)}`,
                            });
                            toast({
                              title: 'Reminder Set',
                              description: `You'll be notified before ${match.homeTeam.name} vs ${match.awayTeam.name}`,
                            });
                          }}
                        >
                          <Bell className="w-3 h-3 mr-1 bell-ring-anim" />
                          Set Reminder
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              );
            })}
          </motion.div>
        </section>
      )}

      {/* ─── Awards & Honors (Premium for detailed stats) ─── */}
      <section className="px-4 mt-6">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <h3 className="text-base font-bold text-warm-800 dark:text-warm-100">
              Awards & Honors
            </h3>
            <Zap className="w-4 h-4 text-brand-gold" />
          </div>
          {!isPremium && (
            <button
              onClick={() => {
                setUpgradeFeature('Player Stats');
                setShowUpgrade(true);
              }}
              className="flex items-center gap-1 text-[10px] font-bold text-brand-gold"
            >
              <Lock className="w-3 h-3" />
              Full Stats
            </button>
          )}
        </div>

        {loading ? (
          <div className="flex flex-col gap-3">
            <AwardSkeleton />
            <AwardSkeleton />
          </div>
        ) : (awardPlayers.length > 0 || motmAwards.length > 0) ? (
          <div className="flex flex-col gap-3">
            {/* MOTM Award Card */}
            {motmAwards.length > 0 && (() => {
              const motm = motmAwards[0];
              return (
                <motion.div
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.1 }}
                  whileHover={{ scale: 1.015 }}
                >
                  <Card
                    className="bg-gradient-to-r from-brand-gold/15 via-brand-gold/10 to-brand-gold-dark/5 border py-0 gap-0 overflow-hidden cursor-pointer relative"
                    onClick={() => setShowAwards(true)}
                  >
                    {/* Rotating gold shimmer border */}
                    <div className="absolute inset-0 rounded-lg gold-shimmer-border" style={{ WebkitMask: 'linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)', WebkitMaskComposite: 'xor', maskComposite: 'exclude', padding: '2px' }} />
                    {/* Shimmer on MOTM card */}
                    <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent animate-[shimmer_4s_ease-in-out_infinite]" />
                    <CardContent className="p-4 relative z-10">
                      <div className="flex items-center gap-3">
                        <div className="relative shrink-0">
                          <div className="w-14 h-14 rounded-full bg-warm-100 dark:bg-warm-700 border-2 border-brand-gold/40 flex items-center justify-center overflow-hidden shadow-md shadow-brand-gold/20">
                            {motm.userAvatar ? (
                              <img src={motm.userAvatar} alt={motm.userName} className="w-full h-full object-cover" />
                            ) : (
                              <div className="w-12 h-12 rounded-full bg-gradient-to-br from-brand-gold/20 to-brand-gold-dark/20 flex items-center justify-center text-lg font-bold text-brand-gold-dark dark:text-brand-gold">
                                {motm.userName.charAt(0)}
                              </div>
                            )}
                          </div>
                          <div className="absolute -bottom-0.5 -right-0.5 w-6 h-6 rounded-full bg-gradient-to-br from-brand-gold to-brand-gold-dark flex items-center justify-center shadow-md">
                            <Crown className="w-3 h-3 text-warm-800" />
                          </div>
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-lg">🥇</span>
                            <Badge className="bg-brand-gold/20 text-brand-gold-dark dark:text-brand-gold text-[10px] font-semibold border-0 px-2 py-0.5">
                              <Trophy className="w-2.5 h-2.5 mr-0.5" />
                              Man of the Match
                            </Badge>
                          </div>
                          <p className="text-warm-800 dark:text-warm-100 font-bold text-sm truncate">
                            {motm.userName}
                          </p>
                          <p className="text-warm-600 dark:text-warm-400 text-xs">
                            {motm.points} points · {motm.matchInfo}
                          </p>
                        </div>
                        <ChevronRight className="w-4 h-4 text-warm-400" />
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              );
            })()}

            {/* Existing Awards (Top Raider, Top Defender) */}
            {awardPlayers.map((player, idx) => {
              const Icon = player.icon;
              const medal = idx === 0 ? '🥇' : '🥈';
              return (
                <motion.div
                  key={player.title}
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.2 + idx * 0.12 }}
                  whileHover={{ scale: 1.015 }}
                >
                  <Card
                    className={`bg-gradient-to-r ${player.gradient} ${player.borderAccent} border py-0 gap-0 overflow-hidden relative cursor-pointer`}
                    onClick={() => handleAwardClick(player)}
                  >
                    {/* Gradient overlay on award cards */}
                    <div className="absolute inset-0 bg-gradient-to-br from-white/10 via-transparent to-white/5 dark:from-white/5 dark:via-transparent dark:to-white/0 pointer-events-none" />
                    <CardContent className="p-4 relative z-10">
                      <div className="flex items-center gap-3">
                        <div className="relative shrink-0">
                          <div className="w-14 h-14 rounded-full bg-warm-100 dark:bg-warm-700 border-2 border-brand-gold/30 flex items-center justify-center overflow-hidden shadow-sm">
                            <div className="w-12 h-12 rounded-full bg-gradient-to-br from-warm-200 to-warm-100 dark:from-warm-600 dark:to-warm-700 flex items-center justify-center text-lg font-bold text-warm-600 dark:text-warm-300">
                              {player.name.charAt(0)}
                            </div>
                          </div>
                          <div className="absolute -bottom-0.5 -right-0.5 w-6 h-6 rounded-full bg-gradient-to-br from-brand-gold to-brand-gold-dark flex items-center justify-center shadow-md">
                            <Icon className="w-3 h-3 text-warm-800" />
                          </div>
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-sm">{medal}</span>
                            <Badge
                              className={`${player.badgeBg} text-[10px] font-semibold border-0 px-2 py-0.5 mb-1`}
                            >
                              {player.title}
                            </Badge>
                            {!isPremium && (
                              <Badge className="bg-brand-gold/20 text-brand-gold text-[8px] border-0 px-1.5 py-0 mb-1 relative overflow-hidden">
                                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent animate-[shimmer_2s_ease-in-out_infinite]" />
                                <Lock className="w-2 h-2 mr-0.5" />
                                PRO
                              </Badge>
                            )}
                          </div>
                          <p className="text-warm-800 dark:text-warm-100 font-bold text-sm truncate">
                            {player.name}
                          </p>
                          <p className="text-warm-600 dark:text-warm-400 text-xs">
                            {player.team}
                          </p>
                        </div>
                        <div className="text-right shrink-0">
                          <p className="text-brand-gold dark:text-brand-gold-light font-black text-base leading-none">
                            {player.stat}
                          </p>
                          <p className="text-warm-500 dark:text-warm-400 text-[10px] mt-0.5">
                            {player.statLabel}
                          </p>
                          {!isPremium && (
                            <p className="text-brand-gold text-[9px] mt-1 font-semibold flex items-center justify-end gap-0.5">
                              <BarChart3 className="w-2.5 h-2.5" />
                              Tap for stats
                            </p>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              );
            })}
          </div>
        ) : (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <Card className="bg-warm-100 dark:bg-warm-800 border-warm-300 dark:border-warm-700 py-0 gap-0 overflow-hidden">
              <CardContent className="flex flex-col items-center justify-center py-10 px-4">
                <div className="relative mb-3 trophy-float">
                  <div className="w-16 h-16 rounded-full bg-brand-gold/10 flex items-center justify-center">
                    <Award className="w-8 h-8 text-brand-gold/60" />
                  </div>
                  <div className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-warm-200 dark:bg-warm-700 flex items-center justify-center">
                    <span className="text-[8px]">🏆</span>
                  </div>
                </div>
                <p className="text-warm-700 dark:text-warm-200 text-sm font-bold">
                  No awards yet
                </p>
                <p className="text-warm-500 dark:text-warm-400 text-xs mt-1 text-center">
                  Play matches to see top performers here
                </p>
              </CardContent>
            </Card>
          </motion.div>
        )}
      </section>

      {/* ─── Leaderboard Preview ─── */}
      <section className="px-4 mt-6">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <h3 className="text-base font-bold text-warm-800 dark:text-warm-100">Leaderboard</h3>
            <BarChart3 className="w-4 h-4 text-brand-teal" />
          </div>
          <motion.button
            onClick={() => setShowLeaderboard(true)}
            className="flex items-center gap-1 px-3 py-1.5 rounded-full bg-gradient-to-r from-brand-red to-brand-red-dark text-white text-[11px] font-bold shadow-sm shadow-brand-red/20 active:scale-95 transition-transform"
            whileTap={{ scale: 0.95 }}
          >
            View Full
            <ChevronRight className="w-3 h-3" />
          </motion.button>
        </div>

        {loading ? (
          <div className="flex gap-3 overflow-x-auto pb-2 custom-scrollbar">
            {[1, 2, 3].map((i) => (
              <div key={i} className="w-28 h-32 rounded-xl bg-warm-100 dark:bg-warm-800 animate-pulse shrink-0" />
            ))}
          </div>
        ) : (
          <div className="flex gap-3 overflow-x-auto pb-2 custom-scrollbar">
            {/* Top 3 Leaderboard Preview Cards */}
            {[1, 2, 3].map((rank) => (
              <LeaderboardPreviewCard
                key={rank}
                rank={rank}
                category="raiders"
              />
            ))}
            {/* "See More" Card */}
            <motion.button
              onClick={() => setShowLeaderboard(true)}
              className="w-28 shrink-0 rounded-xl bg-gradient-to-br from-brand-red/10 to-brand-red/5 dark:from-brand-red/20 dark:to-brand-red/10 border border-brand-red/20 flex flex-col items-center justify-center gap-2 p-3"
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.97 }}
            >
              <div className="w-10 h-10 rounded-full bg-brand-red/10 flex items-center justify-center">
                <ChevronRight className="w-5 h-5 text-brand-red" />
              </div>
              <span className="text-[10px] font-bold text-brand-red text-center">
                View Full Leaderboard
              </span>
            </motion.button>
          </div>
        )}
      </section>

      {/* ─── Explore ─── */}
      <section className="px-4 mt-6">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <h3 className="text-base font-bold text-warm-800 dark:text-warm-100">Explore</h3>
            <Sparkles className="w-4 h-4 text-brand-gold" />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          {/* Social Feed */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
          >
            <Card
              className="p-3 cursor-pointer hover:border-brand-teal/40 dark:hover:border-brand-teal/30 transition-all duration-200 active:scale-[0.98] hover:scale-[1.03] hover:shadow-md hover:shadow-brand-teal/5 border-glow-hover bg-gradient-to-br from-teal-50/60 to-warm-50 dark:from-teal-900/15 dark:to-warm-800 border-warm-200 dark:border-warm-700"
              onClick={() => setShowSocialFeed(true)}
            >
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-2xl bg-gradient-to-br from-brand-teal/20 to-brand-teal/5 flex items-center justify-center">
                  <Rss className="w-4 h-4 text-brand-teal" />
                </div>
                <div>
                  <p className="text-xs font-semibold text-warm-800 dark:text-warm-100">Social Feed</p>
                  <p className="text-[10px] text-warm-500 dark:text-warm-400">Activity updates</p>
                </div>
              </div>
            </Card>
          </motion.div>

          {/* Follow & Connect */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 }}
          >
            <Card
              className="p-3 cursor-pointer hover:border-brand-navy/40 dark:hover:border-brand-navy-light/30 transition-all duration-200 active:scale-[0.98] hover:scale-[1.03] hover:shadow-md hover:shadow-brand-navy/5 border-glow-hover bg-gradient-to-br from-slate-50/60 to-warm-50 dark:from-slate-900/15 dark:to-warm-800 border-warm-200 dark:border-warm-700"
              onClick={() => setShowFollow(true)}
            >
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-2xl bg-gradient-to-br from-brand-navy/20 dark:from-brand-navy-light/20 to-brand-navy/5 dark:to-brand-navy-light/5 flex items-center justify-center">
                  <Users className="w-4 h-4 text-brand-navy dark:text-brand-navy-light" />
                </div>
                <div>
                  <p className="text-xs font-semibold text-warm-800 dark:text-warm-100">Follow</p>
                  <p className="text-[10px] text-warm-500 dark:text-warm-400">Find players</p>
                </div>
              </div>
            </Card>
          </motion.div>

          {/* Match History */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
          >
            <Card
              className="p-3 cursor-pointer hover:border-brand-red/40 dark:hover:border-brand-red/30 transition-all duration-200 active:scale-[0.98] hover:scale-[1.03] hover:shadow-md hover:shadow-brand-red/5 border-glow-hover bg-gradient-to-br from-red-50/60 to-warm-50 dark:from-red-900/15 dark:to-warm-800 border-warm-200 dark:border-warm-700"
              onClick={() => setShowMatchHistory(true)}
            >
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-2xl bg-gradient-to-br from-brand-red/20 to-brand-red/5 flex items-center justify-center">
                  <Calendar className="w-4 h-4 text-brand-red" />
                </div>
                <div>
                  <p className="text-xs font-semibold text-warm-800 dark:text-warm-100">Match History</p>
                  <p className="text-[10px] text-warm-500 dark:text-warm-400">Past matches</p>
                </div>
              </div>
            </Card>
          </motion.div>

          {/* Advanced Stats */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.22 }}
          >
            <Card
              className="p-3 cursor-pointer hover:border-brand-red/40 dark:hover:border-brand-red/30 transition-all duration-200 active:scale-[0.98] hover:scale-[1.03] hover:shadow-md hover:shadow-brand-red/5 border-glow-hover bg-gradient-to-br from-red-50/60 to-warm-50 dark:from-red-900/15 dark:to-warm-800 border-warm-200 dark:border-warm-700"
              onClick={() => {
                if (currentUser?.id) {
                  setShowStats(true);
                }
              }}
            >
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-2xl bg-gradient-to-br from-brand-red/20 to-brand-red/5 flex items-center justify-center">
                  <Activity className="w-4 h-4 text-brand-red" />
                </div>
                <div>
                  <p className="text-xs font-semibold text-warm-800 dark:text-warm-100">My Stats</p>
                  <p className="text-[10px] text-warm-500 dark:text-warm-400">View your stats</p>
                </div>
              </div>
            </Card>
          </motion.div>

          {/* Rules & Tutorial */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.22 }}
          >
            <Card
              className="p-3 cursor-pointer hover:border-brand-teal/40 dark:hover:border-brand-teal/30 transition-all duration-200 active:scale-[0.98] hover:scale-[1.03] hover:shadow-md hover:shadow-brand-teal/5 border-glow-hover bg-gradient-to-br from-emerald-50/60 to-warm-50 dark:from-emerald-900/15 dark:to-warm-800 border-warm-200 dark:border-warm-700"
              onClick={() => setShowRules(true)}
            >
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-2xl bg-gradient-to-br from-brand-teal/20 to-brand-teal/5 flex items-center justify-center">
                  <BookOpen className="w-4 h-4 text-brand-teal" />
                </div>
                <div>
                  <p className="text-xs font-semibold text-warm-800 dark:text-warm-100">Rules</p>
                  <p className="text-[10px] text-warm-500 dark:text-warm-400">Learn the game</p>
                </div>
              </div>
            </Card>
          </motion.div>

          {/* Match Highlights */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.25 }}
          >
            <Card
              className="p-3 cursor-pointer hover:border-brand-gold/40 dark:hover:border-brand-gold/30 transition-all duration-200 active:scale-[0.98] hover:scale-[1.03] hover:shadow-md hover:shadow-brand-gold/5 border-glow-hover bg-gradient-to-br from-amber-50/60 to-warm-50 dark:from-amber-900/15 dark:to-warm-800 border-warm-200 dark:border-warm-700"
              onClick={() => {
                if (recentMatches.length > 0) {
                  setHighlightsMatchId(recentMatches[0].id);
                  setShowHighlights(true);
                } else {
                  toast({ title: 'No matches', description: 'Complete a match to see highlights' });
                }
              }}
            >
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-2xl bg-gradient-to-br from-brand-gold/20 to-brand-gold/5 flex items-center justify-center">
                  <Sparkles className="w-4 h-4 text-brand-gold" />
                </div>
                <div>
                  <p className="text-xs font-semibold text-warm-800 dark:text-warm-100">Highlights</p>
                  <p className="text-[10px] text-warm-500 dark:text-warm-400">Key moments</p>
                </div>
              </div>
            </Card>
          </motion.div>
        </div>

        {/* Phase 5: More Actions */}
        <div className="grid grid-cols-2 gap-3 mt-3">
          {/* Achievements */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
          >
            <Card
              className="p-3 cursor-pointer hover:border-brand-gold/40 dark:hover:border-brand-gold/30 transition-all duration-200 active:scale-[0.98] hover:scale-[1.03] hover:shadow-md hover:shadow-brand-gold/5 border-glow-hover bg-gradient-to-br from-amber-50/60 to-warm-50 dark:from-amber-900/15 dark:to-warm-800 border-warm-200 dark:border-warm-700"
              onClick={() => setShowStreaks(true)}
            >
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-2xl bg-gradient-to-br from-brand-gold/20 to-brand-gold/5 flex items-center justify-center">
                  <Award className="w-4 h-4 text-brand-gold" />
                </div>
                <div>
                  <p className="text-xs font-semibold text-warm-800 dark:text-warm-100">Achievements</p>
                  <p className="text-[10px] text-warm-500 dark:text-warm-400">Streaks & records</p>
                </div>
              </div>
            </Card>
          </motion.div>

          {/* Compare Teams */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.35 }}
          >
            <Card
              className="p-3 cursor-pointer hover:border-brand-red/40 dark:hover:border-brand-red/30 transition-all duration-200 active:scale-[0.98] hover:scale-[1.03] hover:shadow-md hover:shadow-brand-red/5 border-glow-hover bg-gradient-to-br from-red-50/60 to-warm-50 dark:from-red-900/15 dark:to-warm-800 border-warm-200 dark:border-warm-700"
              onClick={() => setShowComparison(true)}
            >
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-2xl bg-gradient-to-br from-brand-red/20 to-brand-red/5 flex items-center justify-center">
                  <Swords className="w-4 h-4 text-brand-red" />
                </div>
                <div>
                  <p className="text-xs font-semibold text-warm-800 dark:text-warm-100">Compare Teams</p>
                  <p className="text-[10px] text-warm-500 dark:text-warm-400">Head-to-head</p>
                </div>
              </div>
            </Card>
          </motion.div>

          {/* Grounds */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
          >
            <Card
              className="p-3 cursor-pointer hover:border-brand-teal/40 dark:hover:border-brand-teal/30 transition-all duration-200 active:scale-[0.98] hover:scale-[1.03] hover:shadow-md hover:shadow-brand-teal/5 border-glow-hover bg-gradient-to-br from-teal-50/60 to-warm-50 dark:from-teal-900/15 dark:to-warm-800 border-warm-200 dark:border-warm-700"
              onClick={() => setShowGrounds(true)}
            >
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-2xl bg-gradient-to-br from-brand-teal/20 to-brand-teal/5 flex items-center justify-center">
                  <MapPin className="w-4 h-4 text-brand-teal" />
                </div>
                <div>
                  <p className="text-xs font-semibold text-warm-800 dark:text-warm-100">Grounds</p>
                  <p className="text-[10px] text-warm-500 dark:text-warm-400">Find venues</p>
                </div>
              </div>
            </Card>
          </motion.div>

          {/* Match Replay */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.45 }}
          >
            <Card
              className="p-3 cursor-pointer hover:border-brand-navy/40 dark:hover:border-brand-navy-light/30 transition-all duration-200 active:scale-[0.98] hover:scale-[1.03] hover:shadow-md hover:shadow-brand-navy/5 border-glow-hover bg-gradient-to-br from-slate-50/60 to-warm-50 dark:from-slate-900/15 dark:to-warm-800 border-warm-200 dark:border-warm-700"
              onClick={() => {
                if (recentMatches.length > 0) {
                  setReplayMatchId(recentMatches[0].id);
                  setShowReplay(true);
                } else {
                  toast({ title: 'No matches', description: 'Complete a match to replay' });
                }
              }}
            >
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-2xl bg-gradient-to-br from-brand-navy/20 dark:from-brand-navy-light/20 to-brand-navy/5 dark:to-brand-navy-light/5 flex items-center justify-center">
                  <Play className="w-4 h-4 text-brand-navy dark:text-brand-navy-light" />
                </div>
                <div>
                  <p className="text-xs font-semibold text-warm-800 dark:text-warm-100">Replay</p>
                  <p className="text-[10px] text-warm-500 dark:text-warm-400">Watch again</p>
                </div>
              </div>
            </Card>
          </motion.div>
        </div>

        {/* Advanced Phase 5: Pro Features */}
        <div className="flex items-center gap-2 mt-5 mb-3">
          <h3 className="text-sm font-bold text-warm-800 dark:text-warm-100 shimmer-sweep-text">Pro Features</h3>
          <Badge className="bg-gradient-to-r from-brand-gold to-brand-gold-dark text-white text-[9px] border-0 font-bold px-1.5 py-0 flex items-center gap-0.5 relative overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent animate-[shimmer_2.5s_ease-in-out_infinite]" />
            <Crown className="w-2.5 h-2.5" />
            PRO
          </Badge>
        </div>
        <div className="grid grid-cols-2 gap-3">
          {/* AI Insights */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
          >
            <Card
              className="p-3 cursor-pointer hover:border-purple-400/40 dark:hover:border-purple-400/30 transition-all duration-200 active:scale-[0.98] hover:scale-[1.03] hover:shadow-md hover:shadow-purple-500/5 relative overflow-hidden bg-gradient-to-br from-purple-50/60 to-warm-50 dark:from-purple-900/15 dark:to-warm-800 border-warm-200 dark:border-warm-700 golden-border-hover lock-shake-hover"
              onClick={() => setShowAIInsights(true)}
            >
              {/* Golden border shimmer */}
              <div className="absolute inset-0 rounded-lg border border-brand-gold/20 animate-[shimmer_5s_ease-in-out_infinite]" style={{ background: 'linear-gradient(90deg, transparent, rgba(245,158,11,0.06), transparent)' }} />
              <div className="flex items-center gap-2.5 relative z-10">
                <div className="w-9 h-9 rounded-2xl bg-gradient-to-br from-purple-500/20 to-purple-500/5 flex items-center justify-center relative">
                  <Brain className="w-4 h-4 text-purple-500" />
                  <Lock className="w-2 h-2 text-brand-gold absolute -top-0.5 -right-0.5 lock-icon" />
                </div>
                <div>
                  <p className="text-xs font-semibold text-warm-800 dark:text-warm-100">AI Insights</p>
                  <p className="text-[10px] text-warm-500 dark:text-warm-400">Smart analysis</p>
                </div>
              </div>
            </Card>
          </motion.div>

          {/* Live Broadcast */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.55 }}
          >
            <Card
              className="p-3 cursor-pointer hover:border-brand-red/40 dark:hover:border-brand-red/30 transition-all duration-200 active:scale-[0.98] hover:scale-[1.03] hover:shadow-md hover:shadow-brand-red/5 relative overflow-hidden bg-gradient-to-br from-red-50/60 to-warm-50 dark:from-red-900/15 dark:to-warm-800 border-warm-200 dark:border-warm-700 golden-border-hover lock-shake-hover"
              onClick={() => {
                if (liveMatches.length > 0) {
                  setBroadcastMatchId(liveMatches[0].id);
                  setShowBroadcast(true);
                } else {
                  toast({ title: 'No live matches', description: 'Start a match to broadcast' });
                }
              }}
            >
              <div className="absolute inset-0 rounded-lg border border-brand-gold/20" style={{ background: 'linear-gradient(90deg, transparent, rgba(245,158,11,0.06), transparent)' }} />
              <div className="flex items-center gap-2.5 relative z-10">
                <div className="w-9 h-9 rounded-2xl bg-gradient-to-br from-brand-red/20 to-brand-red/5 flex items-center justify-center relative">
                  <Radio className="w-4 h-4 text-brand-red" />
                  <Lock className="w-2 h-2 text-brand-gold absolute -top-0.5 -right-0.5 lock-icon" />
                </div>
                <div>
                  <p className="text-xs font-semibold text-warm-800 dark:text-warm-100">Broadcast</p>
                  <p className="text-[10px] text-warm-500 dark:text-warm-400">Watch live</p>
                </div>
              </div>
            </Card>
          </motion.div>

          {/* Seasons */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6 }}
          >
            <Card
              className="p-3 cursor-pointer hover:border-brand-teal/40 dark:hover:border-brand-teal/30 transition-all duration-200 active:scale-[0.98] hover:scale-[1.03] hover:shadow-md hover:shadow-brand-teal/5 relative overflow-hidden bg-gradient-to-br from-teal-50/60 to-warm-50 dark:from-teal-900/15 dark:to-warm-800 border-warm-200 dark:border-warm-700 golden-border-hover lock-shake-hover"
              onClick={() => setShowSeason(true)}
            >
              <div className="absolute inset-0 rounded-lg border border-brand-gold/20" style={{ background: 'linear-gradient(90deg, transparent, rgba(245,158,11,0.06), transparent)' }} />
              <div className="flex items-center gap-2.5 relative z-10">
                <div className="w-9 h-9 rounded-2xl bg-gradient-to-br from-brand-teal/20 to-brand-teal/5 flex items-center justify-center relative">
                  <Calendar className="w-4 h-4 text-brand-teal" />
                  <Lock className="w-2 h-2 text-brand-gold absolute -top-0.5 -right-0.5 lock-icon" />
                </div>
                <div>
                  <p className="text-xs font-semibold text-warm-800 dark:text-warm-100">Seasons</p>
                  <p className="text-[10px] text-warm-500 dark:text-warm-400">Track yearly</p>
                </div>
              </div>
            </Card>
          </motion.div>

          {/* Polls & Predictions */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.65 }}
          >
            <Card
              className="p-3 cursor-pointer hover:border-brand-gold/40 dark:hover:border-brand-gold/30 transition-all duration-200 active:scale-[0.98] hover:scale-[1.03] hover:shadow-md hover:shadow-brand-gold/5 relative overflow-hidden bg-gradient-to-br from-amber-50/60 to-warm-50 dark:from-amber-900/15 dark:to-warm-800 border-warm-200 dark:border-warm-700 golden-border-hover"
              onClick={() => setShowPredictions(true)}
            >
              <div className="absolute inset-0 rounded-lg border border-brand-gold/20" style={{ background: 'linear-gradient(90deg, transparent, rgba(245,158,11,0.06), transparent)' }} />
              <div className="flex items-center gap-2.5 relative z-10">
                <div className="w-9 h-9 rounded-2xl bg-gradient-to-br from-brand-gold/20 to-brand-gold/5 flex items-center justify-center">
                  <Sparkles className="w-4 h-4 text-brand-gold" />
                </div>
                <div>
                  <p className="text-xs font-semibold text-warm-800 dark:text-warm-100">Predictions</p>
                  <p className="text-[10px] text-warm-500 dark:text-warm-400">Predict & win</p>
                </div>
              </div>
            </Card>
          </motion.div>

          {/* Data Export */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.7 }}
          >
            <Card
              className="p-3 cursor-pointer hover:border-brand-navy/40 dark:hover:border-brand-navy-light/30 transition-all duration-200 active:scale-[0.98] hover:scale-[1.03] hover:shadow-md hover:shadow-brand-navy/5 relative overflow-hidden bg-gradient-to-br from-slate-50/60 to-warm-50 dark:from-slate-900/15 dark:to-warm-800 border-warm-200 dark:border-warm-700 golden-border-hover lock-shake-hover"
              onClick={() => setShowDataExport(true)}
            >
              <div className="absolute inset-0 rounded-lg border border-brand-gold/20" style={{ background: 'linear-gradient(90deg, transparent, rgba(245,158,11,0.06), transparent)' }} />
              <div className="flex items-center gap-2.5 relative z-10">
                <div className="w-9 h-9 rounded-2xl bg-gradient-to-br from-brand-navy/20 dark:from-brand-navy-light/20 to-brand-navy/5 dark:to-brand-navy-light/5 flex items-center justify-center relative">
                  <Download className="w-4 h-4 text-brand-navy dark:text-brand-navy-light" />
                  <Lock className="w-2 h-2 text-brand-gold absolute -top-0.5 -right-0.5 lock-icon" />
                </div>
                <div>
                  <p className="text-xs font-semibold text-warm-800 dark:text-warm-100">Export</p>
                  <p className="text-[10px] text-warm-500 dark:text-warm-400">CSV download</p>
                </div>
              </div>
            </Card>
          </motion.div>

          {/* Sponsors */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.75 }}
          >
            <Card
              className="p-3 cursor-pointer hover:border-emerald-400/40 dark:hover:border-emerald-400/30 transition-all duration-200 active:scale-[0.98] hover:scale-[1.03] hover:shadow-md hover:shadow-emerald-500/5 relative overflow-hidden bg-gradient-to-br from-emerald-50/60 to-warm-50 dark:from-emerald-900/15 dark:to-warm-800 border-warm-200 dark:border-warm-700 golden-border-hover lock-shake-hover"
              onClick={() => setShowSponsors(true)}
            >
              <div className="absolute inset-0 rounded-lg border border-brand-gold/20" style={{ background: 'linear-gradient(90deg, transparent, rgba(245,158,11,0.06), transparent)' }} />
              <div className="flex items-center gap-2.5 relative z-10">
                <div className="w-9 h-9 rounded-2xl bg-gradient-to-br from-emerald-500/20 to-emerald-500/5 flex items-center justify-center relative">
                  <Briefcase className="w-4 h-4 text-emerald-500" />
                  <Lock className="w-2 h-2 text-brand-gold absolute -top-0.5 -right-0.5 lock-icon" />
                </div>
                <div>
                  <p className="text-xs font-semibold text-warm-800 dark:text-warm-100">Sponsors</p>
                  <p className="text-[10px] text-warm-500 dark:text-warm-400">Manage ads</p>
                </div>
              </div>
            </Card>
          </motion.div>
        </div>
      </section>

      {/* ─── Recent Activity ─── */}
      {!loading && recentMatches.length > 0 && (
        <section className="px-4 mt-6">
          <div className="flex items-center gap-2 mb-3">
            <h3 className="text-base font-bold text-warm-800 dark:text-warm-100">Recent Activity</h3>
            <TrendingUp className="w-4 h-4 text-brand-teal" />
          </div>
          <Card className="bg-warm-100 dark:bg-warm-800 border-warm-300 dark:border-warm-700 py-0 gap-0 overflow-hidden">
            <CardContent className="p-0">
              <div className="divide-y divide-warm-200 dark:divide-warm-700">
                {recentMatches.slice(0, 4).map((match, idx) => {
                  const winner = match.homeScore > match.awayScore
                    ? match.homeTeam.name
                    : match.awayScore > match.homeScore
                      ? match.awayTeam.name
                      : null;
                  return (
                    <motion.div
                      key={match.id}
                      className="flex items-center gap-3 px-4 py-3 hover:bg-warm-50 dark:hover:bg-warm-700/50 transition-colors cursor-pointer relative"
                      onClick={() => handleRecentMatchClick(match)}
                      initial={{ opacity: 0, x: -8 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: idx * 0.12 }}
                    >
                      {/* Timeline dot connector */}
                      <div className="absolute left-0 top-0 bottom-0 w-px bg-warm-200 dark:bg-warm-700" />
                      <div className={`w-2.5 h-2.5 rounded-full shrink-0 z-10 ml-0.5 timeline-dot-pulse ${winner ? 'bg-brand-gold' : 'bg-warm-400 dark:bg-warm-500'}`} />
                      <div className="w-7 h-7 rounded-full flex items-center justify-center shrink-0 bg-gradient-to-br from-brand-red/10 to-brand-red/5">
                        {winner ? (
                          <Trophy className="w-3 h-3 text-brand-gold" />
                        ) : (
                          <Swords className="w-3 h-3 text-warm-400" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold text-warm-800 dark:text-warm-100 truncate">
                          {match.homeTeam.name} vs {match.awayTeam.name}
                        </p>
                        <p className="text-[10px] text-warm-500 dark:text-warm-400">
                          {winner ? `${winner} won` : 'Draw'} · {match.homeScore}-{match.awayScore}
                        </p>
                      </div>
                      <span className="text-[10px] text-warm-400 dark:text-warm-500 shrink-0">
                        {formatTimeAgo(match.completedAt)}
                      </span>
                    </motion.div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </section>
      )}
    </div>
  );
}

// ─── Leaderboard Preview Card (mini) ───────────────────────────────

function LeaderboardPreviewCard({ rank, category }: { rank: number; category: string }) {
  const [player, setPlayer] = useState<{
    name: string;
    avatar: string | null;
    stat: number;
    statLabel: string;
    teamNames: string[];
  } | null>(null);

  useEffect(() => {
    async function fetchPreview() {
      try {
        const res = await fetch(`/api/leaderboard?category=${category}&limit=3`);
        if (!res.ok) return;
        const data = await res.json();
        const entry = data.leaderboard?.[rank - 1];
        if (entry) {
          setPlayer({
            name: entry.name,
            avatar: entry.avatar,
            stat: entry.stat,
            statLabel: entry.statLabel,
            teamNames: entry.teamNames,
          });
        }
      } catch {
        // silently fail
      }
    }
    fetchPreview();
  }, [rank, category]);

  const rankConfig = rank === 1
    ? { bg: 'from-yellow-400/20 to-yellow-600/10 dark:from-yellow-400/15 dark:to-yellow-600/5', border: 'border-yellow-500/40', medal: '🥇', label: '1st', labelColor: 'text-yellow-500', ring: 'ring-yellow-400/30' }
    : rank === 2
      ? { bg: 'from-slate-300/20 to-slate-400/10 dark:from-slate-400/15 dark:to-slate-500/5', border: 'border-slate-400/40', medal: '🥈', label: '2nd', labelColor: 'text-slate-400', ring: 'ring-slate-300/30' }
      : { bg: 'from-amber-600/20 to-amber-700/10 dark:from-amber-600/15 dark:to-amber-700/5', border: 'border-amber-600/40', medal: '🥉', label: '3rd', labelColor: 'text-amber-600', ring: 'ring-amber-500/30' };

  if (!player) {
    return (
      <div className={`w-28 shrink-0 rounded-xl bg-gradient-to-br ${rankConfig.bg} ${rankConfig.border} border p-3 flex flex-col items-center gap-2`}>
        <div className="w-10 h-10 rounded-full bg-warm-200 dark:bg-warm-700 animate-pulse" />
        <div className="h-3 w-14 rounded bg-warm-200 dark:bg-warm-700 animate-pulse" />
        <div className="h-3 w-10 rounded bg-warm-200 dark:bg-warm-700 animate-pulse" />
      </div>
    );
  }

  return (
    <motion.div
      className={`w-28 shrink-0 rounded-xl bg-gradient-to-br ${rankConfig.bg} ${rankConfig.border} border p-3 flex flex-col items-center gap-1`}
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ delay: rank * 0.1 }}
    >
      <span className="text-lg">{rankConfig.medal}</span>
      <div className={`w-10 h-10 rounded-full bg-warm-100 dark:bg-warm-700 border border-warm-200 dark:border-warm-600 ring-2 ${rankConfig.ring} flex items-center justify-center overflow-hidden`}>
        {player.avatar ? (
          <img src={player.avatar} alt={player.name} className="w-full h-full object-cover" />
        ) : (
          <span className="text-sm font-bold text-warm-500 dark:text-warm-400">
            {player.name.charAt(0).toUpperCase()}
          </span>
        )}
      </div>
      <p className="text-[11px] font-bold text-warm-800 dark:text-warm-100 text-center truncate w-full">
        {player.name}
      </p>
      <p className="text-brand-gold dark:text-brand-gold-light font-black text-sm">{player.stat}</p>
      <p className="text-[8px] text-warm-400 dark:text-warm-500 text-center">{player.statLabel}</p>
    </motion.div>
  );
}
