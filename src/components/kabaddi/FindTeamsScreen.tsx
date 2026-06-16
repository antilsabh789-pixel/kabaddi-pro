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
  Building2,
  Sun,
  Lamp,
  Armchair,
  Car,
  Calendar,
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
type ActiveTab = 'teams' | 'grounds';

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
  groundName?: string | null;
  isMember?: boolean;
}

interface NearbyGround {
  id: string;
  name: string;
  address: string | null;
  city: string | null;
  state: string | null;
  surface: string | null;
  amenities: string | null;
  distance: number;
  matchCount: number;
  lat: number | null;
  lng: number | null;
}

// ─── Surface Config ───────────────────────────────────────────────

const SURFACE_CONFIG: Record<string, { label: string; color: string; bgClass: string; badgeClass: string; icon: string }> = {
  mat: { label: 'Mat', color: '#0d9488', bgClass: 'bg-teal-100 dark:bg-teal-900/30', badgeClass: 'bg-teal-100 text-teal-700 dark:bg-teal-900/40 dark:text-teal-300', icon: '🟩' },
  mud: { label: 'Mud', color: '#d97706', bgClass: 'bg-amber-100 dark:bg-amber-900/30', badgeClass: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300', icon: '🟫' },
  grass: { label: 'Grass', color: '#16a34a', bgClass: 'bg-green-100 dark:bg-green-900/30', badgeClass: 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300', icon: '🌿' },
  synthetic: { label: 'Synthetic', color: '#7c3aed', bgClass: 'bg-purple-100 dark:bg-purple-900/30', badgeClass: 'bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300', icon: '🔷' },
};

const AMENITY_CONFIG: Record<string, { label: string; icon: React.ReactNode }> = {
  lights: { label: 'Lights', icon: <Lamp className="w-3 h-3" /> },
  changing_room: { label: 'Changing Room', icon: <Building2 className="w-3 h-3" /> },
  seating: { label: 'Seating', icon: <Armchair className="w-3 h-3" /> },
  parking: { label: 'Parking', icon: <Car className="w-3 h-3" /> },
};

// ─── Helpers ──────────────────────────────────────────────────────

function formatDistance(km: number): string {
  if (km < 1) return `${Math.round(km * 1000)}m`;
  return `${km}km`;
}

function getTeamInitial(name: string): string {
  return name.trim()[0]?.toUpperCase() || '?';
}

function parseAmenities(amenities: string | null): string[] {
  if (!amenities) return [];
  try {
    const parsed = JSON.parse(amenities);
    if (Array.isArray(parsed)) return parsed;
    return [];
  } catch {
    return [];
  }
}

// ─── Skeletons ────────────────────────────────────────────────────

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

function GroundSkeleton() {
  return (
    <Card className="bg-white/80 dark:bg-warm-800/50 border-warm-200/50 dark:border-warm-700/50 animate-pulse">
      <CardContent className="p-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-warm-200 dark:bg-warm-700" />
          <div className="flex-1 space-y-2">
            <div className="h-4 w-36 bg-warm-200 dark:bg-warm-700 rounded" />
            <div className="h-3 w-24 bg-warm-200 dark:bg-warm-700 rounded" />
            <div className="h-3 w-16 bg-warm-200 dark:bg-warm-700 rounded" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Component ────────────────────────────────────────────────────

export default function FindTeamsScreen({ onBack }: FindTeamsScreenProps) {
  const { currentUser, language } = useKabaddiStore();
  const { toast } = useToast();

  const [activeTab, setActiveTab] = useState<ActiveTab>('teams');
  const [teams, setTeams] = useState<NearbyTeam[]>([]);
  const [grounds, setGrounds] = useState<NearbyGround[]>([]);
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

  // Fetch nearby teams & grounds
  useEffect(() => {
    if (!userLocation) return;

    const fetchData = async () => {
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

        // Fetch teams
        const teamsRes = await fetch(`/api/nearby-teams?${params}`);
        if (teamsRes.ok) {
          const teamsData = await teamsRes.json();
          setTeams(teamsData.teams || []);
        }

        // Fetch grounds nearby
        const groundsParams = new URLSearchParams({
          lat: userLocation.lat.toString(),
          lng: userLocation.lng.toString(),
          radius: radiusFilter,
        });
        const groundsRes = await fetch(`/api/nearby-grounds?${groundsParams}`);
        if (groundsRes.ok) {
          const groundsData = await groundsRes.json();
          setGrounds(groundsData.grounds || []);
        }
      } catch (err) {
        console.error('Fetch error:', err);
        toast({ title: t('findTeams.fetchError', language as 'en' | 'hi'), variant: 'destructive' });
      } finally {
        setLoading(false);
      }
    };

    fetchData();
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

  const currentItems = activeTab === 'teams' ? teams : grounds;
  const itemLabel = activeTab === 'teams'
    ? (teams.length === 1 ? '1 team found' : `${teams.length} teams found`)
    : (grounds.length === 1 ? '1 ground found' : `${grounds.length} grounds found`);

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

        {/* Tabs */}
        <div className="flex px-4 pb-2 gap-1">
          <button
            onClick={() => setActiveTab('teams')}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-semibold transition-all duration-200 ${
              activeTab === 'teams'
                ? 'bg-brand-red text-white shadow-md shadow-brand-red/25'
                : 'bg-warm-100 dark:bg-warm-700 text-warm-600 dark:text-warm-300 hover:bg-warm-200 dark:hover:bg-warm-600'
            }`}
          >
            <Shield className="w-3.5 h-3.5" />
            Teams
            {teams.length > 0 && (
              <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
                activeTab === 'teams' ? 'bg-white/20 text-white' : 'bg-warm-200 dark:bg-warm-600 text-warm-600 dark:text-warm-300'
              }`}>
                {teams.length}
              </span>
            )}
          </button>
          <button
            onClick={() => setActiveTab('grounds')}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-semibold transition-all duration-200 ${
              activeTab === 'grounds'
                ? 'bg-brand-gold text-warm-800 shadow-md shadow-brand-gold/25'
                : 'bg-warm-100 dark:bg-warm-700 text-warm-600 dark:text-warm-300 hover:bg-warm-200 dark:hover:bg-warm-600'
            }`}
          >
            <Building2 className="w-3.5 h-3.5" />
            Grounds
            {grounds.length > 0 && (
              <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
                activeTab === 'grounds' ? 'bg-white/30 text-warm-800' : 'bg-warm-200 dark:bg-warm-600 text-warm-600 dark:text-warm-300'
              }`}>
                {grounds.length}
              </span>
            )}
          </button>
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
            {itemLabel}
          </p>
        )}

        {/* Content */}
        <AnimatePresence mode="wait">
          {activeTab === 'teams' ? (
            <motion.div key="teams" initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 10 }} className="space-y-3">
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
                      <Card className="bg-white/80 dark:bg-warm-800/50 border-warm-200/50 dark:border-warm-700/50 hover:shadow-md transition-shadow border-l-4 border-l-blue-400 dark:border-l-blue-500">
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
                              {(team.groundName || team.city) && (
                                <div className="flex items-center gap-1 mt-0.5">
                                  <MapPin className="w-3 h-3 text-warm-400" />
                                  <span className="text-xs text-warm-400 dark:text-warm-500 truncate">
                                    {team.groundName || team.city}
                                  </span>
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
            </motion.div>
          ) : (
            <motion.div key="grounds" initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -10 }} className="space-y-3">
              {loading ? (
                <>
                  <GroundSkeleton />
                  <GroundSkeleton />
                  <GroundSkeleton />
                  <GroundSkeleton />
                </>
              ) : grounds.length === 0 ? (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center py-12">
                  <Building2 className="w-12 h-12 mx-auto text-warm-300 dark:text-warm-600 mb-3" />
                  <p className="text-warm-500 dark:text-warm-400 text-sm">
                    {t('findTeams.noGrounds', language as 'en' | 'hi')}
                  </p>
                  <p className="text-warm-400 dark:text-warm-500 text-xs mt-1">
                    {t('findTeams.tryLargerRadius', language as 'en' | 'hi')}
                  </p>
                </motion.div>
              ) : (
                <AnimatePresence>
                  {grounds.map((ground, index) => {
                    const surfaceConfig = ground.surface ? SURFACE_CONFIG[ground.surface] : null;
                    const amenities = parseAmenities(ground.amenities);
                    return (
                      <motion.div
                        key={ground.id}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -20 }}
                        transition={{ delay: index * 0.05 }}
                      >
                        <Card className={`bg-white/80 dark:bg-warm-800/50 border-warm-200/50 dark:border-warm-700/50 hover:shadow-md transition-shadow border-l-4 ${surfaceConfig ? `border-l-[${surfaceConfig.color}]` : 'border-l-warm-300 dark:border-l-warm-600'}`}>
                          <CardContent className="p-4">
                            <div className="flex items-start gap-3">
                              {/* Ground Icon */}
                              <div className={`shrink-0 w-12 h-12 rounded-xl flex items-center justify-center ${surfaceConfig?.bgClass || 'bg-warm-100 dark:bg-warm-700'}`}>
                                <Building2 className={`w-5 h-5 ${surfaceConfig ? '' : 'text-warm-400 dark:text-warm-500'}`} style={surfaceConfig ? { color: surfaceConfig.color } : undefined} />
                              </div>

                              {/* Ground Info */}
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <h3 className="font-semibold text-sm text-warm-800 dark:text-warm-100 truncate">
                                    {ground.name}
                                  </h3>
                                  {surfaceConfig && (
                                    <Badge className={`${surfaceConfig.badgeClass} text-[10px] h-5 border-0 font-semibold`}>
                                      {surfaceConfig.icon} {surfaceConfig.label}
                                    </Badge>
                                  )}
                                </div>

                                {ground.address && (
                                  <div className="flex items-center gap-1 mt-0.5">
                                    <MapPin className="w-3 h-3 text-warm-400 shrink-0" />
                                    <span className="text-xs text-warm-400 dark:text-warm-500 truncate">
                                      {ground.address}{ground.city ? `, ${ground.city}` : ''}
                                    </span>
                                  </div>
                                )}

                                {!ground.address && ground.city && (
                                  <div className="flex items-center gap-1 mt-0.5">
                                    <MapPin className="w-3 h-3 text-warm-400 shrink-0" />
                                    <span className="text-xs text-warm-400 dark:text-warm-500">
                                      {ground.city}{ground.state ? `, ${ground.state}` : ''}
                                    </span>
                                  </div>
                                )}

                                <div className="flex items-center gap-3 mt-1.5">
                                  <div className="flex items-center gap-1">
                                    <Calendar className="w-3 h-3 text-warm-400" />
                                    <span className="text-xs text-warm-500 dark:text-warm-400">
                                      {ground.matchCount} {ground.matchCount === 1 ? 'match' : 'matches'}
                                    </span>
                                  </div>
                                </div>

                                {/* Amenities */}
                                {amenities.length > 0 && (
                                  <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                                    {amenities.map((a) => {
                                      const config = AMENITY_CONFIG[a];
                                      return (
                                        <Badge key={a} variant="outline" className="text-[9px] h-5 gap-0.5 border-warm-200 dark:border-warm-600 text-warm-500 dark:text-warm-400">
                                          {config?.icon || null}
                                          {config?.label || a}
                                        </Badge>
                                      );
                                    })}
                                  </div>
                                )}
                              </div>

                              {/* Distance */}
                              <div className="shrink-0">
                                <Badge
                                  variant="secondary"
                                  className="bg-brand-gold/10 text-brand-gold-dark dark:bg-brand-gold/20 dark:text-brand-gold text-xs"
                                >
                                  <Navigation className="w-3 h-3 mr-1" />
                                  {formatDistance(ground.distance)}
                                </Badge>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      </motion.div>
                    );
                  })}
                </AnimatePresence>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}
