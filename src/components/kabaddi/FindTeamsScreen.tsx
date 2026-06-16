'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowLeft,
  MapPin,
  Navigation,
  Filter,
  Users,
  Trophy,
  Loader2,
  Crosshair,
  UserPlus,
  CheckCircle,
  Shield,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useKabaddiStore } from '@/lib/store';
import { t } from '@/lib/i18n';
import { useToast } from '@/hooks/use-toast';

// ─── Types ────────────────────────────────────────────────────────

interface FindTeamsScreenProps {
  onBack: () => void;
}

type RadiusFilter = '1' | '5' | '10' | '25' | '50';

interface NearbyTeam {
  id: string;
  name: string;
  shortName: string | null;
  teamCode: string | null;
  logo: string | null;
  color: string | null;
  memberCount: number;
  distance: number;
  city: string | null;
  area: string | null;
  isMember?: boolean;
}

// ─── Helpers ──────────────────────────────────────────────────────

function formatDistance(km: number): string {
  if (km < 1) return `${Math.round(km * 1000)}m`;
  return `${km}km`;
}

function getTeamInitial(name: string): string {
  return name.trim()[0]?.toUpperCase() || '?';
}

// ─── Skeleton ─────────────────────────────────────────────────────

function TeamSkeleton() {
  return (
    <Card className="bg-white/80 dark:bg-warm-800/50 border-warm-200/50 dark:border-warm-700/50 animate-pulse">
      <CardContent className="p-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-lg bg-warm-200 dark:bg-warm-700" />
          <div className="flex-1 space-y-2">
            <div className="h-4 w-32 bg-warm-200 dark:bg-warm-700 rounded" />
            <div className="h-3 w-20 bg-warm-200 dark:bg-warm-700 rounded" />
          </div>
          <div className="h-8 w-16 bg-warm-200 dark:bg-warm-700 rounded" />
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Component ────────────────────────────────────────────────────

export default function FindTeamsScreen({ onBack }: FindTeamsScreenProps) {
  const { currentUser, language } = useKabaddiStore();
  const { toast } = useToast();

  const [teams, setTeams] = useState<NearbyTeam[]>([]);
  const [loading, setLoading] = useState(true);
  const [radiusFilter, setRadiusFilter] = useState<RadiusFilter>('25');
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [joiningTeamId, setJoiningTeamId] = useState<string | null>(null);

  // Request geolocation
  const requestLocation = useCallback(() => {
    if (!navigator.geolocation) {
      setLocationError(t('findTeams.gpsNotSupported', language as 'en' | 'hi'));
      setLoading(false);
      return;
    }

    setLoading(true);
    setLocationError(null);

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setUserLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude });
      },
      (err) => {
        console.error('Geolocation error:', err);
        setLocationError(t('findTeams.gpsDenied', language as 'en' | 'hi'));
        setLoading(false);
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }, [language]);

  useEffect(() => {
    requestLocation();
  }, [requestLocation]);

  // Fetch nearby teams
  useEffect(() => {
    if (!userLocation) return;

    const fetchTeams = async () => {
      setLoading(true);
      try {
        const params = new URLSearchParams({
          lat: userLocation.lat.toString(),
          lng: userLocation.lng.toString(),
          radius: radiusFilter,
        });
        if (currentUser?.id) {
          params.set('excludeUserId', currentUser.id);
        }

        const res = await fetch(`/api/nearby-teams?${params}`);
        if (!res.ok) throw new Error('Failed to fetch');
        const data = await res.json();
        setTeams(data.teams || []);
      } catch (err) {
        console.error('Fetch teams error:', err);
        toast({ title: t('findTeams.fetchError', language as 'en' | 'hi'), variant: 'destructive' });
      } finally {
        setLoading(false);
      }
    };

    fetchTeams();
  }, [userLocation, radiusFilter, currentUser?.id, language, toast]);

  // Join team handler
  const handleJoinTeam = async (team: NearbyTeam) => {
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
        toast({ title: data.error || t('findTeams.joinError', language as 'en' | 'hi'), variant: 'destructive' });
        return;
      }
      toast({ title: t('findTeams.joinedSuccess', language as 'en' | 'hi') });
      // Remove team from list
      setTeams((prev) => prev.filter((t) => t.id !== team.id));
    } catch {
      toast({ title: t('findTeams.joinError', language as 'en' | 'hi'), variant: 'destructive' });
    } finally {
      setJoiningTeamId(null);
    }
  };

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
              {t('findTeams.title', language as 'en' | 'hi')}
            </h1>
            <p className="text-xs text-warm-500 dark:text-warm-400">
              {t('findTeams.subtitle', language as 'en' | 'hi')}
            </p>
          </div>
          <Button variant="ghost" size="icon" onClick={requestLocation} className="shrink-0 text-warm-500">
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
              <CardContent className="p-3 flex items-center gap-2">
                <Navigation className="w-4 h-4 text-green-600 dark:text-green-400" />
                <p className="text-sm text-green-700 dark:text-green-300">
                  {t('findTeams.locationActive', language as 'en' | 'hi')}
                </p>
              </CardContent>
            </Card>
          </motion.div>
        )}

        {/* Radius Filter */}
        <div>
          <div className="flex items-center gap-1.5 mb-2">
            <Filter className="w-3.5 h-3.5 text-warm-500" />
            <span className="text-xs font-medium text-warm-500 dark:text-warm-400 uppercase tracking-wide">
              {t('findTeams.radius', language as 'en' | 'hi')}
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
          <p className="text-sm text-warm-600 dark:text-warm-400">
            {teams.length} {t('findTeams.teamsFound', language as 'en' | 'hi')}
          </p>
        )}

        {/* Team List */}
        <div className="space-y-3">
          {loading ? (
            <>
              <TeamSkeleton />
              <TeamSkeleton />
              <TeamSkeleton />
              <TeamSkeleton />
            </>
          ) : teams.length === 0 ? (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center py-12">
              <Shield className="w-12 h-12 mx-auto text-warm-300 dark:text-warm-600 mb-3" />
              <p className="text-warm-500 dark:text-warm-400 text-sm">
                {t('findTeams.noTeams', language as 'en' | 'hi')}
              </p>
              <p className="text-warm-400 dark:text-warm-500 text-xs mt-1">
                {t('findTeams.tryLargerRadius', language as 'en' | 'hi')}
              </p>
            </motion.div>
          ) : (
            <AnimatePresence>
              {teams.map((team, index) => (
                <motion.div
                  key={team.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  transition={{ delay: index * 0.05 }}
                >
                  <Card className="bg-white/80 dark:bg-warm-800/50 border-warm-200/50 dark:border-warm-700/50 hover:shadow-md transition-shadow">
                    <CardContent className="p-4">
                      <div className="flex items-center gap-3">
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
                              {team.shortName ? team.shortName[0] : getTeamInitial(team.name)}
                            </div>
                          )}
                        </div>

                        {/* Team Info */}
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
                              {team.memberCount} {t('findTeams.members', language as 'en' | 'hi')}
                            </span>
                          </div>
                          {team.city && (
                            <div className="flex items-center gap-1 mt-0.5">
                              <MapPin className="w-3 h-3 text-warm-400" />
                              <span className="text-xs text-warm-400 dark:text-warm-500">{team.city}</span>
                            </div>
                          )}
                        </div>

                        {/* Distance + Join */}
                        <div className="shrink-0 flex flex-col items-end gap-2">
                          <Badge
                            variant="secondary"
                            className="bg-brand-gold/10 text-brand-gold-dark dark:bg-brand-gold/20 dark:text-brand-gold text-xs"
                          >
                            <Navigation className="w-3 h-3 mr-1" />
                            {formatDistance(team.distance)}
                          </Badge>
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
                            {t('findTeams.join', language as 'en' | 'hi')}
                          </Button>
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
