// Notification helper functions for Kabaddi Pro

export type NotificationType = 'match_start' | 'match_result' | 'achievement' | 'premium' | 'general';

export interface AppNotification {
  id: string;
  type: NotificationType;
  title: string;
  description: string;
  timestamp: number;
  read: boolean;
  matchId?: string; // for match_start/match_result notifications — used to open the scorecard
}

const ICONS: Record<NotificationType, string> = {
  match_start: '🏐',
  match_result: '🏆',
  achievement: '⭐',
  premium: '👑',
  general: '📢',
};

export function getNotificationIcon(type: NotificationType): string {
  return ICONS[type] || '📢';
}

export function matchNotification(
  homeTeam: string,
  awayTeam: string,
  homeScore: number,
  awayScore: number,
  matchId?: string
): Omit<AppNotification, 'id' | 'timestamp' | 'read'> {
  return {
    type: 'match_result',
    title: 'Match Completed',
    description: `${homeTeam} ${homeScore} - ${awayScore} ${awayTeam}`,
    matchId,
  };
}

export function matchStartNotification(
  homeTeam: string,
  awayTeam: string
): Omit<AppNotification, 'id' | 'timestamp' | 'read'> {
  return {
    type: 'match_start',
    title: 'Match Started',
    description: `${homeTeam} vs ${awayTeam} is now live!`,
  };
}

export function achievementNotification(
  badge: string,
  description: string
): Omit<AppNotification, 'id' | 'timestamp' | 'read'> {
  return {
    type: 'achievement',
    title: `Achievement: ${badge}`,
    description,
  };
}

export function premiumNotification(
  message: string
): Omit<AppNotification, 'id' | 'timestamp' | 'read'> {
  return {
    type: 'premium',
    title: 'Premium',
    description: message,
  };
}

export function welcomeBackNotification(name: string): Omit<AppNotification, 'id' | 'timestamp' | 'read'> {
  return {
    type: 'general',
    title: 'Welcome Back!',
    description: `Great to see you again, ${name}! Check out the latest matches.`,
  };
}
