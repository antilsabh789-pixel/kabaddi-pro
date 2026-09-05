'use client';

import { motion } from 'framer-motion';
import { Gift, X } from 'lucide-react';
import { useKabaddiStore } from '@/lib/store';
import { useBackButton } from '@/hooks/use-back-button';
import ReferralContestPanel from './ReferralContestPanel';

interface GiveawayScreenProps {
  onClose: () => void;
  onUpgradeToPremium?: () => void;
  onOpenReferral?: () => void;
}

/**
 * GiveawayScreen
 *
 * This used to host TWO giveaways behind a tab switcher:
 *   1. A 15-day random draw (1kg Protein Powder / Kabaddi Kit / Shaker Bottle)
 *      entered via premium, referrals, or a ₹2 Cashfree payment.
 *   2. A monthly referral contest (1kg Oats Pack) won by the top referrer.
 *
 * The 15-day random draw has been REMOVED — only the monthly referral contest
 * remains. This component is now a thin shell: a branded header with a close
 * button, and the ReferralContestPanel renders everything else (prize card,
 * countdown, entry/rank card, full leaderboard, how-it-works, past winners,
 * and the admin panel).
 *
 * The `onUpgradeToPremium` prop is kept in the interface for backward
 * compatibility with HomeTab (which still passes it) but is no longer used —
 * premium is no longer sold as a giveaway entry path.
 */
export default function GiveawayScreen({ onClose, onOpenReferral }: GiveawayScreenProps) {
  const currentUser = useKabaddiStore((s) => s.currentUser);
  const language = useKabaddiStore((s) => s.language);
  useBackButton(true, onClose);

  return (
    <motion.div
      initial={{ x: '100%' }}
      animate={{ x: 0 }}
      exit={{ x: '100%' }}
      transition={{ type: 'spring', damping: 25, stiffness: 300 }}
      className="fixed inset-0 z-50 bg-warm-50 dark:bg-warm-900 overflow-y-auto"
    >
      {/* Header */}
      <div className="sticky top-0 z-10 bg-gradient-to-r from-purple-600 via-pink-600 to-orange-500 px-4 py-3 flex items-center gap-3 shadow-lg">
        <button onClick={onClose} className="w-9 h-9 rounded-full bg-white/20 flex items-center justify-center">
          <X className="w-5 h-5 text-white" />
        </button>
        <div className="flex-1">
          <h1 className="text-white font-black text-lg flex items-center gap-2">
            <Gift className="w-5 h-5" />
            {language === 'hi' ? 'रेफरल कॉन्टेस्ट' : 'Referral Contest'}
          </h1>
          <p className="text-white/80 text-[10px]">
            {language === 'hi'
              ? 'सबसे ज्यादा रेफरल करने वाला जीतता है · मासिक'
              : 'Most referrals wins 1kg Oats Pack — monthly!'}
          </p>
        </div>
      </div>

      {/* Contest body — rendered by ReferralContestPanel */}
      <ReferralContestPanel
        onClose={onClose}
        onOpenReferral={onOpenReferral}
      />
    </motion.div>
  );
}
