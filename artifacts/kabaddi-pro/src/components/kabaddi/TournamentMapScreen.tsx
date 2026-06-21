'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowLeft,
  MapPin,
  Navigation,
  Filter,
  Trophy,
  Calendar,
  Users,
  Loader2,
  Crosshair,
  Clock,
  Map,
  List,
  Zap,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useKabaddiStore } from '@/lib/store';
import { t } from '@/lib/i18n';
import { useToast } from '@/hooks/use-toast';

// ─── Types ────────────────────────────────────────────────────────

interface TournamentMapScreenProps {
  onBack: () => void;
}

type StatusFilter = 'all' | 'upcoming' | 'ongoing';
type RadiusFilter = '5' | '10' | '25' | '50' | '100' | 'everywhere';
type ViewMode = 'list' | 'grid';

interface NearbyTournament {
  id: string;
  name: string;
  tournamentCode: string | null;
  status: string;
  type: string;
  gender: string | null;
  weightCategory: string | null;
  startDate: string | null;
  endDate: string | null;
  venue: string | null;
  groundName: string | null;
  groundCity: string | null;
  teamCount: number;
  distance: number | null;
}

// ─── Helpers ──────────────────────────────────────────────────────

function formatDistance(km: number): string {
  if (km < 1) return `${Math.round(km * 1000)}m`;
  return `${km}km`;
}

function formatDate(dateStr: string | null, lang: string): string {
  if (!dateStr) return t('tournamentMap.dateTBD', lang as 'en' | 'hi');
  try {
    const date = new Date(dateStr);
    return date.toLocaleDateString(lang === 'hi' ? 'hi-IN' : 'en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  } catch {
    return dateStr;
  }
}

function getStatusColor(status: string): string {
  switch (status) {
    case 'ongoing':
      return 'bg-green-500';
    case 'upcoming':
      return 'bg-brand-gold';
    case 'completed':
      return 'bg-warm-400';
    default:
      return 'bg-warm-400';
  }
}

function getStatusBadge(status: string, lang: string): { label: string; className: string } {
  switch (status) {
    case 'ongoing':
      return {
        label: t('tournamentMap.ongoing', lang as 'en' | 'hi'),
        className: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
      };
    case 'upcoming':
      return {
        label: t('tournamentMap.upcoming', lang as 'en' | 'hi'),
        className: 'bg-brand-gold/10 text-brand-gold-dark dark:bg-brand-gold/20 dark:text-brand-gold',
      };
    default:
      return {
        label: status,
        className: 'bg-warm-100 text-warm-600 dark:bg-warm-700/30 dark:text-warm-400',
      };
  }
}

function getTournamentTypeLabel(type: string, lang: string): string {
  switch (type) {
    case 'knockout': return t('tournament.knockout', lang as 'en' | 'hi');
    case 'league': return t('tournament.league', lang as 'en' | 'hi');
    case 'hybrid': return t('tournament.hybrid', lang as 'en' | 'hi');
    default: return type;
  }
}

// ─── Skeleton ─────────────────────────────────────────────────────

function TournamentSkeleton() {
  return (
    <Card className="bg-white/80 dark:bg-warm-800/50 border-warm-200/50 dark:border-warm-700/50 animate-pulse">
      <CardContent className="p-4">
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="h-5 w-40 bg-warm-200 dark:bg-warm-700 rounded" />
            <div className="h-6 w-20 bg-warm-200 dark:bg-warm-700 rounded-full" />
          </div>
          <div className="h-3 w-28 bg-warm-200 dark:bg-warm-700 rounded" />
          <div className="flex gap-4">
            <div className="h-3 w-16 bg-warm-200 dark:bg-warm-700 rounded" />
            <div className="h-3 w-16 bg-warm-200 dark:bg-warm-700 rounded" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Component ────────────────────────────────────────────────────

export default function TournamentMapScreen({ onBack }: TournamentMapScreenProps) {
  const { language } = useKabaddiStore();
  const { toast } = useToast();

  const [tournaments, setTournaments] = useState<NearbyTournament[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [radiusFilter, setRadiusFilter] = useState<RadiusFilter>('everywhere');
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [locationError, setLocationError] = useState<string | null>(null);

  // Request geolocation
  const requestLocation = useCallback(() => {
    if (!navigator.geolocation) {
      setLocationError(t('tournamentMap.gpsNotSupported', language as 'en' | 'hi'));
      return;
    }

    setLocationError(null);

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setUserLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude });
      },
      (err) => {
        console.error('Geolocation error:', err);
        setLocationError(t('tournamentMap.gpsDenied', language as 'en' | 'hi'));
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }, [language]);

  useEffect(() => {
    requestLocation();
  }, [requestLocation]);

  // Fetch nearby tournaments — works with or without geolocation
  useEffect(() => {
    const fetchTournaments = async () => {
      setLoading(true);
      try {
        const params = new URLSearchParams({
          radius: radiusFilter,
        });
        if (userLocation) {
          params.set('lat', userLocation.lat.toString());
          params.set('lng', userLocation.lng.toString());
        }
        if (statusFilter !== 'all') {
          params.set('status', statusFilter);
        }

        const res = await fetch(`/api/nearby-tournaments?${params}`);
        if (!res.ok) throw new Error('Failed to fetch');
        const data = await res.json();
        setTournaments(data.tournaments || []);
      } catch (err) {
        console.error('Fetch tournaments error:', err);
        toast({ title: t('tournamentMap.fetchError', language as 'en' | 'hi'), variant: 'destructive' });
      } finally {
        setLoading(false);
      }
    };

    fetchTournaments();
  }, [userLocation, statusFilter, radiusFilter, language, toast]);

  const statusFilters: { key: StatusFilter; label: string }[] = [
    { key: 'all', label: t('tournamentMap.allStatus', language as 'en' | 'hi') },
    { key: 'upcoming', label: t('tournamentMap.upcoming', language as 'en' | 'hi') },
    { key: 'ongoing', label: t('tournamentMap.ongoing', language as 'en' | 'hi') },
  ];

  const radiusOptions: { key: RadiusFilter; label: string }[] = [
    { key: 'everywhere', label: t('tournamentMap.everywhere', language as 'en' | 'hi') },
    { key: '5', label: '5km' },
    { key: '10', label: '10km' },
    { key: '25', label: '25km' },
    { key: '50', label: '50km' },
    { key: '100', label: '100km' },
  ];

  return (
    <motion.div
      initial={{ x: 20, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      exit={{ x: -20, opacity: 0 }}
      className="fixed inset-0 z-50 bg-gradient-to-b from-warm-50 to-white dark:from-warm-800 dark:to-warm-900 overflow-y-auto"
    >
      {/* Header */}
      <div className="sticky top-0 z-10 bg-white/90 dark:bg-warm-800/90 backdrop-blur-md border-b border-warm-200 dark:border-warm-700">
        <div className="flex items-center gap-3 px-4 py-3">
          <Button variant="ghost" size="icon" onClick={onBack} className="shrink-0">
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div className="flex-1">
            <h1 className="text-lg font-bold text-warm-800 dark:text-warm-100">
              {t('tournamentMap.title', language as 'en' | 'hi')}
            </h1>
            <p className="text-xs text-warm-500 dark:text-warm-400">
              {t('tournamentMap.subtitle', language as 'en' | 'hi')}
            </p>
          </div>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setViewMode(viewMode === 'list' ? 'grid' : 'list')}
              className="h-8 w-8 text-warm-500"
            >
              {viewMode === 'list' ? <Map className="w-4 h-4" /> : <List className="w-4 h-4" />}
            </Button>
            <Button variant="ghost" size="icon" onClick={requestLocation} className="h-8 w-8 text-warm-500">
              <Crosshair className="w-4 h-4" />
            </Button>
          </div>
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
              <CardContent className="p-3 flex items-center gap-2">
                <Navigation className="w-4 h-4 text-green-600 dark:text-green-400" />
                <p className="text-sm text-green-700 dark:text-green-300">
                  {t('tournamentMap.locationActive', language as 'en' | 'hi')}
                </p>
              </CardContent>
            </Card>
          </motion.div>
        )}

        {/* Status Filter */}
        <div>
          <div className="flex items-center gap-1.5 mb-2">
            <Zap className="w-3.5 h-3.5 text-warm-500" />
            <span className="text-xs font-medium text-warm-500 dark:text-warm-400 uppercase tracking-wide">
              {t('tournamentMap.status', language as 'en' | 'hi')}
            </span>
          </div>
          <div className="flex gap-2">
            {statusFilters.map((sf) => (
              <Button
                key={sf.key}
                size="sm"
                variant={statusFilter === sf.key ? 'default' : 'outline'}
                onClick={() => setStatusFilter(sf.key)}
                className={`h-8 text-xs shrink-0 ${
                  statusFilter === sf.key
                    ? 'bg-brand-red hover:bg-brand-red/90 text-white'
                    : 'border-warm-200 dark:border-warm-700 text-warm-700 dark:text-warm-300'
                }`}
              >
                {sf.label}
              </Button>
            ))}
          </div>
        </div>

        {/* Radius Filter */}
        <div>
          <div className="flex items-center gap-1.5 mb-2">
            <MapPin className="w-3.5 h-3.5 text-warm-500" />
            <span className="text-xs font-medium text-warm-500 dark:text-warm-400 uppercase tracking-wide">
              {t('tournamentMap.radius', language as 'en' | 'hi')}
            </span>
          </div>
          <div className="flex gap-2 overflow-x-auto pb-1">
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
          <p className="text-sm text-warm-600 dark:text-warm-400">
            {tournaments.length} {t('tournamentMap.tournamentsFound', language as 'en' | 'hi')}
          </p>
        )}

        {/* Tournament Cards */}
        {loading ? (
          <div className="space-y-3">
            <TournamentSkeleton />
            <TournamentSkeleton />
            <TournamentSkeleton />
          </div>
        ) : tournaments.length === 0 ? (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center py-12">
            <Trophy className="w-12 h-12 mx-auto text-warm-300 dark:text-warm-600 mb-3" />
            <p className="text-warm-500 dark:text-warm-400 text-sm">
              {t('tournamentMap.noTournaments', language as 'en' | 'hi')}
            </p>
            <p className="text-warm-400 dark:text-warm-500 text-xs mt-1">
              {radiusFilter === 'everywhere'
                ? (language === 'hi' ? 'अभी कोई टूर्नामेंट उपलब्ध नहीं है' : 'No tournaments available right now')
                : t('tournamentMap.tryLargerRadius', language as 'en' | 'hi')}
            </p>
          </motion.div>
        ) : viewMode === 'grid' ? (
          <div className="grid grid-cols-2 gap-3">
            <AnimatePresence>
              {tournaments.map((tournament, index) => {
                const statusBadge = getStatusBadge(tournament.status, language);
                return (
                  <motion.div
                    key={tournament.id}
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    transition={{ delay: index * 0.05 }}
                  >
                    <Card className="bg-white/80 dark:bg-warm-800/50 border-warm-200/50 dark:border-warm-700/50 h-full">
                      <CardContent className="p-3 flex flex-col h-full">
                        {/* Status dot */}
                        <div className="flex items-center justify-between mb-2">
                          <div className={`w-2 h-2 rounded-full ${getStatusColor(tournament.status)}`} />
                          <Badge className={`text-[10px] h-5 ${statusBadge.className}`}>
                            {statusBadge.label}
                          </Badge>
                        </div>

                        {/* Name */}
                        <h3 className="font-semibold text-xs text-warm-800 dark:text-warm-100 line-clamp-2 mb-2">
                          {tournament.name}
                        </h3>

                        {/* Venue */}
                        <div className="flex items-center gap-1 mb-1">
                          <MapPin className="w-3 h-3 text-warm-400 shrink-0" />
                          <span className="text-[10px] text-warm-500 dark:text-warm-400 truncate">
                            {tournament.groundName || tournament.venue || t('tournamentMap.venueTBD', language as 'en' | 'hi')}
                          </span>
                        </div>

                        {/* Date */}
                        <div className="flex items-center gap-1 mb-2">
                          <Calendar className="w-3 h-3 text-warm-400 shrink-0" />
                          <span className="text-[10px] text-warm-500 dark:text-warm-400">
                            {formatDate(tournament.startDate, language)}
                          </span>
                        </div>

                        <div className="mt-auto flex items-center justify-between">
                          <div className="flex items-center gap-1">
                            <Users className="w-3 h-3 text-warm-400" />
                            <span className="text-[10px] text-warm-500">{tournament.teamCount}</span>
                          </div>
                          {typeof tournament.distance === 'number' && tournament.distance > 0 && (
                            <span className="text-[10px] font-medium text-brand-gold-dark dark:text-brand-gold">
                              {formatDistance(tournament.distance)}
                            </span>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>
        ) : (
          <div className="space-y-3">
            <AnimatePresence>
              {tournaments.map((tournament, index) => {
                const statusBadge = getStatusBadge(tournament.status, language);
                return (
                  <motion.div
                    key={tournament.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -20 }}
                    transition={{ delay: index * 0.05 }}
                  >
                    <Card className="bg-white/80 dark:bg-warm-800/50 border-warm-200/50 dark:border-warm-700/50 hover:shadow-md transition-shadow">
                      <CardContent className="p-4">
                        <div className="flex items-start gap-3">
                          {/* Trophy Icon */}
                          <div className="w-10 h-10 rounded-lg bg-brand-red/10 dark:bg-brand-red/20 flex items-center justify-center shrink-0">
                            <Trophy className="w-5 h-5 text-brand-red" />
                          </div>

                          {/* Info */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <h3 className="font-semibold text-sm text-warm-800 dark:text-warm-100 truncate">
                                {tournament.name}
                              </h3>
                              <Badge className={`text-[10px] h-5 shrink-0 ${statusBadge.className}`}>
                                {statusBadge.label}
                              </Badge>
                            </div>

                            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-warm-500 dark:text-warm-400">
                              {tournament.venue && (
                                <div className="flex items-center gap-1">
                                  <MapPin className="w-3 h-3" />
                                  <span className="truncate max-w-[120px]">{tournament.groundName || tournament.venue}</span>
                                </div>
                              )}
                              <div className="flex items-center gap-1">
                                <Calendar className="w-3 h-3" />
                                <span>{formatDate(tournament.startDate, language)}</span>
                              </div>
                              <div className="flex items-center gap-1">
                                <Users className="w-3 h-3" />
                                <span>{tournament.teamCount} {t('common.teams', language as 'en' | 'hi')}</span>
                              </div>
                            </div>

                            {/* Type & Gender */}
                            <div className="flex items-center gap-2 mt-1.5">
                              <Badge variant="outline" className="text-[10px] h-5 border-warm-200 dark:border-warm-700 text-warm-500">
                                {getTournamentTypeLabel(tournament.type, language)}
                              </Badge>
                              {tournament.gender && (
                                <Badge variant="outline" className="text-[10px] h-5 border-warm-200 dark:border-warm-700 text-warm-500">
                                  {tournament.gender === 'boys' ? t('home.boys', language as 'en' | 'hi') : t('home.girls', language as 'en' | 'hi')}
                                </Badge>
                              )}
                              {tournament.weightCategory && (
                                <Badge variant="outline" className="text-[10px] h-5 border-warm-200 dark:border-warm-700 text-warm-500">
                                  {tournament.weightCategory}
                                </Badge>
                              )}
                            </div>
                          </div>

                          {/* Distance */}
                          {typeof tournament.distance === 'number' && tournament.distance > 0 && (
                            <Badge
                              variant="secondary"
                              className="bg-brand-gold/10 text-brand-gold-dark dark:bg-brand-gold/20 dark:text-brand-gold text-xs shrink-0"
                            >
                              <Navigation className="w-3 h-3 mr-1" />
                              {formatDistance(tournament.distance)}
                            </Badge>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>
        )}
      </div>
    </motion.div>
  );
}
