'use client';

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X,
  Swords,
  Shield,
  MessageSquare,
  Check,
  XCircle,
  Clock,
  Trophy,
  AlertCircle,
  Search,
  ChevronDown,
  Eye,
  ExternalLink,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useKabaddiStore } from '@/lib/store';
import { useToast } from '@/hooks/use-toast';

// ─── Types ────────────────────────────────────────────────────────

interface TeamBasic {
  id: string;
  name: string;
  shortName: string | null;
  color: string | null;
}

interface ChallengeItem {
  id: string;
  fromTeamId: string;
  toTeamId: string;
  fromUserId: string;
  toUserId: string | null;
  message: string | null;
  status: string;
  matchId: string | null;
  createdAt: string;
  expiresAt: string | null;
  fromTeam: TeamBasic;
  toTeam: TeamBasic;
  fromUser: { id: string; name: string; avatar: string | null };
  toUser: { id: string; name: string; avatar: string | null } | null;
}

interface HeadToHead {
  teamId: string;
  name: string;
  wins: number;
  losses: number;
  draws: number;
}

type TabId = 'pending' | 'history' | 'send';

// ─── Status Configuration ─────────────────────────────────────────

interface StatusConfig {
  icon: typeof Clock;
  color: string;
  bg: string;
  darkBg: string;
  border: string;
  label: string;
  glow: string;
}

const STATUS_CONFIG: Record<string, StatusConfig> = {
  pending: {
    icon: Clock,
    color: 'text-amber-500',
    bg: 'bg-amber-50',
    darkBg: 'dark:bg-amber-500/10',
    border: 'border-amber-200 dark:border-amber-500/20',
    label: 'Pending',
    glow: 'shadow-amber-200/40 dark:shadow-amber-500/10',
  },
  accepted: {
    icon: Check,
    color: 'text-emerald-500',
    bg: 'bg-emerald-50',
    darkBg: 'dark:bg-emerald-500/10',
    border: 'border-emerald-200 dark:border-emerald-500/20',
    label: 'Accepted',
    glow: 'shadow-emerald-200/40 dark:shadow-emerald-500/10',
  },
  declined: {
    icon: XCircle,
    color: 'text-red-500',
    bg: 'bg-red-50',
    darkBg: 'dark:bg-red-500/10',
    border: 'border-red-200 dark:border-red-500/20',
    label: 'Declined',
    glow: 'shadow-red-200/40 dark:shadow-red-500/10',
  },
  completed: {
    icon: Trophy,
    color: 'text-brand-gold',
    bg: 'bg-brand-gold/5',
    darkBg: 'dark:bg-brand-gold/10',
    border: 'border-brand-gold/20 dark:border-brand-gold/20',
    label: 'Completed',
    glow: 'shadow-brand-gold/20 dark:shadow-brand-gold/10',
  },
  expired: {
    icon: AlertCircle,
    color: 'text-warm-400',
    bg: 'bg-warm-50',
    darkBg: 'dark:bg-warm-800/30',
    border: 'border-warm-200 dark:border-warm-700',
    label: 'Expired',
    glow: '',
  },
};

function getStatusConfig(status: string): StatusConfig {
  return STATUS_CONFIG[status] ?? STATUS_CONFIG.expired;
}

// ─── Searchable Team Select ───────────────────────────────────────

function SearchableTeamSelect({
  teams,
  selectedTeamId,
  onSelect,
  label,
  placeholder,
  excludeTeamId,
}: {
  teams: TeamBasic[];
  selectedTeamId: string;
  onSelect: (id: string) => void;
  label: string;
  placeholder: string;
  excludeTeamId?: string;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);

  const filteredTeams = useMemo(
    () =>
      teams
        .filter((t) => !excludeTeamId || t.id !== excludeTeamId)
        .filter(
          (t) =>
            t.name.toLowerCase().includes(search.toLowerCase()) ||
            (t.shortName && t.shortName.toLowerCase().includes(search.toLowerCase()))
        ),
    [teams, excludeTeamId, search]
  );

  const selectedTeam = teams.find((t) => t.id === selectedTeamId);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div ref={containerRef}>
      <label className="text-xs font-semibold text-warm-600 dark:text-warm-400 mb-1.5 block">
        {label}
      </label>
      <div className="relative">
        <button
          type="button"
          onClick={() => setOpen(!open)}
          className="w-full h-10 rounded-xl border border-warm-300 dark:border-warm-700 bg-white/80 dark:bg-warm-800/80 backdrop-blur-sm px-3 text-sm text-warm-800 dark:text-warm-200 flex items-center justify-between hover:border-brand-red/40 focus:outline-none focus:ring-2 focus:ring-brand-red/20 transition-all"
        >
          <div className="flex items-center gap-2 min-w-0">
            {selectedTeam ? (
              <>
                <div
                  className="w-6 h-6 rounded-md flex items-center justify-center text-[9px] font-bold text-white shrink-0"
                  style={{ backgroundColor: selectedTeam.color || '#64748B' }}
                >
                  {(selectedTeam.shortName || selectedTeam.name.slice(0, 2)).toUpperCase()}
                </div>
                <span className="truncate">{selectedTeam.name}</span>
              </>
            ) : (
              <span className="text-warm-400">{placeholder}</span>
            )}
          </div>
          <ChevronDown className={`w-4 h-4 text-warm-400 transition-transform ${open ? 'rotate-180' : ''}`} />
        </button>

        <AnimatePresence>
          {open && (
            <motion.div
              initial={{ opacity: 0, y: -4, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -4, scale: 0.98 }}
              transition={{ duration: 0.15 }}
              className="absolute z-20 top-full mt-1 w-full bg-white dark:bg-warm-800 border border-warm-200 dark:border-warm-700 rounded-xl shadow-lg overflow-hidden"
            >
              <div className="p-2 border-b border-warm-100 dark:border-warm-700">
                <div className="relative">
                  <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-warm-400" />
                  <input
                    type="text"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search teams..."
                    className="w-full h-8 pl-8 pr-3 rounded-lg bg-warm-50 dark:bg-warm-900 text-xs text-warm-800 dark:text-warm-200 placeholder:text-warm-400 focus:outline-none"
                    autoFocus
                  />
                </div>
              </div>
              <div className="max-h-48 overflow-y-auto custom-scrollbar">
                {filteredTeams.length === 0 ? (
                  <p className="p-3 text-xs text-warm-400 text-center">No teams found</p>
                ) : (
                  filteredTeams.map((team) => (
                    <button
                      key={team.id}
                      type="button"
                      onClick={() => {
                        onSelect(team.id);
                        setOpen(false);
                        setSearch('');
                      }}
                      className={`w-full flex items-center gap-2.5 px-3 py-2.5 text-sm hover:bg-warm-50 dark:hover:bg-warm-700/50 transition-colors ${
                        team.id === selectedTeamId
                          ? 'bg-brand-red/5 dark:bg-brand-red/10 text-brand-red'
                          : 'text-warm-800 dark:text-warm-200'
                      }`}
                    >
                      <div
                        className="w-7 h-7 rounded-lg flex items-center justify-center text-[10px] font-bold text-white shrink-0"
                        style={{ backgroundColor: team.color || '#64748B' }}
                      >
                        {(team.shortName || team.name.slice(0, 2)).toUpperCase()}
                      </div>
                      <div className="text-left min-w-0">
                        <p className="font-semibold text-xs truncate">{team.name}</p>
                        {team.shortName && (
                          <p className="text-[10px] text-warm-400">{team.shortName}</p>
                        )}
                      </div>
                    </button>
                  ))
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

// ─── Confirmation Modal ───────────────────────────────────────────

function ConfirmChallengeModal({
  fromTeam,
  toTeam,
  message,
  onConfirm,
  onCancel,
  sending,
}: {
  fromTeam: TeamBasic | undefined;
  toTeam: TeamBasic | undefined;
  message: string;
  onConfirm: () => void;
  onCancel: () => void;
  sending: boolean;
}) {
  if (!fromTeam || !toTeam) return null;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onCancel(); }}
    >
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.9, opacity: 0 }}
        transition={{ type: 'spring', damping: 25, stiffness: 300 }}
        className="w-full max-w-xs bg-white dark:bg-warm-900 rounded-2xl shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-5">
          <h3 className="text-base font-black text-warm-800 dark:text-warm-200 text-center mb-4">
            Confirm Challenge?
          </h3>

          <div className="flex items-center justify-between gap-3 mb-4">
            <div className="flex-1 text-center">
              <div
                className="w-12 h-12 rounded-xl mx-auto flex items-center justify-center text-white font-bold text-sm shadow-md"
                style={{ backgroundColor: fromTeam.color || '#64748B' }}
              >
                {(fromTeam.shortName || fromTeam.name.slice(0, 2)).toUpperCase()}
              </div>
              <p className="text-xs font-semibold text-warm-800 dark:text-warm-200 mt-1.5 truncate">
                {fromTeam.name}
              </p>
            </div>

            <div className="flex flex-col items-center">
              <Swords className="w-5 h-5 text-brand-red" />
            </div>

            <div className="flex-1 text-center">
              <div
                className="w-12 h-12 rounded-xl mx-auto flex items-center justify-center text-white font-bold text-sm shadow-md"
                style={{ backgroundColor: toTeam.color || '#64748B' }}
              >
                {(toTeam.shortName || toTeam.name.slice(0, 2)).toUpperCase()}
              </div>
              <p className="text-xs font-semibold text-warm-800 dark:text-warm-200 mt-1.5 truncate">
                {toTeam.name}
              </p>
            </div>
          </div>

          {message && (
            <div className="mb-4 p-2.5 rounded-lg bg-warm-50 dark:bg-warm-800 border border-warm-200 dark:border-warm-700">
              <p className="text-xs text-warm-600 dark:text-warm-400 italic">&ldquo;{message}&rdquo;</p>
            </div>
          )}

          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={onCancel}
              disabled={sending}
              className="flex-1 h-10 rounded-xl text-xs font-bold"
            >
              Cancel
            </Button>
            <Button
              onClick={onConfirm}
              disabled={sending}
              className="flex-1 h-10 bg-brand-red hover:bg-brand-red-dark text-white rounded-xl text-xs font-bold"
            >
              {sending ? (
                <motion.div
                  className="w-4 h-4 border-2 border-white border-t-transparent rounded-full"
                  animate={{ rotate: 360 }}
                  transition={{ duration: 0.6, repeat: Infinity, ease: 'linear' }}
                />
              ) : (
                <>
                  <Swords className="w-3.5 h-3.5 mr-1.5" />
                  Send Challenge
                </>
              )}
            </Button>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}

// ─── Challenge Card ───────────────────────────────────────────────

function ChallengeCard({
  challenge,
  isIncoming,
  onAccept,
  onDecline,
  onViewMatch,
  index,
}: {
  challenge: ChallengeItem;
  isIncoming: boolean;
  onAccept: (id: string) => void;
  onDecline: (id: string) => void;
  onViewMatch: (matchId: string) => void;
  index: number;
}) {
  const statusConfig = getStatusConfig(challenge.status);
  const StatusIcon = statusConfig.icon;
  const fromTeam = challenge.fromTeam;
  const toTeam = challenge.toTeam;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{
        delay: Math.min(index * 0.05, 0.3),
        type: 'spring',
        damping: 20,
        stiffness: 200,
      }}
    >
      <Card
        className={`${statusConfig.bg} ${statusConfig.darkBg} ${statusConfig.border} border backdrop-blur-md bg-white/70 dark:bg-warm-900/70 shadow-sm ${statusConfig.glow ? `shadow-md ${statusConfig.glow}` : ''} overflow-hidden`}
      >
        <CardContent className="p-4">
          {/* Header */}
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-1.5">
              <Badge className={`${statusConfig.bg} ${statusConfig.darkBg} ${statusConfig.color} text-[10px] font-semibold border-0`}>
                <StatusIcon className="w-3 h-3 mr-0.5" />
                {statusConfig.label}
              </Badge>
              {isIncoming && challenge.status === 'pending' && (
                <Badge className="bg-brand-teal/10 text-brand-teal text-[9px] font-semibold border-0">
                  Incoming
                </Badge>
              )}
            </div>
            <span className="text-[10px] text-warm-400 dark:text-warm-500">
              {formatDate(challenge.createdAt)}
            </span>
          </div>

          {/* Teams */}
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2 flex-1">
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center text-[11px] font-bold text-white shadow-sm"
                style={{
                  backgroundColor: fromTeam.color || '#DC2626',
                  boxShadow: `0 2px 8px ${fromTeam.color || '#DC2626'}30`,
                }}
              >
                {fromTeam.shortName || fromTeam.name.slice(0, 2).toUpperCase()}
              </div>
              <div className="min-w-0">
                <p className="text-sm font-bold text-warm-800 dark:text-warm-200 truncate">
                  {fromTeam.name}
                </p>
                <p className="text-[10px] text-warm-400 dark:text-warm-500">
                  {isIncoming ? 'Challenger' : 'Your Team'}
                </p>
              </div>
            </div>

            <div className="px-3 flex flex-col items-center">
              <Swords className="w-5 h-5 text-brand-red/60" />
              <span className="text-[8px] text-warm-400 font-bold uppercase mt-0.5">VS</span>
            </div>

            <div className="flex items-center gap-2 flex-1 justify-end">
              <div className="min-w-0 text-right">
                <p className="text-sm font-bold text-warm-800 dark:text-warm-200 truncate">
                  {toTeam.name}
                </p>
                <p className="text-[10px] text-warm-400 dark:text-warm-500">
                  {isIncoming ? 'Your Team' : 'Opponent'}
                </p>
              </div>
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center text-[11px] font-bold text-white shadow-sm"
                style={{
                  backgroundColor: toTeam.color || '#1E293B',
                  boxShadow: `0 2px 8px ${toTeam.color || '#1E293B'}30`,
                }}
              >
                {toTeam.shortName || toTeam.name.slice(0, 2).toUpperCase()}
              </div>
            </div>
          </div>

          {/* Message */}
          {challenge.message && (
            <div className="mb-3 p-2 rounded-lg bg-warm-100/60 dark:bg-warm-800/40 border border-warm-200/50 dark:border-warm-700/30">
              <p className="text-xs text-warm-600 dark:text-warm-400 italic flex items-start gap-1.5">
                <MessageSquare className="w-3 h-3 shrink-0 mt-0.5 text-warm-400" />
                &ldquo;{challenge.message}&rdquo;
              </p>
            </div>
          )}

          {/* Expires at */}
          {challenge.status === 'pending' && challenge.expiresAt && (
            <p className="text-[10px] text-warm-400 dark:text-warm-500 mb-2">
              Expires: {formatDate(challenge.expiresAt)}
            </p>
          )}

          {/* Actions */}
          {isIncoming && challenge.status === 'pending' && (
            <motion.div
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="flex gap-2 mt-1"
            >
              <Button
                onClick={() => onAccept(challenge.id)}
                className="flex-1 bg-emerald-500 hover:bg-emerald-600 text-white h-9 text-xs font-bold rounded-xl shadow-sm"
                whileTap={{ scale: 0.97 }}
              >
                <Shield className="w-3.5 h-3.5 mr-1.5" />
                Accept
              </Button>
              <Button
                onClick={() => onDecline(challenge.id)}
                variant="outline"
                className="flex-1 border-red-300 dark:border-red-500/30 text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 h-9 text-xs font-bold rounded-xl"
              >
                <XCircle className="w-3.5 h-3.5 mr-1.5" />
                Decline
              </Button>
            </motion.div>
          )}

          {/* View Match Result */}
          {challenge.status === 'completed' && challenge.matchId && (
            <Button
              onClick={() => onViewMatch(challenge.matchId!)}
              variant="outline"
              className="w-full mt-1 border-brand-gold/30 dark:border-brand-gold/20 text-brand-gold hover:bg-brand-gold/5 dark:hover:bg-brand-gold/10 h-8 text-xs font-bold rounded-xl"
            >
              <Eye className="w-3 h-3 mr-1.5" />
              View Match Result
              <ExternalLink className="w-3 h-3 ml-1.5" />
            </Button>
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
}

// ─── Helper ───────────────────────────────────────────────────────

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

// ─── Main Component ───────────────────────────────────────────────

export default function ChallengeScreen({ onClose }: { onClose: () => void }) {
  const currentUser = useKabaddiStore((s) => s.currentUser);
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState<TabId>('pending');
  const [challenges, setChallenges] = useState<ChallengeItem[]>([]);
  const [rivalries, setRivalries] = useState<HeadToHead[]>([]);
  const [teams, setTeams] = useState<TeamBasic[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [selectedFromTeam, setSelectedFromTeam] = useState<string>('');
  const [selectedToTeam, setSelectedToTeam] = useState<string>('');
  const [challengeMessage, setChallengeMessage] = useState('');
  const [showConfirm, setShowConfirm] = useState(false);
  const [expandedHistory, setExpandedHistory] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    if (!currentUser?.id) return;
    setLoading(true);
    try {
      const [challengesRes, teamsRes] = await Promise.all([
        fetch(`/api/challenges?userId=${currentUser.id}`),
        fetch('/api/teams'),
      ]);

      if (challengesRes.ok) {
        const data = await challengesRes.json();
        setChallenges(data.challenges || []);
        setRivalries(data.headToHead || []);
      }

      if (teamsRes.ok) {
        const data = await teamsRes.json();
        setTeams(data.teams || data || []);
      }
    } catch (err) {
      console.error('Failed to load challenges:', err);
    } finally {
      setLoading(false);
    }
  }, [currentUser?.id]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleSendChallenge = async () => {
    if (!selectedFromTeam || !selectedToTeam || !currentUser?.id) return;

    if (selectedFromTeam === selectedToTeam) {
      toast({ title: 'Cannot challenge your own team!', variant: 'destructive' });
      return;
    }

    setSending(true);
    try {
      const res = await fetch('/api/challenges', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fromTeamId: selectedFromTeam,
          toTeamId: selectedToTeam,
          fromUserId: currentUser.id,
          message: challengeMessage || null,
        }),
      });

      const data = await res.json();
      if (res.ok) {
        toast({
          title: 'Challenge Sent!',
          description: `Your team has challenged ${data.challenge?.toTeam?.name || 'the opponent'}`,
        });
        setChallengeMessage('');
        setSelectedFromTeam('');
        setSelectedToTeam('');
        setShowConfirm(false);
        loadData();
      } else {
        toast({ title: 'Error', description: data.error || 'Failed to send challenge', variant: 'destructive' });
      }
    } catch {
      toast({ title: 'Error', description: 'Failed to send challenge', variant: 'destructive' });
    } finally {
      setSending(false);
    }
  };

  const handleRespond = async (challengeId: string, action: 'accept' | 'decline') => {
    try {
      const res = await fetch('/api/challenges', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ challengeId, action }),
      });

      if (res.ok) {
        toast({
          title: action === 'accept' ? 'Challenge Accepted!' : 'Challenge Declined',
          description: action === 'accept' ? 'Get ready for the match!' : 'Challenge declined.',
        });
        loadData();
      }
    } catch {
      toast({ title: 'Error', description: 'Failed to respond', variant: 'destructive' });
    }
  };

  const handleViewMatch = (matchId: string) => {
    // Navigate to match details — for now, show a toast
    toast({
      title: 'Match Result',
      description: `Match ${matchId} — view details in match history`,
    });
  };

  // Categorize challenges
  const pendingChallenges = challenges.filter(
    (c) => c.status === 'pending'
  );
  const historyChallenges = challenges.filter(
    (c) => c.status !== 'pending'
  );

  const selectedFromTeamData = teams.find((t) => t.id === selectedFromTeam);
  const selectedToTeamData = teams.find((t) => t.id === selectedToTeam);

  const tabs: { id: TabId; label: string; icon: typeof Swords; count?: number }[] = [
    { id: 'pending', label: 'Challenges', icon: Swords, count: pendingChallenges.length },
    { id: 'history', label: 'History', icon: Shield, count: historyChallenges.length },
    { id: 'send', label: 'Send', icon: MessageSquare },
  ];

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 bg-warm-50 dark:bg-warm-950 overflow-y-auto"
    >
      {/* Header */}
      <div className="sticky top-0 z-10 bg-gradient-to-r from-brand-red to-brand-red-dark">
        <div className="flex items-center justify-between px-4 py-4">
          <div className="flex items-center gap-2">
            <Swords className="w-5 h-5 text-white" />
            <h1 className="text-lg font-bold text-white">Challenges</h1>
          </div>
          <button onClick={onClose} className="p-2 rounded-full hover:bg-white/20 transition-colors">
            <X className="w-5 h-5 text-white" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex px-4 pb-0">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 text-sm font-semibold transition-colors border-b-2 relative ${
                activeTab === tab.id
                  ? 'text-white border-white'
                  : 'text-white/60 border-transparent hover:text-white/80'
              }`}
            >
              <tab.icon className="w-3.5 h-3.5" />
              {tab.label}
              {tab.count !== undefined && tab.count > 0 && (
                <span className="ml-0.5 w-5 h-5 rounded-full bg-white/20 text-[10px] font-bold flex items-center justify-center">
                  {tab.count}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="px-4 py-4 pb-8">
        <AnimatePresence mode="wait">
          {/* ─── Pending Challenges Tab ─── */}
          {activeTab === 'pending' && (
            <motion.div
              key="pending"
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 10 }}
              className="space-y-3"
            >
              {loading ? (
                [1, 2, 3].map((i) => (
                  <div key={i} className="h-32 bg-warm-100 dark:bg-warm-800 rounded-xl animate-pulse" />
                ))
              ) : pendingChallenges.length === 0 ? (
                <Card className="p-8 text-center bg-white/70 dark:bg-warm-900/70 backdrop-blur-md border-warm-200 dark:border-warm-700">
                  <div className="w-16 h-16 rounded-2xl bg-warm-100 dark:bg-warm-800 flex items-center justify-center mx-auto mb-3">
                    <Swords className="w-8 h-8 text-warm-300 dark:text-warm-600" />
                  </div>
                  <p className="text-warm-600 dark:text-warm-300 font-bold">No pending challenges</p>
                  <p className="text-warm-400 text-sm mt-1">Challenge a team to get started!</p>
                </Card>
              ) : (
                pendingChallenges.map((challenge, index) => {
                  const isIncoming = challenge.toUserId === currentUser?.id;
                  return (
                    <ChallengeCard
                      key={challenge.id}
                      challenge={challenge}
                      isIncoming={isIncoming}
                      onAccept={(id) => handleRespond(id, 'accept')}
                      onDecline={(id) => handleRespond(id, 'decline')}
                      onViewMatch={handleViewMatch}
                      index={index}
                    />
                  );
                })
              )}
            </motion.div>
          )}

          {/* ─── History Tab ─── */}
          {activeTab === 'history' && (
            <motion.div
              key="history"
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 10 }}
              className="space-y-3"
            >
              {loading ? (
                [1, 2].map((i) => (
                  <div key={i} className="h-24 bg-warm-100 dark:bg-warm-800 rounded-xl animate-pulse" />
                ))
              ) : historyChallenges.length === 0 && rivalries.length === 0 ? (
                <Card className="p-8 text-center bg-white/70 dark:bg-warm-900/70 backdrop-blur-md border-warm-200 dark:border-warm-700">
                  <div className="w-16 h-16 rounded-2xl bg-warm-100 dark:bg-warm-800 flex items-center justify-center mx-auto mb-3">
                    <Shield className="w-8 h-8 text-warm-300 dark:text-warm-600" />
                  </div>
                  <p className="text-warm-600 dark:text-warm-300 font-bold">No challenge history</p>
                  <p className="text-warm-400 text-sm mt-1">Past challenges will appear here</p>
                </Card>
              ) : (
                <>
                  {/* History Cards */}
                  {historyChallenges.map((challenge, index) => {
                    const isIncoming = challenge.toUserId === currentUser?.id;
                    const isExpanded = expandedHistory === challenge.id;

                    return (
                      <motion.div
                        key={challenge.id}
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: index * 0.03 }}
                      >
                        <Card
                          className={`border backdrop-blur-md bg-white/70 dark:bg-warm-900/70 shadow-sm overflow-hidden cursor-pointer hover:shadow-md transition-shadow ${
                            getStatusConfig(challenge.status).border
                          }`}
                          onClick={() => setExpandedHistory(isExpanded ? null : challenge.id)}
                        >
                          <CardContent className="p-3.5">
                            {/* Compact row */}
                            <div className="flex items-center gap-2">
                              <div
                                className="w-8 h-8 rounded-lg flex items-center justify-center text-[9px] font-bold text-white shrink-0"
                                style={{ backgroundColor: challenge.fromTeam.color || '#64748B' }}
                              >
                                {(challenge.fromTeam.shortName || challenge.fromTeam.name.slice(0, 2)).toUpperCase()}
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-1.5">
                                  <span className="text-xs font-semibold text-warm-800 dark:text-warm-200 truncate">
                                    {challenge.fromTeam.name}
                                  </span>
                                  <span className="text-warm-400 text-[10px]">vs</span>
                                  <span className="text-xs font-semibold text-warm-800 dark:text-warm-200 truncate">
                                    {challenge.toTeam.name}
                                  </span>
                                </div>
                                <p className="text-[10px] text-warm-400 dark:text-warm-500">
                                  {formatDate(challenge.createdAt)}
                                </p>
                              </div>
                              <Badge className={`${getStatusConfig(challenge.status).bg} ${getStatusConfig(challenge.status).darkBg} ${getStatusConfig(challenge.status).color} text-[9px] font-semibold border-0`}>
                                {getStatusConfig(challenge.status).label}
                              </Badge>
                            </div>

                            {/* Expanded Details */}
                            <AnimatePresence>
                              {isExpanded && (
                                <motion.div
                                  initial={{ height: 0, opacity: 0 }}
                                  animate={{ height: 'auto', opacity: 1 }}
                                  exit={{ height: 0, opacity: 0 }}
                                  transition={{ duration: 0.2 }}
                                  className="overflow-hidden"
                                >
                                  <div className="mt-3 pt-3 border-t border-warm-200/60 dark:border-warm-700/40 space-y-2">
                                    {challenge.message && (
                                      <p className="text-xs text-warm-500 dark:text-warm-400 italic bg-warm-50 dark:bg-warm-800/40 rounded-lg p-2">
                                        &ldquo;{challenge.message}&rdquo;
                                      </p>
                                    )}
                                    {challenge.status === 'completed' && challenge.matchId && (
                                      <Button
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          handleViewMatch(challenge.matchId!);
                                        }}
                                        variant="outline"
                                        size="sm"
                                        className="w-full border-brand-gold/30 text-brand-gold text-[11px] font-bold rounded-xl h-8"
                                      >
                                        <Eye className="w-3 h-3 mr-1" />
                                        View Match Result
                                      </Button>
                                    )}
                                    {challenge.expiresAt && (
                                      <p className="text-[10px] text-warm-400">
                                        {challenge.status === 'pending' ? 'Expires' : 'Expired'}: {formatDate(challenge.expiresAt)}
                                      </p>
                                    )}
                                  </div>
                                </motion.div>
                              )}
                            </AnimatePresence>
                          </CardContent>
                        </Card>
                      </motion.div>
                    );
                  })}

                  {/* Rivalries Section */}
                  {rivalries.length > 0 && (
                    <div className="mt-6">
                      <div className="flex items-center gap-2 mb-3">
                        <Shield className="w-4 h-4 text-brand-teal" />
                        <h2 className="text-sm font-bold text-warm-800 dark:text-warm-200">Rivalries</h2>
                      </div>
                      <div className="space-y-3">
                        {rivalries.map((rival) => {
                          const totalMatches = rival.wins + rival.losses + rival.draws;
                          const winRate = totalMatches > 0 ? Math.round((rival.wins / totalMatches) * 100) : 0;

                          return (
                            <Card key={rival.teamId} className="border-warm-200 dark:border-warm-700 backdrop-blur-md bg-white/70 dark:bg-warm-900/70">
                              <CardContent className="p-4">
                                <div className="flex items-center justify-between mb-2">
                                  <span className="font-semibold text-warm-800 dark:text-warm-200 text-sm">{rival.name}</span>
                                  <Badge variant="secondary" className="text-[10px]">
                                    {totalMatches} match{totalMatches !== 1 ? 'es' : ''}
                                  </Badge>
                                </div>
                                <div className="flex items-center gap-3">
                                  <div className="flex-1">
                                    <div className="flex items-center gap-1.5 text-sm mb-1.5">
                                      <span className="text-emerald-600 font-bold">{rival.wins}W</span>
                                      <span className="text-warm-400">-</span>
                                      <span className="text-warm-500 font-medium">{rival.draws}D</span>
                                      <span className="text-warm-400">-</span>
                                      <span className="text-red-500 font-bold">{rival.losses}L</span>
                                    </div>
                                    <div className="h-2 bg-warm-100 dark:bg-warm-800 rounded-full overflow-hidden flex">
                                      {totalMatches > 0 && (
                                        <>
                                          <motion.div
                                            className="bg-emerald-500 h-full"
                                            initial={{ width: 0 }}
                                            animate={{ width: `${(rival.wins / totalMatches) * 100}%` }}
                                            transition={{ duration: 0.5, delay: 0.2 }}
                                          />
                                          <motion.div
                                            className="bg-warm-300 dark:bg-warm-600 h-full"
                                            initial={{ width: 0 }}
                                            animate={{ width: `${(rival.draws / totalMatches) * 100}%` }}
                                            transition={{ duration: 0.5, delay: 0.3 }}
                                          />
                                          <motion.div
                                            className="bg-red-400 h-full"
                                            initial={{ width: 0 }}
                                            animate={{ width: `${(rival.losses / totalMatches) * 100}%` }}
                                            transition={{ duration: 0.5, delay: 0.4 }}
                                          />
                                        </>
                                      )}
                                    </div>
                                  </div>
                                  <div className="text-right">
                                    <p className="text-2xl font-black text-warm-800 dark:text-warm-200">{winRate}%</p>
                                    <p className="text-[9px] text-warm-400 uppercase">Win Rate</p>
                                  </div>
                                </div>
                              </CardContent>
                            </Card>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </>
              )}
            </motion.div>
          )}

          {/* ─── Send Challenge Tab ─── */}
          {activeTab === 'send' && (
            <motion.div
              key="send"
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 10 }}
              className="space-y-4"
            >
              <Card className="border-warm-200 dark:border-warm-700 backdrop-blur-md bg-white/70 dark:bg-warm-900/70">
                <CardContent className="p-5 space-y-4">
                  <div className="flex items-center gap-2 mb-1">
                    <Swords className="w-5 h-5 text-brand-red" />
                    <h3 className="font-bold text-warm-800 dark:text-warm-200">Challenge a Team</h3>
                  </div>

                  {/* From Team - Searchable */}
                  <SearchableTeamSelect
                    teams={teams}
                    selectedTeamId={selectedFromTeam}
                    onSelect={setSelectedFromTeam}
                    label="Your Team"
                    placeholder="Select your team"
                  />

                  {/* To Team - Searchable */}
                  <SearchableTeamSelect
                    teams={teams}
                    selectedTeamId={selectedToTeam}
                    onSelect={setSelectedToTeam}
                    label="Challenge Team"
                    placeholder="Search & select opponent"
                    excludeTeamId={selectedFromTeam}
                  />

                  {/* Message / Taunt */}
                  <div>
                    <label className="text-xs font-semibold text-warm-600 dark:text-warm-400 mb-1.5 block">
                      Message / Taunt (optional)
                    </label>
                    <textarea
                      value={challengeMessage}
                      onChange={(e) => setChallengeMessage(e.target.value.slice(0, 200))}
                      placeholder="Add a taunt or message..."
                      className="w-full rounded-xl border border-warm-300 dark:border-warm-700 bg-white/80 dark:bg-warm-800/80 backdrop-blur-sm px-3 py-2.5 text-sm text-warm-800 dark:text-warm-200 focus:outline-none focus:ring-2 focus:ring-brand-red/30 resize-none h-20 placeholder:text-warm-400"
                    />
                    <p className="text-[10px] text-warm-400 mt-1 text-right">
                      {challengeMessage.length}/200
                    </p>
                  </div>

                  {/* Match Preview */}
                  {selectedFromTeam && selectedToTeam && selectedFromTeam !== selectedToTeam && (
                    <motion.div
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="p-3 rounded-xl bg-warm-50 dark:bg-warm-800/50 border border-warm-200 dark:border-warm-700"
                    >
                      <p className="text-[10px] font-bold text-warm-400 uppercase tracking-wider mb-2">Match Preview</p>
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex-1 text-center">
                          <div
                            className="w-10 h-10 rounded-xl mx-auto flex items-center justify-center text-white font-bold text-xs shadow-sm"
                            style={{ backgroundColor: selectedFromTeamData?.color || '#64748B' }}
                          >
                            {(selectedFromTeamData?.shortName || selectedFromTeamData?.name?.slice(0, 2) || '??').toUpperCase()}
                          </div>
                          <p className="text-[11px] font-semibold text-warm-700 dark:text-warm-300 mt-1 truncate">
                            {selectedFromTeamData?.name}
                          </p>
                        </div>
                        <Swords className="w-5 h-5 text-brand-red/50" />
                        <div className="flex-1 text-center">
                          <div
                            className="w-10 h-10 rounded-xl mx-auto flex items-center justify-center text-white font-bold text-xs shadow-sm"
                            style={{ backgroundColor: selectedToTeamData?.color || '#64748B' }}
                          >
                            {(selectedToTeamData?.shortName || selectedToTeamData?.name?.slice(0, 2) || '??').toUpperCase()}
                          </div>
                          <p className="text-[11px] font-semibold text-warm-700 dark:text-warm-300 mt-1 truncate">
                            {selectedToTeamData?.name}
                          </p>
                        </div>
                      </div>
                    </motion.div>
                  )}

                  <Button
                    onClick={() => {
                      if (selectedFromTeam && selectedToTeam && selectedFromTeam !== selectedToTeam) {
                        setShowConfirm(true);
                      }
                    }}
                    disabled={!selectedFromTeam || !selectedToTeam || selectedFromTeam === selectedToTeam}
                    className="w-full bg-brand-red hover:bg-brand-red-dark text-white h-11 rounded-xl font-bold"
                  >
                    <Swords className="w-4 h-4 mr-2" />
                    Send Challenge
                  </Button>
                </CardContent>
              </Card>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Confirmation Modal */}
      <AnimatePresence>
        {showConfirm && (
          <ConfirmChallengeModal
            fromTeam={selectedFromTeamData}
            toTeam={selectedToTeamData}
            message={challengeMessage}
            onConfirm={handleSendChallenge}
            onCancel={() => setShowConfirm(false)}
            sending={sending}
          />
        )}
      </AnimatePresence>
    </motion.div>
  );
}
