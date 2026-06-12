'use client';

import { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Trophy, Shield, Megaphone, ChevronRight, ArrowLeft, Phone, Eye, EyeOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useKabaddiStore } from '@/lib/store';

type Stage = 'auth' | 'details' | 'role';

const roles = [
  {
    id: 'player',
    title: 'Player',
    description: 'Track your raids, tackles, and performance stats',
    icon: Shield,
    color: 'from-brand-red to-brand-red-dark',
    borderColor: 'border-brand-red/40',
    glowColor: 'shadow-brand-red/20',
  },
  {
    id: 'coach',
    title: 'Coach',
    description: 'Manage teams, strategies, and match tactics',
    icon: Megaphone,
    color: 'from-brand-green to-brand-green-dark',
    borderColor: 'border-brand-green/40',
    glowColor: 'shadow-brand-green/20',
  },
] as const;

const slideVariants = {
  enter: (direction: number) => ({
    x: direction > 0 ? 300 : -300,
    opacity: 0,
  }),
  center: {
    x: 0,
    opacity: 1,
  },
  exit: (direction: number) => ({
    x: direction < 0 ? 300 : -300,
    opacity: 0,
  }),
};

export default function AuthScreen() {
  const [stage, setStage] = useState<Stage>('auth');
  const [isSignUp, setIsSignUp] = useState(false);
  const [phone, setPhone] = useState('');
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [selectedRoles, setSelectedRoles] = useState<Set<string>>(new Set());
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [direction, setDirection] = useState(1);
  const [countryCode] = useState('+91');
  const [error, setError] = useState('');

  // New fields
  const [gender, setGender] = useState<'boy' | 'girl' | ''>('');
  const [weight, setWeight] = useState('');
  const [practiceGround, setPracticeGround] = useState('');
  const [position, setPosition] = useState('');

  const login = useKabaddiStore((s) => s.login);
  const setOnboarded = useKabaddiStore((s) => s.setOnboarded);

  const goNext = useCallback((next: Stage) => {
    setDirection(1);
    setStage(next);
  }, []);

  const goBack = useCallback(() => {
    setDirection(-1);
    if (stage === 'role') setStage('details');
    else if (stage === 'details') setStage('auth');
  }, [stage]);

  const toggleRole = useCallback((roleId: string) => {
    setSelectedRoles((prev) => {
      const next = new Set(prev);
      if (next.has(roleId)) {
        next.delete(roleId);
      } else {
        next.add(roleId);
      }
      return next;
    });
  }, []);

  const handleAuth = useCallback(async () => {
    setError('');

    if (phone.length !== 10) {
      setError('Please enter a valid 10-digit phone number');
      return;
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }
    if (isSignUp && !name.trim()) {
      setError('Please enter your name');
      return;
    }
    if (isSignUp && password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await fetch('/api/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phone: `${countryCode}${phone}`,
          name: name.trim(),
          password,
          role: selectedRoles.values().next().value ?? 'player',
          action: isSignUp ? 'register' : 'login',
          gender: gender === 'boy' ? 'male' : gender === 'girl' ? 'female' : undefined,
          weight: weight ? `${weight}kg` : undefined,
          practiceGround: practiceGround || undefined,
          position: position || undefined,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Authentication failed');
        return;
      }

      const user = data.user;
      // Set user state directly
      login({
        id: user.id,
        phone: user.phone,
        playerCode: user.playerCode || undefined,
        name: user.name || name.trim(),
        role: user.role || 'player',
        avatar: user.avatar || '',
        isPremium: user.isPremium || false,
        isAdmin: user.isAdmin || false,
        gender: user.gender || (gender === 'boy' ? 'male' : gender === 'girl' ? 'female' : undefined),
        weight: user.weight || (weight ? `${weight}kg` : undefined),
        practiceGround: user.practiceGround || practiceGround || undefined,
      });

      if (isSignUp) {
        // New user — go to details page first, then role selection
        goNext('details');
      } else {
        // Returning user — go straight in
        setOnboarded(true);
      }
    } catch (err) {
      setError('Something went wrong. Please try again.');
      console.error('Auth failed:', err);
    } finally {
      setIsSubmitting(false);
    }
  }, [phone, name, password, confirmPassword, isSignUp, selectedRoles, countryCode, login, setOnboarded, goNext, gender, weight, practiceGround]);

  const handleDetailsContinue = useCallback(() => {
    setError('');
    if (!gender) {
      setError('Please select your gender');
      return;
    }

    // Update user details via API
    const currentUser = useKabaddiStore.getState().currentUser;
    if (currentUser?.id) {
      fetch('/api/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: currentUser.id,
          action: 'update-details',
          gender: gender === 'boy' ? 'male' : gender === 'girl' ? 'female' : gender,
          weight: weight ? `${weight}kg` : undefined,
          practiceGround: practiceGround || undefined,
        }),
      }).catch(() => {});

      // Update position on player profile
      if (position) {
        fetch(`/api/players/${currentUser.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ position }),
        }).catch(() => {});
      }
    }

    // Update local state
    useKabaddiStore.getState().updateUser({
      gender: gender === 'boy' ? 'male' : gender === 'girl' ? 'female' : gender,
      weight: weight ? `${weight}kg` : undefined,
      practiceGround: practiceGround || undefined,
    });

    goNext('role');
  }, [gender, weight, practiceGround, position, goNext]);

  const handleGetStarted = useCallback(async () => {
    setIsSubmitting(true);
    try {
      // Update user role via API
      const currentUser = useKabaddiStore.getState().currentUser;
      if (currentUser?.id) {
        const roleValue = Array.from(selectedRoles).join(',') || 'player';
        await fetch('/api/auth', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userId: currentUser.id,
            action: 'update-details',
            role: roleValue,
          }),
        });

        // Update local state
        useKabaddiStore.getState().updateUser({ role: roleValue });
      }
      setOnboarded(true);
    } finally {
      setIsSubmitting(false);
    }
  }, [setOnboarded, selectedRoles]);

  const stageIndex: Record<Stage, number> = { auth: 0, details: 1, role: 2 };

  // Gender-based accent color
  const genderAccent = gender === 'boy' ? '#1E293B' : gender === 'girl' ? '#DC2626' : '';

  return (
    <div className="min-h-screen bg-warm-50 flex flex-col items-center justify-center px-4 relative overflow-hidden">
      {/* Background decoration */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-brand-red/10 rounded-full blur-3xl" />
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-brand-red-dark/10 rounded-full blur-3xl" />
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-96 h-96 bg-brand-red/20 rounded-full blur-3xl" />
      </div>

      {/* Logo - always visible */}
      <motion.div
        className="flex flex-col items-center mb-8 relative z-10"
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <div className="relative mb-3">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-brand-red to-brand-red-dark flex items-center justify-center shadow-lg shadow-brand-red/30">
            <Trophy className="w-8 h-8 text-white" />
          </div>
          <div className="absolute -inset-1 rounded-2xl bg-brand-red/30 blur-md -z-10" />
        </div>
        <h1 className="text-2xl font-black tracking-wider text-warm-800">
          KABADDI <span className="text-brand-red">PRO</span>
        </h1>
      </motion.div>

      {/* Stage content */}
      <div className="w-full max-w-sm relative z-10">
        <AnimatePresence mode="wait" custom={direction}>
          {/* ─── Stage 1: Login / Sign Up ─── */}
          {stage === 'auth' && (
            <motion.div
              key="auth"
              custom={direction}
              variants={slideVariants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{ type: 'spring', stiffness: 300, damping: 30 }}
              className="flex flex-col items-center"
            >
              <h2 className="text-xl font-bold text-warm-800 mb-1">
                {isSignUp ? 'Create Account' : 'Welcome Back!'}
              </h2>
              <p className="text-warm-600 text-sm mb-6 text-center">
                {isSignUp
                  ? 'Sign up to get started with Kabaddi Pro'
                  : 'Login to your Kabaddi Pro account'}
              </p>

              {/* Phone Input */}
              <div className="w-full flex gap-2 mb-3">
                <div className="flex items-center justify-center h-12 px-3 rounded-lg bg-warm-100 border border-warm-300 text-warm-800 font-semibold text-sm shrink-0">
                  <Phone className="w-3.5 h-3.5 mr-1.5 text-warm-600" />
                  {countryCode}
                </div>
                <Input
                  type="tel"
                  inputMode="numeric"
                  maxLength={10}
                  placeholder="Enter 10-digit number"
                  value={phone}
                  onChange={(e) => {
                    const val = e.target.value.replace(/\D/g, '');
                    setPhone(val);
                    if (error) setError('');
                  }}
                  className="h-12 bg-warm-100 border-warm-300 text-warm-800 placeholder:text-warm-500 text-base"
                />
              </div>

              {/* Name Input (Sign Up only) */}
              {isSignUp && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="w-full mb-3"
                >
                  <Input
                    type="text"
                    placeholder="Enter your name"
                    value={name}
                    onChange={(e) => {
                      setName(e.target.value);
                      if (error) setError('');
                    }}
                    className="h-12 bg-warm-100 border-warm-300 text-warm-800 placeholder:text-warm-500 text-base"
                  />
                </motion.div>
              )}

              {/* Password Input */}
              <div className="w-full relative mb-3">
                <div className="relative">
                  <Input
                    type={showPassword ? 'text' : 'password'}
                    placeholder={isSignUp ? 'Create a password' : 'Enter password'}
                    value={password}
                    onChange={(e) => {
                      setPassword(e.target.value);
                      if (error) setError('');
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleAuth();
                    }}
                    className="h-12 bg-warm-100 border-warm-300 text-warm-800 placeholder:text-warm-500 text-base pr-12"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-warm-500 hover:text-warm-700 transition-colors"
                  >
                    {showPassword ? (
                      <EyeOff className="w-5 h-5" />
                    ) : (
                      <Eye className="w-5 h-5" />
                    )}
                  </button>
                </div>
                {isSignUp && password && password.length < 6 && (
                  <p className="text-xs text-warm-500 mt-1 ml-1">
                    Password must be at least 6 characters
                  </p>
                )}
              </div>

              {/* Confirm Password (Sign Up only) */}
              {isSignUp && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="w-full mb-4"
                >
                  <div className="relative">
                    <Input
                      type={showConfirmPassword ? 'text' : 'password'}
                      placeholder="Confirm password"
                      value={confirmPassword}
                      onChange={(e) => {
                        setConfirmPassword(e.target.value);
                        if (error) setError('');
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleAuth();
                      }}
                      className="h-12 bg-warm-100 border-warm-300 text-warm-800 placeholder:text-warm-500 text-base pr-12"
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-warm-500 hover:text-warm-700 transition-colors"
                    >
                      {showConfirmPassword ? (
                        <EyeOff className="w-5 h-5" />
                      ) : (
                        <Eye className="w-5 h-5" />
                      )}
                    </button>
                  </div>
                  {confirmPassword && password !== confirmPassword && (
                    <p className="text-xs text-red-500 mt-1 ml-1">
                      Passwords do not match
                    </p>
                  )}
                </motion.div>
              )}

              {/* Error Message */}
              {error && (
                <motion.p
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="text-brand-red text-sm mb-3 text-center w-full"
                >
                  {error}
                </motion.p>
              )}

              {/* Submit Button */}
              <Button
                onClick={handleAuth}
                disabled={
                  isSubmitting ||
                  phone.length !== 10 ||
                  password.length < 6 ||
                  (isSignUp && (!confirmPassword || password !== confirmPassword))
                }
                className="w-full h-12 bg-brand-red-dark hover:bg-brand-red-dark/90 text-white font-semibold text-base rounded-lg disabled:opacity-40"
              >
                {isSubmitting ? (
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Please wait...
                  </div>
                ) : isSignUp ? (
                  <>
                    Create Account
                    <ChevronRight className="w-4 h-4 ml-1" />
                  </>
                ) : (
                  <>
                    Login
                    <ChevronRight className="w-4 h-4 ml-1" />
                  </>
                )}
              </Button>

              {/* Toggle Login/Signup */}
              <button
                className="text-brand-red hover:text-brand-red-light text-sm font-medium mt-4 transition-colors"
                onClick={() => {
                  setIsSignUp(!isSignUp);
                  setError('');
                  setConfirmPassword('');
                }}
              >
                {isSignUp
                  ? 'Already have an account? Login'
                  : "Don't have an account? Sign Up"}
              </button>
            </motion.div>
          )}

          {/* ─── Stage 2: Details (Gender, Weight, Practice Ground) ─── */}
          {stage === 'details' && (
            <motion.div
              key="details"
              custom={direction}
              variants={slideVariants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{ type: 'spring', stiffness: 300, damping: 30 }}
              className="flex flex-col items-center"
            >
              <button
                onClick={goBack}
                className="self-start flex items-center text-warm-600 hover:text-warm-800 transition-colors mb-4 text-sm"
              >
                <ArrowLeft className="w-4 h-4 mr-1" />
                Back
              </button>

              <h2 className="text-xl font-bold text-warm-800 mb-1">Tell us about yourself</h2>
              <p className="text-warm-600 text-sm mb-6 text-center">
                Help us personalize your experience
              </p>

              {/* Gender Selection */}
              <div className="w-full mb-4">
                <label className="text-sm font-semibold text-warm-700 mb-2 block">
                  Gender <span className="text-brand-red">*</span>
                </label>
                <div className="grid grid-cols-2 gap-3">
                  {/* Boy Button */}
                  <motion.button
                    type="button"
                    whileTap={{ scale: 0.97 }}
                    onClick={() => {
                      setGender('boy');
                      if (error) setError('');
                    }}
                    className={`flex flex-col items-center justify-center gap-2 p-5 rounded-xl border-2 transition-all ${
                      gender === 'boy'
                        ? 'border-brand-blue bg-brand-blue shadow-lg shadow-brand-blue/20'
                        : 'border-warm-300 bg-warm-100 hover:border-brand-blue/40'
                    }`}
                  >
                    <span
                      className={`text-3xl leading-none ${
                        gender === 'boy' ? 'text-white' : 'text-brand-blue'
                      }`}
                    >
                      ♂
                    </span>
                    <span
                      className={`text-sm font-bold ${
                        gender === 'boy' ? 'text-white' : 'text-warm-700'
                      }`}
                    >
                      Boy
                    </span>
                  </motion.button>

                  {/* Girl Button */}
                  <motion.button
                    type="button"
                    whileTap={{ scale: 0.97 }}
                    onClick={() => {
                      setGender('girl');
                      if (error) setError('');
                    }}
                    className={`flex flex-col items-center justify-center gap-2 p-5 rounded-xl border-2 transition-all ${
                      gender === 'girl'
                        ? 'border-brand-red bg-brand-red shadow-lg shadow-brand-red/20'
                        : 'border-warm-300 bg-warm-100 hover:border-brand-red/40'
                    }`}
                  >
                    <span
                      className={`text-3xl leading-none ${
                        gender === 'girl' ? 'text-white' : 'text-brand-red'
                      }`}
                    >
                      ♀
                    </span>
                    <span
                      className={`text-sm font-bold ${
                        gender === 'girl' ? 'text-white' : 'text-warm-700'
                      }`}
                    >
                      Girl
                    </span>
                  </motion.button>
                </div>
              </div>

              {/* Weight Input */}
              <div className="w-full mb-3">
                <label className="text-sm font-semibold text-warm-700 mb-2 block">
                  Weight
                </label>
                <div className="relative">
                  <Input
                    type="number"
                    inputMode="numeric"
                    placeholder="Enter weight"
                    value={weight}
                    onChange={(e) => {
                      setWeight(e.target.value);
                    }}
                    className="h-12 bg-warm-100 border-warm-300 text-warm-800 placeholder:text-warm-500 text-base pr-12"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-warm-500 text-sm font-medium pointer-events-none">
                    kg
                  </span>
                </div>
              </div>

              {/* Practice Ground Input */}
              <div className="w-full mb-4">
                <label className="text-sm font-semibold text-warm-700 mb-2 block">
                  Practice Ground
                </label>
                <Input
                  type="text"
                  placeholder="Enter practice ground / academy"
                  value={practiceGround}
                  onChange={(e) => {
                    setPracticeGround(e.target.value);
                  }}
                  className="h-12 bg-warm-100 border-warm-300 text-warm-800 placeholder:text-warm-500 text-base"
                />
              </div>

              {/* Position Selection */}
              <div className="w-full mb-4">
                <label className="text-sm font-semibold text-warm-700 mb-2 block">
                  Position
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { id: 'left-raider', label: 'Left Raider', icon: '⬅️', meaning: 'Attacks from left' },
                    { id: 'right-raider', label: 'Right Raider', icon: '➡️', meaning: 'Attacks from right' },
                    { id: 'both-raider', label: 'Both Raider', icon: '↔️', meaning: 'Raids both sides' },
                    { id: 'left-corner', label: 'Left Corner', icon: '🛡️', meaning: 'Defends left corner' },
                    { id: 'right-corner', label: 'Right Corner', icon: '🛡️', meaning: 'Defends right corner' },
                    { id: 'left-cover', label: 'Left Cover', icon: '🧱', meaning: 'Cover defender left' },
                    { id: 'right-cover', label: 'Right Cover', icon: '🧱', meaning: 'Cover defender right' },
                    { id: 'all-rounder', label: 'All-Rounder', icon: '⭐', meaning: 'Raid & defense' },
                  ].map((pos) => (
                    <button
                      key={pos.id}
                      type="button"
                      onClick={() => setPosition(position === pos.id ? '' : pos.id)}
                      className={`p-2.5 rounded-xl border-2 text-left transition-all ${
                        position === pos.id
                          ? 'border-brand-teal bg-brand-teal/10'
                          : 'border-warm-300 bg-warm-100 hover:border-warm-200'
                      }`}
                    >
                      <div className="flex items-center gap-1">
                        <span className="text-sm">{pos.icon}</span>
                        <span className={`text-xs font-semibold ${position === pos.id ? 'text-brand-teal' : 'text-warm-700'}`}>
                          {pos.label}
                        </span>
                      </div>
                      <p className="text-[8px] text-warm-400 mt-0.5 ml-5">{pos.meaning}</p>
                    </button>
                  ))}
                </div>
              </div>

              {/* Gender-themed accent bar */}
              {gender && (
                <motion.div
                  initial={{ scaleX: 0 }}
                  animate={{ scaleX: 1 }}
                  transition={{ type: 'spring', stiffness: 300, damping: 25 }}
                  className="w-full h-1 rounded-full mb-4 origin-left"
                  style={{ backgroundColor: genderAccent }}
                />
              )}

              {/* Error Message */}
              {error && (
                <motion.p
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="text-brand-red text-sm mb-3 text-center w-full"
                >
                  {error}
                </motion.p>
              )}

              {/* Continue Button */}
              <Button
                onClick={handleDetailsContinue}
                disabled={!gender}
                className={`w-full h-12 font-semibold text-base rounded-lg disabled:opacity-40 text-white transition-colors ${
                  gender === 'boy'
                    ? 'bg-brand-blue hover:bg-brand-blue-dark'
                    : gender === 'girl'
                      ? 'bg-brand-red hover:bg-brand-red-dark'
                      : 'bg-brand-red-dark hover:bg-brand-red-dark/90'
                }`}
              >
                Continue
                <ChevronRight className="w-4 h-4 ml-1" />
              </Button>
            </motion.div>
          )}

          {/* ─── Stage 3: Role Selection (only for new signups) ─── */}
          {stage === 'role' && (
            <motion.div
              key="role"
              custom={direction}
              variants={slideVariants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{ type: 'spring', stiffness: 300, damping: 30 }}
              className="flex flex-col items-center"
            >
              <button
                onClick={goBack}
                className="self-start flex items-center text-warm-600 hover:text-warm-800 transition-colors mb-4 text-sm"
              >
                <ArrowLeft className="w-4 h-4 mr-1" />
                Back
              </button>

              <h2 className="text-xl font-bold text-warm-800 mb-1">
                What&apos;s your role?
              </h2>
              <p className="text-warm-600 text-sm mb-6 text-center">
                Select one or more roles that apply to you
              </p>

              <div className="w-full flex flex-col gap-3 mb-6">
                {roles.map((role, idx) => {
                  const isSelected = selectedRoles.has(role.id);
                  const Icon = role.icon;
                  return (
                    <motion.button
                      key={role.id}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: idx * 0.1 }}
                      onClick={() => toggleRole(role.id)}
                      className={`w-full flex items-center gap-4 p-4 rounded-xl border transition-all text-left ${
                        isSelected
                          ? `bg-gradient-to-r ${role.color} ${role.borderColor} shadow-lg ${role.glowColor}`
                          : 'bg-warm-100 border-warm-300 hover:border-warm-200'
                      }`}
                    >
                      <div
                        className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 ${
                          isSelected
                            ? 'bg-white/20'
                            : 'bg-warm-200'
                        }`}
                      >
                        <Icon
                          className={`w-6 h-6 ${
                            isSelected ? 'text-white' : 'text-warm-600'
                          }`}
                        />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div
                          className={`font-semibold text-sm ${
                            isSelected ? 'text-white' : 'text-warm-800'
                          }`}
                        >
                          {role.title}
                        </div>
                        <div
                          className={`text-xs mt-0.5 ${
                            isSelected ? 'text-white/70' : 'text-warm-600'
                          }`}
                        >
                          {role.description}
                        </div>
                      </div>
                      <div
                        className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 transition-all ${
                          isSelected
                            ? 'border-white bg-white'
                            : 'border-warm-300'
                        }`}
                      >
                        {isSelected && (
                          <motion.div
                            initial={{ scale: 0 }}
                            animate={{ scale: 1 }}
                            className="w-2.5 h-2.5 rounded-full bg-warm-50"
                          />
                        )}
                      </div>
                    </motion.button>
                  );
                })}
              </div>

              <Button
                onClick={handleGetStarted}
                disabled={isSubmitting || selectedRoles.size === 0}
                className={`w-full h-12 font-semibold text-base rounded-lg disabled:opacity-40 text-white ${
                  gender === 'boy'
                    ? 'bg-brand-blue hover:bg-brand-blue-dark'
                    : gender === 'girl'
                      ? 'bg-brand-red hover:bg-brand-red-dark'
                      : 'bg-brand-red-dark hover:bg-brand-red-dark/90'
                }`}
              >
                {isSubmitting ? (
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Setting up...
                  </div>
                ) : (
                  <>
                    Get Started
                    <ChevronRight className="w-4 h-4 ml-1" />
                  </>
                )}
              </Button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Progress dots */}
      <div className="flex gap-2 mt-8 relative z-10">
        {(['auth', 'details', 'role'] as Stage[]).map((s, idx) => (
          <div
            key={s}
            className={`h-1.5 rounded-full transition-all duration-300 ${
              stageIndex[stage] === idx
                ? 'w-8 bg-brand-red'
                : stageIndex[stage] > idx
                  ? 'w-4 bg-brand-red-dark'
                  : 'w-4 bg-warm-300'
            }`}
          />
        ))}
      </div>
    </div>
  );
}
