import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

// Generate a unique referral code
function generateReferralCode(userId: string): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let code = '';
  const seed = userId.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0);
  for (let i = 0; i < 8; i++) {
    code += chars[(seed * (i + 1) * 7 + i * 13) % chars.length];
  }
  return code;
}

// GET /api/referrals - Get referral info for a user
export async function GET(req: NextRequest) {
  try {
    const userId = req.nextUrl.searchParams.get('userId');
    if (!userId) {
      return NextResponse.json({ error: 'userId required' }, { status: 400 });
    }

    // Get or create referral for this user
    let referral = await db.referral.findFirst({
      where: { referrerId: userId },
    });

    if (!referral) {
      const code = generateReferralCode(userId);
      referral = await db.referral.create({
        data: {
          referrerId: userId,
          referralCode: code,
          status: 'pending',
          premiumDays: 7,
        },
      });
    }

    // Count successful referrals
    const successfulReferrals = await db.referral.count({
      where: { referrerId: userId, status: 'rewarded' },
    });

    // Get list of referred users
    const referrals = await db.referral.findMany({
      where: { referrerId: userId },
      include: {
        referred: { select: { name: true, avatar: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    const totalPremiumDaysEarned = referrals
      .filter(r => r.status === 'rewarded')
      .reduce((sum, r) => sum + r.premiumDays, 0);

    return NextResponse.json({
      referralCode: referral.referralCode,
      successfulReferrals,
      totalPremiumDaysEarned,
      referrals: referrals.map(r => ({
        id: r.id,
        status: r.status,
        premiumDays: r.premiumDays,
        referredName: r.referred?.name || 'Anonymous',
        referredAvatar: r.referred?.avatar || null,
        createdAt: r.createdAt,
        completedAt: r.completedAt,
      })),
    });
  } catch (error) {
    console.error('Referrals GET error:', error);
    return NextResponse.json({ error: 'Failed to fetch referrals' }, { status: 500 });
  }
}

// POST /api/referrals - Apply a referral code (when a new user signs up)
export async function POST(req: NextRequest) {
  try {
    const { referralCode, userId } = await req.json();
    if (!referralCode || !userId) {
      return NextResponse.json({ error: 'referralCode and userId required' }, { status: 400 });
    }

    const referral = await db.referral.findUnique({
      where: { referralCode },
    });

    if (!referral) {
      return NextResponse.json({ error: 'Invalid referral code' }, { status: 404 });
    }

    if (referral.referrerId === userId) {
      return NextResponse.json({ error: 'Cannot use your own referral code' }, { status: 400 });
    }

    if (referral.status === 'rewarded') {
      return NextResponse.json({ error: 'This referral code has already been used' }, { status: 400 });
    }

    // Update the referral with the referred user
    await db.referral.update({
      where: { id: referral.id },
      data: {
        referredId: userId,
        status: 'rewarded',
        completedAt: new Date(),
      },
    });

    // Grant premium days to referrer
    // For now, just activate premium for the referrer (simplified)
    const referrer = await db.user.findUnique({
      where: { id: referral.referrerId },
    });

    if (referrer && !referrer.isPremium) {
      await db.user.update({
        where: { id: referral.referrerId },
        data: { isPremium: true },
      });
    }

    return NextResponse.json({
      success: true,
      referrerName: 'A fellow kabaddi player',
      premiumDaysGranted: referral.premiumDays,
    });
  } catch (error) {
    console.error('Referrals POST error:', error);
    return NextResponse.json({ error: 'Failed to apply referral' }, { status: 500 });
  }
}
