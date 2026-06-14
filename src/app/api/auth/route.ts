import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { createHash } from 'crypto';
import { sendOTP, verifyOTPProvider, isDemoMode } from '@/lib/otp-provider';

// Simple password hashing (for production, use bcrypt)
function hashPassword(password: string): string {
  return createHash('sha256').update(password + 'kabaddi_pro_salt').digest('hex');
}

/**
 * Generate a unique player code in format KP1001, KP1002, etc.
 */
async function generatePlayerCode(): Promise<string> {
  const lastUser = await db.user.findFirst({
    where: { playerCode: { not: null } },
    orderBy: { playerCode: 'desc' },
    select: { playerCode: true },
  });

  let nextNum = 1001;
  if (lastUser?.playerCode) {
    const match = lastUser.playerCode.match(/KP(\d+)/);
    if (match) {
      nextNum = parseInt(match[1]) + 1;
    }
  }

  return `KP${nextNum}`;
}

// ── In-memory OTP Store ─────────────────────────────────────────
// Stores: phone → { otp, expiresAt, verified, attempts }
// In production with MSG91/Twilio Verify, this can be replaced by provider-side verification
const otpStore = new Map<string, {
  otp: string;
  expiresAt: number;
  verified: boolean;
  attempts: number;
  maxAttempts: number;
  resendCount: number;
  providerUsed: string; // track which provider sent this OTP
}>();

// Lazy cleanup: remove expired OTPs on each access
function cleanupExpiredOtps() {
  const now = Date.now();
  for (const [key, val] of otpStore.entries()) {
    if (val.expiresAt < now) {
      otpStore.delete(key);
    }
  }
}

/**
 * Generate a random 6-digit OTP
 */
function generateOTP(): string {
  return String(100000 + Math.floor(Math.random() * 900000));
}

/**
 * Create a verification token from phone + OTP (for signup flow)
 * This token proves the phone was verified via OTP
 */
function createVerificationToken(phone: string, otp: string): string {
  return createHash('sha256').update(`${phone}:${otp}:verified`).digest('hex').slice(0, 24);
}

export async function POST(request: NextRequest) {
  try {
    // Lazy cleanup of expired OTPs
    cleanupExpiredOtps();

    const body = await request.json();
    const { action, phone, password, name, gender, weight, practiceGround, role, email, userId, otp, verificationToken } = body;

    // ── Check OTP Provider Status ────────────────────────────────
    const demoMode = isDemoMode();

    // ── Send Signup OTP ─────────────────────────────────────────
    if (action === 'send-signup-otp') {
      if (!phone) {
        return NextResponse.json(
          { error: 'Phone number is required' },
          { status: 400 }
        );
      }

      // Check if user already exists
      const existingUser = await db.user.findUnique({ where: { phone } });
      if (existingUser) {
        return NextResponse.json(
          { error: 'This phone number is already registered. Please login instead.' },
          { status: 409 }
        );
      }

      // Check rate limiting - max 3 resends per phone
      const existing = otpStore.get(phone);
      if (existing && existing.resendCount >= 3 && existing.expiresAt > Date.now()) {
        const waitSeconds = Math.ceil((existing.expiresAt - Date.now()) / 1000);
        return NextResponse.json(
          { error: `Too many OTP requests. Please wait ${waitSeconds}s and try again.` },
          { status: 429 }
        );
      }

      // Generate OTP
      const newOtp = generateOTP();
      const resendCount = existing ? existing.resendCount + 1 : 1;

      // ── Send OTP via real provider ────────────────────────────
      const otpResult = await sendOTP(phone, newOtp);

      if (!otpResult.success) {
        return NextResponse.json(
          { error: otpResult.message || 'Failed to send OTP. Please try again.' },
          { status: 500 }
        );
      }

      // Store OTP locally for verification (even if provider does server-side verify,
      // we keep a local copy as fallback)
      otpStore.set(phone, {
        otp: newOtp,
        expiresAt: Date.now() + 5 * 60 * 1000, // 5 minutes
        verified: false,
        attempts: 0,
        maxAttempts: 3,
        resendCount,
        providerUsed: otpResult.provider,
      });

      return NextResponse.json({
        message: demoMode
          ? 'OTP sent successfully (Demo Mode)'
          : 'OTP sent successfully to your phone',
        // Only include demoOtp in demo mode
        ...(demoMode && otpResult.demoOtp ? { demoOtp: otpResult.demoOtp } : {}),
        resendCount,
        provider: otpResult.provider,
      });
    }

    // ── Verify Signup OTP ───────────────────────────────────────
    if (action === 'verify-signup-otp') {
      if (!phone || !otp) {
        return NextResponse.json(
          { error: 'Phone and OTP are required' },
          { status: 400 }
        );
      }

      // Try provider-side verification first (MSG91 / Twilio Verify)
      const providerResult = await verifyOTPProvider(phone, otp);
      if (providerResult !== null) {
        if (providerResult.valid) {
          // Provider verified the OTP successfully
          const stored = otpStore.get(phone);
          if (stored) stored.verified = true;

          const token = createVerificationToken(phone, stored?.otp || otp);
          return NextResponse.json({
            verified: true,
            message: 'Phone number verified successfully',
            verificationToken: token,
          });
        } else {
          return NextResponse.json(
            { error: providerResult.message || 'Invalid OTP' },
            { status: 401 }
          );
        }
      }

      // Fallback: Local verification (demo mode or direct SMS)
      const stored = otpStore.get(phone);
      if (!stored) {
        return NextResponse.json(
          { error: 'No OTP was sent to this number. Please request a new one.' },
          { status: 400 }
        );
      }

      // Check expiry
      if (stored.expiresAt < Date.now()) {
        otpStore.delete(phone);
        return NextResponse.json(
          { error: 'OTP has expired. Please request a new one.' },
          { status: 410 }
        );
      }

      // Check attempts
      if (stored.attempts >= stored.maxAttempts) {
        otpStore.delete(phone);
        return NextResponse.json(
          { error: 'Too many incorrect attempts. Please request a new OTP.' },
          { status: 429 }
        );
      }

      // Verify OTP
      stored.attempts++;

      if (stored.otp !== otp) {
        const remaining = stored.maxAttempts - stored.attempts;
        return NextResponse.json(
          { error: `Invalid OTP. ${remaining} attempt${remaining !== 1 ? 's' : ''} remaining.` },
          { status: 401 }
        );
      }

      // OTP verified successfully
      stored.verified = true;
      const token = createVerificationToken(phone, stored.otp);

      return NextResponse.json({
        verified: true,
        message: 'Phone number verified successfully',
        verificationToken: token,
      });
    }

    // ── Register (requires phone verification token) ────────────
    if (action === 'register') {
      if (!phone || !password) {
        return NextResponse.json(
          { error: 'Phone and password are required' },
          { status: 400 }
        );
      }

      if (password.length < 6) {
        return NextResponse.json(
          { error: 'Password must be at least 6 characters' },
          { status: 400 }
        );
      }

      // Verify the phone was verified via OTP
      if (!verificationToken) {
        return NextResponse.json(
          { error: 'Phone verification is required. Please verify your phone number first.' },
          { status: 400 }
        );
      }

      // Validate the verification token
      const stored = otpStore.get(phone);
      if (!stored || !stored.verified) {
        return NextResponse.json(
          { error: 'Phone verification expired or invalid. Please verify your phone number again.' },
          { status: 400 }
        );
      }

      const expectedToken = createVerificationToken(phone, stored.otp);
      if (verificationToken !== expectedToken) {
        return NextResponse.json(
          { error: 'Invalid verification token. Please verify your phone number again.' },
          { status: 400 }
        );
      }

      // Check if user already exists (double-check)
      const existingUser = await db.user.findUnique({ where: { phone } });
      if (existingUser) {
        return NextResponse.json(
          { error: 'Phone number already registered. Please login instead.' },
          { status: 409 }
        );
      }

      // Auto-generate a unique player code
      const playerCode = await generatePlayerCode();

      // Create new user with hashed password and phone verified
      const user = await db.user.create({
        data: {
          phone,
          playerCode,
          password: hashPassword(password),
          name: name || null,
          email: email || null,
          gender: gender || null,
          weight: weight || null,
          practiceGround: practiceGround || null,
          role: role || 'player',
          phoneVerified: true,
        },
      });

      // Create player profile
      await db.playerProfile.create({
        data: { userId: user.id },
      });

      // Clean up OTP store
      otpStore.delete(phone);

      // Return user without password, include profile fields
      const { password: _, ...userWithoutPassword } = user;
      return NextResponse.json({ user: userWithoutPassword });
    }

    // ── Login ───────────────────────────────────────────────────
    if (action === 'login') {
      if (!phone || !password) {
        return NextResponse.json(
          { error: 'Phone and password are required' },
          { status: 400 }
        );
      }

      const user = await db.user.findUnique({
        where: { phone },
        include: { profile: true },
      });
      if (!user) {
        return NextResponse.json(
          { error: 'No account found with this phone number' },
          { status: 404 }
        );
      }

      if (user.password !== hashPassword(password)) {
        return NextResponse.json(
          { error: 'Incorrect password' },
          { status: 401 }
        );
      }

      // Return user without password, include profile position & jerseyNumber
      const { password: _, profile: __, ...userWithoutPassword } = user;
      return NextResponse.json({
        user: {
          ...userWithoutPassword,
          position: user.profile?.position || null,
          jerseyNumber: user.profile?.jerseyNumber || null,
        },
      });
    }

    // ── Update Details ──────────────────────────────────────────
    if (action === 'update-details') {
      if (!userId) {
        return NextResponse.json(
          { error: 'User ID is required' },
          { status: 400 }
        );
      }

      // Build update data from allowed fields only
      const allowedFields = ['name', 'email', 'gender', 'weight', 'practiceGround', 'role', 'avatar'];
      const updateData: Record<string, unknown> = {};

      for (const field of allowedFields) {
        if (body[field] !== undefined) {
          updateData[field] = body[field];
        }
      }

      // Handle password update separately
      if (body.password) {
        updateData.password = hashPassword(body.password);
      }

      if (Object.keys(updateData).length === 0) {
        return NextResponse.json(
          { error: 'No fields to update' },
          { status: 400 }
        );
      }

      const user = await db.user.update({
        where: { id: userId },
        data: updateData,
      });

      const { password: _, ...userWithoutPassword } = user;
      return NextResponse.json({ user: userWithoutPassword });
    }

    // ── Forgot Password: Send OTP ───────────────────────────────
    if (action === 'forgot-password') {
      if (!phone) {
        return NextResponse.json(
          { error: 'Phone number is required' },
          { status: 400 }
        );
      }

      const user = await db.user.findUnique({ where: { phone } });

      // Check rate limiting (always check, regardless of user existence)
      const resetKey = `reset:${phone}`;
      const existing = otpStore.get(resetKey);
      if (existing && existing.resendCount >= 3 && existing.expiresAt > Date.now()) {
        const waitSeconds = Math.ceil((existing.expiresAt - Date.now()) / 1000);
        // In demo mode, reveal the wait time to help testing
        if (demoMode) {
          return NextResponse.json({
            message: `Too many OTP requests. Please wait ${waitSeconds}s and try again.`,
            ...(existing.otp && demoMode ? { demoOtp: existing.otp } : {}),
          });
        }
        return NextResponse.json({ message: 'OTP sent if account exists' });
      }

      // Generate and store OTP for password reset
      // Always generate even if user doesn't exist (for demo mode & to not leak user existence)
      const newOtp = generateOTP();

      // ── Send OTP via real provider (only if user exists in production) ──
      let otpResult;
      if (user || demoMode) {
        // In production: only send SMS if user exists
        // In demo mode: always generate OTP for testing
        otpResult = await sendOTP(phone, newOtp);
      } else {
        // In production, user doesn't exist - don't actually send SMS
        // but still generate an OTP to prevent timing attacks
        otpResult = { success: true, message: 'Skipped', provider: 'none' };
      }

      const resendCount = existing ? existing.resendCount + 1 : 1;
      otpStore.set(resetKey, {
        otp: newOtp,
        expiresAt: Date.now() + 5 * 60 * 1000,
        verified: false,
        attempts: 0,
        maxAttempts: 3,
        resendCount,
        providerUsed: otpResult.provider,
      });

      // Don't reveal if OTP was actually sent or if user exists
      return NextResponse.json({
        message: 'OTP sent if account exists',
        // In demo mode, always return the OTP so the flow is testable
        ...(demoMode ? { demoOtp: newOtp } : {}),
      });
    }

    // ── Verify OTP (for forgot password) ────────────────────────
    if (action === 'verify-otp') {
      if (!phone || !otp) {
        return NextResponse.json(
          { error: 'Phone and OTP are required' },
          { status: 400 }
        );
      }

      // Try provider-side verification first
      const providerResult = await verifyOTPProvider(phone, otp);
      if (providerResult !== null) {
        if (providerResult.valid) {
          const stored = otpStore.get(`reset:${phone}`);
          if (stored) stored.verified = true;

          const token = createVerificationToken(phone, stored?.otp || otp);
          return NextResponse.json({
            verified: true,
            message: 'OTP verified',
            verificationToken: token,
          });
        } else {
          return NextResponse.json(
            { error: providerResult.message || 'Invalid OTP' },
            { status: 401 }
          );
        }
      }

      // Fallback: Local verification
      const stored = otpStore.get(`reset:${phone}`);
      if (!stored) {
        return NextResponse.json(
          { error: 'No OTP was sent. Please request a new one.' },
          { status: 400 }
        );
      }

      // Check expiry
      if (stored.expiresAt < Date.now()) {
        otpStore.delete(`reset:${phone}`);
        return NextResponse.json(
          { error: 'OTP has expired. Please request a new one.' },
          { status: 410 }
        );
      }

      // Check attempts
      stored.attempts++;
      if (stored.attempts > stored.maxAttempts) {
        otpStore.delete(`reset:${phone}`);
        return NextResponse.json(
          { error: 'Too many incorrect attempts. Please request a new OTP.' },
          { status: 429 }
        );
      }

      // Verify OTP
      if (stored.otp !== otp) {
        const remaining = stored.maxAttempts - stored.attempts;
        return NextResponse.json(
          { error: `Invalid OTP. ${remaining} attempt${remaining !== 1 ? 's' : ''} remaining.` },
          { status: 401 }
        );
      }

      // OTP verified
      stored.verified = true;
      const token = createVerificationToken(phone, stored.otp);

      return NextResponse.json({
        verified: true,
        message: 'OTP verified',
        verificationToken: token,
      });
    }

    // ── Reset Password ──────────────────────────────────────────
    if (action === 'reset-password') {
      if (!phone || !password) {
        return NextResponse.json(
          { error: 'Phone and new password are required' },
          { status: 400 }
        );
      }

      if (password.length < 6) {
        return NextResponse.json(
          { error: 'Password must be at least 6 characters' },
          { status: 400 }
        );
      }

      // Verify OTP was verified
      const stored = otpStore.get(`reset:${phone}`);
      if (!stored?.verified) {
        return NextResponse.json(
          { error: 'OTP verification required' },
          { status: 401 }
        );
      }

      // Validate verification token if available
      if (verificationToken) {
        const expectedToken = createVerificationToken(phone, stored.otp);
        if (verificationToken !== expectedToken) {
          return NextResponse.json(
            { error: 'Invalid verification. Please start over.' },
            { status: 400 }
          );
        }
      }

      const user = await db.user.findUnique({ where: { phone } });
      if (!user) {
        return NextResponse.json(
          { error: 'No account found with this phone number' },
          { status: 404 }
        );
      }

      // Update password and mark phone as verified
      await db.user.update({
        where: { phone },
        data: {
          password: hashPassword(password),
          phoneVerified: true,
        },
      });

      // Clean up
      otpStore.delete(`reset:${phone}`);

      return NextResponse.json({ message: 'Password reset successfully' });
    }

    // ── Check OTP Provider Status (for frontend) ────────────────
    if (action === 'otp-status') {
      return NextResponse.json({
        provider: isDemoMode() ? 'demo' : (process.env.OTP_PROVIDER || 'demo'),
        isDemo: demoMode,
      });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (error) {
    console.error('Auth error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
