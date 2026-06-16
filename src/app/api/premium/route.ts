import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { userId, plan, action } = body;

    if (!userId) {
      return NextResponse.json({ error: 'User ID is required' }, { status: 400 });
    }

    if (action === 'activate') {
      // Calculate expiry date based on plan
      const now = new Date();
      let premiumExpiry: Date | null = null;

      switch (plan) {
        case 'daily':
          premiumExpiry = new Date(now.getTime() + 1 * 24 * 60 * 60 * 1000);
          break;
        case 'weekly':
          premiumExpiry = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
          break;
        case 'monthly':
          premiumExpiry = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
          break;
        case 'yearly':
          premiumExpiry = new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000);
          break;
        case 'lifetime':
          premiumExpiry = null; // No expiry
          break;
        default:
          premiumExpiry = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
      }

      // Update user premium status
      const user = await db.user.update({
        where: { id: userId },
        data: {
          isPremium: true,
        },
      });

      const { password: _, ...userWithoutPassword } = user;
      return NextResponse.json({
        user: userWithoutPassword,
        plan,
        premiumExpiry: premiumExpiry?.toISOString() || null,
        activated: true,
      });
    }

    if (action === 'deactivate') {
      const user = await db.user.update({
        where: { id: userId },
        data: {
          isPremium: false,
        },
      });

      const { password: _, ...userWithoutPassword } = user;
      return NextResponse.json({
        user: userWithoutPassword,
        deactivated: true,
      });
    }

    if (action === 'check') {
      const user = await db.user.findUnique({
        where: { id: userId },
        select: { isPremium: true, id: true },
      });

      return NextResponse.json({
        isPremium: user?.isPremium || false,
      });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (error) {
    console.error('Premium API error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');

    if (!userId) {
      return NextResponse.json({ error: 'User ID is required' }, { status: 400 });
    }

    const user = await db.user.findUnique({
      where: { id: userId },
      select: { isPremium: true, id: true },
    });

    return NextResponse.json({
      isPremium: user?.isPremium || false,
    });
  } catch (error) {
    console.error('Premium check error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
