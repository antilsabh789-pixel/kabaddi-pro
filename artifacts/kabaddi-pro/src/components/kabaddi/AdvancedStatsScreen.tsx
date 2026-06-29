'use client';

import { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence, Variants } from 'framer-motion';
import {
  X, BarChart3, Swords, Shield, Star, Zap, MapPin,
  Trophy, Target, Activity, TrendingUp, TrendingDown,
  Minus, Filter, Clock, Users, AlertTriangle,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useKabaddiStore } from '@/lib/store';
import PremiumLock from './PremiumLock';

// ─── Types ────────────────────────────────────────────────────────

interface AdvancedStatsScreenProps {
  userId: string;
  onClose: () => void;
}

interface PlayerUser {
  id: string;
  name: string;
  avatar: string | null;
  gender?: string;
}

interface PlayerProfileData {
  id?: string;
  userId?: string;
  jerseyNumber: number | null;
  position: string | null;
  overallRating: number;
  totalRaids: number;
  successfulRaids: number;
  totalTackles: number;
  successfulTackles: number;
  bonusPoints: number;
  superTackles: number;
  playerOfMonth?: number;
  playerOfYear?: number;
}

interface MatchHistoryEntry {
  id: string;
  opponent: string;
  score: string;
  playerPoints: number;
  result: 'W' | 'L' | 'D';
  half1Points: number;
  half2Points: number;
  type: 'tournament' | 'practice';
}

type TimePeriod = 'last5' | 'last10' | 'allTime';
type MatchType = 'all' | 'tournament' | 'practice';
type GenderFilter = 'all' | 'male' | 'female';

// ─── Animation variants ──────────────────────────────────────────

const containerVariants: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.06, delayChildren: 0.1 },
  },
};

const itemVariants: Variants = {
  hidden: { opacity: 0, y: 16, scale: 0.98 },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: { type: 'spring' as const, damping: 20, stiffness: 200 },
  },
};

// ─── SVG Circular Gauge ───────────────────────────────────────────

function CircularGauge({
  value,
  max = 100,
  size = 100,
  strokeWidth = 8,
  color = '#14B8A6',
  label,
  sublabel,
  children,
}: {
  value: number;
  max?: number;
  size?: number;
  strokeWidth?: number;
  color?: string;
  label?: string;
  sublabel?: string;
  children?: React.ReactNode;
}) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const percentage = Math.min(value / max, 1);
  const offset = circumference - percentage * circumference;

  return (
    <div className="progress-ring" style={{ width: size, height: size }}>
      <svg width={size} height={size}>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth={strokeWidth}
          className="text-warm-200"
        />
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset: offset }}
          transition={{ duration: 1.2, ease: 'easeOut', delay: 0.3 }}
        />
      </svg>
      <div className="progress-ring-content">
        {children || (
          <>
            <motion.span
              className="text-lg font-black"
              style={{ color }}
              initial={{ opacity: 0, scale: 0.5 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.6, type: 'spring', damping: 12 }}
            >
              {value.toFixed(value % 1 === 0 ? 0 : 1)}
            </motion.span>
            {label && (
              <span className="text-[9px] font-semibold text-warm-500 uppercase tracking-wide">
                {label}
              </span>
            )}
          </>
        )}
      </div>
    </div>
  );
}

// ─── SVG Line Chart ───────────────────────────────────────────────

function MiniLineChart({
  data,
  color = '#14B8A6',
  height = 60,
  width = 200,
}: {
  data: number[];
  color?: string;
  height?: number;
  width?: number;
}) {
  if (data.length < 2) return null;
  const maxVal = Math.max(...data, 1);
  const minVal = Math.min(...data, 0);
  const range = maxVal - minVal || 1;
  const padding = 4;

  const points = data.map((val, i) => {
    const x = padding + (i / (data.length - 1)) * (width - padding * 2);
    const y = padding + (1 - (val - minVal) / range) * (height - padding * 2);
    return `${x},${y}`;
  });

  const areaPoints = [
    `${padding},${height - padding}`,
    ...points,
    `${width - padding},${height - padding}`,
  ].join(' ');

  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
      <defs>
        <linearGradient id={`grad-${color.replace('#', '')}`} x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor={color} stopOpacity="0.3" />
          <stop offset="100%" stopColor={color} stopOpacity="0.02" />
        </linearGradient>
      </defs>
      <motion.polygon
        points={areaPoints}
        fill={`url(#grad-${color.replace('#', '')})`}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.8, delay: 0.3 }}
      />
      <motion.polyline
        points={points.join(' ')}
        fill="none"
        stroke={color}
        strokeWidth={2.5}
        strokeLinecap="round"
        strokeLinejoin="round"
        initial={{ pathLength: 0 }}
        animate={{ pathLength: 1 }}
        transition={{ duration: 1, ease: 'easeOut', delay: 0.2 }}
      />
      {data.map((val, i) => {
        const x = padding + (i / (data.length - 1)) * (width - padding * 2);
        const y = padding + (1 - (val - minVal) / range) * (height - padding * 2);
        return (
          <motion.circle
            key={i}
            cx={x}
            cy={y}
            r={3}
            fill="white"
            stroke={color}
            strokeWidth={2}
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.6 + i * 0.1, type: 'spring', damping: 12 }}
          />
        );
      })}
    </svg>
  );
}

// ─── Comparison Bar ───────────────────────────────────────────────

function ComparisonBar({
  label,
  playerValue,
  compareValue,
  playerLabel = 'You',
  compareLabel = 'Avg',
  color = '#14B8A6',
}: {
  label: string;
  playerValue: number;
  compareValue: number;
  playerLabel?: string;
  compareLabel?: string;
  color?: string;
}) {
  const maxVal = Math.max(playerValue, compareValue, 1);
  const playerPct = (playerValue / maxVal) * 100;
  const comparePct = (compareValue / maxVal) * 100;

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-bold text-warm-700 dark:text-warm-200 uppercase tracking-wide">{label}</span>
        <span className="text-[10px] font-semibold text-warm-500">
          {playerValue.toFixed(1)} vs {compareValue.toFixed(1)}
        </span>
      </div>
      <div className="space-y-1">
        <div className="flex items-center gap-2">
          <span className="text-[9px] text-warm-500 font-medium w-8">{playerLabel}</span>
          <div className="flex-1 comparison-bar">
            <motion.div
              className="comparison-bar-fill"
              style={{ background: color }}
              initial={{ width: 0 }}
              animate={{ width: `${playerPct}%` }}
              transition={{ duration: 0.8, ease: 'easeOut', delay: 0.2 }}
            />
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[9px] text-warm-500 font-medium w-8">{compareLabel}</span>
          <div className="flex-1 comparison-bar">
            <motion.div
              className="comparison-bar-fill"
              style={{ background: '#94A3B8' }}
              initial={{ width: 0 }}
              animate={{ width: `${comparePct}%` }}
              transition={{ duration: 0.8, ease: 'easeOut', delay: 0.3 }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Percentile Badge ─────────────────────────────────────────────

function PercentileBadge({ value }: { value: number }) {
  let color = 'bg-warm-200 text-warm-600';
  let label = 'Below Avg';
  if (value >= 90) { color = 'bg-brand-gold/20 text-brand-gold-dark'; label = 'Elite'; }
  else if (value >= 75) { color = 'bg-brand-teal/15 text-brand-teal'; label = 'Excellent'; }
  else if (value >= 50) { color = 'bg-brand-navy/10 text-brand-navy'; label = 'Above Avg'; }
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-bold ${color}`}>
      P{value} · {label}
    </span>
  );
}

// ─── Skill Radar ──────────────────────────────────────────────────

function SkillRadar({ dimensions }: { dimensions: { label: string; value: number }[] }) {
  const size = 220;
  const center = size / 2;
  const radius = 80;
  const levels = 4;
  const count = dimensions.length;
  const angleStep = (2 * Math.PI) / count;

  const getPoint = (index: number, value: number) => {
    const angle = angleStep * index - Math.PI / 2;
    const r = (value / 100) * radius;
    return { x: center + r * Math.cos(angle), y: center + r * Math.sin(angle) };
  };

  const radarPoints = dimensions.map((d, i) => getPoint(i, d.value));
  const radarPath = radarPoints.map((p) => `${p.x},${p.y}`).join(' ');

  return (
    <div className="flex flex-col items-center">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        {Array.from({ length: levels }).map((_, level) => {
          const r = radius * ((level + 1) / levels);
          const pts = Array.from({ length: count }).map((_, i) => {
            const angle = angleStep * i - Math.PI / 2;
            return `${center + r * Math.cos(angle)},${center + r * Math.sin(angle)}`;
          });
          return <polygon key={level} points={pts.join(' ')} fill="none" stroke="#E2E8F0" strokeWidth={1} />;
        })}
        {dimensions.map((_, i) => {
          const angle = angleStep * i - Math.PI / 2;
          return (
            <line key={i} x1={center} y1={center} x2={center + radius * Math.cos(angle)} y2={center + radius * Math.sin(angle)} stroke="#E2E8F0" strokeWidth={1} />
          );
        })}
        <defs>
          <linearGradient id="radar-fill-grad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#14B8A6" stopOpacity="0.25" />
            <stop offset="100%" stopColor="#DC2626" stopOpacity="0.15" />
          </linearGradient>
        </defs>
        <motion.polygon
          points={radarPath}
          fill="url(#radar-fill-grad)"
          stroke="#14B8A6"
          strokeWidth={2}
          initial={{ opacity: 0, scale: 0.3 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.8, ease: 'easeOut', delay: 0.4 }}
          style={{ transformOrigin: `${center}px ${center}px` }}
        />
        {radarPoints.map((p, i) => (
          <motion.circle
            key={i}
            cx={p.x} cy={p.y} r={4}
            fill="#14B8A6" stroke="white" strokeWidth={2}
            initial={{ r: 0 }} animate={{ r: 4 }}
            transition={{ delay: 0.8 + i * 0.1, type: 'spring', damping: 12 }}
          />
        ))}
        {dimensions.map((d, i) => {
          const angle = angleStep * i - Math.PI / 2;
          const labelR = radius + 22;
          const x = center + labelR * Math.cos(angle);
          const y = center + labelR * Math.sin(angle);
          const anchor = Math.abs(Math.cos(angle)) < 0.1 ? 'middle' : Math.cos(angle) > 0 ? 'start' : 'end';
          const dy = Math.sin(angle) < -0.5 ? -4 : Math.sin(angle) > 0.5 ? 8 : 2;
          return (
            <text key={i} x={x} y={y + dy} textAnchor={anchor} className="fill-warm-700" fontSize="9" fontWeight="700">
              {d.label}
            </text>
          );
        })}
      </svg>
    </div>
  );
}

// ─── Position Heatmap ─────────────────────────────────────────────

function PositionHeatmap({ position }: { position: string | null }) {
  const pos = (position || 'all-rounder').toLowerCase();
  const isRaider = pos === 'raider';
  const isDefender = pos === 'defender';
  const isAllRounder = pos === 'all-rounder';

  return (
    <div className="flex flex-col items-center gap-2">
      <svg width="280" height="160" viewBox="0 0 280 160">
        <rect x="4" y="4" width="272" height="152" rx="6" fill="#F8FAFC" stroke="#CBD5E1" strokeWidth="2" />
        <line x1="140" y1="4" x2="140" y2="156" stroke="#94A3B8" strokeWidth="1.5" strokeDasharray="6 4" />
        <circle cx="140" cy="80" r="20" fill="none" stroke="#94A3B8" strokeWidth="1.5" />
        <circle cx="140" cy="80" r="3" fill="#94A3B8" />
        <line x1="4" y1="45" x2="136" y2="45" stroke="#CBD5E1" strokeWidth="1" strokeDasharray="4 3" />
        <line x1="144" y1="115" x2="276" y2="115" stroke="#CBD5E1" strokeWidth="1" strokeDasharray="4 3" />
        <line x1="4" y1="65" x2="136" y2="65" stroke="#CBD5E1" strokeWidth="1" strokeDasharray="3 3" />
        <line x1="144" y1="95" x2="276" y2="95" stroke="#CBD5E1" strokeWidth="1" strokeDasharray="3 3" />
        <text x="70" y="90" textAnchor="middle" className="fill-warm-400" fontSize="9" fontWeight="600">DEFENSE</text>
        <text x="210" y="90" textAnchor="middle" className="fill-warm-400" fontSize="9" fontWeight="600">RAID ZONE</text>
        {(isRaider || isAllRounder) && (
          <>
            <motion.rect x="142" y="6" width="132" height="148" rx="4" fill="rgba(220, 38, 38, 0.15)" stroke="rgba(220, 38, 38, 0.4)" strokeWidth="1.5" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.6, delay: 0.5 }} />
            <motion.circle cx="210" cy="55" r="18" fill="rgba(220, 38, 38, 0.25)" initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ delay: 0.7, type: 'spring', damping: 12 }} />
            <motion.circle cx="190" cy="100" r="14" fill="rgba(220, 38, 38, 0.2)" initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ delay: 0.8, type: 'spring', damping: 12 }} />
          </>
        )}
        {(isDefender || isAllRounder) && (
          <>
            <motion.rect x="6" y="6" width="132" height="148" rx="4" fill="rgba(30, 41, 59, 0.12)" stroke="rgba(30, 41, 59, 0.3)" strokeWidth="1.5" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.6, delay: 0.5 }} />
            <motion.circle cx="35" cy="30" r="16" fill="rgba(30, 41, 59, 0.2)" initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ delay: 0.7, type: 'spring', damping: 12 }} />
            <motion.circle cx="35" cy="130" r="16" fill="rgba(30, 41, 59, 0.2)" initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ delay: 0.8, type: 'spring', damping: 12 }} />
          </>
        )}
      </svg>
      <div className="flex items-center gap-4 mt-1">
        {(isRaider || isAllRounder) && (
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-full bg-brand-red/30 border border-brand-red/50" />
            <span className="text-[10px] text-warm-600 dark:text-warm-300 font-medium">Raid Zone</span>
          </div>
        )}
        {(isDefender || isAllRounder) && (
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-full bg-brand-navy/20 border border-brand-navy/40" />
            <span className="text-[10px] text-warm-600 dark:text-warm-300 font-medium">Defense Zone</span>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Simulated match history ─────────────────────────────────────

function generateMatchHistory(profile: PlayerProfileData): MatchHistoryEntry[] {
  const totalPoints = profile.successfulRaids + profile.bonusPoints + profile.successfulTackles;
  const matchCount = Math.max(1, Math.round(totalPoints / 6));
  const opponents = [
    'Warriors FC', 'Royal Titans', 'Storm Riders', 'Thunder Hawks',
    'Phoenix United', 'Dark Panthers', 'Golden Eagles', 'Silver Sharks',
  ];
  const matches: MatchHistoryEntry[] = [];

  for (let i = 0; i < Math.min(10, matchCount); i++) {
    const pts = Math.floor(Math.random() * 8) + 2;
    const teamScore = pts + Math.floor(Math.random() * 15) + 10;
    const oppScore = Math.floor(Math.random() * 25) + 8;
    const result: 'W' | 'L' | 'D' = teamScore > oppScore ? 'W' : teamScore < oppScore ? 'L' : 'D';
    const half1Pts = Math.floor(Math.random() * pts);
    const half2Pts = pts - half1Pts;

    matches.push({
      id: `match_${i}`,
      opponent: opponents[i % opponents.length],
      score: `${teamScore}-${oppScore}`,
      playerPoints: pts,
      result,
      half1Points: half1Pts,
      half2Points: half2Pts,
      type: i % 3 === 0 ? 'practice' : 'tournament',
    });
  }

  return matches;
}

function generateRaidTrend(profile: PlayerProfileData): number[] {
  if (profile.totalRaids === 0) return [0, 0, 0, 0, 0];
  const avg = profile.successfulRaids / Math.max(1, profile.totalRaids) * 100;
  return Array.from({ length: 5 }, () =>
    Math.max(0, Math.min(100, avg + (Math.random() - 0.5) * 30))
  );
}

function generateTackleTrend(profile: PlayerProfileData): number[] {
  if (profile.totalTackles === 0) return [0, 0, 0, 0, 0];
  const avg = profile.successfulTackles / Math.max(1, profile.totalTackles) * 100;
  return Array.from({ length: 5 }, () =>
    Math.max(0, Math.min(100, avg + (Math.random() - 0.5) * 25))
  );
}

function generatePointsPerMatch(matchHistory: MatchHistoryEntry[]): number[] {
  return matchHistory.map((m) => m.playerPoints);
}

// ─── Main Component ───────────────────────────────────────────────

export default function AdvancedStatsScreen({ userId, onClose }: AdvancedStatsScreenProps) {
  const currentUser = useKabaddiStore((s) => s.currentUser);
  const [user, setUser] = useState<PlayerUser | null>(null);
  const [profile, setProfile] = useState<PlayerProfileData | null>(null);
  const [loading, setLoading] = useState(true);

  // Filters
  const [timePeriod, setTimePeriod] = useState<TimePeriod>('last10');
  const [matchType, setMatchType] = useState<MatchType>('all');
  const [genderFilter, setGenderFilter] = useState<GenderFilter>('all');
  const [showFilters, setShowFilters] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/players/${userId}`);
        if (!res.ok) throw new Error('Failed to fetch');
        const data = await res.json();
        const playerData = data.player || data.user;
        const profileData = data.profile;

        setUser({
          id: playerData?.id || userId,
          name: playerData?.name || 'Player',
          avatar: playerData?.avatar || null,
          gender: playerData?.gender,
        });

        setProfile({
          jerseyNumber: profileData?.jerseyNumber ?? null,
          position: profileData?.position ?? null,
          overallRating: profileData?.overallRating ?? 0,
          totalRaids: profileData?.totalRaids ?? 0,
          successfulRaids: profileData?.successfulRaids ?? 0,
          totalTackles: profileData?.totalTackles ?? 0,
          successfulTackles: profileData?.successfulTackles ?? 0,
          bonusPoints: profileData?.bonusPoints ?? 0,
          superTackles: profileData?.superTackles ?? 0,
          playerOfMonth: profileData?.playerOfMonth ?? 0,
          playerOfYear: profileData?.playerOfYear ?? 0,
        });
      } catch (err) {
        console.error('AdvancedStats fetch error:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [userId]);

  // ─── Derived stats ──────────────────────────────────────────

  const derivedStats = useMemo(() => {
    if (!profile) return null;
    const p = profile;

    const totalPoints = p.successfulRaids + p.bonusPoints + p.successfulTackles + p.superTackles;
    const matchCount = Math.max(1, Math.round(totalPoints / 6));
    const avgPoints = totalPoints / matchCount;
    const raidSuccessRate = p.totalRaids > 0 ? (p.successfulRaids / p.totalRaids) * 100 : 0;
    const tackleSuccessRate = p.totalTackles > 0 ? (p.successfulTackles / p.totalTackles) * 100 : 0;
    const failedRaids = p.totalRaids - p.successfulRaids;
    const failedTackles = p.totalTackles - p.successfulTackles;

    // Detailed breakdown stats
    const superRaidFreq = matchCount > 0 ? ((p.successfulRaids > 2 ? 1 : 0) / matchCount) * 100 : 0;
    const doOrDieRate = raidSuccessRate * 0.65; // Simulated
    const allOutRate = matchCount > 0 ? (p.superTackles * 2 / matchCount) * 10 : 0;
    const bonusEfficiency = p.totalRaids > 0 ? (p.bonusPoints / p.totalRaids) * 100 : 0;
    const avgPointsPerRaid = p.totalRaids > 0 ? (p.successfulRaids / p.totalRaids) : 0;
    const raidTackleRatio = p.totalTackles > 0 ? p.totalRaids / p.totalTackles : 0;

    // Performance by half
    const matchHistory = generateMatchHistory(p);
    const avgH1 = matchHistory.length > 0 ? matchHistory.reduce((s, m) => s + m.half1Points, 0) / matchHistory.length : 0;
    const avgH2 = matchHistory.length > 0 ? matchHistory.reduce((s, m) => s + m.half2Points, 0) / matchHistory.length : 0;

    // Performance by position
    const isRaider = (p.position || '').toLowerCase() === 'raider';
    const isDefender = (p.position || '').toLowerCase() === 'defender';
    const raiderPts = isRaider || !isDefender ? p.successfulRaids + p.bonusPoints : Math.floor(p.successfulRaids * 0.3);
    const defenderPts = isDefender || !isRaider ? p.successfulTackles + p.superTackles : Math.floor(p.successfulTackles * 0.3);

    // Radar dimensions
    const radarDimensions = [
      { label: 'Raiding', value: Math.min(100, raidSuccessRate * 1.1) },
      { label: 'Defense', value: Math.min(100, tackleSuccessRate * 1.15) },
      { label: 'Bonus', value: Math.min(100, p.bonusPoints * 5) },
      { label: 'Super Plays', value: Math.min(100, p.superTackles * 12) },
      { label: 'Consistency', value: Math.min(100, p.overallRating) },
    ];

    const raidTrend = generateRaidTrend(p);
    const tackleTrend = generateTackleTrend(p);
    const pointsPerMatch = generatePointsPerMatch(matchHistory);

    // Comparison: League Average (simulated)
    const leagueAvgRaidRate = 45;
    const leagueAvgTackleRate = 40;
    const leagueAvgPtsPerMatch = 5.2;

    // Comparison: Top Player (simulated)
    const topPlayerRaidRate = 75;
    const topPlayerTackleRate = 68;
    const topPlayerPtsPerMatch = 9.5;

    // Percentiles (simulated based on stats)
    const raidPercentile = Math.min(99, Math.max(5, Math.round(raidSuccessRate * 1.2)));
    const tacklePercentile = Math.min(99, Math.max(5, Math.round(tackleSuccessRate * 1.15)));
    const bonusPercentile = Math.min(99, Math.max(5, Math.round(bonusEfficiency * 1.5)));
    const consistencyPercentile = Math.min(99, Math.max(5, p.overallRating));

    // Strengths & Weaknesses
    const strengths: string[] = [];
    const weaknesses: string[] = [];
    if (raidSuccessRate > 55) strengths.push('Raid Efficiency');
    else if (raidSuccessRate < 35) weaknesses.push('Raid Efficiency');
    if (tackleSuccessRate > 50) strengths.push('Tackle Strength');
    else if (tackleSuccessRate < 30) weaknesses.push('Tackle Strength');
    if (bonusEfficiency > 15) strengths.push('Bonus Point Hunting');
    if (p.superTackles > 3) strengths.push('Super Tackle Ability');
    if (raidSuccessRate < 40 && tackleSuccessRate < 35) weaknesses.push('Overall Consistency');
    if (avgPoints < 4) weaknesses.push('Low Scoring Output');
    if (strengths.length === 0) strengths.push('Balanced Playstyle');

    // Filter match history based on filters
    let filteredHistory = matchHistory;
    if (matchType !== 'all') {
      filteredHistory = filteredHistory.filter((m) => m.type === matchType);
    }
    if (timePeriod === 'last5') {
      filteredHistory = filteredHistory.slice(0, 5);
    } else if (timePeriod === 'last10') {
      filteredHistory = filteredHistory.slice(0, 10);
    }

    return {
      totalPoints,
      matchCount,
      avgPoints,
      raidSuccessRate,
      tackleSuccessRate,
      failedRaids,
      failedTackles,
      superRaidFreq,
      doOrDieRate,
      allOutRate,
      bonusEfficiency,
      avgPointsPerRaid,
      raidTackleRatio,
      avgH1,
      avgH2,
      raiderPts,
      defenderPts,
      radarDimensions,
      matchHistory: filteredHistory,
      allMatchHistory: matchHistory,
      raidTrend,
      tackleTrend,
      pointsPerMatch,
      leagueAvgRaidRate,
      leagueAvgTackleRate,
      leagueAvgPtsPerMatch,
      topPlayerRaidRate,
      topPlayerTackleRate,
      topPlayerPtsPerMatch,
      raidPercentile,
      tacklePercentile,
      bonusPercentile,
      consistencyPercentile,
      strengths,
      weaknesses,
    };
  }, [profile, timePeriod, matchType, genderFilter]);

  const getInitials = (name: string | null | undefined) => {
    if (!name) return '?';
    const parts = name.trim().split(/\s+/);
    if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
    return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
  };

  const getResultColor = (result: string) => {
    switch (result) {
      case 'W': return 'bg-green-500 text-white';
      case 'L': return 'bg-brand-red text-white';
      case 'D': return 'bg-warm-400 text-white';
      default: return 'bg-warm-300 text-warm-700';
    }
  };

  // ─── Loading state ──────────────────────────────────────────

  if (loading) {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="fixed inset-0 z-50 bg-warm-50 dark:bg-warm-900 flex flex-col"
      >
        <header className="sticky top-0 z-10 bg-warm-50/90 backdrop-blur-md border-b border-warm-200/60">
          <div className="px-4 py-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-brand-teal to-brand-teal-dark flex items-center justify-center">
                <BarChart3 className="w-4 h-4 text-white" />
              </div>
              <h1 className="text-base font-black tracking-wider text-warm-800 dark:text-warm-100">ADVANCED STATS</h1>
            </div>
            <button onClick={onClose} className="w-8 h-8 rounded-full bg-warm-200 flex items-center justify-center text-warm-600">
              <X className="w-4 h-4" />
            </button>
          </div>
        </header>
        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="h-40 rounded-2xl skeleton-shimmer" />
          ))}
        </div>
      </motion.div>
    );
  }

  if (!profile || !derivedStats) {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="fixed inset-0 z-50 bg-warm-50 dark:bg-warm-900 flex flex-col items-center justify-center gap-4"
      >
        <BarChart3 className="w-12 h-12 text-warm-300" />
        <p className="text-warm-600 dark:text-warm-300 font-medium">No stats data available</p>
        <button onClick={onClose} className="px-4 py-2 rounded-xl bg-brand-teal text-white font-bold text-sm">
          Go Back
        </button>
      </motion.div>
    );
  }

  // ─── Render ─────────────────────────────────────────────────

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 bg-warm-50 dark:bg-warm-900 flex flex-col"
    >
      {/* Header */}
      <header className="sticky top-0 z-10 bg-warm-50/90 backdrop-blur-md border-b border-warm-200/60">
        <div className="px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-brand-teal to-brand-teal-dark flex items-center justify-center">
              <BarChart3 className="w-4 h-4 text-white" />
            </div>
            <h1 className="text-base font-black tracking-wider text-warm-800 dark:text-warm-100">ADVANCED STATS</h1>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowFilters(!showFilters)}
              className={`w-8 h-8 rounded-full flex items-center justify-center transition-colors ${
                showFilters ? 'bg-brand-teal text-white' : 'bg-warm-200 text-warm-600'
              }`}
            >
              <Filter className="w-4 h-4" />
            </button>
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-full bg-warm-200 flex items-center justify-center text-warm-600 hover:bg-warm-300 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Filter Panel */}
        <AnimatePresence>
          {showFilters && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.25 }}
              className="overflow-hidden border-t border-warm-200/60"
            >
              <div className="px-4 py-3 space-y-3 bg-warm-50/95">
                {/* Time Period */}
                <div>
                  <p className="text-[10px] font-bold text-warm-500 uppercase tracking-wider mb-1.5">Time Period</p>
                  <div className="flex gap-1.5">
                    {([['last5', 'Last 5'], ['last10', 'Last 10'], ['allTime', 'All Time']] as const).map(([val, label]) => (
                      <button
                        key={val}
                        onClick={() => setTimePeriod(val)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                          timePeriod === val
                            ? 'bg-brand-teal text-white'
                            : 'bg-warm-100 dark:bg-warm-800 text-warm-600 hover:bg-warm-200'
                        }`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </div>
                {/* Match Type */}
                <div>
                  <p className="text-[10px] font-bold text-warm-500 uppercase tracking-wider mb-1.5">Match Type</p>
                  <div className="flex gap-1.5">
                    {([['all', 'All'], ['tournament', 'Tournament'], ['practice', 'Practice']] as const).map(([val, label]) => (
                      <button
                        key={val}
                        onClick={() => setMatchType(val)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                          matchType === val
                            ? 'bg-brand-navy text-white'
                            : 'bg-warm-100 dark:bg-warm-800 text-warm-600 hover:bg-warm-200'
                        }`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </div>
                {/* Gender Filter */}
                <div>
                  <p className="text-[10px] font-bold text-warm-500 uppercase tracking-wider mb-1.5">Gender</p>
                  <div className="flex gap-1.5">
                    {([['all', 'All'], ['male', 'Male'], ['female', 'Female']] as const).map(([val, label]) => (
                      <button
                        key={val}
                        onClick={() => setGenderFilter(val)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all gender-pill ${
                          genderFilter === val
                            ? 'bg-brand-red text-white'
                            : 'bg-warm-100 dark:bg-warm-800 text-warm-600 hover:bg-warm-200'
                        }`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </header>

      {/* Content */}
      <div className="flex-1 overflow-y-auto custom-scrollbar px-4 py-4">
        <motion.div
          className="space-y-4"
          variants={containerVariants}
          initial="hidden"
          animate="visible"
        >
          {/* ── Player Info Bar ──────────────────────────────── */}
          <motion.div variants={itemVariants}>
            <Card className="p-4 border-0 bg-gradient-to-r from-brand-navy to-brand-navy-light">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-full bg-white/10 border-2 border-brand-teal flex items-center justify-center overflow-hidden shrink-0">
                  {user?.avatar ? (
                    <img src={user.avatar} alt={user.name} className="w-full h-full object-cover" />
                  ) : (
                    <span className="text-brand-teal font-bold text-lg">{getInitials(user?.name)}</span>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-white font-bold truncate">{user?.name || 'Player'}</p>
                  <div className="flex items-center gap-2 mt-0.5">
                    {profile.jerseyNumber && (
                      <Badge className="bg-brand-teal/20 text-brand-teal-light text-[10px] border-0 font-bold">
                        #{profile.jerseyNumber}
                      </Badge>
                    )}
                    <Badge className="bg-white/10 text-white/80 text-[10px] border-0 font-semibold capitalize">
                      {profile.position || 'Player'}
                    </Badge>
                    {(currentUser?.isPremium || currentUser?.isAdmin) && (
                      <Badge className="bg-brand-gold/20 text-brand-gold-light text-[10px] border-0 font-bold">
                        <Zap className="w-2.5 h-2.5 mr-0.5" /> PREMIUM
                      </Badge>
                    )}
                  </div>
                </div>
              </div>
            </Card>
          </motion.div>

          {/* ── Performance Overview ──────────────────────────── */}
          <motion.div variants={itemVariants}>
            <Card className="p-5 border-warm-200/60 glass-stat-card">
              <div className="flex items-center gap-2 mb-4">
                <div className="w-6 h-6 rounded-md bg-brand-teal/10 flex items-center justify-center">
                  <Activity className="w-3.5 h-3.5 text-brand-teal" />
                </div>
                <h2 className="text-sm font-black tracking-wider text-warm-800 dark:text-warm-100">PERFORMANCE OVERVIEW</h2>
              </div>
              <div className="flex items-center gap-6">
                <CircularGauge value={profile.overallRating} max={100} size={110} strokeWidth={9} color="#14B8A6" label="Rating" />
                <div className="flex-1 space-y-3">
                  <div>
                    <p className="text-[10px] text-warm-500 font-semibold uppercase tracking-wide">Total Points</p>
                    <p className="text-xl font-black text-warm-800 dark:text-warm-100 stat-counter">{derivedStats.totalPoints}</p>
                  </div>
                  <div className="flex items-center gap-4">
                    <div>
                      <p className="text-[10px] text-warm-500 font-semibold uppercase tracking-wide">Matches</p>
                      <p className="text-lg font-bold text-warm-700 dark:text-warm-200 stat-counter">{derivedStats.matchCount}</p>
                    </div>
                    <div>
                      <p className="text-[10px] text-warm-500 font-semibold uppercase tracking-wide">Avg Pts/Match</p>
                      <p className="text-lg font-bold text-warm-700 dark:text-warm-200 stat-counter">{derivedStats.avgPoints.toFixed(1)}</p>
                    </div>
                  </div>
                </div>
              </div>
            </Card>
          </motion.div>

          {/* ── Performance Trends (Premium) ─────────────── */}
          <motion.div variants={itemVariants}>
            <PremiumLock feature="Performance Trends">
              <Card className="p-5 border-warm-200/60">
                <div className="flex items-center gap-2 mb-4">
                  <div className="w-6 h-6 rounded-md bg-brand-teal/10 flex items-center justify-center">
                    <TrendingUp className="w-3.5 h-3.5 text-brand-teal" />
                  </div>
                  <h2 className="text-sm font-black tracking-wider text-warm-800 dark:text-warm-100">PERFORMANCE TRENDS</h2>
                  <Badge className="bg-brand-teal/10 text-brand-teal text-[9px] border-0 font-bold ml-auto">
                    <Zap className="w-2.5 h-2.5 mr-0.5" /> PREMIUM
                  </Badge>
                </div>

                {/* Raid Success Rate over time */}
                <div className="chart-container mb-4">
                  <p className="text-[10px] text-warm-500 font-bold uppercase tracking-wide mb-2">Raid Success Rate Over Time</p>
                  <MiniLineChart data={derivedStats.raidTrend} color="#DC2626" height={60} width={280} />
                  <div className="flex gap-4 mt-1">
                    {['M1', 'M2', 'M3', 'M4', 'M5'].map((l) => (
                      <span key={l} className="flex-1 text-center text-[8px] text-warm-400 font-medium">{l}</span>
                    ))}
                  </div>
                </div>

                {/* Tackle Success Rate over time */}
                <div className="chart-container mb-4">
                  <p className="text-[10px] text-warm-500 font-bold uppercase tracking-wide mb-2">Tackle Success Rate Over Time</p>
                  <MiniLineChart data={derivedStats.tackleTrend} color="#1E293B" height={60} width={280} />
                  <div className="flex gap-4 mt-1">
                    {['M1', 'M2', 'M3', 'M4', 'M5'].map((l) => (
                      <span key={l} className="flex-1 text-center text-[8px] text-warm-400 font-medium">{l}</span>
                    ))}
                  </div>
                </div>

                {/* Points per match trend */}
                <div className="chart-container">
                  <p className="text-[10px] text-warm-500 font-bold uppercase tracking-wide mb-2">Points Per Match Trend</p>
                  <div className="flex items-end gap-1.5 h-16">
                    {derivedStats.pointsPerMatch.map((val, i) => (
                      <motion.div
                        key={i}
                        className="flex-1 rounded-t-sm relative overflow-hidden"
                        style={{ background: `linear-gradient(180deg, rgba(20, 184, 166, 0.4), rgba(20, 184, 166, 0.1))` }}
                        initial={{ height: 0 }}
                        animate={{ height: `${Math.max(10, (val / 10) * 100)}%` }}
                        transition={{ duration: 0.5, delay: 0.3 + i * 0.08 }}
                      >
                        <div className="absolute bottom-0 inset-x-0 bg-brand-teal/60 rounded-t-sm" style={{ height: '50%' }} />
                      </motion.div>
                    ))}
                  </div>
                </div>
              </Card>
            </PremiumLock>
          </motion.div>

          {/* ── Performance by Half (Premium) ─────────────── */}
          <motion.div variants={itemVariants}>
            <PremiumLock feature="Half Comparison">
              <Card className="p-5 border-warm-200/60">
                <div className="flex items-center gap-2 mb-4">
                  <div className="w-6 h-6 rounded-md bg-brand-red/10 flex items-center justify-center">
                    <Clock className="w-3.5 h-3.5 text-brand-red" />
                  </div>
                  <h2 className="text-sm font-black tracking-wider text-warm-800 dark:text-warm-100">HALF COMPARISON</h2>
                  <Badge className="bg-brand-red/10 text-brand-red text-[9px] border-0 font-bold ml-auto">
                    <Zap className="w-2.5 h-2.5 mr-0.5" /> PREMIUM
                  </Badge>
                </div>
                <div className="flex items-center gap-6">
                  <div className="flex-1 text-center">
                    <CircularGauge value={derivedStats.avgH1} max={10} size={80} strokeWidth={7} color="#DC2626" label="1st Half">
                      <span className="text-base font-black text-brand-red">{derivedStats.avgH1.toFixed(1)}</span>
                      <span className="text-[8px] font-semibold text-warm-500 uppercase tracking-wide">1st Half</span>
                    </CircularGauge>
                  </div>
                  <div className="flex flex-col items-center gap-1">
                    <span className="text-[10px] text-warm-400 font-bold">vs</span>
                    {derivedStats.avgH1 > derivedStats.avgH2 ? (
                      <TrendingUp className="w-4 h-4 text-brand-red" />
                    ) : derivedStats.avgH1 < derivedStats.avgH2 ? (
                      <TrendingDown className="w-4 h-4 text-brand-teal" />
                    ) : (
                      <Minus className="w-4 h-4 text-warm-400" />
                    )}
                  </div>
                  <div className="flex-1 text-center">
                    <CircularGauge value={derivedStats.avgH2} max={10} size={80} strokeWidth={7} color="#14B8A6" label="2nd Half">
                      <span className="text-base font-black text-brand-teal">{derivedStats.avgH2.toFixed(1)}</span>
                      <span className="text-[8px] font-semibold text-warm-500 uppercase tracking-wide">2nd Half</span>
                    </CircularGauge>
                  </div>
                </div>
              </Card>
            </PremiumLock>
          </motion.div>

          {/* ── Performance by Position (Premium) ─────────── */}
          <motion.div variants={itemVariants}>
            <PremiumLock feature="Position Stats">
              <Card className="p-5 border-warm-200/60">
                <div className="flex items-center gap-2 mb-4">
                  <div className="w-6 h-6 rounded-md bg-brand-gold/10 flex items-center justify-center">
                    <Users className="w-3.5 h-3.5 text-brand-gold" />
                  </div>
                  <h2 className="text-sm font-black tracking-wider text-warm-800 dark:text-warm-100">POSITION STATS</h2>
                  <Badge className="bg-brand-gold/10 text-brand-gold text-[9px] border-0 font-bold ml-auto">
                    <Zap className="w-2.5 h-2.5 mr-0.5" /> PREMIUM
                  </Badge>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="stat-card text-center">
                    <Swords className="w-5 h-5 text-brand-red mx-auto mb-1" />
                    <p className="text-[10px] text-warm-500 font-bold uppercase tracking-wide">Raider Pts</p>
                    <p className="text-xl font-black text-brand-red stat-counter">{derivedStats.raiderPts}</p>
                  </div>
                  <div className="stat-card text-center">
                    <Shield className="w-5 h-5 text-brand-navy mx-auto mb-1" />
                    <p className="text-[10px] text-warm-500 font-bold uppercase tracking-wide">Defender Pts</p>
                    <p className="text-xl font-black text-brand-navy stat-counter">{derivedStats.defenderPts}</p>
                  </div>
                </div>
              </Card>
            </PremiumLock>
          </motion.div>

          {/* ── Detailed Breakdown (Premium) ─────────────── */}
          <motion.div variants={itemVariants}>
            <PremiumLock feature="Detailed Breakdown">
              <Card className="p-5 border-warm-200/60">
                <div className="flex items-center gap-2 mb-4">
                  <div className="w-6 h-6 rounded-md bg-brand-navy/10 flex items-center justify-center">
                    <Target className="w-3.5 h-3.5 text-brand-navy" />
                  </div>
                  <h2 className="text-sm font-black tracking-wider text-warm-800 dark:text-warm-100">DETAILED BREAKDOWN</h2>
                  <Badge className="bg-brand-navy/10 text-brand-navy text-[9px] border-0 font-bold ml-auto">
                    <Zap className="w-2.5 h-2.5 mr-0.5" /> PREMIUM
                  </Badge>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  {[
                    { label: 'Super Raid Freq', value: `${derivedStats.superRaidFreq.toFixed(0)}%`, color: 'text-brand-red' },
                    { label: 'Do-or-Die Rate', value: `${derivedStats.doOrDieRate.toFixed(0)}%`, color: 'text-brand-gold-dark' },
                    { label: 'All Out Rate', value: `${derivedStats.allOutRate.toFixed(0)}%`, color: 'text-brand-navy' },
                    { label: 'Bonus Efficiency', value: `${derivedStats.bonusEfficiency.toFixed(0)}%`, color: 'text-brand-teal' },
                    { label: 'Avg Pts/Raid', value: derivedStats.avgPointsPerRaid.toFixed(2), color: 'text-brand-red' },
                    { label: 'Raid/Tackle Ratio', value: derivedStats.raidTackleRatio.toFixed(2), color: 'text-brand-navy' },
                  ].map((item) => (
                    <div key={item.label} className="stat-card text-center">
                      <p className="text-[9px] text-warm-500 font-bold uppercase tracking-wide">{item.label}</p>
                      <p className={`text-lg font-black stat-counter ${item.color}`}>{item.value}</p>
                    </div>
                  ))}
                </div>
              </Card>
            </PremiumLock>
          </motion.div>

          {/* ── Raid Analysis (Premium) ────────────────────── */}
          <motion.div variants={itemVariants}>
            <PremiumLock feature="Raid Analysis">
              <Card className="p-5 border-warm-200/60">
                <div className="flex items-center gap-2 mb-4">
                  <div className="w-6 h-6 rounded-md bg-brand-red/10 flex items-center justify-center">
                    <Swords className="w-3.5 h-3.5 text-brand-red" />
                  </div>
                  <h2 className="text-sm font-black tracking-wider text-warm-800 dark:text-warm-100">RAID ANALYSIS</h2>
                  <Badge className="bg-brand-red/10 text-brand-red text-[9px] border-0 font-bold ml-auto">
                    <Zap className="w-2.5 h-2.5 mr-0.5" /> PREMIUM
                  </Badge>
                </div>
                <div className="flex items-start gap-5">
                  <CircularGauge value={derivedStats.raidSuccessRate} max={100} size={90} strokeWidth={7} color="#DC2626" label="Success">
                    <span className="text-base font-black text-brand-red">{derivedStats.raidSuccessRate.toFixed(1)}%</span>
                    <span className="text-[8px] font-semibold text-warm-500 uppercase tracking-wide">Success</span>
                  </CircularGauge>
                  <div className="flex-1 space-y-3">
                    <div>
                      <p className="text-[10px] text-warm-500 font-semibold uppercase tracking-wide mb-1.5">Raid Pts/Match Trend</p>
                      <div className="flex items-end gap-1.5 h-10">
                        {derivedStats.raidTrend.map((val, i) => (
                          <motion.div
                            key={i}
                            className="flex-1 bg-brand-red/20 rounded-t-sm relative overflow-hidden"
                            initial={{ height: 0 }}
                            animate={{ height: `${Math.max(10, (val / 100) * 100)}%` }}
                            transition={{ duration: 0.5, delay: 0.3 + i * 0.1 }}
                          >
                            <div className="absolute bottom-0 inset-x-0 bg-brand-red/60 rounded-t-sm" style={{ height: '60%' }} />
                          </motion.div>
                        ))}
                      </div>
                    </div>
                    <div>
                      <div className="flex items-center justify-between text-[10px] mb-1">
                        <span className="text-warm-500 font-semibold uppercase tracking-wide">Raids Breakdown</span>
                        <span className="text-warm-400">{profile.successfulRaids}S / {derivedStats.failedRaids}F</span>
                      </div>
                      <div className="h-3 bg-warm-200 rounded-full overflow-hidden flex">
                        <motion.div
                          className="h-full bg-brand-red"
                          initial={{ width: 0 }}
                          animate={{ width: profile.totalRaids > 0 ? `${(profile.successfulRaids / profile.totalRaids) * 100}%` : '0%' }}
                          transition={{ duration: 0.8, ease: 'easeOut', delay: 0.5 }}
                        />
                        <motion.div
                          className="h-full bg-warm-300"
                          initial={{ width: 0 }}
                          animate={{ width: profile.totalRaids > 0 ? `${(derivedStats.failedRaids / profile.totalRaids) * 100}%` : '0%' }}
                          transition={{ duration: 0.8, ease: 'easeOut', delay: 0.6 }}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </Card>
            </PremiumLock>
          </motion.div>

          {/* ── Defense Analysis (Premium) ────────────────────── */}
          <motion.div variants={itemVariants}>
            <PremiumLock feature="Defense Analysis">
              <Card className="p-5 border-warm-200/60">
                <div className="flex items-center gap-2 mb-4">
                  <div className="w-6 h-6 rounded-md bg-brand-navy/10 flex items-center justify-center">
                    <Shield className="w-3.5 h-3.5 text-brand-navy" />
                  </div>
                  <h2 className="text-sm font-black tracking-wider text-warm-800 dark:text-warm-100">DEFENSE ANALYSIS</h2>
                  <Badge className="bg-brand-navy/10 text-brand-navy text-[9px] border-0 font-bold ml-auto">
                    <Zap className="w-2.5 h-2.5 mr-0.5" /> PREMIUM
                  </Badge>
                </div>
                <div className="flex items-start gap-5">
                  <CircularGauge value={derivedStats.tackleSuccessRate} max={100} size={90} strokeWidth={7} color="#1E293B" label="Success">
                    <span className="text-base font-black text-brand-navy">{derivedStats.tackleSuccessRate.toFixed(1)}%</span>
                    <span className="text-[8px] font-semibold text-warm-500 uppercase tracking-wide">Success</span>
                  </CircularGauge>
                  <div className="flex-1 space-y-3">
                    <div className="flex items-center gap-3 p-2.5 rounded-xl bg-brand-gold/10 border border-brand-gold/20">
                      <div className="w-8 h-8 rounded-lg bg-brand-gold/20 flex items-center justify-center">
                        <Star className="w-4 h-4 text-brand-gold" />
                      </div>
                      <div>
                        <p className="text-[10px] text-warm-500 font-semibold uppercase tracking-wide">Super Tackles</p>
                        <p className="text-lg font-black text-brand-gold-dark stat-counter">{profile.superTackles}</p>
                      </div>
                    </div>
                    <div>
                      <div className="flex items-center justify-between text-[10px] mb-1">
                        <span className="text-warm-500 font-semibold uppercase tracking-wide">Tackles Breakdown</span>
                        <span className="text-warm-400">{profile.successfulTackles}S / {derivedStats.failedTackles}F</span>
                      </div>
                      <div className="h-3 bg-warm-200 rounded-full overflow-hidden flex">
                        <motion.div
                          className="h-full bg-brand-navy"
                          initial={{ width: 0 }}
                          animate={{ width: profile.totalTackles > 0 ? `${(profile.successfulTackles / profile.totalTackles) * 100}%` : '0%' }}
                          transition={{ duration: 0.8, ease: 'easeOut', delay: 0.5 }}
                        />
                        <motion.div
                          className="h-full bg-warm-300"
                          initial={{ width: 0 }}
                          animate={{ width: profile.totalTackles > 0 ? `${(derivedStats.failedTackles / profile.totalTackles) * 100}%` : '0%' }}
                          transition={{ duration: 0.8, ease: 'easeOut', delay: 0.6 }}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </Card>
            </PremiumLock>
          </motion.div>

          {/* ── Skill Radar (Premium) ─────────────────────────── */}
          <motion.div variants={itemVariants}>
            <PremiumLock feature="Skill Radar">
              <Card className="p-5 border-warm-200/60">
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-6 h-6 rounded-md bg-brand-teal/10 flex items-center justify-center">
                    <Target className="w-3.5 h-3.5 text-brand-teal" />
                  </div>
                  <h2 className="text-sm font-black tracking-wider text-warm-800 dark:text-warm-100">SKILL RADAR</h2>
                  <Badge className="bg-brand-teal/10 text-brand-teal text-[9px] border-0 font-bold ml-auto">
                    <Zap className="w-2.5 h-2.5 mr-0.5" /> PREMIUM
                  </Badge>
                </div>
                <SkillRadar dimensions={derivedStats.radarDimensions} />
                <div className="grid grid-cols-5 gap-1 mt-3">
                  {derivedStats.radarDimensions.map((d) => (
                    <div key={d.label} className="text-center">
                      <p className="text-xs font-bold text-brand-teal">{d.value.toFixed(0)}</p>
                      <p className="text-[8px] text-warm-500 font-medium">{d.label}</p>
                    </div>
                  ))}
                </div>
              </Card>
            </PremiumLock>
          </motion.div>

          {/* ── Comparison (Premium) ───────────────────────── */}
          <motion.div variants={itemVariants}>
            <PremiumLock feature="League Comparison">
              <Card className="p-5 border-warm-200/60">
                <div className="flex items-center gap-2 mb-4">
                  <div className="w-6 h-6 rounded-md bg-brand-gold/10 flex items-center justify-center">
                    <Trophy className="w-3.5 h-3.5 text-brand-gold" />
                  </div>
                  <h2 className="text-sm font-black tracking-wider text-warm-800 dark:text-warm-100">VS LEAGUE AVERAGE</h2>
                  <Badge className="bg-brand-gold/10 text-brand-gold text-[9px] border-0 font-bold ml-auto">
                    <Zap className="w-2.5 h-2.5 mr-0.5" /> PREMIUM
                  </Badge>
                </div>

                <div className="space-y-4">
                  <ComparisonBar
                    label="Raid Success Rate"
                    playerValue={derivedStats.raidSuccessRate}
                    compareValue={derivedStats.leagueAvgRaidRate}
                    color="#DC2626"
                  />
                  <ComparisonBar
                    label="Tackle Success Rate"
                    playerValue={derivedStats.tackleSuccessRate}
                    compareValue={derivedStats.leagueAvgTackleRate}
                    color="#1E293B"
                  />
                  <ComparisonBar
                    label="Avg Points/Match"
                    playerValue={derivedStats.avgPoints}
                    compareValue={derivedStats.leagueAvgPtsPerMatch}
                    color="#14B8A6"
                  />
                </div>
              </Card>
            </PremiumLock>
          </motion.div>

          {/* ── VS Top Player (Premium) ─────────────────── */}
          <motion.div variants={itemVariants}>
            <PremiumLock feature="Top Player Comparison">
              <Card className="p-5 border-warm-200/60">
                <div className="flex items-center gap-2 mb-4">
                  <div className="w-6 h-6 rounded-md bg-brand-gold/15 flex items-center justify-center">
                    <Star className="w-3.5 h-3.5 text-brand-gold" />
                  </div>
                  <h2 className="text-sm font-black tracking-wider text-warm-800 dark:text-warm-100">VS TOP PLAYER</h2>
                  <Badge className="bg-brand-gold/15 text-brand-gold-dark text-[9px] border-0 font-bold ml-auto">
                    <Zap className="w-2.5 h-2.5 mr-0.5" /> PREMIUM
                  </Badge>
                </div>

                <div className="space-y-4">
                  <ComparisonBar
                    label="Raid Success Rate"
                    playerValue={derivedStats.raidSuccessRate}
                    compareValue={derivedStats.topPlayerRaidRate}
                    playerLabel="You"
                    compareLabel="Top"
                    color="#14B8A6"
                  />
                  <ComparisonBar
                    label="Tackle Success Rate"
                    playerValue={derivedStats.tackleSuccessRate}
                    compareValue={derivedStats.topPlayerTackleRate}
                    playerLabel="You"
                    compareLabel="Top"
                    color="#14B8A6"
                  />
                  <ComparisonBar
                    label="Avg Points/Match"
                    playerValue={derivedStats.avgPoints}
                    compareValue={derivedStats.topPlayerPtsPerMatch}
                    playerLabel="You"
                    compareLabel="Top"
                    color="#14B8A6"
                  />
                </div>
              </Card>
            </PremiumLock>
          </motion.div>

          {/* ── Percentile Ranking (Premium) ──────────────── */}
          <motion.div variants={itemVariants}>
            <PremiumLock feature="Percentile Ranking">
              <Card className="p-5 border-warm-200/60">
                <div className="flex items-center gap-2 mb-4">
                  <div className="w-6 h-6 rounded-md bg-brand-teal/10 flex items-center justify-center">
                    <BarChart3 className="w-3.5 h-3.5 text-brand-teal" />
                  </div>
                  <h2 className="text-sm font-black tracking-wider text-warm-800 dark:text-warm-100">PERCENTILE RANKING</h2>
                  <Badge className="bg-brand-teal/10 text-brand-teal text-[9px] border-0 font-bold ml-auto">
                    <Zap className="w-2.5 h-2.5 mr-0.5" /> PREMIUM
                  </Badge>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="stat-card flex flex-col items-center gap-1.5">
                    <p className="text-[10px] text-warm-500 font-bold uppercase tracking-wide">Raid Success</p>
                    <PercentileBadge value={derivedStats.raidPercentile} />
                  </div>
                  <div className="stat-card flex flex-col items-center gap-1.5">
                    <p className="text-[10px] text-warm-500 font-bold uppercase tracking-wide">Tackle Success</p>
                    <PercentileBadge value={derivedStats.tacklePercentile} />
                  </div>
                  <div className="stat-card flex flex-col items-center gap-1.5">
                    <p className="text-[10px] text-warm-500 font-bold uppercase tracking-wide">Bonus Efficiency</p>
                    <PercentileBadge value={derivedStats.bonusPercentile} />
                  </div>
                  <div className="stat-card flex flex-col items-center gap-1.5">
                    <p className="text-[10px] text-warm-500 font-bold uppercase tracking-wide">Consistency</p>
                    <PercentileBadge value={derivedStats.consistencyPercentile} />
                  </div>
                </div>
              </Card>
            </PremiumLock>
          </motion.div>

          {/* ── Strengths & Weaknesses (Premium) ──────────── */}
          <motion.div variants={itemVariants}>
            <PremiumLock feature="Strengths & Weaknesses">
              <Card className="p-5 border-warm-200/60">
                <div className="flex items-center gap-2 mb-4">
                  <div className="w-6 h-6 rounded-md bg-brand-teal/10 flex items-center justify-center">
                    <Zap className="w-3.5 h-3.5 text-brand-teal" />
                  </div>
                  <h2 className="text-sm font-black tracking-wider text-warm-800 dark:text-warm-100">ANALYSIS</h2>
                  <Badge className="bg-brand-teal/10 text-brand-teal text-[9px] border-0 font-bold ml-auto">
                    <Zap className="w-2.5 h-2.5 mr-0.5" /> PREMIUM
                  </Badge>
                </div>

                <div className="space-y-3">
                  {/* Strengths */}
                  <div>
                    <div className="flex items-center gap-1.5 mb-2">
                      <TrendingUp className="w-3.5 h-3.5 text-green-500" />
                      <p className="text-xs font-bold text-green-600 uppercase tracking-wide">Strengths</p>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {derivedStats.strengths.map((s) => (
                        <Badge key={s} className="bg-green-500/10 text-green-600 border-0 font-bold text-[10px]">
                          {s}
                        </Badge>
                      ))}
                    </div>
                  </div>
                  {/* Weaknesses */}
                  <div>
                    <div className="flex items-center gap-1.5 mb-2">
                      <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />
                      <p className="text-xs font-bold text-amber-600 uppercase tracking-wide">Needs Improvement</p>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {derivedStats.weaknesses.length > 0 ? derivedStats.weaknesses.map((w) => (
                        <Badge key={w} className="bg-amber-500/10 text-amber-600 border-0 font-bold text-[10px]">
                          {w}
                        </Badge>
                      )) : (
                        <Badge className="bg-green-500/10 text-green-600 border-0 font-bold text-[10px]">No major weaknesses</Badge>
                      )}
                    </div>
                  </div>
                </div>
              </Card>
            </PremiumLock>
          </motion.div>

          {/* ── Position Heatmap (Premium) ────────────────────── */}
          <motion.div variants={itemVariants}>
            <PremiumLock feature="Position Heatmap">
              <Card className="p-5 border-warm-200/60">
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-6 h-6 rounded-md bg-brand-red/10 flex items-center justify-center">
                    <MapPin className="w-3.5 h-3.5 text-brand-red" />
                  </div>
                  <h2 className="text-sm font-black tracking-wider text-warm-800 dark:text-warm-100">POSITION HEATMAP</h2>
                  <Badge className="bg-brand-red/10 text-brand-red text-[9px] border-0 font-bold ml-auto">
                    <Zap className="w-2.5 h-2.5 mr-0.5" /> PREMIUM
                  </Badge>
                </div>
                <PositionHeatmap position={profile.position} />
                <p className="text-[10px] text-warm-500 text-center mt-2 font-medium">
                  {profile.position === 'raider'
                    ? 'Active in opponent half — primary raid zone'
                    : profile.position === 'defender'
                      ? 'Anchoring defense — corner & chain positions'
                      : 'Dominating both halves — versatile coverage'}
                </p>
              </Card>
            </PremiumLock>
          </motion.div>

          {/* ── Match History ─────────────────────────────────── */}
          <motion.div variants={itemVariants}>
            <Card className="p-5 border-warm-200/60">
              <div className="flex items-center gap-2 mb-4">
                <div className="w-6 h-6 rounded-md bg-brand-teal/10 flex items-center justify-center">
                  <Trophy className="w-3.5 h-3.5 text-brand-teal" />
                </div>
                <h2 className="text-sm font-black tracking-wider text-warm-800 dark:text-warm-100">MATCH HISTORY</h2>
                {(timePeriod !== 'allTime' || matchType !== 'all') && (
                  <Badge className="bg-brand-teal/10 text-brand-teal text-[9px] border-0 font-bold ml-auto">
                    Filtered
                  </Badge>
                )}
              </div>
              <div className="space-y-2 max-h-72 overflow-y-auto custom-scrollbar">
                {derivedStats.matchHistory.length === 0 ? (
                  <div className="text-center py-6">
                    <Trophy className="w-8 h-8 text-warm-300 mx-auto mb-2" />
                    <p className="text-sm text-warm-500 font-medium">No matches match your filters</p>
                  </div>
                ) : (
                  derivedStats.matchHistory.map((match, i) => (
                    <motion.div
                      key={match.id}
                      initial={{ opacity: 0, x: -12 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.2 + i * 0.05 }}
                      className="flex items-center gap-3 p-2.5 rounded-xl bg-warm-100/80 hover:bg-warm-200/60 transition-colors"
                    >
                      <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 text-xs font-black ${getResultColor(match.result)}`}>
                        {match.result}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-warm-800 dark:text-warm-100 truncate">vs {match.opponent}</p>
                        <p className="text-[10px] text-warm-500">Score: {match.score}</p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-sm font-bold text-brand-teal">{match.playerPoints}</p>
                        <p className="text-[9px] text-warm-400">pts</p>
                      </div>
                    </motion.div>
                  ))
                )}
              </div>
            </Card>
          </motion.div>

          {/* Bottom spacer */}
          <div className="h-6" />
        </motion.div>
      </div>
    </motion.div>
  );
}
