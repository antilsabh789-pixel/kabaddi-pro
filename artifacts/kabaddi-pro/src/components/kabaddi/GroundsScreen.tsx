'use client';

import { useState, useEffect, useCallback, useRef, lazy, Suspense } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X,
  MapPin,
  Plus,
  Search,
  Building2,
  CheckCircle,
  Loader2,
  Sun,
  ShowerHead,
  Armchair,
  Car,
  ChevronDown,
  ChevronUp,
  ArrowUpDown,
  Trophy,
  Calendar,
  Navigation,
  Star,
  Clock,
  Layers,
  Map as MapIcon,
  List,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useKabaddiStore } from '@/lib/store';
import { useToast } from '@/hooks/use-toast';

// Lazy-load the map view — Leaflet is ~150 KB and not needed on first paint.
// Code-splitting keeps the initial bundle small for users who only browse the list.
const GroundsMapView = lazy(() => import('./GroundsMapView'));

// ─── Types ────────────────────────────────────────────────────────

interface Ground {
  id: string;
  name: string;
  address: string | null;
  city: string | null;
  state: string | null;
  surface: string | null;
  amenities: string | null;
  lat: number | null;
  lng: number | null;
  mapLink: string | null;
  createdAt: string;
  _count: { matches: number };
  matches?: Array<{
    id: string;
    status: string;
    homeScore: number;
    awayScore: number;
    homeTeam: { name: string; shortName: string | null; color: string | null };
    awayTeam: { name: string; shortName: string | null; color: string | null };
    tournament: { name: string } | null;
    completedAt: string | null;
    createdAt: string;
  }>;
}

type SurfaceFilter = 'all' | 'mat' | 'mud' | 'grass' | 'synthetic';
type SortOption = 'newest' | 'popular' | 'nearest';

interface GroundFormState {
  name: string;
  address: string;
  city: string;
  state: string;
  surface: string;
  mapLink: string;
  hasLights: boolean;
  hasChangingRoom: boolean;
  hasSeating: boolean;
  hasParking: boolean;
}

// ─── Constants ────────────────────────────────────────────────────

const SURFACE_CONFIG: Record<string, { label: string; color: string; bgLight: string; bgDark: string; borderLight: string; borderDark: string; desc: string }> = {
  mat: {
    label: 'Pro Mat',
    color: 'text-teal-700 dark:text-teal-300',
    bgLight: 'bg-teal-50',
    bgDark: 'dark:bg-teal-900/30',
    borderLight: 'border-l-teal-500',
    borderDark: 'dark:border-l-teal-400',
    desc: 'Professional mat surface used in league and international matches',
  },
  mud: {
    label: 'Mud / Clay',
    color: 'text-amber-700 dark:text-amber-300',
    bgLight: 'bg-amber-50',
    bgDark: 'dark:bg-amber-900/30',
    borderLight: 'border-l-amber-500',
    borderDark: 'dark:border-l-amber-400',
    desc: 'Traditional mud/clay surface, popular in rural tournaments',
  },
  grass: {
    label: 'Grass',
    color: 'text-green-700 dark:text-green-300',
    bgLight: 'bg-green-50',
    bgDark: 'dark:bg-green-900/30',
    borderLight: 'border-l-green-500',
    borderDark: 'dark:border-l-green-400',
    desc: 'Natural grass surface, ideal for practice sessions',
  },
  synthetic: {
    label: 'Synthetic',
    color: 'text-purple-700 dark:text-purple-300',
    bgLight: 'bg-purple-50',
    bgDark: 'dark:bg-purple-900/30',
    borderLight: 'border-l-purple-500',
    borderDark: 'dark:border-l-purple-400',
    desc: 'Synthetic rubber surface, durable all-weather playing area',
  },
};

const AMENITY_CONFIG: Record<string, { label: string; icon: React.ComponentType<{ className?: string }> }> = {
  lights: { label: 'Floodlights', icon: Sun },
  changing_room: { label: 'Changing Room', icon: ShowerHead },
  seating: { label: 'Seating', icon: Armchair },
  parking: { label: 'Parking', icon: Car },
};

// ─── Helpers ──────────────────────────────────────────────────────

function parseAmenities(amenities: string | null): string[] {
  if (!amenities) return [];
  try {
    const parsed = JSON.parse(amenities);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function formatDistance(lat1: number, lng1: number, lat2: number, lng2: number): string {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) *
    Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const d = R * c;
  return d < 1 ? `${Math.round(d * 1000)}m` : `${d.toFixed(1)}km`;
}

function getSurfaceBorderClass(surface: string | null): string {
  if (!surface) return 'border-l-warm-300 dark:border-l-warm-600';
  const config = SURFACE_CONFIG[surface];
  if (!config) return 'border-l-warm-300 dark:border-l-warm-600';
  return `${config.borderLight} ${config.borderDark}`;
}

function getSurfaceBadgeClass(surface: string | null): string {
  if (!surface) return 'bg-warm-100 dark:bg-warm-700 text-warm-600 dark:text-warm-300';
  const config = SURFACE_CONFIG[surface];
  if (!config) return 'bg-warm-100 dark:bg-warm-700 text-warm-600 dark:text-warm-300';
  return `${config.bgLight} ${config.bgDark} ${config.color}`;
}

// ════════════════════════════════════════════════════════════════
// MODULE-LEVEL COMPONENTS (moved outside to prevent remounting on
// every parent re-render — the root cause of "typing doesn't work"
// in the Add Ground form)
// ════════════════════════════════════════════════════════════════

// ─── Filter Pill ──────────────────────────────────────────────────
function FilterPill<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { label: string; value: T }[];
  value: T;
  onChange: (val: T) => void;
}) {
  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      {options.map((opt) => (
        <motion.button
          key={opt.value}
          onClick={() => onChange(opt.value)}
          className={`px-2.5 py-1 rounded-full text-[10px] font-semibold transition-all duration-200 ${
            value === opt.value
              ? 'bg-warm-800 dark:bg-warm-100 text-warm-50 dark:text-warm-900 shadow-sm'
              : 'bg-warm-100 dark:bg-warm-700 text-warm-600 dark:text-warm-400 hover:bg-warm-200 dark:hover:bg-warm-600'
          }`}
          whileTap={{ scale: 0.95 }}
        >
          {opt.label}
        </motion.button>
      ))}
    </div>
  );
}

// ─── Ground Card ──────────────────────────────────────────────────
function GroundCard({
  ground,
  userLat,
  userLng,
  onSelect,
  onViewDetail,
}: {
  ground: Ground;
  userLat: number | null;
  userLng: number | null;
  onSelect?: (groundId: string, groundName: string) => void;
  onViewDetail: (groundId: string) => void;
}) {
  const amenities = parseAmenities(ground.amenities);
  const surfaceConfig = ground.surface ? SURFACE_CONFIG[ground.surface] : null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
    >
      <Card
        className={`border-warm-200 dark:border-warm-700 hover:shadow-md transition-all duration-200 border-l-4 ${getSurfaceBorderClass(ground.surface)} ${onSelect ? 'cursor-pointer' : ''} bg-white dark:bg-warm-800`}
        onClick={() => {
          if (onSelect) {
            onSelect(ground.id, ground.name);
          } else {
            onViewDetail(ground.id);
          }
        }}
      >
        <CardContent className="p-4">
          <div className="flex items-start justify-between mb-2">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <h4 className="font-bold text-warm-800 dark:text-warm-100 truncate">{ground.name}</h4>
                {ground._count.matches > 0 && (
                  <div className="flex items-center gap-0.5 shrink-0">
                    <Star className="w-3 h-3 text-brand-gold" />
                    <span className="text-[10px] font-bold text-brand-gold-dark dark:text-brand-gold-light">{ground._count.matches}</span>
                  </div>
                )}
              </div>
              {(ground.city || ground.state) && (
                <div className="flex items-center gap-1 mt-0.5">
                  <MapPin className="w-3 h-3 text-warm-400 dark:text-warm-500 shrink-0" />
                  <p className="text-xs text-warm-500 dark:text-warm-400 truncate">
                    {[ground.city, ground.state].filter(Boolean).join(', ')}
                  </p>
                </div>
              )}
              {ground.address && ground.address !== [ground.city, ground.state].filter(Boolean).join(', ') && (
                <p className="text-[10px] text-warm-400 dark:text-warm-500 mt-0.5 truncate">{ground.address}</p>
              )}
            </div>
            <div className="flex items-center gap-1.5 shrink-0 ml-2">
              {userLat !== null && userLng !== null && ground.lat !== null && ground.lng !== null && (
                <div className="flex items-center gap-0.5 text-[10px] text-warm-400 dark:text-warm-500">
                  <Navigation className="w-3 h-3" />
                  {formatDistance(userLat, userLng, ground.lat, ground.lng)}
                </div>
              )}
              {onSelect && (
                <CheckCircle className="w-4 h-4 text-brand-teal/30 hover:text-brand-teal transition-colors" />
              )}
            </div>
          </div>

          {/* Surface badge + match count + amenities */}
          <div className="flex items-center gap-1.5 flex-wrap">
            {surfaceConfig && (
              <Badge className={`${getSurfaceBadgeClass(ground.surface)} text-[9px] font-semibold border-0 px-1.5 py-0`}>
                {surfaceConfig.label}
              </Badge>
            )}
            <Badge variant="secondary" className="text-[9px] bg-warm-100 dark:bg-warm-700 text-warm-600 dark:text-warm-300 border-0 px-1.5 py-0">
              {ground._count.matches} match{ground._count.matches !== 1 ? 'es' : ''}
            </Badge>
            {amenities.map((a) => {
              const config = AMENITY_CONFIG[a];
              if (!config) return null;
              const Icon = config.icon;
              return (
                <div
                  key={a}
                  className="w-5 h-5 rounded-md bg-warm-100 dark:bg-warm-700 flex items-center justify-center"
                  title={config.label}
                >
                  <Icon className="w-3 h-3 text-warm-500 dark:text-warm-400" />
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}

// ─── Ground Detail View ───────────────────────────────────────────
function GroundDetailView({
  ground,
  userLat,
  userLng,
  onSelect,
  onClose,
  onBack,
}: {
  ground: Ground;
  userLat: number | null;
  userLng: number | null;
  onSelect?: (groundId: string, groundName: string) => void;
  onClose: () => void;
  onBack: () => void;
}) {
  const amenities = parseAmenities(ground.amenities);
  const surfaceConfig = ground.surface ? SURFACE_CONFIG[ground.surface] : null;
  const upcomingMatches = (ground.matches || []).filter((m) => m.status === 'upcoming' || m.status === 'live');
  const recentMatches = (ground.matches || []).filter((m) => m.status === 'completed').slice(0, 5);

  return (
    <motion.div
      initial={{ opacity: 0, x: 40 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 40 }}
      transition={{ type: 'spring', damping: 25, stiffness: 300 }}
      className="flex flex-col"
    >
      {/* Hero Section */}
      <div className={`relative overflow-hidden ${
        ground.surface === 'mat' ? 'bg-gradient-to-br from-teal-600 to-teal-800 dark:from-teal-800 dark:to-teal-950' :
        ground.surface === 'mud' ? 'bg-gradient-to-br from-amber-600 to-amber-800 dark:from-amber-800 dark:to-amber-950' :
        ground.surface === 'grass' ? 'bg-gradient-to-br from-green-600 to-green-800 dark:from-green-800 dark:to-green-950' :
        ground.surface === 'synthetic' ? 'bg-gradient-to-br from-purple-600 to-purple-800 dark:from-purple-800 dark:to-purple-950' :
        'bg-gradient-to-br from-brand-teal to-brand-teal-dark'
      }`}>
        {/* Pattern overlay */}
        <div className="absolute inset-0 opacity-10" style={{
          backgroundImage: `radial-gradient(circle at 25% 25%, white 1px, transparent 1px), radial-gradient(circle at 75% 75%, white 1px, transparent 1px)`,
          backgroundSize: '24px 24px',
        }} />

        <div className="relative px-4 pt-4 pb-6">
          <div className="flex items-center justify-between mb-4">
            <button onClick={onBack} className="p-2 rounded-full hover:bg-white/20 transition-colors">
              <X className="w-5 h-5 text-white" />
            </button>
            <div className="flex items-center gap-2">
              {onSelect && (
                <Button
                  size="sm"
                  onClick={() => { onSelect(ground.id, ground.name); onClose(); }}
                  className="bg-white/20 hover:bg-white/30 text-white border-white/30 backdrop-blur-sm"
                  variant="outline"
                >
                  <CheckCircle className="w-3.5 h-3.5 mr-1.5" />
                  Select
                </Button>
              )}
            </div>
          </div>

          <h2 className="text-2xl font-black text-white mb-1">{ground.name}</h2>
          {(ground.address || ground.city || ground.state) && (
            <div className="flex items-center gap-1.5 text-white/80 text-sm">
              <MapPin className="w-3.5 h-3.5 shrink-0" />
              <span>{[ground.address, ground.city, ground.state].filter(Boolean).join(', ')}</span>
            </div>
          )}

          {/* Distance indicator */}
          {userLat !== null && userLng !== null && ground.lat !== null && ground.lng !== null && (
            <div className="flex items-center gap-1.5 text-white/70 text-xs mt-2">
              <Navigation className="w-3 h-3" />
              <span>{formatDistance(userLat, userLng, ground.lat, ground.lng)} away</span>
            </div>
          )}

          {/* Quick stats row */}
          <div className="flex items-center gap-4 mt-4">
            <div className="flex items-center gap-1.5 text-white/90">
              <Trophy className="w-4 h-4" />
              <span className="text-sm font-bold">{ground._count.matches}</span>
              <span className="text-xs text-white/70">matches</span>
            </div>
            {surfaceConfig && (
              <Badge className={`${getSurfaceBadgeClass(ground.surface)} text-xs font-semibold border-0`}>
                <Layers className="w-3 h-3 mr-1" />
                {surfaceConfig.label}
              </Badge>
            )}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="px-4 py-4 space-y-4">
        {/* Surface Description */}
        {surfaceConfig && (
          <Card className="border-warm-200 dark:border-warm-700">
            <CardContent className="p-4">
              <div className="flex items-start gap-3">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${getSurfaceBadgeClass(ground.surface)}`}>
                  <Layers className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="font-bold text-warm-800 dark:text-warm-100 text-sm">Surface: {surfaceConfig.label}</h4>
                  <p className="text-xs text-warm-500 dark:text-warm-400 mt-0.5">{surfaceConfig.desc}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Amenities */}
        {amenities.length > 0 && (
          <Card className="border-warm-200 dark:border-warm-700">
            <CardContent className="p-4">
              <h4 className="font-bold text-warm-800 dark:text-warm-100 text-sm mb-3">Amenities</h4>
              <div className="grid grid-cols-2 gap-2">
                {amenities.map((a) => {
                  const config = AMENITY_CONFIG[a];
                  if (!config) return null;
                  const Icon = config.icon;
                  return (
                    <div key={a} className="flex items-center gap-2 p-2 rounded-lg bg-warm-50 dark:bg-warm-700/50">
                      <div className="w-7 h-7 rounded-lg bg-brand-teal/10 dark:bg-brand-teal/20 flex items-center justify-center">
                        <Icon className="w-3.5 h-3.5 text-brand-teal" />
                      </div>
                      <span className="text-xs font-medium text-warm-700 dark:text-warm-200">{config.label}</span>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Full Address */}
        {(ground.address || ground.mapLink) && (
          <Card className="border-warm-200 dark:border-warm-700">
            <CardContent className="p-4">
              <h4 className="font-bold text-warm-800 dark:text-warm-100 text-sm mb-2">Address</h4>
              {ground.address && (
                <div className="flex items-start gap-2 mb-2">
                  <MapPin className="w-4 h-4 text-brand-red shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm text-warm-700 dark:text-warm-200">{ground.address}</p>
                    <p className="text-xs text-warm-500 dark:text-warm-400">{[ground.city, ground.state].filter(Boolean).join(', ')}</p>
                  </div>
                </div>
              )}
              {ground.mapLink && (
                <a
                  href={ground.mapLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 mt-2 px-3 py-2 rounded-lg bg-brand-teal/10 dark:bg-brand-teal/20 text-brand-teal text-xs font-semibold hover:bg-brand-teal/20 dark:hover:bg-brand-teal/30 transition-colors"
                >
                  <Navigation className="w-3.5 h-3.5" />
                  Open in Google Maps
                </a>
              )}
            </CardContent>
          </Card>
        )}

        {/* Upcoming Matches */}
        {upcomingMatches.length > 0 && (
          <div>
            <h4 className="font-bold text-warm-800 dark:text-warm-100 text-sm mb-2 flex items-center gap-1.5">
              <Calendar className="w-4 h-4 text-brand-teal" />
              Upcoming Matches
            </h4>
            <div className="space-y-2">
              {upcomingMatches.map((match) => (
                <Card key={match.id} className="border-warm-200 dark:border-warm-700">
                  <CardContent className="p-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded-full flex items-center justify-center text-white text-[9px] font-bold" style={{ backgroundColor: match.homeTeam.color || '#DC2626' }}>
                          {(match.homeTeam.shortName || match.homeTeam.name).charAt(0)}
                        </div>
                        <span className="text-xs font-semibold text-warm-700 dark:text-warm-200">vs</span>
                        <div className="w-6 h-6 rounded-full flex items-center justify-center text-white text-[9px] font-bold" style={{ backgroundColor: match.awayTeam.color || '#1E293B' }}>
                          {(match.awayTeam.shortName || match.awayTeam.name).charAt(0)}
                        </div>
                      </div>
                      {match.tournament && (
                        <Badge className="bg-brand-teal/10 text-brand-teal text-[9px] border-0 font-semibold">
                          {match.tournament.name}
                        </Badge>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )}

        {/* Recent Matches */}
        {recentMatches.length > 0 && (
          <div>
            <h4 className="font-bold text-warm-800 dark:text-warm-100 text-sm mb-2 flex items-center gap-1.5">
              <Clock className="w-4 h-4 text-brand-gold" />
              Recent Matches
            </h4>
            <div className="space-y-2">
              {recentMatches.map((match) => {
                const homeWon = match.homeScore > match.awayScore;
                return (
                  <Card key={match.id} className="border-warm-200 dark:border-warm-700">
                    <CardContent className="p-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 min-w-0">
                          <div className="w-6 h-6 rounded-full flex items-center justify-center text-white text-[9px] font-bold shrink-0" style={{ backgroundColor: match.homeTeam.color || '#DC2626' }}>
                            {(match.homeTeam.shortName || match.homeTeam.name).charAt(0)}
                          </div>
                          <span className={`text-xs font-bold ${homeWon ? 'text-emerald-600 dark:text-emerald-400' : 'text-warm-600 dark:text-warm-300'}`}>
                            {match.homeScore}
                          </span>
                          <span className="text-[10px] text-warm-400">-</span>
                          <span className={`text-xs font-bold ${!homeWon ? 'text-emerald-600 dark:text-emerald-400' : 'text-warm-600 dark:text-warm-300'}`}>
                            {match.awayScore}
                          </span>
                          <div className="w-6 h-6 rounded-full flex items-center justify-center text-white text-[9px] font-bold shrink-0" style={{ backgroundColor: match.awayTeam.color || '#1E293B' }}>
                            {(match.awayTeam.shortName || match.awayTeam.name).charAt(0)}
                          </div>
                        </div>
                        {match.tournament && (
                          <Badge className="bg-warm-100 dark:bg-warm-700 text-warm-600 dark:text-warm-300 text-[8px] border-0 font-semibold ml-2">
                            {match.tournament.name}
                          </Badge>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </div>
        )}

        {/* No matches yet */}
        {ground._count.matches === 0 && (
          <div className="text-center py-6">
            <Trophy className="w-8 h-8 text-warm-300 dark:text-warm-600 mx-auto mb-2" />
            <p className="text-sm text-warm-500 dark:text-warm-400">No matches played here yet</p>
          </div>
        )}
      </div>
    </motion.div>
  );
}

// ─── Add Ground Form ──────────────────────────────────────────────
// CRITICAL: This component MUST be at module level, NOT nested inside
// GroundsScreen. When it was a nested function, every keystroke in the
// form caused the parent to re-render, which created a new AddGroundForm
// function reference, which caused React to unmount and remount the
// entire form — making the input lose focus after every character.
// This was the root cause of "no typing works there".
function AddGroundForm({
  form,
  setForm,
  onAdd,
  adding,
}: {
  form: GroundFormState;
  setForm: (form: GroundFormState) => void;
  onAdd: () => void;
  adding: boolean;
}) {
  return (
    <motion.div
      initial={{ height: 0, opacity: 0 }}
      animate={{ height: 'auto', opacity: 1 }}
      exit={{ height: 0, opacity: 0 }}
      className="px-4 pt-3 overflow-hidden"
    >
      <Card className="border-brand-teal/20 dark:border-brand-teal/30 bg-white dark:bg-warm-800">
        <CardContent className="p-4 space-y-3">
          <h3 className="font-bold text-warm-800 dark:text-warm-100 flex items-center gap-2">
            <Plus className="w-4 h-4 text-brand-teal" />
            New Ground / Academy Details
          </h3>

          <Input
            placeholder="Ground / Academy name *"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            className="bg-warm-50 dark:bg-warm-700 border-warm-200 dark:border-warm-600"
          />
          <Input
            placeholder="Address"
            value={form.address}
            onChange={(e) => setForm({ ...form, address: e.target.value })}
            className="bg-warm-50 dark:bg-warm-700 border-warm-200 dark:border-warm-600"
          />
          <div className="grid grid-cols-2 gap-3">
            <Input
              placeholder="City"
              value={form.city}
              onChange={(e) => setForm({ ...form, city: e.target.value })}
              className="bg-warm-50 dark:bg-warm-700 border-warm-200 dark:border-warm-600"
            />
            <Input
              placeholder="State"
              value={form.state}
              onChange={(e) => setForm({ ...form, state: e.target.value })}
              className="bg-warm-50 dark:bg-warm-700 border-warm-200 dark:border-warm-600"
            />
          </div>

          {/* Surface Selection */}
          <div>
            <label className="text-[10px] font-bold text-warm-500 dark:text-warm-400 mb-1.5 block uppercase tracking-wider">Surface Type</label>
            <div className="grid grid-cols-2 gap-2">
              {Object.entries(SURFACE_CONFIG).map(([key, config]) => (
                <button
                  key={key}
                  onClick={() => setForm({ ...form, surface: key })}
                  className={`p-2.5 rounded-xl border text-xs font-semibold text-center transition-all duration-200 ${
                    form.surface === key
                      ? `border-2 shadow-sm ${config.bgLight} ${config.bgDark} ${config.color}`
                      : 'border-warm-200 dark:border-warm-600 bg-warm-50 dark:bg-warm-700 text-warm-600 dark:text-warm-300 hover:border-warm-300 dark:hover:border-warm-500'
                  }`}
                >
                  {config.label}
                </button>
              ))}
            </div>
          </div>

          {/* Amenities Toggles */}
          <div>
            <label className="text-[10px] font-bold text-warm-500 dark:text-warm-400 mb-1.5 block uppercase tracking-wider">Amenities</label>
            <div className="grid grid-cols-2 gap-2">
              {Object.entries(AMENITY_CONFIG).map(([key, config]) => {
                const formKey = `has${key.charAt(0).toUpperCase()}${key.slice(1).replace(/_([a-z])/g, (_, l) => l.toUpperCase())}` as keyof GroundFormState;
                const isActive = form[formKey] as boolean;
                const Icon = config.icon;
                return (
                  <button
                    key={key}
                    onClick={() => setForm({ ...form, [formKey]: !isActive })}
                    className={`flex items-center gap-1.5 p-2.5 rounded-xl border text-xs font-medium transition-all duration-200 ${
                      isActive
                        ? 'border-brand-teal bg-brand-teal/10 dark:bg-brand-teal/20 text-brand-teal'
                        : 'border-warm-200 dark:border-warm-600 bg-warm-50 dark:bg-warm-700 text-warm-600 dark:text-warm-300'
                    }`}
                  >
                    <Icon className="w-3.5 h-3.5" />
                    {config.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Location (optional) — Google Maps link instead of raw lat/lng */}
          <div>
            <label className="text-[10px] font-bold text-warm-500 dark:text-warm-400 mb-1.5 block uppercase tracking-wider">Location on Map (Optional)</label>
            <div className="relative">
              <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-warm-400" />
              <Input
                placeholder="Paste Google Maps link"
                value={form.mapLink}
                onChange={(e) => setForm({ ...form, mapLink: e.target.value })}
                className="bg-warm-50 dark:bg-warm-700 border-warm-200 dark:border-warm-600 text-xs pl-9"
              />
            </div>
            <p className="text-[9px] text-warm-400 dark:text-warm-500 mt-1">
              Open Google Maps → right-click the spot → copy link, then paste here.
            </p>
          </div>

          <Button
            onClick={onAdd}
            disabled={adding}
            className="w-full bg-brand-teal hover:bg-brand-teal-dark text-white"
          >
            {adding ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Plus className="w-4 h-4 mr-2" />}
            {adding ? 'Adding...' : 'Add Ground / Academy'}
          </Button>
        </CardContent>
      </Card>
    </motion.div>
  );
}

// ════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ════════════════════════════════════════════════════════════════

export default function GroundsScreen({ onClose, onSelect }: { onClose: () => void; onSelect?: (groundId: string, groundName: string) => void }) {
  const currentUser = useKabaddiStore((s) => s.currentUser);
  const { toast } = useToast();
  const [grounds, setGrounds] = useState<Ground[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [surfaceFilter, setSurfaceFilter] = useState<SurfaceFilter>('all');
  const [amenityFilter, setAmenityFilter] = useState<string | null>(null);
  const [sortOption, setSortOption] = useState<SortOption>('newest');
  const [showAddForm, setShowAddForm] = useState(false);
  const [adding, setAdding] = useState(false);
  const [selectedGroundId, setSelectedGroundId] = useState<string | null>(null);
  const [showFilters, setShowFilters] = useState(false);
  const [viewMode, setViewMode] = useState<'list' | 'map'>('list');
  const [userLat, setUserLat] = useState<number | null>(null);
  const [userLng, setUserLng] = useState<number | null>(null);
  const [form, setForm] = useState<GroundFormState>({
    name: '',
    address: '',
    city: '',
    state: '',
    surface: 'mat',
    mapLink: '',
    hasLights: false,
    hasChangingRoom: false,
    hasSeating: false,
    hasParking: false,
  });

  // Get user location
  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setUserLat(pos.coords.latitude);
          setUserLng(pos.coords.longitude);
        },
        () => {
          // Permission denied or unavailable - that's fine
        }
      );
    }
  }, []);

  // ─── Debounce search (300ms) ────────────────────────────────────
  // Prevents a fetch on every keystroke, which was causing race conditions
  // and making the search feel sluggish.
  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    searchTimerRef.current = setTimeout(() => {
      setDebouncedSearch(search);
    }, 300);
    return () => {
      if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    };
  }, [search]);

  const loadGrounds = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (debouncedSearch) params.set('search', debouncedSearch);
      if (surfaceFilter !== 'all') params.set('surface', surfaceFilter);
      if (amenityFilter) params.set('amenity', amenityFilter);
      params.set('sort', sortOption);
      if (sortOption === 'nearest' && userLat !== null && userLng !== null) {
        params.set('lat', userLat.toString());
        params.set('lng', userLng.toString());
      }
      const res = await fetch(`/api/grounds?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setGrounds(data.grounds || []);
      }
    } catch (err) {
      console.error('Failed to load grounds:', err);
    } finally {
      setLoading(false);
    }
  }, [debouncedSearch, surfaceFilter, amenityFilter, sortOption, userLat, userLng]);

  useEffect(() => {
    loadGrounds();
  }, [loadGrounds]);

  const handleAddGround = async () => {
    if (!form.name.trim()) {
      toast({ title: 'Name required', variant: 'destructive' });
      return;
    }

    setAdding(true);
    try {
      const amenities: string[] = [];
      if (form.hasLights) amenities.push('lights');
      if (form.hasChangingRoom) amenities.push('changing_room');
      if (form.hasSeating) amenities.push('seating');
      if (form.hasParking) amenities.push('parking');

      const res = await fetch('/api/grounds', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: form.name,
          address: form.address || undefined,
          city: form.city || undefined,
          state: form.state || undefined,
          surface: form.surface,
          amenities: amenities.length > 0 ? amenities : undefined,
          mapLink: form.mapLink.trim() || undefined,
          addedBy: currentUser?.id,
        }),
      });

      if (res.ok) {
        toast({ title: 'Added!', description: `${form.name} is now available for matches` });
        setForm({ name: '', address: '', city: '', state: '', surface: 'mat', mapLink: '', hasLights: false, hasChangingRoom: false, hasSeating: false, hasParking: false });
        setShowAddForm(false);
        loadGrounds();
      } else {
        const data = await res.json();
        toast({ title: 'Error', description: data.error, variant: 'destructive' });
      }
    } catch {
      toast({ title: 'Error adding ground', variant: 'destructive' });
    } finally {
      setAdding(false);
    }
  };

  // Selected ground detail
  const selectedGround = selectedGroundId ? grounds.find((g) => g.id === selectedGroundId) : null;

  // ─── Render ─────────────────────────────────────────────────────
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 bg-warm-50 dark:bg-warm-900 overflow-y-auto custom-scrollbar"
    >
      <div className="min-h-screen flex flex-col max-w-lg mx-auto">
        {/* Header */}
        <div className={`sticky top-0 z-10 bg-gradient-to-r ${
          selectedGround
            ? 'from-warm-800 to-warm-900 dark:from-warm-700 dark:to-warm-800'
            : 'from-brand-teal to-brand-teal-dark'
        }`}>
          <AnimatePresence mode="wait">
            {selectedGround ? (
              <motion.div key="detail-header" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                <div className="flex items-center justify-between px-4 py-3">
                  <button onClick={() => setSelectedGroundId(null)} className="p-2 rounded-full hover:bg-white/20 transition-colors">
                    <X className="w-5 h-5 text-white" />
                  </button>
                  <h1 className="text-sm font-bold text-white">Ground Details</h1>
                  <div className="w-9" />
                </div>
              </motion.div>
            ) : (
              <motion.div key="list-header" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                <div className="flex items-center justify-between px-4 py-4">
                  <div className="flex items-center gap-2">
                    <MapPin className="w-5 h-5 text-white" />
                    <h1 className="text-lg font-bold text-white">Grounds & Academies</h1>
                  </div>
                  <button onClick={onClose} className="p-2 rounded-full hover:bg-white/20 transition-colors">
                    <X className="w-5 h-5 text-white" />
                  </button>
                </div>

                {/* Search */}
                <div className="px-4 pb-3">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-warm-400" />
                    <input
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      placeholder="Search by name, city, state..."
                      className="w-full h-10 rounded-xl bg-white/90 dark:bg-warm-700/90 border-0 pl-10 pr-4 text-sm text-warm-800 dark:text-warm-100 placeholder:text-warm-400 dark:placeholder:text-warm-500 focus:outline-none focus:ring-2 focus:ring-white/30"
                    />
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Main Content */}
        <AnimatePresence mode="wait">
          {selectedGround ? (
            <GroundDetailView
              key="detail"
              ground={selectedGround}
              userLat={userLat}
              userLng={userLng}
              onSelect={onSelect}
              onClose={onClose}
              onBack={() => setSelectedGroundId(null)}
            />
          ) : (
            <motion.div key="list" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              {/* Action Buttons */}
              <div className="px-4 pt-4 flex items-center gap-2">
                <Button
                  onClick={() => setShowAddForm(!showAddForm)}
                  variant="outline"
                  className="flex-1 border-dashed border-brand-teal/40 text-brand-teal hover:bg-brand-teal/5 h-9 text-xs"
                >
                  <Plus className="w-3.5 h-3.5 mr-1.5" />
                  {showAddForm ? 'Cancel' : 'Add Ground / Academy'}
                </Button>
                <Button
                  onClick={() => setShowFilters(!showFilters)}
                  variant="outline"
                  className="border-warm-200 dark:border-warm-700 text-warm-600 dark:text-warm-300 hover:bg-warm-100 dark:hover:bg-warm-700 h-9 text-xs"
                >
                  <ArrowUpDown className="w-3.5 h-3.5 mr-1.5" />
                  Filter
                  {showFilters ? <ChevronUp className="w-3 h-3 ml-1" /> : <ChevronDown className="w-3 h-3 ml-1" />}
                </Button>
              </div>

              {/* Add Ground Form */}
              <AnimatePresence>
                {showAddForm && (
                  <AddGroundForm
                    form={form}
                    setForm={setForm}
                    onAdd={handleAddGround}
                    adding={adding}
                  />
                )}
              </AnimatePresence>

              {/* Filters */}
              <AnimatePresence>
                {showFilters && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="px-4 pt-3 overflow-hidden space-y-2.5"
                  >
                    {/* Surface Filter */}
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-bold text-warm-500 dark:text-warm-400 uppercase tracking-wider w-14 shrink-0">
                        Surface
                      </span>
                      <FilterPill<SurfaceFilter>
                        options={[
                          { label: 'All', value: 'all' as SurfaceFilter },
                          { label: 'Mat', value: 'mat' as SurfaceFilter },
                          { label: 'Mud', value: 'mud' as SurfaceFilter },
                          { label: 'Grass', value: 'grass' as SurfaceFilter },
                          { label: 'Synthetic', value: 'synthetic' as SurfaceFilter },
                        ]}
                        value={surfaceFilter}
                        onChange={setSurfaceFilter}
                      />
                    </div>

                    {/* Amenity Filter */}
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-bold text-warm-500 dark:text-warm-400 uppercase tracking-wider w-14 shrink-0">
                        Facility
                      </span>
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <motion.button
                          onClick={() => setAmenityFilter(null)}
                          className={`px-2.5 py-1 rounded-full text-[10px] font-semibold transition-all duration-200 ${
                            !amenityFilter
                              ? 'bg-warm-800 dark:bg-warm-100 text-warm-50 dark:text-warm-900 shadow-sm'
                              : 'bg-warm-100 dark:bg-warm-700 text-warm-600 dark:text-warm-400 hover:bg-warm-200 dark:hover:bg-warm-600'
                          }`}
                          whileTap={{ scale: 0.95 }}
                        >
                          All
                        </motion.button>
                        {Object.entries(AMENITY_CONFIG).map(([key, config]) => {
                          const Icon = config.icon;
                          return (
                            <motion.button
                              key={key}
                              onClick={() => setAmenityFilter(amenityFilter === key ? null : key)}
                              className={`px-2.5 py-1 rounded-full text-[10px] font-semibold transition-all duration-200 flex items-center gap-1 ${
                                amenityFilter === key
                                  ? 'bg-warm-800 dark:bg-warm-100 text-warm-50 dark:text-warm-900 shadow-sm'
                                  : 'bg-warm-100 dark:bg-warm-700 text-warm-600 dark:text-warm-400 hover:bg-warm-200 dark:hover:bg-warm-600'
                              }`}
                              whileTap={{ scale: 0.95 }}
                            >
                              <Icon className="w-3 h-3" />
                              {config.label}
                            </motion.button>
                          );
                        })}
                      </div>
                    </div>

                    {/* Sort */}
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-bold text-warm-500 dark:text-warm-400 uppercase tracking-wider w-14 shrink-0">
                        Sort
                      </span>
                      <FilterPill<SortOption>
                        options={[
                          { label: 'Newest', value: 'newest' as SortOption },
                          { label: 'Popular', value: 'popular' as SortOption },
                          ...(userLat !== null ? [{ label: 'Nearest', value: 'nearest' as SortOption }] : []),
                        ]}
                        value={sortOption}
                        onChange={setSortOption}
                      />
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* List / Map View Toggle */}
              {!loading && grounds.length > 0 && (
                <div className="px-4 pt-3">
                  <div className="inline-flex rounded-lg border border-warm-200 dark:border-warm-700 bg-warm-50 dark:bg-warm-800 p-0.5">
                    <button
                      onClick={() => setViewMode('list')}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[11px] font-semibold transition-all ${
                        viewMode === 'list'
                          ? 'bg-white dark:bg-warm-700 text-warm-800 dark:text-warm-100 shadow-sm'
                          : 'text-warm-500 dark:text-warm-400'
                      }`}
                    >
                      <List className="w-3.5 h-3.5" />
                      List
                    </button>
                    <button
                      onClick={() => setViewMode('map')}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[11px] font-semibold transition-all ${
                        viewMode === 'map'
                          ? 'bg-white dark:bg-warm-700 text-warm-800 dark:text-warm-100 shadow-sm'
                          : 'text-warm-500 dark:text-warm-400'
                      }`}
                    >
                      <MapIcon className="w-3.5 h-3.5" />
                      Map
                    </button>
                  </div>
                </div>
              )}

              {/* Grounds List OR Map View */}
              {viewMode === 'map' && !loading && grounds.length > 0 ? (
                <Suspense
                  fallback={
                    <div className="px-4 py-10 flex flex-col items-center gap-2 text-warm-500 dark:text-warm-400">
                      <Loader2 className="w-5 h-5 animate-spin text-brand-teal" />
                      <p className="text-xs">Loading map…</p>
                    </div>
                  }
                >
                  <GroundsMapView
                    grounds={grounds}
                    userLat={userLat}
                    userLng={userLng}
                    onViewDetail={setSelectedGroundId}
                  />
                </Suspense>
              ) : (
                <div className="px-4 py-4 space-y-3">
                  {loading ? (
                    [1, 2, 3].map((i) => (
                      <div key={i} className="h-24 bg-warm-100 dark:bg-warm-800 rounded-xl animate-pulse border-l-4 border-l-warm-300 dark:border-l-warm-600" />
                    ))
                  ) : grounds.length === 0 ? (
                    <Card className="p-8 text-center bg-white dark:bg-warm-800 border-warm-200 dark:border-warm-700">
                      <Building2 className="w-10 h-10 text-warm-300 dark:text-warm-600 mx-auto mb-3" />
                      <p className="text-warm-600 dark:text-warm-300 font-medium">No grounds found</p>
                      <p className="text-warm-400 dark:text-warm-500 text-sm mt-1">Add a ground to get started!</p>
                    </Card>
                  ) : (
                    grounds.map((ground) => (
                      <GroundCard
                        key={ground.id}
                        ground={ground}
                        userLat={userLat}
                        userLng={userLng}
                        onSelect={onSelect}
                        onViewDetail={setSelectedGroundId}
                      />
                    ))
                  )}
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}
