'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X, MessageCircle, Send, Clock, User,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useKabaddiStore } from '@/lib/store';
import { t } from '@/lib/i18n';

// ─── Types ────────────────────────────────────────────────────────────────────

interface Comment {
  id: string;
  matchId: string;
  userId: string;
  comment: string;
  userName: string;
  userAvatar: string | null;
  createdAt: string;
}

interface MatchCommentsScreenProps {
  matchId: string;
  onBack: () => void;
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function MatchCommentsScreen({ matchId, onBack }: MatchCommentsScreenProps) {
  const { currentUser, language } = useKabaddiStore();
  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(true);
  const [newComment, setNewComment] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const fetchComments = useCallback(async () => {
    try {
      const res = await fetch(`/api/match-comments?matchId=${matchId}`);
      if (!res.ok) throw new Error('Failed to fetch');
      const data = await res.json();
      setComments(data.comments || []);
    } catch (err) {
      console.error('Comments fetch error:', err);
    } finally {
      setLoading(false);
    }
  }, [matchId]);

  useEffect(() => {
    fetchComments();
  }, [fetchComments]);

  // Auto-scroll to bottom when new comments arrive
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [comments]);

  const handleSubmit = async () => {
    if (!currentUser || !newComment.trim()) return;

    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch('/api/match-comments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          matchId,
          userId: currentUser.id,
          comment: newComment.trim(),
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to post comment');
      }

      const data = await res.json();
      setComments((prev) => [...prev, data.comment]);
      setNewComment('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to post comment');
    } finally {
      setSubmitting(false);
    }
  };

  const formatTime = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    if (diffMins < 1) return t('comments.justNow', language);
    if (diffMins < 60) return `${diffMins}m`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h`;
    const diffDays = Math.floor(diffHours / 24);
    if (diffDays < 7) return `${diffDays}d`;
    return date.toLocaleDateString([], { day: 'numeric', month: 'short' });
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 bg-warm-50 dark:bg-warm-900 flex flex-col"
      >
        {/* ─── Header ─── */}
        <header className="sticky top-0 z-10 bg-warm-50/90 dark:bg-warm-900/90 backdrop-blur-md border-b border-warm-200/60 dark:border-warm-700/60">
          <div className="px-4 py-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-brand-gold to-brand-gold-dark flex items-center justify-center">
                <MessageCircle className="w-4 h-4 text-white" />
              </div>
              <h1 className="text-base font-black tracking-wider text-warm-800 dark:text-warm-100">
                {t('comments.title', language)}
              </h1>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="text-xs text-warm-500">
                {comments.length}
              </Badge>
              <button
                onClick={onBack}
                className="w-8 h-8 rounded-full bg-warm-200 dark:bg-warm-700 flex items-center justify-center text-warm-600 dark:text-warm-300 hover:bg-warm-300 dark:hover:bg-warm-600 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        </header>

        {/* ─── Comments list ─── */}
        <div
          ref={scrollRef}
          className="flex-1 overflow-y-auto px-4 py-4"
        >
          {loading ? (
            <div className="flex flex-col gap-3">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="flex items-start gap-3">
                  <div className="w-9 h-9 rounded-full bg-warm-100 dark:bg-warm-800 animate-pulse" />
                  <div className="flex-1 h-16 rounded-xl bg-warm-100 dark:bg-warm-800 animate-pulse" />
                </div>
              ))}
            </div>
          ) : comments.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-warm-500">
              <MessageCircle className="w-12 h-12 mb-3 opacity-30" />
              <p className="text-sm font-medium">{t('comments.noComments', language)}</p>
              <p className="text-xs text-warm-400 mt-1">{t('comments.beFirst', language)}</p>
            </div>
          ) : (
            <div className="space-y-3">
              {comments.map((comment, idx) => (
                <motion.div
                  key={comment.id}
                  initial={{ y: 10, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  transition={{ delay: idx * 0.03 }}
                  className="flex items-start gap-3"
                >
                  {/* Avatar */}
                  <div className="w-9 h-9 rounded-full bg-warm-200 dark:bg-warm-700 flex items-center justify-center shrink-0 overflow-hidden">
                    {comment.userAvatar ? (
                      <img
                        src={comment.userAvatar}
                        alt={comment.userName}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <User className="w-4 h-4 text-warm-500" />
                    )}
                  </div>

                  {/* Comment content */}
                  <div className="flex-1 min-w-0">
                    <div className="bg-warm-100 dark:bg-warm-800 rounded-xl p-3">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-sm font-bold text-warm-800 dark:text-warm-100 truncate">
                          {comment.userName}
                        </span>
                        <span className="text-[10px] text-warm-400 flex items-center gap-1 shrink-0">
                          <Clock className="w-2.5 h-2.5" />
                          {formatTime(comment.createdAt)}
                        </span>
                      </div>
                      <p className="text-sm text-warm-700 dark:text-warm-200 break-words">
                        {comment.comment}
                      </p>
                    </div>
                    {currentUser?.id === comment.userId && (
                      <span className="text-[10px] text-brand-gold-dark ml-2">
                        {t('comments.you', language)}
                      </span>
                    )}
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </div>

        {/* ─── Input area ─── */}
        {currentUser ? (
          <div className="border-t border-warm-200/60 dark:border-warm-700/60 bg-warm-50/90 dark:bg-warm-900/90 backdrop-blur-md px-4 py-3">
            {error && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="mb-2 text-xs text-red-500 bg-red-50 dark:bg-red-900/20 p-2 rounded-lg"
              >
                {error}
              </motion.div>
            )}
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-brand-gold/20 flex items-center justify-center shrink-0 overflow-hidden">
                {currentUser.avatar ? (
                  <img
                    src={currentUser.avatar}
                    alt={currentUser.name || ''}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <User className="w-4 h-4 text-brand-gold-dark" />
                )}
              </div>
              <input
                ref={inputRef}
                type="text"
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSubmit();
                  }
                }}
                placeholder={t('comments.placeholder', language)}
                maxLength={500}
                className="flex-1 px-3 py-2 text-sm bg-warm-100 dark:bg-warm-800 border border-warm-200 dark:border-warm-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-gold/30 text-warm-800 dark:text-warm-100 placeholder:text-warm-400"
              />
              <Button
                onClick={handleSubmit}
                disabled={!newComment.trim() || submitting}
                size="icon"
                className="rounded-xl bg-brand-gold hover:bg-brand-gold-dark text-white shrink-0"
              >
                {submitting ? (
                  <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ repeat: Infinity, duration: 1, ease: 'linear' }}
                    className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full"
                  />
                ) : (
                  <Send className="w-4 h-4" />
                )}
              </Button>
            </div>
          </div>
        ) : (
          <div className="border-t border-warm-200/60 dark:border-warm-700/60 bg-warm-50/90 dark:bg-warm-900/90 backdrop-blur-md px-4 py-3">
            <p className="text-xs text-warm-400 text-center">
              {t('comments.loginToComment', language)}
            </p>
          </div>
        )}
      </motion.div>
    </AnimatePresence>
  );
}
