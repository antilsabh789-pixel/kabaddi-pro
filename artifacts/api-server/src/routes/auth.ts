import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { createHash, timingSafeEqual } from 'crypto';
import { db } from '../lib/db';

const router = Router();

const BCRYPT_ROUNDS = 12;

async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, BCRYPT_ROUNDS);
}

// Legacy hashing scheme used by the original Next.js app / seed data.
function legacyHashPassword(password: string): string {
  return createHash('sha256').update(`${password}kabaddi_pro_salt`).digest('hex');
}

async function verifyPassword(password: string, hash: string): Promise<boolean> {
  if (hash.startsWith('$2')) return bcrypt.compare(password, hash);
  // Legacy SHA-256 (64 hex chars) accounts created before the bcrypt switch.
  if (/^[a-f0-9]{64}$/i.test(hash)) {
    const computed = Buffer.from(legacyHashPassword(password), 'hex');
    const stored = Buffer.from(hash.toLowerCase(), 'hex');
    return computed.length === stored.length && timingSafeEqual(computed, stored);
  }
  return false;
}

async function generatePlayerCode(): Promise<string> {
  const lastUser = await db.user.findFirst({
    where: { playerCode: { not: null } },
    orderBy: { playerCode: 'desc' },
    select: { playerCode: true },
  });
  let nextNum = 1001;
  if (lastUser?.playerCode) {
    const match = lastUser.playerCode.match(/KP(\d+)/);
    if (match) nextNum = parseInt(match[1]) + 1;
  }
  return `KP${nextNum}`;
}

function createDOBVerificationToken(phone: string, dateOfBirth: string): string {
  return createHash('sha256').update(`${phone}:${dateOfBirth}:dob-verify`).digest('hex').slice(0, 24);
}

router.post('/auth', async (req, res) => {
  try {
    const body = req.body;
    const { action, phone, password, name, gender, weight, practiceGround, role, email, dateOfBirth, userId, verificationToken, referralCode } = body;

    if (action === 'register') {
      if (!phone || !password || !name || !dateOfBirth) {
        return res.status(400).json({ error: 'Phone, password, name, and date of birth are required' });
      }
      if (password.length < 6) return res.status(400).json({ error: 'Password must be at least 6 characters' });
      const dobRegex = /^\d{4}-\d{2}-\d{2}$/;
      if (!dobRegex.test(dateOfBirth)) return res.status(400).json({ error: 'Date of birth must be in YYYY-MM-DD format' });

      const existingUser = await db.user.findUnique({ where: { phone } });
      if (existingUser) return res.status(409).json({ error: 'Phone number already registered. Please login instead.' });

      const playerCode = await generatePlayerCode();
      const user = await db.user.create({
        data: { phone, playerCode, password: await hashPassword(password), name, email: email || null, dateOfBirth, gender: gender || null, weight: weight || null, practiceGround: practiceGround || null, role: role || 'player', phoneVerified: true },
      });
      await db.playerProfile.create({ data: { userId: user.id } });

      // ── Process referral code (if provided) ──────────────────────────
      // Look up an UNUSED referral record matching the code (referredId is null).
      // If found, mark it as completed and grant 7 days of Premium to BOTH the
      // referrer and the newly-registered user. This runs inline during signup
      // so the referral is attributed automatically — no second "apply code"
      // step required from the user.
      //
      // Failures here MUST NOT fail the registration itself — the user is
      // already created. We just log and continue.
      let referralApplied = false;
      let referralError: string | null = null;
      if (referralCode && typeof referralCode === 'string' && referralCode.trim().length > 0) {
        try {
          const code = referralCode.trim().toUpperCase();
          const referral = await db.referral.findFirst({
            where: { referralCode: code, referredId: null },
          });
          if (!referral) {
            referralError = 'Invalid or already-used referral code';
          } else if (referral.referrerId === user.id) {
            referralError = 'You cannot use your own referral code';
          } else {
            // Mark the referral as completed
            await db.referral.update({
              where: { id: referral.id },
              data: { referredId: user.id, status: 'signed_up', completedAt: new Date() },
            });

            // Grant premium days to BOTH the referrer and the new user
            const premiumDays = referral.premiumDays || 7;
            const now = new Date();
            const premiumExpiry = new Date(now.getTime() + premiumDays * 24 * 60 * 60 * 1000);

            await Promise.all([
              db.user.update({
                where: { id: referral.referrerId },
                data: { isPremium: true, premiumExpiry, premiumPlan: 'referral' },
              }),
              db.user.update({
                where: { id: user.id },
                data: { isPremium: true, premiumExpiry, premiumPlan: 'referral' },
              }),
            ]);

            referralApplied = true;
          }
        } catch (refErr) {
          console.error('Referral apply (during register) error:', refErr);
          referralError = 'Could not apply referral code';
        }
      }

      // Re-fetch the user so the response reflects any premium upgrade from the referral.
      const freshUser = referralApplied
        ? await db.user.findUnique({ where: { id: user.id } })
        : user;
      const { password: _, ...userWithoutPassword } = freshUser || user;
      return res.json({
        user: userWithoutPassword,
        referral: {
          applied: referralApplied,
          error: referralError,
        },
      });
    }

    if (action === 'login') {
      if (!phone || !password) return res.status(400).json({ error: 'Phone and password are required' });
      const user = await db.user.findUnique({ where: { phone }, include: { profile: true } });
      if (!user) return res.status(401).json({ error: 'Invalid phone number or password' });
      const passwordValid = await verifyPassword(password, user.password);
      if (!passwordValid) return res.status(401).json({ error: 'Invalid phone number or password' });
      // Transparently upgrade legacy SHA-256 hashes to bcrypt on successful login.
      if (!user.password.startsWith('$2')) {
        await db.user.update({ where: { id: user.id }, data: { password: await hashPassword(password) } });
      }
      const { password: _, profile: __, ...userWithoutPassword } = user;
      return res.json({ user: { ...userWithoutPassword, position: user.profile?.position || null, jerseyNumber: user.profile?.jerseyNumber || null } });
    }

    if (action === 'forgot-password-verify') {
      if (!phone || !dateOfBirth) return res.status(400).json({ error: 'Phone number and date of birth are required' });
      const user = await db.user.findUnique({ where: { phone } });
      if (!user || user.dateOfBirth !== dateOfBirth) return res.status(401).json({ error: 'Invalid phone number or date of birth' });
      const token = createDOBVerificationToken(phone, dateOfBirth);
      return res.json({ verified: true, message: 'Identity verified successfully', verificationToken: token });
    }

    if (action === 'reset-password') {
      if (!phone || !password || !verificationToken) return res.status(400).json({ error: 'Phone, new password, and verification token are required' });
      if (password.length < 6) return res.status(400).json({ error: 'Password must be at least 6 characters' });
      const user = await db.user.findUnique({ where: { phone } });
      if (!user || !user.dateOfBirth) return res.status(400).json({ error: 'Invalid verification. Please start over.' });
      const expectedToken = createDOBVerificationToken(phone, user.dateOfBirth);
      if (verificationToken !== expectedToken) return res.status(400).json({ error: 'Invalid verification token. Please start over.' });
      await db.user.update({ where: { phone }, data: { password: await hashPassword(password) } });
      return res.json({ message: 'Password reset successfully' });
    }

    if (action === 'update-details') {
      if (!userId) return res.status(400).json({ error: 'User ID is required' });
      const allowedFields = ['name', 'email', 'gender', 'weight', 'practiceGround', 'location', 'role', 'avatar', 'dateOfBirth', 'phone'];
      const updateData: Record<string, unknown> = {};
      for (const field of allowedFields) {
        if (body[field] !== undefined) updateData[field] = body[field];
      }
      if (body.password) updateData.password = await hashPassword(body.password);
      if (updateData.phone) {
        const phoneRegex = /^\+91\d{10}$/;
        if (!phoneRegex.test(updateData.phone as string)) return res.status(400).json({ error: 'Invalid phone number format. Must be +91 followed by 10 digits.' });
        const existingUser = await db.user.findUnique({ where: { phone: updateData.phone as string } });
        if (existingUser && existingUser.id !== userId) return res.status(409).json({ error: 'This phone number is already registered with another account.' });
      }
      if (Object.keys(updateData).length === 0) return res.status(400).json({ error: 'No fields to update' });
      const user = await db.user.update({ where: { id: userId }, data: updateData });
      const { password: _, ...userWithoutPassword } = user;
      return res.json({ user: userWithoutPassword });
    }

    if (action === 'check-phone') {
      if (!phone) return res.status(400).json({ error: 'Phone number is required' });
      const existingUser = await db.user.findUnique({ where: { phone } });
      return res.json({ exists: !!existingUser });
    }

    return res.status(400).json({ error: 'Invalid action' });
  } catch (error) {
    console.error('Auth error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

router.delete('/auth/delete-account', async (req, res) => {
  try {
    const { userId } = req.body;
    if (!userId) return res.status(400).json({ error: 'userId is required' });
    const user = await db.user.findUnique({ where: { id: userId } });
    if (!user) return res.status(404).json({ error: 'User not found' });
    await db.user.delete({ where: { id: userId } });
    return res.json({ message: 'Account deleted successfully' });
  } catch (error) {
    console.error('Delete account error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
