'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ChevronLeft,
  BookOpen,
  Swords,
  Shield,
  Star,
  Users,
  Clock,
  Target,
  AlertTriangle,
  Zap,
  Trophy,
  Timer,
  Crosshair,
  Flame,
  Activity,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Accordion,
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
} from '@/components/ui/accordion';
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselPrevious,
  CarouselNext,
} from '@/components/ui/carousel';

// ─── Types ────────────────────────────────────────────────────────

interface KabaddiRulesScreenProps {
  onClose: () => void;
}

// ─── Animation Variants ──────────────────────────────────────────

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.08, delayChildren: 0.1 },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { type: 'spring', damping: 20, stiffness: 180 },
  },
};

// ─── Data ────────────────────────────────────────────────────────

const KEY_FACTS = [
  { label: 'Team Size', value: '7 Players', icon: Users, color: 'text-brand-teal' },
  { label: 'Match Duration', value: '2 × 20 min', icon: Clock, color: 'text-brand-red' },
  { label: 'Court Size', value: '13m × 10m', icon: Target, color: 'text-brand-gold' },
  { label: 'Players Out', value: 'All Out = 2 pts', icon: AlertTriangle, color: 'text-brand-red' },
];

const GLOSSARY_TERMS = [
  { term: 'Raid', definition: 'An attack by a raider into the opponent\'s half to score points by touching defenders.' },
  { term: 'Lob', definition: 'A technique where the raider jumps over a defender to escape being tackled.' },
  { term: 'Bonus Line', definition: 'A line 1 meter from the baulk line; crossing it earns the raider 1 bonus point if 6+ defenders are on court.' },
  { term: 'Bonus Point', definition: 'An extra point awarded when the raider crosses the bonus line with a foot on the ground in the opponents\' area.' },
  { term: 'Do-or-Die Raid', definition: 'The third consecutive empty raid by a team; the raider MUST score or the team loses a point.' },
  { term: 'All Out', definition: 'When all 7 defenders are out; the attacking team earns 2 extra points and defenders revive.' },
  { term: 'Super Tackle', definition: 'When 3 or fewer defenders successfully tackle a raider; the defending team earns 2 points.' },
  { term: 'Super Raid', definition: 'When a raider scores 3 or more points in a single raid (touching 3+ defenders or bonus + touches).' },
  { term: 'Empty Raid', definition: 'A raid where the raider returns without scoring any points (no touch, no bonus).' },
  { term: 'Cant', definition: 'The repeated chanting of "Kabaddi" the raider must vocalize continuously during a raid without breaking breath.' },
  { term: 'Baulk Line', definition: 'A line that the raider must cross to enter the opponent\'s side of the court.' },
  { term: 'Midline', definition: 'The center line dividing the court into two equal halves.' },
  { term: 'Lobby', definition: 'The area on either side of the court; if a raider steps into the lobby, they are out.' },
  { term: 'Struggle', definition: 'The physical contest between the raider and defenders when the raider is being held.' },
  { term: 'Revival', definition: 'When an out player returns to the court after their team scores a point.' },
  { term: 'Tackle', definition: 'When defenders successfully prevent the raider from returning to their half.' },
  { term: 'Touch Point', definition: 'A point scored when the raider touches a defender and returns to their half successfully.' },
  { term: 'Self Out', definition: 'When a raider steps into the lobby or fails to return without being touched by a defender.' },
];

const TUTORIAL_STEPS = [
  {
    step: 1,
    title: 'The Raid',
    description: 'A raider from the attacking team enters the opponent\'s half while continuously chanting "Kabaddi". The raider must touch one or more defenders and return to their own half before taking a breath to score points.',
    highlight: 'The raider has 30 seconds to complete the raid.',
    color: 'from-brand-red/20 to-brand-red/5',
    iconColor: 'text-brand-red',
  },
  {
    step: 2,
    title: 'Scoring Points',
    description: 'The raider scores 1 point for each defender touched and successfully returned. If the raider crosses the bonus line (with foot on ground), they earn 1 bonus point. A Super Raid occurs when 3+ points are scored in a single raid.',
    highlight: 'Points revive eliminated teammates!',
    color: 'from-brand-gold/20 to-brand-gold/5',
    iconColor: 'text-brand-gold',
  },
  {
    step: 3,
    title: 'Defending',
    description: 'Defenders work together to tackle the raider and prevent them from returning to their half. If they successfully hold the raider, the defending team scores 1 point. With 3 or fewer defenders, a successful tackle earns 2 points (Super Tackle).',
    highlight: 'Coordination is key to successful tackles.',
    color: 'from-brand-teal/20 to-brand-teal/5',
    iconColor: 'text-brand-teal',
  },
  {
    step: 4,
    title: 'All Out',
    description: 'When all 7 defenders are eliminated (sent out), the attacking team scores 2 additional "All Out" points. All out players are then revived, and play continues. An All Out can completely change the momentum of a match.',
    highlight: 'All Out = 2 bonus points + full revival!',
    color: 'from-brand-navy/20 to-brand-navy/5',
    iconColor: 'text-brand-navy dark:text-brand-navy-light',
  },
];

// ─── Kabaddi Court SVG ────────────────────────────────────────────

function KabaddiCourtSVG({ animated = true }: { animated?: boolean }) {
  return (
    <svg viewBox="0 0 400 300" className="w-full max-w-md mx-auto" aria-label="Kabaddi Court Diagram">
      {/* Court background */}
      <rect x="50" y="20" width="300" height="260" rx="4" fill="none" stroke="currentColor" strokeWidth="2" className="text-warm-300 dark:text-warm-600" />

      {/* Midline */}
      <line x1="50" y1="150" x2="350" y2="150" strokeWidth="2" strokeDasharray="8 4" className="stroke-brand-red/60" />

      {/* Baulk lines */}
      <line x1="130" y1="20" x2="130" y2="280" strokeWidth="2" className="stroke-brand-teal/70" />
      <line x1="270" y1="20" x2="270" y2="280" strokeWidth="2" className="stroke-brand-teal/70" />

      {/* Bonus lines */}
      <line x1="140" y1="20" x2="140" y2="280" strokeWidth="1.5" strokeDasharray="4 4" className="stroke-brand-gold/60" />
      <line x1="260" y1="20" x2="260" y2="280" strokeWidth="1.5" strokeDasharray="4 4" className="stroke-brand-gold/60" />

      {/* Center circle */}
      <circle cx="200" cy="150" r="20" fill="none" strokeWidth="1.5" className="stroke-brand-red/50" />

      {/* Labels */}
      <text x="90" y="150" textAnchor="middle" fontSize="10" className="fill-warm-500 dark:fill-warm-400" fontWeight="600">HOME</text>
      <text x="310" y="150" textAnchor="middle" fontSize="10" className="fill-warm-500 dark:fill-warm-400" fontWeight="600">AWAY</text>
      <text x="200" y="14" textAnchor="middle" fontSize="8" className="fill-brand-red/70" fontWeight="600">MIDLINE</text>
      <text x="130" y="14" textAnchor="middle" fontSize="7" className="fill-brand-teal/70">BAULK</text>
      <text x="270" y="14" textAnchor="middle" fontSize="7" className="fill-brand-teal/70">BAULK</text>
      <text x="140" y="296" textAnchor="middle" fontSize="6" className="fill-brand-gold/70">BONUS</text>
      <text x="260" y="296" textAnchor="middle" fontSize="6" className="fill-brand-gold/70">BONUS</text>

      {/* Animated raider */}
      {animated && (
        <motion.circle
          cx={200}
          cy={120}
          r={8}
          className="fill-brand-red"
          animate={{ cx: [200, 310, 200], cy: [120, 110, 120] }}
          transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
        />
      )}

      {/* Defenders */}
      <circle cx="290" cy="100" r="6" className="fill-brand-teal/70" />
      <circle cx="310" cy="130" r="6" className="fill-brand-teal/70" />
      <circle cx="280" cy="170" r="6" className="fill-brand-teal/70" />
      <circle cx="320" cy="200" r="6" className="fill-brand-teal/70" />
    </svg>
  );
}

// ─── Court Layout SVG (detailed) ─────────────────────────────────

function CourtLayoutSVG() {
  return (
    <svg viewBox="0 0 500 380" className="w-full max-w-lg mx-auto" aria-label="Detailed Kabaddi Court Layout">
      {/* Court outer boundary */}
      <rect x="30" y="20" width="440" height="340" rx="4" fill="none" stroke="currentColor" strokeWidth="2.5" className="text-warm-300 dark:text-warm-600" />

      {/* Playing area fill - home */}
      <rect x="30" y="20" width="220" height="340" fill="url(#homeGrad)" opacity="0.15" />
      {/* Playing area fill - away */}
      <rect x="250" y="20" width="220" height="340" fill="url(#awayGrad)" opacity="0.15" />

      {/* Midline */}
      <line x1="250" y1="20" x2="250" y2="360" strokeWidth="3" className="stroke-brand-red" />
      <text x="250" y="12" textAnchor="middle" fontSize="9" className="fill-brand-red" fontWeight="700">MIDLINE</text>

      {/* Baulk lines */}
      <line x1="150" y1="20" x2="150" y2="360" strokeWidth="2" className="stroke-brand-teal" />
      <line x1="350" y1="20" x2="350" y2="360" strokeWidth="2" className="stroke-brand-teal" />
      <text x="150" y="12" textAnchor="middle" fontSize="8" className="fill-brand-teal" fontWeight="600">BAULK LINE</text>
      <text x="350" y="12" textAnchor="middle" fontSize="8" className="fill-brand-teal" fontWeight="600">BAULK LINE</text>

      {/* Bonus lines */}
      <line x1="160" y1="20" x2="160" y2="360" strokeWidth="1.5" strokeDasharray="5 3" className="stroke-brand-gold" />
      <line x1="340" y1="20" x2="340" y2="360" strokeWidth="1.5" strokeDasharray="5 3" className="stroke-brand-gold" />
      <text x="160" y="375" textAnchor="middle" fontSize="7" className="fill-brand-gold" fontWeight="600">BONUS LINE</text>
      <text x="340" y="375" textAnchor="middle" fontSize="7" className="fill-brand-gold" fontWeight="600">BONUS LINE</text>

      {/* Center circle */}
      <circle cx="250" cy="190" r="25" fill="none" strokeWidth="1.5" className="stroke-warm-400 dark:stroke-warm-500" />
      <circle cx="250" cy="190" r="3" className="fill-brand-red" />

      {/* Lobby areas */}
      <rect x="10" y="20" width="20" height="340" rx="2" fill="none" strokeDasharray="4 2" strokeWidth="1" className="stroke-warm-400/50 dark:stroke-warm-500/50" />
      <rect x="470" y="20" width="20" height="340" rx="2" fill="none" strokeDasharray="4 2" strokeWidth="1" className="stroke-warm-400/50 dark:stroke-warm-500/50" />
      <text x="20" y="200" textAnchor="middle" fontSize="6" className="fill-warm-400" transform="rotate(-90, 20, 200)">LOBBY</text>
      <text x="480" y="200" textAnchor="middle" fontSize="6" className="fill-warm-400" transform="rotate(90, 480, 200)">LOBBY</text>

      {/* Half labels */}
      <text x="140" y="200" textAnchor="middle" fontSize="14" className="fill-brand-red/40" fontWeight="800">HOME</text>
      <text x="360" y="200" textAnchor="middle" fontSize="14" className="fill-brand-teal/40" fontWeight="800">AWAY</text>

      {/* Dimensions */}
      <text x="250" y="340 + 30" textAnchor="middle" fontSize="8" className="fill-warm-400">13m × 10m (Standard Pro Kabaddi Court)</text>

      {/* Gradients */}
      <defs>
        <linearGradient id="homeGrad" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#DC2626" />
          <stop offset="100%" stopColor="#DC2626" stopOpacity="0" />
        </linearGradient>
        <linearGradient id="awayGrad" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#14B8A6" stopOpacity="0" />
          <stop offset="100%" stopColor="#14B8A6" />
        </linearGradient>
      </defs>
    </svg>
  );
}

// ─── Tutorial Step Illustration ───────────────────────────────────

function TutorialIllustration({ step }: { step: number }) {
  if (step === 1) {
    // The Raid - raider moving across
    return (
      <div className="relative w-full h-40 bg-gradient-to-r from-brand-red/5 to-brand-teal/5 rounded-xl overflow-hidden border border-warm-200 dark:border-warm-700">
        {/* Court lines */}
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="w-px h-full bg-warm-300 dark:bg-warm-600" />
        </div>
        <div className="absolute left-1/3 top-0 bottom-0 w-px bg-brand-teal/30" />
        <div className="absolute right-1/3 top-0 bottom-0 w-px bg-brand-teal/30" />
        {/* Raider */}
        <motion.div
          className="absolute top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-brand-red flex items-center justify-center shadow-lg shadow-brand-red/30"
          animate={{ left: ['10%', '75%', '10%'] }}
          transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
        >
          <Swords className="w-4 h-4 text-white" />
        </motion.div>
        {/* Defenders */}
        <div className="absolute right-[15%] top-[25%] w-6 h-6 rounded-full bg-brand-teal/60" />
        <div className="absolute right-[25%] top-[55%] w-6 h-6 rounded-full bg-brand-teal/60" />
        <div className="absolute right-[10%] top-[70%] w-6 h-6 rounded-full bg-brand-teal/60" />
        {/* Label */}
        <div className="absolute bottom-2 left-1/2 -translate-x-1/2">
          <Badge className="bg-brand-red/10 text-brand-red border-0 text-[9px]">RAIDER →</Badge>
        </div>
      </div>
    );
  }

  if (step === 2) {
    // Scoring Points
    return (
      <div className="relative w-full h-40 bg-gradient-to-r from-brand-gold/5 to-brand-red/5 rounded-xl overflow-hidden border border-warm-200 dark:border-warm-700">
        <div className="flex items-center justify-center h-full gap-4 px-4">
          {/* Touch points */}
          <motion.div
            className="flex flex-col items-center gap-1"
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.2, type: 'spring' }}
          >
            <div className="w-10 h-10 rounded-full bg-brand-gold/20 flex items-center justify-center border-2 border-brand-gold/40">
              <span className="text-brand-gold font-black text-sm">+1</span>
            </div>
            <span className="text-[9px] text-warm-500 font-semibold">Touch</span>
          </motion.div>
          <motion.div
            className="flex flex-col items-center gap-1"
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.4, type: 'spring' }}
          >
            <div className="w-10 h-10 rounded-full bg-brand-teal/20 flex items-center justify-center border-2 border-brand-teal/40">
              <span className="text-brand-teal font-black text-sm">+1</span>
            </div>
            <span className="text-[9px] text-warm-500 font-semibold">Bonus</span>
          </motion.div>
          <motion.div
            className="flex flex-col items-center gap-1"
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.6, type: 'spring' }}
          >
            <div className="w-10 h-10 rounded-full bg-brand-red/20 flex items-center justify-center border-2 border-brand-red/40">
              <span className="text-brand-red font-black text-sm">+2</span>
            </div>
            <span className="text-[9px] text-warm-500 font-semibold">All Out</span>
          </motion.div>
        </div>
      </div>
    );
  }

  if (step === 3) {
    // Defending
    return (
      <div className="relative w-full h-40 bg-gradient-to-r from-brand-teal/5 to-brand-navy/5 rounded-xl overflow-hidden border border-warm-200 dark:border-warm-700">
        {/* Defenders surrounding raider */}
        <div className="absolute inset-0 flex items-center justify-center">
          {/* Raider in center */}
          <motion.div
            className="w-10 h-10 rounded-full bg-brand-red flex items-center justify-center shadow-lg shadow-brand-red/30 z-10"
            animate={{ scale: [1, 0.9, 1] }}
            transition={{ duration: 1.5, repeat: Infinity }}
          >
            <Swords className="w-5 h-5 text-white" />
          </motion.div>
          {/* Defenders closing in */}
          <motion.div
            className="absolute w-7 h-7 rounded-full bg-brand-teal/70"
            animate={{ top: ['25%', '38%'], left: ['25%', '38%'] }}
            transition={{ duration: 1.5, repeat: Infinity, repeatType: 'reverse' }}
          />
          <motion.div
            className="absolute w-7 h-7 rounded-full bg-brand-teal/70"
            animate={{ top: ['25%', '38%'], right: ['25%', '38%'] }}
            transition={{ duration: 1.5, repeat: Infinity, repeatType: 'reverse' }}
          />
          <motion.div
            className="absolute w-7 h-7 rounded-full bg-brand-teal/70"
            animate={{ bottom: ['25%', '38%'], left: ['25%', '38%'] }}
            transition={{ duration: 1.5, repeat: Infinity, repeatType: 'reverse' }}
          />
          <motion.div
            className="absolute w-7 h-7 rounded-full bg-brand-teal/70"
            animate={{ bottom: ['25%', '38%'], right: ['25%', '38%'] }}
            transition={{ duration: 1.5, repeat: Infinity, repeatType: 'reverse' }}
          />
        </div>
        <div className="absolute bottom-2 left-1/2 -translate-x-1/2">
          <Badge className="bg-brand-teal/10 text-brand-teal border-0 text-[9px]">TACKLE FORMATION</Badge>
        </div>
      </div>
    );
  }

  // Step 4: All Out
  return (
    <div className="relative w-full h-40 bg-gradient-to-r from-brand-navy/5 to-brand-red/5 rounded-xl overflow-hidden border border-warm-200 dark:border-warm-700">
      <div className="absolute inset-0 flex items-center justify-center">
        <motion.div
          className="text-center"
          initial={{ scale: 0.5, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: 'spring', damping: 12 }}
        >
          <div className="relative">
            <motion.div
              className="text-4xl font-black text-brand-red"
              animate={{ scale: [1, 1.2, 1] }}
              transition={{ duration: 1.5, repeat: Infinity }}
            >
              ALL OUT!
            </motion.div>
            <motion.div
              className="absolute -inset-4 rounded-xl bg-brand-red/10"
              animate={{ opacity: [0.3, 0.6, 0.3] }}
              transition={{ duration: 1.5, repeat: Infinity }}
            />
          </div>
          <Badge className="mt-2 bg-brand-gold/10 text-brand-gold border-0 text-[9px]">+2 BONUS POINTS</Badge>
          <p className="text-[10px] text-warm-500 mt-1">All 7 defenders out → Revival</p>
        </motion.div>
      </div>
    </div>
  );
}

// ─── Main Component ──────────────────────────────────────────────

export default function KabaddiRulesScreen({ onClose }: KabaddiRulesScreenProps) {
  const [activeSection, setActiveSection] = useState<string>('intro');

  const sections = [
    { id: 'intro', label: 'Intro', icon: BookOpen },
    { id: 'rules', label: 'Rules', icon: Shield },
    { id: 'tutorial', label: 'Tutorial', icon: Zap },
    { id: 'glossary', label: 'Glossary', icon: BookOpen },
  ];

  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      transition={{ duration: 0.3 }}
      className="fixed inset-0 z-50 bg-warm-50 dark:bg-warm-900 overflow-y-auto custom-scrollbar"
    >
      {/* Header */}
      <div className="sticky top-0 z-10 flex items-center justify-between px-4 py-3 border-b border-warm-200 dark:border-warm-700 bg-warm-50/95 dark:bg-warm-900/95 backdrop-blur-sm">
        <Button variant="ghost" size="sm" onClick={onClose} className="flex items-center gap-1 -ml-2">
          <ChevronLeft className="w-4 h-4" />
          <span className="text-sm">Back</span>
        </Button>
        <h2 className="text-sm font-bold text-warm-800 dark:text-warm-100 flex items-center gap-1.5">
          <BookOpen className="w-4 h-4 text-brand-red" />
          Rules & Tutorial
        </h2>
        <div className="w-14" /> {/* Spacer for centering */}
      </div>

      {/* Section Tabs */}
      <div className="sticky top-[53px] z-10 bg-warm-50/95 dark:bg-warm-900/95 backdrop-blur-sm border-b border-warm-200/60 dark:border-warm-700/40">
        <div className="flex gap-1 px-4 py-2 overflow-x-auto">
          {sections.map((section) => {
            const Icon = section.icon;
            const isActive = activeSection === section.id;
            return (
              <button
                key={section.id}
                onClick={() => setActiveSection(section.id)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all duration-200 ${
                  isActive
                    ? 'bg-brand-red text-white shadow-md shadow-brand-red/20'
                    : 'bg-warm-100 dark:bg-warm-800 text-warm-600 dark:text-warm-400 hover:bg-warm-200 dark:hover:bg-warm-700'
                }`}
              >
                <Icon className="w-3 h-3" />
                {section.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Content */}
      <div className="px-4 py-4 pb-8">
        <AnimatePresence mode="wait">
          {activeSection === 'intro' && (
            <motion.div
              key="intro"
              variants={containerVariants}
              initial="hidden"
              animate="visible"
              exit={{ opacity: 0, y: -10 }}
              className="space-y-5"
            >
              {/* Animated Court Illustration */}
              <motion.div variants={itemVariants}>
                <Card className="overflow-hidden border-0 shadow-sm bg-gradient-to-br from-warm-50 to-warm-100 dark:from-warm-800 dark:to-warm-900">
                  <CardContent className="p-4">
                    <KabaddiCourtSVG animated />
                  </CardContent>
                </Card>
              </motion.div>

              {/* What is Kabaddi? */}
              <motion.div variants={itemVariants}>
                <Card className="overflow-hidden border-0 shadow-sm card-elevated">
                  <CardContent className="p-5">
                    <div className="flex items-center gap-2 mb-3">
                      <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-brand-red to-brand-red-dark flex items-center justify-center">
                        <Swords className="w-4 h-4 text-white" />
                      </div>
                      <h3 className="text-lg font-bold gradient-text">What is Kabaddi?</h3>
                    </div>
                    <p className="text-sm text-warm-600 dark:text-warm-400 leading-relaxed">
                      Kabaddi is an ancient Indian contact team sport played between two teams of seven players.
                      The objective is for a single player on offense (a <strong className="text-brand-red">raider</strong>) to
                      run into the opposing team&apos;s half of the court, touch out as many defenders as possible,
                      and return to their own half—all while chanting &quot;Kabaddi&quot; without breaking breath.
                    </p>
                    <p className="text-sm text-warm-600 dark:text-warm-400 leading-relaxed mt-3">
                      It is one of India&apos;s fastest-growing professional sports, with the Pro Kabaddi League
                      attracting millions of viewers worldwide since its inception in 2014.
                    </p>
                  </CardContent>
                </Card>
              </motion.div>

              {/* Key Facts */}
              <motion.div variants={itemVariants}>
                <h4 className="text-sm font-bold text-warm-800 dark:text-warm-100 mb-3 flex items-center gap-1.5">
                  <Star className="w-4 h-4 text-brand-gold" />
                  Key Facts
                </h4>
                <div className="grid grid-cols-2 gap-3">
                  {KEY_FACTS.map((fact, idx) => {
                    const Icon = fact.icon;
                    return (
                      <motion.div
                        key={fact.label}
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ delay: 0.15 + idx * 0.08 }}
                      >
                        <Card className="p-3 border-0 shadow-sm hover:shadow-md transition-all duration-200 bg-gradient-to-br from-warm-50 to-warm-100 dark:from-warm-800 dark:to-warm-900">
                          <div className="flex items-center gap-2 mb-1.5">
                            <div className={`w-7 h-7 rounded-md bg-warm-200/60 dark:bg-warm-700/60 flex items-center justify-center`}>
                              <Icon className={`w-3.5 h-3.5 ${fact.color}`} />
                            </div>
                            <span className="text-[10px] font-medium text-warm-500 dark:text-warm-400 uppercase tracking-wide">{fact.label}</span>
                          </div>
                          <p className="text-sm font-bold text-warm-800 dark:text-warm-100">{fact.value}</p>
                        </Card>
                      </motion.div>
                    );
                  })}
                </div>
              </motion.div>
            </motion.div>
          )}

          {activeSection === 'rules' && (
            <motion.div
              key="rules"
              variants={containerVariants}
              initial="hidden"
              animate="visible"
              exit={{ opacity: 0, y: -10 }}
              className="space-y-4"
            >
              <Accordion type="multiple" defaultValue={['basic-rules']} className="space-y-2">

                {/* Basic Rules */}
                <motion.div variants={itemVariants}>
                  <Card className="overflow-hidden border-0 shadow-sm">
                    <AccordionItem value="basic-rules" className="border-0">
                      <AccordionTrigger className="px-4 py-3 hover:no-underline hover:bg-warm-50 dark:hover:bg-warm-800/50 transition-colors">
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-lg bg-brand-red/10 flex items-center justify-center">
                            <Swords className="w-4 h-4 text-brand-red" />
                          </div>
                          <div className="text-left">
                            <p className="text-sm font-bold text-warm-800 dark:text-warm-100">Basic Rules</p>
                            <p className="text-[10px] text-warm-500">Raid mechanics, scoring & lob</p>
                          </div>
                        </div>
                      </AccordionTrigger>
                      <AccordionContent className="px-4 pb-4">
                        <div className="space-y-3">
                          <div className="flex gap-2.5">
                            <div className="w-1.5 h-1.5 rounded-full bg-brand-red mt-1.5 shrink-0" />
                            <div>
                              <p className="text-xs font-semibold text-warm-800 dark:text-warm-100">Raid Mechanics</p>
                              <p className="text-xs text-warm-600 dark:text-warm-400 mt-0.5">A raider must enter the opponent&apos;s half, chant &quot;Kabaddi&quot; continuously, and return to their half within 30 seconds to score.</p>
                            </div>
                          </div>
                          <div className="flex gap-2.5">
                            <div className="w-1.5 h-1.5 rounded-full bg-brand-red mt-1.5 shrink-0" />
                            <div>
                              <p className="text-xs font-semibold text-warm-800 dark:text-warm-100">Scoring</p>
                              <p className="text-xs text-warm-600 dark:text-warm-400 mt-0.5">The raider scores 1 point for each defender touched and successfully returned. The defending team scores 1 point for a successful tackle.</p>
                            </div>
                          </div>
                          <div className="flex gap-2.5">
                            <div className="w-1.5 h-1.5 rounded-full bg-brand-red mt-1.5 shrink-0" />
                            <div>
                              <p className="text-xs font-semibold text-warm-800 dark:text-warm-100">Lob</p>
                              <p className="text-xs text-warm-600 dark:text-warm-400 mt-0.5">An escape technique where the raider jumps over a crouching defender to avoid being tackled and return to their half.</p>
                            </div>
                          </div>
                          <div className="flex gap-2.5">
                            <div className="w-1.5 h-1.5 rounded-full bg-brand-red mt-1.5 shrink-0" />
                            <div>
                              <p className="text-xs font-semibold text-warm-800 dark:text-warm-100">Bonus Line</p>
                              <p className="text-xs text-warm-600 dark:text-warm-400 mt-0.5">If a raider puts one foot beyond the bonus line (with 6+ defenders present), they earn 1 bonus point even if they don&apos;t touch any defender.</p>
                            </div>
                          </div>
                        </div>
                      </AccordionContent>
                    </AccordionItem>
                  </Card>
                </motion.div>

                {/* Scoring System */}
                <motion.div variants={itemVariants}>
                  <Card className="overflow-hidden border-0 shadow-sm">
                    <AccordionItem value="scoring-system" className="border-0">
                      <AccordionTrigger className="px-4 py-3 hover:no-underline hover:bg-warm-50 dark:hover:bg-warm-800/50 transition-colors">
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-lg bg-brand-gold/10 flex items-center justify-center">
                            <Trophy className="w-4 h-4 text-brand-gold" />
                          </div>
                          <div className="text-left">
                            <p className="text-sm font-bold text-warm-800 dark:text-warm-100">Scoring System</p>
                            <p className="text-[10px] text-warm-500">Points breakdown & special scoring</p>
                          </div>
                        </div>
                      </AccordionTrigger>
                      <AccordionContent className="px-4 pb-4">
                        <div className="space-y-2">
                          {[
                            { label: 'Raid Point', value: '+1', desc: 'Each defender touched and returned', color: 'bg-brand-red/10 text-brand-red' },
                            { label: 'Bonus Point', value: '+1', desc: 'Crossing bonus line with 6+ defenders', color: 'bg-brand-gold/10 text-brand-gold' },
                            { label: 'Tackle Point', value: '+1', desc: 'Successfully tackling the raider', color: 'bg-brand-teal/10 text-brand-teal' },
                            { label: 'All Out', value: '+2', desc: 'All 7 defenders eliminated', color: 'bg-brand-red/10 text-brand-red' },
                            { label: 'Super Tackle', value: '+2', desc: '3 or fewer defenders tackle the raider', color: 'bg-brand-teal/10 text-brand-teal' },
                            { label: 'Super Raid', value: '3+ pts', desc: 'Raider scores 3+ points in one raid', color: 'bg-brand-gold/10 text-brand-gold' },
                            { label: 'Do-or-Die Raid', value: '+1 or -1', desc: '3rd empty raid: must score or lose a point', color: 'bg-brand-navy/10 text-brand-navy dark:text-brand-navy-light' },
                          ].map((item, idx) => (
                            <div key={idx} className="flex items-start gap-2.5 p-2 rounded-lg bg-warm-50 dark:bg-warm-800/50">
                              <Badge className={`${item.color} border-0 text-[10px] font-black px-1.5 py-0 shrink-0`}>
                                {item.value}
                              </Badge>
                              <div>
                                <p className="text-xs font-semibold text-warm-800 dark:text-warm-100">{item.label}</p>
                                <p className="text-[10px] text-warm-500 dark:text-warm-400">{item.desc}</p>
                              </div>
                            </div>
                          ))}
                        </div>
                      </AccordionContent>
                    </AccordionItem>
                  </Card>
                </motion.div>

                {/* Match Format */}
                <motion.div variants={itemVariants}>
                  <Card className="overflow-hidden border-0 shadow-sm">
                    <AccordionItem value="match-format" className="border-0">
                      <AccordionTrigger className="px-4 py-3 hover:no-underline hover:bg-warm-50 dark:hover:bg-warm-800/50 transition-colors">
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-lg bg-brand-teal/10 flex items-center justify-center">
                            <Timer className="w-4 h-4 text-brand-teal" />
                          </div>
                          <div className="text-left">
                            <p className="text-sm font-bold text-warm-800 dark:text-warm-100">Match Format</p>
                            <p className="text-[10px] text-warm-500">Halves, duration & timeouts</p>
                          </div>
                        </div>
                      </AccordionTrigger>
                      <AccordionContent className="px-4 pb-4">
                        <div className="space-y-3">
                          <div className="flex gap-2.5">
                            <div className="w-1.5 h-1.5 rounded-full bg-brand-teal mt-1.5 shrink-0" />
                            <div>
                              <p className="text-xs font-semibold text-warm-800 dark:text-warm-100">Two Halves</p>
                              <p className="text-xs text-warm-600 dark:text-warm-400 mt-0.5">A match consists of two halves of 20 minutes each, with a 5-minute half-time break.</p>
                            </div>
                          </div>
                          <div className="flex gap-2.5">
                            <div className="w-1.5 h-1.5 rounded-full bg-brand-teal mt-1.5 shrink-0" />
                            <div>
                              <p className="text-xs font-semibold text-warm-800 dark:text-warm-100">Timeouts</p>
                              <p className="text-xs text-warm-600 dark:text-warm-400 mt-0.5">Each team is allowed 1 timeout per half (30 seconds each). Timeouts cannot be carried over.</p>
                            </div>
                          </div>
                          <div className="flex gap-2.5">
                            <div className="w-1.5 h-1.5 rounded-full bg-brand-teal mt-1.5 shrink-0" />
                            <div>
                              <p className="text-xs font-semibold text-warm-800 dark:text-warm-100">Half Duration</p>
                              <p className="text-xs text-warm-600 dark:text-warm-400 mt-0.5">Standard Pro Kabaddi matches have 20-minute halves. Practice matches may use shorter durations.</p>
                            </div>
                          </div>
                          <div className="flex gap-2.5">
                            <div className="w-1.5 h-1.5 rounded-full bg-brand-teal mt-1.5 shrink-0" />
                            <div>
                              <p className="text-xs font-semibold text-warm-800 dark:text-warm-100">Result</p>
                              <p className="text-xs text-warm-600 dark:text-warm-400 mt-0.5">The team with the most points at the end of the match wins. If scores are tied, a tie-breaker may be played.</p>
                            </div>
                          </div>
                        </div>
                      </AccordionContent>
                    </AccordionItem>
                  </Card>
                </motion.div>

                {/* Player Positions */}
                <motion.div variants={itemVariants}>
                  <Card className="overflow-hidden border-0 shadow-sm">
                    <AccordionItem value="player-positions" className="border-0">
                      <AccordionTrigger className="px-4 py-3 hover:no-underline hover:bg-warm-50 dark:hover:bg-warm-800/50 transition-colors">
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-lg bg-brand-navy/10 dark:bg-brand-navy-light/10 flex items-center justify-center">
                            <Users className="w-4 h-4 text-brand-navy dark:text-brand-navy-light" />
                          </div>
                          <div className="text-left">
                            <p className="text-sm font-bold text-warm-800 dark:text-warm-100">Player Positions</p>
                            <p className="text-[10px] text-warm-500">Raider, defender & all-rounder</p>
                          </div>
                        </div>
                      </AccordionTrigger>
                      <AccordionContent className="px-4 pb-4">
                        <div className="space-y-3">
                          <div className="p-3 rounded-xl bg-gradient-to-br from-brand-red/10 to-brand-red/5 border border-brand-red/10">
                            <div className="flex items-center gap-2 mb-1.5">
                              <Swords className="w-4 h-4 text-brand-red" />
                              <p className="text-sm font-bold text-brand-red">Raider</p>
                            </div>
                            <p className="text-xs text-warm-600 dark:text-warm-400">The attacking player who enters the opponent&apos;s half to touch defenders. Raiders need speed, agility, and the ability to chant &quot;Kabaddi&quot; continuously. Positions include Left Raider, Right Raider, and Both Raider.</p>
                          </div>
                          <div className="p-3 rounded-xl bg-gradient-to-br from-brand-teal/10 to-brand-teal/5 border border-brand-teal/10">
                            <div className="flex items-center gap-2 mb-1.5">
                              <Shield className="w-4 h-4 text-brand-teal" />
                              <p className="text-sm font-bold text-brand-teal">Defender</p>
                            </div>
                            <p className="text-xs text-warm-600 dark:text-warm-400">Players who try to tackle the raider and prevent them from returning. Positions include Left Corner, Right Corner, Left Cover, and Right Cover. Corners are typically the main tacklers.</p>
                          </div>
                          <div className="p-3 rounded-xl bg-gradient-to-br from-brand-gold/10 to-brand-gold/5 border border-brand-gold/10">
                            <div className="flex items-center gap-2 mb-1.5">
                              <Star className="w-4 h-4 text-brand-gold" />
                              <p className="text-sm font-bold text-brand-gold">All-Rounder</p>
                            </div>
                            <p className="text-xs text-warm-600 dark:text-warm-400">Versatile players who excel at both raiding and defending. They can be deployed in any position and are crucial for team strategy and flexibility.</p>
                          </div>
                        </div>
                      </AccordionContent>
                    </AccordionItem>
                  </Card>
                </motion.div>

                {/* Cards & Penalties */}
                <motion.div variants={itemVariants}>
                  <Card className="overflow-hidden border-0 shadow-sm">
                    <AccordionItem value="cards-penalties" className="border-0">
                      <AccordionTrigger className="px-4 py-3 hover:no-underline hover:bg-warm-50 dark:hover:bg-warm-800/50 transition-colors">
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-lg bg-yellow-500/10 flex items-center justify-center">
                            <AlertTriangle className="w-4 h-4 text-yellow-500" />
                          </div>
                          <div className="text-left">
                            <p className="text-sm font-bold text-warm-800 dark:text-warm-100">Cards & Penalties</p>
                            <p className="text-[10px] text-warm-500">Disciplinary actions</p>
                          </div>
                        </div>
                      </AccordionTrigger>
                      <AccordionContent className="px-4 pb-4">
                        <div className="space-y-3">
                          <div className="flex items-start gap-3 p-2.5 rounded-lg bg-green-500/5 border border-green-500/10">
                            <div className="w-8 h-10 rounded bg-green-500 flex items-center justify-center shrink-0">
                              <span className="text-white text-xs font-black">GREEN</span>
                            </div>
                            <div>
                              <p className="text-xs font-bold text-warm-800 dark:text-warm-100">Green Card</p>
                              <p className="text-[10px] text-warm-500 dark:text-warm-400">Warning card for minor offenses. The player may continue playing but is warned about their conduct.</p>
                            </div>
                          </div>
                          <div className="flex items-start gap-3 p-2.5 rounded-lg bg-yellow-500/5 border border-yellow-500/10">
                            <div className="w-8 h-10 rounded bg-yellow-500 flex items-center justify-center shrink-0">
                              <span className="text-white text-xs font-black">YELLOW</span>
                            </div>
                            <div>
                              <p className="text-xs font-bold text-warm-800 dark:text-warm-100">Yellow Card</p>
                              <p className="text-[10px] text-warm-500 dark:text-warm-400">2-minute suspension for repeated or more serious offenses. The team plays with one less player during suspension.</p>
                            </div>
                          </div>
                          <div className="flex items-start gap-3 p-2.5 rounded-lg bg-red-500/5 border border-red-500/10">
                            <div className="w-8 h-10 rounded bg-red-500 flex items-center justify-center shrink-0">
                              <span className="text-white text-xs font-black">RED</span>
                            </div>
                            <div>
                              <p className="text-xs font-bold text-warm-800 dark:text-warm-100">Red Card</p>
                              <p className="text-[10px] text-warm-500 dark:text-warm-400">Player is sent off for the rest of the match for severe foul play or violent conduct. The team cannot substitute the player.</p>
                            </div>
                          </div>
                        </div>
                      </AccordionContent>
                    </AccordionItem>
                  </Card>
                </motion.div>

                {/* Court Layout */}
                <motion.div variants={itemVariants}>
                  <Card className="overflow-hidden border-0 shadow-sm">
                    <AccordionItem value="court-layout" className="border-0">
                      <AccordionTrigger className="px-4 py-3 hover:no-underline hover:bg-warm-50 dark:hover:bg-warm-800/50 transition-colors">
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-lg bg-brand-teal/10 flex items-center justify-center">
                            <Crosshair className="w-4 h-4 text-brand-teal" />
                          </div>
                          <div className="text-left">
                            <p className="text-sm font-bold text-warm-800 dark:text-warm-100">Court Layout</p>
                            <p className="text-[10px] text-warm-500">Diagram with labeled areas</p>
                          </div>
                        </div>
                      </AccordionTrigger>
                      <AccordionContent className="px-4 pb-4">
                        <CourtLayoutSVG />
                        <div className="mt-3 space-y-1.5">
                          <div className="flex items-center gap-2 text-[10px]">
                            <div className="w-3 h-0.5 bg-brand-red rounded" />
                            <span className="text-warm-600 dark:text-warm-400"><strong className="text-brand-red">Midline</strong> — divides court into two halves</span>
                          </div>
                          <div className="flex items-center gap-2 text-[10px]">
                            <div className="w-3 h-0.5 bg-brand-teal rounded" />
                            <span className="text-warm-600 dark:text-warm-400"><strong className="text-brand-teal">Baulk Line</strong> — raider must cross to enter opponent&apos;s side</span>
                          </div>
                          <div className="flex items-center gap-2 text-[10px]">
                            <div className="w-3 h-0.5 bg-brand-gold rounded" style={{ borderTop: '1px dashed', height: 0 }} />
                            <span className="text-warm-600 dark:text-warm-400"><strong className="text-brand-gold">Bonus Line</strong> — crossing earns bonus point (6+ defenders)</span>
                          </div>
                          <div className="flex items-center gap-2 text-[10px]">
                            <div className="w-3 h-0.5 bg-warm-400/50 rounded" style={{ borderTop: '1px dashed', height: 0 }} />
                            <span className="text-warm-600 dark:text-warm-400"><strong className="text-warm-500">Lobby</strong> — out of bounds area on the sides</span>
                          </div>
                        </div>
                      </AccordionContent>
                    </AccordionItem>
                  </Card>
                </motion.div>
              </Accordion>
            </motion.div>
          )}

          {activeSection === 'tutorial' && (
            <motion.div
              key="tutorial"
              variants={containerVariants}
              initial="hidden"
              animate="visible"
              exit={{ opacity: 0, y: -10 }}
            >
              <motion.div variants={itemVariants} className="mb-4">
                <Card className="overflow-hidden border-0 shadow-sm bg-gradient-to-br from-brand-red/5 via-warm-50 to-brand-gold/5 dark:from-brand-red/5 dark:via-warm-800 dark:to-brand-gold/5">
                  <CardContent className="p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <Zap className="w-5 h-5 text-brand-gold" />
                      <h3 className="text-base font-bold gradient-text">Interactive Tutorial</h3>
                    </div>
                    <p className="text-xs text-warm-500 dark:text-warm-400">Step through the basics of Kabaddi at your own pace.</p>
                  </CardContent>
                </Card>
              </motion.div>

              <motion.div variants={itemVariants}>
                <Carousel opts={{ align: 'start' }} className="w-full">
                  <CarouselContent>
                    {TUTORIAL_STEPS.map((step) => (
                      <CarouselItem key={step.step}>
                        <Card className="overflow-hidden border-0 shadow-sm min-h-[400px]">
                          <CardContent className="p-5">
                            {/* Step indicator */}
                            <div className="flex items-center gap-2 mb-4">
                              <div className={`w-8 h-8 rounded-full bg-gradient-to-br ${step.color} flex items-center justify-center border border-warm-200 dark:border-warm-700`}>
                                <span className={`text-xs font-black ${step.iconColor}`}>{step.step}</span>
                              </div>
                              <div>
                                <p className="text-sm font-bold text-warm-800 dark:text-warm-100">{step.title}</p>
                                <p className="text-[10px] text-warm-500">Step {step.step} of 4</p>
                              </div>
                            </div>

                            {/* Progress bar */}
                            <div className="w-full h-1.5 bg-warm-200 dark:bg-warm-700 rounded-full mb-4 overflow-hidden">
                              <motion.div
                                className={`h-full rounded-full ${
                                  step.step === 1 ? 'bg-brand-red' :
                                  step.step === 2 ? 'bg-brand-gold' :
                                  step.step === 3 ? 'bg-brand-teal' :
                                  'bg-brand-navy dark:bg-brand-navy-light'
                                }`}
                                initial={{ width: 0 }}
                                animate={{ width: `${(step.step / 4) * 100}%` }}
                                transition={{ duration: 0.5 }}
                              />
                            </div>

                            {/* Illustration */}
                            <TutorialIllustration step={step.step} />

                            {/* Description */}
                            <p className="text-sm text-warm-600 dark:text-warm-400 mt-4 leading-relaxed">
                              {step.description}
                            </p>

                            {/* Highlight box */}
                            <div className={`mt-3 p-2.5 rounded-lg bg-gradient-to-r ${step.color} border border-warm-200/50 dark:border-warm-700/50`}>
                              <div className="flex items-center gap-1.5">
                                <Flame className={`w-3.5 h-3.5 ${step.iconColor}`} />
                                <p className={`text-xs font-semibold ${step.iconColor}`}>{step.highlight}</p>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      </CarouselItem>
                    ))}
                  </CarouselContent>
                  <CarouselPrevious className="left-0 -translate-x-1/2" />
                  <CarouselNext className="right-0 translate-x-1/2" />
                </Carousel>
              </motion.div>

              {/* Quick tip */}
              <motion.div variants={itemVariants} className="mt-4">
                <Card className="overflow-hidden border-0 shadow-sm bg-gradient-to-r from-brand-gold/10 to-brand-red/10 dark:from-brand-gold/5 dark:to-brand-red/5">
                  <CardContent className="p-4">
                    <div className="flex items-start gap-2.5">
                      <Activity className="w-4 h-4 text-brand-gold mt-0.5 shrink-0" />
                      <div>
                        <p className="text-xs font-bold text-warm-800 dark:text-warm-100">Pro Tip</p>
                        <p className="text-[10px] text-warm-500 dark:text-warm-400 mt-0.5">Swipe through the steps or use the arrow buttons to navigate the tutorial. Take your time to understand each concept!</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            </motion.div>
          )}

          {activeSection === 'glossary' && (
            <motion.div
              key="glossary"
              variants={containerVariants}
              initial="hidden"
              animate="visible"
              exit={{ opacity: 0, y: -10 }}
              className="space-y-3"
            >
              <motion.div variants={itemVariants}>
                <div className="flex items-center gap-2 mb-3">
                  <BookOpen className="w-4 h-4 text-brand-teal" />
                  <h3 className="text-base font-bold text-warm-800 dark:text-warm-100">Kabaddi Glossary</h3>
                  <Badge className="bg-brand-teal/10 text-brand-teal border-0 text-[9px]">
                    {GLOSSARY_TERMS.length} terms
                  </Badge>
                </div>
              </motion.div>

              <motion.div
                variants={containerVariants}
                initial="hidden"
                animate="visible"
                className="space-y-2 max-h-[calc(100vh-250px)] overflow-y-auto custom-scrollbar pr-1"
              >
                {GLOSSARY_TERMS.map((item, idx) => (
                  <motion.div key={item.term} variants={itemVariants}>
                    <Card className="overflow-hidden border-0 shadow-sm hover:shadow-md transition-all duration-200">
                      <CardContent className="p-3">
                        <div className="flex items-start gap-2.5">
                          <div className={`w-6 h-6 rounded-md shrink-0 flex items-center justify-center text-[10px] font-black text-white ${
                            idx % 4 === 0 ? 'bg-brand-red' :
                            idx % 4 === 1 ? 'bg-brand-teal' :
                            idx % 4 === 2 ? 'bg-brand-gold' :
                            'bg-brand-navy dark:bg-brand-navy-light'
                          }`}>
                            {item.term.charAt(0)}
                          </div>
                          <div>
                            <p className="text-xs font-bold text-warm-800 dark:text-warm-100">{item.term}</p>
                            <p className="text-[11px] text-warm-600 dark:text-warm-400 mt-0.5 leading-relaxed">{item.definition}</p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </motion.div>
                ))}
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}
