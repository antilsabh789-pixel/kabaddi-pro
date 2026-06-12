'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { X, Gift, Copy, Share2, Users, Crown, Check, Loader2 } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useKabaddiStore } from '@/lib/store';
import { useToast } from '@/hooks/use-toast';

interface ReferralInfo {
  referralCode: string;
  successfulReferrals: number;
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

export default function ReferralScreen({ onClose }: { onClose: () => void }) {
  const currentUser = useKabaddiStore((s) => s.currentUser);
  const isPremium = currentUser?.isPremium || false;
  const { toast } = useToast();
  const [info, setInfo] = useState<ReferralInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [applyCode, setApplyCode] = useState('');
  const [applying, setApplying] = useState(false);

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
      toast({ title: 'Code Copied!', description: 'Share it with friends to earn premium days' });
    }).catch(() => {
      toast({ title: 'Code: ' + info.referralCode, description: 'Copy this code manually' });
    });
  };

  const handleShare = async () => {
    if (!info?.referralCode) return;
    const shareText = `Join me on Kabaddi Pro! 🏆 Use my referral code ${info.referralCode} to sign up and we both get 7 days of Premium FREE! Download now: https://kabaddipro.app`;

    if (navigator.share) {
      try {
        await navigator.share({
          title: 'Join Kabaddi Pro!',
          text: shareText,
        });
      } catch {
        // User cancelled sharing
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

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 bg-warm-50 overflow-y-auto"
    >
      {/* Header */}
      <div className="sticky top-0 z-10 bg-gradient-to-r from-brand-gold-dark via-brand-gold to-brand-gold-light">
        <div className="flex items-center justify-between px-4 py-4">
          <div className="flex items-center gap-2">
            <Gift className="w-5 h-5 text-white" />
            <h1 className="text-lg font-bold text-white">Refer & Earn</h1>
          </div>
          <button onClick={onClose} className="p-2 rounded-full hover:bg-white/20 transition-colors">
            <X className="w-5 h-5 text-white" />
          </button>
        </div>
      </div>

      <div className="px-4 py-4 space-y-4">
        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map(i => <div key={i} className="h-24 bg-warm-100 rounded-xl animate-pulse" />)}
          </div>
        ) : (
          <>
            {/* How It Works */}
            <Card className="bg-gradient-to-br from-brand-gold/10 to-brand-gold-dark/5 border-brand-gold/20">
              <CardContent className="p-4">
                <h3 className="font-bold text-warm-800 mb-3">How It Works</h3>
                <div className="space-y-2.5">
                  {[
                    { step: '1', text: 'Share your referral code with friends' },
                    { step: '2', text: 'They sign up using your code' },
                    { step: '3', text: 'You both get 7 days of Premium FREE!' },
                  ].map(item => (
                    <div key={item.step} className="flex items-start gap-2.5">
                      <div className="w-6 h-6 rounded-full bg-brand-gold/20 flex items-center justify-center shrink-0">
                        <span className="text-[10px] font-bold text-brand-gold">{item.step}</span>
                      </div>
                      <p className="text-sm text-warm-700">{item.text}</p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Referral Code */}
            <Card className="border-brand-gold/30">
              <CardContent className="p-4 text-center">
                <p className="text-xs text-warm-500 mb-2 uppercase tracking-wide font-semibold">Your Referral Code</p>
                <div className="flex items-center justify-center gap-3 mb-3">
                  <span className="text-2xl font-black tracking-[0.3em] text-warm-800 bg-warm-100 px-6 py-3 rounded-xl">
                    {info?.referralCode || '--------'}
                  </span>
                </div>
                <div className="flex gap-2">
                  <Button
                    onClick={handleCopyCode}
                    variant="outline"
                    className="flex-1 border-brand-gold/30 text-brand-gold hover:bg-brand-gold/10 h-9"
                  >
                    <Copy className="w-3.5 h-3.5 mr-1.5" />
                    Copy Code
                  </Button>
                  <Button
                    onClick={handleShare}
                    className="flex-1 bg-brand-gold hover:bg-brand-gold-dark text-white h-9"
                  >
                    <Share2 className="w-3.5 h-3.5 mr-1.5" />
                    Share
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Stats */}
            <div className="grid grid-cols-2 gap-3">
              <Card className="p-3 text-center">
                <Users className="w-5 h-5 text-brand-teal mx-auto mb-1" />
                <div className="text-2xl font-black text-warm-800">{info?.successfulReferrals || 0}</div>
                <div className="text-[10px] text-warm-500">Successful Referrals</div>
              </Card>
              <Card className="p-3 text-center">
                <Crown className="w-5 h-5 text-brand-gold mx-auto mb-1" />
                <div className="text-2xl font-black text-warm-800">{info?.totalPremiumDaysEarned || 0}</div>
                <div className="text-[10px] text-warm-500">Premium Days Earned</div>
              </Card>
            </div>

            {/* Apply Referral Code (for non-premium users) */}
            {!isPremium && (
              <Card className="border-brand-teal/20">
                <CardContent className="p-4">
                  <h3 className="font-bold text-warm-800 mb-2">Have a Referral Code?</h3>
                  <p className="text-xs text-warm-500 mb-3">Enter a friend&apos;s code to get 7 days of Premium FREE!</p>
                  <div className="flex gap-2">
                    <input
                      value={applyCode}
                      onChange={(e) => setApplyCode(e.target.value.toUpperCase())}
                      placeholder="ENTER CODE"
                      maxLength={8}
                      className="flex-1 h-10 rounded-lg border border-warm-300 bg-white px-3 text-sm font-mono tracking-wider text-warm-800 uppercase focus:outline-none focus:ring-2 focus:ring-brand-teal/30"
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
            )}

            {/* Referral History */}
            {info?.referrals && info.referrals.length > 0 && (
              <div>
                <h3 className="font-bold text-warm-800 mb-3">Referral History</h3>
                <div className="space-y-2">
                  {info.referrals.map((ref) => (
                    <Card key={ref.id} className="border-warm-200">
                      <CardContent className="p-3 flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-warm-100 flex items-center justify-center text-sm">
                          {ref.referredAvatar ? (
                            <img src={ref.referredAvatar} alt="" className="w-full h-full rounded-full object-cover" />
                          ) : (
                            '👤'
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-warm-800 truncate">{ref.referredName}</p>
                          <p className="text-[10px] text-warm-400">{new Date(ref.createdAt).toLocaleDateString()}</p>
                        </div>
                        <Badge className={`text-[9px] border-0 ${
                          ref.status === 'rewarded' ? 'bg-emerald-50 text-emerald-600' :
                          ref.status === 'signed_up' ? 'bg-brand-gold/10 text-brand-gold' :
                          'bg-warm-100 text-warm-500'
                        }`}>
                          {ref.status === 'rewarded' ? `+${ref.premiumDays}d Premium` :
                           ref.status === 'signed_up' ? 'Signed Up' :
                           'Pending'}
                        </Badge>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </motion.div>
  );
}
