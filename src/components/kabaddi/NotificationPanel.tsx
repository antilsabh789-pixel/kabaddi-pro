'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { X, Bell, Check, Trash2, Trophy, Swords, Crown, Star } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useKabaddiStore, type AppNotification, type NotificationType } from '@/lib/store';

const NOTIFICATION_ICONS: Record<NotificationType, typeof Bell> = {
  match_start: Swords,
  match_result: Trophy,
  achievement: Star,
  premium: Crown,
  general: Bell,
};

const NOTIFICATION_COLORS: Record<NotificationType, string> = {
  match_start: 'bg-brand-teal/20 text-brand-teal',
  match_result: 'bg-brand-gold/20 text-brand-gold-dark',
  achievement: 'bg-purple-500/20 text-purple-600',
  premium: 'bg-brand-gold/20 text-brand-gold-dark',
  general: 'bg-warm-200 text-warm-600',
};

interface NotificationPanelProps {
  onClose: () => void;
}

export default function NotificationPanel({ onClose }: NotificationPanelProps) {
  const notifications = useKabaddiStore((s) => s.notifications);
  const markAllRead = useKabaddiStore((s) => s.markAllRead);
  const clearNotifications = useKabaddiStore((s) => s.clearNotifications);

  const unreadCount = notifications.filter((n) => !n.read).length;

  const formatTimeAgo = (timestamp: number) => {
    const diff = Date.now() - timestamp;
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'Just now';
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    if (days === 1) return 'Yesterday';
    if (days < 7) return `${days}d ago`;
    return new Date(timestamp).toLocaleDateString();
  };

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
          className="absolute right-0 top-0 bottom-0 w-full max-w-sm bg-warm-50 flex flex-col shadow-2xl"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="sticky top-0 z-10 bg-warm-50/90 backdrop-blur-md border-b border-warm-200/60 px-4 py-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-brand-red/10 flex items-center justify-center">
                  <Bell className="w-4 h-4 text-brand-red" />
                </div>
                <h2 className="text-base font-bold text-warm-800">Notifications</h2>
                {unreadCount > 0 && (
                  <Badge className="bg-brand-red text-white text-[9px] border-0 font-bold px-1.5 py-0">
                    {unreadCount}
                  </Badge>
                )}
              </div>
              <button
                onClick={onClose}
                className="w-8 h-8 rounded-full bg-warm-200 flex items-center justify-center text-warm-600 hover:bg-warm-300 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Action buttons */}
            {notifications.length > 0 && (
              <div className="flex gap-2 mt-2">
                {unreadCount > 0 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={markAllRead}
                    className="h-7 text-[11px] text-brand-teal hover:text-brand-teal-dark hover:bg-brand-teal/10 px-2"
                  >
                    <Check className="w-3 h-3 mr-1" />
                    Mark all read
                  </Button>
                )}
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={clearNotifications}
                  className="h-7 text-[11px] text-brand-red hover:text-brand-red-dark hover:bg-brand-red/10 px-2"
                >
                  <Trash2 className="w-3 h-3 mr-1" />
                  Clear all
                </Button>
              </div>
            )}
          </div>

          {/* Notification List */}
          <div className="flex-1 overflow-y-auto px-4 py-2">
            {notifications.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16">
                <Bell className="w-12 h-12 text-warm-300 mb-3" />
                <p className="text-warm-600 text-sm font-medium">No notifications</p>
                <p className="text-warm-400 text-xs mt-1">
                  You&apos;ll see match results and achievements here
                </p>
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                {notifications.map((notification: AppNotification) => {
                  const Icon = NOTIFICATION_ICONS[notification.type] || Bell;
                  const colorClass = NOTIFICATION_COLORS[notification.type] || NOTIFICATION_COLORS.general;
                  return (
                    <motion.div
                      key={notification.id}
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      className={`p-3 rounded-xl border transition-colors ${
                        notification.read
                          ? 'bg-warm-50 border-warm-200'
                          : 'bg-white border-warm-300 shadow-sm'
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${colorClass}`}>
                          <Icon className="w-4 h-4" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <p className={`text-sm font-semibold text-warm-800 truncate ${
                              !notification.read ? 'font-bold' : ''
                            }`}>
                              {notification.title}
                            </p>
                            {!notification.read && (
                              <div className="w-2 h-2 rounded-full bg-brand-red shrink-0" />
                            )}
                          </div>
                          <p className="text-xs text-warm-500 mt-0.5 leading-relaxed">
                            {notification.description}
                          </p>
                          <p className="text-[10px] text-warm-400 mt-1">
                            {formatTimeAgo(notification.timestamp)}
                          </p>
                        </div>
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            )}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
