'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Undo2, Pause, Play, Square, Timer, Swords, X, Check,
  Crown, Share2, Zap, Shield, Hand, Clock, ArrowLeftRight
} from 'lucide-react';
import { useKabaddiStore, type MatchPlayer, type MatchEvent } from '@/lib/store';
import { useToast } from '@/hooks/use-toast';
import ShareScorecard from './ShareScorecard';
import { matchNotification } from '@/lib/notifications';
import { triggerFeedback, SoundType, vibrate } from '@/lib/sounds';

// Raid flow states
type RaidPhase = 'idle' | 'result' | 'defenders';
type RaidResult = 'success' | 'caught' | 'empty' | null;

const RAID_TIME_LIMIT = 30; // seconds
const ON_COURT_MAX = 7; // kabaddi standard: 7 players on court
const RAID_GAP_TIMEOUT = 5; // seconds after raid ends before auto-pause

export default function LiveScoringScreen() {
  const {
    activeMatch,
    addBatchEvents,
    addEvent,
    undoLastRaid,
    undoLastEvent,
    switchHalf,
    setTimer,
    endMatch,
    setDoOrDie,
    switchRaidQueue,
    callTimeout,
    addNotification,
  } = useKabaddiStore();

  const { toast } = useToast();

  // Match timer state
  const [isPaused, setIsPaused] = useState(false);
  const [hasStartedRaiding, setHasStartedRaiding] = useState(false);
  const matchTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Raid timer state
  const [raidTimer, setRaidTimer] = useState<number | null>(null);
  const raidTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Raid gap timer (5s after raid ends, auto-pause if no new raider)
  const [raidGapTimer, setRaidGapTimer] = useState<number | null>(null);
  const raidGapRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Track consecutive empty raids for do-or-die
  const consecutiveEmptyRaidsRef = useRef<number>(0);
  // Track if 5-min warning has fired for current half
  const fiveMinWarningFiredRef = useRef<boolean>(false);

  // Raid flow state
  const [raidPhase, setRaidPhase] = useState<RaidPhase>('idle');
  const [raider, setRaider] = useState<MatchPlayer | null>(null);
  const [raidResult, setRaidResult] = useState<RaidResult>(null);
  const [selectedDefenders, setSelectedDefenders] = useState<Set<string>>(new Set());
  const [bonusPoint, setBonusPoint] = useState(false);

  // Substitute mode
  const [showSubMode, setShowSubMode] = useState<'home' | 'away' | null>(null);
  const [subOutPlayer, setSubOutPlayer] = useState<MatchPlayer | null>(null);

  // Match end state
  const [showEndMatchConfirm, setShowEndMatchConfirm] = useState(false);
  const [showEndHalfConfirm, setShowEndHalfConfirm] = useState(false);
  const [showMotmOverlay, setShowMotmOverlay] = useState(false);
  const [motmPlayer, setMotmPlayer] = useState<{ name: string; points: number } | null>(null);
  const [showShareScorecard, setShowShareScorecard] = useState(false);
  const [savedMatchData, setSavedMatchData] = useState<{
    homeTeam: string; awayTeam: string; homeScore: number; awayScore: number;
    homeTeamColor: string; awayTeamColor: string; gender: string;
    topRaider: { name: string; points: number } | null;
    topDefender: { name: string; points: number } | null;
    motm: { name: string; points: number } | null;
  } | null>(null);

  // Player profiles (avatars)
  const [playerProfiles, setPlayerProfiles] = useState<Record<string, { avatar?: string }>>({});

  const match = activeMatch;

  // Ref to allow processRaidResult to be called from useEffect before its declaration
  const processRaidResultRef = useRef<(result: RaidResult, touchedDefenders: Set<string>, hasBonus: boolean) => void>(() => {});

  // Fetch player profiles
  useEffect(() => {
    if (!match) return;
    const allPlayerIds = [
      ...match.homeLineup.map(p => p.id),
      ...match.awayLineup.map(p => p.id),
    ].filter(id => id && !id.startsWith('p_'));

    if (allPlayerIds.length === 0) return;

    Promise.all(
      allPlayerIds.map(async (id) => {
        try {
          const res = await fetch(`/api/players/${id}`);
          if (res.ok) {
            const data = await res.json();
            return { id, avatar: data.player?.avatar || null };
          }
        } catch { /* skip */ }
        return null;
      })
    ).then(results => {
      const profiles: Record<string, { avatar?: string }> = {};
      results.forEach(r => {
        if (r && r.id) profiles[r.id] = { avatar: r.avatar || undefined };
      });
      setPlayerProfiles(prev => ({ ...prev, ...profiles }));
    });
  }, [match?.homeLineup.length, match?.awayLineup.length]);

  const formatTime = useCallback((seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  }, []);

  // ═══ CLEAR RAID GAP TIMER ═══
  const clearRaidGap = useCallback(() => {
    if (raidGapRef.current) clearInterval(raidGapRef.current);
    setRaidGapTimer(null);
  }, []);

  // ═══ MATCH TIMER LOGIC ═══
  useEffect(() => {
    if (!match?.isLive || isPaused || !hasStartedRaiding) {
      if (matchTimerRef.current) clearInterval(matchTimerRef.current);
      return;
    }

    matchTimerRef.current = setInterval(() => {
      const currentTimer = useKabaddiStore.getState().activeMatch?.timer ?? 0;
      if (currentTimer <= 0) {
        if (matchTimerRef.current) clearInterval(matchTimerRef.current);
        return;
      }
      setTimer(currentTimer - 1);
    }, 1000);

    return () => {
      if (matchTimerRef.current) clearInterval(matchTimerRef.current);
    };
  }, [match?.isLive, isPaused, hasStartedRaiding, setTimer]);

  // ═══ 5-MINUTE WARNING & HALF/END TIME DETECTION ═══
  useEffect(() => {
    if (!match?.isLive) return;
    const timer = match.timer;
    const halfDuration = match.halfDuration * 60; // convert minutes to seconds
    const fiveMinutes = 5 * 60; // 300 seconds

    // 5 minutes left in half or match
    if (timer === fiveMinutes && !fiveMinWarningFiredRef.current) {
      fiveMinWarningFiredRef.current = true;
      triggerFeedback(SoundType.FIVE_MINUTE_WARNING);
      toast({
        title: match.currentHalf === 2 ? '5 minutes left in match!' : '5 minutes left in half!',
        description: 'Time is running out',
        duration: 3000,
      });
    }

    // Reset 5-min warning flag when half changes
    if (timer === halfDuration) {
      fiveMinWarningFiredRef.current = false;
    }

    // Half time or match time completed (timer hits 0)
    if (timer === 0 && hasStartedRaiding) {
      if (match.currentHalf === 1) {
        // Half 1 complete
        triggerFeedback(SoundType.HALF_END);
        toast({
          title: 'Half time!',
          description: 'First half is complete',
          duration: 3000,
        });
      } else {
        // Match end (half 2 complete)
        triggerFeedback(SoundType.HALF_END);
        // Short delay then match end sound
        setTimeout(() => {
          triggerFeedback(SoundType.MATCH_END);
        }, 800);
        toast({
          title: 'Match over!',
          description: 'Full time — match is complete',
          duration: 4000,
        });
      }
    }
  }, [match?.timer, match?.isLive, match?.currentHalf, match?.halfDuration, hasStartedRaiding, toast]);

  // ═══ RAID TIMER LOGIC ═══
  useEffect(() => {
    if (raidTimer === null) {
      if (raidTimerRef.current) clearInterval(raidTimerRef.current);
      return;
    }

    if (raidTimer <= 0) {
      if (raidTimerRef.current) clearInterval(raidTimerRef.current);
      setRaidTimer(null);
      if (raidPhase !== 'idle' && raider) {
        // 🔊 Raid time expired — 30 seconds ran out!
        triggerFeedback(SoundType.RAID_TIME_EXPIRED);
        processRaidResultRef.current('empty', new Set(), false);
        toast({ title: 'Raid time expired!', description: 'Recorded as empty raid', duration: 2000 });
      }
      return;
    }

    raidTimerRef.current = setInterval(() => {
      setRaidTimer(prev => {
        if (prev === null || prev <= 1) {
          if (raidTimerRef.current) clearInterval(raidTimerRef.current);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      if (raidTimerRef.current) clearInterval(raidTimerRef.current);
    };
  }, [raidTimer !== null]); // eslint-disable-line react-hooks/exhaustive-deps

  // ═══ RAID TIMER HAPTIC COUNTDOWN ═══
  // Vibrate at key raid timer thresholds to warn scorer
  useEffect(() => {
    if (raidTimer === null || raidPhase === 'idle') return;

    // At 10 seconds: short warning vibration
    if (raidTimer === 10) {
      vibrate([40]);
    }
    // At 5 seconds: urgent double vibration
    if (raidTimer === 5) {
      vibrate([60, 30, 60]);
    }
    // At 3, 2, 1 seconds: countdown ticks
    if (raidTimer <= 3 && raidTimer > 0) {
      vibrate([30]);
    }
  }, [raidTimer, raidPhase]);

  // ═══ RAID GAP TIMER LOGIC ═══
  // After a raid ends, if no new raider is selected in 5 seconds, auto-pause
  useEffect(() => {
    if (raidGapTimer === null) {
      if (raidGapRef.current) clearInterval(raidGapRef.current);
      return;
    }

    if (raidGapTimer <= 0) {
      if (raidGapRef.current) clearInterval(raidGapRef.current);
      setRaidGapTimer(null);
      // Auto-pause if no raider selected
      if (raidPhase === 'idle' && hasStartedRaiding && !isPaused) {
        // 🔊 5-second gap expired — timer stopping!
        triggerFeedback(SoundType.RAID_GAP_WARNING);
        setIsPaused(true);
        toast({ title: 'Timer paused', description: 'Select a raider to resume', duration: 1500 });
      }
      return;
    }

    raidGapRef.current = setInterval(() => {
      setRaidGap(prev => {
        if (prev === null || prev <= 1) {
          if (raidGapRef.current) clearInterval(raidGapRef.current);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      if (raidGapRef.current) clearInterval(raidGapRef.current);
    };
  }, [raidGapTimer !== null]); // eslint-disable-line react-hooks/exhaustive-deps

  // Calculate MOTM
  const calculateMotm = useCallback(() => {
    if (!match) return null;
    const playerPoints: Record<string, { name: string; points: number }> = {};
    for (const event of match.events) {
      if (event.playerId && event.playerName) {
        if (!playerPoints[event.playerId]) {
          playerPoints[event.playerId] = { name: event.playerName, points: 0 };
        }
        playerPoints[event.playerId].points += event.value;
      }
    }
    let topPlayer: { name: string; points: number } | null = null;
    for (const p of Object.values(playerPoints)) {
      if (!topPlayer || p.points > topPlayer.points) topPlayer = p;
    }
    return topPlayer;
  }, [match]);

  const calculateTopRaiderDefender = useCallback(() => {
    if (!match) return { topRaider: null, topDefender: null };
    const playerRaidPoints: Record<string, { name: string; points: number }> = {};
    const playerTacklePoints: Record<string, { name: string; points: number }> = {};

    for (const event of match.events) {
      if (!event.playerId || !event.playerName) continue;
      if (['raid_point', 'bonus_point', 'super_raid', 'do_or_die_raid'].includes(event.eventType)) {
        if (!playerRaidPoints[event.playerId]) playerRaidPoints[event.playerId] = { name: event.playerName, points: 0 };
        playerRaidPoints[event.playerId].points += event.value;
      }
      if (['tackle_point', 'super_tackle'].includes(event.eventType)) {
        if (!playerTacklePoints[event.playerId]) playerTacklePoints[event.playerId] = { name: event.playerName, points: 0 };
        playerTacklePoints[event.playerId].points += event.value;
      }
    }

    let topRaider: { name: string; points: number } | null = null;
    for (const p of Object.values(playerRaidPoints)) {
      if (!topRaider || p.points > topRaider.points) topRaider = p;
    }
    let topDefender: { name: string; points: number } | null = null;
    for (const p of Object.values(playerTacklePoints)) {
      if (!topDefender || p.points > topDefender.points) topDefender = p;
    }
    return { topRaider, topDefender };
  }, [match]);

  if (!match) return null;

  // ═══ DERIVED STATE ═══
  const raidingTeam = match.raidQueue;
  const defendingTeam: 'home' | 'away' = raidingTeam === 'home' ? 'away' : 'home';

  const fullRaidingLineup = raidingTeam === 'home' ? match.homeLineup : match.awayLineup;
  const fullDefendingLineup = defendingTeam === 'home' ? match.homeLineup : match.awayLineup;

  const raidingOutIds = raidingTeam === 'home' ? match.homeOutPlayerIds : match.awayOutPlayerIds;
  const defendingOutIds = defendingTeam === 'home' ? match.homeOutPlayerIds : match.awayOutPlayerIds;

  const raidingTeamColor = raidingTeam === 'home' ? match.homeTeamColor : match.awayTeamColor;
  const defendingTeamColor = defendingTeam === 'home' ? match.homeTeamColor : match.awayTeamColor;

  const raidingTeamName = raidingTeam === 'home' ? match.homeTeam : match.awayTeam;
  const defendingTeamName = defendingTeam === 'home' ? match.homeTeam : match.awayTeam;

  // Split lineup: first 7 = on court, rest = substitutes
  const splitLineup = (lineup: MatchPlayer[], outIds: string[]) => {
    const onCourt = lineup.slice(0, ON_COURT_MAX);
    const substitutes = lineup.slice(ON_COURT_MAX);
    const onCourtActive = onCourt.filter(p => !outIds.includes(p.id));
    const onCourtOut = onCourt.filter(p => outIds.includes(p.id));
    return { onCourt, substitutes, onCourtActive, onCourtOut };
  };

  // Handle raider selection → starts raid timer AND match timer
  const handleSelectRaider = (player: MatchPlayer) => {
    if (raidingOutIds.includes(player.id)) return;
    if (raidPhase !== 'idle') return;

    // Auto-start match timer on first raider selection
    if (!hasStartedRaiding) setHasStartedRaiding(true);

    // If paused, auto-resume
    if (isPaused) setIsPaused(false);

    // Clear raid gap timer
    clearRaidGap();

    setRaider(player);
    setRaidPhase('result');
    setRaidResult(null);
    setSelectedDefenders(new Set());
    setBonusPoint(false);

    // Start 30s raid timer
    setRaidTimer(RAID_TIME_LIMIT);

    // 🔊 Whistle when raider starts — different sound if do-or-die
    if (match.isDoOrDie) {
      triggerFeedback(SoundType.DO_OR_DIE);
    } else {
      triggerFeedback(SoundType.WHISTLE);
    }
  };

  // Handle raid result selection
  const handleSelectResult = (result: RaidResult) => {
    if (result === 'empty') {
      processRaidResult(result, new Set(), false);
      return;
    }
    setRaidResult(result);
    setRaidPhase('defenders');
    setSelectedDefenders(new Set());
  };

  // Toggle defender selection
  const toggleDefender = (playerId: string) => {
    setSelectedDefenders(prev => {
      const next = new Set(prev);
      if (next.has(playerId)) next.delete(playerId);
      else next.add(playerId);
      return next;
    });
  };

  // Process raid result
  const processRaidResult = (result: RaidResult, touchedDefenders: Set<string>, hasBonus: boolean) => {
    if (!match || !raider) return;

    if (!hasStartedRaiding) setHasStartedRaiding(true);

    // Stop raid timer
    setRaidTimer(null);
    if (raidTimerRef.current) clearInterval(raidTimerRef.current);

    const raidingTeamId = raidingTeam === 'home' ? match.homeTeamId : match.awayTeamId;
    const defendingTeamId = defendingTeam === 'home' ? match.homeTeamId : match.awayTeamId;

    const events: Omit<MatchEvent, 'id' | 'timestamp'>[] = [];

    if (result === 'success') {
      const touchCount = touchedDefenders.size;
      if (touchCount > 0) {
        events.push({
          matchId: match.id, eventType: 'raid_point', teamId: raidingTeamId,
          half: match.currentHalf, playerId: raider.id, playerName: raider.name,
          value: touchCount,
          details: JSON.stringify({ touchedPlayerIds: Array.from(touchedDefenders), raiderId: raider.id }),
        });
      }
      if (hasBonus) {
        events.push({
          matchId: match.id, eventType: 'bonus_point', teamId: raidingTeamId,
          half: match.currentHalf, playerId: raider.id, playerName: raider.name,
          value: 1, details: JSON.stringify({ raiderId: raider.id }),
        });
      }

      // All out check
      const { onCourt } = splitLineup(fullDefendingLineup, defendingOutIds);
      const defendingOnCourtOut = onCourt.filter(p => defendingOutIds.includes(p.id)).length;
      const newDefendingOutCount = defendingOnCourtOut + touchCount;
      if (newDefendingOutCount >= onCourt.length) {
        events.push({
          matchId: match.id, eventType: 'all_out', teamId: raidingTeamId,
          half: match.currentHalf, value: 2,
        });
      }
    } else if (result === 'caught') {
      const caughtByIds = Array.from(touchedDefenders);
      const primaryCatcher = caughtByIds.length > 0
        ? fullDefendingLineup.find(p => caughtByIds.includes(p.id))
        : null;

      events.push({
        matchId: match.id, eventType: 'tackle_point', teamId: defendingTeamId,
        half: match.currentHalf,
        playerId: primaryCatcher?.id || raider.id, playerName: primaryCatcher?.name || raider.name,
        value: 1,
        details: JSON.stringify({ caughtByIds, raiderId: raider.id }),
      });

      const { onCourtActive } = splitLineup(fullDefendingLineup, defendingOutIds);
      if (onCourtActive.length <= 3) {
        events.push({
          matchId: match.id, eventType: 'super_tackle', teamId: defendingTeamId,
          half: match.currentHalf,
          playerId: primaryCatcher?.id || raider.id, playerName: primaryCatcher?.name || raider.name,
          value: 1,
          details: JSON.stringify({ caughtByIds, raiderId: raider.id }),
        });
      }
    } else if (result === 'empty') {
      events.push({
        matchId: match.id, eventType: 'empty_raid', teamId: raidingTeamId,
        half: match.currentHalf, playerId: raider.id, playerName: raider.name, value: 0,
      });

      // Track consecutive empty raids for do-or-die
      consecutiveEmptyRaidsRef.current += 1;
    }

    // Reset consecutive empty raids on any successful raid (points scored)
    if (result === 'success') {
      consecutiveEmptyRaidsRef.current = 0;
    }
    // Raider caught (tackle) also resets because the defending team scored
    if (result === 'caught') {
      consecutiveEmptyRaidsRef.current = 0;
    }

    // ═══ DO-OR-DIE LOGIC ═══
    // In kabaddi, after 2 consecutive empty raids, the next raid becomes do-or-die
    if (consecutiveEmptyRaidsRef.current >= 2) {
      setDoOrDie(true);
      // 🔊 Do-or-Die activated!
      triggerFeedback(SoundType.DO_OR_DIE);
      toast({
        title: '🔥 DO OR DIE RAID!',
        description: 'Next raider must score — or raider is out!',
        duration: 3000,
      });
    } else {
      setDoOrDie(false);
    }

    if (events.length > 0) {
      addBatchEvents(events);
    }

    // Reset raid state
    setRaidPhase('idle');
    setRaider(null);
    setRaidResult(null);
    setSelectedDefenders(new Set());
    setBonusPoint(false);

    // Start 5-second raid gap timer
    setRaidGapTimer(RAID_GAP_TIMEOUT);
  };

  // Keep ref in sync with latest processRaidResult - called after early return so we assign directly
  // eslint-disable-next-line react-hooks/rules-of-hooks
  processRaidResultRef.current = processRaidResult;

  const cancelRaid = () => {
    setRaidTimer(null);
    if (raidTimerRef.current) clearInterval(raidTimerRef.current);
    setRaidPhase('idle');
    setRaider(null);
    setRaidResult(null);
    setSelectedDefenders(new Set());
    setBonusPoint(false);

    // Start raid gap timer since we're back to idle
    if (hasStartedRaiding) setRaidGapTimer(RAID_GAP_TIMEOUT);
  };

  const handleEndMatch = async () => {
    if (showEndMatchConfirm) {
      const motm = calculateMotm();
      const { topRaider, topDefender } = calculateTopRaiderDefender();

      setSavedMatchData({
        homeTeam: match.homeTeam, awayTeam: match.awayTeam,
        homeScore: match.homeScore, awayScore: match.awayScore,
        homeTeamColor: match.homeTeamColor, awayTeamColor: match.awayTeamColor,
        gender: match.gender, topRaider, topDefender, motm,
      });

      try {
        await fetch('/api/matches', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            homeTeamName: match.homeTeam, awayTeamName: match.awayTeam,
            homeTeamColor: match.homeTeamColor, awayTeamColor: match.awayTeamColor,
            homeScore: match.homeScore, awayScore: match.awayScore,
            gender: match.gender, isPractice: match.isPractice,
            halfDuration: match.halfDuration, playersPerSide: match.playersPerSide,
            events: match.events.map(e => ({
              eventType: e.eventType, teamId: e.teamId, half: e.half,
              playerId: e.playerId, value: e.value, details: e.details,
            })),
          }),
        });
      } catch (err) {
        console.error('Failed to save match:', err);
      }

      addNotification(matchNotification(match.homeTeam, match.awayTeam, match.homeScore, match.awayScore));

      if (motm) {
        setMotmPlayer(motm);
        setShowMotmOverlay(true);
      }

      endMatch();
      // 🔊 Match ended
      triggerFeedback(SoundType.MATCH_END);
      setShowEndMatchConfirm(false);
    } else {
      setShowEndMatchConfirm(true);
      setTimeout(() => setShowEndMatchConfirm(false), 3000);
    }
  };

  const handleEndHalf = () => {
    if (showEndHalfConfirm) {
      // 🔊 Half ended manually
      triggerFeedback(SoundType.HALF_END);
      switchHalf();
      setHasStartedRaiding(false);
      setRaidTimer(null);
      if (raidTimerRef.current) clearInterval(raidTimerRef.current);
      clearRaidGap();
      setRaidPhase('idle');
      setRaider(null);
      // Reset do-or-die and empty raid tracking for new half
      setDoOrDie(false);
      consecutiveEmptyRaidsRef.current = 0;
      fiveMinWarningFiredRef.current = false;
      setShowEndHalfConfirm(false);
    } else {
      setShowEndHalfConfirm(true);
      setTimeout(() => setShowEndHalfConfirm(false), 3000);
    }
  };

  const handlePause = () => {
    const newPaused = !isPaused;
    setIsPaused(newPaused);

    if (newPaused) {
      // Pausing: stop raid timer + gap timer
      if (raidTimerRef.current) clearInterval(raidTimerRef.current);
      clearRaidGap();
    } else {
      // Resuming: restart raid timer if active
      if (raidTimer !== null) {
        raidTimerRef.current = setInterval(() => {
          setRaidTimer(prev => {
            if (prev === null || prev <= 1) {
              if (raidTimerRef.current) clearInterval(raidTimerRef.current);
              return 0;
            }
            return prev - 1;
          });
        }, 1000);
      }
    }
  };

  const handleUndo = () => {
    undoLastRaid();
    clearRaidGap();
    if (hasStartedRaiding) setRaidGapTimer(RAID_GAP_TIMEOUT);
    toast({ title: 'Last raid undone', duration: 1500 });
  };

  const handleTimeout = () => {
    if (!hasStartedRaiding) setHasStartedRaiding(true);
    const teamId = raidingTeam === 'home' ? match.homeTeamId : match.awayTeamId;
    callTimeout(raidingTeam);
    setIsPaused(true);
    if (raidTimerRef.current) clearInterval(raidTimerRef.current);
    clearRaidGap();
    addEvent({
      matchId: match.id, eventType: 'timeout', teamId,
      half: match.currentHalf, value: 0,
    });
  };

  // Substitute handler
  const handleSub = (outPlayer: MatchPlayer, inPlayer: MatchPlayer) => {
    // In kabaddi, substitution is tracked as an event
    const teamId = outPlayer.team === 'home' ? match.homeTeamId : match.awayTeamId;
    addEvent({
      matchId: match.id,
      eventType: 'substitution' as any,
      teamId,
      half: match.currentHalf,
      playerId: inPlayer.id,
      playerName: inPlayer.name,
      value: 0,
      details: JSON.stringify({ outPlayerId: outPlayer.id, outPlayerName: outPlayer.name, inPlayerId: inPlayer.id }),
    });

    // Swap players in lineup
    const store = useKabaddiStore.getState();
    const m = store.activeMatch;
    if (!m) return;

    const swapInLineup = (lineup: MatchPlayer[]) => {
      const outIdx = lineup.findIndex(p => p.id === outPlayer.id);
      const inIdx = lineup.findIndex(p => p.id === inPlayer.id);
      if (outIdx === -1 || inIdx === -1) return lineup;
      const newLineup = [...lineup];
      // Swap positions
      [newLineup[outIdx], newLineup[inIdx]] = [newLineup[inIdx], newLineup[outIdx]];
      return newLineup;
    };

    if (outPlayer.team === 'home') {
      useKabaddiStore.setState({
        activeMatch: { ...m, homeLineup: swapInLineup(m.homeLineup) },
      });
    } else {
      useKabaddiStore.setState({
        activeMatch: { ...m, awayLineup: swapInLineup(m.awayLineup) },
      });
    }

    setShowSubMode(null);
    setSubOutPlayer(null);
    toast({ title: `${inPlayer.name} subs in for ${outPlayer.name}`, duration: 2000 });
  };

  // ─── Player Circle Component ───
  const PlayerCircle = ({
    player,
    isOut,
    isRaiding,
    isSelectable,
    isSelected,
    teamColor,
    onSelect,
    showCheck,
    size = 'normal',
  }: {
    player: MatchPlayer;
    isOut: boolean;
    isRaiding?: boolean;
    isSelectable?: boolean;
    isSelected?: boolean;
    teamColor: string;
    onSelect?: (p: MatchPlayer) => void;
    showCheck?: boolean;
    size?: 'normal' | 'small';
  }) => {
    const profile = playerProfiles[player.id];
    const initials = player.name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
    const isSmall = size === 'small';
    const circleSize = isSmall ? 'w-10 h-10' : 'w-14 h-14';
    const textSize = isSmall ? 'text-xs' : 'text-base';
    const nameWidth = isSmall ? 'max-w-[52px]' : 'max-w-[64px]';
    const nameSize = isSmall ? 'text-[8px]' : 'text-[10px]';

    return (
      <motion.button
        whileTap={isSelectable && !isOut ? { scale: 0.9 } : {}}
        onClick={() => isSelectable && !isOut && onSelect?.(player)}
        className={`relative flex flex-col items-center gap-1 transition-all ${
          isSelectable && !isOut ? 'cursor-pointer' : 'cursor-default'
        } ${isOut ? 'opacity-35' : ''}`}
      >
        <div
          className={`relative ${circleSize} rounded-full overflow-hidden transition-all ${
            isRaiding
              ? 'ring-[3px] ring-yellow-400 ring-offset-2 shadow-lg shadow-yellow-400/30'
              : isSelected
                ? 'ring-[3px] ring-white ring-offset-2 scale-110'
                : ''
          }`}
          style={{
            borderWidth: '3px',
            borderStyle: isOut ? 'dashed' : 'solid',
            borderColor: isOut ? '#d1d5db' : teamColor,
          }}
        >
          {profile?.avatar ? (
            <img src={profile.avatar} alt={player.name} className="w-full h-full object-cover" />
          ) : (
            <div
              className="w-full h-full flex items-center justify-center"
              style={{ backgroundColor: isOut ? '#f3f4f6' : `${teamColor}22` }}
            >
              <span className={`${textSize} font-bold`} style={{ color: isOut ? '#9ca3af' : teamColor }}>
                {initials}
              </span>
            </div>
          )}

          {isOut && (
            <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
              <span className="text-white font-black tracking-wider" style={{ fontSize: isSmall ? '6px' : '8px' }}>OUT</span>
            </div>
          )}

          {isSelected && showCheck && (
            <div className="absolute -top-0.5 -right-0.5 w-4 h-4 rounded-full bg-green-500 flex items-center justify-center border-2 border-white">
              <Check className="w-2.5 h-2.5 text-white" />
            </div>
          )}

          <div
            className="absolute -bottom-0.5 -right-0.5 min-w-[16px] h-[16px] rounded-full flex items-center justify-center font-black border-2 border-white shadow-sm"
            style={{ backgroundColor: isOut ? '#e5e7eb' : teamColor, color: '#fff', fontSize: isSmall ? '6px' : '8px' }}
          >
            {player.jerseyNumber || '?'}
          </div>
        </div>

        <span className={`${nameSize} font-semibold leading-tight truncate ${nameWidth} text-center ${
          isOut ? 'text-gray-400 line-through' : 'text-gray-700'
        }`}>
          {player.name.split(' ').length > 1
            ? `${player.name.split(' ')[0]} ${player.name.split(' ')[1][0]}.`
            : player.name.split(' ')[0]
          }
        </span>
      </motion.button>
    );
  };

  // ─── Render Team Section ───
  const TeamSection = ({
    side,
    teamName,
    teamColor,
    score,
    fullLineup,
    outIds,
    isRaidingSide,
  }: {
    side: 'home' | 'away';
    teamName: string;
    teamColor: string;
    score: number;
    fullLineup: MatchPlayer[];
    outIds: string[];
    isRaidingSide: boolean;
  }) => {
    const isIdle = raidPhase === 'idle';
    const canSelect = isRaidingSide && isIdle;
    const { onCourt, substitutes, onCourtActive, onCourtOut } = splitLineup(fullLineup, outIds);

    return (
      <div className={`relative px-3 pt-3 pb-2 transition-all ${
        isRaidingSide && isIdle ? 'bg-gradient-to-b from-white to-gray-50' : 'bg-white'
      }`}>
        {/* Team header */}
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <div
              className="w-8 h-8 rounded-full flex items-center justify-center text-white font-bold text-xs shadow-sm"
              style={{ backgroundColor: teamColor }}
            >
              {teamName.charAt(0)}
            </div>
            <div>
              <div className="text-sm font-bold text-gray-800 truncate max-w-[100px]">{teamName}</div>
              <div className="text-[10px] text-gray-400">
                {onCourtActive.length} on court
                {onCourtOut.length > 0 && ` · ${onCourtOut.length} out`}
                {substitutes.length > 0 && ` · ${substitutes.length} sub`}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {/* Sub button */}
            {substitutes.length > 0 && (
              <button
                onClick={() => setShowSubMode(side)}
                className="text-[9px] font-bold px-2 py-1 rounded-lg bg-gray-100 text-gray-500 hover:bg-gray-200 transition-colors flex items-center gap-0.5"
              >
                <ArrowLeftRight className="w-3 h-3" />
                SUB
              </button>
            )}
            <div className="text-3xl font-black" style={{ color: teamColor }}>{score}</div>
          </div>
        </div>

        {/* On Court players (first 7) */}
        <div className="flex flex-wrap justify-center gap-x-3 gap-y-2">
          {onCourt.map(player => (
            <PlayerCircle
              key={player.id}
              player={player}
              isOut={outIds.includes(player.id)}
              isRaiding={isRaidingSide && raider?.id === player.id && raidPhase !== 'idle'}
              isSelectable={canSelect && !outIds.includes(player.id)}
              teamColor={teamColor}
              onSelect={handleSelectRaider}
            />
          ))}
        </div>

        {/* Substitutes (rest) */}
        {substitutes.length > 0 && (
          <div className="mt-2 pt-2 border-t border-dashed border-gray-200">
            <div className="text-[8px] font-bold text-gray-400 uppercase tracking-wider mb-1.5 text-center">
              Substitutes
            </div>
            <div className="flex flex-wrap justify-center gap-x-2 gap-y-1">
              {substitutes.map(player => (
                <PlayerCircle
                  key={player.id}
                  player={player}
                  isOut={false}
                  isSelectable={false}
                  teamColor={teamColor}
                  size="small"
                />
              ))}
            </div>
          </div>
        )}

        {/* Raid indicator */}
        {isRaidingSide && isIdle && (
          <motion.div
            animate={{ opacity: [0.5, 1, 0.5] }}
            transition={{ duration: 2, repeat: Infinity }}
            className="mt-2 text-center"
          >
            <span
              className="inline-flex items-center gap-1 text-[10px] font-bold px-3 py-1 rounded-full"
              style={{ backgroundColor: `${teamColor}18`, color: teamColor }}
            >
              <Zap className="w-3 h-3" />
              TAP A PLAYER TO RAID
            </span>
          </motion.div>
        )}
      </div>
    );
  };

  // Raid timer progress percentage
  const raidTimerPercent = raidTimer !== null ? (raidTimer / RAID_TIME_LIMIT) * 100 : 100;
  const raidTimerColor = raidTimer !== null
    ? raidTimer > 15 ? '#22c55e'
      : raidTimer > 5 ? '#f59e0b'
        : '#ef4444'
    : '#22c55e';

  // Raid gap indicator
  const showGapIndicator = raidGapTimer !== null && raidGapTimer > 0 && raidPhase === 'idle';

  return (
    <div className="flex flex-col h-[calc(100vh-80px)] bg-gray-50">
      {/* Share Scorecard Overlay */}
      {showShareScorecard && savedMatchData && (
        <ShareScorecard onClose={() => setShowShareScorecard(false)} matchData={savedMatchData} />
      )}

      {/* Substitute Mode Overlay */}
      <AnimatePresence>
        {showSubMode && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-end justify-center"
          >
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              className="w-full max-w-md bg-white rounded-t-3xl p-4 max-h-[70vh] overflow-y-auto"
            >
              <div className="flex items-center justify-between mb-4">
                <div>
                  <div className="text-sm font-black text-gray-800">Substitution</div>
                  <div className="text-[10px] text-gray-400">
                    Tap an on-court player OUT, then tap a substitute IN
                  </div>
                </div>
                <button
                  onClick={() => { setShowSubMode(null); setSubOutPlayer(null); }}
                  className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center"
                >
                  <X className="w-4 h-4 text-gray-500" />
                </button>
              </div>

              {(() => {
                const lineup = showSubMode === 'home' ? match.homeLineup : match.awayLineup;
                const outIds = showSubMode === 'home' ? match.homeOutPlayerIds : match.awayOutPlayerIds;
                const color = showSubMode === 'home' ? match.homeTeamColor : match.awayTeamColor;
                const { onCourt, substitutes } = splitLineup(lineup, outIds);

                return (
                  <>
                    {/* On court - tap to select OUT */}
                    {!subOutPlayer && (
                      <>
                        <div className="text-[10px] font-bold text-red-600 uppercase mb-2">
                          1. Tap player going OUT
                        </div>
                        <div className="flex flex-wrap justify-center gap-x-3 gap-y-2 mb-4">
                          {onCourt.map(player => (
                            <PlayerCircle
                              key={player.id}
                              player={player}
                              isOut={outIds.includes(player.id)}
                              isSelectable={!outIds.includes(player.id)}
                              teamColor={color}
                              onSelect={(p) => setSubOutPlayer(p)}
                            />
                          ))}
                        </div>
                      </>
                    )}

                    {/* Selected OUT player */}
                    {subOutPlayer && (
                      <>
                        <div className="text-[10px] font-bold text-red-600 uppercase mb-2">
                          Going OUT:
                        </div>
                        <div className="flex justify-center mb-3">
                          <PlayerCircle player={subOutPlayer} isOut={false} teamColor={color} />
                        </div>

                        <div className="text-[10px] font-bold text-green-600 uppercase mb-2">
                          2. Tap substitute coming IN
                        </div>
                        <div className="flex flex-wrap justify-center gap-x-3 gap-y-2 mb-3">
                          {substitutes.map(player => (
                            <PlayerCircle
                              key={player.id}
                              player={player}
                              isOut={false}
                              isSelectable={true}
                              teamColor={color}
                              onSelect={(p) => handleSub(subOutPlayer, p)}
                            />
                          ))}
                        </div>

                        <button
                          onClick={() => setSubOutPlayer(null)}
                          className="w-full py-2 rounded-xl bg-gray-100 text-gray-600 font-bold text-sm"
                        >
                          Cancel selection
                        </button>
                      </>
                    )}
                  </>
                );
              })()}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* MOTM Celebration Overlay */}
      <AnimatePresence>
        {showMotmOverlay && motmPlayer && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-6"
          >
            <motion.div
              initial={{ scale: 0.5, opacity: 0, y: 30 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.5, opacity: 0, y: 30 }}
              transition={{ type: 'spring', damping: 15, stiffness: 200 }}
              className="w-full max-w-sm bg-gradient-to-b from-yellow-50 to-white rounded-3xl p-6 text-center"
            >
              <motion.div animate={{ scale: [1, 1.2, 1], rotate: [0, -5, 5, -5, 0] }} transition={{ duration: 1, repeat: 3 }} className="text-5xl mb-3">🏆</motion.div>
              <div className="text-[10px] font-bold text-yellow-700 bg-yellow-100 px-3 py-1 rounded-full inline-flex items-center gap-1 mb-3">
                <Crown className="w-3 h-3" /> MAN OF THE MATCH
              </div>
              <h3 className="text-xl font-black text-gray-800">{motmPlayer.name}</h3>
              <p className="text-yellow-700 font-bold text-lg mt-1">{motmPlayer.points} points</p>
              <p className="text-gray-500 text-sm mt-2">Top scorer in {match.homeTeam} vs {match.awayTeam}</p>
              <div className="flex gap-3 mt-5">
                <button onClick={() => setShowShareScorecard(true)} className="flex-1 bg-teal-600 hover:bg-teal-700 text-white font-bold rounded-xl py-3 flex items-center justify-center gap-1">
                  <Share2 className="w-4 h-4" /> Share
                </button>
                <button onClick={() => setShowMotmOverlay(false)} className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold rounded-xl py-3">
                  Done
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ═══ TOP BAR ═══ */}
      <div className="bg-gray-900 text-white">
        {/* Main timer row */}
        <div className="px-4 py-2 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-[10px] bg-gray-700 px-2 py-0.5 rounded font-medium">
              7v7
            </span>
            {match.isPractice && (
              <span className="text-[10px] bg-green-900 text-green-300 px-2 py-0.5 rounded font-medium">Practice</span>
            )}
            {match.isDoOrDie && (
              <motion.span animate={{ scale: [1, 1.05, 1] }} transition={{ duration: 0.8, repeat: Infinity }} className="text-[10px] bg-red-700 text-red-100 px-2 py-0.5 rounded font-bold">
                🔥 DO OR DIE
              </motion.span>
            )}
          </div>
          <div className="text-center">
            <div className="text-xl font-mono font-bold tracking-wider">
              {!hasStartedRaiding ? '--:--' : formatTime(match.timer)}
            </div>
            <div className="text-[10px] text-gray-400 -mt-0.5">
              Half {match.currentHalf} · {match.halfDuration}min
            </div>
          </div>
          <div className="text-[10px] text-gray-400 font-medium">
            {match.gender === 'male' ? '♂ Boys' : '♀ Girls'}
          </div>
        </div>

        {/* ═══ RAID TIMER BAR ═══ */}
        <AnimatePresence>
          {raidTimer !== null && raidPhase !== 'idle' && (
            <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.2 }} className="overflow-hidden">
              <div className="px-4 pb-2">
                <div className="flex items-center gap-2">
                  <Clock className="w-3.5 h-3.5 flex-shrink-0" style={{ color: raidTimerColor }} />
                  <div className="flex-1 h-2 bg-gray-700 rounded-full overflow-hidden">
                    <motion.div className="h-full rounded-full" style={{ backgroundColor: raidTimerColor }} animate={{ width: `${raidTimerPercent}%` }} transition={{ duration: 0.5 }} />
                  </div>
                  <span className="text-sm font-mono font-black min-w-[28px] text-right" style={{ color: raidTimerColor }}>{raidTimer}</span>
                </div>
                {raidTimer <= 5 && raidTimer > 0 && (
                  <motion.div animate={{ opacity: [0.5, 1, 0.5] }} transition={{ duration: 0.5, repeat: Infinity }} className="text-center text-[9px] font-bold mt-0.5" style={{ color: raidTimerColor }}>
                    RAID TIME RUNNING OUT!
                  </motion.div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ═══ RAID GAP INDICATOR ═══ */}
        <AnimatePresence>
          {showGapIndicator && (
            <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
              <div className="px-4 pb-1.5 flex items-center justify-center gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
                <span className="text-[9px] text-amber-400 font-bold">
                  Timer pauses in {raidGapTimer}s — Select a raider!
                </span>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* ═══ SCORE BAR ═══ */}
      <div className="bg-white border-b border-gray-100 px-4 py-2 flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-full flex items-center justify-center text-white text-[10px] font-bold" style={{ backgroundColor: match.homeTeamColor }}>{match.homeTeam.charAt(0)}</div>
          <span className="text-sm font-bold text-gray-800 truncate max-w-[100px]">{match.homeTeam}</span>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-2xl font-black" style={{ color: match.homeTeamColor }}>{match.homeScore}</span>
          <span className="text-xs text-gray-300 font-bold">-</span>
          <span className="text-2xl font-black" style={{ color: match.awayTeamColor }}>{match.awayScore}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm font-bold text-gray-800 truncate max-w-[100px]">{match.awayTeam}</span>
          <div className="w-6 h-6 rounded-full flex items-center justify-center text-white text-[10px] font-bold" style={{ backgroundColor: match.awayTeamColor }}>{match.awayTeam.charAt(0)}</div>
        </div>
      </div>

      {/* ═══ TEAM SECTIONS ═══ */}
      <div className="flex-1 overflow-y-auto">
        <TeamSection
          side="home" teamName={match.homeTeam} teamColor={match.homeTeamColor}
          score={match.homeScore} fullLineup={match.homeLineup}
          outIds={match.homeOutPlayerIds} isRaidingSide={raidingTeam === 'home'}
        />
        <div className="h-px bg-gray-200 mx-4" />
        <TeamSection
          side="away" teamName={match.awayTeam} teamColor={match.awayTeamColor}
          score={match.awayScore} fullLineup={match.awayLineup}
          outIds={match.awayOutPlayerIds} isRaidingSide={raidingTeam === 'away'}
        />
      </div>

      {/* ═══ RAID FLOW OVERLAYS ═══ */}
      <AnimatePresence>
        {raidPhase === 'result' && raider && (
          <motion.div initial={{ opacity: 0, y: 60 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 60 }} transition={{ type: 'spring', damping: 25, stiffness: 300 }} className="fixed inset-x-0 bottom-[76px] z-40 px-4">
            <div className="bg-white rounded-2xl shadow-2xl border border-gray-100 p-4 max-w-md mx-auto">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 rounded-full flex items-center justify-center text-white font-bold text-lg shadow-md" style={{ backgroundColor: raidingTeamColor }}>
                  {raider.name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)}
                </div>
                <div className="flex-1">
                  <div className="text-base font-black text-gray-800">#{raider.jerseyNumber || '?'} {raider.name}</div>
                  <div className="text-xs text-gray-400">goes to raid for {raidingTeamName}</div>
                </div>
                {raidTimer !== null && (
                  <div className="relative w-11 h-11 flex-shrink-0">
                    <svg className="w-11 h-11 -rotate-90" viewBox="0 0 44 44">
                      <circle cx="22" cy="22" r="19" fill="none" stroke="#e5e7eb" strokeWidth="3" />
                      <circle cx="22" cy="22" r="19" fill="none" stroke={raidTimerColor} strokeWidth="3"
                        strokeDasharray={`${2 * Math.PI * 19}`} strokeDashoffset={`${2 * Math.PI * 19 * (1 - raidTimer / RAID_TIME_LIMIT)}`}
                        strokeLinecap="round" className="transition-all duration-500" />
                    </svg>
                    <div className="absolute inset-0 flex items-center justify-center">
                      <span className="text-xs font-black" style={{ color: raidTimerColor }}>{raidTimer}</span>
                    </div>
                  </div>
                )}
                <button onClick={cancelRaid} className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center flex-shrink-0">
                  <X className="w-4 h-4 text-gray-500" />
                </button>
              </div>

              <div className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">What happened?</div>

              <div className="space-y-2">
                <motion.button whileTap={{ scale: 0.97 }} onClick={() => handleSelectResult('success')} className="w-full py-3.5 px-4 rounded-xl bg-green-50 border-2 border-green-200 hover:border-green-400 hover:bg-green-100 flex items-center gap-3 transition-colors">
                  <div className="w-10 h-10 rounded-full bg-green-500 flex items-center justify-center flex-shrink-0"><Check className="w-5 h-5 text-white" /></div>
                  <div className="text-left"><div className="font-bold text-green-800">Raid Success</div><div className="text-[10px] text-green-600">Raider returned with points</div></div>
                </motion.button>
                <motion.button whileTap={{ scale: 0.97 }} onClick={() => handleSelectResult('caught')} className="w-full py-3.5 px-4 rounded-xl bg-red-50 border-2 border-red-200 hover:border-red-400 hover:bg-red-100 flex items-center gap-3 transition-colors">
                  <div className="w-10 h-10 rounded-full bg-red-500 flex items-center justify-center flex-shrink-0"><Shield className="w-5 h-5 text-white" /></div>
                  <div className="text-left"><div className="font-bold text-red-800">Raider Caught</div><div className="text-[10px] text-red-600">Defenders tackled the raider</div></div>
                </motion.button>
                <motion.button whileTap={{ scale: 0.97 }} onClick={() => handleSelectResult('empty')} className="w-full py-3.5 px-4 rounded-xl bg-gray-50 border-2 border-gray-200 hover:border-gray-400 hover:bg-gray-100 flex items-center gap-3 transition-colors">
                  <div className="w-10 h-10 rounded-full bg-gray-400 flex items-center justify-center flex-shrink-0"><Swords className="w-5 h-5 text-white" /></div>
                  <div className="text-left"><div className="font-bold text-gray-700">Empty Raid</div><div className="text-[10px] text-gray-500">No points scored</div></div>
                </motion.button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {raidPhase === 'defenders' && raider && raidResult && (
          <motion.div initial={{ opacity: 0, y: 60 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 60 }} transition={{ type: 'spring', damping: 25, stiffness: 300 }} className="fixed inset-x-0 bottom-[76px] z-40 px-4">
            <div className="bg-white rounded-2xl shadow-2xl border border-gray-100 p-4 max-w-md mx-auto max-h-[60vh] overflow-y-auto">
              <div className="flex items-center justify-between mb-3">
                <div className="flex-1">
                  {raidResult === 'success' ? (
                    <><div className="text-sm font-black text-green-700">✅ Tap defenders the raider touched</div>
                    <div className="text-[10px] text-gray-400 mt-0.5">Each selected defender = 1 point for {raidingTeamName}</div></>
                  ) : (
                    <><div className="text-sm font-black text-red-700">❌ Who caught the raider?</div>
                    <div className="text-[10px] text-gray-400 mt-0.5">Select the defender(s) who tackled</div></>
                  )}
                </div>
                {raidTimer !== null && (
                  <div className="flex items-center gap-1 flex-shrink-0 mr-2">
                    <Clock className="w-3.5 h-3.5" style={{ color: raidTimerColor }} />
                    <span className="text-sm font-black font-mono" style={{ color: raidTimerColor }}>{raidTimer}</span>
                  </div>
                )}
                <button onClick={() => { setRaidPhase('result'); setSelectedDefenders(new Set()); setBonusPoint(false); }} className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center flex-shrink-0">
                  <X className="w-4 h-4 text-gray-500" />
                </button>
              </div>

              {/* Only show on-court defenders (first 7) */}
              <div className="flex flex-wrap justify-center gap-x-4 gap-y-3 py-3">
                {(() => {
                  const { onCourt } = splitLineup(fullDefendingLineup, defendingOutIds);
                  return onCourt.map(player => {
                    const isOut = defendingOutIds.includes(player.id);
                    const isSelected = selectedDefenders.has(player.id);
                    const canSelect = !isOut;
                    return (
                      <PlayerCircle key={player.id} player={player} isOut={isOut} isSelectable={canSelect}
                        isSelected={isSelected} teamColor={defendingTeamColor}
                        onSelect={() => canSelect && toggleDefender(player.id)} showCheck />
                    );
                  });
                })()}
              </div>

              {raidResult === 'success' && (
                <button onClick={() => setBonusPoint(!bonusPoint)}
                  className={`mt-2 w-full py-2.5 rounded-xl text-sm font-bold transition-all flex items-center justify-center gap-2 ${
                    bonusPoint ? 'bg-yellow-100 border-2 border-yellow-400 text-yellow-800' : 'bg-gray-50 border-2 border-gray-200 text-gray-500'
                  }`}>
                  <span className="text-lg">⭐</span>Bonus Point {bonusPoint ? 'ON' : 'OFF'}
                </button>
              )}

              <div className="mt-3 flex items-center gap-3">
                <div className="flex-1">
                  {raidResult === 'success' && (
                    <div className="text-xs text-gray-500">
                      <span className="font-bold text-green-700">+{selectedDefenders.size + (bonusPoint ? 1 : 0)}</span> point{selectedDefenders.size + (bonusPoint ? 1 : 0) !== 1 ? 's' : ''} for {raidingTeamName}
                    </div>
                  )}
                  {raidResult === 'caught' && (() => {
                    const { onCourtActive } = splitLineup(fullDefendingLineup, defendingOutIds);
                    return (
                      <div className="text-xs text-gray-500">
                        <span className="font-bold text-red-700">+1</span> tackle point for {defendingTeamName}
                        {onCourtActive.length <= 3 && <span className="ml-1 text-purple-600 font-bold">(+1 super tackle!)</span>}
                      </div>
                    );
                  })()}
                </div>
                <motion.button whileTap={{ scale: 0.95 }}
                  onClick={() => processRaidResult(raidResult, selectedDefenders, bonusPoint)}
                  disabled={raidResult === 'success' && selectedDefenders.size === 0 && !bonusPoint}
                  className="px-6 py-3 rounded-xl font-bold text-white shadow-lg disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                  style={{ backgroundColor: raidResult === 'success' ? '#16a34a' : '#dc2626' }}>
                  <Check className="w-4 h-4 inline mr-1" />Confirm
                </motion.button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ═══ BOTTOM CONTROL BAR ═══ */}
      <div className="border-t border-gray-200 bg-white px-3 py-2.5">
        <div className="grid grid-cols-5 gap-1">
          <button onClick={handleUndo} disabled={match.events.length === 0} className="flex flex-col items-center gap-0.5 py-1 rounded-xl transition-colors active:bg-gray-100 disabled:opacity-30">
            <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center"><Undo2 className="w-4 h-4 text-gray-600" /></div>
            <span className="text-[9px] font-semibold text-gray-500">UNDO</span>
          </button>
          <button onClick={handlePause} className="flex flex-col items-center gap-0.5 py-1 rounded-xl transition-colors active:bg-gray-100">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center ${isPaused ? 'bg-teal-100 text-teal-600' : 'bg-gray-100 text-gray-600'}`}>
              {isPaused ? <Play className="w-4 h-4" /> : <Pause className="w-4 h-4" />}
            </div>
            <span className="text-[9px] font-semibold text-gray-500">{isPaused ? 'PLAY' : 'PAUSE'}</span>
          </button>
          <button onClick={handleTimeout} className="flex flex-col items-center gap-0.5 py-1 rounded-xl transition-colors active:bg-gray-100">
            <div className="w-8 h-8 rounded-full bg-orange-100 flex items-center justify-center"><Hand className="w-4 h-4 text-orange-600" /></div>
            <span className="text-[9px] font-semibold text-gray-500">TIMEOUT</span>
          </button>
          <button onClick={handleEndHalf} className={`flex flex-col items-center gap-0.5 py-1 rounded-xl transition-colors ${showEndHalfConfirm ? 'bg-yellow-50' : 'active:bg-gray-100'}`}>
            <div className={`w-8 h-8 rounded-full flex items-center justify-center ${showEndHalfConfirm ? 'bg-yellow-200 text-yellow-700 animate-pulse' : 'bg-yellow-100 text-yellow-600'}`}><Timer className="w-4 h-4" /></div>
            <span className={`text-[9px] font-semibold ${showEndHalfConfirm ? 'text-yellow-700' : 'text-gray-500'}`}>{showEndHalfConfirm ? 'CONFIRM?' : `END H${match.currentHalf}`}</span>
          </button>
          <button onClick={handleEndMatch} className={`flex flex-col items-center gap-0.5 py-1 rounded-xl transition-colors ${showEndMatchConfirm ? 'bg-red-50' : 'active:bg-gray-100'}`}>
            <div className={`w-8 h-8 rounded-full flex items-center justify-center ${showEndMatchConfirm ? 'bg-red-200 text-red-700 animate-pulse' : 'bg-red-100 text-red-600'}`}><Square className="w-4 h-4" /></div>
            <span className={`text-[9px] font-semibold ${showEndMatchConfirm ? 'text-red-700' : 'text-gray-500'}`}>{showEndMatchConfirm ? 'CONFIRM?' : 'END'}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
