'use client';

import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowLeft,
  Search,
  Send,
  Smile,
  Users,
  Hash,
  X,
  Loader2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useKabaddiStore } from '@/lib/store';
import { useToast } from '@/hooks/use-toast';

// ─── Types ────────────────────────────────────────────────────────

interface TeamChatScreenProps {
  onClose: () => void;
}

interface ChatMessage {
  id: string;
  senderId: string;
  senderName: string;
  senderAvatar: string | null;
  content: string;
  timestamp: number;
  isSystem: boolean;
  reactions: Record<string, string[]>;
}

interface DateGroup {
  label: string;
  messages: ChatMessage[];
}

interface TeamListItem {
  id: string;
  name: string;
  shortName?: string | null;
  color: string;
  logo?: string | null;
  teamCode?: string;
  memberCount: number;
  members: Array<{
    userId: string;
    isCaptain: boolean;
    user: {
      id: string;
      name: string | null;
      avatar: string | null;
    };
  }>;
}

// ─── Constants ────────────────────────────────────────────────────

const QUICK_EMOJIS = ['👍', '🔥', '💪', '👏', '🎯', '❤️', '😂', '🎉'];
const REACTION_EMOJIS = ['👍', '🔥', '❤️', '😂', '😮', '😢', '💪', '👏'];

// ─── Helpers ──────────────────────────────────────────────────────

function formatTime(timestamp: number): string {
  const date = new Date(timestamp);
  const hours = date.getHours();
  const minutes = date.getMinutes();
  const ampm = hours >= 12 ? 'PM' : 'AM';
  const displayHours = hours % 12 || 12;
  return `${displayHours}:${minutes.toString().padStart(2, '0')} ${ampm}`;
}

function getDateLabel(timestamp: number): string {
  const now = new Date();
  const date = new Date(timestamp);
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const messageDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const diffDays = Math.floor((today.getTime() - messageDate.getTime()) / 86400000);

  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function groupMessagesByDate(messages: ChatMessage[]): DateGroup[] {
  const groups: DateGroup[] = [];
  let currentLabel = '';
  let currentMessages: ChatMessage[] = [];

  for (const msg of messages) {
    const label = getDateLabel(msg.timestamp);
    if (label !== currentLabel) {
      if (currentMessages.length > 0) {
        groups.push({ label: currentLabel, messages: currentMessages });
      }
      currentLabel = label;
      currentMessages = [];
    }
    currentMessages.push(msg);
  }

  if (currentMessages.length > 0) {
    groups.push({ label: currentLabel, messages: currentMessages });
  }

  return groups;
}

function getInitials(name: string): string {
  return name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

function getTeamInitials(name: string): string {
  return name
    .split(/\s+/)
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

// ─── Component ────────────────────────────────────────────────────

export default function TeamChatScreen({ onClose }: TeamChatScreenProps) {
  const currentUser = useKabaddiStore((s) => s.currentUser);
  const { toast } = useToast();

  // Team list state
  const [teams, setTeams] = useState<TeamListItem[]>([]);
  const [teamsLoading, setTeamsLoading] = useState(true);
  const [teamSearchQuery, setTeamSearchQuery] = useState('');

  // Currently selected team (null = show team list, non-null = show chat)
  const [selectedTeam, setSelectedTeam] = useState<TeamListItem | null>(null);

  // Per-team in-memory messages. NOTE: there is no chat backend yet — messages
  // persist only for the lifetime of this screen session. A future iteration
  // should add a TeamMessage model + /api/teams/:id/messages routes.
  const [messagesByTeam, setMessagesByTeam] = useState<Record<string, ChatMessage[]>>({});

  // Chat UI state
  const [inputText, setInputText] = useState('');
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [searchMode, setSearchMode] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [showReactionsFor, setShowReactionsFor] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const messages = selectedTeam ? (messagesByTeam[selectedTeam.id] || []) : [];
  const dateGroups = useMemo(() => groupMessagesByDate(messages), [messages]);

  const filteredMessages = useMemo(() => {
    if (!searchQuery.trim()) return messages;
    const q = searchQuery.toLowerCase();
    return messages.filter(
      (m) =>
        m.content.toLowerCase().includes(q) ||
        m.senderName.toLowerCase().includes(q)
    );
  }, [messages, searchQuery]);

  const filteredDateGroups = useMemo(
    () => groupMessagesByDate(filteredMessages),
    [filteredMessages]
  );

  // ─── Fetch the user's teams (only teams they're a member of) ───────
  const fetchTeams = useCallback(async () => {
    if (!currentUser?.id) {
      setTeamsLoading(false);
      return;
    }
    setTeamsLoading(true);
    try {
      const res = await fetch(`/api/teams?filter=my&userId=${currentUser.id}`);
      if (!res.ok) throw new Error('Failed to fetch teams');
      const data = await res.json();
      const rawTeams: any[] = data.teams || [];
      const mapped: TeamListItem[] = rawTeams.map((t: any) => ({
        id: t.id,
        name: t.name || 'Unnamed Team',
        shortName: t.shortName || null,
        color: t.color || '#DC2626',
        logo: t.logo || null,
        teamCode: t.teamCode || null,
        memberCount: t._count?.members ?? t.members?.length ?? 0,
        members: (t.members || []).map((m: any) => ({
          userId: m.userId,
          isCaptain: !!m.isCaptain,
          user: {
            id: m.user?.id || m.userId,
            name: m.user?.name || null,
            avatar: m.user?.avatar || null,
          },
        })),
      }));
      setTeams(mapped);
    } catch (err) {
      console.error('Fetch teams error:', err);
      toast({ title: 'Failed to load teams', variant: 'destructive' });
    } finally {
      setTeamsLoading(false);
    }
  }, [currentUser?.id, toast]);

  useEffect(() => {
    fetchTeams();
  }, [fetchTeams]);

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    if (selectedTeam) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, selectedTeam]);

  // ─── Filtered team list (by name search) ───────────────────────────
  const filteredTeams = useMemo(() => {
    if (!teamSearchQuery.trim()) return teams;
    const q = teamSearchQuery.toLowerCase();
    return teams.filter(
      (t) =>
        t.name.toLowerCase().includes(q) ||
        (t.shortName || '').toLowerCase().includes(q) ||
        (t.teamCode || '').toLowerCase().includes(q)
    );
  }, [teams, teamSearchQuery]);

  // ─── Send a message to the currently selected team ─────────────────
  const handleSend = () => {
    if (!inputText.trim() || !selectedTeam || !currentUser?.id) return;

    const newMessage: ChatMessage = {
      id: `msg_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      senderId: currentUser.id,
      senderName: currentUser.name || 'You',
      senderAvatar: currentUser.avatar || null,
      content: inputText.trim(),
      timestamp: Date.now(),
      isSystem: false,
      reactions: {},
    };

    setMessagesByTeam((prev) => ({
      ...prev,
      [selectedTeam.id]: [...(prev[selectedTeam.id] || []), newMessage],
    }));
    setInputText('');
    setShowEmojiPicker(false);
    inputRef.current?.focus();
  };

  const handleAddReaction = (messageId: string, emoji: string) => {
    if (!selectedTeam || !currentUser?.id) return;
    setMessagesByTeam((prev) => {
      const teamMsgs = prev[selectedTeam.id] || [];
      return {
        ...prev,
        [selectedTeam.id]: teamMsgs.map((msg) => {
          if (msg.id !== messageId) return msg;
          const reactions = { ...msg.reactions };
          if (reactions[emoji]?.includes(currentUser.id)) {
            reactions[emoji] = reactions[emoji].filter((id) => id !== currentUser.id);
            if (reactions[emoji].length === 0) delete reactions[emoji];
          } else {
            reactions[emoji] = [...(reactions[emoji] || []), currentUser.id];
          }
          return { ...msg, reactions };
        }),
      };
    });
    setShowReactionsFor(null);
  };

  const handleEmojiInsert = (emoji: string) => {
    setInputText((prev) => prev + emoji);
  };

  const displayGroups = searchMode ? filteredDateGroups : dateGroups;

  // ════════════════════════════════════════════════════════════════
  // VIEW 1: TEAM LIST (no team selected)
  // ════════════════════════════════════════════════════════════════
  if (!selectedTeam) {
    return (
      <div className="fixed inset-0 z-50 bg-gray-50 dark:bg-gray-950 flex flex-col overflow-hidden">
        {/* Header */}
        <motion.div
          initial={{ y: -20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          className="sticky top-0 z-30 backdrop-blur-xl bg-white/80 dark:bg-gray-900/80 border-b border-gray-200 dark:border-gray-800"
        >
          <div className="flex items-center justify-between px-4 py-3">
            <div className="flex items-center gap-3">
              <Button
                variant="ghost"
                size="icon"
                onClick={onClose}
                className="h-9 w-9 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800"
              >
                <ArrowLeft className="h-5 w-5 text-gray-700 dark:text-gray-300" />
              </Button>
              <div className="flex items-center gap-2">
                <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-amber-500 to-amber-600 flex items-center justify-center shadow-md shadow-amber-500/20">
                  <Users className="h-5 w-5 text-white" />
                </div>
                <div>
                  <h2 className="font-semibold text-gray-900 dark:text-white text-sm">
                    Team Chats
                  </h2>
                  <p className="text-[11px] text-gray-500 dark:text-gray-400">
                    {teams.length} {teams.length === 1 ? 'team' : 'teams'} you're in
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Search bar */}
          <div className="px-4 pb-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                value={teamSearchQuery}
                onChange={(e) => setTeamSearchQuery(e.target.value)}
                placeholder="Search your teams..."
                className="pl-9 h-10 bg-gray-100 dark:bg-gray-800 border-0 text-sm rounded-full"
              />
              {teamSearchQuery && (
                <button
                  onClick={() => setTeamSearchQuery('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
          </div>
        </motion.div>

        {/* Team list */}
        <div className="flex-1 overflow-y-auto px-3 py-3">
          {teamsLoading ? (
            <div className="flex flex-col items-center justify-center py-16 gap-3">
              <Loader2 className="h-7 w-7 animate-spin text-amber-500" />
              <p className="text-sm text-gray-500 dark:text-gray-400">Loading your teams...</p>
            </div>
          ) : filteredTeams.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
              <div className="w-20 h-20 rounded-2xl bg-gray-100 dark:bg-gray-800 flex items-center justify-center mb-4">
                <Users className="h-10 w-10 text-gray-400" />
              </div>
              {teams.length === 0 ? (
                <>
                  <p className="text-base font-bold text-gray-700 dark:text-gray-200 mb-1">
                    No Teams Yet
                  </p>
                  <p className="text-sm text-gray-500 dark:text-gray-400 max-w-[280px] leading-relaxed">
                    You haven't joined any teams. Create a team or ask your captain for the team code to start chatting with teammates.
                  </p>
                </>
              ) : (
                <>
                  <p className="text-base font-bold text-gray-700 dark:text-gray-200 mb-1">
                    No teams match "{teamSearchQuery}"
                  </p>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    Try a different search term.
                  </p>
                </>
              )}
            </div>
          ) : (
            <div className="space-y-2 max-w-md mx-auto">
              {filteredTeams.map((team, index) => {
                const teamMsgs = messagesByTeam[team.id] || [];
                const lastMsg = teamMsgs[teamMsgs.length - 1];
                return (
                  <motion.button
                    key={team.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.03, duration: 0.2 }}
                    onClick={() => {
                      setSelectedTeam(team);
                      setSearchMode(false);
                      setSearchQuery('');
                    }}
                    className="w-full flex items-center gap-3 p-3 rounded-2xl bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 hover:border-amber-300 dark:hover:border-amber-700 hover:shadow-md transition-all text-left group"
                  >
                    {/* Team logo / initials */}
                    <div
                      className="w-12 h-12 rounded-xl flex items-center justify-center text-white font-bold text-sm shrink-0 shadow-sm"
                      style={{ backgroundColor: team.color }}
                    >
                      {team.logo ? (
                        <img src={team.logo} alt={team.name} className="w-full h-full object-cover rounded-xl" />
                      ) : (
                        getTeamInitials(team.name)
                      )}
                    </div>

                    {/* Team info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <p className="font-semibold text-gray-900 dark:text-white text-sm truncate group-hover:text-amber-600 dark:group-hover:text-amber-400 transition-colors">
                          {team.name}
                        </p>
                        {lastMsg && (
                          <span className="text-[10px] text-gray-400 dark:text-gray-500 shrink-0">
                            {formatTime(lastMsg.timestamp)}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center justify-between gap-2 mt-0.5">
                        <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                          {lastMsg ? (
                            <>
                              {lastMsg.senderId === currentUser?.id ? 'You: ' : `${lastMsg.senderName.split(' ')[0]}: `}
                              {lastMsg.content}
                            </>
                          ) : (
                            <span className="flex items-center gap-1">
                              <Users className="h-3 w-3" />
                              {team.memberCount} {team.memberCount === 1 ? 'member' : 'members'}
                            </span>
                          )}
                        </p>
                        {teamMsgs.length > 0 && (
                          <span className="text-[10px] text-amber-600 dark:text-amber-400 font-bold shrink-0">
                            {teamMsgs.length} {teamMsgs.length === 1 ? 'msg' : 'msgs'}
                          </span>
                        )}
                      </div>
                    </div>
                  </motion.button>
                );
              })}
            </div>
          )}
        </div>
      </div>
    );
  }

  // ════════════════════════════════════════════════════════════════
  // VIEW 2: CHAT (team selected)
  // ════════════════════════════════════════════════════════════════
  return (
    <div className="fixed inset-0 z-50 bg-gray-50 dark:bg-gray-950 flex flex-col overflow-hidden">
      {/* ─── Header ─────────────────────────────────────────────── */}
      <motion.div
        initial={{ y: -20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        className="sticky top-0 z-30 backdrop-blur-xl bg-white/80 dark:bg-gray-900/80 border-b border-gray-200 dark:border-gray-800"
      >
        <div className="flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => {
                setSelectedTeam(null);
                setInputText('');
                setShowEmojiPicker(false);
                setSearchMode(false);
                setSearchQuery('');
              }}
              className="h-9 w-9 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800"
            >
              <ArrowLeft className="h-5 w-5 text-gray-700 dark:text-gray-300" />
            </Button>
            <div className="flex items-center gap-3">
              <div
                className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-sm shrink-0"
                style={{ backgroundColor: selectedTeam.color }}
              >
                {selectedTeam.logo ? (
                  <img src={selectedTeam.logo} alt={selectedTeam.name} className="w-full h-full object-cover rounded-full" />
                ) : (
                  getTeamInitials(selectedTeam.name)
                )}
              </div>
              <div>
                <h2 className="font-semibold text-gray-900 dark:text-white text-sm">
                  {selectedTeam.name}
                </h2>
                <div className="flex items-center gap-1.5">
                  <Users className="h-3 w-3 text-gray-500 dark:text-gray-400" />
                  <span className="text-xs text-gray-500 dark:text-gray-400">
                    {selectedTeam.memberCount} {selectedTeam.memberCount === 1 ? 'member' : 'members'}
                  </span>
                </div>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => {
                setSearchMode(!searchMode);
                setSearchQuery('');
              }}
              className="h-9 w-9 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800"
            >
              {searchMode ? (
                <X className="h-5 w-5 text-gray-700 dark:text-gray-300" />
              ) : (
                <Search className="h-5 w-5 text-gray-700 dark:text-gray-300" />
              )}
            </Button>
          </div>
        </div>

        {/* Search Bar */}
        <AnimatePresence>
          {searchMode && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden px-4 pb-3"
            >
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search messages..."
                  className="pl-9 h-9 bg-gray-100 dark:bg-gray-800 border-0 text-sm"
                />
              </div>
              {searchQuery && (
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1.5">
                  {filteredMessages.length} message{filteredMessages.length !== 1 ? 's' : ''} found
                </p>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>

      {/* ─── Messages ───────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-1 custom-scrollbar">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
            <div className="w-16 h-16 rounded-2xl bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center mb-4">
              <Hash className="h-8 w-8 text-amber-500" />
            </div>
            <p className="text-sm font-bold text-gray-700 dark:text-gray-200 mb-1">
              No messages yet
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-400 max-w-[260px] leading-relaxed">
              Send the first message to {selectedTeam.name}. Say hi to your teammates! 👋
            </p>
          </div>
        ) : (
          displayGroups.map((group) => (
            <div key={group.label}>
              {/* Date Separator */}
              <div className="flex items-center justify-center my-4">
                <div className="flex-1 h-px bg-gray-200 dark:bg-gray-800" />
                <span className="px-3 text-xs font-medium text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-950">
                  {group.label}
                </span>
                <div className="flex-1 h-px bg-gray-200 dark:bg-gray-800" />
              </div>

              {/* Messages in group */}
              {group.messages.map((msg, index) => {
                const isSent = msg.senderId === currentUser?.id;
                const showAvatar =
                  index === 0 || group.messages[index - 1]?.senderId !== msg.senderId;

                return (
                  <motion.div
                    key={msg.id}
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.25, delay: 0.02 }}
                    className={`flex ${isSent ? 'justify-end' : 'justify-start'} mb-1 relative`}
                  >
                    <div
                      className={`flex gap-2 max-w-[80%] ${
                        isSent ? 'flex-row-reverse' : 'flex-row'
                      }`}
                    >
                      {/* Avatar */}
                      {showAvatar && !isSent ? (
                        <Avatar className="h-8 w-8 mt-1 flex-shrink-0">
                          {msg.senderAvatar && (
                            <AvatarImage src={msg.senderAvatar} alt={msg.senderName} />
                          )}
                          <AvatarFallback
                            className="text-xs font-medium text-white"
                            style={{ backgroundColor: selectedTeam.color }}
                          >
                            {getInitials(msg.senderName || '?')}
                          </AvatarFallback>
                        </Avatar>
                      ) : !isSent ? (
                        <div className="w-8 flex-shrink-0" />
                      ) : null}

                      {/* Message Bubble */}
                      <div className="flex flex-col">
                        {showAvatar && !isSent && (
                          <span className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-0.5 ml-1">
                            {msg.senderName}
                          </span>
                        )}

                        <div
                          className={`relative group rounded-2xl px-3.5 py-2 ${
                            isSent
                              ? 'bg-gradient-to-br from-amber-500 to-amber-600 text-white rounded-br-md'
                              : 'bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 border border-gray-100 dark:border-gray-700 rounded-bl-md'
                          }`}
                          onClick={() =>
                            setShowReactionsFor(
                              showReactionsFor === msg.id ? null : msg.id
                            )
                          }
                        >
                          <p className="text-sm leading-relaxed break-words">
                            {msg.content}
                          </p>
                          <div
                            className={`flex items-center gap-1 mt-1 ${
                              isSent ? 'justify-end' : 'justify-start'
                            }`}
                          >
                            <span
                              className={`text-[10px] ${
                                isSent
                                  ? 'text-amber-100'
                                  : 'text-gray-400 dark:text-gray-500'
                              }`}
                            >
                              {formatTime(msg.timestamp)}
                            </span>
                          </div>
                        </div>

                        {/* Reactions Display */}
                        {Object.keys(msg.reactions).length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-1 ml-1">
                            {Object.entries(msg.reactions).map(([emoji, users]) => (
                              <button
                                key={emoji}
                                onClick={() => handleAddReaction(msg.id, emoji)}
                                className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-xs border transition-colors ${
                                  currentUser?.id && users.includes(currentUser.id)
                                    ? 'bg-amber-50 dark:bg-amber-900/30 border-amber-300 dark:border-amber-700'
                                    : 'bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-700'
                                }`}
                              >
                                <span>{emoji}</span>
                                <span className="text-gray-600 dark:text-gray-400">
                                  {users.length}
                                </span>
                              </button>
                            ))}
                          </div>
                        )}

                        {/* Reaction Picker */}
                        <AnimatePresence>
                          {showReactionsFor === msg.id && (
                            <motion.div
                              initial={{ opacity: 0, scale: 0.8, y: -5 }}
                              animate={{ opacity: 1, scale: 1, y: 0 }}
                              exit={{ opacity: 0, scale: 0.8, y: -5 }}
                              transition={{ duration: 0.15 }}
                              className={`flex gap-0.5 mt-1 p-1 bg-white dark:bg-gray-800 rounded-full shadow-lg border border-gray-200 dark:border-gray-700 ${
                                isSent ? 'justify-end' : 'justify-start'
                              }`}
                            >
                              {REACTION_EMOJIS.map((emoji) => (
                                <button
                                  key={emoji}
                                  onClick={() => handleAddReaction(msg.id, emoji)}
                                  className="h-7 w-7 flex items-center justify-center rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors text-sm"
                                >
                                  {emoji}
                                </button>
                              ))}
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          ))
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* ─── Emoji Picker ───────────────────────────────────────── */}
      <AnimatePresence>
        {showEmojiPicker && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden border-t border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900"
          >
            <div className="flex flex-wrap gap-1 p-3 justify-center">
              {QUICK_EMOJIS.map((emoji) => (
                <button
                  key={emoji}
                  onClick={() => handleEmojiInsert(emoji)}
                  className="h-10 w-10 flex items-center justify-center rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors text-xl"
                >
                  {emoji}
                </button>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ─── Message Input ──────────────────────────────────────── */}
      <div className="sticky bottom-0 bg-white dark:bg-gray-900 border-t border-gray-200 dark:border-gray-800 px-4 py-3">
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setShowEmojiPicker(!showEmojiPicker)}
            className="h-9 w-9 rounded-full flex-shrink-0 hover:bg-gray-100 dark:hover:bg-gray-800"
          >
            <Smile
              className={`h-5 w-5 transition-colors ${
                showEmojiPicker
                  ? 'text-amber-500'
                  : 'text-gray-500 dark:text-gray-400'
              }`}
            />
          </Button>

          <Input
            ref={inputRef}
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
            placeholder={`Message ${selectedTeam.name}...`}
            className="flex-1 h-10 bg-gray-100 dark:bg-gray-800 border-0 rounded-full px-4 text-sm"
          />

          <Button
            onClick={handleSend}
            disabled={!inputText.trim()}
            className="h-10 w-10 rounded-full flex-shrink-0 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 disabled:opacity-40 disabled:cursor-not-allowed shadow-lg shadow-amber-500/25"
            size="icon"
          >
            <Send className="h-4 w-4 text-white" />
          </Button>
        </div>
      </div>

      {/* ─── Custom Scrollbar Styles ────────────────────────────── */}
      <style>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: #d1d5db;
          border-radius: 999px;
        }
        .dark .custom-scrollbar::-webkit-scrollbar-thumb {
          background: #374151;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: #9ca3af;
        }
        .dark .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: #4b5563;
        }
      `}</style>
    </div>
  );
}
