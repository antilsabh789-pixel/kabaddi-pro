'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Play, Pause, SkipBack, SkipForward, FastForward, RotateCcw, Swords, Shield, Zap, Award } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

interface MatchEventDB {
  id: string;
  teamId: string;
  playerId: string | null;
  eventType: string;
  value: number;
  details: string | null;
  half: number;
  timestamp: string;
}

interface TeamInfo {
  id: string;
  name: string;
  shortName: string | null;
  color: string | null;
}

interface MatchInfo {
  id: string;
  homeScore: number;
  awayScore: number;
  half: number;
  homeTeam: TeamInfo;
  awayTeam: TeamInfo;
  tournament: { name: string } | null;
  startedAt: string | null;
  completedAt: string | null;
}

const EVENT_CONFIG: Record<string, { color: string; bgColor: string; icon: typeof Swords; label: string }> = {
  raid_point: { color: 'text-brand-red', bgColor: 'bg-brand-red/10', icon: Swords, label: 'Raid Point' },
  bonus_point: { color: 'text-brand-gold', bgColor: 'bg-brand-gold/10', icon: Zap, label: 'Bonus Point' },
  tackle_point: { color: 'text-brand-blue', bgColor: 'bg-brand-blue/10', icon: Shield, label: 'Tackle Point' },
  super_tackle: { color: 'text-purple-500', bgColor: 'bg-purple-500/10', icon: Shield, label: 'Super Tackle' },
  super_raid: { color: 'text-orange-500', bgColor: 'bg-orange-500/10', icon: Swords, label: 'Super Raid' },
  all_out: { color: 'text-red-600', bgColor: 'bg-red-600/10', icon: Zap, label: 'All Out' },
  do_or_die_raid: { color: 'text-amber-600', bgColor: 'bg-amber-600/10', icon: Swords, label: 'Do or Die Raid' },
  timeout: { color: 'text-warm-500', bgColor: 'bg-warm-100', icon: Award, label: 'Timeout' },
  yellow_card: { color: 'text-yellow-500', bgColor: 'bg-yellow-500/10', icon: Award, label: 'Yellow Card' },
  red_card: { color: 'text-red-600', bgColor: 'bg-red-600/10', icon: Award, label: 'Red Card' },
  green_card: { color: 'text-emerald-500', bgColor: 'bg-emerald-500/10', icon: Award, label: 'Green Card' },
};

export default function MatchReplayScreen({ matchId, onClose }: { matchId: string; onClose: () => void }) {
  const [match, setMatch] = useState<MatchInfo | null>(null);
  const [events, setEvents] = useState<MatchEventDB[]>([]);
  const [currentStep, setCurrentStep] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playSpeed, setPlaySpeed] = useState(1);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadMatch() {
      try {
        const res = await fetch(`/api/matches?id=${matchId}`);
        if (res.ok) {
          const data = await res.json();
          setMatch(data);
          if (data.events) {
            setEvents(data.events.sort((a: MatchEventDB, b: MatchEventDB) =>
              new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
            ));
          }
        }
      } catch (err) {
        console.error('Failed to load match:', err);
      } finally {
        setLoading(false);
      }
    }
    loadMatch();
  }, [matchId]);

  // Auto-play logic
  useEffect(() => {
    if (!isPlaying || events.length === 0) return;
    const interval = setInterval(() => {
      setCurrentStep(prev => {
        if (prev >= events.length - 1) {
          setIsPlaying(false);
          return prev;
        }
        return prev + 1;
      });
    }, 2000 / playSpeed);
    return () => clearInterval(interval);
  }, [isPlaying, events.length, playSpeed]);

  // Compute running scores
  const getRunningScore = (step: number) => {
    let homeScore = 0;
    let awayScore = 0;
    for (let i = 0; i <= step && i < events.length; i++) {
      const evt = events[i];
      if (!match) continue;
      const isHome = evt.teamId === match.homeTeam.id;
      const points = evt.value;
      // Add all out bonus
      let bonus = 0;
      if (evt.eventType === 'all_out') bonus = 2;
      if (isHome) homeScore += points + bonus;
      else awayScore += points + bonus;
    }
    return { homeScore, awayScore };
  };

  const score = getRunningScore(currentStep);

  const handlePlayPause = () => {
    if (currentStep >= events.length - 1) {
      setCurrentStep(0);
    }
    setIsPlaying(!isPlaying);
  };

  const handleReset = () => {
    setCurrentStep(0);
    setIsPlaying(false);
  };

  const getTeamShortName = (team: TeamInfo) => {
    if (team.shortName) return team.shortName;
    return team.name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 3);
  };

  if (loading) {
    return (
      <div className="fixed inset-0 z-50 bg-warm-50 flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-brand-red border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!match) {
    return (
      <div className="fixed inset-0 z-50 bg-warm-50 flex items-center justify-center">
        <p className="text-warm-600">Match not found</p>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 bg-warm-50 overflow-y-auto"
    >
      {/* Header */}
      <div className="sticky top-0 z-10 bg-gradient-to-r from-brand-navy to-brand-blue">
        <div className="flex items-center justify-between px-4 py-4">
          <div className="flex items-center gap-2">
            <Play className="w-5 h-5 text-white" />
            <h1 className="text-lg font-bold text-white">Match Replay</h1>
          </div>
          <button onClick={onClose} className="p-2 rounded-full hover:bg-white/20 transition-colors">
            <X className="w-5 h-5 text-white" />
          </button>
        </div>
      </div>

      {/* Score Display */}
      <div className="px-4 py-4">
        <Card className="bg-gradient-to-br from-warm-800 to-warm-900 text-white overflow-hidden">
          <CardContent className="p-4">
            {match.tournament && (
              <p className="text-[10px] text-warm-400 text-center mb-2">{match.tournament.name}</p>
            )}
            <div className="flex items-center justify-between">
              <div className="flex flex-col items-center gap-1 flex-1">
                <div
                  className="w-12 h-12 rounded-full flex items-center justify-center text-sm font-bold text-white"
                  style={{ backgroundColor: match.homeTeam.color || '#DC2626' }}
                >
                  {getTeamShortName(match.homeTeam)}
                </div>
                <span className="text-xs text-warm-300 text-center truncate max-w-[100px]">
                  {match.homeTeam.name}
                </span>
              </div>
              <div className="flex items-center gap-4 px-4">
                <motion.span
                  key={`home-${score.homeScore}`}
                  initial={{ scale: 1.3 }}
                  animate={{ scale: 1 }}
                  className="text-3xl font-black"
                >
                  {score.homeScore}
                </motion.span>
                <span className="text-warm-500 text-sm">-</span>
                <motion.span
                  key={`away-${score.awayScore}`}
                  initial={{ scale: 1.3 }}
                  animate={{ scale: 1 }}
                  className="text-3xl font-black"
                >
                  {score.awayScore}
                </motion.span>
              </div>
              <div className="flex flex-col items-center gap-1 flex-1">
                <div
                  className="w-12 h-12 rounded-full flex items-center justify-center text-sm font-bold text-white"
                  style={{ backgroundColor: match.awayTeam.color || '#1E293B' }}
                >
                  {getTeamShortName(match.awayTeam)}
                </div>
                <span className="text-xs text-warm-300 text-center truncate max-w-[100px]">
                  {match.awayTeam.name}
                </span>
              </div>
            </div>

            {/* Step indicator */}
            <div className="mt-3 flex items-center justify-between text-[10px] text-warm-400">
              <span>Event {Math.min(currentStep + 1, events.length)} of {events.length}</span>
              {events[currentStep] && (
                <Badge variant="secondary" className="text-[9px] bg-warm-700 text-warm-300 border-0">
                  Half {events[currentStep].half}
                </Badge>
              )}
            </div>

            {/* Progress bar */}
            <div className="mt-2 h-1.5 bg-warm-700 rounded-full overflow-hidden">
              <motion.div
                className="h-full bg-brand-red rounded-full"
                animate={{ width: events.length > 0 ? `${((currentStep + 1) / events.length) * 100}%` : '0%' }}
                transition={{ duration: 0.3 }}
              />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Controls */}
      <div className="px-4 flex items-center justify-center gap-3 mb-4">
        <button onClick={handleReset} className="p-2 rounded-full bg-warm-100 hover:bg-warm-200 transition-colors">
          <RotateCcw className="w-4 h-4 text-warm-600" />
        </button>
        <button
          onClick={() => setCurrentStep(Math.max(0, currentStep - 1))}
          className="p-2 rounded-full bg-warm-100 hover:bg-warm-200 transition-colors"
        >
          <SkipBack className="w-4 h-4 text-warm-600" />
        </button>
        <button
          onClick={handlePlayPause}
          className="p-3 rounded-full bg-brand-red text-white hover:bg-brand-red-dark transition-colors shadow-lg"
        >
          {isPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5" />}
        </button>
        <button
          onClick={() => setCurrentStep(Math.min(events.length - 1, currentStep + 1))}
          className="p-2 rounded-full bg-warm-100 hover:bg-warm-200 transition-colors"
        >
          <SkipForward className="w-4 h-4 text-warm-600" />
        </button>
        <button
          onClick={() => setPlaySpeed(s => s === 1 ? 2 : s === 2 ? 4 : 1)}
          className="p-2 rounded-full bg-warm-100 hover:bg-warm-200 transition-colors flex items-center gap-1"
        >
          <FastForward className="w-4 h-4 text-warm-600" />
          <span className="text-[10px] font-bold text-warm-600">{playSpeed}x</span>
        </button>
      </div>

      {/* Current Event Detail */}
      {events.length > 0 && currentStep < events.length && (() => {
        const evt = events[currentStep];
        const config = EVENT_CONFIG[evt.eventType] || { color: 'text-warm-500', bgColor: 'bg-warm-100', icon: Award, label: evt.eventType };
        const isHome = evt.teamId === match.homeTeam.id;
        const team = isHome ? match.homeTeam : match.awayTeam;
        const EventIcon = config.icon;

        return (
          <div className="px-4 mb-4">
            <Card className={`${config.bgColor} border-0`}>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className={`w-12 h-12 rounded-xl ${config.bgColor} flex items-center justify-center`}>
                    <EventIcon className={`w-6 h-6 ${config.color}`} />
                  </div>
                  <div className="flex-1">
                    <h4 className={`font-bold ${config.color}`}>{config.label}</h4>
                    <div className="flex items-center gap-2 mt-1">
                      <div
                        className="w-5 h-5 rounded-full flex items-center justify-center text-[8px] font-bold text-white"
                        style={{ backgroundColor: team.color || '#475569' }}
                      >
                        {getTeamShortName(team).charAt(0)}
                      </div>
                      <span className="text-sm text-warm-700">{team.name}</span>
                      {evt.value > 0 && (
                        <Badge className={`${config.bgColor} ${config.color} text-xs border-0 font-bold`}>
                          +{evt.value}
                        </Badge>
                      )}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        );
      })()}

      {/* Timeline */}
      <div className="px-4 pb-6">
        <h3 className="font-bold text-warm-800 mb-3">Event Timeline</h3>
        <div className="space-y-1">
          {events.map((evt, index) => {
            const config = EVENT_CONFIG[evt.eventType] || { color: 'text-warm-500', bgColor: 'bg-warm-100', label: evt.eventType };
            const isHome = evt.teamId === match.homeTeam.id;
            const team = isHome ? match.homeTeam : match.awayTeam;
            const isActive = index === currentStep;

            return (
              <motion.button
                key={evt.id}
                onClick={() => { setCurrentStep(index); setIsPlaying(false); }}
                className={`w-full text-left flex items-center gap-3 p-2 rounded-lg transition-colors ${
                  isActive ? `${config.bgColor} ring-2 ring-brand-red/20` : 'hover:bg-warm-100'
                }`}
                whileTap={{ scale: 0.98 }}
              >
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-sm ${
                  index <= currentStep ? config.bgColor : 'bg-warm-100'
                }`}>
                  {index <= currentStep ? (
                    <span className={config.color}>{evt.eventType === 'raid_point' || evt.eventType === 'super_raid' ? '⚔️' : evt.eventType === 'tackle_point' || evt.eventType === 'super_tackle' ? '🛡️' : '⚡'}</span>
                  ) : (
                    <span className="text-warm-300 text-xs">{index + 1}</span>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <span className={`text-xs font-medium ${index <= currentStep ? 'text-warm-800' : 'text-warm-400'}`}>
                    {config.label}
                  </span>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <div
                      className="w-3 h-3 rounded-full"
                      style={{ backgroundColor: team.color || '#475569' }}
                    />
                    <span className="text-[10px] text-warm-500 truncate">{team.name}</span>
                  </div>
                </div>
                <div className="text-right">
                  {evt.value > 0 && (
                    <span className={`text-sm font-bold ${index <= currentStep ? config.color : 'text-warm-300'}`}>
                      +{evt.value}
                    </span>
                  )}
                  <p className="text-[9px] text-warm-400">H{evt.half}</p>
                </div>
              </motion.button>
            );
          })}
        </div>
      </div>
    </motion.div>
  );
}
