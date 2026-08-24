'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowLeft,
  MapPin,
  Navigation,
  Filter,
  Trophy,
  Loader2,
  Crosshair,
  Building2,
  Sun,
  Lamp,
  Armchair,
  Car,
  Calendar,
  Users,
  Shield,
  GraduationCap,
  Crown,
  Search,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useKabaddiStore } from '@/lib/store';
import { t } from '@/lib/i18n';
import { useToast } from '@/hooks/use-toast';

// ─── Types ────────────────────────────────────────────────────────

interface FindTeamsScreenProps {
  onBack: () => void;
}

type RadiusFilter = '1' | '5' | '10' | '25' | '50' | 'everywhere';
type Section = 'all' | 'grounds' | 'academies' | 'teams';

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

interface AcademyItem {
  id: string;
  name: string;
  address: string | null;
  city: string | null;
  state: string | null;
  surface: null;
  amenities: null;
  lat: number | null;
  lng: number | null;
  mapLink: string | null;
  isAcademy: true;
  coachName: string | null;
  coachAvatar: string | null;
  groundName: string | null;
  playerCount: number;
  matchCount: 0;
  distance: 0;
}

interface TeamItem {
  id: string;
  name: string;
  shortName: string | null;
  teamCode: string | null;
  logo: string | null;
  color: string | null;
  memberCount: number;
  captain: { id: string; name: string | null; avatar: string | null } | null;
  createdAt: string;
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

function ItemSkeleton() {
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
  const { language, currentUser } = useKabaddiStore();
  const { toast } = useToast();

  const [grounds, setGrounds] = useState<NearbyGround[]>([]);
  const [academies, setAcademies] = useState<AcademyItem[]>([]);
  const [teams, setTeams] = useState<TeamItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [radiusFilter, setRadiusFilter] = useState<RadiusFilter>('everywhere');
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [section, setSection] = useState<Section>('all');
  const [search, setSearch] = useState('');

  // Request geolocation — non-blocking: list still loads without GPS
  const requestLocation = useCallback(() => {
    if (!navigator.geolocation) {
      setLocationError(t('findTeams.gpsNotSupported', language as 'en' | 'hi'));
      return;
    }
    setLocationError(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setUserLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude });
      },
      (err) => {
        console.error('Geolocation error:', err);
        setLocationError(t('findTeams.gpsDenied', language as 'en' | 'hi'));
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }, [language]);

  useEffect(() => {
    requestLocation();
  }, [requestLocation]);

  // Fetch grounds + academies + teams in parallel
  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const params = new URLSearchParams({ radius: radiusFilter });
        if (userLocation) {
          params.set('lat', userLocation.lat.toString());
          params.set('lng', userLocation.lng.toString());
        }

        const [groundsRes, academiesRes, teamsRes] = await Promise.all([
          fetch(`/api/nearby-grounds?${params}`),
          fetch('/api/academies/public'),
          fetch('/api/teams/discover?limit=200'),
        ]);

        if (groundsRes.ok) {
          const groundsData = await groundsRes.json();
          setGrounds(groundsData.grounds || []);
        }
        if (academiesRes.ok) {
          const academiesData = await academiesRes.json();
          setAcademies(academiesData.academies || []);
        }
        if (teamsRes.ok) {
          const teamsData = await teamsRes.json();
          setTeams(teamsData.teams || []);
        }
      } catch (err) {
        console.error('Fetch error:', err);
        toast({ title: t('findTeams.fetchError', language as 'en' | 'hi'), variant: 'destructive' });
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [userLocation, radiusFilter, language, toast]);

  const radiusOptions: { key: RadiusFilter; label: string }[] = [
    { key: 'everywhere', label: t('findTeams.everywhere', language as 'en' | 'hi') },
    { key: '1', label: '1km' },
    { key: '5', label: '5km' },
    { key: '10', label: '10km' },
    { key: '25', label: '25km' },
    { key: '50', label: '50km' },
  ];

  // Search filter applied client-side across all three lists
  const searchLower = search.trim().toLowerCase();
  const filteredGrounds = searchLower
    ? grounds.filter((g) =>
        (g.name || '').toLowerCase().includes(searchLower) ||
        (g.city || '').toLowerCase().includes(searchLower) ||
        (g.address || '').toLowerCase().includes(searchLower)
      )
    : grounds;
  const filteredAcademies = searchLower
    ? academies.filter((a) =>
        (a.name || '').toLowerCase().includes(searchLower) ||
        (a.address || '').toLowerCase().includes(searchLower) ||
        (a.coachName || '').toLowerCase().includes(searchLower)
      )
    : academies;
  const filteredTeams = searchLower
    ? teams.filter((tm) =>
        (tm.name || '').toLowerCase().includes(searchLower) ||
        (tm.teamCode || '').toLowerCase().includes(searchLower)
      )
    : teams;

  const sections: { key: Section; label: string; count: number; icon: React.ReactNode; color: string }[] = [
    { key: 'all', label: language === 'hi' ? 'सभी' : 'All', count: filteredGrounds.length + filteredAcademies.length + filteredTeams.length, icon: <Filter className="w-3.5 h-3.5" />, color: 'bg-brand-red' },
    { key: 'grounds', label: language === 'hi' ? 'मैदान' : 'Grounds', count: filteredGrounds.length, icon: <MapPin className="w-3.5 h-3.5" />, color: 'bg-teal-500' },
    { key: 'academies', label: language === 'hi' ? 'अकादमी' : 'Academies', count: filteredAcademies.length, icon: <GraduationCap className="w-3.5 h-3.5" />, color: 'bg-purple-500' },
    { key: 'teams', label: language === 'hi' ? 'टीमें' : 'Teams', count: filteredTeams.length, icon: <Shield className="w-3.5 h-3.5" />, color: 'bg-blue-500' },
  ];

  const showGrounds = section === 'all' || section === 'grounds';
  const showAcademies = section === 'all' || section === 'academies';
  const showTeams = section === 'all' || section === 'teams';

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
          <div className="flex-1 min-w-0">
            <h1 className="text-lg font-bold text-warm-800 dark:text-warm-100 truncate">
              {t('findTeams.groundsTitle', language as 'en' | 'hi')}
            </h1>
            <p className="text-xs text-warm-500 dark:text-warm-400 truncate">
              {t('findTeams.groundsSubtitle', language as 'en' | 'hi')}
            </p>
          </div>
          <Button variant="ghost" size="icon" onClick={requestLocation} className="shrink-0 text-warm-500">
            <Crosshair className="w-5 h-5" />
          </Button>
        </div>

        {/* Search bar */}
        <div className="px-4 pb-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-warm-400" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={language === 'hi' ? 'खोजें...' : 'Search...'}
              className="h-9 pl-9 rounded-xl bg-warm-50 dark:bg-warm-700/50 border-warm-200 dark:border-warm-700 text-sm"
            />
          </div>
        </div>

        {/* Section tabs */}
        <div className="flex gap-2 px-4 pb-2 overflow-x-auto">
          {sections.map((s) => (
            <Button
              key={s.key}
              size="sm"
              variant={section === s.key ? 'default' : 'outline'}
              onClick={() => setSection(s.key)}
              className={`h-8 text-xs shrink-0 gap-1.5 ${
                section === s.key
                  ? `${s.color} hover:opacity-90 text-white border-0`
                  : 'border-warm-200 dark:border-warm-700 text-warm-700 dark:text-warm-300'
              }`}
            >
              {s.icon}
              {s.label}
              <span className={`text-[10px] font-semibold px-1 rounded-full ${
                section === s.key ? 'bg-white/20' : 'bg-warm-100 dark:bg-warm-700'
              }`}>
                {s.count}
              </span>
            </Button>
          ))}
        </div>
      </div>

      <div className="px-4 pb-6 space-y-5">
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
          <div className="flex gap-2 flex-wrap">
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

        {loading ? (
          <div className="space-y-3">
            <ItemSkeleton />
            <ItemSkeleton />
            <ItemSkeleton />
            <ItemSkeleton />
          </div>
        ) : (
          <>
            {/* ─── GROUNDS ─── */}
            {showGrounds && (
              <div className="space-y-3">
                <div className="flex items-center gap-2 mt-2">
                  <MapPin className="w-4 h-4 text-teal-500" />
                  <h2 className="text-sm font-bold text-warm-800 dark:text-warm-100">
                    {language === 'hi' ? 'मैदान' : 'Grounds'}
                  </h2>
                  <Badge variant="secondary" className="text-[10px] bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-300">
                    {filteredGrounds.length}
                  </Badge>
                </div>
                {filteredGrounds.length === 0 ? (
                  <p className="text-center text-sm text-warm-500 dark:text-warm-400 py-4">
                    {t('findTeams.noGrounds', language as 'en' | 'hi')}
                  </p>
                ) : (
                  <AnimatePresence>
                    {filteredGrounds.map((ground, index) => {
                      const surfaceConfig = ground.surface ? SURFACE_CONFIG[ground.surface] : null;
                      const amenities = parseAmenities(ground.amenities);
                      return (
                        <motion.div
                          key={ground.id}
                          initial={{ opacity: 0, y: 20 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -20 }}
                          transition={{ delay: index * 0.04 }}
                        >
                          <Card className={`bg-white/80 dark:bg-warm-800/50 border-warm-200/50 dark:border-warm-700/50 hover:shadow-md transition-shadow border-l-4 ${surfaceConfig ? `border-l-[${surfaceConfig.color}]` : 'border-l-warm-300 dark:border-l-warm-600'}`}>
                            <CardContent className="p-4">
                              <div className="flex items-start gap-3">
                                <div className={`shrink-0 w-12 h-12 rounded-xl flex items-center justify-center ${surfaceConfig?.bgClass || 'bg-warm-100 dark:bg-warm-700'}`}>
                                  <Building2 className={`w-5 h-5 ${surfaceConfig ? '' : 'text-warm-400 dark:text-warm-500'}`} style={surfaceConfig ? { color: surfaceConfig.color } : undefined} />
                                </div>
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
                                  <div className="flex items-center gap-3 mt-1.5">
                                    <div className="flex items-center gap-1">
                                      <Calendar className="w-3 h-3 text-warm-400" />
                                      <span className="text-xs text-warm-500 dark:text-warm-400">
                                        {ground.matchCount} {ground.matchCount === 1 ? 'match' : 'matches'}
                                      </span>
                                    </div>
                                  </div>
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
                                {typeof ground.distance === 'number' && ground.distance > 0 && (
                                  <div className="shrink-0">
                                    <Badge variant="secondary" className="bg-brand-gold/10 text-brand-gold-dark dark:bg-brand-gold/20 dark:text-brand-gold text-xs">
                                      <Navigation className="w-3 h-3 mr-1" />
                                      {formatDistance(ground.distance)}
                                    </Badge>
                                  </div>
                                )}
                              </div>
                            </CardContent>
                          </Card>
                        </motion.div>
                      );
                    })}
                  </AnimatePresence>
                )}
              </div>
            )}

            {/* ─── ACADEMIES ─── */}
            {showAcademies && (
              <div className="space-y-3">
                <div className="flex items-center gap-2 mt-2">
                  <GraduationCap className="w-4 h-4 text-purple-500" />
                  <h2 className="text-sm font-bold text-warm-800 dark:text-warm-100">
                    {language === 'hi' ? 'अकादमी' : 'Academies'}
                  </h2>
                  <Badge variant="secondary" className="text-[10px] bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300">
                    {filteredAcademies.length}
                  </Badge>
                </div>
                {filteredAcademies.length === 0 ? (
                  <p className="text-center text-sm text-warm-500 dark:text-warm-400 py-4">
                    {language === 'hi' ? 'कोई अकादमी नहीं मिली' : 'No academies found'}
                  </p>
                ) : (
                  <AnimatePresence>
                    {filteredAcademies.map((academy, index) => (
                      <motion.div
                        key={academy.id}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -20 }}
                        transition={{ delay: index * 0.04 }}
                      >
                        <Card className="bg-white/80 dark:bg-warm-800/50 border-warm-200/50 dark:border-warm-700/50 hover:shadow-md transition-shadow border-l-4 border-l-purple-400">
                          <CardContent className="p-4">
                            <div className="flex items-start gap-3">
                              <div className="shrink-0 w-12 h-12 rounded-xl flex items-center justify-center bg-purple-100 dark:bg-purple-900/30">
                                <GraduationCap className="w-5 h-5 text-purple-600 dark:text-purple-400" />
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <h3 className="font-semibold text-sm text-warm-800 dark:text-warm-100 truncate">
                                    {academy.name}
                                  </h3>
                                  <Badge className="text-[10px] h-5 border-0 font-semibold bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300">
                                    ACADEMY
                                  </Badge>
                                </div>
                                {academy.groundName && (
                                  <p className="text-xs text-warm-500 dark:text-warm-400 mt-0.5 truncate">
                                    {academy.groundName}
                                  </p>
                                )}
                                {academy.address && (
                                  <div className="flex items-center gap-1 mt-0.5">
                                    <MapPin className="w-3 h-3 text-warm-400 shrink-0" />
                                    <span className="text-xs text-warm-400 dark:text-warm-500 truncate">
                                      {academy.address}
                                    </span>
                                  </div>
                                )}
                                {academy.coachName && (
                                  <div className="flex items-center gap-1 mt-1">
                                    <Crown className="w-3 h-3 text-brand-gold" />
                                    <span className="text-xs text-warm-600 dark:text-warm-300 font-medium">
                                      {academy.coachName}
                                    </span>
                                  </div>
                                )}
                                <div className="flex items-center gap-3 mt-1.5">
                                  <div className="flex items-center gap-1">
                                    <Users className="w-3 h-3 text-warm-400" />
                                    <span className="text-xs text-warm-500 dark:text-warm-400">
                                      {academy.playerCount} {language === 'hi' ? 'खिलाड़ी' : 'players'}
                                    </span>
                                  </div>
                                </div>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      </motion.div>
                    ))}
                  </AnimatePresence>
                )}
              </div>
            )}

            {/* ─── TEAMS ─── */}
            {showTeams && (
              <div className="space-y-3">
                <div className="flex items-center gap-2 mt-2">
                  <Shield className="w-4 h-4 text-blue-500" />
                  <h2 className="text-sm font-bold text-warm-800 dark:text-warm-100">
                    {language === 'hi' ? 'टीमें' : 'Teams'}
                  </h2>
                  <Badge variant="secondary" className="text-[10px] bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300">
                    {filteredTeams.length}
                  </Badge>
                </div>
                {filteredTeams.length === 0 ? (
                  <p className="text-center text-sm text-warm-500 dark:text-warm-400 py-4">
                    {t('findTeams.noTeams', language as 'en' | 'hi')}
                  </p>
                ) : (
                  <AnimatePresence>
                    {filteredTeams.map((team, index) => (
                      <motion.div
                        key={team.id}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -20 }}
                        transition={{ delay: index * 0.04 }}
                      >
                        <Card className="bg-white/80 dark:bg-warm-800/50 border-warm-200/50 dark:border-warm-700/50 hover:shadow-md transition-shadow border-l-4 border-l-blue-400">
                          <CardContent className="p-4">
                            <div className="flex items-start gap-3">
                              <div
                                className="shrink-0 w-12 h-12 rounded-xl flex items-center justify-center text-white font-bold text-lg"
                                style={{ backgroundColor: team.color || '#3b82f6' }}
                              >
                                {team.logo ? (
                                  <img src={team.logo} alt={team.name} className="w-full h-full object-cover rounded-xl" />
                                ) : (
                                  team.shortName?.charAt(0) || team.name.charAt(0)
                                )}
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <h3 className="font-semibold text-sm text-warm-800 dark:text-warm-100 truncate">
                                    {team.name}
                                  </h3>
                                  {team.teamCode && (
                                    <Badge variant="outline" className="text-[10px] h-5 border-blue-200 dark:border-blue-700 text-blue-600 dark:text-blue-300">
                                      {team.teamCode}
                                    </Badge>
                                  )}
                                </div>
                                {team.captain?.name && (
                                  <div className="flex items-center gap-1 mt-0.5">
                                    <Crown className="w-3 h-3 text-brand-gold" />
                                    <span className="text-xs text-warm-600 dark:text-warm-300">
                                      {team.captain.name}
                                    </span>
                                  </div>
                                )}
                                <div className="flex items-center gap-3 mt-1.5">
                                  <div className="flex items-center gap-1">
                                    <Users className="w-3 h-3 text-warm-400" />
                                    <span className="text-xs text-warm-500 dark:text-warm-400">
                                      {team.memberCount} {language === 'hi' ? 'सदस्य' : 'members'}
                                    </span>
                                  </div>
                                </div>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      </motion.div>
                    ))}
                  </AnimatePresence>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </motion.div>
  );
}
