import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const seasonId = searchParams.get('seasonId') || '';

    const where: Record<string, unknown> = {};
    if (seasonId) where.seasonId = seasonId;

    const sponsors = await db.sponsor.findMany({
      where,
      include: {
        season: { select: { id: true, name: true, year: true } },
        team: { select: { id: true, name: true, shortName: true, logo: true } },
      },
      orderBy: [
        { tier: 'asc' },
        { createdAt: 'desc' },
      ],
    });

    const formatted = sponsors.map((sponsor) => ({
      id: sponsor.id,
      name: sponsor.name,
      logo: sponsor.logo,
      website: sponsor.website,
      tier: sponsor.tier,
      isActive: sponsor.isActive,
      seasonId: sponsor.seasonId,
      season: sponsor.season,
      teamId: sponsor.teamId,
      team: sponsor.team,
      createdAt: sponsor.createdAt,
    }));

    return NextResponse.json({ sponsors: formatted });
  } catch (error) {
    console.error('Sponsors fetch error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, logo, website, tier, seasonId, teamId } = body;

    if (!name || !tier) {
      return NextResponse.json(
        { error: 'name and tier are required' },
        { status: 400 }
      );
    }

    const validTiers = ['bronze', 'silver', 'gold', 'platinum'];
    if (!validTiers.includes(tier)) {
      return NextResponse.json(
        { error: `tier must be one of: ${validTiers.join(', ')}` },
        { status: 400 }
      );
    }

    const sponsor = await db.sponsor.create({
      data: {
        name,
        logo: logo || null,
        website: website || null,
        tier,
        seasonId: seasonId || null,
        teamId: teamId || null,
      },
      include: {
        season: { select: { id: true, name: true, year: true } },
        team: { select: { id: true, name: true, shortName: true, logo: true } },
      },
    });

    return NextResponse.json({ sponsor }, { status: 201 });
  } catch (error) {
    console.error('Sponsor create error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
