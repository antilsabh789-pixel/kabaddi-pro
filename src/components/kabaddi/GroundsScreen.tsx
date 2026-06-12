'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { X, MapPin, Plus, Search, Building2, CheckCircle, Loader2 } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useKabaddiStore } from '@/lib/store';
import { useToast } from '@/hooks/use-toast';

interface Ground {
  id: string;
  name: string;
  address: string | null;
  city: string | null;
  state: string | null;
  surface: string | null;
  amenities: string | null;
  _count: { matches: number };
}

const SURFACE_LABELS: Record<string, string> = {
  mat: 'Pro Mat',
  mud: 'Mud / Clay',
  grass: 'Grass',
  synthetic: 'Synthetic',
};

export default function GroundsScreen({ onClose, onSelect }: { onClose: () => void; onSelect?: (groundId: string, groundName: string) => void }) {
  const currentUser = useKabaddiStore((s) => s.currentUser);
  const { toast } = useToast();
  const [grounds, setGrounds] = useState<Ground[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showAddForm, setShowAddForm] = useState(false);
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState({
    name: '',
    address: '',
    city: '',
    state: '',
    surface: 'mat',
    hasLights: false,
    hasChangingRoom: false,
    hasSeating: false,
    hasParking: false,
  });

  const loadGrounds = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (search) params.set('search', search);
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
  }, [search]);

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
          addedBy: currentUser?.id,
        }),
      });

      if (res.ok) {
        toast({ title: 'Ground Added!', description: `${form.name} is now available for matches` });
        setForm({ name: '', address: '', city: '', state: '', surface: 'mat', hasLights: false, hasChangingRoom: false, hasSeating: false, hasParking: false });
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

  const parseAmenities = (amenities: string | null): string[] => {
    if (!amenities) return [];
    try {
      const parsed = JSON.parse(amenities);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  };

  const AMENITY_LABELS: Record<string, { label: string; icon: string }> = {
    lights: { label: 'Floodlights', icon: '💡' },
    changing_room: { label: 'Changing Room', icon: '🚿' },
    seating: { label: 'Seating', icon: '🪑' },
    parking: { label: 'Parking', icon: '🅿️' },
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 bg-warm-50 overflow-y-auto"
    >
      {/* Header */}
      <div className="sticky top-0 z-10 bg-gradient-to-r from-brand-teal to-brand-teal-dark">
        <div className="flex items-center justify-between px-4 py-4">
          <div className="flex items-center gap-2">
            <MapPin className="w-5 h-5 text-white" />
            <h1 className="text-lg font-bold text-white">Grounds & Venues</h1>
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
              placeholder="Search grounds by name, city..."
              className="w-full h-10 rounded-xl bg-white/90 border-0 pl-10 pr-4 text-sm text-warm-800 placeholder:text-warm-400 focus:outline-none focus:ring-2 focus:ring-white/30"
            />
          </div>
        </div>
      </div>

      {/* Add Ground Button */}
      <div className="px-4 pt-4">
        <Button
          onClick={() => setShowAddForm(!showAddForm)}
          variant="outline"
          className="w-full border-dashed border-brand-teal/40 text-brand-teal hover:bg-brand-teal/5 h-10"
        >
          <Plus className="w-4 h-4 mr-2" />
          {showAddForm ? 'Cancel' : 'Add New Ground'}
        </Button>
      </div>

      {/* Add Ground Form */}
      {showAddForm && (
        <motion.div
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: 'auto', opacity: 1 }}
          className="px-4 pt-3 overflow-hidden"
        >
          <Card className="border-brand-teal/20">
            <CardContent className="p-4 space-y-3">
              <h3 className="font-bold text-warm-800">New Ground Details</h3>
              <Input
                placeholder="Ground name *"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="bg-white border-warm-300"
              />
              <Input
                placeholder="Address"
                value={form.address}
                onChange={(e) => setForm({ ...form, address: e.target.value })}
                className="bg-white border-warm-300"
              />
              <div className="grid grid-cols-2 gap-3">
                <Input
                  placeholder="City"
                  value={form.city}
                  onChange={(e) => setForm({ ...form, city: e.target.value })}
                  className="bg-white border-warm-300"
                />
                <Input
                  placeholder="State"
                  value={form.state}
                  onChange={(e) => setForm({ ...form, state: e.target.value })}
                  className="bg-white border-warm-300"
                />
              </div>

              {/* Surface Selection */}
              <div>
                <label className="text-xs font-semibold text-warm-600 mb-1.5 block">Surface Type</label>
                <div className="grid grid-cols-2 gap-2">
                  {Object.entries(SURFACE_LABELS).map(([key, label]) => (
                    <button
                      key={key}
                      onClick={() => setForm({ ...form, surface: key })}
                      className={`p-2 rounded-lg border text-xs font-medium text-center transition-colors ${
                        form.surface === key
                          ? 'border-brand-teal bg-brand-teal/10 text-brand-teal'
                          : 'border-warm-200 bg-white text-warm-600 hover:border-warm-300'
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Amenities Toggles */}
              <div>
                <label className="text-xs font-semibold text-warm-600 mb-1.5 block">Amenities</label>
                <div className="grid grid-cols-2 gap-2">
                  {Object.entries(AMENITY_LABELS).map(([key, { label, icon }]) => (
                    <button
                      key={key}
                      onClick={() => setForm({ ...form, [`has${key.charAt(0).toUpperCase() + key.slice(1).replace(/_([a-z])/g, (_, l) => l.toUpperCase())}`]: !(form as Record<string, unknown>)[`has${key.charAt(0).toUpperCase() + key.slice(1).replace(/_([a-z])/g, (_, l) => l.toUpperCase())}`] })}
                      className={`flex items-center gap-1.5 p-2 rounded-lg border text-xs font-medium transition-colors ${
                        (form as Record<string, boolean>)[`has${key.charAt(0).toUpperCase() + key.slice(1).replace(/_([a-z])/g, (_, l) => l.toUpperCase())}`]
                          ? 'border-brand-teal bg-brand-teal/10 text-brand-teal'
                          : 'border-warm-200 bg-white text-warm-600'
                      }`}
                    >
                      <span>{icon}</span>
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              <Button
                onClick={handleAddGround}
                disabled={adding}
                className="w-full bg-brand-teal hover:bg-brand-teal-dark text-white"
              >
                {adding ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Plus className="w-4 h-4 mr-2" />}
                {adding ? 'Adding...' : 'Add Ground'}
              </Button>
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* Grounds List */}
      <div className="px-4 py-4 space-y-3">
        {loading ? (
          [1, 2, 3].map(i => <div key={i} className="h-24 bg-warm-100 rounded-xl animate-pulse" />)
        ) : grounds.length === 0 ? (
          <Card className="p-8 text-center">
            <Building2 className="w-10 h-10 text-warm-300 mx-auto mb-3" />
            <p className="text-warm-600 font-medium">No grounds found</p>
            <p className="text-warm-400 text-sm mt-1">Add a ground to get started!</p>
          </Card>
        ) : (
          grounds.map(ground => {
            const amenities = parseAmenities(ground.amenities);

            return (
              <motion.div
                key={ground.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
              >
                <Card
                  className={`border-warm-200 hover:border-brand-teal/30 transition-colors ${onSelect ? 'cursor-pointer' : ''}`}
                  onClick={() => onSelect?.(ground.id, ground.name)}
                >
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <h4 className="font-semibold text-warm-800">{ground.name}</h4>
                        {ground.address && (
                          <p className="text-xs text-warm-500 mt-0.5">{ground.address}</p>
                        )}
                        {(ground.city || ground.state) && (
                          <p className="text-xs text-warm-400">
                            {[ground.city, ground.state].filter(Boolean).join(', ')}
                          </p>
                        )}
                      </div>
                      {onSelect && (
                        <CheckCircle className="w-5 h-5 text-brand-teal/30 hover:text-brand-teal transition-colors" />
                      )}
                    </div>

                    <div className="flex items-center gap-2 flex-wrap">
                      {ground.surface && (
                        <Badge variant="secondary" className="text-[10px] bg-brand-teal/10 text-brand-teal border-0">
                          {SURFACE_LABELS[ground.surface] || ground.surface}
                        </Badge>
                      )}
                      <Badge variant="secondary" className="text-[10px] bg-warm-100 text-warm-600 border-0">
                        {ground._count.matches} match{ground._count.matches !== 1 ? 'es' : ''}
                      </Badge>
                      {amenities.map(a => (
                        <Badge key={a} variant="secondary" className="text-[10px] bg-warm-100 text-warm-500 border-0">
                          {AMENITY_LABELS[a]?.icon} {AMENITY_LABELS[a]?.label || a}
                        </Badge>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            );
          })
        )}
      </div>
    </motion.div>
  );
}
