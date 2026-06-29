'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence, Variants } from 'framer-motion';
import {
  X, Vote, Plus, Loader2, ChevronRight, CheckCircle,
  Trophy, Swords, Clock,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useKabaddiStore } from '@/lib/store';
import { useToast } from '@/hooks/use-toast';
import PremiumLock from './PremiumLock';

// ─── Types ────────────────────────────────────────────────────────

interface PollsScreenProps {
  onClose: () => void;
}

type TabId = 'active' | 'my-predictions';

interface Poll {
  id: string;
  question: string;
  options: PollOption[];
  totalVotes: number;
  userVotedOptionId?: string;
  matchId?: string;
  matchContext?: string;
  expiresAt?: string;
  createdAt: string;
}

interface PollOption {
  id: string;
  text: string;
  votes: number;
}

interface UserPrediction {
  id: string;
  pollQuestion: string;
  votedOption: string;
  result: 'won' | 'lost' | 'pending' | null;
  totalVotes: number;
  createdAt: string;
}

// ─── Animation ────────────────────────────────────────────────────

const containerVariants: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.06, delayChildren: 0.1 },
  },
};

const itemVariants: Variants = {
  hidden: { opacity: 0, y: 14 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { type: 'spring' as const, damping: 20, stiffness: 200 },
  },
};

// ─── Component ────────────────────────────────────────────────────

export default function PollsScreen({ onClose }: PollsScreenProps) {
  const currentUser = useKabaddiStore((s) => s.currentUser);
  const isPremium = currentUser?.isPremium || currentUser?.isAdmin || false;
  const { toast } = useToast();

  const [activeTab, setActiveTab] = useState<TabId>('active');
  const [polls, setPolls] = useState<Poll[]>([]);
  const [predictions, setPredictions] = useState<UserPrediction[]>([]);
  const [loading, setLoading] = useState(true);
  const [votingPollId, setVotingPollId] = useState<string | null>(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [creating, setCreating] = useState(false);

  const [createForm, setCreateForm] = useState({
    question: '',
    options: ['', ''],
    matchId: '',
    expiryHours: '24',
  });

  // ─── Fetch polls ──────────────────────────────────────────────

  const fetchPolls = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (currentUser?.id) params.set('userId', currentUser.id);
      const res = await fetch(`/api/polls?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setPolls(data.polls || []);
        setPredictions(data.predictions || []);
      } else {
        setPolls([]);
        setPredictions([]);
      }
    } catch {
      setPolls([]);
      setPredictions([]);
    } finally {
      setLoading(false);
    }
  }, [currentUser?.id]);

  useEffect(() => {
    fetchPolls();
  }, [fetchPolls]);

  // ─── Vote on a poll ──────────────────────────────────────────

  const handleVote = async (pollId: string, optionId: string) => {
    if (votingPollId) return;
    setVotingPollId(pollId);

    try {
      const res = await fetch(`/api/polls/${pollId}/vote`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ optionId, userId: currentUser?.id }),
      });

      if (res.ok) {
        toast({ title: 'Vote recorded!' });
        fetchPolls();
      } else {
        const data = await res.json();
        toast({ title: 'Error', description: data.error || 'Vote failed', variant: 'destructive' });
      }
    } catch {
      toast({ title: 'Error', description: 'Failed to submit vote', variant: 'destructive' });
    } finally {
      setVotingPollId(null);
    }
  };

  // ─── Create poll ─────────────────────────────────────────────

  const handleCreatePoll = async () => {
    if (!createForm.question.trim()) {
      toast({ title: 'Question required', variant: 'destructive' });
      return;
    }
    const validOptions = createForm.options.filter((o) => o.trim());
    if (validOptions.length < 2) {
      toast({ title: 'Need at least 2 options', variant: 'destructive' });
      return;
    }

    setCreating(true);
    try {
      const res = await fetch('/api/polls', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          question: createForm.question,
          options: validOptions,
          matchId: createForm.matchId || undefined,
          expiryHours: parseInt(createForm.expiryHours) || 24,
          userId: currentUser?.id,
        }),
      });

      if (res.ok) {
        toast({ title: 'Poll Created!', description: 'Your poll is now live' });
        setCreateForm({ question: '', options: ['', ''], matchId: '', expiryHours: '24' });
        setShowCreateForm(false);
        fetchPolls();
      } else {
        const data = await res.json();
        toast({ title: 'Error', description: data.error || 'Failed to create poll', variant: 'destructive' });
      }
    } catch {
      toast({ title: 'Error', description: 'Failed to create poll', variant: 'destructive' });
    } finally {
      setCreating(false);
    }
  };

  // ─── Add option to create form ───────────────────────────────

  const addOption = () => {
    if (createForm.options.length < 4) {
      setCreateForm({ ...createForm, options: [...createForm.options, ''] });
    }
  };

  const updateOption = (index: number, value: string) => {
    const newOptions = [...createForm.options];
    newOptions[index] = value;
    setCreateForm({ ...createForm, options: newOptions });
  };

  // ─── Render ───────────────────────────────────────────────────

  return (
    <motion.div
      initial={{ y: '100%' }}
      animate={{ y: 0 }}
      exit={{ y: '100%' }}
      transition={{ type: 'spring', damping: 28, stiffness: 300 }}
      className="fixed inset-0 z-50 bg-warm-50 dark:bg-warm-900 overflow-y-auto"
    >
      {/* ═══ Header ═══ */}
      <div className="sticky top-0 z-10 bg-gradient-to-r from-brand-gold to-brand-gold-dark">
        <div className="flex items-center justify-between px-4 py-4">
          <div className="flex items-center gap-2">
            <Vote className="w-5 h-5 text-white" />
            <h1 className="text-lg font-bold text-white">PREDICTIONS &amp; POLLS</h1>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-full hover:bg-white/20 transition-colors"
          >
            <X className="w-5 h-5 text-white" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex px-4 pb-0">
          {[
            { id: 'active' as TabId, label: 'Active Polls' },
            { id: 'my-predictions' as TabId, label: 'My Predictions' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex-1 pb-2.5 text-sm font-bold border-b-2 transition-colors ${
                activeTab === tab.id
                  ? 'text-white border-white'
                  : 'text-white/50 border-transparent hover:text-white/80'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* ═══ Content ═══ */}
      <div className="px-4 py-4">
        <AnimatePresence mode="wait">
          {activeTab === 'active' ? (
            <motion.div
              key="active"
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 10 }}
              className="space-y-4"
            >
              {/* Create Poll Button */}
              <PremiumLock feature="Create Poll" compact>
                <Button
                  onClick={() => setShowCreateForm(!showCreateForm)}
                  variant="outline"
                  className="w-full border-dashed border-brand-gold/40 text-brand-gold-dark hover:bg-brand-gold/5 h-10"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  {showCreateForm ? 'Cancel' : 'Create Poll'}
                </Button>
              </PremiumLock>

              {/* Create Poll Form */}
              <AnimatePresence>
                {showCreateForm && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="overflow-hidden"
                  >
                    <Card className="border-brand-gold/20">
                      <CardContent className="p-4 space-y-3">
                        <h3 className="font-bold text-warm-800 dark:text-warm-100 text-sm">Create New Poll</h3>
                        <Input
                          placeholder="Your question *"
                          value={createForm.question}
                          onChange={(e) => setCreateForm({ ...createForm, question: e.target.value })}
                          className="bg-white border-warm-300"
                        />
                        <div className="space-y-2">
                          {createForm.options.map((option, i) => (
                            <div key={i} className="flex items-center gap-2">
                              <span className="text-xs text-warm-400 font-bold w-5">{String.fromCharCode(65 + i)}</span>
                              <Input
                                placeholder={`Option ${i + 1}`}
                                value={option}
                                onChange={(e) => updateOption(i, e.target.value)}
                                className="bg-white border-warm-300"
                              />
                            </div>
                          ))}
                          {createForm.options.length < 4 && (
                            <button
                              onClick={addOption}
                              className="text-xs text-brand-teal font-semibold hover:underline"
                            >
                              + Add option
                            </button>
                          )}
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                          <Input
                            placeholder="Match ID (optional)"
                            value={createForm.matchId}
                            onChange={(e) => setCreateForm({ ...createForm, matchId: e.target.value })}
                            className="bg-white border-warm-300"
                          />
                          <select
                            value={createForm.expiryHours}
                            onChange={(e) => setCreateForm({ ...createForm, expiryHours: e.target.value })}
                            className="h-9 rounded-md border border-warm-300 bg-white px-3 text-sm text-warm-700 focus:outline-none focus:ring-2 focus:ring-brand-gold/30"
                          >
                            <option value="1">1 hour</option>
                            <option value="6">6 hours</option>
                            <option value="24">24 hours</option>
                            <option value="72">3 days</option>
                          </select>
                        </div>
                        <Button
                          onClick={handleCreatePoll}
                          disabled={creating}
                          className="w-full bg-brand-gold hover:bg-brand-gold-dark text-white"
                        >
                          {creating ? (
                            <>
                              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                              Creating...
                            </>
                          ) : (
                            <>
                              <Plus className="w-4 h-4 mr-2" />
                              Create Poll
                            </>
                          )}
                        </Button>
                      </CardContent>
                    </Card>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Active Polls List */}
              {loading ? (
                <div className="space-y-3">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="h-36 bg-warm-100 dark:bg-warm-800 rounded-xl animate-pulse" />
                  ))}
                </div>
              ) : polls.length === 0 ? (
                <Card className="p-8 text-center border-warm-200">
                  <div className="w-16 h-16 rounded-full bg-brand-gold/10 flex items-center justify-center mx-auto mb-4">
                    <Vote className="w-8 h-8 text-brand-gold/40" />
                  </div>
                  <h3 className="text-warm-700 dark:text-warm-200 font-bold text-sm">No active polls</h3>
                  <p className="text-warm-400 text-xs mt-1">Create one to get the community voting!</p>
                </Card>
              ) : (
                <motion.div
                  className="space-y-3"
                  variants={containerVariants}
                  initial="hidden"
                  animate="visible"
                >
                  {polls.map((poll, index) => {
                    const hasVoted = !!poll.userVotedOptionId;
                    const isVoting = votingPollId === poll.id;

                    return (
                      <motion.div key={poll.id} variants={itemVariants}>
                        <Card className="border-warm-200/60">
                          <CardContent className="p-4">
                            {/* Question */}
                            <div className="flex items-start gap-2 mb-3">
                              <div className="flex-1">
                                <p className="text-sm font-bold text-warm-800 dark:text-warm-100">
                                  {poll.question}
                                </p>
                                {poll.matchContext && (
                                  <div className="flex items-center gap-1 mt-1">
                                    <Swords className="w-3 h-3 text-brand-red" />
                                    <span className="text-[10px] text-warm-500 font-medium">
                                      {poll.matchContext}
                                    </span>
                                  </div>
                                )}
                              </div>
                              <Badge className="bg-warm-100 dark:bg-warm-800 text-warm-600 dark:text-warm-300 text-[9px] font-bold border-0">
                                {poll.totalVotes} votes
                              </Badge>
                            </div>

                            {/* Vote Options */}
                            <div className="space-y-2">
                              {poll.options.map((option) => {
                                const percentage = poll.totalVotes > 0
                                  ? Math.round((option.votes / poll.totalVotes) * 100)
                                  : 0;
                                const isSelected = poll.userVotedOptionId === option.id;

                                return (
                                  <button
                                    key={option.id}
                                    onClick={() => {
                                      if (!hasVoted && !isVoting) handleVote(poll.id, option.id);
                                    }}
                                    disabled={hasVoted || isVoting}
                                    className={`relative w-full text-left p-3 rounded-xl border transition-all overflow-hidden ${
                                      isSelected
                                        ? 'border-brand-teal bg-brand-teal/5'
                                        : hasVoted
                                          ? 'border-warm-200 bg-warm-50 dark:bg-warm-900'
                                          : 'border-warm-200 bg-white hover:border-brand-teal/40 cursor-pointer'
                                    }`}
                                  >
                                    {/* Percentage bar background */}
                                    {hasVoted && (
                                      <motion.div
                                        className="absolute inset-y-0 left-0 bg-brand-teal/8 rounded-xl"
                                        initial={{ width: 0 }}
                                        animate={{ width: `${percentage}%` }}
                                        transition={{ duration: 0.5, ease: 'easeOut' }}
                                      />
                                    )}
                                    <div className="relative flex items-center justify-between">
                                      <div className="flex items-center gap-2">
                                        {isSelected && <CheckCircle className="w-3.5 h-3.5 text-brand-teal" />}
                                        <span className="text-xs font-semibold text-warm-800 dark:text-warm-100">
                                          {option.text}
                                        </span>
                                      </div>
                                      <div className="flex items-center gap-2">
                                        {hasVoted && (
                                          <>
                                            <span className="text-[10px] text-warm-500">
                                              {option.votes}
                                            </span>
                                            <span className="text-xs font-bold text-brand-teal">
                                              {percentage}%
                                            </span>
                                          </>
                                        )}
                                      </div>
                                    </div>
                                  </button>
                                );
                              })}
                            </div>

                            {/* Expiry */}
                            {poll.expiresAt && (
                              <div className="flex items-center gap-1 mt-2">
                                <Clock className="w-3 h-3 text-warm-400" />
                                <span className="text-[10px] text-warm-400">
                                  Ends {new Date(poll.expiresAt).toLocaleDateString()}
                                </span>
                              </div>
                            )}
                          </CardContent>
                        </Card>
                      </motion.div>
                    );
                  })}

                  {/* Match Prediction Cards */}
                  {polls.filter((p) => p.matchId).length > 0 && (
                    <motion.div variants={itemVariants}>
                      <div className="flex items-center gap-2 mb-2">
                        <Trophy className="w-4 h-4 text-brand-gold" />
                        <h2 className="text-xs font-black tracking-wider text-warm-800 dark:text-warm-100">
                          MATCH PREDICTIONS
                        </h2>
                      </div>
                      {polls
                        .filter((p) => p.matchId)
                        .map((poll) => (
                          <Card key={`match-${poll.id}`} className="border-brand-gold/20 mb-2">
                            <CardContent className="p-3">
                              <p className="text-xs font-bold text-warm-800 dark:text-warm-100 mb-2">
                                {poll.question}
                              </p>
                              <div className="flex items-center gap-2">
                                {poll.options.slice(0, 2).map((option, i) => {
                                  const pct = poll.totalVotes > 0
                                    ? Math.round((option.votes / poll.totalVotes) * 100)
                                    : 50;
                                  return (
                                    <div key={option.id} className="flex-1">
                                      <div className="flex items-center justify-between mb-1">
                                        <span className="text-[10px] font-semibold text-warm-700 dark:text-warm-200">
                                          {option.text}
                                        </span>
                                        <span className="text-[10px] font-bold text-brand-teal">
                                          {pct}%
                                        </span>
                                      </div>
                                      <div className="h-2 bg-warm-200 rounded-full overflow-hidden">
                                        <motion.div
                                          className="h-full rounded-full"
                                          style={{
                                            backgroundColor: i === 0 ? '#DC2626' : '#1E293B',
                                          }}
                                          initial={{ width: 0 }}
                                          animate={{ width: `${pct}%` }}
                                          transition={{ duration: 0.6, ease: 'easeOut' }}
                                        />
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            </CardContent>
                          </Card>
                        ))}
                    </motion.div>
                  )}
                </motion.div>
              )}
            </motion.div>
          ) : (
            /* ─── My Predictions Tab ─────────────────────────── */
            <motion.div
              key="predictions"
              initial={{ opacity: 0, x: 10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -10 }}
              className="space-y-3"
            >
              {loading ? (
                <div className="space-y-3">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="h-20 bg-warm-100 dark:bg-warm-800 rounded-xl animate-pulse" />
                  ))}
                </div>
              ) : predictions.length === 0 ? (
                <Card className="p-8 text-center border-warm-200">
                  <div className="w-16 h-16 rounded-full bg-brand-gold/10 flex items-center justify-center mx-auto mb-4">
                    <Trophy className="w-8 h-8 text-brand-gold/40" />
                  </div>
                  <h3 className="text-warm-700 dark:text-warm-200 font-bold text-sm">No predictions yet</h3>
                  <p className="text-warm-400 text-xs mt-1">
                    Vote on active polls to see your prediction history here.
                  </p>
                </Card>
              ) : (
                predictions.map((prediction, index) => {
                  const resultConfig = {
                    won: { bg: 'bg-green-100', text: 'text-green-700', label: 'Won' },
                    lost: { bg: 'bg-red-100', text: 'text-red-700', label: 'Lost' },
                    pending: { bg: 'bg-brand-gold/15', text: 'text-brand-gold-dark', label: 'Pending' },
                  }[prediction.result || 'pending'];

                  return (
                    <motion.div
                      key={prediction.id}
                      initial={{ opacity: 0, y: 12 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.05 }}
                    >
                      <Card className="border-warm-200/60">
                        <CardContent className="p-4">
                          <div className="flex items-start justify-between">
                            <div className="flex-1 min-w-0">
                              <p className="text-xs font-bold text-warm-800 dark:text-warm-100 truncate">
                                {prediction.pollQuestion}
                              </p>
                              <div className="flex items-center gap-2 mt-1.5">
                                <ChevronRight className="w-3 h-3 text-warm-400" />
                                <span className="text-[11px] text-warm-600 dark:text-warm-300 font-medium">
                                  Voted: {prediction.votedOption}
                                </span>
                              </div>
                              <p className="text-[10px] text-warm-400 mt-1">
                                {new Date(prediction.createdAt).toLocaleDateString()} · {prediction.totalVotes} total votes
                              </p>
                            </div>
                            <Badge className={`${resultConfig.bg} ${resultConfig.text} text-[9px] font-bold border-0`}>
                              {resultConfig.label}
                            </Badge>
                          </div>
                        </CardContent>
                      </Card>
                    </motion.div>
                  );
                })
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}
