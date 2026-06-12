'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, MapPin, Calendar, Users, ChevronDown, ChevronUp, Trophy, Crown, Lock, Loader2, Search, X, Copy, Check, Hash, UserPlus, Trash2, Swords, Sparkles, Timer } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { useKabaddiStore } from '@/lib/store';
import { useToast } from '@/hooks/use-toast';
import PremiumUpgradeScreen from './PremiumUpgradeScreen';

interface TeamInTournament {
  id: string;
  name: string;
  shortName?: string;
  teamCode?: string;
  color: string;
  logo?: string;
  played: number;
  won: number;
  lost: number;
  drawn: number;
  scoreDiff: number;
  points: number;
}

interface Tournament {
  id: string;
  name: string;
  tournamentCode?: string;
  type: string;
  venue: string;
  startDate: string | null;
  endDate: string | null;
  status: string;
  gender: string;
  teams: TeamInTournament[];
  matchCount: number;
  organizerId?: string;
}

interface DbTeam {
  id: string;
  name: string;
  shortName: string | null;
  teamCode: string | null;
  color: string | null;
  logo: string | null;
}

export default function TournamentsTab() {
  const { currentUser } = useKabaddiStore();
  const { toast } = useToast();
  const isPremium = currentUser?.isPremium || false;

  const [statusFilter, setStatusFilter] = useState<'ongoing' | 'upcoming' | 'past'>('ongoing');
  const [genderFilter, setGenderFilter] = useState<'all' | 'male' | 'female'>('all');
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [showUpgrade, setShowUpgrade] = useState(false);
  const [generatingBracket, setGeneratingBracket] = useState(false);

  // Tournament search by code
  const [tournamentSearch, setTournamentSearch] = useState('');

  // New tournament form
  const [newTournament, setNewTournament] = useState({
    name: '',
    venue: '',
    gender: 'male',
    type: 'knockout',
  });

  // Add teams to tournament
  const [addTeamDialogOpen, setAddTeamDialogOpen] = useState<string | null>(null);
  const [teamSearch, setTeamSearch] = useState('');
  const [teamSearchResults, setTeamSearchResults] = useState<DbTeam[]>([]);
  const [isSearchingTeams, setIsSearchingTeams] = useState(false);
  const [allTeams, setAllTeams] = useState<DbTeam[]>([]);
  const [selectedTeamIds, setSelectedTeamIds] = useState<string[]>([]);
  const [addingTeams, setAddingTeams] = useState(false);
  const teamInputRef = useRef<HTMLDivElement>(null);

  // Remove team confirmation
  const [removeTeamId, setRemoveTeamId] = useState<string | null>(null);
  const [removingTeam, setRemovingTeam] = useState(false);

  // Copy code feedback
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  useEffect(() => {
    fetchTournaments();
  }, [statusFilter, genderFilter]);

  // Fetch all teams on mount for instant filtering
  useEffect(() => {
    const fetchAllTeams = async () => {
      try {
        const res = await fetch('/api/teams?limit=100');
        if (res.ok) {
          const data = await res.json();
          setAllTeams(data.teams || []);
        }
      } catch {
        // silently fail
      }
    };
    fetchAllTeams();
  }, []);

  // Close team suggestions when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (teamInputRef.current && !teamInputRef.current.contains(e.target as Node)) {
        setTeamSearchResults([]);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const fetchTournaments = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (statusFilter) params.set('status', statusFilter);
      if (genderFilter && genderFilter !== 'all') params.set('gender', genderFilter);
      if (tournamentSearch.trim()) params.set('search', tournamentSearch.trim());

      const res = await fetch(`/api/tournaments?${params}`);
      if (res.ok) {
        const data = await res.json();
        setTournaments(data.tournaments || []);
      }
    } catch {
      setTournaments([]);
    } finally {
      setLoading(false);
    }
  }, [statusFilter, genderFilter, tournamentSearch]);

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchTournaments();
    }, 300);
    return () => clearTimeout(timer);
  }, [tournamentSearch]);

  const handleCreateClick = () => {
    if (!isPremium) {
      setShowUpgrade(true);
      return;
    }
    setCreateOpen(true);
  };

  const handleCreateTournament = async () => {
    try {
      const res = await fetch('/api/tournaments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...newTournament,
          organizerId: currentUser?.id,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        toast({
          title: 'Tournament Created!',
          description: `Code: ${data.tournament?.tournamentCode || 'N/A'}`,
        });
        setCreateOpen(false);
        fetchTournaments();
      } else {
        const data = await res.json();
        toast({ title: 'Error', description: data.error, variant: 'destructive' });
      }
    } catch {
      toast({ title: 'Error', description: 'Failed to create tournament', variant: 'destructive' });
    }
    setNewTournament({ name: '', venue: '', gender: 'male', type: 'knockout' });
  };

  const handleGenerateBracket = async (tournamentId: string, teamIds: string[]) => {
    setGeneratingBracket(true);
    try {
      const res = await fetch('/api/tournaments/generate-bracket', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tournamentId, teamIds }),
      });
      if (res.ok) {
        const data = await res.json();
        toast({
          title: 'Bracket Generated!',
          description: `${data.matchCount} matches scheduled`,
        });
        fetchTournaments();
      } else {
        const data = await res.json();
        toast({ title: 'Error', description: data.error || 'Failed to generate bracket', variant: 'destructive' });
      }
    } catch {
      toast({ title: 'Error', description: 'Failed to generate bracket', variant: 'destructive' });
    } finally {
      setGeneratingBracket(false);
    }
  };

  // Search teams for adding to tournament
  const getFilteredTeams = useCallback((query: string): DbTeam[] => {
    if (!query.trim()) return allTeams.slice(0, 20);
    const q = query.toLowerCase().trim();
    return allTeams.filter(t =>
      t.name.toLowerCase().includes(q) ||
      (t.teamCode && t.teamCode.toLowerCase().includes(q)) ||
      (t.shortName && t.shortName.toLowerCase().includes(q))
    ).slice(0, 20);
  }, [allTeams]);

  useEffect(() => {
    if (!addTeamDialogOpen) return;
    const timer = setTimeout(async () => {
      const localResults = getFilteredTeams(teamSearch);
      setTeamSearchResults(localResults);

      if (teamSearch.length >= 2) {
        setIsSearchingTeams(true);
        try {
          const res = await fetch(`/api/teams?search=${encodeURIComponent(teamSearch)}`);
          if (res.ok) {
            const data = await res.json();
            const serverTeams: DbTeam[] = data.teams || [];
            const serverIds = new Set(serverTeams.map(t => t.id));
            const merged = [...serverTeams, ...localResults.filter(t => !serverIds.has(t.id))].slice(0, 20);
            setTeamSearchResults(merged);
          }
        } catch {
          // keep local results
        } finally {
          setIsSearchingTeams(false);
        }
      }
    }, 200);
    return () => clearTimeout(timer);
  }, [teamSearch, addTeamDialogOpen, getFilteredTeams]);

  const openAddTeamDialog = (tournamentId: string) => {
    const tournament = tournaments.find(t => t.id === tournamentId);
    setSelectedTeamIds([]);
    setTeamSearch('');
    setTeamSearchResults(getFilteredTeams(''));
    setAddTeamDialogOpen(tournamentId);
  };

  const handleAddTeams = async () => {
    if (!addTeamDialogOpen || selectedTeamIds.length === 0) return;
    setAddingTeams(true);
    try {
      const res = await fetch(`/api/tournaments/${addTeamDialogOpen}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ addTeamIds: selectedTeamIds }),
      });
      if (res.ok) {
        const data = await res.json();
        toast({
          title: 'Teams Added!',
          description: data.message || `${selectedTeamIds.length} team(s) added to tournament`,
        });
        setAddTeamDialogOpen(null);
        setSelectedTeamIds([]);
        fetchTournaments();
      } else {
        const data = await res.json();
        toast({ title: 'Error', description: data.error, variant: 'destructive' });
      }
    } catch {
      toast({ title: 'Error', description: 'Failed to add teams', variant: 'destructive' });
    } finally {
      setAddingTeams(false);
    }
  };

  const handleRemoveTeam = async (tournamentId: string, teamId: string) => {
    setRemovingTeam(true);
    try {
      const res = await fetch(`/api/tournaments/${tournamentId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ removeTeamIds: [teamId] }),
      });
      if (res.ok) {
        toast({ title: 'Team Removed', description: 'Team removed from tournament' });
        setRemoveTeamId(null);
        fetchTournaments();
      } else {
        const data = await res.json();
        toast({ title: 'Error', description: data.error, variant: 'destructive' });
      }
    } catch {
      toast({ title: 'Error', description: 'Failed to remove team', variant: 'destructive' });
    } finally {
      setRemovingTeam(false);
    }
  };

  const copyToClipboard = async (code: string) => {
    try {
      await navigator.clipboard.writeText(code);
      setCopiedCode(code);
      toast({ title: 'Copied!', description: `Code ${code} copied to clipboard` });
      setTimeout(() => setCopiedCode(null), 2000);
    } catch {
      // fallback
    }
  };

  const filteredTournaments = tournaments.filter((t) => {
    if (t.status !== statusFilter) return false;
    if (genderFilter !== 'all' && t.gender !== genderFilter) return false;
    return true;
  });

  const highlightMatch = (text: string, query: string) => {
    if (!query.trim()) return text;
    const regex = new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
    const parts = text.split(regex);
    return parts.map((part, i) =>
      regex.test(part) ? (
        <span key={i} className="text-brand-red font-bold">{part}</span>
      ) : (
        <span key={i}>{part}</span>
      )
    );
  };

  // Format date helper
  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return 'TBD';
    try {
      const date = new Date(dateStr);
      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    } catch {
      return dateStr;
    }
  };

  // Tournament type badge styling
  const getTypeBadge = (type: string) => {
    switch (type) {
      case 'knockout':
        return { bg: 'bg-orange-500/10 dark:bg-orange-500/20', text: 'text-orange-600 dark:text-orange-400', icon: <Swords className="w-3 h-3" /> };
      case 'league':
        return { bg: 'bg-emerald-500/10 dark:bg-emerald-500/20', text: 'text-emerald-600 dark:text-emerald-400', icon: <Trophy className="w-3 h-3" /> };
      case 'hybrid':
        return { bg: 'bg-purple-500/10 dark:bg-purple-500/20', text: 'text-purple-600 dark:text-purple-400', icon: <Sparkles className="w-3 h-3" /> };
      default:
        return { bg: 'bg-warm-200 dark:bg-warm-700', text: 'text-warm-600 dark:text-warm-300', icon: <Trophy className="w-3 h-3" /> };
    }
  };

  // Empty state content based on filter
  const getEmptyContent = () => {
    if (tournamentSearch.trim()) {
      return {
        icon: '🔍',
        title: 'No results found',
        description: `Try searching by tournament code like "TC3001"`,
        cta: null,
      };
    }
    switch (statusFilter) {
      case 'ongoing':
        return {
          icon: '🏟️',
          title: 'No ongoing tournaments right now',
          description: 'Check back later or create your own tournament',
          cta: isPremium ? 'Create Tournament' : null,
        };
      case 'upcoming':
        return {
          icon: '📅',
          title: 'No upcoming tournaments',
          description: 'Be the first to host one!',
          cta: isPremium ? 'Host Tournament' : null,
        };
      case 'past':
        return {
          icon: '🏆',
          title: 'No past tournaments yet',
          description: 'Completed tournaments will appear here',
          cta: null,
        };
      default:
        return {
          icon: '🏆',
          title: 'No tournaments found',
          description: '',
          cta: null,
        };
    }
  };

  return (
    <div className="px-4 py-6 space-y-5">
      {/* Premium Upgrade Modal */}
      {showUpgrade && (
        <PremiumUpgradeScreen
          onClose={() => setShowUpgrade(false)}
          feature="Host Tournaments"
        />
      )}

      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-warm-800 dark:text-warm-100 flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-brand-gold/20 flex items-center justify-center">
            <Trophy className="w-4 h-4 text-brand-gold" />
          </div>
          Tournaments
        </h1>
        <motion.div whileTap={{ scale: 0.95 }}>
          <Button
            onClick={handleCreateClick}
            className={`rounded-xl h-10 px-4 font-bold ${
              isPremium
                ? 'bg-gradient-to-r from-brand-red to-brand-red-light hover:from-brand-red-dark hover:to-brand-red text-white shadow-lg shadow-brand-red/20'
                : 'bg-gradient-to-r from-brand-gold-dark via-brand-gold to-brand-gold-light text-white hover:opacity-90 shadow-lg shadow-brand-gold/20'
            }`}
          >
            {isPremium ? (
              <>
                <Plus className="w-4 h-4 mr-1" />
                Create
              </>
            ) : (
              <>
                <Crown className="w-4 h-4 mr-1" />
                Host
                <Lock className="w-3 h-3 ml-1" />
              </>
            )}
          </Button>
        </motion.div>

        {/* Create Tournament Dialog */}
        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogContent className="bg-warm-50 dark:bg-warm-900 border-warm-300 dark:border-warm-700">
            <DialogHeader>
              <DialogTitle className="text-warm-800 dark:text-warm-100 flex items-center gap-2">
                Create Tournament
                <Badge className="bg-brand-gold/20 text-brand-gold text-[10px] border-0">
                  <Crown className="w-3 h-3 mr-1" />
                  PRO
                </Badge>
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4 mt-2">
              <Input
                placeholder="Tournament name"
                value={newTournament.name}
                onChange={(e) => setNewTournament({ ...newTournament, name: e.target.value })}
                className="bg-white dark:bg-warm-800 border-warm-300 dark:border-warm-700 rounded-xl"
              />
              <Input
                placeholder="Venue"
                value={newTournament.venue}
                onChange={(e) => setNewTournament({ ...newTournament, venue: e.target.value })}
                className="bg-white dark:bg-warm-800 border-warm-300 dark:border-warm-700 rounded-xl"
              />
              <div className="grid grid-cols-3 gap-2">
                {(['knockout', 'league', 'hybrid'] as const).map((t) => {
                  const badge = getTypeBadge(t);
                  return (
                    <button
                      key={t}
                      onClick={() => setNewTournament({ ...newTournament, type: t })}
                      className={`p-2.5 rounded-xl border-2 text-xs font-bold capitalize flex flex-col items-center gap-1 transition-all ${
                        newTournament.type === t
                          ? `${badge.bg} ${badge.text} border-current`
                          : 'border-warm-200 dark:border-warm-700 text-warm-600 dark:text-warm-400'
                      }`}
                    >
                      {badge.icon}
                      {t}
                    </button>
                  );
                })}
              </div>
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => setNewTournament({ ...newTournament, gender: 'male' })}
                  className={`p-3 rounded-xl border-2 text-sm font-bold transition-all ${
                    newTournament.gender === 'male'
                      ? 'border-blue-500 bg-blue-500/10 text-blue-600 dark:text-blue-400'
                      : 'border-warm-200 dark:border-warm-700 text-warm-600 dark:text-warm-400'
                  }`}
                >
                  ♂ Boys
                </button>
                <button
                  onClick={() => setNewTournament({ ...newTournament, gender: 'female' })}
                  className={`p-3 rounded-xl border-2 text-sm font-bold transition-all ${
                    newTournament.gender === 'female'
                      ? 'border-red-500 bg-red-500/10 text-red-600 dark:text-red-400'
                      : 'border-warm-200 dark:border-warm-700 text-warm-600 dark:text-warm-400'
                  }`}
                >
                  ♀ Girls
                </button>
              </div>
              <div className="bg-warm-100 dark:bg-warm-800 rounded-xl p-3 text-center">
                <p className="text-xs text-warm-500 dark:text-warm-400">A unique tournament code will be auto-generated</p>
                <p className="text-[10px] text-warm-400 dark:text-warm-500">Share this code so others can easily find & join</p>
              </div>
              <Button
                onClick={handleCreateTournament}
                disabled={!newTournament.name}
                className="w-full bg-gradient-to-r from-brand-red to-brand-red-light hover:from-brand-red-dark hover:to-brand-red text-white rounded-xl font-bold"
              >
                Create Tournament
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Search Tournaments by Code/Name */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-warm-400" />
        <Input
          placeholder="Search by name or tournament code (e.g. TC3001)..."
          value={tournamentSearch}
          onChange={(e) => setTournamentSearch(e.target.value)}
          className="pl-9 pr-9 h-11 bg-white dark:bg-warm-800 border-warm-200 dark:border-warm-700 rounded-xl text-sm"
        />
        {tournamentSearch && (
          <button
            onClick={() => setTournamentSearch('')}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-warm-400 hover:text-warm-600"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Premium hint for non-premium users */}
      {!isPremium && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <Card
            className="p-4 bg-gradient-to-r from-brand-gold/10 via-brand-gold/5 to-brand-gold/10 dark:from-brand-gold/20 dark:via-brand-gold/10 dark:to-brand-gold/20 border border-brand-gold/30 cursor-pointer active:scale-[0.98] transition-transform overflow-hidden relative"
            onClick={() => setShowUpgrade(true)}
          >
            {/* Shimmer effect */}
            <motion.div
              className="absolute inset-0 bg-gradient-to-r from-transparent via-brand-gold/10 to-transparent"
              animate={{ x: ['-100%', '200%'] }}
              transition={{ duration: 3, repeat: Infinity, ease: 'linear' }}
            />
            <div className="flex items-center gap-3 relative">
              <div className="w-10 h-10 rounded-xl bg-brand-gold/20 flex items-center justify-center shrink-0">
                <Crown className="w-5 h-5 text-brand-gold" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-warm-800 dark:text-warm-100">Want to host your own tournament?</p>
                <p className="text-[11px] text-warm-500 dark:text-warm-400">Upgrade to Premium to create and manage tournaments</p>
              </div>
              <div className="shrink-0">
                <div className="px-3 py-1.5 rounded-lg bg-brand-gold/20 text-brand-gold font-bold text-xs flex items-center gap-1">
                  <Sparkles className="w-3 h-3" />
                  Upgrade
                </div>
              </div>
            </div>
          </Card>
        </motion.div>
      )}

      {/* Status Tabs */}
      <div className="flex gap-1 bg-warm-100 dark:bg-warm-800 p-1 rounded-xl">
        {(['ongoing', 'upcoming', 'past'] as const).map((s) => (
          <button
            key={s}
            onClick={() => setStatusFilter(s)}
            className={`flex-1 px-4 py-2 rounded-lg text-sm font-bold capitalize transition-all duration-200 relative ${
              statusFilter === s
                ? 'bg-white dark:bg-warm-700 text-brand-red shadow-sm'
                : 'text-warm-500 dark:text-warm-400 hover:text-warm-700 dark:hover:text-warm-300'
            }`}
          >
            {s}
            {statusFilter === s && (
              <motion.div
                className="absolute bottom-0 left-1/4 right-1/4 h-0.5 bg-brand-red rounded-full"
                layoutId="statusIndicator"
                transition={{ type: 'spring', stiffness: 500, damping: 30 }}
              />
            )}
          </button>
        ))}
      </div>

      {/* Gender Filter */}
      <div className="flex gap-2">
        {[
          { id: 'all' as const, label: 'All' },
          { id: 'male' as const, label: '♂ Boys' },
          { id: 'female' as const, label: '♀ Girls' },
        ].map((f) => (
          <button
            key={f.id}
            onClick={() => setGenderFilter(f.id)}
            className={`px-4 py-1.5 rounded-full text-xs font-bold transition-all duration-200 ${
              genderFilter === f.id
                ? 'bg-warm-800 dark:bg-warm-200 text-white dark:text-warm-800'
                : 'bg-warm-100 dark:bg-warm-800 text-warm-500 dark:text-warm-400 hover:bg-warm-200 dark:hover:bg-warm-700'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Tournament Cards */}
      {loading ? (
        <div className="space-y-3">
          {[1, 2].map((i) => (
            <div key={i} className="h-36 bg-warm-100 dark:bg-warm-800 rounded-2xl animate-pulse" />
          ))}
        </div>
      ) : filteredTournaments.length === 0 ? (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <Card className="p-8 text-center border-warm-200 dark:border-warm-700 bg-white dark:bg-warm-800/50">
            <div className="text-5xl mb-3">{getEmptyContent().icon}</div>
            <p className="text-warm-700 dark:text-warm-200 text-base font-bold">{getEmptyContent().title}</p>
            <p className="text-warm-400 dark:text-warm-500 text-sm mt-1">{getEmptyContent().description}</p>
            {getEmptyContent().cta && (
              <Button
                onClick={handleCreateClick}
                className="mt-4 bg-gradient-to-r from-brand-red to-brand-red-light text-white rounded-xl font-bold"
              >
                <Plus className="w-4 h-4 mr-1" />
                {getEmptyContent().cta}
              </Button>
            )}
          </Card>
        </motion.div>
      ) : (
        <div className="space-y-3">
          {filteredTournaments.map((tournament, i) => {
            const typeBadge = getTypeBadge(tournament.type);
            const teamCount = tournament.teams.length;
            return (
              <motion.div
                key={tournament.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
              >
                <Card className="overflow-hidden border border-warm-200 dark:border-warm-700 bg-white dark:bg-warm-800/50">
                  {/* Gradient Accent Bar */}
                  <div className={`h-1 ${
                    tournament.gender === 'male'
                      ? 'bg-gradient-to-r from-blue-500 to-blue-400'
                      : 'bg-gradient-to-r from-red-500 to-red-400'
                  }`} />

                  <div
                    className="p-4 cursor-pointer"
                    onClick={() => setExpandedId(expandedId === tournament.id ? null : tournament.id)}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <h3 className="font-bold text-warm-800 dark:text-warm-100 text-sm truncate">
                            {tournament.name}
                          </h3>
                          {/* Tournament Type Badge */}
                          <span className={`inline-flex items-center gap-0.5 px-2 py-0.5 rounded-md text-[9px] font-bold capitalize ${typeBadge.bg} ${typeBadge.text} shrink-0`}>
                            {typeBadge.icon}
                            {tournament.type}
                          </span>
                        </div>
                        {/* Tournament Code Badge */}
                        {tournament.tournamentCode && (
                          <div
                            className="inline-flex items-center gap-1 mt-1 px-2 py-0.5 rounded-md bg-brand-teal/10 dark:bg-brand-teal/20 cursor-pointer hover:bg-brand-teal/20 transition-colors"
                            onClick={(e) => {
                              e.stopPropagation();
                              copyToClipboard(tournament.tournamentCode!);
                            }}
                          >
                            <Hash className="w-3 h-3 text-brand-teal" />
                            <span className="text-[10px] font-mono font-bold text-brand-teal">
                              {tournament.tournamentCode}
                            </span>
                            {copiedCode === tournament.tournamentCode ? (
                              <Check className="w-3 h-3 text-brand-green" />
                            ) : (
                              <Copy className="w-3 h-3 text-brand-teal/60" />
                            )}
                          </div>
                        )}
                        <div className="flex items-center gap-1 mt-1.5 text-xs text-warm-500 dark:text-warm-400">
                          <MapPin className="w-3 h-3" />
                          <span className="truncate">{tournament.venue}</span>
                        </div>
                        <div className="flex items-center gap-1 mt-0.5 text-xs text-warm-500 dark:text-warm-400">
                          <Calendar className="w-3 h-3" />
                          <span>{formatDate(tournament.startDate)}</span>
                        </div>
                      </div>
                      <div className="flex flex-col items-end gap-1.5 ml-3">
                        <Badge
                          variant="secondary"
                          className={`text-[10px] font-bold ${
                            tournament.gender === 'male'
                              ? 'bg-blue-500/10 text-blue-600 dark:text-blue-400'
                              : 'bg-red-500/10 text-red-600 dark:text-red-400'
                          }`}
                        >
                          {tournament.gender === 'male' ? '♂ Boys' : '♀ Girls'}
                        </Badge>
                        {/* Team & Match Count */}
                        <div className="flex items-center gap-2">
                          <div className="flex items-center gap-1 text-xs text-warm-500 dark:text-warm-400 bg-warm-100 dark:bg-warm-700 px-2 py-0.5 rounded-md">
                            <Users className="w-3 h-3" />
                            <span className="font-bold">{teamCount}</span>
                          </div>
                          {tournament.matchCount > 0 && (
                            <div className="flex items-center gap-1 text-xs text-warm-500 dark:text-warm-400 bg-warm-100 dark:bg-warm-700 px-2 py-0.5 rounded-md">
                              <Timer className="w-3 h-3" />
                              <span className="font-bold">{tournament.matchCount}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Team Avatars Row + Progress */}
                    <div className="flex items-center justify-between mt-3">
                      <div className="flex -space-x-1.5">
                        {tournament.teams.slice(0, 5).map((team) => (
                          <div
                            key={team.id}
                            className="w-7 h-7 rounded-full border-2 border-white dark:border-warm-800 flex items-center justify-center text-[8px] font-bold text-white shadow-sm"
                            style={{ backgroundColor: team.color }}
                          >
                            {team.shortName?.charAt(0) || team.name.charAt(0)}
                          </div>
                        ))}
                        {tournament.teams.length > 5 && (
                          <div className="w-7 h-7 rounded-full border-2 border-white dark:border-warm-800 bg-warm-200 dark:bg-warm-600 flex items-center justify-center text-[8px] font-bold text-warm-600 dark:text-warm-300">
                            +{tournament.teams.length - 5}
                          </div>
                        )}
                      </div>
                      {/* Progress indicator for ongoing tournaments */}
                      {tournament.status === 'ongoing' && tournament.matchCount > 0 && (
                        <div className="flex items-center gap-1.5">
                          <div className="w-16 h-1.5 bg-warm-200 dark:bg-warm-700 rounded-full overflow-hidden">
                            <div className="h-full bg-brand-green rounded-full" style={{ width: '45%' }} />
                          </div>
                          <span className="text-[9px] text-brand-green font-bold">Live</span>
                        </div>
                      )}
                      {expandedId === tournament.id ? (
                        <ChevronUp className="w-4 h-4 text-warm-400" />
                      ) : (
                        <ChevronDown className="w-4 h-4 text-warm-400" />
                      )}
                    </div>
                  </div>

                  <AnimatePresence>
                    {expandedId === tournament.id && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        className="overflow-hidden"
                      >
                        <div className="border-t border-warm-200 dark:border-warm-700 p-4 bg-warm-50 dark:bg-warm-800/30 space-y-4">
                          {/* Tournament Code Display */}
                          {tournament.tournamentCode && (
                            <div className="flex items-center justify-between bg-white dark:bg-warm-800 rounded-xl p-3 border border-warm-200 dark:border-warm-700">
                              <div>
                                <p className="text-[10px] text-warm-400 dark:text-warm-500 uppercase font-semibold tracking-wider">Tournament Code</p>
                                <p className="text-lg font-mono font-bold text-brand-teal">{tournament.tournamentCode}</p>
                              </div>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => copyToClipboard(tournament.tournamentCode!)}
                                className="rounded-lg text-xs"
                              >
                                {copiedCode === tournament.tournamentCode ? (
                                  <><Check className="w-3 h-3 mr-1" /> Copied</>
                                ) : (
                                  <><Copy className="w-3 h-3 mr-1" /> Copy</>
                                )}
                              </Button>
                            </div>
                          )}

                          {/* Teams List */}
                          <div>
                            <div className="flex items-center justify-between mb-2">
                              <h4 className="text-xs font-bold text-warm-500 dark:text-warm-400 uppercase tracking-wider">Teams ({tournament.teams.length})</h4>
                              {/* Add Team Button */}
                              <Button
                                onClick={() => openAddTeamDialog(tournament.id)}
                                variant="outline"
                                size="sm"
                                className="rounded-lg h-7 px-2.5 text-[10px] font-bold border-brand-teal text-brand-teal hover:bg-brand-teal/10"
                              >
                                <Plus className="w-3 h-3 mr-1" />
                                Add Team
                              </Button>
                            </div>
                            <div className="space-y-1.5">
                              {tournament.teams.map((team) => (
                                <div key={team.id} className="flex items-center gap-2.5 text-sm text-warm-700 dark:text-warm-300 group bg-white dark:bg-warm-800/50 rounded-lg px-3 py-2 border border-warm-100 dark:border-warm-700/50">
                                  <div
                                    className="w-6 h-6 rounded-lg shrink-0 flex items-center justify-center text-white text-[10px] font-bold"
                                    style={{ backgroundColor: team.color }}
                                  >
                                    {team.shortName?.charAt(0) || team.name.charAt(0)}
                                  </div>
                                  <span className="flex-1 truncate font-medium">{team.name}</span>
                                  {team.teamCode && (
                                    <span className="text-[9px] font-mono font-semibold text-brand-teal bg-brand-teal/10 px-1.5 py-0.5 rounded">
                                      {team.teamCode}
                                    </span>
                                  )}
                                  {team.played > 0 && (
                                    <span className="text-[10px] text-warm-500 dark:text-warm-400 font-medium">
                                      P{team.played} W{team.won} Pts{team.points}
                                    </span>
                                  )}
                                  {/* Remove team button */}
                                  {(tournament.status === 'upcoming' || tournament.status === 'ongoing') && (
                                    <button
                                      onClick={() => setRemoveTeamId(team.id)}
                                      className="opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded-md hover:bg-brand-red/10 text-warm-400 hover:text-brand-red"
                                    >
                                      <Trash2 className="w-3 h-3" />
                                    </button>
                                  )}
                                </div>
                              ))}
                              {tournament.teams.length === 0 && (
                                <p className="text-xs text-warm-400 dark:text-warm-500 text-center py-3">No teams yet. Add teams to get started.</p>
                              )}
                            </div>
                          </div>

                          <div className="flex items-center gap-2 text-xs text-warm-500 dark:text-warm-400 bg-warm-100 dark:bg-warm-700/50 rounded-lg px-3 py-2">
                            <Timer className="w-3.5 h-3.5" />
                            <span className="font-medium">{tournament.matchCount} matches scheduled</span>
                          </div>

                          {/* Standings Table */}
                          {tournament.teams.length > 0 && (
                            <div>
                              <h4 className="text-xs font-bold text-warm-500 dark:text-warm-400 uppercase tracking-wider mb-2">Standings</h4>
                              <div className="bg-white dark:bg-warm-800/50 rounded-xl border border-warm-100 dark:border-warm-700/50 overflow-hidden">
                                <div className="grid grid-cols-8 gap-1 text-[10px] text-warm-400 dark:text-warm-500 font-bold uppercase tracking-wider px-3 py-2 bg-warm-50 dark:bg-warm-800 border-b border-warm-100 dark:border-warm-700/50">
                                  <span className="col-span-3">Team</span>
                                  <span className="text-center">P</span>
                                  <span className="text-center">W</span>
                                  <span className="text-center">L</span>
                                  <span className="text-center">SD</span>
                                  <span className="text-center">Pts</span>
                                </div>
                                {[...tournament.teams].sort((a, b) => b.points - a.points).map((team, idx) => (
                                  <div key={team.id} className={`grid grid-cols-8 gap-1 text-warm-700 dark:text-warm-300 px-3 py-2 text-xs ${idx > 0 ? 'border-t border-warm-50 dark:border-warm-700/30' : ''}`}>
                                    <span className="col-span-3 flex items-center gap-1.5 truncate">
                                      <span className="text-[9px] text-warm-400 dark:text-warm-500 font-bold w-3">{idx + 1}</span>
                                      <div className="w-4 h-4 rounded shrink-0" style={{ backgroundColor: team.color }} />
                                      <span className="truncate font-medium">{team.name}</span>
                                    </span>
                                    <span className="text-center">{team.played}</span>
                                    <span className="text-center font-medium text-brand-green">{team.won}</span>
                                    <span className="text-center">{team.lost}</span>
                                    <span className="text-center">{team.scoreDiff > 0 ? '+' : ''}{team.scoreDiff}</span>
                                    <span className="text-center font-bold text-brand-red">{team.points}</span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}

                          {/* Generate Bracket Button (upcoming) */}
                          {tournament.status === 'upcoming' && tournament.teams.length >= 2 && (
                            <Button
                              onClick={() => handleGenerateBracket(tournament.id, tournament.teams.map(t => t.id))}
                              disabled={generatingBracket}
                              className="w-full bg-gradient-to-r from-brand-red to-brand-red-light hover:from-brand-red-dark hover:to-brand-red text-white rounded-xl h-10 text-xs font-bold shadow-lg shadow-brand-red/20"
                            >
                              {generatingBracket ? (
                                <><Loader2 className="w-3 h-3 mr-1 animate-spin" /> Generating...</>
                              ) : (
                                <><Swords className="w-3 h-3 mr-1" /> Generate Bracket & Start</>
                              )}
                            </Button>
                          )}
                          {tournament.status === 'upcoming' && tournament.teams.length < 2 && (
                            <div className="bg-brand-gold/10 dark:bg-brand-gold/20 border border-brand-gold/20 dark:border-brand-gold/30 rounded-xl p-3 text-center">
                              <p className="text-xs text-warm-600 dark:text-warm-300 font-medium">Add at least 2 teams to generate bracket</p>
                            </div>
                          )}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </Card>
              </motion.div>
            );
          })}
        </div>
      )}

      {/* Add Team Dialog */}
      <Dialog open={!!addTeamDialogOpen} onOpenChange={(open) => { if (!open) setAddTeamDialogOpen(null); }}>
        <DialogContent className="bg-warm-50 dark:bg-warm-900 border-warm-300 dark:border-warm-700 max-h-[80vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="text-warm-800 dark:text-warm-100 flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-brand-teal/10 flex items-center justify-center">
                <UserPlus className="w-4 h-4 text-brand-teal" />
              </div>
              Add Teams
              {selectedTeamIds.length > 0 && (
                <Badge className="bg-brand-teal/20 text-brand-teal text-[10px] border-0">
                  {selectedTeamIds.length} selected
                </Badge>
              )}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 mt-2 flex-1 overflow-hidden flex flex-col" ref={teamInputRef}>
            {/* Search Input */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-warm-400" />
              <Input
                placeholder="Search by team name or code (e.g. KT2001)..."
                value={teamSearch}
                onChange={(e) => setTeamSearch(e.target.value)}
                className="pl-9 pr-9 h-10 bg-white dark:bg-warm-800 border-warm-200 dark:border-warm-700 rounded-xl text-sm"
                autoFocus
              />
              {teamSearch && (
                <button
                  onClick={() => { setTeamSearch(''); setTeamSearchResults(getFilteredTeams('')); }}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-warm-400 hover:text-warm-600"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>

            {/* Search Results */}
            <div className="flex-1 overflow-y-auto min-h-0">
              {isSearchingTeams && (
                <div className="px-3 py-2 flex items-center gap-2">
                  <div className="w-3 h-3 border-2 border-brand-teal border-t-transparent rounded-full animate-spin" />
                  <span className="text-xs text-warm-400">Searching...</span>
                </div>
              )}

              {/* Already in tournament teams */}
              {(() => {
                const currentTournament = tournaments.find(t => t.id === addTeamDialogOpen);
                const existingTeamIds = new Set(currentTournament?.teams.map(t => t.id) || []);
                return teamSearchResults.length > 0 ? (
                  <div className="space-y-1">
                    {teamSearchResults.map(team => {
                      const isAlreadyIn = existingTeamIds.has(team.id);
                      const isSelected = selectedTeamIds.includes(team.id);
                      return (
                        <button
                          key={team.id}
                          onClick={() => {
                            if (isAlreadyIn) return;
                            setSelectedTeamIds(prev =>
                              isSelected
                                ? prev.filter(id => id !== team.id)
                                : [...prev, team.id]
                            );
                          }}
                          disabled={isAlreadyIn}
                          className={`w-full flex items-center gap-3 p-2.5 rounded-xl text-left transition-all ${
                            isAlreadyIn
                              ? 'opacity-50 cursor-not-allowed bg-warm-100 dark:bg-warm-800'
                              : isSelected
                                ? 'bg-brand-teal/10 ring-1 ring-brand-teal'
                                : 'hover:bg-warm-50 dark:hover:bg-warm-800 active:bg-warm-100 dark:active:bg-warm-700'
                          }`}
                        >
                          <div
                            className="w-9 h-9 rounded-lg flex items-center justify-center text-xs font-bold text-white overflow-hidden shrink-0"
                            style={{ backgroundColor: team.color || '#475569' }}
                          >
                            {team.shortName?.charAt(0) || team.name.charAt(0)}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-warm-800 dark:text-warm-200 truncate">
                              {highlightMatch(team.name, teamSearch)}
                            </p>
                            <div className="flex items-center gap-2">
                              {team.teamCode && (
                                <span className="text-[10px] font-mono font-semibold text-brand-teal bg-brand-teal/10 px-1.5 py-0.5 rounded">
                                  {highlightMatch(team.teamCode, teamSearch)}
                                </span>
                              )}
                              {team.shortName && (
                                <span className="text-[10px] text-warm-400 dark:text-warm-500">{team.shortName}</span>
                              )}
                            </div>
                          </div>
                          {isAlreadyIn ? (
                            <Badge className="bg-brand-green/10 text-brand-green text-[9px] border-0">In</Badge>
                          ) : isSelected ? (
                            <div className="w-6 h-6 rounded-full bg-brand-teal flex items-center justify-center">
                              <Check className="w-3.5 h-3.5 text-white" />
                            </div>
                          ) : (
                            <div className="w-6 h-6 rounded-full border-2 border-warm-300 dark:border-warm-600" />
                          )}
                        </button>
                      );
                    })}
                  </div>
                ) : !isSearchingTeams && teamSearch.trim() ? (
                  <div className="px-3 py-6 text-center">
                    <p className="text-sm text-warm-500 dark:text-warm-400">No teams found for &quot;{teamSearch}&quot;</p>
                    <p className="text-[10px] text-warm-400 dark:text-warm-500 mt-1">Create a team first from Team Management</p>
                  </div>
                ) : !teamSearch.trim() && allTeams.length === 0 ? (
                  <div className="px-3 py-6 text-center">
                    <p className="text-xs text-warm-400 dark:text-warm-500">No teams in database yet</p>
                  </div>
                ) : null;
              })()}
            </div>

            {/* Selected Teams Chips */}
            {selectedTeamIds.length > 0 && (
              <div className="flex flex-wrap gap-1.5 pt-2 border-t border-warm-200 dark:border-warm-700">
                {selectedTeamIds.map(teamId => {
                  const team = allTeams.find(t => t.id === teamId);
                  return team ? (
                    <Badge
                      key={teamId}
                      className="bg-brand-teal/10 text-brand-teal text-xs border-0 pr-1 gap-1"
                    >
                      {team.name}
                      <button
                        onClick={() => setSelectedTeamIds(prev => prev.filter(id => id !== teamId))}
                        className="hover:text-brand-red"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </Badge>
                  ) : null;
                })}
              </div>
            )}

            {/* Add Button */}
            <Button
              onClick={handleAddTeams}
              disabled={selectedTeamIds.length === 0 || addingTeams}
              className="w-full bg-gradient-to-r from-brand-teal to-teal-400 hover:from-brand-teal/90 hover:to-teal-500 text-white rounded-xl font-bold shadow-lg shadow-brand-teal/20"
            >
              {addingTeams ? (
                <><Loader2 className="w-4 h-4 mr-1 animate-spin" /> Adding...</>
              ) : (
                <><Plus className="w-4 h-4 mr-1" /> Add {selectedTeamIds.length} Team{selectedTeamIds.length !== 1 ? 's' : ''}</>
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Remove Team Confirmation */}
      <Dialog open={!!removeTeamId} onOpenChange={(open) => { if (!open) setRemoveTeamId(null); }}>
        <DialogContent className="bg-warm-50 dark:bg-warm-900 border-warm-300 dark:border-warm-700">
          <DialogHeader>
            <DialogTitle className="text-warm-800 dark:text-warm-100">Remove Team?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-warm-600 dark:text-warm-300">
            This will remove the team and any upcoming matches involving them. This cannot be undone.
          </p>
          <div className="flex gap-2 mt-3">
            <Button
              variant="outline"
              onClick={() => setRemoveTeamId(null)}
              className="flex-1 rounded-xl"
            >
              Cancel
            </Button>
            <Button
              onClick={() => {
                if (expandedId && removeTeamId) {
                  handleRemoveTeam(expandedId, removeTeamId);
                }
              }}
              disabled={removingTeam}
              className="flex-1 bg-brand-red hover:bg-brand-red-dark text-white rounded-xl"
            >
              {removingTeam ? (
                <><Loader2 className="w-4 h-4 mr-1 animate-spin" /> Removing...</>
              ) : (
                'Remove'
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
