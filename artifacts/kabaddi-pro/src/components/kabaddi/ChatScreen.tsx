'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowLeft, Search, Send, MessageCircle, X, Loader2, MoreVertical,
  Flag, Ban, UserX, Shield, AlertTriangle, Check, Trash2, Users,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  useKabaddiStore,
  type CurrentUser,
} from '@/lib/store';
import { useToast } from '@/hooks/use-toast';
import { useBackButton } from '@/hooks/use-back-button';
import { t } from '@/lib/i18n';

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

interface ChatMessage {
  id: string;
  threadId: string;
  senderId: string;
  content: string;
  isRead: boolean;
  readAt: string | null;
  // Soft-delete (unsend). When non-null, the message has been unsent by
  // the sender and the UI renders a "This message was deleted" placeholder
  // instead of the original content. The backend clears `content` when it
  // sets `deletedAt`, so both fields are reliable indicators.
  deletedAt: string | null;
  createdAt: string;
  sender?: PublicUser;
}

interface ChatThread {
  id: string;
  otherUser: PublicUser;
  lastMessage: {
    id: string;
    content: string;
    senderId: string;
    createdAt: string;
    isRead: boolean;
    deletedAt?: string | null;
  } | null;
  unreadCount: number;
  updatedAt: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────

function displayName(u: PublicUser | undefined | null): string {
  if (!u) return 'Unknown';
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
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  if (diffMins < 1) return 'now';
  if (diffMins < 60) return `${diffMins}m`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) return `${diffDays}d`;
  return date.toLocaleDateString([], { day: 'numeric', month: 'short' });
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

const POLL_INTERVAL_MS = 8000; // poll for new messages every 8s

// ─── safe JSON parsing helper ───────────────────────────────────────────
// When the API is unreachable (e.g. VITE_API_BASE_URL not set on Vercel,
// backend down, or proxy misconfigured), the response is often the SPA's
// index.html (HTML, status 200). Calling res.json() on that throws a cryptic
// "Unexpected token '<', \"<!DOCTYPE \"... is not valid JSON" error.
//
// This helper reads the body ONCE (as text), then attempts JSON parse.
// If the response is HTML or unparseable, it throws a user-friendly error
// instead of the cryptic V8 SyntaxError. The body is consumed only once,
// so call this exactly once per Response object.
async function safeJson<T = any>(res: Response, fallback: T = ({} as T)): Promise<T> {
  const ct = res.headers.get('content-type') || '';
  let text = '';
  try {
    text = await res.text();
  } catch {
    return fallback;
  }
  if (!text) return fallback;
  // If the response isn't JSON (e.g. HTML error page), throw a friendly error
  const looksLikeHtml = text.trim().startsWith('<') || text.includes('<!DOCTYPE') || text.includes('<html');
  if (!ct.includes('application/json') && !ct.includes('text/json')) {
    if (looksLikeHtml) {
      console.error('[chat] non-JSON HTML response', { status: res.status, ct, bodySample: text.slice(0, 200) });
      throw new Error('Could not connect to chat server. Please check your connection and try again.');
    }
    // Log the unexpected response so we can debug. Include status + a body
    // snippet so the next time this fires we can see exactly what came back.
    console.error('[chat] unexpected non-JSON response', { status: res.status, ct, bodySample: text.slice(0, 200) });
    throw new Error(`Could not load messages (server returned ${res.status}). Please try again.`);
  }
  try {
    return JSON.parse(text) as T;
  } catch {
    if (looksLikeHtml) {
      throw new Error('Could not connect to chat server. Please check your connection and try again.');
    }
    throw new Error('Could not parse server response. Please try again.');
  }
}

// ═══════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════════

export default function ChatScreen({ onClose }: { onClose?: () => void } = {}) {
  const currentUser = useKabaddiStore((s) => s.currentUser);
  const language = useKabaddiStore((s) => s.language);
  const addNotification = useKabaddiStore((s) => s.addNotification);
  const pendingChatTarget = useKabaddiStore((s) => s.pendingChatTarget);
  const clearPendingChatTarget = useKabaddiStore((s) => s.clearPendingChatTarget);
  const pendingChatThread = useKabaddiStore((s) => s.pendingChatThread);
  const clearPendingChatThread = useKabaddiStore((s) => s.clearPendingChatThread);
  const { toast } = useToast();

  // Inbox state
  const [threads, setThreads] = useState<ChatThread[]>([]);
  const [threadsLoading, setThreadsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<PublicUser[]>([]);
  const [searching, setSearching] = useState(false);
  const [showNewChat, setShowNewChat] = useState(false);

  // Active conversation state
  const [activeThread, setActiveThread] = useState<{ id: string; otherUser: PublicUser } | null>(null);

  // Inbox poller — refresh thread list every N seconds so unread counts update
  useEffect(() => {
    if (!currentUser?.id || activeThread) return;
    let cancelled = false;
    const poll = async () => {
      try {
        const res = await fetch(`/api/chat/threads?userId=${currentUser.id}`);
        if (!res.ok) return;
        const data = await safeJson(res, { threads: [] });
        if (!cancelled && Array.isArray(data.threads)) {
          setThreads(data.threads);
        }
      } catch {
        /* ignore polling errors */
      }
    };
    poll();
    const id = setInterval(poll, POLL_INTERVAL_MS);
    return () => { cancelled = true; clearInterval(id); };
  }, [currentUser?.id, activeThread]);

  // Initial inbox load
  const fetchThreads = useCallback(async () => {
    if (!currentUser?.id) { setThreadsLoading(false); return; }
    setThreadsLoading(true);
    try {
      const res = await fetch(`/api/chat/threads?userId=${currentUser.id}`);
      if (!res.ok) throw new Error('Failed to load chats');
      const data = await safeJson(res, { threads: [] });
      setThreads(Array.isArray(data.threads) ? data.threads : []);
    } catch (err) {
      console.error('ChatScreen: fetchThreads error:', err);
      toast({
        title: 'Could not load chats',
        description: err instanceof Error ? err.message : undefined,
        variant: 'destructive',
      });
    } finally {
      setThreadsLoading(false);
    }
  }, [currentUser?.id, toast]);

  useEffect(() => { fetchThreads(); }, [fetchThreads]);

  // Player search for new chat
  // Uses /api/players/search?q= (NOT /api/players?search=) — the latter is
  // privacy-locked to phone-numbers-only. /players/search allows substring
  // match on name / playerCode / phone, which is what the chat needs.
  useEffect(() => {
    if (!searchQuery.trim() || !currentUser?.id) {
      setSearchResults([]);
      setSearching(false);
      return;
    }
    setSearching(true);
    const ctrl = new AbortController();
    const timeout = setTimeout(async () => {
      try {
        const res = await fetch(
          `/api/players/search?q=${encodeURIComponent(searchQuery.trim())}&limit=20&userId=${currentUser.id}`,
          { signal: ctrl.signal },
        );
        if (!res.ok) throw new Error('search failed');
        const data = await safeJson(res, { players: [] });
        const list: PublicUser[] = (data.players || [])
          .filter((p: any) => p.id !== currentUser.id && !p.isAdmin)
          .map((p: any) => ({
            id: p.id, name: p.name, playerCode: p.playerCode,
            avatar: p.avatar,
            role: p.role || 'player',
            isPremium: Boolean(p.isPremium),
            isAdmin: Boolean(p.isAdmin),
          }));
        setSearchResults(list);
      } catch (err: any) {
        if (err.name !== 'AbortError') {
          console.error('search error:', err);
        }
      } finally {
        setSearching(false);
      }
    }, 300);
    return () => { ctrl.abort(); clearTimeout(timeout); };
  }, [searchQuery, currentUser?.id]);

  // ─── Start a new conversation ─────────────────────────────────────
  const startConversation = useCallback(async (target: PublicUser) => {
    if (!currentUser?.id) return;
    try {
      const res = await fetch('/api/chat/threads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: currentUser.id, targetUserId: target.id }),
      });
      const data = await safeJson(res);
      if (!res.ok) {
        toast({ title: data.error || 'Could not start chat', variant: 'destructive' });
        return;
      }
      setActiveThread({ id: data.threadId, otherUser: data.otherUser });
      setShowNewChat(false);
      setSearchQuery('');
      setSearchResults([]);
      // Refresh inbox in the background
      fetchThreads();
    } catch (err) {
      console.error('startConversation error:', err);
      toast({ title: 'Could not start chat', variant: 'destructive' });
    }
  }, [currentUser?.id, toast, fetchThreads]);

  // ─── Open an existing thread ──────────────────────────────────────
  const openThread = useCallback((thread: ChatThread) => {
    setActiveThread({ id: thread.id, otherUser: thread.otherUser });
  }, []);

  const closeThread = useCallback(() => {
    setActiveThread(null);
    // Refresh inbox to reflect cleared unread badge
    fetchThreads();
  }, [fetchThreads]);

  // ─── Consume a pending chat target (set by Player Lookup → Chat) ──
  // When the admin taps "Chat" on a player in the Player Lookup panel,
  // the store's `pendingChatTarget` is set and the active tab is switched
  // to 'home' so ChatScreen mounts. Here we auto-start the conversation
  // with that target. The dependency array includes startConversation so
  // we wait until it's stable before consuming. The guard prevents double
  // execution in StrictMode.
  const consumedRef = useRef<string | null>(null);
  useEffect(() => {
    if (!pendingChatTarget || !currentUser?.id) return;
    if (consumedRef.current === pendingChatTarget.id) return;
    consumedRef.current = pendingChatTarget.id;
    const target = pendingChatTarget;
    // Clear immediately so a re-mount doesn't re-trigger
    clearPendingChatTarget();
    startConversation({
      id: target.id,
      name: target.name,
      playerCode: target.playerCode,
      avatar: target.avatar,
      role: 'player',
    });
  }, [pendingChatTarget, currentUser?.id, startConversation, clearPendingChatTarget]);

  // ─── Consume a pending chat THREAD (set by bell notification tap) ──
  // When the user taps a chat notification in the bell panel, the store's
  // `pendingChatThread` is set with { threadId, otherUser } and the active
  // tab is switched to 'home' so ChatScreen mounts. Here we open the
  // existing thread directly via setActiveThread — no need to POST
  // /chat/threads because the thread already exists. The guard prevents
  // double execution in StrictMode.
  const consumedThreadRef = useRef<string | null>(null);
  useEffect(() => {
    if (!pendingChatThread || !currentUser?.id) return;
    if (consumedThreadRef.current === pendingChatThread.threadId) return;
    consumedThreadRef.current = pendingChatThread.threadId;
    const { threadId, otherUser } = pendingChatThread;
    // Clear immediately so a re-mount doesn't re-trigger
    clearPendingChatThread();
    setActiveThread({
      id: threadId,
      otherUser: {
        id: otherUser.id,
        name: otherUser.name,
        playerCode: otherUser.playerCode,
        avatar: otherUser.avatar,
        role: 'player',
      },
    });
    // Refresh the inbox in the background so the thread we just opened
    // shows up at the top with the latest preview.
    fetchThreads();
  }, [pendingChatThread, currentUser?.id, clearPendingChatThread, fetchThreads]);

  // ─── Handle incoming chat notifications (sent from the backend) ──
  // The backend pushes a row into the Notification table; we don't poll
  // that here. Instead, the bell-icon unread count comes from the
  // Zustand `notifications` array. To wire that up, we expose a callback
  // the conversation view calls when it receives a new message via poll.
  // (The NotificationPanel poller in page.tsx picks up server-side
  // notifications separately.)

  // ═══════════════════════════════════════════════════════════════════════
  // RENDER
  // ═══════════════════════════════════════════════════════════════════════

  if (!currentUser) {
    return (
      <div className="flex items-center justify-center min-h-[60vh] px-6 text-center">
        <div>
          <MessageCircle className="w-12 h-12 mx-auto mb-3 text-warm-300" />
          <p className="text-sm text-warm-500">Please log in to start chatting.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-warm-50 dark:bg-warm-900" data-chat-screen={activeThread ? 'conversation' : 'inbox'}>
      <AnimatePresence mode="wait">
        {activeThread ? (
          <ConversationView
            key={`conv-${activeThread.id}`}
            threadId={activeThread.id}
            otherUser={activeThread.otherUser}
            currentUser={currentUser}
            onBack={closeThread}
            onUserBlocked={() => { fetchThreads(); }}
            language={language}
          />
        ) : (
          <InboxView
            key="inbox"
            threads={threads}
            loading={threadsLoading}
            currentUser={currentUser}
            searchQuery={searchQuery}
            setSearchQuery={setSearchQuery}
            searchResults={searchResults}
            searching={searching}
            showNewChat={showNewChat}
            setShowNewChat={setShowNewChat}
            onOpenThread={openThread}
            onStartConversation={startConversation}
            onRefresh={fetchThreads}
            language={language}
            onClose={onClose}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════
// INBOX VIEW — list of conversations + new-chat search
// ═══════════════════════════════════════════════════════════════════════

interface InboxViewProps {
  threads: ChatThread[];
  loading: boolean;
  currentUser: CurrentUser;
  searchQuery: string;
  setSearchQuery: (v: string) => void;
  searchResults: PublicUser[];
  searching: boolean;
  showNewChat: boolean;
  setShowNewChat: (v: boolean) => void;
  onOpenThread: (t: ChatThread) => void;
  onStartConversation: (u: PublicUser) => void;
  onRefresh: () => void;
  language: 'en' | 'hi';
  onClose?: () => void;
}

function InboxView({
  threads, loading, currentUser, searchQuery, setSearchQuery,
  searchResults, searching, showNewChat, setShowNewChat,
  onOpenThread, onStartConversation, onRefresh, language, onClose,
}: InboxViewProps) {
  const totalUnread = threads.reduce((sum, t) => sum + (t.unreadCount || 0), 0);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="max-w-lg mx-auto pb-24"
    >
      {/* ─── Header ─── */}
      <header className="sticky top-0 z-10 bg-warm-50/95 dark:bg-warm-900/95 backdrop-blur-md border-b border-warm-200/60 dark:border-warm-700/60">
        <div className="px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-brand-red to-brand-gold flex items-center justify-center shadow-sm">
              <MessageCircle className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-base font-black tracking-tight text-warm-800 dark:text-warm-100">
                {t('nav.chat', language)}
              </h1>
              <p className="text-[10px] text-warm-500 dark:text-warm-400">
                {totalUnread > 0
                  ? `${totalUnread} unread message${totalUnread === 1 ? '' : 's'}`
                  : 'Tap + to start a new chat'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            {onClose && (
              <button
                onClick={onClose}
                aria-label="Close chat"
                className="w-9 h-9 rounded-full bg-warm-100 dark:bg-warm-800 flex items-center justify-center text-warm-600 dark:text-warm-300 hover:bg-warm-200 dark:hover:bg-warm-700 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            )}
            <button
              onClick={onRefresh}
              aria-label="Refresh"
              className="w-9 h-9 rounded-full bg-warm-100 dark:bg-warm-800 flex items-center justify-center text-warm-600 dark:text-warm-300 hover:bg-warm-200 dark:hover:bg-warm-700 transition-colors"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            </button>
            <button
              onClick={() => setShowNewChat(!showNewChat)}
              aria-label="New chat"
              className={`w-9 h-9 rounded-full flex items-center justify-center transition-colors ${
                showNewChat
                  ? 'bg-brand-red text-white'
                  : 'bg-warm-100 dark:bg-warm-800 text-warm-600 dark:text-warm-300 hover:bg-warm-200 dark:hover:bg-warm-700'
              }`}
            >
              {showNewChat ? <X className="w-4 h-4" /> : <span className="text-xl leading-none font-light">+</span>}
            </button>
          </div>
        </div>
      </header>

      {/* ─── New chat search panel (collapsible) ─── */}
      <AnimatePresence>
        {showNewChat && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden border-b border-warm-200/60 dark:border-warm-700/60 bg-white dark:bg-warm-800/50"
          >
            <div className="p-4">
              <label className="text-[10px] font-bold uppercase text-warm-500 dark:text-warm-400 mb-2 block">
                Search players by name or player code
              </label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-warm-400" />
                <Input
                  autoFocus
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="e.g. Rahul or KP1001"
                  className="pl-9 bg-warm-50 dark:bg-warm-900 border-warm-200 dark:border-warm-700"
                />
                {searching && (
                  <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-warm-400 animate-spin" />
                )}
              </div>

              {searchQuery.trim() && (
                <div className="mt-3 max-h-72 overflow-y-auto">
                  {searchResults.length === 0 && !searching ? (
                    <p className="text-xs text-warm-400 text-center py-4">
                      No players found. Try a different name or code.
                    </p>
                  ) : (
                    <div className="space-y-1">
                      {searchResults.map((u) => (
                        <button
                          key={u.id}
                          onClick={() => onStartConversation(u)}
                          className="w-full flex items-center gap-3 p-2 rounded-xl hover:bg-warm-100 dark:hover:bg-warm-800 transition-colors text-left"
                        >
                          <Avatar className="w-9 h-9 border border-warm-200 dark:border-warm-700">
                            {u.avatar ? <AvatarImage src={u.avatar} /> : null}
                            <AvatarFallback className="bg-brand-red/10 text-brand-red text-xs font-bold">
                              {initials(displayName(u))}
                            </AvatarFallback>
                          </Avatar>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold text-warm-800 dark:text-warm-100 truncate">
                              {displayName(u)}
                            </p>
                            {u.playerCode && (
                              <p className="text-[10px] text-warm-500 dark:text-warm-400">{u.playerCode}</p>
                            )}
                          </div>
                          <MessageCircle className="w-4 h-4 text-warm-400" />
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ─── Conversations list ─── */}
      <div className="px-2 py-2">
        {loading ? (
          <div className="space-y-2 p-2">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="flex items-center gap-3 p-3">
                <div className="w-12 h-12 rounded-full bg-warm-100 dark:bg-warm-800 animate-pulse shrink-0" />
                <div className="flex-1 space-y-2">
                  <div className="h-3 w-1/3 rounded bg-warm-100 dark:bg-warm-800 animate-pulse" />
                  <div className="h-2.5 w-2/3 rounded bg-warm-100 dark:bg-warm-800 animate-pulse" />
                </div>
              </div>
            ))}
          </div>
        ) : threads.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 px-6 text-center">
            <div className="w-20 h-20 rounded-full bg-warm-100 dark:bg-warm-800 flex items-center justify-center mb-4">
              <MessageCircle className="w-10 h-10 text-warm-300" />
            </div>
            <h3 className="text-base font-bold text-warm-700 dark:text-warm-200">No conversations yet</h3>
            <p className="text-xs text-warm-500 dark:text-warm-400 mt-1 max-w-[240px]">
              Tap the <span className="font-bold text-brand-red">+</span> button above to search for players and start your first chat.
            </p>
            <Button
              onClick={() => setShowNewChat(true)}
              className="mt-4 bg-brand-red hover:bg-brand-red-dark text-white text-xs"
              size="sm"
            >
              Start new chat
            </Button>
          </div>
        ) : (
          <div className="space-y-1">
            {threads.map((thread, idx) => (
              <motion.button
                key={thread.id}
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: Math.min(idx * 0.02, 0.3) }}
                onClick={() => onOpenThread(thread)}
                className={`w-full flex items-center gap-3 p-3 rounded-2xl transition-colors text-left ${
                  thread.unreadCount > 0
                    ? 'bg-brand-red/5 dark:bg-brand-red/10 hover:bg-brand-red/10'
                    : 'hover:bg-warm-100 dark:hover:bg-warm-800/50'
                }`}
              >
                <div className="relative shrink-0">
                  <Avatar className="w-12 h-12 border border-warm-200 dark:border-warm-700">
                    {thread.otherUser.avatar ? <AvatarImage src={thread.otherUser.avatar} /> : null}
                    <AvatarFallback className="bg-brand-red/10 text-brand-red text-sm font-bold">
                      {initials(displayName(thread.otherUser))}
                    </AvatarFallback>
                  </Avatar>
                  {thread.unreadCount > 0 && (
                    <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] rounded-full bg-brand-red text-white text-[9px] font-bold flex items-center justify-center px-1 shadow-lg shadow-brand-red/40">
                      {thread.unreadCount > 9 ? '9+' : thread.unreadCount}
                    </span>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <p className={`text-sm truncate ${thread.unreadCount > 0 ? 'font-bold text-warm-800 dark:text-warm-100' : 'font-semibold text-warm-700 dark:text-warm-200'}`}>
                      {displayName(thread.otherUser)}
                      {thread.otherUser.isPremium && (
                        <span className="ml-1 text-[9px] text-brand-gold font-bold">PRO</span>
                      )}
                    </p>
                    <span className="text-[10px] text-warm-400 dark:text-warm-500 shrink-0">
                      {thread.lastMessage ? timeAgo(thread.lastMessage.createdAt) : ''}
                    </span>
                  </div>
                  <p className={`text-xs truncate mt-0.5 italic ${thread.unreadCount > 0 ? 'text-warm-700 dark:text-warm-200 font-medium' : 'text-warm-500 dark:text-warm-400'}`}>
                    {thread.lastMessage
                      ? (thread.lastMessage.deletedAt
                          ? `${thread.lastMessage.senderId === currentUser.id ? 'You: ' : ''}🚫 This message was deleted`
                          : `${thread.lastMessage.senderId === currentUser.id ? 'You: ' : ''}${thread.lastMessage.content}`)
                      : 'No messages yet — say hi! 👋'}
                  </p>
                </div>
              </motion.button>
            ))}
          </div>
        )}
      </div>
    </motion.div>
  );
}

// ═══════════════════════════════════════════════════════════════════════
// CONVERSATION VIEW — message thread + send + report/block
// ═══════════════════════════════════════════════════════════════════════

interface ConversationViewProps {
  threadId: string;
  otherUser: PublicUser;
  currentUser: CurrentUser;
  onBack: () => void;
  onUserBlocked: () => void;
  language: 'en' | 'hi';
}

function ConversationView({
  threadId, otherUser, currentUser, onBack, onUserBlocked, language,
}: ConversationViewProps) {
  const { toast } = useToast();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [newMessage, setNewMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Menu + modals
  const [menuOpen, setMenuOpen] = useState(false);
  const [showReportModal, setShowReportModal] = useState(false);
  const [showBlockConfirm, setShowBlockConfirm] = useState(false);

  // Block status (either direction blocks chat)
  const [youBlockedThem, setYouBlockedThem] = useState(false);
  const [theyBlockedYou, setTheyBlockedYou] = useState(false);

  const scrollRef = useRef<HTMLDivElement>(null);
  const wasAtBottomRef = useRef(true);
  // Mirror `messages` into a ref so fetchMessages can read the latest array
  // for "load more" cursor positioning WITHOUT having `messages` in its
  // useCallback deps. Including messages in deps caused an infinite loop:
  //   setMessages -> fetchMessages identity changes -> useEffect re-fires
  //   -> fetchMessages('initial') -> setMessages -> ...
  const messagesRef = useRef<ChatMessage[]>([]);
  useEffect(() => { messagesRef.current = messages; }, [messages]);

  useBackButton(true, onBack);

  // ─── Fetch messages ───────────────────────────────────────────────
  // Deps are stable (threadId + currentUser.id only). For 'more' mode we
  // read the oldest message from messagesRef.current[0] instead of from
  // a dep, which avoids the infinite re-fetch loop.
  const fetchMessages = useCallback(async (mode: 'initial' | 'more' = 'initial') => {
    try {
      if (mode === 'initial') setLoading(true);
      else setLoadingMore(true);

      // Build a RELATIVE URL string (not `new URL(...).toString()`).
      // The global fetch interceptor in apiBase.ts rewrites relative /api/*
      // paths to API_BASE (the Railway backend URL). If we used `new URL()`
      // here we'd get an absolute same-origin URL that older interceptor
      // versions did not rewrite — causing the fetch to hit Vercel (404)
      // instead of the backend, and the conversation view showed
      // "Unexpected response from server" instead of messages.
      const params = new URLSearchParams();
      params.set('userId', currentUser.id);
      params.set('limit', '30');
      if (mode === 'more') {
        // Use the oldest currently-visible message's createdAt as cursor
        const oldest = messagesRef.current[0];
        if (oldest) params.set('before', oldest.createdAt);
      }
      const fetchUrl = `/api/chat/threads/${threadId}/messages?${params.toString()}`;

      const res = await fetch(fetchUrl);
      // Read body once via safeJson — it throws a friendly error if HTML.
      const data = await safeJson<any>(res, { messages: [] });
      if (!res.ok) {
        throw new Error(data.error || 'Failed to load messages');
      }
      const fetched: ChatMessage[] = Array.isArray(data.messages) ? data.messages : [];

      if (mode === 'initial') {
        setMessages(fetched);
        setHasMore(Boolean(data.hasMore));
        // Scroll to bottom on initial load
        requestAnimationFrame(() => {
          if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        });
      } else {
        // Prepend older messages, preserve scroll position
        const prevScrollHeight = scrollRef.current?.scrollHeight || 0;
        const prevScrollTop = scrollRef.current?.scrollTop || 0;
        setMessages((prev) => [...fetched, ...prev]);
        setHasMore(Boolean(data.hasMore));
        requestAnimationFrame(() => {
          if (scrollRef.current) {
            const newScrollHeight = scrollRef.current.scrollHeight;
            scrollRef.current.scrollTop = prevScrollTop + (newScrollHeight - prevScrollHeight);
          }
        });
      }
    } catch (err) {
      console.error('fetchMessages error:', err);
      if (mode === 'initial') {
        setError(err instanceof Error ? err.message : 'Failed to load messages');
      }
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [threadId, currentUser.id]);

  useEffect(() => {
    fetchMessages('initial');
  }, [fetchMessages]);

  // ─── Poll for new messages (long-poll-ish via setInterval) ───────
  useEffect(() => {
    let cancelled = false;
    const poll = async () => {
      if (cancelled || !scrollRef.current) return;
      const wasAtBottom = wasAtBottomRef.current;
      try {
        // Use a RELATIVE URL so the global fetch interceptor rewrites it
        // to API_BASE (Railway). `new URL(...).toString()` would produce an
        // absolute same-origin URL that bypasses the interceptor.
        const params = new URLSearchParams();
        params.set('userId', currentUser.id);
        params.set('limit', '30');
        const pollUrl = `/api/chat/threads/${threadId}/messages?${params.toString()}`;
        const res = await fetch(pollUrl);
        if (!res.ok || cancelled) return;
        const data = await safeJson(res, { messages: [] });
        const fetched: ChatMessage[] = Array.isArray(data.messages) ? data.messages : [];
        if (cancelled) return;

        // Detect new messages by comparing last id
        setMessages((prev) => {
          const lastId = prev[prev.length - 1]?.id;
          const newLastId = fetched[fetched.length - 1]?.id;
          if (lastId === newLastId && prev.length === fetched.length) return prev; // no change
          // Replace the visible window with the freshest 30
          // (since the backend already marks messages as read on GET)
          if (wasAtBottom) {
            requestAnimationFrame(() => {
              if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
            });
          }
          return fetched;
        });
      } catch {
        /* ignore */
      }
    };
    const id = setInterval(poll, POLL_INTERVAL_MS);
    return () => { cancelled = true; clearInterval(id); };
  }, [threadId, currentUser.id]);

  // ─── Check block status on mount ─────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(
          `/api/chat/block-status?userId=${currentUser.id}&otherUserId=${otherUser.id}`,
        );
        if (!res.ok || cancelled) return;
        const data = await safeJson(res, {});
        if (cancelled) return;
        setYouBlockedThem(Boolean((data as any).youBlockedThem));
        setTheyBlockedYou(Boolean((data as any).theyBlockedYou));
      } catch {
        /* ignore */
      }
    })();
    return () => { cancelled = true; };
  }, [currentUser.id, otherUser.id]);

  // ─── Track scroll position for "should auto-scroll to bottom" ────
  const handleScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    wasAtBottomRef.current = distanceFromBottom < 80;
  }, []);

  // ─── Send a message ──────────────────────────────────────────────
  const handleSend = async () => {
    const trimmed = newMessage.trim();
    if (!trimmed || sending) return;
    setSending(true);
    setError(null);
    try {
      const res = await fetch(`/api/chat/threads/${threadId}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: currentUser.id, content: trimmed }),
      });
      const data = await safeJson(res);
      if (!res.ok) {
        if (data.code === 'BLOCKED') {
          setYouBlockedThem(true);
        }
        throw new Error(data.error || 'Failed to send');
      }
      setMessages((prev) => [...prev, data.message]);
      setNewMessage('');
      requestAnimationFrame(() => {
        if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send');
    } finally {
      setSending(false);
    }
  };

  // ─── Block / Unblock ─────────────────────────────────────────────
  const handleBlock = async () => {
    try {
      const res = await fetch('/api/chat/block', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ blockerId: currentUser.id, blockedId: otherUser.id }),
      });
      const data = await safeJson<any>(res, {});
      if (!res.ok) {
        throw new Error(data.error || 'Failed to block');
      }
      setYouBlockedThem(true);
      setShowBlockConfirm(false);
      setMenuOpen(false);
      toast({ title: `Blocked ${displayName(otherUser)}`, description: 'They can no longer message you.' });
      onUserBlocked();
    } catch (err) {
      toast({
        title: 'Could not block user',
        description: err instanceof Error ? err.message : undefined,
        variant: 'destructive',
      });
    }
  };

  const handleUnblock = async () => {
    try {
      const res = await fetch('/api/chat/block', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ blockerId: currentUser.id, blockedId: otherUser.id }),
      });
      if (!res.ok) throw new Error('Failed to unblock');
      setYouBlockedThem(false);
      setMenuOpen(false);
      toast({ title: `Unblocked ${displayName(otherUser)}` });
    } catch (err) {
      toast({ title: 'Could not unblock', variant: 'destructive' });
    }
  };

  // ─── Submit a report ─────────────────────────────────────────────
  const handleReport = async (reason: string, details: string) => {
    try {
      const res = await fetch('/api/chat/reports', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reporterId: currentUser.id,
          reportedId: otherUser.id,
          threadId,
          reason,
          details: details.trim() || undefined,
        }),
      });
      const data = await safeJson<any>(res, {});
      if (!res.ok) {
        throw new Error(data.error || 'Failed to submit report');
      }
      setShowReportModal(false);
      setMenuOpen(false);
      toast({
        title: 'Report submitted',
        description: 'Our admin team will review this shortly. Thank you for helping keep Kabaddi Pro safe.',
      });
    } catch (err) {
      toast({
        title: 'Could not submit report',
        description: err instanceof Error ? err.message : undefined,
        variant: 'destructive',
      });
    }
  };

  // ─── Unsend (delete) a message ───────────────────────────────────
  // Only the SENDER can unsend their own message. We call DELETE
  // /api/chat/messages/:id which soft-deletes on the backend (sets
  // deletedAt + clears content). The recipient's poller picks up the
  // updated row on the next poll (every 8s) and the UI swaps the bubble
  // for a "This message was deleted" placeholder — matches WhatsApp.
  //
  // We optimistically update the local messages array so the sender sees
  // instant feedback; if the API call fails, we roll back.
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [confirmDeleteMsg, setConfirmDeleteMsg] = useState<ChatMessage | null>(null);

  const handleDeleteMessage = useCallback(async (msg: ChatMessage) => {
    // Optimistic update — mark as deleted locally right away.
    const snapshot = messagesRef.current;
    setMessages((prev) => prev.map((m) =>
      m.id === msg.id ? { ...m, deletedAt: new Date().toISOString(), content: '' } : m
    ));
    setPendingDeleteId(msg.id);
    setConfirmDeleteMsg(null);
    try {
      const res = await fetch(`/api/chat/messages/${encodeURIComponent(msg.id)}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: currentUser.id }),
      });
      const data = await safeJson<any>(res, {});
      if (!res.ok) {
        throw new Error(data.error || 'Could not delete message');
      }
      // The backend returns the canonical updated row — replace our
      // optimistic version with the server's so timestamps match.
      if (data?.message) {
        setMessages((prev) => prev.map((m) =>
          m.id === msg.id ? { ...m, ...data.message } : m
        ));
      }
      toast({ title: 'Message deleted' });
    } catch (err) {
      // Roll back to the snapshot — restore original content + clear deletedAt.
      setMessages(snapshot);
      toast({
        title: 'Could not delete message',
        description: err instanceof Error ? err.message : undefined,
        variant: 'destructive',
      });
    } finally {
      setPendingDeleteId(null);
    }
  }, [currentUser.id, toast]);

  // ─── Long-press detection for own messages ───────────────────────
  // We use a long-press (500ms) on touch devices and right-click on
  // desktop to open the delete confirmation. This matches WhatsApp's
  // "long-press to select" UX. We only show the delete option for
  // messages the current user sent AND that aren't already deleted.
  const longPressTimerRef = useRef<number | null>(null);

  const startLongPress = useCallback((msg: ChatMessage) => {
    if (longPressTimerRef.current !== null) {
      window.clearTimeout(longPressTimerRef.current);
    }
    longPressTimerRef.current = window.setTimeout(() => {
      setConfirmDeleteMsg(msg);
    }, 500);
  }, []);

  const cancelLongPress = useCallback(() => {
    if (longPressTimerRef.current !== null) {
      window.clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  }, []);

  useEffect(() => {
    return () => {
      if (longPressTimerRef.current !== null) {
        window.clearTimeout(longPressTimerRef.current);
      }
    };
  }, []);

  // ═══════════════════════════════════════════════════════════════════════
  // RENDER
  // ═══════════════════════════════════════════════════════════════════════

  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 20 }}
      className="max-w-lg mx-auto pb-24 h-screen flex flex-col"
    >
      {/* ─── Header ─── */}
      <header className="sticky top-0 z-10 bg-warm-50/95 dark:bg-warm-900/95 backdrop-blur-md border-b border-warm-200/60 dark:border-warm-700/60">
        <div className="px-3 py-2.5 flex items-center gap-2">
          <button
            onClick={onBack}
            aria-label="Back"
            className="w-9 h-9 rounded-full hover:bg-warm-100 dark:hover:bg-warm-800 flex items-center justify-center text-warm-600 dark:text-warm-300 transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>

          <Avatar className="w-9 h-9 border border-warm-200 dark:border-warm-700">
            {otherUser.avatar ? <AvatarImage src={otherUser.avatar} /> : null}
            <AvatarFallback className="bg-brand-red/10 text-brand-red text-xs font-bold">
              {initials(displayName(otherUser))}
            </AvatarFallback>
          </Avatar>

          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold text-warm-800 dark:text-warm-100 truncate flex items-center gap-1">
              {displayName(otherUser)}
              {otherUser.isPremium && (
                <span className="text-[9px] text-brand-gold font-bold">PRO</span>
              )}
            </p>
            <p className="text-[10px] text-warm-500 dark:text-warm-400">
              {otherUser.playerCode || 'Kabaddi Player'}
            </p>
          </div>

          {/* ─── Overflow menu ─── */}
          <div className="relative">
            <button
              onClick={() => setMenuOpen(!menuOpen)}
              aria-label="More options"
              className="w-9 h-9 rounded-full hover:bg-warm-100 dark:hover:bg-warm-800 flex items-center justify-center text-warm-600 dark:text-warm-300 transition-colors"
            >
              <MoreVertical className="w-5 h-5" />
            </button>
            <AnimatePresence>
              {menuOpen && (
                <>
                  <div
                    className="fixed inset-0 z-20"
                    onClick={() => setMenuOpen(false)}
                  />
                  <motion.div
                    initial={{ opacity: 0, y: -4, scale: 0.97 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -4, scale: 0.97 }}
                    className="absolute right-0 top-11 z-30 w-52 rounded-xl bg-white dark:bg-warm-800 border border-warm-200 dark:border-warm-700 shadow-xl overflow-hidden"
                  >
                    <button
                      onClick={() => { setShowReportModal(true); setMenuOpen(false); }}
                      className="w-full flex items-center gap-2 px-3 py-2.5 text-sm text-left hover:bg-warm-100 dark:hover:bg-warm-700/50 transition-colors text-warm-700 dark:text-warm-200"
                    >
                      <Flag className="w-4 h-4 text-brand-red" />
                      Report user
                    </button>
                    {youBlockedThem ? (
                      <button
                        onClick={handleUnblock}
                        className="w-full flex items-center gap-2 px-3 py-2.5 text-sm text-left hover:bg-warm-100 dark:hover:bg-warm-700/50 transition-colors text-warm-700 dark:text-warm-200 border-t border-warm-200/60 dark:border-warm-700/60"
                      >
                        <UserX className="w-4 h-4 text-warm-500" />
                        Unblock user
                      </button>
                    ) : (
                      <button
                        onClick={() => { setShowBlockConfirm(true); setMenuOpen(false); }}
                        className="w-full flex items-center gap-2 px-3 py-2.5 text-sm text-left hover:bg-warm-100 dark:hover:bg-warm-700/50 transition-colors text-warm-700 dark:text-warm-200 border-t border-warm-200/60 dark:border-warm-700/60"
                      >
                        <Ban className="w-4 h-4 text-brand-red" />
                        Block user
                      </button>
                    )}
                  </motion.div>
                </>
              )}
            </AnimatePresence>
          </div>
        </div>
      </header>

      {/* ─── Block banner (if either side is blocked) ─── */}
      {(youBlockedThem || theyBlockedYou) && (
        <div className={`px-4 py-2 text-xs text-center border-b ${
          youBlockedThem
            ? 'bg-warm-100 dark:bg-warm-800 text-warm-600 dark:text-warm-300 border-warm-200 dark:border-warm-700'
            : 'bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-800/40'
        }`}>
          {youBlockedThem
            ? `You blocked ${displayName(otherUser)}. Unblock to send messages.`
            : 'You cannot reply to this conversation.'}
        </div>
      )}

      {/* ─── Messages ─── */}
      <div
        ref={scrollRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto px-3 py-4 space-y-2"
      >
        {/* Load-more button */}
        {hasMore && !loading && (
          <div className="flex justify-center pb-2">
            <button
              onClick={() => fetchMessages('more')}
              disabled={loadingMore}
              className="text-[11px] font-semibold text-brand-red hover:underline disabled:opacity-50 flex items-center gap-1"
            >
              {loadingMore && <Loader2 className="w-3 h-3 animate-spin" />}
              Load older messages
            </button>
          </div>
        )}

        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className={`flex ${i % 2 === 0 ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[70%] h-10 rounded-2xl bg-warm-100 dark:bg-warm-800 animate-pulse ${
                  i % 2 === 0 ? 'rounded-br-md' : 'rounded-bl-md'
                }`} style={{ width: `${30 + (i * 12) % 40 }%` }} />
              </div>
            ))}
          </div>
        ) : messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="w-16 h-16 rounded-full bg-warm-100 dark:bg-warm-800 flex items-center justify-center mb-3">
              <MessageCircle className="w-8 h-8 text-warm-300" />
            </div>
            <p className="text-sm font-semibold text-warm-700 dark:text-warm-200">No messages yet</p>
            <p className="text-xs text-warm-500 dark:text-warm-400 mt-1">
              Say hi to {displayName(otherUser)} 👋
            </p>
          </div>
        ) : (
          messages.map((m, idx) => {
            const isMe = m.senderId === currentUser.id;
            const showAvatar = !isMe && (idx === 0 || messages[idx - 1].senderId !== m.senderId);
            const isDeleted = m.deletedAt !== null;
            const isPendingDelete = pendingDeleteId === m.id;
            // Read receipt state — matches WhatsApp's two-tier indicator:
            //   ✓ (single grey tick)  = sent / delivered
            //   ✓✓ (double blue tick)  = read by recipient
            // We use color + count to make the difference scannable at a
            // glance. The recipient's GET /messages route flips isRead to
            // true on the next poll after they open the thread.
            const readByRecipient = Boolean(m.isRead);
            // Long-press + right-click only on the sender's own NON-deleted
            // messages. Recipients cannot delete (no "delete for me" yet —
            // matches WhatsApp's "delete for everyone" only).
            const canDelete = isMe && !isDeleted;
            return (
              <div
                key={m.id}
                className={`flex items-end gap-1.5 ${isMe ? 'justify-end' : 'justify-start'} ${canDelete ? 'cursor-pointer select-none' : ''}`}
                onTouchStart={() => canDelete && startLongPress(m)}
                onTouchEnd={cancelLongPress}
                onTouchMove={cancelLongPress}
                onTouchCancel={cancelLongPress}
                onContextMenu={(e) => {
                  if (!canDelete) return;
                  e.preventDefault();
                  setConfirmDeleteMsg(m);
                }}
              >
                {!isMe && (
                  <div className="w-6 shrink-0">
                    {showAvatar && (
                      <Avatar className="w-6 h-6 border border-warm-200 dark:border-warm-700">
                        {otherUser.avatar ? <AvatarImage src={otherUser.avatar} /> : null}
                        <AvatarFallback className="bg-brand-red/10 text-brand-red text-[8px] font-bold">
                          {initials(displayName(otherUser))}
                        </AvatarFallback>
                      </Avatar>
                    )}
                  </div>
                )}
                <div
                  className={`max-w-[78%] px-3 py-2 text-sm shadow-sm ${
                    isDeleted
                      ? (isMe
                          ? 'bg-brand-red/10 dark:bg-brand-red/20 text-warm-500 dark:text-warm-400 italic rounded-2xl rounded-br-md border border-brand-red/20'
                          : 'bg-warm-100 dark:bg-warm-800/60 text-warm-500 dark:text-warm-400 italic rounded-2xl rounded-bl-md border border-warm-200/60 dark:border-warm-700/60')
                      : (isMe
                          ? 'bg-gradient-to-br from-brand-red to-brand-red-dark text-white rounded-2xl rounded-br-md'
                          : 'bg-white dark:bg-warm-800 text-warm-800 dark:text-warm-100 rounded-2xl rounded-bl-md border border-warm-200/60 dark:border-warm-700/60')
                  }`}
                >
                  {isDeleted ? (
                    <p className="whitespace-pre-wrap break-words leading-snug flex items-center gap-1.5">
                      <Ban className="w-3 h-3 shrink-0 opacity-70" />
                      <span>This message was deleted</span>
                    </p>
                  ) : (
                    <p className="whitespace-pre-wrap break-words leading-snug">{m.content}</p>
                  )}
                  <div className={`flex items-center gap-1 mt-0.5 ${isMe ? 'justify-end' : 'justify-start'}`}>
                    <span className={`text-[9px] ${isMe ? 'text-white/70' : 'text-warm-400'} ${isDeleted ? 'opacity-70' : ''}`}>
                      {formatTime(m.createdAt)}
                    </span>
                    {isMe && (
                      isPendingDelete ? (
                        <Loader2 className="w-2.5 h-2.5 animate-spin text-white/70" />
                      ) : isDeleted ? null : (
                        <span
                          className={`text-[10px] leading-none font-bold ${readByRecipient ? 'text-sky-200' : 'text-white/60'}`}
                          aria-label={readByRecipient ? 'Read' : 'Delivered'}
                          title={readByRecipient ? 'Read' : 'Delivered'}
                        >
                          {readByRecipient ? '✓✓' : '✓'}
                        </span>
                      )
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}

        {error && (
          <div className="text-center py-2">
            <p className="text-[11px] text-brand-red">{error}</p>
          </div>
        )}
      </div>

      {/* ─── Input ─── */}
      <div className="border-t border-warm-200/60 dark:border-warm-700/60 bg-warm-50/95 dark:bg-warm-900/95 backdrop-blur-md p-3">
        {youBlockedThem || theyBlockedYou ? (
          <div className="text-center py-2">
            <p className="text-xs text-warm-500 dark:text-warm-400">
              {youBlockedThem
                ? `You blocked ${displayName(otherUser)}. Unblock to send messages.`
                : 'Messaging is unavailable.'}
            </p>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <input
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSend();
                }
              }}
              placeholder={`Message ${displayName(otherUser)}...`}
              maxLength={2000}
              className="flex-1 px-4 py-2.5 rounded-full bg-white dark:bg-warm-800 border border-warm-200 dark:border-warm-700 text-sm text-warm-800 dark:text-warm-100 placeholder:text-warm-400 focus:outline-none focus:ring-2 focus:ring-brand-red/30"
            />
            <button
              onClick={handleSend}
              disabled={!newMessage.trim() || sending}
              aria-label="Send"
              className="w-10 h-10 rounded-full bg-gradient-to-br from-brand-red to-brand-red-dark text-white flex items-center justify-center shadow-lg shadow-brand-red/30 disabled:opacity-40 disabled:shadow-none transition-all active:scale-95"
            >
              {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            </button>
          </div>
        )}
      </div>

      {/* ─── Report modal ─── */}
      <AnimatePresence>
        {showReportModal && (
          <ReportModal
            otherUser={otherUser}
            onClose={() => setShowReportModal(false)}
            onSubmit={handleReport}
          />
        )}
      </AnimatePresence>

      {/* ─── Block confirm modal ─── */}
      <AnimatePresence>
        {showBlockConfirm && (
          <BlockConfirmModal
            otherUser={otherUser}
            onClose={() => setShowBlockConfirm(false)}
            onConfirm={handleBlock}
          />
        )}
      </AnimatePresence>

      {/* ─── Delete (unsend) confirm modal ─── */}
      <AnimatePresence>
        {confirmDeleteMsg && (
          <DeleteMessageConfirmModal
            message={confirmDeleteMsg}
            onClose={() => setConfirmDeleteMsg(null)}
            onConfirm={() => handleDeleteMessage(confirmDeleteMsg)}
          />
        )}
      </AnimatePresence>
    </motion.div>
  );
}

// ═══════════════════════════════════════════════════════════════════════
// REPORT MODAL — reason picker + details textarea
// ═══════════════════════════════════════════════════════════════════════

const REPORT_REASONS: Array<{ value: string; label: string; icon: typeof Flag; description: string }> = [
  { value: 'spam', label: 'Spam', icon: AlertTriangle, description: 'Repeated unwanted messages or promotions' },
  { value: 'abuse', label: 'Abusive language', icon: AlertTriangle, description: 'Insults, threats, or offensive content' },
  { value: 'harassment', label: 'Harassment', icon: AlertTriangle, description: 'Targeted, repeated unwanted contact' },
  { value: 'inappropriate', label: 'Inappropriate', icon: AlertTriangle, description: 'Sexual, violent, or otherwise inappropriate content' },
  { value: 'other', label: 'Other', icon: AlertTriangle, description: 'Something else — please describe below' },
];

interface ReportModalProps {
  otherUser: PublicUser;
  onClose: () => void;
  onSubmit: (reason: string, details: string) => void;
}

function ReportModal({ otherUser, onClose, onSubmit }: ReportModalProps) {
  const [reason, setReason] = useState('');
  const [details, setDetails] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = () => {
    if (!reason) return;
    setSubmitting(true);
    onSubmit(reason, details);
    // parent closes modal on success
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-end sm:items-center justify-center"
      onClick={onClose}
    >
      <motion.div
        initial={{ y: 40, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 40, opacity: 0 }}
        onClick={(e) => e.stopPropagation()}
        className="w-full sm:max-w-md bg-warm-50 dark:bg-warm-900 rounded-t-3xl sm:rounded-3xl p-5 max-h-[85vh] overflow-y-auto"
      >
        {/* Header */}
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-xl bg-brand-red/10 flex items-center justify-center">
            <Flag className="w-5 h-5 text-brand-red" />
          </div>
          <div>
            <h2 className="text-base font-bold text-warm-800 dark:text-warm-100">Report {displayName(otherUser)}</h2>
            <p className="text-[11px] text-warm-500 dark:text-warm-400">
              Reports are reviewed by our admin team. False reports may result in action against your account.
            </p>
          </div>
        </div>

        {/* Reason picker */}
        <label className="text-[10px] font-bold uppercase text-warm-500 dark:text-warm-400 mb-2 block">
          Reason
        </label>
        <div className="space-y-1.5 mb-4">
          {REPORT_REASONS.map((r) => (
            <button
              key={r.value}
              onClick={() => setReason(r.value)}
              className={`w-full flex items-start gap-3 p-3 rounded-xl text-left transition-colors border ${
                reason === r.value
                  ? 'bg-brand-red/5 dark:bg-brand-red/10 border-brand-red/40'
                  : 'bg-white dark:bg-warm-800 border-warm-200 dark:border-warm-700 hover:border-warm-300'
              }`}
            >
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                reason === r.value ? 'bg-brand-red text-white' : 'bg-warm-100 dark:bg-warm-700 text-warm-500'
              }`}>
                <r.icon className="w-4 h-4" />
              </div>
              <div className="flex-1 min-w-0">
                <p className={`text-sm font-semibold ${
                  reason === r.value ? 'text-brand-red dark:text-brand-red-light' : 'text-warm-800 dark:text-warm-100'
                }`}>{r.label}</p>
                <p className="text-[11px] text-warm-500 dark:text-warm-400">{r.description}</p>
              </div>
              {reason === r.value && (
                <Check className="w-4 h-4 text-brand-red shrink-0 mt-1" />
              )}
            </button>
          ))}
        </div>

        {/* Details */}
        <label className="text-[10px] font-bold uppercase text-warm-500 dark:text-warm-400 mb-2 block">
          Additional details (optional)
        </label>
        <textarea
          value={details}
          onChange={(e) => setDetails(e.target.value)}
          rows={3}
          maxLength={1000}
          placeholder="Tell us more about what happened..."
          className="w-full px-3 py-2 rounded-xl bg-white dark:bg-warm-800 border border-warm-200 dark:border-warm-700 text-sm text-warm-800 dark:text-warm-100 placeholder:text-warm-400 focus:outline-none focus:ring-2 focus:ring-brand-red/30 resize-none"
        />
        <p className="text-[10px] text-warm-400 mt-1 text-right">{details.length}/1000</p>

        {/* Actions */}
        <div className="flex gap-2 mt-4">
          <Button
            onClick={onClose}
            variant="outline"
            className="flex-1"
            disabled={submitting}
          >
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={!reason || submitting}
            className="flex-1 bg-brand-red hover:bg-brand-red-dark text-white"
          >
            {submitting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
            Submit report
          </Button>
        </div>
      </motion.div>
    </motion.div>
  );
}

// ═══════════════════════════════════════════════════════════════════════
// BLOCK CONFIRM MODAL
// ═══════════════════════════════════════════════════════════════════════

interface BlockConfirmModalProps {
  otherUser: PublicUser;
  onClose: () => void;
  onConfirm: () => void;
}

function BlockConfirmModal({ otherUser, onClose, onConfirm }: BlockConfirmModalProps) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-sm bg-warm-50 dark:bg-warm-900 rounded-3xl p-5"
      >
        <div className="w-12 h-12 rounded-2xl bg-brand-red/10 flex items-center justify-center mb-3">
          <Ban className="w-6 h-6 text-brand-red" />
        </div>
        <h2 className="text-base font-bold text-warm-800 dark:text-warm-100">
          Block {displayName(otherUser)}?
        </h2>
        <p className="text-xs text-warm-500 dark:text-warm-400 mt-1.5 leading-relaxed">
          They won't be able to send you messages, and you won't be able to message them.
          You can unblock them anytime from the chat menu.
        </p>
        <div className="flex gap-2 mt-4">
          <Button onClick={onClose} variant="outline" className="flex-1">Cancel</Button>
          <Button
            onClick={onConfirm}
            className="flex-1 bg-brand-red hover:bg-brand-red-dark text-white"
          >
            Block user
          </Button>
        </div>
      </motion.div>
    </motion.div>
  );
}

// ═══════════════════════════════════════════════════════════════════════
// DELETE MESSAGE CONFIRM MODAL
// ═══════════════════════════════════════════════════════════════════════
//
// Shown when the sender long-presses (mobile) or right-clicks (desktop)
// one of their own messages. Asks for confirmation before unsending.
// "Delete for everyone" semantics — the message is soft-deleted on the
// backend and the recipient sees a "This message was deleted" placeholder
// on their next poll. This matches WhatsApp's "Delete for everyone"
// behavior (we don't currently offer a "delete for me only" option).

interface DeleteMessageConfirmModalProps {
  message: ChatMessage;
  onClose: () => void;
  onConfirm: () => void;
}

function DeleteMessageConfirmModal({ message, onClose, onConfirm }: DeleteMessageConfirmModalProps) {
  // Show a short preview of the message being deleted (truncated so the
  // modal stays compact even for long messages).
  const preview = (message.content || '').slice(0, 80);
  const isTruncated = (message.content || '').length > 80;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-sm bg-warm-50 dark:bg-warm-900 rounded-3xl p-5"
      >
        <div className="w-12 h-12 rounded-2xl bg-brand-red/10 flex items-center justify-center mb-3">
          <Trash2 className="w-6 h-6 text-brand-red" />
        </div>
        <h2 className="text-base font-bold text-warm-800 dark:text-warm-100">
          Delete this message?
        </h2>
        <p className="text-xs text-warm-500 dark:text-warm-400 mt-1.5 leading-relaxed">
          This message will be deleted for everyone in this chat. The other
          person will see <span className="italic">"This message was deleted"</span> instead
          of the original text. This action cannot be undone.
        </p>
        {preview && (
          <div className="mt-3 px-3 py-2 rounded-xl bg-warm-100 dark:bg-warm-800/60 border border-warm-200/60 dark:border-warm-700/60">
            <p className="text-xs text-warm-600 dark:text-warm-300 line-clamp-2 break-words">
              &ldquo;{preview}{isTruncated ? '…' : ''}&rdquo;
            </p>
          </div>
        )}
        <div className="flex gap-2 mt-4">
          <Button onClick={onClose} variant="outline" className="flex-1">Cancel</Button>
          <Button
            onClick={onConfirm}
            className="flex-1 bg-brand-red hover:bg-brand-red-dark text-white"
          >
            <Trash2 className="w-3.5 h-3.5 mr-1.5" />
            Delete for everyone
          </Button>
        </div>
      </motion.div>
    </motion.div>
  );
}
