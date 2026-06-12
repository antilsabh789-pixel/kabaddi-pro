'use client';

import { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Trophy, Shield, Megaphone, ChevronRight, ArrowLeft,
  Phone, Eye, EyeOff, User, Lock, Weight, MapPin,
  CircleDot, Zap, Check, Loader2, KeyRound, ArrowRight, Mail
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useKabaddiStore } from '@/lib/store';

type Stage = 'auth' | 'details' | 'role';
type ForgotStage = 'phone' | 'otp' | 'new-password' | 'success';

const roles = [
  {
    id: 'player',
    title: 'Player',
    description: 'Track your raids, tackles, and performance stats',
    icon: Shield,
    color: 'from-brand-red to-brand-red-dark',
    borderColor: 'border-brand-red/40',
    glowColor: 'shadow-brand-red/20',
    animClass: 'animate-pulse',
  },
  {
    id: 'coach',
    title: 'Coach',
    description: 'Manage teams, strategies, and match tactics',
    icon: Megaphone,
    color: 'from-brand-green to-brand-green-dark',
    borderColor: 'border-brand-green/40',
    glowColor: 'shadow-brand-green/20',
    animClass: 'animate-bounce',
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

/* ── Password Strength Helper ── */
function getPasswordStrength(pwd: string): { label: string; color: string; pct: number; barColor: string } {
  if (!pwd) return { label: '', color: '', pct: 0, barColor: '' };
  let score = 0;
  if (pwd.length >= 6) score++;
  if (pwd.length >= 8) score++;
  if (/[A-Z]/.test(pwd)) score++;
  if (/[0-9]/.test(pwd)) score++;
  if (/[^A-Za-z0-9]/.test(pwd)) score++;

  if (score <= 1) return { label: 'Weak', color: 'text-red-500', pct: 25, barColor: 'bg-red-500' };
  if (score <= 2) return { label: 'Medium', color: 'text-amber-500', pct: 50, barColor: 'bg-amber-500' };
  if (score <= 3) return { label: 'Strong', color: 'text-emerald-500', pct: 75, barColor: 'bg-emerald-500' };
  return { label: 'Very Strong', color: 'text-teal-500', pct: 100, barColor: 'bg-teal-500' };
}

/* ── Floating gold particles for background ── */
function FloatingParticles() {
  const particles = useMemo(
    () =>
      Array.from({ length: 24 }, (_, i) => ({
        id: i,
        left: `${Math.random() * 100}%`,
        top: `${Math.random() * 100}%`,
        size: 2 + Math.random() * 5,
        delay: Math.random() * 5,
        duration: 6 + Math.random() * 10,
        opacity: 0.15 + Math.random() * 0.3,
      })),
    [],
  );

  return (
    <>
      {particles.map((p) => (
        <motion.div
          key={p.id}
          className="absolute rounded-full bg-brand-gold/70 dark:bg-brand-gold/40"
          style={{
            left: p.left,
            top: p.top,
            width: p.size,
            height: p.size,
            opacity: p.opacity,
          }}
          animate={{
            y: [0, -30, 0],
            x: [0, Math.random() > 0.5 ? 10 : -10, 0],
            opacity: [p.opacity, p.opacity * 0.4, p.opacity],
          }}
          transition={{
            duration: p.duration,
            delay: p.delay,
            repeat: Infinity,
            ease: 'easeInOut',
          }}
        />
      ))}
    </>
  );
}

/* ── Kabaddi court pattern lines ── */
function CourtPattern() {
  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden opacity-[0.04] dark:opacity-[0.06]">
      {/* Horizontal court lines */}
      {[20, 40, 60, 80].map((top) => (
        <div
          key={`h-${top}`}
          className="absolute left-0 right-0 border-t border-brand-gold/60"
          style={{ top: `${top}%` }}
        />
      ))}
      {/* Vertical center line */}
      <div className="absolute top-0 bottom-0 left-1/2 -translate-x-1/2 border-l border-brand-gold/60" />
      {/* Center circle */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-40 h-40 md:w-56 md:h-56 rounded-full border-2 border-brand-gold/60" />
      {/* Bonus area circles */}
      <div className="absolute top-[30%] left-1/2 -translate-x-1/2 w-20 h-20 md:w-28 md:h-28 rounded-full border border-brand-gold/60" />
      <div className="absolute top-[62%] left-1/2 -translate-x-1/2 w-20 h-20 md:w-28 md:h-28 rounded-full border border-brand-gold/60" />
      {/* Crossed lines */}
      <div className="absolute top-0 left-0 right-0 bottom-0" style={{ transform: 'rotate(45deg)', transformOrigin: 'center' }}>
        <div className="absolute top-1/2 left-0 right-0 border-t border-brand-gold/40" />
      </div>
      <div className="absolute top-0 left-0 right-0 bottom-0" style={{ transform: 'rotate(-45deg)', transformOrigin: 'center' }}>
        <div className="absolute top-1/2 left-0 right-0 border-t border-brand-gold/40" />
      </div>
    </div>
  );
}

/* ── Success Checkmark Animation ── */
function SuccessCheckmark() {
  return (
    <motion.div
      initial={{ scale: 0 }}
      animate={{ scale: 1 }}
      transition={{ type: 'spring', stiffness: 300, damping: 20 }}
      className="w-16 h-16 rounded-full bg-emerald-500 flex items-center justify-center mx-auto mb-4"
    >
      <motion.div
        initial={{ scale: 0, rotate: -90 }}
        animate={{ scale: 1, rotate: 0 }}
        transition={{ delay: 0.2, type: 'spring', stiffness: 400, damping: 15 }}
      >
        <Check className="w-8 h-8 text-white" strokeWidth={3} />
      </motion.div>
    </motion.div>
  );
}

/* ── OTP Input Boxes ── */
function OTPInput({ value, onChange, length = 6 }: { value: string; onChange: (val: string) => void; length?: number }) {
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  const handleChange = (index: number, digit: string) => {
    if (!/^\d*$/.test(digit)) return;
    const newVal = value.split('');
    newVal[index] = digit;
    const combined = newVal.join('');
    onChange(combined);
    if (digit && index < length - 1) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !value[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, length);
    onChange(pasted.padEnd(length, ''));
    const focusIdx = Math.min(pasted.length, length - 1);
    inputRefs.current[focusIdx]?.focus();
  };

  return (
    <div className="flex gap-2 justify-center" onPaste={handlePaste}>
      {Array.from({ length }, (_, i) => (
        <motion.div
          key={i}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: i * 0.05 }}
        >
          <input
            ref={(el) => { inputRefs.current[i] = el; }}
            type="text"
            inputMode="numeric"
            maxLength={1}
            value={value[i] || ''}
            onChange={(e) => handleChange(i, e.target.value)}
            onKeyDown={(e) => handleKeyDown(i, e)}
            className="w-11 h-13 text-center text-lg font-bold rounded-xl border-2 border-warm-300/60 dark:border-warm-600/40 bg-white/60 dark:bg-white/5 text-warm-800 dark:text-warm-100 focus:border-brand-red focus:ring-2 focus:ring-brand-red/30 outline-none transition-all"
            style={{ height: 52 }}
          />
        </motion.div>
      ))}
    </div>
  );
}

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
  const [termsAccepted, setTermsAccepted] = useState(false);

  // New fields
  const [gender, setGender] = useState<'boy' | 'girl' | ''>('');
  const [weight, setWeight] = useState('');
  const [practiceGround, setPracticeGround] = useState('');
  const [position, setPosition] = useState('');

  // Forgot password flow
  const [showForgot, setShowForgot] = useState(false);
  const [forgotStage, setForgotStage] = useState<ForgotStage>('phone');
  const [forgotPhone, setForgotPhone] = useState('');
  const [otpValue, setOtpValue] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [forgotError, setForgotError] = useState('');
  const [forgotSubmitting, setForgotSubmitting] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);

  const login = useKabaddiStore((s) => s.login);
  const setOnboarded = useKabaddiStore((s) => s.setOnboarded);

  const passwordStrength = getPasswordStrength(password);

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
    if (isSignUp && !termsAccepted) {
      setError('Please accept the Terms & Conditions');
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

      // Show success animation briefly
      setShowSuccess(true);
      setTimeout(() => {
        setShowSuccess(false);
        if (isSignUp) {
          goNext('details');
        } else {
          setOnboarded(true);
        }
      }, 800);
    } catch {
      setError('Something went wrong. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  }, [phone, name, password, confirmPassword, isSignUp, selectedRoles, countryCode, login, setOnboarded, goNext, gender, weight, practiceGround, termsAccepted]);

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

  /* ── Forgot Password Handlers ── */
  const handleForgotSendOTP = useCallback(async () => {
    setForgotError('');
    if (forgotPhone.length !== 10) {
      setForgotError('Please enter a valid 10-digit phone number');
      return;
    }
    setForgotSubmitting(true);
    try {
      const res = await fetch('/api/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'forgot-password',
          phone: `+91${forgotPhone}`,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setForgotError(data.error || 'Failed to send OTP');
        return;
      }
      setForgotStage('otp');
    } catch {
      setForgotError('Something went wrong. Please try again.');
    } finally {
      setForgotSubmitting(false);
    }
  }, [forgotPhone]);

  const handleVerifyOTP = useCallback(async () => {
    setForgotError('');
    if (otpValue.length !== 6) {
      setForgotError('Please enter the 6-digit OTP');
      return;
    }
    setForgotSubmitting(true);
    try {
      const res = await fetch('/api/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'verify-otp',
          phone: `+91${forgotPhone}`,
          otp: otpValue,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setForgotError(data.error || 'Invalid OTP');
        return;
      }
      setForgotStage('new-password');
    } catch {
      setForgotError('Something went wrong. Please try again.');
    } finally {
      setForgotSubmitting(false);
    }
  }, [otpValue, forgotPhone]);

  const handleResetPassword = useCallback(async () => {
    setForgotError('');
    if (newPassword.length < 6) {
      setForgotError('Password must be at least 6 characters');
      return;
    }
    if (newPassword !== confirmNewPassword) {
      setForgotError('Passwords do not match');
      return;
    }
    setForgotSubmitting(true);
    try {
      const res = await fetch('/api/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'reset-password',
          phone: `+91${forgotPhone}`,
          otp: otpValue,
          password: newPassword,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setForgotError(data.error || 'Failed to reset password');
        return;
      }
      setForgotStage('success');
    } catch {
      setForgotError('Something went wrong. Please try again.');
    } finally {
      setForgotSubmitting(false);
    }
  }, [newPassword, confirmNewPassword, forgotPhone, otpValue]);

  const stageIndex: Record<Stage, number> = { auth: 0, details: 1, role: 2 };

  // Gender-based accent color
  const genderAccent = gender === 'boy' ? '#1E293B' : gender === 'girl' ? '#DC2626' : '';

  return (
    <div className="min-h-screen bg-gradient-to-br from-warm-50 via-white to-warm-100 dark:from-brand-navy-dark dark:via-brand-navy-dark dark:to-brand-navy flex flex-col items-center justify-center px-4 relative overflow-hidden">
      {/* ── Animated Background ── */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {/* Rich gradient overlay: dark red to deep navy */}
        <div className="absolute inset-0 bg-gradient-to-br from-brand-red/5 via-transparent to-brand-navy/10 dark:from-brand-red/8 dark:via-transparent dark:to-brand-navy/15" />

        {/* Gradient blobs */}
        <div className="absolute -top-40 -right-40 w-96 h-96 bg-brand-red/8 dark:bg-brand-red/5 rounded-full blur-3xl" />
        <div className="absolute -bottom-40 -left-40 w-96 h-96 bg-brand-red-dark/8 dark:bg-brand-red-dark/5 rounded-full blur-3xl" />
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[28rem] h-[28rem] bg-brand-red/12 dark:bg-brand-red/6 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 right-0 w-64 h-64 bg-brand-gold/8 dark:bg-brand-gold/5 rounded-full blur-3xl" />
        <div className="absolute top-10 left-10 w-48 h-48 bg-brand-teal/6 dark:bg-brand-teal/4 rounded-full blur-3xl" />

        {/* Kabaddi court pattern */}
        <CourtPattern />

        {/* Floating gold particles */}
        <FloatingParticles />

        {/* Slow-spinning decorative ring */}
        <div
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full border border-brand-gold/5 dark:border-brand-gold/3"
          style={{ animation: 'spin-slow 60s linear infinite' }}
        />
        <div
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[450px] h-[450px] rounded-full border border-brand-red/5 dark:border-brand-red/3"
          style={{ animation: 'spin-slow 45s linear infinite reverse' }}
        />
      </div>

      {/* ── Success Overlay ── */}
      <AnimatePresence>
        {showSuccess && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center"
          >
            <SuccessCheckmark />
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Forgot Password Modal ── */}
      <AnimatePresence>
        {showForgot && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm flex items-center justify-center px-4"
            onClick={(e) => { if (e.target === e.currentTarget) { setShowForgot(false); setForgotStage('phone'); setForgotPhone(''); setOtpValue(''); setNewPassword(''); setConfirmNewPassword(''); setForgotError(''); } }}
          >
            <motion.div
              initial={{ scale: 0.9, y: 30 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 30 }}
              transition={{ type: 'spring', stiffness: 300, damping: 25 }}
              className="w-full max-w-sm bg-white/10 dark:bg-white/5 backdrop-blur-xl rounded-2xl border border-white/20 p-6 shadow-2xl"
            >
              <AnimatePresence mode="wait">
                {/* ── Stage: Phone ── */}
                {forgotStage === 'phone' && (
                  <motion.div key="forgot-phone" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} transition={{ duration: 0.2 }}>
                    <div className="flex items-center gap-3 mb-4">
                      <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-brand-red to-brand-red-dark flex items-center justify-center">
                        <KeyRound className="w-6 h-6 text-white" />
                      </div>
                      <div>
                        <h3 className="text-lg font-bold text-warm-800 dark:text-warm-100">Reset Password</h3>
                        <p className="text-xs text-warm-500 dark:text-warm-400">We&apos;ll send you an OTP to verify</p>
                      </div>
                    </div>

                    <label className="text-sm font-semibold text-warm-700 dark:text-warm-300 mb-2 block">Phone Number</label>
                    <div className="flex gap-2 mb-4">
                      <div className="flex items-center justify-center h-12 px-3 rounded-xl bg-brand-red/10 border border-brand-red/30 text-brand-red font-bold text-sm shrink-0">
                        +91
                      </div>
                      <Input
                        type="tel"
                        inputMode="numeric"
                        maxLength={10}
                        placeholder="Enter phone number"
                        value={forgotPhone}
                        onChange={(e) => {
                          const val = e.target.value.replace(/\D/g, '');
                          setForgotPhone(val);
                          if (forgotError) setForgotError('');
                        }}
                        className="h-12 bg-white/60 dark:bg-white/5 border-warm-300/60 dark:border-warm-600/40 text-warm-800 dark:text-warm-100 placeholder:text-warm-400 text-base rounded-xl"
                      />
                    </div>

                    <AnimatePresence>
                      {forgotError && (
                        <motion.p initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="text-brand-red text-xs mb-3 text-center">{forgotError}</motion.p>
                      )}
                    </AnimatePresence>

                    <Button
                      onClick={handleForgotSendOTP}
                      disabled={forgotSubmitting || forgotPhone.length !== 10}
                      className="w-full h-12 bg-gradient-to-r from-brand-red to-brand-red-dark hover:from-brand-red-light hover:to-brand-red text-white font-semibold rounded-xl disabled:opacity-40 shadow-lg shadow-brand-red/25"
                    >
                      {forgotSubmitting ? (
                        <div className="flex items-center gap-2">
                          <Loader2 className="w-4 h-4 animate-spin" />
                          Sending OTP...
                        </div>
                      ) : (
                        <>Send OTP <ArrowRight className="w-4 h-4 ml-1" /></>
                      )}
                    </Button>
                  </motion.div>
                )}

                {/* ── Stage: OTP ── */}
                {forgotStage === 'otp' && (
                  <motion.div key="forgot-otp" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} transition={{ duration: 0.2 }}>
                    <div className="flex items-center gap-3 mb-4">
                      <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-brand-gold to-brand-gold-dark flex items-center justify-center">
                        <Mail className="w-6 h-6 text-white" />
                      </div>
                      <div>
                        <h3 className="text-lg font-bold text-warm-800 dark:text-warm-100">Enter OTP</h3>
                        <p className="text-xs text-warm-500 dark:text-warm-400">Sent to +91{forgotPhone}</p>
                      </div>
                    </div>

                    <label className="text-sm font-semibold text-warm-700 dark:text-warm-300 mb-3 block">6-Digit Code</label>
                    <div className="mb-4">
                      <OTPInput value={otpValue} onChange={setOtpValue} />
                    </div>
                    <p className="text-[10px] text-warm-400 dark:text-warm-500 text-center mb-4">Demo OTP: 123456</p>

                    <AnimatePresence>
                      {forgotError && (
                        <motion.p initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="text-brand-red text-xs mb-3 text-center">{forgotError}</motion.p>
                      )}
                    </AnimatePresence>

                    <Button
                      onClick={handleVerifyOTP}
                      disabled={forgotSubmitting || otpValue.length !== 6}
                      className="w-full h-12 bg-gradient-to-r from-brand-gold to-brand-gold-dark hover:from-brand-gold hover:to-brand-gold text-white font-semibold rounded-xl disabled:opacity-40 shadow-lg shadow-brand-gold/25"
                    >
                      {forgotSubmitting ? (
                        <div className="flex items-center gap-2">
                          <Loader2 className="w-4 h-4 animate-spin" />
                          Verifying...
                        </div>
                      ) : (
                        <>Verify OTP <ArrowRight className="w-4 h-4 ml-1" /></>
                      )}
                    </Button>
                  </motion.div>
                )}

                {/* ── Stage: New Password ── */}
                {forgotStage === 'new-password' && (
                  <motion.div key="forgot-newpw" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} transition={{ duration: 0.2 }}>
                    <div className="flex items-center gap-3 mb-4">
                      <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-brand-teal to-emerald-600 flex items-center justify-center">
                        <Lock className="w-6 h-6 text-white" />
                      </div>
                      <div>
                        <h3 className="text-lg font-bold text-warm-800 dark:text-warm-100">New Password</h3>
                        <p className="text-xs text-warm-500 dark:text-warm-400">Choose a strong password</p>
                      </div>
                    </div>

                    <div className="relative mb-3">
                      <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-brand-teal/60 pointer-events-none" />
                      <Input
                        type={showNewPassword ? 'text' : 'password'}
                        placeholder="New password"
                        value={newPassword}
                        onChange={(e) => { setNewPassword(e.target.value); if (forgotError) setForgotError(''); }}
                        className="h-12 bg-white/60 dark:bg-white/5 border-warm-300/60 dark:border-warm-600/40 text-warm-800 dark:text-warm-100 placeholder:text-warm-400 text-base rounded-xl pl-10 pr-12"
                      />
                      <button type="button" onClick={() => setShowNewPassword(!showNewPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-warm-400 hover:text-brand-teal">
                        {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>

                    {/* Password strength indicator */}
                    {newPassword && (
                      <div className="mb-3">
                        <div className="w-full h-1.5 bg-warm-200 dark:bg-warm-700 rounded-full overflow-hidden">
                          <motion.div
                            initial={{ width: 0 }}
                            animate={{ width: `${getPasswordStrength(newPassword).pct}%` }}
                            className={`h-full rounded-full ${getPasswordStrength(newPassword).barColor}`}
                          />
                        </div>
                        <p className={`text-[10px] mt-1 font-medium ${getPasswordStrength(newPassword).color}`}>
                          {getPasswordStrength(newPassword).label}
                        </p>
                      </div>
                    )}

                    <div className="relative mb-4">
                      <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-brand-teal/60 pointer-events-none" />
                      <Input
                        type="password"
                        placeholder="Confirm new password"
                        value={confirmNewPassword}
                        onChange={(e) => { setConfirmNewPassword(e.target.value); if (forgotError) setForgotError(''); }}
                        className="h-12 bg-white/60 dark:bg-white/5 border-warm-300/60 dark:border-warm-600/40 text-warm-800 dark:text-warm-100 placeholder:text-warm-400 text-base rounded-xl pl-10"
                      />
                    </div>

                    {confirmNewPassword && newPassword !== confirmNewPassword && (
                      <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-red-500 text-xs mb-3">Passwords do not match</motion.p>
                    )}

                    <AnimatePresence>
                      {forgotError && (
                        <motion.p initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="text-brand-red text-xs mb-3 text-center">{forgotError}</motion.p>
                      )}
                    </AnimatePresence>

                    <Button
                      onClick={handleResetPassword}
                      disabled={forgotSubmitting || newPassword.length < 6 || newPassword !== confirmNewPassword}
                      className="w-full h-12 bg-gradient-to-r from-brand-teal to-emerald-600 hover:from-brand-teal hover:to-emerald-500 text-white font-semibold rounded-xl disabled:opacity-40 shadow-lg shadow-brand-teal/25"
                    >
                      {forgotSubmitting ? (
                        <div className="flex items-center gap-2">
                          <Loader2 className="w-4 h-4 animate-spin" />
                          Resetting...
                        </div>
                      ) : (
                        <>Reset Password <ArrowRight className="w-4 h-4 ml-1" /></>
                      )}
                    </Button>
                  </motion.div>
                )}

                {/* ── Stage: Success ── */}
                {forgotStage === 'success' && (
                  <motion.div key="forgot-success" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }} className="text-center py-4">
                    <SuccessCheckmark />
                    <h3 className="text-lg font-bold text-warm-800 dark:text-warm-100 mb-1">Password Reset!</h3>
                    <p className="text-sm text-warm-500 dark:text-warm-400 mb-6">Your password has been changed successfully.</p>
                    <Button
                      onClick={() => {
                        setShowForgot(false);
                        setForgotStage('phone');
                        setForgotPhone('');
                        setOtpValue('');
                        setNewPassword('');
                        setConfirmNewPassword('');
                        setForgotError('');
                      }}
                      className="w-full h-12 bg-gradient-to-r from-brand-red to-brand-red-dark hover:from-brand-red-light hover:to-brand-red text-white font-semibold rounded-xl shadow-lg shadow-brand-red/25"
                    >
                      Login Now <ArrowRight className="w-4 h-4 ml-1" />
                    </Button>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Enhanced Logo Section with Scale-In ── */}
      <motion.div
        className="flex flex-col items-center mb-8 relative z-10"
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.6, ease: 'easeOut', type: 'spring', stiffness: 200 }}
      >
        {/* Pulsing glow ring around logo */}
        <div className="relative mb-4">
          {/* Outer pulsing glow */}
          <div className="absolute -inset-3 rounded-2xl bg-brand-red/20 dark:bg-brand-red/10 blur-lg pulse-glow" />
          {/* Spinning border ring */}
          <div
            className="absolute -inset-1.5 rounded-2xl border-2 border-brand-gold/30 dark:border-brand-gold/20"
            style={{ animation: 'spin-slow 20s linear infinite' }}
          />
          {/* Logo icon - scale-in on mount */}
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.2, type: 'spring', stiffness: 300, damping: 15 }}
            whileHover={{ scale: 1.08, rotate: 5 }}
            whileTap={{ scale: 0.95 }}
            className="w-18 h-18 rounded-2xl bg-gradient-to-br from-brand-red via-brand-red-dark to-brand-red flex items-center justify-center shadow-xl shadow-brand-red/40 cursor-pointer relative z-10"
            style={{ width: 72, height: 72 }}
          >
            <Trophy className="w-9 h-9 text-white drop-shadow-lg" />
          </motion.div>
        </div>

        {/* KABADDI PRO with gradient text */}
        <motion.h1
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="text-3xl font-black tracking-wider"
        >
          <span className="gradient-text">KABADDI</span>{' '}
          <span className="gradient-text">PRO</span>
        </motion.h1>

        {/* Tagline with fade-in */}
        <motion.p
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4, duration: 0.5 }}
          className="text-warm-500 dark:text-warm-400 text-xs tracking-widest mt-1.5 font-medium uppercase"
        >
          Live Scoring &amp; Tournaments
        </motion.p>
      </motion.div>

      {/* ── Stage content ── */}
      <div className="w-full max-w-sm relative z-10">
        <AnimatePresence mode="wait" custom={direction}>

          {/* ═══════════════════════════════════════════
              Stage 1: Login / Sign Up
              ═══════════════════════════════════════════ */}
          {stage === 'auth' && (
            <motion.div
              key="auth"
              custom={direction}
              variants={slideVariants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{ type: 'spring', stiffness: 300, damping: 30 }}
              className="bg-white/10 dark:bg-white/5 backdrop-blur-xl rounded-2xl border border-white/30 dark:border-white/10 p-6 shadow-xl shadow-black/5 dark:shadow-black/20"
            >
              {/* Progress dots at top */}
              <div className="flex justify-center gap-2 mb-5">
                {(['auth', 'details', 'role'] as Stage[]).map((s, idx) => (
                  <motion.div
                    key={s}
                    className="h-1.5 rounded-full transition-all duration-500"
                    animate={{
                      width: stageIndex[stage] === idx ? 32 : stageIndex[stage] > idx ? 16 : 16,
                      backgroundColor:
                        stageIndex[stage] === idx
                          ? '#DC2626'
                          : stageIndex[stage] > idx
                            ? '#B91C1C'
                            : '#CBD5E1',
                    }}
                  />
                ))}
              </div>

              <h2 className="text-xl font-bold text-warm-800 dark:text-warm-100 mb-1 text-center">
                {isSignUp ? 'Create Account' : 'Welcome Back!'}
              </h2>
              <p className="text-warm-500 dark:text-warm-400 text-sm mb-6 text-center">
                {isSignUp
                  ? 'Sign up to get started with Kabaddi Pro'
                  : 'Login to your Kabaddi Pro account'}
              </p>

              {/* ── Signup: Name field with user icon ── */}
              <AnimatePresence>
                {isSignUp && (
                  <motion.div
                    initial={{ opacity: 0, height: 0, marginBottom: 0 }}
                    animate={{ opacity: 1, height: 'auto', marginBottom: 12 }}
                    exit={{ opacity: 0, height: 0, marginBottom: 0 }}
                    transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                    className="w-full overflow-hidden"
                  >
                    <div className="relative">
                      <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-brand-red/60 dark:text-brand-red-light/60 pointer-events-none" />
                      <Input
                        type="text"
                        placeholder="Enter your name"
                        value={name}
                        onChange={(e) => {
                          setName(e.target.value);
                          if (error) setError('');
                        }}
                        className="h-12 bg-white/60 dark:bg-white/5 border-warm-300/60 dark:border-warm-600/40 text-warm-800 dark:text-warm-100 placeholder:text-warm-400 dark:placeholder:text-warm-500 text-base rounded-xl pl-10 focus:ring-2 focus:ring-brand-red/40 focus:border-brand-red/60 transition-all"
                      />
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* ── Phone Input with +91 chip ── */}
              <div className="w-full flex gap-2 mb-3">
                <div className="flex items-center justify-center h-12 px-3 rounded-xl bg-brand-red/10 border border-brand-red/30 text-brand-red dark:text-brand-red-light font-bold text-sm shrink-0 gap-1.5">
                  <Phone className="w-3.5 h-3.5" />
                  +91
                </div>
                <motion.div className="flex-1 relative" whileFocus={{ scale: 1.01 }}>
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
                    className="h-12 bg-white/60 dark:bg-white/5 border-warm-300/60 dark:border-warm-600/40 text-warm-800 dark:text-warm-100 placeholder:text-warm-400 dark:placeholder:text-warm-500 text-base rounded-xl focus:ring-2 focus:ring-brand-red/40 focus:border-brand-red/60 transition-all"
                  />
                </motion.div>
              </div>

              {/* ── Password Input with show/hide toggle ── */}
              <div className="w-full relative mb-1">
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-brand-red/60 dark:text-brand-red-light/60 pointer-events-none" />
                  <Input
                    type={showPassword ? 'text' : 'password'}
                    placeholder={isSignUp ? 'Create a password' : 'Enter password'}
                    value={password}
                    onChange={(e) => {
                      setPassword(e.target.value);
                      if (error) setError('');
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !isSignUp) handleAuth();
                    }}
                    className="h-12 bg-white/60 dark:bg-white/5 border-warm-300/60 dark:border-warm-600/40 text-warm-800 dark:text-warm-100 placeholder:text-warm-400 dark:placeholder:text-warm-500 text-base rounded-xl pl-10 pr-12 focus:ring-2 focus:ring-brand-red/40 focus:border-brand-red/60 transition-all"
                  />
                  <motion.button
                    type="button"
                    whileHover={{ scale: 1.1 }}
                    whileTap={{ scale: 0.9 }}
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded-md text-warm-400 hover:text-brand-red dark:text-warm-500 dark:hover:text-brand-red-light transition-colors"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </motion.button>
                </div>

                {/* ── Password Strength Indicator (Signup) ── */}
                {isSignUp && password && (
                  <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} className="mt-2 mb-1">
                    <div className="w-full h-1.5 bg-warm-200 dark:bg-warm-700 rounded-full overflow-hidden">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${passwordStrength.pct}%` }}
                        className={`h-full rounded-full transition-colors ${passwordStrength.barColor}`}
                      />
                    </div>
                    <p className={`text-[10px] mt-1 font-medium ${passwordStrength.color}`}>
                      {passwordStrength.label}
                    </p>
                  </motion.div>
                )}

                {!isSignUp && password && password.length < 6 && (
                  <motion.p
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    className="text-xs text-warm-400 dark:text-warm-500 mt-1.5 ml-1"
                  >
                    Password must be at least 6 characters
                  </motion.p>
                )}
              </div>

              {/* ── Forgot Password Link ── */}
              {!isSignUp && (
                <div className="flex justify-end mb-3">
                  <motion.button
                    whileHover={{ x: 2 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => { setShowForgot(true); setForgotStage('phone'); }}
                    className="text-xs font-medium text-brand-red dark:text-brand-red-light hover:text-brand-red-dark dark:hover:text-brand-red transition-colors"
                  >
                    Forgot Password?
                  </motion.button>
                </div>
              )}

              {/* ── Confirm Password (Signup only) with match/mismatch indicator ── */}
              <AnimatePresence>
                {isSignUp && (
                  <motion.div
                    initial={{ opacity: 0, height: 0, marginBottom: 0 }}
                    animate={{ opacity: 1, height: 'auto', marginBottom: 12 }}
                    exit={{ opacity: 0, height: 0, marginBottom: 0 }}
                    transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                    className="w-full overflow-hidden"
                  >
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-brand-red/60 dark:text-brand-red-light/60 pointer-events-none" />
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
                        className="h-12 bg-white/60 dark:bg-white/5 border-warm-300/60 dark:border-warm-600/40 text-warm-800 dark:text-warm-100 placeholder:text-warm-400 dark:placeholder:text-warm-500 text-base rounded-xl pl-10 pr-12 focus:ring-2 focus:ring-brand-red/40 focus:border-brand-red/60 transition-all"
                      />
                      <motion.button
                        type="button"
                        whileHover={{ scale: 1.1 }}
                        whileTap={{ scale: 0.9 }}
                        onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded-md text-warm-400 hover:text-brand-red dark:text-warm-500 dark:hover:text-brand-red-light transition-colors"
                      >
                        {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </motion.button>
                    </div>
                    {/* Match/mismatch indicator */}
                    {confirmPassword && (
                      <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="flex items-center gap-1.5 mt-1.5 ml-1"
                      >
                        {password === confirmPassword ? (
                          <>
                            <div className="w-4 h-4 rounded-full bg-emerald-500 flex items-center justify-center">
                              <Check className="w-2.5 h-2.5 text-white" strokeWidth={3} />
                            </div>
                            <span className="text-xs font-medium text-emerald-500">Passwords match</span>
                          </>
                        ) : (
                          <>
                            <div className="w-4 h-4 rounded-full bg-red-500 flex items-center justify-center">
                              <CircleDot className="w-2.5 h-2.5 text-white" />
                            </div>
                            <span className="text-xs font-medium text-red-500">Passwords do not match</span>
                          </>
                        )}
                      </motion.div>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>

              {/* ── Terms & Conditions Checkbox (Signup) ── */}
              <AnimatePresence>
                {isSignUp && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="flex items-start gap-2.5 mb-4"
                  >
                    <motion.button
                      type="button"
                      whileTap={{ scale: 0.9 }}
                      onClick={() => setTermsAccepted(!termsAccepted)}
                      className={`mt-0.5 w-5 h-5 rounded-md border-2 flex items-center justify-center shrink-0 transition-all ${
                        termsAccepted
                          ? 'bg-brand-red border-brand-red'
                          : 'border-warm-300 dark:border-warm-600 bg-white/40 dark:bg-white/5'
                      }`}
                    >
                      {termsAccepted && (
                        <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring', stiffness: 500 }}>
                          <Check className="w-3 h-3 text-white" strokeWidth={3} />
                        </motion.div>
                      )}
                    </motion.button>
                    <p className="text-[11px] text-warm-500 dark:text-warm-400 leading-relaxed">
                      I agree to the{' '}
                      <span className="text-brand-red dark:text-brand-red-light font-medium">Terms of Service</span>{' '}
                      and{' '}
                      <span className="text-brand-red dark:text-brand-red-light font-medium">Privacy Policy</span>
                    </p>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Error Message */}
              <AnimatePresence>
                {error && (
                  <motion.p
                    initial={{ opacity: 0, y: -8, height: 0 }}
                    animate={{ opacity: 1, y: 0, height: 'auto' }}
                    exit={{ opacity: 0, y: -8, height: 0 }}
                    transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                    className="text-brand-red dark:text-brand-red-light text-sm mb-3 text-center w-full flex items-center justify-center gap-1.5"
                  >
                    <CircleDot className="w-3.5 h-3.5 shrink-0" />
                    {error}
                  </motion.p>
                )}
              </AnimatePresence>

              {/* ── Submit Button with gradient + shimmer ── */}
              <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                <Button
                  onClick={handleAuth}
                  disabled={
                    isSubmitting ||
                    phone.length !== 10 ||
                    password.length < 6 ||
                    (isSignUp && (!confirmPassword || password !== confirmPassword || !termsAccepted))
                  }
                  className="w-full h-12 bg-gradient-to-r from-brand-red to-brand-red-dark hover:from-brand-red-light hover:to-brand-red text-white font-semibold text-base rounded-xl disabled:opacity-40 shadow-lg shadow-brand-red/25 hover:shadow-xl hover:shadow-brand-red/30 transition-all relative overflow-hidden group"
                >
                  {/* Shimmer hover effect */}
                  <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/0 to-transparent group-hover:via-white/20 transition-all duration-500 -translate-x-full group-hover:translate-x-full" />
                  <span className="relative z-10 flex items-center justify-center gap-1.5">
                    {isSubmitting ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Please wait...
                      </>
                    ) : isSignUp ? (
                      <>
                        Create Account
                        <ChevronRight className="w-4 h-4" />
                      </>
                    ) : (
                      <>
                        Login
                        <ChevronRight className="w-4 h-4" />
                      </>
                    )}
                  </span>
                </Button>
              </motion.div>

              {/* ── OR divider ── */}
              <div className="flex items-center gap-3 my-5">
                <div className="flex-1 h-px bg-warm-200 dark:bg-warm-700" />
                <span className="text-[10px] font-bold text-warm-400 dark:text-warm-500 uppercase tracking-widest">OR</span>
                <div className="flex-1 h-px bg-warm-200 dark:bg-warm-700" />
              </div>

              {/* ── Toggle Login/Signup with animated underline ── */}
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                className="text-brand-red hover:text-brand-red-light dark:text-brand-red-light dark:hover:text-brand-red text-sm font-medium transition-colors w-full text-center group relative"
                onClick={() => {
                  setIsSignUp(!isSignUp);
                  setError('');
                  setConfirmPassword('');
                  setTermsAccepted(false);
                }}
              >
                <span className="relative">
                  {isSignUp
                    ? 'Already have an account? Login'
                    : "Don't have an account? Sign Up"}
                  {/* Animated underline */}
                  <motion.div
                    className="absolute -bottom-0.5 left-0 right-0 h-[1.5px] bg-brand-red dark:bg-brand-red-light rounded-full"
                    initial={{ scaleX: 0 }}
                    whileHover={{ scaleX: 1 }}
                    transition={{ duration: 0.3 }}
                    style={{ transformOrigin: 'center' }}
                  />
                </span>
              </motion.button>
            </motion.div>
          )}

          {/* ═══════════════════════════════════════════
              Stage 2: Details (Gender, Weight, Practice Ground)
              ═══════════════════════════════════════════ */}
          {stage === 'details' && (
            <motion.div
              key="details"
              custom={direction}
              variants={slideVariants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{ type: 'spring', stiffness: 300, damping: 30 }}
              className="bg-white/10 dark:bg-white/5 backdrop-blur-xl rounded-2xl border border-white/30 dark:border-white/10 p-6 shadow-xl shadow-black/5 dark:shadow-black/20"
            >
              {/* Progress dots at top */}
              <div className="flex justify-center gap-2 mb-5">
                {(['auth', 'details', 'role'] as Stage[]).map((s, idx) => (
                  <motion.div
                    key={s}
                    className="h-1.5 rounded-full"
                    animate={{
                      width: stageIndex[stage] === idx ? 32 : stageIndex[stage] > idx ? 16 : 16,
                      backgroundColor:
                        stageIndex[stage] === idx
                          ? '#DC2626'
                          : stageIndex[stage] > idx
                            ? '#B91C1C'
                            : '#CBD5E1',
                    }}
                    transition={{ duration: 0.5 }}
                  />
                ))}
              </div>

              <motion.button
                whileHover={{ x: -3 }}
                whileTap={{ scale: 0.95 }}
                onClick={goBack}
                className="self-start flex items-center text-warm-500 dark:text-warm-400 hover:text-warm-800 dark:hover:text-warm-200 transition-colors mb-4 text-sm"
              >
                <ArrowLeft className="w-4 h-4 mr-1" />
                Back
              </motion.button>

              <h2 className="text-xl font-bold text-warm-800 dark:text-warm-100 mb-1">Tell us about yourself</h2>
              <p className="text-warm-500 dark:text-warm-400 text-sm mb-6 text-center">
                Help us personalize your experience
              </p>

              {/* Gender Selection - Enhanced with gradient backgrounds */}
              <div className="w-full mb-5">
                <label className="text-sm font-semibold text-warm-700 dark:text-warm-300 mb-3 block">
                  Gender <span className="text-brand-red">*</span>
                </label>
                <div className="grid grid-cols-2 gap-3">
                  {/* Boy Card */}
                  <motion.button
                    type="button"
                    whileHover={{ scale: 1.03, y: -2 }}
                    whileTap={{ scale: 0.97 }}
                    onClick={() => {
                      setGender('boy');
                      if (error) setError('');
                    }}
                    className={`relative flex flex-col items-center justify-center gap-2 p-6 rounded-2xl border-2 transition-all overflow-hidden ${
                      gender === 'boy'
                        ? 'border-brand-blue bg-gradient-to-br from-brand-blue to-brand-blue-dark shadow-lg shadow-brand-blue/25'
                        : 'border-warm-300/60 dark:border-warm-600/40 bg-white/60 dark:bg-white/5 hover:border-brand-blue/40 hover:shadow-md'
                    }`}
                  >
                    {gender === 'boy' && (
                      <motion.div
                        initial={{ scale: 0, opacity: 0 }}
                        animate={{ scale: 2, opacity: 0.1 }}
                        className="absolute w-20 h-20 rounded-full bg-white"
                      />
                    )}
                    <span className={`text-4xl leading-none relative z-10 ${gender === 'boy' ? 'text-white drop-shadow-lg' : 'text-brand-blue'}`}>
                      ♂
                    </span>
                    <span className={`text-sm font-bold relative z-10 ${gender === 'boy' ? 'text-white' : 'text-warm-700 dark:text-warm-300'}`}>
                      Boy
                    </span>
                    {gender === 'boy' && (
                      <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} className="absolute top-2 right-2 z-10">
                        <Zap className="w-4 h-4 text-white/60" />
                      </motion.div>
                    )}
                  </motion.button>

                  {/* Girl Card */}
                  <motion.button
                    type="button"
                    whileHover={{ scale: 1.03, y: -2 }}
                    whileTap={{ scale: 0.97 }}
                    onClick={() => {
                      setGender('girl');
                      if (error) setError('');
                    }}
                    className={`relative flex flex-col items-center justify-center gap-2 p-6 rounded-2xl border-2 transition-all overflow-hidden ${
                      gender === 'girl'
                        ? 'border-brand-red bg-gradient-to-br from-brand-red to-brand-red-dark shadow-lg shadow-brand-red/25'
                        : 'border-warm-300/60 dark:border-warm-600/40 bg-white/60 dark:bg-white/5 hover:border-brand-red/40 hover:shadow-md'
                    }`}
                  >
                    {gender === 'girl' && (
                      <motion.div
                        initial={{ scale: 0, opacity: 0 }}
                        animate={{ scale: 2, opacity: 0.1 }}
                        className="absolute w-20 h-20 rounded-full bg-white"
                      />
                    )}
                    <span className={`text-4xl leading-none relative z-10 ${gender === 'girl' ? 'text-white drop-shadow-lg' : 'text-brand-red'}`}>
                      ♀
                    </span>
                    <span className={`text-sm font-bold relative z-10 ${gender === 'girl' ? 'text-white' : 'text-warm-700 dark:text-warm-300'}`}>
                      Girl
                    </span>
                    {gender === 'girl' && (
                      <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} className="absolute top-2 right-2 z-10">
                        <Zap className="w-4 h-4 text-white/60" />
                      </motion.div>
                    )}
                  </motion.button>
                </div>
              </div>

              {/* Weight Input */}
              <div className="w-full mb-3">
                <label className="text-sm font-semibold text-warm-700 dark:text-warm-300 mb-2 block">
                  Weight
                </label>
                <div className="relative">
                  <Weight className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-brand-teal/60 pointer-events-none" />
                  <Input
                    type="number"
                    inputMode="numeric"
                    placeholder="Enter weight"
                    value={weight}
                    onChange={(e) => setWeight(e.target.value)}
                    className="h-12 bg-white/60 dark:bg-white/5 border-warm-300/60 dark:border-warm-600/40 text-warm-800 dark:text-warm-100 placeholder:text-warm-400 dark:placeholder:text-warm-500 text-base rounded-xl pl-10 pr-12 focus:ring-2 focus:ring-brand-teal/40 focus:border-brand-teal/60 transition-all"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-warm-400 dark:text-warm-500 text-sm font-medium pointer-events-none">
                    kg
                  </span>
                </div>
              </div>

              {/* Practice Ground Input */}
              <div className="w-full mb-4">
                <label className="text-sm font-semibold text-warm-700 dark:text-warm-300 mb-2 block">
                  Practice Ground
                </label>
                <div className="relative">
                  <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-brand-teal/60 pointer-events-none" />
                  <Input
                    type="text"
                    placeholder="Enter practice ground / academy"
                    value={practiceGround}
                    onChange={(e) => setPracticeGround(e.target.value)}
                    className="h-12 bg-white/60 dark:bg-white/5 border-warm-300/60 dark:border-warm-600/40 text-warm-800 dark:text-warm-100 placeholder:text-warm-400 dark:placeholder:text-warm-500 text-base rounded-xl pl-10 focus:ring-2 focus:ring-brand-teal/40 focus:border-brand-teal/60 transition-all"
                  />
                </div>
              </div>

              {/* Position Selection */}
              <div className="w-full mb-4">
                <label className="text-sm font-semibold text-warm-700 dark:text-warm-300 mb-2 block">
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
                    <motion.button
                      key={pos.id}
                      type="button"
                      whileHover={{ scale: 1.03 }}
                      whileTap={{ scale: 0.97 }}
                      onClick={() => setPosition(position === pos.id ? '' : pos.id)}
                      className={`p-2.5 rounded-xl border-2 text-left transition-all ${
                        position === pos.id
                          ? 'border-brand-teal bg-brand-teal/10 dark:bg-brand-teal/15 shadow-sm shadow-brand-teal/20'
                          : 'border-warm-300/60 dark:border-warm-600/40 bg-white/40 dark:bg-white/3 hover:border-warm-200 hover:shadow-sm'
                      }`}
                    >
                      <div className="flex items-center gap-1">
                        <span className="text-sm">{pos.icon}</span>
                        <span className={`text-xs font-semibold ${position === pos.id ? 'text-brand-teal dark:text-brand-teal-light' : 'text-warm-700 dark:text-warm-300'}`}>
                          {pos.label}
                        </span>
                      </div>
                      <p className="text-[8px] text-warm-400 dark:text-warm-500 mt-0.5 ml-5">{pos.meaning}</p>
                    </motion.button>
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
              <AnimatePresence>
                {error && (
                  <motion.p
                    initial={{ opacity: 0, y: -8, height: 0 }}
                    animate={{ opacity: 1, y: 0, height: 'auto' }}
                    exit={{ opacity: 0, y: -8, height: 0 }}
                    transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                    className="text-brand-red dark:text-brand-red-light text-sm mb-3 text-center w-full flex items-center justify-center gap-1.5"
                  >
                    <CircleDot className="w-3.5 h-3.5 shrink-0" />
                    {error}
                  </motion.p>
                )}
              </AnimatePresence>

              {/* Continue Button */}
              <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                <Button
                  onClick={handleDetailsContinue}
                  disabled={!gender}
                  className={`w-full h-12 font-semibold text-base rounded-xl disabled:opacity-40 text-white transition-all shadow-lg relative overflow-hidden group ${
                    gender === 'boy'
                      ? 'bg-gradient-to-r from-brand-blue to-brand-blue-dark hover:from-brand-blue-light hover:to-brand-blue shadow-brand-blue/25'
                      : gender === 'girl'
                        ? 'bg-gradient-to-r from-brand-red to-brand-red-dark hover:from-brand-red-light hover:to-brand-red shadow-brand-red/25'
                        : 'bg-gradient-to-r from-brand-red-dark to-brand-red hover:from-brand-red hover:to-brand-red-light shadow-brand-red/25'
                  }`}
                >
                  <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/0 to-transparent group-hover:via-white/20 transition-all duration-500 -translate-x-full group-hover:translate-x-full" />
                  <span className="relative z-10 flex items-center justify-center gap-1.5">
                    Continue
                    <ChevronRight className="w-4 h-4" />
                  </span>
                </Button>
              </motion.div>
            </motion.div>
          )}

          {/* ═══════════════════════════════════════════
              Stage 3: Role Selection
              ═══════════════════════════════════════════ */}
          {stage === 'role' && (
            <motion.div
              key="role"
              custom={direction}
              variants={slideVariants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{ type: 'spring', stiffness: 300, damping: 30 }}
              className="bg-white/10 dark:bg-white/5 backdrop-blur-xl rounded-2xl border border-white/30 dark:border-white/10 p-6 shadow-xl shadow-black/5 dark:shadow-black/20"
            >
              {/* Progress dots at top */}
              <div className="flex justify-center gap-2 mb-5">
                {(['auth', 'details', 'role'] as Stage[]).map((s, idx) => (
                  <motion.div
                    key={s}
                    className="h-1.5 rounded-full"
                    animate={{
                      width: stageIndex[stage] === idx ? 32 : stageIndex[stage] > idx ? 16 : 16,
                      backgroundColor:
                        stageIndex[stage] === idx
                          ? '#DC2626'
                          : stageIndex[stage] > idx
                            ? '#B91C1C'
                            : '#CBD5E1',
                    }}
                    transition={{ duration: 0.5 }}
                  />
                ))}
              </div>

              <motion.button
                whileHover={{ x: -3 }}
                whileTap={{ scale: 0.95 }}
                onClick={goBack}
                className="self-start flex items-center text-warm-500 dark:text-warm-400 hover:text-warm-800 dark:hover:text-warm-200 transition-colors mb-4 text-sm"
              >
                <ArrowLeft className="w-4 h-4 mr-1" />
                Back
              </motion.button>

              <h2 className="text-xl font-bold text-warm-800 dark:text-warm-100 mb-1">
                What&apos;s your role?
              </h2>
              <p className="text-warm-500 dark:text-warm-400 text-sm mb-6 text-center">
                Select one or more roles that apply to you
              </p>

              {/* Subtle kabaddi-themed background illustration */}
              <div className="absolute inset-0 pointer-events-none opacity-[0.02] dark:opacity-[0.03] overflow-hidden rounded-2xl">
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-48 h-48 rounded-full border-4 border-brand-red" />
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-brand-red" />
              </div>

              <div className="w-full flex flex-col gap-4 mb-6 relative z-10">
                {roles.map((role, idx) => {
                  const isSelected = selectedRoles.has(role.id);
                  const Icon = role.icon;
                  return (
                    <motion.button
                      key={role.id}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: idx * 0.15, type: 'spring', stiffness: 300, damping: 25 }}
                      whileHover={{ scale: 1.02, y: -2 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={() => toggleRole(role.id)}
                      className={`w-full relative flex items-center gap-4 p-5 rounded-2xl border-2 transition-all text-left overflow-hidden ${
                        isSelected
                          ? `bg-gradient-to-r ${role.color} ${role.borderColor} shadow-lg ${role.glowColor}`
                          : 'bg-white/60 dark:bg-white/5 border-warm-300/60 dark:border-warm-600/40 hover:border-warm-200 hover:shadow-md'
                      }`}
                    >
                      {!isSelected && (
                        <div className="absolute inset-0 rounded-2xl opacity-0 hover:opacity-100 transition-opacity bg-gradient-to-r from-brand-red/5 via-brand-gold/5 to-brand-red/5 pointer-events-none" />
                      )}

                      {isSelected && (
                        <div className="absolute inset-0 card-shine">
                          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent" style={{ animation: 'shimmer 3s ease-in-out infinite' }} />
                        </div>
                      )}

                      <div
                        className={`w-14 h-14 rounded-xl flex items-center justify-center shrink-0 relative z-10 ${
                          isSelected
                            ? 'bg-white/20'
                            : 'bg-warm-200/60 dark:bg-warm-600/20'
                        }`}
                      >
                        <Icon
                          className={`w-7 h-7 ${isSelected ? role.animClass : ''} ${
                            isSelected ? 'text-white' : 'text-warm-500 dark:text-warm-400'
                          }`}
                        />
                      </div>
                      <div className="flex-1 min-w-0 relative z-10">
                        <div className={`font-bold text-base ${isSelected ? 'text-white' : 'text-warm-800 dark:text-warm-100'}`}>
                          {role.title}
                        </div>
                        <div className={`text-xs mt-0.5 ${isSelected ? 'text-white/70' : 'text-warm-500 dark:text-warm-400'}`}>
                          {role.description}
                        </div>
                      </div>
                      <div
                        className={`w-6 h-6 rounded-full border-2 flex items-center justify-center shrink-0 transition-all relative z-10 ${
                          isSelected
                            ? 'border-white bg-white'
                            : 'border-warm-300 dark:border-warm-500'
                        }`}
                      >
                        {isSelected && (
                          <motion.div
                            initial={{ scale: 0 }}
                            animate={{ scale: 1 }}
                            transition={{ type: 'spring', stiffness: 500, damping: 25 }}
                            className="w-3 h-3 rounded-full bg-warm-50"
                          />
                        )}
                      </div>
                    </motion.button>
                  );
                })}
              </div>

              <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                <Button
                  onClick={handleGetStarted}
                  disabled={isSubmitting || selectedRoles.size === 0}
                  className={`w-full h-12 font-semibold text-base rounded-xl disabled:opacity-40 text-white transition-all shadow-lg relative overflow-hidden group ${
                    gender === 'boy'
                      ? 'bg-gradient-to-r from-brand-blue to-brand-blue-dark hover:from-brand-blue-light hover:to-brand-blue shadow-brand-blue/25'
                      : gender === 'girl'
                        ? 'bg-gradient-to-r from-brand-red to-brand-red-dark hover:from-brand-red-light hover:to-brand-red shadow-brand-red/25'
                        : 'bg-gradient-to-r from-brand-red-dark to-brand-red hover:from-brand-red hover:to-brand-red-light shadow-brand-red/25'
                  }`}
                >
                  <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/0 to-transparent group-hover:via-white/20 transition-all duration-500 -translate-x-full group-hover:translate-x-full" />
                  <span className="relative z-10 flex items-center justify-center gap-1.5">
                    {isSubmitting ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Setting up...
                      </>
                    ) : (
                      <>
                        Get Started
                        <ChevronRight className="w-4 h-4" />
                      </>
                    )}
                  </span>
                </Button>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* ── Bottom Progress dots ── */}
      <div className="flex gap-2 mt-8 relative z-10">
        {(['auth', 'details', 'role'] as Stage[]).map((s, idx) => (
          <motion.div
            key={s}
            className="h-1.5 rounded-full"
            animate={{
              width: stageIndex[stage] === idx ? 32 : stageIndex[stage] > idx ? 16 : 16,
              backgroundColor:
                stageIndex[stage] === idx
                  ? '#DC2626'
                  : stageIndex[stage] > idx
                    ? '#B91C1C'
                    : undefined,
            }}
            transition={{ duration: 0.5 }}
            {...(stageIndex[stage] < idx ? { style: { backgroundColor: '#CBD5E1' } } : {})}
          />
        ))}
      </div>
    </div>
  );
}
