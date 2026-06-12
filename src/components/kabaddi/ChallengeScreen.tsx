'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Swords, Shield, MessageSquare, Check, XCircle, Clock, Trophy, AlertCircle } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useKabaddiStore } from '@/lib/store';
import { useToast } from '@/hooks/use-toast';

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

type TabId = 'challenges' | 'rivalries' | 'send';

export default function ChallengeScreen({ onClose }: { onClose: () => void }) {
  const currentUser = useKabaddiStore((s) => s.currentUser);
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState<TabId>('challenges');
  const [challenges, setChallenges] = useState<ChallengeItem[]>([]);
  const [rivalries, setRivalries] = useState<HeadToHead[]>([]);
  const [teams, setTeams] = useState<TeamBasic[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [selectedFromTeam, setSelectedFromTeam] = useState<string>('');
  const [selectedToTeam, setSelectedToTeam] = useState<string>('');
  const [challengeMessage, setChallengeMessage] = useState('');

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
        toast({ title: 'Challenge Sent!', description: `Your team has challenged ${data.challenge?.toTeam?.name || 'the opponent'}` });
        setChallengeMessage('');
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

  const getStatusConfig = (status: string) => {
    switch (status) {
      case 'pending': return { icon: Clock, color: 'text-amber-500', bg: 'bg-amber-50', label: 'Pending' };
      case 'accepted': return { icon: Check, color: 'text-emerald-500', bg: 'bg-emerald-50', label: 'Accepted' };
      case 'declined': return { icon: XCircle, color: 'text-red-500', bg: 'bg-red-50', label: 'Declined' };
      case 'completed': return { icon: Trophy, color: 'text-brand-gold', bg: 'bg-brand-gold/10', label: 'Completed' };
      case 'expired': return { icon: AlertCircle, color: 'text-warm-400', bg: 'bg-warm-50', label: 'Expired' };
      default: return { icon: Clock, color: 'text-warm-500', bg: 'bg-warm-50', label: status };
    }
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
  };

  const tabs: { id: TabId; label: string; icon: typeof Swords }[] = [
    { id: 'challenges', label: 'Challenges', icon: Swords },
    { id: 'rivalries', label: 'Rivalries', icon: Shield },
    { id: 'send', label: 'Send', icon: MessageSquare },
  ];

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 bg-warm-50 overflow-y-auto"
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
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 text-sm font-semibold transition-colors border-b-2 ${
                activeTab === tab.id
                  ? 'text-white border-white'
                  : 'text-white/60 border-transparent hover:text-white/80'
              }`}
            >
              <tab.icon className="w-3.5 h-3.5" />
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="px-4 py-4">
        {activeTab === 'challenges' && (
          <div className="space-y-3">
            {loading ? (
              [1, 2, 3].map(i => <div key={i} className="h-24 bg-warm-100 rounded-xl animate-pulse" />)
            ) : challenges.length === 0 ? (
              <Card className="p-8 text-center">
                <Swords className="w-10 h-10 text-warm-300 mx-auto mb-3" />
                <p className="text-warm-600 font-medium">No challenges yet</p>
                <p className="text-warm-400 text-sm mt-1">Challenge a team to get started!</p>
              </Card>
            ) : (
              challenges.map(challenge => {
                const statusConfig = getStatusConfig(challenge.status);
                const StatusIcon = statusConfig.icon;
                const isIncoming = challenge.toUserId === currentUser?.id;
                const fromTeam = challenge.fromTeam;
                const toTeam = challenge.toTeam;

                return (
                  <motion.div
                    key={challenge.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                  >
                    <Card className={`border ${statusConfig.bg} overflow-hidden`}>
                      <CardContent className="p-4">
                        <div className="flex items-center justify-between mb-3">
                          <Badge className={`${statusConfig.bg} ${statusConfig.color} text-[10px] font-semibold border-0`}>
                            <StatusIcon className="w-3 h-3 mr-1" />
                            {statusConfig.label}
                          </Badge>
                          <span className="text-[10px] text-warm-400">{formatDate(challenge.createdAt)}</span>
                        </div>

                        {/* Teams */}
                        <div className="flex items-center justify-between mb-3">
                          <div className="flex items-center gap-2 flex-1">
                            <div
                              className="w-8 h-8 rounded-full flex items-center justify-center text-[10px] font-bold text-white shrink-0"
                              style={{ backgroundColor: fromTeam.color || '#DC2626' }}
                            >
                              {fromTeam.shortName || fromTeam.name.slice(0, 2).toUpperCase()}
                            </div>
                            <span className="text-sm font-semibold text-warm-800 truncate">{fromTeam.name}</span>
                          </div>
                          <span className="text-warm-400 text-xs font-bold px-2">VS</span>
                          <div className="flex items-center gap-2 flex-1 justify-end">
                            <span className="text-sm font-semibold text-warm-800 truncate">{toTeam.name}</span>
                            <div
                              className="w-8 h-8 rounded-full flex items-center justify-center text-[10px] font-bold text-white shrink-0"
                              style={{ backgroundColor: toTeam.color || '#1E293B' }}
                            >
                              {toTeam.shortName || toTeam.name.slice(0, 2).toUpperCase()}
                            </div>
                          </div>
                        </div>

                        {/* Message */}
                        {challenge.message && (
                          <p className="text-xs text-warm-500 italic mb-3 bg-warm-100/50 rounded-lg p-2">
                            &ldquo;{challenge.message}&rdquo;
                          </p>
                        )}

                        {/* Actions for incoming pending challenges */}
                        {isIncoming && challenge.status === 'pending' && (
                          <div className="flex gap-2">
                            <Button
                              onClick={() => handleRespond(challenge.id, 'accept')}
                              className="flex-1 bg-emerald-500 hover:bg-emerald-600 text-white h-8 text-xs"
                            >
                              <Check className="w-3 h-3 mr-1" />
                              Accept
                            </Button>
                            <Button
                              onClick={() => handleRespond(challenge.id, 'decline')}
                              variant="outline"
                              className="flex-1 border-red-300 text-red-500 hover:bg-red-50 h-8 text-xs"
                            >
                              <XCircle className="w-3 h-3 mr-1" />
                              Decline
                            </Button>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  </motion.div>
                );
              })
            )}
          </div>
        )}

        {activeTab === 'rivalries' && (
          <div className="space-y-3">
            {loading ? (
              [1, 2].map(i => <div key={i} className="h-20 bg-warm-100 rounded-xl animate-pulse" />)
            ) : rivalries.length === 0 ? (
              <Card className="p-8 text-center">
                <Shield className="w-10 h-10 text-warm-300 mx-auto mb-3" />
                <p className="text-warm-600 font-medium">No rivalries yet</p>
                <p className="text-warm-400 text-sm mt-1">Play matches against the same team to build a rivalry!</p>
              </Card>
            ) : (
              rivalries.map((rival) => {
                const totalMatches = rival.wins + rival.losses + rival.draws;
                const winRate = totalMatches > 0 ? Math.round((rival.wins / totalMatches) * 100) : 0;

                return (
                  <Card key={rival.teamId} className="border-warm-200">
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-semibold text-warm-800">{rival.name}</span>
                        <Badge variant="secondary" className="text-[10px]">
                          {totalMatches} match{totalMatches !== 1 ? 'es' : ''}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="flex-1">
                          <div className="flex items-center gap-1.5 text-sm mb-1">
                            <span className="text-emerald-600 font-bold">{rival.wins}W</span>
                            <span className="text-warm-400">-</span>
                            <span className="text-warm-500 font-medium">{rival.draws}D</span>
                            <span className="text-warm-400">-</span>
                            <span className="text-red-500 font-bold">{rival.losses}L</span>
                          </div>
                          <div className="h-2 bg-warm-100 rounded-full overflow-hidden flex">
                            {totalMatches > 0 && (
                              <>
                                <div className="bg-emerald-500 h-full" style={{ width: `${(rival.wins / totalMatches) * 100}%` }} />
                                <div className="bg-warm-300 h-full" style={{ width: `${(rival.draws / totalMatches) * 100}%` }} />
                                <div className="bg-red-400 h-full" style={{ width: `${(rival.losses / totalMatches) * 100}%` }} />
                              </>
                            )}
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-2xl font-black text-warm-800">{winRate}%</p>
                          <p className="text-[9px] text-warm-400 uppercase">Win Rate</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })
            )}
          </div>
        )}

        {activeTab === 'send' && (
          <div className="space-y-4">
            <Card className="border-warm-200">
              <CardContent className="p-4 space-y-4">
                <h3 className="font-bold text-warm-800">Challenge a Team</h3>

                {/* From Team */}
                <div>
                  <label className="text-xs font-semibold text-warm-600 mb-1.5 block">Your Team</label>
                  <select
                    value={selectedFromTeam}
                    onChange={(e) => setSelectedFromTeam(e.target.value)}
                    className="w-full h-10 rounded-lg border border-warm-300 bg-white px-3 text-sm text-warm-800 focus:outline-none focus:ring-2 focus:ring-brand-red/30"
                  >
                    <option value="">Select your team</option>
                    {teams.map(team => (
                      <option key={team.id} value={team.id}>{team.name}</option>
                    ))}
                  </select>
                </div>

                {/* To Team */}
                <div>
                  <label className="text-xs font-semibold text-warm-600 mb-1.5 block">Challenge Team</label>
                  <select
                    value={selectedToTeam}
                    onChange={(e) => setSelectedToTeam(e.target.value)}
                    className="w-full h-10 rounded-lg border border-warm-300 bg-white px-3 text-sm text-warm-800 focus:outline-none focus:ring-2 focus:ring-brand-red/30"
                  >
                    <option value="">Select opponent</option>
                    {teams
                      .filter(t => t.id !== selectedFromTeam)
                      .map(team => (
                        <option key={team.id} value={team.id}>{team.name}</option>
                      ))}
                  </select>
                </div>

                {/* Message */}
                <div>
                  <label className="text-xs font-semibold text-warm-600 mb-1.5 block">Message (optional)</label>
                  <textarea
                    value={challengeMessage}
                    onChange={(e) => setChallengeMessage(e.target.value)}
                    placeholder="Add a taunt or message..."
                    className="w-full rounded-lg border border-warm-300 bg-white px-3 py-2 text-sm text-warm-800 focus:outline-none focus:ring-2 focus:ring-brand-red/30 resize-none h-20"
                  />
                </div>

                <Button
                  onClick={handleSendChallenge}
                  disabled={!selectedFromTeam || !selectedToTeam || sending}
                  className="w-full bg-brand-red hover:bg-brand-red-dark text-white"
                >
                  <Swords className="w-4 h-4 mr-2" />
                  {sending ? 'Sending...' : 'Send Challenge'}
                </Button>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </motion.div>
  );
}
