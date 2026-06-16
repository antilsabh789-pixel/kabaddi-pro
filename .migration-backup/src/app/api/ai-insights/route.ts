import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId') || '';
    const matchId = searchParams.get('matchId') || '';

    const where: Record<string, unknown> = {};
    if (userId) {
      where.userId = userId;
    } else {
      where.userId = null; // global insights
    }
    if (matchId) where.matchId = matchId;

    const insights = await db.aIInsight.findMany({
      where,
      include: {
        match: {
          select: {
            id: true,
            homeScore: true,
            awayScore: true,
            status: true,
            homeTeam: { select: { id: true, name: true, shortName: true } },
            awayTeam: { select: { id: true, name: true, shortName: true } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });

    return NextResponse.json({ insights });
  } catch (error) {
    console.error('AI insights fetch error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { matchId } = body;

    if (!matchId) {
      return NextResponse.json(
        { error: 'matchId is required' },
        { status: 400 }
      );
    }

    // Fetch match data with events and player stats
    const match = await db.match.findUnique({
      where: { id: matchId },
      include: {
        homeTeam: {
          include: {
            members: {
              include: {
                user: {
                  include: {
                    profile: true,
                  },
                },
              },
            },
          },
        },
        awayTeam: {
          include: {
            members: {
              include: {
                user: {
                  include: {
                    profile: true,
                  },
                },
              },
            },
          },
        },
        events: {
          orderBy: { timestamp: 'asc' },
        },
        scorers: {
          include: {
            user: {
              include: { profile: true },
            },
          },
        },
      },
    });

    if (!match) {
      return NextResponse.json({ error: 'Match not found' }, { status: 404 });
    }

    // Prepare match data summary for AI
    const homeTeamStats = {
      name: match.homeTeam.name,
      score: match.homeScore,
      playerCount: match.homeTeam.members.length,
      topPerformers: match.homeTeam.members
        .filter((m) => m.user.profile)
        .sort((a, b) => b.user.profile!.overallRating - a.user.profile!.overallRating)
        .slice(0, 3)
        .map((m) => ({
          name: m.user.name || 'Unknown',
          rating: m.user.profile!.overallRating,
          totalRaids: m.user.profile!.totalRaids,
          successfulRaids: m.user.profile!.successfulRaids,
          totalTackles: m.user.profile!.totalTackles,
          successfulTackles: m.user.profile!.successfulTackles,
        })),
    };

    const awayTeamStats = {
      name: match.awayTeam.name,
      score: match.awayScore,
      playerCount: match.awayTeam.members.length,
      topPerformers: match.awayTeam.members
        .filter((m) => m.user.profile)
        .sort((a, b) => b.user.profile!.overallRating - a.user.profile!.overallRating)
        .slice(0, 3)
        .map((m) => ({
          name: m.user.name || 'Unknown',
          rating: m.user.profile!.overallRating,
          totalRaids: m.user.profile!.totalRaids,
          successfulRaids: m.user.profile!.successfulRaids,
          totalTackles: m.user.profile!.totalTackles,
          successfulTackles: m.user.profile!.successfulTackles,
        })),
    };

    const eventSummary: Record<string, number> = {};
    for (const evt of match.events) {
      eventSummary[evt.eventType] = (eventSummary[evt.eventType] || 0) + 1;
    }

    const matchDataStr = JSON.stringify({
      status: match.status,
      half: match.half,
      homeTeam: homeTeamStats,
      awayTeam: awayTeamStats,
      eventSummary,
      totalEvents: match.events.length,
    }, null, 2);

    let aiContent: string | null = null;

    // Try to generate AI insights using z-ai-web-dev-sdk
    try {
      const ZAI = (await import('z-ai-web-dev-sdk')).default;
      const zai = await ZAI.create();
      const completion = await zai.chat.completions.create({
        messages: [
          {
            role: 'system',
            content: 'You are a kabaddi analytics expert. Analyze match data and provide predictions, form analysis, and key insights. Respond in JSON format with an array of insights, each having: type (prediction|form_analysis|recommendation|milestone_alert), title, content, confidence (0.0-1.0).'
          },
          {
            role: 'user',
            content: `Analyze this kabaddi match data and provide 3-5 insights:\n\n${matchDataStr}`
          }
        ],
      });
      aiContent = completion.choices[0]?.message?.content || null;
    } catch (aiError) {
      console.error('AI SDK error, using fallback:', aiError);
    }

    // Parse AI response or generate fallback insights
    interface InsightData {
      type: string;
      title: string;
      content: string;
      confidence: number;
    }

    let insightsData: InsightData[] = [];

    if (aiContent) {
      try {
        // Try to parse JSON from AI response
        const jsonMatch = aiContent.match(/\[[\s\S]*\]/);
        if (jsonMatch) {
          insightsData = JSON.parse(jsonMatch[0]);
        }
      } catch {
        // If parsing fails, create a single insight from the raw text
        insightsData = [{
          type: 'form_analysis',
          title: 'Match Analysis',
          content: aiContent.substring(0, 500),
          confidence: 0.7,
        }];
      }
    }

    // Fallback insights if AI didn't produce usable results
    if (insightsData.length === 0) {
      const scoreDiff = match.homeScore - match.awayScore;
      const leadingTeam = scoreDiff > 0 ? match.homeTeam.name : scoreDiff < 0 ? match.awayTeam.name : 'Neither';
      const isTied = scoreDiff === 0;

      insightsData = [
        {
          type: 'prediction',
          title: 'Match Prediction',
          content: isTied
            ? `The match between ${match.homeTeam.name} and ${match.awayTeam.name} is currently tied at ${match.homeScore}-${match.awayScore}. This could go either way.`
            : `${leadingTeam} is currently leading by ${Math.abs(scoreDiff)} points. Based on current form, they have a strong chance of winning.`,
          confidence: Math.min(0.9, 0.5 + Math.abs(scoreDiff) * 0.05),
        },
        {
          type: 'form_analysis',
          title: 'Team Form Analysis',
          content: `${match.homeTeam.name} has scored ${match.homeScore} points with ${homeTeamStats.topPerformers.length} key performers. ${match.awayTeam.name} has scored ${match.awayScore} points with ${awayTeamStats.topPerformers.length} key performers.`,
          confidence: 0.8,
        },
        {
          type: 'recommendation',
          title: 'Key Players to Watch',
          content: [
            ...homeTeamStats.topPerformers.slice(0, 2).map((p) => `${p.name} (${match.homeTeam.name}) - Rating: ${p.rating}`),
            ...awayTeamStats.topPerformers.slice(0, 2).map((p) => `${p.name} (${match.awayTeam.name}) - Rating: ${p.rating}`),
          ].join('. '),
          confidence: 0.75,
        },
      ];

      // Add milestone alert if there are enough events
      if (match.events.length > 10) {
        insightsData.push({
          type: 'milestone_alert',
          title: 'Match Activity Alert',
          content: `This match has seen ${match.events.length} events so far, making it a highly active contest. ${Object.entries(eventSummary).map(([k, v]) => `${k}: ${v}`).join(', ')}.`,
          confidence: 0.9,
        });
      }
    }

    // Save insights to DB
    const savedInsights = await Promise.all(
      insightsData.map((insight) =>
        db.aIInsight.create({
          data: {
            matchId,
            userId: null, // global insight for the match
            type: insight.type,
            title: insight.title,
            content: insight.content,
            confidence: insight.confidence,
          },
        })
      )
    );

    return NextResponse.json({ insights: savedInsights }, { status: 201 });
  } catch (error) {
    console.error('AI insights generate error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
