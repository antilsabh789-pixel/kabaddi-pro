'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowLeft,
  MapPin,
  Navigation,
  Trophy,
  Calendar,
  Users,
  Crosshair,
  Map,
  List,
  Zap,
  Plus,
  X,
  Phone,
  Wallet,
  User,
  Award,
  Send,
  Loader2,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useKabaddiStore } from '@/lib/store';
import { t } from '@/lib/i18n';
import { useToast } from '@/hooks/use-toast';

// ─── Types ────────────────────────────────────────────────────────

interface TournamentMapScreenProps {
  onBack: () => void;
}

type StatusFilter = 'all' | 'upcoming' | 'ongoing';
type RadiusFilter = '5' | '10' | '25' | '50' | '100' | 'everywhere';

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

interface CommunityTournament {
  id: string;
  name: string;
  date: string | null;
  venue: string | null;
  prizeMoney: string | null;
  weightCategory: string | null;
  playerName: string | null;
  coachName: string | null;
  organizerPhone: string | null;
  organizerPhone2: string | null;
  postedByName: string | null;
  createdAt: string;
}

// ─── Helpers ──────────────────────────────────────────────────────

function formatDate(dateStr: string | null, lang: string): string {
  if (!dateStr) return t('tournamentMap.dateTBD', lang as 'en' | 'hi');
  // Try ISO parse first, otherwise return as-is
  try {
    const date = new Date(dateStr);
    if (!isNaN(date.getTime())) {
      return date.toLocaleDateString(lang === 'hi' ? 'hi-IN' : 'en-IN', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      });
    }
  } catch { /* fall through */ }
  return dateStr;
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

// ─── Add Tournament Form ─────────────────────────────────────────

function AddTournamentForm({
  lang,
  onClose,
  onSubmitted,
}: {
  lang: string;
  onClose: () => void;
  onSubmitted: () => void;
}) {
  const { currentUser } = useKabaddiStore();
  const { toast } = useToast();
  const [submitting, setSubmitting] = useState(false);
  const nameRef = useRef<HTMLInputElement>(null);

  const [form, setForm] = useState({
    name: '',
    date: '',
    venue: '',
    prizeMoney: '',
    weightCategory: '',
    playerName: currentUser?.name || '',
    coachName: '',
    organizerPhone: '',
    organizerPhone2: '',
  });

  const updateField = (field: string, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async () => {
    if (!form.name.trim()) {
      toast({
        title: lang === 'hi' ? 'टूर्नामेंट का नाम जरूरी है' : 'Tournament name is required',
        variant: 'destructive',
      });
      nameRef.current?.focus();
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch('/api/community-tournaments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          postedBy: currentUser?.id || null,
          postedByName: currentUser?.name || null,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Failed to add tournament');
      }
      toast({
        title: lang === 'hi' ? 'टूर्नामेंट जोड़ दिया गया!' : 'Tournament added!',
        description: lang === 'hi' ? 'टूर्नामेंट सफलतापूर्वक जोड़ा गया' : 'Tournament posted successfully',
      });
      onSubmitted();
      onClose();
    } catch (err) {
      console.error('Add tournament error:', err);
      toast({
        title: lang === 'hi' ? 'त्रुटि' : 'Error',
        description: err instanceof Error ? err.message : (lang === 'hi' ? 'टूर्नामेंट जोड़ने में विफल' : 'Failed to add tournament'),
        variant: 'destructive',
      });
    } finally {
      setSubmitting(false);
    }
  };

  const inputClass =
    'w-full h-10 rounded-xl border border-warm-200 dark:border-warm-700 bg-white dark:bg-warm-800 px-3 text-sm text-warm-800 dark:text-warm-100 placeholder:text-warm-400 dark:placeholder:text-warm-500 focus:outline-none focus:ring-2 focus:ring-brand-red/30 focus:border-brand-red';

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[60] bg-black/40 backdrop-blur-sm flex items-end sm:items-center justify-center"
      onClick={onClose}
    >
      <motion.div
        initial={{ y: 100, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 100, opacity: 0 }}
        transition={{ type: 'spring', damping: 25, stiffness: 300 }}
        className="w-full max-w-lg bg-white dark:bg-warm-800 rounded-t-3xl sm:rounded-3xl max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="sticky top-0 z-10 bg-white/90 dark:bg-warm-800/90 backdrop-blur-md border-b border-warm-200 dark:border-warm-700 px-5 py-4 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-warm-800 dark:text-warm-100">
              {lang === 'hi' ? 'टूर्नामेंट जोड़ें' : 'Add Tournament'}
            </h2>
            <p className="text-xs text-warm-500">
              {lang === 'hi' ? 'कोई भी टूर्नामेंट की जानकारी जोड़ सकता है' : 'Anyone can post tournament details'}
            </p>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose} className="shrink-0 h-8 w-8">
            <X className="w-5 h-5" />
          </Button>
        </div>

        {/* Form */}
        <div className="p-5 space-y-4">
          {/* Tournament Name (required) */}
          <div>
            <label className="flex items-center gap-1.5 text-xs font-medium text-warm-600 dark:text-warm-400 mb-1.5">
              <Trophy className="w-3.5 h-3.5" />
              {lang === 'hi' ? 'टूर्नामेंट का नाम' : 'Tournament Name'} <span className="text-brand-red">*</span>
            </label>
            <Input
              ref={nameRef}
              value={form.name}
              onChange={(e) => updateField('name', e.target.value)}
              placeholder={lang === 'hi' ? 'जैसे: जिला कबड्डी प्रतियोगिता' : 'e.g. District Kabaddi Championship'}
              className={inputClass}
            />
          </div>

          {/* Date */}
          <div>
            <label className="flex items-center gap-1.5 text-xs font-medium text-warm-600 dark:text-warm-400 mb-1.5">
              <Calendar className="w-3.5 h-3.5" />
              {lang === 'hi' ? 'तारीख' : 'Date'}
            </label>
            <Input
              type="date"
              value={form.date}
              onChange={(e) => updateField('date', e.target.value)}
              className={inputClass}
            />
          </div>

          {/* Venue */}
          <div>
            <label className="flex items-center gap-1.5 text-xs font-medium text-warm-600 dark:text-warm-400 mb-1.5">
              <MapPin className="w-3.5 h-3.5" />
              {lang === 'hi' ? 'स्थान / वेन्यू' : 'Venue'}
            </label>
            <Input
              value={form.venue}
              onChange={(e) => updateField('venue', e.target.value)}
              placeholder={lang === 'hi' ? 'जैसे: जिला स्टेडियम, जयपुर' : 'e.g. District Stadium, Jaipur'}
              className={inputClass}
            />
          </div>

          {/* Prize Money */}
          <div>
            <label className="flex items-center gap-1.5 text-xs font-medium text-warm-600 dark:text-warm-400 mb-1.5">
              <Wallet className="w-3.5 h-3.5" />
              {lang === 'hi' ? 'इनाम राशि' : 'Prize Money'}
            </label>
            <Input
              value={form.prizeMoney}
              onChange={(e) => updateField('prizeMoney', e.target.value)}
              placeholder={lang === 'hi' ? 'जैसे: 51,000 रुपये' : 'e.g. 51,000 INR'}
              className={inputClass}
            />
          </div>

          {/* Weight Category */}
          <div>
            <label className="flex items-center gap-1.5 text-xs font-medium text-warm-600 dark:text-warm-400 mb-1.5">
              <Award className="w-3.5 h-3.5" />
              {lang === 'hi' ? 'वजन श्रेणी' : 'Weight Category'}
            </label>
            <Input
              value={form.weightCategory}
              onChange={(e) => updateField('weightCategory', e.target.value)}
              placeholder={lang === 'hi' ? 'जैसे: 65kg, 80kg से नीचे, Open' : 'e.g. 65kg, Below 80kg, Open'}
              className={inputClass}
            />
          </div>

          {/* Player / Coach Name */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="flex items-center gap-1.5 text-xs font-medium text-warm-600 dark:text-warm-400 mb-1.5">
                <User className="w-3.5 h-3.5" />
                {lang === 'hi' ? 'खिलाड़ी का नाम' : 'Player Name'}
              </label>
              <Input
                value={form.playerName}
                onChange={(e) => updateField('playerName', e.target.value)}
                placeholder={lang === 'hi' ? 'खिलाड़ी का नाम' : 'Player name'}
                className={inputClass}
              />
            </div>
            <div>
              <label className="flex items-center gap-1.5 text-xs font-medium text-warm-600 dark:text-warm-400 mb-1.5">
                <User className="w-3.5 h-3.5" />
                {lang === 'hi' ? 'कोच का नाम' : 'Coach Name'}
              </label>
              <Input
                value={form.coachName}
                onChange={(e) => updateField('coachName', e.target.value)}
                placeholder={lang === 'hi' ? 'कोच का नाम' : 'Coach name'}
                className={inputClass}
              />
            </div>
          </div>

          {/* Organizer Phone Numbers */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="flex items-center gap-1.5 text-xs font-medium text-warm-600 dark:text-warm-400 mb-1.5">
                <Phone className="w-3.5 h-3.5" />
                {lang === 'hi' ? 'organizer फोन' : 'Organizer Phone'}
              </label>
              <Input
                type="tel"
                value={form.organizerPhone}
                onChange={(e) => updateField('organizerPhone', e.target.value)}
                placeholder={lang === 'hi' ? 'फोन नंबर' : 'Phone number'}
                className={inputClass}
              />
            </div>
            <div>
              <label className="flex items-center gap-1.5 text-xs font-medium text-warm-600 dark:text-warm-400 mb-1.5">
                <Phone className="w-3.5 h-3.5" />
                {lang === 'hi' ? 'organizer फोन 2' : 'Organizer Phone 2'}
              </label>
              <Input
                type="tel"
                value={form.organizerPhone2}
                onChange={(e) => updateField('organizerPhone2', e.target.value)}
                placeholder={lang === 'hi' ? 'वैकल्पिक' : 'Optional'}
                className={inputClass}
              />
            </div>
          </div>

          {/* Submit */}
          <Button
            onClick={handleSubmit}
            disabled={submitting || !form.name.trim()}
            className="w-full h-12 bg-brand-red hover:bg-brand-red/90 text-white font-semibold rounded-xl mt-2"
          >
            {submitting ? (
              <Loader2 className="w-5 h-5 animate-spin mr-2" />
            ) : (
              <Send className="w-4 h-4 mr-2" />
            )}
            {submitting
              ? (lang === 'hi' ? 'जोड़ रहे हैं...' : 'Adding...')
              : (lang === 'hi' ? 'टूर्नामेंट जोड़ें' : 'Add Tournament')}
          </Button>
        </div>
      </motion.div>
    </motion.div>
  );
}

// ─── Community Tournament Card ───────────────────────────────────

function CommunityTournamentCard({ tournament, lang }: { tournament: CommunityTournament; lang: string }) {
  return (
    <Card className="bg-white/80 dark:bg-warm-800/50 border-warm-200/50 dark:border-warm-700/50 hover:shadow-md transition-shadow">
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          {/* Trophy Icon */}
          <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-brand-red/10 to-brand-gold/10 dark:from-brand-red/20 dark:to-brand-gold/20 flex items-center justify-center shrink-0">
            <Trophy className="w-5 h-5 text-brand-red" />
          </div>

          {/* Info */}
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-sm text-warm-800 dark:text-warm-100 truncate">
              {tournament.name}
            </h3>

            {/* Details grid */}
            <div className="mt-2 space-y-1.5">
              {/* Date */}
              {tournament.date && (
                <div className="flex items-center gap-1.5 text-xs text-warm-500 dark:text-warm-400">
                  <Calendar className="w-3 h-3 shrink-0" />
                  <span>{formatDate(tournament.date, lang)}</span>
                </div>
              )}

              {/* Venue */}
              {tournament.venue && (
                <div className="flex items-center gap-1.5 text-xs text-warm-500 dark:text-warm-400">
                  <MapPin className="w-3 h-3 shrink-0" />
                  <span className="truncate">{tournament.venue}</span>
                </div>
              )}

              {/* Prize Money */}
              {tournament.prizeMoney && (
                <div className="flex items-center gap-1.5 text-xs font-medium text-green-700 dark:text-green-400">
                  <Wallet className="w-3 h-3 shrink-0" />
                  <span>{tournament.prizeMoney}</span>
                </div>
              )}

              {/* Weight Category */}
              {tournament.weightCategory && (
                <Badge variant="outline" className="text-[10px] h-5 border-warm-200 dark:border-warm-700 text-warm-500">
                  <Award className="w-2.5 h-2.5 mr-1" />
                  {tournament.weightCategory}
                </Badge>
              )}

              {/* Player / Coach Name */}
              {(tournament.playerName || tournament.coachName) && (
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-warm-500 dark:text-warm-400">
                  {tournament.playerName && (
                    <div className="flex items-center gap-1">
                      <User className="w-3 h-3" />
                      <span>{tournament.playerName}</span>
                    </div>
                  )}
                  {tournament.coachName && (
                    <div className="flex items-center gap-1">
                      <User className="w-3 h-3" />
                      <span>{tournament.coachName}</span>
                    </div>
                  )}
                </div>
              )}

              {/* Organizer Phone Numbers */}
              {(tournament.organizerPhone || tournament.organizerPhone2) && (
                <div className="flex flex-wrap items-center gap-2 mt-1 pt-1.5 border-t border-warm-100 dark:border-warm-700/50">
                  {tournament.organizerPhone && (
                    <a
                      href={`tel:${tournament.organizerPhone}`}
                      className="inline-flex items-center gap-1 text-xs font-medium text-brand-red hover:text-brand-red/80 dark:text-red-400"
                    >
                      <Phone className="w-3 h-3" />
                      {tournament.organizerPhone}
                    </a>
                  )}
                  {tournament.organizerPhone2 && (
                    <a
                      href={`tel:${tournament.organizerPhone2}`}
                      className="inline-flex items-center gap-1 text-xs font-medium text-brand-red hover:text-brand-red/80 dark:text-red-400"
                    >
                      <Phone className="w-3 h-3" />
                      {tournament.organizerPhone2}
                    </a>
                  )}
                </div>
              )}

              {/* Posted by */}
              {tournament.postedByName && (
                <p className="text-[10px] text-warm-400 dark:text-warm-500 mt-1">
                  {lang === 'hi' ? 'द्वारा पोस्ट किया गया' : 'Posted by'}: {tournament.postedByName}
                </p>
              )}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Main Component ───────────────────────────────────────────────

export default function TournamentMapScreen({ onBack }: TournamentMapScreenProps) {
  const { language } = useKabaddiStore();
  const { toast } = useToast();

  // Nearby tournaments state
  const [tournaments, setTournaments] = useState<NearbyTournament[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [radiusFilter, setRadiusFilter] = useState<RadiusFilter>('everywhere');
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [locationError, setLocationError] = useState<string | null>(null);

  // Community tournaments state
  const [communityTournaments, setCommunityTournaments] = useState<CommunityTournament[]>([]);
  const [communityLoading, setCommunityLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);

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

  // Fetch nearby tournaments
  useEffect(() => {
    const fetchTournaments = async () => {
      setLoading(true);
      try {
        const params = new URLSearchParams({ radius: radiusFilter });
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

  // Fetch community tournaments
  const fetchCommunityTournaments = useCallback(async () => {
    setCommunityLoading(true);
    try {
      const res = await fetch('/api/community-tournaments');
      if (!res.ok) throw new Error('Failed to fetch');
      const data = await res.json();
      setCommunityTournaments(data.tournaments || []);
    } catch (err) {
      console.error('Fetch community tournaments error:', err);
    } finally {
      setCommunityLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCommunityTournaments();
  }, [fetchCommunityTournaments]);

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

  const hasAnyContent = tournaments.length > 0 || communityTournaments.length > 0;

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
          <Button variant="ghost" size="icon" onClick={requestLocation} className="h-8 w-8 text-warm-500">
            <Crosshair className="w-4 h-4" />
          </Button>
        </div>
      </div>

      <div className="px-4 pb-24 space-y-5">
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

        {/* ── Community Tournament Postings Section ── */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-bold text-warm-800 dark:text-warm-100 flex items-center gap-2">
              <Trophy className="w-4 h-4 text-brand-gold" />
              {language === 'hi' ? 'टूर्नामेंट मैप' : 'Tournament Map'}
            </h2>
            {!communityLoading && (
              <span className="text-xs text-warm-400">
                {communityTournaments.length} {language === 'hi' ? 'पोस्ट' : 'posts'}
              </span>
            )}
          </div>

          {communityLoading ? (
            <div className="space-y-3">
              <TournamentSkeleton />
              <TournamentSkeleton />
            </div>
          ) : communityTournaments.length === 0 ? (
            <Card className="bg-warm-50/50 dark:bg-warm-800/30 border-warm-200/30 dark:border-warm-700/30">
              <CardContent className="p-6 text-center">
                <Trophy className="w-10 h-10 mx-auto text-warm-300 dark:text-warm-600 mb-2" />
                <p className="text-sm text-warm-500 dark:text-warm-400">
                  {language === 'hi'
                    ? 'अभी कोई टूर्नामेंट पोस्ट नहीं हुआ'
                    : 'No tournaments posted yet'}
                </p>
                <p className="text-xs text-warm-400 dark:text-warm-500 mt-1">
                  {language === 'hi'
                    ? 'पहला टूर्नामेंट जोड़ने के लिए + बटन दबाएं'
                    : 'Tap the + button to add the first tournament'}
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              <AnimatePresence>
                {communityTournaments.map((ct, index) => (
                  <motion.div
                    key={ct.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.04 }}
                  >
                    <CommunityTournamentCard tournament={ct} lang={language} />
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          )}
        </div>

        {/* ── Nearby Tournaments Section (existing) ── */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-bold text-warm-800 dark:text-warm-100 flex items-center gap-2">
              <Map className="w-4 h-4 text-brand-red" />
              {language === 'hi' ? 'नज़दीकी टूर्नामेंट' : 'Nearby Tournaments'}
            </h2>
            {!loading && (
              <span className="text-xs text-warm-400">
                {tournaments.length} {t('tournamentMap.tournamentsFound', language as 'en' | 'hi')}
              </span>
            )}
          </div>

          {loading ? (
            <div className="space-y-3">
              <TournamentSkeleton />
              <TournamentSkeleton />
            </div>
          ) : tournaments.length === 0 ? (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center py-8">
              <Map className="w-10 h-10 mx-auto text-warm-300 dark:text-warm-600 mb-2" />
              <p className="text-warm-500 dark:text-warm-400 text-sm">
                {t('tournamentMap.noTournaments', language as 'en' | 'hi')}
              </p>
            </motion.div>
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
                      transition={{ delay: index * 0.04 }}
                    >
                      <Card className="bg-white/80 dark:bg-warm-800/50 border-warm-200/50 dark:border-warm-700/50 hover:shadow-md transition-shadow">
                        <CardContent className="p-4">
                          <div className="flex items-start gap-3">
                            <div className="w-10 h-10 rounded-lg bg-brand-red/10 dark:bg-brand-red/20 flex items-center justify-center shrink-0">
                              <Trophy className="w-5 h-5 text-brand-red" />
                            </div>
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
                              {tournament.weightCategory && (
                                <Badge variant="outline" className="text-[10px] h-5 border-warm-200 dark:border-warm-700 text-warm-500 mt-1.5">
                                  {tournament.weightCategory}
                                </Badge>
                              )}
                            </div>
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
      </div>

      {/* ── Floating Add Button ── */}
      <motion.div
        className="fixed bottom-24 right-4 z-50"
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        transition={{ type: 'spring', stiffness: 400, damping: 20, delay: 0.3 }}
      >
        <Button
          onClick={() => setShowAddForm(true)}
          className="w-14 h-14 rounded-full bg-gradient-to-br from-brand-red to-brand-red/90 hover:from-brand-red/90 hover:to-brand-red shadow-lg shadow-brand-red/30 text-white"
          whileTap={{ scale: 0.9 }}
        >
          <Plus className="w-7 h-7" />
        </Button>
      </motion.div>

      {/* ── Add Tournament Modal ── */}
      <AnimatePresence>
        {showAddForm && (
          <AddTournamentForm
            lang={language}
            onClose={() => setShowAddForm(false)}
            onSubmitted={fetchCommunityTournaments}
          />
        )}
      </AnimatePresence>
    </motion.div>
  );
}
