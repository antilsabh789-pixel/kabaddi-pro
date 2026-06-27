'use client';

import { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { motion, AnimatePresence, Variants } from 'framer-motion';
import {
  Trophy, Shield, Megaphone, ChevronRight, ArrowLeft,
  Phone, Eye, EyeOff, User, Lock, Weight, MapPin,
  CircleDot, Zap, Check, Loader2, KeyRound, ArrowRight,
  ShieldCheck, Calendar, AlertCircle, Gift
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useKabaddiStore } from '@/lib/store';
import { authRequest } from '@/lib/authClient';

type Stage = 'auth' | 'role' | 'details';
type ForgotStage = 'verify' | 'new-password' | 'success';

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
    description: 'Manage your academy, attendance, fees, and team performance',
    icon: Megaphone,
    color: 'from-brand-green to-brand-green-dark',
    borderColor: 'border-brand-green/40',
    glowColor: 'shadow-brand-green/20',
    animClass: 'animate-bounce',
  },
] as const;

const slideVariants: Variants = {
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
      {[20, 40, 60, 80].map((top) => (
        <div key={`h-${top}`} className="absolute left-0 right-0 border-t border-brand-gold/60" style={{ top: `${top}%` }} />
      ))}
      <div className="absolute top-0 bottom-0 left-1/2 -translate-x-1/2 border-l border-brand-gold/60" />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-40 h-40 md:w-56 md:h-56 rounded-full border-2 border-brand-gold/60" />
      <div className="absolute top-[30%] left-1/2 -translate-x-1/2 w-20 h-20 md:w-28 md:h-28 rounded-full border border-brand-gold/60" />
      <div className="absolute top-[62%] left-1/2 -translate-x-1/2 w-20 h-20 md:w-28 md:h-28 rounded-full border border-brand-gold/60" />
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

/* ── Date of Birth Picker Component ── */
function DOBPicker({
  day,
  month,
  year,
  onChange,
}: {
  day: string;
  month: string;
  year: string;
  onChange: (day: string, month: string, year: string) => void;
}) {
  const months = [
    'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
    'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
  ];

  const currentYear = new Date().getFullYear();
  const daysInMonth = useMemo(() => {
    const m = month ? parseInt(month) : 0;
    const y = year ? parseInt(year) : currentYear;
    if (m === 0) return 31;
    return new Date(y, m, 0).getDate();
  }, [month, year, currentYear]);

  const days = useMemo(() => Array.from({ length: daysInMonth }, (_, i) => String(i + 1)), [daysInMonth]);
  const years = useMemo(() => Array.from({ length: 80 }, (_, i) => String(currentYear - 10 - i)), [currentYear]);

  const selectClass =
    'h-12 bg-white/60 dark:bg-white/5 border-warm-300/60 dark:border-warm-600/40 text-warm-800 dark:text-warm-100 text-sm rounded-xl focus:ring-2 focus:ring-brand-red/40 focus:border-brand-red/60 transition-all appearance-none cursor-pointer text-center font-medium';

  return (
    <div className="flex gap-2">
      {/* Day */}
      <div className="relative flex-1">
        <select
          value={day}
          onChange={(e) => onChange(e.target.value, month, year)}
          className={`${selectClass} w-full ${!day ? 'text-warm-400 dark:text-warm-500' : ''}`}
        >
          <option value="" disabled>DD</option>
          {days.map((d) => (
            <option key={d} value={d}>{d.padStart(2, '0')}</option>
          ))}
        </select>
        <div className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none">
          <svg className="w-3 h-3 text-warm-400" fill="none" viewBox="0 0 10 6">
            <path d="M1 1l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
      </div>

      {/* Month */}
      <div className="relative flex-[1.3]">
        <select
          value={month}
          onChange={(e) => {
            const newMonth = e.target.value;
            const m = newMonth ? parseInt(newMonth) : 0;
            const y = year ? parseInt(year) : currentYear;
            const maxDays = new Date(y, m, 0).getDate();
            const newDay = day && parseInt(day) > maxDays ? String(maxDays) : day;
            onChange(newDay, newMonth, year);
          }}
          className={`${selectClass} w-full ${!month ? 'text-warm-400 dark:text-warm-500' : ''}`}
        >
          <option value="" disabled>Month</option>
          {months.map((m, i) => (
            <option key={i} value={String(i + 1)}>{m}</option>
          ))}
        </select>
        <div className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none">
          <svg className="w-3 h-3 text-warm-400" fill="none" viewBox="0 0 10 6">
            <path d="M1 1l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
      </div>

      {/* Year */}
      <div className="relative flex-[1.2]">
        <select
          value={year}
          onChange={(e) => {
            const newYear = e.target.value;
            const m = month ? parseInt(month) : 0;
            const y = newYear ? parseInt(newYear) : currentYear;
            const maxDays = new Date(y, m, 0).getDate();
            const newDay = day && parseInt(day) > maxDays ? String(maxDays) : day;
            onChange(newDay, month, newYear);
          }}
          className={`${selectClass} w-full ${!year ? 'text-warm-400 dark:text-warm-500' : ''}`}
        >
          <option value="" disabled>YYYY</option>
          {years.map((y) => (
            <option key={y} value={y}>{y}</option>
          ))}
        </select>
        <div className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none">
          <svg className="w-3 h-3 text-warm-400" fill="none" viewBox="0 0 10 6">
            <path d="M1 1l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
      </div>
    </div>
  );
}

/* ── Error Message Component ── */
function ErrorMessage({ message }: { message: string }) {
  return (
    <motion.p
      initial={{ opacity: 0, y: -8, height: 0 }}
      animate={{ opacity: 1, y: 0, height: 'auto' }}
      exit={{ opacity: 0, y: -8, height: 0 }}
      transition={{ type: 'spring', stiffness: 400, damping: 30 }}
      className="text-brand-red dark:text-brand-red-light text-sm mb-3 text-center w-full flex items-center justify-center gap-1.5"
    >
      <CircleDot className="w-3.5 h-3.5 shrink-0" />
      {message}
    </motion.p>
  );
}

export default function AuthScreen() {
  const [stage, setStage] = useState<Stage>('auth');
  const [isSignUp, setIsSignUp] = useState(false);

  // Auth form fields
  const [phone, setPhone] = useState('');
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [direction, setDirection] = useState(1);
  const [error, setError] = useState('');
  const [showSuccess, setShowSuccess] = useState(false);

  // Referral code — pre-filled from ?ref=CODE URL param (or localStorage if the
  // user clicked a share link earlier and we stashed it for the next signup).
  // Also still editable manually on the registration form below.
  const [referralCode, setReferralCode] = useState('');

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      // 1) Check URL: ?ref=CODE or ?referral=CODE
      const params = new URLSearchParams(window.location.search);
      const fromUrl = params.get('ref') || params.get('referral') || params.get('refcode');
      if (fromUrl) {
        const cleaned = fromUrl.trim().toUpperCase();
        setReferralCode(cleaned);
        // Persist so the user can navigate around the app before registering
        // without losing the attribution.
        try { localStorage.setItem('kabaddi-pending-referral', cleaned); } catch { /* ignore */ }
        return;
      }
      // 2) Fall back to a previously-stashed code (user clicked a share link earlier)
      const stashed = localStorage.getItem('kabaddi-pending-referral');
      if (stashed) setReferralCode(stashed.toUpperCase());
    } catch { /* ignore */ }
  }, []);

  // Date of Birth
  const [dobDay, setDobDay] = useState('');
  const [dobMonth, setDobMonth] = useState('');
  const [dobYear, setDobYear] = useState('');

  // Phone check
  const [phoneExists, setPhoneExists] = useState(false);
  const [phoneChecking, setPhoneChecking] = useState(false);
  const phoneCheckTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Details fields
  const [gender, setGender] = useState<'boy' | 'girl' | ''>('');
  const [weight, setWeight] = useState('');
  const [practiceGround, setPracticeGround] = useState('');
  const [coachLocation, setCoachLocation] = useState('');
  const [position, setPosition] = useState('');
  const [selectedRole, setSelectedRole] = useState<'player' | 'coach' | ''>('');

  // Forgot password flow
  const [showForgot, setShowForgot] = useState(false);
  const forgotOverlayRef = useRef<HTMLDivElement>(null);
  const [forgotStage, setForgotStage] = useState<ForgotStage>('verify');
  const [forgotPhone, setForgotPhone] = useState('');
  const [forgotDobDay, setForgotDobDay] = useState('');
  const [forgotDobMonth, setForgotDobMonth] = useState('');
  const [forgotDobYear, setForgotDobYear] = useState('');
  const [forgotError, setForgotError] = useState('');
  const [forgotSubmitting, setForgotSubmitting] = useState(false);
  const [forgotVerificationToken, setForgotVerificationToken] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);

  const login = useKabaddiStore((s) => s.login);
  const setOnboarded = useKabaddiStore((s) => s.setOnboarded);

  const passwordStrength = getPasswordStrength(password);

  // Auto-focus forgot password overlay
  useEffect(() => {
    if (showForgot && forgotOverlayRef.current) {
      forgotOverlayRef.current.focus();
    }
  }, [showForgot]);

  const goNext = useCallback((next: Stage) => {
    setDirection(1);
    setStage(next);
  }, []);

  const goBack = useCallback(() => {
    setDirection(-1);
    if (stage === 'details') setStage('role');
    else if (stage === 'role') setStage('auth');
  }, [stage]);

  const selectRole = useCallback((roleId: 'player' | 'coach') => {
    setSelectedRole(roleId);
  }, []);

  // ── Check Phone Availability ──────────────────────────────────
  const checkPhoneAvailability = useCallback(async (phoneVal: string) => {
    if (phoneVal.length !== 10) {
      setPhoneExists(false);
      return;
    }
    setPhoneChecking(true);
    try {
      const res = await authRequest({ action: 'check-phone', phone: `+91${phoneVal}` });
      const data = res.data;
      setPhoneExists(data.exists === true);
    } catch {
      // Silently fail - don't block signup
    } finally {
      setPhoneChecking(false);
    }
  }, []);

  // Debounced phone check
  const handlePhoneChange = useCallback((val: string) => {
    setPhone(val);
    setPhoneExists(false);
    setError('');
    if (phoneCheckTimeoutRef.current) {
      clearTimeout(phoneCheckTimeoutRef.current);
    }
    if (val.length === 10) {
      phoneCheckTimeoutRef.current = setTimeout(() => {
        checkPhoneAvailability(val);
      }, 500);
    }
  }, [checkPhoneAvailability]);

  // ── Format DOB ────────────────────────────────────────────────
  const formatDOB = (day: string, month: string, year: string): string => {
    if (!day || !month || !year) return '';
    return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
  };

  // ── Register ──────────────────────────────────────────────────
  const handleRegister = useCallback(async () => {
    setError('');

    if (!phone || phone.length !== 10) {
      setError('Please enter a valid 10-digit phone number');
      return;
    }
    if (phoneExists) {
      setError('This phone number is already registered. Please login instead.');
      return;
    }
    if (!name.trim()) {
      setError('Please enter your name');
      return;
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }
    if (!dobDay || !dobMonth || !dobYear) {
      setError('Please select your date of birth');
      return;
    }
    if (!termsAccepted) {
      setError('Please accept the Terms & Conditions');
      return;
    }

    const dateOfBirth = formatDOB(dobDay, dobMonth, dobYear);
    setIsSubmitting(true);
    try {
      const res = await authRequest({
        action: 'register',
        phone: `+91${phone}`,
        name: name.trim(),
        password,
        dateOfBirth,
        referralCode: referralCode.trim() || undefined,
      });

      const data = res.data;
      if (!res.ok) {
        setError(data.error || 'Registration failed');
        return;
      }

      const user = data.user;
      login({
        id: user.id,
        phone: user.phone,
        playerCode: user.playerCode || undefined,
        name: user.name || name.trim(),
        role: user.role || 'player',
        avatar: user.avatar || '',
        isPremium: user.isPremium || false,
        premiumExpiry: user.premiumExpiry || null,
        premiumPlan: user.premiumPlan || null,
        isAdmin: user.isAdmin || false,
        gender: user.gender || undefined,
        weight: user.weight || undefined,
        practiceGround: user.practiceGround || undefined,
        position: user.position || undefined,
        jerseyNumber: user.jerseyNumber || undefined,
      });

      // Clear the stashed pending-referral code now that we've consumed it
      // (or attempted to). Prevents the code from being re-applied if the
      // user logs out and registers a second account on the same device.
      try { localStorage.removeItem('kabaddi-pending-referral'); } catch { /* ignore */ }

      // Surface referral outcome to the user (non-blocking — registration
      // succeeded regardless of whether the referral code was valid).
      if (data.referral?.applied) {
        // Friendly toast-like inline message (the success animation will show next)
        console.log(`Referral applied — ${data.referral.premiumDaysGranted || 7} premium days granted to both you and your referrer.`);
      } else if (data.referral?.error && referralCode.trim()) {
        // Only show the error if the user actually entered a code
        console.warn(`Referral not applied: ${data.referral.error}`);
      }

      setShowSuccess(true);
      setTimeout(() => {
        setShowSuccess(false);
        goNext('role');
      }, 800);
    } catch {
      setError('Something went wrong. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  }, [phone, phoneExists, name, password, confirmPassword, dobDay, dobMonth, dobYear, termsAccepted, referralCode, login, goNext]);

  // ── Login ─────────────────────────────────────────────────────
  const handleLogin = useCallback(async () => {
    setError('');

    if (phone.length !== 10) {
      setError('Please enter a valid 10-digit phone number');
      return;
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await authRequest({
        phone: `+91${phone}`,
        password,
        action: 'login',
      });

      const data = res.data;
      if (!res.ok) {
        setError(data.error || 'Authentication failed');
        return;
      }

      const user = data.user;
      login({
        id: user.id,
        phone: user.phone,
        playerCode: user.playerCode || undefined,
        name: user.name || '',
        role: user.role || 'player',
        avatar: user.avatar || '',
        isPremium: user.isPremium || false,
        premiumExpiry: user.premiumExpiry || null,
        premiumPlan: user.premiumPlan || null,
        isAdmin: user.isAdmin || false,
        gender: user.gender || undefined,
        weight: user.weight || undefined,
        practiceGround: user.practiceGround || undefined,
        position: user.position || undefined,
        jerseyNumber: user.jerseyNumber || undefined,
      });

      setShowSuccess(true);
      setTimeout(() => {
        setShowSuccess(false);
        setOnboarded(true);
      }, 800);
    } catch {
      setError('Something went wrong. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  }, [phone, password, login, setOnboarded]);

  // ── Details Continue ──────────────────────────────────────────
  const handleDetailsContinue = useCallback(() => {
    setError('');
    const isCoach = selectedRole === 'coach';

    if (!isCoach && !gender) {
      setError('Please select your gender');
      return;
    }

    if (isCoach && !practiceGround.trim()) {
      setError('Please enter your academy / playground name');
      return;
    }

    const currentUser = useKabaddiStore.getState().currentUser;
    if (currentUser?.id) {
      authRequest({
        userId: currentUser.id,
        action: 'update-details',
        gender: !isCoach ? (gender === 'boy' ? 'male' : gender === 'girl' ? 'female' : gender) : undefined,
        weight: !isCoach && weight ? `${weight.replace(/kg$/i, '')}kg` : undefined,
        practiceGround: practiceGround || undefined,
        location: isCoach ? coachLocation || undefined : undefined,
      }).catch(() => {});

      if (!isCoach && position) {
        fetch(`/api/players/${currentUser.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ position }),
        }).catch(() => {});
      }
    }

    useKabaddiStore.getState().updateUser({
      gender: !isCoach ? (gender === 'boy' ? 'male' : gender === 'girl' ? 'female' : gender) : undefined,
      weight: !isCoach && weight ? `${weight.replace(/kg$/i, '')}kg` : undefined,
      practiceGround: practiceGround || undefined,
      location: isCoach ? coachLocation || undefined : undefined,
      position: !isCoach ? (position || undefined) : undefined,
    });

    // After details, finish onboarding
    setOnboarded(true);
  }, [gender, weight, practiceGround, coachLocation, position, selectedRole, setOnboarded]);

  // ── Role Get Started ──────────────────────────────────────────
  const handleGetStarted = useCallback(async () => {
    setIsSubmitting(true);
    try {
      const currentUser = useKabaddiStore.getState().currentUser;
      if (currentUser?.id) {
        await authRequest({
          userId: currentUser.id,
          action: 'update-details',
          role: selectedRole,
        });
        useKabaddiStore.getState().updateUser({ role: selectedRole });
      }
      // Go to role-specific details
      goNext('details');
    } finally {
      setIsSubmitting(false);
    }
  }, [selectedRole, goNext]);

  // ── Forgot Password: Verify with DOB ─────────────────────────
  const handleForgotVerify = useCallback(async () => {
    setForgotError('');
    if (forgotPhone.length !== 10) {
      setForgotError('Please enter a valid 10-digit phone number');
      return;
    }
    if (!forgotDobDay || !forgotDobMonth || !forgotDobYear) {
      setForgotError('Please select your date of birth');
      return;
    }

    const dateOfBirth = formatDOB(forgotDobDay, forgotDobMonth, forgotDobYear);
    setForgotSubmitting(true);
    try {
      const res = await authRequest({
        action: 'forgot-password-verify',
        phone: `+91${forgotPhone}`,
        dateOfBirth,
      });
      const data = res.data;
      if (!res.ok) {
        setForgotError(data.error || 'Verification failed');
        return;
      }
      setForgotVerificationToken(data.verificationToken);
      setForgotStage('new-password');
    } catch {
      setForgotError('Something went wrong. Please try again.');
    } finally {
      setForgotSubmitting(false);
    }
  }, [forgotPhone, forgotDobDay, forgotDobMonth, forgotDobYear]);

  // ── Forgot Password: Reset Password ──────────────────────────
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
      const res = await authRequest({
        action: 'reset-password',
        phone: `+91${forgotPhone}`,
        password: newPassword,
        verificationToken: forgotVerificationToken,
      });
      const data = res.data;
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
  }, [newPassword, confirmNewPassword, forgotPhone, forgotVerificationToken]);

  // ── Close forgot password modal ──────────────────────────────
  const closeForgotModal = useCallback(() => {
    setShowForgot(false);
    setForgotStage('verify');
    setForgotPhone('');
    setForgotDobDay('');
    setForgotDobMonth('');
    setForgotDobYear('');
    setForgotError('');
    setNewPassword('');
    setConfirmNewPassword('');
    setForgotVerificationToken('');
  }, []);

  const stageIndex: Record<Stage, number> = { auth: 0, role: 1, details: 2 };

  // Toggle signup mode
  const handleToggleSignUp = useCallback(() => {
    setIsSignUp(!isSignUp);
    setError('');
    setPhoneExists(false);
    setConfirmPassword('');
    setTermsAccepted(false);
    setName('');
    setDobDay('');
    setDobMonth('');
    setDobYear('');
  }, [isSignUp]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-warm-50 via-white to-warm-100 dark:from-brand-navy-dark dark:via-brand-navy-dark dark:to-brand-navy flex flex-col px-4 relative overflow-hidden">
      {/* ── Animated Background ── */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute inset-0 bg-gradient-to-br from-brand-red/5 via-transparent to-brand-navy/10 dark:from-brand-red/8 dark:via-transparent dark:to-brand-navy/15" />
        <div className="absolute -top-40 -right-40 w-96 h-96 bg-brand-red/8 dark:bg-brand-red/5 rounded-full blur-3xl" />
        <div className="absolute -bottom-40 -left-40 w-96 h-96 bg-brand-red-dark/8 dark:bg-brand-red-dark/5 rounded-full blur-3xl" />
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[28rem] h-[28rem] bg-brand-red/12 dark:bg-brand-red/6 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 right-0 w-64 h-64 bg-brand-gold/8 dark:bg-brand-gold/5 rounded-full blur-3xl" />
        <div className="absolute top-10 left-10 w-48 h-48 bg-brand-teal/6 dark:bg-brand-teal/4 rounded-full blur-3xl" />
        <CourtPattern />
        <FloatingParticles />
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
            ref={forgotOverlayRef}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm flex items-center justify-center px-4"
            onClick={(e) => {
              if (e.target === e.currentTarget) closeForgotModal();
            }}
            onKeyDown={(e) => {
              if (e.key === 'Escape') closeForgotModal();
            }}
            tabIndex={-1}
          >
            <motion.div
              initial={{ scale: 0.9, y: 30 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 30 }}
              transition={{ type: 'spring', stiffness: 300, damping: 25 }}
              className="w-full max-w-sm bg-white/10 dark:bg-white/5 backdrop-blur-xl rounded-2xl border border-white/20 p-6 shadow-2xl"
            >
              <AnimatePresence mode="wait">
                {/* ── Stage: Verify with Phone + DOB ── */}
                {forgotStage === 'verify' && (
                  <motion.div key="forgot-verify" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} transition={{ duration: 0.2 }}>
                    <div className="flex items-center gap-3 mb-4">
                      <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-brand-red to-brand-red-dark flex items-center justify-center">
                        <KeyRound className="w-6 h-6 text-white" />
                      </div>
                      <div>
                        <h3 className="text-lg font-bold text-warm-800 dark:text-warm-100">Reset Password</h3>
                        <p className="text-xs text-warm-500 dark:text-warm-400">Verify your identity to continue</p>
                      </div>
                    </div>

                    <p className="text-xs text-warm-500 dark:text-warm-400 mb-4">
                      Enter your phone number and date of birth to verify your identity
                    </p>

                    {/* Phone Input */}
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

                    {/* Date of Birth */}
                    <label className="text-sm font-semibold text-warm-700 dark:text-warm-300 mb-2 block">
                      <span className="flex items-center gap-1.5">
                        <Calendar className="w-3.5 h-3.5 text-brand-red/60" />
                        Date of Birth
                      </span>
                    </label>
                    <div className="mb-4">
                      <DOBPicker
                        day={forgotDobDay}
                        month={forgotDobMonth}
                        year={forgotDobYear}
                        onChange={(d, m, y) => {
                          setForgotDobDay(d);
                          setForgotDobMonth(m);
                          setForgotDobYear(y);
                          if (forgotError) setForgotError('');
                        }}
                      />
                    </div>

                    <AnimatePresence>
                      {forgotError && (
                        <motion.p initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="text-brand-red text-xs mb-3 text-center">{forgotError}</motion.p>
                      )}
                    </AnimatePresence>

                    <Button
                      onClick={handleForgotVerify}
                      disabled={forgotSubmitting || forgotPhone.length !== 10 || !forgotDobDay || !forgotDobMonth || !forgotDobYear}
                      className="w-full h-12 bg-gradient-to-r from-brand-red to-brand-red-dark hover:from-brand-red-light hover:to-brand-red text-white font-semibold rounded-xl disabled:opacity-40 shadow-lg shadow-brand-red/25"
                    >
                      {forgotSubmitting ? (
                        <div className="flex items-center gap-2">
                          <Loader2 className="w-4 h-4 animate-spin" />
                          Verifying...
                        </div>
                      ) : (
                        <>Verify <ArrowRight className="w-4 h-4 ml-1" /></>
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

                    {/* Verified badge */}
                    <div className="flex items-center justify-center gap-2 mb-4">
                      <motion.div
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        transition={{ type: 'spring', stiffness: 300, damping: 15 }}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-500/15 border border-emerald-500/25"
                      >
                        <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
                        <span className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">Identity verified</span>
                      </motion.div>
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
                      onClick={closeForgotModal}
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

      {/* ── Enhanced Logo Section ── */}
      <motion.div
        className="flex flex-col items-center mb-8 relative z-10"
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.6, ease: 'easeOut', type: 'spring', stiffness: 200 }}
      >
        <div className="relative mb-4">
          <div className="absolute -inset-3 rounded-2xl bg-brand-red/20 dark:bg-brand-red/10 blur-lg pulse-glow" />
          <div
            className="absolute -inset-1.5 rounded-2xl border-2 border-brand-gold/30 dark:border-brand-gold/20"
            style={{ animation: 'spin-slow 20s linear infinite' }}
          />
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

        <motion.h1
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="text-3xl font-black tracking-wider"
        >
          <span className="gradient-text">KABADDI</span>{' '}
          <span className="gradient-text">PRO</span>
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4, duration: 0.5 }}
          className="text-warm-500 dark:text-warm-400 text-xs tracking-widest mt-1.5 font-medium uppercase"
        >
          Live Scoring &amp; Tournaments
        </motion.p>

        {/* Version Badge */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.6 }}
          className="mt-2"
        >
          <span className="text-[9px] font-mono text-warm-400/60 dark:text-warm-500/60">v1.0</span>
        </motion.div>
      </motion.div>

      {/* ── Stage content ── */}
      <div className="flex-1 flex flex-col items-center justify-center w-full relative z-10">
        <div className="w-full max-w-sm">
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

                {/* App Logo (shown on auth stage) */}
                {stage === 'auth' && (
                  <div className="flex justify-center mb-5">
                    <motion.div
                      initial={{ scale: 0.8, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      transition={{ type: 'spring', stiffness: 200, damping: 15 }}
                      className="relative"
                    >
                      <div className="absolute inset-0 rounded-2xl bg-brand-red/30 blur-lg animate-pulse" />
                      <img
                        src="/app-icon.png"
                        alt="Kabaddi Pro"
                        className="relative w-20 h-20 rounded-2xl object-cover shadow-xl shadow-brand-red/30 ring-2 ring-white/40"
                      />
                    </motion.div>
                  </div>
                )}

                {/* ── LOGIN MODE ── */}
                {!isSignUp && (
                  <>
                    <h2 className="text-xl font-bold text-warm-800 dark:text-warm-100 mb-1 text-center">
                      Welcome Back!
                    </h2>
                    <p className="text-warm-500 dark:text-warm-400 text-sm mb-6 text-center">
                      Login to your Kabaddi Pro account
                    </p>

                    {/* Phone Input */}
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

                    {/* Password Input */}
                    <div className="w-full relative mb-1">
                      <div className="relative">
                        <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-brand-red/60 dark:text-brand-red-light/60 pointer-events-none" />
                        <Input
                          type={showPassword ? 'text' : 'password'}
                          placeholder="Enter password"
                          value={password}
                          onChange={(e) => {
                            setPassword(e.target.value);
                            if (error) setError('');
                          }}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') handleLogin();
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

                      {password && password.length < 6 && (
                        <motion.p
                          initial={{ opacity: 0, x: -8 }}
                          animate={{ opacity: 1, x: 0 }}
                          className="text-xs text-warm-400 dark:text-warm-500 mt-1.5 ml-1"
                        >
                          Password must be at least 6 characters
                        </motion.p>
                      )}
                    </div>

                    {/* Forgot Password Link */}
                    <div className="flex justify-end mb-3">
                      <motion.button
                        whileHover={{ x: 2 }}
                        whileTap={{ scale: 0.95 }}
                        onClick={() => { setShowForgot(true); setForgotStage('verify'); }}
                        className="text-xs font-medium text-brand-red dark:text-brand-red-light hover:text-brand-red-dark dark:hover:text-brand-red transition-colors"
                      >
                        Forgot Password?
                      </motion.button>
                    </div>

                    {/* Error Message */}
                    <AnimatePresence>
                      {error && <ErrorMessage message={error} />}
                    </AnimatePresence>

                    {/* Login Button */}
                    <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                      <Button
                        onClick={handleLogin}
                        disabled={isSubmitting || phone.length !== 10 || password.length < 6}
                        className="w-full h-12 bg-gradient-to-r from-brand-red to-brand-red-dark hover:from-brand-red-light hover:to-brand-red text-white font-semibold text-base rounded-xl disabled:opacity-40 shadow-lg shadow-brand-red/25 hover:shadow-xl hover:shadow-brand-red/30 transition-all relative overflow-hidden group"
                      >
                        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/0 to-transparent group-hover:via-white/20 transition-all duration-500 -translate-x-full group-hover:translate-x-full" />
                        <span className="relative z-10 flex items-center justify-center gap-1.5">
                          {isSubmitting ? (
                            <>
                              <Loader2 className="w-4 h-4 animate-spin" />
                              Please wait...
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
                  </>
                )}

                {/* ── SIGNUP MODE ── */}
                {isSignUp && (
                  <>
                    <h2 className="text-xl font-bold text-warm-800 dark:text-warm-100 mb-1 text-center">
                      Create Account
                    </h2>
                    <p className="text-warm-500 dark:text-warm-400 text-sm mb-4 text-center">
                      Join Kabaddi Pro and start your journey
                    </p>

                    {/* Phone Input */}
                    <div className="w-full flex gap-2 mb-2">
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
                            handlePhoneChange(val);
                          }}
                          className="h-12 bg-white/60 dark:bg-white/5 border-warm-300/60 dark:border-warm-600/40 text-warm-800 dark:text-warm-100 placeholder:text-warm-400 dark:placeholder:text-warm-500 text-base rounded-xl focus:ring-2 focus:ring-brand-red/40 focus:border-brand-red/60 transition-all"
                        />
                        {phoneChecking && (
                          <div className="absolute right-3 top-1/2 -translate-y-1/2">
                            <Loader2 className="w-4 h-4 animate-spin text-brand-red/50" />
                          </div>
                        )}
                      </motion.div>
                    </div>

                    {/* Phone already registered warning */}
                    <AnimatePresence>
                      {phoneExists && phone.length === 10 && !phoneChecking && (
                        <motion.div
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: 'auto' }}
                          exit={{ opacity: 0, height: 0 }}
                          className="mb-3"
                        >
                          <div className="flex items-center gap-2 px-3 py-2.5 rounded-lg bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/20">
                            <AlertCircle className="w-4 h-4 text-amber-500 shrink-0" />
                            <div>
                              <p className="text-[11px] font-semibold text-amber-700 dark:text-amber-400">Already registered</p>
                              <button
                                type="button"
                                onClick={() => { setIsSignUp(false); setPhoneExists(false); setError(''); }}
                                className="text-[10px] text-amber-600 dark:text-amber-400/80 hover:underline font-medium"
                              >
                                Login instead →
                              </button>
                            </div>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>

                    {/* Name Input */}
                    <div className="relative mb-3">
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

                    {/* Password Input */}
                    <div className="w-full relative mb-1">
                      <div className="relative">
                        <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-brand-red/60 dark:text-brand-red-light/60 pointer-events-none" />
                        <Input
                          type={showPassword ? 'text' : 'password'}
                          placeholder="Create a password"
                          value={password}
                          onChange={(e) => {
                            setPassword(e.target.value);
                            if (error) setError('');
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

                      {/* Password Strength Indicator */}
                      {password && (
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
                    </div>

                    {/* Confirm Password */}
                    <div className="w-full relative mb-2">
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
                        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex items-center gap-1.5 mt-1.5 ml-1">
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
                    </div>

                    {/* Date of Birth */}
                    <div className="mb-3">
                      <label className="text-sm font-semibold text-warm-700 dark:text-warm-300 mb-2 block">
                        <span className="flex items-center gap-1.5">
                          <Calendar className="w-3.5 h-3.5 text-brand-red/60" />
                          Date of Birth
                        </span>
                      </label>
                      <DOBPicker
                        day={dobDay}
                        month={dobMonth}
                        year={dobYear}
                        onChange={(d, m, y) => {
                          setDobDay(d);
                          setDobMonth(m);
                          setDobYear(y);
                          if (error) setError('');
                        }}
                      />
                    </div>

                    {/* Referral Code (optional) */}
                    <div className="mb-3">
                      <label className="text-sm font-semibold text-warm-700 dark:text-warm-300 mb-2 block">
                        <span className="flex items-center gap-1.5">
                          <Gift className="w-3.5 h-3.5 text-brand-gold" />
                          Referral Code <span className="text-warm-400 font-normal">(optional)</span>
                        </span>
                      </label>
                      <input
                        type="text"
                        value={referralCode}
                        onChange={(e) => {
                          setReferralCode(e.target.value.toUpperCase().replace(/[^A-Z0-9-]/g, ''));
                          if (error) setError('');
                        }}
                        placeholder="ENTER CODE"
                        maxLength={20}
                        autoComplete="off"
                        className="w-full h-11 rounded-xl border-2 border-warm-200 dark:border-warm-700 bg-white/60 dark:bg-white/5 px-3 text-sm font-mono tracking-wider text-warm-800 dark:text-warm-100 uppercase placeholder:text-warm-400 focus:outline-none focus:border-brand-gold focus:ring-2 focus:ring-brand-gold/20 transition-all"
                      />
                      <p className="text-[10px] text-warm-500 dark:text-warm-400 mt-1 leading-relaxed">
                        Referred by a friend? Enter their code to give <span className="font-bold text-brand-gold">both of you 7 days of Premium FREE</span> — and unlock Giveaway entries.
                      </p>
                    </div>

                    {/* Terms & Conditions */}
                    <div className="flex items-start gap-2.5 mb-4">
                      <motion.button
                        type="button"
                        whileTap={{ scale: 0.9 }}
                        onClick={() => setTermsAccepted(!termsAccepted)}
                        role="checkbox"
                        aria-checked={termsAccepted}
                        aria-label="Accept Terms of Service and Privacy Policy"
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
                    </div>

                    {/* Error Message */}
                    <AnimatePresence>
                      {error && <ErrorMessage message={error} />}
                    </AnimatePresence>

                    {/* Sign Up Button */}
                    <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                      <Button
                        onClick={handleRegister}
                        disabled={
                          isSubmitting ||
                          phone.length !== 10 ||
                          phoneExists ||
                          !name.trim() ||
                          password.length < 6 ||
                          !confirmPassword ||
                          password !== confirmPassword ||
                          !dobDay || !dobMonth || !dobYear ||
                          !termsAccepted
                        }
                        className="w-full h-12 bg-gradient-to-r from-brand-red to-brand-red-dark hover:from-brand-red-light hover:to-brand-red text-white font-semibold text-base rounded-xl disabled:opacity-40 shadow-lg shadow-brand-red/25 hover:shadow-xl hover:shadow-brand-red/30 transition-all relative overflow-hidden group"
                      >
                        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/0 to-transparent group-hover:via-white/20 transition-all duration-500 -translate-x-full group-hover:translate-x-full" />
                        <span className="relative z-10 flex items-center justify-center gap-1.5">
                          {isSubmitting ? (
                            <>
                              <Loader2 className="w-4 h-4 animate-spin" />
                              Creating Account...
                            </>
                          ) : (
                            <>
                              Sign Up
                              <ChevronRight className="w-4 h-4" />
                            </>
                          )}
                        </span>
                      </Button>
                    </motion.div>
                  </>
                )}

                {/* ── OR divider ── */}
                <div className="flex items-center gap-3 my-5">
                  <div className="flex-1 h-px bg-warm-200 dark:bg-warm-700" />
                  <span className="text-[10px] font-bold text-warm-400 dark:text-warm-500 uppercase tracking-widest">OR</span>
                  <div className="flex-1 h-px bg-warm-200 dark:bg-warm-700" />
                </div>

                {/* ── Toggle Login/Signup ── */}
                <button
                  className="text-brand-red hover:text-brand-red-light dark:text-brand-red-light dark:hover:text-brand-red text-sm font-medium transition-colors w-full text-center group relative pointer-events-auto"
                  onClick={handleToggleSignUp}
                >
                  <span className="relative">
                    {isSignUp
                      ? 'Already have an account? Login'
                      : "Don't have an account? Sign Up"}
                    <span className="absolute -bottom-0.5 left-0 right-0 h-[1.5px] bg-brand-red dark:bg-brand-red-light rounded-full origin-center scale-x-0 group-hover:scale-x-100 transition-transform duration-300" />
                  </span>
                </button>
              </motion.div>
            )}

            {/* ═══════════════════════════════════════════
                Stage 2: Role Selection (FIRST after auth)
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
                <div className="flex justify-center gap-2 mb-5">
                  {(['auth', 'role', 'details'] as Stage[]).map((s, idx) => (
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

                <h2 className="text-xl font-bold text-warm-800 dark:text-warm-100 mb-1 text-center">Are you a Player or Coach?</h2>
                <p className="text-warm-500 dark:text-warm-400 text-sm mb-6 text-center">
                  Select how you&apos;ll use Kabaddi Pro
                </p>

                <div className="space-y-4 mb-6">
                  {roles.map((r) => {
                    const Icon = r.icon;
                    const isSelected = selectedRole === r.id;
                    return (
                      <motion.button
                        key={r.id}
                        type="button"
                        whileHover={{ scale: 1.02, y: -2 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={() => selectRole(r.id as 'player' | 'coach')}
                        className={`w-full p-4 rounded-2xl border-2 transition-all flex items-center gap-4 ${
                          isSelected
                            ? `${r.borderColor} bg-gradient-to-r ${r.color} shadow-lg ${r.glowColor}`
                            : 'border-warm-300/60 dark:border-warm-600/40 bg-white/60 dark:bg-white/5 hover:border-brand-gold/30'
                        }`}
                      >
                        <div className={`w-14 h-14 rounded-xl flex items-center justify-center shrink-0 ${
                          isSelected ? 'bg-white/20' : 'bg-warm-100 dark:bg-warm-800'
                        }`}>
                          <Icon className={`w-7 h-7 ${isSelected ? 'text-white' : 'text-warm-500 dark:text-warm-400'}`} />
                        </div>
                        <div className="text-left flex-1">
                          <h3 className={`text-base font-bold ${isSelected ? 'text-white' : 'text-warm-800 dark:text-warm-100'}`}>
                            {r.title}
                          </h3>
                          <p className={`text-xs mt-0.5 ${isSelected ? 'text-white/80' : 'text-warm-500 dark:text-warm-400'}`}>
                            {r.description}
                          </p>
                        </div>
                        {isSelected && (
                          <motion.div
                            initial={{ scale: 0 }}
                            animate={{ scale: 1 }}
                            transition={{ type: 'spring', stiffness: 400, damping: 15 }}
                            className="w-6 h-6 rounded-full bg-white flex items-center justify-center shrink-0"
                          >
                            <Check className="w-4 h-4 text-brand-red" strokeWidth={3} />
                          </motion.div>
                        )}
                      </motion.button>
                    );
                  })}
                </div>

                {/* Coach feature preview */}
                {selectedRole === 'coach' && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="mb-4 p-3 rounded-xl bg-brand-green/10 border border-brand-green/20"
                  >
                    <p className="text-xs font-semibold text-brand-green-dark dark:text-brand-green mb-1">Coach Features Include:</p>
                    <ul className="text-[10px] text-warm-600 dark:text-warm-400 space-y-0.5">
                      <li>📋 Digital Register & Attendance</li>
                      <li>💰 Fee Management & Ledger</li>
                      <li>🏆 Student Incentive & Rewards</li>
                      <li>📊 Attendance-to-Performance Analytics</li>
                      <li>📢 Parental Notification Gateway</li>
                    </ul>
                  </motion.div>
                )}

                <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                  <Button
                    onClick={handleGetStarted}
                    disabled={isSubmitting || !selectedRole}
                    className="w-full h-12 bg-gradient-to-r from-brand-red to-brand-red-dark hover:from-brand-red-light hover:to-brand-red text-white font-semibold rounded-xl disabled:opacity-40 shadow-lg shadow-brand-red/25 transition-all"
                  >
                    {isSubmitting ? (
                      <div className="flex items-center gap-2">
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Setting up...
                      </div>
                    ) : (
                      <>
                        Continue <ChevronRight className="w-4 h-4 ml-1" />
                      </>
                    )}
                  </Button>
                </motion.div>
              </motion.div>
            )}

            {/* ═══════════════════════════════════════════
                Stage 3: Details (Conditional - Player vs Coach)
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
                <div className="flex justify-center gap-2 mb-5">
                  {(['auth', 'role', 'details'] as Stage[]).map((s, idx) => (
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

                {/* Coach-only details */}
                {selectedRole === 'coach' ? (
                  <>
                    <div className="flex items-center gap-3 mb-4">
                      <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-brand-green to-brand-green-dark flex items-center justify-center">
                        <Megaphone className="w-6 h-6 text-white" />
                      </div>
                      <div>
                        <h2 className="text-xl font-bold text-warm-800 dark:text-warm-100">Coach Setup</h2>
                        <p className="text-warm-500 dark:text-warm-400 text-sm">Tell us about your academy</p>
                      </div>
                    </div>

                    {/* Academy / Playground Name */}
                    <div className="relative mb-4">
                      <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-brand-green/60 pointer-events-none" />
                      <Input
                        type="text"
                        placeholder="Academy / Playground name *"
                        value={practiceGround}
                        onChange={(e) => { setPracticeGround(e.target.value); if (error) setError(''); }}
                        className="h-12 bg-white/60 dark:bg-white/5 border-warm-300/60 dark:border-warm-600/40 text-warm-800 dark:text-warm-100 placeholder:text-warm-400 text-base rounded-xl pl-10"
                      />
                    </div>

                    {/* City / Location */}
                    <div className="relative mb-4">
                      <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-brand-green/60 pointer-events-none" />
                      <Input
                        type="text"
                        placeholder="City / Area (e.g. Pune, Kothrud)"
                        value={coachLocation}
                        onChange={(e) => setCoachLocation(e.target.value)}
                        className="h-12 bg-white/60 dark:bg-white/5 border-warm-300/60 dark:border-warm-600/40 text-warm-800 dark:text-warm-100 placeholder:text-warm-400 text-base rounded-xl pl-10"
                      />
                    </div>

                    <AnimatePresence>
                      {error && (
                        <motion.p initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="text-brand-red text-sm mb-3 text-center">{error}</motion.p>
                      )}
                    </AnimatePresence>

                    <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                      <Button
                        onClick={handleDetailsContinue}
                        disabled={!practiceGround.trim()}
                        className="w-full h-12 bg-gradient-to-r from-brand-green to-brand-green-dark hover:from-brand-green hover:to-brand-green text-white font-semibold rounded-xl disabled:opacity-40 shadow-lg shadow-brand-green/25 transition-all"
                      >
                        Start Coaching <ChevronRight className="w-4 h-4 ml-1" />
                      </Button>
                    </motion.div>
                  </>
                ) : (
                  <>
                    <h2 className="text-xl font-bold text-warm-800 dark:text-warm-100 mb-1">Tell us about yourself</h2>
                    <p className="text-warm-500 dark:text-warm-400 text-sm mb-6 text-center">
                      Help us personalize your experience
                    </p>

                    {/* Gender Selection */}
                    <div className="w-full mb-5">
                      <label className="text-sm font-semibold text-warm-700 dark:text-warm-300 mb-3 block">
                        Gender <span className="text-brand-red">*</span>
                      </label>
                      <div className="grid grid-cols-2 gap-3">
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
                            <motion.div initial={{ scale: 0, opacity: 0 }} animate={{ scale: 2, opacity: 0.1 }} className="absolute w-20 h-20 rounded-full bg-white" />
                          )}
                          <span className={`text-4xl leading-none relative z-10 ${gender === 'boy' ? 'text-white drop-shadow-lg' : 'text-brand-blue'}`}>♂</span>
                          <span className={`text-sm font-bold relative z-10 ${gender === 'boy' ? 'text-white' : 'text-warm-700 dark:text-warm-300'}`}>Boy</span>
                          {gender === 'boy' && (
                            <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} className="absolute top-2 right-2 z-10">
                              <Zap className="w-4 h-4 text-white/60" />
                            </motion.div>
                          )}
                        </motion.button>

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
                            <motion.div initial={{ scale: 0, opacity: 0 }} animate={{ scale: 2, opacity: 0.1 }} className="absolute w-20 h-20 rounded-full bg-white" />
                          )}
                          <span className={`text-4xl leading-none relative z-10 ${gender === 'girl' ? 'text-white drop-shadow-lg' : 'text-brand-red'}`}>♀</span>
                          <span className={`text-sm font-bold relative z-10 ${gender === 'girl' ? 'text-white' : 'text-warm-700 dark:text-warm-300'}`}>Girl</span>
                          {gender === 'girl' && (
                            <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} className="absolute top-2 right-2 z-10">
                              <Zap className="w-4 h-4 text-white/60" />
                            </motion.div>
                          )}
                        </motion.button>
                      </div>
                    </div>

                    {/* Weight */}
                    <div className="relative mb-4">
                      <Weight className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-brand-red/60 pointer-events-none" />
                      <Input
                        type="text"
                        placeholder="Weight (e.g. 65)"
                        value={weight}
                        onChange={(e) => setWeight(e.target.value)}
                        className="h-12 bg-white/60 dark:bg-white/5 border-warm-300/60 dark:border-warm-600/40 text-warm-800 dark:text-warm-100 placeholder:text-warm-400 text-base rounded-xl pl-10"
                      />
                    </div>

                    {/* Practice Ground */}
                    <div className="relative mb-4">
                      <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-brand-red/60 pointer-events-none" />
                      <Input
                        type="text"
                        placeholder="Practice ground / Academy name"
                        value={practiceGround}
                        onChange={(e) => setPracticeGround(e.target.value)}
                        className="h-12 bg-white/60 dark:bg-white/5 border-warm-300/60 dark:border-warm-600/40 text-warm-800 dark:text-warm-100 placeholder:text-warm-400 text-base rounded-xl pl-10"
                      />
                    </div>

                    {/* Position Selection */}
                    <div className="mb-5">
                      <label className="text-sm font-semibold text-warm-700 dark:text-warm-300 mb-2 block">Playing Position</label>
                      <div className="grid grid-cols-3 gap-2">
                        {['Raider', 'Defender', 'All-Rounder'].map((pos) => (
                          <motion.button
                            key={pos}
                            type="button"
                            whileHover={{ scale: 1.03 }}
                            whileTap={{ scale: 0.97 }}
                            onClick={() => setPosition(pos.toLowerCase().replace('-', '-'))}
                            className={`py-2.5 px-2 rounded-xl border-2 text-xs font-semibold transition-all ${
                              position === pos.toLowerCase().replace('-', '-')
                                ? 'border-brand-red bg-brand-red/10 text-brand-red'
                                : 'border-warm-300/60 dark:border-warm-600/40 bg-white/60 dark:bg-white/5 text-warm-600 dark:text-warm-400 hover:border-brand-red/30'
                            }`}
                          >
                            {pos}
                          </motion.button>
                        ))}
                      </div>
                    </div>

                    <AnimatePresence>
                      {error && (
                        <motion.p initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="text-brand-red text-sm mb-3 text-center">{error}</motion.p>
                      )}
                    </AnimatePresence>

                    <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                      <Button
                        onClick={handleDetailsContinue}
                        disabled={!gender}
                        className="w-full h-12 bg-gradient-to-r from-brand-red to-brand-red-dark hover:from-brand-red-light hover:to-brand-red text-white font-semibold rounded-xl disabled:opacity-40 shadow-lg shadow-brand-red/25 transition-all"
                      >
                        Continue <ChevronRight className="w-4 h-4 ml-1" />
                      </Button>
                    </motion.div>
                  </>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Footer - sticks to bottom */}
      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.8 }}
        className="text-warm-400 dark:text-warm-500 text-[10px] py-4 relative z-10 text-center"
      >
        By continuing, you agree to our Terms & Privacy Policy
      </motion.p>
    </div>
  );
}
