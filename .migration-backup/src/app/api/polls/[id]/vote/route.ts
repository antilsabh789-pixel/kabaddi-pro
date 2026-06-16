import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: pollId } = await params;
    const body = await request.json();
    const { optionId, userId } = body;

    if (!optionId || !userId) {
      return NextResponse.json(
        { error: 'optionId and userId are required' },
        { status: 400 }
      );
    }

    // Verify poll exists and is active
    const poll = await db.poll.findUnique({ where: { id: pollId } });
    if (!poll) {
      return NextResponse.json({ error: 'Poll not found' }, { status: 404 });
    }
    if (poll.status !== 'active') {
      return NextResponse.json({ error: 'Poll is not active' }, { status: 400 });
    }
    if (poll.endsAt && new Date() > poll.endsAt) {
      return NextResponse.json({ error: 'Poll has expired' }, { status: 400 });
    }

    // Check if user already voted
    const existingVote = await db.pollVote.findUnique({
      where: { pollId_userId: { pollId, userId } },
    });

    if (existingVote) {
      return NextResponse.json(
        { error: 'User has already voted on this poll', existingVote },
        { status: 409 }
      );
    }

    // Verify option belongs to this poll
    const option = await db.pollOption.findUnique({ where: { id: optionId } });
    if (!option || option.pollId !== pollId) {
      return NextResponse.json(
        { error: 'Invalid option for this poll' },
        { status: 400 }
      );
    }

    // Create the vote
    const vote = await db.pollVote.create({
      data: {
        pollId,
        optionId,
        userId,
      },
      include: {
        option: { select: { id: true, label: true } },
      },
    });

    // Return updated poll with vote counts
    const updatedPoll = await db.poll.findUnique({
      where: { id: pollId },
      include: {
        options: {
          include: {
            _count: { select: { votes: true } },
          },
        },
        _count: { select: { votes: true } },
      },
    });

    return NextResponse.json({ vote, poll: updatedPoll }, { status: 201 });
  } catch (error) {
    console.error('Poll vote error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
