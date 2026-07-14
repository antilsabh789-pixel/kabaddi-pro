'use client';

import { useState, useCallback, useEffect, useMemo } from 'react';
import { motion, AnimatePresence, useMotionValue, useTransform, PanInfo } from 'framer-motion';
import {
  X,
  Bell,
  BellOff,
  Trophy,
  Radio,
  Crown,
  Star,
  Trash2,
  Check,
  CheckCheck,
  Swords,
  MessageCircle,
  Shield,
  Zap,
  ChevronDown,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  useKabaddiStore,
  type AppNotification,
  type NotificationType,
} from '@/lib/store';
import { cn } from '@/lib/utils';

// ─── Constants ──────────────────────────────────────────────────────

type CategoryFilter = 'all' | 'match' | 'achievement' | 'premium' | 'general' | 'chat';

interface CategoryTab {
  id: CategoryFilter;
  label: string;
  types: NotificationType[];
}

const CATEGORY_TABS: CategoryTab[] = [
  { id: 'all', label: 'All', types: ['match_start', 'match_result', 'achievement', 'premium', 'general', 'chat'] },
  { id: 'match', label: 'Matches', types: ['match_start', 'match_result'] },
  { id: 'achievement', label: 'Achievements', types: ['achievement'] },
  { id: 'premium', label: 'Premium', types: ['premium'] },
  { id: 'chat', label: 'Chat', types: ['chat'] },
  { id: 'general', label: 'General', types: ['general'] },
];

const NOTIFICATION_ICONS: Record<NotificationType, typeof Bell> = {
  match_start: Radio,
  match_result: Swords,
  achievement: Trophy,
  premium: Crown,
  general: Bell,
  chat: MessageCircle,
};

const NOTIFICATION_BORDER_COLORS: Record<NotificationType, string> = {
  match_start: 'border-l-brand-teal',
  match_result: 'border-l-brand-red',
  achievement: 'border-l-brand-gold',
  premium: 'border-l-brand-gold',
  general: 'border-l-warm-400',
  chat: 'border-l-brand-red',
};

const NOTIFICATION_ICON_BG: Record<NotificationType, string> = {
  match_start: 'bg-brand-teal/15 text-brand-teal',
  match_result: 'bg-brand-red/15 text-brand-red',
  achievement: 'bg-brand-gold/15 text-brand-gold-dark dark:text-brand-gold',
  premium: 'bg-brand-gold/15 text-brand-gold-dark dark:text-brand-gold',
  general: 'bg-warm-200 dark:bg-warm-300/30 text-warm-500 dark:text-warm-400',
  chat: 'bg-brand-red/15 text-brand-red',
};

const NOTIFICATION_TYPE_LABELS: Record<NotificationType, string> = {
  match_start: 'Match Starting',
  match_result: 'Score Update',
  achievement: 'Achievement',
  premium: 'Premium',
  general: 'General',
  chat: 'New Message',
};

const GROUP_ORDER: NotificationType[] = ['match_start', 'match_result', 'achievement', 'premium', 'chat', 'general'];

const EMPTY_STATE_MESSAGES: Record<CategoryFilter, { title: string; subtitle: string }> = {
  all: { title: 'No notifications', subtitle: "You'll see match results and achievements here" },
  match: { title: 'No match updates', subtitle: 'Match notifications will appear when games go live or finish' },
  achievement: { title: 'No achievements yet', subtitle: 'Keep playing to unlock achievements!' },
  premium: { title: 'No premium alerts', subtitle: 'Premium feature updates will show here' },
  chat: { title: 'No chat messages', subtitle: 'New direct messages from other players will appear here' },
  general: { title: 'All caught up!', subtitle: 'General announcements will appear here' },
};

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

// Group notifications by type
function groupNotificationsByType(notifications: AppNotification[]): { type: NotificationType; label: string; notifications: AppNotification[] }[] {
  const groups = new Map<NotificationType, AppNotification[]>();

  for (const notification of notifications) {
    const existing = groups.get(notification.type) || [];
    existing.push(notification);
    groups.set(notification.type, existing);
  }

  return GROUP_ORDER
    .filter((type) => groups.has(type))
    .map((type) => ({
      type,
      label: NOTIFICATION_TYPE_LABELS[type],
      notifications: groups.get(type)!,
    }));
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
  const Icon = NOTIFICATION_ICONS[notification.type] || Bell;
  const borderClass = NOTIFICATION_BORDER_COLORS[notification.type] || 'border-l-warm-400';
  const iconBgClass = NOTIFICATION_ICON_BG[notification.type] || NOTIFICATION_ICON_BG.general;
  const isPremium = notification.type === 'premium';

  const handleDragEnd = useCallback(
    (_: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
      if (Math.abs(info.offset.x) > 120) {
        onDismiss(notification.id);
      }
    },
    [notification.id, onDismiss]
  );

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
        borderClass,
        notification.read
          ? 'bg-warm-50/60 dark:bg-warm-100/40 border border-warm-200/50 dark:border-warm-200/20'
          : 'bg-white dark:bg-warm-100 border border-warm-200 dark:border-warm-200/30 shadow-sm',
        !notification.read && 'bg-brand-red/[0.03] dark:bg-brand-red/[0.06]',
        isPremium && !notification.read && 'card-shine'
      )}
      onClick={() => onClick(notification)}
      role="button"
      aria-label={`${notification.read ? 'Read' : 'Unread'} notification: ${notification.title}`}
    >
      {/* Swipe hint background */}
      <div className="absolute inset-0 rounded-xl bg-brand-red/10 dark:bg-brand-red/20 flex items-center justify-end pr-6 pointer-events-none">
        <Trash2 className="w-5 h-5 text-brand-red/50" />
      </div>

      <div className="relative p-3 flex items-start gap-3">
        {/* Icon with type indicator */}
        <div className="relative">
          <div
            className={cn(
              'w-9 h-9 rounded-full flex items-center justify-center shrink-0',
              iconBgClass
            )}
          >
            <Icon className="w-4 h-4" />
          </div>
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
          <div className="flex items-center gap-2">
            <p
              className={cn(
                'text-sm text-warm-800 dark:text-warm-700 truncate',
                !notification.read ? 'font-bold' : 'font-medium'
              )}
            >
              {notification.title}
            </p>
          </div>
          <p className="text-xs text-warm-500 dark:text-warm-400 mt-0.5 leading-relaxed line-clamp-2">
            {notification.description}
          </p>
          <div className="flex items-center justify-between mt-1.5">
            <div className="flex items-center gap-2">
              <p className="text-[10px] text-warm-400 dark:text-warm-500">
                {formatTimeAgo(notification.timestamp)}
              </p>
              <span className={cn(
                'text-[9px] font-semibold px-1.5 py-0.5 rounded-full',
                notification.type === 'match_start' && 'bg-brand-teal/10 text-brand-teal',
                notification.type === 'match_result' && 'bg-brand-red/10 text-brand-red',
                notification.type === 'achievement' && 'bg-brand-gold/10 text-brand-gold-dark dark:text-brand-gold',
                notification.type === 'premium' && 'bg-brand-gold/10 text-brand-gold-dark dark:text-brand-gold',
                notification.type === 'general' && 'bg-warm-200/50 dark:bg-warm-300/20 text-warm-500 dark:text-warm-400',
              )}>
                {NOTIFICATION_TYPE_LABELS[notification.type]}
              </span>
            </div>
            {!notification.read && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onMarkRead(notification.id);
                }}
                className="flex items-center gap-1 text-[10px] font-medium text-brand-teal dark:text-brand-teal-light hover:text-brand-teal-dark transition-colors px-1.5 py-0.5 rounded-md hover:bg-brand-teal/10"
                aria-label="Mark notification as read"
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

// ─── Notification Group Header ──────────────────────────────────────

interface GroupHeaderProps {
  label: string;
  type: NotificationType;
  count: number;
  unreadCount: number;
  isExpanded: boolean;
  onToggle: () => void;
}

function GroupHeader({ label, type, count, unreadCount, isExpanded, onToggle }: GroupHeaderProps) {
  const Icon = NOTIFICATION_ICONS[type];
  const iconBgClass = NOTIFICATION_ICON_BG[type];

  return (
    <button
      onClick={onToggle}
      className="w-full flex items-center gap-2 py-2 px-1 group"
      aria-expanded={isExpanded}
      aria-label={`${label} group - ${count} notifications, ${unreadCount} unread`}
    >
      <div className={cn('w-5 h-5 rounded-full flex items-center justify-center', iconBgClass)}>
        <Icon className="w-2.5 h-2.5" />
      </div>
      <span className="text-xs font-semibold text-warm-700 dark:text-warm-600 flex-1 text-left">
        {label}
      </span>
      {unreadCount > 0 && (
        <span className="min-w-[16px] h-4 rounded-full bg-brand-red text-white text-[9px] font-bold flex items-center justify-center px-1">
          {unreadCount}
        </span>
      )}
      <span className="text-[10px] text-warm-400 dark:text-warm-500 mr-1">
        {count}
      </span>
      <ChevronDown
        className={cn(
          'w-3.5 h-3.5 text-warm-400 dark:text-warm-500 transition-transform duration-200',
          isExpanded ? 'rotate-180' : 'rotate-0'
        )}
      />
    </button>
  );
}

// ─── Category Tab ───────────────────────────────────────────────────

interface CategoryTabButtonProps {
  tab: CategoryTab;
  isActive: boolean;
  count: number;
  onClick: () => void;
}

function CategoryTabButton({ tab, isActive, count, onClick }: CategoryTabButtonProps) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'relative px-3 py-1.5 text-xs font-semibold rounded-full transition-colors whitespace-nowrap',
        isActive
          ? 'text-white'
          : 'text-warm-500 dark:text-warm-400 hover:text-warm-700 dark:hover:text-warm-300'
      )}
      aria-selected={isActive}
      role="tab"
    >
      {isActive && (
        <motion.div
          layoutId="notification-tab-indicator"
          className="absolute inset-0 rounded-full bg-brand-red"
          transition={{ type: 'spring', damping: 25, stiffness: 300 }}
        />
      )}
      <span className="relative z-10 flex items-center gap-1">
        {tab.label}
        {count > 0 && (
          <span
            className={cn(
              'min-w-[16px] h-4 rounded-full text-[9px] font-bold flex items-center justify-center px-1',
              isActive
                ? 'bg-white/25 text-white'
                : 'bg-warm-200 dark:bg-warm-300/30 text-warm-600 dark:text-warm-400'
            )}
          >
            {count > 99 ? '99+' : count}
          </span>
        )}
      </span>
    </button>
  );
}

// ─── Empty State ────────────────────────────────────────────────────

interface EmptyStateProps {
  category: CategoryFilter;
}

function EmptyState({ category }: EmptyStateProps) {
  const messages = EMPTY_STATE_MESSAGES[category];

  return (
    <div className="flex flex-col items-center justify-center py-20">
      <motion.div
        animate={{ y: [0, -8, 0] }}
        transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
      >
        <div className="w-20 h-20 rounded-2xl bg-warm-100 dark:bg-warm-200/20 flex items-center justify-center mb-4 relative overflow-hidden">
          <BellOff className="w-8 h-8 text-warm-300 dark:text-warm-400" />
          {/* Decorative circles for illustration */}
          <div className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-brand-gold/10" />
          <div className="absolute -bottom-1 -left-1 w-4 h-4 rounded-full bg-brand-red/10" />
        </div>
      </motion.div>
      <p className="text-warm-600 dark:text-warm-400 text-sm font-semibold">{messages.title}</p>
      <p className="text-warm-400 dark:text-warm-500 text-xs mt-1 text-center max-w-[200px]">
        {messages.subtitle}
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
        <h3 className="text-base font-bold text-warm-800 dark:text-warm-700">Clear All?</h3>
        <p className="text-xs text-warm-500 dark:text-warm-400 mt-1">
          This will remove all notifications. This action cannot be undone.
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
  onNavigate?: (screen: string, matchId?: string) => void;
}

export default function NotificationPanel({ onClose, onNavigate }: NotificationPanelProps) {
  const notifications = useKabaddiStore((s) => s.notifications);
  const markNotificationRead = useKabaddiStore((s) => s.markNotificationRead);
  const markAllRead = useKabaddiStore((s) => s.markAllRead);
  const clearNotifications = useKabaddiStore((s) => s.clearNotifications);
  const addNotification = useKabaddiStore((s) => s.addNotification);

  const [activeCategory, setActiveCategory] = useState<CategoryFilter>('all');
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(new Set());
  const [groupedView, setGroupedView] = useState(true);
  const [expandedGroups, setExpandedGroups] = useState<Set<NotificationType>>(
    new Set(['match_start', 'match_result', 'achievement', 'premium', 'general'])
  );

  const unreadCount = notifications.filter((n) => !n.read).length;

  // Filter notifications by category and exclude dismissed
  const filteredNotifications = useMemo(() => {
    return notifications.filter((n) => {
      if (dismissedIds.has(n.id)) return false;
      const tab = CATEGORY_TABS.find((t) => t.id === activeCategory);
      if (!tab) return true;
      return tab.types.includes(n.type);
    });
  }, [notifications, dismissedIds, activeCategory]);

  // Grouped notifications
  const groupedNotifications = useMemo(() => {
    return groupNotificationsByType(filteredNotifications);
  }, [filteredNotifications]);

  // Count by category
  const categoryCounts = CATEGORY_TABS.map((tab) => ({
    tab,
    count: notifications.filter((n) => tab.types.includes(n.type) && !dismissedIds.has(n.id)).length,
    unreadCount: notifications.filter(
      (n) => tab.types.includes(n.type) && !n.read && !dismissedIds.has(n.id)
    ).length,
  }));

  // Auto-generate contextual notifications on load
  useEffect(() => {
    const existingTypes = new Set(notifications.map((n) => n.type));

    // Premium feature available (only if not premium user and no existing premium notification)
    if (!existingTypes.has('premium')) {
      const timer = setTimeout(() => {
        addNotification({
          type: 'premium',
          title: 'Upgrade to Pro',
          description: 'Unlock advanced stats, AI insights, and more with Kabaddi Pro!',
        });
      }, 2000);
      return () => clearTimeout(timer);
    }
  
    return undefined;}, [addNotification, notifications.length]);

  const handleMarkRead = useCallback(
    (id: string) => {
      markNotificationRead(id);
    },
    [markNotificationRead]
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
      // Mark as read
      if (!notification.read) {
        markNotificationRead(notification.id);
      }

      // Navigate based on type
      if (onNavigate) {
        switch (notification.type) {
          case 'match_start':
          case 'match_result':
            // Pass the matchId so the parent can open MatchDetailsScreen
            // with the correct match scorecard
            onNavigate('match-details', notification.matchId);
            break;
          case 'achievement':
            onNavigate('achievements');
            break;
          case 'premium':
            onNavigate('premium');
            break;
          default:
            break;
        }
      }

      onClose();
    },
    [markNotificationRead, onNavigate, onClose]
  );

  const handleClearAll = useCallback(() => {
    clearNotifications();
    setShowClearConfirm(false);
  }, [clearNotifications]);

  const toggleGroup = useCallback((type: NotificationType) => {
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(type)) {
        next.delete(type);
      } else {
        next.add(type);
      }
      return next;
    });
  }, []);

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
                  <Bell className="w-4 h-4 text-brand-red" />
                </div>
                <h2 className="text-base font-bold text-warm-800 dark:text-warm-700">
                  Notifications
                </h2>
                {unreadCount > 0 && (
                  <Badge className="bg-brand-red text-white text-[9px] border-0 font-bold px-1.5 py-0 animate-[badge-new-bounce_0.5s_ease-out]">
                    {unreadCount > 99 ? '99+' : unreadCount}
                  </Badge>
                )}
              </div>
              <div className="flex items-center gap-2">
                {/* Grouped view toggle */}
                <button
                  onClick={() => setGroupedView(!groupedView)}
                  className={cn(
                    'w-8 h-8 rounded-full flex items-center justify-center transition-colors',
                    groupedView
                      ? 'bg-brand-red/10 text-brand-red'
                      : 'bg-warm-200/80 dark:bg-warm-200/30 text-warm-600 dark:text-warm-400'
                  )}
                  aria-label={groupedView ? 'Switch to flat list view' : 'Switch to grouped view'}
                  title={groupedView ? 'Flat list' : 'Grouped'}
                >
                  <Shield className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={onClose}
                  className="w-8 h-8 rounded-full bg-warm-200/80 dark:bg-warm-200/30 flex items-center justify-center text-warm-600 dark:text-warm-400 hover:bg-warm-300 dark:hover:bg-warm-200/40 transition-colors"
                  aria-label="Close notifications"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Action buttons */}
            {notifications.length > 0 && (
              <div className="flex gap-2 mt-2">
                {unreadCount > 0 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={markAllRead}
                    className="h-7 text-[11px] text-brand-teal dark:text-brand-teal-light hover:text-brand-teal-dark hover:bg-brand-teal/10 px-2"
                    aria-label="Mark all notifications as read"
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
                  aria-label="Clear all notifications"
                >
                  <Trash2 className="w-3 h-3 mr-1" />
                  Clear all
                </Button>
              </div>
            )}

            {/* Category Tabs */}
            <div className="flex gap-1 mt-3 overflow-x-auto custom-scrollbar pb-1 -mx-1 px-1" role="tablist">
              {categoryCounts.map(({ tab, count, unreadCount: tabUnread }) => (
                <CategoryTabButton
                  key={tab.id}
                  tab={tab}
                  isActive={activeCategory === tab.id}
                  count={tabUnread || count}
                  onClick={() => setActiveCategory(tab.id)}
                />
              ))}
            </div>
          </div>

          {/* ─── Notification List ─── */}
          <div className="flex-1 overflow-y-auto px-4 py-2 custom-scrollbar relative">
            <AnimatePresence mode="popLayout">
              {filteredNotifications.length === 0 ? (
                <EmptyState category={activeCategory} />
              ) : groupedView ? (
                /* Grouped view */
                <div className="flex flex-col gap-1">
                  {groupedNotifications.map((group) => (
                    <div key={group.type}>
                      <GroupHeader
                        label={group.label}
                        type={group.type}
                        count={group.notifications.length}
                        unreadCount={group.notifications.filter((n) => !n.read).length}
                        isExpanded={expandedGroups.has(group.type)}
                        onToggle={() => toggleGroup(group.type)}
                      />
                      <AnimatePresence>
                        {expandedGroups.has(group.type) && (
                          <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: 'auto', opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            transition={{ duration: 0.2 }}
                            className="overflow-hidden"
                          >
                            <div className="flex flex-col gap-2 pb-2">
                              {group.notifications.map((notification: AppNotification, idx: number) => (
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
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  ))}
                </div>
              ) : (
                /* Flat list view */
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
                Swipe left on a notification to dismiss • Tap to view
              </p>
            </div>
          )}
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
