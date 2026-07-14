'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Flag, Shield, Loader2, X, Check, AlertTriangle, MessageCircle,
  ChevronRight, Filter, Inbox, CheckCircle2, Ban, FileText,
} from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useKabaddiStore } from '@/lib/store';
import { useToast } from '@/hooks/use-toast';

// ─── Types ────────────────────────────────────────────────────────────

interface PublicUser {
  id: string;
  name: string | null;
  playerCode: string | null;
  avatar: string | null;
  role: string;
  isPremium?: boolean;
  isAdmin?: boolean;
}

interface ChatReport {
  id: string;
  reporterId: string;
  reportedId: string;
  threadId: string | null;
  messageId: string | null;
  reason: string;
  details: string | null;
  status: 'pending' | 'reviewing' | 'actioned' | 'dismissed';
  reviewedBy: string | null;
  reviewedAt: string | null;
  adminNote: string | null;
  createdAt: string;
  reporter?: PublicUser;
  reported?: PublicUser;
  reviewer?: { id: string; name: string | null } | null;
}

interface ContextMessage {
  id: string;
  threadId: string;
  senderId: string;
  content: string;
  createdAt: string;
  sender?: PublicUser;
}

// ─── Constants ────────────────────────────────────────────────────────

const STATUS_META: Record<ChatReport['status'], { label: string; color: string; bg: string; icon: typeof Flag }> = {
  pending:   { label: 'Pending',   color: 'text-amber-700 dark:text-amber-400', bg: 'bg-amber-100 dark:bg-amber-900/30', icon: Inbox },
  reviewing: { label: 'Reviewing', color: 'text-blue-700 dark:text-blue-400', bg: 'bg-blue-100 dark:bg-blue-900/30', icon: Loader2 },
  actioned:  { label: 'Actioned',  color: 'text-green-700 dark:text-green-400', bg: 'bg-green-100 dark:bg-green-900/30', icon: CheckCircle2 },
  dismissed: { label: 'Dismissed', color: 'text-warm-500', bg: 'bg-warm-100 dark:bg-warm-800/50', icon: X },
};

const REASON_LABELS: Record<string, string> = {
  spam: 'Spam',
  abuse: 'Abusive language',
  harassment: 'Harassment',
  inappropriate: 'Inappropriate content',
  other: 'Other',
};

function displayName(u?: PublicUser | null): string {
  if (!u) return 'Unknown user';
  return u.name?.trim() || u.playerCode || 'Kabaddi Player';
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 0 || !parts[0]) return 'KP';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}

function timeAgo(iso: string): string {
  const date = new Date(iso);
  const diffMs = Date.now() - date.getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return date.toLocaleDateString([], { day: 'numeric', month: 'short' });
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleString([], {
    day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
  });
}

// ═══════════════════════════════════════════════════════════════════════
// MAIN ADMIN PANEL
// ═══════════════════════════════════════════════════════════════════════

export default function ChatReportsPanel() {
  const currentUser = useKabaddiStore((s) => s.currentUser);
  const { toast } = useToast();

  const [reports, setReports] = useState<ChatReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'pending' | 'reviewing' | 'actioned' | 'dismissed' | 'all'>('pending');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [stats, setStats] = useState<Record<string, number>>({});

  // Detail view
  const [selectedReport, setSelectedReport] = useState<ChatReport | null>(null);
  const [contextMessages, setContextMessages] = useState<ContextMessage[]>([]);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [adminNote, setAdminNote] = useState('');

  const fetchReports = useCallback(async () => {
    if (!currentUser?.id) return;
    setLoading(true);
    try {
      const params = new URLSearchParams({
        adminId: currentUser.id,
        page: String(page),
        pageSize: '20',
      });
      if (filter !== 'all') params.set('status', filter);
      const res = await fetch(`/api/admin/chat/reports?${params}`);
      if (!res.ok) throw new Error('Failed to load reports');
      const data = await res.json();
      setReports(data.reports || []);
      setTotalPages(data.pagination?.totalPages || 1);
      setTotal(data.pagination?.total || 0);
    } catch (err) {
      console.error('fetchReports:', err);
      toast({ title: 'Could not load chat reports', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }, [currentUser?.id, filter, page, toast]);

  const fetchStats = useCallback(async () => {
    if (!currentUser?.id) return;
    try {
      const res = await fetch(`/api/admin/chat/stats?adminId=${currentUser.id}`);
      if (!res.ok) return;
      const data = await res.json();
      setStats(data.byStatus || {});
    } catch {
      /* ignore */
    }
  }, [currentUser?.id]);

  useEffect(() => { fetchReports(); }, [fetchReports]);
  useEffect(() => { fetchStats(); }, [fetchStats]);

  // ─── Open detail view ─────────────────────────────────────────────
  const openReport = async (report: ChatReport) => {
    setSelectedReport(report);
    setAdminNote(report.adminNote || '');
    setContextMessages([]);
    setLoadingDetail(true);
    try {
      const res = await fetch(`/api/admin/chat/reports/${report.id}?adminId=${currentUser?.id}`);
      if (!res.ok) throw new Error('Failed to load report');
      const data = await res.json();
      setSelectedReport(data.report);
      setContextMessages(data.contextMessages || []);
      setAdminNote(data.report?.adminNote || '');
    } catch (err) {
      console.error('openReport:', err);
      toast({ title: 'Could not load report details', variant: 'destructive' });
    } finally {
      setLoadingDetail(false);
    }
  };

  // ─── Apply a review action ────────────────────────────────────────
  const applyAction = async (status: 'reviewing' | 'actioned' | 'dismissed') => {
    if (!selectedReport || !currentUser?.id) return;
    try {
      const res = await fetch(`/api/admin/chat/reports/${selectedReport.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          adminId: currentUser.id,
          status,
          adminNote: adminNote.trim() || undefined,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Failed to update report');
      }
      const data = await res.json();
      toast({
        title: `Report marked as ${STATUS_META[status].label.toLowerCase()}`,
        description: status === 'actioned'
          ? 'Action recorded. Take any external steps (warn/ban user) as needed.'
          : undefined,
      });
      setSelectedReport(null);
      fetchReports();
      fetchStats();
    } catch (err) {
      toast({
        title: 'Could not update report',
        description: err instanceof Error ? err.message : undefined,
        variant: 'destructive',
      });
    }
  };

  // ═══════════════════════════════════════════════════════════════════════
  // RENDER
  // ═══════════════════════════════════════════════════════════════════════

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.32 }}
      className="px-4 mb-4"
    >
      <Card className="p-4 bg-white dark:bg-warm-800/50 border-warm-200 dark:border-warm-700">
        {/* ─── Header ─── */}
        <div className="flex items-center gap-2 mb-3">
          <div className="w-9 h-9 rounded-xl bg-brand-red/10 flex items-center justify-center">
            <Shield className="w-5 h-5 text-brand-red" />
          </div>
          <div className="flex-1">
            <h2 className="text-sm font-bold text-warm-800 dark:text-warm-100">Chat Reports</h2>
            <p className="text-[10px] text-warm-500 dark:text-warm-400">
              Review player-submitted chat reports and take action.
            </p>
          </div>
          {stats.pending > 0 && (
            <span className="min-w-[20px] h-5 px-1.5 rounded-full bg-brand-red text-white text-[10px] font-bold flex items-center justify-center">
              {stats.pending}
            </span>
          )}
        </div>

        {/* ─── Stat pills ─── */}
        <div className="grid grid-cols-4 gap-1.5 mb-3">
          {(['pending', 'reviewing', 'actioned', 'dismissed'] as const).map((s) => {
            const meta = STATUS_META[s];
            const Icon = meta.icon;
            const count = stats[s] || 0;
            return (
              <button
                key={s}
                onClick={() => { setFilter(s === filter ? 'all' : s); setPage(1); }}
                className={`p-2 rounded-xl text-center transition-all border ${
                  filter === s
                    ? 'ring-2 ring-brand-red/40 ' + meta.bg
                    : 'bg-warm-50 dark:bg-warm-800/50 border-warm-200 dark:border-warm-700 hover:' + meta.bg
                }`}
              >
                <Icon className={`w-3 h-3 mx-auto mb-0.5 ${meta.color}`} />
                <p className={`text-[10px] font-bold ${meta.color}`}>{count}</p>
                <p className="text-[8px] text-warm-500 dark:text-warm-400 uppercase">{meta.label}</p>
              </button>
            );
          })}
        </div>

        {/* ─── Filter row ─── */}
        <div className="flex items-center gap-1.5 mb-3 overflow-x-auto pb-1 -mx-1 px-1">
          <Filter className="w-3 h-3 text-warm-400 shrink-0" />
          {(['pending', 'reviewing', 'actioned', 'dismissed', 'all'] as const).map((f) => (
            <button
              key={f}
              onClick={() => { setFilter(f); setPage(1); }}
              className={`px-2.5 py-1 rounded-full text-[10px] font-semibold whitespace-nowrap transition-colors ${
                filter === f
                  ? 'bg-brand-red text-white'
                  : 'bg-warm-100 dark:bg-warm-800 text-warm-600 dark:text-warm-300 hover:bg-warm-200 dark:hover:bg-warm-700'
              }`}
            >
              {f === 'all' ? 'All' : STATUS_META[f].label}
            </button>
          ))}
          <span className="ml-auto text-[10px] text-warm-400 shrink-0">{total} total</span>
        </div>

        {/* ─── Reports list ─── */}
        {loading ? (
          <div className="space-y-2 py-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-16 rounded-xl bg-warm-100 dark:bg-warm-800 animate-pulse" />
            ))}
          </div>
        ) : reports.length === 0 ? (
          <div className="text-center py-8">
            <Inbox className="w-10 h-10 mx-auto mb-2 text-warm-300" />
            <p className="text-xs font-semibold text-warm-600 dark:text-warm-300">No {filter === 'all' ? '' : filter} reports</p>
            <p className="text-[10px] text-warm-400 mt-0.5">
              {filter === 'pending' ? 'You\'re all caught up!' : 'Try a different filter.'}
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {reports.map((r) => {
              const meta = STATUS_META[r.status];
              const StatusIcon = meta.icon;
              return (
                <button
                  key={r.id}
                  onClick={() => openReport(r)}
                  className="w-full p-3 rounded-xl bg-warm-50 dark:bg-warm-800/50 hover:bg-warm-100 dark:hover:bg-warm-800 border border-warm-200/60 dark:border-warm-700/60 text-left transition-colors"
                >
                  <div className="flex items-start gap-2.5">
                    <Avatar className="w-8 h-8 border border-warm-200 dark:border-warm-700 shrink-0">
                      {r.reported?.avatar ? <AvatarImage src={r.reported.avatar} /> : null}
                      <AvatarFallback className="bg-brand-red/10 text-brand-red text-[10px] font-bold">
                        {initials(displayName(r.reported))}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <p className="text-xs font-bold text-warm-800 dark:text-warm-100 truncate">
                          {displayName(r.reported)}
                        </p>
                        <span className={`px-1.5 py-0.5 rounded text-[8px] font-bold ${meta.bg} ${meta.color}`}>
                          {meta.label.toUpperCase()}
                        </span>
                      </div>
                      <p className="text-[10px] text-warm-500 dark:text-warm-400 mt-0.5">
                        <span className="font-semibold">{REASON_LABELS[r.reason] || r.reason}</span>
                        {' · '}
                        Reported by {displayName(r.reporter)}
                      </p>
                      {r.details && (
                        <p className="text-[10px] text-warm-500 dark:text-warm-400 mt-0.5 truncate italic">
                          “{r.details}”
                        </p>
                      )}
                      <p className="text-[9px] text-warm-400 mt-0.5">{timeAgo(r.createdAt)}</p>
                    </div>
                    <ChevronRight className="w-4 h-4 text-warm-400 shrink-0 mt-1" />
                  </div>
                </button>
              );
            })}

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-center gap-2 pt-2">
                <Button
                  size="sm"
                  variant="outline"
                  disabled={page <= 1}
                  onClick={() => setPage(page - 1)}
                  className="text-[11px] h-7"
                >
                  ← Prev
                </Button>
                <span className="text-[10px] text-warm-500">Page {page} of {totalPages}</span>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={page >= totalPages}
                  onClick={() => setPage(page + 1)}
                  className="text-[11px] h-7"
                >
                  Next →
                </Button>
              </div>
            )}
          </div>
        )}
      </Card>

      {/* ─── Detail Modal ─── */}
      <AnimatePresence>
        {selectedReport && (
          <ReportDetailModal
            report={selectedReport}
            contextMessages={contextMessages}
            loading={loadingDetail}
            adminNote={adminNote}
            setAdminNote={setAdminNote}
            onClose={() => setSelectedReport(null)}
            onAction={applyAction}
          />
        )}
      </AnimatePresence>
    </motion.div>
  );
}

// ═══════════════════════════════════════════════════════════════════════
// DETAIL MODAL — full report + context messages + admin actions
// ═══════════════════════════════════════════════════════════════════════

interface ReportDetailModalProps {
  report: ChatReport;
  contextMessages: ContextMessage[];
  loading: boolean;
  adminNote: string;
  setAdminNote: (v: string) => void;
  onClose: () => void;
  onAction: (status: 'reviewing' | 'actioned' | 'dismissed') => void;
}

function ReportDetailModal({
  report, contextMessages, loading, adminNote, setAdminNote, onClose, onAction,
}: ReportDetailModalProps) {
  const meta = STATUS_META[report.status];

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onClose}
      className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center"
    >
      <motion.div
        initial={{ y: 40, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 40, opacity: 0 }}
        onClick={(e) => e.stopPropagation()}
        className="w-full sm:max-w-md bg-warm-50 dark:bg-warm-900 rounded-t-3xl sm:rounded-3xl max-h-[90vh] overflow-y-auto"
      >
        {/* Header */}
        <div className="sticky top-0 bg-warm-50 dark:bg-warm-900 px-5 py-4 border-b border-warm-200/60 dark:border-warm-700/60 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-xl bg-brand-red/10 flex items-center justify-center">
              <Flag className="w-4 h-4 text-brand-red" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-warm-800 dark:text-warm-100">Chat Report</h2>
              <p className="text-[10px] text-warm-500 dark:text-warm-400">Filed {timeAgo(report.createdAt)}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-warm-100 dark:bg-warm-800 flex items-center justify-center text-warm-500 hover:bg-warm-200 dark:hover:bg-warm-700 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {/* Status badge */}
          <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full ${meta.bg} ${meta.color}`}>
            <meta.icon className="w-3 h-3" />
            <span className="text-[10px] font-bold uppercase">{meta.label}</span>
          </div>

          {/* Reason + details */}
          <div>
            <p className="text-[10px] font-bold uppercase text-warm-500 dark:text-warm-400 mb-1">Reason</p>
            <p className="text-sm font-semibold text-warm-800 dark:text-warm-100">
              {REASON_LABELS[report.reason] || report.reason}
            </p>
          </div>

          {report.details && (
            <div>
              <p className="text-[10px] font-bold uppercase text-warm-500 dark:text-warm-400 mb-1">
                Reporter's account
              </p>
              <p className="text-xs text-warm-700 dark:text-warm-200 italic bg-warm-100 dark:bg-warm-800 p-2.5 rounded-xl">
                “{report.details}”
              </p>
            </div>
          )}

          {/* People involved */}
          <div className="grid grid-cols-2 gap-2">
            <div className="p-2.5 rounded-xl bg-warm-100 dark:bg-warm-800/60">
              <p className="text-[9px] font-bold uppercase text-warm-500 dark:text-warm-400 mb-1">Reported</p>
              <div className="flex items-center gap-1.5">
                <Avatar className="w-7 h-7 border border-warm-200 dark:border-warm-700">
                  {report.reported?.avatar ? <AvatarImage src={report.reported.avatar} /> : null}
                  <AvatarFallback className="bg-brand-red/10 text-brand-red text-[10px] font-bold">
                    {initials(displayName(report.reported))}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-warm-800 dark:text-warm-100 truncate">{displayName(report.reported)}</p>
                  {report.reported?.playerCode && (
                    <p className="text-[9px] text-warm-500">{report.reported.playerCode}</p>
                  )}
                </div>
              </div>
            </div>
            <div className="p-2.5 rounded-xl bg-warm-100 dark:bg-warm-800/60">
              <p className="text-[9px] font-bold uppercase text-warm-500 dark:text-warm-400 mb-1">Reporter</p>
              <div className="flex items-center gap-1.5">
                <Avatar className="w-7 h-7 border border-warm-200 dark:border-warm-700">
                  {report.reporter?.avatar ? <AvatarImage src={report.reporter.avatar} /> : null}
                  <AvatarFallback className="bg-warm-200 dark:bg-warm-700 text-warm-600 text-[10px] font-bold">
                    {initials(displayName(report.reporter))}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-warm-800 dark:text-warm-100 truncate">{displayName(report.reporter)}</p>
                  {report.reporter?.playerCode && (
                    <p className="text-[9px] text-warm-500">{report.reporter.playerCode}</p>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Context messages */}
          {report.threadId && (
            <div>
              <p className="text-[10px] font-bold uppercase text-warm-500 dark:text-warm-400 mb-1.5 flex items-center gap-1">
                <MessageCircle className="w-3 h-3" />
                Conversation context
              </p>
              {loading ? (
                <div className="space-y-1.5">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="h-8 rounded-lg bg-warm-100 dark:bg-warm-800 animate-pulse" />
                  ))}
                </div>
              ) : contextMessages.length === 0 ? (
                <p className="text-[11px] text-warm-400 italic">No messages found (thread may have been deleted).</p>
              ) : (
                <div className="space-y-1.5 max-h-48 overflow-y-auto p-2 bg-white dark:bg-warm-800/40 rounded-xl border border-warm-200/60 dark:border-warm-700/60">
                  {contextMessages.map((m) => {
                    const isReported = m.senderId === report.reportedId;
                    return (
                      <div key={m.id} className={`flex flex-col ${isReported ? 'items-end' : 'items-start'}`}>
                        <div className={`max-w-[80%] px-2.5 py-1.5 rounded-xl text-[11px] ${
                          isReported
                            ? 'bg-brand-red/10 text-warm-800 dark:text-warm-100 rounded-br-md border border-brand-red/20'
                            : 'bg-warm-100 dark:bg-warm-800 text-warm-700 dark:text-warm-200 rounded-bl-md'
                        }`}>
                          <p className="whitespace-pre-wrap break-words">{m.content}</p>
                          <p className="text-[8px] text-warm-400 mt-0.5 text-right">{formatTime(m.createdAt)}</p>
                        </div>
                        {isReported && (
                          <p className="text-[8px] text-brand-red font-bold mt-0.5">Reported user</p>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* Admin note */}
          <div>
            <label className="text-[10px] font-bold uppercase text-warm-500 dark:text-warm-400 mb-1.5 block flex items-center gap-1">
              <FileText className="w-3 h-3" />
              Admin note (internal)
            </label>
            <textarea
              value={adminNote}
              onChange={(e) => setAdminNote(e.target.value)}
              rows={2}
              maxLength={1000}
              placeholder="Optional — record what action you took (e.g. 'warned user', '7-day ban applied')"
              className="w-full px-3 py-2 rounded-xl bg-white dark:bg-warm-800 border border-warm-200 dark:border-warm-700 text-xs text-warm-800 dark:text-warm-100 placeholder:text-warm-400 focus:outline-none focus:ring-2 focus:ring-brand-red/30 resize-none"
            />
          </div>

          {/* Reviewer info (if already reviewed) */}
          {report.reviewedBy && (
            <div className="text-[10px] text-warm-500 dark:text-warm-400 bg-warm-100 dark:bg-warm-800/50 p-2 rounded-lg">
              Reviewed by <span className="font-semibold">{report.reviewer?.name || 'Admin'}</span>
              {report.reviewedAt && <> on {formatTime(report.reviewedAt)}</>}
            </div>
          )}

          {/* Actions */}
          <div className="grid grid-cols-3 gap-1.5 pt-1">
            <Button
              onClick={() => onAction('reviewing')}
              variant="outline"
              className="text-[11px] h-9 border-blue-300 text-blue-700 hover:bg-blue-50 dark:border-blue-700 dark:text-blue-400 dark:hover:bg-blue-900/20"
            >
              <Loader2 className="w-3 h-3 mr-1" />
              Reviewing
            </Button>
            <Button
              onClick={() => onAction('actioned')}
              className="text-[11px] h-9 bg-green-600 hover:bg-green-700 text-white"
            >
              <Check className="w-3 h-3 mr-1" />
              Actioned
            </Button>
            <Button
              onClick={() => onAction('dismissed')}
              variant="outline"
              className="text-[11px] h-9 text-warm-600 dark:text-warm-300"
            >
              <X className="w-3 h-3 mr-1" />
              Dismiss
            </Button>
          </div>

          <p className="text-[9px] text-warm-400 text-center pt-1 leading-relaxed">
            <AlertTriangle className="w-2.5 h-2.5 inline mr-1" />
            To ban a user from the app, use the Player Search panel to look them up and remove their account.
            This panel only tracks the report status.
          </p>
        </div>
      </motion.div>
    </motion.div>
  );
}
