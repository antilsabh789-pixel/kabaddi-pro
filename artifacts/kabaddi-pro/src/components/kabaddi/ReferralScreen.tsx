'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence, Variants } from 'framer-motion';
import {
  X, Gift, Copy, Share2, Users, Crown, Check, Loader2,
  MessageCircle, Twitter, Link2, Sparkles, ChevronRight,
  PartyPopper, Award,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useKabaddiStore } from '@/lib/store';
import { useToast } from '@/hooks/use-toast';

// ─── Types ────────────────────────────────────────────────────────

interface ReferralInfo {
  referralCode: string;
  successfulReferrals: number;
  totalReferrals: number;
  totalPremiumDaysEarned: number;
  referrals: {
    id: string;
    status: string;
    premiumDays: number;
    referredName: string;
    referredAvatar: string | null;
    createdAt: string;
    completedAt: string | null;
  }[];
}

// ─── Animation variants ──────────────────────────────────────────

const containerVariants: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.08, delayChildren: 0.1 },
  },
};

const itemVariants: Variants = {
  hidden: { opacity: 0, y: 16, scale: 0.97 },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: { type: 'spring' as const, damping: 20, stiffness: 200 },
  },
};

// ─── Confetti Particle ────────────────────────────────────────────

function ConfettiParticle({ delay, color, left }: { delay: number; color: string; left: string }) {
  return (
    <motion.div
      className="absolute w-2 h-2 rounded-full"
      style={{ background: color, left }}
      initial={{ y: -20, opacity: 0, scale: 0 }}
      animate={{ y: [0, -30, 80], opacity: [0, 1, 0], scale: [0, 1.2, 0.6], rotate: [0, 180, 360] }}
      transition={{ duration: 1.5, delay, ease: 'easeOut' }}
    />
  );
}

// ─── QR Code Pattern ──────────────────────────────────────────────

function QRCodePattern({ code }: { code: string }) {
  // Generate a deterministic pattern from the code
  const cells: boolean[] = [];
  for (let i = 0; i < 64; i++) {
    const charCode = code.charCodeAt(i % code.length);
    cells.push((charCode + i) % 3 === 0);
  }
  // Force corner markers (standard QR pattern)
  const setMarker = (startRow: number, startCol: number) => {
    for (let r = 0; r < 3; r++) {
      for (let c = 0; c < 3; c++) {
        const idx = (startRow + r) * 8 + (startCol + c);
        if (r === 0 || r === 2 || c === 0 || c === 2) {
          cells[idx] = true;
        } else {
          cells[idx] = false;
        }
      }
    }
  };
  setMarker(0, 0);
  setMarker(0, 5);
  setMarker(5, 0);

  return (
    <div className="qr-code-pattern mx-auto">
      {cells.map((isDark, i) => (
        <div key={i} className={isDark ? 'qr-cell-dark' : 'qr-cell-light'} />
      ))}
    </div>
  );
}

// ─── Step Indicator ───────────────────────────────────────────────

function StepIndicator({
  step,
  title,
  description,
  isActive,
  delay,
}: {
  step: number;
  title: string;
  description: string;
  isActive: boolean;
  delay: number;
}) {
  return (
    <motion.div
      className="flex items-start gap-3"
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay, type: 'spring', damping: 20 }}
    >
      <div className="relative">
        <motion.div
          className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${
            isActive
              ? 'bg-gradient-to-br from-brand-gold to-brand-gold-dark shadow-lg shadow-brand-gold/30'
              : 'bg-brand-gold/10'
          }`}
          animate={isActive ? { scale: [1, 1.05, 1] } : {}}
          transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
        >
          <span className={`text-sm font-black ${isActive ? 'text-white' : 'text-brand-gold'}`}>{step}</span>
        </motion.div>
        {step < 3 && (
          <div className="absolute top-10 left-1/2 -translate-x-1/2 w-0.5 h-6 bg-brand-gold/20" />
        )}
      </div>
      <div className="pt-1.5">
        <p className="text-sm font-bold text-warm-800 dark:text-warm-100">{title}</p>
        <p className="text-xs text-warm-500 mt-0.5">{description}</p>
      </div>
    </motion.div>
  );
}

// ─── Status Badge ─────────────────────────────────────────────────

function StatusBadge({ status }: { status: string }) {
  switch (status) {
    case 'rewarded':
      return (
        <Badge className="bg-amber-500/15 text-amber-600 border-0 font-bold text-[9px] gap-0.5">
          <Award className="w-2.5 h-2.5" />
          Rewarded
        </Badge>
      );
    case 'signed_up':
      return (
        <Badge className="bg-emerald-500/15 text-emerald-600 border-0 font-bold text-[9px] gap-0.5">
          <Check className="w-2.5 h-2.5" />
          Signed Up
        </Badge>
      );
    default:
      return (
        <Badge className="bg-amber-500/10 text-amber-500 border-0 font-bold text-[9px]">
          Pending
        </Badge>
      );
  }
}

// ─── Main Component ───────────────────────────────────────────────

export default function ReferralScreen({ onClose }: { onClose: () => void }) {
  const currentUser = useKabaddiStore((s) => s.currentUser);
  const isPremium = currentUser?.isPremium || currentUser?.isAdmin || false;
  const { toast } = useToast();
  const [info, setInfo] = useState<ReferralInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [applyCode, setApplyCode] = useState('');
  const [applying, setApplying] = useState(false);
  const [copied, setCopied] = useState(false);
  const [showConfetti, setShowConfetti] = useState(false);

  const loadReferral = useCallback(async () => {
    if (!currentUser?.id) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/referrals?userId=${currentUser.id}`);
      if (res.ok) {
        const data = await res.json();
        setInfo(data);
      }
    } catch (err) {
      console.error('Failed to load referral:', err);
    } finally {
      setLoading(false);
    }
  }, [currentUser?.id]);

  useEffect(() => {
    loadReferral();
  }, [loadReferral]);

  const handleCopyCode = () => {
    if (!info?.referralCode) return;
    navigator.clipboard.writeText(info.referralCode).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      toast({ title: 'Code Copied!', description: 'Share it with friends to earn premium days' });
    }).catch(() => {
      toast({ title: 'Code: ' + info.referralCode, description: 'Copy this code manually' });
    });
  };

  // Build a share URL that pre-fills the referral code on the signup screen.
  // The AuthScreen reads ?ref=CODE (or ?referral=CODE) and auto-fills the
  // referral input — so users who click a shared link don't have to
  // remember/type the code.
  // IMPORTANT: Always link to the root URL, not the current pathname. If the
  // referrer is on /profile or /follow when they share, a logged-out recipient
  // would get redirected by the auth gate and lose the ?ref param.
  const shareUrl = typeof window !== 'undefined' && info?.referralCode
    ? `${window.location.origin}/?ref=${encodeURIComponent(info.referralCode)}`
    : 'https://kabaddipro.app';

  const handleShareWhatsApp = () => {
    if (!info?.referralCode) return;
    const text = `Join me on Kabaddi Pro! 🏆 Use my referral code *${info.referralCode}* to sign up and we both get 7 days of Premium FREE! Click here: ${shareUrl}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
  };

  const handleShareTwitter = () => {
    if (!info?.referralCode) return;
    const text = `Join me on Kabaddi Pro! 🏆 Use my referral code ${info.referralCode} and we both get 7 days Premium FREE! ${shareUrl} #KabaddiPro`;
    window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}`, '_blank');
  };

  const handleShare = async () => {
    if (!info?.referralCode) return;
    const shareText = `Join me on Kabaddi Pro! 🏆 Use my referral code ${info.referralCode} to sign up and we both get 7 days of Premium FREE! Click here: ${shareUrl}`;

    if (navigator.share) {
      try {
        await navigator.share({ title: 'Join Kabaddi Pro!', text: shareText });
      } catch {
        // User cancelled
      }
    } else {
      navigator.clipboard.writeText(shareText);
      toast({ title: 'Invite copied!', description: 'Share with friends' });
    }
  };

  const handleApplyCode = async () => {
    if (!applyCode.trim() || !currentUser?.id) return;
    setApplying(true);
    try {
      const res = await fetch('/api/referrals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ referralCode: applyCode.trim().toUpperCase(), userId: currentUser.id }),
      });

      const data = await res.json();
      if (res.ok) {
        toast({ title: 'Referral Applied!', description: `You earned ${data.premiumDaysGranted} premium days!` });
        setApplyCode('');
        setShowConfetti(true);
        setTimeout(() => setShowConfetti(false), 2500);
        loadReferral();
      } else {
        toast({ title: 'Error', description: data.error, variant: 'destructive' });
      }
    } catch {
      toast({ title: 'Error applying code', variant: 'destructive' });
    } finally {
      setApplying(false);
    }
  };

  const confettiColors = ['#DC2626', '#F59E0B', '#14B8A6', '#FBBF24', '#EF4444', '#22C55E'];
  const confettiParticles = Array.from({ length: 12 }, (_, i) => ({
    delay: i * 0.1,
    color: confettiColors[i % confettiColors.length],
    left: `${(i * 8.33) + Math.random() * 5}%`,
  }));

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 bg-warm-50 dark:bg-warm-900 overflow-y-auto"
    >
      {/* Confetti overlay */}
      <AnimatePresence>
        {showConfetti && (
          <motion.div
            className="fixed inset-0 pointer-events-none z-50"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            {confettiParticles.map((p, i) => (
              <ConfettiParticle key={i} delay={p.delay} color={p.color} left={p.left} />
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Header */}
      <div className="sticky top-0 z-10 gold-gradient-bg">
        <div className="flex items-center justify-between px-4 py-4">
          <div className="flex items-center gap-2">
            <motion.div
              animate={{ rotate: [0, -10, 10, -5, 0] }}
              transition={{ duration: 2, repeat: Infinity, repeatDelay: 3 }}
            >
              <Gift className="w-5 h-5 text-white" />
            </motion.div>
            <h1 className="text-lg font-black text-white tracking-wide">REFER & EARN</h1>
          </div>
          <button onClick={onClose} className="p-2 rounded-full hover:bg-white/20 transition-colors">
            <X className="w-5 h-5 text-white" />
          </button>
        </div>
      </div>

      <div className="px-4 py-4 space-y-4">
        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3, 4].map(i => <div key={i} className="h-24 skeleton-shimmer rounded-xl" />)}
          </div>
        ) : (
          <motion.div
            variants={containerVariants}
            initial="hidden"
            animate="visible"
            className="space-y-4"
          >
            {/* ── How It Works ──────────────────────────────── */}
            <motion.div variants={itemVariants}>
              <Card className="bg-gradient-to-br from-brand-gold/5 to-brand-gold-dark/5 border-brand-gold/20 overflow-hidden">
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 mb-4">
                    <Sparkles className="w-4 h-4 text-brand-gold" />
                    <h3 className="font-black text-warm-800 dark:text-warm-100 text-sm uppercase tracking-wide">How It Works</h3>
                  </div>
                  <div className="space-y-5">
                    <StepIndicator
                      step={1}
                      title="Share Your Code"
                      description="Send your unique referral code to friends"
                      isActive={true}
                      delay={0.1}
                    />
                    <StepIndicator
                      step={2}
                      title="Friend Signs Up"
                      description="They enter your code during registration"
                      isActive={false}
                      delay={0.2}
                    />
                    <StepIndicator
                      step={3}
                      title="Both Get Rewards!"
                      description="7 days of Premium FREE for both of you"
                      isActive={false}
                      delay={0.3}
                    />
                  </div>
                </CardContent>
              </Card>
            </motion.div>

            {/* ── Referral Code ─────────────────────────────── */}
            <motion.div variants={itemVariants}>
              <div className="referral-code-box">
                <p className="text-xs text-warm-500 mb-2 uppercase tracking-widest font-bold">Your Referral Code</p>
                <motion.div
                  className="coin-flip"
                  key={info?.referralCode}
                >
                  <span className="text-3xl font-black tracking-[0.4em] text-warm-800 dark:text-warm-100 block mb-3">
                    {info?.referralCode || '--------'}
                  </span>
                </motion.div>

                {/* QR Code */}
                {info?.referralCode && (
                  <div className="mb-4">
                    <QRCodePattern code={info.referralCode} />
                  </div>
                )}

                {/* Share buttons */}
                <div className="grid grid-cols-3 gap-2">
                  <Button
                    onClick={handleCopyCode}
                    variant="outline"
                    className="border-brand-gold/30 text-brand-gold hover:bg-brand-gold/10 h-11 flex flex-col items-center justify-center gap-0.5"
                  >
                    {copied ? (
                      <Check className="w-4 h-4 text-green-500" />
                    ) : (
                      <Copy className="w-4 h-4" />
                    )}
                    <span className="text-[9px] font-bold">{copied ? 'Copied!' : 'Copy Code'}</span>
                  </Button>
                  <Button
                    onClick={handleShareWhatsApp}
                    variant="outline"
                    className="border-green-500/30 text-green-600 hover:bg-green-500/10 h-11 flex flex-col items-center justify-center gap-0.5"
                  >
                    <MessageCircle className="w-4 h-4" />
                    <span className="text-[9px] font-bold">WhatsApp</span>
                  </Button>
                  <Button
                    onClick={handleShareTwitter}
                    variant="outline"
                    className="border-sky-500/30 text-sky-500 hover:bg-sky-500/10 h-11 flex flex-col items-center justify-center gap-0.5"
                  >
                    <Twitter className="w-4 h-4" />
                    <span className="text-[9px] font-bold">Twitter</span>
                  </Button>
                </div>
              </div>
            </motion.div>

            {/* ── Referral Stats ─────────────────────────────── */}
            <motion.div variants={itemVariants}>
              <div className="grid grid-cols-3 gap-2">
                <div className="stat-card text-center">
                  <Users className="w-5 h-5 text-brand-teal mx-auto mb-1" />
                  <p className="text-xl font-black text-warm-800 dark:text-warm-100 stat-counter">{info?.totalReferrals || 0}</p>
                  <p className="text-[9px] text-warm-500 font-bold uppercase tracking-wide">Total Sent</p>
                </div>
                <div className="stat-card text-center">
                  <Check className="w-5 h-5 text-emerald-500 mx-auto mb-1" />
                  <p className="text-xl font-black text-warm-800 dark:text-warm-100 stat-counter">{info?.successfulReferrals || 0}</p>
                  <p className="text-[9px] text-warm-500 font-bold uppercase tracking-wide">Signed Up</p>
                </div>
                <div className="stat-card text-center">
                  <Crown className="w-5 h-5 text-brand-gold mx-auto mb-1" />
                  <p className="text-xl font-black text-warm-800 dark:text-warm-100 stat-counter">{info?.totalPremiumDaysEarned || 0}</p>
                  <p className="text-[9px] text-warm-500 font-bold uppercase tracking-wide">Premium Days</p>
                </div>
              </div>
            </motion.div>

            {/* ── Reward Detail ──────────────────────────────── */}
            <motion.div variants={itemVariants}>
              <Card className="border-brand-gold/20 bg-gradient-to-r from-brand-gold/5 via-brand-gold/10 to-brand-gold/5">
                <CardContent className="p-4 flex items-center gap-3">
                  <motion.div
                    className="w-12 h-12 rounded-xl gold-gradient-bg flex items-center justify-center shrink-0 shadow-lg shadow-brand-gold/20"
                    animate={{ scale: [1, 1.05, 1] }}
                    transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
                  >
                    <PartyPopper className="w-6 h-6 text-white" />
                  </motion.div>
                  <div className="flex-1">
                    <p className="text-sm font-black text-warm-800 dark:text-warm-100">7 Days Premium Per Referral!</p>
                    <p className="text-xs text-warm-500">Both you and your friend get 7 days of premium access for every successful referral.</p>
                  </div>
                </CardContent>
              </Card>
            </motion.div>

            {/* ── Apply Referral Code ────────────────────────── */}
            {!isPremium && (
              <motion.div variants={itemVariants}>
                <Card className="border-brand-teal/20">
                  <CardContent className="p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <Link2 className="w-4 h-4 text-brand-teal" />
                      <h3 className="font-bold text-warm-800 dark:text-warm-100 text-sm">Have a Referral Code?</h3>
                    </div>
                    <p className="text-xs text-warm-500 mb-3">Enter a friend&apos;s code to get 7 days of Premium FREE!</p>
                    <div className="flex gap-2">
                      <input
                        value={applyCode}
                        onChange={(e) => setApplyCode(e.target.value.toUpperCase())}
                        placeholder="ENTER CODE"
                        maxLength={20}
                        className="flex-1 h-10 rounded-lg border border-warm-300 bg-white px-3 text-sm font-mono tracking-wider text-warm-800 uppercase focus:outline-none focus:ring-2 focus:ring-brand-teal/30 input-focus-brand"
                      />
                      <Button
                        onClick={handleApplyCode}
                        disabled={!applyCode.trim() || applying}
                        className="bg-brand-teal hover:bg-brand-teal-dark text-white h-10"
                      >
                        {applying ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            )}

            {/* ── Referral History ───────────────────────────── */}
            <motion.div variants={itemVariants}>
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-black text-warm-800 dark:text-warm-100 text-sm uppercase tracking-wide">Referral History</h3>
                {info?.referrals && info.referrals.length > 0 && (
                  <span className="text-[10px] text-warm-400 font-medium">{info.referrals.length} total</span>
                )}
              </div>

              {info?.referrals && info.referrals.length > 0 ? (
                <div className="space-y-2 max-h-80 overflow-y-auto custom-scrollbar">
                  {info.referrals.map((ref, i) => (
                    <motion.div
                      key={ref.id}
                      initial={{ opacity: 0, x: -12 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.05 }}
                    >
                      <Card className={`border-warm-200/60 ${
                        ref.status === 'rewarded' ? 'card-win' : ref.status === 'signed_up' ? 'border-l-4 border-l-emerald-500' : ''
                      }`}>
                        <CardContent className="p-3 flex items-center gap-3">
                          <div className="w-9 h-9 rounded-full bg-warm-100 dark:bg-warm-800 flex items-center justify-center text-sm shrink-0">
                            {ref.referredAvatar ? (
                              <img src={ref.referredAvatar} alt="" className="w-full h-full rounded-full object-cover" />
                            ) : (
                              <span className="text-base">👤</span>
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold text-warm-800 dark:text-warm-100 truncate">{ref.referredName}</p>
                            <div className="flex items-center gap-2">
                              <p className="text-[10px] text-warm-400">{new Date(ref.createdAt).toLocaleDateString()}</p>
                              {ref.status === 'rewarded' && ref.premiumDays > 0 && (
                                <p className="text-[10px] text-brand-gold font-bold">+{ref.premiumDays}d Premium</p>
                              )}
                            </div>
                          </div>
                          <StatusBadge status={ref.status} />
                        </CardContent>
                      </Card>
                    </motion.div>
                  ))}
                </div>
              ) : (
                <Card className="border-warm-200/60">
                  <CardContent className="p-8 text-center">
                    <motion.div
                      animate={{ y: [0, -8, 0] }}
                      transition={{ duration: 2.5, repeat: Infinity, ease: 'easeInOut' }}
                    >
                      <Gift className="w-12 h-12 text-brand-gold/40 mx-auto mb-3" />
                    </motion.div>
                    <p className="text-sm font-bold text-warm-700 dark:text-warm-200 mb-1">No Referrals Yet</p>
                    <p className="text-xs text-warm-500">Share your code with friends to start earning Premium days!</p>
                    <Button
                      onClick={handleShare}
                      className="mt-3 bg-brand-gold hover:bg-brand-gold-dark text-white h-9 text-xs font-bold"
                    >
                      <Share2 className="w-3.5 h-3.5 mr-1.5" />
                      Share Your Code
                    </Button>
                  </CardContent>
                </Card>
              )}
            </motion.div>

            {/* ── General Share Button ───────────────────────── */}
            <motion.div variants={itemVariants}>
              <Button
                onClick={handleShare}
                className="w-full gold-gradient-bg hover:opacity-90 text-white h-12 font-bold text-sm shadow-lg shadow-brand-gold/20"
              >
                <Share2 className="w-4 h-4 mr-2" />
                Share Referral Link
                <ChevronRight className="w-4 h-4 ml-1" />
              </Button>
            </motion.div>

            {/* Bottom spacer */}
            <div className="h-6" />
          </motion.div>
        )}
      </div>
    </motion.div>
  );
}
