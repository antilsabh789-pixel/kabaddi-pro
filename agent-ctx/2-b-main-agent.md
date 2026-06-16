# Task 2-b: Discovery & Community Features

## Task Summary
Create 5 new screen components and their corresponding API routes for discovery and community features in the Kabaddi Pro Next.js app.

## Files Created

### Components (in /src/components/kabaddi/)
1. **FindPlayersScreen.tsx** (Feature #63) - GPS-based player discovery
2. **FindTeamsScreen.tsx** (Feature #64) - Nearby team discovery
3. **TournamentMapScreen.tsx** (Feature #67) - Tournament discovery with list/grid views
4. **SmartTeamSuggestionsScreen.tsx** (Feature #68) - AI-powered team recommendations
5. **PlayerWinRateScreen.tsx** (Feature #11) - Player win rate vs specific teams

### API Routes (in /src/app/api/)
1. **/api/nearby-players/route.ts** - GET: Find players near lat/lng using Haversine formula
2. **/api/player-location/route.ts** - POST: Save/update user's GPS location (upsert)
3. **/api/nearby-teams/route.ts** - GET: Find teams near user via member locations + ground matches
4. **/api/nearby-tournaments/route.ts** - GET: Find tournaments near user via grounds
5. **/api/team-suggestions/route.ts** - GET: Suggest teams based on position/proximity/skill
6. **/api/player-win-rate/route.ts** - GET: Player win/loss stats grouped by opposing team

### Modified Files
- **/src/lib/i18n.ts** - Added ~90 new translation keys for all 5 features (en/hi)
- **/worklog.md** - Appended task 2-b work log entry

## Technical Details
- Haversine formula used across all proximity APIs for accurate distance calculation
- All screens use browser Geolocation API with proper error handling
- FindPlayersScreen includes "Save My Location" upsert to PlayerLocation table
- FindTeamsScreen uses dual discovery: member PlayerLocations + Ground-based match lookups
- TournamentMapScreen supports list/grid view toggle with status and radius filters
- SmartTeamSuggestionsScreen uses scoring algorithm: position need (30pts) + proximity (25pts) + skill level (20pts) + team size (15pts)
- PlayerWinRateScreen has expandable team rows, visual win rate bars, and 3 sort modes
- All components follow existing patterns: 'use client', framer-motion, shadcn/ui, warm/brand colors, dark mode, responsive, loading skeletons
- Lint check passes clean
