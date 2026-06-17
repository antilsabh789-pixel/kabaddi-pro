'use client';

import { useState, useEffect, useRef, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowLeft,
  Search,
  Send,
  Smile,
  Users,
  Circle,
  Check,
  CheckCheck,
  Plus,
  X,
  Hash,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Card } from '@/components/ui/card';

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

// ─── Mock Data ────────────────────────────────────────────────────

const CURRENT_USER_ID = 'user_1';

const MOCK_MESSAGES: ChatMessage[] = [
  {
    id: 'msg_1',
    senderId: 'system',
    senderName: 'System',
    senderAvatar: null,
    content: 'Rahul Sharma joined the team',
    timestamp: Date.now() - 86400000 * 2 - 3600000 * 5,
    isSystem: true,
    reactions: {},
  },
  {
    id: 'msg_2',
    senderId: 'user_2',
    senderName: 'Rahul Sharma',
    senderAvatar: null,
    content: 'Hey everyone! Excited to be part of the team!',
    timestamp: Date.now() - 86400000 * 2 - 3600000 * 4.5,
    isSystem: false,
    reactions: { '👍': ['user_3', 'user_4'] },
  },
  {
    id: 'msg_3',
    senderId: 'user_3',
    senderName: 'Vikram Singh',
    senderAvatar: null,
    content: 'Welcome aboard Rahul! We have practice tomorrow at 6 AM',
    timestamp: Date.now() - 86400000 * 2 - 3600000 * 4,
    isSystem: false,
    reactions: {},
  },
  {
    id: 'msg_4',
    senderId: 'user_1',
    senderName: 'You',
    senderAvatar: null,
    content: 'Great to have you! Make sure to check the drills section in the app',
    timestamp: Date.now() - 86400000 * 2 - 3600000 * 3.5,
    isSystem: false,
    reactions: { '💪': ['user_2'] },
  },
  {
    id: 'msg_5',
    senderId: 'user_4',
    senderName: 'Amit Patel',
    senderAvatar: null,
    content: 'Coach said we need to work on our chain tackling. Let us focus on that tomorrow.',
    timestamp: Date.now() - 86400000 - 3600000 * 6,
    isSystem: false,
    reactions: { '🔥': ['user_1', 'user_3'] },
  },
  {
    id: 'msg_6',
    senderId: 'user_3',
    senderName: 'Vikram Singh',
    senderAvatar: null,
    content: 'Agreed. Our defense was leaking in the last match. Need to tighten up.',
    timestamp: Date.now() - 86400000 - 3600000 * 5,
    isSystem: false,
    reactions: {},
  },
  {
    id: 'msg_7',
    senderId: 'system',
    senderName: 'System',
    senderAvatar: null,
    content: 'Priya Verma joined the team',
    timestamp: Date.now() - 86400000 - 3600000 * 3,
    isSystem: true,
    reactions: {},
  },
  {
    id: 'msg_8',
    senderId: 'user_5',
    senderName: 'Priya Verma',
    senderAvatar: null,
    content: 'Hello team! Looking forward to playing with everyone!',
    timestamp: Date.now() - 86400000 - 3600000 * 2.5,
    isSystem: false,
    reactions: { '👏': ['user_1', 'user_2', 'user_4'] },
  },
  {
    id: 'msg_9',
    senderId: 'user_2',
    senderName: 'Rahul Sharma',
    senderAvatar: null,
    content: 'Welcome Priya! What position do you play?',
    timestamp: Date.now() - 86400000 - 3600000 * 2,
    isSystem: false,
    reactions: {},
  },
  {
    id: 'msg_10',
    senderId: 'user_5',
    senderName: 'Priya Verma',
    senderAvatar: null,
    content: 'I am an all-rounder, but prefer raiding!',
    timestamp: Date.now() - 86400000 - 3600000 * 1.5,
    isSystem: false,
    reactions: { '🎯': ['user_3'] },
  },
  {
    id: 'msg_11',
    senderId: 'user_1',
    senderName: 'You',
    senderAvatar: null,
    content: 'Perfect timing! We needed another raider. Match this weekend!',
    timestamp: Date.now() - 86400000 - 3600000,
    isSystem: false,
    reactions: {},
  },
  {
    id: 'msg_12',
    senderId: 'user_4',
    senderName: 'Amit Patel',
    senderAvatar: null,
    content: 'Anyone up for extra practice tonight?',
    timestamp: Date.now() - 3600000 * 4,
    isSystem: false,
    reactions: { '💪': ['user_1', 'user_3'] },
  },
  {
    id: 'msg_13',
    senderId: 'user_3',
    senderName: 'Vikram Singh',
    senderAvatar: null,
    content: 'Count me in! Let us meet at the ground at 7 PM',
    timestamp: Date.now() - 3600000 * 3,
    isSystem: false,
    reactions: {},
  },
  {
    id: 'msg_14',
    senderId: 'user_2',
    senderName: 'Rahul Sharma',
    senderAvatar: null,
    content: 'I will be there! Working on my toe touches today',
    timestamp: Date.now() - 3600000 * 2,
    isSystem: false,
    reactions: { '🔥': ['user_4'] },
  },
  {
    id: 'msg_15',
    senderId: 'user_1',
    senderName: 'You',
    senderAvatar: null,
    content: 'Let us do some raid drills too. I want to try the running hand touch',
    timestamp: Date.now() - 3600000,
    isSystem: false,
    reactions: { '👍': ['user_2', 'user_4'] },
  },
  {
    id: 'msg_16',
    senderId: 'user_5',
    senderName: 'Priya Verma',
    senderAvatar: null,
    content: 'Sounds like a plan! See you all at 7',
    timestamp: Date.now() - 1800000,
    isSystem: false,
    reactions: {},
  },
];

const TEAM_INFO = {
  name: 'Bengal Warriors',
  memberCount: 12,
  onlineCount: 5,
  teamColor: '#E11D48',
};

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

// ─── Component ────────────────────────────────────────────────────

export default function TeamChatScreen({ onClose }: TeamChatScreenProps) {
  const [messages, setMessages] = useState<ChatMessage[]>(MOCK_MESSAGES);
  const [inputText, setInputText] = useState('');
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [searchMode, setSearchMode] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [showReactionsFor, setShowReactionsFor] = useState<string | null>(null);
  const [isTyping, setIsTyping] = useState(false);
  const [unreadCount, setUnreadCount] = useState(3);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

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

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Simulate typing indicator
  useEffect(() => {
    const interval = setInterval(() => {
      setIsTyping(true);
      setTimeout(() => setIsTyping(false), 3000);
    }, 15000);
    return () => clearInterval(interval);
  }, []);

  // Clear unread when opening
  useEffect(() => {
    const timer = setTimeout(() => setUnreadCount(0), 2000);
    return () => clearTimeout(timer);
  }, []);

  const handleSend = () => {
    if (!inputText.trim()) return;

    const newMessage: ChatMessage = {
      id: `msg_${Date.now()}`,
      senderId: CURRENT_USER_ID,
      senderName: 'You',
      senderAvatar: null,
      content: inputText.trim(),
      timestamp: Date.now(),
      isSystem: false,
      reactions: {},
    };

    setMessages((prev) => [...prev, newMessage]);
    setInputText('');
    setShowEmojiPicker(false);
    inputRef.current?.focus();
  };

  const handleAddReaction = (messageId: string, emoji: string) => {
    setMessages((prev) =>
      prev.map((msg) => {
        if (msg.id !== messageId) return msg;
        const reactions = { ...msg.reactions };
        if (reactions[emoji]?.includes(CURRENT_USER_ID)) {
          reactions[emoji] = reactions[emoji].filter((id) => id !== CURRENT_USER_ID);
          if (reactions[emoji].length === 0) delete reactions[emoji];
        } else {
          reactions[emoji] = [...(reactions[emoji] || []), CURRENT_USER_ID];
        }
        return { ...msg, reactions };
      })
    );
    setShowReactionsFor(null);
  };

  const handleEmojiInsert = (emoji: string) => {
    setInputText((prev) => prev + emoji);
  };

  const displayGroups = searchMode ? filteredDateGroups : dateGroups;

  return (
    <div className="fixed inset-0 z-50 bg-gray-50 dark:bg-gray-950 flex flex-col overflow-y-auto">
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
              onClick={onClose}
              className="h-9 w-9 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800"
            >
              <ArrowLeft className="h-5 w-5 text-gray-700 dark:text-gray-300" />
            </Button>
            <div className="flex items-center gap-3">
              <div className="relative">
                <div
                  className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-sm"
                  style={{ backgroundColor: TEAM_INFO.teamColor }}
                >
                  BW
                </div>
                <div className="absolute -bottom-0.5 -right-0.5">
                  <Circle className="h-3.5 w-3.5 fill-green-500 text-white" />
                </div>
              </div>
              <div>
                <h2 className="font-semibold text-gray-900 dark:text-white text-sm">
                  {TEAM_INFO.name}
                </h2>
                <div className="flex items-center gap-1.5">
                  <Users className="h-3 w-3 text-gray-500 dark:text-gray-400" />
                  <span className="text-xs text-gray-500 dark:text-gray-400">
                    {TEAM_INFO.memberCount} members
                  </span>
                  <span className="text-xs text-gray-400 dark:text-gray-600 mx-1">|</span>
                  <span className="text-xs text-green-600 dark:text-green-400 font-medium">
                    {TEAM_INFO.onlineCount} online
                  </span>
                </div>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {unreadCount > 0 && (
              <Badge className="bg-red-500 text-white text-xs px-2 py-0.5">
                {unreadCount}
              </Badge>
            )}
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
        {displayGroups.map((group) => (
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
              if (msg.isSystem) {
                return (
                  <motion.div
                    key={msg.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.3 }}
                    className="flex justify-center my-3"
                  >
                    <div className="flex items-center gap-1.5 bg-gray-100 dark:bg-gray-800 rounded-full px-3 py-1">
                      <Hash className="h-3 w-3 text-gray-400" />
                      <span className="text-xs text-gray-500 dark:text-gray-400">
                        {msg.content}
                      </span>
                    </div>
                  </motion.div>
                );
              }

              const isSent = msg.senderId === CURRENT_USER_ID;
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
                        <AvatarFallback
                          className="text-xs font-medium text-white"
                          style={{ backgroundColor: TEAM_INFO.teamColor }}
                        >
                          {getInitials(msg.senderName)}
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
                          {isSent && (
                            <CheckCheck className="h-3 w-3 text-amber-100" />
                          )}
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
                                users.includes(CURRENT_USER_ID)
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
        ))}

        {/* Typing Indicator */}
        <AnimatePresence>
          {isTyping && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 8 }}
              className="flex items-center gap-2 ml-10"
            >
              <Avatar className="h-8 w-8">
                <AvatarFallback
                  className="text-xs font-medium text-white"
                  style={{ backgroundColor: TEAM_INFO.teamColor }}
                >
                  VS
                </AvatarFallback>
              </Avatar>
              <div className="bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-2xl rounded-bl-md px-4 py-2.5">
                <div className="flex items-center gap-1">
                  <motion.span
                    className="h-1.5 w-1.5 rounded-full bg-gray-400 dark:bg-gray-500"
                    animate={{ y: [0, -4, 0] }}
                    transition={{ duration: 0.6, repeat: Infinity, delay: 0 }}
                  />
                  <motion.span
                    className="h-1.5 w-1.5 rounded-full bg-gray-400 dark:bg-gray-500"
                    animate={{ y: [0, -4, 0] }}
                    transition={{ duration: 0.6, repeat: Infinity, delay: 0.15 }}
                  />
                  <motion.span
                    className="h-1.5 w-1.5 rounded-full bg-gray-400 dark:bg-gray-500"
                    animate={{ y: [0, -4, 0] }}
                    transition={{ duration: 0.6, repeat: Infinity, delay: 0.3 }}
                  />
                </div>
              </div>
              <span className="text-xs text-gray-400 dark:text-gray-500">
                Vikram is typing...
              </span>
            </motion.div>
          )}
        </AnimatePresence>

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
            placeholder="Type a message..."
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
