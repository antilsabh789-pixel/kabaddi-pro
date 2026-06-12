'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, MapPin, Calendar, Users, ChevronDown, ChevronUp, Trophy, Crown, Lock, Loader2, Search, X, Copy, Check, Hash, UserPlus, Trash2 } from 'lucide-react';
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
  }, [tournamentSearch]); // eslint-disable-line react-hooks/exhaustive-deps

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
        <h1 className="text-xl font-bold text-warm-800 flex items-center gap-2">
          <Trophy className="w-5 h-5 text-brand-gold" />
          Tournaments
        </h1>
        <div className="flex items-center gap-2">
          <Button
            onClick={handleCreateClick}
            className={`rounded-xl h-9 px-3 ${
              isPremium
                ? 'bg-brand-red hover:bg-brand-red-dark text-white'
                : 'bg-gradient-to-r from-brand-gold-dark via-brand-gold to-brand-gold-light text-white hover:opacity-90'
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
        </div>

        {/* Create Tournament Dialog */}
        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogContent className="bg-warm-50 border-warm-300">
            <DialogHeader>
              <DialogTitle className="text-warm-800 flex items-center gap-2">
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
                className="bg-white border-warm-300 rounded-xl"
              />
              <Input
                placeholder="Venue"
                value={newTournament.venue}
                onChange={(e) => setNewTournament({ ...newTournament, venue: e.target.value })}
                className="bg-white border-warm-300 rounded-xl"
              />
              <div className="grid grid-cols-3 gap-2">
                {(['knockout', 'league', 'hybrid'] as const).map((t) => (
                  <button
                    key={t}
                    onClick={() => setNewTournament({ ...newTournament, type: t })}
                    className={`p-2 rounded-xl border-2 text-xs font-medium capitalize ${
                      newTournament.type === t
                        ? 'border-brand-red bg-brand-red/10 text-brand-red'
                        : 'border-warm-300 text-warm-600'
                    }`}
                  >
                    {t}
                  </button>
                ))}
              </div>
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => setNewTournament({ ...newTournament, gender: 'male' })}
                  className={`p-3 rounded-xl border-2 text-sm font-medium ${
                    newTournament.gender === 'male'
                      ? 'border-brand-blue bg-brand-blue/10 text-brand-blue'
                      : 'border-warm-300 text-warm-600'
                  }`}
                >
                  ♂ Boys
                </button>
                <button
                  onClick={() => setNewTournament({ ...newTournament, gender: 'female' })}
                  className={`p-3 rounded-xl border-2 text-sm font-medium ${
                    newTournament.gender === 'female'
                      ? 'border-brand-red bg-brand-red/10 text-brand-red'
                      : 'border-warm-300 text-warm-600'
                  }`}
                >
                  ♀ Girls
                </button>
              </div>
              <div className="bg-warm-100 rounded-xl p-3 text-center">
                <p className="text-xs text-warm-500">A unique tournament code will be auto-generated</p>
                <p className="text-[10px] text-warm-400">Share this code so others can easily find & join</p>
              </div>
              <Button
                onClick={handleCreateTournament}
                disabled={!newTournament.name}
                className="w-full bg-brand-red hover:bg-brand-red-dark text-white rounded-xl"
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
          className="pl-9 pr-9 h-10 bg-white border-warm-300 rounded-xl text-sm"
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
          <Card className="p-3 bg-gradient-to-r from-brand-gold/10 to-brand-gold/5 border border-brand-gold/20 cursor-pointer active:scale-[0.98] transition-transform"
            onClick={() => setShowUpgrade(true)}
          >
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-brand-gold/20 flex items-center justify-center shrink-0">
                <Crown className="w-4 h-4 text-brand-gold" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-warm-800">Want to host your own tournament?</p>
                <p className="text-[10px] text-warm-500">Upgrade to Premium to create and manage tournaments</p>
              </div>
              <Lock className="w-4 h-4 text-brand-gold shrink-0" />
            </div>
          </Card>
        </motion.div>
      )}

      {/* Status Tabs */}
      <div className="flex gap-2">
        {(['ongoing', 'upcoming', 'past'] as const).map((s) => (
          <button
            key={s}
            onClick={() => setStatusFilter(s)}
            className={`px-4 py-1.5 rounded-full text-sm font-medium capitalize transition-all ${
              statusFilter === s
                ? 'bg-brand-red text-white'
                : 'bg-warm-200 text-warm-600'
            }`}
          >
            {s}
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
            className={`px-3 py-1 rounded-full text-xs font-medium transition-all ${
              genderFilter === f.id
                ? 'bg-warm-700 text-white'
                : 'bg-warm-200 text-warm-500'
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
            <div key={i} className="h-32 bg-warm-200 rounded-xl animate-pulse" />
          ))}
        </div>
      ) : filteredTournaments.length === 0 ? (
        <Card className="p-8 text-center">
          <div className="text-3xl mb-2">🏆</div>
          <p className="text-warm-500 text-sm">No tournaments found</p>
          {tournamentSearch && (
            <p className="text-xs text-warm-400 mt-1">
              Try searching by tournament code like &quot;TC3001&quot;
            </p>
          )}
        </Card>
      ) : (
        <div className="space-y-3">
          {filteredTournaments.map((tournament, i) => (
            <motion.div
              key={tournament.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
            >
              <Card className="overflow-hidden border border-warm-300">
                <div
                  className="p-4 cursor-pointer"
                  onClick={() => setExpandedId(expandedId === tournament.id ? null : tournament.id)}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <h3 className="font-bold text-warm-800 text-sm truncate">
                        {tournament.name}
                      </h3>
                      {/* Tournament Code Badge */}
                      {tournament.tournamentCode && (
                        <div
                          className="inline-flex items-center gap-1 mt-1 px-2 py-0.5 rounded-md bg-brand-teal/10 cursor-pointer hover:bg-brand-teal/20 transition-colors"
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
                      <div className="flex items-center gap-1 mt-1 text-xs text-warm-500">
                        <MapPin className="w-3 h-3" />
                        <span className="truncate">{tournament.venue}</span>
                      </div>
                      <div className="flex items-center gap-1 mt-0.5 text-xs text-warm-500">
                        <Calendar className="w-3 h-3" />
                        <span>{tournament.startDate || 'TBD'}</span>
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      <Badge
                        variant="secondary"
                        className={`text-[10px] ${
                          tournament.gender === 'male'
                            ? 'bg-brand-blue/10 text-brand-blue'
                            : 'bg-brand-red/10 text-brand-red'
                        }`}
                      >
                        {tournament.gender === 'male' ? '♂ Boys' : '♀ Girls'}
                      </Badge>
                      <Badge variant="secondary" className="text-[10px] bg-warm-200 text-warm-600 capitalize">
                        {tournament.type}
                      </Badge>
                      <div className="flex items-center gap-1 text-xs text-warm-500">
                        <Users className="w-3 h-3" />
                        {tournament.teams.length}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between mt-2">
                    <div className="flex -space-x-1">
                      {tournament.teams.slice(0, 4).map((team) => (
                        <div
                          key={team.id}
                          className="w-6 h-6 rounded-full border-2 border-white flex items-center justify-center text-[8px] font-bold text-white"
                          style={{ backgroundColor: team.color }}
                        >
                          {team.shortName?.charAt(0) || team.name.charAt(0)}
                        </div>
                      ))}
                      {tournament.teams.length > 4 && (
                        <div className="w-6 h-6 rounded-full border-2 border-white bg-warm-300 flex items-center justify-center text-[8px] font-bold text-warm-600">
                          +{tournament.teams.length - 4}
                        </div>
                      )}
                    </div>
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
                      <div className="border-t border-warm-200 p-4 bg-warm-100/50 space-y-4">
                        {/* Tournament Code Display */}
                        {tournament.tournamentCode && (
                          <div className="flex items-center justify-between bg-white rounded-xl p-3 border border-warm-200">
                            <div>
                              <p className="text-[10px] text-warm-400 uppercase font-semibold tracking-wider">Tournament Code</p>
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
                            <h4 className="text-xs font-medium text-warm-500">Teams ({tournament.teams.length})</h4>
                            {/* Add Team Button - available for upcoming AND ongoing */}
                            <Button
                              onClick={() => openAddTeamDialog(tournament.id)}
                              variant="outline"
                              size="sm"
                              className="rounded-lg h-7 px-2 text-[10px] border-brand-teal text-brand-teal hover:bg-brand-teal/10"
                            >
                              <Plus className="w-3 h-3 mr-1" />
                              Add Team
                            </Button>
                          </div>
                          <div className="space-y-1">
                            {tournament.teams.map((team) => (
                              <div key={team.id} className="flex items-center gap-2 text-sm text-warm-700 group">
                                <div
                                  className="w-4 h-4 rounded-full shrink-0"
                                  style={{ backgroundColor: team.color }}
                                />
                                <span className="flex-1 truncate">{team.name}</span>
                                {team.teamCode && (
                                  <span className="text-[9px] font-mono font-semibold text-brand-teal bg-brand-teal/10 px-1.5 py-0.5 rounded">
                                    {team.teamCode}
                                  </span>
                                )}
                                {team.played > 0 && (
                                  <span className="text-xs text-warm-500">
                                    P{team.played} W{team.won} Pts{team.points}
                                  </span>
                                )}
                                {/* Remove team button - only for upcoming/ongoing */}
                                {(tournament.status === 'upcoming' || tournament.status === 'ongoing') && (
                                  <button
                                    onClick={() => setRemoveTeamId(team.id)}
                                    className="opacity-0 group-hover:opacity-100 transition-opacity p-0.5 rounded hover:bg-brand-red/10 text-warm-400 hover:text-brand-red"
                                  >
                                    <Trash2 className="w-3 h-3" />
                                  </button>
                                )}
                              </div>
                            ))}
                            {tournament.teams.length === 0 && (
                              <p className="text-xs text-warm-400 text-center py-2">No teams yet. Add teams to get started.</p>
                            )}
                          </div>
                        </div>

                        <div className="text-xs text-warm-500">
                          {tournament.matchCount} matches scheduled
                        </div>

                        {/* Standings Table */}
                        {tournament.teams.length > 0 && (
                          <div>
                            <h4 className="text-xs font-medium text-warm-500 mb-2">Standings</h4>
                            <div className="text-xs">
                              <div className="grid grid-cols-7 gap-1 text-warm-400 font-medium mb-1">
                                <span className="col-span-2">Team</span>
                                <span className="text-center">P</span>
                                <span className="text-center">W</span>
                                <span className="text-center">L</span>
                                <span className="text-center">SD</span>
                                <span className="text-center">Pts</span>
                              </div>
                              {[...tournament.teams].sort((a, b) => b.points - a.points).map((team) => (
                                <div key={team.id} className="grid grid-cols-7 gap-1 text-warm-700 py-0.5">
                                  <span className="col-span-2 flex items-center gap-1 truncate">
                                    <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: team.color }} />
                                    {team.name}
                                  </span>
                                  <span className="text-center">{team.played}</span>
                                  <span className="text-center">{team.won}</span>
                                  <span className="text-center">{team.lost}</span>
                                  <span className="text-center">{team.scoreDiff > 0 ? '+' : ''}{team.scoreDiff}</span>
                                  <span className="text-center font-semibold">{team.points}</span>
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
                            className="w-full bg-brand-red hover:bg-brand-red-dark text-white rounded-xl h-9 text-xs"
                          >
                            {generatingBracket ? (
                              <><Loader2 className="w-3 h-3 mr-1 animate-spin" /> Generating...</>
                            ) : (
                              'Generate Bracket & Start'
                            )}
                          </Button>
                        )}
                        {tournament.status === 'upcoming' && tournament.teams.length < 2 && (
                          <div className="bg-brand-gold/10 border border-brand-gold/20 rounded-xl p-3 text-center">
                            <p className="text-xs text-warm-600">Add at least 2 teams to generate bracket</p>
                          </div>
                        )}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </Card>
            </motion.div>
          ))}
        </div>
      )}

      {/* Add Team Dialog */}
      <Dialog open={!!addTeamDialogOpen} onOpenChange={(open) => { if (!open) setAddTeamDialogOpen(null); }}>
        <DialogContent className="bg-warm-50 border-warm-300 max-h-[80vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="text-warm-800 flex items-center gap-2">
              <UserPlus className="w-4 h-4 text-brand-teal" />
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
                className="pl-9 pr-9 h-10 bg-white border-warm-300 rounded-xl text-sm"
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
                          className={`w-full flex items-center gap-3 p-2.5 rounded-xl text-left transition-colors ${
                            isAlreadyIn
                              ? 'opacity-50 cursor-not-allowed bg-warm-100'
                              : isSelected
                                ? 'bg-brand-teal/10 ring-1 ring-brand-teal'
                                : 'hover:bg-warm-50 active:bg-warm-100'
                          }`}
                        >
                          <div
                            className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white overflow-hidden shrink-0"
                            style={{ backgroundColor: team.color || '#475569' }}
                          >
                            {team.shortName?.charAt(0) || team.name.charAt(0)}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-warm-800 truncate">
                              {highlightMatch(team.name, teamSearch)}
                            </p>
                            <div className="flex items-center gap-2">
                              {team.teamCode && (
                                <span className="text-[10px] font-mono font-semibold text-brand-teal bg-brand-teal/10 px-1.5 py-0.5 rounded">
                                  {highlightMatch(team.teamCode, teamSearch)}
                                </span>
                              )}
                              {team.shortName && (
                                <span className="text-[10px] text-warm-400">{team.shortName}</span>
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
                            <div className="w-6 h-6 rounded-full border-2 border-warm-300" />
                          )}
                        </button>
                      );
                    })}
                  </div>
                ) : !isSearchingTeams && teamSearch.trim() ? (
                  <div className="px-3 py-6 text-center">
                    <p className="text-sm text-warm-500">No teams found for &quot;{teamSearch}&quot;</p>
                    <p className="text-[10px] text-warm-400 mt-1">Create a team first from Team Management</p>
                  </div>
                ) : !teamSearch.trim() && allTeams.length === 0 ? (
                  <div className="px-3 py-6 text-center">
                    <p className="text-xs text-warm-400">No teams in database yet</p>
                  </div>
                ) : null;
              })()}
            </div>

            {/* Selected Teams Chips */}
            {selectedTeamIds.length > 0 && (
              <div className="flex flex-wrap gap-1.5 pt-2 border-t border-warm-200">
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
              className="w-full bg-brand-teal hover:bg-brand-teal/90 text-white rounded-xl"
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
        <DialogContent className="bg-warm-50 border-warm-300">
          <DialogHeader>
            <DialogTitle className="text-warm-800">Remove Team?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-warm-600">
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
