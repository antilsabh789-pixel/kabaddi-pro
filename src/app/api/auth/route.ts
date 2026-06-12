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

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, phone, password, name, gender, weight, practiceGround, role, email, userId } = body;

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
          name: name || null,
          email: email || null,
          gender: gender || null,
          weight: weight || null,
          practiceGround: practiceGround || null,
          role: role || 'player',
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

      // Return user without password
      const { password: _, ...userWithoutPassword } = user;
      return NextResponse.json({ user: userWithoutPassword });
    }

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

    // ── Forgot Password: Send OTP (simulated) ──
    if (action === 'forgot-password') {
      if (!phone) {
        return NextResponse.json(
          { error: 'Phone number is required' },
          { status: 400 }
        );
      }

      const user = await db.user.findUnique({ where: { phone } });
      if (!user) {
        // Don't reveal whether user exists — still return success
        return NextResponse.json({ message: 'OTP sent if account exists' });
      }

      // Simulated OTP: In production, send via SMS
      // For demo, we store the OTP temporarily (in-memory)
      // We'll use a simple hash of the phone + timestamp as a "token"
      return NextResponse.json({ message: 'OTP sent if account exists' });
    }

    // ── Verify OTP (simulated — accepts "123456") ──
    if (action === 'verify-otp') {
      if (!phone || !body.otp) {
        return NextResponse.json(
          { error: 'Phone and OTP are required' },
          { status: 400 }
        );
      }

      // Demo: accept "123456" as valid OTP
      if (body.otp !== '123456') {
        return NextResponse.json(
          { error: 'Invalid OTP. Please try again.' },
          { status: 401 }
        );
      }

      // Verify user exists
      const user = await db.user.findUnique({ where: { phone } });
      if (!user) {
        return NextResponse.json(
          { error: 'No account found with this phone number' },
          { status: 404 }
        );
      }

      return NextResponse.json({ verified: true, message: 'OTP verified' });
    }

    // ── Reset Password ──
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

      // Verify OTP was provided (simple check)
      if (!body.otp || body.otp !== '123456') {
        return NextResponse.json(
          { error: 'OTP verification required' },
          { status: 401 }
        );
      }

      const user = await db.user.findUnique({ where: { phone } });
      if (!user) {
        return NextResponse.json(
          { error: 'No account found with this phone number' },
          { status: 404 }
        );
      }

      // Update password
      await db.user.update({
        where: { phone },
        data: { password: hashPassword(password) },
      });

      return NextResponse.json({ message: 'Password reset successfully' });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (error) {
    console.error('Auth error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
