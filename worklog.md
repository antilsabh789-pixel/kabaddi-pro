---
Task ID: 1
Agent: Main Agent
Task: Redesign match preview player display - change from circles to rectangular boxes with image/name/jersey, 7 per row each side, remove timer from center

Work Log:
- Read MatchDayExperience.tsx to understand current player display (was using circular team icons with Swords/Shield)
- Updated /api/match-events/route.ts to include player roster data (homePlayers/awayPlayers) with id, name, avatar, jerseyNumber, position, playerCode, isCaptain
- Added MatchPlayerAPI interface to MatchDayExperience.tsx
- Updated MatchDataAPI interface to include playersPerSide, homePlayers, and awayPlayers
- Created PlayerBox component - rectangular card (68px wide) with player image/avatar, jersey number badge, captain crown badge, and player name
- Redesigned score section: Home team name + score on top, home players row, VS/half indicator divider, away players row, away team name + score on bottom
- Removed CircularTimer from center divider between the two player rows
- Players shown in horizontal scrollable rows with up to playersPerSide (default 7) per team
- AnimatedScore component retained for score display with animation
- Verified lint passes, no TypeScript errors, API returns correct player data

Stage Summary:
- Players now shown in rectangular boxes instead of circles
- Each box shows: player avatar/initial, jersey number badge, name, captain crown
- 7 players per row (horizontal scroll if more), both home and away sides
- Timer removed from center between player rows
- API now returns full player roster for each team with jersey numbers and captain info
