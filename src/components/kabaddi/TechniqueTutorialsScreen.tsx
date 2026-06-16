'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowLeft,
  Swords,
  Shield,
  Star,
  ChevronDown,
  ChevronUp,
  Footprints,
  Hand,
  UserCheck,
  Crosshair,
  Zap,
  Flame,
  Move,
  Target,
  Dumbbell,
  Eye,
  ArrowRight,
  CheckCircle2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';

// ─── Types ────────────────────────────────────────────────────────

interface TechniqueTutorialsScreenProps {
  onBack: () => void;
}

type TutorialCategory = 'raiding' | 'defense' | 'allround';
type Difficulty = 'beginner' | 'intermediate' | 'advanced';

interface TutorialStep {
  title: string;
  description: string;
  icon: typeof Footprints;
}

interface Tutorial {
  id: string;
  title: string;
  description: string;
  category: TutorialCategory;
  difficulty: Difficulty;
  steps: TutorialStep[];
}

// ─── Difficulty Config ────────────────────────────────────────────

const DIFFICULTY_CONFIG: Record<Difficulty, { label: string; color: string; bgColor: string; borderColor: string }> = {
  beginner: { label: 'Beginner', color: 'text-green-600 dark:text-green-400', bgColor: 'bg-green-50 dark:bg-green-900/20', borderColor: 'border-green-200 dark:border-green-800' },
  intermediate: { label: 'Intermediate', color: 'text-amber-600 dark:text-amber-400', bgColor: 'bg-amber-50 dark:bg-amber-900/20', borderColor: 'border-amber-200 dark:border-amber-800' },
  advanced: { label: 'Advanced', color: 'text-red-600 dark:text-red-400', bgColor: 'bg-red-50 dark:bg-red-900/20', borderColor: 'border-red-200 dark:border-red-800' },
};

// ─── Category Config ──────────────────────────────────────────────

const CATEGORY_CONFIG: Record<TutorialCategory, { label: string; icon: typeof Swords; color: string; bgColor: string }> = {
  raiding: { label: 'Raiding Techniques', icon: Swords, color: 'text-brand-red', bgColor: 'bg-brand-red/10' },
  defense: { label: 'Defense Techniques', icon: Shield, color: 'text-emerald-600 dark:text-emerald-400', bgColor: 'bg-emerald-50 dark:bg-emerald-900/20' },
  allround: { label: 'All-Round Skills', icon: Star, color: 'text-brand-gold', bgColor: 'bg-brand-gold/10' },
};

// ─── Tutorials Data ───────────────────────────────────────────────

const TUTORIALS: Tutorial[] = [
  // ─── Raiding Techniques ──────────────────────────────────────
  {
    id: 'toe-touch',
    title: 'Toe Touch',
    description: 'A fundamental raiding technique where you extend your leg to touch a defender and quickly retreat to your half.',
    category: 'raiding',
    difficulty: 'beginner',
    steps: [
      { title: 'Approach with Speed', description: 'Sprint towards the defender with controlled speed. Keep your body low and balanced.', icon: Zap },
      { title: 'Extend Your Leg', description: 'As you get close, extend your lead leg towards the defender. Keep your body leaning back for balance.', icon: Footprints },
      { title: 'Make Contact', description: 'Touch the defender with your toe — even a slight touch counts as a successful raid point.', icon: Target },
      { title: 'Retreat Quickly', description: 'Pull your leg back immediately and sprint to your half. Speed of retreat is crucial to avoid being tackled.', icon: Move },
      { title: 'Practice Timing', description: 'Practice the extension and retreat rhythm. The entire move should take less than 2 seconds.', icon: Dumbbell },
    ],
  },
  {
    id: 'hand-touch',
    title: 'Hand Touch',
    description: 'A quick raiding move using your hand to touch a defender, ideal for targeting defenders near the boundary.',
    category: 'raiding',
    difficulty: 'beginner',
    steps: [
      { title: 'Position Yourself', description: 'Approach the defender at an angle rather than head-on. This gives you more escape routes.', icon: Target },
      { title: 'Stretch Your Arm', description: 'Extend your arm fully towards the defender. Keep your other arm free for balance.', icon: Hand },
      { title: 'Touch and Withdraw', description: 'Make a quick touch and immediately pull your arm back. The key is speed — touch and go.', icon: Zap },
      { title: 'Use Body Feint', description: 'Before touching, use a body feint to confuse the defender about your target direction.', icon: Eye },
      { title: 'Practice Combinations', description: 'Combine hand touches with toe touches to become an unpredictable raider.', icon: Dumbbell },
    ],
  },
  {
    id: 'scorpion-kick',
    title: 'Scorpion Kick',
    description: 'An advanced technique where you kick backward like a scorpion to touch a defender behind you while retreating.',
    category: 'raiding',
    difficulty: 'advanced',
    steps: [
      { title: 'Create Space', description: 'Move past the defender first, creating a small gap between you and them.', icon: Move },
      { title: 'Look Over Shoulder', description: 'Glance back to locate the defender\'s position. Peripheral awareness is key.', icon: Eye },
      { title: 'Kick Backward', description: 'Swing your leg backward in an arc, aiming to touch the defender with your heel or toe.', icon: Footprints },
      { title: 'Maintain Balance', description: 'Keep your core tight and arms out for balance. The backward kick can throw you off balance.', icon: Dumbbell },
      { title: 'Continue Retreat', description: 'After the kick, immediately continue your retreat. Don\'t pause to check if you scored.', icon: Zap },
    ],
  },
  {
    id: 'frog-jump',
    title: 'Frog Jump',
    description: 'An acrobatic technique where you jump over crouching defenders with legs spread wide to escape a tackle.',
    category: 'raiding',
    difficulty: 'intermediate',
    steps: [
      { title: 'Read the Defense', description: 'Identify when defenders are crouching low preparing to grab your legs.', icon: Eye },
      { title: 'Build Momentum', description: 'Approach with enough speed to generate the power needed for a jump.', icon: Zap },
      { title: 'Leap with Spread Legs', description: 'Jump high while spreading your legs wide — like a frog. This clears the crouching defenders.', icon: Footprints },
      { title: 'Land Safely', description: 'Aim to land on both feet in your half of the court. Bend your knees to absorb impact.', icon: Target },
      { title: 'Build Leg Strength', description: 'This move requires strong legs. Practice squat jumps and box jumps off the mat.', icon: Dumbbell },
    ],
  },
  {
    id: 'running-hand-touch',
    title: 'Running Hand Touch',
    description: 'A high-speed variant of hand touch where you touch a defender while sprinting at full pace.',
    category: 'raiding',
    difficulty: 'intermediate',
    steps: [
      { title: 'Full Sprint Approach', description: 'Run at maximum speed towards the defender\'s side. Speed is your primary weapon here.', icon: Zap },
      { title: 'Target the Edge', description: 'Aim for the defender closest to the boundary — they have the least room to chase you.', icon: Target },
      { title: 'Touch at Speed', description: 'Extend your arm and make contact while maintaining your running speed. Don\'t slow down.', icon: Hand },
      { title: 'Curve Your Run', description: 'After the touch, curve your run back toward your half. This creates distance from other defenders.', icon: Move },
      { title: 'Practice at Game Speed', description: 'This technique only works at full speed. Practice with defenders who are trying to catch you.', icon: Dumbbell },
    ],
  },
  {
    id: 'bonus-point-technique',
    title: 'Bonus Point Technique',
    description: 'How to consistently score bonus points by crossing the bonus line with proper technique when 6+ defenders are on court.',
    category: 'raiding',
    difficulty: 'beginner',
    steps: [
      { title: 'Check Defender Count', description: 'Before raiding, check that 6 or more defenders are on the court. Bonus is only available then.', icon: Eye },
      { title: 'Approach the Bonus Line', description: 'Move towards the bonus line area. It\'s located 1 meter from the baulk line.', icon: Target },
      { title: 'Cross with Foot Down', description: 'Cross the bonus line with one foot touching the ground in the opponents\' area. This earns 1 point.', icon: Footprints },
      { title: 'Don\'t Stay Too Long', description: 'After crossing, immediately retreat. Lingering invites tackles and risks losing the point.', icon: Zap },
      { title: 'Combine with Touches', description: 'After scoring the bonus, try to also touch a defender on your way back for an additional point.', icon: Star },
    ],
  },

  // ─── Defense Techniques ──────────────────────────────────────
  {
    id: 'ankle-hold',
    title: 'Ankle Hold',
    description: 'A crucial defensive technique where you grab the raider\'s ankle to stop their retreat and score a tackle point.',
    category: 'defense',
    difficulty: 'beginner',
    steps: [
      { title: 'Stay Low', description: 'Maintain a low defensive stance. Keep your center of gravity low for quick reactions.', icon: Dumbbell },
      { title: 'Watch the Feet', description: 'Focus on the raider\'s feet rather than their upper body. The feet tell you where they\'re going.', icon: Eye },
      { title: 'Grab the Ankle', description: 'When the raider\'s foot is within reach, firmly grab their ankle with both hands. Grip is everything.', icon: Hand },
      { title: 'Pull and Hold', description: 'Pull the ankle toward you and hold firmly. Don\'t let the raider shake you off.', icon: UserCheck },
      { title: 'Call for Support', description: 'Signal teammates to assist. A solo ankle hold can be broken; a chain is stronger.', icon: Crosshair },
    ],
  },
  {
    id: 'back-hold',
    title: 'Back Hold',
    description: 'A powerful defensive move where you grab the raider from behind, preventing any escape attempt.',
    category: 'defense',
    difficulty: 'intermediate',
    steps: [
      { title: 'Position Behind Raider', description: 'Move to get behind the raider. This is easier when the raider is focused on other defenders.', icon: Move },
      { title: 'Lock Your Arms', description: 'Wrap your arms around the raider\'s waist or chest. Lock your hands together for a firm grip.', icon: Hand },
      { title: 'Pull Back', description: 'Pull the raider backward, away from the center line. Use your body weight for leverage.', icon: UserCheck },
      { title: 'Don\'t Let Go', description: 'The raider will try to break free. Maintain your grip and call for support from teammates.', icon: Dumbbell },
      { title: 'Practice Grip Strength', description: 'Strong grip is essential. Practice holding exercises and grip strengtheners off the mat.', icon: Flame },
    ],
  },
  {
    id: 'dash',
    title: 'Dash (Push Out)',
    description: 'An aggressive defensive technique where you push the raider out of bounds to score a tackle point.',
    category: 'defense',
    difficulty: 'beginner',
    steps: [
      { title: 'Position Near Boundary', description: 'Stand between the raider and the center line, near the boundary area.', icon: Target },
      { title: 'Wait for Approach', description: 'Let the raider come to you. Patience is key — don\'t commit too early.', icon: Eye },
      { title: 'Push with Force', description: 'When the raider is close, push them forcefully towards the boundary/lobby area.', icon: Zap },
      { title: 'Use Leverage', description: 'Push from a low position using your legs for power. Don\'t just use arm strength.', icon: Dumbbell },
      { title: 'Avoid Crossing Line', description: 'Make sure you don\'t step into the lobby yourself, or you\'ll be out too.', icon: Footprints },
    ],
  },
  {
    id: 'chain-tackle',
    title: 'Chain Tackle',
    description: 'A coordinated team defense where multiple defenders link together to form an unbreakable chain against the raider.',
    category: 'defense',
    difficulty: 'advanced',
    steps: [
      { title: 'Communication is Key', description: 'Signal to your teammates that you\'re forming a chain. Use verbal calls or hand signals.', icon: Crosshair },
      { title: 'Link Together', description: 'Defenders grab each other\'s wrists or clothing to form a connected chain. No gaps!', icon: Hand },
      { title: 'Approach as One', description: 'Move toward the raider as a unit. Don\'t break formation or leave gaps.', icon: Move },
      { title: 'Surround the Raider', description: 'Use the chain to surround the raider, cutting off all escape routes.', icon: Target },
      { title: 'Hold Until Whistle', description: 'Maintain the chain hold until the referee blows the whistle confirming the tackle.', icon: Dumbbell },
    ],
  },
  {
    id: 'diving-ankle-hold',
    title: 'Diving Ankle Hold',
    description: 'A desperate but effective technique where you dive to grab the raider\'s ankle as they try to escape.',
    category: 'defense',
    difficulty: 'advanced',
    steps: [
      { title: 'Time Your Dive', description: 'Wait for the exact moment the raider turns to retreat. This is when they\'re most vulnerable.', icon: Eye },
      { title: 'Commit Fully', description: 'Dive with full commitment. A half-hearted dive won\'t reach the ankle.', icon: Zap },
      { title: 'Grab and Roll', description: 'Grab the ankle and roll your body to use your weight to pull the raider down.', icon: Hand },
      { title: 'Hold Until Help Arrives', description: 'Maintain your grip on the ankle until teammates arrive to complete the tackle.', icon: UserCheck },
      { title: 'Practice on Mats', description: 'Always practice diving on soft surfaces first to avoid injuries. Build up to game situations.', icon: Dumbbell },
    ],
  },
  {
    id: 'crocodile-hold',
    title: 'Crocodile Hold',
    description: 'A devastating defensive technique where you lock both legs of the raider, making escape nearly impossible.',
    category: 'defense',
    difficulty: 'advanced',
    steps: [
      { title: 'Get Low Position', description: 'Start in an extremely low stance. You need to be at leg level to execute this hold.', icon: Dumbbell },
      { title: 'Trap One Leg', description: 'First, grab one of the raider\'s legs firmly. This is your anchor point.', icon: Hand },
      { title: 'Lock the Second Leg', description: 'Quickly wrap your other arm around the raider\'s second leg. Now both legs are trapped.', icon: UserCheck },
      { title: 'Squeeze and Hold', description: 'Squeeze both legs together and hold firmly, like a crocodile\'s jaw. The raider cannot move.', icon: Flame },
      { title: 'Call for Support', description: 'While the crocodile hold is strong, it\'s safest when teammates help ensure the raider cannot drag you.', icon: Crosshair },
    ],
  },

  // ─── All-Round Skills ────────────────────────────────────────
  {
    id: 'court-awareness',
    title: 'Court Awareness',
    description: 'The ability to read the game, know where all players are, and make split-second decisions on the mat.',
    category: 'allround',
    difficulty: 'intermediate',
    steps: [
      { title: 'Scan Constantly', description: 'Develop the habit of scanning the entire court, not just the player in front of you.', icon: Eye },
      { title: 'Track Player Count', description: 'Always know how many players are on the court for each team. This affects strategy.', icon: Crosshair },
      { title: 'Read Body Language', description: 'Learn to read opponents\' body language to anticipate their next move.', icon: Target },
      { title: 'Know Your Position', description: 'Always be aware of your position relative to the center line, boundary, and other players.', icon: Move },
      { title: 'Practice Game Situations', description: 'The best way to improve awareness is playing lots of matches and analyzing them afterward.', icon: Dumbbell },
    ],
  },
  {
    id: 'fitness-basics',
    title: 'Kabaddi Fitness Basics',
    description: 'Essential fitness training for kabaddi players including stamina, strength, and flexibility exercises.',
    category: 'allround',
    difficulty: 'beginner',
    steps: [
      { title: 'Build Cardio Endurance', description: 'Kabaddi requires sustained effort. Run 3-5 km daily and do interval sprints to build stamina.', icon: Dumbbell },
      { title: 'Strengthen Core', description: 'A strong core is essential for balance during tackles and raids. Do planks, crunches, and Russian twists.', icon: Flame },
      { title: 'Grip Strength', description: 'Defenders need strong grips. Use grip strengtheners, pull-ups, and farmer\'s walks.', icon: Hand },
      { title: 'Flexibility Training', description: 'Stretch daily to prevent injuries. Focus on hamstrings, hips, and shoulders.', icon: Move },
      { title: 'Recovery and Rest', description: 'Rest is part of training. Get 7-8 hours of sleep and include rest days in your schedule.', icon: Star },
    ],
  },
  {
    id: 'game-intelligence',
    title: 'Game Intelligence',
    description: 'How to think strategically during a match, read the opponent\'s patterns, and make smart decisions.',
    category: 'allround',
    difficulty: 'advanced',
    steps: [
      { title: 'Study Opponents', description: 'Before the match, study your opponents\' previous games. Know their strengths and weaknesses.', icon: Eye },
      { title: 'Adapt Mid-Game', description: 'If your initial strategy isn\'t working, be willing to change. Flexibility wins matches.', icon: Crosshair },
      { title: 'Manage Energy', description: 'Don\'t exhaust yourself early. Pace your efforts throughout the match for strong finishes.', icon: Zap },
      { title: 'Read Momentum Shifts', description: 'Recognize when momentum shifts and capitalize on it — or call a timeout to stop it.', icon: Target },
      { title: 'Lead by Example', description: 'Whether captain or not, lead through your actions. Strong performances inspire teammates.', icon: Star },
    ],
  },
  {
    id: 'mental-toughness',
    title: 'Mental Toughness',
    description: 'Developing the mental resilience needed to perform under pressure and bounce back from setbacks.',
    category: 'allround',
    difficulty: 'intermediate',
    steps: [
      { title: 'Stay Calm Under Pressure', description: 'Practice breathing techniques. Deep, controlled breathing helps you stay composed in crucial moments.', icon: Eye },
      { title: 'Visualize Success', description: 'Before matches, visualize yourself executing techniques perfectly. Mental rehearsal improves performance.', icon: Target },
      { title: 'Embrace Mistakes', description: 'Everyone makes errors. The key is to quickly refocus after a mistake rather than dwelling on it.', icon: Zap },
      { title: 'Build Self-Confidence', description: 'Confidence comes from preparation. The more you practice, the more confident you\'ll feel in matches.', icon: Star },
      { title: 'Develop Routines', description: 'Create pre-match and pre-raid routines. Familiar routines help reduce anxiety and improve focus.', icon: Dumbbell },
    ],
  },
];

// ─── Animation Variants ───────────────────────────────────────────

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.06, delayChildren: 0.1 },
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

// ─── Component ────────────────────────────────────────────────────

export default function TechniqueTutorialsScreen({ onBack }: TechniqueTutorialsScreenProps) {
  const [activeCategory, setActiveCategory] = useState<TutorialCategory>('raiding');
  const [expandedTutorial, setExpandedTutorial] = useState<string | null>(null);

  const filteredTutorials = TUTORIALS.filter(t => t.category === activeCategory);

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="sticky top-0 z-50 bg-background/95 backdrop-blur-sm border-b border-border">
        <div className="flex items-center gap-3 p-4">
          <Button variant="ghost" size="icon" onClick={onBack}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div className="flex-1">
            <h1 className="font-bold text-foreground">Technique Tutorials</h1>
            <p className="text-xs text-muted-foreground">Master kabaddi skills step by step</p>
          </div>
          <Badge className="bg-brand-gold/10 text-brand-gold border-brand-gold/20">
            {TUTORIALS.length} tutorials
          </Badge>
        </div>

        {/* Category tabs */}
        <div className="flex gap-2 px-4 pb-3 overflow-x-auto">
          {(Object.entries(CATEGORY_CONFIG) as [TutorialCategory, typeof CATEGORY_CONFIG[TutorialCategory]][]).map(([key, config]) => (
            <Button
              key={key}
              variant={activeCategory === key ? 'default' : 'outline'}
              size="sm"
              className={`flex-shrink-0 ${
                activeCategory === key
                  ? 'bg-brand-red hover:bg-brand-red/90 text-white'
                  : ''
              }`}
              onClick={() => {
                setActiveCategory(key);
                setExpandedTutorial(null);
              }}
            >
              <config.icon className="w-4 h-4 mr-1.5" />
              {config.label}
            </Button>
          ))}
        </div>
      </div>

      {/* Content */}
      <motion.div
        key={activeCategory}
        variants={containerVariants}
        initial="hidden"
        animate="visible"
        className="p-4 space-y-3"
      >
        {/* Category header */}
        <motion.div variants={itemVariants} className="flex items-center gap-3 mb-2">
          <div className={`w-10 h-10 rounded-xl ${CATEGORY_CONFIG[activeCategory].bgColor} flex items-center justify-center`}>
            {(() => {
              const IconComp = CATEGORY_CONFIG[activeCategory].icon;
              return <IconComp className={`w-5 h-5 ${CATEGORY_CONFIG[activeCategory].color}`} />;
            })()}
          </div>
          <div>
            <h2 className="font-semibold text-foreground">{CATEGORY_CONFIG[activeCategory].label}</h2>
            <p className="text-sm text-muted-foreground">{filteredTutorials.length} techniques</p>
          </div>
        </motion.div>

        {/* Tutorial Cards */}
        {filteredTutorials.map((tutorial) => {
          const isExpanded = expandedTutorial === tutorial.id;
          const diffConfig = DIFFICULTY_CONFIG[tutorial.difficulty];

          return (
            <motion.div key={tutorial.id} variants={itemVariants}>
              <Card className={`transition-all ${isExpanded ? 'ring-2 ring-brand-red/30' : ''}`}>
                <CardContent className="p-0">
                  {/* Tutorial header - always visible */}
                  <button
                    className="w-full text-left p-4 flex items-start gap-3"
                    onClick={() => setExpandedTutorial(isExpanded ? null : tutorial.id)}
                  >
                    <div className={`w-10 h-10 rounded-xl ${diffConfig.bgColor} flex items-center justify-center flex-shrink-0`}>
                      <Footprints className={`w-5 h-5 ${diffConfig.color}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-semibold text-foreground">{tutorial.title}</h3>
                        <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${diffConfig.color} ${diffConfig.borderColor}`}>
                          {diffConfig.label}
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground line-clamp-2">{tutorial.description}</p>
                    </div>
                    <motion.div
                      animate={{ rotate: isExpanded ? 180 : 0 }}
                      transition={{ duration: 0.2 }}
                      className="flex-shrink-0 mt-1"
                    >
                      <ChevronDown className="w-5 h-5 text-muted-foreground" />
                    </motion.div>
                  </button>

                  {/* Expanded steps */}
                  <AnimatePresence>
                    {isExpanded && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.3 }}
                        className="overflow-hidden"
                      >
                        <div className="px-4 pb-4 space-y-3">
                          <div className="h-px bg-border" />

                          {/* Steps */}
                          <div className="space-y-3">
                            {tutorial.steps.map((step, stepIndex) => {
                              const StepIcon = step.icon;
                              return (
                                <motion.div
                                  key={stepIndex}
                                  initial={{ opacity: 0, x: -20 }}
                                  animate={{ opacity: 1, x: 0 }}
                                  transition={{ delay: stepIndex * 0.08 }}
                                  className="flex items-start gap-3"
                                >
                                  <div className="flex flex-col items-center gap-1">
                                    <div className="w-8 h-8 rounded-full bg-brand-red/10 flex items-center justify-center flex-shrink-0">
                                      <span className="text-xs font-bold text-brand-red">{stepIndex + 1}</span>
                                    </div>
                                    {stepIndex < tutorial.steps.length - 1 && (
                                      <div className="w-0.5 h-6 bg-border" />
                                    )}
                                  </div>
                                  <div className="flex-1 pt-0.5">
                                    <div className="flex items-center gap-2">
                                      <StepIcon className="w-4 h-4 text-brand-gold flex-shrink-0" />
                                      <h4 className="font-medium text-sm text-foreground">{step.title}</h4>
                                    </div>
                                    <p className="text-xs text-muted-foreground mt-1 ml-6">{step.description}</p>
                                  </div>
                                </motion.div>
                              );
                            })}
                          </div>

                          {/* Practice tip */}
                          <div className="bg-brand-gold/5 border border-brand-gold/20 rounded-xl p-3 flex items-start gap-2">
                            <CheckCircle2 className="w-4 h-4 text-brand-gold flex-shrink-0 mt-0.5" />
                            <p className="text-xs text-muted-foreground">
                              <span className="font-medium text-brand-gold">Pro Tip:</span> Practice each step slowly at first, then gradually increase speed. Perfect technique at slow speed beats sloppy technique at full speed.
                            </p>
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </CardContent>
              </Card>
            </motion.div>
          );
        })}

        {/* Bottom info */}
        <motion.div variants={itemVariants}>
          <Card className="bg-muted/50">
            <CardContent className="p-4">
              <div className="flex items-start gap-3">
                <Star className="w-5 h-5 text-brand-gold flex-shrink-0 mt-0.5" />
                <div className="text-sm text-muted-foreground">
                  <p className="font-medium text-foreground mb-1">More tutorials coming soon!</p>
                  <p>We regularly add new techniques and skills. Keep practicing and check back for updates.</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </motion.div>
    </div>
  );
}
