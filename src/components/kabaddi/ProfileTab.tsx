'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Camera, Edit3, Zap, Shield, Swords, Award, Loader2, Crown, Lock, Settings, LogOut, IndianRupee, TrendingUp, Users, CreditCard, Moon, Sun, BarChart3, Activity, MapPin, Gift, Swords as ChallengeIcon, Brain, Radio, Download, Vote, Briefcase, Calendar, Hash, Eye, EyeOff, Trophy, Copy, Check, ChevronRight, AlertTriangle } from 'lucide-react';
import { useKabaddiStore, type Language } from '@/lib/store';
import { useTheme } from 'next-themes';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Cell } from 'recharts';
import PremiumUpgradeScreen from './PremiumUpgradeScreen';
import PremiumLock from './PremiumLock';
import TeamManagementScreen from './TeamManagementScreen';
import PlayerComparisonScreen from './PlayerComparisonScreen';
import AdvancedStatsScreen from './AdvancedStatsScreen';
import FollowScreen from './FollowScreen';
import AchievementsScreen from './AchievementsScreen';
import ChallengeScreen from './ChallengeScreen';
import GroundsScreen from './GroundsScreen';
import ReferralScreen from './ReferralScreen';
import AIInsightsScreen from './AIInsightsScreen';
import BroadcastScreen from './BroadcastScreen';
import DataExportScreen from './DataExportScreen';
import SeasonScreen from './SeasonScreen';
import PollsScreen from './PollsScreen';
import SponsorScreen from './SponsorScreen';
import { t } from '@/lib/i18n';

const POSITIONS = [
  { id: 'left-raider', label: 'Left Raider', icon: '⬅️', meaning: 'Attacks from left side' },
  { id: 'right-raider', label: 'Right Raider', icon: '➡️', meaning: 'Attacks from right side' },
  { id: 'both-raider', label: 'Both Raider', icon: '↔️', meaning: 'Raids from both sides' },
  { id: 'left-corner', label: 'Left Corner', icon: '🛡️', meaning: 'Defends left corner' },
  { id: 'right-corner', label: 'Right Corner', icon: '🛡️', meaning: 'Defends right corner' },
  { id: 'left-cover', label: 'Left Cover', icon: '🧱', meaning: 'Cover defender left side' },
  { id: 'right-cover', label: 'Right Cover', icon: '🧱', meaning: 'Cover defender right side' },
  { id: 'all-rounder', label: 'All-Rounder', icon: '⭐', meaning: 'Excels in both raid & defense' },
];

interface RecentMatch {
  id: string;
  homeTeam: string;
  awayTeam: string;
  homeScore: number;
  awayScore: number;
  date: string;
  isPractice: boolean;
  userTeamSide: 'home' | 'away' | 'unknown';
}

export default function ProfileTab() {
  const { currentUser, updateUser, logout } = useKabaddiStore();
  const language = useKabaddiStore((s) => s.language);
  const setLanguage = useKabaddiStore((s) => s.setLanguage);
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [showUpgrade, setShowUpgrade] = useState(false);
  const [showTeamManagement, setShowTeamManagement] = useState(false);
  const [showPlayerComparison, setShowPlayerComparison] = useState(false);
  const [showAdvancedStats, setShowAdvancedStats] = useState(false);
  const [showFollow, setShowFollow] = useState(false);
  const [showAchievements, setShowAchievements] = useState(false);
  const [showChallenges, setShowChallenges] = useState(false);
  const [showGrounds, setShowGrounds] = useState(false);
  const [showReferral, setShowReferral] = useState(false);
  const [showAIInsights, setShowAIInsights] = useState(false);
  const [showDataExport, setShowDataExport] = useState(false);
  const [showSeason, setShowSeason] = useState(false);
  const [showPolls, setShowPolls] = useState(false);
  const [showSponsors, setShowSponsors] = useState(false);
  const { theme, setTheme } = useTheme();
  const darkMode = theme === 'dark';
  const [editForm, setEditForm] = useState({
    gender: currentUser?.gender || '',
    weight: currentUser?.weight?.replace('kg', '') || '',
    practiceGround: currentUser?.practiceGround || '',
    position: '',
    jerseyNumber: '',
  });
  const [earnings, setEarnings] = useState<{
    totalRevenueINR: number;
    totalPayments: number;
    monthlyCount: number;
    yearlyCount: number;
    lifetimeCount: number;
    recentRevenueINR: number;
    recentPaymentsCount: number;
  } | null>(null);

  const [profileData, setProfileData] = useState({
    totalRaids: 0,
    successfulRaids: 0,
    totalTackles: 0,
    successfulTackles: 0,
    bonusPoints: 0,
    superTackles: 0,
    overallRating: 0,
    position: null as string | null,
    jerseyNumber: null as number | null,
    playerCode: null as string | null,
    // Tournament-specific stats
    tournamentMatches: 0,
    tournamentRaidPoints: 0,
    tournamentTacklePoints: 0,
    tournamentTotalPoints: 0,
    // Practice-specific stats
    practiceMatches: 0,
    practiceRaidPoints: 0,
    practiceTacklePoints: 0,
    practiceTotalPoints: 0,
  });
  const [showPhone, setShowPhone] = useState(false);
  const [codeCopied, setCodeCopied] = useState(false);
  const [recentMatches, setRecentMatches] = useState<RecentMatch[]>([]);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);

  const isPremium = currentUser?.isPremium || false;

  const handleCopyCode = () => {
    const code = profileData.playerCode || currentUser?.playerCode;
    if (code) {
      navigator.clipboard.writeText(code).then(() => {
        setCodeCopied(true);
        setTimeout(() => setCodeCopied(false), 2000);
      }).catch(() => {
        toast({ title: 'Code: ' + code });
      });
    }
  };

  // Load profile data from API
  const loadProfile = useCallback(async (userId: string) => {
    try {
      const res = await fetch(`/api/players/${userId}`);
      if (res.ok) {
        const data = await res.json();
        const fetchedPlayerCode = data.player?.playerCode || null;

        if (data.profile) {
          return {
            totalRaids: data.profile.totalRaids || 0,
            successfulRaids: data.profile.successfulRaids || 0,
            totalTackles: data.profile.totalTackles || 0,
            successfulTackles: data.profile.successfulTackles || 0,
            bonusPoints: data.profile.bonusPoints || 0,
            superTackles: data.profile.superTackles || 0,
            overallRating: data.profile.overallRating || 0,
            position: data.profile.position || null,
            jerseyNumber: data.profile.jerseyNumber || null,
            playerCode: fetchedPlayerCode,
            tournamentMatches: data.profile.tournamentMatches || 0,
            tournamentRaidPoints: data.profile.tournamentRaidPoints || 0,
            tournamentTacklePoints: data.profile.tournamentTacklePoints || 0,
            tournamentTotalPoints: data.profile.tournamentTotalPoints || 0,
            practiceMatches: data.profile.practiceMatches || 0,
            practiceRaidPoints: data.profile.practiceRaidPoints || 0,
            practiceTacklePoints: data.profile.practiceTacklePoints || 0,
            practiceTotalPoints: data.profile.practiceTotalPoints || 0,
          };
        } else {
          return {
            totalRaids: 0,
            successfulRaids: 0,
            totalTackles: 0,
            successfulTackles: 0,
            bonusPoints: 0,
            superTackles: 0,
            overallRating: 0,
            position: null,
            jerseyNumber: null,
            playerCode: fetchedPlayerCode,
            tournamentMatches: 0,
            tournamentRaidPoints: 0,
            tournamentTacklePoints: 0,
            tournamentTotalPoints: 0,
            practiceMatches: 0,
            practiceRaidPoints: 0,
            practiceTacklePoints: 0,
            practiceTotalPoints: 0,
          };
        }
      }
    } catch {
      // Return fallback data
    }
    return null;
  }, []);

  // Load recent matches from API
  const loadRecentMatches = useCallback(async (userId: string) => {
    try {
      const res = await fetch('/api/matches?limit=5');
      if (res.ok) {
        const data = await res.json();
        if (data.matches && Array.isArray(data.matches)) {
          const matches: RecentMatch[] = data.matches.map((m: Record<string, unknown>) => {
            const homeTeam = (m.homeTeam as Record<string, string>)?.name || 'Team A';
            const awayTeam = (m.awayTeam as Record<string, string>)?.name || 'Team B';
            const scorers = m.scorers as Array<Record<string, string>> | undefined;
            const userScored = scorers?.some((s) => s.userId === userId);
            let userTeamSide: 'home' | 'away' | 'unknown' = 'unknown';
            if (userScored) {
              const userScorer = scorers?.find((s) => s.userId === userId);
              if (userScorer?.teamId === m.homeTeamId) userTeamSide = 'home';
              else if (userScorer?.teamId === m.awayTeamId) userTeamSide = 'away';
            }
            return {
              id: m.id as string,
              homeTeam,
              awayTeam,
              homeScore: (m.homeScore as number) || 0,
              awayScore: (m.awayScore as number) || 0,
              date: m.completedAt ? new Date(m.completedAt as string).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) : '—',
              isPractice: (m.isPractice as boolean) || false,
              userTeamSide,
            };
          });
          setRecentMatches(matches);
        }
      }
    } catch {
      // Silently fail
    }
  }, []);

  useEffect(() => {
    if (!currentUser?.id) return;
    let cancelled = false;
    loadProfile(currentUser.id).then((data) => {
      if (data && !cancelled) {
        setProfileData(data);
        setEditForm(prev => ({
          ...prev,
          position: data.position || '',
          jerseyNumber: data.jerseyNumber?.toString() || '',
        }));
        if (data.playerCode && !currentUser?.playerCode) {
          updateUser({ playerCode: data.playerCode });
        }
      }
    });
    loadRecentMatches(currentUser.id);
    return () => { cancelled = true; };
  }, [currentUser?.id, loadProfile, loadRecentMatches, updateUser, currentUser?.playerCode]);

  // Load earnings data for admin users
  useEffect(() => {
    if (!currentUser?.isAdmin) return;
    let cancelled = false;
    fetch('/api/payments?status=paid')
      .then(res => res.json())
      .then(data => {
        if (!cancelled && data.summary) {
          setEarnings(data.summary);
        }
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [currentUser?.isAdmin]);

  // Dark mode: use next-themes
  const toggleDarkMode = () => {
    setTheme(darkMode ? 'light' : 'dark');
  };

  // Sync edit form when currentUser changes
  useEffect(() => {
    setEditForm({
      gender: currentUser?.gender || '',
      weight: currentUser?.weight?.replace('kg', '') || '',
      practiceGround: currentUser?.practiceGround || '',
      position: profileData.position || '',
      jerseyNumber: profileData.jerseyNumber?.toString() || '',
    });
  }, [currentUser, profileData.position, profileData.jerseyNumber, editOpen]);

  // ─── Avatar Upload ───
  const handleAvatarClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !currentUser?.id) return;

    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
    if (!allowedTypes.includes(file.type)) {
      toast({ title: 'Invalid file type', description: 'Only JPEG, PNG, WebP, GIF allowed.', variant: 'destructive' });
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      toast({ title: 'File too large', description: 'Max 5MB allowed.', variant: 'destructive' });
      return;
    }

    setUploading(true);
    try {
      const reader = new FileReader();
      const base64Promise = new Promise<string>((resolve, reject) => {
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
      });
      reader.readAsDataURL(file);
      const fileData = await base64Promise;

      const res = await fetch('/api/upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fileData,
          fileName: file.name,
          fileType: file.type,
          userId: currentUser.id,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        const avatarUrl = data.url;
        updateUser({ avatar: avatarUrl });
        toast({ title: 'Profile picture updated!' });
      } else {
        const data = await res.json();
        toast({ title: 'Upload failed', description: data.error || 'Please try again.', variant: 'destructive' });
      }
    } catch {
      toast({ title: 'Upload failed', description: 'Please try again.', variant: 'destructive' });
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  // ─── Save Profile ───
  const handleSaveProfile = async () => {
    try {
      const updateBody: Record<string, unknown> = {
        gender: editForm.gender,
        weight: editForm.weight ? `${editForm.weight}kg` : undefined,
        practiceGround: editForm.practiceGround || undefined,
        position: editForm.position || undefined,
        jerseyNumber: editForm.jerseyNumber ? parseInt(editForm.jerseyNumber) : undefined,
      };

      await fetch(`/api/players/${currentUser?.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updateBody),
      });
    } catch {
      // Local update still works
    }
    updateUser({
      gender: editForm.gender || undefined,
      weight: editForm.weight ? `${editForm.weight}kg` : undefined,
      practiceGround: editForm.practiceGround || undefined,
    });
    setEditOpen(false);
    toast({ title: 'Profile updated!' });
  };

  const raidPoints = profileData.successfulRaids + profileData.bonusPoints;
  const tacklePoints = profileData.successfulTackles;
  const raidSuccessRate = profileData.totalRaids > 0 ? (profileData.successfulRaids / profileData.totalRaids) * 100 : 0;
  const tackleSuccessRate = profileData.totalTackles > 0 ? (profileData.successfulTackles / profileData.totalTackles) * 100 : 0;

  const performanceData = [
    { name: 'Raids', value: profileData.successfulRaids },
    { name: 'Tackles', value: profileData.successfulTackles },
    { name: 'Bonus', value: profileData.bonusPoints * 10 },
    { name: 'S.Tkl', value: profileData.superTackles * 10 },
  ];

  const barColors = ['#DC2626', '#1E293B', '#14B8A6', '#475569'];

  const badges = [
    { icon: '⚡', label: 'Super Raider', condition: profileData.successfulRaids >= 20, premium: false },
    { icon: '🛡️', label: 'Iron Wall', condition: profileData.superTackles >= 5, premium: false },
    { icon: '🏆', label: 'Veteran', condition: profileData.totalRaids >= 50, premium: true },
    { icon: '🔥', label: 'On Fire', condition: raidPoints >= 30, premium: true },
    { icon: '💪', label: 'All-Rounder', condition: raidPoints >= 20 && tacklePoints >= 20, premium: false },
    { icon: '🎯', label: 'Precision', condition: raidSuccessRate >= 70, premium: true },
    { icon: '🧱', label: 'Fortress', condition: tackleSuccessRate >= 70, premium: true },
  ];

  // Feature categories
  const featureCategories = [
    {
      title: 'Team & Stats',
      items: [
        { icon: Users, label: 'My Teams', desc: 'Manage your teams', color: 'brand-teal', onClick: () => setShowTeamManagement(true) },
        { icon: BarChart3, label: 'Compare', desc: isPremium ? 'Player vs Player' : 'PRO only', color: 'brand-gold', onClick: () => { if (!isPremium) { setShowUpgrade(true); return; } setShowPlayerComparison(true); } },
        { icon: Activity, label: 'My Stats', desc: isPremium ? 'Advanced analytics' : 'PRO only', color: 'brand-red', onClick: () => setShowAdvancedStats(true) },
        { icon: Users, label: 'Follow', desc: 'Find & connect', color: 'brand-navy', onClick: () => setShowFollow(true) },
      ],
    },
    {
      title: 'Achievements',
      items: [
        { icon: Award, label: 'Achievements', desc: 'Unlock badges', color: 'brand-gold', onClick: () => setShowAchievements(true) },
        { icon: Swords, label: 'Challenges', desc: 'Rival teams', color: 'brand-red', onClick: () => setShowChallenges(true) },
        { icon: MapPin, label: 'Grounds', desc: 'Find venues', color: 'brand-teal', onClick: () => setShowGrounds(true) },
        { icon: Gift, label: 'Refer & Earn', desc: 'Free Premium', color: 'brand-gold', onClick: () => setShowReferral(true) },
      ],
    },
    {
      title: 'Advanced',
      items: [
        { icon: Brain, label: 'AI Insights', desc: 'Smart analysis', color: 'purple-500', onClick: () => setShowAIInsights(true) },
        { icon: Calendar, label: 'Seasons', desc: 'Track yearly', color: 'brand-teal', onClick: () => setShowSeason(true) },
        { icon: Vote, label: 'Predictions', desc: 'Vote & predict', color: 'brand-gold', onClick: () => setShowPolls(true) },
        { icon: Download, label: 'Export Data', desc: 'CSV download', color: 'brand-navy', onClick: () => setShowDataExport(true) },
        { icon: Briefcase, label: 'Sponsors', desc: 'Manage ads', color: 'emerald-500', onClick: () => setShowSponsors(true) },
      ],
    },
  ];

  const getPositionLabel = (pos: string | null) => {
    if (!pos) return null;
    const found = POSITIONS.find(p => p.id === pos);
    return found ? found.label : pos;
  };

  const getPositionIcon = (pos: string | null) => {
    if (!pos) return null;
    const found = POSITIONS.find(p => p.id === pos);
    return found ? found.icon : '🏅';
  };

  const getMatchResult = (match: RecentMatch): 'W' | 'L' | 'D' => {
    if (match.userTeamSide === 'unknown') {
      return match.homeScore === match.awayScore ? 'D' : 'D';
    }
    const myScore = match.userTeamSide === 'home' ? match.homeScore : match.awayScore;
    const oppScore = match.userTeamSide === 'home' ? match.awayScore : match.homeScore;
    if (myScore > oppScore) return 'W';
    if (myScore < oppScore) return 'L';
    return 'D';
  };

  const getResultColor = (result: 'W' | 'L' | 'D') => {
    switch (result) {
      case 'W': return 'bg-emerald-500 text-white';
      case 'L': return 'bg-red-500 text-white';
      case 'D': return 'bg-amber-500 text-white';
    }
  };

  return (
    <div className="px-4 py-6 space-y-6">
      {/* Premium Upgrade Modal */}
      {showUpgrade && (
        <PremiumUpgradeScreen
          onClose={() => setShowUpgrade(false)}
          feature="Premium Features"
        />
      )}
      {showTeamManagement && (
        <TeamManagementScreen onClose={() => setShowTeamManagement(false)} />
      )}
      {showPlayerComparison && (
        <PlayerComparisonScreen onClose={() => setShowPlayerComparison(false)} />
      )}
      {showAdvancedStats && currentUser?.id && (
        <AdvancedStatsScreen userId={currentUser.id} onClose={() => setShowAdvancedStats(false)} />
      )}
      {showFollow && (
        <FollowScreen onClose={() => setShowFollow(false)} />
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
      {showReferral && (
        <ReferralScreen onClose={() => setShowReferral(false)} />
      )}
      {showAIInsights && (
        <AIInsightsScreen onClose={() => setShowAIInsights(false)} />
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

      {/* Hidden file input for avatar upload */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif"
        className="hidden"
        onChange={handleFileChange}
      />

      {/* ═══════════════════════════════════════════ */}
      {/* PROFILE HEADER with Gradient Banner */}
      {/* ═══════════════════════════════════════════ */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative overflow-hidden rounded-2xl shadow-lg"
      >
        {/* Gradient Banner Background */}
        <div className="relative bg-gradient-to-br from-red-600 via-red-700 to-red-900 dark:from-red-800 dark:via-red-900 dark:to-red-950 pt-8 pb-16 px-6">
          {/* Decorative Pattern Overlay */}
          <div className="absolute inset-0 opacity-10">
            <div className="absolute top-0 left-0 w-full h-full" style={{
              backgroundImage: `repeating-linear-gradient(45deg, transparent, transparent 10px, rgba(255,255,255,0.1) 10px, rgba(255,255,255,0.1) 11px),
                repeating-linear-gradient(-45deg, transparent, transparent 10px, rgba(255,255,255,0.1) 10px, rgba(255,255,255,0.1) 11px)`,
            }} />
            {/* Decorative circles */}
            <div className="absolute -top-8 -right-8 w-32 h-32 rounded-full border-4 border-white/20" />
            <div className="absolute -bottom-4 -left-4 w-24 h-24 rounded-full border-4 border-white/15" />
            <div className="absolute top-4 right-20 w-12 h-12 rounded-full border-2 border-white/10" />
          </div>

          {/* Edit Profile Button */}
          <div className="relative z-10 flex justify-end mb-2">
            <Dialog open={editOpen} onOpenChange={setEditOpen}>
              <DialogTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-white/80 hover:text-white hover:bg-white/10 rounded-full px-3 h-8 text-xs gap-1.5"
                >
                  <Edit3 className="w-3.5 h-3.5" />
                  Edit
                </Button>
              </DialogTrigger>
              <DialogContent className="bg-warm-50 dark:bg-warm-100 border-warm-300 max-h-[85vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle className="text-warm-800 dark:text-warm-700">Edit Profile</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 mt-2">
                  {/* Gender Selection */}
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      onClick={() => setEditForm({ ...editForm, gender: 'male' })}
                      className={`p-3 rounded-xl border-2 text-sm font-medium transition-all ${
                        editForm.gender === 'male'
                          ? 'border-brand-blue bg-brand-blue/10 text-brand-blue'
                          : 'border-warm-300 text-warm-600 dark:border-warm-200'
                      }`}
                    >
                      ♂ Boy
                    </button>
                    <button
                      onClick={() => setEditForm({ ...editForm, gender: 'female' })}
                      className={`p-3 rounded-xl border-2 text-sm font-medium transition-all ${
                        editForm.gender === 'female'
                          ? 'border-brand-red bg-brand-red/10 text-brand-red'
                          : 'border-warm-300 text-warm-600 dark:border-warm-200'
                      }`}
                    >
                      ♀ Girl
                    </button>
                  </div>

                  {/* Weight Input */}
                  <div className="relative">
                    <Input
                      type="number"
                      placeholder="Weight (kg)"
                      value={editForm.weight}
                      onChange={(e) => setEditForm({ ...editForm, weight: e.target.value })}
                      className="bg-white dark:bg-warm-50 border-warm-300 rounded-xl pr-12"
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-warm-400 text-sm pointer-events-none">kg</span>
                  </div>

                  {/* Practice Ground */}
                  <Input
                    placeholder="Practice ground"
                    value={editForm.practiceGround}
                    onChange={(e) => setEditForm({ ...editForm, practiceGround: e.target.value })}
                    className="bg-white dark:bg-warm-50 border-warm-300 rounded-xl"
                  />

                  {/* Jersey Number */}
                  <div className="relative">
                    <Input
                      type="number"
                      placeholder="Jersey Number"
                      value={editForm.jerseyNumber}
                      onChange={(e) => setEditForm({ ...editForm, jerseyNumber: e.target.value })}
                      className="bg-white dark:bg-warm-50 border-warm-300 rounded-xl"
                      min={1}
                      max={99}
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-warm-400 text-sm pointer-events-none">#</span>
                  </div>

                  {/* Position Selection */}
                  <div>
                    <label className="text-sm font-semibold text-warm-700 dark:text-warm-600 mb-2 block">Position</label>
                    <div className="grid grid-cols-2 gap-2">
                      {POSITIONS.map((pos) => (
                        <button
                          key={pos.id}
                          onClick={() => setEditForm({ ...editForm, position: editForm.position === pos.id ? '' : pos.id })}
                          className={`p-2.5 rounded-xl border-2 text-left transition-all ${
                            editForm.position === pos.id
                              ? 'border-brand-teal bg-brand-teal/10'
                              : 'border-warm-300 bg-white dark:bg-warm-50 hover:border-warm-200'
                          }`}
                        >
                          <div className="flex items-center gap-1.5">
                            <span className="text-base">{pos.icon}</span>
                            <span className={`text-xs font-semibold ${editForm.position === pos.id ? 'text-brand-teal' : 'text-warm-700 dark:text-warm-600'}`}>
                              {pos.label}
                            </span>
                          </div>
                          <p className="text-[9px] text-warm-400 mt-0.5 ml-6">{pos.meaning}</p>
                        </button>
                      ))}
                    </div>
                  </div>

                  <Button
                    onClick={handleSaveProfile}
                    className="w-full bg-brand-red hover:bg-brand-red-dark text-white rounded-xl"
                  >
                    Save Changes
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>

          {/* Name and Gender */}
          <div className="relative z-10 text-center">
            <h2 className="text-xl font-bold text-white flex items-center justify-center gap-1.5">
              {currentUser?.name || 'Player'}
              {currentUser?.gender === 'male' ? (
                <span className="text-blue-300">♂</span>
              ) : currentUser?.gender === 'female' ? (
                <span className="text-pink-300">♀</span>
              ) : null}
              {isPremium ? (
                <motion.div
                  initial={{ scale: 0, rotate: -180 }}
                  animate={{ scale: 1, rotate: 0 }}
                  transition={{ type: 'spring', stiffness: 300, damping: 15 }}
                  className="inline-flex items-center"
                >
                  <div className="w-6 h-6 rounded-full bg-gradient-to-br from-brand-gold to-brand-gold-dark flex items-center justify-center shadow-md">
                    <Crown className="w-3.5 h-3.5 text-white" />
                  </div>
                </motion.div>
              ) : null}
            </h2>

            {/* Weight & Practice Ground under name */}
            <div className="flex items-center justify-center gap-3 mt-1.5 text-white/70 text-xs">
              {currentUser?.weight && (
                <span className="flex items-center gap-1">
                  <Activity className="w-3 h-3" />
                  {currentUser.weight}
                </span>
              )}
              {currentUser?.practiceGround && (
                <span className="flex items-center gap-1">
                  <MapPin className="w-3 h-3" />
                  {currentUser.practiceGround}
                </span>
              )}
            </div>

            {/* Position, Jersey & Premium Badges */}
            <div className="flex items-center justify-center gap-2 mt-2">
              {profileData.position && (
                <span className="px-2.5 py-1 rounded-full bg-white/15 backdrop-blur-sm text-white text-xs font-medium border border-white/20">
                  {getPositionIcon(profileData.position)} {getPositionLabel(profileData.position)}
                </span>
              )}
              {profileData.jerseyNumber && (
                <span className="px-2.5 py-1 rounded-full bg-white/15 backdrop-blur-sm text-white text-xs font-medium border border-white/20">
                  #{profileData.jerseyNumber}
                </span>
              )}
              {isPremium && (
                <span className="px-2.5 py-1 rounded-full bg-gradient-to-r from-brand-gold to-brand-gold-dark text-white text-xs font-bold">
                  PRO
                </span>
              )}
            </div>

            <p className="text-white/60 text-sm capitalize mt-1">{currentUser?.role || 'Player'}</p>
          </div>
        </div>

        {/* Avatar overlapping the banner */}
        <div className="absolute -bottom-10 left-1/2 -translate-x-1/2 z-20">
          <div className="relative">
            <div className="w-20 h-20 rounded-full bg-warm-200 dark:bg-warm-300 flex items-center justify-center text-3xl overflow-hidden border-4 border-white dark:border-warm-100 shadow-xl">
              {currentUser?.avatar ? (
                <img
                  src={currentUser.avatar}
                  alt={currentUser.name || 'Player'}
                  className="w-full h-full object-cover"
                />
              ) : (
                <span>
                  {currentUser?.gender === 'female' ? '👩' : '👨'}
                </span>
              )}
            </div>
            <button
              onClick={handleAvatarClick}
              disabled={uploading}
              className="absolute bottom-0 right-0 w-7 h-7 rounded-full bg-brand-red flex items-center justify-center text-white shadow-lg hover:bg-brand-red-dark transition-colors disabled:opacity-50"
            >
              {uploading ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Camera className="w-3.5 h-3.5" />
              )}
            </button>
          </div>
        </div>
      </motion.div>

      {/* Player Code - Prominent Display */}
      {(profileData.playerCode || currentUser?.playerCode) && (
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.1, type: 'spring', stiffness: 300 }}
          className="pt-8"
        >
          <button
            onClick={handleCopyCode}
            className="w-full inline-flex items-center gap-3 px-4 py-3 rounded-xl bg-gradient-to-r from-slate-50 via-slate-100 to-slate-50 dark:from-warm-100 dark:via-warm-100/80 dark:to-warm-100 border-2 border-slate-200 dark:border-warm-200 hover:border-brand-teal/40 active:scale-[0.98] transition-all shadow-sm"
          >
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-red-500 to-red-700 flex items-center justify-center shadow-md shrink-0">
              <Hash className="w-5 h-5 text-white" />
            </div>
            <div className="text-left flex-1">
              <p className="text-[10px] font-semibold text-warm-400 uppercase tracking-wider leading-none">Player Code</p>
              <p className="text-lg font-black text-warm-800 dark:text-warm-700 font-mono leading-tight tracking-wider">{profileData.playerCode || currentUser?.playerCode}</p>
            </div>
            <div className="shrink-0">
              <AnimatePresence mode="wait">
                {codeCopied ? (
                  <motion.div
                    key="check"
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    exit={{ scale: 0 }}
                    className="w-8 h-8 rounded-full bg-emerald-500 flex items-center justify-center"
                  >
                    <Check className="w-4 h-4 text-white" />
                  </motion.div>
                ) : (
                  <motion.div
                    key="copy"
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    exit={{ scale: 0 }}
                    className="w-8 h-8 rounded-full bg-warm-200 dark:bg-warm-300 flex items-center justify-center"
                  >
                    <Copy className="w-3.5 h-3.5 text-warm-400" />
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </button>
        </motion.div>
      )}

      {/* ═══════════════════════════════════════════ */}
      {/* PREMIUM CARD */}
      {/* ═══════════════════════════════════════════ */}
      {!isPremium && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
        >
          <button
            onClick={() => setShowUpgrade(true)}
            className="w-full relative overflow-hidden rounded-2xl p-[2px] active:scale-[0.98] transition-transform"
          >
            {/* Animated gradient border */}
            <div className="absolute inset-0 rounded-2xl bg-gradient-to-r from-amber-400 via-yellow-300 to-amber-400 animate-[borderRotate_3s_linear_infinite]" style={{ backgroundSize: '200% 200%' }} />
            <div className="relative rounded-2xl bg-gradient-to-r from-amber-600 via-yellow-500 to-amber-600 p-4 overflow-hidden">
              {/* Golden shimmer effect */}
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent -translate-x-full animate-[shimmer_3s_infinite]" />
              {/* Sparkle dots */}
              <div className="absolute top-3 right-8 w-1.5 h-1.5 rounded-full bg-white/60 animate-pulse" />
              <div className="absolute top-8 right-16 w-1 h-1 rounded-full bg-white/40 animate-pulse" style={{ animationDelay: '0.5s' }} />
              <div className="absolute bottom-4 right-10 w-1.5 h-1.5 rounded-full bg-white/50 animate-pulse" style={{ animationDelay: '1s' }} />
              <div className="relative z-10 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-xl bg-white/20 backdrop-blur-sm flex items-center justify-center shadow-md">
                    <Crown className="w-7 h-7 text-white" />
                  </div>
                  <div className="text-left">
                    <p className="text-white font-bold text-base">Go Premium</p>
                    <p className="text-white/80 text-xs">Unlock stats, host tournaments & more</p>
                  </div>
                </div>
                <div className="bg-white/25 backdrop-blur-sm rounded-xl px-4 py-2">
                  <span className="text-white text-sm font-black">₹149</span>
                  <span className="text-white/80 text-xs">/mo</span>
                </div>
              </div>
            </div>
          </button>
        </motion.div>
      )}

      {/* Premium Active Card */}
      {isPremium && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
        >
          <Card className="p-4 bg-gradient-to-r from-brand-gold/10 to-brand-gold/5 border border-brand-gold/20 dark:from-brand-gold/20 dark:to-brand-gold/10">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-brand-gold/20 flex items-center justify-center">
                  <Crown className="w-5 h-5 text-brand-gold" />
                </div>
                <div className="text-left">
                  <p className="text-warm-800 dark:text-warm-700 font-bold text-sm">Premium Active</p>
                  <p className="text-warm-500 text-xs">All features unlocked</p>
                </div>
              </div>
              <Badge className="bg-brand-gold/20 text-brand-gold border-0 text-xs font-bold">
                <Crown className="w-3 h-3 mr-1" />
                PRO
              </Badge>
            </div>
          </Card>
        </motion.div>
      )}

      {/* ═══════════════════════════════════════════ */}
      {/* STATS CARDS */}
      {/* ═══════════════════════════════════════════ */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="grid grid-cols-3 gap-3"
      >
        <Card className="p-3 text-center bg-brand-red/5 dark:bg-brand-red/10 border-brand-red/15 shadow-sm">
          <Zap className="w-5 h-5 text-brand-red mx-auto mb-1" />
          <div className="text-lg font-bold text-brand-red">{raidPoints}</div>
          <div className="text-[10px] text-warm-600 dark:text-warm-500">Raid Points</div>
        </Card>
        <Card className="p-3 text-center bg-brand-blue/5 dark:bg-brand-blue/10 border-brand-blue/15 shadow-sm">
          <Shield className="w-5 h-5 text-brand-blue mx-auto mb-1" />
          <div className="text-lg font-bold text-brand-blue">{tacklePoints}</div>
          <div className="text-[10px] text-warm-600 dark:text-warm-500">Tackle Points</div>
        </Card>
        <Card className="p-3 text-center bg-brand-gold/5 dark:bg-brand-gold/10 border-brand-gold/15 shadow-sm">
          <Swords className="w-5 h-5 text-brand-gold mx-auto mb-1" />
          <div className="text-lg font-bold text-brand-gold">{profileData.overallRating.toFixed(1)}</div>
          <div className="text-[10px] text-warm-600 dark:text-warm-500">Rating</div>
        </Card>
      </motion.div>

      {/* ═══════════════════════════════════════════ */}
      {/* SCORE BREAKDOWN with Progress Bars */}
      {/* ═══════════════════════════════════════════ */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.12 }}
      >
        <h3 className="font-bold text-warm-800 dark:text-warm-700 mb-3 flex items-center gap-2">
          <Trophy className="w-4 h-4 text-brand-gold" />
          Score Breakdown
        </h3>

        {/* Success Rate Progress Bars */}
        <Card className="p-4 mb-3 shadow-sm">
          <div className="space-y-4">
            {/* Raid Success Rate */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-md bg-brand-red/10 flex items-center justify-center">
                    <Zap className="w-3.5 h-3.5 text-brand-red" />
                  </div>
                  <span className="text-sm font-medium text-warm-700 dark:text-warm-600">Raid Success</span>
                </div>
                <span className="text-sm font-bold text-brand-red">{raidSuccessRate.toFixed(0)}%</span>
              </div>
              <div className="w-full h-2.5 bg-warm-200 dark:bg-warm-300 rounded-full overflow-hidden">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${Math.min(raidSuccessRate, 100)}%` }}
                  transition={{ duration: 1, ease: 'easeOut', delay: 0.3 }}
                  className="h-full rounded-full bg-gradient-to-r from-red-400 via-red-500 to-red-600"
                />
              </div>
              <p className="text-[10px] text-warm-400 mt-1">{profileData.successfulRaids} of {profileData.totalRaids} raids successful</p>
            </div>

            {/* Tackle Success Rate */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-md bg-brand-blue/10 flex items-center justify-center">
                    <Shield className="w-3.5 h-3.5 text-brand-blue" />
                  </div>
                  <span className="text-sm font-medium text-warm-700 dark:text-warm-600">Tackle Success</span>
                </div>
                <span className="text-sm font-bold text-brand-blue">{tackleSuccessRate.toFixed(0)}%</span>
              </div>
              <div className="w-full h-2.5 bg-warm-200 dark:bg-warm-300 rounded-full overflow-hidden">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${Math.min(tackleSuccessRate, 100)}%` }}
                  transition={{ duration: 1, ease: 'easeOut', delay: 0.4 }}
                  className="h-full rounded-full bg-gradient-to-r from-slate-400 via-slate-600 to-slate-800"
                />
              </div>
              <p className="text-[10px] text-warm-400 mt-1">{profileData.successfulTackles} of {profileData.totalTackles} tackles successful</p>
            </div>
          </div>
        </Card>

        {/* Practice vs Tournament Stats */}
        <div className="grid grid-cols-2 gap-3">
          {/* Practice Stats */}
          <Card className="p-3 bg-brand-green/5 dark:bg-brand-green/10 border-brand-green/15 shadow-sm">
            <div className="flex items-center gap-1.5 mb-2">
              <span className="text-sm">🏋️</span>
              <span className="text-xs font-bold text-brand-green">Practice</span>
            </div>
            <div className="space-y-1.5">
              <div className="flex justify-between text-[11px]">
                <span className="text-warm-500 dark:text-warm-400">Matches</span>
                <span className="text-warm-800 dark:text-warm-700 font-semibold">{profileData.practiceMatches}</span>
              </div>
              <div className="flex justify-between text-[11px]">
                <span className="text-warm-500 dark:text-warm-400">Raid Pts</span>
                <span className="text-brand-red font-semibold">{profileData.practiceRaidPoints}</span>
              </div>
              <div className="flex justify-between text-[11px]">
                <span className="text-warm-500 dark:text-warm-400">Tackle Pts</span>
                <span className="text-brand-blue font-semibold">{profileData.practiceTacklePoints}</span>
              </div>
              <div className="flex justify-between text-[11px] border-t border-warm-200 dark:border-warm-300 pt-1">
                <span className="text-warm-500 dark:text-warm-400">Total Pts</span>
                <span className="text-warm-800 dark:text-warm-700 font-bold">{profileData.practiceTotalPoints}</span>
              </div>
            </div>
          </Card>
          {/* Tournament Stats */}
          <Card className="p-3 bg-brand-gold/5 dark:bg-brand-gold/10 border-brand-gold/15 shadow-sm">
            <div className="flex items-center gap-1.5 mb-2">
              <span className="text-sm">🏆</span>
              <span className="text-xs font-bold text-brand-gold">Tournament</span>
            </div>
            <div className="space-y-1.5">
              <div className="flex justify-between text-[11px]">
                <span className="text-warm-500 dark:text-warm-400">Matches</span>
                <span className="text-warm-800 dark:text-warm-700 font-semibold">{profileData.tournamentMatches}</span>
              </div>
              <div className="flex justify-between text-[11px]">
                <span className="text-warm-500 dark:text-warm-400">Raid Pts</span>
                <span className="text-brand-red font-semibold">{profileData.tournamentRaidPoints}</span>
              </div>
              <div className="flex justify-between text-[11px]">
                <span className="text-warm-500 dark:text-warm-400">Tackle Pts</span>
                <span className="text-brand-blue font-semibold">{profileData.tournamentTacklePoints}</span>
              </div>
              <div className="flex justify-between text-[11px] border-t border-warm-200 dark:border-warm-300 pt-1">
                <span className="text-warm-500 dark:text-warm-400">Total Pts</span>
                <span className="text-warm-800 dark:text-warm-700 font-bold">{profileData.tournamentTotalPoints}</span>
              </div>
            </div>
          </Card>
        </div>
      </motion.div>

      {/* ═══════════════════════════════════════════ */}
      {/* RECENT MATCHES Section (NEW) */}
      {/* ═══════════════════════════════════════════ */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.14 }}
      >
        <h3 className="font-bold text-warm-800 dark:text-warm-700 mb-3 flex items-center gap-2">
          <Calendar className="w-4 h-4 text-brand-teal" />
          Recent Matches
        </h3>
        <Card className="shadow-sm overflow-hidden">
          {recentMatches.length === 0 ? (
            <div className="p-6 text-center">
              <div className="w-12 h-12 rounded-full bg-warm-100 dark:bg-warm-200 flex items-center justify-center mx-auto mb-3">
                <Swords className="w-6 h-6 text-warm-300 dark:text-warm-400" />
              </div>
              <p className="text-sm text-warm-500 dark:text-warm-400">No matches yet</p>
              <p className="text-xs text-warm-400 dark:text-warm-300 mt-1">Start scoring to see your match history</p>
            </div>
          ) : (
            <div className="divide-y divide-warm-200 dark:divide-warm-300">
              {recentMatches.slice(0, 5).map((match, idx) => {
                const result = getMatchResult(match);
                return (
                  <motion.div
                    key={match.id}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.1 * idx }}
                    className="flex items-center gap-3 px-4 py-3 hover:bg-warm-50 dark:hover:bg-warm-200/30 transition-colors"
                  >
                    {/* Result indicator */}
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-black shrink-0 ${getResultColor(result)}`}>
                      {result}
                    </div>
                    {/* Match info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1 text-sm font-medium text-warm-800 dark:text-warm-700">
                        <span className="truncate">{match.homeTeam}</span>
                        <span className="text-warm-400 text-xs shrink-0">vs</span>
                        <span className="truncate">{match.awayTeam}</span>
                      </div>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-xs text-warm-400">{match.date}</span>
                        {match.isPractice && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-brand-teal/10 text-brand-teal font-medium">Practice</span>
                        )}
                      </div>
                    </div>
                    {/* Score */}
                    <div className="text-right shrink-0">
                      <span className="text-sm font-bold text-warm-800 dark:text-warm-700">
                        {match.homeScore} - {match.awayScore}
                      </span>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          )}
          {recentMatches.length > 0 && (
            <div className="px-4 py-2.5 border-t border-warm-200 dark:border-warm-300">
              <button className="w-full text-center text-xs font-semibold text-brand-teal hover:text-brand-teal-dark transition-colors flex items-center justify-center gap-1">
                View All Matches
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </Card>
      </motion.div>

      {/* ═══════════════════════════════════════════ */}
      {/* BADGES Section with Animated Icons */}
      {/* ═══════════════════════════════════════════ */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.15 }}
      >
        <PremiumLock feature="Detailed Badges">
          <h3 className="font-bold text-warm-800 dark:text-warm-700 mb-3 flex items-center gap-2">
            <Award className="w-4 h-4 text-brand-gold" />
            Badges
          </h3>
          {badges.every(b => !b.condition) ? (
            <Card className="p-5 shadow-sm">
              <div className="text-center">
                <motion.div
                  animate={{ y: [0, -4, 0] }}
                  transition={{ duration: 2, repeat: Infinity }}
                  className="text-3xl mb-2"
                >
                  🏅
                </motion.div>
                <p className="text-sm text-warm-600 dark:text-warm-500 font-medium">No badges earned yet</p>
                <p className="text-xs text-warm-400 dark:text-warm-300 mt-1">Play more matches to unlock badges!</p>
              </div>
            </Card>
          ) : (
            <div className="flex flex-wrap gap-2">
              {badges.map((badge, idx) => (
                <motion.div
                  key={badge.label}
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 0.05 * idx, type: 'spring', stiffness: 300 }}
                >
                  <Badge
                    variant="secondary"
                    className={`py-1.5 px-3 text-xs relative ${
                      badge.condition
                        ? 'bg-brand-gold/10 text-brand-gold border border-brand-gold/30 shadow-sm'
                        : badge.premium && !isPremium
                          ? 'bg-warm-100 dark:bg-warm-200 text-warm-300 dark:text-warm-400 border border-warm-200 dark:border-warm-300'
                          : 'bg-warm-200 dark:bg-warm-300 text-warm-400 dark:text-warm-500'
                    }`}
                  >
                    <motion.span
                      className="inline-block mr-1"
                      animate={badge.condition ? { scale: [1, 1.2, 1] } : {}}
                      transition={badge.condition ? { duration: 2, repeat: Infinity, repeatDelay: 3 } : {}}
                    >
                      {badge.premium && !isPremium ? '🔒' : badge.icon}
                    </motion.span>
                    {badge.label}
                    {badge.premium && !isPremium && (
                      <span className="ml-1 text-[8px] font-bold text-brand-gold/60">PRO</span>
                    )}
                  </Badge>
                </motion.div>
              ))}
            </div>
          )}
        </PremiumLock>
      </motion.div>

      {/* ═══════════════════════════════════════════ */}
      {/* PERFORMANCE CHART */}
      {/* ═══════════════════════════════════════════ */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
      >
        <PremiumLock feature="Performance Analytics">
          <h3 className="font-bold text-warm-800 dark:text-warm-700 mb-3">Performance</h3>
          <Card className="p-4 shadow-sm">
            <div className="h-48">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={performanceData} barSize={40}>
                  <XAxis
                    dataKey="name"
                    axisLine={false}
                    tickLine={false}
                    tick={{ fontSize: 11, fill: '#8B7355' }}
                  />
                  <YAxis hide />
                  <Bar dataKey="value" radius={[6, 6, 0, 0]}>
                    {performanceData.map((_, index) => (
                      <Cell key={`cell-${index}`} fill={barColors[index]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>
        </PremiumLock>
      </motion.div>

      {/* ═══════════════════════════════════════════ */}
      {/* DETAILED STATS BREAKDOWN */}
      {/* ═══════════════════════════════════════════ */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.22 }}
      >
        <PremiumLock feature="Detailed Stats" compact>
          <h3 className="font-bold text-warm-800 dark:text-warm-700 mb-3 flex items-center gap-2">
            <Swords className="w-4 h-4 text-brand-red" />
            Detailed Breakdown
          </h3>
          <Card className="p-4 shadow-sm">
            <div className="grid grid-cols-2 gap-3">
              <div className="text-center p-2.5 rounded-xl bg-brand-red/5 dark:bg-brand-red/10">
                <Zap className="w-4 h-4 text-brand-red mx-auto mb-1" />
                <p className="text-xs text-warm-500 dark:text-warm-400">Raid Success</p>
                <p className="text-lg font-bold text-brand-red">
                  {profileData.totalRaids > 0
                    ? ((profileData.successfulRaids / profileData.totalRaids) * 100).toFixed(0)
                    : 0}%
                </p>
              </div>
              <div className="text-center p-2.5 rounded-xl bg-brand-blue/5 dark:bg-brand-blue/10">
                <Shield className="w-4 h-4 text-brand-blue mx-auto mb-1" />
                <p className="text-xs text-warm-500 dark:text-warm-400">Tackle Success</p>
                <p className="text-lg font-bold text-brand-blue">
                  {profileData.totalTackles > 0
                    ? ((profileData.successfulTackles / profileData.totalTackles) * 100).toFixed(0)
                    : 0}%
                </p>
              </div>
              <div className="text-center p-2.5 rounded-xl bg-brand-teal/5 dark:bg-brand-teal/10">
                <Award className="w-4 h-4 text-brand-teal mx-auto mb-1" />
                <p className="text-xs text-warm-500 dark:text-warm-400">Bonus Points</p>
                <p className="text-lg font-bold text-brand-teal">{profileData.bonusPoints}</p>
              </div>
              <div className="text-center p-2.5 rounded-xl bg-purple-500/5 dark:bg-purple-500/10">
                <Shield className="w-4 h-4 text-purple-500 mx-auto mb-1" />
                <p className="text-xs text-warm-500 dark:text-warm-400">Super Tackles</p>
                <p className="text-lg font-bold text-purple-500">{profileData.superTackles}</p>
              </div>
            </div>
          </Card>
        </PremiumLock>
      </motion.div>

      {/* ═══════════════════════════════════════════ */}
      {/* FEATURE LIST - Categorized with Left Border Accents */}
      {/* ═══════════════════════════════════════════ */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.26 }}
      >
        <h3 className="font-bold text-warm-800 dark:text-warm-700 mb-3 flex items-center gap-2">
          <Settings className="w-4 h-4 text-warm-500" />
          Features
        </h3>
        <div className="space-y-4">
          {featureCategories.map((category) => (
            <div key={category.title}>
              <p className="text-[10px] font-semibold text-warm-400 dark:text-warm-300 uppercase tracking-wider mb-2 ml-1">{category.title}</p>
              <Card className="shadow-sm overflow-hidden divide-y divide-warm-100 dark:divide-warm-200">
                {category.items.map((item, idx) => {
                  const IconComp = item.icon;
                  return (
                    <motion.button
                      key={item.label}
                      initial={{ opacity: 0, x: -5 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.03 * idx }}
                      onClick={item.onClick}
                      className="w-full flex items-center gap-3 p-3 hover:bg-warm-50 dark:hover:bg-warm-200/30 active:bg-warm-100 dark:active:bg-warm-200/50 transition-colors text-left group"
                    >
                      {/* Left border accent */}
                      <div className={`w-1 h-8 rounded-full bg-${item.color} shrink-0`} />
                      {/* Icon */}
                      <div className={`w-8 h-8 rounded-lg bg-${item.color}/10 flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform`}>
                        <IconComp className={`w-4 h-4 text-${item.color}`} />
                      </div>
                      {/* Label and description */}
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold text-warm-800 dark:text-warm-700">{item.label}</p>
                        <p className="text-[10px] text-warm-400 dark:text-warm-300">{item.desc}</p>
                      </div>
                      {/* Chevron */}
                      <ChevronRight className="w-4 h-4 text-warm-300 dark:text-warm-400 group-hover:text-warm-500 transition-colors shrink-0" />
                    </motion.button>
                  );
                })}
              </Card>
            </div>
          ))}
        </div>
      </motion.div>

      {/* ═══════════════════════════════════════════ */}
      {/* SECTION DIVIDER */}
      {/* ═══════════════════════════════════════════ */}
      <div className="flex items-center gap-3 my-2">
        <div className="flex-1 h-px bg-warm-200 dark:bg-warm-300" />
        <span className="text-[10px] font-medium text-warm-300 dark:text-warm-400 uppercase tracking-wider">Info & Settings</span>
        <div className="flex-1 h-px bg-warm-200 dark:bg-warm-300" />
      </div>

      {/* ═══════════════════════════════════════════ */}
      {/* PERSONAL INFO & SETTINGS */}
      {/* ═══════════════════════════════════════════ */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.25 }}
      >
        <Card className="p-4 space-y-4 shadow-sm">
          {/* Phone */}
          <div className="flex justify-between text-sm items-center">
            <div>
              <span className="text-warm-800 dark:text-warm-700 font-medium text-xs">Phone</span>
              <p className="text-[10px] text-warm-400 dark:text-warm-300">Your registered number</p>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-warm-800 dark:text-warm-700 font-medium font-mono text-xs">
                {showPhone ? (currentUser?.phone || '—') : (currentUser?.phone ? `****${currentUser.phone.slice(-2)}` : '—')}
              </span>
              <button
                onClick={() => setShowPhone(!showPhone)}
                className="w-5 h-5 rounded-full bg-warm-100 dark:bg-warm-200 flex items-center justify-center text-warm-400 hover:text-warm-600 transition-colors"
              >
                {showPhone ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
              </button>
            </div>
          </div>

          {/* Weight */}
          {currentUser?.weight && (
            <div className="flex justify-between text-sm items-center">
              <div>
                <span className="text-warm-800 dark:text-warm-700 font-medium text-xs">Weight</span>
                <p className="text-[10px] text-warm-400 dark:text-warm-300">Your weight category</p>
              </div>
              <span className="text-warm-800 dark:text-warm-700 font-medium text-xs">{currentUser.weight}</span>
            </div>
          )}

          {/* Practice Ground */}
          {currentUser?.practiceGround && (
            <div className="flex justify-between text-sm items-center">
              <div>
                <span className="text-warm-800 dark:text-warm-700 font-medium text-xs">Practice Ground</span>
                <p className="text-[10px] text-warm-400 dark:text-warm-300">Your training venue</p>
              </div>
              <span className="text-warm-800 dark:text-warm-700 font-medium text-xs">{currentUser.practiceGround}</span>
            </div>
          )}

          {/* Position */}
          {profileData.position && (
            <div className="flex justify-between text-sm items-center">
              <div>
                <span className="text-warm-800 dark:text-warm-700 font-medium text-xs">Position</span>
                <p className="text-[10px] text-warm-400 dark:text-warm-300">Your playing role</p>
              </div>
              <span className="text-warm-800 dark:text-warm-700 font-medium text-xs">{getPositionIcon(profileData.position)} {getPositionLabel(profileData.position)}</span>
            </div>
          )}

          {/* Jersey */}
          {profileData.jerseyNumber && (
            <div className="flex justify-between text-sm items-center">
              <div>
                <span className="text-warm-800 dark:text-warm-700 font-medium text-xs">Jersey</span>
                <p className="text-[10px] text-warm-400 dark:text-warm-300">Your jersey number</p>
              </div>
              <span className="text-warm-800 dark:text-warm-700 font-medium text-xs">#{profileData.jerseyNumber}</span>
            </div>
          )}

          {/* Plan */}
          <div className="flex justify-between text-sm items-center">
            <div>
              <span className="text-warm-800 dark:text-warm-700 font-medium text-xs">Plan</span>
              <p className="text-[10px] text-warm-400 dark:text-warm-300">Your subscription</p>
            </div>
            <span className={`font-medium text-xs ${isPremium ? 'text-brand-gold' : 'text-warm-600 dark:text-warm-500'}`}>
              {isPremium ? '⭐ Premium' : 'Free'}
            </span>
          </div>

          {/* Language Toggle */}
          <div className="flex justify-between items-center">
            <div>
              <span className="text-warm-800 dark:text-warm-700 font-medium text-xs">Language</span>
              <p className="text-[10px] text-warm-400 dark:text-warm-300">App display language</p>
            </div>
            <div className="flex items-center gap-1 bg-warm-100 dark:bg-warm-200 rounded-lg p-0.5">
              <button
                onClick={() => setLanguage('en')}
                className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                  language === 'en'
                    ? 'bg-brand-teal text-white shadow-sm'
                    : 'text-warm-500 dark:text-warm-400 hover:text-warm-700 dark:hover:text-warm-600'
                }`}
              >
                English
              </button>
              <button
                onClick={() => setLanguage('hi')}
                className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                  language === 'hi'
                    ? 'bg-brand-teal text-white shadow-sm'
                    : 'text-warm-500 dark:text-warm-400 hover:text-warm-700 dark:hover:text-warm-600'
                }`}
              >
                हिंदी
              </button>
            </div>
          </div>

          {/* Dark Mode Toggle */}
          <div className="flex justify-between items-center">
            <div>
              <span className="text-warm-800 dark:text-warm-700 font-medium text-xs">Theme</span>
              <p className="text-[10px] text-warm-400 dark:text-warm-300">{darkMode ? 'Dark mode active' : 'Light mode active'}</p>
            </div>
            <button
              onClick={toggleDarkMode}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                darkMode
                  ? 'bg-warm-700 text-brand-gold hover:bg-warm-600'
                  : 'bg-warm-100 dark:bg-warm-200 text-warm-600 dark:text-warm-500 hover:bg-warm-200 dark:hover:bg-warm-300'
              }`}
            >
              {darkMode ? (
                <>
                  <Moon className="w-3.5 h-3.5" />
                  Dark
                </>
              ) : (
                <>
                  <Sun className="w-3.5 h-3.5" />
                  Light
                </>
              )}
            </button>
          </div>
        </Card>
      </motion.div>

      {/* ═══════════════════════════════════════════ */}
      {/* EARNINGS DASHBOARD - Admin Only */}
      {/* ═══════════════════════════════════════════ */}
      {currentUser?.isAdmin && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.28 }}
        >
          <h3 className="font-bold text-warm-800 dark:text-warm-700 mb-3 flex items-center gap-2">
            <IndianRupee className="w-4 h-4 text-emerald-500" />
            Earnings Dashboard
          </h3>
          <Card className="p-4 bg-gradient-to-br from-emerald-50 to-teal-50 dark:from-emerald-900/20 dark:to-teal-900/20 border-emerald-200 dark:border-emerald-800/30">
            <div className="grid grid-cols-2 gap-3 mb-3">
              <div className="p-3 rounded-xl bg-white/80 dark:bg-warm-100/50 border border-emerald-100 dark:border-emerald-800/20">
                <div className="flex items-center gap-1.5 mb-1">
                  <IndianRupee className="w-3.5 h-3.5 text-emerald-600" />
                  <span className="text-[10px] text-warm-500 dark:text-warm-400 uppercase tracking-wide">Total Revenue</span>
                </div>
                <p className="text-xl font-black text-emerald-700 dark:text-emerald-400">
                  ₹{earnings?.totalRevenueINR?.toLocaleString() || '0'}
                </p>
              </div>
              <div className="p-3 rounded-xl bg-white/80 dark:bg-warm-100/50 border border-emerald-100 dark:border-emerald-800/20">
                <div className="flex items-center gap-1.5 mb-1">
                  <TrendingUp className="w-3.5 h-3.5 text-teal-600" />
                  <span className="text-[10px] text-warm-500 dark:text-warm-400 uppercase tracking-wide">Last 30 Days</span>
                </div>
                <p className="text-xl font-black text-teal-700 dark:text-teal-400">
                  ₹{earnings?.recentRevenueINR?.toLocaleString() || '0'}
                </p>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <div className="text-center p-2 rounded-lg bg-white/60 dark:bg-warm-100/30 border border-emerald-100 dark:border-emerald-800/20">
                <p className="text-xs text-warm-500 dark:text-warm-400">Monthly</p>
                <p className="text-base font-bold text-warm-800 dark:text-warm-700">{earnings?.monthlyCount || 0}</p>
              </div>
              <div className="text-center p-2 rounded-lg bg-white/60 dark:bg-warm-100/30 border border-emerald-100 dark:border-emerald-800/20">
                <p className="text-xs text-warm-500 dark:text-warm-400">Yearly</p>
                <p className="text-base font-bold text-warm-800 dark:text-warm-700">{earnings?.yearlyCount || 0}</p>
              </div>
              <div className="text-center p-2 rounded-lg bg-white/60 dark:bg-warm-100/30 border border-emerald-100 dark:border-emerald-800/20">
                <p className="text-xs text-warm-500 dark:text-warm-400">Lifetime</p>
                <p className="text-base font-bold text-warm-800 dark:text-warm-700">{earnings?.lifetimeCount || 0}</p>
              </div>
            </div>
            <div className="mt-3 flex items-center justify-between text-xs text-warm-500 dark:text-warm-400">
              <span className="flex items-center gap-1">
                <Users className="w-3 h-3" />
                {earnings?.totalPayments || 0} premium subscribers
              </span>
              <span className="flex items-center gap-1">
                <CreditCard className="w-3 h-3" />
                Razorpay
              </span>
            </div>
          </Card>
        </motion.div>
      )}

      {/* ═══════════════════════════════════════════ */}
      {/* LOGOUT BUTTON with Confirmation */}
      {/* ═══════════════════════════════════════════ */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
      >
        {!showLogoutConfirm ? (
          <Button
            variant="outline"
            onClick={() => setShowLogoutConfirm(true)}
            className="w-full rounded-xl border-warm-300 dark:border-warm-200 text-brand-red hover:bg-brand-red/5 hover:text-brand-red h-11 gap-2"
          >
            <LogOut className="w-4 h-4" />
            Logout
          </Button>
        ) : (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="rounded-xl border-2 border-red-200 dark:border-red-800/40 bg-red-50 dark:bg-red-900/20 p-4 text-center"
          >
            <div className="flex items-center justify-center gap-2 mb-3">
              <AlertTriangle className="w-5 h-5 text-red-500" />
              <p className="text-sm font-bold text-red-700 dark:text-red-400">Confirm Logout</p>
            </div>
            <p className="text-xs text-warm-500 dark:text-warm-400 mb-4">Are you sure you want to log out of your account?</p>
            <div className="flex gap-3">
              <Button
                variant="outline"
                onClick={() => setShowLogoutConfirm(false)}
                className="flex-1 rounded-xl border-warm-300 dark:border-warm-200 h-9 text-xs"
              >
                Cancel
              </Button>
              <Button
                onClick={() => {
                  logout();
                  toast({ title: 'Logged out successfully' });
                }}
                className="flex-1 rounded-xl bg-brand-red hover:bg-brand-red-dark text-white h-9 text-xs"
              >
                <LogOut className="w-3.5 h-3.5 mr-1.5" />
                Logout
              </Button>
            </div>
          </motion.div>
        )}
      </motion.div>
    </div>
  );
}
