'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X, Briefcase, Plus, ExternalLink, Loader2,
  Crown, Gem, Award, Star, BarChart3,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useKabaddiStore } from '@/lib/store';
import { useToast } from '@/hooks/use-toast';

// ─── Types ────────────────────────────────────────────────────────

interface SponsorScreenProps {
  onClose: () => void;
}

interface Sponsor {
  id: string;
  name: string;
  logoUrl: string | null;
  website: string | null;
  tier: 'platinum' | 'gold' | 'silver' | 'bronze';
  seasonId?: string;
  teamId?: string;
}

// ─── Tier Config ──────────────────────────────────────────────────

const TIER_CONFIG: Record<string, {
  label: string;
  icon: typeof Crown;
  bgColor: string;
  borderColor: string;
  badgeBg: string;
  badgeText: string;
  cardBg: string;
  iconColor: string;
  cols: string;
}> = {
  platinum: {
    label: 'Platinum',
    icon: Gem,
    bgColor: 'bg-gradient-to-br from-slate-100 to-slate-200',
    borderColor: 'border-slate-300',
    badgeBg: 'bg-slate-200',
    badgeText: 'text-slate-700',
    cardBg: 'bg-gradient-to-br from-slate-50 to-white',
    iconColor: 'text-slate-600',
    cols: 'grid-cols-2 sm:grid-cols-4',
  },
  gold: {
    label: 'Gold',
    icon: Crown,
    bgColor: 'bg-gradient-to-br from-yellow-50 to-amber-100',
    borderColor: 'border-brand-gold/30',
    badgeBg: 'bg-brand-gold/15',
    badgeText: 'text-brand-gold-dark',
    cardBg: 'bg-gradient-to-br from-yellow-50/50 to-white',
    iconColor: 'text-brand-gold',
    cols: 'grid-cols-2 sm:grid-cols-3',
  },
  silver: {
    label: 'Silver',
    icon: Award,
    bgColor: 'bg-gradient-to-br from-gray-50 to-gray-100',
    borderColor: 'border-gray-300',
    badgeBg: 'bg-gray-200',
    badgeText: 'text-gray-600',
    cardBg: 'bg-gradient-to-br from-gray-50/50 to-white',
    iconColor: 'text-gray-500',
    cols: 'grid-cols-2',
  },
  bronze: {
    label: 'Bronze',
    icon: Star,
    bgColor: 'bg-gradient-to-br from-orange-50 to-amber-50',
    borderColor: 'border-amber-300',
    badgeBg: 'bg-amber-100',
    badgeText: 'text-amber-700',
    cardBg: 'bg-gradient-to-br from-orange-50/50 to-white',
    iconColor: 'text-amber-600',
    cols: 'grid-cols-1',
  },
};

const TIER_ORDER = ['platinum', 'gold', 'silver', 'bronze'] as const;

// ─── Animation ────────────────────────────────────────────────────

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.06, delayChildren: 0.1 },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 14, scale: 0.97 },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: { type: 'spring' as const, damping: 20, stiffness: 200 },
  },
};

// ─── Component ────────────────────────────────────────────────────

export default function SponsorScreen({ onClose }: SponsorScreenProps) {
  const currentUser = useKabaddiStore((s) => s.currentUser);
  const isAdmin = currentUser?.isAdmin || false;
  const { toast } = useToast();

  const [sponsors, setSponsors] = useState<Sponsor[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [adding, setAdding] = useState(false);

  const [form, setForm] = useState({
    name: '',
    logoUrl: '',
    website: '',
    tier: 'gold',
    seasonId: '',
    teamId: '',
  });

  // ─── Fetch sponsors ───────────────────────────────────────────

  const fetchSponsors = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/sponsors');
      if (res.ok) {
        const data = await res.json();
        setSponsors(data.sponsors || []);
      } else {
        setSponsors([]);
      }
    } catch {
      setSponsors([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSponsors();
  }, [fetchSponsors]);

  // ─── Add Sponsor ──────────────────────────────────────────────

  const handleAddSponsor = async () => {
    if (!form.name.trim()) {
      toast({ title: 'Name required', variant: 'destructive' });
      return;
    }

    setAdding(true);
    try {
      const res = await fetch('/api/sponsors', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: form.name,
          logoUrl: form.logoUrl || undefined,
          website: form.website || undefined,
          tier: form.tier,
          seasonId: form.seasonId || undefined,
          teamId: form.teamId || undefined,
          userId: currentUser?.id,
        }),
      });

      if (res.ok) {
        toast({ title: 'Sponsor Added!', description: `${form.name} is now a ${form.tier} sponsor` });
        setForm({ name: '', logoUrl: '', website: '', tier: 'gold', seasonId: '', teamId: '' });
        setShowAddForm(false);
        fetchSponsors();
      } else {
        const data = await res.json();
        toast({ title: 'Error', description: data.error || 'Failed to add sponsor', variant: 'destructive' });
      }
    } catch {
      toast({ title: 'Error', description: 'Failed to add sponsor', variant: 'destructive' });
    } finally {
      setAdding(false);
    }
  };

  // ─── Group sponsors by tier ───────────────────────────────────

  const grouped = TIER_ORDER.reduce((acc, tier) => {
    acc[tier] = sponsors.filter((s) => s.tier === tier);
    return acc;
  }, {} as Record<string, Sponsor[]>);

  // ─── Stats ────────────────────────────────────────────────────

  const totalSponsors = sponsors.length;
  const tierCounts = TIER_ORDER.reduce((acc, tier) => {
    acc[tier] = grouped[tier].length;
    return acc;
  }, {} as Record<string, number>);

  // ─── Render ───────────────────────────────────────────────────

  return (
    <motion.div
      initial={{ y: '100%' }}
      animate={{ y: 0 }}
      exit={{ y: '100%' }}
      transition={{ type: 'spring', damping: 28, stiffness: 300 }}
      className="fixed inset-0 z-50 bg-warm-50 overflow-y-auto"
    >
      {/* ═══ Header ═══ */}
      <div className="sticky top-0 z-10 bg-gradient-to-r from-brand-navy to-brand-navy-light">
        <div className="flex items-center justify-between px-4 py-4">
          <div className="flex items-center gap-2">
            <Briefcase className="w-5 h-5 text-white" />
            <h1 className="text-lg font-bold text-white">SPONSORS</h1>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-full hover:bg-white/20 transition-colors"
          >
            <X className="w-5 h-5 text-white" />
          </button>
        </div>
      </div>

      {/* ═══ Content ═══ */}
      <div className="px-4 py-4">
        <motion.div
          className="space-y-4"
          variants={containerVariants}
          initial="hidden"
          animate="visible"
        >
          {/* Stats Bar */}
          <motion.div variants={itemVariants}>
            <Card className="border-warm-200/60">
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-6 h-6 rounded-md bg-brand-teal/10 flex items-center justify-center">
                    <BarChart3 className="w-3.5 h-3.5 text-brand-teal" />
                  </div>
                  <h2 className="text-xs font-black tracking-wider text-warm-800">OVERVIEW</h2>
                </div>

                <div className="flex items-center justify-between">
                  <div className="text-center flex-1">
                    <p className="text-2xl font-black text-warm-800">{totalSponsors}</p>
                    <p className="text-[10px] text-warm-500 font-semibold">Total</p>
                  </div>
                  {TIER_ORDER.map((tier) => {
                    const config = TIER_CONFIG[tier];
                    const TierIcon = config.icon;
                    return (
                      <div key={tier} className="text-center flex-1">
                        <div className={`w-7 h-7 rounded-lg ${config.badgeBg} flex items-center justify-center mx-auto mb-1`}>
                          <TierIcon className={`w-3.5 h-3.5 ${config.iconColor}`} />
                        </div>
                        <p className="text-sm font-bold text-warm-700">{tierCounts[tier]}</p>
                        <p className="text-[8px] text-warm-500 font-semibold uppercase">{tier}</p>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          </motion.div>

          {/* Add Sponsor Button (Admin Only) */}
          {isAdmin && (
            <motion.div variants={itemVariants}>
              <Button
                onClick={() => setShowAddForm(!showAddForm)}
                variant="outline"
                className="w-full border-dashed border-brand-navy/30 text-brand-navy hover:bg-brand-navy/5 h-10"
              >
                <Plus className="w-4 h-4 mr-2" />
                {showAddForm ? 'Cancel' : 'Add Sponsor'}
              </Button>
            </motion.div>
          )}

          {/* Add Sponsor Form */}
          <AnimatePresence>
            {showAddForm && isAdmin && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="overflow-hidden"
              >
                <Card className="border-brand-navy/20">
                  <CardContent className="p-4 space-y-3">
                    <h3 className="font-bold text-warm-800 text-sm">New Sponsor</h3>
                    <Input
                      placeholder="Sponsor name *"
                      value={form.name}
                      onChange={(e) => setForm({ ...form, name: e.target.value })}
                      className="bg-white border-warm-300"
                    />
                    <Input
                      placeholder="Logo URL (optional)"
                      value={form.logoUrl}
                      onChange={(e) => setForm({ ...form, logoUrl: e.target.value })}
                      className="bg-white border-warm-300"
                    />
                    <Input
                      placeholder="Website URL (optional)"
                      value={form.website}
                      onChange={(e) => setForm({ ...form, website: e.target.value })}
                      className="bg-white border-warm-300"
                    />

                    {/* Tier Selection */}
                    <div>
                      <label className="text-xs font-semibold text-warm-600 mb-1.5 block">Tier</label>
                      <div className="grid grid-cols-4 gap-2">
                        {TIER_ORDER.map((tier) => {
                          const config = TIER_CONFIG[tier];
                          const TierIcon = config.icon;
                          const isSelected = form.tier === tier;

                          return (
                            <button
                              key={tier}
                              onClick={() => setForm({ ...form, tier })}
                              className={`p-2 rounded-lg border text-center transition-all ${
                                isSelected
                                  ? `${config.borderColor} ${config.bgColor} shadow-sm`
                                  : 'border-warm-200 bg-white hover:border-warm-300'
                              }`}
                            >
                              <TierIcon className={`w-4 h-4 mx-auto mb-1 ${config.iconColor}`} />
                              <span className={`text-[9px] font-bold capitalize ${
                                isSelected ? config.badgeText : 'text-warm-500'
                              }`}>
                                {tier}
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <Input
                        placeholder="Season ID (optional)"
                        value={form.seasonId}
                        onChange={(e) => setForm({ ...form, seasonId: e.target.value })}
                        className="bg-white border-warm-300"
                      />
                      <Input
                        placeholder="Team ID (optional)"
                        value={form.teamId}
                        onChange={(e) => setForm({ ...form, teamId: e.target.value })}
                        className="bg-white border-warm-300"
                      />
                    </div>

                    <Button
                      onClick={handleAddSponsor}
                      disabled={adding}
                      className="w-full bg-brand-navy hover:bg-brand-navy-dark text-white"
                    >
                      {adding ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          Adding...
                        </>
                      ) : (
                        <>
                          <Plus className="w-4 h-4 mr-2" />
                          Add Sponsor
                        </>
                      )}
                    </Button>
                  </CardContent>
                </Card>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Sponsor Tiers */}
          {loading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-24 bg-warm-100 rounded-xl animate-pulse" />
              ))}
            </div>
          ) : sponsors.length === 0 ? (
            <motion.div variants={itemVariants}>
              <Card className="p-8 text-center border-warm-200">
                <div className="w-16 h-16 rounded-full bg-brand-navy/10 flex items-center justify-center mx-auto mb-4">
                  <Briefcase className="w-8 h-8 text-brand-navy/40" />
                </div>
                <h3 className="text-warm-700 font-bold text-sm">No sponsors yet</h3>
                <p className="text-warm-400 text-xs mt-1 max-w-[280px] mx-auto">
                  Add sponsors to monetize your tournaments!
                </p>
              </Card>
            </motion.div>
          ) : (
            TIER_ORDER.map((tier) => {
              const tierSponsors = grouped[tier];
              if (tierSponsors.length === 0) return null;

              const config = TIER_CONFIG[tier];
              const TierIcon = config.icon;

              return (
                <motion.div key={tier} variants={itemVariants}>
                  {/* Tier Header */}
                  <div className="flex items-center gap-2 mb-2">
                    <TierIcon className={`w-4 h-4 ${config.iconColor}`} />
                    <h2 className="text-xs font-black tracking-wider text-warm-800 uppercase">
                      {config.label}
                    </h2>
                    <Badge className={`${config.badgeBg} ${config.badgeText} text-[9px] font-bold border-0`}>
                      {tierSponsors.length}
                    </Badge>
                  </div>

                  {/* Sponsor Cards Grid */}
                  <div className={`grid ${config.cols} gap-3`}>
                    {tierSponsors.map((sponsor, i) => (
                      <motion.div
                        key={sponsor.id}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: i * 0.05 }}
                      >
                        <Card className={`${config.borderColor} ${config.cardBg} hover:shadow-md transition-shadow`}>
                          <CardContent className="p-3">
                            <div className="flex items-center gap-3">
                              {/* Logo or Placeholder */}
                              <div className={`w-10 h-10 rounded-lg ${config.bgColor} border ${config.borderColor} flex items-center justify-center shrink-0 overflow-hidden`}>
                                {sponsor.logoUrl ? (
                                  <img
                                    src={sponsor.logoUrl}
                                    alt={sponsor.name}
                                    className="w-full h-full object-cover"
                                  />
                                ) : (
                                  <span className={`text-sm font-black ${config.iconColor}`}>
                                    {sponsor.name.charAt(0).toUpperCase()}
                                  </span>
                                )}
                              </div>

                              <div className="flex-1 min-w-0">
                                <p className="text-xs font-bold text-warm-800 truncate">
                                  {sponsor.name}
                                </p>
                                <Badge className={`${config.badgeBg} ${config.badgeText} text-[8px] font-bold border-0 mt-0.5`}>
                                  {config.label}
                                </Badge>
                              </div>

                              {/* Website Link */}
                              {sponsor.website && (
                                <a
                                  href={sponsor.website}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="w-7 h-7 rounded-full bg-warm-100 flex items-center justify-center hover:bg-warm-200 transition-colors shrink-0"
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  <ExternalLink className="w-3 h-3 text-warm-500" />
                                </a>
                              )}
                            </div>
                          </CardContent>
                        </Card>
                      </motion.div>
                    ))}
                  </div>
                </motion.div>
              );
            })
          )}
        </motion.div>
      </div>
    </motion.div>
  );
}
