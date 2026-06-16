'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowLeft,
  MapPin,
  Navigation,
  Filter,
  Users,
  Shield,
  Swords,
  Star,
  Loader2,
  Locate,
  Save,
  Crosshair,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useKabaddiStore } from '@/lib/store';
import { t } from '@/lib/i18n';
import { useToast } from '@/hooks/use-toast';

// ─── Types ────────────────────────────────────────────────────────

interface FindPlayersScreenProps {
  onBack: () => void;
}

type PositionFilter = 'all' | 'raider' | 'defender' | 'all-rounder';
type RadiusFilter = '1' | '5' | '10' | '25' | '50';

interface NearbyPlayer {
  id: string;
  name: string | null;
  avatar: string | null;
  gender: string | null;
  weight: string | null;
  playerCode: string | null;
  position: string | null;
  overallRating: number;
  totalMatches: number;
  totalPoints: number;
  weightCategory: string | null;
  successfulRaids: number;
  successfulTackles: number;
  distance: number;
  city: string | null;
  area: string | null;
}

// ─── Helpers ──────────────────────────────────────────────────────

function getInitial(name: string | null | undefined): string {
  if (!name) return '?';
  const parts = name.trim().split(/\s+/);
  return parts.length > 1
    ? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
    : parts[0][0].toUpperCase();
}

function getPositionIcon(position: string | null): React.ReactNode {
  const pos = position?.toLowerCase() || '';
  if (pos.includes('raider')) return <Swords className="w-3.5 h-3.5 text-brand-gold" />;
  if (pos.includes('defender') || pos.includes('corner') || pos.includes('cover'))
    return <Shield className="w-3.5 h-3.5 text-green-500" />;
  return <Star className="w-3.5 h-3.5 text-brand-gold-dark" />;
}

function getPositionLabel(position: string | null, lang: string): string {
  if (!position) return t('findPlayers.unknown', lang as 'en' | 'hi');
  const pos = position.toLowerCase();
  if (pos.includes('raider') && !pos.includes('all')) return t('findPlayers.raider', lang as 'en' | 'hi');
  if (pos.includes('defender') || pos.includes('corner') || pos.includes('cover'))
    return t('findPlayers.defender', lang as 'en' | 'hi');
  if (pos.includes('all-rounder')) return t('findPlayers.allRounder', lang as 'en' | 'hi');
  return position;
}

function formatDistance(km: number): string {
  if (km < 1) return `${Math.round(km * 1000)}m`;
  return `${km}km`;
}

// ─── Skeleton ─────────────────────────────────────────────────────

function PlayerSkeleton() {
  return (
    <Card className="bg-white/80 dark:bg-warm-800/50 border-warm-200/50 dark:border-warm-700/50 animate-pulse">
      <CardContent className="p-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-full bg-warm-200 dark:bg-warm-700" />
          <div className="flex-1 space-y-2">
            <div className="h-4 w-24 bg-warm-200 dark:bg-warm-700 rounded" />
            <div className="h-3 w-16 bg-warm-200 dark:bg-warm-700 rounded" />
          </div>
          <div className="h-6 w-12 bg-warm-200 dark:bg-warm-700 rounded-full" />
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Component ────────────────────────────────────────────────────

export default function FindPlayersScreen({ onBack }: FindPlayersScreenProps) {
  const { currentUser, language } = useKabaddiStore();
  const { toast } = useToast();

  const [players, setPlayers] = useState<NearbyPlayer[]>([]);
  const [loading, setLoading] = useState(true);
  const [positionFilter, setPositionFilter] = useState<PositionFilter>('all');
  const [radiusFilter, setRadiusFilter] = useState<RadiusFilter>('25');
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [savingLocation, setSavingLocation] = useState(false);

  // Request geolocation
  const requestLocation = useCallback(() => {
    if (!navigator.geolocation) {
      setLocationError(t('findPlayers.gpsNotSupported', language as 'en' | 'hi'));
      setLoading(false);
      return;
    }

    setLoading(true);
    setLocationError(null);

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude } = pos.coords;
        setUserLocation({ lat: latitude, lng: longitude });
      },
      (err) => {
        console.error('Geolocation error:', err);
        setLocationError(t('findPlayers.gpsDenied', language as 'en' | 'hi'));
        setLoading(false);
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }, [language]);

  // Auto-request location on mount
  useEffect(() => {
    requestLocation();
  }, [requestLocation]);

  // Fetch nearby players when location or filters change
  useEffect(() => {
    if (!userLocation) return;

    const fetchPlayers = async () => {
      setLoading(true);
      try {
        const params = new URLSearchParams({
          lat: userLocation.lat.toString(),
          lng: userLocation.lng.toString(),
          radius: radiusFilter,
          excludeUserId: currentUser?.id || '',
        });
        if (positionFilter !== 'all') {
          params.set('position', positionFilter);
        }

        const res = await fetch(`/api/nearby-players?${params}`);
        if (!res.ok) throw new Error('Failed to fetch');
        const data = await res.json();
        setPlayers(data.players || []);
      } catch (err) {
        console.error('Fetch players error:', err);
        toast({ title: t('findPlayers.fetchError', language as 'en' | 'hi'), variant: 'destructive' });
      } finally {
        setLoading(false);
      }
    };

    fetchPlayers();
  }, [userLocation, positionFilter, radiusFilter, currentUser?.id, language, toast]);

  // Save location handler
  const handleSaveLocation = async () => {
    if (!userLocation || !currentUser) return;
    setSavingLocation(true);
    try {
      const res = await fetch('/api/player-location', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: currentUser.id,
          lat: userLocation.lat,
          lng: userLocation.lng,
        }),
      });
      if (!res.ok) throw new Error('Failed to save');
      toast({ title: t('findPlayers.locationSaved', language as 'en' | 'hi') });
    } catch {
      toast({ title: t('findPlayers.locationSaveError', language as 'en' | 'hi'), variant: 'destructive' });
    } finally {
      setSavingLocation(false);
    }
  };

  const positionFilters: { key: PositionFilter; label: string; icon: React.ReactNode }[] = [
    { key: 'all', label: t('findPlayers.allPositions', language as 'en' | 'hi'), icon: <Users className="w-3.5 h-3.5" /> },
    { key: 'raider', label: t('findPlayers.raider', language as 'en' | 'hi'), icon: <Swords className="w-3.5 h-3.5" /> },
    { key: 'defender', label: t('findPlayers.defender', language as 'en' | 'hi'), icon: <Shield className="w-3.5 h-3.5" /> },
    { key: 'all-rounder', label: t('findPlayers.allRounder', language as 'en' | 'hi'), icon: <Star className="w-3.5 h-3.5" /> },
  ];

  const radiusOptions: { key: RadiusFilter; label: string }[] = [
    { key: '1', label: '1km' },
    { key: '5', label: '5km' },
    { key: '10', label: '10km' },
    { key: '25', label: '25km' },
    { key: '50', label: '50km' },
  ];

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
            <h1 className="text-lg font-bold text-warm-800 dark:text-warm-100">
              {t('findPlayers.title', language as 'en' | 'hi')}
            </h1>
            <p className="text-xs text-warm-500 dark:text-warm-400">
              {t('findPlayers.subtitle', language as 'en' | 'hi')}
            </p>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={requestLocation}
            className="shrink-0 text-warm-500"
          >
            <Crosshair className="w-5 h-5" />
          </Button>
        </div>
      </div>

      <div className="px-4 pb-6 space-y-4">
        {/* Location Status */}
        {locationError && (
          <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
            <Card className="bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800">
              <CardContent className="p-3 flex items-center gap-2">
                <MapPin className="w-4 h-4 text-red-500 shrink-0" />
                <p className="text-sm text-red-700 dark:text-red-300">{locationError}</p>
              </CardContent>
            </Card>
          </motion.div>
        )}

        {userLocation && (
          <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
            <Card className="bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800">
              <CardContent className="p-3 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Navigation className="w-4 h-4 text-green-600 dark:text-green-400" />
                  <p className="text-sm text-green-700 dark:text-green-300">
                    {t('findPlayers.locationActive', language as 'en' | 'hi')}
                  </p>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleSaveLocation}
                  disabled={savingLocation}
                  className="h-7 text-xs gap-1 border-green-300 dark:border-green-700 text-green-700 dark:text-green-300"
                >
                  {savingLocation ? (
                    <Loader2 className="w-3 h-3 animate-spin" />
                  ) : (
                    <Save className="w-3 h-3" />
                  )}
                  {t('findPlayers.saveLocation', language as 'en' | 'hi')}
                </Button>
              </CardContent>
            </Card>
          </motion.div>
        )}

        {/* Position Filter */}
        <div>
          <div className="flex items-center gap-1.5 mb-2">
            <Filter className="w-3.5 h-3.5 text-warm-500" />
            <span className="text-xs font-medium text-warm-500 dark:text-warm-400 uppercase tracking-wide">
              {t('findPlayers.position', language as 'en' | 'hi')}
            </span>
          </div>
          <div className="flex gap-2 overflow-x-auto pb-1">
            {positionFilters.map((pf) => (
              <Button
                key={pf.key}
                size="sm"
                variant={positionFilter === pf.key ? 'default' : 'outline'}
                onClick={() => setPositionFilter(pf.key)}
                className={`h-8 text-xs gap-1 shrink-0 ${
                  positionFilter === pf.key
                    ? 'bg-brand-red hover:bg-brand-red/90 text-white'
                    : 'border-warm-200 dark:border-warm-700 text-warm-700 dark:text-warm-300'
                }`}
              >
                {pf.icon}
                {pf.label}
              </Button>
            ))}
          </div>
        </div>

        {/* Radius Filter */}
        <div>
          <div className="flex items-center gap-1.5 mb-2">
            <MapPin className="w-3.5 h-3.5 text-warm-500" />
            <span className="text-xs font-medium text-warm-500 dark:text-warm-400 uppercase tracking-wide">
              {t('findPlayers.radius', language as 'en' | 'hi')}
            </span>
          </div>
          <div className="flex gap-2">
            {radiusOptions.map((ro) => (
              <Button
                key={ro.key}
                size="sm"
                variant={radiusFilter === ro.key ? 'default' : 'outline'}
                onClick={() => setRadiusFilter(ro.key)}
                className={`h-8 text-xs shrink-0 ${
                  radiusFilter === ro.key
                    ? 'bg-brand-gold hover:bg-brand-gold-dark text-warm-800'
                    : 'border-warm-200 dark:border-warm-700 text-warm-700 dark:text-warm-300'
                }`}
              >
                {ro.label}
              </Button>
            ))}
          </div>
        </div>

        {/* Results Count */}
        {!loading && (
          <div className="flex items-center justify-between">
            <p className="text-sm text-warm-600 dark:text-warm-400">
              {players.length} {t('findPlayers.playersFound', language as 'en' | 'hi')}
            </p>
          </div>
        )}

        {/* Player List */}
        <div className="space-y-3">
          {loading ? (
            <>
              <PlayerSkeleton />
              <PlayerSkeleton />
              <PlayerSkeleton />
              <PlayerSkeleton />
              <PlayerSkeleton />
            </>
          ) : players.length === 0 ? (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="text-center py-12"
            >
              <Users className="w-12 h-12 mx-auto text-warm-300 dark:text-warm-600 mb-3" />
              <p className="text-warm-500 dark:text-warm-400 text-sm">
                {t('findPlayers.noPlayers', language as 'en' | 'hi')}
              </p>
              <p className="text-warm-400 dark:text-warm-500 text-xs mt-1">
                {t('findPlayers.tryLargerRadius', language as 'en' | 'hi')}
              </p>
            </motion.div>
          ) : (
            <AnimatePresence>
              {players.map((player, index) => (
                <motion.div
                  key={player.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  transition={{ delay: index * 0.05 }}
                >
                  <Card className="bg-white/80 dark:bg-warm-800/50 border-warm-200/50 dark:border-warm-700/50 hover:shadow-md transition-shadow">
                    <CardContent className="p-4">
                      <div className="flex items-center gap-3">
                        {/* Avatar */}
                        <div className="relative shrink-0">
                          {player.avatar ? (
                            <img
                              src={player.avatar}
                              alt={player.name || ''}
                              className="w-12 h-12 rounded-full object-cover border-2 border-warm-200 dark:border-warm-600"
                            />
                          ) : (
                            <div className="w-12 h-12 rounded-full bg-gradient-to-br from-brand-red to-brand-gold flex items-center justify-center text-white font-bold text-sm border-2 border-warm-200 dark:border-warm-600">
                              {getInitial(player.name)}
                            </div>
                          )}
                          {player.distance <= 5 && (
                            <div className="absolute -bottom-0.5 -right-0.5 w-4 h-4 bg-green-500 rounded-full border-2 border-white dark:border-warm-800 flex items-center justify-center">
                              <MapPin className="w-2 h-2 text-white" />
                            </div>
                          )}
                        </div>

                        {/* Info */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <h3 className="font-semibold text-sm text-warm-800 dark:text-warm-100 truncate">
                              {player.name || t('findPlayers.unknown', language as 'en' | 'hi')}
                            </h3>
                            {player.position && (
                              <div className="flex items-center gap-1">
                                {getPositionIcon(player.position)}
                              </div>
                            )}
                          </div>
                          <div className="flex items-center gap-2 mt-0.5">
                            <span className="text-xs text-warm-500 dark:text-warm-400">
                              {getPositionLabel(player.position, language)}
                            </span>
                            {player.weightCategory && (
                              <>
                                <span className="text-warm-300 dark:text-warm-600">·</span>
                                <span className="text-xs text-warm-500 dark:text-warm-400">
                                  {player.weightCategory}
                                </span>
                              </>
                            )}
                          </div>
                          <div className="flex items-center gap-3 mt-1">
                            {player.totalMatches > 0 && (
                              <span className="text-xs text-warm-400 dark:text-warm-500">
                                {player.totalMatches} {t('findPlayers.matches', language as 'en' | 'hi')}
                              </span>
                            )}
                            {player.overallRating > 0 && (
                              <div className="flex items-center gap-0.5">
                                <Star className="w-3 h-3 text-brand-gold fill-brand-gold" />
                                <span className="text-xs font-medium text-warm-600 dark:text-warm-300">
                                  {player.overallRating.toFixed(1)}
                                </span>
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Distance */}
                        <div className="shrink-0 text-right">
                          <Badge
                            variant="secondary"
                            className="bg-brand-gold/10 text-brand-gold-dark dark:bg-brand-gold/20 dark:text-brand-gold text-xs"
                          >
                            <Navigation className="w-3 h-3 mr-1" />
                            {formatDistance(player.distance)}
                          </Badge>
                          {player.area && (
                            <p className="text-[10px] text-warm-400 dark:text-warm-500 mt-0.5 truncate max-w-[80px]">
                              {player.area}
                            </p>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              ))}
            </AnimatePresence>
          )}
        </div>
      </div>
    </motion.div>
  );
}
