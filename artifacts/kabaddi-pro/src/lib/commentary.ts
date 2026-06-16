/**
 * Auto-generate text commentary for kabaddi scoring events
 */

export interface CommentaryExtras {
  isSuperRaid?: boolean;
  isSuperTackle?: boolean;
  isDoOrDie?: boolean;
  isAllOut?: boolean;
  defendersTouched?: number;
}

export function generateCommentary(
  eventType: string,
  playerName: string,
  teamName: string,
  value: number,
  extras?: CommentaryExtras,
): string {
  switch (eventType) {
    case 'raid_point': {
      if (extras?.isSuperRaid || value >= 3) {
        return `SUPER RAID! ${playerName} with ${value} points for ${teamName}!`;
      }
      if (value === 1) {
        return `${playerName} scores a raid point for ${teamName}!`;
      }
      return `${playerName} scores ${value} raid points for ${teamName}!`;
    }

    case 'bonus_point':
      return `Bonus point! ${playerName} sneaks past the defense for ${teamName}!`;

    case 'tackle_point':
      return `${playerName} is tackled out! Defense holds strong!`;

    case 'super_tackle':
      return `SUPER TACKLE! ${playerName} is brought down with just ${extras?.defendersTouched ?? 3} defenders! +2 for ${teamName}!`;

    case 'empty_raid':
      return `Empty raid from ${playerName}. No points this time.`;

    case 'all_out':
      return `ALL OUT! ${teamName} wipes out the opposition! +2 bonus points!`;

    case 'do_or_die_raid':
      return `DO-OR-DIE raid for ${playerName}! This one matters!`;

    default:
      return `${playerName} makes a play for ${teamName}!`;
  }
}

/** Get a color class for commentary dot based on type */
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
    default:
      return 'bg-gray-400';
  }
}

/** Get commentary type from event type for coloring */
export function getCommentaryType(eventType: string): string {
  if (eventType === 'super_tackle') return 'super_tackle';
  if (eventType === 'all_out') return 'all_out';
  if (eventType === 'empty_raid') return 'empty_raid';
  if (eventType === 'do_or_die_raid') return 'do_or_die_raid';
  if (eventType === 'bonus_point') return 'bonus_point';
  if (eventType === 'tackle_point') return 'tackle_point';
  // raid_point can also be super_raid
  return eventType;
}
