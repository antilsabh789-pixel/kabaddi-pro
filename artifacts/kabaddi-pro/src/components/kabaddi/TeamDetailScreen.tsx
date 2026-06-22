'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Users,
  Plus,
  X,
  Search,
  Crown,
  Shield,
  ChevronLeft,
  Trash2,
  Hash,
  LogOut,
  Copy,
  Check,
  Share2,
  Trophy,
  Target,
  TrendingUp,
  UserMinus,
  ArrowLeftRight,
  Swords,
  Pencil,
  Image as ImageIcon,
  Loader2,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { useKabaddiStore } from '@/lib/store';
import { useToast } from '@/hooks/use-toast';

// ─── Types ────────────────────────────────────────────────────────

interface TeamMemberUser {
  id: string;
  name: string | null;
  phone: string;
  avatar: string | null;
  profile?: {
    position?: string | null;
    overallRating?: number;
    jerseyNumber?: number;
  } | null;
}

interface TeamMemberEntry {
  id: string;
  teamId: string;
  userId: string;
  isCaptain: boolean;
  user: TeamMemberUser;
}

interface TeamData {
  id: string;
  name: string;
  shortName: string | null;
  teamCode: string | null;
  color: string | null;
  logo: string | null;
  createdAt: string;
  updatedAt: string;
  members: TeamMemberEntry[];
}

interface TeamStats {
  totalMatches: number;
  wins: number;
  losses: number;
  totalPoints: number;
}

interface RecentMatch {
  id: string;
  homeTeamId: string;
  awayTeamId: string;
  homeScore: number;
  awayScore: number;
  status: string;
  completedAt: string | null;
  homeTeam: { id: string; name: string; shortName: string | null; color: string | null };
  awayTeam: { id: string; name: string; shortName: string | null; color: string | null };
}

interface PlayerSearchResult {
  id: string;
  name: string | null;
  phone: string;
  avatar: string | null;
  profile?: {
    position?: string | null;
    overallRating?: number;
  } | null;
}

interface TeamDetailScreenProps {
  teamId: string;
  onBack: () => void;
  onClose: () => void;
}

// ─── Helpers ──────────────────────────────────────────────────────

function getInitials(name: string | null | undefined): string {
  if (!name) return '?';
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
  return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
}

function getDisplayName(name: string | null | undefined): string {
  return name?.trim() || 'Unnamed Player';
}

function hexToRgb(hex: string | null): string {
  if (!hex) return '220, 38, 38';
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!result) return '220, 38, 38';
  return `${parseInt(result[1], 16)}, ${parseInt(result[2], 16)}, ${parseInt(result[3], 16)}`;
}

// ─── Warrior Images ────────────────────────────────────────────────

const WARRIOR_IMAGES = [
  { id: 'warrior-1', name: 'Lion Warrior', src: '/warriors/warrior_1.png' },
  { id: 'warrior-2', name: 'Eagle Warrior', src: '/warriors/warrior_2.png' },
  { id: 'warrior-3', name: 'Tiger Warrior', src: '/warriors/warrior_3.png' },
  { id: 'warrior-4', name: 'Bull Warrior', src: '/warriors/warrior_4.png' },
  { id: 'warrior-5', name: 'Cobra Warrior', src: '/warriors/warrior_5.png' },
  { id: 'warrior-6', name: 'Panther Warrior', src: '/warriors/warrior_6.png' },
  { id: 'warrior-7', name: 'Bear Warrior', src: '/warriors/warrior_7.png' },
  { id: 'warrior-8', name: 'Wolf Warrior', src: '/warriors/warrior_8.png' },
  { id: 'warrior-9', name: 'Hawk Warrior', src: '/warriors/warrior_9.png' },
  { id: 'warrior-10', name: 'Rhino Warrior', src: '/warriors/warrior_10.png' },
  { id: 'warrior-11', name: 'Dragon Warrior', src: '/warriors/warrior_11.png' },
  { id: 'warrior-12', name: 'Phoenix Warrior', src: '/warriors/warrior_12.png' },
];

function getTeamAvatar(logo: string | null): string | null {
  if (!logo) return null;
  const warrior = WARRIOR_IMAGES.find(w => w.id === logo);
  if (warrior) return warrior.src;
  return logo;
}

// ─── Component ────────────────────────────────────────────────────

export default function TeamDetailScreen({ teamId, onBack, onClose }: TeamDetailScreenProps) {
  const currentUser = useKabaddiStore((s) => s.currentUser);
  const { toast } = useToast();

  // Data state
  const [team, setTeam] = useState<TeamData | null>(null);
  const [teamStats, setTeamStats] = useState<TeamStats>({
    totalMatches: 0,
    wins: 0,
    losses: 0,
    totalPoints: 0,
  });
  const [recentMatches, setRecentMatches] = useState<RecentMatch[]>([]);

  // Loading states
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);

  // Dialog states
  const [searchDialogOpen, setSearchDialogOpen] = useState(false);
  const [leaveDialogOpen, setLeaveDialogOpen] = useState(false);
  const [transferCaptainDialogOpen, setTransferCaptainDialogOpen] = useState(false);
  const [transferCaptainUserId, setTransferCaptainUserId] = useState<string | null>(null);

  // Search
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<PlayerSearchResult[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);

  // Delete confirmation
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  // Copied state
  const [copiedCode, setCopiedCode] = useState(false);

  // ─── Edit team name/logo dialog ───────────────────────────────
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editName, setEditName] = useState('');
  const [editShortName, setEditShortName] = useState('');
  const [editLogo, setEditLogo] = useState<string | null>(null);
  const [editSaving, setEditSaving] = useState(false);
  const [logoUploading, setLogoUploading] = useState(false);

  // ─── Fetch team detail ────────────────────────────────────────

  const fetchTeamDetail = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/teams/${teamId}`);
      if (!res.ok) throw new Error('Failed to fetch team detail');
      const data = await res.json();
      setTeam(data.team);
      setTeamStats(data.stats || { totalMatches: 0, wins: 0, losses: 0, totalPoints: 0 });
      setRecentMatches(data.recentMatches || []);
    } catch (err) {
      console.error('Fetch team detail error:', err);
      toast({
        title: 'Error',
        description: 'Failed to load team details',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }, [teamId, toast]);

  useEffect(() => {
    fetchTeamDetail();
  }, [fetchTeamDetail]);

  // ─── Search players ──────────────────────────────────────────

  const searchPlayers = useCallback(async (query: string) => {
    if (!query.trim()) {
      setSearchResults([]);
      return;
    }
    setSearchLoading(true);
    try {
      const res = await fetch(`/api/players?search=${encodeURIComponent(query)}`);
      if (!res.ok) throw new Error('Search failed');
      const data = await res.json();
      setSearchResults(data.players || []);
    } catch (err) {
      console.error('Search players error:', err);
      setSearchResults([]);
    } finally {
      setSearchLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!searchDialogOpen) return;
    const timer = setTimeout(() => {
      searchPlayers(searchQuery);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery, searchDialogOpen, searchPlayers]);

  // ─── Computed values ──────────────────────────────────────────

  const isCurrentUserCaptain = team?.members.some(
    (m) => m.userId === currentUser?.id && m.isCaptain
  ) ?? false;

  const isCurrentUserMember = team?.members.some(
    (m) => m.userId === currentUser?.id
  ) ?? false;

  const captainMember = team?.members.find((m) => m.isCaptain);

  const isPlayerInTeam = (playerId: string): boolean => {
    if (!team) return false;
    return team.members.some((m) => m.userId === playerId);
  };

  // ─── Actions ──────────────────────────────────────────────────

  const handleAddPlayer = async (playerId: string, playerName: string) => {
    if (!team) return;
    setActionLoading(true);
    try {
      const res = await fetch(`/api/teams/${team.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          captainUserId: currentUser?.id,
          addMemberId: playerId,
        }),
      });
      if (!res.ok) throw new Error('Failed to add player');
      toast({
        title: 'Player Added',
        description: `${playerName} has been added to the team.`,
      });
      setSearchDialogOpen(false);
      setSearchQuery('');
      setSearchResults([]);
      fetchTeamDetail();
    } catch (err) {
      console.error('Add player error:', err);
      toast({
        title: 'Error',
        description: 'Failed to add player to team',
        variant: 'destructive',
      });
    } finally {
      setActionLoading(false);
    }
  };

  const handleRemovePlayer = async (userId: string, playerName: string) => {
    if (!team) return;
    setActionLoading(true);
    try {
      const res = await fetch(`/api/teams/${team.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          captainUserId: currentUser?.id,
          removeMemberId: userId,
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to remove player');
      }
      toast({
        title: 'Player Removed',
        description: `${playerName} has been removed from the team.`,
      });
      setDeleteConfirmId(null);
      fetchTeamDetail();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to remove player';
      console.error('Remove player error:', err);
      toast({
        title: 'Error',
        description: message,
        variant: 'destructive',
      });
    } finally {
      setActionLoading(false);
    }
  };

  const handleTransferCaptain = async (userId: string, playerName: string) => {
    if (!team) return;
    setActionLoading(true);
    try {
      const res = await fetch(`/api/teams/${team.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          captainUserId: currentUser?.id,
          captainId: userId,
        }),
      });
      if (!res.ok) throw new Error('Failed to transfer captaincy');
      toast({
        title: 'Captain Transferred',
        description: `${playerName} is now the captain.`,
      });
      setTransferCaptainDialogOpen(false);
      setTransferCaptainUserId(null);
      fetchTeamDetail();
    } catch (err) {
      console.error('Transfer captain error:', err);
      toast({
        title: 'Error',
        description: 'Failed to transfer captaincy',
        variant: 'destructive',
      });
    } finally {
      setActionLoading(false);
    }
  };

  // ─── Edit team name / logo ─────────────────────────────────────

  const openEditDialog = () => {
    if (!team) return;
    setEditName(team.name);
    setEditShortName(team.shortName || '');
    setEditLogo(team.logo || null);
    setEditDialogOpen(true);
  };

  const handleLogoUpload = async (file: File) => {
    if (!currentUser) return;
    setLogoUploading(true);
    try {
      const reader = new FileReader();
      reader.onload = async (e) => {
        const fileData = e.target?.result as string;
        try {
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
          if (!res.ok) throw new Error('Upload failed');
          const data = await res.json();
          if (data.url) {
            setEditLogo(data.url);
          }
        } catch (err) {
          console.error('Logo upload error:', err);
          toast({
            title: 'Upload Failed',
            description: 'Could not upload image. Try a smaller file.',
            variant: 'destructive',
          });
        } finally {
          setLogoUploading(false);
        }
      };
      reader.readAsDataURL(file);
    } catch (err) {
      console.error('Logo upload error:', err);
      setLogoUploading(false);
      toast({
        title: 'Upload Failed',
        description: 'Could not read image file.',
        variant: 'destructive',
      });
    }
  };

  const handleSaveEdit = async () => {
    if (!team || !currentUser) return;
    if (!editName.trim() || editName.trim().length < 3) {
      toast({
        title: 'Name too short',
        description: 'Team name must be at least 3 characters.',
        variant: 'destructive',
      });
      return;
    }
    setEditSaving(true);
    try {
      const body: Record<string, unknown> = {
        captainUserId: currentUser.id,
        name: editName.trim(),
        logo: editLogo, // can be null to clear, or a URL/data-URL string
      };
      if (editShortName.trim()) {
        body.shortName = editShortName.trim().slice(0, 4).toUpperCase();
      }
      const res = await fetch(`/api/teams/${team.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to update team');
      }
      toast({
        title: 'Team Updated',
        description: 'Team details have been saved.',
      });
      setEditDialogOpen(false);
      fetchTeamDetail();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to update team';
      console.error('Team edit error:', err);
      toast({
        title: 'Error',
        description: message,
        variant: 'destructive',
      });
    } finally {
      setEditSaving(false);
    }
  };

  const handleLeaveTeam = async () => {
    if (!team || !currentUser) return;
    setActionLoading(true);
    try {
      const res = await fetch('/api/teams/leave', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ teamId: team.id, userId: currentUser.id }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to leave team');
      }
      const data = await res.json();
      toast({
        title: 'Left Team',
        description: data.teamDeleted
          ? 'You left the team. Since you were the last member, the team was deleted.'
          : `You've left ${team.name}.`,
      });
      setLeaveDialogOpen(false);
      onBack();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to leave team';
      console.error('Leave team error:', err);
      toast({
        title: 'Error',
        description: message,
        variant: 'destructive',
      });
    } finally {
      setActionLoading(false);
    }
  };

  const handleDeleteTeam = async () => {
    if (!team) return;
    setActionLoading(true);
    try {
      const res = await fetch(`/api/teams/${team.id}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ captainUserId: currentUser?.id }),
      });
      if (!res.ok) throw new Error('Failed to delete team');
      toast({
        title: 'Team Deleted',
        description: `${team.name} has been deleted.`,
      });
      onBack();
    } catch (err) {
      console.error('Delete team error:', err);
      toast({
        title: 'Error',
        description: 'Failed to delete team',
        variant: 'destructive',
      });
    } finally {
      setActionLoading(false);
    }
  };

  const copyTeamCode = () => {
    if (!team?.teamCode) return;
    navigator.clipboard.writeText(team.teamCode);
    setCopiedCode(true);
    toast({ title: 'Copied!', description: `Team code ${team.teamCode} copied to clipboard` });
    setTimeout(() => setCopiedCode(false), 2000);
  };

  const shareTeamCode = () => {
    if (!team?.teamCode) return;
    const shareText = `Join my Kabaddi Pro team "${team.name}"! Use code: ${team.teamCode}`;
    if (navigator.share) {
      navigator.share({
        title: `Join ${team.name}`,
        text: shareText,
      }).catch(() => {
        copyTeamCode();
      });
    } else {
      copyTeamCode();
    }
  };

  // ─── Render ──────────────────────────────────────────────────

  if (loading) {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 bg-warm-50 dark:bg-warm-800 flex flex-col"
      >
        <header className="sticky top-0 z-10 bg-warm-50/90 dark:bg-warm-800/90 backdrop-blur-md border-b border-warm-200/60 dark:border-warm-700/60">
          <div className="px-4 py-3 flex items-center gap-2">
            <button
              onClick={onBack}
              className="w-8 h-8 rounded-full bg-warm-200 dark:bg-warm-700 flex items-center justify-center text-warm-600 dark:text-warm-300"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <h1 className="text-base font-black tracking-wider text-warm-800 dark:text-warm-100">
              LOADING...
            </h1>
          </div>
        </header>
        <div className="flex-1 px-4 py-4 space-y-3">
          <div className="h-40 rounded-2xl bg-warm-100 dark:bg-warm-700 animate-pulse" />
          <div className="grid grid-cols-4 gap-2">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-16 rounded-xl bg-warm-100 dark:bg-warm-700 animate-pulse" />
            ))}
          </div>
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-16 rounded-xl bg-warm-100 dark:bg-warm-700 animate-pulse" />
          ))}
        </div>
      </motion.div>
    );
  }

  if (!team) {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 bg-warm-50 dark:bg-warm-800 flex flex-col"
      >
        <header className="sticky top-0 z-10 bg-warm-50/90 dark:bg-warm-800/90 backdrop-blur-md border-b border-warm-200/60 dark:border-warm-700/60">
          <div className="px-4 py-3 flex items-center gap-2">
            <button
              onClick={onBack}
              className="w-8 h-8 rounded-full bg-warm-200 dark:bg-warm-700 flex items-center justify-center text-warm-600 dark:text-warm-300"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <h1 className="text-base font-black tracking-wider text-warm-800 dark:text-warm-100">
              TEAM NOT FOUND
            </h1>
            <div className="ml-auto">
              <button
                onClick={onClose}
                className="w-8 h-8 rounded-full bg-warm-200 dark:bg-warm-700 flex items-center justify-center text-warm-600 dark:text-warm-300"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        </header>
        <div className="flex-1 flex flex-col items-center justify-center">
          <Shield className="w-12 h-12 text-warm-300 dark:text-warm-600 mb-3" />
          <p className="text-warm-500 dark:text-warm-400 text-sm">Team not found</p>
        </div>
      </motion.div>
    );
  }

  const teamColor = team.color || '#DC2626';
  const teamColorRgb = hexToRgb(teamColor);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 bg-warm-50 dark:bg-warm-800 flex flex-col"
    >
      {/* ═══ Header ═══ */}
      <header
        className="sticky top-0 z-10 backdrop-blur-md border-b"
        style={{
          background: `linear-gradient(135deg, rgba(${teamColorRgb}, 0.95), rgba(${teamColorRgb}, 0.85))`,
          borderBottomColor: `rgba(${teamColorRgb}, 0.3)`,
        }}
      >
        <div className="px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <button
              onClick={onBack}
              className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center text-white hover:bg-white/30 transition-colors"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <h1 className="text-base font-black tracking-wider text-white">
              {team.name.toUpperCase()}
            </h1>
          </div>
          <div className="flex items-center gap-2">
            {isCurrentUserCaptain && (
              <button
                onClick={openEditDialog}
                disabled={actionLoading}
                className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center text-white hover:bg-white/40 transition-colors"
                title="Edit Team Name / Logo"
              >
                <Pencil className="w-4 h-4" />
              </button>
            )}
            {isCurrentUserCaptain && (
              <button
                onClick={handleDeleteTeam}
                disabled={actionLoading}
                className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center text-white hover:bg-red-500/60 transition-colors"
                title="Delete Team"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            )}
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center text-white hover:bg-white/30 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      {/* ═══ Content ═══ */}
      <div className="flex-1 overflow-y-auto custom-scrollbar">
        <div className="px-4 py-4 space-y-4">
          {/* ─── Team Header Card ─── */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.05 }}
          >
            <Card
              className="border-warm-200 dark:border-warm-600 py-0 gap-0 overflow-hidden"
              style={{ borderLeftWidth: '4px', borderLeftColor: teamColor }}
            >
              <CardContent className="p-5">
                <div className="flex items-center gap-4">
                  {getTeamAvatar(team.logo) ? (
                    <div className="w-16 h-16 rounded-2xl overflow-hidden shrink-0 shadow-lg border-2 border-white/20">
                      <img src={getTeamAvatar(team.logo)!} alt={team.name} className="w-full h-full object-cover" />
                    </div>
                  ) : (
                    <div
                      className="w-16 h-16 rounded-2xl flex items-center justify-center text-white font-black text-xl shrink-0 shadow-lg"
                      style={{ backgroundColor: teamColor }}
                    >
                      {team.shortName
                        ? team.shortName.slice(0, 3)
                        : team.name.charAt(0).toUpperCase()}
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <h2 className="text-xl font-black text-warm-800 dark:text-warm-100 truncate">
                      {team.name}
                    </h2>
                    <div className="flex items-center gap-2 mt-1 flex-wrap">
                      {team.shortName && (
                        <Badge
                          variant="secondary"
                          className="text-xs px-2 py-0.5 bg-warm-100 dark:bg-warm-600 text-warm-600 dark:text-warm-300"
                        >
                          {team.shortName}
                        </Badge>
                      )}
                      <div
                        className="w-4 h-4 rounded-full border-2 border-warm-200 dark:border-warm-500 shrink-0"
                        style={{ backgroundColor: teamColor }}
                      />
                      {team.teamCode && (
                        <button
                          onClick={copyTeamCode}
                          className="flex items-center gap-1 text-xs text-warm-500 dark:text-warm-400 font-mono hover:text-brand-teal transition-colors"
                        >
                          {copiedCode ? (
                            <Check className="w-3 h-3 text-brand-teal" />
                          ) : (
                            <Copy className="w-3 h-3" />
                          )}
                          {team.teamCode}
                        </button>
                      )}
                    </div>
                  </div>
                  <motion.div
                    className="flex flex-col items-center shrink-0"
                    whileTap={{ scale: 0.9 }}
                  >
                    <Badge
                      className="bg-brand-teal/10 text-brand-teal border-brand-teal/20 text-sm px-3 py-1"
                    >
                      <Users className="w-3.5 h-3.5 mr-1" />
                      {team.members.length}
                    </Badge>
                  </motion.div>
                </div>

                {/* Action buttons row */}
                <div className="flex gap-2 mt-4">
                  {team.teamCode && (
                    <Button
                      size="sm"
                      onClick={shareTeamCode}
                      className="bg-brand-teal/10 text-brand-teal hover:bg-brand-teal/20 border-brand-teal/20 rounded-xl h-8 px-3 text-xs font-semibold"
                      variant="outline"
                    >
                      <Share2 className="w-3.5 h-3.5 mr-1" />
                      Invite
                    </Button>
                  )}
                  {isCurrentUserCaptain && (
                    <Button
                      size="sm"
                      onClick={() => setSearchDialogOpen(true)}
                      className="bg-brand-teal hover:bg-brand-teal-dark text-white rounded-xl h-8 px-3 text-xs font-semibold"
                    >
                      <Plus className="w-3.5 h-3.5 mr-1" />
                      Add Player
                    </Button>
                  )}
                  {isCurrentUserMember && !isCurrentUserCaptain && (
                    <Button
                      size="sm"
                      onClick={() => setLeaveDialogOpen(true)}
                      variant="outline"
                      className="border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-xl h-8 px-3 text-xs font-semibold"
                    >
                      <LogOut className="w-3.5 h-3.5 mr-1" />
                      Leave
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          </motion.div>

          {/* ─── Stats Row ─── */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="grid grid-cols-4 gap-2"
          >
            {[
              {
                label: 'Matches',
                value: teamStats.totalMatches,
                icon: Swords,
                color: 'text-warm-800 dark:text-warm-100',
                bg: 'bg-warm-50 dark:bg-warm-700',
              },
              {
                label: 'Wins',
                value: teamStats.wins,
                icon: Trophy,
                color: 'text-brand-teal',
                bg: 'bg-brand-teal/5 dark:bg-brand-teal/10',
              },
              {
                label: 'Losses',
                value: teamStats.losses,
                icon: Target,
                color: 'text-brand-red',
                bg: 'bg-brand-red/5 dark:bg-brand-red/10',
              },
              {
                label: 'Points',
                value: teamStats.totalPoints,
                icon: TrendingUp,
                color: 'text-brand-gold',
                bg: 'bg-brand-gold/5 dark:bg-brand-gold/10',
              },
            ].map((stat) => (
              <Card
                key={stat.label}
                className={`${stat.bg} border-warm-200 dark:border-warm-600 py-0 gap-0`}
              >
                <CardContent className="p-3 text-center">
                  <p className={`text-lg font-black ${stat.color}`}>
                    {stat.value}
                  </p>
                  <p className="text-[10px] text-warm-500 dark:text-warm-400 font-medium uppercase tracking-wide">
                    {stat.label}
                  </p>
                </CardContent>
              </Card>
            ))}
          </motion.div>

          {/* ─── Members Header ─── */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 }}
            className="flex items-center justify-between"
          >
            <h3 className="font-bold text-warm-800 dark:text-warm-100 flex items-center gap-2">
              <Users className="w-4 h-4 text-brand-teal" />
              Members ({team.members.length})
            </h3>
            {isCurrentUserCaptain && (
              <Button
                size="sm"
                onClick={() => setSearchDialogOpen(true)}
                className="bg-brand-teal hover:bg-brand-teal-dark text-white rounded-xl h-8 px-3 text-xs font-semibold"
              >
                <Plus className="w-3.5 h-3.5 mr-1" />
                Add
              </Button>
            )}
          </motion.div>

          {/* ─── Member List ─── */}
          <div className="space-y-2">
            {team.members.length === 0 ? (
              <div className="text-center py-8">
                <Users className="w-10 h-10 text-warm-300 dark:text-warm-600 mx-auto mb-2" />
                <p className="text-warm-500 dark:text-warm-400 text-sm">
                  No members yet
                </p>
              </div>
            ) : (
              team.members.map((member, index) => {
                const canManage =
                  isCurrentUserCaptain || currentUser?.isAdmin;

                return (
                  <motion.div
                    key={member.id}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.15 + index * 0.04 }}
                  >
                    <Card
                      className="bg-white dark:bg-warm-700 border-warm-200 dark:border-warm-600 py-0 gap-0 overflow-hidden"
                      style={{
                        borderLeftWidth: '3px',
                        borderLeftColor: member.isCaptain ? teamColor : 'transparent',
                      }}
                    >
                      <CardContent className="p-3">
                        <div className="flex items-center gap-3">
                          {/* Avatar */}
                          <div className="relative shrink-0">
                            <div
                              className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-sm"
                              style={{
                                backgroundColor: teamColor,
                              }}
                            >
                              {member.user.avatar ? (
                                <img
                                  src={member.user.avatar}
                                  alt={getDisplayName(member.user.name)}
                                  className="w-full h-full rounded-full object-cover"
                                />
                              ) : (
                                getInitials(member.user.name)
                              )}
                            </div>
                            {member.isCaptain && (
                              <motion.div
                                initial={{ scale: 0 }}
                                animate={{ scale: 1 }}
                                className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-brand-gold flex items-center justify-center shadow-sm"
                              >
                                <Crown className="w-3 h-3 text-white" />
                              </motion.div>
                            )}
                          </div>

                          {/* Name & Info */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="font-semibold text-sm text-warm-800 dark:text-warm-100 truncate">
                                {getDisplayName(member.user.name)}
                              </span>
                              {member.isCaptain && (
                                <Badge className="bg-brand-gold/10 text-brand-gold-dark border-brand-gold/20 text-[10px] px-1.5 py-0">
                                  CAPTAIN
                                </Badge>
                              )}
                              {member.userId === currentUser?.id && (
                                <Badge
                                  variant="secondary"
                                  className="text-[10px] px-1.5 py-0 bg-brand-teal/10 text-brand-teal"
                                >
                                  YOU
                                </Badge>
                              )}
                            </div>
                            <p className="text-xs text-warm-500 dark:text-warm-400">
                              {member.user.phone}
                              {member.user.profile?.position &&
                                ` · ${member.user.profile.position}`}
                              {member.user.profile?.jerseyNumber &&
                                ` · #${member.user.profile.jerseyNumber}`}
                            </p>
                          </div>

                          {/* Actions */}
                          {canManage && member.userId !== currentUser?.id && (
                            <div className="flex items-center gap-1 shrink-0">
                              {!member.isCaptain && (
                                <button
                                  onClick={() => {
                                    setTransferCaptainUserId(member.userId);
                                    setTransferCaptainDialogOpen(true);
                                  }}
                                  disabled={actionLoading}
                                  className="w-7 h-7 rounded-lg bg-brand-gold/10 flex items-center justify-center text-brand-gold hover:bg-brand-gold/20 transition-colors"
                                  title="Transfer Captain"
                                >
                                  <Crown className="w-3.5 h-3.5" />
                                </button>
                              )}
                              <button
                                onClick={() => setDeleteConfirmId(member.userId)}
                                disabled={actionLoading}
                                className="w-7 h-7 rounded-lg bg-red-50 dark:bg-red-900/20 flex items-center justify-center text-warm-400 hover:bg-red-100 dark:hover:bg-red-900/40 hover:text-brand-red transition-colors"
                                title="Remove Player"
                              >
                                <UserMinus className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          )}
                        </div>

                        {/* Delete confirmation inline */}
                        <AnimatePresence>
                          {deleteConfirmId === member.userId && (
                            <motion.div
                              initial={{ height: 0, opacity: 0 }}
                              animate={{ height: 'auto', opacity: 1 }}
                              exit={{ height: 0, opacity: 0 }}
                              transition={{ duration: 0.2 }}
                              className="overflow-hidden"
                            >
                              <div className="mt-2 pt-2 border-t border-warm-200 dark:border-warm-600 flex items-center justify-between">
                                <span className="text-xs text-warm-600 dark:text-warm-300">
                                  Remove{' '}
                                  <strong>
                                    {getDisplayName(member.user.name)}
                                  </strong>
                                  ?
                                </span>
                                <div className="flex gap-2">
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="h-7 text-xs rounded-lg border-warm-300 dark:border-warm-500"
                                    onClick={() => setDeleteConfirmId(null)}
                                  >
                                    Cancel
                                  </Button>
                                  <Button
                                    size="sm"
                                    className="h-7 text-xs rounded-lg bg-brand-red hover:bg-brand-red-dark text-white"
                                    onClick={() =>
                                      handleRemovePlayer(
                                        member.userId,
                                        getDisplayName(member.user.name)
                                      )
                                    }
                                    disabled={actionLoading}
                                  >
                                    Remove
                                  </Button>
                                </div>
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </CardContent>
                    </Card>
                  </motion.div>
                );
              })
            )}
          </div>

          {/* ─── Recent Matches ─── */}
          {recentMatches.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.25 }}
            >
              <h3 className="font-bold text-warm-800 dark:text-warm-100 flex items-center gap-2 mb-3">
                <Swords className="w-4 h-4 text-brand-red" />
                Recent Matches
              </h3>
              <div className="space-y-2">
                {recentMatches.map((match, index) => {
                  const isHome = match.homeTeamId === teamId;
                  const teamScore = isHome ? match.homeScore : match.awayScore;
                  const opponentScore = isHome ? match.awayScore : match.homeScore;
                  const isWin = teamScore > opponentScore;
                  const isLoss = teamScore < opponentScore;
                  const opponent = isHome ? match.awayTeam : match.homeTeam;

                  return (
                    <motion.div
                      key={match.id}
                      initial={{ opacity: 0, x: -12 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.25 + index * 0.04 }}
                    >
                      <Card className="bg-white dark:bg-warm-700 border-warm-200 dark:border-warm-600 py-0 gap-0 overflow-hidden">
                        <CardContent className="p-3">
                          <div className="flex items-center gap-3">
                            {/* Result badge */}
                            <div
                              className={`w-8 h-8 rounded-lg flex items-center justify-center text-white font-bold text-xs shrink-0 ${
                                isWin
                                  ? 'bg-brand-teal'
                                  : isLoss
                                  ? 'bg-brand-red'
                                  : 'bg-warm-400'
                              }`}
                            >
                              {isWin ? 'W' : isLoss ? 'L' : 'D'}
                            </div>

                            {/* Match info */}
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-semibold text-warm-800 dark:text-warm-100 truncate">
                                vs {opponent.name}
                              </p>
                              <p className="text-xs text-warm-500 dark:text-warm-400">
                                {match.completedAt
                                  ? new Date(match.completedAt).toLocaleDateString()
                                  : 'Completed'}
                              </p>
                            </div>

                            {/* Score */}
                            <div className="text-right shrink-0">
                              <p className="text-sm font-black text-warm-800 dark:text-warm-100">
                                {teamScore} - {opponentScore}
                              </p>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    </motion.div>
                  );
                })}
              </div>
            </motion.div>
          )}

          {/* Bottom spacing */}
          <div className="h-4" />
        </div>
      </div>

      {/* ═══ Leave Team Confirmation Dialog ═══ */}
      <Dialog open={leaveDialogOpen} onOpenChange={setLeaveDialogOpen}>
        <DialogContent className="bg-warm-50 dark:bg-warm-800 border-warm-200 dark:border-warm-600 rounded-2xl max-w-[calc(100%-2rem)] sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-warm-800 dark:text-warm-100 flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
                <LogOut className="w-3.5 h-3.5 text-brand-red" />
              </div>
              Leave Team
            </DialogTitle>
            <DialogDescription className="text-warm-500 dark:text-warm-400">
              Are you sure you want to leave &quot;{team.name}&quot;? You&apos;ll need a new invite or team code to rejoin.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-2">
            <Button
              variant="outline"
              onClick={() => setLeaveDialogOpen(false)}
              className="rounded-xl border-warm-300 dark:border-warm-600 text-warm-600 dark:text-warm-300"
            >
              Cancel
            </Button>
            <Button
              onClick={handleLeaveTeam}
              disabled={actionLoading}
              className="bg-brand-red hover:bg-brand-red-dark text-white rounded-xl font-semibold flex-1 sm:flex-none"
            >
              {actionLoading ? (
                <span className="flex items-center gap-2">
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Leaving...
                </span>
              ) : (
                <>
                  <LogOut className="w-4 h-4 mr-1.5" />
                  Leave Team
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ═══ Transfer Captain Confirmation Dialog ═══ */}
      <Dialog open={transferCaptainDialogOpen} onOpenChange={setTransferCaptainDialogOpen}>
        <DialogContent className="bg-warm-50 dark:bg-warm-800 border-warm-200 dark:border-warm-600 rounded-2xl max-w-[calc(100%-2rem)] sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-warm-800 dark:text-warm-100 flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-brand-gold/10 flex items-center justify-center">
                <Crown className="w-3.5 h-3.5 text-brand-gold" />
              </div>
              Transfer Captaincy
            </DialogTitle>
            <DialogDescription className="text-warm-500 dark:text-warm-400">
              {transferCaptainUserId
                ? `Transfer captaincy to ${getDisplayName(team.members.find((m) => m.userId === transferCaptainUserId)?.user.name)}? You will become a regular member.`
                : 'Select a new captain from the team members.'}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-2">
            <Button
              variant="outline"
              onClick={() => {
                setTransferCaptainDialogOpen(false);
                setTransferCaptainUserId(null);
              }}
              className="rounded-xl border-warm-300 dark:border-warm-600 text-warm-600 dark:text-warm-300"
            >
              Cancel
            </Button>
            <Button
              onClick={() => {
                if (transferCaptainUserId) {
                  handleTransferCaptain(
                    transferCaptainUserId,
                    getDisplayName(
                      team.members.find((m) => m.userId === transferCaptainUserId)?.user.name
                    )
                  );
                }
              }}
              disabled={actionLoading || !transferCaptainUserId}
              className="bg-brand-gold hover:bg-brand-gold-dark text-white rounded-xl font-semibold flex-1 sm:flex-none"
            >
              {actionLoading ? (
                <span className="flex items-center gap-2">
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Transferring...
                </span>
              ) : (
                <>
                  <ArrowLeftRight className="w-4 h-4 mr-1.5" />
                  Transfer
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ═══ Search Players Dialog ═══ */}
      <Dialog open={searchDialogOpen} onOpenChange={setSearchDialogOpen}>
        <DialogContent className="bg-warm-50 dark:bg-warm-800 border-warm-200 dark:border-warm-600 rounded-2xl max-w-[calc(100%-2rem)] sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-warm-800 dark:text-warm-100 flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-brand-teal flex items-center justify-center">
                <Search className="w-3.5 h-3.5 text-white" />
              </div>
              Add Player
            </DialogTitle>
            <DialogDescription className="text-warm-500 dark:text-warm-400">
              Search for players by name or phone number to add to {team.name}.
            </DialogDescription>
          </DialogHeader>

          {/* Search Input */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-warm-400" />
            <Input
              placeholder="Search by name or phone..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 h-11 bg-white dark:bg-warm-700 border-warm-300 dark:border-warm-600 rounded-xl text-warm-800 dark:text-warm-100"
              autoFocus
            />
            {searchQuery && (
              <button
                onClick={() => {
                  setSearchQuery('');
                  setSearchResults([]);
                }}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-warm-400 hover:text-warm-600"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Search Results */}
          <div className="max-h-72 overflow-y-auto custom-scrollbar space-y-2">
            {searchLoading ? (
              <div className="flex flex-col gap-2 py-4">
                {[1, 2, 3].map((i) => (
                  <div
                    key={i}
                    className="h-14 rounded-xl bg-warm-100 dark:bg-warm-700 animate-pulse"
                  />
                ))}
              </div>
            ) : searchQuery.trim() === '' ? (
              <div className="text-center py-8">
                <Search className="w-8 h-8 text-warm-300 dark:text-warm-600 mx-auto mb-2" />
                <p className="text-warm-400 dark:text-warm-500 text-sm">
                  Type to search for players
                </p>
              </div>
            ) : searchResults.length === 0 ? (
              <div className="text-center py-8">
                <Users className="w-8 h-8 text-warm-300 dark:text-warm-600 mx-auto mb-2" />
                <p className="text-warm-500 dark:text-warm-400 text-sm">No players found</p>
                <p className="text-warm-400 dark:text-warm-500 text-xs mt-1">
                  Try a different search term
                </p>
              </div>
            ) : (
              searchResults.map((player) => {
                const alreadyInTeam = isPlayerInTeam(player.id);
                return (
                  <motion.div
                    key={player.id}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                  >
                    <Card
                      className={`bg-white dark:bg-warm-700 border-warm-200 dark:border-warm-600 py-0 gap-0 overflow-hidden ${
                        alreadyInTeam
                          ? 'opacity-60'
                          : 'cursor-pointer hover:shadow-md active:scale-[0.98]'
                      } transition-all`}
                      onClick={() => {
                        if (!alreadyInTeam) {
                          handleAddPlayer(
                            player.id,
                            getDisplayName(player.name)
                          );
                        }
                      }}
                    >
                      <CardContent className="p-3">
                        <div className="flex items-center gap-3">
                          <div
                            className="w-9 h-9 rounded-full flex items-center justify-center text-white font-bold text-xs shrink-0"
                            style={{ backgroundColor: teamColor }}
                          >
                            {player.avatar ? (
                              <img
                                src={player.avatar}
                                alt={getDisplayName(player.name)}
                                className="w-full h-full rounded-full object-cover"
                              />
                            ) : (
                              getInitials(player.name)
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-semibold text-sm text-warm-800 dark:text-warm-100 truncate">
                              {getDisplayName(player.name)}
                            </p>
                            <p className="text-xs text-warm-500 dark:text-warm-400">
                              {player.phone}
                              {player.profile?.position &&
                                ` · ${player.profile.position}`}
                            </p>
                          </div>
                          {alreadyInTeam ? (
                            <Badge
                              variant="secondary"
                              className="text-[10px] px-2 py-0.5 bg-brand-teal/10 text-brand-teal shrink-0"
                            >
                              IN TEAM
                            </Badge>
                          ) : (
                            <div className="w-7 h-7 rounded-lg bg-brand-teal/10 flex items-center justify-center text-brand-teal shrink-0">
                              <Plus className="w-4 h-4" />
                            </div>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  </motion.div>
                );
              })
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* ═══ Edit Team Name / Logo Dialog (Captain only) ═══ */}
      <AnimatePresence>
        {editDialogOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[70] bg-black/60 flex items-end sm:items-center justify-center p-4"
            onClick={(e) => { if (e.target === e.currentTarget) setEditDialogOpen(false); }}
          >
            <motion.div
              initial={{ y: 60, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 60, opacity: 0 }}
              className="bg-white dark:bg-warm-800 rounded-2xl shadow-2xl max-w-md w-full max-h-[85vh] overflow-hidden flex flex-col"
            >
              {/* Dialog Header */}
              <div className="p-4 border-b border-warm-200 dark:border-warm-700 flex items-center justify-between">
                <h3 className="font-bold text-warm-800 dark:text-warm-100 flex items-center gap-2">
                  <Pencil className="w-4 h-4 text-brand-teal" />
                  Edit Team
                </h3>
                <button
                  onClick={() => setEditDialogOpen(false)}
                  className="w-8 h-8 rounded-full bg-warm-100 dark:bg-warm-700 flex items-center justify-center hover:bg-warm-200 dark:hover:bg-warm-600 transition-colors"
                >
                  <X className="w-4 h-4 text-warm-500" />
                </button>
              </div>

              {/* Dialog Body */}
              <div className="p-4 space-y-4 overflow-y-auto flex-1">
                {/* Team Logo */}
                <div className="flex flex-col items-center gap-2">
                  <div className="w-20 h-20 rounded-2xl overflow-hidden bg-warm-100 dark:bg-warm-700 border-2 border-warm-200 dark:border-warm-600 flex items-center justify-center">
                    {editLogo ? (
                      <img src={editLogo} alt="Team logo" className="w-full h-full object-cover" />
                    ) : (
                      <ImageIcon className="w-8 h-8 text-warm-400" />
                    )}
                  </div>
                  <label className="cursor-pointer">
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) handleLogoUpload(file);
                      }}
                    />
                    <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                      logoUploading
                        ? 'bg-warm-100 dark:bg-warm-700 text-warm-400 cursor-wait'
                        : 'bg-brand-teal/10 text-brand-teal hover:bg-brand-teal/20'
                    }`}>
                      {logoUploading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ImageIcon className="w-3.5 h-3.5" />}
                      {logoUploading ? 'Uploading...' : (editLogo ? 'Change Logo' : 'Upload Logo')}
                    </span>
                  </label>
                  {editLogo && (
                    <button
                      onClick={() => setEditLogo(null)}
                      className="text-[10px] text-red-500 hover:text-red-600 underline"
                    >
                      Remove logo
                    </button>
                  )}
                </div>

                {/* Team Name */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-warm-600 dark:text-warm-300 uppercase tracking-wide">
                    Team Name *
                  </label>
                  <Input
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    placeholder="Enter team name (min 3 chars)"
                    maxLength={50}
                    className="bg-warm-50 dark:bg-warm-700 border-warm-200 dark:border-warm-600 text-warm-800 dark:text-warm-100"
                  />
                </div>

                {/* Short Name (optional) */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-warm-600 dark:text-warm-300 uppercase tracking-wide">
                    Short Name (optional)
                  </label>
                  <Input
                    value={editShortName}
                    onChange={(e) => setEditShortName(e.target.value.toUpperCase().slice(0, 4))}
                    placeholder="e.g. TIG"
                    maxLength={4}
                    className="bg-warm-50 dark:bg-warm-700 border-warm-200 dark:border-warm-600 text-warm-800 dark:text-warm-100 font-mono uppercase"
                  />
                  <p className="text-[10px] text-warm-400">2-4 characters, shown as a badge</p>
                </div>
              </div>

              {/* Dialog Footer */}
              <div className="p-4 border-t border-warm-200 dark:border-warm-700 flex gap-2">
                <Button
                  variant="outline"
                  onClick={() => setEditDialogOpen(false)}
                  disabled={editSaving}
                  className="flex-1"
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleSaveEdit}
                  disabled={editSaving || editName.trim().length < 3}
                  className="flex-1 bg-brand-teal hover:bg-brand-teal-dark text-white"
                >
                  {editSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4 mr-1.5" />}
                  {editSaving ? 'Saving...' : 'Save Changes'}
                </Button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
