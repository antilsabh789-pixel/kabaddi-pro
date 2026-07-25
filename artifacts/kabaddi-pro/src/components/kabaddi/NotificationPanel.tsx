'use client';

import { useState, useCallback, useMemo, useEffect } from 'react';
import { motion, AnimatePresence, useMotionValue, useTransform, PanInfo } from 'framer-motion';
import {
  X,
  BellOff,
  Trash2,
  Check,
  CheckCheck,
  MessageCircle,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  useKabaddiStore,
  type AppNotification,
} from '@/lib/store';
import { cn } from '@/lib/utils';

// ─── Notification Panel (chat-only) ──────────────────────────────────
//
// Per the user's request, the bell notification panel now shows ONLY
// message (chat) notifications. All other notification types (match_start,
// match_result, achievement, premium, general) are filtered out and never
// surface in this panel. The bell badge in the top-right of the app still
// counts them, but tapping the bell only shows chat messages.
//
// When the user taps a chat notification, we call `openChatThread` on the
// store. That stashes { threadId, otherUser } into `pendingChatThread` and
// switches the active tab to 'home'. HomeTab sees `pendingChatThread`,
// opens ChatScreen, which sees `pendingChatThread`, and opens that exact
// conversation thread directly. No need to re-fetch — we already have the
// thread ID from the backend.

// ─── Helpers ────────────────────────────────────────────────────────

function formatTimeAgo(timestamp: number): string {
  const diff = Date.now() - timestamp;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins} min ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} hour${hours > 1 ? 's' : ''} ago`;
  const days = Math.floor(hours / 24);
  if (days === 1) return 'Yesterday';
  if (days < 7) return `${days} days ago`;
  return new Date(timestamp).toLocaleDateString();
}

function displayName(name: string | null | undefined, playerCode: string | null | undefined): string {
  if (name && name.trim()) return name.trim();
  if (playerCode) return playerCode;
  return 'Kabaddi Player';
}

function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 0 || !parts[0]) return 'KP';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}

// ─── Notification Card ──────────────────────────────────────────────

interface NotificationCardProps {
  notification: AppNotification;
  onMarkRead: (id: string) => void;
  onClick: (notification: AppNotification) => void;
  onDismiss: (id: string) => void;
  index?: number;
}

function NotificationCard({ notification, onMarkRead, onClick, onDismiss, index = 0 }: NotificationCardProps) {
  const x = useMotionValue(0);
  const opacity = useTransform(x, [-150, 0, 150], [0.3, 1, 0.3]);

  const handleDragEnd = useCallback(
    (_: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
      if (Math.abs(info.offset.x) > 120) {
        onDismiss(notification.id);
      }
    },
    [notification.id, onDismiss]
  );

  // Sender info — prefer the stashed `fromUser` (included from backend),
  // fall back to `fromUserId` only. The title from the backend is
  // "New message from <sender>" — we strip that prefix to show just the
  // sender's name as the card heading.
  const sender = notification.fromUser;
  const senderName = sender
    ? displayName(sender.name, sender.playerCode)
    : notification.title.replace(/^New message from\s+/i, '') || 'Kabaddi Player';
  const senderInitials = initialsOf(senderName);
  const senderAvatar = sender?.avatar || null;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, x: 40, scale: 0.95 }}
      animate={{ opacity: 1, x: 0, scale: 1 }}
      exit={{ opacity: 0, x: -100, height: 0, marginBottom: 0, scale: 0.9 }}
      transition={{ type: 'spring', damping: 25, stiffness: 300, delay: index * 0.03 }}
      style={{ x, opacity }}
      drag="x"
      dragConstraints={{ left: 0, right: 0 }}
      dragElastic={0.15}
      onDragEnd={handleDragEnd}
      className={cn(
        'relative rounded-xl border-l-4 cursor-pointer transition-colors select-none',
        'border-l-brand-red',
        notification.read
          ? 'bg-warm-50/60 dark:bg-warm-100/40 border border-warm-200/50 dark:border-warm-200/20'
          : 'bg-white dark:bg-warm-100 border border-warm-200 dark:border-warm-200/30 shadow-sm bg-brand-red/[0.03] dark:bg-brand-red/[0.06]'
      )}
      onClick={() => onClick(notification)}
      role="button"
      aria-label={`${notification.read ? 'Read' : 'Unread'} message from ${senderName}`}
    >
      {/* Swipe hint background */}
      <div className="absolute inset-0 rounded-xl bg-brand-red/10 dark:bg-brand-red/20 flex items-center justify-end pr-6 pointer-events-none">
        <Trash2 className="w-5 h-5 text-brand-red/50" />
      </div>

      <div className="relative p-3 flex items-start gap-3">
        {/* Avatar with unread dot */}
        <div className="relative shrink-0">
          <Avatar className="w-10 h-10 rounded-full border border-warm-200 dark:border-warm-700/50">
            <AvatarImage src={senderAvatar || undefined} alt={senderName} />
            <AvatarFallback className="bg-brand-red/10 text-brand-red text-xs font-bold">
              {senderInitials}
            </AvatarFallback>
          </Avatar>
          {/* Unread dot */}
          {!notification.read && (
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-brand-red border-2 border-white dark:border-warm-100"
            />
          )}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <MessageCircle className="w-3 h-3 text-brand-red shrink-0" />
            <p
              className={cn(
                'text-sm text-warm-800 dark:text-warm-700 truncate',
                !notification.read ? 'font-bold' : 'font-medium'
              )}
            >
              {senderName}
            </p>
          </div>
          <p className="text-xs text-warm-600 dark:text-warm-500 mt-0.5 leading-relaxed line-clamp-2">
            {notification.description || '(empty message)'}
          </p>
          <div className="flex items-center justify-between mt-1.5">
            <p className="text-[10px] text-warm-400 dark:text-warm-500">
              {formatTimeAgo(notification.timestamp)}
            </p>
            {!notification.read && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onMarkRead(notification.id);
                }}
                className="flex items-center gap-1 text-[10px] font-medium text-brand-teal dark:text-brand-teal-light hover:text-brand-teal-dark transition-colors px-1.5 py-0.5 rounded-md hover:bg-brand-teal/10"
                aria-label="Mark message as read"
              >
                <Check className="w-3 h-3" />
                Mark read
              </button>
            )}
          </div>
        </div>
      </div>
    </motion.div>
  );
}

// ─── Empty State ────────────────────────────────────────────────────

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-20">
      <motion.div
        animate={{ y: [0, -8, 0] }}
        transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
      >
        <div className="w-20 h-20 rounded-2xl bg-warm-100 dark:bg-warm-200/20 flex items-center justify-center mb-4 relative overflow-hidden">
          <BellOff className="w-8 h-8 text-warm-300 dark:text-warm-400" />
          <div className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-brand-red/10" />
          <div className="absolute -bottom-1 -left-1 w-4 h-4 rounded-full bg-brand-teal/10" />
        </div>
      </motion.div>
      <p className="text-warm-600 dark:text-warm-400 text-sm font-semibold">No messages yet</p>
      <p className="text-warm-400 dark:text-warm-500 text-xs mt-1 text-center max-w-[220px]">
        New direct messages from other players will appear here. Tap one to open the chat.
      </p>
    </div>
  );
}

// ─── Clear Confirmation Dialog ──────────────────────────────────────

interface ClearConfirmProps {
  onConfirm: () => void;
  onCancel: () => void;
}

function ClearConfirmDialog({ onConfirm, onCancel }: ClearConfirmProps) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.9 }}
      className="absolute inset-0 z-20 bg-black/30 backdrop-blur-sm flex items-center justify-center p-4"
    >
      <motion.div
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        className="glass-card-strong rounded-2xl p-5 shadow-xl max-w-[280px] w-full text-center"
      >
        <div className="w-12 h-12 rounded-full bg-brand-red/10 flex items-center justify-center mx-auto mb-3">
          <Trash2 className="w-6 h-6 text-brand-red" />
        </div>
        <h3 className="text-base font-bold text-warm-800 dark:text-warm-700">Clear all messages?</h3>
        <p className="text-xs text-warm-500 dark:text-warm-400 mt-1">
          This will remove all message notifications from this panel. The actual conversations will not be deleted.
        </p>
        <div className="flex gap-2 mt-4">
          <Button
            variant="outline"
            size="sm"
            onClick={onCancel}
            className="flex-1 h-9 text-xs"
          >
            Cancel
          </Button>
          <Button
            variant="destructive"
            size="sm"
            onClick={onConfirm}
            className="flex-1 h-9 text-xs"
          >
            <Trash2 className="w-3 h-3 mr-1" />
            Clear All
          </Button>
        </div>
      </motion.div>
    </motion.div>
  );
}

// ─── Main Panel ─────────────────────────────────────────────────────

interface NotificationPanelProps {
  onClose: () => void;
  // `onNavigate` is kept for backwards compatibility (older callers may
  // still pass it) but is no longer used — chat-thread navigation now
  // goes through the store's `openChatThread` action so it works from
  // any tab, not just the Home tab.
  onNavigate?: (screen: string, matchId?: string) => void;
}

export default function NotificationPanel({ onClose }: NotificationPanelProps) {
  const allNotifications = useKabaddiStore((s) => s.notifications);
  const markNotificationRead = useKabaddiStore((s) => s.markNotificationRead);
  const markBackendNotificationRead = useKabaddiStore((s) => s.markBackendNotificationRead);
  const openChatThread = useKabaddiStore((s) => s.openChatThread);
  const currentUser = useKabaddiStore((s) => s.currentUser);

  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(new Set());

  // ─── Filter: only chat notifications ──────────────────────────────
  // The user explicitly asked for the bell panel to show ONLY message
  // notifications. We filter out every other type (match_start,
  // match_result, achievement, premium, general) — those notifications
  // still exist in the store and still contribute to the bell badge
  // count, but they never appear inside this panel.
  const chatNotifications = useMemo(() => {
    return allNotifications.filter((n) => n.type === 'chat');
  }, [allNotifications]);

  const unreadCount = chatNotifications.filter((n) => !n.read).length;

  const filteredNotifications = useMemo(() => {
    return chatNotifications.filter((n) => !dismissedIds.has(n.id));
  }, [chatNotifications, dismissedIds]);

  // ─── Auto-mark-as-read on panel open (WhatsApp behavior) ───────────
  // When the user opens the bell panel, they've SEEN the notifications.
  // We mark every visible chat notification as read — both locally and
  // on the backend — so the bell badge clears immediately and the same
  // notification doesn't reappear as unread on the next app open.
  //
  // This fixes the "every time I open the app it shows the notification
  // even though I've seen it" bug, which happened when a user opened
  // the bell panel, SAW the notification, but closed the panel without
  // tapping it or clicking "Mark all read". The notification stayed
  // unread locally AND on the backend, so it reappeared on every app
  // open (especially after localStorage was cleared or on a new device,
  // where the local `read: true` flag was lost).
  //
  // Re-fires when chatNotifications changes (e.g. sync brings in
  // notifications after the panel opened). The body is idempotent —
  // it only touches notifications that are still unread — so re-firing
  // is harmless. If a brand-new chat message arrives while the panel
  // is open, it gets auto-marked as read too, which matches WhatsApp
  // inbox behavior.
  useEffect(() => {
    if (!currentUser?.id) return;
    const unreadChatNotifications = chatNotifications.filter((n) => !n.read);
    if (unreadChatNotifications.length === 0) return;

    // Local update (instant UI feedback — bell badge clears right away)
    useKabaddiStore.setState((state) => ({
      notifications: state.notifications.map((n) =>
        n.type === 'chat' && !n.read ? { ...n, read: true } : n
      ),
    }));

    // Backend update (best-effort, fire-and-forget). Use markAllRead so
    // we don't fire N separate PATCHes for N unread notifications.
    // Non-chat notifications are also marked read server-side, which is
    // benign — they're hidden from this panel anyway and the user has
    // effectively "seen" them by opening the app.
    fetch('/api/notifications', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: currentUser.id, markAllRead: true }),
    }).catch(() => { /* ignore — best-effort, local state already updated */ });
  }, [currentUser?.id, chatNotifications]);

  const handleMarkRead = useCallback(
    (id: string) => {
      markNotificationRead(id);
      // Also mark as read on the backend (best-effort). This keeps the
      // server-side unread count in sync so the bell badge is accurate
      // across sessions and devices.
      if (currentUser?.id) {
        markBackendNotificationRead(currentUser.id, id);
      }
    },
    [markNotificationRead, markBackendNotificationRead, currentUser?.id]
  );

  const handleDismiss = useCallback((id: string) => {
    setDismissedIds((prev) => {
      const next = new Set(prev);
      next.add(id);
      return next;
    });
  }, []);

  const handleNotificationClick = useCallback(
    (notification: AppNotification) => {
      // Mark as read locally + on the backend (best-effort)
      if (!notification.read) {
        markNotificationRead(notification.id);
        if (currentUser?.id) {
          markBackendNotificationRead(currentUser.id, notification.id);
        }
      }

      // Open the chat thread. We need a threadId — if the backend didn't
      // provide one (e.g. older notifications created before this column
      // existed), we can't open the thread directly; just close the panel.
      // The user will land on the inbox and can pick the conversation
      // manually.
      const threadId = notification.threadId;
      const fromUser = notification.fromUser;
      const fallbackId = notification.fromUserId;

      if (threadId && (fromUser || fallbackId)) {
        openChatThread(
          threadId,
          fromUser
            ? {
                id: fromUser.id,
                name: fromUser.name,
                playerCode: fromUser.playerCode,
                avatar: fromUser.avatar,
              }
            : {
                id: fallbackId!,
                name: notification.title.replace(/^New message from\s+/i, '') || null,
                playerCode: null,
                avatar: null,
              }
        );
      }

      onClose();
    },
    [markNotificationRead, markBackendNotificationRead, currentUser?.id, openChatThread, onClose]
  );

  const handleClearAll = useCallback(() => {
    // Only clear chat notifications from the store — keep other types
    // (match/achievement/etc.) intact since they're not shown here anyway
    // and we don't want to wipe them silently.
    // We do this by removing only chat-type notifications from the array.
    useKabaddiStore.setState((state) => ({
      notifications: state.notifications.filter((n) => n.type !== 'chat'),
    }));
    setDismissedIds(new Set());
    setShowClearConfirm(false);
  }, []);

  // `handleMarkAllRead` marks only chat notifications as read locally
  // (preserves unread state for any hidden match/achievement notifications
  // so they can still surface elsewhere later). Best-effort backend sync
  // via PATCH /notifications?markAllRead=true so the bell badge stays
  // accurate across devices.
  const handleMarkAllRead = useCallback(() => {
    // Mark only chat notifications as read locally (preserves unread
    // state for any hidden match/achievement notifications so they can
    // still surface elsewhere later).
    useKabaddiStore.setState((state) => ({
      notifications: state.notifications.map((n) =>
        n.type === 'chat' ? { ...n, read: true } : n
      ),
    }));
    // Best-effort: mark all as read on the backend too so the bell
    // badge stays accurate. The backend doesn't expose a "mark only chat"
    // route, so we use markAllRead. Hidden non-chat notifications are
    // not surfaced in this panel anyway, so marking them read is benign.
    if (currentUser?.id) {
      fetch('/api/notifications', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: currentUser.id, markAllRead: true }),
      }).catch(() => { /* ignore — best-effort */ });
    }
  }, [currentUser?.id]);

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm"
        onClick={onClose}
      >
        <motion.div
          initial={{ x: '100%' }}
          animate={{ x: 0 }}
          exit={{ x: '100%' }}
          transition={{ type: 'spring', damping: 25, stiffness: 300 }}
          className="absolute right-0 top-0 bottom-0 w-full max-w-sm glass-notification-panel flex flex-col shadow-2xl"
          onClick={(e) => e.stopPropagation()}
        >
          {/* ─── Header ─── */}
          <div className="sticky top-0 z-10 glass-card-strong border-b border-warm-200/60 dark:border-warm-200/20 px-4 py-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-brand-red/10 flex items-center justify-center">
                  <MessageCircle className="w-4 h-4 text-brand-red" />
                </div>
                <h2 className="text-base font-bold text-warm-800 dark:text-warm-700">
                  Messages
                </h2>
                {unreadCount > 0 && (
                  <Badge className="bg-brand-red text-white text-[9px] border-0 font-bold px-1.5 py-0 animate-[badge-new-bounce_0.5s_ease-out]">
                    {unreadCount > 99 ? '99+' : unreadCount}
                  </Badge>
                )}
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={onClose}
                  className="w-8 h-8 rounded-full bg-warm-200/80 dark:bg-warm-200/30 flex items-center justify-center text-warm-600 dark:text-warm-400 hover:bg-warm-300 dark:hover:bg-warm-200/40 transition-colors"
                  aria-label="Close messages"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Action buttons */}
            {filteredNotifications.length > 0 && (
              <div className="flex gap-2 mt-2">
                {unreadCount > 0 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleMarkAllRead}
                    className="h-7 text-[11px] text-brand-teal dark:text-brand-teal-light hover:text-brand-teal-dark hover:bg-brand-teal/10 px-2"
                    aria-label="Mark all messages as read"
                  >
                    <CheckCheck className="w-3 h-3 mr-1" />
                    Mark all read
                  </Button>
                )}
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowClearConfirm(true)}
                  className="h-7 text-[11px] text-brand-red hover:text-brand-red-dark hover:bg-brand-red/10 px-2"
                  aria-label="Clear all messages"
                >
                  <Trash2 className="w-3 h-3 mr-1" />
                  Clear all
                </Button>
              </div>
            )}
          </div>

          {/* ─── Notification List ─── */}
          <div className="flex-1 overflow-y-auto px-4 py-3 custom-scrollbar relative">
            <AnimatePresence mode="popLayout">
              {filteredNotifications.length === 0 ? (
                <EmptyState />
              ) : (
                <div className="flex flex-col gap-2">
                  {filteredNotifications.map((notification: AppNotification, idx: number) => (
                    <NotificationCard
                      key={notification.id}
                      notification={notification}
                      onMarkRead={handleMarkRead}
                      onClick={handleNotificationClick}
                      onDismiss={handleDismiss}
                      index={idx}
                    />
                  ))}
                </div>
              )}
            </AnimatePresence>

            {/* Clear Confirmation Overlay */}
            <AnimatePresence>
              {showClearConfirm && (
                <ClearConfirmDialog
                  onConfirm={handleClearAll}
                  onCancel={() => setShowClearConfirm(false)}
                />
              )}
            </AnimatePresence>
          </div>

          {/* ─── Footer hint ─── */}
          {filteredNotifications.length > 0 && (
            <div className="px-4 py-2 border-t border-warm-200/50 dark:border-warm-200/20 glass-card">
              <p className="text-[10px] text-warm-400 dark:text-warm-500 text-center">
                Swipe left to dismiss • Tap to open chat
              </p>
            </div>
          )}
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
