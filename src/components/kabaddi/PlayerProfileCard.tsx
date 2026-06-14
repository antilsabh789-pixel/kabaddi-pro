'use client';

import { useState, useRef, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Zap, Shield, Swords, Share2, Download, Link2, X,
  Maximize2, RotateCcw, Trophy, Target, Flame,
  TrendingUp, Award, Crown, Lock,
} from 'lucide-react';
import { useKabaddiStore, type CurrentUser } from '@/lib/store';
import { t } from '@/lib/i18n';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { toPng } from 'html-to-image';
import PremiumLock from './PremiumLock';

// ─── Types ───────────────────────────────────────────────────────────

export interface PlayerProfileData {
  totalRaids: number;
  successfulRaids: number;
  totalTackles: number;
  successfulTackles: number;
  bonusPoints: number;
  superTackles: number;
  overallRating: number;
  position: string | null;
  jerseyNumber: number | null;
  playerCode: string | null;
  totalMatches: number;
  totalPoints: number;
  raidPoints: number;
  tacklePoints: number;
  tournamentMatches: number;
  tournamentRaidPoints: number;
  tournamentTacklePoints: number;
  tournamentTotalPoints: number;
  practiceMatches: number;
  practiceRaidPoints: number;
  practiceTacklePoints: number;
  practiceTotalPoints: number;
  teamNames?: string[];
  playerOfMonth?: number;
  playerOfYear?: number;
}

interface PlayerProfileCardProps {
  player?: CurrentUser;
  profile?: PlayerProfileData;
  compact?: boolean;
}

// ─── Position Helpers ────────────────────────────────────────────────

type PositionType = 'raider' | 'defender' | 'all-rounder';

function getPositionType(position: string | null): PositionType {
  if (!position) return 'all-rounder';
  const p = position.toLowerCase();
  if (p.includes('raider')) return 'raider';
  if (p.includes('corner') || p.includes('cover') || p.includes('defend')) return 'defender';
  return 'all-rounder';
}

function getPositionColor(position: string | null) {
  const type = getPositionType(position);
  switch (type) {
    case 'raider': return { ring: 'ring-red-500', bg: 'bg-red-500', text: 'text-red-500', gradient: 'from-red-500 to-orange-500', border: 'border-red-500/30' };
    case 'defender': return { ring: 'ring-blue-500', bg: 'bg-blue-500', text: 'text-blue-500', gradient: 'from-blue-500 to-cyan-500', border: 'border-blue-500/30' };
    case 'all-rounder': return { ring: 'ring-amber-500', bg: 'bg-amber-500', text: 'text-amber-500', gradient: 'from-amber-500 to-yellow-400', border: 'border-amber-500/30' };
  }
}

function getPositionLabel(position: string | null): string {
  if (!position) return 'All-Rounder';
  const map: Record<string, string> = {
    'left-raider': 'Left Raider',
    'right-raider': 'Right Raider',
    'both-raider': 'Both Raider',
    'left-corner': 'Left Corner',
    'right-corner': 'Right Corner',
    'left-cover': 'Left Cover',
    'right-cover': 'Right Cover',
    'all-rounder': 'All-Rounder',
  };
  return map[position] || position;
}

// ─── Static Position Icon Component ──────────────────────────────────

function PositionIcon({ type, className }: { type: PositionType; className?: string }) {
  switch (type) {
    case 'raider': return <Zap className={className} />;
    case 'defender': return <Shield className={className} />;
    case 'all-rounder': return <Swords className={className} />;
  }
}

// ─── Animated Counter ────────────────────────────────────────────────

function AnimatedCounter({ value, duration = 1200 }: { value: number; duration?: number }) {
  const [display, setDisplay] = useState(value);
  const prevValueRef = useRef(value);

  useEffect(() => {
    const end = value;
    if (end === 0) {
      prevValueRef.current = 0;
      return;
    }
    const start = prevValueRef.current;
    if (start === end) return;
    const increment = (end - start) / (duration / 16);
    let current = start;
    const timer = setInterval(() => {
      current += increment;
      if ((increment > 0 && current >= end) || (increment < 0 && current <= end)) {
        setDisplay(end);
        prevValueRef.current = end;
        clearInterval(timer);
      } else {
        setDisplay(Math.floor(current));
      }
    }, 16);
    return () => clearInterval(timer);
  }, [value, duration]);

  return <>{display}</>;
}

// ─── Circular Rating Indicator ───────────────────────────────────────

function CircularRating({ rating, size = 48 }: { rating: number; size?: number }) {
  const radius = (size - 8) / 2;
  const circumference = 2 * Math.PI * radius;
  const progress = Math.min(rating / 10, 1);
  const offset = circumference - progress * circumference;

  const getColor = (r: number) => {
    if (r >= 8) return '#22c55e';
    if (r >= 6) return '#eab308';
    if (r >= 4) return '#f97316';
    return '#ef4444';
  };

  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="rgba(255,255,255,0.15)"
          strokeWidth="4"
          fill="none"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={getColor(rating)}
          strokeWidth="4"
          fill="none"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          className="transition-all duration-1000 ease-out"
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="text-xs font-black text-white">{rating.toFixed(1)}</span>
      </div>
    </div>
  );
}

// ─── Main Component ──────────────────────────────────────────────────

export default function PlayerProfileCard({ player: playerProp, profile: profileProp, compact = false }: PlayerProfileCardProps) {
  const viewerIsPremium = useKabaddiStore((s) => s.currentUser?.isPremium) || false;
  const viewerId = useKabaddiStore((s) => s.currentUser?.id);
  const language = useKabaddiStore((s) => s.language);
  const storeUser = useKabaddiStore((s) => s.currentUser);
  const { toast } = useToast();

  const player = playerProp || storeUser;
  const isOwnProfile = viewerId === player?.id;
  const canSeeStats = viewerIsPremium || isOwnProfile;
  const [flipped, setFlipped] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const [showShareMenu, setShowShareMenu] = useState(false);
  const [fetchedProfile, setFetchedProfile] = useState<PlayerProfileData | null>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const frontRef = useRef<HTMLDivElement>(null);

  // Use provided profile or fetched profile
  const profile = profileProp || fetchedProfile;

  // Fetch profile if not provided
  useEffect(() => {
    if (profileProp) return;
    if (!player?.id) return;
    let cancelled = false;
    fetch(`/api/players/${player.id}`)
      .then(res => res.ok ? res.json() : null)
      .then(data => {
        if (cancelled || !data) return;
        const p = data.profile;
        setFetchedProfile({
          totalRaids: p?.totalRaids || 0,
          successfulRaids: p?.successfulRaids || 0,
          totalTackles: p?.totalTackles || 0,
          successfulTackles: p?.successfulTackles || 0,
          bonusPoints: p?.bonusPoints || 0,
          superTackles: p?.superTackles || 0,
          overallRating: p?.overallRating || 0,
          position: p?.position || null,
          jerseyNumber: p?.jerseyNumber || null,
          playerCode: data.player?.playerCode || null,
          totalMatches: p?.totalMatches || 0,
          totalPoints: p?.totalPoints || 0,
          raidPoints: p?.raidPoints || (p?.successfulRaids || 0) + (p?.bonusPoints || 0),
          tacklePoints: p?.tacklePoints || p?.successfulTackles || 0,
          tournamentMatches: p?.tournamentMatches || 0,
          tournamentRaidPoints: p?.tournamentRaidPoints || 0,
          tournamentTacklePoints: p?.tournamentTacklePoints || 0,
          tournamentTotalPoints: p?.tournamentTotalPoints || 0,
          practiceMatches: p?.practiceMatches || 0,
          practiceRaidPoints: p?.practiceRaidPoints || 0,
          practiceTacklePoints: p?.practiceTacklePoints || 0,
          practiceTotalPoints: p?.practiceTotalPoints || 0,
          playerOfMonth: p?.playerOfMonth || 0,
          playerOfYear: p?.playerOfYear || 0,
        });
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [player?.id, profileProp]);

  const position = profile?.position || null;
  const posType = getPositionType(position);
  const posColor = getPositionColor(position);
  // Use TOURNAMENT-ONLY stats for main card display (leaderboard/awards use these)
  const totalPoints = profile?.tournamentTotalPoints || (profile?.tournamentRaidPoints || 0) + (profile?.tournamentTacklePoints || 0);
  const raidPoints = profile?.tournamentRaidPoints || 0;
  const tacklePoints = profile?.tournamentTacklePoints || 0;
  const matches = profile?.tournamentMatches || 0;

  // Practice stats (shown separately, not in main display)
  const practiceTotalPoints = profile?.practiceTotalPoints || 0;
  const practiceRaidPoints = profile?.practiceRaidPoints || 0;
  const practiceTacklePoints = profile?.practiceTacklePoints || 0;
  const practiceMatches = profile?.practiceMatches || 0;

  // ─── Share Functionality ─────────────────────────────────────────

  const captureCard = async () => {
    if (!frontRef.current) return null;
    try {
      const dataUrl = await toPng(frontRef.current, {
        quality: 0.95,
        pixelRatio: 2,
        backgroundColor: '#1a1a2e',
      });
      return dataUrl;
    } catch (err) {
      console.error('Failed to capture card:', err);
      return null;
    }
  };

  const handleShareImage = async () => {
    const dataUrl = await captureCard();
    if (!dataUrl) {
      toast({ title: 'Failed to capture card', variant: 'destructive' });
      return;
    }

    try {
      const response = await fetch(dataUrl);
      const blob = await response.blob();
      const file = new File([blob], `kabaddi-pro-${player?.name || 'player'}.png`, { type: 'image/png' });

      if (navigator.share && navigator.canShare({ files: [file] })) {
        await navigator.share({
          title: 'Kabaddi Pro Player Card',
          text: `Check out ${player?.name || 'this player'} on Kabaddi Pro!`,
          files: [file],
        });
        toast({ title: 'Shared successfully!' });
      } else {
        const link = document.createElement('a');
        link.download = `kabaddi-pro-${player?.name || 'player'}.png`;
        link.href = dataUrl;
        link.click();
        toast({ title: 'Card downloaded!' });
      }
    } catch {
      const link = document.createElement('a');
      link.download = `kabaddi-pro-${player?.name || 'player'}.png`;
      link.href = dataUrl;
      link.click();
      toast({ title: 'Card downloaded!' });
    }
    setShowShareMenu(false);
  };

  const handleCopyLink = () => {
    const code = profile?.playerCode || player?.playerCode;
    const url = code ? `${window.location.origin}?player=${code}` : window.location.href;
    navigator.clipboard.writeText(url).then(() => {
      toast({ title: 'Link copied to clipboard!' });
    }).catch(() => {
      toast({ title: 'Failed to copy link', variant: 'destructive' });
    });
    setShowShareMenu(false);
  };

  const handleWebShare = async () => {
    if (!navigator.share) {
      handleCopyLink();
      return;
    }
    try {
      await navigator.share({
        title: 'Kabaddi Pro Player',
        text: `Check out ${player?.name || 'this player'} on Kabaddi Pro!`,
        url: profile?.playerCode ? `${window.location.origin}?player=${profile.playerCode}` : window.location.href,
      });
      toast({ title: 'Shared successfully!' });
    } catch {
      // User cancelled or share failed
    }
    setShowShareMenu(false);
  };

  // ─── Performance bars data ───────────────────────────────────────

  const maxStatValue = Math.max(raidPoints, tacklePoints, profile?.bonusPoints || 0, profile?.superTackles || 0, 1);
  const performanceBars = useMemo(() => [
    { label: 'Raid Points', value: raidPoints, color: 'from-red-500 to-orange-500', iconType: 'raid' as const },
    { label: 'Tackle Points', value: tacklePoints, color: 'from-blue-500 to-cyan-500', iconType: 'tackle' as const },
    { label: 'Bonus Points', value: profile?.bonusPoints || 0, color: 'from-teal-500 to-emerald-500', iconType: 'bonus' as const },
    { label: 'Super Tackles', value: profile?.superTackles || 0, color: 'from-purple-500 to-pink-500', iconType: 'super' as const },
  ], [raidPoints, tacklePoints, profile?.bonusPoints, profile?.superTackles]);

  const raidSuccessRate = (profile?.totalRaids || 0) > 0
    ? ((profile?.successfulRaids || 0) / profile.totalRaids) * 100
    : 0;
  const tackleSuccessRate = (profile?.totalTackles || 0) > 0
    ? ((profile?.successfulTackles || 0) / profile.totalTackles) * 100
    : 0;

  // Static icon renderer for performance bars
  const BarIcon = ({ type, className }: { type: 'raid' | 'tackle' | 'bonus' | 'super'; className?: string }) => {
    switch (type) {
      case 'raid': return <Zap className={className} />;
      case 'tackle': return <Shield className={className} />;
      case 'bonus': return <Target className={className} />;
      case 'super': return <Flame className={className} />;
    }
  };

  // ─── Card Front ──────────────────────────────────────────────────

  const cardFront = (
    <div
      ref={frontRef}
      className="relative w-full overflow-hidden rounded-2xl shadow-2xl"
      style={{
        background: `linear-gradient(135deg, #8B0000 0%, #B22222 30%, #D4A017 70%, #B8860B 100%)`,
        minHeight: compact ? 340 : 420,
      }}
    >
      {/* Decorative background elements */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute inset-0 opacity-[0.06]" style={{
          backgroundImage: `repeating-linear-gradient(45deg, transparent, transparent 20px, rgba(255,255,255,0.3) 20px, rgba(255,255,255,0.3) 21px)`,
        }} />
        <div className="absolute -top-16 -right-16 w-48 h-48 rounded-full border-[3px] border-white/10" />
        <div className="absolute -bottom-12 -left-12 w-40 h-40 rounded-full border-[3px] border-white/8" />
        <div className="absolute top-6 right-12 w-2 h-2 rounded-full bg-white/30 animate-pulse" />
        <div className="absolute top-20 right-6 w-1.5 h-1.5 rounded-full bg-white/20 animate-pulse" style={{ animationDelay: '0.7s' }} />
        <div className="absolute bottom-32 left-8 w-1 h-1 rounded-full bg-white/25 animate-pulse" style={{ animationDelay: '1.4s' }} />
        {profile?.jerseyNumber && (
          <div className="absolute right-4 top-1/2 -translate-y-1/2 text-[120px] font-black text-white/[0.06] leading-none select-none pointer-events-none">
            {profile.jerseyNumber}
          </div>
        )}
      </div>

      {/* Rating circle - top right */}
      <div className="absolute top-3 right-3 z-10">
        <CircularRating rating={profile?.overallRating || 0} size={compact ? 40 : 48} />
      </div>

      {/* Content */}
      <div className={`relative z-10 flex flex-col items-center ${compact ? 'pt-8 pb-6 px-5' : 'pt-10 pb-8 px-6'}`}>
        {/* Avatar with ring */}
        <div className={`relative ${compact ? 'mb-4' : 'mb-5'}`}>
          <div className={`${compact ? 'w-20 h-20' : 'w-28 h-28'} rounded-full ring-4 ${posColor.ring} ring-offset-2 ring-offset-transparent bg-warm-200 flex items-center justify-center overflow-hidden shadow-xl`}>
            {player?.avatar ? (
              <img
                src={player.avatar}
                alt={player.name || 'Player'}
                className="w-full h-full object-cover"
              />
            ) : (
              <span className={`${compact ? 'text-3xl' : 'text-4xl'}`}>
                {player?.gender === 'female' ? '👩' : '👨'}
              </span>
            )}
          </div>
          {/* Position badge on avatar */}
          <div className={`absolute -bottom-1 left-1/2 -translate-x-1/2 ${posColor.bg} rounded-full px-2.5 py-0.5 flex items-center gap-1 shadow-lg`}>
            <PositionIcon type={posType} className="w-3 h-3 text-white" />
            <span className="text-[10px] font-bold text-white uppercase tracking-wide">
              {posType.substring(0, 3)}
            </span>
          </div>
        </div>

        {/* Player Name with gradient text */}
        <h2 className={`${compact ? 'text-lg' : 'text-2xl'} font-black text-center leading-tight flex items-center justify-center gap-1.5`}>
          <span className={`bg-gradient-to-r ${player?.isPremium ? 'from-brand-gold via-brand-gold-light to-brand-gold' : 'from-white via-yellow-100 to-white'} bg-clip-text text-transparent drop-shadow-lg`}>
            {player?.name || 'Player'}
          </span>
          {player?.isPremium && (
            <Badge className="bg-gradient-to-r from-brand-gold to-brand-gold-dark text-white text-[8px] border-0 font-bold px-1 py-0">
              <Crown className="w-2.5 h-2.5 mr-0.5" />PRO
            </Badge>
          )}
          {player?.gender === 'male' && <span className="text-blue-300 text-lg">♂</span>}
          {player?.gender === 'female' && <span className="text-pink-300 text-lg">♀</span>}
        </h2>

        {/* Player Code badge */}
        {(profile?.playerCode || player?.playerCode) && (
          <div className="mt-1.5 px-3 py-1 rounded-full bg-white/15 backdrop-blur-sm border border-white/20">
            <span className="text-xs font-mono font-bold text-white/90 tracking-wider">
              {profile?.playerCode || player?.playerCode}
            </span>
          </div>
        )}

        {/* Position & Jersey Badges */}
        <div className="flex items-center gap-2 mt-2.5">
          {position && (
            <Badge className={`${posColor.bg} text-white border-0 text-[10px] font-bold gap-1 px-2 py-0.5`}>
              <PositionIcon type={posType} className="w-3 h-3" />
              {getPositionLabel(position)}
            </Badge>
          )}
          {profile?.jerseyNumber && (
            <Badge className="bg-white/15 backdrop-blur-sm text-white border border-white/20 text-[10px] font-bold px-2 py-0.5">
              #{profile.jerseyNumber}
            </Badge>
          )}
          {player?.isPremium && (
            <Badge className="bg-amber-500/80 text-white border-0 text-[10px] font-bold px-2 py-0.5">
              PRO
            </Badge>
          )}
        </div>

        {/* Team Names */}
        {profile?.teamNames && profile.teamNames.length > 0 && (
          <div className="mt-2 text-white/60 text-[11px] text-center">
            {profile.teamNames.join(' • ')}
          </div>
        )}

        {/* Stats Row */}
        <div className={`relative mt-5 w-full ${compact ? '' : 'max-w-[300px]'}`}>
          <div className={`grid grid-cols-4 gap-2 ${!canSeeStats ? 'blur-sm select-none' : ''}`}>
          {[
            { label: 'Total Pts', value: totalPoints, iconType: 'total' as const, color: 'text-amber-300' },
            { label: 'Raid Pts', value: raidPoints, iconType: 'raid' as const, color: 'text-red-300' },
            { label: 'Tackle Pts', value: tacklePoints, iconType: 'tackle' as const, color: 'text-cyan-300' },
            { label: 'Matches', value: matches, iconType: 'matches' as const, color: 'text-emerald-300' },
          ].map((stat) => (
            <div key={stat.label} className="text-center bg-white/10 backdrop-blur-sm rounded-xl p-2 border border-white/10">
              <StatIcon type={stat.iconType} className={`w-3.5 h-3.5 mx-auto mb-1 ${stat.color}`} />
              <div className="text-base font-black text-white">
                <AnimatedCounter value={stat.value} />
              </div>
              <div className="text-[8px] text-white/60 uppercase tracking-wider font-medium">{stat.label}</div>
            </div>
          ))}
          </div>
          {!canSeeStats && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/40 rounded-xl">
              <div className="text-center">
                <Crown className="w-8 h-8 text-brand-gold mx-auto mb-2" />
                <p className="text-sm font-bold text-white">Premium Only</p>
                <p className="text-xs text-white/60">Go Premium to view detailed stats</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Bottom brand strip */}
      <div className="relative z-10 bg-black/20 px-4 py-2 flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <div className="w-5 h-5 rounded-md bg-gradient-to-br from-red-500 to-amber-500 flex items-center justify-center">
            <span className="text-[8px] font-black text-white">K</span>
          </div>
          <span className="text-[10px] font-bold text-white/60 tracking-wider">KABADDI PRO</span>
        </div>
        <span className="text-[9px] text-white/40">{new Date().getFullYear()}</span>
      </div>
    </div>
  );

  // ─── Card Back ──────────────────────────────────────────────────

  const cardBack = (
    <div
      className="relative w-full overflow-hidden rounded-2xl shadow-2xl"
      style={{
        background: `linear-gradient(135deg, #1a1a2e 0%, #16213e 40%, #0f3460 100%)`,
        minHeight: compact ? 340 : 420,
      }}
    >
      {/* Decorative */}
      <div className="absolute inset-0 overflow-hidden opacity-10">
        <div className="absolute -top-8 -left-8 w-32 h-32 rounded-full border-2 border-white/20" />
        <div className="absolute -bottom-6 -right-6 w-28 h-28 rounded-full border-2 border-white/15" />
      </div>

      <div className={`relative z-10 ${compact ? 'pt-6 pb-5 px-4' : 'pt-8 pb-6 px-5'}`}>
        {/* Header */}
        <div className="flex items-center gap-3 mb-4">
          <div className={`w-10 h-10 rounded-full ring-2 ${posColor.ring} bg-warm-200 flex items-center justify-center overflow-hidden`}>
            {player?.avatar ? (
              <img src={player.avatar} alt={player.name || ''} className="w-full h-full object-cover" />
            ) : (
              <span className="text-lg">{player?.gender === 'female' ? '👩' : '👨'}</span>
            )}
          </div>
          <div>
            <h3 className="text-base font-bold text-white">{player?.name || 'Player'}</h3>
            <p className="text-[10px] text-white/50">{profile?.playerCode || player?.playerCode} • {getPositionLabel(position)}</p>
          </div>
        </div>

        {/* Performance Chart */}
        <div className="mb-4 relative">
          {!canSeeStats && (
            <div className="absolute inset-0 z-10 flex items-center justify-center bg-black/50 backdrop-blur-sm rounded-xl">
              <div className="text-center">
                <Lock className="w-6 h-6 text-yellow-400 mx-auto mb-1.5" />
                <p className="text-xs font-bold text-white">PRO Only</p>
              </div>
            </div>
          )}
          <div className={!canSeeStats ? 'blur-sm select-none pointer-events-none' : ''}>
          <h4 className="text-[10px] font-bold text-white/50 uppercase tracking-wider mb-2.5">Performance Breakdown</h4>
          <div className="space-y-2.5">
            {performanceBars.map((bar) => {
              const widthPct = maxStatValue > 0 ? (bar.value / maxStatValue) * 100 : 0;
              return (
                <div key={bar.label}>
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-1.5">
                      <BarIcon type={bar.iconType} className="w-3 h-3 text-white/60" />
                      <span className="text-[10px] text-white/70 font-medium">{bar.label}</span>
                    </div>
                    <span className="text-[11px] font-bold text-white">{bar.value}</span>
                  </div>
                  <div className="w-full h-2 bg-white/10 rounded-full overflow-hidden">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${widthPct}%` }}
                      transition={{ duration: 0.8, ease: 'easeOut' }}
                      className={`h-full rounded-full bg-gradient-to-r ${bar.color}`}
                    />
                  </div>
                </div>
              );
            })}
          </div>
          </div>
        </div>

        {/* Success Rates */}
        <div className="grid grid-cols-2 gap-2.5 mb-4 relative">
          {!canSeeStats && (
            <div className="absolute inset-0 z-10 flex items-center justify-center bg-black/50 backdrop-blur-sm rounded-xl">
              <div className="text-center">
                <Crown className="w-6 h-6 text-yellow-400 mx-auto mb-1.5" />
                <p className="text-xs font-bold text-white">Premium Stats</p>
              </div>
            </div>
          )}
          <div className={!canSeeStats ? 'blur-sm select-none pointer-events-none' : ''}>
          <div className="bg-white/5 rounded-xl p-3 border border-white/10">
            <div className="flex items-center gap-1.5 mb-1">
              <Zap className="w-3 h-3 text-red-400" />
              <span className="text-[10px] text-white/50 font-medium">Raid Success</span>
            </div>
            <span className="text-lg font-black text-white">{raidSuccessRate.toFixed(0)}%</span>
            <div className="w-full h-1.5 bg-white/10 rounded-full mt-1.5 overflow-hidden">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${Math.min(raidSuccessRate, 100)}%` }}
                transition={{ duration: 1, ease: 'easeOut' }}
                className="h-full rounded-full bg-gradient-to-r from-red-400 to-orange-400"
              />
            </div>
          </div>
          </div>
          <div className={!canSeeStats ? 'blur-sm select-none pointer-events-none' : ''}>
          <div className="bg-white/5 rounded-xl p-3 border border-white/10">
            <div className="flex items-center gap-1.5 mb-1">
              <Shield className="w-3 h-3 text-blue-400" />
              <span className="text-[10px] text-white/50 font-medium">Tackle Success</span>
            </div>
            <span className="text-lg font-black text-white">{tackleSuccessRate.toFixed(0)}%</span>
            <div className="w-full h-1.5 bg-white/10 rounded-full mt-1.5 overflow-hidden">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${Math.min(tackleSuccessRate, 100)}%` }}
                transition={{ duration: 1, ease: 'easeOut' }}
                className="h-full rounded-full bg-gradient-to-r from-blue-400 to-cyan-400"
              />
            </div>
          </div>
          </div>
        </div>

        {/* Season Highlights */}
        <div className="relative">
          {!canSeeStats && (
            <div className="absolute inset-0 z-10 flex items-center justify-center bg-black/50 backdrop-blur-sm rounded-xl">
              <div className="text-center">
                <Lock className="w-5 h-5 text-yellow-400 mx-auto mb-1" />
                <p className="text-[10px] font-bold text-white">Unlock with PRO</p>
              </div>
            </div>
          )}
          <div className={!canSeeStats ? 'blur-sm select-none pointer-events-none' : ''}>
          <h4 className="text-[10px] font-bold text-white/50 uppercase tracking-wider mb-2">Season Highlights</h4>
          <div className="grid grid-cols-3 gap-2">
            <div className="bg-white/5 rounded-lg p-2 text-center border border-white/10">
              <Trophy className="w-3.5 h-3.5 text-amber-400 mx-auto mb-1" />
              <p className="text-sm font-bold text-white">{matches}</p>
              <p className="text-[8px] text-white/40">Tourney Matches</p>
            </div>
            <div className="bg-white/5 rounded-lg p-2 text-center border border-white/10">
              <TrendingUp className="w-3.5 h-3.5 text-emerald-400 mx-auto mb-1" />
              <p className="text-sm font-bold text-white">{totalPoints}</p>
              <p className="text-[8px] text-white/40">Tourney Pts</p>
            </div>
            <div className="bg-white/5 rounded-lg p-2 text-center border border-white/10">
              <Award className="w-3.5 h-3.5 text-purple-400 mx-auto mb-1" />
              <p className="text-sm font-bold text-white">{profile?.playerOfMonth || 0}</p>
              <p className="text-[8px] text-white/40">POTM</p>
            </div>
          </div>
          </div>
        </div>

        {/* Flip prompt */}
        <div className="mt-4 text-center">
          <p className="text-[9px] text-white/30 flex items-center justify-center gap-1">
            <RotateCcw className="w-2.5 h-2.5" />
            Tap to flip back
          </p>
        </div>
      </div>

      {/* Bottom brand strip */}
      <div className="absolute bottom-0 left-0 right-0 bg-black/20 px-4 py-2 flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <div className="w-5 h-5 rounded-md bg-gradient-to-br from-red-500 to-amber-500 flex items-center justify-center">
            <span className="text-[8px] font-black text-white">K</span>
          </div>
          <span className="text-[10px] font-bold text-white/60 tracking-wider">KABADDI PRO</span>
        </div>
        <span className="text-[9px] text-white/40">{new Date().getFullYear()}</span>
      </div>
    </div>
  );

  // ─── Fullscreen View ────────────────────────────────────────────

  const fullscreenView = (
    <AnimatePresence>
      {fullscreen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-start justify-center overflow-y-auto p-4"
          onClick={(e) => { if (e.target === e.currentTarget) setFullscreen(false); }}
        >
          <motion.div
            initial={{ scale: 0.8, y: 50 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0.8, y: 50 }}
            transition={{ type: 'spring', stiffness: 300, damping: 25 }}
            className="w-full max-w-md my-8"
          >
            {/* Close button */}
            <div className="flex justify-end mb-3">
              <button
                onClick={() => setFullscreen(false)}
                className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center text-white hover:bg-white/20 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Full-screen profile */}
            <div className="rounded-2xl overflow-hidden shadow-2xl" style={{
              background: 'linear-gradient(135deg, #8B0000 0%, #B22222 30%, #D4A017 70%, #B8860B 100%)',
            }}>
              {/* Decorative */}
              <div className="absolute inset-0 overflow-hidden opacity-[0.06] pointer-events-none">
                <div style={{
                  backgroundImage: `repeating-linear-gradient(45deg, transparent, transparent 20px, rgba(255,255,255,0.3) 20px, rgba(255,255,255,0.3) 21px)`,
                  width: '100%', height: '100%',
                }} />
              </div>

              <div className="relative z-10 pt-10 pb-8 px-6">
                {/* Rating circle */}
                <div className="absolute top-4 right-4">
                  <CircularRating rating={profile?.overallRating || 0} size={56} />
                </div>

                {/* Avatar */}
                <div className="flex flex-col items-center mb-6">
                  <div className={`w-32 h-32 rounded-full ring-4 ${posColor.ring} ring-offset-2 ring-offset-transparent bg-warm-200 flex items-center justify-center overflow-hidden shadow-xl mb-3`}>
                    {player?.avatar ? (
                      <img src={player.avatar} alt={player.name || ''} className="w-full h-full object-cover" />
                    ) : (
                      <span className="text-5xl">{player?.gender === 'female' ? '👩' : '👨'}</span>
                    )}
                  </div>
                  <div className={`${posColor.bg} rounded-full px-4 py-1 flex items-center gap-1.5 shadow-lg -mt-5`}>
                    <PositionIcon type={posType} className="w-4 h-4 text-white" />
                    <span className="text-xs font-bold text-white uppercase tracking-wide">
                      {getPositionLabel(position)}
                    </span>
                  </div>
                </div>

                {/* Name */}
                <h2 className="text-3xl font-black text-center mb-1">
                  <span className="bg-gradient-to-r from-white via-yellow-100 to-white bg-clip-text text-transparent">
                    {player?.name || 'Player'}
                  </span>
                  {player?.gender === 'male' && <span className="ml-2 text-blue-300">♂</span>}
                  {player?.gender === 'female' && <span className="ml-2 text-pink-300">♀</span>}
                </h2>

                {/* Code & Badges */}
                <div className="flex items-center justify-center gap-2 mt-2">
                  {(profile?.playerCode || player?.playerCode) && (
                    <div className="px-3 py-1 rounded-full bg-white/15 backdrop-blur-sm border border-white/20">
                      <span className="text-sm font-mono font-bold text-white/90">{profile?.playerCode || player?.playerCode}</span>
                    </div>
                  )}
                  {profile?.jerseyNumber && (
                    <Badge className="bg-white/15 text-white border border-white/20 font-bold">#{profile.jerseyNumber}</Badge>
                  )}
                  {player?.isPremium && (
                    <Badge className="bg-amber-500/80 text-white border-0 font-bold">PRO</Badge>
                  )}
                </div>

                {/* Stats Grid */}
                <div className="relative mt-6">
                  {!canSeeStats && (
                    <div className="absolute inset-0 z-10 flex items-center justify-center bg-black/50 backdrop-blur-sm rounded-xl">
                      <div className="text-center">
                        <Lock className="w-8 h-8 text-yellow-400 mx-auto mb-2" />
                        <p className="text-sm font-bold text-white">Premium Only</p>
                        <p className="text-xs text-white/60">Go Premium to view detailed stats</p>
                      </div>
                    </div>
                  )}
                  <div className={`grid grid-cols-4 gap-3 ${!canSeeStats ? 'blur-sm select-none' : ''}`}>
                  {[
                    { label: 'Total Pts', value: totalPoints, iconType: 'total' as const, color: 'text-amber-300' },
                    { label: 'Raid Pts', value: raidPoints, iconType: 'raid' as const, color: 'text-red-300' },
                    { label: 'Tackle Pts', value: tacklePoints, iconType: 'tackle' as const, color: 'text-cyan-300' },
                    { label: 'Matches', value: matches, iconType: 'matches' as const, color: 'text-emerald-300' },
                  ].map((stat) => (
                    <div key={stat.label} className="text-center bg-white/10 backdrop-blur-sm rounded-xl p-3 border border-white/10">
                      <StatIcon type={stat.iconType} className={`w-4 h-4 mx-auto mb-1.5 ${stat.color}`} />
                      <div className="text-xl font-black text-white">
                        <AnimatedCounter value={stat.value} />
                      </div>
                      <div className="text-[9px] text-white/60 uppercase tracking-wider font-medium mt-0.5">{stat.label}</div>
                    </div>
                  ))}
                  </div>
                </div>

                {/* Detailed Performance */}
                <div className="mt-6 relative">
                  {!canSeeStats && (
                    <div className="absolute inset-0 z-10 flex items-center justify-center bg-black/50 backdrop-blur-sm rounded-xl">
                      <div className="text-center">
                        <Crown className="w-7 h-7 text-yellow-400 mx-auto mb-1.5" />
                        <p className="text-sm font-bold text-white">PRO Stats</p>
                      </div>
                    </div>
                  )}
                  <div className={`bg-white/5 backdrop-blur-sm rounded-xl p-4 border border-white/10 ${!canSeeStats ? 'blur-sm select-none pointer-events-none' : ''}`}>
                  <h4 className="text-xs font-bold text-white/60 uppercase tracking-wider mb-3">Performance Breakdown</h4>
                  <div className="space-y-3">
                    {performanceBars.map((bar) => {
                      const widthPct = maxStatValue > 0 ? (bar.value / maxStatValue) * 100 : 0;
                      return (
                        <div key={bar.label}>
                          <div className="flex items-center justify-between mb-1">
                            <div className="flex items-center gap-1.5">
                              <BarIcon type={bar.iconType} className="w-3.5 h-3.5 text-white/60" />
                              <span className="text-xs text-white/70 font-medium">{bar.label}</span>
                            </div>
                            <span className="text-sm font-bold text-white">{bar.value}</span>
                          </div>
                          <div className="w-full h-2.5 bg-white/10 rounded-full overflow-hidden">
                            <motion.div
                              initial={{ width: 0 }}
                              animate={{ width: `${widthPct}%` }}
                              transition={{ duration: 0.8, ease: 'easeOut' }}
                              className={`h-full rounded-full bg-gradient-to-r ${bar.color}`}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  </div>
                </div>

                {/* Success Rates Row */}
                <div className="relative mt-4">
                  {!canSeeStats && (
                    <div className="absolute inset-0 z-10 flex items-center justify-center bg-black/50 backdrop-blur-sm rounded-xl">
                      <div className="text-center">
                        <Lock className="w-6 h-6 text-yellow-400 mx-auto mb-1" />
                        <p className="text-xs font-bold text-white">Unlock with PRO</p>
                      </div>
                    </div>
                  )}
                  <div className={`grid grid-cols-2 gap-3 ${!canSeeStats ? 'blur-sm select-none pointer-events-none' : ''}`}>
                  <div className="bg-white/5 rounded-xl p-3 border border-white/10">
                    <div className="flex items-center gap-1.5 mb-1.5">
                      <Zap className="w-3.5 h-3.5 text-red-400" />
                      <span className="text-[11px] text-white/50 font-medium">Raid Success</span>
                    </div>
                    <span className="text-xl font-black text-white">{raidSuccessRate.toFixed(0)}%</span>
                    <div className="w-full h-2 bg-white/10 rounded-full mt-2 overflow-hidden">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${Math.min(raidSuccessRate, 100)}%` }}
                        transition={{ duration: 1, ease: 'easeOut' }}
                        className="h-full rounded-full bg-gradient-to-r from-red-400 to-orange-400"
                      />
                    </div>
                  </div>
                  <div className="bg-white/5 rounded-xl p-3 border border-white/10">
                    <div className="flex items-center gap-1.5 mb-1.5">
                      <Shield className="w-3.5 h-3.5 text-blue-400" />
                      <span className="text-[11px] text-white/50 font-medium">Tackle Success</span>
                    </div>
                    <span className="text-xl font-black text-white">{tackleSuccessRate.toFixed(0)}%</span>
                    <div className="w-full h-2 bg-white/10 rounded-full mt-2 overflow-hidden">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${Math.min(tackleSuccessRate, 100)}%` }}
                        transition={{ duration: 1, ease: 'easeOut' }}
                        className="h-full rounded-full bg-gradient-to-r from-blue-400 to-cyan-400"
                      />
                    </div>
                  </div>
                  </div>
                </div>

                {/* Season Highlights */}
                <div className="mt-4 relative">
                  {!canSeeStats && (
                    <div className="absolute inset-0 z-10 flex items-center justify-center bg-black/50 backdrop-blur-sm rounded-xl">
                      <div className="text-center">
                        <Crown className="w-6 h-6 text-yellow-400 mx-auto mb-1" />
                        <p className="text-xs font-bold text-white">Premium Feature</p>
                      </div>
                    </div>
                  )}
                  <div className={`bg-white/5 rounded-xl p-3 border border-white/10 ${!canSeeStats ? 'blur-sm select-none pointer-events-none' : ''}`}>
                  <h4 className="text-[11px] font-bold text-white/50 uppercase tracking-wider mb-2.5">Season Highlights</h4>
                  <div className="grid grid-cols-4 gap-2">
                    <div className="text-center">
                      <Trophy className="w-4 h-4 text-amber-400 mx-auto mb-1" />
                      <p className="text-base font-bold text-white">{matches}</p>
                      <p className="text-[8px] text-white/40">Tourney Matches</p>
                    </div>
                    <div className="text-center">
                      <TrendingUp className="w-4 h-4 text-emerald-400 mx-auto mb-1" />
                      <p className="text-base font-bold text-white">{totalPoints}</p>
                      <p className="text-[8px] text-white/40">Tourney Pts</p>
                    </div>
                    <div className="text-center">
                      <Award className="w-4 h-4 text-purple-400 mx-auto mb-1" />
                      <p className="text-base font-bold text-white">{profile?.playerOfMonth || 0}</p>
                      <p className="text-[8px] text-white/40">POTM</p>
                    </div>
                    <div className="text-center">
                      <Flame className="w-4 h-4 text-orange-400 mx-auto mb-1" />
                      <p className="text-base font-bold text-white">{profile?.superTackles || 0}</p>
                      <p className="text-[8px] text-white/40">S.Tackles</p>
                    </div>
                  </div>
                  </div>
                </div>

                {/* Match History Summary */}
                <div className="mt-4 relative">
                  {!canSeeStats && (
                    <div className="absolute inset-0 z-10 flex items-center justify-center bg-black/50 backdrop-blur-sm rounded-xl">
                      <div className="text-center">
                        <Lock className="w-5 h-5 text-yellow-400 mx-auto mb-1" />
                        <p className="text-[10px] font-bold text-white">PRO Only</p>
                      </div>
                    </div>
                  )}
                  <div className={`bg-white/5 rounded-xl p-3 border border-white/10 ${!canSeeStats ? 'blur-sm select-none pointer-events-none' : ''}`}>
                  <h4 className="text-[11px] font-bold text-white/50 uppercase tracking-wider mb-2">Match Summary</h4>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="flex items-center gap-2 p-2 bg-white/5 rounded-lg">
                      <span className="text-sm">🏋️</span>
                      <div>
                        <p className="text-xs font-bold text-white">{profile?.practiceMatches || 0}</p>
                        <p className="text-[8px] text-white/40">Practice</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 p-2 bg-white/5 rounded-lg">
                      <span className="text-sm">🏆</span>
                      <div>
                        <p className="text-xs font-bold text-white">{profile?.tournamentMatches || 0}</p>
                        <p className="text-[8px] text-white/40">Tournament</p>
                      </div>
                    </div>
                  </div>
                  </div>
                </div>
              </div>

              {/* Brand strip */}
              <div className="bg-black/20 px-4 py-2 flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <div className="w-5 h-5 rounded-md bg-gradient-to-br from-red-500 to-amber-500 flex items-center justify-center">
                    <span className="text-[8px] font-black text-white">K</span>
                  </div>
                  <span className="text-[10px] font-bold text-white/60 tracking-wider">KABADDI PRO</span>
                </div>
                <span className="text-[9px] text-white/40">{new Date().getFullYear()}</span>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );

  // ─── Render ─────────────────────────────────────────────────────

  return (
    <>
      {/* Card with flip animation */}
      <div className="relative" ref={cardRef}>
        {/* Action buttons */}
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setFlipped(!flipped)}
              className="flex items-center gap-1 text-[10px] font-semibold text-white/60 hover:text-white/90 transition-colors bg-white/10 rounded-lg px-2.5 py-1.5"
            >
              <RotateCcw className="w-3 h-3" />
              Flip
            </button>
            <button
              onClick={() => setFullscreen(true)}
              className="flex items-center gap-1 text-[10px] font-semibold text-white/60 hover:text-white/90 transition-colors bg-white/10 rounded-lg px-2.5 py-1.5"
            >
              <Maximize2 className="w-3 h-3" />
              Expand
            </button>
          </div>
          <div className="relative">
            <button
              onClick={() => setShowShareMenu(!showShareMenu)}
              className="flex items-center gap-1 text-[10px] font-semibold text-white/60 hover:text-white/90 transition-colors bg-white/10 rounded-lg px-2.5 py-1.5"
            >
              <Share2 className="w-3 h-3" />
              Share
            </button>

            {/* Share dropdown */}
            <AnimatePresence>
              {showShareMenu && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.9, y: -5 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.9, y: -5 }}
                  transition={{ duration: 0.15 }}
                  className="absolute right-0 top-full mt-1.5 bg-warm-100 dark:bg-warm-200 rounded-xl shadow-xl border border-warm-300 dark:border-warm-300 overflow-hidden z-20 min-w-[160px]"
                >
                  <button
                    onClick={handleShareImage}
                    className="w-full flex items-center gap-2.5 px-3.5 py-2.5 hover:bg-warm-200 dark:hover:bg-warm-300 transition-colors text-left"
                  >
                    <Download className="w-4 h-4 text-brand-red" />
                    <span className="text-xs font-medium text-warm-800 dark:text-warm-700">Download Card</span>
                  </button>
                  <button
                    onClick={handleCopyLink}
                    className="w-full flex items-center gap-2.5 px-3.5 py-2.5 hover:bg-warm-200 dark:hover:bg-warm-300 transition-colors text-left"
                  >
                    <Link2 className="w-4 h-4 text-brand-teal" />
                    <span className="text-xs font-medium text-warm-800 dark:text-warm-700">Copy Link</span>
                  </button>
                  {typeof navigator !== 'undefined' && navigator.share && (
                    <button
                      onClick={handleWebShare}
                      className="w-full flex items-center gap-2.5 px-3.5 py-2.5 hover:bg-warm-200 dark:hover:bg-warm-300 transition-colors text-left"
                    >
                      <Share2 className="w-4 h-4 text-brand-gold" />
                      <span className="text-xs font-medium text-warm-800 dark:text-warm-700">Share via...</span>
                    </button>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>

        {/* 3D Flip Container */}
        <div
          className="relative w-full cursor-pointer"
          style={{ perspective: '1200px' }}
          onClick={() => setFlipped(!flipped)}
        >
          <div
            className="relative w-full transition-transform duration-700 ease-in-out"
            style={{
              transformStyle: 'preserve-3d',
              transform: flipped ? 'rotateY(180deg)' : 'rotateY(0deg)',
            }}
          >
            {/* Front */}
            <div style={{ backfaceVisibility: 'hidden' }}>
              {cardFront}
            </div>
            {/* Back */}
            <div
              className="absolute inset-0"
              style={{ backfaceVisibility: 'hidden', transform: 'rotateY(180deg)' }}
            >
              {cardBack}
            </div>
          </div>
        </div>
      </div>

      {/* Fullscreen overlay */}
      {fullscreenView}
    </>
  );
}

// ─── Static Stat Icon Component ──────────────────────────────────────

function StatIcon({ type, className }: { type: 'total' | 'raid' | 'tackle' | 'matches'; className?: string }) {
  switch (type) {
    case 'total': return <Trophy className={className} />;
    case 'raid': return <Zap className={className} />;
    case 'tackle': return <Shield className={className} />;
    case 'matches': return <Target className={className} />;
  }
}
