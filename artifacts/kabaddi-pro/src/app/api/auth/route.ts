import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { createHash } from 'crypto';

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

/**
 * Create a verification token from phone + dateOfBirth (for password reset flow)
 * This token proves the user verified their identity via DOB
 */
function createDOBVerificationToken(phone: string, dateOfBirth: string): string {
  return createHash('sha256').update(`${phone}:${dateOfBirth}:dob-verify`).digest('hex').slice(0, 24);
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, phone, password, name, gender, weight, practiceGround, role, email, dateOfBirth, userId, verificationToken } = body;

    // ── Register (phone + password + name + dateOfBirth) ────────────
    if (action === 'register') {
      if (!phone || !password || !name || !dateOfBirth) {
        return NextResponse.json(
          { error: 'Phone, password, name, and date of birth are required' },
          { status: 400 }
        );
      }

      if (password.length < 6) {
        return NextResponse.json(
          { error: 'Password must be at least 6 characters' },
          { status: 400 }
        );
      }

      // Validate dateOfBirth format (YYYY-MM-DD)
      const dobRegex = /^\d{4}-\d{2}-\d{2}$/;
      if (!dobRegex.test(dateOfBirth)) {
        return NextResponse.json(
          { error: 'Date of birth must be in YYYY-MM-DD format' },
          { status: 400 }
        );
      }

      // Check if user already exists
      const existingUser = await db.user.findUnique({ where: { phone } });
      if (existingUser) {
        return NextResponse.json(
          { error: 'Phone number already registered. Please login instead.' },
          { status: 409 }
        );
      }

      // Auto-generate a unique player code
      const playerCode = await generatePlayerCode();

      // Create new user with hashed password
      const user = await db.user.create({
        data: {
          phone,
          playerCode,
          password: hashPassword(password),
          name,
          email: email || null,
          dateOfBirth,
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

      // Return user without password
      const { password: _, ...userWithoutPassword } = user;
      return NextResponse.json({ user: userWithoutPassword });
    }

    // ── Login (phone + password) ────────────────────────────────────
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
          { error: 'Invalid phone number or password' },
          { status: 401 }
        );
      }

      if (user.password !== hashPassword(password)) {
        return NextResponse.json(
          { error: 'Invalid phone number or password' },
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

    // ── Forgot Password: Verify identity with DOB ──────────────────
    if (action === 'forgot-password-verify') {
      if (!phone || !dateOfBirth) {
        return NextResponse.json(
          { error: 'Phone number and date of birth are required' },
          { status: 400 }
        );
      }

      const user = await db.user.findUnique({ where: { phone } });
      if (!user || user.dateOfBirth !== dateOfBirth) {
        // Don't reveal which is wrong for security
        return NextResponse.json(
          { error: 'Invalid phone number or date of birth' },
          { status: 401 }
        );
      }

      // Generate verification token from phone + DOB
      const token = createDOBVerificationToken(phone, dateOfBirth);

      return NextResponse.json({
        verified: true,
        message: 'Identity verified successfully',
        verificationToken: token,
      });
    }

    // ── Reset Password (after DOB verification) ────────────────────
    if (action === 'reset-password') {
      if (!phone || !password || !verificationToken) {
        return NextResponse.json(
          { error: 'Phone, new password, and verification token are required' },
          { status: 400 }
        );
      }

      if (password.length < 6) {
        return NextResponse.json(
          { error: 'Password must be at least 6 characters' },
          { status: 400 }
        );
      }

      // Find user and verify the token
      const user = await db.user.findUnique({ where: { phone } });
      if (!user || !user.dateOfBirth) {
        return NextResponse.json(
          { error: 'Invalid verification. Please start over.' },
          { status: 400 }
        );
      }

      const expectedToken = createDOBVerificationToken(phone, user.dateOfBirth);
      if (verificationToken !== expectedToken) {
        return NextResponse.json(
          { error: 'Invalid verification token. Please start over.' },
          { status: 400 }
        );
      }

      // Update password
      await db.user.update({
        where: { phone },
        data: {
          password: hashPassword(password),
        },
      });

      return NextResponse.json({ message: 'Password reset successfully' });
    }

    // ── Update Details ──────────────────────────────────────────────
    if (action === 'update-details') {
      if (!userId) {
        return NextResponse.json(
          { error: 'User ID is required' },
          { status: 400 }
        );
      }

      // Build update data from allowed fields only
      const allowedFields = ['name', 'email', 'gender', 'weight', 'practiceGround', 'location', 'role', 'avatar', 'dateOfBirth', 'phone'];
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

      // If phone is being updated, validate and check uniqueness
      if (updateData.phone) {
        // Validate phone format (should be +91XXXXXXXXXX)
        const phoneRegex = /^\+91\d{10}$/;
        if (!phoneRegex.test(updateData.phone as string)) {
          return NextResponse.json(
            { error: 'Invalid phone number format. Must be +91 followed by 10 digits.' },
            { status: 400 }
          );
        }

        // Check if the new phone number is already taken by another user
        const existingUser = await db.user.findUnique({
          where: { phone: updateData.phone as string },
        });
        if (existingUser && existingUser.id !== userId) {
          return NextResponse.json(
            { error: 'This phone number is already registered with another account.' },
            { status: 409 }
          );
        }
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

    // ── Check Phone (check if phone number is registered) ───────────
    if (action === 'check-phone') {
      if (!phone) {
        return NextResponse.json(
          { error: 'Phone number is required' },
          { status: 400 }
        );
      }

      const existingUser = await db.user.findUnique({ where: { phone } });
      return NextResponse.json({ exists: !!existingUser });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (error) {
    console.error('Auth error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
