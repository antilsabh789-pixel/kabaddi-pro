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
  ChevronRight,
  Hash,
  LogIn,
  Check,
  Sparkles,
  Lock,
  Camera,
  ImageIcon,
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
import { useKabaddiStore, type TeamFilter } from '@/lib/store';
import { useToast } from '@/hooks/use-toast';
import TeamDetailScreen from './TeamDetailScreen';

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

interface JoinPreviewTeam {
  id: string;
  name: string;
  shortName: string | null;
  color: string | null;
  teamCode: string | null;
  memberCount: number;
  captainName: string;
}

interface TeamManagementScreenProps {
  onClose: () => void;
}

// ─── Constants ────────────────────────────────────────────────────

const KABADDI_COLORS = [
  { value: '#DC2626', label: 'Red' },
  { value: '#1E40AF', label: 'Blue' },
  { value: '#16A34A', label: 'Green' },
  { value: '#EA580C', label: 'Orange' },
  { value: '#9333EA', label: 'Purple' },
  { value: '#0D9488', label: 'Teal' },
  { value: '#CA8A04', label: 'Gold' },
  { value: '#1E293B', label: 'Navy' },
];

const TEAM_COLORS = KABADDI_COLORS.map((c) => c.value);

// ─── Warrior Images ────────────────────────────────────────────────

const WARRIOR_IMAGES = [
  { id: 'warrior-1', name: 'Lion Warrior', src: '/warriors/warrior_1.png', bg: 'from-red-600 to-orange-600' },
  { id: 'warrior-2', name: 'Eagle Warrior', src: '/warriors/warrior_2.png', bg: 'from-blue-600 to-cyan-600' },
  { id: 'warrior-3', name: 'Tiger Warrior', src: '/warriors/warrior_3.png', bg: 'from-amber-600 to-yellow-600' },
  { id: 'warrior-4', name: 'Bull Warrior', src: '/warriors/warrior_4.png', bg: 'from-gray-700 to-gray-900' },
  { id: 'warrior-5', name: 'Cobra Warrior', src: '/warriors/warrior_5.png', bg: 'from-green-600 to-emerald-600' },
  { id: 'warrior-6', name: 'Panther Warrior', src: '/warriors/warrior_6.png', bg: 'from-purple-600 to-violet-600' },
  { id: 'warrior-7', name: 'Bear Warrior', src: '/warriors/warrior_7.png', bg: 'from-amber-800 to-amber-600' },
  { id: 'warrior-8', name: 'Wolf Warrior', src: '/warriors/warrior_8.png', bg: 'from-slate-600 to-slate-800' },
  { id: 'warrior-9', name: 'Hawk Warrior', src: '/warriors/warrior_9.png', bg: 'from-teal-600 to-teal-800' },
  { id: 'warrior-10', name: 'Rhino Warrior', src: '/warriors/warrior_10.png', bg: 'from-stone-600 to-stone-800' },
  { id: 'warrior-11', name: 'Dragon Warrior', src: '/warriors/warrior_11.png', bg: 'from-red-700 to-red-900' },
  { id: 'warrior-12', name: 'Phoenix Warrior', src: '/warriors/warrior_12.png', bg: 'from-orange-500 to-red-600' },
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

function generateShortName(name: string): string {
  const words = name.trim().split(/\s+/);
  if (words.length >= 3) {
    return (words[0].charAt(0) + words[1].charAt(0) + words[2].charAt(0)).toUpperCase();
  }
  if (words.length === 2) {
    return (words[0].charAt(0) + words[1].charAt(0)).toUpperCase();
  }
  return name.slice(0, 3).toUpperCase();
}

// ─── Component ────────────────────────────────────────────────────

export default function TeamManagementScreen({ onClose }: TeamManagementScreenProps) {
  const currentUser = useKabaddiStore((s) => s.currentUser);
  const { toast } = useToast();

  // View state
  const [view, setView] = useState<'list' | 'detail' | 'join'>('list');
  const [teams, setTeams] = useState<TeamData[]>([]);
  const [selectedTeam, setSelectedTeam] = useState<TeamData | null>(null);
  const [teamFilter, setTeamFilter] = useState<TeamFilter>('my');
  const [teamSearch, setTeamSearch] = useState('');

  // Loading states
  const [teamsLoading, setTeamsLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);

  // Create Team Dialog
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [newTeamName, setNewTeamName] = useState('');
  const [newTeamShortName, setNewTeamShortName] = useState('');
  const [newTeamColor, setNewTeamColor] = useState(TEAM_COLORS[0]);
  const [newTeamWarrior, setNewTeamWarrior] = useState<string>(WARRIOR_IMAGES[0].id);
  const [newTeamCustomAvatar, setNewTeamCustomAvatar] = useState<string | null>(null);
  const [warriorPickerOpen, setWarriorPickerOpen] = useState(false);
  const [uploadLoading, setUploadLoading] = useState(false);
  const [shortNameManuallySet, setShortNameManuallySet] = useState(false);

  // Search Players Dialog
  const [searchDialogOpen, setSearchDialogOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<PlayerSearchResult[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);

  // Join Team
  const [joinCode, setJoinCode] = useState('');
  const [joinPreview, setJoinPreview] = useState<JoinPreviewTeam | null>(null);
  const [joinLoading, setJoinLoading] = useState(false);
  const [joinPreviewLoading, setJoinPreviewLoading] = useState(false);
  const [joinConfirmOpen, setJoinConfirmOpen] = useState(false);

  // Count user's teams
  const myTeamCount = teams.filter((t) =>
    t.members.some((m) => m.userId === currentUser?.id)
  ).length;
  const isFreeUser = !currentUser?.isPremium;

  // ─── Fetch teams ─────────────────────────────────────────────

  const fetchTeams = useCallback(async () => {
    if (!currentUser) return;
    setTeamsLoading(true);
    try {
      const params = new URLSearchParams();
      if (teamSearch) params.set('search', teamSearch);
      if (teamFilter === 'my') params.set('userId', currentUser.id);
      params.set('filter', teamFilter);

      const res = await fetch(`/api/teams?${params.toString()}`);
      if (!res.ok) throw new Error('Failed to fetch teams');
      const data = await res.json();
      setTeams(data.teams || []);
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
  }, [currentUser, teamFilter, teamSearch, toast]);

  useEffect(() => {
    fetchTeams();
  }, [fetchTeams]);

  // ─── Auto-generate short name ──────────────────────────────

  useEffect(() => {
    if (!shortNameManuallySet && newTeamName) {
      setNewTeamShortName(generateShortName(newTeamName));
    }
  }, [newTeamName, shortNameManuallySet]);

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

  // ─── Handle avatar upload ────────────────────────────────────────

  const handleAvatarUpload = async (file: File) => {
    if (!currentUser) return;
    setUploadLoading(true);
    try {
      const reader = new FileReader();
      reader.onload = async (e) => {
        const fileData = e.target?.result as string;
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
        setNewTeamCustomAvatar(data.url);
        setNewTeamWarrior(''); // Clear warrior selection when custom avatar is chosen
        toast({ title: 'Avatar Uploaded', description: 'Custom team avatar has been set.' });
        setUploadLoading(false);
      };
      reader.readAsDataURL(file);
    } catch (err) {
      console.error('Upload error:', err);
      toast({ title: 'Upload Failed', description: 'Failed to upload avatar image.', variant: 'destructive' });
      setUploadLoading(false);
    }
  };

  // Get the effective team avatar URL
  const getTeamAvatar = (logo: string | null): string | null => {
    if (!logo) return null;
    // Check if it's a warrior ID reference
    const warrior = WARRIOR_IMAGES.find(w => w.id === logo);
    if (warrior) return warrior.src;
    // Otherwise it's a custom uploaded URL
    return logo;
  };

  const handleCreateTeam = async () => {
    if (!currentUser || !newTeamName.trim()) return;
    if (newTeamName.trim().length < 3) {
      toast({
        title: 'Validation Error',
        description: 'Team name must be at least 3 characters',
        variant: 'destructive',
      });
      return;
    }
    if (isFreeUser && myTeamCount >= 1) {
      toast({
        title: 'Team Limit Reached',
        description: 'Free users can create only 1 team. Upgrade to Premium for unlimited teams.',
        variant: 'destructive',
      });
      return;
    }
    setActionLoading(true);
    try {
      // Determine logo: custom avatar URL takes priority, then warrior ID
      const logoValue = newTeamCustomAvatar || newTeamWarrior || undefined;
      const res = await fetch('/api/teams', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newTeamName.trim(),
          shortName: newTeamShortName.trim().slice(0, 3).toUpperCase() || undefined,
          color: newTeamColor,
          logo: logoValue,
          memberIds: [currentUser.id],
          captainId: currentUser.id,
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to create team');
      }
      const data = await res.json();
      toast({
        title: 'Team Created!',
        description: `${newTeamName.trim()} has been created successfully.`,
      });
      setCreateDialogOpen(false);
      setNewTeamName('');
      setNewTeamShortName('');
      setNewTeamColor(TEAM_COLORS[0]);
      setNewTeamWarrior(WARRIOR_IMAGES[0].id);
      setNewTeamCustomAvatar(null);
      setShortNameManuallySet(false);
      fetchTeams();
      // Auto-navigate to new team detail
      if (data.team) {
        setSelectedTeam(data.team);
        setView('detail');
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to create team';
      console.error('Create team error:', err);
      toast({
        title: 'Error',
        description: message,
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
      // Refresh team detail
      const detailRes = await fetch(`/api/teams/${selectedTeam.id}`);
      if (detailRes.ok) {
        const detailData = await detailRes.json();
        setSelectedTeam(detailData.team);
      }
      fetchTeams();
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

  // ─── Join team by code ────────────────────────────────────────

  const handleJoinPreview = async () => {
    if (!joinCode.trim()) return;
    setJoinPreviewLoading(true);
    try {
      const res = await fetch(`/api/teams/join?code=${encodeURIComponent(joinCode.trim())}`);
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Team not found');
      }
      const data = await res.json();
      setJoinPreview(data.team);
      setJoinConfirmOpen(true);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Team not found';
      toast({
        title: 'Team Not Found',
        description: message,
        variant: 'destructive',
      });
      setJoinPreview(null);
    } finally {
      setJoinPreviewLoading(false);
    }
  };

  const handleJoinTeam = async () => {
    if (!currentUser || !joinPreview) return;
    setJoinLoading(true);
    try {
      const res = await fetch('/api/teams/join', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          teamCode: joinPreview.teamCode,
          userId: currentUser.id,
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to join team');
      }
      toast({
        title: 'Team Joined!',
        description: `You've joined ${joinPreview.name}.`,
      });
      setJoinConfirmOpen(false);
      setJoinCode('');
      setJoinPreview(null);
      setView('list');
      fetchTeams();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to join team';
      toast({
        title: 'Error',
        description: message,
        variant: 'destructive',
      });
    } finally {
      setJoinLoading(false);
    }
  };

  // ─── Navigate to team detail ─────────────────────────────────

  const openTeamDetail = (team: TeamData) => {
    setSelectedTeam(team);
    setView('detail');
  };

  const goBackToList = () => {
    setView('list');
    setSelectedTeam(null);
    fetchTeams();
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

  // ─── Handle team detail back/closes ─────────────────────────

  const handleDetailBack = () => {
    goBackToList();
  };

  const handleDetailClose = () => {
    onClose();
  };

  // ─── If viewing team detail, show TeamDetailScreen ────────────

  if (view === 'detail' && selectedTeam) {
    return (
      <TeamDetailScreen
        teamId={selectedTeam.id}
        onBack={handleDetailBack}
        onClose={handleDetailClose}
      />
    );
  }

  // ─── Render ──────────────────────────────────────────────────

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 bg-warm-50 dark:bg-warm-800 flex flex-col"
    >
      {/* ═══ Header ═══ */}
      <header className="sticky top-0 z-10 bg-warm-50/90 dark:bg-warm-800/90 backdrop-blur-md border-b border-warm-200/60 dark:border-warm-700/60">
        <div className="px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            {view === 'join' ? (
              <button
                onClick={() => { setView('list'); setJoinPreview(null); setJoinCode(''); }}
                className="w-8 h-8 rounded-full bg-warm-200 dark:bg-warm-700 flex items-center justify-center text-warm-600 dark:text-warm-300 hover:bg-warm-300 dark:hover:bg-warm-600 transition-colors"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
            ) : (
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-brand-red to-brand-red-dark flex items-center justify-center">
                <Shield className="w-4 h-4 text-white" />
              </div>
            )}
            <h1 className="text-base font-black tracking-wider text-warm-800 dark:text-warm-100">
              {view === 'join' ? 'JOIN TEAM' : 'TEAMS'}
            </h1>
          </div>
          <div className="flex items-center gap-2">
            {view === 'list' && (
              <>
                <button
                  onClick={() => setView('join')}
                  className="w-8 h-8 rounded-full bg-brand-teal/10 flex items-center justify-center text-brand-teal hover:bg-brand-teal/20 transition-colors"
                  title="Join Team"
                >
                  <LogIn className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setCreateDialogOpen(true)}
                  className="w-8 h-8 rounded-full bg-brand-red flex items-center justify-center text-white hover:bg-brand-red-dark transition-colors"
                  title="Create Team"
                >
                  <Plus className="w-4 h-4" />
                </button>
              </>
            )}
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-full bg-warm-200 dark:bg-warm-700 flex items-center justify-center text-warm-600 dark:text-warm-300 hover:bg-warm-300 dark:hover:bg-warm-600 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Filter tabs & search (only on list view) */}
        {view === 'list' && (
          <div className="px-4 pb-3 space-y-3">
            {/* Filter Tabs */}
            <div className="flex gap-2">
              {(['my', 'all'] as TeamFilter[]).map((filter) => (
                <button
                  key={filter}
                  onClick={() => setTeamFilter(filter)}
                  className={`px-4 py-1.5 rounded-full text-xs font-bold uppercase tracking-wide transition-all ${
                    teamFilter === filter
                      ? 'bg-brand-red text-white shadow-md'
                      : 'bg-warm-100 dark:bg-warm-700 text-warm-600 dark:text-warm-300 hover:bg-warm-200 dark:hover:bg-warm-600'
                  }`}
                >
                  {filter === 'my' ? 'My Teams' : 'All Teams'}
                </button>
              ))}
              {isFreeUser && (
                <div className="ml-auto flex items-center gap-1 text-xs text-warm-500 dark:text-warm-400">
                  <Lock className="w-3 h-3" />
                  {myTeamCount}/1
                </div>
              )}
              {!isFreeUser && (
                <div className="ml-auto flex items-center gap-1 text-xs text-brand-teal">
                  <Sparkles className="w-3 h-3" />
                  Unlimited
                </div>
              )}
            </div>

            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-warm-400" />
              <Input
                placeholder="Search by name or code..."
                value={teamSearch}
                onChange={(e) => setTeamSearch(e.target.value)}
                className="pl-9 h-9 bg-white dark:bg-warm-700 border-warm-200 dark:border-warm-600 rounded-xl text-warm-800 dark:text-warm-100 text-sm"
              />
              {teamSearch && (
                <button
                  onClick={() => setTeamSearch('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-warm-400 hover:text-warm-600"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>
        )}
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
                      className="h-24 rounded-2xl bg-warm-100 dark:bg-warm-700 animate-pulse"
                    />
                  ))}
                </div>
              ) : teams.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16">
                  <motion.div
                    initial={{ scale: 0.8, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ delay: 0.1 }}
                    className="w-20 h-20 rounded-2xl bg-gradient-to-br from-brand-red/10 to-brand-teal/10 flex items-center justify-center mb-4"
                  >
                    <Users className="w-10 h-10 text-brand-red/50" />
                  </motion.div>
                  <p className="text-warm-700 dark:text-warm-200 font-bold text-lg">
                    {teamSearch ? 'No Teams Found' : 'No Teams Yet'}
                  </p>
                  <p className="text-warm-400 dark:text-warm-500 text-sm mt-1 text-center max-w-[260px]">
                    {teamSearch
                      ? 'Try a different search term'
                      : 'Create your first team and start playing Kabaddi!'}
                  </p>
                  {!teamSearch && (
                    <div className="flex gap-3 mt-5">
                      <Button
                        onClick={() => setCreateDialogOpen(true)}
                        className="bg-brand-red hover:bg-brand-red-dark text-white rounded-xl font-semibold"
                      >
                        <Plus className="w-4 h-4 mr-1.5" />
                        Create Team
                      </Button>
                      <Button
                        onClick={() => setView('join')}
                        variant="outline"
                        className="border-brand-teal text-brand-teal hover:bg-brand-teal/10 rounded-xl font-semibold"
                      >
                        <LogIn className="w-4 h-4 mr-1.5" />
                        Join Team
                      </Button>
                    </div>
                  )}
                </div>
              ) : (
                teams.map((team, index) => {
                  const isMyTeam = team.members.some(
                    (m) => m.userId === currentUser?.id
                  );
                  const isCaptain = team.members.some(
                    (m) => m.userId === currentUser?.id && m.isCaptain
                  );

                  return (
                    <motion.div
                      key={team.id}
                      initial={{ opacity: 0, y: 12 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.06 }}
                    >
                      <Card
                        className="bg-white dark:bg-warm-700 py-0 gap-0 overflow-hidden cursor-pointer hover:shadow-md transition-shadow active:scale-[0.98] border-l-4"
                        style={{ borderLeftColor: team.color || '#DC2626' }}
                        onClick={() => openTeamDetail(team)}
                      >
                        <CardContent className="p-4">
                          <div className="flex items-center gap-3">
                            {/* Color badge / Warrior logo */}
                            {getTeamAvatar(team.logo) ? (
                              <div className="w-12 h-12 rounded-xl overflow-hidden shrink-0 shadow-sm border-2 border-warm-200 dark:border-warm-600">
                                <img
                                  src={getTeamAvatar(team.logo)!}
                                  alt={team.name}
                                  className="w-full h-full object-cover"
                                />
                              </div>
                            ) : (
                              <div
                                className="w-12 h-12 rounded-xl flex items-center justify-center text-white font-black text-lg shrink-0 shadow-sm"
                                style={{
                                  backgroundColor: team.color || '#DC2626',
                                }}
                              >
                                {team.shortName
                                  ? team.shortName.slice(0, 2)
                                  : team.name.charAt(0).toUpperCase()}
                              </div>
                            )}

                            {/* Team info */}
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <h3 className="font-bold text-warm-800 dark:text-warm-100 truncate">
                                  {team.name}
                                </h3>
                                {team.shortName && (
                                  <Badge
                                    variant="secondary"
                                    className="text-[10px] px-1.5 py-0 bg-warm-100 dark:bg-warm-600 text-warm-500 dark:text-warm-300 shrink-0"
                                  >
                                    {team.shortName}
                                  </Badge>
                                )}
                                {isCaptain && (
                                  <Badge className="bg-brand-gold/10 text-brand-gold-dark border-brand-gold/20 text-[9px] px-1.5 py-0 shrink-0">
                                    <Crown className="w-2.5 h-2.5 mr-0.5" />
                                    CAPTAIN
                                  </Badge>
                                )}
                              </div>
                              <div className="flex items-center gap-3 mt-1">
                                <span className="text-xs text-warm-500 dark:text-warm-400 flex items-center gap-1">
                                  <Users className="w-3 h-3" />
                                  {team.members.length}
                                </span>
                                {team.teamCode && (
                                  <span className="text-xs text-warm-400 dark:text-warm-500 flex items-center gap-1 font-mono">
                                    <Hash className="w-3 h-3" />
                                    {team.teamCode}
                                  </span>
                                )}
                              </div>
                            </div>

                            {/* Arrow indicator */}
                            <ChevronRight className="w-4 h-4 text-warm-400 dark:text-warm-500 shrink-0" />
                          </div>
                        </CardContent>
                      </Card>
                    </motion.div>
                  );
                })
              )}
            </motion.div>
          ) : (
            /* ─── Join Team View ─── */
            <motion.div
              key="join-team"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              transition={{ duration: 0.2 }}
              className="px-4 py-6"
            >
              <div className="max-w-sm mx-auto space-y-6">
                {/* Join Illustration */}
                <motion.div
                  initial={{ scale: 0.9, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ delay: 0.1 }}
                  className="flex flex-col items-center"
                >
                  <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-brand-teal/10 to-brand-teal/5 dark:from-brand-teal/20 dark:to-brand-teal/10 flex items-center justify-center mb-3">
                    <LogIn className="w-10 h-10 text-brand-teal" />
                  </div>
                  <h2 className="text-xl font-black text-warm-800 dark:text-warm-100">
                    Join a Team
                  </h2>
                  <p className="text-sm text-warm-500 dark:text-warm-400 text-center mt-1 max-w-[280px]">
                    Enter the team code shared by the captain to join their team
                  </p>
                </motion.div>

                {/* Code Input */}
                <div className="space-y-3">
                  <label className="text-sm font-medium text-warm-700 dark:text-warm-300">
                    Team Code
                  </label>
                  <div className="relative">
                    <Hash className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-warm-400" />
                    <Input
                      placeholder="e.g. KT2001"
                      value={joinCode}
                      onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                      className="pl-10 h-14 bg-white dark:bg-warm-700 border-warm-200 dark:border-warm-600 rounded-xl text-warm-800 dark:text-warm-100 text-lg font-mono text-center tracking-widest uppercase"
                      maxLength={10}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleJoinPreview();
                      }}
                    />
                  </div>
                  <Button
                    onClick={handleJoinPreview}
                    disabled={!joinCode.trim() || joinPreviewLoading}
                    className="w-full bg-brand-teal hover:bg-brand-teal-dark text-white rounded-xl font-semibold h-12"
                  >
                    {joinPreviewLoading ? (
                      <span className="flex items-center gap-2">
                        <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        Searching...
                      </span>
                    ) : (
                      <>
                        <Search className="w-4 h-4 mr-2" />
                        Find Team
                      </>
                    )}
                  </Button>
                </div>

                {/* Join Preview */}
                <AnimatePresence>
                  {joinPreview && (
                    <motion.div
                      initial={{ opacity: 0, y: 12 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -12 }}
                    >
                      <Card
                        className="bg-white dark:bg-warm-700 border-warm-200 dark:border-warm-600 py-0 gap-0 overflow-hidden border-l-4"
                        style={{ borderLeftColor: joinPreview.color || '#0D9488' }}
                      >
                        <CardContent className="p-4 space-y-3">
                          <div className="flex items-center gap-3">
                            <div
                              className="w-12 h-12 rounded-xl flex items-center justify-center text-white font-black text-lg shrink-0"
                              style={{
                                backgroundColor: joinPreview.color || '#0D9488',
                              }}
                            >
                              {joinPreview.shortName
                                ? joinPreview.shortName.slice(0, 2)
                                : joinPreview.name.charAt(0)}
                            </div>
                            <div className="flex-1 min-w-0">
                              <h3 className="font-bold text-warm-800 dark:text-warm-100 truncate">
                                {joinPreview.name}
                              </h3>
                              <div className="flex items-center gap-2 mt-0.5">
                                <Badge
                                  variant="secondary"
                                  className="text-[10px] px-1.5 py-0 bg-warm-100 dark:bg-warm-600 text-warm-500 dark:text-warm-300"
                                >
                                  {joinPreview.shortName}
                                </Badge>
                                <span className="text-xs text-warm-500 dark:text-warm-400">
                                  <Users className="w-3 h-3 inline mr-0.5" />
                                  {joinPreview.memberCount} members
                                </span>
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-2 text-xs text-warm-500 dark:text-warm-400 bg-warm-50 dark:bg-warm-800 rounded-lg p-2">
                            <Crown className="w-3.5 h-3.5 text-brand-gold" />
                            Captain: {joinPreview.captainName}
                          </div>
                          <Button
                            onClick={() => setJoinConfirmOpen(true)}
                            className="w-full bg-brand-teal hover:bg-brand-teal-dark text-white rounded-xl font-semibold"
                          >
                            <LogIn className="w-4 h-4 mr-2" />
                            Join This Team
                          </Button>
                        </CardContent>
                      </Card>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Divider with "or" */}
                <div className="flex items-center gap-3">
                  <div className="flex-1 h-px bg-warm-200 dark:bg-warm-600" />
                  <span className="text-xs text-warm-400 dark:text-warm-500 uppercase font-medium">
                    or
                  </span>
                  <div className="flex-1 h-px bg-warm-200 dark:bg-warm-600" />
                </div>

                {/* Create team CTA */}
                <div className="text-center">
                  <p className="text-sm text-warm-500 dark:text-warm-400 mb-3">
                    Don&apos;t have a team code?
                  </p>
                  <Button
                    onClick={() => {
                      setView('list');
                      setCreateDialogOpen(true);
                    }}
                    variant="outline"
                    className="border-brand-red text-brand-red hover:bg-brand-red/10 rounded-xl font-semibold"
                  >
                    <Plus className="w-4 h-4 mr-1.5" />
                    Create a Team
                  </Button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* ═══ Create Team Dialog ═══ */}
      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent className="bg-warm-50 dark:bg-warm-800 border-warm-200 dark:border-warm-600 rounded-2xl max-w-[calc(100%-2rem)] sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-warm-800 dark:text-warm-100 flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-brand-red flex items-center justify-center">
                <Shield className="w-3.5 h-3.5 text-white" />
              </div>
              Create New Team
            </DialogTitle>
            <DialogDescription className="text-warm-500 dark:text-warm-400">
              Set up your Kabaddi team. You&apos;ll be added as captain automatically.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* Team Name */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-warm-700 dark:text-warm-300">
                Team Name <span className="text-brand-red">*</span>
              </label>
              <Input
                placeholder="e.g. Mumbai Warriors"
                value={newTeamName}
                onChange={(e) => setNewTeamName(e.target.value)}
                className={`h-11 bg-white dark:bg-warm-700 border-warm-300 dark:border-warm-600 rounded-xl text-warm-800 dark:text-warm-100 ${
                  newTeamName.length > 0 && newTeamName.length < 3
                    ? 'border-brand-red focus:border-brand-red'
                    : ''
                }`}
                maxLength={30}
              />
              <div className="flex justify-between">
                <span className="text-[10px] text-warm-400">
                  {newTeamName.length > 0 && newTeamName.length < 3
                    ? 'Minimum 3 characters'
                    : '3-30 characters'}
                </span>
                <span className="text-[10px] text-warm-400">
                  {newTeamName.length}/30
                </span>
              </div>
            </div>

            {/* Short Name */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-warm-700 dark:text-warm-300">
                Short Name
                <span className="text-warm-400 font-normal ml-1">
                  (2-3 chars, auto-generated)
                </span>
              </label>
              <Input
                placeholder="e.g. MUM"
                value={newTeamShortName}
                onChange={(e) => {
                  setNewTeamShortName(
                    e.target.value.slice(0, 3).toUpperCase()
                  );
                  setShortNameManuallySet(true);
                }}
                className="h-11 bg-white dark:bg-warm-700 border-warm-300 dark:border-warm-600 rounded-xl text-warm-800 dark:text-warm-100 uppercase font-mono tracking-wider"
                maxLength={3}
              />
            </div>

            {/* Color Picker */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-warm-700 dark:text-warm-300">
                Team Color
              </label>
              <div className="flex gap-2.5 flex-wrap">
                {KABADDI_COLORS.map((colorInfo) => (
                  <button
                    key={colorInfo.value}
                    onClick={() => setNewTeamColor(colorInfo.value)}
                    className={`w-9 h-9 rounded-xl transition-all duration-200 relative ${
                      newTeamColor === colorInfo.value
                        ? 'ring-2 ring-offset-2 ring-warm-400 dark:ring-offset-warm-800 scale-110 shadow-md'
                        : 'hover:scale-105'
                    }`}
                    style={{ backgroundColor: colorInfo.value }}
                    title={colorInfo.label}
                  >
                    {newTeamColor === colorInfo.value && (
                      <Check className="w-4 h-4 text-white absolute inset-0 m-auto" />
                    )}
                  </button>
                ))}
              </div>

              {/* Preview */}
              <div className="flex items-center gap-3 mt-3 p-3 bg-white/60 dark:bg-warm-700/60 backdrop-blur-sm rounded-xl border border-warm-200/60 dark:border-warm-600/60">
                {newTeamCustomAvatar ? (
                  <div className="w-12 h-12 rounded-lg overflow-hidden shadow-sm border-2 border-warm-200 dark:border-warm-600">
                    <img src={newTeamCustomAvatar} alt="Team avatar" className="w-full h-full object-cover" />
                  </div>
                ) : WARRIOR_IMAGES.find(w => w.id === newTeamWarrior) ? (
                  <div className="w-12 h-12 rounded-lg overflow-hidden shadow-sm border-2 border-warm-200 dark:border-warm-600">
                    <img src={WARRIOR_IMAGES.find(w => w.id === newTeamWarrior)!.src} alt="Warrior avatar" className="w-full h-full object-cover" />
                  </div>
                ) : (
                  <div
                    className="w-12 h-12 rounded-lg flex items-center justify-center text-white font-bold text-sm shadow-sm"
                    style={{ backgroundColor: newTeamColor }}
                  >
                    {newTeamShortName
                      ? newTeamShortName.slice(0, 2)
                      : newTeamName
                      ? newTeamName.charAt(0).toUpperCase()
                      : '?'}
                  </div>
                )}
                <div>
                  <p className="font-bold text-warm-800 dark:text-warm-100 text-sm">
                    {newTeamName || 'Team Name'}
                  </p>
                  <div className="flex items-center gap-2">
                    <p className="text-xs text-warm-400 dark:text-warm-500">
                      {newTeamShortName
                        ? `Short: ${newTeamShortName}`
                        : 'Auto-generated short name'}
                    </p>
                    <span className="text-xs text-warm-400 dark:text-warm-500 font-mono">
                      · KT----
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Team Avatar / Profile Picture */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-warm-700 dark:text-warm-300">
                Team Avatar
              </label>

              {/* Current avatar display */}
              <div className="flex items-center gap-3">
                {newTeamCustomAvatar ? (
                  <div className="w-16 h-16 rounded-2xl overflow-hidden shadow-md border-2 border-brand-teal">
                    <img src={newTeamCustomAvatar} alt="Custom avatar" className="w-full h-full object-cover" />
                  </div>
                ) : WARRIOR_IMAGES.find(w => w.id === newTeamWarrior) ? (
                  <div className="w-16 h-16 rounded-2xl overflow-hidden shadow-md border-2 border-brand-teal">
                    <img src={WARRIOR_IMAGES.find(w => w.id === newTeamWarrior)!.src} alt="Warrior avatar" className="w-full h-full object-cover" />
                  </div>
                ) : (
                  <div
                    className="w-16 h-16 rounded-2xl flex items-center justify-center text-white font-black text-xl shadow-md"
                    style={{ backgroundColor: newTeamColor }}
                  >
                    ?
                  </div>
                )}
                <div className="flex-1">
                  <p className="text-sm font-medium text-warm-700 dark:text-warm-300">
                    {newTeamCustomAvatar ? 'Custom Avatar' : WARRIOR_IMAGES.find(w => w.id === newTeamWarrior)?.name || 'Select Avatar'}
                  </p>
                  <p className="text-xs text-warm-400 dark:text-warm-500">
                    Choose a warrior or upload your own
                  </p>
                </div>
              </div>

              {/* Action buttons */}
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setWarriorPickerOpen(true)}
                  className="flex-1 rounded-xl border-brand-red/30 text-brand-red hover:bg-brand-red/10 text-xs font-semibold"
                >
                  <ImageIcon className="w-3.5 h-3.5 mr-1.5" />
                  Choose Warrior
                </Button>
                <label className="flex-1 cursor-pointer">
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full rounded-xl border-brand-teal/30 text-brand-teal hover:bg-brand-teal/10 text-xs font-semibold"
                    disabled={uploadLoading}
                    asChild
                  >
                    <span>
                      {uploadLoading ? (
                        <span className="flex items-center gap-1.5">
                          <span className="w-3.5 h-3.5 border-2 border-brand-teal/30 border-t-brand-teal rounded-full animate-spin" />
                          Uploading...
                        </span>
                      ) : (
                        <>
                          <Camera className="w-3.5 h-3.5 mr-1.5" />
                          Upload from Gallery
                        </>
                      )}
                    </span>
                  </Button>
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) {
                        handleAvatarUpload(file);
                      }
                    }}
                  />
                </label>
              </div>

              {/* Quick warrior strip (small preview) */}
              {!newTeamCustomAvatar && (
                <div className="flex gap-1.5 overflow-x-auto pb-1 custom-scrollbar">
                  {WARRIOR_IMAGES.map((warrior) => (
                    <button
                      key={warrior.id}
                      onClick={() => {
                        setNewTeamWarrior(warrior.id);
                        setNewTeamCustomAvatar(null);
                      }}
                      className={`shrink-0 w-10 h-10 rounded-lg overflow-hidden transition-all duration-200 border-2 ${
                        newTeamWarrior === warrior.id
                          ? 'border-brand-red shadow-md scale-110'
                          : 'border-warm-200 dark:border-warm-600 hover:border-warm-300 dark:hover:border-warm-500 hover:scale-105'
                      }`}
                      title={warrior.name}
                    >
                      <img src={warrior.src} alt={warrior.name} className="w-full h-full object-cover" />
                    </button>
                  ))}
                </div>
              )}

              {/* Clear custom avatar button */}
              {newTeamCustomAvatar && (
                <button
                  onClick={() => {
                    setNewTeamCustomAvatar(null);
                    setNewTeamWarrior(WARRIOR_IMAGES[0].id);
                  }}
                  className="text-xs text-warm-500 dark:text-warm-400 hover:text-brand-red transition-colors flex items-center gap-1"
                >
                  <X className="w-3 h-3" />
                  Remove custom avatar
                </button>
              )}
            </div>

            {/* Free tier limit notice */}
            {isFreeUser && myTeamCount >= 1 && (
              <div className="flex items-center gap-2 p-3 bg-brand-gold/10 dark:bg-brand-gold/20 rounded-xl border border-brand-gold/20">
                <Lock className="w-4 h-4 text-brand-gold shrink-0" />
                <p className="text-xs text-brand-gold-dark dark:text-brand-gold-light">
                  Free users can create 1 team. Upgrade to Premium for unlimited teams.
                </p>
              </div>
            )}
          </div>

          <DialogFooter className="gap-2 sm:gap-2">
            <Button
              variant="outline"
              onClick={() => {
                setCreateDialogOpen(false);
                setShortNameManuallySet(false);
              }}
              className="rounded-xl border-warm-300 dark:border-warm-600 text-warm-600 dark:text-warm-300"
            >
              Cancel
            </Button>
            <Button
              onClick={handleCreateTeam}
              disabled={
                !newTeamName.trim() ||
                newTeamName.trim().length < 3 ||
                actionLoading ||
                (isFreeUser && myTeamCount >= 1)
              }
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

      {/* ═══ Join Team Confirmation Dialog ═══ */}
      <Dialog open={joinConfirmOpen} onOpenChange={setJoinConfirmOpen}>
        <DialogContent className="bg-warm-50 dark:bg-warm-800 border-warm-200 dark:border-warm-600 rounded-2xl max-w-[calc(100%-2rem)] sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-warm-800 dark:text-warm-100 flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-brand-teal flex items-center justify-center">
                <LogIn className="w-3.5 h-3.5 text-white" />
              </div>
              Confirm Join
            </DialogTitle>
            <DialogDescription className="text-warm-500 dark:text-warm-400">
              {joinPreview
                ? `Are you sure you want to join "${joinPreview.name}"?`
                : 'Confirm joining this team?'}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-2">
            <Button
              variant="outline"
              onClick={() => setJoinConfirmOpen(false)}
              className="rounded-xl border-warm-300 dark:border-warm-600 text-warm-600 dark:text-warm-300"
            >
              Cancel
            </Button>
            <Button
              onClick={handleJoinTeam}
              disabled={joinLoading}
              className="bg-brand-teal hover:bg-brand-teal-dark text-white rounded-xl font-semibold flex-1 sm:flex-none"
            >
              {joinLoading ? (
                <span className="flex items-center gap-2">
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Joining...
                </span>
              ) : (
                <>
                  <LogIn className="w-4 h-4 mr-1.5" />
                  Join Team
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
                            <p className="font-semibold text-sm text-warm-800 dark:text-warm-100 truncate">
                              {getDisplayName(player.name)}
                            </p>
                            <p className="text-xs text-warm-500 dark:text-warm-400">
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

      {/* ═══ Warrior Avatar Picker Dialog ═══ */}
      <Dialog open={warriorPickerOpen} onOpenChange={setWarriorPickerOpen}>
        <DialogContent className="bg-warm-50 dark:bg-warm-800 border-warm-200 dark:border-warm-600 rounded-2xl max-w-[calc(100%-2rem)] sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-warm-800 dark:text-warm-100 flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-brand-red flex items-center justify-center">
                <Shield className="w-3.5 h-3.5 text-white" />
              </div>
              Choose Team Avatar
            </DialogTitle>
            <DialogDescription className="text-warm-500 dark:text-warm-400">
              Select a fierce warrior avatar for your Kabaddi team
            </DialogDescription>
          </DialogHeader>

          <div className="grid grid-cols-3 sm:grid-cols-4 gap-3 py-3 max-h-96 overflow-y-auto custom-scrollbar">
            {WARRIOR_IMAGES.map((warrior) => (
              <motion.button
                key={warrior.id}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => {
                  setNewTeamWarrior(warrior.id);
                  setNewTeamCustomAvatar(null);
                  setWarriorPickerOpen(false);
                }}
                className={`relative flex flex-col items-center gap-2 p-3 rounded-2xl transition-all duration-200 border-2 ${
                  newTeamWarrior === warrior.id && !newTeamCustomAvatar
                    ? 'border-brand-red shadow-lg scale-105 bg-brand-red/5 dark:bg-brand-red/10'
                    : 'border-warm-200 dark:border-warm-600 hover:border-warm-300 dark:hover:border-warm-500 bg-white dark:bg-warm-700'
                }`}
              >
                <div className="w-16 h-16 rounded-xl overflow-hidden shadow-sm border border-warm-200 dark:border-warm-600">
                  <img src={warrior.src} alt={warrior.name} className="w-full h-full object-cover" />
                </div>
                <span className="text-[10px] font-semibold text-warm-700 dark:text-warm-300 truncate w-full text-center leading-tight">
                  {warrior.name}
                </span>
                {newTeamWarrior === warrior.id && !newTeamCustomAvatar && (
                  <div className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-brand-red flex items-center justify-center shadow-md">
                    <Check className="w-3 h-3 text-white" />
                  </div>
                )}
              </motion.button>
            ))}
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setWarriorPickerOpen(false)}
              className="rounded-xl border-warm-300 dark:border-warm-600 text-warm-600 dark:text-warm-300"
            >
              Cancel
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </motion.div>
  );
}
