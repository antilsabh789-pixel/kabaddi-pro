import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const matchId = searchParams.get('matchId') || '';

    const where: Record<string, unknown> = { status: 'active' };
    if (matchId) where.matchId = matchId;

    const polls = await db.poll.findMany({
      where,
      include: {
        options: {
          include: {
            team: { select: { id: true, name: true, shortName: true, logo: true } },
            _count: { select: { votes: true } },
          },
        },
        _count: { select: { votes: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    const formatted = polls.map((poll) => ({
      id: poll.id,
      question: poll.question,
      type: poll.type,
      status: poll.status,
      seasonId: poll.seasonId,
      matchId: poll.matchId,
      endsAt: poll.endsAt,
      createdAt: poll.createdAt,
      totalVotes: poll._count.votes,
      options: poll.options.map((opt) => ({
        id: opt.id,
        label: opt.label,
        icon: opt.icon,
        teamId: opt.teamId,
        team: opt.team,
        voteCount: opt._count.votes,
        percentage: poll._count.votes > 0
          ? Math.round((opt._count.votes / poll._count.votes) * 100)
          : 0,
      })),
    }));

    return NextResponse.json({ polls: formatted });
  } catch (error) {
    console.error('Polls fetch error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { question, type, seasonId, matchId, options, endsAt } = body;

    if (!question || !options || !Array.isArray(options) || options.length < 2) {
      return NextResponse.json(
        { error: 'question and at least 2 options are required' },
        { status: 400 }
      );
    }

    const poll = await db.poll.create({
      data: {
        question,
        type: type || 'prediction',
        seasonId: seasonId || null,
        matchId: matchId || null,
        status: 'active',
        endsAt: endsAt ? new Date(endsAt) : null,
        options: {
          create: options.map((opt: { label: string; icon?: string; teamId?: string }) => ({
            label: opt.label,
            icon: opt.icon || null,
            teamId: opt.teamId || null,
          })),
        },
      },
      include: {
        options: {
          include: {
            team: { select: { id: true, name: true, shortName: true } },
            _count: { select: { votes: true } },
          },
        },
        _count: { select: { votes: true } },
      },
    });

    return NextResponse.json({ poll }, { status: 201 });
  } catch (error) {
    console.error('Poll create error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
