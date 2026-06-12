'use client';

import { useEffect, useState, useCallback } from 'react';
import { motion } from 'framer-motion';
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
import ChallengeScreen from './ChallengeScreen';
import GroundsScreen from './GroundsScreen';
import MatchReplayScreen from './MatchReplayScreen';
import AIInsightsScreen from './AIInsightsScreen';
import BroadcastScreen from './BroadcastScreen';
import DataExportScreen from './DataExportScreen';
import SeasonScreen from './SeasonScreen';
import PollsScreen from './PollsScreen';
import SponsorScreen from './SponsorScreen';
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

// ─── Skeleton Components ───────────────────────────────────────────

function LiveMatchSkeleton() {
  return (
    <Card className="bg-warm-100 border-warm-300 py-0 gap-0 overflow-hidden">
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
    <Card className="bg-warm-100 border-warm-300 border py-0 gap-0 overflow-hidden">
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

// ─── Component ─────────────────────────────────────────────────────

type GenderFilter = 'all' | 'boys' | 'girls';

export default function HomeTab() {
  const currentUser = useKabaddiStore((s) => s.currentUser);
  const fetchHomeData = useKabaddiStore((s) => s.fetchHomeData);
  const homeData = useKabaddiStore((s) => s.homeData);
  const addNotification = useKabaddiStore((s) => s.addNotification);
  const notifications = useKabaddiStore((s) => s.notifications);
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
  const [showChallenges, setShowChallenges] = useState(false);
  const [showGrounds, setShowGrounds] = useState(false);
  const [showReplay, setShowReplay] = useState(false);
  const [replayMatchId, setReplayMatchId] = useState<string | null>(null);
  const [showAIInsights, setShowAIInsights] = useState(false);
  const [showBroadcast, setShowBroadcast] = useState(false);
  const [broadcastMatchId, setBroadcastMatchId] = useState<string | null>(null);
  const [showDataExport, setShowDataExport] = useState(false);
  const [showSeason, setShowSeason] = useState(false);
  const [showPolls, setShowPolls] = useState(false);
  const [showSponsors, setShowSponsors] = useState(false);

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
    if (currentUser?.name && notifications.length === 0) {
      addNotification(welcomeBackNotification(currentUser.name));
    }
  }, [currentUser?.name]);

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

  return (
    <div className="min-h-screen bg-warm-50 pb-6">
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
        <NotificationPanel onClose={() => setShowNotifications(false)} />
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
      {showAchievements && (
        <AchievementsScreen onClose={() => setShowAchievements(false)} />
      )}
      {showChallenges && (
        <ChallengeScreen onClose={() => setShowChallenges(false)} />
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
      {showSponsors && (
        <SponsorScreen onClose={() => setShowSponsors(false)} />
      )}

      {/* ─── Header ─── */}
      <header className="sticky top-0 z-30 bg-warm-50/90 backdrop-blur-md border-b border-warm-200/60">
        <div className="px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-brand-red to-brand-red-dark flex items-center justify-center">
              <Trophy className="w-4 h-4 text-white" />
            </div>
            <h1 className="text-base font-black tracking-wider text-warm-800">
              KABADDI <span className="text-brand-red">PRO</span>
            </h1>
            {isPremium && (
              <Badge className="bg-gradient-to-r from-brand-gold to-brand-gold-dark text-white text-[9px] border-0 font-bold px-1.5 py-0">
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
                className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-gradient-to-r from-brand-gold-dark via-brand-gold to-brand-gold-light text-white text-[10px] font-bold shadow-sm shadow-brand-gold/20 active:scale-95 transition-transform"
              >
                <Crown className="w-3 h-3" />
                PRO
              </button>
            )}
            <button
              onClick={() => setShowNotifications(true)}
              className="relative p-2 rounded-full hover:bg-warm-100 transition-colors"
            >
              {unreadNotificationCount > 0 ? (
                <Bell className="w-5 h-5 text-warm-700" />
              ) : (
                <BellOff className="w-5 h-5 text-warm-400" />
              )}
              {unreadNotificationCount > 0 && (
                <span className="absolute top-0.5 right-0.5 flex items-center justify-center min-w-[16px] h-4 rounded-full bg-brand-red text-white text-[9px] font-bold px-1">
                  {unreadNotificationCount > 9 ? '9+' : unreadNotificationCount}
                </span>
              )}
            </button>
          </div>
        </div>
      </header>

      {/* ─── Greeting ─── */}
      <div className="px-4 pt-4 pb-2">
        <p className="text-warm-600 text-sm">Hello,</p>
        <h2 className="text-xl font-bold text-warm-800">
          {currentUser?.name ?? 'Player'}{' '}
          <span className="text-base align-middle">
            {currentUser?.gender && (
              <span className={currentUser.gender.toLowerCase() === 'female' || currentUser.gender.toLowerCase() === 'girls'
                ? 'text-brand-red'
                : 'text-brand-blue'
              }>
                {genderIcon}
              </span>
            )}
          </span>{' '}
          👋
        </h2>
      </div>

      {/* ─── Error State ─── */}
      {error && (
        <section className="px-4 mt-4">
          <Card className="bg-brand-red/20 border-brand-red/30 py-0 gap-0">
            <CardContent className="p-4 flex items-center gap-3">
              <Zap className="w-5 h-5 text-brand-red shrink-0" />
              <p className="text-warm-700 text-sm flex-1">{error}</p>
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
      <section className="px-4 mt-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <h3 className="text-base font-bold text-warm-800">
              Live Matches
            </h3>
            <span className="relative flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-brand-red-light opacity-75" />
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-brand-red" />
            </span>
            <Badge className="bg-emerald-500/10 text-emerald-600 text-[9px] border-0 font-semibold">
              FREE
            </Badge>
          </div>
        </div>

        {/* Gender Filter Toggles */}
        <div className="flex items-center gap-2 mb-3">
          <button
            onClick={() => setGenderFilter('all')}
            className={`px-3 py-1 rounded-full text-xs font-semibold transition-colors ${
              genderFilter === 'all'
                ? 'bg-warm-800 text-warm-50'
                : 'bg-warm-100 text-warm-600 hover:bg-warm-200'
            }`}
          >
            All
          </button>
          <button
            onClick={() => setGenderFilter('boys')}
            className={`px-3 py-1 rounded-full text-xs font-semibold transition-colors ${
              genderFilter === 'boys'
                ? 'bg-brand-blue text-white'
                : 'bg-brand-blue/10 text-brand-blue hover:bg-brand-blue/20'
            }`}
          >
            ♂ Boys
          </button>
          <button
            onClick={() => setGenderFilter('girls')}
            className={`px-3 py-1 rounded-full text-xs font-semibold transition-colors ${
              genderFilter === 'girls'
                ? 'bg-brand-red text-white'
                : 'bg-brand-red/10 text-brand-red hover:bg-brand-red/20'
            }`}
          >
            ♀ Girls
          </button>
        </div>

        {loading ? (
          <div className="flex flex-col gap-3">
            <LiveMatchSkeleton />
            <LiveMatchSkeleton />
          </div>
        ) : filteredMatches.length > 0 ? (
          <motion.div
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
                    className="bg-warm-100 border-warm-300 cursor-pointer hover:border-warm-200 transition-colors py-0 gap-0 overflow-hidden"
                    onClick={() => handleMatchClick(match)}
                  >
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <Badge
                            variant="secondary"
                            className="bg-brand-red/20 text-brand-red text-[10px] font-semibold border-0 px-2 py-0.5"
                          >
                            ● LIVE
                          </Badge>
                          {match.gender && (
                            <Badge
                              variant="secondary"
                              className={`text-[10px] font-semibold border-0 px-2 py-0.5 ${
                                match.gender.toLowerCase() === 'female' || match.gender.toLowerCase() === 'girls'
                                  ? 'bg-brand-red/15 text-brand-red'
                                  : 'bg-brand-blue/15 text-brand-blue'
                              }`}
                            >
                              {match.gender.toLowerCase() === 'female' || match.gender.toLowerCase() === 'girls'
                                ? '♀ Girls Match'
                                : '♂ Boys Match'}
                            </Badge>
                          )}
                        </div>
                        <span className="text-xs text-warm-500 font-medium">
                          {halfLabel(match.half)}
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <div className="flex flex-col items-center gap-1 flex-1">
                          <div
                            className="w-10 h-10 rounded-full bg-warm-50 flex items-center justify-center text-xs font-bold text-warm-800"
                            style={{
                              borderColor: match.homeTeam.color || '#DC2626',
                              borderWidth: 2,
                            }}
                          >
                            {getTeamShortName(match.homeTeam)}
                          </div>
                          <span className="text-xs text-warm-600 text-center leading-tight">
                            {match.homeTeam.name}
                          </span>
                        </div>
                        <div className="flex items-center gap-3 px-4">
                          <span className="text-2xl font-black text-warm-800">
                            {match.homeScore}
                          </span>
                          <span className="text-warm-500 text-sm font-medium">
                            vs
                          </span>
                          <span className="text-2xl font-black text-warm-800">
                            {match.awayScore}
                          </span>
                        </div>
                        <div className="flex flex-col items-center gap-1 flex-1">
                          <div
                            className="w-10 h-10 rounded-full bg-warm-50 flex items-center justify-center text-xs font-bold text-warm-800"
                            style={{
                              borderColor: match.awayTeam.color || '#DC2626',
                              borderWidth: 2,
                            }}
                          >
                            {getTeamShortName(match.awayTeam)}
                          </div>
                          <span className="text-xs text-warm-600 text-center leading-tight">
                            {match.awayTeam.name}
                          </span>
                        </div>
                      </div>
                      {match.tournament && (
                        <p className="text-[10px] text-warm-500 text-center mt-2">
                          {match.tournament.name}
                        </p>
                      )}
                    </CardContent>
                  </Card>
                </motion.div>
              </motion.div>
            ))}
          </motion.div>
        ) : (
          <Card className="bg-warm-100 border-warm-300 py-0 gap-0">
            <CardContent className="flex flex-col items-center justify-center py-10">
              <Calendar className="w-10 h-10 text-warm-500 mb-3" />
              <p className="text-warm-600 text-sm font-medium">
                {genderFilter !== 'all'
                  ? `No live ${genderFilter} matches right now`
                  : 'No live matches right now'}
              </p>
              <p className="text-warm-500 text-xs mt-1">
                Check back later for upcoming matches
              </p>
            </CardContent>
          </Card>
        )}
      </section>

      {/* ─── Recent Results ─── */}
      {!loading && recentMatches.length > 0 && (
        <section className="px-4 mt-6">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-base font-bold text-warm-800">Recent Results</h3>
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
                    className="bg-warm-100 border-warm-300 cursor-pointer hover:border-warm-200 transition-colors py-0 gap-0 overflow-hidden"
                    onClick={() => handleRecentMatchClick(match)}
                  >
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between mb-2">
                        <Badge className="bg-warm-200 text-warm-600 text-[10px] font-semibold border-0 px-2 py-0.5">
                          ✓ COMPLETED
                        </Badge>
                        <span className="text-[10px] text-warm-400">
                          {formatTimeAgo(match.completedAt)}
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 flex-1 min-w-0">
                          <div
                            className="w-8 h-8 rounded-full flex items-center justify-center text-[10px] font-bold text-white shrink-0"
                            style={{ backgroundColor: match.homeTeam.color || '#DC2626' }}
                          >
                            {getTeamShortName(match.homeTeam)}
                          </div>
                          <span className={`text-sm font-semibold truncate ${isHomeWin && !isDraw ? 'text-warm-800' : 'text-warm-500'}`}>
                            {match.homeTeam.name}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 px-3">
                          <span className={`text-lg font-black ${isHomeWin && !isDraw ? 'text-warm-800' : 'text-warm-500'}`}>
                            {match.homeScore}
                          </span>
                          <span className="text-warm-400 text-xs">-</span>
                          <span className={`text-lg font-black ${!isHomeWin && !isDraw ? 'text-warm-800' : 'text-warm-500'}`}>
                            {match.awayScore}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 flex-1 min-w-0 justify-end">
                          <span className={`text-sm font-semibold truncate ${!isHomeWin && !isDraw ? 'text-warm-800' : 'text-warm-500'}`}>
                            {match.awayTeam.name}
                          </span>
                          <div
                            className="w-8 h-8 rounded-full flex items-center justify-center text-[10px] font-bold text-white shrink-0"
                            style={{ backgroundColor: match.awayTeam.color || '#1E293B' }}
                          >
                            {getTeamShortName(match.awayTeam)}
                          </div>
                        </div>
                      </div>
                      {match.tournament && (
                        <p className="text-[10px] text-warm-400 text-center mt-2">
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
                          className="p-1.5 rounded-lg hover:bg-warm-200 transition-colors text-warm-400 hover:text-brand-teal"
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
            <h3 className="text-base font-bold text-warm-800">Upcoming Matches</h3>
            <Clock className="w-4 h-4 text-warm-400" />
          </div>
          <motion.div
            className="flex flex-col gap-3"
            variants={stagger}
            initial="hidden"
            animate="show"
          >
            {upcomingMatches.slice(0, 5).map((match) => (
              <motion.div key={match.id} variants={fadeUp}>
                <Card className="bg-warm-100 border-warm-300 py-0 gap-0 overflow-hidden">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between mb-2">
                      <Badge className="bg-brand-teal/10 text-brand-teal text-[10px] font-semibold border-0 px-2 py-0.5">
                        📅 UPCOMING
                      </Badge>
                      <span className="text-[10px] text-warm-400">
                        {formatDate(match.startedAt)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 flex-1 min-w-0">
                        <div
                          className="w-8 h-8 rounded-full flex items-center justify-center text-[10px] font-bold text-white shrink-0"
                          style={{ backgroundColor: match.homeTeam.color || '#DC2626' }}
                        >
                          {getTeamShortName(match.homeTeam)}
                        </div>
                        <span className="text-sm font-semibold text-warm-700 truncate">
                          {match.homeTeam.name}
                        </span>
                      </div>
                      <span className="text-warm-400 text-xs font-medium px-2">vs</span>
                      <div className="flex items-center gap-2 flex-1 min-w-0 justify-end">
                        <span className="text-sm font-semibold text-warm-700 truncate">
                          {match.awayTeam.name}
                        </span>
                        <div
                          className="w-8 h-8 rounded-full flex items-center justify-center text-[10px] font-bold text-white shrink-0"
                          style={{ backgroundColor: match.awayTeam.color || '#1E293B' }}
                        >
                          {getTeamShortName(match.awayTeam)}
                        </div>
                      </div>
                    </div>
                    {match.tournament && (
                      <p className="text-[10px] text-warm-400 text-center mt-2">
                        {match.tournament.name}
                      </p>
                    )}
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
                        <Bell className="w-3 h-3 mr-1" />
                        Set Reminder
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </motion.div>
        </section>
      )}

      {/* ─── Awards & Honors (Premium for detailed stats) ─── */}
      <section className="px-4 mt-6">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <h3 className="text-base font-bold text-warm-800">
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
                    className="bg-gradient-to-r from-brand-gold/15 to-brand-gold-dark/5 border-brand-gold/30 border py-0 gap-0 overflow-hidden cursor-pointer"
                    onClick={() => setShowAwards(true)}
                  >
                    <CardContent className="p-4">
                      <div className="flex items-center gap-3">
                        <div className="relative shrink-0">
                          <div className="w-14 h-14 rounded-full bg-warm-100 border-2 border-brand-gold/40 flex items-center justify-center overflow-hidden">
                            {motm.userAvatar ? (
                              <img src={motm.userAvatar} alt={motm.userName} className="w-full h-full object-cover" />
                            ) : (
                              <div className="w-12 h-12 rounded-full bg-warm-200 flex items-center justify-center text-lg font-bold text-warm-600">
                                {motm.userName.charAt(0)}
                              </div>
                            )}
                          </div>
                          <div className="absolute -bottom-0.5 -right-0.5 w-6 h-6 rounded-full bg-brand-gold flex items-center justify-center">
                            <Crown className="w-3 h-3 text-warm-800" />
                          </div>
                        </div>
                        <div className="flex-1 min-w-0">
                          <Badge className="bg-brand-gold/20 text-brand-gold-dark text-[10px] font-semibold border-0 px-2 py-0.5 mb-1">
                            <Trophy className="w-2.5 h-2.5 mr-0.5" />
                            Man of the Match
                          </Badge>
                          <p className="text-warm-800 font-bold text-sm truncate">
                            {motm.userName}
                          </p>
                          <p className="text-warm-600 text-xs">
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
                    <CardContent className="p-4">
                      <div className="flex items-center gap-3">
                        <div className="relative shrink-0">
                          <div className="w-14 h-14 rounded-full bg-warm-100 border-2 border-brand-gold/30 flex items-center justify-center">
                            <div className="w-12 h-12 rounded-full bg-warm-200 flex items-center justify-center text-lg font-bold text-warm-600">
                              {player.name.charAt(0)}
                            </div>
                          </div>
                          <div className="absolute -bottom-0.5 -right-0.5 w-6 h-6 rounded-full bg-brand-gold flex items-center justify-center">
                            <Icon className="w-3 h-3 text-warm-800" />
                          </div>
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <Badge
                              className={`${player.badgeBg} text-[10px] font-semibold border-0 px-2 py-0.5 mb-1`}
                            >
                              {player.title}
                            </Badge>
                            {!isPremium && (
                              <Badge className="bg-brand-gold/20 text-brand-gold text-[8px] border-0 px-1 py-0 mb-1">
                                <Lock className="w-2 h-2 mr-0.5" />
                                PRO
                              </Badge>
                            )}
                          </div>
                          <p className="text-warm-800 font-bold text-sm truncate">
                            {player.name}
                          </p>
                          <p className="text-warm-600 text-xs">
                            {player.team}
                          </p>
                        </div>
                        <div className="text-right shrink-0">
                          <p className="text-brand-gold font-black text-base leading-none">
                            {player.stat}
                          </p>
                          <p className="text-warm-500 text-[10px] mt-0.5">
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
          <Card className="bg-warm-100 border-warm-300 py-0 gap-0">
            <CardContent className="flex flex-col items-center justify-center py-10">
              <Award className="w-10 h-10 text-warm-500 mb-3" />
              <p className="text-warm-600 text-sm font-medium">
                No awards yet
              </p>
              <p className="text-warm-500 text-xs mt-1">
                Play matches to see top performers here
              </p>
            </CardContent>
          </Card>
        )}
      </section>

      {/* ─── Leaderboard Preview ─── */}
      <section className="px-4 mt-6">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <h3 className="text-base font-bold text-warm-800">Leaderboard</h3>
            <BarChart3 className="w-4 h-4 text-brand-teal" />
          </div>
          <button
            onClick={() => setShowLeaderboard(true)}
            className="flex items-center gap-1 text-[11px] font-bold text-brand-red"
          >
            View Full
            <ChevronRight className="w-3 h-3" />
          </button>
        </div>

        {loading ? (
          <div className="flex gap-3 overflow-x-auto pb-2 custom-scrollbar">
            {[1, 2, 3].map((i) => (
              <div key={i} className="w-28 h-32 rounded-xl bg-warm-100 animate-pulse shrink-0" />
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
              className="w-28 shrink-0 rounded-xl bg-gradient-to-br from-brand-red/10 to-brand-red/5 border border-brand-red/20 flex flex-col items-center justify-center gap-2 p-3"
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

      {/* ─── Phase 3: Quick Actions ─── */}
      <section className="px-4 mt-6">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-base font-bold text-warm-800">Explore</h3>
          <Sparkles className="w-4 h-4 text-brand-gold" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          {/* Social Feed */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
          >
            <Card
              className="p-3 cursor-pointer hover:border-brand-teal/30 transition-colors active:scale-[0.98]"
              onClick={() => setShowSocialFeed(true)}
            >
              <div className="flex items-center gap-2">
                <div className="w-9 h-9 rounded-lg bg-brand-teal/10 flex items-center justify-center">
                  <Rss className="w-4.5 h-4.5 text-brand-teal" />
                </div>
                <div>
                  <p className="text-xs font-semibold text-warm-800">Social Feed</p>
                  <p className="text-[10px] text-warm-500">Activity updates</p>
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
              className="p-3 cursor-pointer hover:border-brand-navy/30 transition-colors active:scale-[0.98]"
              onClick={() => setShowFollow(true)}
            >
              <div className="flex items-center gap-2">
                <div className="w-9 h-9 rounded-lg bg-brand-navy/10 flex items-center justify-center">
                  <Users className="w-4.5 h-4.5 text-brand-navy" />
                </div>
                <div>
                  <p className="text-xs font-semibold text-warm-800">Follow</p>
                  <p className="text-[10px] text-warm-500">Find players</p>
                </div>
              </div>
            </Card>
          </motion.div>

          {/* Advanced Stats */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
          >
            <Card
              className="p-3 cursor-pointer hover:border-brand-red/30 transition-colors active:scale-[0.98]"
              onClick={() => {
                if (currentUser?.id) {
                  setStatsUserId(currentUser.id);
                  setShowAdvancedStats(true);
                }
              }}
            >
              <div className="flex items-center gap-2">
                <div className="w-9 h-9 rounded-lg bg-brand-red/10 flex items-center justify-center">
                  <Activity className="w-4.5 h-4.5 text-brand-red" />
                </div>
                <div>
                  <p className="text-xs font-semibold text-warm-800">My Stats</p>
                  <p className="text-[10px] text-warm-500">{isPremium ? 'Analytics' : 'PRO only'}</p>
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
              className="p-3 cursor-pointer hover:border-brand-gold/30 transition-colors active:scale-[0.98]"
              onClick={() => {
                if (recentMatches.length > 0) {
                  setHighlightsMatchId(recentMatches[0].id);
                  setShowHighlights(true);
                } else {
                  toast({ title: 'No matches', description: 'Complete a match to see highlights' });
                }
              }}
            >
              <div className="flex items-center gap-2">
                <div className="w-9 h-9 rounded-lg bg-brand-gold/10 flex items-center justify-center">
                  <Sparkles className="w-4.5 h-4.5 text-brand-gold" />
                </div>
                <div>
                  <p className="text-xs font-semibold text-warm-800">Highlights</p>
                  <p className="text-[10px] text-warm-500">Key moments</p>
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
              className="p-3 cursor-pointer hover:border-brand-gold/30 transition-colors active:scale-[0.98]"
              onClick={() => setShowAchievements(true)}
            >
              <div className="flex items-center gap-2">
                <div className="w-9 h-9 rounded-lg bg-brand-gold/10 flex items-center justify-center">
                  <Award className="w-4.5 h-4.5 text-brand-gold" />
                </div>
                <div>
                  <p className="text-xs font-semibold text-warm-800">Achievements</p>
                  <p className="text-[10px] text-warm-500">Unlock badges</p>
                </div>
              </div>
            </Card>
          </motion.div>

          {/* Challenges */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.35 }}
          >
            <Card
              className="p-3 cursor-pointer hover:border-brand-red/30 transition-colors active:scale-[0.98]"
              onClick={() => setShowChallenges(true)}
            >
              <div className="flex items-center gap-2">
                <div className="w-9 h-9 rounded-lg bg-brand-red/10 flex items-center justify-center">
                  <Swords className="w-4.5 h-4.5 text-brand-red" />
                </div>
                <div>
                  <p className="text-xs font-semibold text-warm-800">Challenges</p>
                  <p className="text-[10px] text-warm-500">Challenge teams</p>
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
              className="p-3 cursor-pointer hover:border-brand-teal/30 transition-colors active:scale-[0.98]"
              onClick={() => setShowGrounds(true)}
            >
              <div className="flex items-center gap-2">
                <div className="w-9 h-9 rounded-lg bg-brand-teal/10 flex items-center justify-center">
                  <MapPin className="w-4.5 h-4.5 text-brand-teal" />
                </div>
                <div>
                  <p className="text-xs font-semibold text-warm-800">Grounds</p>
                  <p className="text-[10px] text-warm-500">Find venues</p>
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
              className="p-3 cursor-pointer hover:border-brand-navy/30 transition-colors active:scale-[0.98]"
              onClick={() => {
                if (recentMatches.length > 0) {
                  setReplayMatchId(recentMatches[0].id);
                  setShowReplay(true);
                } else {
                  toast({ title: 'No matches', description: 'Complete a match to replay' });
                }
              }}
            >
              <div className="flex items-center gap-2">
                <div className="w-9 h-9 rounded-lg bg-brand-navy/10 flex items-center justify-center">
                  <Play className="w-4.5 h-4.5 text-brand-navy" />
                </div>
                <div>
                  <p className="text-xs font-semibold text-warm-800">Replay</p>
                  <p className="text-[10px] text-warm-500">Watch again</p>
                </div>
              </div>
            </Card>
          </motion.div>
        </div>

        {/* Advanced Phase 5: Pro Features */}
        <div className="flex items-center gap-2 mt-5 mb-3">
          <h3 className="text-sm font-bold text-warm-800">Pro Features</h3>
          <Crown className="w-3.5 h-3.5 text-brand-gold" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          {/* AI Insights */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
          >
            <Card
              className="p-3 cursor-pointer hover:border-purple-400/30 transition-colors active:scale-[0.98]"
              onClick={() => setShowAIInsights(true)}
            >
              <div className="flex items-center gap-2">
                <div className="w-9 h-9 rounded-lg bg-purple-500/10 flex items-center justify-center">
                  <Brain className="w-4.5 h-4.5 text-purple-500" />
                </div>
                <div>
                  <p className="text-xs font-semibold text-warm-800">AI Insights</p>
                  <p className="text-[10px] text-warm-500">Smart analysis</p>
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
              className="p-3 cursor-pointer hover:border-brand-red/30 transition-colors active:scale-[0.98]"
              onClick={() => {
                if (liveMatches.length > 0) {
                  setBroadcastMatchId(liveMatches[0].id);
                  setShowBroadcast(true);
                } else {
                  toast({ title: 'No live matches', description: 'Start a match to broadcast' });
                }
              }}
            >
              <div className="flex items-center gap-2">
                <div className="w-9 h-9 rounded-lg bg-brand-red/10 flex items-center justify-center">
                  <Radio className="w-4.5 h-4.5 text-brand-red" />
                </div>
                <div>
                  <p className="text-xs font-semibold text-warm-800">Broadcast</p>
                  <p className="text-[10px] text-warm-500">Watch live</p>
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
              className="p-3 cursor-pointer hover:border-brand-teal/30 transition-colors active:scale-[0.98]"
              onClick={() => setShowSeason(true)}
            >
              <div className="flex items-center gap-2">
                <div className="w-9 h-9 rounded-lg bg-brand-teal/10 flex items-center justify-center">
                  <Calendar className="w-4.5 h-4.5 text-brand-teal" />
                </div>
                <div>
                  <p className="text-xs font-semibold text-warm-800">Seasons</p>
                  <p className="text-[10px] text-warm-500">Track yearly</p>
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
              className="p-3 cursor-pointer hover:border-brand-gold/30 transition-colors active:scale-[0.98]"
              onClick={() => setShowPolls(true)}
            >
              <div className="flex items-center gap-2">
                <div className="w-9 h-9 rounded-lg bg-brand-gold/10 flex items-center justify-center">
                  <Vote className="w-4.5 h-4.5 text-brand-gold" />
                </div>
                <div>
                  <p className="text-xs font-semibold text-warm-800">Predictions</p>
                  <p className="text-[10px] text-warm-500">Vote & predict</p>
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
              className="p-3 cursor-pointer hover:border-brand-navy/30 transition-colors active:scale-[0.98]"
              onClick={() => setShowDataExport(true)}
            >
              <div className="flex items-center gap-2">
                <div className="w-9 h-9 rounded-lg bg-brand-navy/10 flex items-center justify-center">
                  <Download className="w-4.5 h-4.5 text-brand-navy" />
                </div>
                <div>
                  <p className="text-xs font-semibold text-warm-800">Export</p>
                  <p className="text-[10px] text-warm-500">CSV download</p>
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
              className="p-3 cursor-pointer hover:border-emerald-400/30 transition-colors active:scale-[0.98]"
              onClick={() => setShowSponsors(true)}
            >
              <div className="flex items-center gap-2">
                <div className="w-9 h-9 rounded-lg bg-emerald-500/10 flex items-center justify-center">
                  <Briefcase className="w-4.5 h-4.5 text-emerald-500" />
                </div>
                <div>
                  <p className="text-xs font-semibold text-warm-800">Sponsors</p>
                  <p className="text-[10px] text-warm-500">Manage ads</p>
                </div>
              </div>
            </Card>
          </motion.div>
        </div>
      </section>
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

  const rankStyle = rank === 1
    ? { bg: 'from-yellow-400/20 to-yellow-600/10', border: 'border-yellow-500/40', medal: '🥇' }
    : rank === 2
      ? { bg: 'from-slate-300/20 to-slate-400/10', border: 'border-slate-400/40', medal: '🥈' }
      : { bg: 'from-amber-600/20 to-amber-700/10', border: 'border-amber-600/40', medal: '🥉' };

  if (!player) {
    return (
      <div className={`w-28 shrink-0 rounded-xl bg-gradient-to-br ${rankStyle.bg} ${rankStyle.border} border p-3 flex flex-col items-center gap-2`}>
        <div className="w-10 h-10 rounded-full bg-warm-200 animate-pulse" />
        <div className="h-3 w-14 rounded bg-warm-200 animate-pulse" />
        <div className="h-3 w-10 rounded bg-warm-200 animate-pulse" />
      </div>
    );
  }

  return (
    <motion.div
      className={`w-28 shrink-0 rounded-xl bg-gradient-to-br ${rankStyle.bg} ${rankStyle.border} border p-3 flex flex-col items-center gap-1`}
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ delay: rank * 0.1 }}
    >
      <span className="text-lg">{rankStyle.medal}</span>
      <div className="w-10 h-10 rounded-full bg-warm-100 border border-warm-200 flex items-center justify-center overflow-hidden">
        {player.avatar ? (
          <img src={player.avatar} alt={player.name} className="w-full h-full object-cover" />
        ) : (
          <span className="text-sm font-bold text-warm-500">
            {player.name.charAt(0).toUpperCase()}
          </span>
        )}
      </div>
      <p className="text-[11px] font-bold text-warm-800 text-center truncate w-full">
        {player.name}
      </p>
      <p className="text-brand-gold font-black text-sm">{player.stat}</p>
      <p className="text-[8px] text-warm-400 text-center">{player.statLabel}</p>
    </motion.div>
  );
}
