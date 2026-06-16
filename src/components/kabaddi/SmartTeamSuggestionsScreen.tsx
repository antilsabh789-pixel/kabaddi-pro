'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowLeft,
  Sparkles,
  MapPin,
  Navigation,
  Shield,
  Swords,
  Star,
  Users,
  Loader2,
  UserPlus,
  Eye,
  Target,
  Brain,
  Flame,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useKabaddiStore } from '@/lib/store';
import { t } from '@/lib/i18n';
import { useToast } from '@/hooks/use-toast';

// ─── Types ────────────────────────────────────────────────────────

interface SmartTeamSuggestionsScreenProps {
  onBack: () => void;
}

interface TeamSuggestion {
  id: string;
  name: string;
  shortName: string | null;
  teamCode: string | null;
  logo: string | null;
  color: string | null;
  memberCount: number;
  reasons: string[];
  score: number;
  distance: number | null;
}

// ─── Helpers ──────────────────────────────────────────────────────

function formatDistance(km: number): string {
  if (km < 1) return `${Math.round(km * 1000)}m`;
  return `${km}km`;
}

function getReasonIcon(reason: string): React.ReactNode {
  const lower = reason.toLowerCase();
  if (lower.includes('raider')) return <Swords className="w-3 h-3 text-brand-gold" />;
  if (lower.includes('defender')) return <Shield className="w-3 h-3 text-green-500" />;
  if (lower.includes('all-rounder')) return <Star className="w-3 h-3 text-purple-500" />;
  if (lower.includes('close') || lower.includes('near') || lower.includes('area'))
    return <MapPin className="w-3 h-3 text-brand-red" />;
  if (lower.includes('skill') || lower.includes('compatible'))
    return <Target className="w-3 h-3 text-blue-500" />;
  if (lower.includes('looking') || lower.includes('players'))
    return <Users className="w-3 h-3 text-orange-500" />;
  return <Sparkles className="w-3 h-3 text-brand-gold" />;
}

function getReasonColor(reason: string): string {
  const lower = reason.toLowerCase();
  if (lower.includes('raider')) return 'bg-brand-gold/10 text-brand-gold-dark dark:bg-brand-gold/20 dark:text-brand-gold border-brand-gold/20';
  if (lower.includes('defender')) return 'bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-400 border-green-100 dark:border-green-800';
  if (lower.includes('all-rounder')) return 'bg-purple-50 text-purple-700 dark:bg-purple-900/20 dark:text-purple-400 border-purple-100 dark:border-purple-800';
  if (lower.includes('close') || lower.includes('near') || lower.includes('area'))
    return 'bg-brand-red/10 text-brand-red dark:bg-brand-red/20 border-brand-red/10';
  if (lower.includes('skill') || lower.includes('compatible'))
    return 'bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-400 border-blue-100 dark:border-blue-800';
  if (lower.includes('looking') || lower.includes('players'))
    return 'bg-orange-50 text-orange-700 dark:bg-orange-900/20 dark:text-orange-400 border-orange-100 dark:border-orange-800';
  return 'bg-warm-100 text-warm-700 dark:bg-warm-700/30 dark:text-warm-300 border-warm-200 dark:border-warm-600';
}

// ─── Skeleton ─────────────────────────────────────────────────────

function SuggestionSkeleton() {
  return (
    <Card className="bg-white/80 dark:bg-warm-800/50 border-warm-200/50 dark:border-warm-700/50 animate-pulse">
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          <div className="w-12 h-12 rounded-lg bg-warm-200 dark:bg-warm-700" />
          <div className="flex-1 space-y-2">
            <div className="h-4 w-36 bg-warm-200 dark:bg-warm-700 rounded" />
            <div className="flex gap-2">
              <div className="h-5 w-20 bg-warm-200 dark:bg-warm-700 rounded-full" />
              <div className="h-5 w-24 bg-warm-200 dark:bg-warm-700 rounded-full" />
            </div>
            <div className="h-3 w-16 bg-warm-200 dark:bg-warm-700 rounded" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Component ────────────────────────────────────────────────────

export default function SmartTeamSuggestionsScreen({ onBack }: SmartTeamSuggestionsScreenProps) {
  const { currentUser, language } = useKabaddiStore();
  const { toast } = useToast();

  const [suggestions, setSuggestions] = useState<TeamSuggestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [joiningTeamId, setJoiningTeamId] = useState<string | null>(null);
  const [expandedTeamId, setExpandedTeamId] = useState<string | null>(null);

  // Fetch suggestions on mount
  useEffect(() => {
    if (!currentUser?.id) {
      setLoading(false);
      return;
    }

    const fetchSuggestions = async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/team-suggestions?userId=${currentUser.id}`);
        if (!res.ok) throw new Error('Failed to fetch');
        const data = await res.json();
        setSuggestions(data.suggestions || []);
      } catch (err) {
        console.error('Fetch suggestions error:', err);
        toast({ title: t('teamSuggestions.fetchError', language as 'en' | 'hi'), variant: 'destructive' });
      } finally {
        setLoading(false);
      }
    };

    fetchSuggestions();
  }, [currentUser?.id, language, toast]);

  // Join team handler
  const handleJoinTeam = async (team: TeamSuggestion) => {
    if (!currentUser || !team.teamCode) return;
    setJoiningTeamId(team.id);
    try {
      const res = await fetch('/api/teams/join', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ teamCode: team.teamCode, userId: currentUser.id }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast({ title: data.error || t('teamSuggestions.joinError', language as 'en' | 'hi'), variant: 'destructive' });
        return;
      }
      toast({ title: t('teamSuggestions.joinedSuccess', language as 'en' | 'hi') });
      setSuggestions((prev) => prev.filter((s) => s.id !== team.id));
    } catch {
      toast({ title: t('teamSuggestions.joinError', language as 'en' | 'hi'), variant: 'destructive' });
    } finally {
      setJoiningTeamId(null);
    }
  };

  const topScore = suggestions.length > 0 ? Math.max(...suggestions.map((s) => s.score)) : 0;

  return (
    <motion.div
      initial={{ x: 20, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      exit={{ x: -20, opacity: 0 }}
      className="min-h-screen bg-gradient-to-b from-warm-50 to-white dark:from-warm-800 dark:to-warm-900"
    >
      {/* Header */}
      <div className="sticky top-0 z-10 bg-white/90 dark:bg-warm-800/90 backdrop-blur-md border-b border-warm-200 dark:border-warm-700">
        <div className="flex items-center gap-3 px-4 py-3">
          <Button variant="ghost" size="icon" onClick={onBack} className="shrink-0">
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <Brain className="w-5 h-5 text-brand-gold" />
              <h1 className="text-lg font-bold text-warm-800 dark:text-warm-100">
                {t('teamSuggestions.title', language as 'en' | 'hi')}
              </h1>
            </div>
            <p className="text-xs text-warm-500 dark:text-warm-400">
              {t('teamSuggestions.subtitle', language as 'en' | 'hi')}
            </p>
          </div>
        </div>
      </div>

      <div className="px-4 pb-6 space-y-4">
        {/* AI Banner */}
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
          <Card className="bg-gradient-to-r from-brand-gold/10 to-brand-red/10 dark:from-brand-gold/5 dark:to-brand-red/5 border-brand-gold/20 dark:border-brand-gold/10">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-brand-gold/20 dark:bg-brand-gold/10 flex items-center justify-center shrink-0">
                  <Sparkles className="w-5 h-5 text-brand-gold" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-warm-800 dark:text-warm-100">
                    {t('teamSuggestions.smartMatch', language as 'en' | 'hi')}
                  </h3>
                  <p className="text-xs text-warm-500 dark:text-warm-400 mt-0.5">
                    {t('teamSuggestions.smartMatchDesc', language as 'en' | 'hi')}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Suggestions */}
        {loading ? (
          <div className="space-y-3">
            <SuggestionSkeleton />
            <SuggestionSkeleton />
            <SuggestionSkeleton />
          </div>
        ) : suggestions.length === 0 ? (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center py-12">
            <Brain className="w-12 h-12 mx-auto text-warm-300 dark:text-warm-600 mb-3" />
            <p className="text-warm-500 dark:text-warm-400 text-sm">
              {t('teamSuggestions.noSuggestions', language as 'en' | 'hi')}
            </p>
            <p className="text-warm-400 dark:text-warm-500 text-xs mt-1">
              {t('teamSuggestions.joinMoreTeams', language as 'en' | 'hi')}
            </p>
          </motion.div>
        ) : (
          <AnimatePresence>
            {suggestions.map((team, index) => {
              const isExpanded = expandedTeamId === team.id;
              const isTop = team.score === topScore && topScore > 0;

              return (
                <motion.div
                  key={team.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  transition={{ delay: index * 0.08 }}
                >
                  <Card
                    className={`bg-white/80 dark:bg-warm-800/50 border-warm-200/50 dark:border-warm-700/50 hover:shadow-md transition-all ${
                      isTop ? 'ring-2 ring-brand-gold/30 dark:ring-brand-gold/20' : ''
                    }`}
                  >
                    <CardContent className="p-4">
                      {/* Top Pick Badge */}
                      {isTop && (
                        <div className="flex items-center gap-1 mb-2">
                          <Flame className="w-3.5 h-3.5 text-brand-gold" />
                          <span className="text-[10px] font-bold uppercase tracking-wider text-brand-gold-dark dark:text-brand-gold">
                            {t('teamSuggestions.topPick', language as 'en' | 'hi')}
                          </span>
                        </div>
                      )}

                      <div className="flex items-start gap-3">
                        {/* Team Logo */}
                        <div className="shrink-0">
                          {team.logo ? (
                            <img
                              src={team.logo}
                              alt={team.name}
                              className="w-12 h-12 rounded-lg object-cover border border-warm-200 dark:border-warm-600"
                            />
                          ) : (
                            <div
                              className="w-12 h-12 rounded-lg flex items-center justify-center text-white font-bold text-lg border border-warm-200 dark:border-warm-600"
                              style={{ backgroundColor: team.color || '#DC2626' }}
                            >
                              {team.shortName ? team.shortName[0] : team.name[0]}
                            </div>
                          )}
                        </div>

                        {/* Info */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <h3 className="font-semibold text-sm text-warm-800 dark:text-warm-100 truncate">
                              {team.name}
                            </h3>
                            {team.shortName && (
                              <Badge variant="outline" className="text-[10px] h-5 border-warm-200 dark:border-warm-700 text-warm-500">
                                {team.shortName}
                              </Badge>
                            )}
                          </div>

                          <div className="flex items-center gap-2 mt-0.5">
                            <Users className="w-3 h-3 text-warm-400" />
                            <span className="text-xs text-warm-500 dark:text-warm-400">
                              {team.memberCount} {t('teamSuggestions.members', language as 'en' | 'hi')}
                            </span>
                            {team.distance !== null && (
                              <>
                                <span className="text-warm-300 dark:text-warm-600">·</span>
                                <Navigation className="w-3 h-3 text-warm-400" />
                                <span className="text-xs text-warm-500 dark:text-warm-400">
                                  {formatDistance(team.distance)}
                                </span>
                              </>
                            )}
                          </div>

                          {/* Match Reasons */}
                          <div className="flex flex-wrap gap-1.5 mt-2">
                            {team.reasons.slice(0, isExpanded ? undefined : 2).map((reason, ri) => (
                              <Badge
                                key={ri}
                                variant="outline"
                                className={`text-[10px] h-5 gap-1 ${getReasonColor(reason)}`}
                              >
                                {getReasonIcon(reason)}
                                {reason}
                              </Badge>
                            ))}
                            {team.reasons.length > 2 && !isExpanded && (
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-5 text-[10px] text-warm-400 px-1"
                                onClick={() => setExpandedTeamId(team.id)}
                              >
                                +{team.reasons.length - 2} {t('teamSuggestions.more', language as 'en' | 'hi')}
                              </Button>
                            )}
                          </div>

                          {/* Match Score Bar */}
                          <div className="mt-2">
                            <div className="flex items-center justify-between mb-0.5">
                              <span className="text-[10px] text-warm-400 dark:text-warm-500">
                                {t('teamSuggestions.matchScore', language as 'en' | 'hi')}
                              </span>
                              <span className="text-[10px] font-bold text-brand-gold-dark dark:text-brand-gold">
                                {team.score}%
                              </span>
                            </div>
                            <div className="w-full h-1.5 bg-warm-100 dark:bg-warm-700 rounded-full overflow-hidden">
                              <motion.div
                                initial={{ width: 0 }}
                                animate={{ width: `${Math.min(team.score, 100)}%` }}
                                transition={{ duration: 0.8, delay: index * 0.1 }}
                                className="h-full rounded-full bg-gradient-to-r from-brand-gold to-brand-red"
                              />
                            </div>
                          </div>
                        </div>

                        {/* Action Buttons */}
                        <div className="flex flex-col gap-2 shrink-0">
                          <Button
                            size="sm"
                            className="h-7 text-xs gap-1 bg-brand-red hover:bg-brand-red/90 text-white"
                            onClick={() => handleJoinTeam(team)}
                            disabled={joiningTeamId === team.id}
                          >
                            {joiningTeamId === team.id ? (
                              <Loader2 className="w-3 h-3 animate-spin" />
                            ) : (
                              <UserPlus className="w-3 h-3" />
                            )}
                            {t('teamSuggestions.join', language as 'en' | 'hi')}
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-7 text-xs gap-1 border-warm-200 dark:border-warm-700 text-warm-600 dark:text-warm-300"
                            onClick={() => setExpandedTeamId(isExpanded ? null : team.id)}
                          >
                            <Eye className="w-3 h-3" />
                            {t('teamSuggestions.view', language as 'en' | 'hi')}
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              );
            })}
          </AnimatePresence>
        )}
      </div>
    </motion.div>
  );
}
