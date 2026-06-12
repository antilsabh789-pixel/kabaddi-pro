'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { motion } from 'framer-motion';
import { Camera, Edit3, Zap, Shield, Swords, Award, Loader2, Crown, Lock, Settings, LogOut, IndianRupee, TrendingUp, Users, CreditCard, Moon, Sun, BarChart3, Activity, MapPin, Gift, Swords as ChallengeIcon, Brain, Radio, Download, Vote, Briefcase, Calendar, Hash, Eye, EyeOff, Trophy, Copy, Check } from 'lucide-react';
import { useKabaddiStore, type Language } from '@/lib/store';
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
  const [darkMode, setDarkMode] = useState(false);
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

  const isPremium = currentUser?.isPremium || false;

  const handleCopyCode = () => {
    const code = profileData.playerCode || currentUser?.playerCode;
    if (code) {
      navigator.clipboard.writeText(code).then(() => {
        setCodeCopied(true);
        setTimeout(() => setCodeCopied(false), 2000);
      }).catch(() => {
        // Fallback: select text
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
        // Always extract playerCode from the player object
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
          // Even if no profile, return playerCode
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

  useEffect(() => {
    if (!currentUser?.id) return;
    let cancelled = false;
    loadProfile(currentUser.id).then((data) => {
      if (data && !cancelled) {
        setProfileData(data);
        // Also update edit form with loaded position/jersey
        setEditForm(prev => ({
          ...prev,
          position: data.position || '',
          jerseyNumber: data.jerseyNumber?.toString() || '',
        }));
        // Sync playerCode to currentUser if not already there
        if (data.playerCode && !currentUser?.playerCode) {
          updateUser({ playerCode: data.playerCode });
        }
      }
    });
    return () => { cancelled = true; };
  }, [currentUser?.id, loadProfile]);

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

  // Dark mode: load saved preference on mount
  useEffect(() => {
    const saved = localStorage.getItem('kabaddi-pro-theme');
    if (saved === 'dark') {
      setDarkMode(true);
      document.documentElement.classList.add('dark');
    }
  }, []);

  const toggleDarkMode = () => {
    const next = !darkMode;
    setDarkMode(next);
    if (next) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('kabaddi-pro-theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('kabaddi-pro-theme', 'light');
    }
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

    // Validate file type
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
    if (!allowedTypes.includes(file.type)) {
      toast({ title: 'Invalid file type', description: 'Only JPEG, PNG, WebP, GIF allowed.', variant: 'destructive' });
      return;
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast({ title: 'File too large', description: 'Max 5MB allowed.', variant: 'destructive' });
      return;
    }

    setUploading(true);
    try {
      // Convert file to base64
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
        // Update local state
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
      // Reset file input
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

  const performanceData = [
    { name: 'Raids', value: profileData.successfulRaids },
    { name: 'Tackles', value: profileData.successfulTackles },
    { name: 'Bonus', value: profileData.bonusPoints * 10 },
    { name: 'S.Tkl', value: profileData.superTackles * 10 },
  ];

  const barColors = ['#DC2626', '#1E293B', '#14B8A6', '#475569'];

  const badges = [
    { icon: '⚡', label: 'Super Raider', condition: profileData.successfulRaids >= 20 },
    { icon: '🛡️', label: 'Iron Wall', condition: profileData.superTackles >= 5 },
    { icon: '🏆', label: 'Veteran', condition: profileData.totalRaids >= 50 },
    { icon: '🔥', label: 'On Fire', condition: raidPoints >= 30 },
    { icon: '💪', label: 'All-Rounder', condition: raidPoints >= 20 && tacklePoints >= 20 },
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

  return (
    <div className="px-4 py-6 space-y-5">
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

      {/* Profile Header */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center"
      >
        <div className="relative inline-block">
          <div className="w-24 h-24 rounded-full bg-warm-200 flex items-center justify-center text-4xl overflow-hidden border-4 border-white shadow-lg">
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
            className="absolute bottom-0 right-0 w-8 h-8 rounded-full bg-brand-red flex items-center justify-center text-white shadow-lg hover:bg-brand-red-dark transition-colors disabled:opacity-50"
          >
            {uploading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Camera className="w-4 h-4" />
            )}
          </button>
        </div>

        <h2 className="text-xl font-bold text-warm-800 mt-3 flex items-center justify-center gap-1.5">
          {currentUser?.name || 'Player'}
          {currentUser?.gender === 'male' ? (
            <span className="text-brand-blue">♂</span>
          ) : currentUser?.gender === 'female' ? (
            <span className="text-brand-red">♀</span>
          ) : null}
          {/* Premium Crown Badge */}
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

        {/* Player Code - Prominent Display */}
        {(profileData.playerCode || currentUser?.playerCode) && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.1, type: 'spring', stiffness: 300 }}
            className="mt-3"
          >
            <button
              onClick={handleCopyCode}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-indigo-500/10 via-indigo-500/5 to-purple-500/10 border-2 border-indigo-500/20 hover:border-indigo-500/40 active:scale-[0.97] transition-all shadow-sm"
            >
              <div className="w-8 h-8 rounded-lg bg-indigo-500 flex items-center justify-center shadow-md">
                <Hash className="w-4 h-4 text-white" />
              </div>
              <div className="text-left">
                <p className="text-[9px] font-semibold text-indigo-400 uppercase tracking-wider leading-none">Player Code</p>
                <p className="text-lg font-black text-indigo-600 font-mono leading-tight tracking-wider">{profileData.playerCode || currentUser?.playerCode}</p>
              </div>
              <div className="ml-2">
                {codeCopied ? (
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    className="w-6 h-6 rounded-full bg-green-500 flex items-center justify-center"
                  >
                    <Check className="w-3.5 h-3.5 text-white" />
                  </motion.div>
                ) : (
                  <div className="w-6 h-6 rounded-full bg-indigo-500/10 flex items-center justify-center">
                    <Copy className="w-3 h-3 text-indigo-400" />
                  </div>
                )}
              </div>
            </button>
          </motion.div>
        )}

        {/* Position, Jersey & Premium Badge */}
        <div className="flex items-center justify-center gap-2 mt-1.5">
          {profileData.position && (
            <Badge variant="secondary" className="bg-brand-teal/10 text-brand-teal text-xs border border-brand-teal/20">
              {getPositionIcon(profileData.position)} {getPositionLabel(profileData.position)}
            </Badge>
          )}
          {profileData.jerseyNumber && (
            <Badge variant="secondary" className="bg-brand-red/10 text-brand-red text-xs border border-brand-red/20">
              #{profileData.jerseyNumber}
            </Badge>
          )}
          {/* Premium Badge */}
          {isPremium ? (
            <Badge className="bg-gradient-to-r from-brand-gold to-brand-gold-dark text-white text-xs border-0 font-bold">
              <Crown className="w-3 h-3 mr-1" />
              PRO
            </Badge>
          ) : null}
        </div>

        <p className="text-warm-500 text-sm capitalize">{currentUser?.role || 'Player'}</p>

        {/* Go Premium Card (shown only for free users) */}
        {!isPremium && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="mt-4"
          >
            <button
              onClick={() => setShowUpgrade(true)}
              className="w-full relative overflow-hidden rounded-2xl p-4 bg-gradient-to-r from-brand-gold-dark via-brand-gold to-brand-gold-light shadow-lg shadow-brand-gold/20 active:scale-[0.98] transition-transform"
            >
              {/* Shimmer effect */}
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full animate-[shimmer_3s_infinite]" />
              <div className="relative z-10 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-white/20 backdrop-blur-sm flex items-center justify-center">
                    <Crown className="w-6 h-6 text-white" />
                  </div>
                  <div className="text-left">
                    <p className="text-white font-bold text-sm">Go Premium</p>
                    <p className="text-white/80 text-xs">Unlock detailed stats & host tournaments</p>
                  </div>
                </div>
                <div className="bg-white/20 backdrop-blur-sm rounded-lg px-3 py-1.5">
                  <span className="text-white text-xs font-bold">₹149/mo</span>
                </div>
              </div>
            </button>
          </motion.div>
        )}

        {/* Premium Active Card (shown for premium users) */}
        {isPremium && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="mt-4"
          >
            <Card className="p-4 bg-gradient-to-r from-brand-gold/10 to-brand-gold/5 border border-brand-gold/20">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-brand-gold/20 flex items-center justify-center">
                    <Crown className="w-5 h-5 text-brand-gold" />
                  </div>
                  <div className="text-left">
                    <p className="text-warm-800 font-bold text-sm">Premium Active</p>
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

        <Dialog open={editOpen} onOpenChange={setEditOpen}>
          <DialogTrigger asChild>
            <Button
              variant="outline"
              className="mt-3 rounded-xl border-warm-300 text-warm-600 h-8 text-xs"
            >
              <Edit3 className="w-3 h-3 mr-1" />
              Edit Profile
            </Button>
          </DialogTrigger>
          <DialogContent className="bg-warm-50 border-warm-300 max-h-[85vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="text-warm-800">Edit Profile</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 mt-2">
              {/* Gender Selection */}
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => setEditForm({ ...editForm, gender: 'male' })}
                  className={`p-3 rounded-xl border-2 text-sm font-medium ${
                    editForm.gender === 'male'
                      ? 'border-brand-blue bg-brand-blue/10 text-brand-blue'
                      : 'border-warm-300 text-warm-600'
                  }`}
                >
                  ♂ Boy
                </button>
                <button
                  onClick={() => setEditForm({ ...editForm, gender: 'female' })}
                  className={`p-3 rounded-xl border-2 text-sm font-medium ${
                    editForm.gender === 'female'
                      ? 'border-brand-red bg-brand-red/10 text-brand-red'
                      : 'border-warm-300 text-warm-600'
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
                  className="bg-white border-warm-300 rounded-xl pr-12"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-warm-400 text-sm pointer-events-none">kg</span>
              </div>

              {/* Practice Ground */}
              <Input
                placeholder="Practice ground"
                value={editForm.practiceGround}
                onChange={(e) => setEditForm({ ...editForm, practiceGround: e.target.value })}
                className="bg-white border-warm-300 rounded-xl"
              />

              {/* Jersey Number */}
              <div className="relative">
                <Input
                  type="number"
                  placeholder="Jersey Number"
                  value={editForm.jerseyNumber}
                  onChange={(e) => setEditForm({ ...editForm, jerseyNumber: e.target.value })}
                  className="bg-white border-warm-300 rounded-xl"
                  min={1}
                  max={99}
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-warm-400 text-sm pointer-events-none">#</span>
              </div>

              {/* Position Selection */}
              <div>
                <label className="text-sm font-semibold text-warm-700 mb-2 block">Position</label>
                <div className="grid grid-cols-2 gap-2">
                  {POSITIONS.map((pos) => (
                    <button
                      key={pos.id}
                      onClick={() => setEditForm({ ...editForm, position: editForm.position === pos.id ? '' : pos.id })}
                      className={`p-2.5 rounded-xl border-2 text-left transition-all ${
                        editForm.position === pos.id
                          ? 'border-brand-teal bg-brand-teal/10'
                          : 'border-warm-300 bg-white hover:border-warm-200'
                      }`}
                    >
                      <div className="flex items-center gap-1.5">
                        <span className="text-base">{pos.icon}</span>
                        <span className={`text-xs font-semibold ${editForm.position === pos.id ? 'text-brand-teal' : 'text-warm-700'}`}>
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
      </motion.div>

      {/* Stats Cards - Basic stats always visible */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="grid grid-cols-3 gap-3"
      >
        <Card className="p-3 text-center bg-brand-red/5 border-brand-red/15">
          <Zap className="w-5 h-5 text-brand-red mx-auto mb-1" />
          <div className="text-lg font-bold text-brand-red">{raidPoints}</div>
          <div className="text-[10px] text-warm-600">Raid Points</div>
        </Card>
        <Card className="p-3 text-center bg-brand-blue/5 border-brand-blue/15">
          <Shield className="w-5 h-5 text-brand-blue mx-auto mb-1" />
          <div className="text-lg font-bold text-brand-blue">{tacklePoints}</div>
          <div className="text-[10px] text-warm-600">Tackle Points</div>
        </Card>
        <Card className="p-3 text-center bg-brand-gold/5 border-brand-gold/15">
          <Swords className="w-5 h-5 text-brand-gold mx-auto mb-1" />
          <div className="text-lg font-bold text-brand-gold">{profileData.overallRating.toFixed(1)}</div>
          <div className="text-[10px] text-warm-600">Rating</div>
        </Card>
      </motion.div>

      {/* Practice vs Tournament Stats Breakdown */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.12 }}
      >
        <h3 className="font-bold text-warm-800 mb-3 flex items-center gap-2">
          <Trophy className="w-4 h-4 text-brand-gold" />
          Score Breakdown
        </h3>
        <div className="grid grid-cols-2 gap-3">
          {/* Practice Stats */}
          <Card className="p-3 bg-brand-green/5 border-brand-green/15">
            <div className="flex items-center gap-1.5 mb-2">
              <span className="text-sm">🏋️</span>
              <span className="text-xs font-bold text-brand-green">Practice</span>
            </div>
            <div className="space-y-1.5">
              <div className="flex justify-between text-[11px]">
                <span className="text-warm-500">Matches</span>
                <span className="text-warm-800 font-semibold">{profileData.practiceMatches}</span>
              </div>
              <div className="flex justify-between text-[11px]">
                <span className="text-warm-500">Raid Pts</span>
                <span className="text-brand-red font-semibold">{profileData.practiceRaidPoints}</span>
              </div>
              <div className="flex justify-between text-[11px]">
                <span className="text-warm-500">Tackle Pts</span>
                <span className="text-brand-blue font-semibold">{profileData.practiceTacklePoints}</span>
              </div>
              <div className="flex justify-between text-[11px] border-t border-warm-200 pt-1">
                <span className="text-warm-500">Total Pts</span>
                <span className="text-warm-800 font-bold">{profileData.practiceTotalPoints}</span>
              </div>
            </div>
          </Card>
          {/* Tournament Stats */}
          <Card className="p-3 bg-brand-gold/5 border-brand-gold/15">
            <div className="flex items-center gap-1.5 mb-2">
              <span className="text-sm">🏆</span>
              <span className="text-xs font-bold text-brand-gold">Tournament</span>
            </div>
            <div className="space-y-1.5">
              <div className="flex justify-between text-[11px]">
                <span className="text-warm-500">Matches</span>
                <span className="text-warm-800 font-semibold">{profileData.tournamentMatches}</span>
              </div>
              <div className="flex justify-between text-[11px]">
                <span className="text-warm-500">Raid Pts</span>
                <span className="text-brand-red font-semibold">{profileData.tournamentRaidPoints}</span>
              </div>
              <div className="flex justify-between text-[11px]">
                <span className="text-warm-500">Tackle Pts</span>
                <span className="text-brand-blue font-semibold">{profileData.tournamentTacklePoints}</span>
              </div>
              <div className="flex justify-between text-[11px] border-t border-warm-200 pt-1">
                <span className="text-warm-500">Total Pts</span>
                <span className="text-warm-800 font-bold">{profileData.tournamentTotalPoints}</span>
              </div>
            </div>
          </Card>
        </div>
      </motion.div>

      {/* Badges - PREMIUM FEATURE */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.15 }}
      >
        <PremiumLock feature="Detailed Badges">
          <h3 className="font-bold text-warm-800 mb-3 flex items-center gap-2">
            <Award className="w-4 h-4 text-brand-gold" />
            Badges
          </h3>
          <div className="flex flex-wrap gap-2">
            {badges.map((badge) => (
              <Badge
                key={badge.label}
                variant="secondary"
                className={`py-1.5 px-3 text-xs ${
                  badge.condition
                    ? 'bg-brand-gold/10 text-brand-gold border border-brand-gold/30'
                    : 'bg-warm-200 text-warm-400'
                }`}
              >
                {badge.icon} {badge.label}
              </Badge>
            ))}
          </div>
        </PremiumLock>
      </motion.div>

      {/* Performance Chart - PREMIUM FEATURE */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
      >
        <PremiumLock feature="Performance Analytics">
          <h3 className="font-bold text-warm-800 mb-3">Performance</h3>
          <Card className="p-4">
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

      {/* Detailed Stats Breakdown - PREMIUM FEATURE */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.22 }}
      >
        <PremiumLock feature="Detailed Stats" compact>
          <h3 className="font-bold text-warm-800 mb-3 flex items-center gap-2">
            <Swords className="w-4 h-4 text-brand-red" />
            Detailed Breakdown
          </h3>
          <Card className="p-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="text-center p-2 rounded-lg bg-brand-red/5">
                <p className="text-xs text-warm-500">Raid Success</p>
                <p className="text-lg font-bold text-brand-red">
                  {profileData.totalRaids > 0
                    ? ((profileData.successfulRaids / profileData.totalRaids) * 100).toFixed(0)
                    : 0}%
                </p>
              </div>
              <div className="text-center p-2 rounded-lg bg-brand-blue/5">
                <p className="text-xs text-warm-500">Tackle Success</p>
                <p className="text-lg font-bold text-brand-blue">
                  {profileData.totalTackles > 0
                    ? ((profileData.successfulTackles / profileData.totalTackles) * 100).toFixed(0)
                    : 0}%
                </p>
              </div>
              <div className="text-center p-2 rounded-lg bg-brand-teal/5">
                <p className="text-xs text-warm-500">Bonus Points</p>
                <p className="text-lg font-bold text-brand-teal">{profileData.bonusPoints}</p>
              </div>
              <div className="text-center p-2 rounded-lg bg-purple-500/5">
                <p className="text-xs text-warm-500">Super Tackles</p>
                <p className="text-lg font-bold text-purple-500">{profileData.superTackles}</p>
              </div>
            </div>
          </Card>
        </PremiumLock>
      </motion.div>

      {/* Quick Actions */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.26 }}
        className="grid grid-cols-2 gap-3"
      >
        <Card
          className="p-3 cursor-pointer hover:border-brand-teal/30 transition-colors active:scale-[0.98]"
          onClick={() => setShowTeamManagement(true)}
        >
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-brand-teal/10 flex items-center justify-center">
              <Users className="w-4 h-4 text-brand-teal" />
            </div>
            <div>
              <p className="text-xs font-semibold text-warm-800">My Teams</p>
              <p className="text-[10px] text-warm-500">Manage teams</p>
            </div>
          </div>
        </Card>
        <Card
          className="p-3 cursor-pointer hover:border-brand-gold/30 transition-colors active:scale-[0.98]"
          onClick={() => {
            if (!isPremium) {
              setShowUpgrade(true);
              return;
            }
            setShowPlayerComparison(true);
          }}
        >
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-brand-gold/10 flex items-center justify-center">
              <BarChart3 className="w-4 h-4 text-brand-gold" />
            </div>
            <div>
              <p className="text-xs font-semibold text-warm-800">Compare</p>
              <p className="text-[10px] text-warm-500">{isPremium ? 'Player vs Player' : 'PRO only'}</p>
            </div>
          </div>
        </Card>
        <Card
          className="p-3 cursor-pointer hover:border-brand-red/30 transition-colors active:scale-[0.98]"
          onClick={() => setShowAdvancedStats(true)}
        >
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-brand-red/10 flex items-center justify-center">
              <Activity className="w-4 h-4 text-brand-red" />
            </div>
            <div>
              <p className="text-xs font-semibold text-warm-800">My Stats</p>
              <p className="text-[10px] text-warm-500">{isPremium ? 'Advanced analytics' : 'PRO only'}</p>
            </div>
          </div>
        </Card>
        <Card
          className="p-3 cursor-pointer hover:border-brand-navy/30 transition-colors active:scale-[0.98]"
          onClick={() => setShowFollow(true)}
        >
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-brand-navy/10 flex items-center justify-center">
              <Users className="w-4 h-4 text-brand-navy" />
            </div>
            <div>
              <p className="text-xs font-semibold text-warm-800">Follow</p>
              <p className="text-[10px] text-warm-500">Find & connect</p>
            </div>
          </div>
        </Card>
        {/* Phase 5 Quick Actions */}
        <Card
          className="p-3 cursor-pointer hover:border-brand-gold/30 transition-colors active:scale-[0.98]"
          onClick={() => setShowAchievements(true)}
        >
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-brand-gold/10 flex items-center justify-center">
              <Award className="w-4 h-4 text-brand-gold" />
            </div>
            <div>
              <p className="text-xs font-semibold text-warm-800">Achievements</p>
              <p className="text-[10px] text-warm-500">Unlock badges</p>
            </div>
          </div>
        </Card>
        <Card
          className="p-3 cursor-pointer hover:border-brand-red/30 transition-colors active:scale-[0.98]"
          onClick={() => setShowChallenges(true)}
        >
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-brand-red/10 flex items-center justify-center">
              <Swords className="w-4 h-4 text-brand-red" />
            </div>
            <div>
              <p className="text-xs font-semibold text-warm-800">Challenges</p>
              <p className="text-[10px] text-warm-500">Rival teams</p>
            </div>
          </div>
        </Card>
        <Card
          className="p-3 cursor-pointer hover:border-brand-teal/30 transition-colors active:scale-[0.98]"
          onClick={() => setShowGrounds(true)}
        >
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-brand-teal/10 flex items-center justify-center">
              <MapPin className="w-4 h-4 text-brand-teal" />
            </div>
            <div>
              <p className="text-xs font-semibold text-warm-800">Grounds</p>
              <p className="text-[10px] text-warm-500">Find venues</p>
            </div>
          </div>
        </Card>
        <Card
          className="p-3 cursor-pointer hover:border-brand-gold/30 transition-colors active:scale-[0.98]"
          onClick={() => setShowReferral(true)}
        >
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-brand-gold/10 flex items-center justify-center">
              <Gift className="w-4 h-4 text-brand-gold" />
            </div>
            <div>
              <p className="text-xs font-semibold text-warm-800">Refer & Earn</p>
              <p className="text-[10px] text-warm-500">Free Premium</p>
            </div>
          </div>
        </Card>
        {/* Advanced Phase 5 Quick Actions */}
        <Card
          className="p-3 cursor-pointer hover:border-purple-400/30 transition-colors active:scale-[0.98]"
          onClick={() => setShowAIInsights(true)}
        >
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-purple-500/10 flex items-center justify-center">
              <Brain className="w-4 h-4 text-purple-500" />
            </div>
            <div>
              <p className="text-xs font-semibold text-warm-800">AI Insights</p>
              <p className="text-[10px] text-warm-500">Smart analysis</p>
            </div>
          </div>
        </Card>
        <Card
          className="p-3 cursor-pointer hover:border-brand-teal/30 transition-colors active:scale-[0.98]"
          onClick={() => setShowSeason(true)}
        >
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-brand-teal/10 flex items-center justify-center">
              <Calendar className="w-4 h-4 text-brand-teal" />
            </div>
            <div>
              <p className="text-xs font-semibold text-warm-800">Seasons</p>
              <p className="text-[10px] text-warm-500">Track yearly</p>
            </div>
          </div>
        </Card>
        <Card
          className="p-3 cursor-pointer hover:border-brand-gold/30 transition-colors active:scale-[0.98]"
          onClick={() => setShowPolls(true)}
        >
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-brand-gold/10 flex items-center justify-center">
              <Vote className="w-4 h-4 text-brand-gold" />
            </div>
            <div>
              <p className="text-xs font-semibold text-warm-800">Predictions</p>
              <p className="text-[10px] text-warm-500">Vote & predict</p>
            </div>
          </div>
        </Card>
        <Card
          className="p-3 cursor-pointer hover:border-brand-navy/30 transition-colors active:scale-[0.98]"
          onClick={() => setShowDataExport(true)}
        >
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-brand-navy/10 flex items-center justify-center">
              <Download className="w-4 h-4 text-brand-navy" />
            </div>
            <div>
              <p className="text-xs font-semibold text-warm-800">Export Data</p>
              <p className="text-[10px] text-warm-500">CSV download</p>
            </div>
          </div>
        </Card>
        <Card
          className="p-3 cursor-pointer hover:border-emerald-400/30 transition-colors active:scale-[0.98]"
          onClick={() => setShowSponsors(true)}
        >
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center">
              <Briefcase className="w-4 h-4 text-emerald-500" />
            </div>
            <div>
              <p className="text-xs font-semibold text-warm-800">Sponsors</p>
              <p className="text-[10px] text-warm-500">Manage ads</p>
            </div>
          </div>
        </Card>
      </motion.div>
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.25 }}
      >
        <Card className="p-4 space-y-3">
          <div className="flex justify-between text-sm items-center">
            <span className="text-warm-500">Phone</span>
            <div className="flex items-center gap-1.5">
              <span className="text-warm-800 font-medium font-mono">
                {showPhone ? (currentUser?.phone || '—') : (currentUser?.phone ? `****${currentUser.phone.slice(-2)}` : '—')}
              </span>
              <button
                onClick={() => setShowPhone(!showPhone)}
                className="w-5 h-5 rounded-full bg-warm-100 flex items-center justify-center text-warm-400 hover:text-warm-600 transition-colors"
              >
                {showPhone ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
              </button>
            </div>
          </div>
          {currentUser?.weight && (
            <div className="flex justify-between text-sm">
              <span className="text-warm-500">Weight</span>
              <span className="text-warm-800 font-medium">{currentUser.weight}</span>
            </div>
          )}
          {currentUser?.practiceGround && (
            <div className="flex justify-between text-sm">
              <span className="text-warm-500">Practice Ground</span>
              <span className="text-warm-800 font-medium">{currentUser.practiceGround}</span>
            </div>
          )}
          {profileData.position && (
            <div className="flex justify-between text-sm">
              <span className="text-warm-500">Position</span>
              <span className="text-warm-800 font-medium">{getPositionIcon(profileData.position)} {getPositionLabel(profileData.position)}</span>
            </div>
          )}
          {profileData.jerseyNumber && (
            <div className="flex justify-between text-sm">
              <span className="text-warm-500">Jersey</span>
              <span className="text-warm-800 font-medium">#{profileData.jerseyNumber}</span>
            </div>
          )}
          <div className="flex justify-between text-sm">
            <span className="text-warm-500">Plan</span>
            <span className={`font-medium ${isPremium ? 'text-brand-gold' : 'text-warm-600'}`}>
              {isPremium ? '⭐ Premium' : 'Free'}
            </span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-warm-500">Language</span>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setLanguage('en')}
                className={`px-2 py-0.5 rounded text-xs font-medium transition-colors ${
                  language === 'en' ? 'bg-brand-teal text-white' : 'text-warm-600 hover:bg-warm-100'
                }`}
              >
                English
              </button>
              <button
                onClick={() => setLanguage('hi')}
                className={`px-2 py-0.5 rounded text-xs font-medium transition-colors ${
                  language === 'hi' ? 'bg-brand-teal text-white' : 'text-warm-600 hover:bg-warm-100'
                }`}
              >
                हिंदी
              </button>
            </div>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-warm-500">Theme</span>
            <button
              onClick={toggleDarkMode}
              className="flex items-center gap-1.5 text-warm-800 font-medium hover:text-brand-teal transition-colors"
            >
              {darkMode ? (
                <>
                  <Moon className="w-3.5 h-3.5" />
                  <span className="text-xs">Dark</span>
                </>
              ) : (
                <>
                  <Sun className="w-3.5 h-3.5" />
                  <span className="text-xs">Light</span>
                </>
              )}
            </button>
          </div>
        </Card>
      </motion.div>

      {/* Earnings Dashboard - Admin Only */}
      {currentUser?.isAdmin && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.28 }}
        >
          <h3 className="font-bold text-warm-800 mb-3 flex items-center gap-2">
            <IndianRupee className="w-4 h-4 text-emerald-500" />
            Earnings Dashboard
          </h3>
          <Card className="p-4 bg-gradient-to-br from-emerald-50 to-teal-50 border-emerald-200">
            <div className="grid grid-cols-2 gap-3 mb-3">
              <div className="p-3 rounded-xl bg-white/80 border border-emerald-100">
                <div className="flex items-center gap-1.5 mb-1">
                  <IndianRupee className="w-3.5 h-3.5 text-emerald-600" />
                  <span className="text-[10px] text-warm-500 uppercase tracking-wide">Total Revenue</span>
                </div>
                <p className="text-xl font-black text-emerald-700">
                  ₹{earnings?.totalRevenueINR?.toLocaleString() || '0'}
                </p>
              </div>
              <div className="p-3 rounded-xl bg-white/80 border border-emerald-100">
                <div className="flex items-center gap-1.5 mb-1">
                  <TrendingUp className="w-3.5 h-3.5 text-teal-600" />
                  <span className="text-[10px] text-warm-500 uppercase tracking-wide">Last 30 Days</span>
                </div>
                <p className="text-xl font-black text-teal-700">
                  ₹{earnings?.recentRevenueINR?.toLocaleString() || '0'}
                </p>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <div className="text-center p-2 rounded-lg bg-white/60 border border-emerald-100">
                <p className="text-xs text-warm-500">Monthly</p>
                <p className="text-base font-bold text-warm-800">{earnings?.monthlyCount || 0}</p>
              </div>
              <div className="text-center p-2 rounded-lg bg-white/60 border border-emerald-100">
                <p className="text-xs text-warm-500">Yearly</p>
                <p className="text-base font-bold text-warm-800">{earnings?.yearlyCount || 0}</p>
              </div>
              <div className="text-center p-2 rounded-lg bg-white/60 border border-emerald-100">
                <p className="text-xs text-warm-500">Lifetime</p>
                <p className="text-base font-bold text-warm-800">{earnings?.lifetimeCount || 0}</p>
              </div>
            </div>
            <div className="mt-3 flex items-center justify-between text-xs text-warm-500">
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

      {/* Logout Button */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
      >
        <Button
          variant="outline"
          onClick={() => {
            logout();
            toast({ title: 'Logged out successfully' });
          }}
          className="w-full rounded-xl border-warm-300 text-brand-red hover:bg-brand-red/5 hover:text-brand-red h-10"
        >
          <LogOut className="w-4 h-4 mr-2" />
          Logout
        </Button>
      </motion.div>
    </div>
  );
}
