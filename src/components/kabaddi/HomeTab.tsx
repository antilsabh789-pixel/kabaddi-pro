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
  MessageCircle,
  Crosshair,
  Megaphone,
  IndianRupee,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useKabaddiStore } from '@/lib/store';
import { t } from '@/lib/i18n';
import Portal from '@/components/portal';
import { useToast } from '@/hooks/use-toast';
import PremiumUpgradeScreen from './PremiumUpgradeScreen';
import LeaderboardScreen from './LeaderboardScreen';
import TeamsLeaderboardScreen from './TeamsLeaderboardScreen';
import MatchAwardsScreen from './MatchAwardsScreen';
import NotificationPanel from './NotificationPanel';
import ShareScorecard from './ShareScorecard';
import MatchDetailsScreen from './MatchDetailsScreen';
import MatchDayExperience from './MatchDayExperience';
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
import TeamChatScreen from './TeamChatScreen';
import DailyChallengeScreen from './DailyChallengeScreen';
import MatchTimelineScreen from './MatchTimelineScreen';
import CoachDashboard from './CoachDashboard';
import LiveCommentaryTicker, { toCommentaryMatchInfo, type CommentaryMatchInfo } from './LiveCommentaryTicker';
import LiveMatchCommentaryFeed, { type LiveMatchCommentaryInfo } from './LiveMatchCommentaryFeed';
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
  const [flash, setFlash] = useState(false);

  useEffect(() => {
    if (prevValue.current !== value) {
      prevValue.current = value;
      const t1 = setTimeout(() => setAnimating(true), 0);
      const t2 = setTimeout(() => setAnimating(false), 400);
      const t3 = setTimeout(() => setFlash(true), 0);
      const t4 = setTimeout(() => setFlash(false), 600);
      return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); clearTimeout(t4); };
    }
  }, [value]);

  return (
    <span className={`${animating ? 'number-ticker' : ''} ${flash ? 'score-change-flash' : ''}`} key={`${value}-${animating}`}>
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

// ─── Awards Confetti Section (on scroll into view) ─────────────────

function AwardsConfettiSection() {
  const ref = useRef<HTMLDivElement>(null);
  const [shown, setShown] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !shown) {
          setShown(true);
        }
      },
      { threshold: 0.3 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [shown]);

  const confettiColors = ['#DC2626', '#F59E0B', '#14B8A6', '#FBBF24', '#1E293B'];

  return (
    <div ref={ref} className="absolute inset-0 overflow-hidden pointer-events-none z-0">
      {shown && [...Array(8)].map((_, i) => (
        <motion.div
          key={`award-confetti-${i}`}
          className="absolute w-1.5 h-1.5 rounded-full"
          style={{
            left: `${10 + i * 12}%`,
            top: '40%',
            backgroundColor: confettiColors[i % confettiColors.length],
          }}
          initial={{ y: 0, opacity: 0, scale: 0 }}
          animate={{ y: [-10, -40, -80], opacity: [0, 1, 0], scale: [0, 1.2, 0.5] }}
          transition={{ duration: 1.5, delay: i * 0.1, ease: 'easeOut' }}
        />
      ))}
    </div>
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
      const diff = Math.max(0, new Date(targetDate || '').getTime() - Date.now());
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
              <span className="text-sm font-black text-white dark:text-warm-900 tabular-nums countdown-flip">
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
  const language = useKabaddiStore((s) => s.language);
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
  const [showMatchDayExperience, setShowMatchDayExperience] = useState(false);
  const [matchDayExperienceId, setMatchDayExperienceId] = useState<string | null>(null);
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
  const [showTeamChat, setShowTeamChat] = useState(false);
  const [showDailyChallenge, setShowDailyChallenge] = useState(false);
  const [showMatchTimeline, setShowMatchTimeline] = useState(false);
  const [showCoachesCorner, setShowCoachesCorner] = useState(false);
  const [showTeamsLeaderboard, setShowTeamsLeaderboard] = useState(false);

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
    // For live matches, show the immersive MatchDayExperience
    if (match.status === 'live') {
      setMatchDayExperienceId(match.id);
      setShowMatchDayExperience(true);
    } else {
      setSelectedMatchId(match.id);
      setShowMatchDetails(true);
    }
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
            transition={{ type: 'spring', stiffness: 400, damping: 35 }}
          >
            <div className="flex flex-col items-center gap-1">
              {/* Animated icon with haptic snap feel */}
              {isRefreshing ? (
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ duration: 0.8, repeat: Infinity, ease: 'linear' }}
                  className="ptr-snap-anim"
                >
                  <RefreshCw className="w-5 h-5 text-brand-red" />
                </motion.div>
              ) : (
                <motion.div
                  animate={{
                    rotate: isPastThreshold ? 180 : pullProgress * 180,
                    scale: isPastThreshold ? 1.15 : 1,
                  }}
                  transition={{ type: 'spring', stiffness: 500, damping: 25 }}
                  className={isPastThreshold ? 'ptr-snap-anim' : ''}
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

      {/* Overlays - rendered through Portal to escape scroll container */}
      <Portal>
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
      {showMatchDayExperience && matchDayExperienceId && (
        <MatchDayExperience
          matchId={matchDayExperienceId}
          onClose={() => {
            setShowMatchDayExperience(false);
            setMatchDayExperienceId(null);
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
      {showTeamChat && (
        <TeamChatScreen onClose={() => setShowTeamChat(false)} />
      )}
      {showDailyChallenge && (
        <DailyChallengeScreen onClose={() => setShowDailyChallenge(false)} />
      )}
      {showMatchTimeline && (
        <MatchTimelineScreen
          onClose={() => setShowMatchTimeline(false)}
        />
      )}
      {showCoachesCorner && (
        <CoachDashboard onClose={() => setShowCoachesCorner(false)} />
      )}
      {showTeamsLeaderboard && (
        <TeamsLeaderboardScreen onClose={() => setShowTeamsLeaderboard(false)} />
      )}
      </Portal>

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
      <motion.div
        className="px-4 pt-4 pb-3 rounded-b-2xl relative overflow-hidden"
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        style={{
          background: 'linear-gradient(135deg, rgba(220,38,38,0.06) 0%, rgba(245,158,11,0.04) 50%, rgba(20,184,166,0.03) 100%)',
        }}
      >
        {/* Animated court line patterns */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          <div className="absolute top-0 left-1/4 w-px h-full bg-gradient-to-b from-brand-red/10 via-brand-gold/5 to-transparent" />
          <div className="absolute top-0 left-1/2 w-px h-full bg-gradient-to-b from-transparent via-brand-gold/8 to-brand-red/5" />
          <div className="absolute top-0 left-3/4 w-px h-full bg-gradient-to-b from-brand-teal/8 via-transparent to-brand-gold/5" />
          <div className="absolute top-1/3 left-0 right-0 h-px bg-gradient-to-r from-transparent via-brand-red/8 to-transparent" />
          <div className="absolute top-2/3 left-0 right-0 h-px bg-gradient-to-r from-transparent via-brand-gold/6 to-transparent" />
          {/* Center circle pattern */}
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-24 h-24 rounded-full border border-brand-gold/8" />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-16 h-16 rounded-full border border-brand-red/6" />
        </div>
        {/* Parallax shimmer overlay */}
        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent animate-[shimmer_4s_ease-in-out_infinite]" />

        <div className="flex items-center justify-between relative z-10">
          <div>
            <p className="text-warm-500 dark:text-warm-400 text-xs font-medium uppercase tracking-wider flex items-center gap-1.5">
              <span>{getTimeEmoji()}</span>
              <span>{t('home.greeting', language)}</span>
            </p>
            <h2 className="text-2xl font-black text-warm-800 dark:text-warm-100 mt-0.5 flex items-center gap-2">
              <span className={`bg-gradient-to-r from-warm-800 via-brand-red-dark to-warm-800 dark:from-warm-100 dark:via-brand-red-light dark:to-warm-100 bg-clip-text text-transparent ${isPremium ? '!from-brand-gold !via-brand-gold-light !to-brand-gold' : ''}`}>
                {currentUser?.name ?? 'Player'}
              </span>
              {isPremium && (
                <Badge className="bg-gradient-to-r from-brand-gold to-brand-gold-dark text-white text-[8px] border-0 font-bold px-1 py-0 ml-0.5">
                  <Crown className="w-2.5 h-2.5 mr-0.5" />PRO
                </Badge>
              )}
              {/* Position Badge */}
              {currentUser?.role && (
                <motion.span
                  className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wide shadow-sm"
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ type: 'spring', damping: 12, stiffness: 280, delay: 0.2 }}
                  style={{
                    backgroundColor: currentUser.role.toLowerCase() === 'raider' ? 'rgba(220,38,38,0.15)'
                      : currentUser.role.toLowerCase() === 'defender' ? 'rgba(30,41,59,0.15)'
                      : 'rgba(245,158,11,0.15)',
                    color: currentUser.role.toLowerCase() === 'raider' ? '#DC2626'
                      : currentUser.role.toLowerCase() === 'defender' ? '#1E293B'
                      : '#D97706',
                    boxShadow: currentUser.role.toLowerCase() === 'raider' ? '0 2px 8px rgba(220,38,38,0.15)'
                      : currentUser.role.toLowerCase() === 'defender' ? '0 2px 8px rgba(30,41,59,0.15)'
                      : '0 2px 8px rgba(245,158,11,0.15)',
                  }}
                >
                  {currentUser.role.toLowerCase() === 'raider' && <Swords className="w-2.5 h-2.5" />}
                  {currentUser.role.toLowerCase() === 'defender' && <Shield className="w-2.5 h-2.5" />}
                  {currentUser.role.toLowerCase() !== 'raider' && currentUser.role.toLowerCase() !== 'defender' && <Zap className="w-2.5 h-2.5" />}
                  {currentUser.role}
                </motion.span>
              )}
              {/* Gender icon */}
              {currentUser?.gender && (
                <span
                  className={currentUser.gender.toLowerCase() === 'female' || currentUser.gender.toLowerCase() === 'girls'
                    ? 'text-brand-red'
                    : 'text-brand-blue dark:text-brand-teal'
                  }
                >
                  {genderIcon}
                </span>
              )}
              {/* Streak/Fire icon for active players */}
              {(recentMatches.length > 0 || liveMatches.length > 0) && (
                <motion.span
                  className="fire-flicker"
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ type: 'spring', damping: 10, stiffness: 300, delay: 0.4 }}
                >
                  <Flame className="w-4 h-4 text-brand-gold" />
                </motion.span>
              )}
            </h2>
          </div>
          {/* Player Code - enhanced */}
          {currentUser?.playerCode && (
            <motion.button
              onClick={handleCopyPlayerCode}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-gradient-to-br from-warm-100 to-warm-50 dark:from-warm-800 dark:to-warm-700 border border-warm-200 dark:border-warm-600 hover:border-brand-gold/50 hover:shadow-md hover:shadow-brand-gold/10 transition-all duration-200 active:scale-95 relative overflow-hidden group card-hover-lift"
              whileTap={{ scale: 0.95 }}
            >
              <div className="absolute inset-0 bg-gradient-to-r from-brand-gold/0 via-brand-gold/5 to-brand-gold/0 opacity-0 group-hover:opacity-100 transition-opacity" />
              <span className="text-[10px] font-mono font-black text-brand-red dark:text-brand-red-light tracking-wider">{currentUser.playerCode}</span>
              {copiedCode ? (
                <Check className="w-3 h-3 text-emerald-500" />
              ) : (
                <Copy className="w-3 h-3 text-warm-400 group-hover:text-brand-gold transition-colors" />
              )}
            </motion.button>
          )}
        </div>
      </motion.div>

      {/* ─── Quick Stats Banner ─── */}
      <div className="px-4 mt-2">
        <motion.div
          className="bg-gradient-to-r from-brand-red via-brand-red-dark to-brand-navy rounded-2xl p-5 shadow-xl shadow-brand-red/25 overflow-hidden relative"
          initial={{ opacity: 0, y: 12, scale: 0.97 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.5, delay: 0.15 }}
        >
          {/* Decorative elements */}
          <div className="absolute -top-6 -right-6 w-24 h-24 rounded-full bg-white/10" />
          <div className="absolute -bottom-4 -left-4 w-20 h-20 rounded-full bg-white/5" />
          <div className="absolute top-2 right-20 w-8 h-8 rounded-full bg-white/5" />
          {/* Court line pattern decorations */}
          <div className="absolute top-0 left-1/4 w-px h-full bg-white/5" />
          <div className="absolute top-0 left-1/2 w-px h-full bg-white/5" />
          <div className="absolute top-1/2 left-0 right-0 h-px bg-white/5" />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-16 h-16 rounded-full border border-white/5" />
          {/* Enhanced parallax shimmer overlay */}
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/8 to-transparent animate-[shimmer_3s_ease-in-out_infinite]" />
          <div className="absolute inset-0 bg-gradient-to-br from-brand-gold/5 via-transparent to-brand-teal/5" />
          <div className="relative z-10">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-white/15 flex items-center justify-center backdrop-blur-sm border border-white/10">
                  <Shield className="w-4 h-4 text-yellow-300" />
                </div>
                <span className="text-white/80 text-[10px] font-bold uppercase tracking-widest">{t('home.globalStats', language)}</span>
              </div>
              {currentUser?.playerCode && (
                <div className="px-2.5 py-1 rounded-lg bg-white/10 border border-white/15 backdrop-blur-sm">
                  <span className="text-white/90 text-[10px] font-mono font-bold tracking-wider">{currentUser.playerCode}</span>
                </div>
              )}
            </div>
            <motion.div
              className="grid grid-cols-3 gap-3"
              variants={stagger}
              initial="hidden"
              animate="show"
            >
              <motion.div
                variants={fadeUp}
                className="text-center glass-card rounded-xl p-2.5 stat-card-glow cursor-pointer relative overflow-hidden group ripple-container"
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.97 }}
                onClick={(e) => {
                  const rect = e.currentTarget.getBoundingClientRect();
                  const ripple = document.createElement('div');
                  ripple.className = 'ripple-effect';
                  ripple.style.left = `${e.clientX - rect.left}px`;
                  ripple.style.top = `${e.clientY - rect.top}px`;
                  ripple.style.width = '20px';
                  ripple.style.height = '20px';
                  e.currentTarget.appendChild(ripple);
                  setTimeout(() => ripple.remove(), 600);
                  if (currentUser?.id) setShowStats(true);
                }}
              >
                <div className="absolute inset-0 bg-gradient-to-b from-brand-gold/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                <div className="flex items-center justify-center gap-1 relative z-10">
                  <Swords className="w-3.5 h-3.5 text-brand-gold-light stat-icon-hover" />
                </div>
                <div className="text-2xl font-black text-white mt-1 relative z-10">
                  <AnimatedCounter target={raidPts} />
                </div>
                <div className="text-[9px] text-white/70 font-semibold uppercase mt-0.5 relative z-10">{t('profile.raidPoints', language)}</div>
              </motion.div>
              <motion.div
                variants={fadeUp}
                className="text-center glass-card rounded-xl p-2.5 stat-card-glow cursor-pointer border-x border-white/10 relative overflow-hidden group ripple-container"
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.97 }}
                onClick={(e) => {
                  const rect = e.currentTarget.getBoundingClientRect();
                  const ripple = document.createElement('div');
                  ripple.className = 'ripple-effect';
                  ripple.style.left = `${e.clientX - rect.left}px`;
                  ripple.style.top = `${e.clientY - rect.top}px`;
                  ripple.style.width = '20px';
                  ripple.style.height = '20px';
                  e.currentTarget.appendChild(ripple);
                  setTimeout(() => ripple.remove(), 600);
                  if (currentUser?.id) setShowStats(true);
                }}
              >
                <div className="absolute inset-0 bg-gradient-to-b from-brand-teal/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                <div className="flex items-center justify-center gap-1 relative z-10">
                  <Shield className="w-3.5 h-3.5 text-brand-gold-light stat-icon-hover" />
                </div>
                <div className="text-2xl font-black text-white mt-1 relative z-10">
                  <AnimatedCounter target={tacklePts} />
                </div>
                <div className="text-[9px] text-white/70 font-semibold uppercase mt-0.5 relative z-10">{t('profile.tacklePoints', language)}</div>
              </motion.div>
              <motion.div
                variants={fadeUp}
                className="text-center glass-card rounded-xl p-2.5 stat-card-glow cursor-pointer relative overflow-hidden group ripple-container"
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.97 }}
                onClick={(e) => {
                  const rect = e.currentTarget.getBoundingClientRect();
                  const ripple = document.createElement('div');
                  ripple.className = 'ripple-effect';
                  ripple.style.left = `${e.clientX - rect.left}px`;
                  ripple.style.top = `${e.clientY - rect.top}px`;
                  ripple.style.width = '20px';
                  ripple.style.height = '20px';
                  e.currentTarget.appendChild(ripple);
                  setTimeout(() => ripple.remove(), 600);
                  if (currentUser?.id) setShowStats(true);
                }}
              >
                <div className="absolute inset-0 bg-gradient-to-b from-brand-red/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                <div className="flex items-center justify-center gap-1 relative z-10">
                  <Calendar className="w-3.5 h-3.5 text-brand-gold-light stat-icon-hover" />
                </div>
                <div className="text-2xl font-black text-white mt-1 relative z-10">
                  <AnimatedCounter target={totalMatches} />
                </div>
                <div className="text-[9px] text-white/70 font-semibold uppercase mt-0.5 relative z-10">{t('profile.matches', language)}</div>
              </motion.div>
            </motion.div>
          </div>
        </motion.div>
      </div>

      {/* ─── Gradient Separator ─── */}
      <div className="px-4 mt-4">
        <div className="section-gradient-separator" />
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

      {/* ─── Coach Dashboard Banner (COACH USERS ONLY) ─── */}
      {currentUser?.role === 'coach' && (
        <motion.section
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="px-4 mt-5"
        >
          <Card
            className="p-4 cursor-pointer transition-all duration-200 active:scale-[0.98] hover:shadow-xl relative overflow-hidden bg-gradient-to-br from-brand-green/15 via-brand-green/5 to-brand-green/10 dark:from-brand-green/20 dark:via-brand-green/5 dark:to-brand-green/10 border-brand-green/25 dark:border-brand-green/15"
            onClick={() => setShowCoachesCorner(true)}
          >
            <div className="absolute inset-0 bg-gradient-to-r from-brand-green/5 via-transparent to-brand-green/5" />
            <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-gradient-to-b from-brand-green to-brand-green-dark rounded-r" />
            <div className="flex items-center gap-4 relative z-10">
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-brand-green to-brand-green-dark flex items-center justify-center shadow-lg shadow-brand-green/30 shrink-0">
                <Megaphone className="w-7 h-7 text-white" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <h3 className="text-base font-bold text-warm-800 dark:text-warm-100">Coach Dashboard</h3>
                  <Badge className="bg-brand-green/20 text-brand-green border-brand-green/30 text-[8px] px-1.5">YOUR HUB</Badge>
                </div>
                <p className="text-xs text-warm-500 dark:text-warm-400 mt-0.5">Manage academy, attendance, fees & rewards</p>
                <div className="flex gap-3 mt-2">
                  <span className="text-[10px] text-warm-400 flex items-center gap-1"><Calendar className="w-3 h-3" /> Attendance</span>
                  <span className="text-[10px] text-warm-400 flex items-center gap-1"><IndianRupee className="w-3 h-3" /> Fees</span>
                  <span className="text-[10px] text-warm-400 flex items-center gap-1"><Trophy className="w-3 h-3" /> Rewards</span>
                  <span className="text-[10px] text-warm-400 flex items-center gap-1"><BarChart3 className="w-3 h-3" /> Analytics</span>
                </div>
              </div>
              <ChevronRight className="w-5 h-5 text-brand-green/50 shrink-0" />
            </div>
          </Card>
        </motion.section>
      )}

      {/* ─── Live Matches (FREE) ─── */}
      <section className="px-4 mt-5">
        <div className="flex items-center justify-between mb-3 section-header-decorated">
          <div className="flex items-center gap-2">
            <h3 className="text-base font-bold text-warm-800 dark:text-warm-100">
              {t('home.liveMatches', language)}
            </h3>
            <span className="relative flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-brand-red-light opacity-75" />
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-brand-red" />
            </span>
            <Badge className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-[9px] border-0 font-semibold">
              {t('home.free', language)}
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
            {t('home.all', language)}
          </button>
          <button
            onClick={() => setGenderFilter('boys')}
            className={`px-3.5 py-1.5 rounded-full text-xs font-semibold gender-pill ${
              genderFilter === 'boys'
                ? 'bg-brand-blue text-white shadow-sm'
                : 'bg-brand-blue/10 text-brand-blue dark:text-brand-navy-light hover:bg-brand-blue/20'
            }`}
          >
            ♂ {t('home.boys', language)}
          </button>
          <button
            onClick={() => setGenderFilter('girls')}
            className={`px-3.5 py-1.5 rounded-full text-xs font-semibold gender-pill ${
              genderFilter === 'girls'
                ? 'bg-brand-red text-white shadow-sm'
                : 'bg-brand-red/10 text-brand-red hover:bg-brand-red/20'
            }`}
          >
            ♀ {t('home.girls', language)}
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
                      className="bg-warm-100 dark:bg-warm-800 cursor-pointer transition-all duration-200 py-0 gap-0 overflow-hidden relative live-card-glow"
                      style={{
                        borderColor: 'transparent',
                        boxShadow: `0 0 0 1px rgba(220,38,38,0.15), 0 4px 24px -4px ${match.homeTeam.color || '#DC2626'}15, 0 4px 24px -4px ${match.awayTeam.color || '#1E293B'}15`,
                      }}
                      onClick={() => handleMatchClick(match)}
                    >
                      {/* Team color gradient border strip at top */}
                      <div
                        className="h-2 w-full relative"
                        style={{
                          background: `linear-gradient(90deg, ${match.homeTeam.color || '#DC2626'}, ${match.awayTeam.color || '#1E293B'})`,
                        }}
                      >
                        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent animate-[shimmer_3s_ease-in-out_infinite]" />
                      </div>
                      {/* Subtle background glow matching dominant team color */}
                      <div
                        className="absolute inset-0 pointer-events-none"
                        style={{
                          background: `radial-gradient(ellipse at 30% 50%, ${match.homeScore >= match.awayScore ? (match.homeTeam.color || '#DC2626') : (match.awayTeam.color || '#1E293B')}08, transparent 70%)`,
                        }}
                      />
                      {/* Animated background particles */}
                      <div className="absolute inset-0 overflow-hidden pointer-events-none">
                        {[...Array(4)].map((_, i) => (
                          <motion.div
                            key={`particle-${match.id}-${i}`}
                            className="absolute w-1 h-1 rounded-full"
                            style={{
                              left: `${20 + i * 20}%`,
                              top: '60%',
                              backgroundColor: i % 2 === 0 ? 'rgba(220,38,38,0.15)' : 'rgba(245,158,11,0.15)',
                            }}
                            animate={{
                              y: [0, -20, -30],
                              opacity: [0.3, 0.5, 0],
                              scale: [1, 1.2, 0.8],
                            }}
                            transition={{
                              duration: 2.5,
                              repeat: Infinity,
                              delay: i * 0.6,
                              ease: 'easeOut',
                            }}
                          />
                        ))}
                      </div>
                      {/* Animated court line pattern inside live card */}
                      <div className="absolute inset-0 overflow-hidden pointer-events-none court-line-animated">
                        <div className="absolute top-1/2 left-[8%] right-[8%] h-px bg-gradient-to-r from-transparent via-brand-gold/12 to-transparent" />
                        <div className="absolute top-[30%] left-[15%] right-[15%] h-px bg-gradient-to-r from-transparent via-brand-red/8 to-transparent" />
                        <div className="absolute top-[70%] left-[15%] right-[15%] h-px bg-gradient-to-r from-transparent via-brand-red/8 to-transparent" />
                        <div className="absolute top-[25%] bottom-[25%] left-1/2 w-px bg-gradient-to-b from-transparent via-brand-gold/10 to-transparent" />
                        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-10 h-10 rounded-full border border-brand-gold/10" />
                        <div className="absolute top-1/2 left-[20%] -translate-y-1/2 w-6 h-8 border border-brand-red/8 rounded-sm" />
                        <div className="absolute top-1/2 right-[20%] -translate-y-1/2 w-6 h-8 border border-brand-red/8 rounded-sm" />
                      </div>
                      <CardContent className="p-4 relative z-10">
                        {/* Confetti on score change */}
                        <ConfettiParticles trigger={match.homeScore + match.awayScore} />
                        <div className="flex items-center justify-between mb-3">
                          <div className="flex items-center gap-2">
                            {/* Enhanced pulsing LIVE indicator with ring animation */}
                            <Badge
                              variant="secondary"
                              className="bg-brand-red/20 text-brand-red text-[10px] font-bold border border-brand-red/20 px-2.5 py-1 flex items-center gap-1.5 live-badge-dramatic relative"
                            >
                              <span className="relative flex h-2.5 w-2.5">
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-brand-red-light opacity-75" />
                                <span className="animate-pulse absolute inline-flex h-full w-full rounded-full bg-brand-red/30 ring-2 ring-brand-red/20" />
                                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-brand-red" />
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
                          <span className="text-xs text-warm-500 dark:text-warm-400 font-medium bg-warm-200/50 dark:bg-warm-700/50 px-2 py-0.5 rounded-md">
                            {halfLabel(match.half)}
                          </span>
                        </div>
                        <div className="flex items-center justify-between">
                          <div className="flex flex-col items-center gap-1 flex-1">
                            <div
                              className="w-12 h-12 rounded-full bg-warm-50 dark:bg-warm-700 flex items-center justify-center text-xs font-bold text-warm-800 dark:text-warm-100 shadow-md relative"
                              style={{
                                borderColor: match.homeTeam.color || '#DC2626',
                                borderWidth: 3,
                                boxShadow: `0 2px 12px ${match.homeTeam.color || '#DC2626'}25`,
                              }}
                            >
                              {getTeamShortName(match.homeTeam)}
                            </div>
                            <span className="text-xs text-warm-600 dark:text-warm-400 text-center leading-tight font-medium">
                              {match.homeTeam.name}
                            </span>
                          </div>
                          <div className="flex items-center gap-2 px-3">
                            <span className="text-4xl font-black tabular-nums" style={{ color: match.homeTeam.color || '#DC2626' }}>
                              <NumberTicker value={match.homeScore} />
                            </span>
                            <div className="flex flex-col items-center gap-0.5">
                              <span className="text-warm-400 text-[10px] font-bold uppercase tracking-wider">
                                vs
                              </span>
                              <div className="w-1 h-1 rounded-full bg-brand-red animate-pulse" />
                            </div>
                            <span className="text-4xl font-black tabular-nums" style={{ color: match.awayTeam.color || '#1E293B' }}>
                              <NumberTicker value={match.awayScore} />
                            </span>
                          </div>
                          {/* Mini team formation visualization */}
                          <div className="absolute bottom-0 left-0 right-0 h-6 pointer-events-none overflow-hidden opacity-20">
                            <svg className="w-full h-full" viewBox="0 0 200 20" preserveAspectRatio="none">
                              {/* Home team dots (left side) */}
                              <circle cx="30" cy="10" r="2.5" fill={match.homeTeam.color || '#DC2626'} />
                              <circle cx="45" cy="5" r="2" fill={match.homeTeam.color || '#DC2626'} />
                              <circle cx="45" cy="15" r="2" fill={match.homeTeam.color || '#DC2626'} />
                              <circle cx="60" cy="8" r="2" fill={match.homeTeam.color || '#DC2626'} />
                              <circle cx="60" cy="14" r="2" fill={match.homeTeam.color || '#DC2626'} />
                              {/* Away team dots (right side) */}
                              <circle cx="170" cy="10" r="2.5" fill={match.awayTeam.color || '#1E293B'} />
                              <circle cx="155" cy="5" r="2" fill={match.awayTeam.color || '#1E293B'} />
                              <circle cx="155" cy="15" r="2" fill={match.awayTeam.color || '#1E293B'} />
                              <circle cx="140" cy="8" r="2" fill={match.awayTeam.color || '#1E293B'} />
                              <circle cx="140" cy="14" r="2" fill={match.awayTeam.color || '#1E293B'} />
                              {/* Center line */}
                              <line x1="100" y1="0" x2="100" y2="20" stroke="rgba(245,158,11,0.3)" strokeWidth="0.5" />
                            </svg>
                          </div>
                          <div className="flex flex-col items-center gap-1 flex-1">
                            <div
                              className="w-12 h-12 rounded-full bg-warm-50 dark:bg-warm-700 flex items-center justify-center text-xs font-bold text-warm-800 dark:text-warm-100 shadow-md relative"
                              style={{
                                borderColor: match.awayTeam.color || '#1E293B',
                                borderWidth: 3,
                                boxShadow: `0 2px 12px ${match.awayTeam.color || '#1E293B'}25`,
                              }}
                            >
                              {getTeamShortName(match.awayTeam)}
                            </div>
                            <span className="text-xs text-warm-600 dark:text-warm-400 text-center leading-tight font-medium">
                              {match.awayTeam.name}
                            </span>
                          </div>
                        </div>
                        {/* Mini Scoreboard Visualization - colored team bars showing score proportion */}
                        <div className="mt-3 px-2">
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-[9px] font-bold text-warm-500 dark:text-warm-400 uppercase">
                              {halfLabel(match.half)}
                            </span>
                            <span className="text-[9px] font-medium text-warm-400 dark:text-warm-500">
                              {match.half === 1 ? '1st' : '2nd'} Half
                            </span>
                          </div>
                          {/* Score proportion bar */}
                          <div className="h-2.5 w-full rounded-full overflow-hidden flex gap-0.5">
                            <motion.div
                              className="h-full rounded-l-full relative"
                              style={{ backgroundColor: match.homeTeam.color || '#DC2626' }}
                              initial={{ width: '0%' }}
                              animate={{
                                width: `${((match.homeScore + 0.5) / Math.max(match.homeScore + match.awayScore + 1, 1)) * 100}%`,
                              }}
                              transition={{ duration: 0.8, ease: 'easeOut' }}
                            >
                              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent animate-[shimmer_4s_ease-in-out_infinite]" />
                            </motion.div>
                            <motion.div
                              className="h-full rounded-r-full relative"
                              style={{ backgroundColor: match.awayTeam.color || '#1E293B' }}
                              initial={{ width: '0%' }}
                              animate={{
                                width: `${((match.awayScore + 0.5) / Math.max(match.homeScore + match.awayScore + 1, 1)) * 100}%`,
                              }}
                              transition={{ duration: 0.8, ease: 'easeOut' }}
                            >
                              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/15 to-transparent animate-[shimmer_5s_ease-in-out_infinite]" />
                            </motion.div>
                          </div>
                        </div>
                        {match.tournament && (
                          <p className="text-[10px] text-warm-500 dark:text-warm-400 text-center mt-2">
                            {match.tournament.name}
                          </p>
                        )}
                      </CardContent>
                      {/* Live Commentary Feed - Enhanced */}
                      {activeMatch && activeMatch.id === match.id && activeMatch.events.length > 0 ? (
                        <LiveMatchCommentaryFeed
                          events={activeMatch.events}
                          match={{
                            homeTeamId: match.homeTeam.id,
                            awayTeamId: match.awayTeam.id,
                            homeTeam: match.homeTeam.name,
                            awayTeam: match.awayTeam.name,
                            homeTeamColor: match.homeTeam.color ?? '#DC2626',
                            awayTeamColor: match.awayTeam.color ?? '#1E293B',
                            currentHalf: activeMatch.currentHalf,
                          }}
                          maxEvents={5}
                        />
                      ) : (
                        <LiveCommentaryTicker
                          mode="compact"
                          events={[]}
                          match={{
                            homeTeamId: match.homeTeam.id,
                            awayTeamId: match.awayTeam.id,
                            homeTeam: match.homeTeam.name,
                            awayTeam: match.awayTeam.name,
                            homeTeamColor: match.homeTeam.color ?? '#DC2626',
                            awayTeamColor: match.awayTeam.color ?? '#1E293B',
                          }}
                          onExpand={() => handleMatchClick(match)}
                        />
                      )}
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
                    <div className="w-16 h-16 rounded-full bg-warm-200 dark:bg-warm-700 flex items-center justify-center empty-state-pulse">
                      <span className="text-2xl">🏟️</span>
                    </div>
                    <div className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-brand-gold/20 flex items-center justify-center empty-state-pulse" style={{ animationDelay: '0.5s' }}>
                      <span className="text-[9px]">⏳</span>
                    </div>
                  </div>
                  <p className="text-warm-700 dark:text-warm-200 text-sm font-bold">
                    {genderFilter !== 'all'
                      ? t('home.noLiveMatches', language)
                      : t('home.noLiveMatches', language)}
                  </p>
                  <p className="text-warm-500 dark:text-warm-400 text-xs mt-1 text-center">
                    Matches will appear here when they go live — stay tuned! 🏏
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

      {/* ─── Gradient Separator ─── */}
      {!loading && recentMatches.length > 0 && (
        <div className="px-4 mt-5">
          <div className="section-gradient-separator" />
        </div>
      )}

      {/* ─── Recent Results / Match History ─── */}
      {!loading && recentMatches.length > 0 && (
        <section className="px-4 mt-6">
          <div className="flex items-center justify-between mb-3 section-header-decorated">
            <div className="flex items-center gap-2">
              <h3 className="text-base font-bold text-warm-800 dark:text-warm-100">{t('home.recentResults', language)}</h3>
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
                    className="cursor-pointer transition-all duration-200 py-0 gap-0 overflow-hidden relative"
                    style={{
                      backgroundColor: isHomeWin
                        ? `linear-gradient(135deg, ${match.homeTeam.color || '#DC2626'}08, transparent 60%)`
                        : !isDraw
                          ? `linear-gradient(135deg, ${match.awayTeam.color || '#1E293B'}08, transparent 60%)`
                          : undefined,
                      boxShadow: `0 0 0 1px rgba(16,185,129,0.1), 0 2px 12px -2px rgba(0,0,0,0.06)`,
                    }}
                    onClick={() => handleRecentMatchClick(match)}
                  >
                    {/* Subtle gradient background based on winning team color */}
                    <div
                      className="absolute inset-0 pointer-events-none"
                      style={{
                        background: isHomeWin && !isDraw
                          ? `linear-gradient(135deg, ${match.homeTeam.color || '#DC2626'}08, transparent 50%)`
                          : !isDraw
                            ? `linear-gradient(135deg, ${match.awayTeam.color || '#1E293B'}08, transparent 50%)`
                            : 'linear-gradient(135deg, rgba(245,158,11,0.04), transparent 50%)',
                      }}
                    />
                    {/* Left color accent strip */}
                    <div
                      className="absolute left-0 top-0 bottom-0 w-1"
                      style={{
                        background: isHomeWin && !isDraw
                          ? match.homeTeam.color || '#DC2626'
                          : !isDraw
                            ? match.awayTeam.color || '#1E293B'
                            : '#F59E0B',
                      }}
                    />
                    <CardContent className="p-4 relative z-10">
                      <div className="flex items-center justify-between mb-2">
                        <Badge className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-[10px] font-semibold border border-emerald-500/20 px-2 py-0.5 flex items-center gap-1">
                          <motion.span
                            initial={{ scale: 0 }}
                            animate={{ scale: 1 }}
                            transition={{ type: 'spring', damping: 12, stiffness: 300, delay: 0.2 }}
                          >
                            <Check className="w-2.5 h-2.5" />
                          </motion.span>
                          {t('home.completed', language)}
                        </Badge>
                        <span className="text-[10px] text-warm-400 dark:text-warm-500">
                          {formatTimeAgo(match.completedAt)}
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 flex-1 min-w-0">
                          <div
                            className="w-9 h-9 rounded-full flex items-center justify-center text-[10px] font-bold text-white shrink-0 shadow-md relative"
                            style={{ backgroundColor: match.homeTeam.color || '#DC2626' }}
                          >
                            {getTeamShortName(match.homeTeam)}
                            {/* Victory crown for winning team */}
                            {isHomeWin && !isDraw && (
                              <motion.div
                                className="absolute -top-2 left-1/2 -translate-x-1/2"
                                initial={{ scale: 0, y: 4 }}
                                animate={{ scale: 1, y: 0 }}
                                transition={{ type: 'spring', damping: 10, stiffness: 300, delay: 0.3 }}
                              >
                                <Crown className="w-3 h-3 text-brand-gold drop-shadow-sm" />
                              </motion.div>
                            )}
                          </div>
                          <span className={`text-sm font-semibold truncate ${isHomeWin && !isDraw ? 'text-warm-800 dark:text-warm-100' : 'text-warm-500 dark:text-warm-400'}`}>
                            {match.homeTeam.name}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 px-3">
                          <span className={`text-2xl font-black tabular-nums ${isHomeWin && !isDraw ? 'text-warm-800 dark:text-warm-100' : 'text-warm-400 dark:text-warm-500'}`} style={isHomeWin && !isDraw ? { color: match.homeTeam.color || undefined } : undefined}>
                            {match.homeScore}
                          </span>
                          <span className="text-warm-300 dark:text-warm-600 text-xs font-medium">-</span>
                          <span className={`text-2xl font-black tabular-nums ${!isHomeWin && !isDraw ? 'text-warm-800 dark:text-warm-100' : 'text-warm-400 dark:text-warm-500'}`} style={!isHomeWin && !isDraw ? { color: match.awayTeam.color || undefined } : undefined}>
                            {match.awayScore}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 flex-1 min-w-0 justify-end">
                          <span className={`text-sm font-semibold truncate ${!isHomeWin && !isDraw ? 'text-warm-800 dark:text-warm-100' : 'text-warm-500 dark:text-warm-400'}`}>
                            {match.awayTeam.name}
                          </span>
                          <div
                            className="w-9 h-9 rounded-full flex items-center justify-center text-[10px] font-bold text-white shrink-0 shadow-md relative"
                            style={{ backgroundColor: match.awayTeam.color || '#1E293B' }}
                          >
                            {getTeamShortName(match.awayTeam)}
                            {/* Victory crown for winning team */}
                            {!isHomeWin && !isDraw && (
                              <motion.div
                                className="absolute -top-2 left-1/2 -translate-x-1/2"
                                initial={{ scale: 0, y: 4 }}
                                animate={{ scale: 1, y: 0 }}
                                transition={{ type: 'spring', damping: 10, stiffness: 300, delay: 0.3 }}
                              >
                                <Crown className="w-3 h-3 text-brand-gold drop-shadow-sm" />
                              </motion.div>
                            )}
                          </div>
                        </div>
                      </div>
                      {/* Score proportion mini-bar */}
                      <div className="mt-2 h-1 rounded-full overflow-hidden flex gap-px">
                        <div
                          className="h-full rounded-l-full transition-all duration-500"
                          style={{
                            width: `${((match.homeScore + 0.5) / Math.max(match.homeScore + match.awayScore + 1, 1)) * 100}%`,
                            backgroundColor: match.homeTeam.color || '#DC2626',
                            opacity: isHomeWin && !isDraw ? 0.7 : 0.3,
                          }}
                        />
                        <div
                          className="h-full rounded-r-full transition-all duration-500"
                          style={{
                            width: `${((match.awayScore + 0.5) / Math.max(match.homeScore + match.awayScore + 1, 1)) * 100}%`,
                            backgroundColor: match.awayTeam.color || '#1E293B',
                            opacity: !isHomeWin && !isDraw ? 0.7 : 0.3,
                          }}
                        />
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
          <div className="flex items-center justify-between mb-3 section-header-decorated">
            <div className="flex items-center gap-2">
              <h3 className="text-base font-bold text-warm-800 dark:text-warm-100">{t('home.upcomingMatches', language)}</h3>
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
                    {/* Top gradient border */}
                    <div
                      className="h-1 w-full relative"
                      style={{
                        background: `linear-gradient(90deg, ${gradientFrom}, ${gradientTo})`,
                      }}
                    >
                      <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent animate-[shimmer_4s_ease-in-out_infinite]" />
                    </div>
                    <CardContent className="p-4 relative z-10">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-1.5">
                          <Badge className="bg-brand-teal/10 text-brand-teal text-[10px] font-semibold border border-brand-teal/20 px-2 py-0.5 flex items-center gap-1">
                            <Calendar className="w-2.5 h-2.5" />
                            {t('home.upcoming', language)}
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
                        {/* Prominently styled date */}
                        <div className="flex items-center gap-1 bg-warm-100 dark:bg-warm-800 px-2 py-0.5 rounded-md border border-warm-200 dark:border-warm-700">
                          <Calendar className="w-2.5 h-2.5 text-brand-teal" />
                          <span className="text-[10px] font-semibold text-warm-600 dark:text-warm-300">
                            {formatDate(match.startedAt)}
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 flex-1 min-w-0">
                          <div
                            className="w-10 h-10 rounded-full flex items-center justify-center text-[10px] font-bold text-white shrink-0 shadow-md ring-2 ring-white/30"
                            style={{
                              backgroundColor: match.homeTeam.color || '#DC2626',
                              boxShadow: `0 2px 8px ${match.homeTeam.color || '#DC2626'}20`,
                            }}
                          >
                            {getTeamShortName(match.homeTeam)}
                          </div>
                          <span className="text-sm font-semibold text-warm-700 dark:text-warm-300 truncate">
                            {match.homeTeam.name}
                          </span>
                        </div>
                        <span className="text-warm-400 text-xs font-bold uppercase tracking-wider px-2">vs</span>
                        <div className="flex items-center gap-2 flex-1 min-w-0 justify-end">
                          <span className="text-sm font-semibold text-warm-700 dark:text-warm-300 truncate">
                            {match.awayTeam.name}
                          </span>
                          <div
                            className="w-10 h-10 rounded-full flex items-center justify-center text-[10px] font-bold text-white shrink-0 shadow-md ring-2 ring-white/30"
                            style={{
                              backgroundColor: match.awayTeam.color || '#1E293B',
                              boxShadow: `0 2px 8px ${match.awayTeam.color || '#1E293B'}20`,
                            }}
                          >
                            {getTeamShortName(match.awayTeam)}
                          </div>
                        </div>
                      </div>
                      {/* Team color bars with shimmer */}
                      <div className="flex gap-1 mt-2">
                        <div className="h-1.5 rounded-full flex-1 relative overflow-hidden" style={{ backgroundColor: match.homeTeam.color || '#DC2626', opacity: 0.6 }}>
                          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/25 to-transparent animate-[shimmer_5s_ease-in-out_infinite]" />
                        </div>
                        <div className="h-1.5 rounded-full flex-1 relative overflow-hidden" style={{ backgroundColor: match.awayTeam.color || '#1E293B', opacity: 0.6 }}>
                          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent animate-[shimmer_6s_ease-in-out_infinite]" />
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
                      {/* Countdown Timer - enhanced container */}
                      <div className="mt-3 py-2.5 px-3 rounded-xl bg-gradient-to-r from-warm-50 to-warm-100/80 dark:from-warm-900/80 dark:to-warm-800/60 border border-warm-200/60 dark:border-warm-700/40 relative overflow-hidden">
                        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-brand-teal/5 to-transparent" />
                        <CountdownTimer targetDate={match.startedAt} />
                      </div>
                      {/* Set Reminder button - enhanced */}
                      <div className="flex justify-end mt-2.5">
                        <motion.div whileTap={{ scale: 0.9 }} whileHover={{ scale: 1.02 }}>
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-8 text-[11px] font-semibold text-brand-teal hover:text-white hover:bg-brand-teal border-brand-teal/30 hover:border-brand-teal px-3 rounded-lg transition-all duration-200 bell-ring-bounce group"
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
                            <Bell className="w-3.5 h-3.5 mr-1.5 group-hover:animate-bounce" />
                            {t('home.setReminder', language)}
                          </Button>
                        </motion.div>
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
      <section className="px-4 mt-6 relative">
        {/* Confetti particles on scroll into view */}
        <AwardsConfettiSection />
        <div className="flex items-center justify-between mb-3 section-header-decorated">
          <div className="flex items-center gap-2">
            <h3 className="text-base font-bold text-warm-800 dark:text-warm-100">
              {t('home.awardsHonors', language)}
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
                    className="bg-gradient-to-r from-brand-gold/15 via-brand-gold/10 to-brand-gold-dark/5 border py-0 gap-0 overflow-hidden cursor-pointer relative golden-shimmer-sweep"
                    onClick={() => setShowAwards(true)}
                  >
                    {/* Rotating gold shimmer border */}
                    <div className="absolute inset-0 rounded-lg gold-shimmer-border" style={{ WebkitMask: 'linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)', WebkitMaskComposite: 'xor', maskComposite: 'exclude', padding: '2px' }} />
                    {/* Shimmer on MOTM card */}
                    <div className="absolute inset-0 bg-gradient-to-r from-transparent via-brand-gold/10 to-transparent animate-[shimmer_3s_ease-in-out_infinite]" />
                    <CardContent className="p-4 relative z-10">
                      <div className="flex items-center gap-3">
                        <div className="relative shrink-0">
                          <div className="w-16 h-16 rounded-full bg-warm-100 dark:bg-warm-700 border-2 border-brand-gold/40 flex items-center justify-center overflow-hidden shadow-md shadow-brand-gold/20">
                            {motm.userAvatar ? (
                              <img src={motm.userAvatar} alt={motm.userName} className="w-full h-full object-cover" />
                            ) : (
                              <div className="w-14 h-14 rounded-full bg-gradient-to-br from-brand-gold/20 to-brand-gold-dark/20 flex items-center justify-center text-xl font-bold text-brand-gold-dark dark:text-brand-gold trophy-rotate">
                                {motm.userName.charAt(0)}
                              </div>
                            )}
                          </div>
                          <div className="absolute -bottom-1 -right-1 w-7 h-7 rounded-full bg-gradient-to-br from-brand-gold to-brand-gold-dark flex items-center justify-center shadow-md gold-medal-shimmer">
                            <Crown className="w-3.5 h-3.5 text-warm-800" />
                          </div>
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-xl medal-hover gold-medal-shimmer">🥇</span>
                            <Badge className="bg-brand-gold/20 text-brand-gold-dark dark:text-brand-gold text-[10px] font-semibold border-0 px-2 py-0.5">
                              <Trophy className="w-3 h-3 mr-0.5" />
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
                          <div className="w-16 h-16 rounded-full bg-warm-100 dark:bg-warm-700 border-2 border-brand-gold/30 flex items-center justify-center overflow-hidden shadow-sm">
                            <div className="w-14 h-14 rounded-full bg-gradient-to-br from-warm-200 to-warm-100 dark:from-warm-600 dark:to-warm-700 flex items-center justify-center text-lg font-bold text-warm-600 dark:text-warm-300">
                              {player.name.charAt(0)}
                            </div>
                          </div>
                          <div className="absolute -bottom-1 -right-1 w-7 h-7 rounded-full bg-gradient-to-br from-brand-gold to-brand-gold-dark flex items-center justify-center shadow-md">
                            <Icon className="w-3.5 h-3.5 text-warm-800" />
                          </div>
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-base medal-hover gold-medal-shimmer">{medal}</span>
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
        <div className="flex items-center justify-between mb-3 section-header-decorated">
          <div className="flex items-center gap-2">
            <h3 className="text-base font-bold text-warm-800 dark:text-warm-100">{t('home.leaderboard', language)}</h3>
            <BarChart3 className="w-4 h-4 text-brand-teal" />
          </div>
          <motion.button
            onClick={() => setShowLeaderboard(true)}
            className="flex items-center gap-1 px-3 py-1.5 rounded-full bg-gradient-to-r from-brand-red to-brand-red-dark text-white text-[11px] font-bold shadow-sm shadow-brand-red/20 active:scale-95 transition-transform view-all-arrow"
            whileTap={{ scale: 0.95 }}
          >
            {t('home.seeAll', language)}
            <ChevronRight className="w-3 h-3 arrow-slide-target" />
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
                {t('home.seeAll', language)}
              </span>
            </motion.button>
          </div>
        )}
      </section>

      {/* ─── Explore ─── */}
      <section className="px-4 mt-6">
        <div className="flex items-center justify-between mb-3 section-header-decorated relative">
          <div className="flex items-center gap-2">
            <h3 className="text-base font-bold text-warm-800 dark:text-warm-100">Explore</h3>
            <Sparkles className="w-4 h-4 text-brand-gold" />
          </div>
          {/* Floating particles behind section header */}
          <div className="absolute inset-0 overflow-hidden pointer-events-none">
            {[...Array(5)].map((_, i) => (
              <motion.div
                key={`explore-particle-${i}`}
                className="absolute w-1 h-1 rounded-full bg-brand-gold/30 sparkle-particle"
                style={{
                  left: `${10 + i * 20}%`,
                  top: '50%',
                  animationDelay: `${i * 0.4}s`,
                }}
              />
            ))}
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          {/* Social Feed - teal for stats/community */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.05 }}
          >
            <Card
              className="p-3.5 cursor-pointer transition-all duration-200 active:scale-[0.97] hover:scale-[1.04] hover:shadow-lg hover:shadow-brand-teal/10 border-warm-200 dark:border-warm-700 bg-gradient-to-br from-teal-50/80 to-warm-50 dark:from-teal-900/20 dark:to-warm-800 relative overflow-hidden group card-hover-lift"
              onClick={() => setShowSocialFeed(true)}
            >
              <div className="absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-b from-brand-teal to-brand-teal/40" />
              <div className="absolute inset-0 bg-gradient-to-r from-brand-teal/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
              <div className="flex items-center gap-3 relative z-10">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-brand-teal/30 to-brand-teal/10 flex items-center justify-center shadow-sm shrink-0 group-hover:shadow-md group-hover:shadow-brand-teal/20 transition-shadow">
                  <Rss className="w-4.5 h-4.5 text-brand-teal" />
                </div>
                <div>
                  <p className="text-xs font-semibold text-warm-800 dark:text-warm-100">{t('home.socialFeed', language)}</p>
                  <p className="text-[10px] text-warm-500 dark:text-warm-400">Activity updates</p>
                </div>
              </div>
            </Card>
          </motion.div>

          {/* Follow & Connect - teal for stats/community */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
          >
            <Card
              className="p-3.5 cursor-pointer transition-all duration-200 active:scale-[0.97] hover:scale-[1.04] hover:shadow-lg hover:shadow-brand-teal/10 border-warm-200 dark:border-warm-700 bg-gradient-to-br from-teal-50/60 to-warm-50 dark:from-teal-900/15 dark:to-warm-800 relative overflow-hidden group card-hover-lift"
              onClick={() => setShowFollow(true)}
            >
              <div className="absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-b from-brand-teal to-brand-teal/40" />
              <div className="absolute inset-0 bg-gradient-to-r from-brand-teal/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
              <div className="flex items-center gap-3 relative z-10">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-brand-teal/30 to-brand-teal/10 flex items-center justify-center shadow-sm shrink-0 group-hover:shadow-md group-hover:shadow-brand-teal/20 transition-shadow">
                  <Users className="w-4.5 h-4.5 text-brand-teal" />
                </div>
                <div>
                  <p className="text-xs font-semibold text-warm-800 dark:text-warm-100">{t('home.followConnect', language)}</p>
                  <p className="text-[10px] text-warm-500 dark:text-warm-400">Find players</p>
                </div>
              </div>
            </Card>
          </motion.div>

          {/* Match History - red for live features */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 }}
          >
            <Card
              className="p-3.5 cursor-pointer transition-all duration-200 active:scale-[0.97] hover:scale-[1.04] hover:shadow-lg hover:shadow-brand-red/10 border-warm-200 dark:border-warm-700 bg-gradient-to-br from-red-50/80 to-warm-50 dark:from-red-900/20 dark:to-warm-800 relative overflow-hidden group card-hover-lift"
              onClick={() => setShowMatchHistory(true)}
            >
              <div className="absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-b from-brand-red to-brand-red/40" />
              <div className="absolute inset-0 bg-gradient-to-r from-brand-red/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
              <div className="flex items-center gap-3 relative z-10">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-brand-red/30 to-brand-red/10 flex items-center justify-center shadow-sm shrink-0 group-hover:shadow-md group-hover:shadow-brand-red/20 transition-shadow">
                  <Calendar className="w-4.5 h-4.5 text-brand-red" />
                </div>
                <div>
                  <p className="text-xs font-semibold text-warm-800 dark:text-warm-100">Match History</p>
                  <p className="text-[10px] text-warm-500 dark:text-warm-400">Past matches</p>
                </div>
              </div>
            </Card>
          </motion.div>

          {/* Advanced Stats - teal for stats */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
          >
            <Card
              className="p-3.5 cursor-pointer transition-all duration-200 active:scale-[0.97] hover:scale-[1.04] hover:shadow-lg hover:shadow-brand-teal/10 border-warm-200 dark:border-warm-700 bg-gradient-to-br from-teal-50/60 to-warm-50 dark:from-teal-900/15 dark:to-warm-800 relative overflow-hidden group card-hover-lift"
              onClick={() => {
                if (currentUser?.id) {
                  setShowStats(true);
                }
              }}
            >
              <div className="absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-b from-brand-teal to-brand-teal/40" />
              <div className="absolute inset-0 bg-gradient-to-r from-brand-teal/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
              <div className="flex items-center gap-3 relative z-10">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-brand-teal/30 to-brand-teal/10 flex items-center justify-center shadow-sm shrink-0 group-hover:shadow-md group-hover:shadow-brand-teal/20 transition-shadow">
                  <Activity className="w-4.5 h-4.5 text-brand-teal" />
                </div>
                <div>
                  <p className="text-xs font-semibold text-warm-800 dark:text-warm-100">{t('home.advancedStats', language)}</p>
                  <p className="text-[10px] text-warm-500 dark:text-warm-400">View your stats</p>
                </div>
              </div>
            </Card>
          </motion.div>

          {/* Rules & Tutorial - teal for stats */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.25 }}
          >
            <Card
              className="p-3.5 cursor-pointer transition-all duration-200 active:scale-[0.97] hover:scale-[1.04] hover:shadow-lg hover:shadow-emerald-500/10 border-warm-200 dark:border-warm-700 bg-gradient-to-br from-emerald-50/80 to-warm-50 dark:from-emerald-900/20 dark:to-warm-800 relative overflow-hidden group card-hover-lift"
              onClick={() => setShowRules(true)}
            >
              <div className="absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-b from-brand-teal to-brand-teal/40" />
              <div className="absolute inset-0 bg-gradient-to-r from-brand-teal/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
              <div className="flex items-center gap-3 relative z-10">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-brand-teal/30 to-brand-teal/10 flex items-center justify-center shadow-sm shrink-0 group-hover:shadow-md group-hover:shadow-brand-teal/20 transition-shadow">
                  <BookOpen className="w-4.5 h-4.5 text-brand-teal" />
                </div>
                <div>
                  <p className="text-xs font-semibold text-warm-800 dark:text-warm-100">Rules</p>
                  <p className="text-[10px] text-warm-500 dark:text-warm-400">Learn the game</p>
                </div>
              </div>
            </Card>
          </motion.div>

          {/* Match Highlights - gold for premium */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
          >
            <Card
              className="p-3.5 cursor-pointer transition-all duration-200 active:scale-[0.97] hover:scale-[1.04] hover:shadow-lg hover:shadow-brand-gold/10 border-warm-200 dark:border-warm-700 bg-gradient-to-br from-amber-50/80 to-warm-50 dark:from-amber-900/20 dark:to-warm-800 relative overflow-hidden group card-hover-lift"
              onClick={() => {
                if (recentMatches.length > 0) {
                  setHighlightsMatchId(recentMatches[0].id);
                  setShowHighlights(true);
                } else {
                  toast({ title: 'No matches', description: 'Complete a match to see highlights' });
                }
              }}
            >
              <div className="absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-b from-brand-gold to-brand-gold/40" />
              <div className="absolute inset-0 bg-gradient-to-r from-brand-gold/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
              <div className="flex items-center gap-3 relative z-10">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-brand-gold/30 to-brand-gold/10 flex items-center justify-center shadow-sm shrink-0 group-hover:shadow-md group-hover:shadow-brand-gold/20 transition-shadow">
                  <Sparkles className="w-4.5 h-4.5 text-brand-gold" />
                </div>
                <div>
                  <p className="text-xs font-semibold text-warm-800 dark:text-warm-100">{t('home.highlights', language)}</p>
                  <p className="text-[10px] text-warm-500 dark:text-warm-400">Key moments</p>
                </div>
              </div>
            </Card>
          </motion.div>
        </div>

        {/* Phase 5: More Actions */}
        <div className="grid grid-cols-2 gap-3 mt-3">
          {/* Achievements - gold for premium */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.35 }}
          >
            <Card
              className="p-3.5 cursor-pointer transition-all duration-200 active:scale-[0.97] hover:scale-[1.04] hover:shadow-lg hover:shadow-brand-gold/10 border-warm-200 dark:border-warm-700 bg-gradient-to-br from-amber-50/80 to-warm-50 dark:from-amber-900/20 dark:to-warm-800 relative overflow-hidden group card-hover-lift"
              onClick={() => setShowStreaks(true)}
            >
              <div className="absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-b from-brand-gold to-brand-gold/40" />
              <div className="absolute inset-0 bg-gradient-to-r from-brand-gold/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
              <div className="flex items-center gap-3 relative z-10">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-brand-gold/30 to-brand-gold/10 flex items-center justify-center shadow-sm shrink-0 group-hover:shadow-md group-hover:shadow-brand-gold/20 transition-shadow">
                  <Award className="w-4.5 h-4.5 text-brand-gold" />
                </div>
                <div>
                  <p className="text-xs font-semibold text-warm-800 dark:text-warm-100">Achievements</p>
                  <p className="text-[10px] text-warm-500 dark:text-warm-400">Streaks & records</p>
                </div>
              </div>
            </Card>
          </motion.div>

          {/* Compare Teams - red for live features */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
          >
            <Card
              className="p-3.5 cursor-pointer transition-all duration-200 active:scale-[0.97] hover:scale-[1.04] hover:shadow-lg hover:shadow-brand-red/10 border-warm-200 dark:border-warm-700 bg-gradient-to-br from-red-50/80 to-warm-50 dark:from-red-900/20 dark:to-warm-800 relative overflow-hidden group card-hover-lift"
              onClick={() => {
                if (!isPremium) {
                  setUpgradeFeature('Compare Teams');
                  setShowUpgrade(true);
                  return;
                }
                setShowComparison(true);
              }}
            >
              <div className="absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-b from-brand-red to-brand-red/40" />
              <div className="absolute inset-0 bg-gradient-to-r from-brand-red/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
              {!isPremium && (
                <div className="absolute top-2 right-2 z-20">
                  <div className="w-6 h-6 rounded-full bg-gradient-to-br from-yellow-400 to-amber-500 flex items-center justify-center shadow-md shadow-yellow-400/30">
                    <Lock className="w-3 h-3 text-white" />
                  </div>
                </div>
              )}
              <div className="flex items-center gap-3 relative z-10">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-brand-red/30 to-brand-red/10 flex items-center justify-center shadow-sm shrink-0 group-hover:shadow-md group-hover:shadow-brand-red/20 transition-shadow">
                  <Swords className="w-4.5 h-4.5 text-brand-red" />
                </div>
                <div>
                  <p className="text-xs font-semibold text-warm-800 dark:text-warm-100 flex items-center gap-1">
                    Compare Teams
                    {!isPremium && <span className="text-[8px] font-extrabold text-yellow-600 dark:text-yellow-400 bg-yellow-400/20 dark:bg-yellow-400/10 px-1 rounded">PRO</span>}
                  </p>
                  <p className="text-[10px] text-warm-500 dark:text-warm-400">Head-to-head</p>
                </div>
              </div>
            </Card>
          </motion.div>

          {/* Grounds - teal for stats */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.45 }}
          >
            <Card
              className="p-3.5 cursor-pointer transition-all duration-200 active:scale-[0.97] hover:scale-[1.04] hover:shadow-lg hover:shadow-brand-teal/10 border-warm-200 dark:border-warm-700 bg-gradient-to-br from-teal-50/80 to-warm-50 dark:from-teal-900/20 dark:to-warm-800 relative overflow-hidden group card-hover-lift"
              onClick={() => setShowGrounds(true)}
            >
              <div className="absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-b from-brand-teal to-brand-teal/40" />
              <div className="absolute inset-0 bg-gradient-to-r from-brand-teal/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
              <div className="flex items-center gap-3 relative z-10">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-brand-teal/30 to-brand-teal/10 flex items-center justify-center shadow-sm shrink-0 group-hover:shadow-md group-hover:shadow-brand-teal/20 transition-shadow">
                  <MapPin className="w-4.5 h-4.5 text-brand-teal" />
                </div>
                <div>
                  <p className="text-xs font-semibold text-warm-800 dark:text-warm-100">Grounds</p>
                  <p className="text-[10px] text-warm-500 dark:text-warm-400">Find venues</p>
                </div>
              </div>
            </Card>
          </motion.div>

          {/* Match Replay - red for live features */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.45 }}
          >
            <Card
              className="p-3.5 cursor-pointer transition-all duration-200 active:scale-[0.97] hover:scale-[1.04] hover:shadow-lg border-warm-200 dark:border-warm-700 bg-gradient-to-br from-red-50/60 to-warm-50 dark:from-red-900/15 dark:to-warm-800 relative overflow-hidden group card-hover-lift"
              onClick={() => {
                if (recentMatches.length > 0) {
                  setReplayMatchId(recentMatches[0].id);
                  setShowReplay(true);
                } else {
                  toast({ title: 'No matches', description: 'Complete a match to replay' });
                }
              }}
            >
              <div className="absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-b from-brand-red to-brand-red/40" />
              <div className="absolute inset-0 bg-gradient-to-r from-brand-red/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
              <div className="flex items-center gap-3 relative z-10">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-brand-red/30 to-brand-red/10 flex items-center justify-center shadow-sm shrink-0 group-hover:shadow-md group-hover:shadow-brand-red/20 transition-shadow">
                  <Play className="w-4.5 h-4.5 text-brand-red" />
                </div>
                <div>
                  <p className="text-xs font-semibold text-warm-800 dark:text-warm-100">Replay</p>
                  <p className="text-[10px] text-warm-500 dark:text-warm-400">Watch again</p>
                </div>
              </div>
            </Card>
          </motion.div>

          {/* Team Chat - navy for communication */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
          >
            <Card
              className="p-3.5 cursor-pointer transition-all duration-200 active:scale-[0.97] hover:scale-[1.04] hover:shadow-lg hover:shadow-brand-navy/10 border-warm-200 dark:border-warm-700 bg-gradient-to-br from-blue-50/80 to-warm-50 dark:from-blue-900/20 dark:to-warm-800 relative overflow-hidden group card-hover-lift"
              onClick={() => setShowTeamChat(true)}
            >
              <div className="absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-b from-brand-navy to-brand-navy/40" />
              <div className="absolute inset-0 bg-gradient-to-r from-brand-navy/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
              <div className="flex items-center gap-3 relative z-10">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-brand-navy/30 to-brand-navy/10 flex items-center justify-center shadow-sm shrink-0 group-hover:shadow-md group-hover:shadow-brand-navy/20 transition-shadow">
                  <MessageCircle className="w-4.5 h-4.5 text-brand-navy" />
                </div>
                <div>
                  <p className="text-xs font-semibold text-warm-800 dark:text-warm-100">Team Chat</p>
                  <p className="text-[10px] text-warm-500 dark:text-warm-400">Message teammates</p>
                </div>
              </div>
            </Card>
          </motion.div>

          {/* Daily Challenges - flame for motivation */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.55 }}
          >
            <Card
              className="p-3.5 cursor-pointer transition-all duration-200 active:scale-[0.97] hover:scale-[1.04] hover:shadow-lg hover:shadow-orange-500/10 border-warm-200 dark:border-warm-700 bg-gradient-to-br from-orange-50/80 to-warm-50 dark:from-orange-900/20 dark:to-warm-800 relative overflow-hidden group card-hover-lift"
              onClick={() => setShowDailyChallenge(true)}
            >
              <div className="absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-b from-orange-500 to-orange-500/40" />
              <div className="absolute inset-0 bg-gradient-to-r from-orange-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
              <div className="flex items-center gap-3 relative z-10">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-orange-500/30 to-orange-500/10 flex items-center justify-center shadow-sm shrink-0 group-hover:shadow-md group-hover:shadow-orange-500/20 transition-shadow">
                  <Crosshair className="w-4.5 h-4.5 text-orange-500" />
                </div>
                <div>
                  <p className="text-xs font-semibold text-warm-800 dark:text-warm-100">Daily Challenges</p>
                  <p className="text-[10px] text-warm-500 dark:text-warm-400">Earn XP & streaks</p>
                </div>
              </div>
            </Card>
          </motion.div>

          {/* Teams Leaderboard - red/gold for competitive ranking */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.65 }}
          >
            <Card
              className="p-3.5 cursor-pointer transition-all duration-200 active:scale-[0.97] hover:scale-[1.04] hover:shadow-lg hover:shadow-brand-red/10 border-warm-200 dark:border-warm-700 bg-gradient-to-br from-red-50/80 to-amber-50/60 dark:from-red-900/20 dark:to-amber-900/15 relative overflow-hidden group card-hover-lift"
              onClick={() => setShowTeamsLeaderboard(true)}
            >
              <div className="absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-b from-brand-red to-brand-gold" />
              <div className="absolute inset-0 bg-gradient-to-r from-brand-red/5 to-brand-gold/5 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
              <div className="flex items-center gap-3 relative z-10">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-brand-red/30 to-brand-gold/20 flex items-center justify-center shadow-sm shrink-0 group-hover:shadow-md group-hover:shadow-brand-red/20 transition-shadow">
                  <Shield className="w-4.5 h-4.5 text-brand-red" />
                </div>
                <div>
                  <p className="text-xs font-semibold text-warm-800 dark:text-warm-100">Teams Leaderboard</p>
                  <p className="text-[10px] text-warm-500 dark:text-warm-400">Team rankings & points</p>
                </div>
              </div>
            </Card>
          </motion.div>

        </div>
        <div className="flex items-center gap-2 mt-5 mb-3">
          <h3 className="text-sm font-bold text-warm-800 dark:text-warm-100 shimmer-sweep-text">Pro Features</h3>
          <Badge className="bg-gradient-to-r from-brand-gold to-brand-gold-dark text-white text-[9px] border-0 font-bold px-1.5 py-0 flex items-center gap-0.5 relative overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent animate-[shimmer_2.5s_ease-in-out_infinite]" />
            <Crown className="w-2.5 h-2.5" />
            PRO
          </Badge>
        </div>
        <div className="grid grid-cols-2 gap-3">
          {/* AI Insights - gold/pro */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
          >
            <Card
              className="p-3.5 cursor-pointer transition-all duration-200 active:scale-[0.97] hover:scale-[1.04] hover:shadow-lg relative overflow-hidden bg-gradient-to-br from-purple-50/80 to-warm-50 dark:from-purple-900/20 dark:to-warm-800 border-warm-200 dark:border-warm-700 group card-hover-lift"
              onClick={() => setShowAIInsights(true)}
            >
              {/* Shimmer/lock overlay effect */}
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-brand-gold/8 to-transparent animate-[shimmer_3s_ease-in-out_infinite]" />
              <div className="absolute inset-0 rounded-lg ring-1 ring-brand-gold/15" />
              <div className="absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-b from-brand-gold to-brand-gold/40" />
              <div className="flex items-center gap-3 relative z-10">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500/30 to-purple-500/10 flex items-center justify-center relative shadow-sm group-hover:shadow-md group-hover:shadow-purple-500/20 transition-shadow shrink-0">
                  <Brain className="w-4.5 h-4.5 text-purple-500" />
                  <Lock className="w-2.5 h-2.5 text-brand-gold absolute -top-1 -right-1 lock-icon drop-shadow-sm" />
                </div>
                <div>
                  <p className="text-xs font-semibold text-warm-800 dark:text-warm-100">AI Insights</p>
                  <p className="text-[10px] text-warm-500 dark:text-warm-400">Smart analysis</p>
                </div>
              </div>
            </Card>
          </motion.div>

          {/* Live Broadcast - red for live */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.55 }}
          >
            <Card
              className="p-3.5 cursor-pointer transition-all duration-200 active:scale-[0.97] hover:scale-[1.04] hover:shadow-lg relative overflow-hidden bg-gradient-to-br from-red-50/80 to-warm-50 dark:from-red-900/20 dark:to-warm-800 border-warm-200 dark:border-warm-700 group card-hover-lift"
              onClick={() => {
                if (liveMatches.length > 0) {
                  setBroadcastMatchId(liveMatches[0].id);
                  setShowBroadcast(true);
                } else {
                  toast({ title: 'No live matches', description: 'Start a match to broadcast' });
                }
              }}
            >
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-brand-gold/8 to-transparent animate-[shimmer_3.5s_ease-in-out_infinite]" />
              <div className="absolute inset-0 rounded-lg ring-1 ring-brand-gold/15" />
              <div className="absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-b from-brand-red to-brand-gold" />
              <div className="flex items-center gap-3 relative z-10">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-brand-red/30 to-brand-red/10 flex items-center justify-center relative shadow-sm group-hover:shadow-md group-hover:shadow-brand-red/20 transition-shadow shrink-0">
                  <Radio className="w-4.5 h-4.5 text-brand-red" />
                  <Lock className="w-2.5 h-2.5 text-brand-gold absolute -top-1 -right-1 lock-icon drop-shadow-sm" />
                </div>
                <div>
                  <p className="text-xs font-semibold text-warm-800 dark:text-warm-100">Broadcast</p>
                  <p className="text-[10px] text-warm-500 dark:text-warm-400">Watch live</p>
                </div>
              </div>
            </Card>
          </motion.div>

          {/* Seasons - teal for stats */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6 }}
          >
            <Card
              className="p-3.5 cursor-pointer transition-all duration-200 active:scale-[0.97] hover:scale-[1.04] hover:shadow-lg relative overflow-hidden bg-gradient-to-br from-teal-50/80 to-warm-50 dark:from-teal-900/20 dark:to-warm-800 border-warm-200 dark:border-warm-700 group card-hover-lift"
              onClick={() => setShowSeason(true)}
            >
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-brand-gold/8 to-transparent animate-[shimmer_4s_ease-in-out_infinite]" />
              <div className="absolute inset-0 rounded-lg ring-1 ring-brand-gold/15" />
              <div className="absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-b from-brand-teal to-brand-gold" />
              <div className="flex items-center gap-3 relative z-10">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-brand-teal/30 to-brand-teal/10 flex items-center justify-center relative shadow-sm group-hover:shadow-md group-hover:shadow-brand-teal/20 transition-shadow shrink-0">
                  <Calendar className="w-4.5 h-4.5 text-brand-teal" />
                  <Lock className="w-2.5 h-2.5 text-brand-gold absolute -top-1 -right-1 lock-icon drop-shadow-sm" />
                </div>
                <div>
                  <p className="text-xs font-semibold text-warm-800 dark:text-warm-100">Seasons</p>
                  <p className="text-[10px] text-warm-500 dark:text-warm-400">Track yearly</p>
                </div>
              </div>
            </Card>
          </motion.div>

          {/* Polls & Predictions - gold for premium */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.65 }}
          >
            <Card
              className="p-3.5 cursor-pointer transition-all duration-200 active:scale-[0.97] hover:scale-[1.04] hover:shadow-lg relative overflow-hidden bg-gradient-to-br from-amber-50/80 to-warm-50 dark:from-amber-900/20 dark:to-warm-800 border-warm-200 dark:border-warm-700 group card-hover-lift"
              onClick={() => setShowPredictions(true)}
            >
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-brand-gold/8 to-transparent animate-[shimmer_3s_ease-in-out_infinite]" />
              <div className="absolute inset-0 rounded-lg ring-1 ring-brand-gold/15" />
              <div className="absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-b from-brand-gold to-brand-gold/40" />
              <div className="flex items-center gap-3 relative z-10">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-brand-gold/30 to-brand-gold/10 flex items-center justify-center shadow-sm group-hover:shadow-md group-hover:shadow-brand-gold/20 transition-shadow shrink-0">
                  <Sparkles className="w-4.5 h-4.5 text-brand-gold" />
                </div>
                <div>
                  <p className="text-xs font-semibold text-warm-800 dark:text-warm-100">Predictions</p>
                  <p className="text-[10px] text-warm-500 dark:text-warm-400">Predict & win</p>
                </div>
              </div>
            </Card>
          </motion.div>

          {/* Data Export - gold for premium */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.7 }}
          >
            <Card
              className="p-3.5 cursor-pointer transition-all duration-200 active:scale-[0.97] hover:scale-[1.04] hover:shadow-lg relative overflow-hidden bg-gradient-to-br from-slate-50/80 to-warm-50 dark:from-slate-900/20 dark:to-warm-800 border-warm-200 dark:border-warm-700 group card-hover-lift"
              onClick={() => setShowDataExport(true)}
            >
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-brand-gold/8 to-transparent animate-[shimmer_4.5s_ease-in-out_infinite]" />
              <div className="absolute inset-0 rounded-lg ring-1 ring-brand-gold/15" />
              <div className="absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-b from-brand-gold to-brand-gold/40" />
              <div className="flex items-center gap-3 relative z-10">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-brand-navy/30 dark:from-brand-navy-light/30 to-brand-navy/10 dark:to-brand-navy-light/10 flex items-center justify-center relative shadow-sm group-hover:shadow-md group-hover:shadow-brand-navy/20 transition-shadow shrink-0">
                  <Download className="w-4.5 h-4.5 text-brand-navy dark:text-brand-navy-light" />
                  <Lock className="w-2.5 h-2.5 text-brand-gold absolute -top-1 -right-1 lock-icon drop-shadow-sm" />
                </div>
                <div>
                  <p className="text-xs font-semibold text-warm-800 dark:text-warm-100">Export</p>
                  <p className="text-[10px] text-warm-500 dark:text-warm-400">CSV download</p>
                </div>
              </div>
            </Card>
          </motion.div>

          {/* Sponsors - gold for premium */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.75 }}
          >
            <Card
              className="p-3.5 cursor-pointer transition-all duration-200 active:scale-[0.97] hover:scale-[1.04] hover:shadow-lg relative overflow-hidden bg-gradient-to-br from-emerald-50/80 to-warm-50 dark:from-emerald-900/20 dark:to-warm-800 border-warm-200 dark:border-warm-700 group card-hover-lift"
              onClick={() => setShowSponsors(true)}
            >
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-brand-gold/8 to-transparent animate-[shimmer_5s_ease-in-out_infinite]" />
              <div className="absolute inset-0 rounded-lg ring-1 ring-brand-gold/15" />
              <div className="absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-b from-brand-gold to-brand-gold/40" />
              <div className="flex items-center gap-3 relative z-10">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500/30 to-emerald-500/10 flex items-center justify-center relative shadow-sm group-hover:shadow-md group-hover:shadow-emerald-500/20 transition-shadow shrink-0">
                  <Briefcase className="w-4.5 h-4.5 text-emerald-500" />
                  <Lock className="w-2.5 h-2.5 text-brand-gold absolute -top-1 -right-1 lock-icon drop-shadow-sm" />
                </div>
                <div>
                  <p className="text-xs font-semibold text-warm-800 dark:text-warm-100">Sponsors</p>
                  <p className="text-[10px] text-warm-500 dark:text-warm-400">Manage ads</p>
                </div>
              </div>
            </Card>
          </motion.div>

          {/* Coach Dashboard - primary feature for coaches, premium for players */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.8 }}
          >
            <Card
              className={`p-3.5 cursor-pointer transition-all duration-200 active:scale-[0.97] hover:scale-[1.04] hover:shadow-lg relative overflow-hidden group card-hover-lift ${
                currentUser?.role === 'coach'
                  ? 'bg-gradient-to-br from-brand-green/20 to-brand-green/5 dark:from-brand-green/15 dark:to-brand-green/5 border-brand-green/30 dark:border-brand-green/20 ring-1 ring-brand-green/20'
                  : 'bg-gradient-to-br from-teal-50/80 to-warm-50 dark:from-teal-900/20 dark:to-warm-800 border-warm-200 dark:border-warm-700'
              }`}
              onClick={() => {
                // Coaches always have access, players need premium
                if (currentUser?.role !== 'coach' && !isPremium) {
                  setUpgradeFeature("Coach Dashboard");
                  setShowUpgrade(true);
                  return;
                }
                setShowCoachesCorner(true);
              }}
            >
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-brand-gold/8 to-transparent animate-[shimmer_5.5s_ease-in-out_infinite]" />
              <div className="absolute inset-0 rounded-lg ring-1 ring-brand-gold/15" />
              <div className={`absolute left-0 top-0 bottom-0 w-1 ${currentUser?.role === 'coach' ? 'bg-gradient-to-b from-brand-green to-brand-green-dark' : 'bg-gradient-to-b from-brand-teal to-brand-gold'}`} />
              {currentUser?.role !== 'coach' && !isPremium && (
                <div className="absolute top-2 right-2 z-20">
                  <div className="w-6 h-6 rounded-full bg-gradient-to-br from-yellow-400 to-amber-500 flex items-center justify-center shadow-md shadow-yellow-400/30">
                    <Lock className="w-3 h-3 text-white" />
                  </div>
                </div>
              )}
              {currentUser?.role === 'coach' && (
                <div className="absolute top-2 right-2 z-20">
                  <Badge className="bg-brand-green/20 text-brand-green border-brand-green/30 text-[8px] px-1.5 py-0">COACH</Badge>
                </div>
              )}
              <div className="flex items-center gap-3 relative z-10">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center relative shadow-sm group-hover:shadow-md transition-shadow shrink-0 ${
                  currentUser?.role === 'coach'
                    ? 'bg-gradient-to-br from-brand-green/40 to-brand-green/20 shadow-brand-green/20'
                    : 'bg-gradient-to-br from-brand-teal/30 to-brand-teal/10 shadow-brand-teal/20'
                }`}>
                  <Megaphone className={`w-4.5 h-4.5 ${currentUser?.role === 'coach' ? 'text-brand-green' : 'text-brand-teal'}`} />
                  {currentUser?.role !== 'coach' && !isPremium && <Lock className="w-2.5 h-2.5 text-brand-gold absolute -top-1 -right-1 lock-icon drop-shadow-sm" />}
                </div>
                <div>
                  <p className="text-xs font-semibold text-warm-800 dark:text-warm-100 flex items-center gap-1">
                    {currentUser?.role === 'coach' ? 'Coach Dashboard' : t('coach.title', language)}
                    {currentUser?.role !== 'coach' && !isPremium && <span className="text-[8px] font-extrabold text-yellow-600 dark:text-yellow-400 bg-yellow-400/20 dark:bg-yellow-400/10 px-1 rounded">PRO</span>}
                  </p>
                  <p className="text-[10px] text-warm-500 dark:text-warm-400">
                    {currentUser?.role === 'coach' ? 'Manage academy, attendance & fees' : t('coach.manageTeam', language)}
                  </p>
                </div>
              </div>
            </Card>
          </motion.div>
        </div>
      </section>

      {/* ─── Recent Activity ─── */}
      {!loading && recentMatches.length > 0 && (
        <section className="px-4 mt-6">
          <div className="flex items-center gap-2 mb-3 section-header-decorated">
            <h3 className="text-base font-bold text-warm-800 dark:text-warm-100">{t('home.recentResults', language)}</h3>
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
                      className="flex items-center gap-3 px-4 py-3 hover:bg-warm-50 dark:hover:bg-warm-700/50 transition-colors cursor-pointer relative group"
                      onClick={() => handleRecentMatchClick(match)}
                      initial={{ opacity: 0, x: -8 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: idx * 0.12 }}
                    >
                      {/* Timeline dot connector */}
                      <div className="absolute left-0 top-0 bottom-0 w-px bg-warm-200 dark:bg-warm-700" />
                      <div className={`w-2.5 h-2.5 rounded-full shrink-0 z-10 ml-0.5 timeline-dot-pulse ${winner ? 'bg-brand-gold' : 'bg-warm-400 dark:bg-warm-500'}`} />
                      {/* Team color accent bar */}
                      <div
                        className="absolute left-0 top-0 bottom-0 w-0.5 opacity-60"
                        style={{
                          backgroundColor: winner === match.homeTeam.name
                            ? match.homeTeam.color || '#DC2626'
                            : winner === match.awayTeam.name
                              ? match.awayTeam.color || '#1E293B'
                              : '#F59E0B',
                        }}
                      />
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
                        {/* Hover expand details */}
                        <div className="hover-expand-content">
                          <p className="text-[9px] text-warm-400 dark:text-warm-500 mt-1">
                            {match.tournament?.name || 'Friendly Match'} · {formatTimeAgo(match.completedAt)}
                          </p>
                        </div>
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

      {/* Footer */}
      <div className="mt-8 mb-4 text-center px-4">
        <p className="text-sm font-semibold text-warm-500 dark:text-warm-400">
          {t('footer.madeFor', language)}
        </p>
        <p className="text-[10px] text-warm-400 dark:text-warm-500 mt-0.5">
          {t('footer.madeIn', language)}
        </p>
      </div>
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
    ? { bg: 'from-yellow-400/20 to-yellow-600/10 dark:from-yellow-400/15 dark:to-yellow-600/5', border: 'border-yellow-500/40', medal: '🥇', label: '1st', labelColor: 'text-yellow-500', ring: 'ring-2 ring-yellow-400', badgeBg: 'bg-gradient-to-br from-yellow-400 to-yellow-600', badgeText: 'text-yellow-900', avatarBorder: 'border-yellow-400', arrowColor: 'text-yellow-500', barGradient: 'from-yellow-400 to-yellow-600' }
    : rank === 2
      ? { bg: 'from-slate-300/20 to-slate-400/10 dark:from-slate-400/15 dark:to-slate-500/5', border: 'border-slate-400/40', medal: '🥈', label: '2nd', labelColor: 'text-slate-400', ring: 'ring-2 ring-slate-300', badgeBg: 'bg-gradient-to-br from-slate-300 to-slate-500', badgeText: 'text-slate-900', avatarBorder: 'border-slate-300', arrowColor: 'text-slate-400', barGradient: 'from-slate-300 to-slate-500' }
      : { bg: 'from-amber-600/20 to-amber-700/10 dark:from-amber-600/15 dark:to-amber-700/5', border: 'border-amber-600/40', medal: '🥉', label: '3rd', labelColor: 'text-amber-600', ring: 'ring-2 ring-amber-500', badgeBg: 'bg-gradient-to-br from-amber-500 to-amber-700', badgeText: 'text-amber-100', avatarBorder: 'border-amber-500', arrowColor: 'text-amber-600', barGradient: 'from-amber-500 to-amber-700' };

  if (!player) {
    return (
      <div className={`w-28 shrink-0 rounded-xl bg-gradient-to-br ${rankConfig.bg} ${rankConfig.border} border p-3 flex flex-col items-center gap-2`}>
        <div className="w-10 h-10 rounded-full bg-warm-200 dark:bg-warm-700 animate-pulse" />
        <div className="h-3 w-14 rounded bg-warm-200 dark:bg-warm-700 animate-pulse" />
        <div className="h-3 w-10 rounded bg-warm-200 dark:bg-warm-700 animate-pulse" />
      </div>
    );
  }

  // Generate a mini bar chart breakdown with gradient colors
  const barMax = Math.max(player.stat, 1);
  const barSegments = [
    { label: 'R', value: Math.round(barMax * 0.5), gradient: 'bg-gradient-to-t from-brand-red to-brand-red-light' },
    { label: 'T', value: Math.round(barMax * 0.3), gradient: 'bg-gradient-to-t from-brand-navy to-brand-navy-light dark:from-brand-navy-light dark:to-brand-teal' },
    { label: 'B', value: Math.round(barMax * 0.2), gradient: 'bg-gradient-to-t from-brand-gold-dark to-brand-gold-light' },
  ];

  return (
    <motion.div
      className={`w-28 shrink-0 rounded-xl bg-gradient-to-br ${rankConfig.bg} ${rankConfig.border} border p-3 flex flex-col items-center gap-1 relative overflow-hidden`}
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ delay: rank * 0.1 }}
      whileHover={{ scale: 1.05, y: -2 }}
    >
      {/* Shimmer overlay for top rank */}
      {rank === 1 && (
        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-yellow-400/10 to-transparent animate-[shimmer_3s_ease-in-out_infinite]" />
      )}
      {/* Position change indicator */}
      <div className="absolute top-2 right-2">
        <motion.div
          initial={{ y: 5, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: rank * 0.1 + 0.3 }}
          className="flex items-center gap-0.5"
        >
          <TrendingUp className={`w-2.5 h-2.5 ${rankConfig.arrowColor}`} />
        </motion.div>
      </div>
      {/* Rank badge with gradient and shine */}
      <div className={`${rankConfig.badgeBg} ${rankConfig.badgeText} w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-black rank-badge-shine shadow-md relative`}>
        {rank}
      </div>
      {/* Medal-style avatar with colored border */}
      <div className={`w-11 h-11 rounded-full bg-warm-100 dark:bg-warm-700 border-2 ${rankConfig.avatarBorder} ${rankConfig.ring} flex items-center justify-center overflow-hidden relative shadow-md`}>
        {player.avatar ? (
          <img src={player.avatar} alt={player.name} className="w-full h-full object-cover" />
        ) : (
          <span className="text-sm font-bold text-warm-500 dark:text-warm-400">
            {player.name.charAt(0).toUpperCase()}
          </span>
        )}
        {/* Team color indicator dot */}
        {player.teamNames && player.teamNames.length > 0 && (
          <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-brand-red border-2 border-white dark:border-warm-800 shadow-sm" />
        )}
      </div>
      <p className="text-[11px] font-bold text-warm-800 dark:text-warm-100 text-center truncate w-full">
        {player.name}
      </p>
      <p className="text-brand-gold dark:text-brand-gold-light font-black text-sm">{player.stat}</p>
      {/* Mini gradient bar chart breakdown */}
      <div className="flex gap-0.5 w-full items-end mt-0.5">
        {barSegments.map((seg) => (
          <div key={seg.label} className="flex-1 flex flex-col items-center gap-0.5">
            <div
              className={`w-full rounded-sm ${seg.gradient}`}
              style={{ height: `${Math.max((seg.value / barMax) * 16, 3)}px` }}
            />
            <span className="text-[6px] text-warm-400 font-medium">{seg.label}</span>
          </div>
        ))}
      </div>
      <p className="text-[8px] text-warm-400 dark:text-warm-500 text-center">{player.statLabel}</p>
    </motion.div>
  );
}
