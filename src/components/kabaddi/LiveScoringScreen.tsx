'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Undo2, Pause, Play, Square, Timer, Swords, X, Check,
  Crown, Share2, Zap, Shield, Hand, Clock, ArrowLeftRight,
  ChevronUp, AlertTriangle, Sparkles, Flame,
  ArrowRight, ArrowRightLeft,
  MessageSquare, ChevronDown, UserPlus,
} from 'lucide-react';
import { useKabaddiStore, type MatchPlayer, type MatchEvent } from '@/lib/store';
import { useToast } from '@/hooks/use-toast';
import ShareScorecard from './ShareScorecard';
import ScorerTransferScreen from './ScorerTransferScreen';
import { matchNotification } from '@/lib/notifications';
import { triggerFeedback, SoundType, vibrate } from '@/lib/sounds';
import { cn } from '@/lib/utils';

// Raid flow states
type RaidPhase = 'idle' | 'result' | 'defenders';
type RaidResult = 'success' | 'caught' | 'empty' | null;
type ActionTab = 'raid' | 'defense' | 'special' | 'cards';

const RAID_TIME_LIMIT = 30; // seconds
const ON_COURT_MAX = 7; // kabaddi standard: 7 players on court
const RAID_GAP_TIMEOUT = 5; // seconds after raid ends before auto-pause
const MAX_TIMEOUTS = 2; // max timeouts per team (practice matches)
const TIMEOUT_DURATION = 120; // 2 minutes timeout duration

// ─── Confetti Particle ──────────────────────────────────────────────

function ConfettiParticle({ delay, color, index }: { delay: number; color: string; index: number }) {
  const leftPos = (index * 17 + 13) % 100;
  const rotateEnd = (index * 47 + 23) % 720 - 360;
  const xDrift = ((index * 31) % 80) - 40;

  return (
    <motion.div
      initial={{ y: -20, x: 0, rotate: 0, opacity: 1 }}
      animate={{ y: '100vh', x: xDrift, rotate: rotateEnd, opacity: 0 }}
      transition={{ duration: 3 + (index % 3), delay, ease: 'easeIn' }}
      className="absolute top-0 w-2 h-2 rounded-sm"
      style={{ left: `${leftPos}%`, backgroundColor: color }}
    />
  );
}

function MatchEndCelebration({
  homeTeam,
  awayTeam,
  homeScore,
  awayScore,
  homeColor,
  awayColor,
  onShare,
  onDone,
  motm,
}: {
  homeTeam: string;
  awayTeam: string;
  homeScore: number;
  awayScore: number;
  homeColor: string;
  awayColor: string;
  onShare: () => void;
  onDone: () => void;
  motm: { name: string; points: number } | null;
}) {
  const winner = homeScore > awayScore ? 'home' : awayScore > homeScore ? 'away' : 'draw';
  const winnerName = winner === 'home' ? homeTeam : winner === 'away' ? awayTeam : 'Draw';
  const colors = [homeColor, awayColor, '#FFD700', '#FF6B35', '#00C853', '#E040FB'];

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4"
    >
      {/* Confetti */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        {Array.from({ length: 50 }).map((_, i) => (
          <ConfettiParticle key={i} index={i} delay={i * 0.06} color={colors[i % colors.length]} />
        ))}
      </div>

      <motion.div
        initial={{ scale: 0.5, opacity: 0, y: 30 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.5, opacity: 0, y: 30 }}
        transition={{ type: 'spring', damping: 15, stiffness: 200 }}
        className="w-full max-w-sm rounded-3xl overflow-hidden shadow-2xl"
        style={{
          background: `linear-gradient(135deg, ${homeColor}15, ${awayColor}15)`,
        }}
      >
        {/* Winner header */}
        <div className="px-6 pt-8 pb-4 text-center">
          <motion.div
            animate={{ scale: [1, 1.2, 1], rotate: [0, -5, 5, -5, 0] }}
            transition={{ duration: 1.5, repeat: 2 }}
            className="text-5xl mb-3"
          >
            🏆
          </motion.div>
          <motion.h2
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="text-2xl font-black text-gray-800 dark:text-warm-100"
          >
            {winner === 'draw' ? 'It\'s a Draw!' : `${winnerName} Wins!`}
          </motion.h2>

          {/* Score display */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5 }}
            className="flex items-center justify-center gap-4 mt-4"
          >
            <div className="text-center">
              <div className="w-14 h-14 rounded-full flex items-center justify-center text-white font-bold text-xl shadow-md" style={{ backgroundColor: homeColor }}>
                {homeTeam.charAt(0)}
              </div>
              <p className="text-xs font-bold mt-1" style={{ color: homeColor }}>{homeTeam}</p>
              <p className="text-3xl font-black mt-1" style={{ color: homeColor }}>{homeScore}</p>
            </div>
            <span className="text-xl text-gray-300 font-bold">-</span>
            <div className="text-center">
              <div className="w-14 h-14 rounded-full flex items-center justify-center text-white font-bold text-xl shadow-md" style={{ backgroundColor: awayColor }}>
                {awayTeam.charAt(0)}
              </div>
              <p className="text-xs font-bold mt-1" style={{ color: awayColor }}>{awayTeam}</p>
              <p className="text-3xl font-black mt-1" style={{ color: awayColor }}>{awayScore}</p>
            </div>
          </motion.div>
        </div>

        {/* MOTM */}
        {motm && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.7 }}
            className="mx-6 mb-4 p-3 rounded-xl bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-700/50"
          >
            <div className="flex items-center gap-2">
              <Crown className="w-5 h-5 text-yellow-500" />
              <div>
                <p className="text-[9px] font-bold text-yellow-700 dark:text-yellow-400 uppercase tracking-wider">Man of the Match</p>
                <p className="text-sm font-black text-gray-800 dark:text-warm-100">{motm.name}</p>
                <p className="text-xs text-yellow-600 dark:text-yellow-400 font-bold">{motm.points} points</p>
              </div>
            </div>
          </motion.div>
        )}

        {/* Actions */}
        <div className="px-6 pb-6 flex gap-3">
          <motion.button
            whileTap={{ scale: 0.95 }}
            onClick={onShare}
            className="flex-1 py-3 rounded-xl bg-brand-red hover:bg-red-700 text-white font-bold text-sm flex items-center justify-center gap-2 shadow-lg"
          >
            <Share2 className="w-4 h-4" /> Share
          </motion.button>
          <motion.button
            whileTap={{ scale: 0.95 }}
            onClick={onDone}
            className="flex-1 py-3 rounded-xl bg-gray-100 dark:bg-warm-700 hover:bg-gray-200 text-gray-700 dark:text-warm-200 font-bold text-sm"
          >
            Done
          </motion.button>
        </div>
      </motion.div>
    </motion.div>
  );
}

// ─── Half Time Transition Screen ────────────────────────────────────

function HalfTimeTransition({
  half,
  homeTeam,
  awayTeam,
  homeScore,
  awayScore,
  homeColor,
  awayColor,
  onContinue,
}: {
  half: number;
  homeTeam: string;
  awayTeam: string;
  homeScore: number;
  awayScore: number;
  homeColor: string;
  awayColor: string;
  onContinue: () => void;
}) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4"
    >
      <motion.div
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.8, opacity: 0 }}
        className="w-full max-w-sm rounded-3xl p-6 text-center"
        style={{
          background: `linear-gradient(135deg, ${homeColor}10, ${awayColor}10)`,
        }}
      >
        <motion.div
          animate={{ scale: [1, 1.1, 1] }}
          transition={{ duration: 2, repeat: Infinity }}
          className="text-4xl mb-3"
        >
          ⏱️
        </motion.div>
        <h2 className="text-2xl font-black text-gray-800 dark:text-warm-100 mb-1">
          Half Time!
        </h2>
        <p className="text-sm text-gray-500 dark:text-warm-400 mb-4">
          {half === 1 ? '1st Half Complete' : '2nd Half Starting'}
        </p>

        {/* Score summary */}
        <div className="flex items-center justify-center gap-6 mb-6">
          <div className="text-center">
            <p className="text-xs font-bold" style={{ color: homeColor }}>{homeTeam}</p>
            <p className="text-3xl font-black" style={{ color: homeColor }}>{homeScore}</p>
          </div>
          <span className="text-lg text-gray-300 font-bold">-</span>
          <div className="text-center">
            <p className="text-xs font-bold" style={{ color: awayColor }}>{awayTeam}</p>
            <p className="text-3xl font-black" style={{ color: awayColor }}>{awayScore}</p>
          </div>
        </div>

        <motion.button
          whileTap={{ scale: 0.95 }}
          onClick={onContinue}
          className="w-full py-3 rounded-xl bg-brand-red hover:bg-red-700 text-white font-bold text-sm shadow-lg"
        >
          Continue to {half === 1 ? '2nd Half' : 'Match'}
        </motion.button>
      </motion.div>
    </motion.div>
  );
}

// ─── All Out Celebration Overlay ────────────────────────────────────

function AllOutCelebration({
  teamName,
  teamColor,
  onDismiss,
}: {
  teamName: string;
  teamColor: string;
  onDismiss: () => void;
}) {
  useEffect(() => {
    const timer = setTimeout(onDismiss, 2000);
    return () => clearTimeout(timer);
  }, [onDismiss]);

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.8 }}
      transition={{ duration: 0.2 }}
      className="fixed inset-0 z-40 flex items-center justify-center pointer-events-none"
    >
      {/* Full screen team color flash */}
      <motion.div
        initial={{ opacity: 0.6 }}
        animate={{ opacity: 0 }}
        transition={{ duration: 0.8 }}
        className="absolute inset-0"
        style={{ backgroundColor: teamColor }}
      />

      <motion.div
        initial={{ scale: 0.3, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: 'spring', damping: 10, stiffness: 200 }}
        className="relative px-8 py-6 rounded-2xl text-center"
        style={{
          background: `linear-gradient(135deg, ${teamColor}50, ${teamColor}25)`,
          boxShadow: `0 0 60px ${teamColor}60`,
        }}
      >
        <motion.div
          animate={{ scale: [1, 1.3, 1], rotate: [0, 10, -10, 0] }}
          transition={{ duration: 0.5, repeat: 2 }}
          className="text-5xl mb-1"
        >
          💥
        </motion.div>
        <motion.h3
          animate={{ scale: [1, 1.08, 1] }}
          transition={{ duration: 0.3, repeat: 2 }}
          className="text-2xl font-black"
          style={{ color: teamColor }}
        >
          ALL OUT!
        </motion.h3>
        <p className="text-xs font-bold text-white/90 mt-0.5 drop-shadow-lg">
          {teamName} • +2 pts • All revive
        </p>
      </motion.div>
    </motion.div>
  );
}

// ─── Super Raid Celebration Overlay ─────────────────────────────────

function SuperRaidCelebration({
  teamName,
  teamColor,
  playerName,
  onDismiss,
}: {
  teamName: string;
  teamColor: string;
  playerName: string;
  onDismiss: () => void;
}) {
  useEffect(() => {
    const timer = setTimeout(onDismiss, 2000);
    return () => clearTimeout(timer);
  }, [onDismiss]);

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.8 }}
      transition={{ duration: 0.2 }}
      className="fixed inset-0 z-40 flex items-center justify-center pointer-events-none"
    >
      {/* Fire-themed background flash */}
      <motion.div
        initial={{ opacity: 0.6 }}
        animate={{ opacity: 0 }}
        transition={{ duration: 0.8 }}
        className="absolute inset-0"
        style={{ background: 'linear-gradient(135deg, rgba(234,88,12,0.3), rgba(234,179,8,0.2))' }}
      />

      {/* Fire particles - reduced count */}
      {Array.from({ length: 10 }).map((_, i) => (
        <motion.div
          key={i}
          initial={{
            y: 0,
            x: ((i * 37) % 200) - 100,
            opacity: 1,
            scale: 1,
          }}
          animate={{
            y: -150 - (i % 3) * 40,
            x: ((i * 37) % 200) - 100 + ((i % 2 === 0 ? 1 : -1) * (i % 5) * 8),
            opacity: 0,
            scale: 0.3,
          }}
          transition={{
            duration: 1 + (i % 3) * 0.3,
            delay: i * 0.04,
            ease: 'easeOut',
          }}
          className="absolute text-xl"
          style={{ left: `${40 + (i * 3) % 20}%`, bottom: '35%' }}
        >
          {i % 3 === 0 ? '🔥' : i % 3 === 1 ? '✨' : '💥'}
        </motion.div>
      ))}

      <motion.div
        initial={{ scale: 0.3, opacity: 0, rotate: -10 }}
        animate={{ scale: 1, opacity: 1, rotate: 0 }}
        transition={{ type: 'spring', damping: 15, stiffness: 250 }}
        className="relative px-6 py-4 rounded-2xl text-center"
        style={{
          background: `linear-gradient(135deg, #ea580c50, #eab30830)`,
          boxShadow: `0 0 40px rgba(234,88,12,0.4), 0 0 80px rgba(234,179,8,0.2)`,
        }}
      >
        <motion.div
          animate={{ scale: [1, 1.3, 1], rotate: [0, 8, -8, 0] }}
          transition={{ duration: 0.4, repeat: 2 }}
          className="text-5xl mb-1"
        >
          🔥
        </motion.div>
        <motion.h3
          animate={{ scale: [1, 1.08, 1] }}
          transition={{ duration: 0.3, repeat: 2 }}
          className="text-2xl font-black"
          style={{ color: '#ea580c' }}
        >
          SUPER RAID!
        </motion.h3>
        <p className="text-xs font-bold text-white/90 mt-0.5 drop-shadow-lg">
          {playerName} • 3+ pts • {teamName}
        </p>
      </motion.div>
    </motion.div>
  );
}

// ─── Do or Die Indicator ────────────────────────────────────────────

function DoOrDieIndicator({ teamColor }: { teamColor: string }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      className="mx-4 mt-1"
    >
      <motion.div
        animate={{ backgroundColor: [`${teamColor}30`, `${teamColor}60`, `${teamColor}30`] }}
        transition={{ duration: 1, repeat: Infinity }}
        className="flex items-center justify-center gap-2 py-1.5 rounded-lg"
      >
        <motion.div animate={{ scale: [1, 1.3, 1] }} transition={{ duration: 0.5, repeat: Infinity }}>
          <Flame className="w-4 h-4" style={{ color: teamColor }} />
        </motion.div>
        <span className="text-xs font-black tracking-wider" style={{ color: teamColor }}>
          DO OR DIE RAID
        </span>
        <motion.div animate={{ scale: [1, 1.3, 1] }} transition={{ duration: 0.5, repeat: Infinity }}>
          <AlertTriangle className="w-4 h-4" style={{ color: teamColor }} />
        </motion.div>
      </motion.div>
    </motion.div>
  );
}

// ─── Event Confirmation Toast (inline) ──────────────────────────────

function EventConfirmation({
  message,
  teamColor,
  onUndo,
}: {
  message: string;
  teamColor: string;
  onUndo: () => void;
}) {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => setVisible(false), 3000);
    return () => clearTimeout(timer);
  }, []);

  if (!visible) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 20 }}
      className="fixed bottom-20 left-4 right-4 z-50 flex items-center justify-center"
    >
      <div
        className="flex items-center gap-2 px-4 py-2.5 rounded-xl shadow-lg border"
        style={{
          backgroundColor: teamColor + '15',
          borderColor: teamColor + '30',
        }}
      >
        <Check className="w-4 h-4" style={{ color: teamColor }} />
        <span className="text-xs font-bold" style={{ color: teamColor }}>{message}</span>
        <button
          onClick={() => { setVisible(false); onUndo(); }}
          className="ml-2 px-2 py-0.5 rounded-md text-[10px] font-bold bg-white dark:bg-warm-800 text-gray-600 dark:text-warm-300 hover:bg-gray-100"
        >
          UNDO
        </button>
      </div>
    </motion.div>
  );
}

// ─── Event Log Entry ────────────────────────────────────────────────

function EventLogEntry({ event, matchInfo }: { event: MatchEvent; matchInfo: { homeTeamId: string; homeTeamColor: string; awayTeamColor: string } }) {
  const isHome = event.teamId === matchInfo.homeTeamId;
  const teamColor = isHome ? matchInfo.homeTeamColor : matchInfo.awayTeamColor;

  const eventIcons: Record<string, string> = {
    raid_point: '✅',
    bonus_point: '🎯',
    tackle_point: '🛡',
    super_tackle: '⚡',
    super_raid: '🔥',
    do_or_die_raid: '🔥',
    all_out: '💥',
    empty_raid: '⏭',
    self_out: '🚫',
    substitution: '🔄',
    timeout: '📋',
    yellow_card: '🟨',
    red_card: '🟥',
    green_card: '🟩',
  };

  const eventLabels: Record<string, string> = {
    raid_point: 'Raid Pt',
    bonus_point: 'Bonus Pt',
    tackle_point: 'Tackle Pt',
    super_tackle: 'Super Tackle',
    super_raid: 'Super Raid',
    do_or_die_raid: 'Do-or-Die',
    all_out: 'All Out',
    empty_raid: 'Empty',
    self_out: 'Self-Out',
    substitution: 'Sub',
    timeout: 'Timeout',
    yellow_card: 'Yellow Card',
    red_card: 'Red Card',
    green_card: 'Green Card',
  };

  const timeStr = new Date(event.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });

  return (
    <motion.div
      initial={{ opacity: 0, x: -8 }}
      animate={{ opacity: 1, x: 0 }}
      className="flex items-center gap-2 py-1 px-2 rounded-lg hover:bg-gray-800/30 dark:hover:bg-gray-700/30 transition-colors"
    >
      <span className="text-[9px] font-mono text-gray-500 dark:text-gray-400 w-14 shrink-0">{timeStr}</span>
      <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: teamColor }} />
      <span className="text-xs truncate max-w-[80px] font-medium text-gray-700 dark:text-gray-300">{event.playerName || '—'}</span>
      <span className="text-xs">{eventIcons[event.eventType] || '📌'}</span>
      <span className="text-[10px] font-semibold text-gray-500 dark:text-gray-400 flex-1">{eventLabels[event.eventType] || event.eventType}</span>
      {event.value > 0 && (
        <span className="text-[10px] font-black px-1.5 py-0.5 rounded-md" style={{ backgroundColor: `${teamColor}20`, color: teamColor }}>
          +{event.value}
        </span>
      )}
    </motion.div>
  );
}

// ─── Animated Score Counter ─────────────────────────────────────────

function AnimatedScore({ value, color }: { value: number; color: string }) {
  return (
    <motion.span
      key={value}
      initial={{ scale: 1.5, opacity: 0.5 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ type: 'spring', damping: 12, stiffness: 300 }}
      className="text-3xl font-black tabular-nums leading-none"
      style={{ color }}
    >
      {value}
    </motion.span>
  );
}

// ─── Main Component ─────────────────────────────────────────────────

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
    addPlayerToMatch,
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

  // Track consecutive empty raids per team for do-or-die
  const consecutiveEmptyRaidsRef = useRef<Record<string, number>>({});

  // Self-out confirmation state
  const [selfOutConfirm, setSelfOutConfirm] = useState<MatchPlayer | null>(null);

  // Super raid celebration state
  const [superRaidCelebration, setSuperRaidCelebration] = useState<{ teamName: string; teamColor: string; playerName: string } | null>(null);
  // Track if 5-min warning has fired for current half
  const fiveMinWarningFiredRef = useRef<boolean>(false);

  // Raid flow state
  const [raidPhase, setRaidPhase] = useState<RaidPhase>('idle');
  const [raider, setRaider] = useState<MatchPlayer | null>(null);
  const [raidResult, setRaidResult] = useState<RaidResult>(null);
  const [selectedDefenders, setSelectedDefenders] = useState<Set<string>>(new Set());
  const [bonusPoint, setBonusPoint] = useState(false);

  // Turn transition lock: briefly prevents raider selection after a raid ends
  // This ensures the state fully resets before the next team can pick a raider
  const [isTurnTransitioning, setIsTurnTransitioning] = useState(false);

  // Substitute mode
  const [showSubMode, setShowSubMode] = useState<'home' | 'away' | null>(null);
  const [subOutPlayer, setSubOutPlayer] = useState<MatchPlayer | null>(null);

  // Add player mid-match
  const [showAddPlayer, setShowAddPlayer] = useState(false);
  const [addPlayerTeam, setAddPlayerTeam] = useState<'home' | 'away' | null>(null);
  const [addPlayerName, setAddPlayerName] = useState('');
  const [addPlayerJersey, setAddPlayerJersey] = useState('');

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

  // New UI states
  const [showHalfTimeTransition, setShowHalfTimeTransition] = useState(false);
  const [showMatchEndCelebration, setShowMatchEndCelebration] = useState(false);
  const [allOutCelebration, setAllOutCelebration] = useState<{ teamName: string; teamColor: string } | null>(null);
  const [eventConfirm, setEventConfirm] = useState<{ message: string; teamColor: string } | null>(null);
  const [showTimeoutOverlay, setShowTimeoutOverlay] = useState(false);
  const [timeoutCountdown, setTimeoutCountdown] = useState(TIMEOUT_DURATION);
  const [timeoutTeam, setTimeoutTeam] = useState<'home' | 'away'>('home');
  const timeoutRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Player profiles (avatars)
  const [playerProfiles, setPlayerProfiles] = useState<Record<string, { avatar?: string }>>({});

  // Action tab state
  const [actionTab, setActionTab] = useState<ActionTab>('raid');

  // Event log state
  const [showFullLog, setShowFullLog] = useState(false);
  const [showScorerTransfer, setShowScorerTransfer] = useState(false);
  const eventLogRef = useRef<HTMLDivElement>(null);

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
    const halfDuration = match.halfDuration * 60;
    const fiveMinutes = 5 * 60;

    if (timer === fiveMinutes && !fiveMinWarningFiredRef.current) {
      fiveMinWarningFiredRef.current = true;
      triggerFeedback(SoundType.FIVE_MINUTE_WARNING);
      toast({
        title: match.currentHalf === 2 ? '5 minutes left in match!' : '5 minutes left in half!',
        description: 'Time is running out',
        duration: 3000,
      });
    }

    if (timer === halfDuration) {
      fiveMinWarningFiredRef.current = false;
    }

    if (timer === 0 && hasStartedRaiding) {
      if (match.currentHalf === 1) {
        triggerFeedback(SoundType.HALF_END);
        setShowHalfTimeTransition(true);
      } else {
        triggerFeedback(SoundType.HALF_END);
        setTimeout(() => {
          triggerFeedback(SoundType.MATCH_END);
        }, 800);
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
  }, [raidTimer !== null, raidPhase, raider, toast]);

  // ═══ RAID TIMER HAPTIC COUNTDOWN ═══
  useEffect(() => {
    if (raidTimer === null || raidPhase === 'idle') return;

    if (raidTimer === 10) {
      vibrate([40]);
    }
    if (raidTimer === 5) {
      vibrate([60, 30, 60]);
    }
    if (raidTimer <= 3 && raidTimer > 0) {
      vibrate([30]);
    }
  }, [raidTimer, raidPhase]);

  // ═══ RAID GAP TIMER LOGIC ═══
  useEffect(() => {
    if (raidGapTimer === null) {
      if (raidGapRef.current) clearInterval(raidGapRef.current);
      return;
    }

    if (raidGapTimer <= 0) {
      if (raidGapRef.current) clearInterval(raidGapRef.current);
      setRaidGapTimer(null);
      if (raidPhase === 'idle' && hasStartedRaiding && !isPaused) {
        triggerFeedback(SoundType.RAID_GAP_WARNING);
        setIsPaused(true);
        toast({ title: 'Timer paused', description: 'Select a raider to resume', duration: 1500 });
      }
      return;
    }

    raidGapRef.current = setInterval(() => {
      setRaidGapTimer(prev => {
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
  }, [raidGapTimer !== null, raidPhase, hasStartedRaiding, isPaused]);

  // ═══ TIMEOUT COUNTDOWN (2 minutes) ═══
  useEffect(() => {
    if (!showTimeoutOverlay) {
      if (timeoutRef.current) clearInterval(timeoutRef.current);
      return;
    }
    setTimeoutCountdown(TIMEOUT_DURATION);
    timeoutRef.current = setInterval(() => {
      setTimeoutCountdown(prev => {
        if (prev <= 1) {
          if (timeoutRef.current) clearInterval(timeoutRef.current);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => {
      if (timeoutRef.current) clearInterval(timeoutRef.current);
    };
  }, [showTimeoutOverlay]);

  // Auto-resume when timeout reaches 0
  useEffect(() => {
    if (showTimeoutOverlay && timeoutCountdown === 0) {
      setShowTimeoutOverlay(false);
      setIsPaused(false);
    }
  }, [showTimeoutOverlay, timeoutCountdown]);

  // ═══ AUTO-SCROLL EVENT LOG ═══
  useEffect(() => {
    if (showFullLog && eventLogRef.current) {
      eventLogRef.current.scrollTop = eventLogRef.current.scrollHeight;
    }
  }, [match?.events.length, showFullLog]);

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

  // Get player points from match events (before early return for hooks rule)
  const getPlayerPoints = useCallback((playerId: string): { raid: number; tackle: number } => {
    if (!match) return { raid: 0, tackle: 0 };
    let raid = 0;
    let tackle = 0;
    for (const event of match.events) {
      if (event.playerId !== playerId) continue;
      if (['raid_point', 'super_raid', 'do_or_die_raid', 'bonus_point'].includes(event.eventType)) {
        raid += event.value;
      }
      if (['tackle_point', 'super_tackle'].includes(event.eventType)) {
        tackle += event.value;
      }
    }
    return { raid, tackle };
  }, [match?.events]);

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

  // Half indicator
  const halfLabel = !hasStartedRaiding
    ? 'NOT STARTED'
    : match.timer === 0 && match.currentHalf === 1
      ? 'HALF TIME'
      : match.timer === 0 && match.currentHalf === 2
        ? 'FULL TIME'
        : match.currentHalf === 1
          ? '1ST HALF'
          : '2ND HALF';

  const isTimerPulsing = match.timer > 0 && match.timer < 60 && hasStartedRaiding && !isPaused;

  // Split lineup: first 7 = on court, rest = substitutes
  const splitLineup = (lineup: MatchPlayer[], outIds: string[]) => {
    const onCourt = lineup.slice(0, ON_COURT_MAX);
    const substitutes = lineup.slice(ON_COURT_MAX);
    const onCourtActive = onCourt.filter(p => !outIds.includes(p.id));
    const onCourtOut = onCourt.filter(p => outIds.includes(p.id));
    return { onCourt, substitutes, onCourtActive, onCourtOut };
  };

  // ═══ SCORE BREAKDOWN ═══
  const homeRaidPoints = match.events
    .filter(e => e.teamId === match.homeTeamId && ['raid_point', 'bonus_point', 'super_raid', 'do_or_die_raid', 'all_out'].includes(e.eventType))
    .reduce((sum, e) => sum + e.value, 0);
  const homeTacklePoints = match.events
    .filter(e => e.teamId === match.homeTeamId && ['tackle_point', 'super_tackle'].includes(e.eventType))
    .reduce((sum, e) => sum + e.value, 0);
  const awayRaidPoints = match.events
    .filter(e => e.teamId === match.awayTeamId && ['raid_point', 'bonus_point', 'super_raid', 'do_or_die_raid', 'all_out'].includes(e.eventType))
    .reduce((sum, e) => sum + e.value, 0);
  const awayTacklePoints = match.events
    .filter(e => e.teamId === match.awayTeamId && ['tackle_point', 'super_tackle'].includes(e.eventType))
    .reduce((sum, e) => sum + e.value, 0);

  // Handle raider selection → starts raid timer AND match timer
  const handleSelectRaider = (player: MatchPlayer) => {
    if (raidingOutIds.includes(player.id)) return;
    if (raidPhase !== 'idle') return;
    // Strict turn lock: prevent selection during turn transition
    if (isTurnTransitioning) return;

    if (!hasStartedRaiding) setHasStartedRaiding(true);
    if (isPaused) setIsPaused(false);
    clearRaidGap();

    setRaider(player);
    setRaidPhase('result');
    setRaidResult(null);
    setSelectedDefenders(new Set());
    setBonusPoint(false);
    setActionTab('raid');

    setRaidTimer(RAID_TIME_LIMIT);

    // Check if THIS team has a pending do-or-die
    const raidingTeamId = raidingTeam === 'home' ? match.homeTeamId : match.awayTeamId;
    const isTeamDoOrDie = match.isDoOrDie && match.doOrDieTeamId === raidingTeamId;

    if (isTeamDoOrDie) {
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

    // Activate turn lock IMMEDIATELY to prevent any race conditions
    // during the state transition (addBatchEvents flips raidQueue in the store)
    setIsTurnTransitioning(true);

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

      // Super Raid auto-detection: 3+ points in a single raid
      const totalRaidPoints = touchCount + (hasBonus ? 1 : 0);
      if (totalRaidPoints >= 3) {
        events.push({
          matchId: match.id, eventType: 'super_raid', teamId: raidingTeamId,
          half: match.currentHalf, playerId: raider.id, playerName: raider.name,
          value: 1,
          details: JSON.stringify({ raiderId: raider.id, touchCount, bonusPoint: hasBonus }),
        });
        // Show super raid celebration
        setSuperRaidCelebration({ teamName: raidingTeamName, teamColor: raidingTeamColor, playerName: raider.name });
      }

      // All out check: if ALL defenders on court will be out after this raid
      const { onCourtActive } = splitLineup(fullDefendingLineup, defendingOutIds);
      // Count how many active defenders will remain after touch points
      const remainingDefenders = onCourtActive.length - touchCount;
      if (remainingDefenders <= 0) {
        events.push({
          matchId: match.id, eventType: 'all_out', teamId: raidingTeamId,
          half: match.currentHalf, value: 2,
        });
        // Trigger all-out celebration
        setAllOutCelebration({ teamName: raidingTeamName, teamColor: raidingTeamColor });
        triggerFeedback(SoundType.ALL_OUT);
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
      // Super Tackle: when defending team has 3 or fewer active players on court
      if (onCourtActive.length <= 3) {
        events.push({
          matchId: match.id, eventType: 'super_tackle', teamId: defendingTeamId,
          half: match.currentHalf,
          playerId: primaryCatcher?.id || raider.id, playerName: primaryCatcher?.name || raider.name,
          value: 1,
          details: JSON.stringify({ caughtByIds, raiderId: raider.id }),
        });
      }

      // All-Out check: if the raiding team's raider was their last active player
      const raidingOnCourtActive = splitLineup(fullRaidingLineup, raidingOutIds).onCourtActive;
      if (raidingOnCourtActive.length <= 1) {
        // This was the last raider → All Out for the raiding team
        events.push({
          matchId: match.id, eventType: 'all_out', teamId: defendingTeamId,
          half: match.currentHalf, value: 2,
        });
        setAllOutCelebration({ teamName: defendingTeamName, teamColor: defendingTeamColor });
        triggerFeedback(SoundType.ALL_OUT);
      }
    } else if (result === 'empty') {
      // Do-or-Die: if this team has a pending do-or-die and raider has empty raid, raider is OUT
      const isTeamDoOrDie = match.isDoOrDie && match.doOrDieTeamId === raidingTeamId;
      if (isTeamDoOrDie) {
        // Do-or-die raid failed! Raider is out, defending team gets +1
        events.push({
          matchId: match.id, eventType: 'do_or_die_raid', teamId: defendingTeamId,
          half: match.currentHalf, playerId: raider.id, playerName: raider.name,
          value: 1,
          details: JSON.stringify({ raiderId: raider.id, failed: true }),
        });
        // Reset empty raid counter for the raiding team since they scored 0
        consecutiveEmptyRaidsRef.current[raidingTeamId] = 0;

        // All-Out check: if the raiding team's raider was their last active player
        const raidingOnCourtActive = splitLineup(fullRaidingLineup, raidingOutIds).onCourtActive;
        if (raidingOnCourtActive.length <= 1) {
          events.push({
            matchId: match.id, eventType: 'all_out', teamId: defendingTeamId,
            half: match.currentHalf, value: 2,
          });
          setAllOutCelebration({ teamName: defendingTeamName, teamColor: defendingTeamColor });
          triggerFeedback(SoundType.ALL_OUT);
        }
      } else {
        events.push({
          matchId: match.id, eventType: 'empty_raid', teamId: raidingTeamId,
          half: match.currentHalf, playerId: raider.id, playerName: raider.name, value: 0,
        });

        // Track consecutive empty raids per team
        consecutiveEmptyRaidsRef.current[raidingTeamId] = (consecutiveEmptyRaidsRef.current[raidingTeamId] || 0) + 1;
      }
    }

    // Reset consecutive empty raids on any successful raid (points scored)
    if (result === 'success') {
      consecutiveEmptyRaidsRef.current[raidingTeamId] = 0;
    }
    if (result === 'caught') {
      // Defending team scored, reset THEIR counter
      consecutiveEmptyRaidsRef.current[defendingTeamId] = 0;
    }

    // ═══ DO-OR-DIE LOGIC (per team) ═══
    // Evaluate BEFORE the turn swaps (addBatchEvents flips raidQueue)
    const raidingEmptyCount = consecutiveEmptyRaidsRef.current[raidingTeamId] || 0;
    if (raidingEmptyCount >= 2) {
      // Do-or-die applies to this team's NEXT raid (after opponent raids)
      setDoOrDie(true, raidingTeamId);
      triggerFeedback(SoundType.DO_OR_DIE);
      toast({
        title: '🔥 DO OR DIE RAID!',
        description: `${raidingTeamName}'s next raid must score — or raider is out!`,
        duration: 3000,
      });
    } else {
      // Clear do-or-die ONLY if it belonged to this team
      if (match.doOrDieTeamId === raidingTeamId) {
        setDoOrDie(false);
      }
    }

    if (events.length > 0) {
      addBatchEvents(events);
    }

    // Show event confirmation
    const pointValue = result === 'success' ? (touchedDefenders.size + (hasBonus ? 1 : 0)) : result === 'caught' ? 1 : 0;
    const confirmMsg = result === 'success'
      ? `${raider.name} +${pointValue} raid point${pointValue > 1 ? 's' : ''}`
      : result === 'caught'
        ? `${defendingTeamName} +1 tackle`
        : 'Empty raid recorded';
    setEventConfirm({ message: confirmMsg, teamColor: result === 'caught' ? defendingTeamColor : raidingTeamColor });

    // ═══ STRICT TURN TRANSITION ═══
    // Turn lock was already activated at the top of this function.
    // Now reset ALL raid state completely before the next team can select.
    setRaidPhase('idle');
    setRaider(null);
    setRaidResult(null);
    setSelectedDefenders(new Set());
    setBonusPoint(false);

    // Release the turn lock after a brief delay (800ms) to allow state to settle
    // and give visual feedback that the turn has swapped
    setTimeout(() => {
      setIsTurnTransitioning(false);
    }, 800);

    // Start 5-second raid gap timer
    setRaidGapTimer(RAID_GAP_TIMEOUT);
  };

  // Keep ref in sync with latest processRaidResult
  // This is a standard React pattern for accessing latest closure from effects
  // eslint-disable-next-line react-hooks/refs
  processRaidResultRef.current = processRaidResult;

  const cancelRaid = () => {
    setRaidTimer(null);
    if (raidTimerRef.current) clearInterval(raidTimerRef.current);
    setRaidPhase('idle');
    setRaider(null);
    setRaidResult(null);
    setSelectedDefenders(new Set());
    setBonusPoint(false);

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
      }

      endMatch();
      triggerFeedback(SoundType.MATCH_END);
      setShowEndMatchConfirm(false);
      setShowMatchEndCelebration(true);
    } else {
      setShowEndMatchConfirm(true);
      setTimeout(() => setShowEndMatchConfirm(false), 3000);
    }
  };

  const handleEndHalf = () => {
    if (showEndHalfConfirm) {
      triggerFeedback(SoundType.HALF_END);
      switchHalf();
      setHasStartedRaiding(false);
      setRaidTimer(null);
      if (raidTimerRef.current) clearInterval(raidTimerRef.current);
      clearRaidGap();
      setRaidPhase('idle');
      setRaider(null);
      setDoOrDie(false);
      setIsTurnTransitioning(false);
      consecutiveEmptyRaidsRef.current = {};
      fiveMinWarningFiredRef.current = false;
      setShowEndHalfConfirm(false);
      setShowHalfTimeTransition(true);
    } else {
      setShowEndHalfConfirm(true);
      setTimeout(() => setShowEndHalfConfirm(false), 3000);
    }
  };

  const handlePause = () => {
    const newPaused = !isPaused;
    setIsPaused(newPaused);

    if (newPaused) {
      if (raidTimerRef.current) clearInterval(raidTimerRef.current);
      clearRaidGap();
    } else {
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

  const handleTimeout = (team?: 'home' | 'away') => {
    const timeoutFor = team || raidingTeam;
    const currentTimeouts = timeoutFor === 'home' ? match.homeTimeouts : match.awayTimeouts;

    if (currentTimeouts >= MAX_TIMEOUTS) {
      toast({
        title: 'No timeouts left!',
        description: `${timeoutFor === 'home' ? match.homeTeam : match.awayTeam} has used all ${MAX_TIMEOUTS} timeouts`,
        duration: 2000,
      });
      return;
    }

    if (!hasStartedRaiding) setHasStartedRaiding(true);
    const teamId = timeoutFor === 'home' ? match.homeTeamId : match.awayTeamId;
    callTimeout(timeoutFor);
    setIsPaused(true);
    if (raidTimerRef.current) clearInterval(raidTimerRef.current);
    clearRaidGap();
    addEvent({
      matchId: match.id, eventType: 'timeout', teamId,
      half: match.currentHalf, value: 0,
    });
    setTimeoutTeam(timeoutFor);
    setShowTimeoutOverlay(true);
  };

  // Quick action handlers for special events
  const handleBonusPoint = () => {
    if (!match) return;
    // Bonus point validation: only available with 6+ active defenders
    const { onCourtActive: activeDefenders } = splitLineup(fullDefendingLineup, defendingOutIds);
    if (activeDefenders.length < 6) {
      toast({ title: 'Bonus not available', description: 'Bonus only with 6+ defenders on court', duration: 2000 });
      return;
    }
    const teamId = raidingTeam === 'home' ? match.homeTeamId : match.awayTeamId;
    addEvent({
      matchId: match.id, eventType: 'bonus_point', teamId,
      half: match.currentHalf, value: 1,
      playerId: raider?.id, playerName: raider?.name,
    });
    triggerFeedback(SoundType.WHISTLE);
    setEventConfirm({ message: 'Bonus Point!', teamColor: raidingTeamColor });
  };

  const handleAllOut = () => {
    if (!match) return;
    const teamId = raidingTeam === 'home' ? match.homeTeamId : match.awayTeamId;
    addEvent({
      matchId: match.id, eventType: 'all_out', teamId,
      half: match.currentHalf, value: 2,
    });
    triggerFeedback(SoundType.WHISTLE);
    setAllOutCelebration({ teamName: raidingTeamName, teamColor: raidingTeamColor });
    setEventConfirm({ message: 'All Out! +2', teamColor: raidingTeamColor });
  };

  const handleCard = (cardType: 'yellow_card' | 'red_card') => {
    if (!match) return;
    const teamId = raidingTeam === 'home' ? match.homeTeamId : match.awayTeamId;
    addEvent({
      matchId: match.id, eventType: cardType, teamId,
      half: match.currentHalf, value: 0,
      playerId: raider?.id, playerName: raider?.name,
    });
    const label = cardType === 'yellow_card' ? '🟨 Yellow Card' : '🟥 Red Card';
    setEventConfirm({ message: label, teamColor: raidingTeamColor });
  };

  const handleTacklePoint = () => {
    if (!match) return;
    const teamId = defendingTeam === 'home' ? match.homeTeamId : match.awayTeamId;
    addEvent({
      matchId: match.id, eventType: 'tackle_point', teamId,
      half: match.currentHalf, value: 1,
    });
    triggerFeedback(SoundType.WHISTLE);
    setEventConfirm({ message: `${defendingTeamName} +1 Tackle`, teamColor: defendingTeamColor });
  };

  const handleSuperTackle = () => {
    if (!match) return;
    const teamId = defendingTeam === 'home' ? match.homeTeamId : match.awayTeamId;
    addEvent({
      matchId: match.id, eventType: 'super_tackle', teamId,
      half: match.currentHalf, value: 1,
    });
    triggerFeedback(SoundType.WHISTLE);
    setEventConfirm({ message: `${defendingTeamName} +1 Super Tackle!`, teamColor: defendingTeamColor });
  };

  // Self-out handler
  const handleSelfOut = (selfOutPlayer: MatchPlayer) => {
    if (!match || !raider) return;
    const raidingTeamId = raidingTeam === 'home' ? match.homeTeamId : match.awayTeamId;

    const events: Omit<MatchEvent, 'id' | 'timestamp'>[] = [];

    events.push({
      matchId: match.id, eventType: 'self_out', teamId: raidingTeamId,
      half: match.currentHalf,
      value: 1,
      playerId: selfOutPlayer.id,
      playerName: selfOutPlayer.name,
      details: JSON.stringify({ selfOutPlayerId: selfOutPlayer.id, raiderId: raider?.id }),
    });

    // Check if self-out triggers an all-out
    const { onCourt } = splitLineup(fullDefendingLineup, defendingOutIds);
    const defendingOnCourtOut = onCourt.filter(p => [...defendingOutIds, selfOutPlayer.id].includes(p.id)).length;
    if (defendingOnCourtOut >= onCourt.length) {
      events.push({
        matchId: match.id, eventType: 'all_out', teamId: raidingTeamId,
        half: match.currentHalf, value: 2,
      });
      setAllOutCelebration({ teamName: raidingTeamName, teamColor: raidingTeamColor });
    }

    addBatchEvents(events);
    triggerFeedback(SoundType.WHISTLE);
    setEventConfirm({ message: `${selfOutPlayer.name} self-out! +1 ${raidingTeamName}`, teamColor: raidingTeamColor });
    setSelfOutConfirm(null);
  };

  // Substitute handler
  const handleSub = (outPlayer: MatchPlayer, inPlayer: MatchPlayer) => {
    const teamId = outPlayer.team === 'home' ? match.homeTeamId : match.awayTeamId;
    addEvent({
      matchId: match.id,
      eventType: 'substitution' as const,
      teamId,
      half: match.currentHalf,
      playerId: inPlayer.id,
      playerName: inPlayer.name,
      value: 0,
      details: JSON.stringify({ outPlayerId: outPlayer.id, outPlayerName: outPlayer.name, inPlayerId: inPlayer.id }),
    });

    const store = useKabaddiStore.getState();
    const m = store.activeMatch;
    if (!m) return;

    const swapInLineup = (lineup: MatchPlayer[]) => {
      const outIdx = lineup.findIndex(p => p.id === outPlayer.id);
      const inIdx = lineup.findIndex(p => p.id === inPlayer.id);
      if (outIdx === -1 || inIdx === -1) return lineup;
      const newLineup = [...lineup];
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

  // Add player mid-match handler
  const handleAddPlayer = () => {
    if (!addPlayerTeam || !addPlayerName.trim()) return;
    const lineup = addPlayerTeam === 'home' ? match.homeLineup : match.awayLineup;
    const maxSquad = match.playersPerSide + 5;
    if (lineup.length >= maxSquad) {
      toast({ title: 'Squad full', description: `Maximum ${maxSquad} players allowed`, duration: 2000 });
      return;
    }
    const newPlayer: MatchPlayer = {
      id: `p_${Date.now()}_${Math.random().toString(36).slice(2, 5)}`,
      name: addPlayerName.trim(),
      jerseyNumber: addPlayerJersey ? parseInt(addPlayerJersey) || lineup.length + 1 : lineup.length + 1,
      team: addPlayerTeam,
    };
    addPlayerToMatch(addPlayerTeam, newPlayer);
    const teamName = addPlayerTeam === 'home' ? match.homeTeam : match.awayTeam;
    toast({ title: `${newPlayer.name} added to ${teamName}`, description: `#${newPlayer.jerseyNumber} • Squad: ${lineup.length + 1}`, duration: 2000 });
    triggerFeedback(SoundType.WHISTLE);
    setAddPlayerName('');
    setAddPlayerJersey('');
    setShowAddPlayer(false);
    setAddPlayerTeam(null);
  };

  // ─── Player Circle Component (Enhanced) ───
  const PlayerCircle = ({
    player,
    isOut,
    isRaiding,
    isSelectable,
    isDefending,
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
    /** True when this player is on the defending team and cannot be selected as raider */
    isDefending?: boolean;
    isSelected?: boolean;
    teamColor: string;
    onSelect?: (p: MatchPlayer) => void;
    showCheck?: boolean;
    size?: 'normal' | 'small';
  }) => {
    const profile = playerProfiles[player.id];
    const initials = player.name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
    const isSmall = size === 'small';
    const circleSize = isSmall ? 'w-9 h-9' : 'w-12 h-12';
    const nameSize = isSmall ? 'text-[7px]' : 'text-[8px]';
    const nameWidth = isSmall ? 'max-w-[40px]' : 'max-w-[52px]';

    // Player stat bubbles (only for normal size)
    const pts = !isSmall ? getPlayerPoints(player.id) : null;

    return (
      <motion.button
        whileTap={isSelectable && !isOut ? { scale: 0.9 } : {}}
        onClick={() => isSelectable && !isOut && onSelect?.(player)}
        className={`relative flex flex-col items-center gap-0.5 transition-all ${
          isSelectable && !isOut ? 'cursor-pointer' : 'cursor-default'
        } ${isOut ? 'opacity-40' : isDefending ? 'opacity-50' : ''}`}
      >
        <div
          className={`relative ${circleSize} rounded-full overflow-hidden transition-all ${
            isRaiding
              ? 'ring-2 ring-yellow-400 ring-offset-1 ring-offset-gray-900'
              : isSelected
                ? 'ring-2 ring-white ring-offset-1 ring-offset-gray-900 scale-110'
                : ''
          }`}
          style={{
            borderWidth: '2px',
            borderStyle: isOut ? 'dashed' : isDefending ? 'dotted' : 'solid',
            borderColor: isOut ? '#6b7280' : isDefending ? '#6b7280' : teamColor,
          }}
        >
          {profile?.avatar ? (
            <img
              src={profile.avatar}
              alt={player.name}
              className="w-full h-full object-cover"
              style={{ filter: isOut ? 'grayscale(100%)' : 'none' }}
            />
          ) : (
            <div
              className="w-full h-full flex items-center justify-center"
              style={{ backgroundColor: isOut ? '#374151' : `${teamColor}22` }}
            >
              <span className={`${isSmall ? 'text-[9px]' : 'text-xs'} font-bold`} style={{ color: isOut ? '#6b7280' : teamColor }}>
                {initials}
              </span>
            </div>
          )}

          {/* OUT overlay with red X - more prominent */}
          {isOut && (
            <div className="absolute inset-0 bg-red-900/60 flex items-center justify-center">
              <div className="relative">
                <X className={`${isSmall ? 'w-4 h-4' : 'w-5 h-5'} text-red-400 font-black drop-shadow-[0_0_3px_rgba(239,68,68,0.8)]`} strokeWidth={3} />
              </div>
            </div>
          )}

          {/* Selected checkmark */}
          {isSelected && showCheck && (
            <div className="absolute -top-0.5 -right-0.5 w-3.5 h-3.5 rounded-full bg-green-500 flex items-center justify-center border border-white">
              <Check className="w-2 h-2 text-white" />
            </div>
          )}

          {/* Jersey number badge at bottom-right */}
          {player.jerseyNumber && (
            <div
              className="absolute -bottom-0.5 -right-0.5 min-w-[14px] h-[14px] rounded-full flex items-center justify-center font-black border border-white shadow-sm"
              style={{
                backgroundColor: isOut ? '#4b5563' : teamColor,
                color: '#fff',
                fontSize: '7px',
              }}
            >
              {player.jerseyNumber}
            </div>
          )}
        </div>

        {/* Raiding glow animation - enhanced breathing gold glow */}
        {isRaiding && (
          <>
            <motion.div
              className="absolute inset-0 rounded-full"
              animate={{
                boxShadow: [
                  `0 0 8px 2px rgba(234, 179, 8, 0.3)`,
                  `0 0 20px 8px rgba(234, 179, 8, 0.6)`,
                  `0 0 8px 2px rgba(234, 179, 8, 0.3)`,
                ]
              }}
              transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut' }}
            />
            <motion.div
              className="absolute -inset-1 rounded-full border-2 border-yellow-400"
              animate={{ opacity: [0.3, 0.8, 0.3], scale: [0.95, 1.05, 0.95] }}
              transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut' }}
            />
          </>
        )}

        {/* Player name */}
        <span className={`${nameSize} font-semibold leading-tight truncate ${nameWidth} text-center ${
          isOut ? 'text-gray-500 line-through' : 'text-gray-300 dark:text-warm-300'
        }`}>
          {player.name.split(' ').length > 1
            ? `${player.name.split(' ')[0]} ${player.name.split(' ')[1][0]}.`
            : player.name.split(' ')[0]
          }
        </span>

        {/* Stat bubbles for on-court players */}
        {pts && (pts.raid > 0 || pts.tackle > 0) && !isOut && (
          <div className="flex items-center gap-0.5">
            {pts.raid > 0 && (
              <span className="inline-flex items-center gap-0.5 text-[6px] font-bold px-0.5 rounded-full bg-red-900/40 text-red-400">
                <Zap className="w-1.5 h-1.5" />{pts.raid}
              </span>
            )}
            {pts.tackle > 0 && (
              <span className="inline-flex items-center gap-0.5 text-[6px] font-bold px-0.5 rounded-full bg-teal-900/40 text-teal-400">
                <Shield className="w-1.5 h-1.5" />{pts.tackle}
              </span>
            )}
          </div>
        )}
      </motion.button>
    );
  };

  // ─── Render Team Half (Vertical Split) ───
  const TeamHalf = ({
    side,
    teamName,
    teamColor,
    score,
    raidPts,
    tacklePts,
    fullLineup,
    outIds,
    isRaidingSide,
    timeoutsUsed,
  }: {
    side: 'home' | 'away';
    teamName: string;
    teamColor: string;
    score: number;
    raidPts: number;
    tacklePts: number;
    fullLineup: MatchPlayer[];
    outIds: string[];
    isRaidingSide: boolean;
    timeoutsUsed: number;
  }) => {
    const isIdle = raidPhase === 'idle';
    // Strict turn lock: can only select raider when it's your turn AND not in transition
    const canSelect = isRaidingSide && isIdle && !isTurnTransitioning;
    const { onCourt, substitutes, onCourtActive, onCourtOut } = splitLineup(fullLineup, outIds);
    const timeoutsLeft = Math.max(0, MAX_TIMEOUTS - timeoutsUsed);

    return (
      <div className={`flex flex-col h-full transition-colors duration-300 ${
        isRaidingSide && isIdle
          ? 'bg-gradient-to-b from-gray-900 to-gray-950'
          : isRaidingSide
            ? 'bg-gradient-to-b from-gray-900/90 to-gray-950/90'
            : 'bg-gray-900/95'
      }`}>
        {/* Compact team info bar with turn indicator */}
        <div className="flex items-center justify-between px-2 py-1.5 border-b" style={{ borderColor: `${teamColor}30` }}>
          <div className="flex items-center gap-1.5">
            <div
              className="w-5 h-5 rounded-full flex items-center justify-center text-white font-bold text-[8px]"
              style={{ backgroundColor: teamColor }}
            >
              {teamName.charAt(0)}
            </div>
            <span className="text-[9px] font-bold text-gray-200 truncate max-w-[55px]">
              {teamName}
            </span>
            {/* Turn indicator badge */}
            {isRaidingSide ? (
              <motion.span
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                className="inline-flex items-center gap-0.5 text-[6px] font-black px-1 py-0.5 rounded-full bg-emerald-900/50 text-emerald-400 uppercase tracking-wider"
              >
                <Swords className="w-2 h-2" />
                RAID
              </motion.span>
            ) : (
              <span className="inline-flex items-center gap-0.5 text-[6px] font-bold px-1 py-0.5 rounded-full bg-gray-800/50 text-gray-500 uppercase tracking-wider">
                <Shield className="w-2 h-2" />
                DEF
              </span>
            )}
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-[7px] text-gray-400">
              {onCourtActive.length}/{onCourt.length}
            </span>
            {onCourtOut.length > 0 && (
              <span className="text-[7px] font-bold text-red-400">
                {onCourtOut.length} out
              </span>
            )}
            <span className="text-[7px] text-orange-400/70">
              ⏱{timeoutsLeft}
            </span>
            {/* Substitute button */}
            {substitutes.length > 0 && (
              <button
                onClick={() => setShowSubMode(side)}
                className="flex items-center gap-0.5 text-[7px] font-bold px-1.5 py-0.5 rounded-md transition-colors"
                style={{
                  backgroundColor: `${teamColor}20`,
                  color: teamColor,
                }}
              >
                <ArrowLeftRight className="w-2.5 h-2.5" />
                SUB
              </button>
            )}
          </div>
        </div>

        {/* On Court players (2-column grid) */}
        <div className="grid grid-cols-2 gap-x-1 gap-y-1 px-1 py-1.5">
          {onCourt.map(player => (
            <div key={player.id} className="flex justify-center">
              <PlayerCircle
                player={player}
                isOut={outIds.includes(player.id)}
                isRaiding={isRaidingSide && raider?.id === player.id && raidPhase !== 'idle'}
                isSelectable={canSelect && !outIds.includes(player.id)}
                isDefending={!isRaidingSide && !outIds.includes(player.id) && raidPhase === 'idle'}
                teamColor={teamColor}
                onSelect={handleSelectRaider}
              />
            </div>
          ))}
        </div>

        {/* Substitutes section */}
        {substitutes.length > 0 && (
          <div className="mt-auto px-1 pb-1">
            <div className="border-t border-dashed border-gray-700 pt-1.5">
              <div className="flex items-center justify-between mb-1">
                <span className="text-[7px] font-bold text-gray-500 uppercase tracking-wider">
                  Subs ({substitutes.length})
                </span>
                <button
                  onClick={() => setShowSubMode(side)}
                  className="flex items-center gap-0.5 text-[7px] font-bold px-1.5 py-0.5 rounded-md transition-colors"
                  style={{
                    backgroundColor: `${teamColor}25`,
                    color: teamColor,
                  }}
                >
                  <ArrowLeftRight className="w-2.5 h-2.5" />
                  SUB
                </button>
              </div>
              <div className="flex flex-wrap justify-center gap-x-1 gap-y-0.5">
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
          </div>
        )}

        {/* Raid / Defending indicator */}
        {isRaidingSide && isIdle && (
          <motion.div
            animate={{ opacity: [0.4, 1, 0.4] }}
            transition={{ duration: 2, repeat: Infinity }}
            className="px-2 pb-1.5 text-center"
          >
            <span
              className="inline-flex items-center gap-0.5 text-[7px] font-bold px-2 py-0.5 rounded-full"
              style={{ backgroundColor: `${teamColor}20`, color: teamColor }}
            >
              <motion.span animate={{ y: [0, -2, 0] }} transition={{ duration: 0.8, repeat: Infinity }}>
                <ChevronUp className="w-2 h-2" />
              </motion.span>
              TAP TO RAID
            </span>
          </motion.div>
        )}
        {!isRaidingSide && isIdle && (
          <div className="px-2 pb-1.5 text-center">
            <span className="inline-flex items-center gap-0.5 text-[7px] font-bold px-2 py-0.5 rounded-full bg-gray-800/40 text-gray-600 uppercase tracking-wider">
              <Shield className="w-2 h-2" />
              DEFENDING
            </span>
          </div>
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

  // Recent events for compact log (last 5)
  const recentEvents = match.events.slice(-5);
  const allEvents = match.events;

  return (
    <div className="flex flex-col h-screen bg-gray-950 dark:bg-warm-950">
      {/* Share Scorecard Overlay */}
      {showShareScorecard && savedMatchData && (
        <ShareScorecard onClose={() => setShowShareScorecard(false)} matchData={savedMatchData} />
      )}

      {/* Scorer Transfer Overlay */}
      {showScorerTransfer && (
        <ScorerTransferScreen
          onClose={() => setShowScorerTransfer(false)}
          activeMatch={match}
        />
      )}

      {/* Match End Celebration */}
      <AnimatePresence>
        {showMatchEndCelebration && savedMatchData && (
          <MatchEndCelebration
            homeTeam={savedMatchData.homeTeam}
            awayTeam={savedMatchData.awayTeam}
            homeScore={savedMatchData.homeScore}
            awayScore={savedMatchData.awayScore}
            homeColor={savedMatchData.homeTeamColor}
            awayColor={savedMatchData.awayTeamColor}
            motm={motmPlayer}
            onShare={() => setShowShareScorecard(true)}
            onDone={() => setShowMatchEndCelebration(false)}
          />
        )}
      </AnimatePresence>

      {/* Half Time Transition */}
      <AnimatePresence>
        {showHalfTimeTransition && (
          <HalfTimeTransition
            half={match.currentHalf}
            homeTeam={match.homeTeam}
            awayTeam={match.awayTeam}
            homeScore={match.homeScore}
            awayScore={match.awayScore}
            homeColor={match.homeTeamColor}
            awayColor={match.awayTeamColor}
            onContinue={() => setShowHalfTimeTransition(false)}
          />
        )}
      </AnimatePresence>

      {/* All Out Celebration */}
      <AnimatePresence>
        {allOutCelebration && (
          <AllOutCelebration
            teamName={allOutCelebration.teamName}
            teamColor={allOutCelebration.teamColor}
            onDismiss={() => setAllOutCelebration(null)}
          />
        )}
      </AnimatePresence>

      {/* Super Raid Celebration */}
      <AnimatePresence>
        {superRaidCelebration && (
          <SuperRaidCelebration
            teamName={superRaidCelebration.teamName}
            teamColor={superRaidCelebration.teamColor}
            playerName={superRaidCelebration.playerName}
            onDismiss={() => setSuperRaidCelebration(null)}
          />
        )}
      </AnimatePresence>

      {/* Self-Out Confirmation Popup */}
      <AnimatePresence>
        {selfOutConfirm && raidPhase === 'result' && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4"
          >
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.8, opacity: 0 }}
              className="w-full max-w-xs rounded-2xl p-5 text-center bg-gray-900 dark:bg-warm-800 border border-red-700/50"
            >
              <div className="text-3xl mb-2">🚫</div>
              <h3 className="text-base font-black text-gray-100 dark:text-warm-100">Self-Out?</h3>
              <p className="text-sm text-gray-400 dark:text-warm-400 mt-1">
                Did <span className="font-bold text-white">{selfOutConfirm.name}</span> step off the mat?
              </p>
              <p className="text-[10px] text-gray-500 mt-1">
                {raidingTeamName} gets +1 point
              </p>
              <div className="flex gap-3 mt-4">
                <motion.button
                  whileTap={{ scale: 0.95 }}
                  onClick={() => setSelfOutConfirm(null)}
                  className="flex-1 py-2.5 rounded-xl bg-gray-700 dark:bg-warm-700 text-gray-300 font-bold text-sm"
                >
                  Cancel
                </motion.button>
                <motion.button
                  whileTap={{ scale: 0.95 }}
                  onClick={() => handleSelfOut(selfOutConfirm)}
                  className="flex-1 py-2.5 rounded-xl bg-red-600 text-white font-bold text-sm"
                >
                  Confirm Self-Out
                </motion.button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Timeout Overlay (2 minutes) */}
      <AnimatePresence>
        {showTimeoutOverlay && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4"
          >
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.8, opacity: 0 }}
              className="w-full max-w-xs rounded-2xl p-6 text-center bg-gray-900 dark:bg-warm-800 border border-gray-700 dark:border-warm-700"
              style={{ borderTopColor: timeoutTeam === 'home' ? match.homeTeamColor : match.awayTeamColor, borderTopWidth: '4px' }}
            >
              <Hand className="w-10 h-10 text-orange-500 mx-auto mb-3" />
              <h3 className="text-lg font-black text-gray-100 dark:text-warm-100">Timeout</h3>
              <p className="text-sm text-gray-400 dark:text-warm-400 mb-3">
                {timeoutTeam === 'home' ? match.homeTeam : match.awayTeam} called a timeout
              </p>
              <div className="relative w-24 h-24 mx-auto mb-3">
                <svg className="w-24 h-24 -rotate-90" viewBox="0 0 96 96">
                  <circle cx="48" cy="48" r="42" fill="none" stroke="#374151" strokeWidth="4" />
                  <circle cx="48" cy="48" r="42" fill="none" stroke="#f97316" strokeWidth="4"
                    strokeDasharray={`${2 * Math.PI * 42}`}
                    strokeDashoffset={`${2 * Math.PI * 42 * (1 - timeoutCountdown / TIMEOUT_DURATION)}`}
                    strokeLinecap="round" className="transition-all duration-1000" />
                </svg>
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="text-2xl font-black text-orange-500 font-mono">{formatTime(timeoutCountdown)}</span>
                </div>
              </div>
              <div className="flex items-center justify-center gap-1 mb-3 text-[10px] text-gray-400">
                <Clock className="w-3 h-3" />
                <span>{Math.floor(timeoutCountdown / 60)}:{(timeoutCountdown % 60).toString().padStart(2, '0')} remaining</span>
              </div>
              <button
                onClick={() => {
                  setShowTimeoutOverlay(false);
                  setIsPaused(false);
                }}
                className="w-full py-2.5 rounded-xl bg-brand-red text-white font-bold text-sm"
              >
                Resume Play
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

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
              className="w-full max-w-md bg-gray-900 dark:bg-warm-800 rounded-t-3xl p-4 max-h-[70vh] overflow-y-auto"
            >
              <div className="flex items-center justify-between mb-4">
                <div>
                  <div className="text-sm font-black text-gray-100 dark:text-warm-100">Substitution</div>
                  <div className="text-[10px] text-gray-400 dark:text-warm-500">
                    Tap an on-court player OUT, then tap a substitute IN
                  </div>
                </div>
                <button
                  onClick={() => { setShowSubMode(null); setSubOutPlayer(null); }}
                  className="w-8 h-8 rounded-full bg-gray-700 dark:bg-warm-700 flex items-center justify-center"
                >
                  <X className="w-4 h-4 text-gray-400 dark:text-warm-400" />
                </button>
              </div>

              {(() => {
                const lineup = showSubMode === 'home' ? match.homeLineup : match.awayLineup;
                const teamColor = showSubMode === 'home' ? match.homeTeamColor : match.awayTeamColor;
                const outIds = showSubMode === 'home' ? match.homeOutPlayerIds : match.awayOutPlayerIds;
                const { onCourt, substitutes: subs } = splitLineup(lineup, outIds);

                return (
                  <div>
                    {/* On court players */}
                    <div className="mb-3">
                      <div className="text-[9px] font-bold text-gray-400 uppercase tracking-wider mb-2">On Court — Tap to sub OUT</div>
                      <div className="flex flex-wrap gap-2">
                        {onCourt.map(player => {
                          const isOut = outIds.includes(player.id);
                          const isSelected = subOutPlayer?.id === player.id;
                          return (
                            <button
                              key={player.id}
                              onClick={() => {
                                if (subOutPlayer?.id === player.id) {
                                  setSubOutPlayer(null);
                                } else {
                                  setSubOutPlayer(player);
                                }
                              }}
                              className={`flex flex-col items-center gap-0.5 p-1.5 rounded-xl transition-all ${
                                isSelected
                                  ? 'bg-red-900/30 ring-2 ring-red-500'
                                  : isOut
                                    ? 'opacity-40'
                                    : 'hover:bg-gray-800'
                              }`}
                            >
                              <PlayerCircle
                                player={player}
                                isOut={isOut}
                                isSelectable={!isOut}
                                teamColor={teamColor}
                              />
                              {isSelected && (
                                <span className="text-[8px] font-bold text-red-400">OUT →</span>
                              )}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* Substitutes */}
                    <div className="border-t border-dashed border-gray-700 pt-3">
                      <div className="text-[9px] font-bold text-gray-400 uppercase tracking-wider mb-2">Substitutes — Tap to sub IN</div>
                      <div className="flex flex-wrap gap-2">
                        {subs.map(player => {
                          const canSubIn = !!subOutPlayer;
                          const isSelected = false;
                          return (
                            <button
                              key={player.id}
                              onClick={() => {
                                if (subOutPlayer) {
                                  handleSub(subOutPlayer, player);
                                }
                              }}
                              disabled={!canSubIn}
                              className={`flex flex-col items-center gap-0.5 p-1.5 rounded-xl transition-all ${
                                canSubIn
                                  ? 'hover:bg-green-900/20 cursor-pointer'
                                  : 'opacity-50 cursor-not-allowed'
                              } ${canSubIn && subOutPlayer ? 'ring-1 ring-green-800' : ''}`}
                            >
                              <PlayerCircle
                                player={player}
                                isOut={false}
                                teamColor={teamColor}
                                size="small"
                              />
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                );
              })()}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* MOTM Celebration Overlay (legacy path) */}
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
              className="w-full max-w-sm bg-gradient-to-b from-yellow-50 to-white dark:from-yellow-900/20 dark:to-warm-800 rounded-3xl p-6 text-center"
            >
              <motion.div animate={{ scale: [1, 1.2, 1], rotate: [0, -5, 5, -5, 0] }} transition={{ duration: 1, repeat: 3 }} className="text-5xl mb-3">🏆</motion.div>
              <div className="text-[10px] font-bold text-yellow-700 dark:text-yellow-400 bg-yellow-100 dark:bg-yellow-900/30 px-3 py-1 rounded-full inline-flex items-center gap-1 mb-3">
                <Crown className="w-3 h-3" /> MAN OF THE MATCH
              </div>
              <h3 className="text-xl font-black text-gray-800 dark:text-warm-100">{motmPlayer.name}</h3>
              <p className="text-yellow-700 dark:text-yellow-400 font-bold text-lg mt-1">{motmPlayer.points} points</p>
              <p className="text-gray-500 dark:text-warm-400 text-sm mt-2">Top scorer in {match.homeTeam} vs {match.awayTeam}</p>
              <div className="flex gap-3 mt-5">
                <button onClick={() => setShowShareScorecard(true)} className="flex-1 bg-brand-red hover:bg-red-700 text-white font-bold rounded-xl py-3 flex items-center justify-center gap-1">
                  <Share2 className="w-4 h-4" /> Share
                </button>
                <button onClick={() => setShowMotmOverlay(false)} className="flex-1 bg-gray-100 dark:bg-warm-700 hover:bg-gray-200 dark:hover:bg-warm-600 text-gray-700 dark:text-warm-200 font-bold rounded-xl py-3">
                  Done
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Event Confirmation Toast */}
      <AnimatePresence>
        {eventConfirm && (
          <EventConfirmation
            message={eventConfirm.message}
            teamColor={eventConfirm.teamColor}
            onUndo={() => {
              undoLastEvent();
              toast({ title: 'Event undone', duration: 1500 });
            }}
          />
        )}
      </AnimatePresence>

      {/* ═══ COMPACT TOP INFO BAR ═══ */}
      <div className="relative overflow-hidden shrink-0" style={{
        background: `linear-gradient(135deg, ${match.homeTeamColor}15, #111827, ${match.awayTeamColor}15)`,
      }}>
        {/* Top info row */}
        <div className="relative px-2 pt-1 pb-0.5 flex items-center justify-between">
          <div className="flex items-center gap-1">
            <span className="text-[8px] bg-gray-700/80 px-1.5 py-0.5 rounded font-medium text-gray-300">
              7v7
            </span>
            {match.isPractice && (
              <span className="text-[8px] bg-green-900/60 text-green-300 px-1.5 py-0.5 rounded font-medium">Practice</span>
            )}
          </div>
          {/* Half indicator badge */}
          <motion.div
            key={halfLabel}
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className={`text-[8px] font-black tracking-[0.12em] px-2 py-0.5 rounded-full ${
              halfLabel === 'HALF TIME' || halfLabel === 'FULL TIME'
                ? 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30'
                : halfLabel === 'NOT STARTED'
                  ? 'bg-gray-600/40 text-gray-400 border border-gray-500/30'
                  : 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
            }`}
          >
            {halfLabel}
          </motion.div>
          <div className="text-[8px] text-gray-400 font-medium">
            {match.gender === 'male' ? '♂' : '♀'}
          </div>
        </div>

        {/* ═══ RAID TIMER BAR ═══ */}
        <AnimatePresence>
          {raidTimer !== null && raidPhase !== 'idle' && (
            <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.2 }} className="overflow-hidden">
              <div className="px-3 pb-1.5">
                <div className="flex items-center gap-1.5">
                  <Clock className="w-3 h-3 flex-shrink-0" style={{ color: raidTimerColor }} />
                  <div className="flex-1 h-1.5 bg-gray-700 rounded-full overflow-hidden">
                    <motion.div className="h-full rounded-full" style={{ backgroundColor: raidTimerColor }} animate={{ width: `${raidTimerPercent}%` }} transition={{ duration: 0.5 }} />
                  </div>
                  <span className="text-xs font-mono font-black min-w-[24px] text-right" style={{ color: raidTimerColor }}>{raidTimer}</span>
                </div>
                {raidTimer <= 5 && raidTimer > 0 && (
                  <motion.div animate={{ opacity: [0.5, 1, 0.5] }} transition={{ duration: 0.5, repeat: Infinity }} className="text-center text-[8px] font-bold mt-0.5" style={{ color: raidTimerColor }}>
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
              <div className="px-3 pb-1 flex items-center justify-center gap-1.5">
                <div className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
                <span className="text-[8px] text-amber-400 font-bold">
                  Timer pauses in {raidGapTimer}s — Select a raider!
                </span>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* ═══ TURN INDICATOR — Always visible during idle, enhanced during transition ═══ */}
      {hasStartedRaiding && raidPhase === 'idle' && (
        <AnimatePresence mode="wait">
          <motion.div
            key={raidingTeam + (isTurnTransitioning ? '-swap' : '-idle')}
            initial={{ opacity: 0, scaleY: 0 }}
            animate={{ opacity: 1, scaleY: 1 }}
            exit={{ opacity: 0, scaleY: 0 }}
            transition={{ duration: 0.3 }}
            className="origin-top overflow-hidden"
          >
            <div
              className="flex items-center justify-center gap-2 py-1.5 px-3"
              style={{
                backgroundColor: isTurnTransitioning ? `${raidingTeamColor}25` : `${raidingTeamColor}10`,
                borderBottom: `2px solid ${raidingTeamColor}${isTurnTransitioning ? '60' : '25'}`,
              }}
            >
              {isTurnTransitioning ? (
                /* Dramatic turn-swap animation */
                <motion.div
                  className="flex items-center gap-2"
                  initial={{ x: raidingTeam === 'home' ? 30 : -30, opacity: 0 }}
                  animate={{ x: 0, opacity: 1 }}
                  transition={{ type: 'spring', damping: 12, stiffness: 200 }}
                >
                  <motion.div
                    animate={{ rotate: [0, raidingTeam === 'home' ? -180 : 180, 0] }}
                    transition={{ duration: 0.6, ease: 'easeInOut' }}
                  >
                    <ArrowRightLeft className="w-4 h-4" style={{ color: raidingTeamColor }} />
                  </motion.div>
                  <span className="text-[10px] font-black tracking-wider" style={{ color: raidingTeamColor }}>
                    TURN → {raidingTeamName}'S RAID
                  </span>
                  {match.isDoOrDie && match.doOrDieTeamId === (raidingTeam === 'home' ? match.homeTeamId : match.awayTeamId) && (
                    <motion.span
                      animate={{ scale: [1, 1.3, 1] }}
                      transition={{ duration: 0.5, repeat: Infinity }}
                      className="text-xs"
                    >
                      🔥
                    </motion.span>
                  )}
                </motion.div>
              ) : (
                /* Subtle persistent turn indicator */
                <div className="flex items-center gap-1.5">
                  <motion.div
                    animate={{ scale: [1, 1.15, 1] }}
                    transition={{ duration: 2, repeat: Infinity }}
                  >
                    <Swords className="w-3 h-3" style={{ color: raidingTeamColor }} />
                  </motion.div>
                  <span className="text-[9px] font-black tracking-wider" style={{ color: raidingTeamColor }}>
                    {raidingTeamName}'S RAID
                  </span>
                  {match.isDoOrDie && match.doOrDieTeamId === (raidingTeam === 'home' ? match.homeTeamId : match.awayTeamId) && (
                    <motion.div
                      animate={{ scale: [1, 1.3, 1] }}
                      transition={{ duration: 0.5, repeat: Infinity }}
                    >
                      <Flame className="w-3 h-3 text-orange-500" />
                    </motion.div>
                  )}
                </div>
              )}
            </div>
          </motion.div>
        </AnimatePresence>
      )}

      {/* ═══ VERTICAL KABADDI MAT: Away (inverted) | Score | Home (normal) ═══ */}
      <div className="flex-1 flex flex-col overflow-hidden min-h-0">
        {/* Away Team - TOP (inverted/rotated 180° — like viewing from the other side of the court) */}
        <div className="flex-1 overflow-y-auto min-h-0 [transform:rotate(180deg)]">
          <TeamHalf
            side="away"
            teamName={match.awayTeam}
            teamColor={match.awayTeamColor}
            score={match.awayScore}
            raidPts={awayRaidPoints}
            tacklePts={awayTacklePoints}
            fullLineup={match.awayLineup}
            outIds={match.awayOutPlayerIds}
            isRaidingSide={raidingTeam === 'away'}
            timeoutsUsed={match.awayTimeouts}
          />
        </div>

        {/* ═══ Compact center divider with scores + court pattern ═══ */}
        <div className="shrink-0 relative overflow-hidden" style={{
          background: `linear-gradient(180deg, ${match.awayTeamColor}10, #1f2937, ${match.homeTeamColor}10)`,
        }}>
          {/* Subtle kabaddi court lines pattern */}
          <div className="absolute inset-0 opacity-20 pointer-events-none">
            {/* Center line */}
            <div className="absolute left-4 right-4 top-1/2 h-px bg-gray-400" />
            {/* Baulk lines */}
            <div className="absolute left-4 right-4 top-[25%] h-px bg-gray-500/50" />
            <div className="absolute left-4 right-4 top-[75%] h-px bg-gray-500/50" />
            {/* Bonus lines */}
            <div className="absolute left-4 right-4 top-[15%] h-px bg-gray-600/30 border-dashed" />
            <div className="absolute left-4 right-4 top-[85%] h-px bg-gray-600/30 border-dashed" />
            {/* Center circle */}
            <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-6 h-6 rounded-full border border-gray-400/40" />
          </div>

          <div className="relative flex items-center justify-around py-1.5 px-3 border-y border-gray-700/40">
            {/* Away score */}
            <div className="flex items-center gap-1.5">
              <div className="w-5 h-5 rounded-full flex items-center justify-center text-white font-bold text-[8px] shadow-md" style={{ backgroundColor: match.awayTeamColor, boxShadow: `0 0 6px ${match.awayTeamColor}40` }}>
                {match.awayTeam.charAt(0)}
              </div>
              <span className="text-xl font-black" style={{ color: match.awayTeamColor }}>{match.awayScore}</span>
            </div>

            {/* Center info */}
            <div className="flex flex-col items-center gap-0">
              {/* Turn indicator */}
              {hasStartedRaiding && raidPhase === 'idle' && (
                <motion.div
                  key={raidingTeam}
                  initial={{ scale: 0.8, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  className="flex items-center gap-0.5 px-1.5 py-px rounded-full mb-0.5"
                  style={{ backgroundColor: `${raidingTeamColor}20` }}
                >
                  <motion.div
                    animate={{ x: raidingTeam === 'home' ? [-1, 1, -1] : [1, -1, 1] }}
                    transition={{ duration: 1, repeat: Infinity }}
                  >
                    <Swords className="w-2.5 h-2.5" style={{ color: raidingTeamColor }} />
                  </motion.div>
                  <span className="text-[6px] font-black tracking-wider" style={{ color: raidingTeamColor }}>
                    {raidingTeamName}
                  </span>
                </motion.div>
              )}
              {/* Do-or-Die flame */}
              {match.isDoOrDie && match.doOrDieTeamId === (raidingTeam === 'home' ? match.homeTeamId : match.awayTeamId) && raidPhase === 'idle' && (
                <motion.span
                  animate={{ scale: [1, 1.2, 1] }}
                  transition={{ duration: 0.5, repeat: Infinity }}
                  className="text-xs"
                >
                  🔥
                </motion.span>
              )}
              <span className={cn(
                'text-sm font-mono font-black tracking-wider',
                isTimerPulsing && 'animate-pulse'
              )} style={{ color: isTimerPulsing ? '#ef4444' : '#e5e7eb' }}>
                {!hasStartedRaiding ? '--:--' : formatTime(match.timer)}
              </span>
              <span className="text-[7px] text-gray-500 font-medium">
                {match.currentHalf === 1 ? '1ST HALF' : '2ND HALF'} · {match.halfDuration}min
              </span>
            </div>

            {/* Home score */}
            <div className="flex items-center gap-1.5">
              <span className="text-xl font-black" style={{ color: match.homeTeamColor }}>{match.homeScore}</span>
              <div className="w-5 h-5 rounded-full flex items-center justify-center text-white font-bold text-[8px] shadow-md" style={{ backgroundColor: match.homeTeamColor, boxShadow: `0 0 6px ${match.homeTeamColor}40` }}>
                {match.homeTeam.charAt(0)}
              </div>
            </div>
          </div>
        </div>

        {/* Home Team - BOTTOM (normal orientation) */}
        <div className="flex-1 overflow-y-auto min-h-0">
          <TeamHalf
            side="home"
            teamName={match.homeTeam}
            teamColor={match.homeTeamColor}
            score={match.homeScore}
            raidPts={homeRaidPoints}
            tacklePts={homeTacklePoints}
            fullLineup={match.homeLineup}
            outIds={match.homeOutPlayerIds}
            isRaidingSide={raidingTeam === 'home'}
            timeoutsUsed={match.homeTimeouts}
          />
        </div>
      </div>

      {/* ═══ RAID FLOW OVERLAYS — Tabbed Quick Actions ═══ */}
      <AnimatePresence>
        {raidPhase === 'result' && raider && (
          <motion.div initial={{ opacity: 0, y: 60 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 60 }} transition={{ type: 'spring', damping: 25, stiffness: 300 }} className="fixed inset-x-0 bottom-[76px] z-40 px-4">
            <div className="bg-gray-900 dark:bg-warm-800 rounded-2xl shadow-2xl border border-gray-700 dark:border-warm-700 p-4 max-w-md mx-auto">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 rounded-full flex items-center justify-center text-white font-bold text-lg shadow-md" style={{ backgroundColor: raidingTeamColor }}>
                  {raider.name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)}
                </div>
                <div className="flex-1">
                  <div className="text-base font-black text-gray-100 dark:text-warm-100">#{raider.jerseyNumber || '?'} {raider.name}</div>
                  <div className="text-xs text-gray-400 dark:text-warm-500">goes to raid for {raidingTeamName}</div>
                </div>
                {raidTimer !== null && (
                  <div className="relative w-11 h-11 flex-shrink-0">
                    <svg className="w-11 h-11 -rotate-90" viewBox="0 0 44 44">
                      <circle cx="22" cy="22" r="19" fill="none" stroke="#374151" strokeWidth="3" />
                      <circle cx="22" cy="22" r="19" fill="none" stroke={raidTimerColor} strokeWidth="3"
                        strokeDasharray={`${2 * Math.PI * 19}`} strokeDashoffset={`${2 * Math.PI * 19 * (1 - raidTimer / RAID_TIME_LIMIT)}`}
                        strokeLinecap="round" className="transition-all duration-500" />
                    </svg>
                    <div className="absolute inset-0 flex items-center justify-center">
                      <span className="text-xs font-black" style={{ color: raidTimerColor }}>{raidTimer}</span>
                    </div>
                  </div>
                )}
                <button onClick={cancelRaid} className="w-8 h-8 rounded-full bg-gray-700 dark:bg-warm-700 flex items-center justify-center flex-shrink-0">
                  <X className="w-4 h-4 text-gray-400 dark:text-warm-400" />
                </button>
              </div>

              {/* Tabbed action sections */}
              <div className="flex gap-1 mb-3 bg-gray-800 dark:bg-warm-900 rounded-xl p-1">
                {([
                  { id: 'raid' as ActionTab, label: 'Raid', icon: Swords },
                  { id: 'defense' as ActionTab, label: 'Defense', icon: Shield },
                  { id: 'special' as ActionTab, label: 'Special', icon: Sparkles },
                  { id: 'cards' as ActionTab, label: 'Cards', icon: AlertTriangle },
                ]).map(tab => (
                  <button
                    key={tab.id}
                    onClick={() => setActionTab(tab.id)}
                    className={cn(
                      'flex-1 flex items-center justify-center gap-1 py-1.5 rounded-lg text-[10px] font-bold transition-all',
                      actionTab === tab.id
                        ? 'bg-gray-600 dark:bg-warm-700 text-white shadow-sm'
                        : 'text-gray-400 hover:text-gray-300'
                    )}
                  >
                    <tab.icon className="w-3 h-3" />
                    {tab.label}
                  </button>
                ))}
              </div>

              <AnimatePresence mode="wait">
                {actionTab === 'raid' && (
                  <motion.div key="raid" initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 10 }} className="space-y-2">
                    <div className="text-[9px] font-bold text-gray-500 dark:text-warm-500 uppercase tracking-wider mb-1">Raid Outcome</div>
                    <div className="grid grid-cols-3 gap-2">
                      <motion.button whileTap={{ scale: 0.92 }} onClick={() => handleSelectResult('success')} className="py-3 px-2 rounded-xl flex flex-col items-center gap-1.5 transition-all" style={{ background: 'linear-gradient(135deg, #22c55e25, #22c55e08)', border: '2px solid #22c55e50' }}>
                        <div className="text-xl">✅</div>
                        <span className="text-[10px] font-bold text-green-400">Successful Raid</span>
                      </motion.button>
                      <motion.button whileTap={{ scale: 0.92 }} onClick={() => handleSelectResult('caught')} className="py-3 px-2 rounded-xl flex flex-col items-center gap-1.5 transition-all" style={{ background: 'linear-gradient(135deg, #ef444425, #ef444408)', border: '2px solid #ef444450' }}>
                        <div className="text-xl">❌</div>
                        <span className="text-[10px] font-bold text-red-400">Caught Out</span>
                      </motion.button>
                      <motion.button whileTap={{ scale: 0.92 }} onClick={() => handleSelectResult('empty')} className="py-3 px-2 rounded-xl flex flex-col items-center gap-1.5 transition-all" style={{ background: 'linear-gradient(135deg, #9ca3af25, #9ca3af08)', border: '2px solid #9ca3af50' }}>
                        <div className="text-xl">⏭</div>
                        <span className="text-[10px] font-bold text-gray-400">Empty Raid</span>
                      </motion.button>
                    </div>
                    {/* Self-Out button */}
                    <motion.button
                      whileTap={{ scale: 0.92 }}
                      onClick={() => {
                        // Show defending team players to pick who self-outed
                        const { onCourtActive: activeDefenders } = splitLineup(fullDefendingLineup, defendingOutIds);
                        if (activeDefenders.length > 0) {
                          // Set self-out confirm to first active defender - user can tap a defender below
                          setActionTab('defense');
                        }
                      }}
                      className="w-full py-2.5 px-2 rounded-xl flex items-center justify-center gap-2 transition-all"
                      style={{ background: 'linear-gradient(135deg, #f9731625, #f9731608)', border: '2px solid #f9731650' }}
                    >
                      <div className="text-base">🚫</div>
                      <span className="text-[10px] font-bold text-orange-400">SELF-OUT</span>
                      <span className="text-[8px] text-orange-400/70">Defender steps off mat</span>
                    </motion.button>
                  </motion.div>
                )}

                {actionTab === 'defense' && (
                  <motion.div key="defense" initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 10 }} className="space-y-2">
                    <div className="text-[9px] font-bold text-gray-500 dark:text-warm-500 uppercase tracking-wider mb-1">Defense Actions</div>
                    <div className="grid grid-cols-2 gap-2">
                      <motion.button whileTap={{ scale: 0.92 }} onClick={handleTacklePoint} className="py-3 px-2 rounded-xl flex flex-col items-center gap-1.5 transition-all" style={{ background: `linear-gradient(135deg, ${defendingTeamColor}25, ${defendingTeamColor}08)`, border: `2px solid ${defendingTeamColor}50` }}>
                        <div className="text-xl">🛡</div>
                        <span className="text-[10px] font-bold" style={{ color: defendingTeamColor }}>Tackle Point</span>
                      </motion.button>
                      <motion.button whileTap={{ scale: 0.92 }} onClick={handleSuperTackle} className="py-3 px-2 rounded-xl flex flex-col items-center gap-1.5 transition-all" style={{ background: 'linear-gradient(135deg, #a855f725, #a855f708)', border: '2px solid #a855f750' }}>
                        <div className="text-xl">⚡</div>
                        <span className="text-[10px] font-bold text-purple-400">Super Tackle</span>
                      </motion.button>
                    </div>
                    {/* Self-out: tap a defender to declare self-out */}
                    <div className="border-t border-gray-700 pt-2 mt-2">
                      <div className="text-[9px] font-bold text-orange-400/80 uppercase tracking-wider mb-1.5">🚫 Tap defender for Self-Out</div>
                      <div className="flex flex-wrap gap-2 justify-center">
                        {(() => {
                          const { onCourt, onCourtActive } = splitLineup(fullDefendingLineup, defendingOutIds);
                          return onCourt.filter(p => !defendingOutIds.includes(p.id)).map(player => (
                            <button
                              key={player.id}
                              onClick={() => setSelfOutConfirm(player)}
                              className="flex flex-col items-center gap-0.5 p-1.5 rounded-xl transition-all hover:bg-orange-900/20 active:bg-orange-900/30"
                            >
                              <PlayerCircle
                                player={player}
                                isOut={false}
                                isSelectable={false}
                                teamColor={defendingTeamColor}
                                size="small"
                              />
                              <span className="text-[7px] font-bold text-orange-400">Self-Out</span>
                            </button>
                          ));
                        })()}
                      </div>
                    </div>
                  </motion.div>
                )}

                {actionTab === 'special' && (() => {
                  const { onCourtActive: activeDefenders } = splitLineup(fullDefendingLineup, defendingOutIds);
                  const canGetBonus = activeDefenders.length >= 6;
                  return (
                    <motion.div key="special" initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 10 }} className="space-y-2">
                      <div className="text-[9px] font-bold text-gray-500 dark:text-warm-500 uppercase tracking-wider mb-1">Special Events</div>
                      <div className="grid grid-cols-3 gap-2">
                        <motion.button
                          whileTap={canGetBonus ? { scale: 0.92 } : {}}
                          onClick={canGetBonus ? handleBonusPoint : undefined}
                          className={`py-3 px-2 rounded-xl flex flex-col items-center gap-1.5 transition-all ${!canGetBonus ? 'opacity-40 cursor-not-allowed' : ''}`}
                          style={{ background: 'linear-gradient(135deg, #eab30825, #eab30808)', border: `2px solid ${canGetBonus ? '#eab30850' : '#9ca3af30'}` }}
                          title={canGetBonus ? 'Bonus Point' : 'Bonus only with 6+ defenders'}
                        >
                          <div className="text-xl">🎯</div>
                          <span className={`text-[10px] font-bold ${canGetBonus ? 'text-yellow-400' : 'text-gray-500'}`}>Bonus Point</span>
                          {!canGetBonus && <span className="text-[7px] text-gray-500">Need 6+ defenders</span>}
                        </motion.button>
                        <motion.button whileTap={{ scale: 0.92 }} onClick={handleAllOut} className="py-3 px-2 rounded-xl flex flex-col items-center gap-1.5 transition-all" style={{ background: `linear-gradient(135deg, ${raidingTeamColor}25, ${raidingTeamColor}08)`, border: `2px solid ${raidingTeamColor}50` }}>
                          <div className="text-xl">💥</div>
                          <span className="text-[10px] font-bold" style={{ color: raidingTeamColor }}>All Out</span>
                        </motion.button>
                        <motion.button whileTap={{ scale: 0.92 }} onClick={() => handleTimeout()} className="py-3 px-2 rounded-xl flex flex-col items-center gap-1.5 transition-all" style={{ background: 'linear-gradient(135deg, #f9731625, #f9731608)', border: '2px solid #f9731650' }}>
                          <div className="text-xl">📋</div>
                          <span className="text-[10px] font-bold text-orange-400">Timeout</span>
                        </motion.button>
                      </div>
                    </motion.div>
                  );
                })()}

                {actionTab === 'cards' && (
                  <motion.div key="cards" initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 10 }} className="space-y-2">
                    <div className="text-[9px] font-bold text-gray-500 dark:text-warm-500 uppercase tracking-wider mb-1">Card Penalties</div>
                    <div className="grid grid-cols-2 gap-2">
                      <motion.button whileTap={{ scale: 0.92 }} onClick={() => handleCard('yellow_card')} className="py-3 px-2 rounded-xl flex flex-col items-center gap-1.5 transition-all" style={{ background: 'linear-gradient(135deg, #eab30825, #eab30808)', border: '2px solid #eab30850' }}>
                        <div className="text-xl">🟨</div>
                        <span className="text-[10px] font-bold text-yellow-400">Yellow Card</span>
                      </motion.button>
                      <motion.button whileTap={{ scale: 0.92 }} onClick={() => handleCard('red_card')} className="py-3 px-2 rounded-xl flex flex-col items-center gap-1.5 transition-all" style={{ background: 'linear-gradient(135deg, #ef444425, #ef444408)', border: '2px solid #ef444450' }}>
                        <div className="text-xl">🟥</div>
                        <span className="text-[10px] font-bold text-red-400">Red Card</span>
                      </motion.button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {raidPhase === 'defenders' && raider && raidResult && (
          <motion.div initial={{ opacity: 0, y: 60 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 60 }} transition={{ type: 'spring', damping: 25, stiffness: 300 }} className="fixed inset-x-0 bottom-[76px] z-40 px-4">
            <div className="bg-gray-900 dark:bg-warm-800 rounded-2xl shadow-2xl border border-gray-700 dark:border-warm-700 p-4 max-w-md mx-auto max-h-[60vh] overflow-y-auto">
              <div className="flex items-center justify-between mb-3">
                <div className="flex-1">
                  {raidResult === 'success' ? (
                    <><div className="text-sm font-black text-green-400">✅ Tap defenders the raider touched</div>
                    <div className="text-[10px] text-gray-400 dark:text-warm-500 mt-0.5">Each selected defender = 1 point for {raidingTeamName}</div></>
                  ) : (
                    <><div className="text-sm font-black text-red-400">❌ Who caught the raider?</div>
                    <div className="text-[10px] text-gray-400 dark:text-warm-500 mt-0.5">Select the defender(s) who tackled</div></>
                  )}
                </div>
                {raidTimer !== null && (
                  <div className="flex items-center gap-1 flex-shrink-0 mr-2">
                    <Clock className="w-3.5 h-3.5" style={{ color: raidTimerColor }} />
                    <span className="text-sm font-black font-mono" style={{ color: raidTimerColor }}>{raidTimer}</span>
                  </div>
                )}
                <button onClick={() => { setRaidPhase('result'); setSelectedDefenders(new Set()); setBonusPoint(false); }} className="w-8 h-8 rounded-full bg-gray-700 dark:bg-warm-700 flex items-center justify-center flex-shrink-0">
                  <X className="w-4 h-4 text-gray-400 dark:text-warm-400" />
                </button>
              </div>

              {/* Only show on-court defenders (first 7) */}
              <div className="flex flex-wrap justify-center gap-x-3 gap-y-2 py-2">
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

              {raidResult === 'success' && (() => {
                const { onCourtActive: activeDefenders } = splitLineup(fullDefendingLineup, defendingOutIds);
                const canGetBonus = activeDefenders.length >= 6;
                return (
                  <button
                    onClick={() => canGetBonus && setBonusPoint(!bonusPoint)}
                    disabled={!canGetBonus}
                    className={`mt-2 w-full py-2.5 rounded-xl text-sm font-bold transition-all flex items-center justify-center gap-2 ${
                      bonusPoint ? 'bg-yellow-900/30 border-2 border-yellow-400 text-yellow-400' : canGetBonus ? 'bg-gray-800 dark:bg-warm-700 border-2 border-gray-600 dark:border-warm-600 text-gray-400 dark:text-warm-400' : 'bg-gray-800/50 dark:bg-warm-700/50 border-2 border-gray-700 dark:border-warm-600 text-gray-600 dark:text-warm-600 cursor-not-allowed opacity-50'
                    }`}
                    title={canGetBonus ? 'Toggle Bonus Point' : 'Bonus only with 6+ defenders on court'}
                  >
                    <span className="text-lg">⭐</span>Bonus Point {bonusPoint ? 'ON' : 'OFF'}
                    {!canGetBonus && <span className="text-[8px] ml-1">(6+ defenders needed)</span>}
                  </button>
                );
              })()}

              <div className="mt-3 flex items-center gap-3">
                <div className="flex-1">
                  {raidResult === 'success' && (
                    <div className="text-xs text-gray-400">
                      <span className="font-bold text-green-400">+{selectedDefenders.size + (bonusPoint ? 1 : 0)}</span> point{selectedDefenders.size + (bonusPoint ? 1 : 0) !== 1 ? 's' : ''} for {raidingTeamName}
                    </div>
                  )}
                  {raidResult === 'caught' && (() => {
                    const { onCourtActive } = splitLineup(fullDefendingLineup, defendingOutIds);
                    return (
                      <div className="text-xs text-gray-400">
                        <span className="font-bold text-red-400">+1</span> tackle point for {defendingTeamName}
                        {onCourtActive.length <= 3 && <span className="ml-1 text-purple-400 font-bold">(+1 super tackle!)</span>}
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
      <div className="border-t border-gray-700 dark:border-warm-700 bg-gray-900 dark:bg-warm-800 px-2 py-1.5 shrink-0">
        <div className="grid grid-cols-6 gap-0.5">
          <button onClick={handleUndo} disabled={match.events.length === 0} className="flex flex-col items-center gap-0.5 py-1 rounded-xl transition-colors active:bg-gray-800 dark:active:bg-warm-700 disabled:opacity-30">
            <div className="w-7 h-7 rounded-full bg-gray-700 dark:bg-warm-700 flex items-center justify-center"><Undo2 className="w-3.5 h-3.5 text-gray-400 dark:text-warm-300" /></div>
            <span className="text-[8px] font-semibold text-gray-400 dark:text-warm-400">UNDO</span>
          </button>
          <button onClick={handlePause} className="flex flex-col items-center gap-0.5 py-1 rounded-xl transition-colors active:bg-gray-800 dark:active:bg-warm-700">
            <div className={`w-7 h-7 rounded-full flex items-center justify-center ${isPaused ? 'bg-teal-900/40 text-teal-400' : 'bg-gray-700 dark:bg-warm-700 text-gray-400 dark:text-warm-300'}`}>
              {isPaused ? <Play className="w-3.5 h-3.5" /> : <Pause className="w-3.5 h-3.5" />}
            </div>
            <span className="text-[8px] font-semibold text-gray-400 dark:text-warm-400">{isPaused ? 'PLAY' : 'PAUSE'}</span>
          </button>
          <button onClick={() => setShowAddPlayer(true)} className="flex flex-col items-center gap-0.5 py-1 rounded-xl transition-colors active:bg-gray-800 dark:active:bg-warm-700">
            <div className="w-7 h-7 rounded-full bg-emerald-900/30 flex items-center justify-center"><UserPlus className="w-3.5 h-3.5 text-emerald-400" /></div>
            <span className="text-[8px] font-semibold text-gray-400 dark:text-warm-400">ADD</span>
          </button>
          <button onClick={() => handleTimeout()} className="flex flex-col items-center gap-0.5 py-1 rounded-xl transition-colors active:bg-gray-800 dark:active:bg-warm-700">
            <div className="w-7 h-7 rounded-full bg-orange-900/30 flex items-center justify-center"><Hand className="w-3.5 h-3.5 text-orange-400" /></div>
            <span className="text-[8px] font-semibold text-gray-400 dark:text-warm-400">TIMEOUT</span>
          </button>
          <button onClick={handleEndHalf} className={`flex flex-col items-center gap-0.5 py-1 rounded-xl transition-colors ${showEndHalfConfirm ? 'bg-yellow-900/20' : 'active:bg-gray-800 dark:active:bg-warm-700'}`}>
            <div className={`w-7 h-7 rounded-full flex items-center justify-center ${showEndHalfConfirm ? 'bg-yellow-800 text-yellow-300 animate-pulse' : 'bg-yellow-900/30 text-yellow-400'}`}><Timer className="w-3.5 h-3.5" /></div>
            <span className={`text-[8px] font-semibold ${showEndHalfConfirm ? 'text-yellow-300' : 'text-gray-400 dark:text-warm-400'}`}>{showEndHalfConfirm ? 'SURE?' : `H${match.currentHalf}`}</span>
          </button>
          <button onClick={handleEndMatch} className={`flex flex-col items-center gap-0.5 py-1 rounded-xl transition-colors ${showEndMatchConfirm ? 'bg-red-900/20' : 'active:bg-gray-800 dark:active:bg-warm-700'}`}>
            <div className={`w-7 h-7 rounded-full flex items-center justify-center ${showEndMatchConfirm ? 'bg-red-800 text-red-300 animate-pulse' : 'bg-red-900/30 text-red-400'}`}><Square className="w-3.5 h-3.5" /></div>
            <span className={`text-[8px] font-semibold ${showEndMatchConfirm ? 'text-red-300' : 'text-gray-400 dark:text-warm-400'}`}>{showEndMatchConfirm ? 'SURE?' : 'END'}</span>
          </button>
        </div>
      </div>

      {/* ═══ ADD PLAYER MODAL ═══ */}
      <AnimatePresence>
        {showAddPlayer && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-end justify-center"
            onClick={() => { setShowAddPlayer(false); setAddPlayerTeam(null); setAddPlayerName(''); setAddPlayerJersey(''); }}
          >
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              className="w-full max-w-md bg-gray-900 dark:bg-warm-800 rounded-t-3xl p-5 pb-8"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Handle bar */}
              <div className="w-10 h-1 bg-gray-600 rounded-full mx-auto mb-4" />

              <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                <UserPlus className="w-5 h-5 text-emerald-400" />
                Add Player
              </h3>

              {/* Team Selection */}
              {!addPlayerTeam ? (
                <div className="space-y-3">
                  <p className="text-sm text-gray-400">Which team is the player joining?</p>
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      onClick={() => setAddPlayerTeam('home')}
                      className="flex items-center gap-2 p-3 rounded-xl border-2 border-gray-700 hover:border-gray-500 transition-colors"
                      style={{ backgroundColor: `${match.homeTeamColor}15` }}
                    >
                      <div className="w-8 h-8 rounded-full flex items-center justify-center text-white font-bold text-sm" style={{ backgroundColor: match.homeTeamColor }}>
                        {match.homeTeam.charAt(0)}
                      </div>
                      <div className="text-left">
                        <p className="text-sm font-bold text-white">{match.homeTeam}</p>
                        <p className="text-[10px] text-gray-400">{match.homeLineup.length} players</p>
                      </div>
                    </button>
                    <button
                      onClick={() => setAddPlayerTeam('away')}
                      className="flex items-center gap-2 p-3 rounded-xl border-2 border-gray-700 hover:border-gray-500 transition-colors"
                      style={{ backgroundColor: `${match.awayTeamColor}15` }}
                    >
                      <div className="w-8 h-8 rounded-full flex items-center justify-center text-white font-bold text-sm" style={{ backgroundColor: match.awayTeamColor }}>
                        {match.awayTeam.charAt(0)}
                      </div>
                      <div className="text-left">
                        <p className="text-sm font-bold text-white">{match.awayTeam}</p>
                        <p className="text-[10px] text-gray-400">{match.awayLineup.length} players</p>
                      </div>
                    </button>
                  </div>
                </div>
              ) : (
                /* Player Details Form */
                <div className="space-y-3">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-6 h-6 rounded-full flex items-center justify-center text-white text-[10px] font-bold" style={{ backgroundColor: addPlayerTeam === 'home' ? match.homeTeamColor : match.awayTeamColor }}>
                      {(addPlayerTeam === 'home' ? match.homeTeam : match.awayTeam).charAt(0)}
                    </div>
                    <span className="text-sm font-semibold text-white">{addPlayerTeam === 'home' ? match.homeTeam : match.awayTeam}</span>
                    <button onClick={() => setAddPlayerTeam(null)} className="ml-auto text-[10px] text-gray-400 hover:text-white">Change</button>
                  </div>

                  <div>
                    <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Player Name *</label>
                    <input
                      type="text"
                      value={addPlayerName}
                      onChange={(e) => setAddPlayerName(e.target.value)}
                      placeholder="Enter player name"
                      className="w-full mt-1 px-3 py-2.5 bg-gray-800 dark:bg-warm-700 border border-gray-600 dark:border-warm-600 rounded-xl text-sm text-white placeholder-gray-500 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/30"
                      autoFocus
                    />
                  </div>

                  <div>
                    <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Jersey Number</label>
                    <input
                      type="number"
                      value={addPlayerJersey}
                      onChange={(e) => setAddPlayerJersey(e.target.value)}
                      placeholder="Auto-assign"
                      className="w-full mt-1 px-3 py-2.5 bg-gray-800 dark:bg-warm-700 border border-gray-600 dark:border-warm-600 rounded-xl text-sm text-white placeholder-gray-500 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/30"
                    />
                  </div>

                  <div className="flex gap-2 pt-2">
                    <button
                      onClick={() => { setShowAddPlayer(false); setAddPlayerTeam(null); setAddPlayerName(''); setAddPlayerJersey(''); }}
                      className="flex-1 py-2.5 rounded-xl border border-gray-600 text-gray-300 font-semibold text-sm"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleAddPlayer}
                      disabled={!addPlayerName.trim()}
                      className="flex-1 py-2.5 rounded-xl bg-emerald-600 text-white font-bold text-sm disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      Add Player
                    </button>
                  </div>
                </div>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
