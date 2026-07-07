'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowLeft,
  Plus,
  MapPin,
  Users,
  Calendar,
  Clock,
  Check,
  X,
  ChevronRight,
  Building2,
  ClipboardCheck,
  IndianRupee,
  Trophy,
  BarChart3,
  Bell,
  Send,
  Star,
  Crown,
  Trash2,
  UserPlus,
  Settings,
  Sun,
  ToggleLeft,
  ToggleRight,
  AlertCircle,
  CheckCircle2,
  Loader2,
  Phone,
  MessageCircle,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { useKabaddiStore, type CoachAcademy } from '@/lib/store';
import { t } from '@/lib/i18n';
import { toast } from '@/hooks/use-toast';
import PremiumLock from './PremiumLock';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  Legend,
} from 'recharts';

// ─── Types ────────────────────────────────────────────────────────

interface CoachDashboardProps {
  onClose: () => void;
}

interface AcademyData {
  id: string;
  name: string;
  location: string | null;
  groundName: string | null;
  coachUserId: string;
  sundayHoliday: boolean;
  practiceSchedule: string;
  offDays?: string; // JSON string of weekday names: '["sun","mon"]', or '[]' for all-days-working
  players: AcademyPlayerData[];
  _count: { players: number };
  createdAt: string;
}

interface AcademyPlayerData {
  id: string;
  userId: string;
  user: {
    id: string;
    name: string | null;
    phone: string | null;
    avatar: string | null;
  };
  joinedAt: string;
}

interface AttendanceRecord {
  userId: string;
  name: string | null;
  phone: string | null;
  avatar: string | null;
  isPresent: boolean;
  session?: string; // 'default' | 'morning' | 'evening'
  note?: string | null;
}

interface FeeRecordData {
  id: string; // backend 'id' field
  academyId: string;
  userId: string;
  month: string;
  amount: number;
  status: string;
  paidAt: string | null;
  expiryDate: string | null;
  period: string;
  notes: string | null;
  user: { id: string; name: string | null; avatar: string | null; phone: string | null };
  // Convenience flat fields (populated by fetchFees for backwards-compat)
  name?: string | null;
  phone?: string | null;
  avatar?: string | null;
  feeId?: string | null;
}

// Player fee status as returned by GET /api/coach/fees/status — includes
// days-left + isExpired so the UI can render the red dot.
interface PlayerFeeStatus {
  userId: string;
  name: string | null;
  avatar: string | null;
  phone: string | null;
  feeRecord: {
    id: string;
    amount: number;
    status: string;
    paidAt: string | null;
    expiryDate: string | null;
    period: string;
    month: string;
  } | null;
  daysLeft: number | null; // null = never paid; positive = days left; negative = days expired
  isExpired: boolean;
}

interface FeeSummary {
  totalExpected: number;
  collected: number;
  pending: number;
  overdue: number;
  totalStudents: number;
  paidCount: number;
  pendingCount: number;
  overdueCount: number;
}
interface RewardData {
  id: string;
  userId: string;
  type: string;
  title: string;
  description: string | null;
  points: number;
  month: string | null;
  icon: string | null;
  createdAt: string;
  user: {
    id: string;
    name: string | null;
    avatar: string | null;
  };
}

interface LeaderboardEntry {
  userId: string;
  name: string | null;
  avatar: string | null;
  totalPoints: number;
  rewardCount: number;
}

interface AnalyticsData {
  attendancePerformance: { name: string; attendancePercent: number; performanceScore: number }[];
  attendanceTrend: { month: string; attendanceRate: number; present: number; total: number }[];
  feeSummary: { paid: number; pending: number; overdue: number; paidCount: number; pendingCount: number; overdueCount: number };
  totalPlayers: number;
}

interface ParentData {
  id: string;
  userId: string;
  parentName: string;
  parentPhone: string;
  relation: string;
  user: {
    id: string;
    name: string | null;
    phone: string | null;
  };
}

type TabId = 'academy' | 'attendance' | 'fees' | 'rewards' | 'analytics';
type AcademySubView = 'list' | 'detail' | 'create';

// ─── Tab Config ────────────────────────────────────────────────────

const TABS: { id: TabId; label: string; icon: React.ReactNode }[] = [
  { id: 'academy', label: 'Academy', icon: <Building2 className="w-4 h-4" /> },
  { id: 'attendance', label: 'Attendance', icon: <ClipboardCheck className="w-4 h-4" /> },
  { id: 'fees', label: 'Fees', icon: <IndianRupee className="w-4 h-4" /> },
  { id: 'rewards', label: 'Rewards', icon: <Trophy className="w-4 h-4" /> },
  { id: 'analytics', label: 'Analytics', icon: <BarChart3 className="w-4 h-4" /> },
];

const PIE_COLORS = ['#22c55e', '#f59e0b', '#ef4444'];

// ─── Component ────────────────────────────────────────────────────

export default function CoachDashboard({ onClose }: CoachDashboardProps) {
  const { language, currentUser } = useKabaddiStore();
  const lang = language;
  const coachUserId = currentUser?.id || '';
  const isPremium = currentUser?.isPremium || currentUser?.isAdmin || false;

  // ─── State ─────────────────────────────────────────────
  const [activeTab, setActiveTab] = useState<TabId>('academy');
  const [selectedAcademyId, setSelectedAcademyId] = useState<string | null>(null);
  const [academySubView, setAcademySubView] = useState<AcademySubView>('list');
  const [loading, setLoading] = useState(false);

  // Academy state
  const [academies, setAcademies] = useState<AcademyData[]>([]);
  const [academyDetail, setAcademyDetail] = useState<AcademyData | null>(null);

  // Create academy form
  const [newName, setNewName] = useState('');
  const [newLocation, setNewLocation] = useState('');
  const [newGroundName, setNewGroundName] = useState('');
  const [newSundayHoliday, setNewSundayHoliday] = useState(false);
  const [newPracticeSchedule, setNewPracticeSchedule] = useState<'one-time' | 'both-time'>('one-time');
  // Multi-day holiday picker. Array of weekday short names: ['sun','mon',...].
  // Empty array = all days working (no holidays).
  const [newOffDays, setNewOffDays] = useState<string[]>([]);
  // Edit-academy mode (so coach can change offDays after creation)
  const [showEditAcademy, setShowEditAcademy] = useState(false);
  const [editOffDays, setEditOffDays] = useState<string[]>([]);

  // Attendance state
  const [attendanceRecords, setAttendanceRecords] = useState<AttendanceRecord[]>([]);
  const [attendanceDate, setAttendanceDate] = useState(new Date().toISOString().split('T')[0]);
  // Which session we're currently marking. 'default' for one-time academies,
  // 'morning' or 'evening' for both-time academies.
  const [activeSession, setActiveSession] = useState<'default' | 'morning' | 'evening'>('default');

  // Fees state
  const [feeRecords, setFeeRecords] = useState<FeeRecordData[]>([]);
  const [feeSummary, setFeeSummary] = useState<FeeSummary | null>(null);
  const [feeMonth, setFeeMonth] = useState(new Date().toISOString().slice(0, 7));
  // Player fee status list — every player with days-left + isExpired flag.
  // Fetched from GET /api/coach/fees/status (separate from the monthly records).
  const [playerFeeStatuses, setPlayerFeeStatuses] = useState<PlayerFeeStatus[]>([]);

  // Player profile quick-view (call/WhatsApp from coach view)
  const [playerProfileView, setPlayerProfileView] = useState<AcademyPlayerData | null>(null);

  // Rewards state
  const [rewards, setRewards] = useState<RewardData[]>([]);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [playerOfMonth, setPlayerOfMonth] = useState<RewardData | null>(null);

  // Analytics state
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);

  // Parents state
  const [parents, setParents] = useState<ParentData[]>([]);

  // Add player form
  const [addPlayerPhone, setAddPlayerPhone] = useState('');
  const [addPlayerName, setAddPlayerName] = useState('');

  // Add fee form
  const [showAddFeeForm, setShowAddFeeForm] = useState(false);
  const [feeFormUserId, setFeeFormUserId] = useState('');
  const [feeFormAmount, setFeeFormAmount] = useState('');

  // Reward form
  const [showRewardForm, setShowRewardForm] = useState(false);
  const [rewardForm, setRewardForm] = useState({
    type: 'player_of_month' as string,
    title: '',
    description: '',
    points: 0,
    userId: '',
  });

  // ─── Academy API Calls ─────────────────────────────────

  const fetchAcademies = useCallback(async () => {
    if (!coachUserId) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/academies?coachUserId=${coachUserId}`);
      const data = await res.json();
      if (data.academies) {
        setAcademies(data.academies);
        if (data.academies.length > 0 && !selectedAcademyId) {
          setSelectedAcademyId(data.academies[0].id);
        }
      }
    } catch (err) {
      console.error('Fetch academies error:', err);
    } finally {
      setLoading(false);
    }
  }, [coachUserId, selectedAcademyId]);

  const fetchAcademyDetail = useCallback(async (academyId: string) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/academies/${academyId}`);
      const data = await res.json();
      if (data.academy) {
        setAcademyDetail(data.academy);
      }
    } catch (err) {
      console.error('Fetch academy detail error:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  const createAcademy = async () => {
    if (!newName.trim() || !coachUserId) return;
    setLoading(true);
    try {
      const res = await fetch('/api/academies', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newName,
          location: newLocation || null,
          groundName: newGroundName || null,
          coachUserId,
          sundayHoliday: newOffDays.includes('sun'), // backwards-compat: sundayHoliday reflects the new offDays array
          practiceSchedule: newPracticeSchedule,
          offDays: newOffDays,
        }),
      });
      const data = await res.json();
      if (data.academy) {
        toast({ title: 'Academy created successfully!' });
        setNewName('');
        setNewLocation('');
        setNewGroundName('');
        setNewSundayHoliday(false);
        setNewOffDays([]);
        setNewPracticeSchedule('one-time');
        setAcademySubView('list');
        fetchAcademies();
      } else {
        toast({ title: 'Failed to create academy', variant: 'destructive' });
      }
    } catch {
      toast({ title: 'Failed to create academy', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  // Update an existing academy's offDays (and optionally other fields).
  // Called from the Edit Academy sheet in the academy detail view.
  const updateAcademyOffDays = async (academyId: string, offDays: string[]) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/academies/${academyId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          offDays,
          sundayHoliday: offDays.includes('sun'), // keep backwards-compat boolean in sync
        }),
      });
      const data = await res.json();
      if (data.academy) {
        toast({ title: 'Holidays updated!' });
        setAcademyDetail(data.academy);
        setShowEditAcademy(false);
        fetchAcademies();
      } else {
        toast({ title: 'Failed to update academy', variant: 'destructive' });
      }
    } catch {
      toast({ title: 'Failed to update academy', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const deleteAcademy = async (id: string) => {
    if (!confirm('Are you sure you want to delete this academy?')) return;
    try {
      const res = await fetch(`/api/academies/${id}`, { method: 'DELETE' });
      if (res.ok) {
        toast({ title: 'Academy deleted' });
        if (selectedAcademyId === id) {
          setSelectedAcademyId(null);
          setAcademyDetail(null);
        }
        fetchAcademies();
      }
    } catch {
      toast({ title: 'Failed to delete academy', variant: 'destructive' });
    }
  };

  const addPlayerToAcademy = async () => {
    if (!selectedAcademyId || !addPlayerPhone.trim()) return;
    try {
      // First find user by phone
      const searchRes = await fetch(`/api/players?search=${addPlayerPhone}`);
      const searchData = await searchRes.json();
      const player = searchData.players?.[0];
      if (!player) {
        toast({ title: 'Player not found. Ask them to register first.', variant: 'destructive' });
        return;
      }
      const res = await fetch(`/api/academies/${selectedAcademyId}/players`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: player.id }),
      });
      if (res.ok) {
        toast({ title: 'Player added!' });
        setAddPlayerPhone('');
        setAddPlayerName('');
        fetchAcademyDetail(selectedAcademyId);
      } else {
        const data = await res.json();
        toast({ title: data.error || 'Failed to add player', variant: 'destructive' });
      }
    } catch {
      toast({ title: 'Failed to add player', variant: 'destructive' });
    }
  };

  const removePlayerFromAcademy = async (userId: string) => {
    if (!selectedAcademyId) return;
    try {
      const res = await fetch(`/api/academies/${selectedAcademyId}/players?userId=${userId}`, {
        method: 'DELETE',
      });
      if (res.ok) {
        toast({ title: 'Player removed' });
        fetchAcademyDetail(selectedAcademyId);
      }
    } catch {
      toast({ title: 'Failed to remove player', variant: 'destructive' });
    }
  };

  // ─── Attendance API Calls ──────────────────────────────

  const fetchAttendance = useCallback(async (academyId: string, date?: string) => {
    setLoading(true);
    try {
      const d = date || attendanceDate;
      // Backend route is /api/coach/attendance (not /api/academies/:id/attendance).
      // Both return { attendance: [...] }.
      const res = await fetch(`/api/coach/attendance?academyId=${academyId}&date=${d}`);
      const data = await res.json();
      if (data.attendance) {
        setAttendanceRecords(data.attendance);
      }
    } catch (err) {
      console.error('Fetch attendance error:', err);
    } finally {
      setLoading(false);
    }
  }, [attendanceDate]);

  const saveAttendance = async () => {
    if (!selectedAcademyId) return;
    setLoading(true);
    try {
      // Backend POST /api/coach/attendance takes a SINGLE record at a time
      // (academyId, userId, date, isPresent, note). The old code sent
      // { records: [...] } which the backend ignored. Save each record in parallel.
      const promises = attendanceRecords.map((r) =>
        fetch('/api/coach/attendance', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            academyId: selectedAcademyId,
            userId: r.userId,
            date: attendanceDate,
            isPresent: r.isPresent,
          }),
        })
      );
      await Promise.all(promises);
      toast({ title: 'Attendance saved!' });
    } catch {
      toast({ title: 'Failed to save attendance', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  // ─── Fees API Calls ────────────────────────────────────

  const fetchFees = useCallback(async (academyId: string, month?: string) => {
    setLoading(true);
    try {
      const m = month || feeMonth;
      const res = await fetch(`/api/coach/fees?academyId=${academyId}&month=${m}`);
      const data = await res.json();
      // Backend returns { feeRecords: [...] } with nested `user` object.
      // Normalize into the flat FeeRecordData shape the UI expects.
      if (data.feeRecords) {
        const normalized: FeeRecordData[] = data.feeRecords.map((r: any) => ({
          id: r.id,
          academyId: r.academyId,
          userId: r.userId,
          month: r.month,
          amount: r.amount || 0,
          status: r.status || 'pending',
          paidAt: r.paidAt || null,
          expiryDate: r.expiryDate || null,
          period: r.period || 'monthly',
          notes: r.notes || null,
          user: r.user || { id: r.userId, name: null, avatar: null, phone: null },
          // Flat convenience fields (so old render code that reads record.name still works)
          name: r.user?.name || null,
          phone: r.user?.phone || null,
          avatar: r.user?.avatar || null,
          feeId: r.id,
        }));
        setFeeRecords(normalized);
        // Derive summary with the CORRECT field names (matches FeeSummary interface).
        // This was the root cause of the fees-tab white-screen crash.
        const paid = normalized.filter((r) => r.status === 'paid');
        const pending = normalized.filter((r) => r.status === 'pending');
        const overdue = normalized.filter((r) => r.status === 'overdue');
        const totalExpected = normalized.reduce((sum, r) => sum + (r.amount || 0), 0);
        const collected = paid.reduce((sum, r) => sum + (r.amount || 0), 0);
        const pendingAmt = pending.reduce((sum, r) => sum + (r.amount || 0), 0);
        const overdueAmt = overdue.reduce((sum, r) => sum + (r.amount || 0), 0);
        setFeeSummary({
          totalExpected,
          collected,
          pending: pendingAmt,
          overdue: overdueAmt,
          totalStudents: normalized.length,
          paidCount: paid.length,
          pendingCount: pending.length,
          overdueCount: overdue.length,
        });
      } else {
        setFeeRecords([]);
        setFeeSummary(null);
      }
    } catch (err) {
      console.error('Fetch fees error:', err);
    } finally {
      setLoading(false);
    }
  }, [feeMonth]);

  // Fetch the per-player fee status (with days-left + isExpired) for the
  // red-dot fee list. Calls GET /api/coach/fees/status.
  const fetchPlayerFeeStatuses = useCallback(async (academyId: string) => {
    try {
      const res = await fetch(`/api/coach/fees/status?academyId=${academyId}`);
      const data = await res.json();
      if (data.players) {
        setPlayerFeeStatuses(data.players);
      } else {
        setPlayerFeeStatuses([]);
      }
    } catch (err) {
      console.error('Fetch player fee statuses error:', err);
      setPlayerFeeStatuses([]);
    }
  }, []);

  const markFeePaid = async (feeId: string) => {
    if (!feeId) return;
    try {
      // Backend has no PUT route — POST /api/coach/fees upserts by (academyId, userId, month).
      // Find the existing record, then POST with isPaid: true to flip its status.
      const existing = feeRecords.find((r) => r.id === feeId || r.feeId === feeId);
      if (!existing || !selectedAcademyId) return;
      const res = await fetch('/api/coach/fees', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          academyId: selectedAcademyId,
          userId: existing.userId,
          month: existing.month,
          amount: existing.amount,
          isPaid: true,
          period: existing.period || 'monthly',
        }),
      });
      if (res.ok) {
        toast({ title: 'Fee marked as paid!' });
        if (selectedAcademyId) {
          fetchFees(selectedAcademyId);
          fetchPlayerFeeStatuses(selectedAcademyId);
        }
      }
    } catch {
      toast({ title: 'Failed to update fee', variant: 'destructive' });
    }
  };

  const createFeeRecord = async () => {
    if (!selectedAcademyId || !feeFormUserId || !feeFormAmount) return;
    try {
      const res = await fetch('/api/coach/fees', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          academyId: selectedAcademyId,
          userId: feeFormUserId,
          month: feeMonth,
          amount: parseInt(feeFormAmount),
          // Backend derives status from isPaid, not status. 'pending' = isPaid: false.
          isPaid: false,
        }),
      });
      if (res.ok) {
        toast({ title: 'Fee record created!' });
        setShowAddFeeForm(false);
        setFeeFormUserId('');
        setFeeFormAmount('');
        fetchFees(selectedAcademyId);
      }
    } catch {
      toast({ title: 'Failed to create fee record', variant: 'destructive' });
    }
  };

  const sendFeeReminders = () => {
    const pendingCount = feeRecords.filter((r) => r.status === 'pending' || r.status === 'overdue').length;
    toast({ title: `Reminders sent to ${pendingCount} students!` });
  };

  // ─── Rewards API Calls ─────────────────────────────────

  const fetchRewards = useCallback(async (academyId: string) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/coach/rewards?academyId=${academyId}`);
      const data = await res.json();
      // Backend returns only { rewards: [...] } — no leaderboard or playerOfMonth.
      // Old code waited for data.leaderboard which never came, so rewards never rendered.
      if (data.rewards) {
        setRewards(data.rewards);
        setLeaderboard([]);
        setPlayerOfMonth(null);
      }
    } catch (err) {
      console.error('Fetch rewards error:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  const giveReward = async () => {
    if (!selectedAcademyId || !rewardForm.userId || !rewardForm.title) return;
    try {
      const res = await fetch('/api/coach/rewards', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          academyId: selectedAcademyId,
          userId: rewardForm.userId,
          type: rewardForm.type,
          title: rewardForm.title,
          description: rewardForm.description || null,
          points: rewardForm.points,
          month: rewardForm.type === 'player_of_month' ? new Date().toISOString().slice(0, 7) : null,
          icon: rewardForm.type === 'player_of_month' ? '👑' : rewardForm.type === 'best_raider' ? '⚔️' : '🛡️',
        }),
      });
      if (res.ok) {
        toast({ title: 'Reward given!' });
        setShowRewardForm(false);
        setRewardForm({ type: 'player_of_month', title: '', description: '', points: 0, userId: '' });
        fetchRewards(selectedAcademyId);
      }
    } catch {
      toast({ title: 'Failed to give reward', variant: 'destructive' });
    }
  };

  // ─── Analytics API Calls ───────────────────────────────

  const fetchAnalytics = useCallback(async (academyId: string) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/coach/analytics?academyId=${academyId}`);
      const data = await res.json();
      // Backend returns { academy, performanceData, playerCount }.
      // Old code checked for data.attendancePerformance which never existed.
      if (data.academy || data.performanceData) {
        setAnalytics(data);
      }
    } catch (err) {
      console.error('Fetch analytics error:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  // ─── Parents API Calls ─────────────────────────────────

  const fetchParents = useCallback(async (academyId: string) => {
    try {
      const res = await fetch(`/api/coach/parents?academyId=${academyId}`);
      const data = await res.json();
      if (data.parents) {
        setParents(data.parents);
      }
    } catch (err) {
      console.error('Fetch parents error:', err);
    }
  }, []);

  // ─── Effects ───────────────────────────────────────────

  useEffect(() => {
    fetchAcademies();
  }, [fetchAcademies]);

  useEffect(() => {
    if (!selectedAcademyId) return;
    if (activeTab === 'attendance') fetchAttendance(selectedAcademyId);
    else if (activeTab === 'fees') {
      fetchFees(selectedAcademyId);
      fetchPlayerFeeStatuses(selectedAcademyId);
    }
    else if (activeTab === 'rewards') fetchRewards(selectedAcademyId);
    else if (activeTab === 'analytics') fetchAnalytics(selectedAcademyId);
  }, [activeTab, selectedAcademyId, fetchAttendance, fetchFees, fetchPlayerFeeStatuses, fetchRewards, fetchAnalytics]);

  // ─── Academy Selector ──────────────────────────────────

  const renderAcademySelector = (show: boolean) => {
    if (!show || academies.length === 0) return null;
    return (
      <div className="px-4 mb-4">
        <label className="text-xs font-semibold text-warm-500 dark:text-warm-400 uppercase tracking-wider mb-1.5 block">
          Select Academy
        </label>
        <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
          {academies.map((a) => (
            <button
              key={a.id}
              onClick={() => setSelectedAcademyId(a.id)}
              className={`flex-shrink-0 px-4 py-2 rounded-xl text-sm font-medium transition-all ${
                selectedAcademyId === a.id
                  ? 'bg-brand-green text-white shadow-md'
                  : 'bg-white/10 dark:bg-white/5 text-warm-700 dark:text-warm-300 hover:bg-white/20'
              }`}
            >
              {a.name}
            </button>
          ))}
        </div>
      </div>
    );
  };

  // ─── Tab: Academy ──────────────────────────────────────

  const renderAcademyTab = () => {
    if (academySubView === 'create') {
      return (
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -20 }}
          className="p-4 space-y-4"
        >
          <div className="flex items-center gap-2 mb-2">
            <button
              onClick={() => setAcademySubView('list')}
              className="p-1.5 rounded-lg hover:bg-white/10"
            >
              <ArrowLeft className="w-5 h-5 text-warm-700 dark:text-warm-300" />
            </button>
            <h2 className="text-lg font-bold text-warm-800 dark:text-warm-200">Create Academy</h2>
          </div>

          <div className="space-y-3">
            <div>
              <label className="text-xs font-semibold text-warm-500 dark:text-warm-400 uppercase tracking-wider mb-1.5 block">
                Academy Name *
              </label>
              <Input
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="e.g., Rohtak Kabaddi Academy"
                className="bg-white/50 dark:bg-white/5 border-warm-200 dark:border-warm-700"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-warm-500 dark:text-warm-400 uppercase tracking-wider mb-1.5 block">
                Location
              </label>
              <Input
                value={newLocation}
                onChange={(e) => setNewLocation(e.target.value)}
                placeholder="e.g., Sector 3, Rohtak"
                className="bg-white/50 dark:bg-white/5 border-warm-200 dark:border-warm-700"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-warm-500 dark:text-warm-400 uppercase tracking-wider mb-1.5 block">
                Ground Name
              </label>
              <Input
                value={newGroundName}
                onChange={(e) => setNewGroundName(e.target.value)}
                placeholder="e.g., Municipal Ground"
                className="bg-white/50 dark:bg-white/5 border-warm-200 dark:border-warm-700"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-warm-500 dark:text-warm-400 uppercase tracking-wider mb-1.5 block">
                Practice Schedule
              </label>
              <div className="flex gap-2">
                <button
                  onClick={() => setNewPracticeSchedule('one-time')}
                  className={`flex-1 py-2.5 rounded-xl text-sm font-medium transition-all ${
                    newPracticeSchedule === 'one-time'
                      ? 'bg-brand-green text-white shadow-md'
                      : 'bg-white/10 dark:bg-white/5 text-warm-700 dark:text-warm-300'
                  }`}
                >
                  <Clock className="w-4 h-4 inline mr-1" />
                  One Time
                </button>
                <button
                  onClick={() => setNewPracticeSchedule('both-time')}
                  className={`flex-1 py-2.5 rounded-xl text-sm font-medium transition-all ${
                    newPracticeSchedule === 'both-time'
                      ? 'bg-brand-green text-white shadow-md'
                      : 'bg-white/10 dark:bg-white/5 text-warm-700 dark:text-warm-300'
                  }`}
                >
                  <Clock className="w-4 h-4 inline mr-1" />
                  Both Time
                </button>
              </div>
            </div>
            {/* Multi-day holiday picker — coach chooses ANY day(s) as holiday,
                or picks "All days working" (empty selection = no holidays). */}
            <div className="p-3 rounded-xl bg-white/10 dark:bg-white/5">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <Sun className="w-4 h-4 text-brand-gold" />
                  <span className="text-sm font-medium text-warm-700 dark:text-warm-300">Holiday Days</span>
                </div>
                <button
                  type="button"
                  onClick={() => setNewOffDays([])}
                  className={`text-[10px] font-bold px-2 py-1 rounded-full transition-colors ${
                    newOffDays.length === 0
                      ? 'bg-emerald-500 text-white'
                      : 'bg-warm-200 dark:bg-warm-700 text-warm-600 dark:text-warm-300'
                  }`}
                >
                  All days working
                </button>
              </div>
              <p className="text-[10px] text-warm-500 dark:text-warm-400 mb-2">
                Tap the day(s) you want as holidays. Leave empty for no holidays.
              </p>
              <div className="grid grid-cols-7 gap-1">
                {(['sun','mon','tue','wed','thu','fri','sat'] as const).map((day) => {
                  const isOff = newOffDays.includes(day);
                  return (
                    <button
                      key={day}
                      type="button"
                      onClick={() => {
                        setNewOffDays(prev => isOff ? prev.filter(d => d !== day) : [...prev, day]);
                      }}
                      className={`p-1.5 rounded-lg text-[10px] font-bold uppercase transition-all ${
                        isOff
                          ? 'bg-red-500 text-white'
                          : 'bg-white/50 dark:bg-white/5 text-warm-600 dark:text-warm-300 hover:bg-white/80'
                      }`}
                    >
                      {day.charAt(0)}
                    </button>
                  );
                })}
              </div>
              {newOffDays.length > 0 && (
                <p className="text-[10px] text-red-500 dark:text-red-400 mt-2 font-medium">
                  {newOffDays.length === 1 ? `${newOffDays[0].toUpperCase()} is holiday` : `${newOffDays.length} holidays: ${newOffDays.map(d => d.charAt(0).toUpperCase() + d.slice(1)).join(', ')}`}
                </p>
              )}
            </div>
          </div>

          <Button
            onClick={createAcademy}
            disabled={!newName.trim() || loading}
            className="w-full bg-brand-green hover:bg-brand-green-dark text-white font-semibold py-3 rounded-xl"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Plus className="w-4 h-4 mr-2" />}
            Create Academy
          </Button>
        </motion.div>
      );
    }

    if (academySubView === 'detail' && academyDetail) {
      return (
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -20 }}
          className="p-4 space-y-4"
        >
          <div className="flex items-center gap-2 mb-2">
            <button
              onClick={() => {
                setAcademySubView('list');
                setAcademyDetail(null);
              }}
              className="p-1.5 rounded-lg hover:bg-white/10"
            >
              <ArrowLeft className="w-5 h-5 text-warm-700 dark:text-warm-300" />
            </button>
            <div>
              <h2 className="text-lg font-bold text-warm-800 dark:text-warm-200">{academyDetail.name}</h2>
              {academyDetail.location && (
                <p className="text-xs text-warm-500 flex items-center gap-1">
                  <MapPin className="w-3 h-3" /> {academyDetail.location}
                </p>
              )}
            </div>
          </div>

          {/* Academy Info Card */}
          <Card className="bg-white/10 dark:bg-white/5 backdrop-blur-xl border-white/10">
            <CardContent className="p-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="flex items-center gap-2">
                  <Users className="w-4 h-4 text-brand-green" />
                  <div>
                    <p className="text-xs text-warm-500">Players</p>
                    <p className="text-sm font-bold text-warm-800 dark:text-warm-200">{academyDetail._count?.players || academyDetail.players?.length || 0}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-brand-gold" />
                  <div>
                    <p className="text-xs text-warm-500">Schedule</p>
                    <p className="text-sm font-bold text-warm-800 dark:text-warm-200 capitalize">{(academyDetail.practiceSchedule || 'one-time').replace('-', ' ')}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2 col-span-2">
                  <Sun className="w-4 h-4 text-brand-gold shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-warm-500">Holidays</p>
                    <p className="text-sm font-bold text-warm-800 dark:text-warm-200 truncate">
                      {(() => {
                        try {
                          const arr = JSON.parse(academyDetail.offDays || '[]');
                          if (!Array.isArray(arr) || arr.length === 0) {
                            // Backwards-compat: if offDays is empty, fall back to sundayHoliday
                            return academyDetail.sundayHoliday ? 'Sunday' : 'All days working (no holidays)';
                          }
                          return arr.map((d: string) => d.charAt(0).toUpperCase() + d.slice(1)).join(', ');
                        } catch {
                          return academyDetail.sundayHoliday ? 'Sunday' : 'All days working (no holidays)';
                        }
                      })()}
                    </p>
                  </div>
                  <button
                    onClick={() => {
                      // Pre-fill editOffDays from the academy's current offDays
                      try {
                        const arr = JSON.parse(academyDetail.offDays || '[]');
                        setEditOffDays(Array.isArray(arr) ? arr : (academyDetail.sundayHoliday ? ['sun'] : []));
                      } catch {
                        setEditOffDays(academyDetail.sundayHoliday ? ['sun'] : []);
                      }
                      setShowEditAcademy(true);
                    }}
                    className="shrink-0 p-1.5 rounded-lg bg-warm-200 dark:bg-warm-700 text-warm-600 dark:text-warm-300 hover:bg-warm-300"
                    title="Edit holidays"
                  >
                    <Settings className="w-3.5 h-3.5" />
                  </button>
                </div>
                <div className="flex items-center gap-2">
                  <MapPin className="w-4 h-4 text-brand-red" />
                  <div>
                    <p className="text-xs text-warm-500">Ground</p>
                    <p className="text-sm font-bold text-warm-800 dark:text-warm-200">{academyDetail.groundName || 'N/A'}</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Edit Holidays Sheet */}
          <AnimatePresence>
            {showEditAcademy && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 z-50 bg-black/50 flex items-end sm:items-center justify-center p-4"
                onClick={() => setShowEditAcademy(false)}
              >
                <motion.div
                  initial={{ y: 50, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  exit={{ y: 50, opacity: 0 }}
                  onClick={(e) => e.stopPropagation()}
                  className="bg-white dark:bg-warm-900 rounded-2xl p-5 w-full max-w-sm space-y-4"
                >
                  <div className="flex items-center justify-between">
                    <h3 className="text-base font-bold text-warm-800 dark:text-warm-100">Edit Holidays</h3>
                    <button onClick={() => setShowEditAcademy(false)} className="p-1 rounded-full hover:bg-warm-100 dark:hover:bg-warm-800">
                      <X className="w-4 h-4 text-warm-500" />
                    </button>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-warm-500">Pick the day(s) your academy is closed:</span>
                    <button
                      type="button"
                      onClick={() => setEditOffDays([])}
                      className={`text-[10px] font-bold px-2 py-1 rounded-full transition-colors ${
                        editOffDays.length === 0
                          ? 'bg-emerald-500 text-white'
                          : 'bg-warm-200 dark:bg-warm-700 text-warm-600 dark:text-warm-300'
                      }`}
                    >
                      All days working
                    </button>
                  </div>
                  <div className="grid grid-cols-7 gap-1.5">
                    {(['sun','mon','tue','wed','thu','fri','sat'] as const).map((day) => {
                      const isOff = editOffDays.includes(day);
                      return (
                        <button
                          key={day}
                          type="button"
                          onClick={() => {
                            setEditOffDays(prev => isOff ? prev.filter(d => d !== day) : [...prev, day]);
                          }}
                          className={`p-2.5 rounded-lg text-[10px] font-bold uppercase transition-all ${
                            isOff
                              ? 'bg-red-500 text-white'
                              : 'bg-warm-100 dark:bg-warm-800 text-warm-600 dark:text-warm-300 hover:bg-warm-200'
                          }`}
                        >
                          {day.charAt(0)}
                        </button>
                      );
                    })}
                  </div>
                  {editOffDays.length > 0 && (
                    <p className="text-[10px] text-red-500 dark:text-red-400 font-medium">
                      {editOffDays.length === 1 ? `${editOffDays[0].toUpperCase()} is holiday` : `${editOffDays.length} holidays: ${editOffDays.map(d => d.charAt(0).toUpperCase() + d.slice(1)).join(', ')}`}
                    </p>
                  )}
                  <Button
                    onClick={() => updateAcademyOffDays(academyDetail.id, editOffDays)}
                    disabled={loading}
                    className="w-full bg-brand-green hover:bg-brand-green-dark text-white"
                  >
                    {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Check className="w-4 h-4 mr-2" />}
                    Save Holidays
                  </Button>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Add Player */}
          <Card className="bg-white/10 dark:bg-white/5 backdrop-blur-xl border-white/10">
            <CardContent className="p-4 space-y-3">
              <h3 className="text-sm font-bold text-warm-700 dark:text-warm-300 flex items-center gap-2">
                <UserPlus className="w-4 h-4 text-brand-green" />
                Add Player
              </h3>
              <div className="flex gap-2">
                <Input
                  value={addPlayerPhone}
                  onChange={(e) => setAddPlayerPhone(e.target.value)}
                  placeholder="Player phone number"
                  className="flex-1 bg-white/50 dark:bg-white/5 border-warm-200 dark:border-warm-700 text-sm"
                />
                <Button
                  onClick={addPlayerToAcademy}
                  disabled={!addPlayerPhone.trim()}
                  className="bg-brand-green hover:bg-brand-green-dark text-white"
                  size="sm"
                >
                  <Plus className="w-4 h-4" />
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Player List */}
          <Card className="bg-white/10 dark:bg-white/5 backdrop-blur-xl border-white/10">
            <CardContent className="p-4">
              <h3 className="text-sm font-bold text-warm-700 dark:text-warm-300 mb-3 flex items-center gap-2">
                <Users className="w-4 h-4 text-brand-green" />
                Players ({academyDetail.players?.length || 0})
              </h3>
              {academyDetail.players && academyDetail.players.length > 0 ? (
                <div className="space-y-2 max-h-64 overflow-y-auto custom-scrollbar">
                  {academyDetail.players.map((p) => (
                    <div
                      key={p.id}
                      className="flex items-center justify-between p-2.5 rounded-lg bg-white/5 hover:bg-white/10 transition-colors"
                    >
                      <div
                        className="flex items-center gap-2.5 flex-1 min-w-0 cursor-pointer"
                        onClick={() => setPlayerProfileView(p)}
                      >
                        <div className="w-8 h-8 rounded-full bg-brand-green/20 flex items-center justify-center text-brand-green font-bold text-xs overflow-hidden shrink-0">
                          {p.user.avatar ? (
                            <img src={p.user.avatar} alt={p.user.name || 'Player'} className="w-full h-full object-cover" />
                          ) : (
                            (p.user.name || '?')[0]?.toUpperCase()
                          )}
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-warm-800 dark:text-warm-200 truncate">{p.user.name || 'Unknown'}</p>
                          <p className="text-[10px] text-warm-500 truncate">{p.user.phone || 'No phone'}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        {p.user.phone && (
                          <>
                            {/* Call button — opens phone dialer */}
                            <a
                              href={`tel:${p.user.phone}`}
                              className="p-1.5 rounded-lg hover:bg-emerald-50 dark:hover:bg-emerald-900/20 text-emerald-500 transition-colors"
                              title={`Call ${p.user.phone}`}
                            >
                              <Phone className="w-3.5 h-3.5" />
                            </a>
                            {/* WhatsApp button — opens wa.me chat */}
                            <a
                              href={`https://wa.me/${p.user.phone.replace(/\D/g, '')}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="p-1.5 rounded-lg hover:bg-green-50 dark:hover:bg-green-900/20 text-green-500 transition-colors"
                              title={`WhatsApp ${p.user.phone}`}
                            >
                              <MessageCircle className="w-3.5 h-3.5" />
                            </a>
                          </>
                        )}
                        <button
                          onClick={() => removePlayerFromAcademy(p.userId)}
                          className="p-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 text-warm-400 hover:text-red-500 transition-colors"
                          title="Remove from academy"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-warm-500 text-center py-4">No players yet</p>
              )}
            </CardContent>
          </Card>

          {/* Delete Academy */}
          <Button
            onClick={() => deleteAcademy(academyDetail.id)}
            variant="outline"
            className="w-full border-red-200 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20"
          >
            <Trash2 className="w-4 h-4 mr-2" />
            Delete Academy
          </Button>

          {/* Player Quick-Profile Modal — shows when coach taps a player row.
              Lets coach call / WhatsApp directly without leaving the dashboard. */}
          <AnimatePresence>
            {playerProfileView && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 z-50 bg-black/50 flex items-end sm:items-center justify-center p-4"
                onClick={() => setPlayerProfileView(null)}
              >
                <motion.div
                  initial={{ y: 50, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  exit={{ y: 50, opacity: 0 }}
                  onClick={(e) => e.stopPropagation()}
                  className="bg-white dark:bg-warm-900 rounded-2xl p-5 w-full max-w-sm space-y-4"
                >
                  <div className="flex items-center justify-between">
                    <h3 className="text-base font-bold text-warm-800 dark:text-warm-100">Player Details</h3>
                    <button onClick={() => setPlayerProfileView(null)} className="p-1 rounded-full hover:bg-warm-100 dark:hover:bg-warm-800">
                      <X className="w-4 h-4 text-warm-500" />
                    </button>
                  </div>
                  <div className="flex flex-col items-center text-center py-2">
                    <div className="w-20 h-20 rounded-full bg-gradient-to-br from-brand-green to-brand-green-dark flex items-center justify-center text-white font-bold text-2xl overflow-hidden mb-3">
                      {playerProfileView.user.avatar ? (
                        <img src={playerProfileView.user.avatar} alt={playerProfileView.user.name || 'Player'} className="w-full h-full object-cover" />
                      ) : (
                        (playerProfileView.user.name || '?')[0]?.toUpperCase()
                      )}
                    </div>
                    <p className="text-lg font-bold text-warm-800 dark:text-warm-100">{playerProfileView.user.name || 'Unknown Player'}</p>
                    {playerProfileView.user.phone && (
                      <p className="text-sm text-warm-500 dark:text-warm-400 mt-0.5">{playerProfileView.user.phone}</p>
                    )}
                    <p className="text-[10px] text-warm-400 dark:text-warm-500 mt-1">
                      Joined {new Date(playerProfileView.joinedAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </p>
                  </div>
                  {/* Action buttons */}
                  <div className="grid grid-cols-2 gap-3">
                    {playerProfileView.user.phone ? (
                      <>
                        <a
                          href={`tel:${playerProfileView.user.phone}`}
                          className="flex items-center justify-center gap-2 py-3 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white font-semibold text-sm transition-colors"
                        >
                          <Phone className="w-4 h-4" />
                          Call
                        </a>
                        <a
                          href={`https://wa.me/${playerProfileView.user.phone.replace(/\D/g, '')}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center justify-center gap-2 py-3 rounded-xl bg-green-500 hover:bg-green-600 text-white font-semibold text-sm transition-colors"
                        >
                          <MessageCircle className="w-4 h-4" />
                          WhatsApp
                        </a>
                      </>
                    ) : (
                      <p className="col-span-2 text-center text-xs text-warm-400 py-3">No phone number on file</p>
                    )}
                  </div>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      );
    }

    // Academy List View
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="p-4 space-y-4"
      >
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-lg font-bold text-warm-800 dark:text-warm-200">My Academies</h2>
          <Button
            onClick={() => setAcademySubView('create')}
            size="sm"
            className="bg-brand-green hover:bg-brand-green-dark text-white"
          >
            <Plus className="w-4 h-4 mr-1" />
            Create
          </Button>
        </div>

        {loading && academies.length === 0 ? (
          <div className="flex flex-col items-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-brand-green mb-3" />
            <p className="text-sm text-warm-500">Loading academies...</p>
          </div>
        ) : academies.length === 0 ? (
          <Card className="bg-white/10 dark:bg-white/5 backdrop-blur-xl border-white/10">
            <CardContent className="p-8 text-center">
              <Building2 className="w-12 h-12 text-warm-300 mx-auto mb-3" />
              <p className="text-warm-600 dark:text-warm-400 font-medium mb-1">No academy yet</p>
              <p className="text-xs text-warm-500">Create one to start managing your team!</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {academies.map((academy) => (
              <motion.div
                key={academy.id}
                whileHover={{ scale: 1.01 }}
                whileTap={{ scale: 0.99 }}
                onClick={() => {
                  setSelectedAcademyId(academy.id);
                  fetchAcademyDetail(academy.id);
                  setAcademySubView('detail');
                }}
                className="cursor-pointer"
              >
                <Card className="bg-white/10 dark:bg-white/5 backdrop-blur-xl border-white/10 hover:border-brand-green/30 transition-all">
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <h3 className="font-bold text-warm-800 dark:text-warm-200 text-sm">{academy.name}</h3>
                        {academy.location && (
                          <p className="text-xs text-warm-500 flex items-center gap-1 mt-0.5">
                            <MapPin className="w-3 h-3" /> {academy.location}
                          </p>
                        )}
                        <div className="flex items-center gap-3 mt-2">
                          <Badge variant="secondary" className="bg-brand-green/10 text-brand-green text-[10px]">
                            <Users className="w-3 h-3 mr-0.5" />
                            {academy._count?.players || 0} Players
                          </Badge>
                          <Badge variant="secondary" className="bg-brand-gold/10 text-brand-gold text-[10px]">
                            <Clock className="w-3 h-3 mr-0.5" />
                            {(academy.practiceSchedule || 'one-time').replace('-', ' ')}
                          </Badge>
                        </div>
                      </div>
                      <ChevronRight className="w-5 h-5 text-warm-400" />
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        )}
      </motion.div>
    );
  };

  // ─── Tab: Attendance ───────────────────────────────────

  const renderAttendanceTab = () => {
    if (!selectedAcademyId) {
      return (
        <div className="p-4 text-center">
          <ClipboardCheck className="w-12 h-12 text-warm-300 mx-auto mb-3" />
          <p className="text-warm-500">Select an academy first</p>
          {renderAcademySelector(true)}
        </div>
      );
    }

    const presentCount = attendanceRecords.filter((r) => r.isPresent).length;
    const totalCount = attendanceRecords.length;
    const percentage = totalCount > 0 ? Math.round((presentCount / totalCount) * 100) : 0;
    const absentPlayers = attendanceRecords.filter((r) => !r.isPresent);

    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="p-4 space-y-4"
      >
        {renderAcademySelector(true)}

        {/* Date & Stats Header */}
        <Card className="bg-gradient-to-r from-brand-green/10 to-brand-green/5 backdrop-blur-xl border-brand-green/20">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <Calendar className="w-5 h-5 text-brand-green" />
                <span className="text-sm font-bold text-warm-800 dark:text-warm-200">
                  {new Date(attendanceDate).toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' })}
                </span>
              </div>
              <Input
                type="date"
                value={attendanceDate}
                onChange={(e) => {
                  setAttendanceDate(e.target.value);
                  if (selectedAcademyId) fetchAttendance(selectedAcademyId, e.target.value);
                }}
                className="w-auto text-xs bg-white/50 dark:bg-white/5 border-warm-200 dark:border-warm-700"
              />
            </div>
            <div className="flex items-center gap-4">
              <div className="flex-1">
                <div className="w-full h-2 bg-white/20 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-brand-green rounded-full transition-all"
                    style={{ width: `${percentage}%` }}
                  />
                </div>
              </div>
              <span className="text-sm font-bold text-brand-green">{percentage}%</span>
            </div>
            <p className="text-xs text-warm-500 mt-1">
              {presentCount} of {totalCount} present
            </p>
          </CardContent>
        </Card>

        {/* Bulk Actions */}
        <div className="flex gap-2">
          <Button
            size="sm"
            className="flex-1 bg-brand-green hover:bg-brand-green-dark text-white text-xs"
            onClick={() => setAttendanceRecords((prev) => prev.map((r) => ({ ...r, isPresent: true })))}
          >
            <Check className="w-3 h-3 mr-1" />
            Mark All Present
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="flex-1 border-warm-200 dark:border-warm-700 text-warm-600 dark:text-warm-300 text-xs"
            onClick={() => setAttendanceRecords((prev) => prev.map((r) => ({ ...r, isPresent: false })))}
          >
            <X className="w-3 h-3 mr-1" />
            Mark All Absent
          </Button>
        </div>

        {/* Player Attendance Grid */}
        {loading && attendanceRecords.length === 0 ? (
          <div className="flex justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin text-brand-green" />
          </div>
        ) : attendanceRecords.length === 0 ? (
          <Card className="bg-white/10 dark:bg-white/5 backdrop-blur-xl border-white/10">
            <CardContent className="p-6 text-center">
              <Users className="w-8 h-8 text-warm-300 mx-auto mb-2" />
              <p className="text-sm text-warm-500">No players in this academy</p>
            </CardContent>
          </Card>
        ) : (
          <Card className="bg-white/10 dark:bg-white/5 backdrop-blur-xl border-white/10">
            <CardContent className="p-3">
              <div className="space-y-1.5 max-h-72 overflow-y-auto custom-scrollbar">
                {attendanceRecords.map((record) => (
                  <div
                    key={record.userId}
                    className="flex items-center justify-between p-2.5 rounded-lg bg-white/5 hover:bg-white/10 transition-colors"
                  >
                    <div className="flex items-center gap-2.5">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs ${
                        record.isPresent
                          ? 'bg-brand-green/20 text-brand-green'
                          : 'bg-red-100 dark:bg-red-900/20 text-red-500'
                      }`}>
                        {(record.name || '?')[0]?.toUpperCase()}
                      </div>
                      <span className="text-sm font-medium text-warm-800 dark:text-warm-200">
                        {record.name || 'Unknown'}
                      </span>
                    </div>
                    <button
                      onClick={() =>
                        setAttendanceRecords((prev) =>
                          prev.map((r) =>
                            r.userId === record.userId ? { ...r, isPresent: !r.isPresent } : r
                          )
                        )
                      }
                      className={`w-9 h-9 rounded-lg flex items-center justify-center transition-all ${
                        record.isPresent
                          ? 'bg-brand-green text-white shadow-md'
                          : 'bg-warm-100 dark:bg-warm-800 text-warm-400'
                      }`}
                    >
                      {record.isPresent ? <Check className="w-4 h-4" /> : <X className="w-4 h-4" />}
                    </button>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Save Button */}
        <Button
          onClick={saveAttendance}
          disabled={loading || attendanceRecords.length === 0}
          className="w-full bg-brand-green hover:bg-brand-green-dark text-white font-semibold py-3 rounded-xl"
        >
          {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <ClipboardCheck className="w-4 h-4 mr-2" />}
          Save Attendance
        </Button>

        {/* Missing Players & Notify Parents */}
        {absentPlayers.length > 0 && (
          <Card className="bg-red-50/50 dark:bg-red-900/10 backdrop-blur-xl border-red-200/30 dark:border-red-800/30">
            <CardContent className="p-4 space-y-3">
              <h3 className="text-sm font-bold text-red-600 dark:text-red-400 flex items-center gap-2">
                <AlertCircle className="w-4 h-4" />
                Missing Players ({absentPlayers.length})
              </h3>
              <div className="space-y-1">
                {absentPlayers.map((p) => (
                  <p key={p.userId} className="text-xs text-red-500 dark:text-red-400">
                    • {p.name || 'Unknown'}
                  </p>
                ))}
              </div>
              <Button
                onClick={() => {
                  toast({ title: `Notification sent to ${absentPlayers.length} parents!` });
                }}
                size="sm"
                className="w-full bg-red-500 hover:bg-red-600 text-white"
              >
                <Bell className="w-3 h-3 mr-1" />
                Notify Parents
              </Button>
            </CardContent>
          </Card>
        )}
      </motion.div>
    );
  };

  // ─── Tab: Fees ─────────────────────────────────────────

  const renderFeesTab = () => {
    if (!selectedAcademyId) {
      return (
        <div className="p-4 text-center">
          <IndianRupee className="w-12 h-12 text-warm-300 mx-auto mb-3" />
          <p className="text-warm-500">Select an academy first</p>
          {renderAcademySelector(true)}
        </div>
      );
    }

    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="p-4 space-y-4"
      >
        {renderAcademySelector(true)}

        {/* Month Selector */}
        <div className="flex items-center justify-between">
          <Input
            type="month"
            value={feeMonth}
            onChange={(e) => {
              setFeeMonth(e.target.value);
              if (selectedAcademyId) fetchFees(selectedAcademyId, e.target.value);
            }}
            className="w-auto text-sm bg-white/50 dark:bg-white/5 border-warm-200 dark:border-warm-700"
          />
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="outline"
              className="border-brand-gold/30 text-brand-gold"
              onClick={sendFeeReminders}
            >
              <Send className="w-3 h-3 mr-1" />
              Send Reminders
            </Button>
          </div>
        </div>

        {/* Fee Summary Cards */}
        {feeSummary && (
          <div className="grid grid-cols-2 gap-3">
            <Card className="bg-green-50/50 dark:bg-green-900/10 backdrop-blur-xl border-green-200/30">
              <CardContent className="p-3 text-center">
                <p className="text-[10px] text-green-600 uppercase tracking-wider font-semibold">Collected</p>
                <p className="text-lg font-bold text-green-600">₹{feeSummary.collected.toLocaleString()}</p>
                <p className="text-[10px] text-green-500">{feeSummary.paidCount} paid</p>
              </CardContent>
            </Card>
            <Card className="bg-amber-50/50 dark:bg-amber-900/10 backdrop-blur-xl border-amber-200/30">
              <CardContent className="p-3 text-center">
                <p className="text-[10px] text-amber-600 uppercase tracking-wider font-semibold">Pending</p>
                <p className="text-lg font-bold text-amber-600">₹{feeSummary.pending.toLocaleString()}</p>
                <p className="text-[10px] text-amber-500">{feeSummary.pendingCount} pending</p>
              </CardContent>
            </Card>
            <Card className="bg-red-50/50 dark:bg-red-900/10 backdrop-blur-xl border-red-200/30">
              <CardContent className="p-3 text-center">
                <p className="text-[10px] text-red-600 uppercase tracking-wider font-semibold">Overdue</p>
                <p className="text-lg font-bold text-red-600">₹{feeSummary.overdue.toLocaleString()}</p>
                <p className="text-[10px] text-red-500">{feeSummary.overdueCount} overdue</p>
              </CardContent>
            </Card>
            <Card className="bg-white/10 dark:bg-white/5 backdrop-blur-xl border-white/10">
              <CardContent className="p-3 text-center">
                <p className="text-[10px] text-warm-500 uppercase tracking-wider font-semibold">Total</p>
                <p className="text-lg font-bold text-warm-800 dark:text-warm-200">₹{feeSummary.totalExpected.toLocaleString()}</p>
                <p className="text-[10px] text-warm-500">{feeSummary.totalStudents} students</p>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Add Fee Record Button */}
        <Button
          onClick={() => setShowAddFeeForm(!showAddFeeForm)}
          size="sm"
          className="w-full bg-brand-green/10 text-brand-green hover:bg-brand-green/20 border-0"
          variant="outline"
        >
          <Plus className="w-3 h-3 mr-1" />
          Add Fee Record
        </Button>

        {/* Add Fee Form */}
        <AnimatePresence>
          {showAddFeeForm && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="overflow-hidden"
            >
              <Card className="bg-white/10 dark:bg-white/5 backdrop-blur-xl border-white/10">
                <CardContent className="p-4 space-y-3">
                  <h3 className="text-sm font-bold text-warm-700 dark:text-warm-300">New Fee Record</h3>
                  <div>
                    <label className="text-xs text-warm-500 mb-1 block">Student</label>
                    <select
                      value={feeFormUserId}
                      onChange={(e) => setFeeFormUserId(e.target.value)}
                      className="w-full p-2 rounded-lg bg-white/50 dark:bg-white/5 border border-warm-200 dark:border-warm-700 text-sm text-warm-800 dark:text-warm-200"
                    >
                      <option value="">Select student</option>
                      {feeRecords.map((r) => (
                        <option key={r.userId} value={r.userId}>{r.name || 'Unknown'}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs text-warm-500 mb-1 block">Amount (₹)</label>
                    <Input
                      type="number"
                      value={feeFormAmount}
                      onChange={(e) => setFeeFormAmount(e.target.value)}
                      placeholder="e.g., 500"
                      className="bg-white/50 dark:bg-white/5 border-warm-200 dark:border-warm-700"
                    />
                  </div>
                  <div className="flex gap-2">
                    <Button
                      onClick={createFeeRecord}
                      disabled={!feeFormUserId || !feeFormAmount}
                      size="sm"
                      className="flex-1 bg-brand-green text-white"
                    >
                      Create
                    </Button>
                    <Button
                      onClick={() => setShowAddFeeForm(false)}
                      size="sm"
                      variant="outline"
                      className="flex-1"
                    >
                      Cancel
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ─── Player Fee Status List (with days-left + red dot for expired) ───
            This is the new "at-a-glance" view the user requested. It lists EVERY
            player in the academy (not just those with a fee record this month),
            shows how many days are left in their paid period, and shows a red dot
            next to expired players so the coach can identify them instantly. */}
        <Card className="bg-white/10 dark:bg-white/5 backdrop-blur-xl border-white/10">
          <CardContent className="p-3">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-xs font-bold text-warm-700 dark:text-warm-300 flex items-center gap-1.5">
                <Users className="w-3.5 h-3.5 text-brand-green" />
                All Players — Fee Status
              </h3>
              <span className="text-[9px] text-warm-500">
                {playerFeeStatuses.filter(p => p.isExpired).length} expired · {playerFeeStatuses.filter(p => !p.isExpired && p.feeRecord).length} active
              </span>
            </div>
            {playerFeeStatuses.length === 0 ? (
              <div className="text-center py-6">
                <Loader2 className="w-5 h-5 animate-spin text-warm-400 mx-auto mb-2" />
                <p className="text-xs text-warm-500">Loading fee statuses…</p>
              </div>
            ) : (
              <div className="space-y-1.5 max-h-96 overflow-y-auto custom-scrollbar">
                {/* Sort: expired first (red), then by days-left ascending, then never-paid */}
                {[...playerFeeStatuses]
                  .sort((a, b) => {
                    // Expired players first, then active by days-left, then never-paid
                    if (a.isExpired && !b.isExpired) return -1;
                    if (!a.isExpired && b.isExpired) return 1;
                    if (a.daysLeft === null && b.daysLeft !== null) return 1;
                    if (a.daysLeft !== null && b.daysLeft === null) return -1;
                    if (a.daysLeft !== null && b.daysLeft !== null) return a.daysLeft - b.daysLeft;
                    return (a.name || '').localeCompare(b.name || '');
                  })
                  .map((p) => {
                    const expired = p.isExpired;
                    const neverPaid = !p.feeRecord;
                    const daysLeft = p.daysLeft;
                    return (
                      <div
                        key={p.userId}
                        className={`flex items-center justify-between p-2.5 rounded-lg transition-colors ${
                          expired
                            ? 'bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/40'
                            : neverPaid
                            ? 'bg-warm-50 dark:bg-warm-800/30'
                            : 'bg-white/5 hover:bg-white/10'
                        }`}
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          {/* Red dot for expired, amber for never-paid, green for active */}
                          <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${
                            expired ? 'bg-red-500 animate-pulse' : neverPaid ? 'bg-warm-400' : 'bg-emerald-500'
                          }`} />
                          <div className={`w-7 h-7 rounded-full overflow-hidden flex items-center justify-center font-bold text-[10px] shrink-0 ${
                            expired
                              ? 'bg-red-100 dark:bg-red-900/40 text-red-600'
                              : 'bg-brand-green/20 text-brand-green'
                          }`}>
                            {p.avatar ? (
                              <img src={p.avatar} alt={p.name || 'Player'} className="w-full h-full object-cover" />
                            ) : (
                              (p.name || '?')[0]?.toUpperCase()
                            )}
                          </div>
                          <div className="min-w-0">
                            <p className={`text-sm font-medium truncate ${expired ? 'text-red-700 dark:text-red-300' : 'text-warm-800 dark:text-warm-200'}`}>
                              {p.name || 'Unknown'}
                            </p>
                            <p className="text-[10px] text-warm-500 truncate">
                              {p.phone || 'No phone'}
                            </p>
                          </div>
                        </div>
                        <div className="flex flex-col items-end shrink-0">
                          {neverPaid ? (
                            <span className="text-[10px] font-semibold text-warm-500">Never paid</span>
                          ) : expired ? (
                            <span className="text-[10px] font-bold text-red-600 dark:text-red-400">
                              {daysLeft !== null && daysLeft < 0 ? `${Math.abs(daysLeft)}d expired` : 'Expired'}
                            </span>
                          ) : daysLeft !== null ? (
                            <span className={`text-[10px] font-bold ${daysLeft <= 7 ? 'text-amber-600 dark:text-amber-400' : 'text-emerald-600 dark:text-emerald-400'}`}>
                              {daysLeft}d left
                            </span>
                          ) : (
                            <span className="text-[10px] text-warm-500">—</span>
                          )}
                          {p.feeRecord && (
                            <span className="text-[9px] text-warm-400 capitalize">
                              {p.feeRecord.period} · ₹{p.feeRecord.amount}
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Fee Records List */}
        {loading && feeRecords.length === 0 ? (
          <div className="flex justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin text-brand-green" />
          </div>
        ) : feeRecords.length === 0 ? (
          <Card className="bg-white/10 dark:bg-white/5 backdrop-blur-xl border-white/10">
            <CardContent className="p-6 text-center">
              <IndianRupee className="w-8 h-8 text-warm-300 mx-auto mb-2" />
              <p className="text-sm text-warm-500">No fee records for this month</p>
            </CardContent>
          </Card>
        ) : (
          <Card className="bg-white/10 dark:bg-white/5 backdrop-blur-xl border-white/10">
            <CardContent className="p-3">
              <div className="space-y-1.5 max-h-80 overflow-y-auto custom-scrollbar">
                {feeRecords.map((record) => (
                  <div
                    key={record.userId}
                    className="flex items-center justify-between p-2.5 rounded-lg bg-white/5 hover:bg-white/10 transition-colors"
                  >
                    <div className="flex items-center gap-2.5">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs ${
                        record.status === 'paid'
                          ? 'bg-green-100 dark:bg-green-900/20 text-green-600'
                          : record.status === 'overdue'
                          ? 'bg-red-100 dark:bg-red-900/20 text-red-500'
                          : 'bg-amber-100 dark:bg-amber-900/20 text-amber-600'
                      }`}>
                        {(record.name || '?')[0]?.toUpperCase()}
                      </div>
                      <div>
                        <p className="text-sm font-medium text-warm-800 dark:text-warm-200">{record.name || 'Unknown'}</p>
                        <p className="text-[10px] text-warm-500">₹{record.amount.toLocaleString()}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge
                        className={`text-[10px] ${
                          record.status === 'paid'
                            ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                            : record.status === 'overdue'
                            ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                            : 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
                        }`}
                      >
                        {record.status === 'paid' && <CheckCircle2 className="w-3 h-3 mr-0.5" />}
                        {record.status.charAt(0).toUpperCase() + record.status.slice(1)}
                      </Badge>
                      {record.status !== 'paid' && record.feeId && (
                        <Button
                          size="sm"
                          className="h-7 text-[10px] bg-brand-green text-white px-2"
                          onClick={() => markFeePaid(record.feeId!)}
                        >
                          Mark Paid
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </motion.div>
    );
  };

  // ─── Tab: Rewards ──────────────────────────────────────

  const renderRewardsTab = () => {
    if (!selectedAcademyId) {
      return (
        <div className="p-4 text-center">
          <Trophy className="w-12 h-12 text-warm-300 mx-auto mb-3" />
          <p className="text-warm-500">Select an academy first</p>
          {renderAcademySelector(true)}
        </div>
      );
    }

    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="p-4 space-y-4"
      >
        {renderAcademySelector(true)}

        {/* Player of the Month */}
        {playerOfMonth ? (
          <Card className="bg-gradient-to-r from-brand-gold/20 to-brand-gold/5 backdrop-blur-xl border-brand-gold/30">
            <CardContent className="p-4 text-center">
              <Crown className="w-8 h-8 text-brand-gold mx-auto mb-2" />
              <p className="text-xs text-brand-gold font-semibold uppercase tracking-wider mb-1">Player of the Month</p>
              <p className="text-lg font-bold text-warm-800 dark:text-warm-200">{playerOfMonth.user?.name || 'Unknown'}</p>
              <p className="text-xs text-warm-500">{playerOfMonth.title}</p>
              {playerOfMonth.description && (
                <p className="text-xs text-warm-500 mt-1">{playerOfMonth.description}</p>
              )}
            </CardContent>
          </Card>
        ) : (
          <Card className="bg-white/10 dark:bg-white/5 backdrop-blur-xl border-white/10">
            <CardContent className="p-4 text-center">
              <Crown className="w-8 h-8 text-warm-300 mx-auto mb-2" />
              <p className="text-sm text-warm-500">No Player of the Month this month</p>
              <p className="text-xs text-warm-400">Give a reward to crown the best player!</p>
            </CardContent>
          </Card>
        )}

        {/* Give Reward Button */}
        <Button
          onClick={() => setShowRewardForm(!showRewardForm)}
          size="sm"
          className="w-full bg-brand-gold/10 text-brand-gold hover:bg-brand-gold/20 border-0"
          variant="outline"
        >
          <Star className="w-3 h-3 mr-1" />
          Give Reward
        </Button>

        {/* Reward Form */}
        <AnimatePresence>
          {showRewardForm && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="overflow-hidden"
            >
              <Card className="bg-white/10 dark:bg-white/5 backdrop-blur-xl border-white/10">
                <CardContent className="p-4 space-y-3">
                  <h3 className="text-sm font-bold text-warm-700 dark:text-warm-300">Give Reward</h3>
                  <div>
                    <label className="text-xs text-warm-500 mb-1 block">Type</label>
                    <div className="grid grid-cols-2 gap-2">
                      {[
                        { value: 'player_of_month', label: '👑 Player of Month' },
                        { value: 'best_raider', label: '⚔️ Best Raider' },
                        { value: 'best_defender', label: '🛡️ Best Defender' },
                        { value: 'custom', label: '⭐ Custom' },
                      ].map((type) => (
                        <button
                          key={type.value}
                          onClick={() => setRewardForm((f) => ({ ...f, type: type.value }))}
                          className={`py-2 px-3 rounded-lg text-xs font-medium transition-all ${
                            rewardForm.type === type.value
                              ? 'bg-brand-gold text-white shadow-md'
                              : 'bg-white/10 dark:bg-white/5 text-warm-600 dark:text-warm-400'
                          }`}
                        >
                          {type.label}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <label className="text-xs text-warm-500 mb-1 block">Student</label>
                    <select
                      value={rewardForm.userId}
                      onChange={(e) => setRewardForm((f) => ({ ...f, userId: e.target.value }))}
                      className="w-full p-2 rounded-lg bg-white/50 dark:bg-white/5 border border-warm-200 dark:border-warm-700 text-sm text-warm-800 dark:text-warm-200"
                    >
                      <option value="">Select student</option>
                      {academyDetail?.players?.map((p) => (
                        <option key={p.userId} value={p.userId}>{p.user.name || 'Unknown'}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs text-warm-500 mb-1 block">Title</label>
                    <Input
                      value={rewardForm.title}
                      onChange={(e) => setRewardForm((f) => ({ ...f, title: e.target.value }))}
                      placeholder="e.g., Outstanding Performance"
                      className="bg-white/50 dark:bg-white/5 border-warm-200 dark:border-warm-700"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-warm-500 mb-1 block">Description (optional)</label>
                    <Input
                      value={rewardForm.description}
                      onChange={(e) => setRewardForm((f) => ({ ...f, description: e.target.value }))}
                      placeholder="Reason for reward"
                      className="bg-white/50 dark:bg-white/5 border-warm-200 dark:border-warm-700"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-warm-500 mb-1 block">Points</label>
                    <Input
                      type="number"
                      value={rewardForm.points}
                      onChange={(e) => setRewardForm((f) => ({ ...f, points: parseInt(e.target.value) || 0 }))}
                      placeholder="0"
                      className="bg-white/50 dark:bg-white/5 border-warm-200 dark:border-warm-700"
                    />
                  </div>
                  <div className="flex gap-2">
                    <Button
                      onClick={giveReward}
                      disabled={!rewardForm.userId || !rewardForm.title}
                      size="sm"
                      className="flex-1 bg-brand-gold text-white"
                    >
                      Give Reward
                    </Button>
                    <Button
                      onClick={() => setShowRewardForm(false)}
                      size="sm"
                      variant="outline"
                      className="flex-1"
                    >
                      Cancel
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Points Leaderboard */}
        {leaderboard.length > 0 && (
          <Card className="bg-white/10 dark:bg-white/5 backdrop-blur-xl border-white/10">
            <CardContent className="p-4">
              <h3 className="text-sm font-bold text-warm-700 dark:text-warm-300 mb-3 flex items-center gap-2">
                <Star className="w-4 h-4 text-brand-gold" />
                Points Leaderboard
              </h3>
              <div className="space-y-2 max-h-48 overflow-y-auto custom-scrollbar">
                {leaderboard.map((entry, idx) => (
                  <div
                    key={entry.userId}
                    className="flex items-center justify-between p-2 rounded-lg bg-white/5"
                  >
                    <div className="flex items-center gap-2.5">
                      <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                        idx === 0 ? 'bg-brand-gold/20 text-brand-gold' :
                        idx === 1 ? 'bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-300' :
                        idx === 2 ? 'bg-amber-100 dark:bg-amber-900/20 text-amber-600' :
                        'bg-warm-100 dark:bg-warm-800 text-warm-500'
                      }`}>
                        {idx + 1}
                      </span>
                      <span className="text-sm font-medium text-warm-800 dark:text-warm-200">{entry.name || 'Unknown'}</span>
                    </div>
                    <Badge className="bg-brand-gold/10 text-brand-gold text-[10px]">
                      {entry.totalPoints} pts
                    </Badge>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Recent Rewards */}
        {rewards.length > 0 && (
          <Card className="bg-white/10 dark:bg-white/5 backdrop-blur-xl border-white/10">
            <CardContent className="p-4">
              <h3 className="text-sm font-bold text-warm-700 dark:text-warm-300 mb-3">Reward History</h3>
              <div className="space-y-2 max-h-48 overflow-y-auto custom-scrollbar">
                {rewards.slice(0, 20).map((reward) => (
                  <div key={reward.id} className="flex items-center gap-3 p-2 rounded-lg bg-white/5">
                    <span className="text-lg">
                      {reward.type === 'player_of_month' ? '👑' :
                       reward.type === 'best_raider' ? '⚔️' :
                       reward.type === 'best_defender' ? '🛡️' : '⭐'}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-warm-800 dark:text-warm-200 truncate">{reward.title}</p>
                      <p className="text-[10px] text-warm-500">
                        {reward.user?.name || 'Unknown'} • {reward.points} pts • {new Date(reward.createdAt).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {!loading && rewards.length === 0 && (
          <Card className="bg-white/10 dark:bg-white/5 backdrop-blur-xl border-white/10">
            <CardContent className="p-6 text-center">
              <Trophy className="w-8 h-8 text-warm-300 mx-auto mb-2" />
              <p className="text-sm text-warm-500">No rewards yet</p>
              <p className="text-xs text-warm-400">Start rewarding your players!</p>
            </CardContent>
          </Card>
        )}
      </motion.div>
    );
  };

  // ─── Tab: Analytics ────────────────────────────────────

  const renderAnalyticsTab = () => {
    if (!selectedAcademyId) {
      return (
        <div className="p-4 text-center">
          <BarChart3 className="w-12 h-12 text-warm-300 mx-auto mb-3" />
          <p className="text-warm-500">Select an academy first</p>
          {renderAcademySelector(true)}
        </div>
      );
    }

    if (loading && !analytics) {
      return (
        <div className="flex flex-col items-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-brand-green mb-3" />
          <p className="text-sm text-warm-500">Loading analytics...</p>
        </div>
      );
    }

    if (!analytics) return null;

    const feePieData = [
      { name: 'Paid', value: analytics.feeSummary.paid },
      { name: 'Pending', value: analytics.feeSummary.pending },
      { name: 'Overdue', value: analytics.feeSummary.overdue },
    ].filter((d) => d.value > 0);

    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="p-4 space-y-4"
      >
        {renderAcademySelector(true)}

        {/* Attendance vs Performance */}
        <Card className="bg-white/10 dark:bg-white/5 backdrop-blur-xl border-white/10">
          <CardContent className="p-4">
            <h3 className="text-sm font-bold text-warm-700 dark:text-warm-300 mb-3">
              Attendance vs Performance
            </h3>
            {analytics.attendancePerformance.length > 0 ? (
              <div className="h-56">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={analytics.attendancePerformance.slice(0, 10)} barGap={4}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                    <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                    <YAxis tick={{ fontSize: 10 }} domain={[0, 100]} />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: 'rgba(255,255,255,0.95)',
                        borderRadius: '8px',
                        border: 'none',
                        boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                        fontSize: '12px',
                      }}
                    />
                    <Bar dataKey="attendancePercent" fill="#22c55e" name="Attendance %" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="performanceScore" fill="#f59e0b" name="Performance" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <p className="text-sm text-warm-500 text-center py-8">No data available yet</p>
            )}
          </CardContent>
        </Card>

        {/* Monthly Attendance Trend */}
        <Card className="bg-white/10 dark:bg-white/5 backdrop-blur-xl border-white/10">
          <CardContent className="p-4">
            <h3 className="text-sm font-bold text-warm-700 dark:text-warm-300 mb-3">
              Monthly Attendance Trend
            </h3>
            {analytics.attendanceTrend.length > 0 ? (
              <div className="h-48">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={analytics.attendanceTrend}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                    <XAxis dataKey="month" tick={{ fontSize: 10 }} />
                    <YAxis tick={{ fontSize: 10 }} domain={[0, 100]} />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: 'rgba(255,255,255,0.95)',
                        borderRadius: '8px',
                        border: 'none',
                        boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                        fontSize: '12px',
                      }}
                    />
                    <Line
                      type="monotone"
                      dataKey="attendanceRate"
                      stroke="#22c55e"
                      strokeWidth={2}
                      dot={{ fill: '#22c55e', r: 4 }}
                      name="Attendance %"
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <p className="text-sm text-warm-500 text-center py-8">No attendance data yet</p>
            )}
          </CardContent>
        </Card>

        {/* Fee Collection Pie Chart */}
        <PremiumLock feature="Advanced Fee Analytics" compact={false}>
          <Card className="bg-white/10 dark:bg-white/5 backdrop-blur-xl border-white/10">
            <CardContent className="p-4">
              <h3 className="text-sm font-bold text-warm-700 dark:text-warm-300 mb-3">
                Fee Collection Rate
              </h3>
              {feePieData.length > 0 ? (
                <div className="h-52">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={feePieData}
                        cx="50%"
                        cy="50%"
                        innerRadius={50}
                        outerRadius={75}
                        paddingAngle={3}
                        dataKey="value"
                        label={({ name, value }) => `₹${value}`}
                      >
                        {feePieData.map((_, index) => (
                          <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip
                        formatter={(value: number) => `₹${value.toLocaleString()}`}
                        contentStyle={{
                          backgroundColor: 'rgba(255,255,255,0.95)',
                          borderRadius: '8px',
                          border: 'none',
                          boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                          fontSize: '12px',
                        }}
                      />
                      <Legend
                        iconType="circle"
                        iconSize={8}
                        wrapperStyle={{ fontSize: '11px' }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <p className="text-sm text-warm-500 text-center py-8">No fee data for this month</p>
              )}
            </CardContent>
          </Card>
        </PremiumLock>

        {/* Quick Stats */}
        <Card className="bg-white/10 dark:bg-white/5 backdrop-blur-xl border-white/10">
          <CardContent className="p-4">
            <h3 className="text-sm font-bold text-warm-700 dark:text-warm-300 mb-3">Quick Stats</h3>
            <div className="grid grid-cols-2 gap-3">
              <div className="p-3 rounded-xl bg-brand-green/10 text-center">
                <p className="text-2xl font-bold text-brand-green">{analytics.totalPlayers}</p>
                <p className="text-[10px] text-warm-500 uppercase tracking-wider">Total Players</p>
              </div>
              <div className="p-3 rounded-xl bg-brand-gold/10 text-center">
                <p className="text-2xl font-bold text-brand-gold">
                  {analytics.feeSummary.paid + analytics.feeSummary.pending + analytics.feeSummary.overdue > 0
                    ? Math.round(
                        (analytics.feeSummary.paid /
                          (analytics.feeSummary.paid + analytics.feeSummary.pending + analytics.feeSummary.overdue)) *
                          100
                      )
                    : 0}%
                </p>
                <p className="text-[10px] text-warm-500 uppercase tracking-wider">Fee Collection</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>
    );
  };

  // ─── Main Render ───────────────────────────────────────

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 20 }}
      className="fixed inset-0 z-50 bg-warm-50 dark:bg-warm-900 flex flex-col"
    >
      {/* Header */}
      <div className="sticky top-0 z-30 bg-warm-50/80 dark:bg-warm-900/80 backdrop-blur-xl border-b border-warm-200/50 dark:border-warm-700/50">
        <div className="flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg hover:bg-white/10 transition-colors"
            >
              <ArrowLeft className="w-5 h-5 text-warm-700 dark:text-warm-300" />
            </button>
            <div>
              <h1 className="text-lg font-black text-warm-800 dark:text-warm-200 flex items-center gap-1.5">
                <span className="text-brand-green">COACH</span> DASHBOARD
              </h1>
              {currentUser?.name && (
                <p className="text-[10px] text-warm-500">{currentUser.name}</p>
              )}
            </div>
          </div>
          {isPremium && (
            <Badge className="bg-brand-gold/10 text-brand-gold border-brand-gold/20 text-[10px]">
              <Crown className="w-3 h-3 mr-0.5" />
              PRO
            </Badge>
          )}
        </div>

        {/* Tabs */}
        <div className="flex overflow-x-auto px-2 pb-2 gap-1 scrollbar-hide">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex-shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold transition-all ${
                activeTab === tab.id
                  ? 'bg-brand-green text-white shadow-md'
                  : 'bg-white/10 dark:bg-white/5 text-warm-600 dark:text-warm-400 hover:bg-white/20'
              }`}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        <AnimatePresence mode="wait">
          {activeTab === 'academy' && <div key="academy">{renderAcademyTab()}</div>}
          {activeTab === 'attendance' && <div key="attendance">{renderAttendanceTab()}</div>}
          {activeTab === 'fees' && <div key="fees">{renderFeesTab()}</div>}
          {activeTab === 'rewards' && <div key="rewards">{renderRewardsTab()}</div>}
          {activeTab === 'analytics' && <div key="analytics">{renderAnalyticsTab()}</div>}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}
