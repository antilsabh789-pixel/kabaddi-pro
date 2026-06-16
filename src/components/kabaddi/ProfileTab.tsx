'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Camera, Edit3, Zap, Shield, Swords, Award, Loader2, Crown, Lock, Settings, LogOut, IndianRupee, TrendingUp, Users, CreditCard, Moon, Sun, BarChart3, Activity, MapPin, Gift, Swords as ChallengeIcon, Brain, Download, Vote, Briefcase, Calendar, Hash, Eye, EyeOff, Trophy, Copy, Check, ChevronRight, AlertTriangle, Share2, X, TrendingDown, Star, Clock, Target, Flame, Heart, Gauge, Sparkles, Flag, MessageCircle, Crosshair, Megaphone, Phone, Pencil, Trash2 } from 'lucide-react';
import { useKabaddiStore, type Language } from '@/lib/store';
import Portal from '@/components/portal';
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
  DialogDescription,
} from '@/components/ui/dialog';
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip';
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Cell, PieChart, Pie, RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis, LineChart, Line } from 'recharts';
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
import DataExportScreen from './DataExportScreen';
import SeasonScreen from './SeasonScreen';
import PollsScreen from './PollsScreen';
import SponsorScreen from './SponsorScreen';
import PlayerStatsScreen from './PlayerStatsScreen';
import PlayerProfileCard from './PlayerProfileCard';
import TeamChatScreen from './TeamChatScreen';
import DailyChallengeScreen from './DailyChallengeScreen';
import MatchHistoryTimeline from './MatchHistoryTimeline';
import CoachDashboard from './CoachDashboard';
import ImageCropDialog from './ImageCropDialog';
import { t } from '@/lib/i18n';

const POSITIONS = [
  { id: 'left-raider', labelKey: 'positions.leftRaider', icon: '⬅️', meaning: 'Attacks from left side' },
  { id: 'right-raider', labelKey: 'positions.rightRaider', icon: '➡️', meaning: 'Attacks from right side' },
  { id: 'both-raider', labelKey: 'positions.bothRaider', icon: '↔️', meaning: 'Raids from both sides' },
  { id: 'left-corner', labelKey: 'positions.leftCorner', icon: '🛡️', meaning: 'Defends left corner' },
  { id: 'right-corner', labelKey: 'positions.rightCorner', icon: '🛡️', meaning: 'Defends right corner' },
  { id: 'left-cover', labelKey: 'positions.leftCover', icon: '🧱', meaning: 'Cover defender left side' },
  { id: 'right-cover', labelKey: 'positions.rightCover', icon: '🧱', meaning: 'Cover defender right side' },
  { id: 'all-rounder', labelKey: 'positions.allRounder', icon: '⭐', meaning: 'Excels in both raid & defense' },
];

const WEIGHT_CATEGORIES = [
  { label: 'Open', value: 'open' },
];

const PRACTICE_GROUNDS = [
  'Shivaji Stadium', 'Talkatora Indoor Stadium', 'Thyagaraj Sports Complex',
  'Indira Gandhi Indoor Stadium', 'Siri Fort Sports Complex', 'Chhatrasal Stadium',
  'Jawaharlal Nehru Stadium', 'Dr. Karni Singh Shooting Range', 'Other'
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
  completedAt?: string;
}

// ─── Animated Value (count-up on first view) ────────────────────

function AnimatedValue({ value, decimals = 0 }: { value: number; decimals?: number }) {
  const [display, setDisplay] = useState(0);
  const [hasAnimated, setHasAnimated] = useState(false);
  const ref = useRef<HTMLSpanElement>(null);
  const valueRef = useRef(value);

  useEffect(() => {
    valueRef.current = value;
  }, [value]);

  useEffect(() => {
    if (hasAnimated) return;
    if (value === 0) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !hasAnimated) {
          setHasAnimated(true);
          const targetVal = valueRef.current;
          const duration = 1200;
          const startTime = performance.now();

          function step(currentTime: number) {
            const elapsed = currentTime - startTime;
            const progress = Math.min(elapsed / duration, 1);
            const eased = 1 - Math.pow(1 - progress, 3);
            const current = eased * targetVal;
            setDisplay(decimals > 0 ? parseFloat(current.toFixed(decimals)) : Math.round(current));
            if (progress < 1) {
              requestAnimationFrame(step);
            }
          }

          requestAnimationFrame(step);
        }
      },
      { threshold: 0.1 }
    );

    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, [value, decimals, hasAnimated]);

  return <span ref={ref}>{hasAnimated ? (decimals > 0 ? display.toFixed(decimals) : display) : value}</span>;
}

// ─── Sparkline Mini Chart ────────────────────

function MiniSparkline({ data, color }: { data: number[]; color: string }) {
  const chartData = data.map((v, i) => ({ x: i, y: v }));
  return (
    <div className="w-16 h-6">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={chartData}>
          <Line type="monotone" dataKey="y" stroke={color} strokeWidth={1.5} dot={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

// ─── Time Ago helper ────────────────────

function timeAgo(dateStr: string): string {
  if (!dateStr || dateStr === '—') return '';
  try {
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return dateStr;
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 60) return mins <= 1 ? 'just now' : `${mins}m ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    if (days < 7) return `${days}d ago`;
    const weeks = Math.floor(days / 7);
    if (weeks < 4) return `${weeks}w ago`;
    return dateStr;
  } catch {
    return dateStr;
  }
}

// ─── Level/Rank helper ────────────────────

function getPlayerLevel(totalMatches: number, totalPoints: number): { label: string; color: string; icon: string; progress: number } {
  const score = totalMatches * 2 + totalPoints;
  if (score >= 500) return { label: 'Legend', color: 'from-amber-400 to-yellow-600', icon: '👑', progress: 100 };
  if (score >= 200) return { label: 'Pro', color: 'from-red-500 to-orange-500', icon: '🔥', progress: Math.min(((score - 200) / 300) * 100, 100) };
  if (score >= 50) return { label: 'Intermediate', color: 'from-teal-500 to-emerald-500', icon: '⚡', progress: Math.min(((score - 50) / 150) * 100, 100) };
  return { label: 'Beginner', color: 'from-slate-400 to-slate-500', icon: '🌱', progress: Math.min((score / 50) * 100, 100) };
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
  const [showCoachDashboard, setShowCoachDashboard] = useState(false);
  const [showSponsors, setShowSponsors] = useState(false);
  const [showStats, setShowStats] = useState(false);
  const [showProfileCard, setShowProfileCard] = useState(false);
  const [showTeamChat, setShowTeamChat] = useState(false);
  const [showDailyChallenge, setShowDailyChallenge] = useState(false);
  const { theme, setTheme } = useTheme();
  const darkMode = theme === 'dark';
  const [editForm, setEditForm] = useState({
    gender: currentUser?.gender || '',
    weight: currentUser?.weight || '',
    practiceGround: currentUser?.practiceGround || '',
    position: '',
    jerseyNumber: '',
  });
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [cropImageSrc, setCropImageSrc] = useState<string | null>(null);
  const [groundSearch, setGroundSearch] = useState('');
  const [showGroundSuggestions, setShowGroundSuggestions] = useState(false);
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
    tournamentMatches: 0,
    tournamentRaidPoints: 0,
    tournamentTacklePoints: 0,
    tournamentTotalPoints: 0,
    practiceMatches: 0,
    practiceRaidPoints: 0,
    practiceTacklePoints: 0,
    practiceTotalPoints: 0,
    // User fields from API for syncing
    userWeight: null as string | null,
    userGender: null as string | null,
    userPracticeGround: null as string | null,
  });
  const [profileNotFound, setProfileNotFound] = useState(false); // kept for data loading logic but UI card removed
  const [showPhone, setShowPhone] = useState(false);
  const [showPhoneEdit, setShowPhoneEdit] = useState(false);
  const [newPhone, setNewPhone] = useState('');
  const [phoneEditLoading, setPhoneEditLoading] = useState(false);
  const [phoneEditError, setPhoneEditError] = useState('');
  const [codeCopied, setCodeCopied] = useState(false);
  const [recentMatches, setRecentMatches] = useState<RecentMatch[]>([]);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [showDeleteAccount, setShowDeleteAccount] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [deleteAccountLoading, setDeleteAccountLoading] = useState(false);
  const [deleteAccountError, setDeleteAccountError] = useState('');

  // Member since date - use createdAt timestamp, fallback to 30 days ago
  const memberSince = currentUser?.createdAt ? new Date(currentUser.createdAt) : new Date(Date.now() - 30 * 86400000);

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
      if (res.status === 404) {
        // Player record doesn't exist yet — return 'not-found' sentinel
        return 'not-found' as const;
      }
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
            // User fields from API for syncing to store
            userWeight: data.player?.weight || null,
            userGender: data.player?.gender || null,
            userPracticeGround: data.player?.practiceGround || null,
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
            // User fields from API for syncing to store
            userWeight: data.player?.weight || null,
            userGender: data.player?.gender || null,
            userPracticeGround: data.player?.practiceGround || null,
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
              completedAt: m.completedAt as string | undefined,
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
      if (cancelled) return;
      if (data === 'not-found') {
        // Player record doesn't exist in DB yet — still allow profile editing
        setProfileNotFound(true);
      } else if (data) {
        setProfileNotFound(false);
        setProfileData(data);
        setEditForm(prev => ({
          ...prev,
          position: data.position || '',
          jerseyNumber: data.jerseyNumber?.toString() || '',
        }));
        // Sync all profile fields to Zustand store for consistent display
        const storeUpdate: Record<string, unknown> = {
          position: data.position || undefined,
          jerseyNumber: data.jerseyNumber || undefined,
        };
        if (data.userWeight) storeUpdate.weight = data.userWeight;
        if (data.userGender) storeUpdate.gender = data.userGender;
        if (data.userPracticeGround) storeUpdate.practiceGround = data.userPracticeGround;
        if (data.playerCode && !currentUser?.playerCode) {
          storeUpdate.playerCode = data.playerCode;
        }
        updateUser(storeUpdate);
      } else {
        // Network error or other failure — don't block the UI
        setProfileNotFound(false);
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

  const toggleDarkMode = () => {
    setTheme(darkMode ? 'light' : 'dark');
  };

  useEffect(() => {
    setEditForm({
      gender: currentUser?.gender || '',
      weight: currentUser?.weight || '',
      practiceGround: currentUser?.practiceGround || '',
      position: currentUser?.position || profileData.position || '',
      jerseyNumber: (currentUser?.jerseyNumber || profileData.jerseyNumber)?.toString() || '',
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

    // Read the file and open crop dialog instead of uploading directly
    const reader = new FileReader();
    reader.onload = () => {
      setCropImageSrc(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleCropComplete = async (croppedDataUrl: string) => {
    if (!currentUser?.id) return;
    setCropImageSrc(null);
    setAvatarPreview(croppedDataUrl);
    setUploading(true);

    try {
      const res = await fetch('/api/upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fileData: croppedDataUrl,
          fileName: 'avatar.jpg',
          fileType: 'image/jpeg',
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
      setAvatarPreview(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleCropCancel = () => {
    setCropImageSrc(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // ─── Save Profile ───
  const handleSaveProfile = async () => {
    // Optimistically update local state immediately for responsive UI
    const updatedPosition = editForm.position || undefined;
    const updatedJerseyNumber = editForm.jerseyNumber ? parseInt(editForm.jerseyNumber) : undefined;
    const updatedWeight = editForm.weight ? (editForm.weight === 'open' ? 'open' : editForm.weight) : undefined;
    const updatedGender = editForm.gender || undefined;
    const updatedPracticeGround = editForm.practiceGround || undefined;

    // Update Zustand store with all fields (including position & jerseyNumber)
    updateUser({
      gender: updatedGender,
      weight: updatedWeight,
      practiceGround: updatedPracticeGround,
      position: updatedPosition,
      jerseyNumber: updatedJerseyNumber,
    });

    // Update local profileData immediately for instant display
    setProfileData(prev => ({
      ...prev,
      position: updatedPosition || prev.position,
      jerseyNumber: updatedJerseyNumber ?? prev.jerseyNumber,
    }));
    setProfileNotFound(false);

    try {
      const updateBody: Record<string, unknown> = {
        gender: editForm.gender,
        weight: editForm.weight ? (editForm.weight === 'open' ? 'open' : editForm.weight) : undefined,
        practiceGround: editForm.practiceGround || undefined,
        position: editForm.position || undefined,
        jerseyNumber: editForm.jerseyNumber ? parseInt(editForm.jerseyNumber) : undefined,
      };

      const res = await fetch(`/api/players/${currentUser?.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updateBody),
      });

      // If save was successful, reload profile to get server-confirmed data
      if (res.ok && currentUser?.id) {
        const data = await loadProfile(currentUser.id);
        if (data && data !== 'not-found') {
          setProfileData(data);
          setEditForm(prev => ({
            ...prev,
            position: data.position || '',
            jerseyNumber: data.jerseyNumber?.toString() || '',
          }));
          // Sync all returned fields to store
          const reloadedUpdate: Record<string, unknown> = {
            position: data.position || undefined,
            jerseyNumber: data.jerseyNumber || undefined,
          };
          if (data.userWeight) reloadedUpdate.weight = data.userWeight;
          if (data.userGender) reloadedUpdate.gender = data.userGender;
          if (data.userPracticeGround) reloadedUpdate.practiceGround = data.userPracticeGround;
          if (data.playerCode && !currentUser?.playerCode) {
            reloadedUpdate.playerCode = data.playerCode;
          }
          updateUser(reloadedUpdate);
        }
      } else {
        // API failed but local state is already updated optimistically
        console.warn('Profile API save failed, local state updated');
      }
    } catch {
      // API failed but local state is already updated optimistically
      console.warn('Profile API save failed, local state updated');
    }
    setEditOpen(false);
    toast({ title: 'Profile updated!' });
  };

  // ─── Change Phone Number ───
  const handleChangePhone = async () => {
    setPhoneEditError('');

    // Validate phone (10 digits)
    const phoneRegex = /^\d{10}$/;
    if (!phoneRegex.test(newPhone)) {
      setPhoneEditError(t('profile.phoneInvalid', language));
      return;
    }

    const fullPhone = `+91${newPhone}`;

    // Check if same as current
    if (fullPhone === currentUser?.phone) {
      setPhoneEditError('New phone number is same as current');
      return;
    }

    setPhoneEditLoading(true);
    try {
      const res = await fetch('/api/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'update-details',
          userId: currentUser?.id,
          phone: fullPhone,
        }),
      });

      const data = await res.json();

      if (res.ok) {
        // Update local state
        updateUser({ phone: fullPhone });
        setShowPhoneEdit(false);
        setNewPhone('');
        toast({ title: t('profile.phoneUpdated', language) });
      } else {
        if (res.status === 409) {
          setPhoneEditError(t('profile.phoneAlreadyRegistered', language));
        } else {
          setPhoneEditError(data.error || 'Failed to update phone number');
        }
      }
    } catch {
      setPhoneEditError('Failed to update phone number. Please try again.');
    } finally {
      setPhoneEditLoading(false);
    }
  };

  // ─── Delete Account ───
  const handleDeleteAccount = async () => {
    if (deleteConfirmText !== 'DELETE') return;

    setDeleteAccountLoading(true);
    setDeleteAccountError('');

    try {
      const res = await fetch('/api/auth/delete-account', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: currentUser?.id,
          confirmation: 'DELETE',
        }),
      });

      const data = await res.json();

      if (res.ok && data.success) {
        // Clear all local state and logout
        logout();
        toast({ title: t('profile.deleteAccountSuccess', language) });
      } else {
        setDeleteAccountError(data.error || t('profile.deleteAccountFailed', language));
      }
    } catch {
      setDeleteAccountError(t('profile.deleteAccountFailed', language));
    } finally {
      setDeleteAccountLoading(false);
    }
  };

  // ─── Tournament Stats (used for main profile, leaderboard, awards) ───
  const tournamentRaidPoints = profileData.tournamentRaidPoints;
  const tournamentTacklePoints = profileData.tournamentTacklePoints;
  const tournamentTotalPoints = profileData.tournamentTotalPoints;
  const tournamentMatches = profileData.tournamentMatches;

  // ─── Practice Stats (separate tab) ───
  const practiceRaidPoints = profileData.practiceRaidPoints;
  const practiceTacklePoints = profileData.practiceTacklePoints;
  const practiceTotalPoints = profileData.practiceTotalPoints;
  const practiceMatches = profileData.practiceMatches;

  // Main profile uses tournament-only stats
  const raidPoints = tournamentRaidPoints;
  const tacklePoints = tournamentTacklePoints;
  const totalPoints = tournamentTotalPoints;
  const totalMatches = tournamentMatches;

  // Success rates still use combined data for accuracy (more data = better rate)
  const raidSuccessRate = profileData.totalRaids > 0 ? (profileData.successfulRaids / profileData.totalRaids) * 100 : 0;
  const tackleSuccessRate = profileData.totalTackles > 0 ? (profileData.successfulTackles / profileData.totalTackles) * 100 : 0;

  // Use calculated level if player has match history, otherwise use self-reported experience
  const calculatedLevel = getPlayerLevel(totalMatches, totalPoints);
  const experienceMap: Record<string, { label: string; color: string; icon: string; progress: number }> = {
    beginner: { label: 'Beginner', color: 'from-slate-400 to-slate-500', icon: '🌱', progress: 10 },
    intermediate: { label: 'Intermediate', color: 'from-teal-500 to-emerald-500', icon: '⚡', progress: 40 },
    advanced: { label: 'Advanced', color: 'from-red-500 to-orange-500', icon: '🔥', progress: 70 },
  };
  const selfReportedLevel = currentUser?.experienceLevel ? experienceMap[currentUser.experienceLevel] : null;
  const playerLevel = totalMatches > 0 ? calculatedLevel : (selfReportedLevel || calculatedLevel);

  const performanceData = [
    { name: 'Raids', value: profileData.successfulRaids },
    { name: 'Tackles', value: profileData.successfulTackles },
    { name: 'Bonus', value: profileData.bonusPoints * 10 },
    { name: 'S.Tkl', value: profileData.superTackles * 10 },
  ];

  const barColors = ['#DC2626', '#1E293B', '#14B8A6', '#475569'];

  // Donut chart data for score breakdown
  const donutData = [
    { name: 'Raid', value: raidPoints, fill: '#EA580C' },
    { name: 'Tackle', value: tacklePoints, fill: '#059669' },
    { name: 'Bonus', value: profileData.bonusPoints, fill: '#D97706' },
  ].filter(d => d.value > 0);

  // Radar chart data for player skills
  const radarData = [
    { subject: 'Raid', player: Math.min(raidSuccessRate, 100), avg: 50 },
    { subject: 'Tackle', player: Math.min(tackleSuccessRate, 100), avg: 45 },
    { subject: 'Bonus', player: Math.min(profileData.bonusPoints * 5, 100), avg: 30 },
    { subject: 'Speed', player: Math.min((totalMatches * 3 + raidPoints) * 0.5, 100), avg: 40 },
    { subject: 'Stamina', player: Math.min(totalMatches * 5, 100), avg: 35 },
    { subject: 'Strategy', player: Math.min(profileData.superTackles * 10 + profileData.overallRating * 10, 100), avg: 38 },
  ];

  // Sparkline data (simulated from recent performance)
  const raidSparkline = [3, 5, 2, 7, 4, 6, raidPoints % 10 + 2];
  const tackleSparkline = [1, 3, 2, 4, 2, 3, tacklePoints % 8 + 1];
  const ratingSparkline = [4, 5, 3, 6, 5, 7, Math.round(profileData.overallRating)];

  // Enhanced badges with categories, locked states, and progress
  // All badges are based on TOURNAMENT stats only (not practice)
  const badgeCategories = [
    {
      title: 'Performance',
      badges: [
        { icon: '⚡', label: 'Super Raider', condition: tournamentRaidPoints >= 20, premium: false, progress: Math.min((tournamentRaidPoints / 20) * 100, 100), threshold: '20 tourney raid pts' },
        { icon: '🔥', label: 'On Fire', condition: raidPoints >= 30, premium: true, progress: Math.min((raidPoints / 30) * 100, 100), threshold: '30 tourney raid pts' },
        { icon: '🎯', label: 'Precision', condition: raidSuccessRate >= 70, premium: true, progress: Math.min((raidSuccessRate / 70) * 100, 100), threshold: '70% raid rate' },
      ],
    },
    {
      title: 'Consistency',
      badges: [
        { icon: '🛡️', label: 'Iron Wall', condition: tournamentTacklePoints >= 10, premium: false, progress: Math.min((tournamentTacklePoints / 10) * 100, 100), threshold: '10 tourney tackle pts' },
        { icon: '🧱', label: 'Fortress', condition: tackleSuccessRate >= 70, premium: true, progress: Math.min((tackleSuccessRate / 70) * 100, 100), threshold: '70% tackle rate' },
        { icon: '🏆', label: 'Veteran', condition: tournamentMatches >= 15, premium: true, progress: Math.min((tournamentMatches / 15) * 100, 100), threshold: '15 tourney matches' },
      ],
    },
    {
      title: 'Social',
      badges: [
        { icon: '💪', label: 'All-Rounder', condition: raidPoints >= 20 && tacklePoints >= 20, premium: false, progress: Math.min(((raidPoints >= 20 ? 1 : raidPoints / 20) + (tacklePoints >= 20 ? 1 : tacklePoints / 20)) * 50, 100), threshold: '20+ in both (tourney)' },
        { icon: '🌟', label: 'Team Player', condition: totalMatches >= 10, premium: false, progress: Math.min((totalMatches / 10) * 100, 100), threshold: '10 tourney matches' },
      ],
    },
    {
      title: 'Special',
      badges: [
        { icon: '👑', label: 'Legend', condition: totalPoints >= 100, premium: true, progress: Math.min((totalPoints / 100) * 100, 100), threshold: '100 tourney pts' },
        { icon: '💎', label: 'Diamond', condition: isPremium && totalPoints >= 50, premium: true, progress: isPremium ? Math.min((totalPoints / 50) * 100, 100) : 0, threshold: 'PRO + 50 tourney pts' },
      ],
    },
  ];

  // Feature categories
  const featureCategories = [
    {
      title: 'Team & Stats',
      items: [
        ...(currentUser?.role === 'coach' ? [{ icon: Megaphone, label: 'Coach Dashboard', desc: 'Academy, attendance & fees', color: 'brand-green', premium: false, onClick: () => setShowCoachDashboard(true) }] : []),
        { icon: Users, label: 'My Teams', desc: 'Manage your teams', color: 'brand-teal', premium: false, onClick: () => setShowTeamManagement(true) },
        { icon: BarChart3, label: 'Compare', desc: isPremium ? 'Player vs Player' : 'PRO only', color: 'brand-gold', premium: true, onClick: () => { if (!isPremium) { setShowUpgrade(true); return; } setShowPlayerComparison(true); } },
        { icon: Activity, label: 'My Stats', desc: 'View your stats', color: 'brand-red', premium: false, onClick: () => setShowStats(true) },
        { icon: Users, label: 'Follow', desc: 'Find & connect', color: 'brand-navy', premium: false, onClick: () => setShowFollow(true) },
        { icon: MessageCircle, label: 'Team Chat', desc: 'Message teammates', color: 'brand-navy', premium: false, onClick: () => setShowTeamChat(true) },
      ],
    },
    {
      title: 'Achievements',
      items: [
        { icon: Award, label: 'Achievements', desc: 'Unlock badges', color: 'brand-gold', premium: false, onClick: () => setShowAchievements(true) },
        { icon: Crosshair, label: 'Daily Quests', desc: 'Earn XP & streaks', color: 'orange-500', premium: false, onClick: () => setShowDailyChallenge(true) },
        { icon: Swords, label: 'Challenges', desc: 'Rival teams', color: 'brand-red', premium: false, onClick: () => setShowChallenges(true) },
        { icon: MapPin, label: 'Grounds', desc: 'Find venues', color: 'brand-teal', premium: false, onClick: () => setShowGrounds(true) },
        { icon: Gift, label: 'Refer & Earn', desc: 'Free Premium', color: 'brand-gold', premium: false, onClick: () => setShowReferral(true) },
      ],
    },
    {
      title: 'Advanced',
      items: [
        { icon: Brain, label: 'AI Insights', desc: 'Smart analysis', color: 'purple-500', premium: false, onClick: () => setShowAIInsights(true) },
        { icon: Calendar, label: 'Seasons', desc: 'Track yearly', color: 'brand-teal', premium: false, onClick: () => setShowSeason(true) },
        { icon: Vote, label: 'Predictions', desc: 'Vote & predict', color: 'brand-gold', premium: false, onClick: () => setShowPolls(true) },
        { icon: Download, label: 'Export Data', desc: 'CSV download', color: 'brand-navy', premium: false, onClick: () => setShowDataExport(true) },
        { icon: Briefcase, label: 'Sponsors', desc: 'Manage ads', color: 'emerald-500', premium: false, onClick: () => setShowSponsors(true) },
      ],
    },
  ];

  const getPositionLabel = (pos: string | null) => {
    if (!pos) return null;
    const found = POSITIONS.find(p => p.id === pos);
    return found ? t(found.labelKey, language) : pos;
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

  const getResultBg = (result: 'W' | 'L' | 'D') => {
    switch (result) {
      case 'W': return 'border-l-emerald-500';
      case 'L': return 'border-l-red-500';
      case 'D': return 'border-l-amber-500';
    }
  };

  // Detailed breakdown stat items with progress
  const detailedStats = [
    { label: 'Raid Success', value: raidSuccessRate, max: 100, color: 'from-orange-400 via-red-500 to-amber-500', icon: Zap, iconColor: 'text-orange-500', prev: raidSuccessRate - 5 },
    { label: 'Tackle Success', value: tackleSuccessRate, max: 100, color: 'from-emerald-400 via-teal-500 to-green-500', icon: Shield, iconColor: 'text-emerald-500', prev: tackleSuccessRate - 3 },
    { label: 'Super Tackles', value: Math.min(profileData.superTackles * 10, 100), max: 100, color: 'from-purple-400 via-purple-500 to-pink-500', icon: Target, iconColor: 'text-purple-500', prev: Math.min((profileData.superTackles - 1) * 10, 100) },
    { label: 'Bonus Points', value: Math.min(profileData.bonusPoints * 5, 100), max: 100, color: 'from-amber-400 via-yellow-500 to-orange-500', icon: Star, iconColor: 'text-amber-500', prev: Math.min((profileData.bonusPoints - 1) * 5, 100) },
    { label: 'Match Impact', value: Math.min(profileData.overallRating * 10, 100), max: 100, color: 'from-rose-400 via-red-500 to-brand-red', icon: Flame, iconColor: 'text-rose-500', prev: Math.min((profileData.overallRating - 0.5) * 10, 100) },
  ];

  return (
    <div className="px-3 py-4 space-y-4">
      {/* Overlays - rendered through Portal to escape scroll container */}
      <Portal>
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
      {showCoachDashboard && (
        <CoachDashboard onClose={() => setShowCoachDashboard(false)} />
      )}
      {showAIInsights && (
        <AIInsightsScreen onClose={() => setShowAIInsights(false)} />
      )}
      {showStats && currentUser?.id && (
        <PlayerStatsScreen userId={currentUser.id} onClose={() => setShowStats(false)} />
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
      {showTeamChat && (
        <TeamChatScreen onClose={() => setShowTeamChat(false)} />
      )}
      {showDailyChallenge && (
        <DailyChallengeScreen onClose={() => setShowDailyChallenge(false)} />
      )}
      </Portal>

      {/* Player Profile Card Overlay - also needs Portal */}
      <Portal>
      <AnimatePresence>
        {showProfileCard && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-start justify-center overflow-y-auto p-4"
            onClick={(e) => { if (e.target === e.currentTarget) setShowProfileCard(false); }}
          >
            <motion.div
              initial={{ scale: 0.9, y: 30 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 30 }}
              transition={{ type: 'spring', stiffness: 300, damping: 25 }}
              className="w-full max-w-sm my-8"
            >
              <div className="flex justify-end mb-2">
                <button
                  onClick={() => setShowProfileCard(false)}
                  className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center text-white hover:bg-white/20 transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <PlayerProfileCard />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
      </Portal>

      {/* Hidden file input for avatar upload - uses opacity+absolute instead of display:none for better cross-browser support */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif"
        className="absolute opacity-0 w-0 h-0 overflow-hidden pointer-events-none"
        style={{ position: 'absolute' }}
        onChange={handleFileChange}
        aria-hidden="true"
        tabIndex={-1}
      />

      {/* Image Crop Dialog */}
      {cropImageSrc && (
        <ImageCropDialog
          imageSrc={cropImageSrc}
          onCropComplete={handleCropComplete}
          onCancel={handleCropCancel}
          circularCrop={true}
          aspectRatio={1}
          title={t('profile.cropPhoto', language)}
        />
      )}

      {/* ═══════════════════════════════════════════ */}
      {/* 1. PROFILE HEADER with Dynamic Gradient Banner */}
      {/* ═══════════════════════════════════════════ */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative rounded-2xl shadow-lg overflow-visible"
      >
        {/* Dynamic Gradient Banner Background */}
        <div className="relative bg-gradient-to-br from-brand-red via-red-700 to-brand-gold-dark dark:from-brand-red-dark dark:via-red-900 dark:to-amber-900 pt-5 pb-14 px-5 profile-banner-gradient overflow-hidden rounded-2xl">
          {/* Animated Mesh Pattern */}
          <div className="absolute inset-0 opacity-10">
            <motion.div
              className="absolute inset-0"
              style={{
                backgroundImage: `repeating-linear-gradient(45deg, transparent, transparent 10px, rgba(255,255,255,0.1) 10px, rgba(255,255,255,0.1) 11px),
                  repeating-linear-gradient(-45deg, transparent, transparent 10px, rgba(255,255,255,0.1) 10px, rgba(255,255,255,0.1) 11px)`,
              }}
              animate={{ backgroundPositionX: [0, 20, 0] }}
              transition={{ duration: 20, repeat: Infinity, ease: 'linear' }}
            />
            {/* Animated floating circles */}
            <motion.div
              className="absolute -top-8 -right-8 w-32 h-32 rounded-full border-4 border-white/20"
              animate={{ rotate: 360 }}
              transition={{ duration: 40, repeat: Infinity, ease: 'linear' }}
            />
            <motion.div
              className="absolute -bottom-4 -left-4 w-24 h-24 rounded-full border-4 border-white/15"
              animate={{ rotate: -360 }}
              transition={{ duration: 30, repeat: Infinity, ease: 'linear' }}
            />
            <motion.div
              className="absolute top-4 right-20 w-12 h-12 rounded-full border-2 border-white/10"
              animate={{ scale: [1, 1.3, 1] }}
              transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
            />
            {/* Dot pattern */}
            <div className="absolute inset-0" style={{
              backgroundImage: 'radial-gradient(circle, rgba(255,255,255,0.05) 1px, transparent 1px)',
              backgroundSize: '16px 16px',
            }} />
            {/* Animated diagonal lines */}
            <motion.div
              className="absolute inset-0 opacity-30"
              style={{
                background: `linear-gradient(45deg, transparent 40%, rgba(255,255,255,0.05) 50%, transparent 60%)`,
                backgroundSize: '200% 200%',
              }}
              animate={{ backgroundPosition: ['0% 0%', '100% 100%', '0% 0%'] }}
              transition={{ duration: 8, repeat: Infinity, ease: 'easeInOut' }}
            />
          </div>

          {/* Edit Profile Button & Share Profile Button */}
          <div className="relative z-10 flex justify-end gap-2 mb-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowProfileCard(true)}
              className="text-white/80 hover:text-white hover:bg-white/10 rounded-full px-3 h-8 text-xs gap-1.5"
            >
              <Share2 className="w-3.5 h-3.5" />
              {t('common.share', language)}
            </Button>
            <Dialog open={editOpen} onOpenChange={setEditOpen}>
              <DialogTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-white/80 hover:text-white hover:bg-white/15 rounded-full px-3 h-8 text-xs gap-1.5 transition-all duration-200 hover:scale-105"
                >
                  <Edit3 className="w-3.5 h-3.5" />
                  {t('profile.editProfile', language)}
                </Button>
              </DialogTrigger>
              <DialogContent className="bg-warm-50 dark:bg-warm-100 border-warm-300 max-h-[85vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle className="text-warm-800 dark:text-warm-800">{t('profile.editProfile', language)}</DialogTitle>
                </DialogHeader>
                <div className="space-y-5 mt-2">
                  {/* Avatar Upload with Preview */}
                  <div className="flex flex-col items-center gap-3">
                    <div className="relative">
                      <div className="w-20 h-20 rounded-full bg-warm-200 dark:bg-warm-300 flex items-center justify-center text-3xl overflow-hidden border-3 border-brand-red/20 shadow-lg">
                        {avatarPreview || currentUser?.avatar ? (
                          <img src={avatarPreview || currentUser?.avatar} alt="Preview" className="w-full h-full object-cover" />
                        ) : (
                          <span>{currentUser?.gender === 'female' ? '👩' : '👨'}</span>
                        )}
                      </div>
                      <button
                        onClick={handleAvatarClick}
                        disabled={uploading}
                        className="absolute -bottom-1 -right-1 w-8 h-8 rounded-full bg-brand-red flex items-center justify-center text-white shadow-lg hover:bg-brand-red-dark transition-colors disabled:opacity-50"
                      >
                        {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Camera className="w-4 h-4" />}
                      </button>
                    </div>
                    <p className="text-[10px] text-warm-400">Tap to change photo</p>
                  </div>

                  {/* Gender Selection */}
                  <div>
                    <label className="text-sm font-semibold text-warm-700 dark:text-warm-600 mb-2 block">Gender</label>
                    <div className="grid grid-cols-2 gap-3">
                      <button
                        onClick={() => setEditForm({ ...editForm, gender: 'male' })}
                        className={`p-3 rounded-xl border-2 text-sm font-medium transition-all flex items-center justify-center gap-2 ${
                          editForm.gender === 'male'
                            ? 'border-brand-teal bg-brand-teal/10 text-brand-teal'
                            : 'border-warm-300 text-warm-600 dark:border-warm-200'
                        }`}
                      >
                        <span className="text-lg">♂</span> Boy
                      </button>
                      <button
                        onClick={() => setEditForm({ ...editForm, gender: 'female' })}
                        className={`p-3 rounded-xl border-2 text-sm font-medium transition-all flex items-center justify-center gap-2 ${
                          editForm.gender === 'female'
                            ? 'border-brand-red bg-brand-red/10 text-brand-red'
                            : 'border-warm-300 text-warm-600 dark:border-warm-200'
                        }`}
                      >
                        <span className="text-lg">♀</span> Girl
                      </button>
                    </div>
                  </div>

                  {/* Weight Category Selector */}
                  <div>
                    <label className="text-sm font-semibold text-warm-700 dark:text-warm-600 mb-2 block">Weight Category</label>
                    <div className="grid grid-cols-2 gap-2">
                      {/* Open Option */}
                      <button
                        onClick={() => setEditForm({ ...editForm, weight: 'open' })}
                        className={`p-2.5 rounded-lg border-2 text-xs font-medium transition-all flex flex-col items-center gap-1 ${
                          editForm.weight === 'open'
                            ? 'border-brand-teal bg-brand-teal/10 text-brand-teal'
                            : 'border-warm-300 bg-white dark:bg-warm-50 text-warm-600 dark:text-warm-500 hover:border-warm-200'
                        }`}
                      >
                        <span className="text-base">♾️</span>
                        Open
                        <span className="text-[9px] opacity-60">No restriction</span>
                      </button>
                      {/* Weight Option */}
                      <button
                        onClick={() => setEditForm({ ...editForm, weight: editForm.weight && editForm.weight !== 'open' ? editForm.weight : '' })}
                        className={`p-2.5 rounded-lg border-2 text-xs font-medium transition-all flex flex-col items-center gap-1 ${
                          editForm.weight && editForm.weight !== 'open'
                            ? 'border-brand-teal bg-brand-teal/10 text-brand-teal'
                            : 'border-warm-300 bg-white dark:bg-warm-50 text-warm-600 dark:text-warm-500 hover:border-warm-200'
                        }`}
                      >
                        <span className="text-base">⚖️</span>
                        Weight
                        <span className="text-[9px] opacity-60">Enter manually</span>
                      </button>
                    </div>
                    {editForm.weight && editForm.weight !== 'open' && (
                      <div className="relative mt-2">
                        <Input
                          type="text"
                          placeholder="e.g. 65kg, 70kg, Below 80kg..."
                          value={editForm.weight}
                          onChange={(e) => setEditForm({ ...editForm, weight: e.target.value })}
                          className="bg-white dark:bg-warm-50 border-2 border-amber-200 dark:border-amber-800/40 focus:border-brand-teal rounded-xl pr-10"
                          maxLength={30}
                        />
                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-amber-500 text-sm pointer-events-none">⚖️</span>
                      </div>
                    )}
                  </div>

                  {/* Practice Ground with Autocomplete */}
                  <div className="relative">
                    <label className="text-sm font-semibold text-warm-700 dark:text-warm-600 mb-2 block">Practice Ground</label>
                    <Input
                      placeholder="Search for a ground..."
                      value={groundSearch || editForm.practiceGround}
                      onChange={(e) => {
                        setGroundSearch(e.target.value);
                        setEditForm({ ...editForm, practiceGround: e.target.value });
                        setShowGroundSuggestions(true);
                      }}
                      onFocus={() => setShowGroundSuggestions(true)}
                      onBlur={() => setTimeout(() => setShowGroundSuggestions(false), 200)}
                      className="bg-white dark:bg-warm-50 border-warm-300 rounded-xl"
                    />
                    {showGroundSuggestions && groundSearch && (
                      <div className="absolute z-10 w-full mt-1 bg-white dark:bg-warm-50 border border-warm-300 dark:border-warm-200 rounded-lg shadow-lg max-h-32 overflow-y-auto">
                        {PRACTICE_GROUNDS.filter(g => g.toLowerCase().includes(groundSearch.toLowerCase())).map((ground) => (
                          <button
                            key={ground}
                            onClick={() => {
                              setEditForm({ ...editForm, practiceGround: ground });
                              setGroundSearch(ground);
                              setShowGroundSuggestions(false);
                            }}
                            className="w-full text-left px-3 py-2 text-xs text-warm-700 dark:text-warm-600 hover:bg-warm-100 dark:hover:bg-warm-200 transition-colors"
                          >
                            <MapPin className="w-3 h-3 inline mr-1.5 text-warm-400" />
                            {ground}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Jersey Number */}
                  <div>
                    <label className="text-sm font-semibold text-warm-700 dark:text-warm-600 mb-2 block">Jersey Number</label>
                    <div className="relative">
                      <Input
                        type="number"
                        placeholder="Your jersey number"
                        value={editForm.jerseyNumber}
                        onChange={(e) => setEditForm({ ...editForm, jerseyNumber: e.target.value })}
                        className="bg-white dark:bg-warm-50 border-warm-300 rounded-xl pr-12"
                        min={1}
                        max={99}
                      />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-warm-400 text-sm pointer-events-none">#</span>
                    </div>
                  </div>

                  {/* Position Selection with Visual Icons */}
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
                              {t(pos.labelKey, language)}
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
                    {t('common.save', language)}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>

          {/* Name and Gender with Position Badge */}
          <div className="relative z-10 text-center">
            <h2 className={`text-xl font-bold text-white flex items-center justify-center gap-1.5 ${isPremium ? 'text-2xl' : ''}`}>
              <span className={isPremium ? 'bg-gradient-to-r from-yellow-400 via-amber-300 to-yellow-500 bg-clip-text text-transparent font-extrabold drop-shadow-[0_0_8px_rgba(245,158,11,0.3)]' : 'text-white'}>
                {currentUser?.name || 'Player'}
              </span>
              {isPremium && (
                <span className="relative inline-flex items-center ml-0.5">
                  <Badge className="bg-gradient-to-r from-yellow-400 via-amber-400 to-yellow-500 text-yellow-900 text-[8px] border-0 font-extrabold px-1.5 py-0 shadow-lg shadow-yellow-400/20 overflow-hidden">
                    <span className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent animate-[shimmer_3s_ease-in-out_infinite]" style={{ backgroundSize: '200% 100%' }} />
                    <Crown className="w-2.5 h-2.5 mr-0.5 relative z-10" />PRO
                  </Badge>
                </span>
              )}
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
                  <div className="w-7 h-7 rounded-full bg-gradient-to-br from-yellow-400 via-amber-400 to-yellow-500 flex items-center justify-center shadow-lg shadow-yellow-400/30 ring-2 ring-yellow-300/30">
                    <Crown className="w-4 h-4 text-yellow-900" />
                  </div>
                </motion.div>
              ) : null}
            </h2>

            {/* Position badge with kabaddi-themed icon */}
            {(profileData.position || currentUser?.position) && (
              <div className="flex items-center justify-center gap-1.5 mt-1.5">
                <span className="px-3 py-1 rounded-full bg-white/15 backdrop-blur-sm border border-white/20 flex items-center gap-1.5">
                  <span className="text-sm">{getPositionIcon(profileData.position || currentUser?.position || '')}</span>
                  <span className="text-white/90 text-xs font-semibold">{getPositionLabel(profileData.position || currentUser?.position || '')}</span>
                  {(profileData.jerseyNumber || currentUser?.jerseyNumber) && (
                    <span className="text-white/60 text-[10px] font-mono">#{profileData.jerseyNumber || currentUser?.jerseyNumber}</span>
                  )}
                </span>
              </div>
            )}

            {/* Weight & Practice Ground */}
            <div className="flex items-center justify-center gap-3 mt-1.5 text-white/70 text-xs">
              {currentUser?.weight && (
                <span className="flex items-center gap-1">
                  <Activity className="w-3 h-3" />
                  {currentUser.weight === 'open' ? '♾️ Open' : `⚖️ ${currentUser.weight}`}
                </span>
              )}
              {currentUser?.practiceGround && (
                <span className="flex items-center gap-1">
                  <MapPin className="w-3 h-3" />
                  {currentUser.practiceGround}
                </span>
              )}
            </div>

            {/* Badges Row */}
            <div className="flex items-center justify-center gap-2 mt-2">
              {(profileData.jerseyNumber || currentUser?.jerseyNumber) && (
                <span className="px-2.5 py-1 rounded-full bg-white/15 backdrop-blur-sm text-white text-xs font-medium border border-white/20">
                  #{profileData.jerseyNumber || currentUser?.jerseyNumber}
                </span>
              )}
              {isPremium && (
                <span className="relative px-2.5 py-1 rounded-full bg-gradient-to-r from-yellow-400 via-amber-400 to-yellow-500 text-yellow-900 text-xs font-extrabold shadow-md shadow-yellow-400/20 overflow-hidden">
                  <span className="absolute inset-0 bg-gradient-to-r from-transparent via-white/25 to-transparent animate-[shimmer_3s_ease-in-out_infinite]" style={{ backgroundSize: '200% 100%' }} />
                  <span className="relative z-10 flex items-center gap-1"><Crown className="w-3 h-3" />PRO</span>
                </span>
              )}
            </div>

            {/* Level/Rank Indicator */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="mt-3 flex items-center justify-center gap-2"
            >
              <div className={`px-3 py-1 rounded-full bg-gradient-to-r ${playerLevel.color} text-white text-xs font-bold flex items-center gap-1 shadow-lg`}>
                <span>{playerLevel.icon}</span>
                {playerLevel.label}
              </div>
            </motion.div>

            {/* Level progress bar with gradient */}
            <div className="mt-2 mx-auto max-w-[160px]">
              <div className="w-full h-2 bg-white/20 rounded-full overflow-hidden backdrop-blur-sm">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${playerLevel.progress}%` }}
                  transition={{ duration: 1.5, ease: 'easeOut', delay: 0.5 }}
                  className="h-full rounded-full bg-gradient-to-r from-white/50 via-white/80 to-brand-gold/80 relative"
                >
                  {/* Shine effect */}
                  <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent -translate-x-full animate-[shimmer_3s_ease-in-out_infinite]" />
                </motion.div>
              </div>
              <p className="text-[9px] text-white/40 mt-1">{playerLevel.progress.toFixed(0)}% to next level</p>
            </div>

            {/* Member Since */}
            <p className="text-white/40 text-[10px] mt-2">
              <Clock className="w-3 h-3 inline mr-1" />
              Member since {memberSince.toLocaleDateString('en-IN', { month: 'short', year: 'numeric' })}
            </p>

            <p className="text-white/60 text-sm capitalize mt-0.5">{currentUser?.role || 'Player'}</p>
          </div>
        </div>

        {/* Avatar overlapping the banner with enhanced animated border ring and profile completeness */}
        <div className="absolute -bottom-16 left-1/2 -translate-x-1/2 z-20">
          <div className="relative">
            {/* Animated rotating border ring - enhanced with more colors */}
            <motion.div
              className="absolute -inset-3 rounded-full"
              style={{
                background: `conic-gradient(from 0deg, #DC2626, #F59E0B, #14B8A6, #3B82F6, #8B5CF6, #EC4899, #DC2626)`,
              }}
              animate={{ rotate: 360 }}
              transition={{ duration: 6, repeat: Infinity, ease: 'linear' }}
            />
            <div className="absolute -inset-[6px] rounded-full bg-white dark:bg-warm-900" />
            {/* Pulsing outer glow - enhanced */}
            <motion.div
              className="absolute -inset-4 rounded-full"
              animate={{
                boxShadow: [
                  '0 0 0 0 rgba(220, 38, 38, 0.4), 0 0 0 0 rgba(245, 158, 11, 0.3), 0 0 0 0 rgba(20, 184, 166, 0.2)',
                  '0 0 0 12px rgba(220, 38, 38, 0), 0 0 0 8px rgba(245, 158, 11, 0.1), 0 0 0 4px rgba(20, 184, 166, 0.05)',
                  '0 0 0 0 rgba(220, 38, 38, 0), 0 0 0 0 rgba(245, 158, 11, 0), 0 0 0 0 rgba(20, 184, 166, 0)',
                ],
              }}
              transition={{ duration: 2.5, repeat: Infinity, ease: 'easeInOut' }}
            />
            {/* Profile completeness ring */}
            <svg className="absolute -inset-1 w-[calc(100%+8px)] h-[calc(100%+8px)] -rotate-90 pointer-events-none z-10" viewBox="0 0 140 140">
              <circle cx="70" cy="70" r="66" fill="none" stroke="rgba(220,38,38,0.1)" strokeWidth="2" />
              <motion.circle
                cx="70" cy="70" r="66" fill="none"
                stroke="url(#completenessGrad)"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeDasharray={2 * Math.PI * 66}
                initial={{ strokeDashoffset: 2 * Math.PI * 66 }}
                animate={{ strokeDashoffset: 2 * Math.PI * 66 * (1 - playerLevel.progress / 100) }}
                transition={{ duration: 1.5, ease: 'easeOut', delay: 0.5 }}
              />
              <defs>
                <linearGradient id="completenessGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#DC2626" />
                  <stop offset="50%" stopColor="#F59E0B" />
                  <stop offset="100%" stopColor="#14B8A6" />
                </linearGradient>
              </defs>
            </svg>
            <div className={`w-28 h-28 rounded-full bg-warm-200 dark:bg-warm-300 flex items-center justify-center text-4xl overflow-hidden border-4 border-white dark:border-warm-100 shadow-2xl relative ${
              profileData.position?.includes('raider') || profileData.position?.includes('both')
                ? 'position-ring-raider'
                : profileData.position?.includes('corner') || profileData.position?.includes('cover')
                  ? 'position-ring-defender'
                  : profileData.position === 'all-rounder'
                    ? 'position-ring-allrounder'
                    : ''
            }`}>
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
            {/* Animated level badge with bounce */}
            <motion.div
              className="absolute -bottom-2 left-1/2 -translate-x-1/2 z-30"
              initial={{ scale: 0, y: 10 }}
              animate={{ scale: 1, y: 0 }}
              transition={{ type: 'spring', stiffness: 400, damping: 15, delay: 0.5 }}
            >
              <motion.div
                className={`px-3 py-1 rounded-full bg-gradient-to-r ${playerLevel.color} text-white text-[10px] font-bold flex items-center gap-1 shadow-lg whitespace-nowrap`}
                animate={{ y: [0, -3, 0] }}
                transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut', delay: 1 }}
              >
                <span>{playerLevel.icon}</span>
                {playerLevel.label}
              </motion.div>
            </motion.div>
            <button
              onClick={handleAvatarClick}
              disabled={uploading}
              className="absolute bottom-1 right-1 w-9 h-9 rounded-full bg-brand-red flex items-center justify-center text-white shadow-lg hover:bg-brand-red-dark transition-colors disabled:opacity-50 border-2 border-white dark:border-warm-100"
            >
              {uploading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Camera className="w-4 h-4" />
              )}
            </button>
          </div>
        </div>
      </motion.div>

      {/* Spacer for avatar overlap */}
      <div className="h-16" />

      {/* Player Code - Glassmorphism Card */}
      {(profileData.playerCode || currentUser?.playerCode) && (
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.1, type: 'spring', stiffness: 300 }}
          className="pt-2"
        >
          <button
            onClick={handleCopyCode}
            className="w-full inline-flex items-center gap-3 px-4 py-3.5 rounded-xl backdrop-blur-md bg-white/40 dark:bg-white/10 border border-white/30 dark:border-white/10 hover:bg-white/50 dark:hover:bg-white/15 active:scale-[0.98] transition-all shadow-lg"
          >
            <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-red-500 to-red-700 flex items-center justify-center shadow-md shrink-0">
              <Hash className="w-5 h-5 text-white" />
            </div>
            <div className="text-left flex-1">
              <p className="text-[10px] font-semibold text-warm-400 uppercase tracking-wider leading-none">Player Code</p>
              <p className="text-xl font-black text-warm-800 dark:text-warm-100 font-mono leading-tight tracking-wider">{profileData.playerCode || currentUser?.playerCode}</p>
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
            className="w-full relative overflow-hidden rounded-2xl p-[2px] active:scale-[0.98] transition-transform premium-card-shimmer"
          >
            {/* Animated gradient border */}
            <motion.div
              className="absolute inset-0 rounded-2xl"
              style={{ background: 'linear-gradient(90deg, #F59E0B, #EAB308, #F59E0B, #D97706, #F59E0B)' }}
              animate={{ backgroundPosition: ['0% 0%', '200% 0%'] }}
              transition={{ duration: 3, repeat: Infinity, ease: 'linear' }}
            />
            <div className="relative rounded-2xl bg-gradient-to-r from-amber-600 via-yellow-500 to-amber-600 p-5 overflow-hidden">
              {/* Enhanced shimmer animation */}
              <motion.div
                className="absolute inset-0"
                style={{ background: 'linear-gradient(110deg, transparent 30%, rgba(255,255,255,0.35) 50%, transparent 70%)', backgroundSize: '200% 100%' }}
                animate={{ backgroundPosition: ['200% 0%', '-200% 0%'] }}
                transition={{ duration: 2.5, repeat: Infinity, ease: 'linear' }}
              />
              {/* Sparkle effects */}
              <div className="absolute top-3 right-8 w-2 h-2 rounded-full bg-white/70" style={{ animation: 'twinkle 2s infinite' }} />
              <div className="absolute top-8 right-16 w-1.5 h-1.5 rounded-full bg-white/50" style={{ animation: 'twinkle 2s 0.5s infinite' }} />
              <div className="absolute bottom-4 right-10 w-2 h-2 rounded-full bg-white/60" style={{ animation: 'twinkle 2s 1s infinite' }} />
              <div className="absolute top-6 left-12 w-1 h-1 rounded-full bg-white/40" style={{ animation: 'twinkle 2s 1.5s infinite' }} />
              <div className="relative z-10">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <motion.div
                      className="w-14 h-14 rounded-xl bg-white/20 backdrop-blur-sm flex items-center justify-center shadow-lg"
                      animate={{ rotate: [0, -5, 5, 0] }}
                      transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
                    >
                      <Crown className="w-8 h-8 text-white" />
                    </motion.div>
                    <div className="text-left">
                      <p className="text-white font-bold text-lg">{t('profile.goPremium', language)}</p>
                      <p className="text-white/80 text-xs">Unlock stats, host tournaments & more</p>
                    </div>
                  </div>
                  <div className="bg-white/25 backdrop-blur-sm rounded-xl px-5 py-2.5 text-center">
                    <span className="text-white text-xl font-black">₹99</span>
                    <span className="text-white/80 text-xs block">/mo</span>
                  </div>
                </div>
                {/* Feature icons with descriptions */}
                <div className="grid grid-cols-3 gap-2 mt-3">
                  {[
                    { icon: <BarChart3 className="w-3.5 h-3.5" />, text: 'Advanced Stats' },
                    { icon: <Swords className="w-3.5 h-3.5" />, text: 'Tournaments' },
                    { icon: <Award className="w-3.5 h-3.5" />, text: 'All Badges' },
                  ].map((feature, i) => (
                    <div key={i} className="flex items-center gap-1.5 bg-white/10 rounded-lg px-2 py-1.5">
                      <div className="text-white/90">{feature.icon}</div>
                      <span className="text-[9px] text-white/80 font-medium">{feature.text}</span>
                    </div>
                  ))}
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
          <Card className="p-4 bg-gradient-to-r from-yellow-400/10 via-amber-400/5 to-yellow-400/10 border border-yellow-400/20 dark:from-yellow-400/20 dark:via-amber-400/10 dark:to-yellow-400/20 overflow-hidden relative">
            {/* Shimmer effect on premium card */}
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-yellow-400/5 to-transparent animate-[shimmer_3s_ease-in-out_infinite]" style={{ backgroundSize: '200% 100%' }} />
            <div className="flex items-center justify-between relative z-10">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-yellow-400/20 to-amber-400/20 flex items-center justify-center shadow-md shadow-yellow-400/10">
                  <Crown className="w-5 h-5 text-yellow-500" />
                </div>
                <div className="text-left">
                  <p className="text-warm-800 dark:text-warm-100 font-bold text-sm">{t('profile.premiumActive', language)}</p>
                  <p className="text-warm-500 dark:text-warm-300 text-xs">{t('profile.allFeaturesUnlocked', language)}</p>
                </div>
              </div>
              <Badge className="bg-gradient-to-r from-yellow-400 via-amber-400 to-yellow-500 text-yellow-900 border-0 text-xs font-extrabold shadow-md shadow-yellow-400/20 overflow-hidden relative">
                <span className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent animate-[shimmer_3s_ease-in-out_infinite]" style={{ backgroundSize: '200% 100%' }} />
                <Crown className="w-3 h-3 mr-1 relative z-10" />
                <span className="relative z-10">PRO</span>
              </Badge>
            </div>
          </Card>
        </motion.div>
      )}

      {/* ═══════════════════════════════════════════ */}
      {/* 2. STATS CARDS with Circular Progress Rings */}
      {/* ═══════════════════════════════════════════ */}
      {(
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="grid grid-cols-3 gap-2"
      >
        {[
          { label: t('profile.raidPointsLong', language), value: raidPoints, icon: Zap, color: 'orange', sparkData: raidSparkline, trend: raidPoints > 0 ? 12 : 0, glow: 'stat-glow-orange', ringColor: '#EA580C', ringBg: '#EA580C20', pct: Math.min((raidPoints / Math.max(totalPoints, 1)) * 100, 100) },
          { label: t('profile.tacklePointsLong', language), value: tacklePoints, icon: Shield, color: 'emerald', sparkData: tackleSparkline, trend: tacklePoints > 0 ? 8 : 0, glow: 'stat-glow-emerald', ringColor: '#059669', ringBg: '#05966920', pct: Math.min((tacklePoints / Math.max(totalPoints, 1)) * 100, 100) },
          { label: t('profile.rating', language), value: parseFloat(profileData.overallRating.toFixed(1)), icon: Swords, color: 'amber', sparkData: ratingSparkline, trend: profileData.overallRating > 0 ? -3 : 0, decimals: 1, glow: 'stat-glow-amber', ringColor: '#D97706', ringBg: '#D9770620', pct: Math.min(profileData.overallRating * 10, 100) },
        ].map((stat, idx) => {
          const IconComp = stat.icon;
          const circumference = 2 * Math.PI * 28;
          const strokeDashoffset = circumference - (stat.pct / 100) * circumference;
          return (
            <motion.div
              key={stat.label}
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 + idx * 0.08 }}
              className={`glass-card rounded-xl p-2.5 shadow-lg ${stat.glow} hover:scale-[1.03] transition-transform duration-200 relative overflow-hidden`}
            >
              {/* Circular Progress Ring Background */}
              <div className="flex justify-center mb-2">
                <div className="relative w-16 h-16">
                  <svg className="w-16 h-16 -rotate-90" viewBox="0 0 64 64">
                    <circle cx="32" cy="32" r="28" fill="none" stroke={stat.ringBg} strokeWidth="4" />
                    <motion.circle
                      cx="32" cy="32" r="28" fill="none"
                      stroke={stat.ringColor}
                      strokeWidth="4"
                      strokeLinecap="round"
                      strokeDasharray={circumference}
                      initial={{ strokeDashoffset: circumference }}
                      animate={{ strokeDashoffset }}
                      transition={{ duration: 1.5, ease: 'easeOut', delay: 0.3 + idx * 0.1 }}
                    />
                  </svg>
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                      stat.color === 'orange' ? 'bg-orange-500/15' :
                      stat.color === 'emerald' ? 'bg-emerald-500/15' :
                      'bg-amber-500/15'
                    }`}>
                      <IconComp className={`w-4 h-4 ${
                        stat.color === 'orange' ? 'text-orange-500' :
                        stat.color === 'emerald' ? 'text-emerald-500' :
                        'text-amber-500'
                      }`} />
                    </div>
                  </div>
                </div>
              </div>
              <div className={`text-lg font-black text-center ${
                stat.color === 'orange' ? 'text-orange-600 dark:text-orange-400' :
                stat.color === 'emerald' ? 'text-emerald-600 dark:text-emerald-400' :
                'text-amber-600 dark:text-amber-400'
              }`}>
                <AnimatedValue value={stat.value} decimals={stat.decimals || 0} />
              </div>
              <div className="flex items-center justify-between mt-0.5">
                <div className="text-[10px] text-warm-600 dark:text-warm-300">{stat.label}</div>
                {stat.trend !== 0 && (
                  <div className={`flex items-center gap-0.5 text-[9px] font-bold px-1.5 py-0.5 rounded-full ${
                    stat.trend > 0 ? 'text-emerald-600 bg-emerald-500/10 dark:text-emerald-400 dark:bg-emerald-500/15' : 'text-red-600 bg-red-500/10 dark:text-red-400 dark:bg-red-500/15'
                  }`}>
                    {stat.trend > 0 ? <TrendingUp className="w-2.5 h-2.5" /> : <TrendingDown className="w-2.5 h-2.5" />}
                    {Math.abs(stat.trend)}%
                  </div>
                )}
              </div>
            </motion.div>
          );
        })}
      </motion.div>
      )}

      {/* ═══════════════════════════════════════════ */}
      {/* 3. SCORE BREAKDOWN with Donut/Ring Chart */}
      {/* ═══════════════════════════════════════════ */}
      {(
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.12 }}
      >
        <h3 className="font-bold text-warm-800 dark:text-warm-100 mb-3 flex items-center gap-2">
          <Trophy className="w-4 h-4 text-brand-gold" />
          {t('profile.detailedBreakdown', language)}
        </h3>

        <div className="grid grid-cols-5 gap-3">
          {/* Donut Chart - Enhanced */}
          <Card className="col-span-2 p-3 shadow-sm flex items-center justify-center glass-card">
            <div className="w-full h-36 relative">
              {donutData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={donutData}
                      cx="50%"
                      cy="50%"
                      innerRadius={38}
                      outerRadius={58}
                      dataKey="value"
                      strokeWidth={3}
                      stroke="var(--card)"
                      animationBegin={300}
                      animationDuration={1500}
                      animationEasing="ease-out"
                    >
                      {donutData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.fill} />
                      ))}
                    </Pie>
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex items-center justify-center h-full text-warm-400 text-xs">No data yet</div>
              )}
              {/* Center label - enhanced */}
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                <motion.span
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ delay: 0.8, type: 'spring', stiffness: 300 }}
                  className="text-xl font-black text-warm-800 dark:text-warm-100"
                >
                  <AnimatedValue value={totalPoints} />
                </motion.span>
                <span className="text-[8px] font-bold text-warm-400 uppercase tracking-wider">🏆 Tourney Pts</span>
              </div>
            </div>
          </Card>

          {/* Legend & Breakdown - Enhanced */}
          <div className="col-span-3 space-y-2">
            {donutData.map((item) => {
              const pct = totalPoints > 0 ? ((item.value / totalPoints) * 100).toFixed(0) : 0;
              return (
                <motion.div
                  key={item.name}
                  initial={{ opacity: 0, x: 10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.5 + donutData.indexOf(item) * 0.1 }}
                  className="flex items-center gap-2 p-1.5 rounded-lg hover:bg-warm-100/50 dark:hover:bg-warm-200/30 transition-colors"
                >
                  <div className="w-3 h-3 rounded-full shrink-0 shadow-sm" style={{ backgroundColor: item.fill }} />
                  <span className="text-xs font-medium text-warm-600 dark:text-warm-300 flex-1">{item.name}</span>
                  <span className="text-xs font-black text-warm-800 dark:text-warm-100">{item.value}</span>
                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full" style={{ backgroundColor: `${item.fill}15`, color: item.fill }}>{pct}%</span>
                </motion.div>
              );
            })}

            {/* Success Rate Progress Bars - Enhanced */}
            <div className="mt-2 space-y-2.5 pt-2 border-t border-warm-200 dark:border-warm-300">
              <div>
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-1.5">
                    <div className="w-5 h-5 rounded-md bg-orange-500/10 flex items-center justify-center">
                      <Zap className="w-3 h-3 text-orange-500" />
                    </div>
                    <span className="text-[10px] font-semibold text-warm-600 dark:text-warm-300">{t('profile.raidSuccess', language)}</span>
                  </div>
                  <span className="text-[10px] font-black text-orange-500">{raidSuccessRate.toFixed(0)}%</span>
                </div>
                <div className="w-full h-2.5 bg-warm-200 dark:bg-warm-300 rounded-full overflow-hidden progress-glow">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${Math.min(raidSuccessRate, 100)}%` }}
                    transition={{ duration: 1.5, ease: 'easeOut', delay: 0.3 }}
                    className="h-full rounded-full bg-gradient-to-r from-orange-400 via-red-500 to-amber-500"
                  />
                </div>
              </div>
              <div>
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-1.5">
                    <div className="w-5 h-5 rounded-md bg-emerald-500/10 flex items-center justify-center">
                      <Shield className="w-3 h-3 text-emerald-500" />
                    </div>
                    <span className="text-[10px] font-semibold text-warm-600 dark:text-warm-300">{t('profile.tackleSuccess', language)}</span>
                  </div>
                  <span className="text-[10px] font-black text-emerald-500">{tackleSuccessRate.toFixed(0)}%</span>
                </div>
                <div className="w-full h-2.5 bg-warm-200 dark:bg-warm-300 rounded-full overflow-hidden progress-glow">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${Math.min(tackleSuccessRate, 100)}%` }}
                    transition={{ duration: 1.5, ease: 'easeOut', delay: 0.4 }}
                    className="h-full rounded-full bg-gradient-to-r from-emerald-400 via-teal-500 to-green-500"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ═══ Practice Stats Section ═══ */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.13 }}
        >
          <Card className="overflow-hidden border-0 shadow-sm">
            <div className="p-4 bg-gradient-to-br from-emerald-50/80 to-teal-50/50 dark:from-emerald-900/15 dark:to-teal-900/10">
              {/* Section Header */}
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-emerald-500/15 flex items-center justify-center">
                    <span className="text-sm">🏋️</span>
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-warm-800 dark:text-warm-200">Practice Stats</h3>
                    <p className="text-[9px] text-warm-500 dark:text-warm-400">Not counted in leaderboard or awards</p>
                  </div>
                </div>
                {practiceMatches > 0 && (
                  <Badge variant="secondary" className="text-[9px] bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                    {practiceMatches} matches
                  </Badge>
                )}
              </div>

              {practiceMatches > 0 ? (
                <>
                  {/* Practice Stats Grid */}
                  <div className="grid grid-cols-4 gap-2 mb-3">
                    <div className="text-center p-2 rounded-xl bg-white/60 dark:bg-warm-800/40">
                      <p className="text-lg font-black text-warm-800 dark:text-warm-100">{practiceMatches}</p>
                      <p className="text-[8px] text-warm-500 dark:text-warm-400 uppercase font-semibold">Matches</p>
                    </div>
                    <div className="text-center p-2 rounded-xl bg-orange-500/10 dark:bg-orange-500/5">
                      <p className="text-lg font-black text-orange-500">{practiceRaidPoints}</p>
                      <p className="text-[8px] text-warm-500 dark:text-warm-400 uppercase font-semibold">Raid Pts</p>
                    </div>
                    <div className="text-center p-2 rounded-xl bg-emerald-500/10 dark:bg-emerald-500/5">
                      <p className="text-lg font-black text-emerald-500">{practiceTacklePoints}</p>
                      <p className="text-[8px] text-warm-500 dark:text-warm-400 uppercase font-semibold">Tackle Pts</p>
                    </div>
                    <div className="text-center p-2 rounded-xl bg-amber-500/10 dark:bg-amber-500/5">
                      <p className="text-lg font-black text-amber-600 dark:text-amber-400">{practiceTotalPoints}</p>
                      <p className="text-[8px] text-warm-500 dark:text-warm-400 uppercase font-semibold">Total Pts</p>
                    </div>
                  </div>

                  {/* Comparison Bar */}
                  <div className="bg-white/40 dark:bg-warm-800/30 rounded-xl p-3">
                    <p className="text-[10px] font-semibold text-warm-600 dark:text-warm-300 mb-2">Points Distribution</p>
                    <div className="h-3 rounded-full bg-warm-200 dark:bg-warm-700 overflow-hidden flex">
                      {practiceTotalPoints > 0 && (
                        <>
                          <motion.div
                            initial={{ width: 0 }}
                            animate={{ width: `${(practiceRaidPoints / practiceTotalPoints) * 100}%` }}
                            transition={{ duration: 0.8, delay: 0.3 }}
                            className="h-full bg-gradient-to-r from-orange-400 to-orange-500"
                          />
                          <motion.div
                            initial={{ width: 0 }}
                            animate={{ width: `${(practiceTacklePoints / practiceTotalPoints) * 100}%` }}
                            transition={{ duration: 0.8, delay: 0.4 }}
                            className="h-full bg-gradient-to-r from-emerald-400 to-emerald-500"
                          />
                        </>
                      )}
                    </div>
                    <div className="flex items-center justify-between mt-2">
                      <div className="flex items-center gap-1.5">
                        <div className="w-2 h-2 rounded-full bg-orange-500" />
                        <span className="text-[9px] text-warm-500 dark:text-warm-400">Raid {practiceTotalPoints > 0 ? Math.round((practiceRaidPoints / practiceTotalPoints) * 100) : 0}%</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <div className="w-2 h-2 rounded-full bg-emerald-500" />
                        <span className="text-[9px] text-warm-500 dark:text-warm-400">Tackle {practiceTotalPoints > 0 ? Math.round((practiceTacklePoints / practiceTotalPoints) * 100) : 0}%</span>
                      </div>
                    </div>
                  </div>
                </>
              ) : (
                <div className="text-center py-4">
                  <p className="text-xs text-warm-500 dark:text-warm-400 font-medium">No practice matches yet</p>
                  <p className="text-[10px] text-warm-400 dark:text-warm-500 mt-1">Start a practice match to track your training stats</p>
                </div>
              )}
            </div>
          </Card>
        </motion.div>

        {/* Tournament vs Practice Overview (compact) */}
        <div className="grid grid-cols-2 gap-3 mt-1">
          <motion.div
            initial={{ opacity: 0, x: -15 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.3 }}
            whileHover={{ scale: 1.02, y: -2 }}
            className="transition-transform"
          >
            <Card className="p-3 bg-amber-50/50 dark:bg-amber-900/10 border-amber-200/50 dark:border-amber-800/20 shadow-sm relative overflow-hidden">
              {/* Decorative gradient accent */}
              <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-amber-400 to-yellow-500" />
              <div className="flex items-center gap-1.5 mb-2">
                <span className="text-sm">🏆</span>
                <span className="text-xs font-bold text-amber-600 dark:text-amber-400">Tournament</span>
                <span className="text-[8px] font-semibold text-amber-500/60 dark:text-amber-400/40 ml-auto">COUNTS</span>
              </div>
              <div className="space-y-1.5">
                <div className="flex justify-between text-[11px]">
                  <span className="text-warm-500 dark:text-warm-400">{t('profile.matches', language)}</span>
                  <span className="text-warm-800 dark:text-warm-100 font-semibold">{profileData.tournamentMatches}</span>
                </div>
                <div className="flex justify-between text-[11px]">
                  <span className="text-warm-500 dark:text-warm-400">{t('common.raidPts', language)}</span>
                  <span className="text-orange-500 font-semibold">{profileData.tournamentRaidPoints}</span>
                </div>
                <div className="flex justify-between text-[11px]">
                  <span className="text-warm-500 dark:text-warm-400">{t('common.tacklePts', language)}</span>
                  <span className="text-emerald-500 font-semibold">{profileData.tournamentTacklePoints}</span>
                </div>
                <div className="flex justify-between text-[11px] border-t border-warm-200 dark:border-warm-300 pt-1">
                  <span className="text-warm-500 dark:text-warm-400">{t('common.totalPts', language)}</span>
                  <span className="text-warm-800 dark:text-warm-100 font-bold">{profileData.tournamentTotalPoints}</span>
                </div>
              </div>
            </Card>
          </motion.div>
          <motion.div
            initial={{ opacity: 0, x: 15 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.4 }}
            whileHover={{ scale: 1.02, y: -2 }}
            className="transition-transform"
          >
            <Card className="p-3 bg-emerald-50/50 dark:bg-emerald-900/10 border-emerald-200/50 dark:border-emerald-800/20 shadow-sm relative overflow-hidden">
              {/* Decorative gradient accent */}
              <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-emerald-400 to-teal-500" />
              <div className="flex items-center gap-1.5 mb-2">
                <span className="text-sm">🏋️</span>
                <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400">Practice</span>
                <span className="text-[8px] font-semibold text-emerald-500/60 dark:text-emerald-400/40 ml-auto">TRAINING</span>
              </div>
              <div className="space-y-1.5">
                <div className="flex justify-between text-[11px]">
                  <span className="text-warm-500 dark:text-warm-400">{t('profile.matches', language)}</span>
                  <span className="text-warm-800 dark:text-warm-100 font-semibold">{profileData.practiceMatches}</span>
                </div>
                <div className="flex justify-between text-[11px]">
                  <span className="text-warm-500 dark:text-warm-400">{t('common.raidPts', language)}</span>
                  <span className="text-orange-500 font-semibold">{profileData.practiceRaidPoints}</span>
                </div>
                <div className="flex justify-between text-[11px]">
                  <span className="text-warm-500 dark:text-warm-400">{t('common.tacklePts', language)}</span>
                  <span className="text-emerald-500 font-semibold">{profileData.practiceTacklePoints}</span>
                </div>
                <div className="flex justify-between text-[11px] border-t border-warm-200 dark:border-warm-300 pt-1">
                  <span className="text-warm-500 dark:text-warm-400">{t('common.totalPts', language)}</span>
                  <span className="text-warm-800 dark:text-warm-100 font-bold">{profileData.practiceTotalPoints}</span>
                </div>
              </div>
            </Card>
          </motion.div>
        </div>
      </motion.div>
      )}

      {/* ═══════════════════════════════════════════ */}
      {/* 4. MATCH HISTORY TIMELINE (Enhanced) */}
      {/* ═══════════════════════════════════════════ */}
      {(
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.14 }}
      >
        <MatchHistoryTimeline
          matches={recentMatches.map((m) => ({
            id: m.id,
            homeTeam: m.homeTeam,
            awayTeam: m.awayTeam,
            homeScore: m.homeScore,
            awayScore: m.awayScore,
            date: m.date,
            isPractice: m.isPractice,
            userTeamSide: m.userTeamSide,
            completedAt: m.completedAt,
          }))}
        />
      </motion.div>
      )}

      {/* ═══════════════════════════════════════════ */}
      {/* 5. BADGES Section with Categories, Locked & Progress */}
      {/* ═══════════════════════════════════════════ */}
      {(
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.15 }}
      >
        <PremiumLock feature="Detailed Badges">
          <h3 className="font-bold text-warm-800 dark:text-warm-100 mb-3 flex items-center gap-2">
            <Award className="w-4 h-4 text-brand-gold" />
            {t('profile.badges', language)}
          </h3>
          <div className="space-y-4">
            {badgeCategories.map((category) => (
              <div key={category.title}>
                <p className="text-[10px] font-semibold text-warm-400 dark:text-warm-300 uppercase tracking-wider mb-2">{category.title}</p>
                <div className="flex flex-wrap gap-2 justify-center">
                  {category.badges.map((badge, idx) => {
                    const isLocked = badge.premium && !isPremium;
                    return (
                      <motion.div
                        key={badge.label}
                        initial={{ opacity: 0, scale: 0.8, y: 10 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        transition={{ delay: 0.06 * idx, type: 'spring', stiffness: 300 }}
                        whileHover={{ scale: 1.08, y: -2 }}
                        className="transition-transform"
                      >
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <div
                              className={`relative flex flex-col items-center px-3 py-2.5 rounded-xl border-2 transition-all min-w-[76px] max-w-[90px] cursor-default ${
                                badge.condition
                                  ? 'bg-gradient-to-br from-brand-gold/15 to-brand-gold/5 border-brand-gold/40 shadow-md badge-unlocked-shimmer'
                                  : isLocked
                                    ? 'bg-warm-100/30 dark:bg-warm-200/20 border-warm-200/60 dark:border-warm-300/50 badge-locked relative overflow-hidden'
                                    : 'bg-warm-100 dark:bg-warm-200/50 border-warm-200 dark:border-warm-300 hover:border-brand-gold/30'
                              }`}
                            >
                              {/* Locked badge shimmer effect */}
                              {isLocked && (
                                <motion.div
                                  className="absolute inset-0 pointer-events-none"
                                  style={{
                                    background: 'linear-gradient(110deg, transparent 30%, rgba(255,255,255,0.15) 50%, transparent 70%)',
                                    backgroundSize: '200% 100%',
                                  }}
                                  animate={{ backgroundPosition: ['200% 0%', '-200% 0%'] }}
                                  transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
                                />
                              )}
                              <motion.span
                                className="text-xl relative z-10"
                                animate={badge.condition ? { scale: [1, 1.2, 1], rotate: [0, 5, -5, 0] } : {}}
                                transition={badge.condition ? { duration: 2.5, repeat: Infinity, repeatDelay: 4 } : {}}
                              >
                                {isLocked ? <Lock className="w-4 h-4 text-warm-400" /> : badge.icon}
                              </motion.span>
                              <span className={`text-[9px] font-bold mt-1 relative z-10 ${
                                badge.condition ? 'text-brand-gold' : 'text-warm-400 dark:text-warm-500'
                              }`}>
                                {badge.label}
                              </span>
                              {/* Progress indicator for partially completed - enhanced */}
                              {!badge.condition && !isLocked && badge.progress > 0 && (
                                <div className="w-full mt-1 relative z-10">
                                  <div className="w-full h-1.5 bg-warm-200 dark:bg-warm-300 rounded-full overflow-hidden">
                                    <motion.div
                                      initial={{ width: 0 }}
                                      animate={{ width: `${badge.progress}%` }}
                                      transition={{ duration: 1, ease: 'easeOut', delay: 0.3 }}
                                      className="h-full rounded-full bg-gradient-to-r from-brand-gold/60 to-brand-gold"
                                    />
                                  </div>
                                  <span className="text-[7px] text-warm-400 font-medium">{badge.progress.toFixed(0)}%</span>
                                </div>
                              )}
                              {isLocked && (
                                <span className="text-[7px] font-bold text-brand-gold/60 mt-0.5 flex items-center gap-0.5 relative z-10">
                                  <Crown className="w-2 h-2" /> PRO
                                </span>
                              )}
                              {/* Unlocked checkmark */}
                              {badge.condition && (
                                <motion.div
                                  initial={{ scale: 0 }}
                                  animate={{ scale: 1 }}
                                  className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-emerald-500 flex items-center justify-center shadow-sm"
                                >
                                  <Check className="w-2.5 h-2.5 text-white" />
                                </motion.div>
                              )}
                            </div>
                          </TooltipTrigger>
                          <TooltipContent side="bottom">
                            <p className="font-semibold">{badge.condition ? '✨ Unlocked!' : `${badge.threshold} needed`}</p>
                            {!badge.condition && <p className="text-[9px] opacity-70">{badge.progress.toFixed(0)}% progress</p>}
                          </TooltipContent>
                        </Tooltip>
                      </motion.div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </PremiumLock>
      </motion.div>
      )}

      {/* ═══════════════════════════════════════════ */}
      {/* 6. PERFORMANCE RADAR/SPIDER CHART */}
      {/* ═══════════════════════════════════════════ */}
      {(
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
      >
        <PremiumLock feature="Performance Analytics">
          <h3 className="font-bold text-warm-800 dark:text-warm-100 mb-3 flex items-center gap-2">
            <Gauge className="w-4 h-4 text-brand-red" />
            {t('profile.performance', language)}
          </h3>
          <Card className="p-4 shadow-sm glass-card relative overflow-hidden">
            {/* Decorative gradient corner accent */}
            <div className="absolute top-0 right-0 w-20 h-20 bg-gradient-to-bl from-brand-red/5 to-transparent pointer-events-none" />
            <div className="h-60">
              <ResponsiveContainer width="100%" height="100%">
                <RadarChart data={radarData} cx="50%" cy="50%" outerRadius="72%">
                  <PolarGrid stroke="var(--border)" strokeOpacity={0.3} />
                  <PolarAngleAxis dataKey="subject" tick={{ fontSize: 10, fill: 'var(--color-warm-500)' }} />
                  <PolarRadiusAxis angle={30} domain={[0, 100]} tick={false} axisLine={false} />
                  {/* Average player overlay - lighter, dashed */}
                  <Radar
                    name="Average"
                    dataKey="avg"
                    stroke="#94A3B8"
                    fill="#94A3B8"
                    fillOpacity={0.08}
                    strokeDasharray="5 5"
                    strokeWidth={1}
                    animationBegin={0}
                    animationDuration={800}
                  />
                  {/* Player's stats - enhanced with glow */}
                  <Radar
                    name="You"
                    dataKey="player"
                    stroke="#DC2626"
                    fill="#DC2626"
                    fillOpacity={0.25}
                    strokeWidth={2.5}
                    animationBegin={400}
                    animationDuration={1200}
                    animationEasing="ease-out"
                  />
                </RadarChart>
              </ResponsiveContainer>
            </div>
            {/* Legend - enhanced with comparison */}
            <div className="flex items-center justify-center gap-4 mt-2">
              <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-brand-red/10">
                <div className="w-3 h-1.5 rounded-full bg-brand-red" />
                <span className="text-[10px] font-semibold text-brand-red">You</span>
              </div>
              <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-warm-200/50 dark:bg-warm-300/30">
                <div className="w-3 h-1.5 rounded-full bg-slate-400 opacity-50" />
                <span className="text-[10px] font-medium text-warm-500 dark:text-warm-400">Avg Player</span>
              </div>
            </div>
            {/* Skill highlights with pulse on max stat */}
            <div className="grid grid-cols-3 gap-2 mt-3">
              {radarData.slice(0, 3).map((skill) => {
                const isMax = skill.player === Math.max(...radarData.map(s => s.player));
                return (
                  <motion.div
                    key={skill.subject}
                    className={`text-center p-1.5 rounded-lg ${
                      isMax
                        ? 'bg-brand-red/10 border border-brand-red/20 ring-1 ring-brand-red/10'
                        : 'bg-warm-100/50 dark:bg-warm-200/30'
                    }`}
                    whileHover={{ scale: 1.05 }}
                  >
                    <p className="text-[9px] text-warm-400 uppercase font-semibold">{skill.subject}</p>
                    <div className="flex items-center justify-center gap-1">
                      <p className={`text-sm font-black ${isMax ? 'text-brand-red' : 'text-warm-800 dark:text-warm-100'}`}>{Math.round(skill.player)}</p>
                      {isMax && (
                        <motion.span
                          animate={{ scale: [1, 1.3, 1], opacity: [0.5, 1, 0.5] }}
                          transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut' }}
                          className="text-[8px]"
                        >
                          🔥
                        </motion.span>
                      )}
                    </div>
                    {/* Comparison vs average */}
                    {skill.player > skill.avg && (
                      <span className="text-[7px] text-emerald-500 font-bold">+{Math.round(skill.player - skill.avg)} vs avg</span>
                    )}
                  </motion.div>
                );
              })}
            </div>
          </Card>

          {/* Bar Chart - legacy performance data */}
          <Card className="p-4 shadow-sm mt-3">
            <h4 className="text-xs font-semibold text-warm-600 dark:text-warm-300 mb-2">Performance Summary</h4>
            <div className="h-36">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={performanceData} barSize={40}>
                  <XAxis
                    dataKey="name"
                    axisLine={false}
                    tickLine={false}
                    tick={{ fontSize: 11, fill: '#8B7355' }}
                  />
                  <YAxis hide />
                  <Bar dataKey="value" radius={[6, 6, 0, 0]} animationDuration={1000} animationEasing="ease-out">
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
      )}

      {/* ═══════════════════════════════════════════ */}
      {/* 7. DETAILED BREAKDOWN with Animated Progress Bars */}
      {/* ═══════════════════════════════════════════ */}
      {(
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.22 }}
      >
        <PremiumLock feature="Detailed Stats" compact>
          <h3 className="font-bold text-warm-800 dark:text-warm-100 mb-3 flex items-center gap-2">
            <Swords className="w-4 h-4 text-brand-red" />
            {t('profile.detailedBreakdown', language)}
          </h3>
          <Card className="p-4 shadow-sm glass-card">
            <div className="space-y-4">
              {detailedStats.map((stat, idx) => {
                const IconComp = stat.icon;
                const diff = stat.value - stat.prev;
                return (
                  <motion.div
                    key={stat.label}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.08 * idx }}
                    className="progress-glow rounded-lg p-1 -m-1"
                  >
                    <div className="flex items-center justify-between mb-1.5">
                      <div className="flex items-center gap-2">
                        <div className={`w-7 h-7 rounded-lg bg-gradient-to-br ${stat.color} flex items-center justify-center shadow-sm`}>
                          <IconComp className="w-3.5 h-3.5 text-white" />
                        </div>
                        <span className="text-sm font-semibold text-warm-700 dark:text-warm-300">{stat.label}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-black text-warm-800 dark:text-warm-100 tabular-nums">{stat.value.toFixed(0)}%</span>
                        {diff !== 0 && (
                          <span className={`text-[9px] font-bold flex items-center gap-0.5 px-1.5 py-0.5 rounded-full ${
                            diff > 0 ? 'text-emerald-600 bg-emerald-500/10 dark:text-emerald-400' : 'text-red-600 bg-red-500/10 dark:text-red-400'
                          }`}>
                            {diff > 0 ? <TrendingUp className="w-2.5 h-2.5" /> : <TrendingDown className="w-2.5 h-2.5" />}
                            {Math.abs(diff).toFixed(0)}%
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="w-full h-3 bg-warm-200 dark:bg-warm-300 rounded-full overflow-hidden">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${Math.min(stat.value, 100)}%` }}
                        transition={{ duration: 1.5, ease: 'easeOut', delay: 0.2 + idx * 0.1 }}
                        className={`h-full rounded-full bg-gradient-to-r ${stat.color} relative`}
                      >
                        {/* Shine effect on progress bar */}
                        <div className="absolute inset-0 rounded-full overflow-hidden">
                          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full animate-[shimmer_3s_ease-in-out_infinite]" />
                        </div>
                      </motion.div>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          </Card>

          {/* Quick stat grid - enhanced */}
          <div className="grid grid-cols-2 gap-3 mt-3">
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.3 }}
              className="text-center p-3 rounded-xl bg-gradient-to-br from-orange-50/80 to-orange-100/30 dark:from-orange-900/15 dark:to-orange-800/5 border border-orange-200/50 dark:border-orange-800/20 hover:scale-[1.02] transition-transform feature-btn-hover"
            >
              <div className="w-8 h-8 rounded-lg bg-orange-500/10 flex items-center justify-center mx-auto mb-1.5 glow-pulse">
                <Zap className="w-4 h-4 text-orange-500" />
              </div>
              <p className="text-[10px] text-warm-500 dark:text-warm-300 font-medium">{t('profile.bonusPoints', language)}</p>
              <p className="text-xl font-black text-orange-500"><AnimatedValue value={profileData.bonusPoints} /></p>
            </motion.div>
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.35 }}
              className="text-center p-3 rounded-xl bg-gradient-to-br from-purple-50/80 to-purple-100/30 dark:from-purple-900/15 dark:to-purple-800/5 border border-purple-200/50 dark:border-purple-800/20 hover:scale-[1.02] transition-transform feature-btn-hover"
            >
              <div className="w-8 h-8 rounded-lg bg-purple-500/10 flex items-center justify-center mx-auto mb-1.5 glow-pulse">
                <Shield className="w-4 h-4 text-purple-500" />
              </div>
              <p className="text-[10px] text-warm-500 dark:text-warm-300 font-medium">{t('profile.superTackles', language)}</p>
              <p className="text-xl font-black text-purple-500"><AnimatedValue value={profileData.superTackles} /></p>
            </motion.div>
          </div>
        </PremiumLock>
      </motion.div>
      )}

      {/* ═══════════════════════════════════════════ */}
      {/* 8. FEATURES GRID with Staggered Animation & Tooltips */}
      {/* ═══════════════════════════════════════════ */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.26 }}
      >
        <h3 className="font-bold text-warm-800 dark:text-warm-100 mb-3 flex items-center gap-2">
          <Settings className="w-4 h-4 text-warm-500" />
          Features
        </h3>
        <div className="space-y-5">
          {featureCategories.map((category, catIdx) => (
            <div key={category.title}>
              {/* Enhanced visual category header */}
              <div className="flex items-center gap-2 mb-2.5 ml-1">
                <div className={`w-1.5 h-1.5 rounded-full ${
                  catIdx === 0 ? 'bg-brand-teal' :
                  catIdx === 1 ? 'bg-brand-gold' :
                  'bg-brand-red'
                }`} />
                <p className="text-[10px] font-bold text-warm-500 dark:text-warm-400 uppercase tracking-widest">{category.title}</p>
                <div className="flex-1 h-px bg-warm-200 dark:bg-warm-700" />
              </div>
              <Card className="shadow-sm overflow-hidden divide-y divide-warm-100 dark:divide-warm-700/50">
                {category.items.map((item, idx) => {
                  const IconComp = item.icon;
                  const isPremiumFeature = item.premium && !isPremium;
                  return (
                    <motion.button
                      key={item.label}
                      initial={{ opacity: 0, x: -5 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.05 * (catIdx * 4 + idx), type: 'spring', stiffness: 200 }}
                      onClick={item.onClick}
                      className={`w-full flex items-center gap-3 p-3.5 hover:bg-warm-50 dark:hover:bg-warm-200/30 active:bg-warm-100 dark:active:bg-warm-200/50 transition-all duration-200 text-left group hover:translate-x-1 chevron-hover-rotate feature-btn-hover relative ${isPremiumFeature ? 'premium-feature-shimmer' : ''}`}
                    >
                      {/* Left border accent - enhanced with gradient */}
                      <div className={`w-1.5 h-10 rounded-full shrink-0 transition-all duration-200 group-hover:h-12 group-hover:w-2 ${
                        item.color === 'brand-teal' ? 'bg-gradient-to-b from-brand-teal to-emerald-600' :
                        item.color === 'brand-gold' ? 'bg-gradient-to-b from-brand-gold to-amber-600' :
                        item.color === 'brand-red' ? 'bg-gradient-to-b from-brand-red to-red-700' :
                        item.color === 'brand-navy' ? 'bg-gradient-to-b from-brand-navy to-slate-700' :
                        item.color === 'purple-500' ? 'bg-gradient-to-b from-purple-500 to-purple-700' :
                        item.color === 'emerald-500' ? 'bg-gradient-to-b from-emerald-500 to-emerald-700' :
                        'bg-warm-400'
                      }`} />
                      {/* Icon with color coding - enhanced with gradient bg and glow */}
                      <motion.div
                        className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 group-hover:scale-110 transition-all duration-200 relative ${
                          item.color === 'brand-teal' ? 'bg-brand-teal/10' :
                          item.color === 'brand-gold' ? 'bg-brand-gold/10' :
                          item.color === 'brand-red' ? 'bg-brand-red/10' :
                          item.color === 'brand-navy' ? 'bg-brand-navy/10' :
                          item.color === 'purple-500' ? 'bg-purple-500/10' :
                          item.color === 'emerald-500' ? 'bg-emerald-500/10' :
                          'bg-warm-200/50'
                        }`}
                        whileHover={{
                          boxShadow: item.color === 'brand-teal' ? '0 0 12px rgba(20, 184, 166, 0.3)' :
                            item.color === 'brand-gold' ? '0 0 12px rgba(245, 158, 11, 0.3)' :
                            item.color === 'brand-red' ? '0 0 12px rgba(220, 38, 38, 0.3)' :
                            item.color === 'brand-navy' ? '0 0 12px rgba(30, 41, 59, 0.3)' :
                            '0 0 8px rgba(100, 116, 139, 0.2)',
                        }}
                      >
                        <IconComp className={`w-4.5 h-4.5 ${
                          item.color === 'brand-teal' ? 'text-brand-teal' :
                          item.color === 'brand-gold' ? 'text-brand-gold' :
                          item.color === 'brand-red' ? 'text-brand-red' :
                          item.color === 'brand-navy' ? 'text-brand-navy' :
                          item.color === 'purple-500' ? 'text-purple-500' :
                          item.color === 'emerald-500' ? 'text-emerald-500' :
                          'text-warm-500'
                        }`} />
                      </motion.div>
                      {/* Label and description */}
                      <div className="flex-1 min-w-0 relative z-10">
                        <div className="flex items-center gap-1.5">
                          <p className="text-xs font-semibold text-warm-800 dark:text-warm-100">{item.label}</p>
                          {isPremiumFeature && (
                            <span className="text-[7px] font-bold text-brand-gold bg-brand-gold/15 px-1.5 py-0.5 rounded-full flex items-center gap-0.5">
                              <Crown className="w-2 h-2" /> PRO
                            </span>
                          )}
                        </div>
                        <p className="text-[10px] text-warm-400 dark:text-warm-300">{item.desc}</p>
                      </div>
                      {/* Premium lock overlay for locked features */}
                      {isPremiumFeature && (
                        <div className="shrink-0 w-8 h-8 rounded-full bg-brand-gold/10 flex items-center justify-center">
                          <Lock className="w-3.5 h-3.5 text-brand-gold/60" />
                        </div>
                      )}
                      {/* Chevron - only for non-premium-locked items */}
                      {!isPremiumFeature && (
                        <ChevronRight className="w-4 h-4 text-warm-300 dark:text-warm-400 group-hover:text-warm-500 transition-colors shrink-0 chevron-icon relative z-10" />
                      )}
                    </motion.button>
                  );
                })}
              </Card>
            </div>
          ))}
        </div>
      </motion.div>

      {/* ═══════════════════════════════════════════ */}
      {/* SECTION DIVIDER - Enhanced */}
      {/* ═══════════════════════════════════════════ */}
      <div className="flex items-center gap-3 my-2">
        <div className="flex-1 h-px bg-gradient-to-r from-transparent via-warm-200 dark:via-warm-700 to-warm-200 dark:to-warm-700" />
        <span className="text-[10px] font-bold text-warm-400 dark:text-warm-300 uppercase tracking-widest">Info & Settings</span>
        <div className="flex-1 h-px bg-gradient-to-r from-warm-200 dark:from-warm-700 via-warm-200 dark:via-warm-700 to-transparent" />
      </div>

      {/* ═══════════════════════════════════════════ */}
      {/* 9. PERSONAL INFO & SETTINGS with Enhanced Toggles */}
      {/* ═══════════════════════════════════════════ */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.25 }}
      >
        <Card className="p-4 space-y-4 shadow-sm glass-card">
          {/* Phone */}
          <div className="flex justify-between text-sm items-center py-1">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-warm-100 dark:bg-warm-200/50 flex items-center justify-center">
                <Phone className="w-3.5 h-3.5 text-warm-400" />
              </div>
              <div>
                <span className="text-warm-800 dark:text-warm-100 font-medium text-xs">Phone</span>
                <p className="text-[10px] text-warm-400 dark:text-warm-300">Your registered number</p>
              </div>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-warm-800 dark:text-warm-100 font-medium font-mono text-xs">
                {showPhone ? (currentUser?.phone || '—') : (currentUser?.phone ? `****${currentUser.phone.slice(-2)}` : '—')}
              </span>
              <motion.button
                onClick={() => setShowPhone(!showPhone)}
                whileTap={{ scale: 0.9 }}
                className="w-5 h-5 rounded-full bg-warm-100 dark:bg-warm-200 flex items-center justify-center text-warm-400 hover:text-warm-600 transition-colors"
              >
                {showPhone ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
              </motion.button>
              <motion.button
                onClick={() => { setShowPhoneEdit(true); setNewPhone(''); setPhoneEditError(''); }}
                whileTap={{ scale: 0.9 }}
                className="w-5 h-5 rounded-full bg-brand-teal/10 flex items-center justify-center text-brand-teal hover:bg-brand-teal/20 transition-colors"
                title={t('profile.changePhone', language)}
              >
                <Pencil className="w-3 h-3" />
              </motion.button>
            </div>
          </div>

          {/* Weight */}
          {currentUser?.weight && (
            <div className="flex justify-between text-sm items-center py-1">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-warm-100 dark:bg-warm-200/50 flex items-center justify-center">
                  <Activity className="w-3.5 h-3.5 text-warm-400" />
                </div>
                <div>
                  <span className="text-warm-800 dark:text-warm-100 font-medium text-xs">Weight</span>
                  <p className="text-[10px] text-warm-400 dark:text-warm-300">Your weight category</p>
                </div>
              </div>
              <span className="text-warm-800 dark:text-warm-100 font-medium text-xs">{currentUser.weight === 'open' ? '♾️ Open' : currentUser.weight}</span>
            </div>
          )}

          {/* Practice Ground */}
          {currentUser?.practiceGround && (
            <div className="flex justify-between text-sm items-center py-1">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-warm-100 dark:bg-warm-200/50 flex items-center justify-center">
                  <MapPin className="w-3.5 h-3.5 text-warm-400" />
                </div>
                <div>
                  <span className="text-warm-800 dark:text-warm-100 font-medium text-xs">Practice Ground</span>
                  <p className="text-[10px] text-warm-400 dark:text-warm-300">Your training venue</p>
                </div>
              </div>
              <span className="text-warm-800 dark:text-warm-100 font-medium text-xs max-w-[150px] truncate">{currentUser.practiceGround}</span>
            </div>
          )}

          {/* Position */}
          {(profileData.position || currentUser?.position) && (
            <div className="flex justify-between text-sm items-center py-1">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-warm-100 dark:bg-warm-200/50 flex items-center justify-center">
                  <Target className="w-3.5 h-3.5 text-warm-400" />
                </div>
                <div>
                  <span className="text-warm-800 dark:text-warm-100 font-medium text-xs">Position</span>
                  <p className="text-[10px] text-warm-400 dark:text-warm-300">Your playing role</p>
                </div>
              </div>
              <span className="text-warm-800 dark:text-warm-100 font-medium text-xs">{getPositionIcon(profileData.position || currentUser?.position || '')} {getPositionLabel(profileData.position || currentUser?.position || '')}</span>
            </div>
          )}

          {/* Jersey */}
          {(profileData.jerseyNumber || currentUser?.jerseyNumber) && (
            <div className="flex justify-between text-sm items-center py-1">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-warm-100 dark:bg-warm-200/50 flex items-center justify-center">
                  <Hash className="w-3.5 h-3.5 text-warm-400" />
                </div>
                <div>
                  <span className="text-warm-800 dark:text-warm-100 font-medium text-xs">Jersey</span>
                  <p className="text-[10px] text-warm-400 dark:text-warm-300">Your jersey number</p>
                </div>
              </div>
              <span className="text-warm-800 dark:text-warm-100 font-medium text-xs">#{profileData.jerseyNumber || currentUser?.jerseyNumber}</span>
            </div>
          )}

          {/* Plan */}
          <div className="flex justify-between text-sm items-center py-1">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-warm-100 dark:bg-warm-200/50 flex items-center justify-center">
                <CreditCard className="w-3.5 h-3.5 text-warm-400" />
              </div>
              <div>
                <span className="text-warm-800 dark:text-warm-100 font-medium text-xs">Plan</span>
                <p className="text-[10px] text-warm-400 dark:text-warm-300">Your subscription</p>
              </div>
            </div>
            <span className={`font-medium text-xs flex items-center gap-1 ${isPremium ? 'text-brand-gold' : 'text-warm-600 dark:text-warm-300'}`}>
              {isPremium ? <><Crown className="w-3 h-3" /> Premium</> : 'Free'}
            </span>
          </div>

          {/* Language Toggle with Flag Icons - Enhanced */}
          <div className="flex justify-between items-center py-1">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-warm-100 dark:bg-warm-200/50 flex items-center justify-center">
                <Flag className="w-3.5 h-3.5 text-warm-400" />
              </div>
              <div>
                <span className="text-warm-800 dark:text-warm-100 font-medium text-xs">{t('profile.language', language)}</span>
                <p className="text-[10px] text-warm-400 dark:text-warm-300">{language === 'hi' ? 'ऐप्लिकेशन भाषा' : 'App display language'}</p>
              </div>
            </div>
            <div className="flex items-center gap-1 bg-warm-100 dark:bg-warm-200 rounded-xl p-1">
              <motion.button
                onClick={() => setLanguage('en')}
                whileTap={{ scale: 0.95 }}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-300 flex items-center gap-1.5 ${
                  language === 'en'
                    ? 'bg-brand-teal text-white shadow-md'
                    : 'text-warm-500 dark:text-warm-400 hover:text-warm-700 dark:hover:text-warm-600'
                }`}
              >
                🇬🇧 English
              </motion.button>
              <motion.button
                onClick={() => setLanguage('hi')}
                whileTap={{ scale: 0.95 }}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-300 flex items-center gap-1.5 ${
                  language === 'hi'
                    ? 'bg-brand-teal text-white shadow-md'
                    : 'text-warm-500 dark:text-warm-400 hover:text-warm-700 dark:hover:text-warm-600'
                }`}
              >
                🇮🇳 हिंदी
              </motion.button>
            </div>
          </div>

          {/* Dark Mode Toggle with Sun/Moon Animation - Enhanced with animated toggle track */}
          <div className="flex justify-between items-center py-1">
            <div className="flex items-center gap-2">
              <div className={`w-7 h-7 rounded-lg flex items-center justify-center transition-colors duration-300 ${darkMode ? 'bg-brand-gold/20' : 'bg-warm-100 dark:bg-warm-200/50'}`}>
                <AnimatePresence mode="wait">
                  {darkMode ? (
                    <motion.div
                      key="moon-icon"
                      initial={{ rotate: -90, scale: 0, opacity: 0 }}
                      animate={{ rotate: 0, scale: 1, opacity: 1 }}
                      exit={{ rotate: 90, scale: 0, opacity: 0 }}
                      transition={{ duration: 0.3, type: 'spring', stiffness: 300 }}
                    >
                      <Moon className="w-3.5 h-3.5 text-brand-gold" />
                    </motion.div>
                  ) : (
                    <motion.div
                      key="sun-icon"
                      initial={{ rotate: 90, scale: 0, opacity: 0 }}
                      animate={{ rotate: 0, scale: 1, opacity: 1 }}
                      exit={{ rotate: -90, scale: 0, opacity: 0 }}
                      transition={{ duration: 0.3, type: 'spring', stiffness: 300 }}
                    >
                      <Sun className="w-3.5 h-3.5 text-warm-400" />
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
              <div>
                <span className="text-warm-800 dark:text-warm-100 font-medium text-xs">{t('profile.darkMode', language)}</span>
                <p className="text-[10px] text-warm-400 dark:text-warm-300">{darkMode ? 'Dark mode active' : 'Light mode active'}</p>
              </div>
            </div>
            <motion.button
              onClick={toggleDarkMode}
              className={`relative flex items-center rounded-full p-1 transition-colors duration-300 ${
                darkMode ? 'bg-warm-700' : 'bg-warm-200'
              }`}
              style={{ width: '52px', height: '28px' }}
              whileTap={{ scale: 0.95 }}
            >
              {/* Animated toggle track background */}
              <motion.div
                className="absolute inset-0 rounded-full overflow-hidden"
                style={{
                  background: darkMode
                    ? 'linear-gradient(90deg, #1E293B, #334155)'
                    : 'linear-gradient(90deg, #E2E8F0, #F1F5F9)',
                }}
                transition={{ duration: 0.3 }}
              />
              {/* Stars/moon dots in dark mode */}
              {darkMode && (
                <>
                  <motion.div
                    className="absolute top-1.5 left-2 w-1 h-1 rounded-full bg-white/30"
                    animate={{ opacity: [0.3, 0.8, 0.3] }}
                    transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
                  />
                  <motion.div
                    className="absolute top-3 left-4 w-0.5 h-0.5 rounded-full bg-white/20"
                    animate={{ opacity: [0.2, 0.6, 0.2] }}
                    transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut', delay: 0.5 }}
                  />
                </>
              )}
              {/* Sun rays in light mode */}
              {!darkMode && (
                <motion.div
                  className="absolute top-1 right-3 w-1.5 h-1.5 rounded-full bg-amber-400/20"
                  animate={{ scale: [1, 1.3, 1], opacity: [0.3, 0.6, 0.3] }}
                  transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
                />
              )}
              {/* Toggle knob */}
              <motion.div
                className="relative z-10 w-5 h-5 rounded-full shadow-md flex items-center justify-center"
                style={{
                  backgroundColor: darkMode ? '#1E293B' : '#FFFFFF',
                }}
                animate={{ x: darkMode ? 22 : 0 }}
                transition={{ type: 'spring', stiffness: 500, damping: 30 }}
              >
                <AnimatePresence mode="wait">
                  {darkMode ? (
                    <motion.div
                      key="toggle-moon"
                      initial={{ rotate: -180, scale: 0 }}
                      animate={{ rotate: 0, scale: 1 }}
                      exit={{ rotate: 180, scale: 0 }}
                      transition={{ duration: 0.2 }}
                    >
                      <Moon className="w-3 h-3 text-brand-gold" />
                    </motion.div>
                  ) : (
                    <motion.div
                      key="toggle-sun"
                      initial={{ rotate: 180, scale: 0 }}
                      animate={{ rotate: 0, scale: 1 }}
                      exit={{ rotate: -180, scale: 0 }}
                      transition={{ duration: 0.2 }}
                    >
                      <Sun className="w-3 h-3 text-amber-500" />
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            </motion.button>
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
          <h3 className="font-bold text-warm-800 dark:text-warm-100 mb-3 flex items-center gap-2">
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
                <p className="text-base font-bold text-warm-800 dark:text-warm-100">{earnings?.monthlyCount || 0}</p>
              </div>
              <div className="text-center p-2 rounded-lg bg-white/60 dark:bg-warm-100/30 border border-emerald-100 dark:border-emerald-800/20">
                <p className="text-xs text-warm-500 dark:text-warm-400">Yearly</p>
                <p className="text-base font-bold text-warm-800 dark:text-warm-100">{earnings?.yearlyCount || 0}</p>
              </div>
              <div className="text-center p-2 rounded-lg bg-white/60 dark:bg-warm-100/30 border border-emerald-100 dark:border-emerald-800/20">
                <p className="text-xs text-warm-500 dark:text-warm-400">Lifetime</p>
                <p className="text-base font-bold text-warm-800 dark:text-warm-100">{earnings?.lifetimeCount || 0}</p>
              </div>
            </div>
            <div className="mt-3 flex items-center justify-between text-xs text-warm-500 dark:text-warm-400">
              <span className="flex items-center gap-1">
                <Users className="w-3 h-3" />
                {earnings?.totalPayments || 0} premium subscribers
              </span>
              <span className="flex items-center gap-1">
                <CreditCard className="w-3 h-3" />
                Cashfree
              </span>
            </div>
          </Card>
        </motion.div>
      )}

      {/* ═══════════════════════════════════════════ */}
      {/* 10. LOGOUT BUTTON with Confirmation Dialog */}
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
            {t('profile.logout', language)}
          </Button>
        ) : (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="rounded-xl border-2 border-red-200 dark:border-red-800/40 bg-red-50 dark:bg-red-900/20 p-4 text-center"
          >
            <div className="flex items-center justify-center gap-2 mb-3">
              <motion.div
                animate={{ rotate: [0, -10, 10, -10, 0] }}
                transition={{ duration: 0.5 }}
              >
                <AlertTriangle className="w-5 h-5 text-red-500" />
              </motion.div>
              <p className="text-sm font-bold text-red-700 dark:text-red-400">Confirm Logout</p>
            </div>
            <p className="text-xs text-warm-500 dark:text-warm-400 mb-4">Are you sure you want to log out of your account?</p>
            <div className="flex gap-3">
              <Button
                variant="outline"
                onClick={() => setShowLogoutConfirm(false)}
                className="flex-1 rounded-xl border-warm-300 dark:border-warm-200 h-9 text-xs"
              >
                {t('common.cancel', language)}
              </Button>
              <Button
                onClick={() => {
                  logout();
                  toast({ title: 'Logged out successfully' });
                }}
                className="flex-1 rounded-xl bg-brand-red hover:bg-brand-red-dark text-white h-9 text-xs"
              >
                <LogOut className="w-3.5 h-3.5 mr-1.5" />
                {t('profile.logout', language)}
              </Button>
            </div>
          </motion.div>
        )}
      </motion.div>

      {/* ═══════════════════════════════════════════ */}
      {/* 10b. DELETE ACCOUNT BUTTON */}
      {/* ═══════════════════════════════════════════ */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.35 }}
      >
        <Button
          variant="outline"
          onClick={() => { setShowDeleteAccount(true); setDeleteConfirmText(''); setDeleteAccountError(''); }}
          className="w-full rounded-xl border-red-200 dark:border-red-800/40 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 hover:text-red-600 h-11 gap-2 text-xs"
        >
          <Trash2 className="w-4 h-4" />
          {t('profile.deleteAccount', language)}
        </Button>
      </motion.div>

      {/* ═══════════════════════════════════════════ */}
      {/* 11. CHANGE PHONE NUMBER DIALOG */}
      {/* ═══════════════════════════════════════════ */}
      <Dialog open={showPhoneEdit} onOpenChange={(open) => { setShowPhoneEdit(open); if (!open) { setNewPhone(''); setPhoneEditError(''); } }}>
        <DialogContent className="bg-warm-50 dark:bg-warm-100 border-warm-300 max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-warm-800 dark:text-warm-800 flex items-center gap-2">
              <Phone className="w-4 h-4 text-brand-teal" />
              {t('profile.changePhone', language)}
            </DialogTitle>
            <DialogDescription className="text-warm-500 dark:text-warm-400 text-xs">
              Update your registered phone number used for login
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            {/* Current Phone */}
            <div className="bg-warm-100 dark:bg-warm-200/50 rounded-xl p-3">
              <p className="text-[10px] text-warm-400 dark:text-warm-300 uppercase tracking-wider font-semibold mb-1">
                {t('profile.currentPhone', language)}
              </p>
              <p className="text-warm-800 dark:text-warm-100 font-mono text-sm font-medium">
                {currentUser?.phone || '—'}
              </p>
            </div>

            {/* New Phone Input */}
            <div>
              <label className="text-sm font-semibold text-warm-700 dark:text-warm-600 mb-2 block">
                {t('profile.newPhone', language)}
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-warm-400 text-sm font-medium pointer-events-none">
                  +91
                </span>
                <Input
                  type="tel"
                  placeholder="Enter 10-digit number"
                  value={newPhone}
                  onChange={(e) => {
                    const val = e.target.value.replace(/\D/g, '').slice(0, 10);
                    setNewPhone(val);
                    if (phoneEditError) setPhoneEditError('');
                  }}
                  className="bg-white dark:bg-warm-50 border-warm-300 rounded-xl pl-12 font-mono"
                  maxLength={10}
                  autoFocus
                />
              </div>
              {newPhone && newPhone.length < 10 && (
                <p className="text-[10px] text-warm-400 mt-1">{10 - newPhone.length} more digit{10 - newPhone.length !== 1 ? 's' : ''} needed</p>
              )}
              {newPhone && newPhone.length === 10 && (
                <p className="text-[10px] text-brand-teal mt-1 flex items-center gap-1">
                  <Check className="w-3 h-3" /> Valid number
                </p>
              )}
            </div>

            {/* Error Message */}
            {phoneEditError && (
              <motion.div
                initial={{ opacity: 0, y: -5 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex items-center gap-2 text-xs text-red-500 bg-red-50 dark:bg-red-900/20 p-2.5 rounded-lg"
              >
                <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />
                {phoneEditError}
              </motion.div>
            )}

            {/* Warning Note */}
            <div className="flex items-start gap-2 text-[10px] text-warm-400 dark:text-warm-300 bg-amber-50 dark:bg-amber-900/10 p-2.5 rounded-lg">
              <AlertTriangle className="w-3 h-3 flex-shrink-0 mt-0.5 text-amber-500" />
              <span>You will use the new phone number for login. Make sure you have access to this number.</span>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-3 pt-1">
              <Button
                variant="outline"
                onClick={() => { setShowPhoneEdit(false); setNewPhone(''); setPhoneEditError(''); }}
                className="flex-1 rounded-xl border-warm-300 dark:border-warm-200 h-10 text-xs"
              >
                {t('common.cancel', language)}
              </Button>
              <Button
                onClick={handleChangePhone}
                disabled={phoneEditLoading || newPhone.length !== 10}
                className="flex-1 rounded-xl bg-brand-teal hover:bg-brand-teal-dark text-white h-10 text-xs disabled:opacity-50"
              >
                {phoneEditLoading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <>
                    <Phone className="w-3.5 h-3.5 mr-1.5" />
                    {t('profile.updatePhone', language)}
                  </>
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ═══════════════════════════════════════════ */}
      {/* 12. DELETE ACCOUNT DIALOG */}
      {/* ═══════════════════════════════════════════ */}
      <Dialog open={showDeleteAccount} onOpenChange={(open) => { setShowDeleteAccount(open); if (!open) { setDeleteConfirmText(''); setDeleteAccountError(''); } }}>
        <DialogContent className="bg-warm-50 dark:bg-warm-100 border-warm-300 max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-red-600 dark:text-red-500 flex items-center gap-2">
              <Trash2 className="w-4 h-4" />
              {t('profile.deleteAccountTitle', language)}
            </DialogTitle>
            <DialogDescription className="text-warm-500 dark:text-warm-400 text-xs">
              {t('profile.deleteAccountWarning', language)}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            {/* User info */}
            <div className="bg-warm-100 dark:bg-warm-200/50 rounded-xl p-3 flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-brand-red/10 flex items-center justify-center text-lg overflow-hidden border-2 border-red-200">
                {currentUser?.avatar ? (
                  <img src={currentUser.avatar} alt="Avatar" className="w-full h-full object-cover" />
                ) : (
                  <span>{currentUser?.gender === 'female' ? '👩' : '👨'}</span>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-warm-800 dark:text-warm-100 text-sm font-semibold truncate">{currentUser?.name || 'Player'}</p>
                <p className="text-warm-400 text-[10px] font-mono">{currentUser?.phone}</p>
              </div>
            </div>

            {/* Data loss warning */}
            <div className="bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-800/30 rounded-xl p-3">
              <div className="flex items-center gap-1.5 mb-2">
                <AlertTriangle className="w-3.5 h-3.5 text-red-500" />
                <p className="text-xs font-semibold text-red-600 dark:text-red-400">{t('profile.deleteAccountDataLoss', language)}</p>
              </div>
              <ul className="text-[10px] text-red-500/80 dark:text-red-400/80 space-y-1 ml-5">
                {t('profile.deleteAccountDataItems', language).split(', ').map((item, i) => (
                  <li key={i} className="flex items-start gap-1.5">
                    <span className="text-red-400 mt-0.5">•</span>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Confirmation input */}
            <div>
              <label className="text-xs font-semibold text-warm-700 dark:text-warm-600 mb-2 block">
                {t('profile.deleteAccountConfirm', language)}
              </label>
              <Input
                type="text"
                placeholder="DELETE"
                value={deleteConfirmText}
                onChange={(e) => {
                  setDeleteConfirmText(e.target.value);
                  if (deleteAccountError) setDeleteAccountError('');
                }}
                className="bg-white dark:bg-warm-50 border-warm-300 rounded-xl font-mono text-center text-sm tracking-widest uppercase"
                autoFocus
              />
              {deleteConfirmText && deleteConfirmText !== 'DELETE' && (
                <p className="text-[10px] text-red-500 mt-1">Type DELETE exactly to confirm</p>
              )}
              {deleteConfirmText === 'DELETE' && (
                <p className="text-[10px] text-red-600 mt-1 flex items-center gap-1">
                  <AlertTriangle className="w-3 h-3" /> Ready to delete — this cannot be undone
                </p>
              )}
            </div>

            {/* Error Message */}
            {deleteAccountError && (
              <motion.div
                initial={{ opacity: 0, y: -5 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex items-center gap-2 text-xs text-red-500 bg-red-50 dark:bg-red-900/20 p-2.5 rounded-lg"
              >
                <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />
                {deleteAccountError}
              </motion.div>
            )}

            {/* Action Buttons */}
            <div className="flex gap-3 pt-1">
              <Button
                variant="outline"
                onClick={() => { setShowDeleteAccount(false); setDeleteConfirmText(''); setDeleteAccountError(''); }}
                className="flex-1 rounded-xl border-warm-300 dark:border-warm-200 h-10 text-xs"
              >
                {t('common.cancel', language)}
              </Button>
              <Button
                onClick={handleDeleteAccount}
                disabled={deleteAccountLoading || deleteConfirmText !== 'DELETE'}
                className="flex-1 rounded-xl bg-red-600 hover:bg-red-700 text-white h-10 text-xs disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {deleteAccountLoading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <>
                    <Trash2 className="w-3.5 h-3.5 mr-1.5" />
                    {t('profile.deleteAccountConfirmBtn', language)}
                  </>
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
