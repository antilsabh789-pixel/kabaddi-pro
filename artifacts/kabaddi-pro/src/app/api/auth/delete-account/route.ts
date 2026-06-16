import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { userId, confirmation } = body;

    if (!userId) {
      return NextResponse.json(
        { error: 'User ID is required' },
        { status: 400 }
      );
    }

    // Require confirmation phrase for safety
    if (confirmation !== 'DELETE') {
      return NextResponse.json(
        { error: 'Confirmation required. Please type DELETE to confirm.' },
        { status: 400 }
      );
    }

    // Check user exists
    const user = await db.user.findUnique({
      where: { id: userId },
      select: { id: true, phone: true, name: true },
    });

    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    // Delete all related data in correct order (respecting foreign key constraints)

    // 1. Delete student rewards
    try {
      await db.studentReward.deleteMany({ where: { userId } });
    } catch { /* skip if no records */ }

    // 2. Delete fee records
    try {
      await db.feeRecord.deleteMany({ where: { userId } });
    } catch { /* skip if no records */ }

    // 3. Delete attendances
    try {
      await db.attendance.deleteMany({ where: { userId } });
    } catch { /* skip if no records */ }

    // 4. Delete academy players
    try {
      await db.academyPlayer.deleteMany({ where: { userId } });
    } catch { /* skip if no records */ }

    // 5. Delete parent contacts
    try {
      await db.parentContact.deleteMany({ where: { userId } });
    } catch { /* skip if no records */ }

    // 6. Delete AI insights
    try {
      await db.aiInsight.deleteMany({ where: { userId } });
    } catch { /* skip if no records */ }

    // 7. Delete poll votes
    try {
      await db.pollVote.deleteMany({ where: { userId } });
    } catch { /* skip if no records */ }

    // 8. Delete referrals made and used
    try {
      await db.referral.updateMany({
        where: { referredId: userId },
        data: { referredId: null },
      });
    } catch { /* skip */ }
    try {
      await db.referral.deleteMany({ where: { referrerId: userId } });
    } catch { /* skip if no records */ }

    // 9. Delete challenges sent and received
    try {
      await db.challenge.deleteMany({
        where: { OR: [{ fromUserId: userId }, { toUserId: userId }] },
      });
    } catch { /* skip if no records */ }

    // 10. Delete user achievements
    try {
      await db.userAchievement.deleteMany({ where: { userId } });
    } catch { /* skip if no records */ }

    // 11. Delete activities
    try {
      await db.activity.deleteMany({ where: { userId } });
    } catch { /* skip if no records */ }

    // 12. Delete notifications (both sent and received)
    try {
      await db.notification.deleteMany({
        where: { OR: [{ userId }, { fromUserId: userId }] },
      });
    } catch { /* skip if no records */ }

    // 13. Delete follows (both follower and following)
    try {
      await db.follow.deleteMany({
        where: { OR: [{ followerId: userId }, { followingId: userId }] },
      });
    } catch { /* skip if no records */ }

    // 14. Delete payments
    try {
      await db.payment.deleteMany({ where: { userId } });
    } catch { /* skip if no records */ }

    // 15. Delete match scorers
    try {
      await db.matchScorer.deleteMany({ where: { userId } });
    } catch { /* skip if no records */ }

    // 16. Delete team memberships
    try {
      await db.teamMember.deleteMany({ where: { userId } });
    } catch { /* skip if no records */ }

    // 17. Delete player profile
    try {
      await db.playerProfile.deleteMany({ where: { userId } });
    } catch { /* skip if no records */ }

    // 18. Nullify tournament organizer references
    try {
      await db.tournament.updateMany({
        where: { organizerId: userId },
        data: { organizerId: null },
      });
    } catch { /* skip */ }

    // 19. Nullify match transfer references
    try {
      await db.matchTransfer.updateMany({
        where: { scorerUserId: userId },
        data: { scorerUserId: null },
      });
    } catch { /* skip */ }
    try {
      await db.matchTransfer.updateMany({
        where: { receiverUserId: userId },
        data: { receiverUserId: null },
      });
    } catch { /* skip */ }

    // 20. Finally, delete the user record itself
    // (cascade on User model handles remaining relations)
    await db.user.delete({
      where: { id: userId },
    });

    return NextResponse.json({
      success: true,
      message: 'Account deleted successfully',
    });
  } catch (error) {
    console.error('Delete account error:', error);
    return NextResponse.json(
      { error: 'Failed to delete account. Please try again.' },
      { status: 500 }
    );
  }
}
