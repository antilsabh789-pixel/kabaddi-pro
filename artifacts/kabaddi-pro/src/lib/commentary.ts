/**
 * AI-style commentary engine for kabaddi scoring.
 *
 * Two layers:
 *   1. generateCommentary()  — rich, multi-sentence per-event commentary
 *   2. generateMatchNarrative() — a full match summary paragraph (for scorecards)
 */

export interface CommentaryExtras {
  isSuperRaid?: boolean;
  isSuperTackle?: boolean;
  isDoOrDie?: boolean;
  isAllOut?: boolean;
  defendersTouched?: number;
  half?: number;
  matchTime?: string; // e.g. "12:34"
  scoreAfter?: string; // e.g. "14-11"
  teamScoreDelta?: number; // points gained by this event
}

export interface MatchEventForCommentary {
  eventType: string;
  playerName?: string;
  teamName?: string;
  value: number;
  half?: number;
  timestamp?: number;
  details?: string;
}

export interface MatchDataForNarrative {
  homeTeam: string;
  awayTeam: string;
  homeScore: number;
  awayScore: number;
  events: MatchEventForCommentary[];
  homeHalfScore?: number | null;
  awayHalfScore?: number | null;
  duration?: number | null;
}

// ─── Per-event commentary (rich, multi-sentence) ────────────────────

export function generateCommentary(
  eventType: string,
  playerName: string,
  teamName: string,
  value: number,
  extras?: CommentaryExtras,
): string {
  const time = extras?.matchTime ? `[${extras.matchTime}] ` : '';
  const scoreStr = extras?.scoreAfter ? ` → ${extras.scoreAfter}` : '';

  switch (eventType) {
    case 'raid_point': {
      if (extras?.isSuperRaid || value >= 3) {
        return `${time}🔥 SUPER RAID! ${playerName} tears through the defense, taking down ${value} defenders in one breathless raid! ${teamName} erupt as the scoreboard ticks up by ${value}.${scoreStr}`;
      }
      if (value === 1) {
        return `${time}⚔️ ${playerName} darts in, gets a touch on the defender, and escapes safely. One raid point for ${teamName}.${scoreStr}`;
      }
      return `${time}⚔️ ${playerName} touches ${value} defenders and returns — a multi-point raid for ${teamName}!${scoreStr}`;
    }

    case 'bonus_point':
      return `${time}✨ Bonus point! ${playerName} crosses the bonus line with composure, sneaking past the defense. ${teamName} get an extra point.${scoreStr}`;

    case 'tackle_point':
      return `${time}🛡️ ${playerName} is caught and brought down by the defense chain! A solid tackle — ${teamName} get the point.${scoreStr}`;

    case 'super_tackle':
      return `${time}💪 SUPER TACKLE! With only ${extras?.defendersTouched ?? 3} defenders on the mat, ${teamName} bring down the raider in stunning fashion! +2 points!${scoreStr}`;

    case 'empty_raid':
      return `${time}⚪ Empty raid from ${playerName}. The raider returns without scoring — no damage done.${scoreStr}`;

    case 'all_out':
      return `${time}💥 ALL OUT! ${teamName} wipe out the entire opposition! Every defender is sent to the bench and ${teamName} collect +2 bonus points!${scoreStr}`;

    case 'do_or_die_raid':
      return `${time}⚠️ DO-OR-DIE raid for ${playerName}! The pressure is immense — ${teamName} need a result here.${scoreStr}`;

    case 'technical_point':
      return `${time}📋 Technical point awarded to ${teamName} by the umpire.${scoreStr}`;

    case 'yellow_card':
      return `${time}🟨 Yellow card shown to ${playerName}! A 2-minute suspension — ${teamName} are down to ${value} players.`;

    case 'red_card':
      return `${time}🟥 Red card! ${playerName} is sent off for the remainder of the match! ${teamName} will play a player short.`;

    case 'green_card':
      return `${time}🟩 Green card — warning to ${playerName} for ${teamName}.`;

    case 'substitution':
      return `${time}🔄 Substitution for ${teamName} — ${playerName} comes on.`;

    case 'timeout':
      return `${time}⏸️ Timeout called by ${teamName}. The coach has words with the players.`;

    default:
      return `${time}${playerName} makes a play for ${teamName}!${scoreStr}`;
  }
}

// ─── Full match narrative (for scorecards) ──────────────────────────

/**
 * Generate a 2-4 sentence AI-style match narrative from the events array.
 * Covers: result, key moments (super raids, all-outs, do-or-die), top
 * performers, and momentum. Used in the scorecard's "AI Commentary" section.
 */
export function generateMatchNarrative(data: MatchDataForNarrative): string {
  const { homeTeam, awayTeam, homeScore, awayScore, events } = data;
  if (events.length === 0) {
    return `${homeTeam} ${homeScore} - ${awayScore} ${awayTeam}. The match is yet to begin — stay tuned for live action!`;
  }

  const margin = Math.abs(homeScore - awayScore);
  const winner = homeScore > awayScore ? homeTeam : awayScore > homeScore ? awayTeam : null;
  const loser = homeScore > awayScore ? awayTeam : awayScore > homeScore ? homeTeam : null;

  // Count key events
  const superRaids = events.filter(e => e.eventType === 'raid_point' && (e.value >= 3));
  const allOuts = events.filter(e => e.eventType === 'all_out');
  const superTackles = events.filter(e => e.eventType === 'super_tackle');
  const doOrDie = events.filter(e => e.eventType === 'do_or_die_raid');
  const emptyRaids = events.filter(e => e.eventType === 'empty_raid');
  const raidPoints = events.filter(e => e.eventType === 'raid_point' || e.eventType === 'bonus_point');
  const tacklePoints = events.filter(e => e.eventType === 'tackle_point' || e.eventType === 'super_tackle');

  // Top raider (most raid points)
  const raiderPoints = new Map<string, { name: string; team: string; pts: number }>();
  for (const e of raidPoints) {
    if (!e.playerName) continue;
    const key = e.playerName;
    const existing = raiderPoints.get(key) || { name: e.playerName, team: e.teamName || '', pts: 0 };
    existing.pts += e.value;
    raiderPoints.set(key, existing);
  }
  const topRaider = [...raiderPoints.values()].sort((a, b) => b.pts - a.pts)[0];

  // Top defender (most tackle points)
  const defenderPoints = new Map<string, { name: string; team: string; pts: number }>();
  for (const e of tacklePoints) {
    if (!e.playerName) continue;
    const key = e.playerName;
    const existing = defenderPoints.get(key) || { name: e.playerName, team: e.teamName || '', pts: 0 };
    existing.pts += e.value;
    defenderPoints.set(key, existing);
  }
  const topDefender = [...defenderPoints.values()].sort((a, b) => b.pts - a.pts)[0];

  // Build narrative
  const sentences: string[] = [];

  // Sentence 1: Result
  if (winner && loser) {
    if (margin === 0) {
      sentences.push(`A nail-biting contest ended in a ${homeScore}-${awayScore} draw between ${homeTeam} and ${awayTeam}.`);
    } else if (margin <= 2) {
      sentences.push(`${winner} edged past ${loser} in a thriller, winning ${homeScore > awayScore ? `${homeScore}-${awayScore}` : `${awayScore}-${homeScore}`} by the slimmest of margins.`);
    } else if (margin <= 5) {
      sentences.push(`${winner} defeated ${loser} ${homeScore > awayScore ? `${homeScore}-${awayScore}` : `${awayScore}-${homeScore}`} in a hard-fought battle.`);
    } else if (margin <= 10) {
      sentences.push(`${winner} secured a convincing ${homeScore > awayScore ? `${homeScore}-${awayScore}` : `${awayScore}-${homeScore}`} victory over ${loser}.`);
    } else {
      sentences.push(`${winner} dominated ${loser} with a commanding ${homeScore > awayScore ? `${homeScore}-${awayScore}` : `${awayScore}-${homeScore}`} triumph.`);
    }
  } else {
    sentences.push(`The match between ${homeTeam} and ${awayTeam} is underway, currently ${homeScore}-${awayScore}.`);
  }

  // Sentence 2: Key moments
  const keyMoments: string[] = [];
  if (superRaids.length > 0) {
    const best = superRaids.sort((a, b) => b.value - a.value)[0];
    keyMoments.push(`${best.playerName} lit up the mat with a ${best.value}-point super raid`);
  }
  if (allOuts.length > 0) {
    keyMoments.push(`${allOuts.length} all-out${allOuts.length > 1 ? 's' : ''} reshaped the contest`);
  }
  if (superTackles.length > 0) {
    keyMoments.push(`${superTackles.length} super tackle${superTackles.length > 1 ? 's' : ''} showcased defensive brilliance`);
  }
  if (doOrDie.length > 0) {
    keyMoments.push(`${doOrDie.length} do-or-die raid${doOrDie.length > 1 ? 's' : ''} added drama`);
  }
  if (keyMoments.length > 0) {
    sentences.push(`The match featured ${keyMoments.join(', ')}.`);
  }

  // Sentence 3: Top performers
  const performers: string[] = [];
  if (topRaider && topRaider.pts > 0) {
    performers.push(`${topRaider.name} (${topRaider.team}) led the raiding charts with ${topRaider.pts} points`);
  }
  if (topDefender && topDefender.pts > 0) {
    performers.push(`${topDefender.name} (${topDefender.team}) was the defensive rock with ${topDefender.pts} tackle points`);
  }
  if (performers.length > 0) {
    sentences.push(`${performers.join(' while ')}.`);
  }

  // Sentence 4: Match character (raid-heavy vs defense-heavy)
  if (raidPoints.length > tacklePoints.length * 2) {
    sentences.push(`It was a raid-dominated affair with ${raidPoints.length} successful raids against just ${tacklePoints.length} tackles.`);
  } else if (tacklePoints.length > raidPoints.length) {
    sentences.push(`Defense ruled the day as tackles (${tacklePoints.length}) outnumbered successful raids (${raidPoints.length}).`);
  } else if (emptyRaids.length > events.length * 0.3) {
    sentences.push(`A cautious, tactical encounter with ${emptyRaids.length} empty raids reflecting the tight defense on both sides.`);
  }

  return sentences.join(' ');
}

// ─── Helpers (unchanged) ────────────────────────────────────────────

export function getCommentaryDotColor(type: string): string {
  switch (type) {
    case 'raid_point':
    case 'bonus_point':
    case 'do_or_die_raid':
      return 'bg-red-400';
    case 'tackle_point':
    case 'super_tackle':
      return 'bg-blue-400';
    case 'super_raid':
      return 'bg-yellow-400';
    case 'all_out':
      return 'bg-orange-400';
    case 'empty_raid':
      return 'bg-gray-400';
    case 'technical_point':
      return 'bg-purple-400';
    default:
      return 'bg-gray-400';
  }
}

export function getCommentaryType(eventType: string): string {
  if (eventType === 'super_tackle') return 'super_tackle';
  if (eventType === 'all_out') return 'all_out';
  if (eventType === 'empty_raid') return 'empty_raid';
  if (eventType === 'do_or_die_raid') return 'do_or_die_raid';
  if (eventType === 'bonus_point') return 'bonus_point';
  if (eventType === 'tackle_point') return 'tackle_point';
  return eventType;
}
