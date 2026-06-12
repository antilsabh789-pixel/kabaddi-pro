'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Swords,
  Shield,
  Sparkles,
  ChevronRight,
  ChevronLeft,
  SkipForward,
  Trophy,
  Target,
  Flame,
  Zap,
  Users,
  CheckCircle2,
  PartyPopper,
  Weight,
  Dumbbell,
  CircleDot,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useKabaddiStore, type OnboardingPosition, type OnboardingExperience, type OnboardingWeightCategory } from '@/lib/store';

// ─── Types ────────────────────────────────────────────────────────

interface TeamOption {
  id: string;
  name: string;
  teamCode: string;
  memberCount?: number;
}

// ─── Step Configuration ───────────────────────────────────────────

const TOTAL_STEPS = 4;

// ─── Position Options ─────────────────────────────────────────────

const POSITION_OPTIONS: { value: OnboardingPosition; label: string; description: string; icon: typeof Swords }[] = [
  { value: 'raider', label: 'Raider', description: 'Attack & score points', icon: Swords },
  { value: 'defender', label: 'Defender', description: 'Tackle & stop raiders', icon: Shield },
  { value: 'all-rounder', label: 'All-Rounder', description: 'Master of both sides', icon: Sparkles },
];

const EXPERIENCE_OPTIONS: { value: OnboardingExperience; label: string; description: string; icon: typeof Target }[] = [
  { value: 'beginner', label: 'Beginner', description: 'New to kabaddi', icon: CircleDot },
  { value: 'intermediate', label: 'Intermediate', description: '1-3 years of play', icon: Target },
  { value: 'advanced', label: 'Advanced', description: '3+ years competitive', icon: Flame },
];

const WEIGHT_OPTIONS: { value: OnboardingWeightCategory; label: string; description: string; icon: typeof Weight }[] = [
  { value: 'below-60', label: 'Below 60 kg', description: 'Lightweight', icon: Weight },
  { value: '60-70', label: '60-70 kg', description: 'Welterweight', icon: Weight },
  { value: '70-80', label: '70-80 kg', description: 'Middleweight', icon: Dumbbell },
  { value: '80-90', label: '80-90 kg', description: 'Heavyweight', icon: Dumbbell },
  { value: 'above-90', label: 'Above 90 kg', description: 'Super heavyweight', icon: Zap },
];

// ─── Confetti Particle ────────────────────────────────────────────

function ConfettiParticle({ delay, x, color }: { delay: number; x: number; color: string }) {
  return (
    <motion.div
      className="absolute w-2 h-2 rounded-sm"
      style={{ left: `${x}%`, top: '-2%', backgroundColor: color }}
      initial={{ y: 0, rotate: 0, opacity: 1 }}
      animate={{ y: '110vh', rotate: 720, opacity: 0 }}
      transition={{ duration: 2.5 + Math.random(), delay, ease: 'easeOut' }}
    />
  );
}

function ConfettiBurst() {
  const colors = ['#DC2626', '#F59E0B', '#10B981', '#8B5CF6', '#EF4444', '#F97316', '#06B6D4'];
  const particles = Array.from({ length: 50 }, (_, i) => ({
    id: i,
    delay: Math.random() * 0.8,
    x: Math.random() * 100,
    color: colors[Math.floor(Math.random() * colors.length)],
  }));

  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none z-10">
      {particles.map((p) => (
        <ConfettiParticle key={p.id} delay={p.delay} x={p.x} color={p.color} />
      ))}
    </div>
  );
}

// ─── Progress Dots ────────────────────────────────────────────────

function ProgressDots({ currentStep }: { currentStep: number }) {
  return (
    <div className="flex items-center justify-center gap-2">
      {Array.from({ length: TOTAL_STEPS }, (_, i) => (
        <motion.div
          key={i}
          className="rounded-full"
          animate={{
            width: i === currentStep ? 24 : 8,
            height: 8,
            backgroundColor: i === currentStep ? '#FFFFFF' : i < currentStep ? '#FFFFFF88' : '#FFFFFF33',
          }}
          transition={{ type: 'spring', damping: 20, stiffness: 300 }}
        />
      ))}
    </div>
  );
}

// ─── Step 1: Welcome ──────────────────────────────────────────────

function WelcomeStep() {
  return (
    <motion.div
      initial={{ opacity: 0, x: 60 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -60 }}
      transition={{ type: 'spring', damping: 24, stiffness: 200 }}
      className="flex flex-col items-center justify-center text-center px-6 py-8"
    >
      {/* Kabaddi Illustration */}
      <motion.div
        className="relative mb-8"
        initial={{ scale: 0.5, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ delay: 0.2, type: 'spring', damping: 15, stiffness: 200 }}
      >
        <div className="w-32 h-32 rounded-3xl bg-white/10 backdrop-blur-sm border border-white/20 flex items-center justify-center shadow-2xl">
          <div className="relative">
            <motion.div
              animate={{ rotate: [0, 10, -10, 0] }}
              transition={{ duration: 2, repeat: Infinity, repeatDelay: 3 }}
            >
              <Swords className="w-16 h-16 text-brand-gold" />
            </motion.div>
            <motion.div
              className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-brand-red flex items-center justify-center"
              animate={{ scale: [1, 1.2, 1] }}
              transition={{ duration: 1.5, repeat: Infinity }}
            >
              <Flame className="w-3 h-3 text-white" />
            </motion.div>
          </div>
        </div>
        {/* Glow effect */}
        <div className="absolute inset-0 rounded-3xl bg-brand-gold/20 blur-2xl -z-10" />
      </motion.div>

      <motion.h1
        className="text-3xl font-black text-white tracking-tight mb-3"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
      >
        Welcome to
        <span className="text-brand-gold"> Kabaddi Pro</span>
      </motion.h1>

      <motion.p
        className="text-white/70 text-sm leading-relaxed max-w-[280px] mb-6"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
      >
        Your ultimate kabaddi companion. Track scores, join tournaments, and connect with players.
      </motion.p>

      <motion.div
        className="flex flex-col gap-3 w-full max-w-[260px]"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5 }}
      >
        {[
          { icon: Trophy, text: 'Live scoring & match tracking' },
          { icon: Users, text: 'Join teams & tournaments' },
          { icon: Target, text: 'Track your performance stats' },
        ].map((item, i) => (
          <motion.div
            key={i}
            className="flex items-center gap-3 bg-white/5 backdrop-blur-sm rounded-xl px-4 py-3 border border-white/10"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.6 + i * 0.1 }}
          >
            <div className="w-8 h-8 rounded-lg bg-brand-gold/15 flex items-center justify-center shrink-0">
              <item.icon className="w-4 h-4 text-brand-gold" />
            </div>
            <span className="text-white/80 text-sm font-medium">{item.text}</span>
          </motion.div>
        ))}
      </motion.div>
    </motion.div>
  );
}

// ─── Step 2: Profile Setup ────────────────────────────────────────

function ProfileStep({
  profile,
  onProfileChange,
}: {
  profile: { position: OnboardingPosition | null; experience: OnboardingExperience | null; weightCategory: OnboardingWeightCategory | null };
  onProfileChange: (data: { position?: OnboardingPosition | null; experience?: OnboardingExperience | null; weightCategory?: OnboardingWeightCategory | null }) => void;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, x: 60 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -60 }}
      transition={{ type: 'spring', damping: 24, stiffness: 200 }}
      className="flex flex-col px-6 py-6"
    >
      <motion.div className="text-center mb-6">
        <div className="w-14 h-14 rounded-2xl bg-white/10 backdrop-blur-sm border border-white/20 flex items-center justify-center mx-auto mb-3">
          <Target className="w-7 h-7 text-brand-gold" />
        </div>
        <h2 className="text-xl font-black text-white mb-1">Your Profile</h2>
        <p className="text-white/60 text-xs">Tell us about your kabaddi style</p>
      </motion.div>

      {/* Position Selection */}
      <div className="mb-5">
        <p className="text-white/80 text-xs font-bold uppercase tracking-wider mb-2.5">Position</p>
        <div className="grid grid-cols-3 gap-2">
          {POSITION_OPTIONS.map((opt) => (
            <motion.button
              key={opt.value}
              onClick={() => onProfileChange({ position: opt.value })}
              className={`flex flex-col items-center gap-1.5 p-3 rounded-xl border transition-all duration-200 ${
                profile.position === opt.value
                  ? 'bg-brand-gold/20 border-brand-gold/50 shadow-lg shadow-brand-gold/10'
                  : 'bg-white/5 border-white/10 hover:bg-white/10 hover:border-white/20'
              }`}
              whileTap={{ scale: 0.95 }}
            >
              <opt.icon className={`w-6 h-6 ${profile.position === opt.value ? 'text-brand-gold' : 'text-white/50'}`} />
              <span className={`text-xs font-bold ${profile.position === opt.value ? 'text-brand-gold' : 'text-white/60'}`}>
                {opt.label}
              </span>
              <span className={`text-[10px] leading-tight text-center ${profile.position === opt.value ? 'text-brand-gold/70' : 'text-white/40'}`}>
                {opt.description}
              </span>
            </motion.button>
          ))}
        </div>
      </div>

      {/* Experience Level */}
      <div className="mb-5">
        <p className="text-white/80 text-xs font-bold uppercase tracking-wider mb-2.5">Experience Level</p>
        <div className="grid grid-cols-3 gap-2">
          {EXPERIENCE_OPTIONS.map((opt) => (
            <motion.button
              key={opt.value}
              onClick={() => onProfileChange({ experience: opt.value })}
              className={`flex flex-col items-center gap-1.5 p-3 rounded-xl border transition-all duration-200 ${
                profile.experience === opt.value
                  ? 'bg-brand-gold/20 border-brand-gold/50 shadow-lg shadow-brand-gold/10'
                  : 'bg-white/5 border-white/10 hover:bg-white/10 hover:border-white/20'
              }`}
              whileTap={{ scale: 0.95 }}
            >
              <opt.icon className={`w-6 h-6 ${profile.experience === opt.value ? 'text-brand-gold' : 'text-white/50'}`} />
              <span className={`text-xs font-bold ${profile.experience === opt.value ? 'text-brand-gold' : 'text-white/60'}`}>
                {opt.label}
              </span>
              <span className={`text-[10px] leading-tight text-center ${profile.experience === opt.value ? 'text-brand-gold/70' : 'text-white/40'}`}>
                {opt.description}
              </span>
            </motion.button>
          ))}
        </div>
      </div>

      {/* Weight Category */}
      <div>
        <p className="text-white/80 text-xs font-bold uppercase tracking-wider mb-2.5">Weight Category</p>
        <div className="grid grid-cols-2 gap-2">
          {WEIGHT_OPTIONS.map((opt) => (
            <motion.button
              key={opt.value}
              onClick={() => onProfileChange({ weightCategory: opt.value })}
              className={`flex items-center gap-2.5 p-3 rounded-xl border transition-all duration-200 ${
                profile.weightCategory === opt.value
                  ? 'bg-brand-gold/20 border-brand-gold/50 shadow-lg shadow-brand-gold/10'
                  : 'bg-white/5 border-white/10 hover:bg-white/10 hover:border-white/20'
              }`}
              whileTap={{ scale: 0.95 }}
            >
              <opt.icon className={`w-5 h-5 shrink-0 ${profile.weightCategory === opt.value ? 'text-brand-gold' : 'text-white/50'}`} />
              <div className="text-left min-w-0">
                <span className={`text-xs font-bold block ${profile.weightCategory === opt.value ? 'text-brand-gold' : 'text-white/60'}`}>
                  {opt.label}
                </span>
                <span className={`text-[10px] ${profile.weightCategory === opt.value ? 'text-brand-gold/70' : 'text-white/40'}`}>
                  {opt.description}
                </span>
              </div>
            </motion.button>
          ))}
        </div>
      </div>
    </motion.div>
  );
}

// ─── Step 3: Pick Your Team ───────────────────────────────────────

function TeamStep({
  selectedTeamId,
  onSelectTeam,
  teams,
  loading,
}: {
  selectedTeamId: string | null;
  onSelectTeam: (teamId: string | null) => void;
  teams: TeamOption[];
  loading: boolean;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, x: 60 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -60 }}
      transition={{ type: 'spring', damping: 24, stiffness: 200 }}
      className="flex flex-col px-6 py-6"
    >
      <motion.div className="text-center mb-6">
        <div className="w-14 h-14 rounded-2xl bg-white/10 backdrop-blur-sm border border-white/20 flex items-center justify-center mx-auto mb-3">
          <Users className="w-7 h-7 text-brand-gold" />
        </div>
        <h2 className="text-xl font-black text-white mb-1">Pick Your Team</h2>
        <p className="text-white/60 text-xs">Join an existing team or skip to create your own later</p>
      </motion.div>

      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-16 rounded-xl bg-white/5 animate-pulse border border-white/10" />
          ))}
        </div>
      ) : teams.length === 0 ? (
        <div className="flex flex-col items-center py-8">
          <Users className="w-10 h-10 text-white/30 mb-3" />
          <p className="text-white/50 text-sm">No teams available yet</p>
          <p className="text-white/40 text-xs mt-1">You can create one later</p>
        </div>
      ) : (
        <div className="space-y-2.5 max-h-72 overflow-y-auto custom-scrollbar pr-1">
          {teams.map((team, index) => (
            <motion.button
              key={team.id}
              onClick={() => onSelectTeam(selectedTeamId === team.id ? null : team.id)}
              className={`w-full flex items-center gap-3 p-3.5 rounded-xl border transition-all duration-200 text-left ${
                selectedTeamId === team.id
                  ? 'bg-brand-gold/20 border-brand-gold/50 shadow-lg shadow-brand-gold/10'
                  : 'bg-white/5 border-white/10 hover:bg-white/10 hover:border-white/20'
              }`}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05 }}
              whileTap={{ scale: 0.98 }}
            >
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                selectedTeamId === team.id ? 'bg-brand-gold/30' : 'bg-white/10'
              }`}>
                <Swords className={`w-5 h-5 ${selectedTeamId === team.id ? 'text-brand-gold' : 'text-white/50'}`} />
              </div>
              <div className="flex-1 min-w-0">
                <p className={`text-sm font-bold truncate ${selectedTeamId === team.id ? 'text-brand-gold' : 'text-white/80'}`}>
                  {team.name}
                </p>
                <p className="text-[11px] text-white/40">
                  {team.teamCode}
                  {team.memberCount != null ? ` · ${team.memberCount} members` : ''}
                </p>
              </div>
              {selectedTeamId === team.id && (
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ type: 'spring', damping: 15, stiffness: 300 }}
                >
                  <CheckCircle2 className="w-5 h-5 text-brand-gold" />
                </motion.div>
              )}
            </motion.button>
          ))}
        </div>
      )}
    </motion.div>
  );
}

// ─── Step 4: All Set ──────────────────────────────────────────────

function CompleteStep({ profile }: { profile: { position: OnboardingPosition | null; experience: OnboardingExperience | null } }) {
  const positionLabel = POSITION_OPTIONS.find((o) => o.value === profile.position)?.label || 'Player';
  const experienceLabel = EXPERIENCE_OPTIONS.find((o) => o.value === profile.experience)?.label || '';

  return (
    <motion.div
      initial={{ opacity: 0, x: 60 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -60 }}
      transition={{ type: 'spring', damping: 24, stiffness: 200 }}
      className="flex flex-col items-center justify-center text-center px-6 py-8"
    >
      <ConfettiBurst />

      <motion.div
        className="relative mb-6"
        initial={{ scale: 0, rotate: -180 }}
        animate={{ scale: 1, rotate: 0 }}
        transition={{ delay: 0.3, type: 'spring', damping: 12, stiffness: 200 }}
      >
        <div className="w-28 h-28 rounded-3xl bg-brand-gold/20 backdrop-blur-sm border border-brand-gold/40 flex items-center justify-center shadow-2xl shadow-brand-gold/20">
          <PartyPopper className="w-14 h-14 text-brand-gold" />
        </div>
        <div className="absolute inset-0 rounded-3xl bg-brand-gold/10 blur-3xl -z-10" />
      </motion.div>

      <motion.h2
        className="text-2xl font-black text-white mb-2"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5 }}
      >
        You&apos;re All Set! 🎉
      </motion.h2>

      <motion.p
        className="text-white/60 text-sm mb-6 max-w-[260px]"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.6 }}
      >
        Your Kabaddi Pro profile is ready. Let the games begin!
      </motion.p>

      <motion.div
        className="bg-white/5 backdrop-blur-sm rounded-2xl p-4 border border-white/10 w-full max-w-[280px]"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.7 }}
      >
        <p className="text-white/50 text-[10px] font-bold uppercase tracking-wider mb-3">Your Profile Summary</p>
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-white/50 text-xs">Position</span>
            <span className="text-brand-gold text-xs font-bold">{positionLabel}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-white/50 text-xs">Experience</span>
            <span className="text-brand-gold text-xs font-bold">{experienceLabel || 'Not set'}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-white/50 text-xs">Ready to play</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}

// ─── Main Component ───────────────────────────────────────────────

export default function OnboardingWizard() {
  const { onboardingProfile, setOnboardingProfile, completeOnboarding } = useKabaddiStore();

  const [currentStep, setCurrentStep] = useState(0);
  const [direction, setDirection] = useState(1);
  const [teams, setTeams] = useState<TeamOption[]>([]);
  const [teamsLoading, setTeamsLoading] = useState(false);
  const [localProfile, setLocalProfile] = useState(onboardingProfile);

  // Fetch teams for step 3
  const fetchTeams = useCallback(async () => {
    setTeamsLoading(true);
    try {
      const res = await fetch('/api/teams?limit=20');
      const data = await res.json();
      const teamList: TeamOption[] = (data.teams || data || []).map((t: Record<string, unknown>) => ({
        id: t.id as string,
        name: (t.name as string) || 'Unnamed Team',
        teamCode: (t.teamCode as string) || '',
        memberCount: t.memberCount as number | undefined,
      }));
      setTeams(teamList);
    } catch {
      setTeams([]);
    } finally {
      setTeamsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (currentStep === 2) {
      void fetchTeams();
    }
  }, [currentStep, fetchTeams]);

  const goToStep = useCallback((step: number) => {
    setDirection(step > currentStep ? 1 : -1);
    setCurrentStep(step);
  }, [currentStep]);

  const handleNext = useCallback(() => {
    if (currentStep < TOTAL_STEPS - 1) {
      // Save profile to store on each step transition
      setOnboardingProfile(localProfile);
      goToStep(currentStep + 1);
    }
  }, [currentStep, goToStep, localProfile, setOnboardingProfile]);

  const handleBack = useCallback(() => {
    if (currentStep > 0) {
      goToStep(currentStep - 1);
    }
  }, [currentStep, goToStep]);

  const handleSkip = useCallback(() => {
    setOnboardingProfile(localProfile);
    if (currentStep < TOTAL_STEPS - 1) {
      goToStep(currentStep + 1);
    }
  }, [currentStep, goToStep, localProfile, setOnboardingProfile]);

  const handleComplete = useCallback(() => {
    setOnboardingProfile(localProfile);
    completeOnboarding();
  }, [completeOnboarding, localProfile, setOnboardingProfile]);

  const handleLocalProfileChange = useCallback((data: { position?: OnboardingPosition | null; experience?: OnboardingExperience | null; weightCategory?: OnboardingWeightCategory | null }) => {
    setLocalProfile((prev) => ({ ...prev, ...data }));
  }, []);

  const handleTeamSelect = useCallback((teamId: string | null) => {
    setLocalProfile((prev) => ({ ...prev, selectedTeamId: teamId }));
  }, []);

  // Step titles for accessibility
  const stepTitles = ['Welcome', 'Your Profile', 'Pick Your Team', 'All Set'];

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex flex-col bg-gradient-to-br from-red-800 via-red-900 to-red-950"
    >
      {/* Background pattern */}
      <div
        className="absolute inset-0 opacity-[0.04]"
        style={{
          backgroundImage: `repeating-linear-gradient(45deg, transparent, transparent 35px, rgba(255,255,255,0.1) 35px, rgba(255,255,255,0.1) 36px)`,
        }}
      />

      {/* Skip button (steps 1-2) */}
      {currentStep > 0 && currentStep < 3 && (
        <motion.button
          onClick={handleSkip}
          className="absolute top-4 right-4 z-20 flex items-center gap-1 text-white/50 hover:text-white/80 text-xs font-medium transition-colors"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <span>Skip</span>
          <SkipForward className="w-3.5 h-3.5" />
        </motion.button>
      )}

      {/* Back button (steps 1-3) */}
      {currentStep > 0 && (
        <motion.button
          onClick={handleBack}
          className="absolute top-4 left-4 z-20 w-8 h-8 rounded-full bg-white/10 flex items-center justify-center text-white/70 hover:bg-white/20 hover:text-white transition-colors"
          initial={{ opacity: 0, x: -10 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -10 }}
        >
          <ChevronLeft className="w-4 h-4" />
        </motion.button>
      )}

      {/* Main Content Area */}
      <div className="flex-1 relative overflow-hidden flex items-start justify-center pt-16">
        <AnimatePresence mode="wait" custom={direction}>
          <motion.div
            key={currentStep}
            custom={direction}
            initial={{ opacity: 0, x: direction * 60 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: direction * -60 }}
            transition={{ type: 'spring', damping: 24, stiffness: 200 }}
            className="w-full max-w-md mx-auto"
            role="region"
            aria-label={stepTitles[currentStep]}
          >
            {currentStep === 0 && <WelcomeStep />}
            {currentStep === 1 && (
              <ProfileStep
                profile={localProfile}
                onProfileChange={handleLocalProfileChange}
              />
            )}
            {currentStep === 2 && (
              <TeamStep
                selectedTeamId={localProfile.selectedTeamId}
                onSelectTeam={handleTeamSelect}
                teams={teams}
                loading={teamsLoading}
              />
            )}
            {currentStep === 3 && (
              <CompleteStep profile={localProfile} />
            )}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Bottom Navigation */}
      <div className="relative z-10 px-6 pb-8 pt-4">
        {/* Progress Dots */}
        <div className="mb-5">
          <ProgressDots currentStep={currentStep} />
        </div>

        {/* Action Buttons */}
        <AnimatePresence mode="wait">
          {currentStep === 0 && (
            <motion.div
              key="welcome-btn"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
            >
              <Button
                onClick={handleNext}
                className="w-full h-12 rounded-xl bg-brand-gold hover:bg-brand-gold/90 text-red-950 font-black text-sm tracking-wide shadow-lg shadow-brand-gold/20"
              >
                Let&apos;s Get Started
                <ChevronRight className="w-4 h-4 ml-1" />
              </Button>
            </motion.div>
          )}

          {currentStep === 1 && (
            <motion.div
              key="profile-btn"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
            >
              <Button
                onClick={handleNext}
                className="w-full h-12 rounded-xl bg-brand-gold hover:bg-brand-gold/90 text-red-950 font-black text-sm tracking-wide shadow-lg shadow-brand-gold/20"
              >
                Continue
                <ChevronRight className="w-4 h-4 ml-1" />
              </Button>
            </motion.div>
          )}

          {currentStep === 2 && (
            <motion.div
              key="team-btn"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
            >
              <Button
                onClick={handleNext}
                className="w-full h-12 rounded-xl bg-brand-gold hover:bg-brand-gold/90 text-red-950 font-black text-sm tracking-wide shadow-lg shadow-brand-gold/20"
              >
                {localProfile.selectedTeamId ? 'Join & Continue' : 'Continue Without Team'}
                <ChevronRight className="w-4 h-4 ml-1" />
              </Button>
            </motion.div>
          )}

          {currentStep === 3 && (
            <motion.div
              key="complete-btn"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
            >
              <Button
                onClick={handleComplete}
                className="w-full h-12 rounded-xl bg-brand-gold hover:bg-brand-gold/90 text-red-950 font-black text-sm tracking-wide shadow-lg shadow-brand-gold/20"
              >
                Go to Home
                <Sparkles className="w-4 h-4 ml-1" />
              </Button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}
