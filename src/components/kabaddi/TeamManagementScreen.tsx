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
  Edit3,
  Trash2,
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
  color: string | null;
  logo: string | null;
  createdAt: string;
  updatedAt: string;
  members: TeamMemberEntry[];
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

interface TeamStats {
  totalMatches: number;
  wins: number;
  losses: number;
  totalPoints: number;
}

interface TeamManagementScreenProps {
  onClose: () => void;
}

// ─── Constants ────────────────────────────────────────────────────

const TEAM_COLORS = [
  '#DC2626', '#1E293B', '#14B8A6', '#475569', '#9333EA',
  '#F97316', '#06B6D4', '#EC4899', '#84CC16', '#6366F1',
];

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

// ─── Component ────────────────────────────────────────────────────

export default function TeamManagementScreen({ onClose }: TeamManagementScreenProps) {
  const currentUser = useKabaddiStore((s) => s.currentUser);
  const { toast } = useToast();

  // View state
  const [view, setView] = useState<'list' | 'detail'>('list');
  const [teams, setTeams] = useState<TeamData[]>([]);
  const [selectedTeam, setSelectedTeam] = useState<TeamData | null>(null);
  const [teamStats, setTeamStats] = useState<TeamStats>({
    totalMatches: 0,
    wins: 0,
    losses: 0,
    totalPoints: 0,
  });

  // Loading states
  const [teamsLoading, setTeamsLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  // Create Team Dialog
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [newTeamName, setNewTeamName] = useState('');
  const [newTeamShortName, setNewTeamShortName] = useState('');
  const [newTeamColor, setNewTeamColor] = useState(TEAM_COLORS[0]);

  // Search Players Dialog
  const [searchDialogOpen, setSearchDialogOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<PlayerSearchResult[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);

  // Delete confirmation
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  // ─── Fetch teams for current user ─────────────────────────────

  const fetchTeams = useCallback(async () => {
    if (!currentUser) return;
    setTeamsLoading(true);
    try {
      const res = await fetch('/api/teams');
      if (!res.ok) throw new Error('Failed to fetch teams');
      const data = await res.json();
      // Filter teams where the current user is a member
      const userTeams: TeamData[] = (data.teams || []).filter((team: TeamData) =>
        team.members.some((m: TeamMemberEntry) => m.userId === currentUser.id)
      );
      setTeams(userTeams);
    } catch (err) {
      console.error('Fetch teams error:', err);
      toast({
        title: 'Error',
        description: 'Failed to load teams',
        variant: 'destructive',
      });
    } finally {
      setTeamsLoading(false);
    }
  }, [currentUser, toast]);

  useEffect(() => {
    fetchTeams();
  }, [fetchTeams]);

  // ─── Fetch team detail ────────────────────────────────────────

  const fetchTeamDetail = useCallback(async (teamId: string) => {
    setDetailLoading(true);
    try {
      const res = await fetch(`/api/teams/${teamId}`);
      if (!res.ok) throw new Error('Failed to fetch team detail');
      const data = await res.json();
      setSelectedTeam(data.team);

      // Compute stats from matches (we'll approximate from what's available)
      // Since there's no dedicated stats endpoint per team, we set defaults
      // A real implementation would call a stats endpoint
      setTeamStats({
        totalMatches: 0,
        wins: 0,
        losses: 0,
        totalPoints: 0,
      });
    } catch (err) {
      console.error('Fetch team detail error:', err);
      toast({
        title: 'Error',
        description: 'Failed to load team details',
        variant: 'destructive',
      });
    } finally {
      setDetailLoading(false);
    }
  }, [toast]);

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

  // Debounced search
  useEffect(() => {
    if (!searchDialogOpen) return;
    const timer = setTimeout(() => {
      searchPlayers(searchQuery);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery, searchDialogOpen, searchPlayers]);

  // ─── Create team ─────────────────────────────────────────────

  const handleCreateTeam = async () => {
    if (!currentUser || !newTeamName.trim()) return;
    setActionLoading(true);
    try {
      const res = await fetch('/api/teams', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newTeamName.trim(),
          shortName: newTeamShortName.trim().slice(0, 3).toUpperCase() || undefined,
          color: newTeamColor,
          memberIds: [currentUser.id],
          captainId: currentUser.id,
        }),
      });
      if (!res.ok) throw new Error('Failed to create team');
      toast({
        title: 'Team Created!',
        description: `${newTeamName.trim()} has been created successfully.`,
      });
      setCreateDialogOpen(false);
      setNewTeamName('');
      setNewTeamShortName('');
      setNewTeamColor(TEAM_COLORS[0]);
      fetchTeams();
    } catch (err) {
      console.error('Create team error:', err);
      toast({
        title: 'Error',
        description: 'Failed to create team',
        variant: 'destructive',
      });
    } finally {
      setActionLoading(false);
    }
  };

  // ─── Add player to team ──────────────────────────────────────

  const handleAddPlayer = async (playerId: string, playerName: string) => {
    if (!selectedTeam) return;
    setActionLoading(true);
    try {
      // Add member via PATCH — we need to create a TeamMember
      // The API doesn't have a direct add-member endpoint,
      // so we'll use the teams API to create a new member entry
      const res = await fetch(`/api/teams/${selectedTeam.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
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
      fetchTeamDetail(selectedTeam.id);
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

  // ─── Remove player from team ─────────────────────────────────

  const handleRemovePlayer = async (memberId: string, playerName: string) => {
    if (!selectedTeam) return;
    setActionLoading(true);
    try {
      const res = await fetch(`/api/teams/${selectedTeam.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          removeMemberId: memberId,
        }),
      });
      if (!res.ok) throw new Error('Failed to remove player');
      toast({
        title: 'Player Removed',
        description: `${playerName} has been removed from the team.`,
      });
      setDeleteConfirmId(null);
      fetchTeamDetail(selectedTeam.id);
    } catch (err) {
      console.error('Remove player error:', err);
      toast({
        title: 'Error',
        description: 'Failed to remove player',
        variant: 'destructive',
      });
    } finally {
      setActionLoading(false);
    }
  };

  // ─── Set captain ─────────────────────────────────────────────

  const handleSetCaptain = async (userId: string, playerName: string) => {
    if (!selectedTeam) return;
    setActionLoading(true);
    try {
      const res = await fetch(`/api/teams/${selectedTeam.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ captainId: userId }),
      });
      if (!res.ok) throw new Error('Failed to set captain');
      toast({
        title: 'Captain Updated',
        description: `${playerName} is now the captain.`,
      });
      fetchTeamDetail(selectedTeam.id);
    } catch (err) {
      console.error('Set captain error:', err);
      toast({
        title: 'Error',
        description: 'Failed to set captain',
        variant: 'destructive',
      });
    } finally {
      setActionLoading(false);
    }
  };

  // ─── Delete team ─────────────────────────────────────────────

  const handleDeleteTeam = async () => {
    if (!selectedTeam) return;
    setActionLoading(true);
    try {
      const res = await fetch(`/api/teams/${selectedTeam.id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to delete team');
      toast({
        title: 'Team Deleted',
        description: `${selectedTeam.name} has been deleted.`,
      });
      setSelectedTeam(null);
      setView('list');
      fetchTeams();
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

  // ─── Navigate to team detail ─────────────────────────────────

  const openTeamDetail = (team: TeamData) => {
    setSelectedTeam(team);
    setView('detail');
    fetchTeamDetail(team.id);
  };

  const goBackToList = () => {
    setView('list');
    setSelectedTeam(null);
  };

  // ─── Get captain name for a team ─────────────────────────────

  const getCaptainName = (team: TeamData): string => {
    const captain = team.members.find((m) => m.isCaptain);
    return captain ? getDisplayName(captain.user.name) : 'No captain';
  };

  // ─── Check if player is already in team ──────────────────────

  const isPlayerInTeam = (playerId: string): boolean => {
    if (!selectedTeam) return false;
    return selectedTeam.members.some((m) => m.userId === playerId);
  };

  // ─── Render ──────────────────────────────────────────────────

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 bg-warm-50 flex flex-col"
    >
      {/* ═══ Header ═══ */}
      <header className="sticky top-0 z-10 bg-warm-50/90 backdrop-blur-md border-b border-warm-200/60">
        <div className="px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            {view === 'detail' ? (
              <button
                onClick={goBackToList}
                className="w-8 h-8 rounded-full bg-warm-200 flex items-center justify-center text-warm-600 hover:bg-warm-300 transition-colors"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
            ) : (
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-brand-red to-brand-red-dark flex items-center justify-center">
                <Shield className="w-4 h-4 text-white" />
              </div>
            )}
            <h1 className="text-base font-black tracking-wider text-warm-800">
              {view === 'detail' && selectedTeam
                ? selectedTeam.name.toUpperCase()
                : 'MY TEAMS'}
            </h1>
          </div>
          <div className="flex items-center gap-2">
            {view === 'list' && (
              <button
                onClick={() => setCreateDialogOpen(true)}
                className="w-8 h-8 rounded-full bg-brand-red flex items-center justify-center text-white hover:bg-brand-red-dark transition-colors"
              >
                <Plus className="w-4 h-4" />
              </button>
            )}
            {view === 'detail' && selectedTeam && (
              <button
                onClick={handleDeleteTeam}
                disabled={actionLoading}
                className="w-8 h-8 rounded-full bg-warm-200 flex items-center justify-center text-warm-500 hover:bg-red-100 hover:text-brand-red transition-colors"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            )}
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-full bg-warm-200 flex items-center justify-center text-warm-600 hover:bg-warm-300 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      {/* ═══ Content ═══ */}
      <div className="flex-1 overflow-y-auto custom-scrollbar">
        <AnimatePresence mode="wait">
          {view === 'list' ? (
            <motion.div
              key="team-list"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.2 }}
              className="px-4 py-4 space-y-3"
            >
              {/* ─── Team List View ─── */}
              {teamsLoading ? (
                <div className="flex flex-col gap-3">
                  {[1, 2, 3].map((i) => (
                    <div
                      key={i}
                      className="h-24 rounded-2xl bg-warm-100 animate-pulse"
                    />
                  ))}
                </div>
              ) : teams.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16">
                  <div className="w-16 h-16 rounded-full bg-warm-200 flex items-center justify-center mb-4">
                    <Users className="w-8 h-8 text-warm-400" />
                  </div>
                  <p className="text-warm-700 font-bold text-lg">No Teams Yet</p>
                  <p className="text-warm-400 text-sm mt-1 text-center max-w-[240px]">
                    Create your first team and start playing Kabaddi!
                  </p>
                  <Button
                    onClick={() => setCreateDialogOpen(true)}
                    className="mt-4 bg-brand-red hover:bg-brand-red-dark text-white rounded-xl font-semibold"
                  >
                    <Plus className="w-4 h-4 mr-1.5" />
                    Create Team
                  </Button>
                </div>
              ) : (
                teams.map((team, index) => (
                  <motion.div
                    key={team.id}
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.06 }}
                  >
                    <Card
                      className="bg-white border-warm-200 py-0 gap-0 overflow-hidden cursor-pointer hover:shadow-md transition-shadow active:scale-[0.98]"
                      onClick={() => openTeamDetail(team)}
                    >
                      <CardContent className="p-4">
                        <div className="flex items-center gap-3">
                          {/* Color badge */}
                          <div
                            className="w-12 h-12 rounded-xl flex items-center justify-center text-white font-black text-lg shrink-0 shadow-sm"
                            style={{ backgroundColor: team.color || '#DC2626' }}
                          >
                            {team.shortName
                              ? team.shortName.slice(0, 2)
                              : team.name.charAt(0).toUpperCase()}
                          </div>

                          {/* Team info */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <h3 className="font-bold text-warm-800 truncate">
                                {team.name}
                              </h3>
                              {team.shortName && (
                                <Badge
                                  variant="secondary"
                                  className="text-[10px] px-1.5 py-0 bg-warm-100 text-warm-500 shrink-0"
                                >
                                  {team.shortName}
                                </Badge>
                              )}
                            </div>
                            <div className="flex items-center gap-3 mt-1">
                              <span className="text-xs text-warm-500 flex items-center gap-1">
                                <Users className="w-3 h-3" />
                                {team.members.length}
                              </span>
                              <span className="text-xs text-warm-500 flex items-center gap-1">
                                <Crown className="w-3 h-3 text-brand-gold" />
                                {getCaptainName(team)}
                              </span>
                            </div>
                          </div>

                          {/* Arrow indicator */}
                          <ChevronLeft className="w-4 h-4 text-warm-400 rotate-180 shrink-0" />
                        </div>
                      </CardContent>
                    </Card>
                  </motion.div>
                ))
              )}
            </motion.div>
          ) : (
            <motion.div
              key="team-detail"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              transition={{ duration: 0.2 }}
              className="px-4 py-4 space-y-4"
            >
              {/* ─── Team Detail View ─── */}
              {detailLoading ? (
                <div className="flex flex-col gap-3">
                  <div className="h-32 rounded-2xl bg-warm-100 animate-pulse" />
                  <div className="h-20 rounded-2xl bg-warm-100 animate-pulse" />
                  {[1, 2, 3].map((i) => (
                    <div
                      key={i}
                      className="h-16 rounded-xl bg-warm-100 animate-pulse"
                    />
                  ))}
                </div>
              ) : selectedTeam ? (
                <>
                  {/* Team Header Card */}
                  <Card className="border-warm-200 py-0 gap-0 overflow-hidden">
                    <CardContent className="p-5">
                      <div className="flex items-center gap-4">
                        <div
                          className="w-16 h-16 rounded-2xl flex items-center justify-center text-white font-black text-xl shrink-0 shadow-md"
                          style={{
                            backgroundColor: selectedTeam.color || '#DC2626',
                          }}
                        >
                          {selectedTeam.shortName
                            ? selectedTeam.shortName.slice(0, 3)
                            : selectedTeam.name.charAt(0).toUpperCase()}
                        </div>
                        <div className="flex-1 min-w-0">
                          <h2 className="text-xl font-black text-warm-800 truncate">
                            {selectedTeam.name}
                          </h2>
                          <div className="flex items-center gap-2 mt-1">
                            {selectedTeam.shortName && (
                              <Badge
                                variant="secondary"
                                className="text-xs px-2 py-0.5 bg-warm-100 text-warm-600"
                              >
                                {selectedTeam.shortName}
                              </Badge>
                            )}
                            <div
                              className="w-4 h-4 rounded-full border-2 border-warm-200 shrink-0"
                              style={{
                                backgroundColor:
                                  selectedTeam.color || '#DC2626',
                              }}
                            />
                          </div>
                        </div>
                        <Badge className="bg-brand-teal/10 text-brand-teal border-brand-teal/20 shrink-0">
                          <Users className="w-3 h-3 mr-1" />
                          {selectedTeam.members.length}
                        </Badge>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Stats Row */}
                  <div className="grid grid-cols-4 gap-2">
                    {[
                      {
                        label: 'Matches',
                        value: teamStats.totalMatches,
                        color: 'text-warm-800',
                      },
                      {
                        label: 'Wins',
                        value: teamStats.wins,
                        color: 'text-brand-teal',
                      },
                      {
                        label: 'Losses',
                        value: teamStats.losses,
                        color: 'text-brand-red',
                      },
                      {
                        label: 'Points',
                        value: teamStats.totalPoints,
                        color: 'text-brand-gold',
                      },
                    ].map((stat) => (
                      <Card
                        key={stat.label}
                        className="bg-white border-warm-200 py-0 gap-0"
                      >
                        <CardContent className="p-3 text-center">
                          <p className={`text-lg font-black ${stat.color}`}>
                            {stat.value}
                          </p>
                          <p className="text-[10px] text-warm-500 font-medium uppercase tracking-wide">
                            {stat.label}
                          </p>
                        </CardContent>
                      </Card>
                    ))}
                  </div>

                  {/* Members Header */}
                  <div className="flex items-center justify-between">
                    <h3 className="font-bold text-warm-800 flex items-center gap-2">
                      <Users className="w-4 h-4 text-brand-teal" />
                      Members
                    </h3>
                    <Button
                      size="sm"
                      onClick={() => setSearchDialogOpen(true)}
                      className="bg-brand-teal hover:bg-brand-teal-dark text-white rounded-xl h-8 px-3 text-xs font-semibold"
                    >
                      <Plus className="w-3.5 h-3.5 mr-1" />
                      Add Player
                    </Button>
                  </div>

                  {/* Member List */}
                  <div className="space-y-2">
                    {selectedTeam.members.length === 0 ? (
                      <div className="text-center py-8">
                        <Users className="w-10 h-10 text-warm-300 mx-auto mb-2" />
                        <p className="text-warm-500 text-sm">
                          No members yet
                        </p>
                      </div>
                    ) : (
                      selectedTeam.members.map((member, index) => {
                        const isCurrentUserCaptain =
                          selectedTeam.members.find(
                            (m) => m.isCaptain
                          )?.userId === currentUser?.id;
                        const canManage =
                          isCurrentUserCaptain ||
                          currentUser?.isAdmin;

                        return (
                          <motion.div
                            key={member.id}
                            initial={{ opacity: 0, y: 8 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: index * 0.04 }}
                          >
                            <Card className="bg-white border-warm-200 py-0 gap-0 overflow-hidden">
                              <CardContent className="p-3">
                                <div className="flex items-center gap-3">
                                  {/* Avatar */}
                                  <div className="relative shrink-0">
                                    <div
                                      className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-sm"
                                      style={{
                                        backgroundColor:
                                          selectedTeam.color || '#DC2626',
                                      }}
                                    >
                                      {member.user.avatar ? (
                                        <img
                                          src={member.user.avatar}
                                          alt={getDisplayName(
                                            member.user.name
                                          )}
                                          className="w-full h-full rounded-full object-cover"
                                        />
                                      ) : (
                                        getInitials(member.user.name)
                                      )}
                                    </div>
                                    {member.isCaptain && (
                                      <div className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-brand-gold flex items-center justify-center shadow-sm">
                                        <Crown className="w-3 h-3 text-white" />
                                      </div>
                                    )}
                                  </div>

                                  {/* Name & Info */}
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2">
                                      <span className="font-semibold text-sm text-warm-800 truncate">
                                        {getDisplayName(member.user.name)}
                                      </span>
                                      {member.isCaptain && (
                                        <Badge className="bg-brand-gold/10 text-brand-gold-dark border-brand-gold/20 text-[10px] px-1.5 py-0">
                                          CAPTAIN
                                        </Badge>
                                      )}
                                      {member.userId ===
                                        currentUser?.id && (
                                        <Badge
                                          variant="secondary"
                                          className="text-[10px] px-1.5 py-0 bg-brand-teal/10 text-brand-teal"
                                        >
                                          YOU
                                        </Badge>
                                      )}
                                    </div>
                                    <p className="text-xs text-warm-500">
                                      {member.user.phone}
                                      {member.user.profile?.position &&
                                        ` · ${member.user.profile.position}`}
                                    </p>
                                  </div>

                                  {/* Actions */}
                                  {canManage &&
                                    member.userId !== currentUser?.id && (
                                      <div className="flex items-center gap-1 shrink-0">
                                        {!member.isCaptain && (
                                          <button
                                            onClick={() =>
                                              handleSetCaptain(
                                                member.userId,
                                                getDisplayName(
                                                  member.user.name
                                                )
                                              )
                                            }
                                            disabled={actionLoading}
                                            className="w-7 h-7 rounded-lg bg-brand-gold/10 flex items-center justify-center text-brand-gold hover:bg-brand-gold/20 transition-colors"
                                            title="Set as Captain"
                                          >
                                            <Crown className="w-3.5 h-3.5" />
                                          </button>
                                        )}
                                        <button
                                          onClick={() =>
                                            setDeleteConfirmId(member.id)
                                          }
                                          disabled={actionLoading}
                                          className="w-7 h-7 rounded-lg bg-red-50 flex items-center justify-center text-warm-400 hover:bg-red-100 hover:text-brand-red transition-colors"
                                          title="Remove Player"
                                        >
                                          <Trash2 className="w-3.5 h-3.5" />
                                        </button>
                                      </div>
                                    )}
                                </div>

                                {/* Delete confirmation */}
                                <AnimatePresence>
                                  {deleteConfirmId === member.id && (
                                    <motion.div
                                      initial={{ height: 0, opacity: 0 }}
                                      animate={{ height: 'auto', opacity: 1 }}
                                      exit={{ height: 0, opacity: 0 }}
                                      transition={{ duration: 0.2 }}
                                      className="overflow-hidden"
                                    >
                                      <div className="mt-2 pt-2 border-t border-warm-200 flex items-center justify-between">
                                        <span className="text-xs text-warm-600">
                                          Remove{' '}
                                          <strong>
                                            {getDisplayName(
                                              member.user.name
                                            )}
                                          </strong>
                                          ?
                                        </span>
                                        <div className="flex gap-2">
                                          <Button
                                            size="sm"
                                            variant="outline"
                                            className="h-7 text-xs rounded-lg border-warm-300"
                                            onClick={() =>
                                              setDeleteConfirmId(null)
                                            }
                                          >
                                            Cancel
                                          </Button>
                                          <Button
                                            size="sm"
                                            className="h-7 text-xs rounded-lg bg-brand-red hover:bg-brand-red-dark text-white"
                                            onClick={() =>
                                              handleRemovePlayer(
                                                member.id,
                                                getDisplayName(
                                                  member.user.name
                                                )
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
                </>
              ) : (
                <div className="flex flex-col items-center justify-center py-16">
                  <Shield className="w-12 h-12 text-warm-300 mb-3" />
                  <p className="text-warm-500 text-sm">Team not found</p>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* ═══ Create Team Dialog ═══ */}
      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent className="bg-warm-50 border-warm-200 rounded-2xl max-w-[calc(100%-2rem)] sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-warm-800 flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-brand-red flex items-center justify-center">
                <Shield className="w-3.5 h-3.5 text-white" />
              </div>
              Create New Team
            </DialogTitle>
            <DialogDescription className="text-warm-500">
              Set up your Kabaddi team. You&apos;ll be added as captain automatically.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* Team Name */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-warm-700">
                Team Name <span className="text-brand-red">*</span>
              </label>
              <Input
                placeholder="e.g. Mumbai Warriors"
                value={newTeamName}
                onChange={(e) => setNewTeamName(e.target.value)}
                className="h-11 bg-white border-warm-300 rounded-xl text-warm-800"
                maxLength={50}
              />
            </div>

            {/* Short Name */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-warm-700">
                Short Name
                <span className="text-warm-400 font-normal ml-1">
                  (3 chars max)
                </span>
              </label>
              <Input
                placeholder="e.g. MUM"
                value={newTeamShortName}
                onChange={(e) =>
                  setNewTeamShortName(
                    e.target.value.slice(0, 3).toUpperCase()
                  )
                }
                className="h-11 bg-white border-warm-300 rounded-xl text-warm-800 uppercase"
                maxLength={3}
              />
            </div>

            {/* Color Picker */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-warm-700">
                Team Color
              </label>
              <div className="flex gap-2.5 flex-wrap">
                {TEAM_COLORS.map((color) => (
                  <button
                    key={color}
                    onClick={() => setNewTeamColor(color)}
                    className={`w-9 h-9 rounded-xl transition-all duration-200 ${
                      newTeamColor === color
                        ? 'ring-2 ring-offset-2 ring-warm-400 scale-110 shadow-md'
                        : 'hover:scale-105'
                    }`}
                    style={{ backgroundColor: color }}
                  />
                ))}
              </div>
              {/* Preview */}
              <div className="flex items-center gap-3 mt-3 p-3 bg-white rounded-xl border border-warm-200">
                <div
                  className="w-10 h-10 rounded-lg flex items-center justify-center text-white font-bold text-sm"
                  style={{ backgroundColor: newTeamColor }}
                >
                  {newTeamShortName
                    ? newTeamShortName.slice(0, 2)
                    : newTeamName
                    ? newTeamName.charAt(0).toUpperCase()
                    : '?'}
                </div>
                <div>
                  <p className="font-bold text-warm-800 text-sm">
                    {newTeamName || 'Team Name'}
                  </p>
                  <p className="text-xs text-warm-400">
                    {newTeamShortName
                      ? `Short: ${newTeamShortName}`
                      : 'No short name'}
                  </p>
                </div>
              </div>
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-2">
            <Button
              variant="outline"
              onClick={() => setCreateDialogOpen(false)}
              className="rounded-xl border-warm-300 text-warm-600"
            >
              Cancel
            </Button>
            <Button
              onClick={handleCreateTeam}
              disabled={!newTeamName.trim() || actionLoading}
              className="bg-brand-red hover:bg-brand-red-dark text-white rounded-xl font-semibold flex-1 sm:flex-none"
            >
              {actionLoading ? (
                <span className="flex items-center gap-2">
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Creating...
                </span>
              ) : (
                <>
                  <Plus className="w-4 h-4 mr-1.5" />
                  Create Team
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ═══ Search Players Dialog ═══ */}
      <Dialog open={searchDialogOpen} onOpenChange={setSearchDialogOpen}>
        <DialogContent className="bg-warm-50 border-warm-200 rounded-2xl max-w-[calc(100%-2rem)] sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-warm-800 flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-brand-teal flex items-center justify-center">
                <Search className="w-3.5 h-3.5 text-white" />
              </div>
              Add Player
            </DialogTitle>
            <DialogDescription className="text-warm-500">
              Search for players by name or phone number.
            </DialogDescription>
          </DialogHeader>

          {/* Search Input */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-warm-400" />
            <Input
              placeholder="Search by name or phone..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 h-11 bg-white border-warm-300 rounded-xl text-warm-800"
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
                    className="h-14 rounded-xl bg-warm-100 animate-pulse"
                  />
                ))}
              </div>
            ) : searchQuery.trim() === '' ? (
              <div className="text-center py-8">
                <Search className="w-8 h-8 text-warm-300 mx-auto mb-2" />
                <p className="text-warm-400 text-sm">
                  Type to search for players
                </p>
              </div>
            ) : searchResults.length === 0 ? (
              <div className="text-center py-8">
                <Users className="w-8 h-8 text-warm-300 mx-auto mb-2" />
                <p className="text-warm-500 text-sm">No players found</p>
                <p className="text-warm-400 text-xs mt-1">
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
                      className={`bg-white border-warm-200 py-0 gap-0 overflow-hidden ${
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
                          {/* Avatar */}
                          <div
                            className="w-9 h-9 rounded-full flex items-center justify-center text-white font-bold text-xs shrink-0"
                            style={{
                              backgroundColor:
                                selectedTeam?.color || '#DC2626',
                            }}
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

                          {/* Info */}
                          <div className="flex-1 min-w-0">
                            <p className="font-semibold text-sm text-warm-800 truncate">
                              {getDisplayName(player.name)}
                            </p>
                            <p className="text-xs text-warm-500">
                              {player.phone}
                              {player.profile?.position &&
                                ` · ${player.profile.position}`}
                            </p>
                          </div>

                          {/* Status */}
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
    </motion.div>
  );
}
