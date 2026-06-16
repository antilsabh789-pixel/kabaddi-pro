'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X, Share2, Download, Copy, Check, Shield, Clock,
  Smartphone, AlertTriangle, RefreshCw, QrCode,
  ArrowRightLeft, Users, Zap,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { useKabaddiStore, type ActiveMatch } from '@/lib/store';
import { useToast } from '@/hooks/use-toast';

type TransferTab = 'share' | 'receive';

interface ScorerTransferScreenProps {
  onClose: () => void;
  /** If provided, we're sharing an active match. If not, we're in receive mode. */
  activeMatch?: ActiveMatch | null;
}

export default function ScorerTransferScreen({ onClose, activeMatch }: ScorerTransferScreenProps) {
  const currentUser = useKabaddiStore((s) => s.currentUser);
  const loadMatch = useKabaddiStore((s) => s.loadMatch);
  const { toast } = useToast();

  // Default to 'share' if we have an active match, otherwise 'receive'
  const [tab, setTab] = useState<TransferTab>(activeMatch ? 'share' : 'receive');

  // Share state
  const [transferCode, setTransferCode] = useState<string | null>(null);
  const [codeExpiry, setCodeExpiry] = useState<Date | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [copied, setCopied] = useState(false);
  const [codeTimer, setCodeTimer] = useState<string>('');

  // Receive state
  const [inputCode, setInputCode] = useState('');
  const [isValidating, setIsValidating] = useState(false);
  const [receiveError, setReceiveError] = useState<string | null>(null);
  const [previewMatch, setPreviewMatch] = useState<ActiveMatch | null>(null);
  const [previewScorer, setPreviewScorer] = useState<string | null>(null);
  const [isClaiming, setIsClaiming] = useState(false);

  // Timer for code expiry
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (transferCode && codeExpiry) {
      const updateTimer = () => {
        const now = Date.now();
        const expiry = new Date(codeExpiry).getTime();
        const remaining = expiry - now;
        if (remaining <= 0) {
          setCodeTimer('Expired');
          if (timerRef.current) clearInterval(timerRef.current);
          return;
        }
        const mins = Math.floor(remaining / 60000);
        const secs = Math.floor((remaining % 60000) / 1000);
        setCodeTimer(`${mins}:${secs.toString().padStart(2, '0')}`);
      };
      updateTimer();
      timerRef.current = setInterval(updateTimer, 1000);
      return () => {
        if (timerRef.current) clearInterval(timerRef.current);
      };
    }
  }, [transferCode, codeExpiry]);

  const handleGenerateCode = useCallback(async () => {
    if (!activeMatch) return;
    setIsGenerating(true);
    try {
      const res = await fetch('/api/match-transfer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          matchState: activeMatch,
          scorerUserId: currentUser?.id,
          scorerName: currentUser?.name,
          matchId: activeMatch.id,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast({ title: 'Error', description: data.error || 'Failed to generate code', variant: 'destructive' });
        return;
      }
      setTransferCode(data.transferCode);
      setCodeExpiry(data.expiresAt);
    } catch (err) {
      console.error('Generate code error:', err);
      toast({ title: 'Error', description: 'Failed to generate transfer code', variant: 'destructive' });
    } finally {
      setIsGenerating(false);
    }
  }, [activeMatch, currentUser, toast]);

  const handleCopyCode = useCallback(() => {
    if (!transferCode) return;
    navigator.clipboard.writeText(transferCode).then(() => {
      setCopied(true);
      toast({ title: 'Copied!', description: 'Transfer code copied to clipboard' });
      setTimeout(() => setCopied(false), 2000);
    }).catch(() => {
      // Fallback
      const textArea = document.createElement('textarea');
      textArea.value = transferCode;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }, [transferCode, toast]);

  const handleValidateCode = useCallback(async () => {
    if (!inputCode.trim()) return;
    setIsValidating(true);
    setReceiveError(null);
    setPreviewMatch(null);
    setPreviewScorer(null);

    try {
      const res = await fetch(`/api/match-transfer?code=${inputCode.trim().toUpperCase()}`);
      const data = await res.json();

      if (!res.ok) {
        setReceiveError(data.error || 'Invalid code');
        return;
      }

      setPreviewMatch(data.matchState);
      setPreviewScorer(data.scorerName);
    } catch (err) {
      console.error('Validate code error:', err);
      setReceiveError('Failed to validate code. Please try again.');
    } finally {
      setIsValidating(false);
    }
  }, [inputCode]);

  const handleClaimTransfer = useCallback(async () => {
    if (!previewMatch) return;
    setIsClaiming(true);

    try {
      const res = await fetch('/api/match-transfer', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code: inputCode.trim().toUpperCase(),
          receiverUserId: currentUser?.id,
        }),
      });
      const data = await res.json();

      if (!res.ok) {
        setReceiveError(data.error || 'Failed to claim transfer');
        return;
      }

      // Load the match into the store
      loadMatch(previewMatch);

      toast({
        title: 'Match Transferred! 🎉',
        description: `You can now continue scoring ${previewMatch.homeTeam} vs ${previewMatch.awayTeam}`,
      });

      onClose();
    } catch (err) {
      console.error('Claim transfer error:', err);
      setReceiveError('Failed to claim transfer. Please try again.');
    } finally {
      setIsClaiming(false);
    }
  }, [previewMatch, inputCode, currentUser, loadMatch, toast, onClose]);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 bg-warm-50 dark:bg-warm-800 flex flex-col"
    >
      {/* Header */}
      <header className="sticky top-0 z-10 bg-warm-50/90 dark:bg-warm-800/90 backdrop-blur-md border-b border-warm-200/60 dark:border-warm-600/30">
        <div className="px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-teal-500 to-teal-600 flex items-center justify-center">
              <ArrowRightLeft className="w-4 h-4 text-white" />
            </div>
            <div>
              <h1 className="text-base font-black tracking-wider text-warm-800 dark:text-warm-100">
                HANDOFF SCORER
              </h1>
              <p className="text-[9px] text-warm-400 dark:text-warm-500 font-medium">
                Transfer live scoring to another device
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-warm-200 dark:bg-warm-600 flex items-center justify-center text-warm-600 dark:text-warm-300 hover:bg-warm-300 dark:hover:bg-warm-500 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tab Toggle */}
        <div className="flex gap-2 px-4 pb-3">
          <button
            onClick={() => setTab('share')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-all ${
              tab === 'share'
                ? 'bg-teal-600 text-white shadow-sm'
                : 'bg-warm-100 dark:bg-warm-700 text-warm-600 dark:text-warm-300 hover:bg-warm-200 dark:hover:bg-warm-600'
            }`}
          >
            <Share2 className="w-3 h-3" />
            Share Match
          </button>
          <button
            onClick={() => setTab('receive')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-all ${
              tab === 'receive'
                ? 'bg-teal-600 text-white shadow-sm'
                : 'bg-warm-100 dark:bg-warm-700 text-warm-600 dark:text-warm-300 hover:bg-warm-200 dark:hover:bg-warm-600'
            }`}
          >
            <Download className="w-3 h-3" />
            Receive Match
          </button>
        </div>
      </header>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-4 py-4 custom-scrollbar">
        <AnimatePresence mode="wait">
          {tab === 'share' ? (
            <motion.div
              key="share"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              className="flex flex-col gap-4"
            >
              {/* Info Card */}
              <Card className="bg-gradient-to-br from-teal-50/80 to-warm-50 dark:from-teal-900/20 dark:to-warm-800 border-teal-200/50 dark:border-teal-700/30">
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-xl bg-teal-100 dark:bg-teal-800/40 flex items-center justify-center shrink-0">
                      <Smartphone className="w-5 h-5 text-teal-600 dark:text-teal-400" />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-warm-800 dark:text-warm-100">How it works</h3>
                      <p className="text-xs text-warm-500 dark:text-warm-400 mt-1 leading-relaxed">
                        Generate a transfer code and share it with the new scorer. They enter the code on their phone to continue scoring from exactly where you left off. Works for both tournament and practice matches.
                      </p>
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-2 mt-3">
                    <div className="bg-white/60 dark:bg-warm-700/40 rounded-lg p-2 text-center">
                      <p className="text-lg">1️⃣</p>
                      <p className="text-[9px] text-warm-500 dark:text-warm-400 font-medium">Generate code</p>
                    </div>
                    <div className="bg-white/60 dark:bg-warm-700/40 rounded-lg p-2 text-center">
                      <p className="text-lg">2️⃣</p>
                      <p className="text-[9px] text-warm-500 dark:text-warm-400 font-medium">Share code</p>
                    </div>
                    <div className="bg-white/60 dark:bg-warm-700/40 rounded-lg p-2 text-center">
                      <p className="text-lg">3️⃣</p>
                      <p className="text-[9px] text-warm-500 dark:text-warm-400 font-medium">Continue scoring</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Current Match Info */}
              {activeMatch && (
                <Card className="bg-warm-100/60 dark:bg-warm-700/40 border-warm-200 dark:border-warm-600/30">
                  <CardContent className="p-4">
                    <div className="flex items-center gap-2 mb-3">
                      <Zap className="w-4 h-4 text-brand-red" />
                      <span className="text-xs font-bold text-warm-700 dark:text-warm-200">Current Live Match</span>
                      <Badge className="bg-red-500 text-white text-[8px] border-0 animate-pulse">LIVE</Badge>
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div
                          className="w-8 h-8 rounded-full flex items-center justify-center text-white text-[10px] font-bold"
                          style={{ backgroundColor: activeMatch.homeTeamColor || '#DC2626' }}
                        >
                          {(activeMatch.homeTeam || 'H').slice(0, 2).toUpperCase()}
                        </div>
                        <span className="text-sm font-bold text-warm-800 dark:text-warm-100">{activeMatch.homeTeam}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-lg font-black text-warm-800 dark:text-warm-100">
                          {activeMatch.homeScore} - {activeMatch.awayScore}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-bold text-warm-800 dark:text-warm-100">{activeMatch.awayTeam}</span>
                        <div
                          className="w-8 h-8 rounded-full flex items-center justify-center text-white text-[10px] font-bold"
                          style={{ backgroundColor: activeMatch.awayTeamColor || '#1E293B' }}
                        >
                          {(activeMatch.awayTeam || 'A').slice(0, 2).toUpperCase()}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center justify-center gap-3 mt-2">
                      <Badge variant="outline" className="text-[9px]">
                        H{activeMatch.currentHalf}
                      </Badge>
                      <Badge variant="outline" className="text-[9px]">
                        {activeMatch.isPractice ? 'Practice' : 'Tournament'}
                      </Badge>
                      <Badge variant="outline" className="text-[9px]">
                        {activeMatch.events.length} events
                      </Badge>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Generate Code Section */}
              {!transferCode ? (
                <Button
                  onClick={handleGenerateCode}
                  disabled={isGenerating || !activeMatch}
                  className="w-full bg-gradient-to-r from-teal-600 to-teal-500 hover:from-teal-700 hover:to-teal-600 text-white font-bold rounded-xl py-6 text-sm shadow-lg shadow-teal-500/20"
                >
                  {isGenerating ? (
                    <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <Share2 className="w-4 h-4 mr-2" />
                  )}
                  {isGenerating ? 'Generating...' : 'Generate Transfer Code'}
                </Button>
              ) : (
                <motion.div
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ type: 'spring', damping: 15, stiffness: 200 }}
                >
                  <Card className="bg-gradient-to-br from-teal-50 to-white dark:from-teal-900/30 dark:to-warm-800 border-2 border-teal-300 dark:border-teal-600/50 shadow-lg">
                    <CardContent className="p-5">
                      {/* Success indicator */}
                      <div className="flex items-center gap-2 mb-4">
                        <div className="w-8 h-8 rounded-full bg-teal-100 dark:bg-teal-800/40 flex items-center justify-center">
                          <Check className="w-4 h-4 text-teal-600 dark:text-teal-400" />
                        </div>
                        <div>
                          <p className="text-sm font-bold text-teal-700 dark:text-teal-300">Code Generated!</p>
                          <p className="text-[10px] text-warm-500 dark:text-warm-400">Share this code with the new scorer</p>
                        </div>
                      </div>

                      {/* The Code */}
                      <div className="bg-white dark:bg-warm-700 rounded-2xl p-4 text-center border border-teal-200/50 dark:border-teal-600/30 shadow-inner">
                        <p className="text-[10px] text-warm-400 dark:text-warm-500 font-medium mb-1">TRANSFER CODE</p>
                        <div className="flex items-center justify-center gap-1.5">
                          {transferCode.split('').map((char, i) => (
                            <motion.span
                              key={i}
                              initial={{ opacity: 0, y: 8 }}
                              animate={{ opacity: 1, y: 0 }}
                              transition={{ delay: i * 0.08 }}
                              className="w-9 h-12 rounded-lg bg-teal-50 dark:bg-teal-900/30 border border-teal-200 dark:border-teal-700/50 flex items-center justify-center text-xl font-black text-teal-700 dark:text-teal-300 tracking-wider"
                            >
                              {char}
                            </motion.span>
                          ))}
                        </div>

                        {/* Timer */}
                        {codeTimer && (
                          <div className="flex items-center justify-center gap-1.5 mt-3">
                            <Clock className="w-3 h-3 text-warm-400 dark:text-warm-500" />
                            <span className={`text-[10px] font-semibold ${
                              codeTimer === 'Expired'
                                ? 'text-red-500'
                                : 'text-warm-500 dark:text-warm-400'
                            }`}>
                              {codeTimer === 'Expired' ? 'Code expired' : `Expires in ${codeTimer}`}
                            </span>
                          </div>
                        )}
                      </div>

                      {/* Copy Button */}
                      <div className="flex gap-2 mt-4">
                        <Button
                          onClick={handleCopyCode}
                          className="flex-1 bg-teal-600 hover:bg-teal-700 text-white font-bold rounded-xl"
                        >
                          {copied ? <Check className="w-4 h-4 mr-1.5" /> : <Copy className="w-4 h-4 mr-1.5" />}
                          {copied ? 'Copied!' : 'Copy Code'}
                        </Button>
                        <Button
                          onClick={handleGenerateCode}
                          variant="outline"
                          className="flex-1 border-teal-300 dark:border-teal-600 text-teal-700 dark:text-teal-300 font-bold rounded-xl"
                        >
                          <RefreshCw className="w-4 h-4 mr-1.5" />
                          New Code
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              )}

              {/* Warning */}
              <Card className="bg-amber-50/80 dark:bg-amber-900/15 border-amber-200/50 dark:border-amber-700/20">
                <CardContent className="p-3">
                  <div className="flex items-start gap-2">
                    <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                    <div>
                      <p className="text-xs font-semibold text-amber-700 dark:text-amber-400">Important</p>
                      <ul className="text-[10px] text-amber-600 dark:text-amber-400/80 mt-1 space-y-0.5">
                        <li>• Code expires in 30 minutes</li>
                        <li>• Keep scoring until the new scorer confirms receipt</li>
                        <li>• Both scorers will see the same match state</li>
                        <li>• Only one person should score at a time after transfer</li>
                      </ul>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ) : (
            <motion.div
              key="receive"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="flex flex-col gap-4"
            >
              {/* Info Card */}
              <Card className="bg-gradient-to-br from-teal-50/80 to-warm-50 dark:from-teal-900/20 dark:to-warm-800 border-teal-200/50 dark:border-teal-700/30">
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-xl bg-teal-100 dark:bg-teal-800/40 flex items-center justify-center shrink-0">
                      <Download className="w-5 h-5 text-teal-600 dark:text-teal-400" />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-warm-800 dark:text-warm-100">Receive a Match</h3>
                      <p className="text-xs text-warm-500 dark:text-warm-400 mt-1 leading-relaxed">
                        Enter the transfer code shared by the current scorer. You&apos;ll take over the live scoring from exactly where they left off.
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Code Input */}
              <Card className="bg-warm-100/60 dark:bg-warm-700/40 border-warm-200 dark:border-warm-600/30">
                <CardContent className="p-4">
                  <label className="text-xs font-bold text-warm-700 dark:text-warm-200 block mb-2">
                    Enter Transfer Code
                  </label>
                  <div className="flex gap-2">
                    <Input
                      value={inputCode}
                      onChange={(e) => {
                        setInputCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6));
                        setReceiveError(null);
                        setPreviewMatch(null);
                      }}
                      placeholder="e.g. ABC123"
                      className="text-center text-lg font-black tracking-[0.3em] uppercase bg-white dark:bg-warm-800 border-2 border-teal-200 dark:border-teal-700/50 focus:border-teal-500 rounded-xl h-12"
                      maxLength={6}
                    />
                    <Button
                      onClick={handleValidateCode}
                      disabled={inputCode.length < 6 || isValidating}
                      className="bg-teal-600 hover:bg-teal-700 text-white font-bold rounded-xl px-4"
                    >
                      {isValidating ? (
                        <RefreshCw className="w-4 h-4 animate-spin" />
                      ) : (
                        <Check className="w-4 h-4" />
                      )}
                    </Button>
                  </div>
                  <p className="text-[10px] text-warm-400 dark:text-warm-500 mt-1.5 text-center">
                    6-character code from the current scorer
                  </p>
                </CardContent>
              </Card>

              {/* Error */}
              {receiveError && (
                <motion.div
                  initial={{ opacity: 0, y: -8 }}
                  animate={{ opacity: 1, y: 0 }}
                >
                  <Card className="bg-red-50/80 dark:bg-red-900/15 border-red-200/50 dark:border-red-700/20">
                    <CardContent className="p-3">
                      <div className="flex items-center gap-2">
                        <AlertTriangle className="w-4 h-4 text-red-500 shrink-0" />
                        <p className="text-xs text-red-600 dark:text-red-400 font-medium">{receiveError}</p>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              )}

              {/* Match Preview */}
              {previewMatch && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ type: 'spring', damping: 15, stiffness: 200 }}
                >
                  <Card className="bg-gradient-to-br from-teal-50 to-white dark:from-teal-900/30 dark:to-warm-800 border-2 border-teal-300 dark:border-teal-600/50 shadow-lg">
                    <CardContent className="p-4">
                      <div className="flex items-center gap-2 mb-3">
                        <Shield className="w-4 h-4 text-teal-600 dark:text-teal-400" />
                        <span className="text-xs font-bold text-teal-700 dark:text-teal-300">Match Found!</span>
                      </div>

                      {/* Teams & Score */}
                      <div className="bg-white dark:bg-warm-700 rounded-xl p-3 border border-teal-200/30 dark:border-teal-600/20">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <div
                              className="w-8 h-8 rounded-full flex items-center justify-center text-white text-[10px] font-bold"
                              style={{ backgroundColor: previewMatch.homeTeamColor || '#DC2626' }}
                            >
                              {(previewMatch.homeTeam || 'H').slice(0, 2).toUpperCase()}
                            </div>
                            <span className="text-sm font-bold text-warm-800 dark:text-warm-100">{previewMatch.homeTeam}</span>
                          </div>
                          <span className="text-lg font-black text-warm-800 dark:text-warm-100">
                            {previewMatch.homeScore} - {previewMatch.awayScore}
                          </span>
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-bold text-warm-800 dark:text-warm-100">{previewMatch.awayTeam}</span>
                            <div
                              className="w-8 h-8 rounded-full flex items-center justify-center text-white text-[10px] font-bold"
                              style={{ backgroundColor: previewMatch.awayTeamColor || '#1E293B' }}
                            >
                              {(previewMatch.awayTeam || 'A').slice(0, 2).toUpperCase()}
                            </div>
                          </div>
                        </div>

                        {/* Match details */}
                        <div className="flex items-center justify-center gap-3 mt-2">
                          <Badge variant="outline" className="text-[9px]">
                            Half {previewMatch.currentHalf}
                          </Badge>
                          <Badge variant="outline" className="text-[9px]">
                            {previewMatch.isPractice ? 'Practice' : 'Tournament'}
                          </Badge>
                          <Badge variant="outline" className="text-[9px]">
                            {previewMatch.events.length} events
                          </Badge>
                          <Badge variant="outline" className="text-[9px]">
                            {previewMatch.homeLineup?.length || 0}v{previewMatch.awayLineup?.length || 0}
                          </Badge>
                        </div>

                        {previewScorer && (
                          <p className="text-[10px] text-warm-400 dark:text-warm-500 text-center mt-2">
                            Shared by {previewScorer}
                          </p>
                        )}
                      </div>

                      {/* Claim Button */}
                      <Button
                        onClick={handleClaimTransfer}
                        disabled={isClaiming}
                        className="w-full mt-4 bg-gradient-to-r from-teal-600 to-teal-500 hover:from-teal-700 hover:to-teal-600 text-white font-bold rounded-xl py-5 text-sm shadow-lg shadow-teal-500/20"
                      >
                        {isClaiming ? (
                          <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                        ) : (
                          <Zap className="w-4 h-4 mr-2" />
                        )}
                        {isClaiming ? 'Taking Over...' : 'Take Over Scoring'}
                      </Button>
                    </CardContent>
                  </Card>
                </motion.div>
              )}

              {/* Warning */}
              <Card className="bg-amber-50/80 dark:bg-amber-900/15 border-amber-200/50 dark:border-amber-700/20">
                <CardContent className="p-3">
                  <div className="flex items-start gap-2">
                    <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                    <div>
                      <p className="text-xs font-semibold text-amber-700 dark:text-amber-400">Before you start</p>
                      <ul className="text-[10px] text-amber-600 dark:text-amber-400/80 mt-1 space-y-0.5">
                        <li>• Make sure the previous scorer has stopped scoring</li>
                        <li>• The match will resume exactly from where it was left</li>
                        <li>• Timer will need to be manually adjusted if time passed</li>
                        <li>• You can also pause the match after taking over</li>
                      </ul>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}
