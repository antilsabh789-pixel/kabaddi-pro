import { Router } from 'express';
import { db } from '../lib/db';

const router = Router();

// ─── Helpers ────────────────────────────────────────────────────────────

/** Canonical (a, b) ordering so the (userAId, userBId) unique constraint
 *  always stores the lower cuid first, regardless of who initiated. */
function orderedPair(a: string, b: string): [string, string] {
  return a < b ? [a, b] : [b, a];
}

const PUBLIC_USER_FIELDS = {
  id: true,
  name: true,
  playerCode: true,
  avatar: true,
  role: true,
  isPremium: true,
  isAdmin: true,
} as const;

const VALID_REPORT_REASONS = ['spam', 'abuse', 'harassment', 'inappropriate', 'other'] as const;
const VALID_REPORT_STATUSES = ['pending', 'reviewing', 'actioned', 'dismissed'] as const;

// ─── 1. List user's chat threads (inbox) ────────────────────────────────
// Returns threads with the other participant + last message preview + unread count
router.get('/chat/threads', async (req, res) => {
  try {
    const userId = req.query['userId'] as string;
    if (!userId) return res.status(400).json({ error: 'userId is required' });

    const threads = await db.chatThread.findMany({
      where: { OR: [{ userAId: userId }, { userBId: userId }] },
      orderBy: { updatedAt: 'desc' },
      include: {
        userA: { select: PUBLIC_USER_FIELDS },
        userB: { select: PUBLIC_USER_FIELDS },
        messages: {
          orderBy: { createdAt: 'desc' },
          take: 1,
          select: { id: true, content: true, senderId: true, createdAt: true, isRead: true },
        },
      },
    });

    // For each thread: compute unread count + identify the "other" user
    const enriched = await Promise.all(
      threads.map(async (t: any) => {
        const otherUser = t.userAId === userId ? t.userB : t.userA;
        const unreadCount = await db.chatMessage.count({
          where: { threadId: t.id, senderId: { not: userId }, isRead: false },
        });
        return {
          id: t.id,
          otherUser,
          lastMessage: t.messages[0] || null,
          unreadCount,
          updatedAt: t.updatedAt,
        };
      }),
    );

    return res.json({ threads: enriched });
  } catch (err) {
    console.error('GET /chat/threads error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ─── 2. Get-or-create a thread with a target user ──────────────────────
router.post('/chat/threads', async (req, res) => {
  try {
    const { userId, targetUserId } = req.body;
    if (!userId || !targetUserId) {
      return res.status(400).json({ error: 'userId and targetUserId are required' });
    }
    if (userId === targetUserId) {
      return res.status(400).json({ error: 'Cannot start a chat with yourself' });
    }

    // Verify target exists
    const target = await db.user.findUnique({
      where: { id: targetUserId },
      select: PUBLIC_USER_FIELDS,
    });
    if (!target) return res.status(404).json({ error: 'Target user not found' });

    // Check block (either direction blocks chat creation)
    const blockExists = await db.chatBlock.findFirst({
      where: {
        OR: [
          { blockerId: userId, blockedId: targetUserId },
          { blockerId: targetUserId, blockedId: userId },
        ],
      },
    });
    if (blockExists) {
      const youBlocked = blockExists.blockerId === userId;
      return res.status(403).json({
        error: youBlocked
          ? 'You have blocked this user. Unblock them to start a chat.'
          : 'This user is not available for chat.',
        code: 'BLOCKED',
      });
    }

    const [a, b] = orderedPair(userId, targetUserId);
    const thread = await db.chatThread.upsert({
      where: { userAId_userBId: { userAId: a, userBId: b } },
      update: {},
      create: { userAId: a, userBId: b },
    });

    return res.json({
      threadId: thread.id,
      otherUser: target,
      createdAt: thread.createdAt,
    });
  } catch (err) {
    console.error('POST /chat/threads error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ─── 3. Get messages for a thread (paginated, cursor-based) ────────────
// Also marks all UNREAD messages sent BY THE OTHER USER as read.
router.get('/chat/threads/:threadId/messages', async (req, res) => {
  try {
    const { threadId } = req.params;
    const userId = req.query['userId'] as string;
    const before = req.query['before'] as string | undefined; // ISO timestamp cursor
    const limit = Math.min(Number(req.query['limit'] || 30), 100);

    if (!userId) return res.status(400).json({ error: 'userId is required' });

    // Verify caller is a participant
    const thread = await db.chatThread.findUnique({ where: { id: threadId } });
    if (!thread) return res.status(404).json({ error: 'Thread not found' });
    if (thread.userAId !== userId && thread.userBId !== userId) {
      return res.status(403).json({ error: 'Not a participant in this thread' });
    }

    const where: any = { threadId };
    if (before) where.createdAt = { lt: new Date(before) };

    const messages = await db.chatMessage.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: limit,
      include: { sender: { select: PUBLIC_USER_FIELDS } },
    });

    // Mark all messages sent BY THE OTHER USER as read (recipient opened thread)
    await db.chatMessage.updateMany({
      where: {
        threadId,
        senderId: { not: userId },
        isRead: false,
      },
      data: { isRead: true, readAt: new Date() },
    });

    // Reverse so oldest-first for display (we fetched desc for cursor pagination)
    return res.json({ messages: messages.reverse(), hasMore: messages.length === limit });
  } catch (err) {
    console.error('GET /chat/threads/:id/messages error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ─── 4. Send a message ─────────────────────────────────────────────────
router.post('/chat/threads/:threadId/messages', async (req, res) => {
  try {
    const { threadId } = req.params;
    const { userId, content } = req.body;

    if (!userId) return res.status(400).json({ error: 'userId is required' });
    if (!content || typeof content !== 'string') {
      return res.status(400).json({ error: 'content is required' });
    }
    const trimmed = content.trim();
    if (!trimmed) return res.status(400).json({ error: 'Message cannot be empty' });
    if (trimmed.length > 2000) {
      return res.status(400).json({ error: 'Message too long (max 2000 chars)' });
    }

    // Verify caller is a participant
    const thread = await db.chatThread.findUnique({ where: { id: threadId } });
    if (!thread) return res.status(404).json({ error: 'Thread not found' });
    if (thread.userAId !== userId && thread.userBId !== userId) {
      return res.status(403).json({ error: 'Not a participant in this thread' });
    }

    const otherUserId = thread.userAId === userId ? thread.userBId : thread.userAId;

    // Check block (either direction — if blocked, no new messages)
    const blockExists = await db.chatBlock.findFirst({
      where: {
        OR: [
          { blockerId: userId, blockedId: otherUserId },
          { blockerId: otherUserId, blockedId: userId },
        ],
      },
    });
    if (blockExists) {
      const youBlocked = blockExists.blockerId === userId;
      return res.status(403).json({
        error: youBlocked
          ? 'You have blocked this user. Unblock them to send messages.'
          : 'You cannot reply to this conversation.',
        code: 'BLOCKED',
      });
    }

    // Create the message + bump thread's updatedAt (for inbox sorting)
    const [message] = await db.$transaction([
      db.chatMessage.create({
        data: { threadId, senderId: userId, content: trimmed },
        include: { sender: { select: PUBLIC_USER_FIELDS } },
      }),
      db.chatThread.update({ where: { id: threadId }, data: { updatedAt: new Date() } }),
    ]);

    // Push a Notification to the recipient so the bell icon shows it.
    // Best-effort: if it fails, the message still went through.
    try {
      const sender = await db.user.findUnique({
        where: { id: userId },
        select: { name: true, playerCode: true },
      });
      const senderLabel = sender?.name || sender?.playerCode || 'A player';
      await db.notification.create({
        data: {
          userId: otherUserId,
          fromUserId: userId,
          type: 'chat',
          title: `New message from ${senderLabel}`,
          message: trimmed.length > 80 ? trimmed.slice(0, 80) + '…' : trimmed,
        },
      });
    } catch (notifErr) {
      console.warn('chat: failed to push notification:', String(notifErr).slice(0, 200));
    }

    return res.json({ message });
  } catch (err) {
    console.error('POST /chat/threads/:id/messages error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ─── 5. Block a user ───────────────────────────────────────────────────
router.post('/chat/block', async (req, res) => {
  try {
    const { blockerId, blockedId } = req.body;
    if (!blockerId || !blockedId) {
      return res.status(400).json({ error: 'blockerId and blockedId are required' });
    }
    if (blockerId === blockedId) {
      return res.status(400).json({ error: 'Cannot block yourself' });
    }
    const target = await db.user.findUnique({ where: { id: blockedId }, select: { id: true } });
    if (!target) return res.status(404).json({ error: 'Target user not found' });

    // Upsert — idempotent if already blocked
    await db.chatBlock.upsert({
      where: { blockerId_blockedId: { blockerId, blockedId } },
      update: {},
      create: { blockerId, blockedId },
    });
    return res.json({ success: true });
  } catch (err) {
    console.error('POST /chat/block error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ─── 6. Unblock a user ─────────────────────────────────────────────────
router.delete('/chat/block', async (req, res) => {
  try {
    const { blockerId, blockedId } = req.body;
    if (!blockerId || !blockedId) {
      return res.status(400).json({ error: 'blockerId and blockedId are required' });
    }
    await db.chatBlock.deleteMany({ where: { blockerId, blockedId } });
    return res.json({ success: true });
  } catch (err) {
    console.error('DELETE /chat/block error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ─── 7. List users I've blocked ────────────────────────────────────────
router.get('/chat/blocked', async (req, res) => {
  try {
    const userId = req.query['userId'] as string;
    if (!userId) return res.status(400).json({ error: 'userId is required' });
    const blocks = await db.chatBlock.findMany({
      where: { blockerId: userId },
      orderBy: { createdAt: 'desc' },
      include: { blocked: { select: PUBLIC_USER_FIELDS } },
    });
    return res.json({ blocked: blocks.map((b: any) => b.blocked) });
  } catch (err) {
    console.error('GET /chat/blocked error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ─── 8. Check if I have a block (either direction) with another user ───
router.get('/chat/block-status', async (req, res) => {
  try {
    const userId = req.query['userId'] as string;
    const otherUserId = req.query['otherUserId'] as string;
    if (!userId || !otherUserId) {
      return res.status(400).json({ error: 'userId and otherUserId are required' });
    }
    const block = await db.chatBlock.findFirst({
      where: {
        OR: [
          { blockerId: userId, blockedId: otherUserId },
          { blockerId: otherUserId, blockedId: userId },
        ],
      },
    });
    return res.json({
      youBlockedThem: block?.blockerId === userId,
      theyBlockedYou: block?.blockerId === otherUserId,
    });
  } catch (err) {
    console.error('GET /chat/block-status error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ─── 9. Submit a report ────────────────────────────────────────────────
router.post('/chat/reports', async (req, res) => {
  try {
    const { reporterId, reportedId, threadId, messageId, reason, details } = req.body;
    if (!reporterId || !reportedId || !reason) {
      return res.status(400).json({ error: 'reporterId, reportedId, and reason are required' });
    }
    if (reporterId === reportedId) {
      return res.status(400).json({ error: 'Cannot report yourself' });
    }
    if (!VALID_REPORT_REASONS.includes(reason)) {
      return res.status(400).json({ error: `reason must be one of: ${VALID_REPORT_REASONS.join(', ')}` });
    }
    const reported = await db.user.findUnique({ where: { id: reportedId }, select: { id: true } });
    if (!reported) return res.status(404).json({ error: 'Reported user not found' });

    const report = await db.chatReport.create({
      data: {
        reporterId,
        reportedId,
        threadId: threadId || null,
        messageId: messageId || null,
        reason,
        details: details ? String(details).slice(0, 1000) : null,
      },
    });
    return res.json({ report });
  } catch (err) {
    console.error('POST /chat/reports error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ═══════════════════════════════════════════════════════════════════════
// ─── ADMIN ROUTES — Review chat reports ────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════

/** Canonical admin guard — same pattern as admin.ts */
async function requireAdmin(adminId: string | undefined) {
  if (!adminId) return null;
  const admin = await db.user.findUnique({
    where: { id: adminId },
    select: { isAdmin: true, name: true, id: true },
  });
  if (!admin || !admin.isAdmin) return null;
  return admin;
}

// ─── A1. List chat reports (with filters) ──────────────────────────────
router.get('/admin/chat/reports', async (req, res) => {
  try {
    const adminId = req.query['adminId'] as string;
    const admin = await requireAdmin(adminId);
    if (!admin) return res.status(403).json({ error: 'Admin access required' });

    const status = req.query['status'] as string | undefined;
    const page = Math.max(1, Number(req.query['page'] || 1));
    const pageSize = Math.min(50, Number(req.query['pageSize'] || 20));

    const where: any = {};
    if (status && VALID_REPORT_STATUSES.includes(status as any)) where.status = status;

    const [reports, total] = await Promise.all([
      db.chatReport.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: {
          reporter: { select: PUBLIC_USER_FIELDS },
          reported: { select: PUBLIC_USER_FIELDS },
          reviewer: { select: { id: true, name: true } },
        },
      }),
      db.chatReport.count({ where }),
    ]);

    return res.json({
      reports,
      pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) },
    });
  } catch (err) {
    console.error('GET /admin/chat/reports error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ─── A2. Get a single report (with the reported message context) ───────
router.get('/admin/chat/reports/:id', async (req, res) => {
  try {
    const adminId = req.query['adminId'] as string;
    const admin = await requireAdmin(adminId);
    if (!admin) return res.status(403).json({ error: 'Admin access required' });

    const report = await db.chatReport.findUnique({
      where: { id: req.params['id'] },
      include: {
        reporter: { select: PUBLIC_USER_FIELDS },
        reported: { select: PUBLIC_USER_FIELDS },
        reviewer: { select: { id: true, name: true } },
      },
    });
    if (!report) return res.status(404).json({ error: 'Report not found' });

    // If the report references a thread, also pull recent context messages
    let contextMessages: any[] = [];
    if (report.threadId) {
      contextMessages = await db.chatMessage.findMany({
        where: { threadId: report.threadId },
        orderBy: { createdAt: 'desc' },
        take: 20,
        include: { sender: { select: PUBLIC_USER_FIELDS } },
      });
      contextMessages.reverse();
    }

    return res.json({ report, contextMessages });
  } catch (err) {
    console.error('GET /admin/chat/reports/:id error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ─── A3. Update report status (review action) ──────────────────────────
// Body: { adminId, status, adminNote? }
router.patch('/admin/chat/reports/:id', async (req, res) => {
  try {
    const { adminId, status, adminNote } = req.body;
    const admin = await requireAdmin(adminId);
    if (!admin) return res.status(403).json({ error: 'Admin access required' });

    if (!status || !VALID_REPORT_STATUSES.includes(status)) {
      return res.status(400).json({ error: `status must be one of: ${VALID_REPORT_STATUSES.join(', ')}` });
    }

    const existing = await db.chatReport.findUnique({ where: { id: req.params['id'] } });
    if (!existing) return res.status(404).json({ error: 'Report not found' });

    const updated = await db.chatReport.update({
      where: { id: req.params['id'] },
      data: {
        status,
        reviewedBy: admin.id,
        reviewedAt: new Date(),
        adminNote: adminNote !== undefined ? String(adminNote).slice(0, 1000) : existing.adminNote,
      },
    });
    return res.json({ report: updated });
  } catch (err) {
    console.error('PATCH /admin/chat/reports/:id error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ─── A4. Admin: list all reports filed against a specific user ─────────
router.get('/admin/chat/users/:userId/reports', async (req, res) => {
  try {
    const adminId = req.query['adminId'] as string;
    const admin = await requireAdmin(adminId);
    if (!admin) return res.status(403).json({ error: 'Admin access required' });

    const reports = await db.chatReport.findMany({
      where: { reportedId: req.params['userId'] },
      orderBy: { createdAt: 'desc' },
      take: 50,
      include: {
        reporter: { select: PUBLIC_USER_FIELDS },
        reviewer: { select: { id: true, name: true } },
      },
    });
    return res.json({ reports });
  } catch (err) {
    console.error('GET /admin/chat/users/:id/reports error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ─── A5. Stats summary for admin dashboard ─────────────────────────────
router.get('/admin/chat/stats', async (req, res) => {
  try {
    const adminId = req.query['adminId'] as string;
    const admin = await requireAdmin(adminId);
    if (!admin) return res.status(403).json({ error: 'Admin access required' });

    const [pending, reviewing, actioned, dismissed, total] = await Promise.all([
      db.chatReport.count({ where: { status: 'pending' } }),
      db.chatReport.count({ where: { status: 'reviewing' } }),
      db.chatReport.count({ where: { status: 'actioned' } }),
      db.chatReport.count({ where: { status: 'dismissed' } }),
      db.chatReport.count(),
    ]);

    return res.json({
      byStatus: { pending, reviewing, actioned, dismissed, total },
    });
  } catch (err) {
    console.error('GET /admin/chat/stats error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
