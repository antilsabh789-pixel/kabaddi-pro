'use client';

/**
 * Coaches Corner — REBUILT (simple version)
 *
 * Single-page flow:
 *   1. Academy list (or "Create Academy" if none)
 *   2. Tap an academy → Academy Dashboard with 5 options:
 *      - Attendance (always saved, no date limit)
 *      - Fees (simple paid/pending per month)
 *      - Announcements (broadcast to all academy players)
 *      - Performances (last match stats per player)
 *      - Players (roster + Call / WhatsApp / Chat per player)
 *
 * This component intentionally replaces the older 6-tab CoachDashboard with a
 * much simpler, focused UX. The old CoachDashboard.tsx is kept on disk for
 * reference but no longer imported anywhere.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowLeft,
  Plus,
  MapPin,
  Users,
  Calendar,
  IndianRupee,
  Megaphone,
  Trophy,
  Phone,
  MessageCircle,
  X,
  ChevronRight,
  Building2,
  Loader2,
  AlertTriangle,
  Check,
  CheckCircle2,
  Send,
  Trash2,
  UserPlus,
  Search,
  Sparkles,
  Crown,
  Zap,
  Shield,
  Clock,
  CalendarDays,
  Pencil,
  MessageSquare,
  Sun,
  Moon,
  Save,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useKabaddiStore } from '@/lib/store';
import { useToast } from '@/hooks/use-toast';
import { useBackButton } from '@/hooks/use-back-button';

// ─── Types ────────────────────────────────────────────────────────────

interface AcademyData {
  id: string;
  name: string;
  location: string | null;
  groundName: string | null;
  coachUserId: string;
  sundayHoliday?: boolean;
  practiceSchedule?: string; // "one-time" (default) or "two-sessions" (morning+evening)
  offDays?: string; // JSON string of weekday names
  players: AcademyPlayerData[];
  _count: { players: number };
  createdAt: string;
}

interface AcademyPlayerData {
  id: string; // AcademyPlayer row id
  userId: string;
  user: {
    id: string;
    name: string | null;
    phone: string | null;
    avatar: string | null;
    playerCode?: string | null;
    provisional?: boolean;
  };
  joinedAt: string;
}

interface AttendanceRecord {
  id: string;
  userId: string;
  date: string;
  isPresent: boolean;
  session: string;
  note?: string | null;
}

interface FeeRecordData {
  id: string;
  userId: string;
  month: string;
  amount: number;
  status: string; // pending, paid, overdue
  paidAt: string | null;
  period: string;
  notes?: string | null;
}

interface AnnouncementData {
  id: string;
  title: string;
  message: string;
  createdAt: string;
  coach?: { id: string; name: string | null; avatar: string | null };
}

interface PerformancePlayer {
  userId: string;
  name: string | null;
  playerCode: string | null;
  avatar: string | null;
  stats: {
    raidPoints: number;
    tacklePoints: number;
    bonusPoints: number;
    totalPoints: number;
    events: number;
  };
  hasPlayedInLastMatch: boolean;
}

interface LastMatchData {
  id: string;
  date: string;
  homeTeamName: string;
  awayTeamName: string;
  homeScore: number;
  awayScore: number;
  tournamentName: string | null;
  completedAt: string | null;
  isPractice: boolean;
  venue: string | null;
}

type View =
  | { name: 'academies' }
  | { name: 'create' }
  | { name: 'dashboard'; academyId: string }
  | { name: 'attendance'; academyId: string }
  | { name: 'fees'; academyId: string }
  | { name: 'announcements'; academyId: string }
  | { name: 'performances'; academyId: string }
  | { name: 'players'; academyId: string };

// ─── Component ────────────────────────────────────────────────────────

export default function CoachesCornerScreen({ onClose }: { onClose: () => void }) {
  const currentUser = useKabaddiStore((s) => s.currentUser);
  const startChatWith = useKabaddiStore((s) => s.startChatWith);
  const { toast } = useToast();

  const [view, setView] = useState<View>({ name: 'academies' });
  useBackButton(true, onClose);

  // ─── Academies list state ───
  const [academies, setAcademies] = useState<AcademyData[]>([]);
  const [loadingAcademies, setLoadingAcademies] = useState(false);
  const [academiesError, setAcademiesError] = useState<string | null>(null);

  // ─── Create form state ───
  const [createForm, setCreateForm] = useState({ name: '', location: '', groundName: '' });
  const [creating, setCreating] = useState(false);

  // ─── Selected academy detail ───
  const [selectedAcademy, setSelectedAcademy] = useState<AcademyData | null>(null);

  // ─── Fetch academies list ───
  const fetchAcademies = useCallback(async () => {
    if (!currentUser?.id) return;
    setLoadingAcademies(true);
    setAcademiesError(null);
    try {
      const res = await fetch(`/api/academies?coachUserId=${currentUser.id}&_t=${Date.now()}`, { cache: 'no-store' });
      const data = await res.json();
      if (!res.ok) {
        setAcademiesError(data.error || 'Failed to load academies');
        setAcademies([]);
      } else {
        setAcademies(data.academies || []);
      }
    } catch {
      setAcademiesError('Network error. Check your connection.');
      setAcademies([]);
    } finally {
      setLoadingAcademies(false);
    }
  }, [currentUser?.id]);

  useEffect(() => {
    fetchAcademies();
  }, [fetchAcademies]);

  // ─── Fetch academy detail ───
  const fetchAcademyDetail = useCallback(async (academyId: string) => {
    try {
      const res = await fetch(`/api/academies/${academyId}?_t=${Date.now()}`, { cache: 'no-store' });
      const data = await res.json();
      if (res.ok && data.academy) {
        setSelectedAcademy(data.academy);
      }
    } catch {
      // non-fatal
    }
  }, []);

  // ─── Create academy ───
  const handleCreate = async () => {
    if (!currentUser?.id) return;
    if (!createForm.name.trim()) {
      toast({ title: 'Academy name required', variant: 'destructive' });
      return;
    }
    setCreating(true);
    try {
      const res = await fetch('/api/academies', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: createForm.name.trim(),
          location: createForm.location.trim() || null,
          groundName: createForm.groundName.trim() || null,
          coachUserId: currentUser.id,
          sundayHoliday: false,
          practiceSchedule: 'one-time',
          offDays: [],
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast({ title: 'Create failed', description: data.error, variant: 'destructive' });
        return;
      }
      toast({ title: 'Academy created!', description: createForm.name.trim() });
      setCreateForm({ name: '', location: '', groundName: '' });
      await fetchAcademies();
      setView({ name: 'academies' });
    } catch {
      toast({ title: 'Network error', variant: 'destructive' });
    } finally {
      setCreating(false);
    }
  };

  // ─── Render ───
  return (
    <div className="fixed inset-0 z-50 bg-warm-50 dark:bg-warm-900 flex flex-col">
      <AnimatePresence mode="wait">
        {view.name === 'academies' && (
          <AcademiesListView
            key="academies"
            academies={academies}
            loading={loadingAcademies}
            error={academiesError}
            onClose={onClose}
            onRefresh={fetchAcademies}
            onCreate={() => setView({ name: 'create' })}
            onOpenAcademy={(id) => {
              fetchAcademyDetail(id);
              setView({ name: 'dashboard', academyId: id });
            }}
          />
        )}

        {view.name === 'create' && (
          <CreateAcademyView
            key="create"
            form={createForm}
            setForm={setCreateForm}
            creating={creating}
            onBack={() => setView({ name: 'academies' })}
            onCreate={handleCreate}
          />
        )}

        {view.name === 'dashboard' && (
          <AcademyDashboardView
            key={`dash-${view.academyId}`}
            academyId={view.academyId}
            academy={selectedAcademy}
            onBack={() => setView({ name: 'academies' })}
            onNavigate={(sub) => setView({ name: sub, academyId: view.academyId } as View)}
            onAcademyUpdated={() => {
              fetchAcademyDetail(view.academyId);
              fetchAcademies();
            }}
          />
        )}

        {view.name === 'attendance' && (
          <AttendanceView key={`att-${view.academyId}`} academyId={view.academyId} onBack={() => setView({ name: 'dashboard', academyId: view.academyId })} />
        )}

        {view.name === 'fees' && (
          <FeesView key={`fees-${view.academyId}`} academyId={view.academyId} onBack={() => setView({ name: 'dashboard', academyId: view.academyId })} />
        )}

        {view.name === 'announcements' && (
          <AnnouncementsView key={`ann-${view.academyId}`} academyId={view.academyId} coachUserId={currentUser?.id || ''} onBack={() => setView({ name: 'dashboard', academyId: view.academyId })} />
        )}

        {view.name === 'performances' && (
          <PerformancesView key={`perf-${view.academyId}`} academyId={view.academyId} onBack={() => setView({ name: 'dashboard', academyId: view.academyId })} />
        )}

        {view.name === 'players' && (
          <PlayersView
            key={`players-${view.academyId}`}
            academyId={view.academyId}
            onBack={() => setView({ name: 'dashboard', academyId: view.academyId })}
            onRefreshDashboard={() => fetchAcademyDetail(view.academyId)}
            startChatWith={startChatWith}
            toast={toast}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── Shared Header ────────────────────────────────────────────────────

function ScreenHeader({ title, subtitle, onBack, accent = 'emerald' }: { title: string; subtitle?: string; onBack: () => void; accent?: 'emerald' | 'orange' | 'amber' | 'violet' | 'blue' | 'red' }) {
  const accentBg = {
    emerald: 'from-emerald-500 to-teal-600',
    orange: 'from-orange-500 to-amber-600',
    amber: 'from-amber-500 to-yellow-600',
    violet: 'from-violet-500 to-fuchsia-600',
    blue: 'from-blue-500 to-cyan-600',
    red: 'from-red-500 to-rose-600',
  }[accent];
  return (
    <motion.div initial={{ y: -16, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className={`sticky top-0 z-20 bg-gradient-to-r ${accentBg} text-white shadow-md`}>
      <div className="flex items-center gap-3 px-4 py-3">
        <button onClick={onBack} className="w-9 h-9 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center transition-colors shrink-0">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="flex-1 min-w-0">
          <h1 className="font-black text-base leading-tight truncate">{title}</h1>
          {subtitle && <p className="text-[11px] text-white/80 truncate">{subtitle}</p>}
        </div>
      </div>
    </motion.div>
  );
}

function initials(name: string | null, code: string | null | undefined) {
  if (name && name.trim()) {
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    return name.slice(0, 2).toUpperCase();
  }
  if (code) return code.slice(-2);
  return '??';
}

// ─── 1. Academies List View ───────────────────────────────────────────

function AcademiesListView({ academies, loading, error, onClose, onRefresh, onCreate, onOpenAcademy }: {
  academies: AcademyData[];
  loading: boolean;
  error: string | null;
  onClose: () => void;
  onRefresh: () => void;
  onCreate: () => void;
  onOpenAcademy: (id: string) => void;
}) {
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex-1 flex flex-col">
      <motion.div initial={{ y: -16, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className="sticky top-0 z-20 bg-gradient-to-r from-emerald-500 to-teal-600 text-white shadow-md">
        <div className="flex items-center gap-3 px-4 py-3">
          <button onClick={onClose} className="w-9 h-9 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center transition-colors shrink-0">
            <X className="w-5 h-5" />
          </button>
          <div className="flex-1">
            <h1 className="font-black text-base">Coach's Corner</h1>
            <p className="text-[11px] text-white/80">Your academies</p>
          </div>
          <button onClick={onRefresh} className="w-9 h-9 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center transition-colors" title="Refresh">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className={loading ? 'animate-spin' : ''}><path d="M3 12a9 9 0 1 0 9-9"/><path d="M3 4v5h5"/></svg>
          </button>
        </div>
      </motion.div>

      <div className="flex-1 overflow-y-auto px-4 py-4 max-w-lg mx-auto w-full">
        {loading && academies.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16">
            <Loader2 className="w-8 h-8 text-emerald-500 animate-spin mb-3" />
            <p className="text-sm text-warm-500">Loading your academies...</p>
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center py-16">
            <AlertTriangle className="w-10 h-10 text-red-400 mb-3" />
            <p className="text-sm font-bold text-red-600 mb-1">{error}</p>
            <Button onClick={onRefresh} variant="outline" className="mt-3">Retry</Button>
          </div>
        ) : academies.length === 0 ? (
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col items-center justify-center py-16 text-center">
            <div className="w-20 h-20 rounded-3xl bg-gradient-to-br from-emerald-100 to-teal-100 dark:from-emerald-900/30 dark:to-teal-900/30 flex items-center justify-center mb-4">
              <Building2 className="w-10 h-10 text-emerald-500" />
            </div>
            <h2 className="text-lg font-black text-warm-800 dark:text-warm-100 mb-1">No Academies Yet</h2>
            <p className="text-sm text-warm-500 dark:text-warm-400 mb-5 max-w-xs">Create your first academy to start managing players, attendance, fees, and announcements.</p>
            <Button onClick={onCreate} className="bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white h-11 px-5 rounded-xl font-bold gap-2">
              <Plus className="w-4 h-4" /> Create Academy
            </Button>
          </motion.div>
        ) : (
          <>
            <div className="flex items-center justify-between mb-3">
              <p className="text-[11px] text-warm-500 dark:text-warm-400 uppercase tracking-wider font-semibold">
                {academies.length} {academies.length === 1 ? 'Academy' : 'Academies'}
              </p>
              <Button onClick={onCreate} size="sm" className="bg-emerald-500 hover:bg-emerald-600 text-white h-8 px-3 rounded-lg gap-1.5">
                <Plus className="w-3.5 h-3.5" /> New
              </Button>
            </div>
            <div className="space-y-3">
              {academies.map((a, idx) => (
                <motion.button
                  key={a.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: idx * 0.04 }}
                  onClick={() => onOpenAcademy(a.id)}
                  className="w-full text-left rounded-2xl bg-white dark:bg-warm-800 border border-warm-200 dark:border-warm-700 hover:border-emerald-300 dark:hover:border-emerald-700 hover:shadow-md transition-all p-4 active:scale-[0.98]"
                >
                  <div className="flex items-start gap-3">
                    <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center text-white font-black text-lg shrink-0">
                      {a.name.slice(0, 1).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-bold text-sm text-warm-800 dark:text-warm-100 truncate">{a.name}</h3>
                      {a.location && (
                        <p className="text-[11px] text-warm-500 dark:text-warm-400 flex items-center gap-1 mt-0.5">
                          <MapPin className="w-3 h-3" /> {a.location}
                        </p>
                      )}
                      <div className="flex items-center gap-3 mt-2">
                        <span className="text-[10px] font-bold text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/20 px-2 py-0.5 rounded-full flex items-center gap-1">
                          <Users className="w-2.5 h-2.5" /> {a._count?.players ?? a.players?.length ?? 0} players
                        </span>
                        {a.groundName && (
                          <span className="text-[10px] text-warm-400 dark:text-warm-500 truncate">{a.groundName}</span>
                        )}
                      </div>
                    </div>
                    <ChevronRight className="w-4 h-4 text-warm-400 shrink-0 mt-1" />
                  </div>
                </motion.button>
              ))}
            </div>
          </>
        )}
      </div>
    </motion.div>
  );
}

// ─── 2. Create Academy View ───────────────────────────────────────────

function CreateAcademyView({ form, setForm, creating, onBack, onCreate }: {
  form: { name: string; location: string; groundName: string };
  setForm: (f: { name: string; location: string; groundName: string }) => void;
  creating: boolean;
  onBack: () => void;
  onCreate: () => void;
}) {
  return (
    <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="flex-1 flex flex-col">
      <ScreenHeader title="Create Academy" subtitle="Set up your new academy" onBack={onBack} accent="emerald" />
      <div className="flex-1 overflow-y-auto px-4 py-5 max-w-lg mx-auto w-full">
        <div className="rounded-2xl bg-white dark:bg-warm-800 border border-warm-200 dark:border-warm-700 p-5 space-y-4">
          <div>
            <label className="text-xs font-bold text-warm-700 dark:text-warm-200 mb-1.5 block">Academy Name <span className="text-red-500">*</span></label>
            <Input
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="e.g., Rohtak Kabaddi Academy"
              className="h-11 rounded-xl"
              autoFocus
            />
          </div>
          <div>
            <label className="text-xs font-bold text-warm-700 dark:text-warm-200 mb-1.5 block">Location <span className="text-warm-400 font-normal">(optional)</span></label>
            <Input
              value={form.location}
              onChange={(e) => setForm({ ...form, location: e.target.value })}
              placeholder="e.g., Sector 3, Rohtak"
              className="h-11 rounded-xl"
            />
          </div>
          <div>
            <label className="text-xs font-bold text-warm-700 dark:text-warm-200 mb-1.5 block">Ground Name <span className="text-warm-400 font-normal">(optional)</span></label>
            <Input
              value={form.groundName}
              onChange={(e) => setForm({ ...form, groundName: e.target.value })}
              placeholder="e.g., Municipal Ground"
              className="h-11 rounded-xl"
            />
          </div>
        </div>
        <p className="text-[11px] text-warm-400 dark:text-warm-500 mt-3 px-1 leading-relaxed">
          You can add players, set attendance, collect fees, and send announcements after creating the academy.
        </p>
        <Button
          onClick={onCreate}
          disabled={creating || !form.name.trim()}
          className="w-full mt-4 h-12 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white font-bold disabled:opacity-50"
        >
          {creating ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Creating...</> : <><Plus className="w-4 h-4 mr-2" /> Create Academy</>}
        </Button>
      </div>
    </motion.div>
  );
}

// ─── 3. Academy Dashboard View (5 options) ────────────────────────────

function AcademyDashboardView({ academyId, academy, onBack, onNavigate, onAcademyUpdated }: {
  academyId: string;
  academy: AcademyData | null;
  onBack: () => void;
  onNavigate: (sub: 'attendance' | 'fees' | 'announcements' | 'performances' | 'players') => void;
  onAcademyUpdated?: () => void;
}) {
  const { toast } = useToast();
  const [localAcademy, setLocalAcademy] = useState<AcademyData | null>(academy);
  const [showEdit, setShowEdit] = useState(false);
  const [editForm, setEditForm] = useState({ name: '', location: '', groundName: '', sundayHoliday: false, twoSessions: false });
  const [savingEdit, setSavingEdit] = useState(false);

  useEffect(() => {
    if (!academyId) return;
    let cancelled = false;
    fetch(`/api/academies/${academyId}?_t=${Date.now()}`, { cache: 'no-store' })
      .then((r) => r.json())
      .then((data) => {
        if (!cancelled && data.academy) setLocalAcademy(data.academy);
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [academyId]);

  const openEdit = () => {
    setEditForm({
      name: localAcademy?.name || '',
      location: localAcademy?.location || '',
      groundName: localAcademy?.groundName || '',
      sundayHoliday: !!localAcademy?.sundayHoliday,
      twoSessions: localAcademy?.practiceSchedule === 'two-sessions',
    });
    setShowEdit(true);
  };

  const saveEdit = async () => {
    if (!editForm.name.trim()) {
      toast({ title: 'Academy name required', variant: 'destructive' });
      return;
    }
    setSavingEdit(true);
    try {
      const res = await fetch(`/api/academies/${academyId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: editForm.name.trim(),
          location: editForm.location.trim() || null,
          groundName: editForm.groundName.trim() || null,
          sundayHoliday: editForm.sundayHoliday,
          practiceSchedule: editForm.twoSessions ? 'two-sessions' : 'one-time',
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast({ title: 'Update failed', description: data.error, variant: 'destructive' });
        return;
      }
      if (data.academy) setLocalAcademy(data.academy);
      setShowEdit(false);
      toast({ title: 'Academy updated' });
      onAcademyUpdated?.();
    } catch {
      toast({ title: 'Network error', variant: 'destructive' });
    } finally {
      setSavingEdit(false);
    }
  };

  const playerCount = localAcademy?._count?.players ?? localAcademy?.players?.length ?? 0;

  const options: { id: 'attendance' | 'fees' | 'announcements' | 'performances' | 'players'; label: string; desc: string; icon: typeof Calendar; accent: 'emerald' | 'orange' | 'amber' | 'violet' | 'blue' }[] = [
    { id: 'attendance', label: 'Attendance', desc: 'Daily present/absent', icon: Calendar, accent: 'emerald' },
    { id: 'fees', label: 'Fees', desc: 'Monthly fee tracking', icon: IndianRupee, accent: 'amber' },
    { id: 'announcements', label: 'Announcements', desc: 'Broadcast to players', icon: Megaphone, accent: 'orange' },
    { id: 'performances', label: 'Performances', desc: 'Last match stats', icon: Trophy, accent: 'violet' },
    { id: 'players', label: 'Players', desc: `${playerCount} in roster · Call/Chat`, icon: Users, accent: 'blue' },
  ];

  const accentBg = {
    emerald: 'from-emerald-500 to-teal-600',
    orange: 'from-orange-500 to-amber-600',
    amber: 'from-amber-500 to-yellow-600',
    violet: 'from-violet-500 to-fuchsia-600',
    blue: 'from-blue-500 to-cyan-600',
  };

  return (
    <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="flex-1 flex flex-col">
      <ScreenHeader title={localAcademy?.name || 'Academy'} subtitle={localAcademy?.location || localAcademy?.groundName || undefined} onBack={onBack} accent="emerald" />
      <div className="flex-1 overflow-y-auto px-4 py-5 max-w-lg mx-auto w-full">
        {/* Academy info card */}
        {localAcademy && (
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="rounded-2xl bg-gradient-to-br from-emerald-50 to-teal-50 dark:from-emerald-900/20 dark:to-teal-900/20 border border-emerald-200 dark:border-emerald-800/30 p-4 mb-4">
            <div className="flex items-center gap-3">
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center text-white font-black text-xl shrink-0">
                {localAcademy.name.slice(0, 1).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-black text-sm text-warm-800 dark:text-warm-100 truncate">{localAcademy.name}</h3>
                {localAcademy.location && <p className="text-[11px] text-warm-500 dark:text-warm-400 flex items-center gap-1 mt-0.5"><MapPin className="w-3 h-3" /> {localAcademy.location}</p>}
                {localAcademy.groundName && <p className="text-[11px] text-warm-500 dark:text-warm-400 flex items-center gap-1 mt-0.5"><Building2 className="w-3 h-3" /> {localAcademy.groundName}</p>}
              </div>
              <button
                onClick={openEdit}
                title="Edit Academy"
                className="w-9 h-9 rounded-full bg-white/70 dark:bg-warm-800/70 hover:bg-white dark:hover:bg-warm-700 text-emerald-600 dark:text-emerald-400 flex items-center justify-center transition-colors shrink-0"
              >
                <Pencil className="w-4 h-4" />
              </button>
            </div>
            <div className="grid grid-cols-3 gap-2 mt-3">
              <div className="rounded-lg bg-white/60 dark:bg-warm-800/60 p-2 text-center">
                <div className="text-base font-black text-emerald-700 dark:text-emerald-400">{playerCount}</div>
                <div className="text-[9px] text-warm-500 uppercase tracking-wider">Players</div>
              </div>
              <div className="rounded-lg bg-white/60 dark:bg-warm-800/60 p-2 text-center">
                <div className="text-base font-black text-amber-700 dark:text-amber-400">₹0</div>
                <div className="text-[9px] text-warm-500 uppercase tracking-wider">Fees</div>
              </div>
              <div className="rounded-lg bg-white/60 dark:bg-warm-800/60 p-2 text-center">
                <div className="text-base font-black text-violet-700 dark:text-violet-400">0</div>
                <div className="text-[9px] text-warm-500 uppercase tracking-wider">Matches</div>
              </div>
            </div>
            {/* Schedule badges */}
            <div className="flex flex-wrap gap-1.5 mt-3">
              {localAcademy.practiceSchedule === 'two-sessions' && (
                <span className="text-[9px] font-bold text-emerald-700 dark:text-emerald-400 bg-emerald-100 dark:bg-emerald-900/30 px-2 py-0.5 rounded-full flex items-center gap-1">
                  <Clock className="w-2.5 h-2.5" /> Morning + Evening
                </span>
              )}
              {localAcademy.sundayHoliday && (
                <span className="text-[9px] font-bold text-amber-700 dark:text-amber-400 bg-amber-100 dark:bg-amber-900/30 px-2 py-0.5 rounded-full flex items-center gap-1">
                  <Sun className="w-2.5 h-2.5" /> Sunday Holiday
                </span>
              )}
            </div>
          </motion.div>
        )}

        {/* 5 options */}
        <div className="space-y-3">
          {options.map((opt, idx) => {
            const Icon = opt.icon;
            return (
              <motion.button
                key={opt.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.05 }}
                onClick={() => onNavigate(opt.id)}
                className="w-full flex items-center gap-4 p-4 rounded-2xl bg-white dark:bg-warm-800 border border-warm-200 dark:border-warm-700 hover:border-emerald-300 dark:hover:border-emerald-700 hover:shadow-md transition-all active:scale-[0.98] text-left"
              >
                <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${accentBg[opt.accent]} flex items-center justify-center text-white shrink-0 shadow-sm`}>
                  <Icon className="w-5 h-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-bold text-sm text-warm-800 dark:text-warm-100">{opt.label}</h3>
                  <p className="text-[11px] text-warm-500 dark:text-warm-400 truncate">{opt.desc}</p>
                </div>
                <ChevronRight className="w-5 h-5 text-warm-400 shrink-0" />
              </motion.button>
            );
          })}
        </div>
      </div>

      {/* Edit Academy bottom sheet */}
      <AnimatePresence>
        {showEdit && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setShowEdit(false)}
            className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm flex items-end justify-center"
          >
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-lg bg-white dark:bg-warm-800 rounded-t-3xl p-5 pb-8 max-h-[90vh] overflow-y-auto"
            >
              <div className="w-12 h-1.5 bg-warm-200 dark:bg-warm-700 rounded-full mx-auto mb-4" />
              <div className="flex items-center gap-2 mb-4">
                <Pencil className="w-4 h-4 text-emerald-500" />
                <h3 className="font-black text-base text-warm-800 dark:text-warm-100">Edit Academy</h3>
              </div>

              <label className="text-xs font-bold text-warm-700 dark:text-warm-200 mb-1.5 block">Academy Name <span className="text-red-500">*</span></label>
              <Input
                value={editForm.name}
                onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                placeholder="e.g., Star Kabaddi Academy"
                className="h-11 rounded-xl mb-3"
              />

              <label className="text-xs font-bold text-warm-700 dark:text-warm-200 mb-1.5 block">Location <span className="text-warm-400 font-normal">(optional)</span></label>
              <Input
                value={editForm.location}
                onChange={(e) => setEditForm({ ...editForm, location: e.target.value })}
                placeholder="e.g., Pune, Maharashtra"
                className="h-11 rounded-xl mb-3"
              />

              <label className="text-xs font-bold text-warm-700 dark:text-warm-200 mb-1.5 block">Ground Name <span className="text-warm-400 font-normal">(optional)</span></label>
              <Input
                value={editForm.groundName}
                onChange={(e) => setEditForm({ ...editForm, groundName: e.target.value })}
                placeholder="e.g., Shivaji Ground"
                className="h-11 rounded-xl mb-4"
              />

              <div className="space-y-2 mb-4">
                <button
                  type="button"
                  onClick={() => setEditForm({ ...editForm, twoSessions: !editForm.twoSessions })}
                  className={`w-full flex items-center gap-3 p-3 rounded-xl border-2 transition-all text-left ${
                    editForm.twoSessions
                      ? 'border-emerald-400 bg-emerald-50 dark:bg-emerald-900/20'
                      : 'border-warm-200 dark:border-warm-700 bg-white dark:bg-warm-800'
                  }`}
                >
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${editForm.twoSessions ? 'bg-emerald-500 text-white' : 'bg-warm-100 dark:bg-warm-700 text-warm-500'}`}>
                    <Clock className="w-5 h-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-warm-800 dark:text-warm-100">Two sessions per day</p>
                    <p className="text-[11px] text-warm-500 dark:text-warm-400">Mark attendance separately for Morning &amp; Evening</p>
                  </div>
                  <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center shrink-0 ${editForm.twoSessions ? 'bg-emerald-500 border-emerald-500' : 'border-warm-300 dark:border-warm-600'}`}>
                    {editForm.twoSessions && <Check className="w-3.5 h-3.5 text-white" />}
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setEditForm({ ...editForm, sundayHoliday: !editForm.sundayHoliday })}
                  className={`w-full flex items-center gap-3 p-3 rounded-xl border-2 transition-all text-left ${
                    editForm.sundayHoliday
                      ? 'border-amber-400 bg-amber-50 dark:bg-amber-900/20'
                      : 'border-warm-200 dark:border-warm-700 bg-white dark:bg-warm-800'
                  }`}
                >
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${editForm.sundayHoliday ? 'bg-amber-500 text-white' : 'bg-warm-100 dark:bg-warm-700 text-warm-500'}`}>
                    <Sun className="w-5 h-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-warm-800 dark:text-warm-100">Sunday Holiday</p>
                    <p className="text-[11px] text-warm-500 dark:text-warm-400">Sundays are off — no attendance expected</p>
                  </div>
                  <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center shrink-0 ${editForm.sundayHoliday ? 'bg-amber-500 border-amber-500' : 'border-warm-300 dark:border-warm-600'}`}>
                    {editForm.sundayHoliday && <Check className="w-3.5 h-3.5 text-white" />}
                  </div>
                </button>
              </div>

              <Button
                onClick={saveEdit}
                disabled={savingEdit || !editForm.name.trim()}
                className="w-full h-11 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white font-bold"
              >
                {savingEdit ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Saving...</> : <><Save className="w-4 h-4 mr-2" /> Save Changes</>}
              </Button>
              <Button onClick={() => setShowEdit(false)} variant="ghost" className="w-full mt-2 h-9 text-warm-500">
                Cancel
              </Button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

// ─── 4. Attendance View (simple, all entries saved forever) ───────────

function AttendanceView({ academyId, onBack }: { academyId: string; onBack: () => void }) {
  const { toast } = useToast();
  const [players, setPlayers] = useState<AcademyPlayerData[]>([]);
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10)); // YYYY-MM-DD
  // records keyed by `${userId}|${session}` so morning & evening stay independent
  const [records, setRecords] = useState<Map<string, boolean>>(new Map());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [practiceSchedule, setPracticeSchedule] = useState<string>('one-time');
  const [session, setSession] = useState<'default' | 'morning' | 'evening'>('default');

  const twoSessions = practiceSchedule === 'two-sessions';
  // When academy schedule changes, reset session selector
  useEffect(() => {
    setSession(twoSessions ? 'morning' : 'default');
  }, [twoSessions]);

  // Load roster + attendance for this date (all sessions)
  const loadAll = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [academyRes, attRes] = await Promise.all([
        fetch(`/api/academies/${academyId}?_t=${Date.now()}`, { cache: 'no-store' }),
        fetch(`/api/coach/attendance?academyId=${academyId}&date=${date}&_t=${Date.now()}`, { cache: 'no-store' }),
      ]);
      const academyData = await academyRes.json();
      const attData = await attRes.json();
      if (!academyRes.ok) throw new Error(academyData.error || 'Failed to load academy');
      const roster: AcademyPlayerData[] = academyData.academy?.players || [];
      setPlayers(roster);
      if (academyData.academy?.practiceSchedule) {
        setPracticeSchedule(academyData.academy.practiceSchedule);
      }
      // Key records by userId|session so we can swap between morning/evening without losing state
      const map = new Map<string, boolean>();
      for (const r of (attData.attendance || attData.records || []) as AttendanceRecord[]) {
        map.set(`${r.userId}|${r.session || 'default'}`, r.isPresent);
      }
      setRecords(map);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Network error');
      setPlayers([]);
    } finally {
      setLoading(false);
    }
  }, [academyId, date]);

  useEffect(() => { loadAll(); }, [loadAll]);

  const key = (userId: string) => `${userId}|${session}`;
  const toggle = (userId: string) => {
    setRecords((prev) => {
      const next = new Map(prev);
      const k = key(userId);
      next.set(k, !next.get(k));
      return next;
    });
  };
  const markAll = (present: boolean) => {
    setRecords((prev) => {
      const next = new Map(prev);
      for (const p of players) next.set(key(p.userId), present);
      return next;
    });
  };

  const saveAll = async () => {
    setSaving(true);
    try {
      // POST one record per player for the currently selected session
      const promises = players.map((p) =>
        fetch('/api/coach/attendance', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            academyId,
            userId: p.userId,
            date,
            isPresent: records.get(key(p.userId)) ?? false,
            session,
          }),
        })
      );
      await Promise.all(promises);
      const sessionLabel = session === 'default' ? '' : ` (${session})`;
      toast({ title: 'Attendance saved', description: `${players.length} ${players.length === 1 ? 'player' : 'players'} marked for ${date}${sessionLabel}` });
    } catch {
      toast({ title: 'Save failed', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const presentCount = players.filter((p) => records.get(key(p.userId)) === true).length;
  const absentCount = players.length - presentCount;

  return (
    <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="flex-1 flex flex-col">
      <ScreenHeader title="Attendance" subtitle={date} onBack={onBack} accent="emerald" />
      <div className="flex-1 overflow-y-auto px-4 py-4 max-w-lg mx-auto w-full pb-24">
        {/* Date picker + summary */}
        <div className="rounded-2xl bg-white dark:bg-warm-800 border border-warm-200 dark:border-warm-700 p-3 mb-3">
          <div className="flex items-center gap-2">
            <CalendarDays className="w-4 h-4 text-emerald-500 shrink-0" />
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              max="2099-12-31"
              className="flex-1 bg-transparent text-sm font-bold text-warm-800 dark:text-warm-100 focus:outline-none"
            />
          </div>

          {/* Session toggle (only when academy has two-sessions enabled) */}
          {twoSessions && players.length > 0 && (
            <div className="mt-3 grid grid-cols-2 gap-2 p-1 rounded-xl bg-warm-100 dark:bg-warm-700/50">
              <button
                onClick={() => setSession('morning')}
                className={`flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-bold transition-all ${
                  session === 'morning'
                    ? 'bg-white dark:bg-warm-800 text-amber-600 shadow-sm'
                    : 'text-warm-500'
                }`}
              >
                <Sun className="w-3.5 h-3.5" /> Morning
              </button>
              <button
                onClick={() => setSession('evening')}
                className={`flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-bold transition-all ${
                  session === 'evening'
                    ? 'bg-white dark:bg-warm-800 text-indigo-600 shadow-sm'
                    : 'text-warm-500'
                }`}
              >
                <Moon className="w-3.5 h-3.5" /> Evening
              </button>
            </div>
          )}

          {players.length > 0 && (
            <div className="grid grid-cols-3 gap-2 mt-3">
              <div className="rounded-lg bg-emerald-50 dark:bg-emerald-900/20 p-2 text-center">
                <div className="text-base font-black text-emerald-700 dark:text-emerald-400">{presentCount}</div>
                <div className="text-[9px] text-warm-500 uppercase tracking-wider">Present</div>
              </div>
              <div className="rounded-lg bg-red-50 dark:bg-red-900/20 p-2 text-center">
                <div className="text-base font-black text-red-700 dark:text-red-400">{absentCount}</div>
                <div className="text-[9px] text-warm-500 uppercase tracking-wider">Absent</div>
              </div>
              <div className="rounded-lg bg-warm-50 dark:bg-warm-700/40 p-2 text-center">
                <div className="text-base font-black text-warm-700 dark:text-warm-300">{players.length}</div>
                <div className="text-[9px] text-warm-500 uppercase tracking-wider">Total</div>
              </div>
            </div>
          )}
          {players.length > 0 && (
            <div className="flex gap-2 mt-3">
              <button onClick={() => markAll(true)} className="flex-1 py-1.5 rounded-lg bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 text-[11px] font-bold hover:bg-emerald-200 dark:hover:bg-emerald-900/50">
                All Present
              </button>
              <button onClick={() => markAll(false)} className="flex-1 py-1.5 rounded-lg bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 text-[11px] font-bold hover:bg-red-200 dark:hover:bg-red-900/50">
                All Absent
              </button>
            </div>
          )}
          {twoSessions && players.length > 0 && (
            <p className="text-[10px] text-warm-500 dark:text-warm-400 mt-2 text-center">
              Marking <span className="font-bold capitalize">{session}</span> session. Switch tab to mark the other.
            </p>
          )}
        </div>

        {/* Player list */}
        {loading ? (
          <div className="flex flex-col items-center justify-center py-12">
            <Loader2 className="w-8 h-8 text-emerald-500 animate-spin mb-3" />
            <p className="text-sm text-warm-500">Loading roster...</p>
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center py-12">
            <AlertTriangle className="w-8 h-8 text-red-400 mb-2" />
            <p className="text-sm font-bold text-red-600">{error}</p>
            <Button onClick={loadAll} variant="outline" className="mt-3" size="sm">Retry</Button>
          </div>
        ) : players.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <Users className="w-10 h-10 text-warm-300 mb-3" />
            <p className="text-sm font-bold text-warm-700 dark:text-warm-200 mb-1">No players in roster</p>
            <p className="text-xs text-warm-500">Add players from the Players tab first.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {players.map((p) => {
              const isPresent = records.get(key(p.userId)) === true;
              return (
                <motion.button
                  key={`${p.userId}-${session}`}
                  onClick={() => toggle(p.userId)}
                  className={`w-full flex items-center gap-3 p-3 rounded-xl border transition-all active:scale-[0.98] text-left ${
                    isPresent
                      ? 'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-300 dark:border-emerald-800'
                      : 'bg-white dark:bg-warm-800 border-warm-200 dark:border-warm-700'
                  }`}
                >
                  <div className="w-10 h-10 rounded-full overflow-hidden bg-gradient-to-br from-emerald-400 to-teal-500 flex items-center justify-center text-white font-bold text-xs shrink-0">
                    {p.user.avatar ? <img src={p.user.avatar} alt="" className="w-full h-full object-cover" /> : initials(p.user.name, p.user.playerCode)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-warm-800 dark:text-warm-100 truncate">{p.user.name || 'Unnamed'}</p>
                    {p.user.playerCode && <p className="text-[10px] font-mono text-warm-500">{p.user.playerCode}</p>}
                  </div>
                  <div className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 transition-colors ${isPresent ? 'bg-emerald-500 text-white' : 'bg-warm-200 dark:bg-warm-700 text-warm-400'}`}>
                    {isPresent ? <Check className="w-4 h-4" /> : <X className="w-4 h-4" />}
                  </div>
                </motion.button>
              );
            })}
          </div>
        )}
      </div>

      {/* Sticky save bar */}
      {players.length > 0 && (
        <div className="sticky bottom-0 bg-white/95 dark:bg-warm-800/95 backdrop-blur border-t border-warm-200 dark:border-warm-700 px-4 py-3">
          <Button
            onClick={saveAll}
            disabled={saving || loading}
            className="w-full h-11 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white font-bold disabled:opacity-50"
          >
            {saving ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Saving...</> : <><Check className="w-4 h-4 mr-2" /> Save Attendance{twoSessions && <span className="capitalize"> · {session}</span>}</>}
          </Button>
        </div>
      )}
    </motion.div>
  );
}

// ─── 5. Fees View (simple monthly) ────────────────────────────────────

function FeesView({ academyId, onBack }: { academyId: string; onBack: () => void }) {
  const { toast } = useToast();
  const [players, setPlayers] = useState<AcademyPlayerData[]>([]);
  const [month, setMonth] = useState(new Date().toISOString().slice(0, 7)); // YYYY-MM
  const [feeRecords, setFeeRecords] = useState<Map<string, FeeRecordData>>(new Map());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionPlayer, setActionPlayer] = useState<AcademyPlayerData | null>(null);
  const [amountInput, setAmountInput] = useState('');
  const [periodInput, setPeriodInput] = useState<'monthly' | 'weekly' | 'daily' | 'yearly' | 'custom'>('monthly');
  const [saving, setSaving] = useState(false);

  const loadAll = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [academyRes, feesRes] = await Promise.all([
        fetch(`/api/academies/${academyId}?_t=${Date.now()}`, { cache: 'no-store' }),
        fetch(`/api/coach/fees?academyId=${academyId}&month=${month}&_t=${Date.now()}`, { cache: 'no-store' }),
      ]);
      const academyData = await academyRes.json();
      const feesData = await feesRes.json();
      if (!academyRes.ok) throw new Error(academyData.error || 'Failed to load academy');
      setPlayers(academyData.academy?.players || []);
      const map = new Map<string, FeeRecordData>();
      for (const r of (feesData.fees || feesData.records || []) as FeeRecordData[]) {
        map.set(r.userId, r);
      }
      setFeeRecords(map);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Network error');
      setPlayers([]);
    } finally {
      setLoading(false);
    }
  }, [academyId, month]);

  useEffect(() => { loadAll(); }, [loadAll]);

  const openAction = (p: AcademyPlayerData) => {
    const existing = feeRecords.get(p.userId);
    setAmountInput(existing ? String(existing.amount) : '500');
    setPeriodInput((existing?.period as any) || 'monthly');
    setActionPlayer(p);
  };

  const saveFee = async (isPaid: boolean) => {
    if (!actionPlayer) return;
    const amount = parseInt(amountInput, 10);
    if (isNaN(amount) || amount < 0) {
      toast({ title: 'Enter a valid amount', variant: 'destructive' });
      return;
    }
    setSaving(true);
    try {
      const res = await fetch('/api/coach/fees', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          academyId,
          userId: actionPlayer.userId,
          month,
          amount,
          isPaid,
          period: periodInput,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast({ title: 'Save failed', description: data.error, variant: 'destructive' });
        return;
      }
      toast({ title: isPaid ? 'Marked as Paid' : 'Marked as Pending', description: `${actionPlayer.user.name || 'Player'} · ₹${amount}` });
      setActionPlayer(null);
      await loadAll();
    } catch {
      toast({ title: 'Network error', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const totalCollected = players.reduce((sum, p) => {
    const r = feeRecords.get(p.userId);
    return r && r.status === 'paid' ? sum + r.amount : sum;
  }, 0);
  const totalPending = players.reduce((sum, p) => {
    const r = feeRecords.get(p.userId);
    return r && r.status !== 'paid' ? sum + r.amount : sum;
  }, 0);

  return (
    <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="flex-1 flex flex-col">
      <ScreenHeader title="Fees" subtitle={`Month: ${month}`} onBack={onBack} accent="amber" />
      <div className="flex-1 overflow-y-auto px-4 py-4 max-w-lg mx-auto w-full">
        {/* Month picker + summary */}
        <div className="rounded-2xl bg-white dark:bg-warm-800 border border-warm-200 dark:border-warm-700 p-3 mb-3">
          <div className="flex items-center gap-2">
            <CalendarDays className="w-4 h-4 text-amber-500 shrink-0" />
            <input
              type="month"
              value={month}
              onChange={(e) => setMonth(e.target.value)}
              className="flex-1 bg-transparent text-sm font-bold text-warm-800 dark:text-warm-100 focus:outline-none"
            />
          </div>
          {players.length > 0 && (
            <div className="grid grid-cols-2 gap-2 mt-3">
              <div className="rounded-lg bg-emerald-50 dark:bg-emerald-900/20 p-2 text-center">
                <div className="text-base font-black text-emerald-700 dark:text-emerald-400">₹{totalCollected.toLocaleString()}</div>
                <div className="text-[9px] text-warm-500 uppercase tracking-wider">Collected</div>
              </div>
              <div className="rounded-lg bg-red-50 dark:bg-red-900/20 p-2 text-center">
                <div className="text-base font-black text-red-700 dark:text-red-400">₹{totalPending.toLocaleString()}</div>
                <div className="text-[9px] text-warm-500 uppercase tracking-wider">Pending</div>
              </div>
            </div>
          )}
        </div>

        {loading ? (
          <div className="flex flex-col items-center justify-center py-12">
            <Loader2 className="w-8 h-8 text-amber-500 animate-spin mb-3" />
            <p className="text-sm text-warm-500">Loading fees...</p>
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center py-12">
            <AlertTriangle className="w-8 h-8 text-red-400 mb-2" />
            <p className="text-sm font-bold text-red-600">{error}</p>
            <Button onClick={loadAll} variant="outline" className="mt-3" size="sm">Retry</Button>
          </div>
        ) : players.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <IndianRupee className="w-10 h-10 text-warm-300 mb-3" />
            <p className="text-sm font-bold text-warm-700 dark:text-warm-200 mb-1">No players in roster</p>
          </div>
        ) : (
          <div className="space-y-2">
            {players.map((p) => {
              const r = feeRecords.get(p.userId);
              const isPaid = r?.status === 'paid';
              return (
                <motion.button
                  key={p.userId}
                  initial={{ opacity: 0, y: 5 }}
                  animate={{ opacity: 1, y: 0 }}
                  onClick={() => openAction(p)}
                  className={`w-full flex items-center gap-3 p-3 rounded-xl border transition-all text-left active:scale-[0.98] ${
                    isPaid
                      ? 'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-300 dark:border-emerald-800'
                      : r
                      ? 'bg-amber-50 dark:bg-amber-900/20 border-amber-300 dark:border-amber-800'
                      : 'bg-white dark:bg-warm-800 border-warm-200 dark:border-warm-700'
                  }`}
                >
                  <div className="w-10 h-10 rounded-full overflow-hidden bg-gradient-to-br from-amber-400 to-yellow-500 flex items-center justify-center text-white font-bold text-xs shrink-0">
                    {p.user.avatar ? <img src={p.user.avatar} alt="" className="w-full h-full object-cover" /> : initials(p.user.name, p.user.playerCode)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-warm-800 dark:text-warm-100 truncate">{p.user.name || 'Unnamed'}</p>
                    <p className="text-[10px] text-warm-500">
                      {r ? `₹${r.amount} · ${r.period}` : 'No record'}
                    </p>
                  </div>
                  <span className={`shrink-0 text-[9px] font-bold px-2 py-0.5 rounded-full ${
                    isPaid ? 'bg-emerald-500 text-white' : r ? 'bg-amber-500 text-white' : 'bg-warm-200 dark:bg-warm-700 text-warm-500'
                  }`}>
                    {isPaid ? 'PAID' : r ? 'PENDING' : 'NONE'}
                  </span>
                </motion.button>
              );
            })}
          </div>
        )}
      </div>

      {/* Action sheet */}
      <AnimatePresence>
        {actionPlayer && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setActionPlayer(null)}
            className="fixed inset-0 z-30 bg-black/50 backdrop-blur-sm flex items-end justify-center"
          >
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-lg bg-white dark:bg-warm-800 rounded-t-3xl p-5 pb-8"
            >
              <div className="w-12 h-1.5 bg-warm-200 dark:bg-warm-700 rounded-full mx-auto mb-4" />
              <h3 className="font-black text-base text-warm-800 dark:text-warm-100 mb-1">{actionPlayer.user.name || 'Player'}</h3>
              <p className="text-xs text-warm-500 mb-4">Fee for {month}</p>

              <label className="text-xs font-bold text-warm-700 dark:text-warm-200 mb-1.5 block">Amount (₹)</label>
              <Input
                type="number"
                value={amountInput}
                onChange={(e) => setAmountInput(e.target.value)}
                className="h-11 rounded-xl mb-3"
                placeholder="500"
              />

              <label className="text-xs font-bold text-warm-700 dark:text-warm-200 mb-1.5 block">Period</label>
              <div className="grid grid-cols-5 gap-1.5 mb-4">
                {(['daily', 'weekly', 'monthly', 'yearly', 'custom'] as const).map((p) => (
                  <button
                    key={p}
                    onClick={() => setPeriodInput(p)}
                    className={`py-1.5 rounded-lg text-[10px] font-bold capitalize transition-colors ${
                      periodInput === p
                        ? 'bg-amber-500 text-white'
                        : 'bg-warm-100 dark:bg-warm-700 text-warm-600 dark:text-warm-300'
                    }`}
                  >
                    {p}
                  </button>
                ))}
              </div>

              <div className="flex gap-2">
                <Button
                  onClick={() => saveFee(false)}
                  disabled={saving}
                  variant="outline"
                  className="flex-1 h-11 rounded-xl border-amber-300 text-amber-700 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-900/20"
                >
                  Mark Pending
                </Button>
                <Button
                  onClick={() => saveFee(true)}
                  disabled={saving}
                  className="flex-1 h-11 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white"
                >
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Check className="w-4 h-4 mr-1.5" /> Mark Paid</>}
                </Button>
              </div>
              <Button onClick={() => setActionPlayer(null)} variant="ghost" className="w-full mt-2 h-9 text-warm-500">
                Cancel
              </Button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

// ─── 6. Announcements View ────────────────────────────────────────────

function AnnouncementsView({ academyId, coachUserId, onBack }: { academyId: string; coachUserId: string; onBack: () => void }) {
  const { toast } = useToast();
  const [announcements, setAnnouncements] = useState<AnnouncementData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const loadAnnouncements = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/coach/announcements?academyId=${academyId}&_t=${Date.now()}`, { cache: 'no-store' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to load');
      setAnnouncements(data.announcements || []);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Network error');
      setAnnouncements([]);
    } finally {
      setLoading(false);
    }
  }, [academyId]);

  useEffect(() => { loadAnnouncements(); }, [loadAnnouncements]);

  const send = async () => {
    if (!title.trim() && !message.trim()) {
      toast({ title: 'Add a title or message', variant: 'destructive' });
      return;
    }
    setSending(true);
    try {
      const res = await fetch('/api/coach/announcements', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          academyId,
          coachUserId,
          title: title.trim() || 'Announcement',
          message: message.trim(),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast({ title: 'Send failed', description: data.error, variant: 'destructive' });
        return;
      }
      toast({ title: 'Announcement sent', description: 'All academy players notified' });
      setTitle(''); setMessage(''); setShowForm(false);
      await loadAnnouncements();
    } catch {
      toast({ title: 'Network error', variant: 'destructive' });
    } finally {
      setSending(false);
    }
  };

  const del = async (id: string) => {
    if (!confirm('Delete this announcement?')) return;
    setDeletingId(id);
    try {
      const res = await fetch(`/api/coach/announcements/${id}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ coachUserId }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast({ title: 'Delete failed', description: data.error, variant: 'destructive' });
        return;
      }
      toast({ title: 'Deleted' });
      await loadAnnouncements();
    } catch {
      toast({ title: 'Network error', variant: 'destructive' });
    } finally {
      setDeletingId(null);
    }
  };

  const fmtDate = (iso: string) => {
    try {
      const d = new Date(iso);
      const now = new Date();
      const diff = Math.floor((now.getTime() - d.getTime()) / (60 * 1000));
      if (diff < 1) return 'just now';
      if (diff < 60) return `${diff}m ago`;
      if (diff < 1440) return `${Math.floor(diff / 60)}h ago`;
      if (diff < 10080) return `${Math.floor(diff / 1440)}d ago`;
      return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
    } catch { return ''; }
  };

  return (
    <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="flex-1 flex flex-col">
      <ScreenHeader title="Announcements" subtitle="Broadcast to all players" onBack={onBack} accent="orange" />
      <div className="flex-1 overflow-y-auto px-4 py-4 max-w-lg mx-auto w-full">
        <Button
          onClick={() => setShowForm(true)}
          className="w-full mb-3 h-11 rounded-xl bg-gradient-to-r from-orange-500 to-amber-600 hover:from-orange-600 hover:to-amber-700 text-white font-bold gap-2"
        >
          <Plus className="w-4 h-4" /> New Announcement
        </Button>

        {loading ? (
          <div className="flex flex-col items-center justify-center py-12">
            <Loader2 className="w-8 h-8 text-orange-500 animate-spin mb-3" />
            <p className="text-sm text-warm-500">Loading announcements...</p>
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center py-12">
            <AlertTriangle className="w-8 h-8 text-red-400 mb-2" />
            <p className="text-sm font-bold text-red-600">{error}</p>
            <Button onClick={loadAnnouncements} variant="outline" className="mt-3" size="sm">Retry</Button>
          </div>
        ) : announcements.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <Megaphone className="w-10 h-10 text-warm-300 mb-3" />
            <p className="text-sm font-bold text-warm-700 dark:text-warm-200 mb-1">No announcements yet</p>
            <p className="text-xs text-warm-500">Send your first message to all academy players.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {announcements.map((a, idx) => (
              <motion.div
                key={a.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.04 }}
                className="rounded-2xl bg-white dark:bg-warm-800 border border-warm-200 dark:border-warm-700 p-4"
              >
                <div className="flex items-start gap-3">
                  <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-orange-500 to-amber-600 flex items-center justify-center text-white shrink-0">
                    <Megaphone className="w-4 h-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <h3 className="font-bold text-sm text-warm-800 dark:text-warm-100 truncate flex-1">{a.title}</h3>
                      <button
                        onClick={() => del(a.id)}
                        disabled={deletingId === a.id}
                        className="text-warm-400 hover:text-red-500 shrink-0"
                        title="Delete"
                      >
                        {deletingId === a.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                    <p className="text-xs text-warm-600 dark:text-warm-300 leading-relaxed whitespace-pre-wrap">{a.message}</p>
                    <div className="flex items-center gap-1.5 mt-2 text-[10px] text-warm-400">
                      <Clock className="w-3 h-3" />
                      {fmtDate(a.createdAt)}
                      {a.coach?.name && <span>· by {a.coach.name}</span>}
                    </div>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>

      {/* New announcement sheet */}
      <AnimatePresence>
        {showForm && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setShowForm(false)}
            className="fixed inset-0 z-30 bg-black/50 backdrop-blur-sm flex items-end justify-center"
          >
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-lg bg-white dark:bg-warm-800 rounded-t-3xl p-5 pb-8"
            >
              <div className="w-12 h-1.5 bg-warm-200 dark:bg-warm-700 rounded-full mx-auto mb-4" />
              <h3 className="font-black text-base text-warm-800 dark:text-warm-100 mb-3">New Announcement</h3>

              <label className="text-xs font-bold text-warm-700 dark:text-warm-200 mb-1.5 block">Title</label>
              <Input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g., Practice cancelled tomorrow"
                className="h-11 rounded-xl mb-3"
              />

              <label className="text-xs font-bold text-warm-700 dark:text-warm-200 mb-1.5 block">Message</label>
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Type your message to all academy players..."
                rows={4}
                className="w-full rounded-xl border border-warm-200 dark:border-warm-700 bg-white dark:bg-warm-900 px-3 py-2 text-sm text-warm-800 dark:text-warm-100 focus:outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-400/20 resize-none"
              />

              <Button
                onClick={send}
                disabled={sending}
                className="w-full mt-4 h-11 rounded-xl bg-gradient-to-r from-orange-500 to-amber-600 hover:from-orange-600 hover:to-amber-700 text-white font-bold"
              >
                {sending ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Sending...</> : <><Send className="w-4 h-4 mr-2" /> Send to All Players</>}
              </Button>
              <Button onClick={() => setShowForm(false)} variant="ghost" className="w-full mt-2 h-9 text-warm-500">
                Cancel
              </Button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

// ─── 7. Performances View (last match stats) ──────────────────────────

function PerformancesView({ academyId, onBack }: { academyId: string; onBack: () => void }) {
  const { toast } = useToast();
  const [lastMatch, setLastMatch] = useState<LastMatchData | null>(null);
  const [players, setPlayers] = useState<PerformancePlayer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/coach/performances?academyId=${academyId}&_t=${Date.now()}`, { cache: 'no-store' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to load');
      setLastMatch(data.lastMatch);
      setPlayers(data.players || []);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Network error');
      setPlayers([]);
      setLastMatch(null);
    } finally {
      setLoading(false);
    }
  }, [academyId]);

  useEffect(() => { load(); }, [load]);

  const fmtDate = (iso: string | null) => {
    if (!iso) return '';
    try {
      return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
    } catch { return ''; }
  };

  return (
    <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="flex-1 flex flex-col">
      <ScreenHeader title="Performances" subtitle="Last match stats" onBack={onBack} accent="violet" />
      <div className="flex-1 overflow-y-auto px-4 py-4 max-w-lg mx-auto w-full">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-12">
            <Loader2 className="w-8 h-8 text-violet-500 animate-spin mb-3" />
            <p className="text-sm text-warm-500">Loading performances...</p>
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center py-12">
            <AlertTriangle className="w-8 h-8 text-red-400 mb-2" />
            <p className="text-sm font-bold text-red-600">{error}</p>
            <Button onClick={load} variant="outline" className="mt-3" size="sm">Retry</Button>
          </div>
        ) : !lastMatch ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <Trophy className="w-10 h-10 text-warm-300 mb-3" />
            <p className="text-sm font-bold text-warm-700 dark:text-warm-200 mb-1">No match data yet</p>
            <p className="text-xs text-warm-500 max-w-xs">Once your academy players score in matches, their last match performance will appear here.</p>
          </div>
        ) : (
          <>
            {/* Last match card */}
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className="rounded-2xl bg-gradient-to-br from-violet-50 to-fuchsia-50 dark:from-violet-900/20 dark:to-fuchsia-900/20 border border-violet-200 dark:border-violet-800/30 p-4 mb-3"
            >
              <div className="flex items-center gap-2 mb-2">
                <Trophy className="w-4 h-4 text-violet-500" />
                <span className="text-[10px] font-bold uppercase tracking-wider text-violet-700 dark:text-violet-400">
                  {lastMatch.tournamentName || (lastMatch.isPractice ? 'Practice Match' : 'Match')}
                </span>
              </div>
              <div className="flex items-center justify-between gap-2">
                <div className="flex-1 text-center">
                  <p className="text-xs font-bold text-warm-700 dark:text-warm-200 truncate">{lastMatch.homeTeamName}</p>
                  <p className="text-2xl font-black text-warm-800 dark:text-warm-100">{lastMatch.homeScore}</p>
                </div>
                <span className="text-[10px] font-bold text-warm-400">VS</span>
                <div className="flex-1 text-center">
                  <p className="text-xs font-bold text-warm-700 dark:text-warm-200 truncate">{lastMatch.awayTeamName}</p>
                  <p className="text-2xl font-black text-warm-800 dark:text-warm-100">{lastMatch.awayScore}</p>
                </div>
              </div>
              <div className="flex items-center justify-center gap-2 mt-2 text-[10px] text-warm-500">
                <CalendarDays className="w-3 h-3" />
                {fmtDate(lastMatch.date)}
                {lastMatch.venue && <span>· {lastMatch.venue}</span>}
              </div>
            </motion.div>

            {/* Player stats */}
            <p className="text-[11px] text-warm-500 dark:text-warm-400 uppercase tracking-wider font-semibold mb-2 px-1">Player Stats</p>
            {players.length === 0 ? (
              <p className="text-xs text-warm-500 text-center py-8">No players in roster.</p>
            ) : (
              <div className="space-y-2">
                {players.map((p, idx) => (
                  <motion.div
                    key={p.userId}
                    initial={{ opacity: 0, y: 5 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: idx * 0.04 }}
                    className={`rounded-2xl border p-3 ${
                      p.hasPlayedInLastMatch
                        ? 'bg-white dark:bg-warm-800 border-warm-200 dark:border-warm-700'
                        : 'bg-warm-50 dark:bg-warm-800/50 border-warm-100 dark:border-warm-700/50'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full overflow-hidden bg-gradient-to-br from-violet-400 to-fuchsia-500 flex items-center justify-center text-white font-bold text-xs shrink-0">
                        {p.avatar ? <img src={p.avatar} alt="" className="w-full h-full object-cover" /> : initials(p.name, p.playerCode)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold text-warm-800 dark:text-warm-100 truncate">{p.name || 'Unnamed'}</p>
                        {p.playerCode && <p className="text-[10px] font-mono text-warm-500">{p.playerCode}</p>}
                      </div>
                      {p.hasPlayedInLastMatch ? (
                        <div className="text-right">
                          <div className="text-lg font-black text-violet-600 dark:text-violet-400 leading-none">{p.stats.totalPoints}</div>
                          <div className="text-[9px] text-warm-500 uppercase tracking-wider">pts</div>
                        </div>
                      ) : (
                        <span className="text-[10px] text-warm-400 italic">didn't play</span>
                      )}
                    </div>
                    {p.hasPlayedInLastMatch && (
                      <div className="grid grid-cols-3 gap-1.5 mt-3">
                        <div className="rounded-lg bg-blue-50 dark:bg-blue-900/20 p-2 text-center">
                          <div className="text-sm font-black text-blue-700 dark:text-blue-400">{p.stats.raidPoints}</div>
                          <div className="text-[9px] text-warm-500 uppercase tracking-wider flex items-center justify-center gap-0.5"><Zap className="w-2.5 h-2.5" /> Raid</div>
                        </div>
                        <div className="rounded-lg bg-red-50 dark:bg-red-900/20 p-2 text-center">
                          <div className="text-sm font-black text-red-700 dark:text-red-400">{p.stats.tacklePoints}</div>
                          <div className="text-[9px] text-warm-500 uppercase tracking-wider flex items-center justify-center gap-0.5"><Shield className="w-2.5 h-2.5" /> Tackle</div>
                        </div>
                        <div className="rounded-lg bg-emerald-50 dark:bg-emerald-900/20 p-2 text-center">
                          <div className="text-sm font-black text-emerald-700 dark:text-emerald-400">{p.stats.bonusPoints}</div>
                          <div className="text-[9px] text-warm-500 uppercase tracking-wider flex items-center justify-center gap-0.5"><Sparkles className="w-2.5 h-2.5" /> Bonus</div>
                        </div>
                      </div>
                    )}
                  </motion.div>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </motion.div>
  );
}

// ─── 8. Players View (list + Call/WhatsApp/Chat) ──────────────────────

function PlayersView({ academyId, onBack, onRefreshDashboard, startChatWith, toast }: {
  academyId: string;
  onBack: () => void;
  onRefreshDashboard: () => void;
  startChatWith: (target: { id: string; name: string | null; playerCode: string | null; avatar: string | null }) => void;
  toast: (t: { title: string; description?: string; variant?: 'default' | 'destructive' }) => void;
}) {
  const currentUser = useKabaddiStore((s) => s.currentUser);
  const [players, setPlayers] = useState<AcademyPlayerData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionPlayer, setActionPlayer] = useState<AcademyPlayerData | null>(null);

  // Add-player sheet state
  const [showAdd, setShowAdd] = useState(false);
  const [searchPhone, setSearchPhone] = useState('');
  const [searchName, setSearchName] = useState('');
  const [searching, setSearching] = useState(false);
  const [adding, setAdding] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/academies/${academyId}?_t=${Date.now()}`, { cache: 'no-store' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to load');
      setPlayers(data.academy?.players || []);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Network error');
      setPlayers([]);
    } finally {
      setLoading(false);
    }
  }, [academyId]);

  useEffect(() => { load(); }, [load]);

  // Search players by phone to find an existing user
  const searchByPhone = async () => {
    if (!searchPhone.trim()) return;
    setSearching(true);
    try {
      const res = await fetch(`/api/players?search=${encodeURIComponent(searchPhone.trim())}&_t=${Date.now()}`, { cache: 'no-store' });
      const data = await res.json();
      if (res.ok && data.players && data.players.length > 0) {
        const found = data.players[0];
        setSearchName(found.name || '');
        toast({ title: 'Player found', description: `${found.name || found.playerCode || 'Existing user'} will be added` });
      } else {
        toast({ title: 'No existing user', description: 'A placeholder account will be created for this phone' });
      }
    } catch {
      toast({ title: 'Search failed', variant: 'destructive' });
    } finally {
      setSearching(false);
    }
  };

  // Add player: find-or-create provisional user, then add to academy
  const addPlayer = async () => {
    if (!searchPhone.trim()) {
      toast({ title: 'Phone required', variant: 'destructive' });
      return;
    }
    setAdding(true);
    try {
      // 1. find-or-create provisional user
      const provRes = await fetch('/api/players/provisional', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phone: searchPhone.trim(),
          name: searchName.trim() || undefined,
          createdByUserId: currentUser?.id,
        }),
      });
      const provData = await provRes.json();
      if (!provRes.ok) {
        toast({ title: 'Add failed', description: provData.error, variant: 'destructive' });
        return;
      }
      const userId = provData.user.id;
      // 2. add to academy
      const addRes = await fetch(`/api/academies/${academyId}/players`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId }),
      });
      const addData = await addRes.json();
      if (!addRes.ok) {
        // 409 = already a member — treat as success-ish
        if (addRes.status === 409) {
          toast({ title: 'Already a member', description: 'This player is already in your academy' });
        } else {
          toast({ title: 'Add failed', description: addData.error, variant: 'destructive' });
          return;
        }
      } else {
        toast({ title: 'Player added', description: provData.user.name || provData.user.playerCode || searchPhone });
      }
      setSearchPhone(''); setSearchName('');
      setShowAdd(false);
      await load();
      onRefreshDashboard();
    } catch {
      toast({ title: 'Network error', variant: 'destructive' });
    } finally {
      setAdding(false);
    }
  };

  const removePlayer = async (userId: string) => {
    if (!confirm('Remove this player from the academy?')) return;
    try {
      const res = await fetch(`/api/academies/${academyId}/players?userId=${userId}`, { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok) {
        toast({ title: 'Remove failed', description: data.error, variant: 'destructive' });
        return;
      }
      toast({ title: 'Player removed' });
      await load();
      onRefreshDashboard();
    } catch {
      toast({ title: 'Network error', variant: 'destructive' });
    }
  };

  const openChat = (p: AcademyPlayerData) => {
    startChatWith({
      id: p.user.id,
      name: p.user.name,
      playerCode: p.user.playerCode || null,
      avatar: p.user.avatar,
    });
    setActionPlayer(null);
    toast({ title: 'Opening chat…', description: p.user.name || 'Player' });
  };

  return (
    <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="flex-1 flex flex-col">
      <ScreenHeader title="Players" subtitle={`${players.length} in roster`} onBack={onBack} accent="blue" />
      <div className="flex-1 overflow-y-auto px-4 py-4 max-w-lg mx-auto w-full">
        <Button
          onClick={() => setShowAdd(true)}
          className="w-full mb-3 h-11 rounded-xl bg-gradient-to-r from-blue-500 to-cyan-600 hover:from-blue-600 hover:to-cyan-700 text-white font-bold gap-2"
        >
          <UserPlus className="w-4 h-4" /> Add Player
        </Button>

        {loading ? (
          <div className="flex flex-col items-center justify-center py-12">
            <Loader2 className="w-8 h-8 text-blue-500 animate-spin mb-3" />
            <p className="text-sm text-warm-500">Loading roster...</p>
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center py-12">
            <AlertTriangle className="w-8 h-8 text-red-400 mb-2" />
            <p className="text-sm font-bold text-red-600">{error}</p>
            <Button onClick={load} variant="outline" className="mt-3" size="sm">Retry</Button>
          </div>
        ) : players.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <Users className="w-10 h-10 text-warm-300 mb-3" />
            <p className="text-sm font-bold text-warm-700 dark:text-warm-200 mb-1">No players yet</p>
            <p className="text-xs text-warm-500">Tap "Add Player" to add your first academy player by phone number.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {players.map((p, idx) => (
              <motion.button
                key={p.userId}
                initial={{ opacity: 0, y: 5 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.03 }}
                onClick={() => setActionPlayer(p)}
                className="w-full flex items-center gap-3 p-3 rounded-xl bg-white dark:bg-warm-800 border border-warm-200 dark:border-warm-700 hover:border-blue-300 dark:hover:border-blue-700 hover:shadow-sm transition-all text-left active:scale-[0.98]"
              >
                <div className="w-11 h-11 rounded-full overflow-hidden bg-gradient-to-br from-blue-400 to-cyan-500 flex items-center justify-center text-white font-bold text-sm shrink-0">
                  {p.user.avatar ? <img src={p.user.avatar} alt="" className="w-full h-full object-cover" /> : initials(p.user.name, p.user.playerCode)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <p className="text-sm font-bold text-warm-800 dark:text-warm-100 truncate">{p.user.name || 'Unnamed Player'}</p>
                    {p.user.provisional && (
                      <span className="shrink-0 text-[9px] font-bold text-sky-700 dark:text-sky-400 bg-sky-100 dark:bg-sky-900/30 px-1.5 py-0.5 rounded-full">PROV</span>
                    )}
                  </div>
                  <p className="text-[10px] text-warm-500 dark:text-warm-400 truncate">
                    {p.user.phone || 'no phone'}{p.user.playerCode ? ` · ${p.user.playerCode}` : ''}
                  </p>
                </div>
                <ChevronRight className="w-4 h-4 text-warm-400 shrink-0" />
              </motion.button>
            ))}
          </div>
        )}
      </div>

      {/* Action sheet — Call / WhatsApp / Chat / Remove */}
      <AnimatePresence>
        {actionPlayer && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setActionPlayer(null)}
            className="fixed inset-0 z-30 bg-black/50 backdrop-blur-sm flex items-end justify-center"
          >
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-lg bg-white dark:bg-warm-800 rounded-t-3xl p-5 pb-8"
            >
              <div className="w-12 h-1.5 bg-warm-200 dark:bg-warm-700 rounded-full mx-auto mb-4" />
              <div className="flex items-center gap-3 mb-4">
                <div className="w-14 h-14 rounded-full overflow-hidden bg-gradient-to-br from-blue-400 to-cyan-500 flex items-center justify-center text-white font-bold text-base shrink-0">
                  {actionPlayer.user.avatar ? <img src={actionPlayer.user.avatar} alt="" className="w-full h-full object-cover" /> : initials(actionPlayer.user.name, actionPlayer.user.playerCode)}
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-black text-base text-warm-800 dark:text-warm-100 truncate">{actionPlayer.user.name || 'Unnamed Player'}</h3>
                  <p className="text-xs text-warm-500 truncate">{actionPlayer.user.phone || 'no phone'}</p>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2 mb-3">
                {actionPlayer.user.phone ? (
                  <>
                    <a
                      href={`tel:${actionPlayer.user.phone}`}
                      className="flex flex-col items-center gap-1 py-3 rounded-xl bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-100 dark:hover:bg-emerald-900/40 transition-colors"
                    >
                      <Phone className="w-5 h-5" />
                      <span className="text-[10px] font-bold">Call</span>
                    </a>
                    <a
                      href={`https://wa.me/${actionPlayer.user.phone.replace(/\D/g, '')}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex flex-col items-center gap-1 py-3 rounded-xl bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400 hover:bg-green-100 dark:hover:bg-green-900/40 transition-colors"
                    >
                      <MessageCircle className="w-5 h-5" />
                      <span className="text-[10px] font-bold">WhatsApp</span>
                    </a>
                  </>
                ) : (
                  <div className="col-span-2 py-3 rounded-xl bg-warm-100 dark:bg-warm-700 text-warm-500 text-center text-[11px] font-medium">
                    No phone number on file
                  </div>
                )}
                {actionPlayer.user.id !== currentUser?.id && (
                  <button
                    onClick={() => openChat(actionPlayer)}
                    className="flex flex-col items-center gap-1 py-3 rounded-xl bg-violet-50 dark:bg-violet-900/20 text-violet-700 dark:text-violet-400 hover:bg-violet-100 dark:hover:bg-violet-900/40 transition-colors"
                  >
                    <MessageSquare className="w-5 h-5" />
                    <span className="text-[10px] font-bold">Chat in App</span>
                  </button>
                )}
              </div>

              <Button
                onClick={() => { setActionPlayer(null); removePlayer(actionPlayer.userId); }}
                variant="outline"
                className="w-full h-10 rounded-xl border-red-200 dark:border-red-800/40 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20"
              >
                <Trash2 className="w-4 h-4 mr-2" /> Remove from Academy
              </Button>
              <Button onClick={() => setActionPlayer(null)} variant="ghost" className="w-full mt-2 h-9 text-warm-500">
                Close
              </Button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Add player sheet */}
      <AnimatePresence>
        {showAdd && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setShowAdd(false)}
            className="fixed inset-0 z-30 bg-black/50 backdrop-blur-sm flex items-end justify-center"
          >
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-lg bg-white dark:bg-warm-800 rounded-t-3xl p-5 pb-8"
            >
              <div className="w-12 h-1.5 bg-warm-200 dark:bg-warm-700 rounded-full mx-auto mb-4" />
              <h3 className="font-black text-base text-warm-800 dark:text-warm-100 mb-1">Add Player</h3>
              <p className="text-xs text-warm-500 mb-4">Enter the player's phone number. If they already have an account they'll be linked; otherwise a placeholder account is created that auto-upgrades when they sign up.</p>

              <label className="text-xs font-bold text-warm-700 dark:text-warm-200 mb-1.5 block">Phone Number <span className="text-red-500">*</span></label>
              <div className="flex gap-2 mb-3">
                <Input
                  type="tel"
                  value={searchPhone}
                  onChange={(e) => setSearchPhone(e.target.value)}
                  placeholder="e.g., 9876543210"
                  className="flex-1 h-11 rounded-xl"
                  autoFocus
                />
                <Button onClick={searchByPhone} disabled={searching || !searchPhone.trim()} variant="outline" className="h-11 px-4 rounded-xl">
                  {searching ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                </Button>
              </div>

              <label className="text-xs font-bold text-warm-700 dark:text-warm-200 mb-1.5 block">Player Name <span className="text-warm-400 font-normal">(optional)</span></label>
              <Input
                value={searchName}
                onChange={(e) => setSearchName(e.target.value)}
                placeholder="e.g., Rahul Kumar"
                className="h-11 rounded-xl mb-4"
              />

              <Button
                onClick={addPlayer}
                disabled={adding || !searchPhone.trim()}
                className="w-full h-11 rounded-xl bg-gradient-to-r from-blue-500 to-cyan-600 hover:from-blue-600 hover:to-cyan-700 text-white font-bold"
              >
                {adding ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Adding...</> : <><UserPlus className="w-4 h-4 mr-2" /> Add to Academy</>}
              </Button>
              <Button onClick={() => setShowAdd(false)} variant="ghost" className="w-full mt-2 h-9 text-warm-500">
                Cancel
              </Button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
