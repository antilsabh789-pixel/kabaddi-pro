# Kabaddi Pro - Work Log

---
Task ID: 11
Agent: Main Agent
Task: Make player profile visits available from everywhere with premium-gated stats

Work Log:
- Created PlayerProfileScreen component (src/components/kabaddi/PlayerProfileScreen.tsx):
  - Full-screen overlay with animated slide-in, gradient banner with position-colored theme
  - Avatar with animated entrance, name, position badge, player code, jersey number
  - Follow/Following toggle button with follower count and API integration
  - Team names display
  - Quick stats grid: Matches (always visible), Total Pts & Rating (premium-gated with blur)
  - Premium gating: `canSeeStats = isPremium || isOwnProfile` - non-premium sees blurred stats
  - "Unlock Full Stats" banner opens PremiumUpgradeScreen when clicked
  - Performance breakdown: Raid Pts, Tackle Pts, Bonus Pts, Super Tackles (locked without premium)
  - Success rate animated bars: Raid %, Tackle %, Raid Attempts (locked)
  - Tournament vs Practice breakdown (premium only, only shows if matches > 0)
  - Weight and practice ground info
- Added openPlayerProfile helper to HomeTab.tsx
- Player profile accessible from everywhere:
  - Popular Players cards → click opens profile
  - Leaderboard Preview mini cards (top 3 on home) → click opens profile
  - Full Leaderboard Screen → click any podium entry or list entry
  - Awards section → handleAwardClick now opens profile (was just showing toast)
- Updated LeaderboardPreviewCard: now stores userId, accepts onClickPlayer prop, cursor-pointer
- Updated LeaderboardScreen: added onViewPlayer prop, all podium entries + list entries are clickable
- Updated PopularPlayersSection: added onViewProfile callback, card has cursor-pointer + onClick
- Updated /api/players/[id] route: now includes team names via TeamMember include
- Added i18n translations: profile.followers, profile.viewProfile, profile.unlockStats, profile.unlockStatsDesc (en/hi)
- Tested with agent-browser: Player profile opens from Popular Players, shows premium-locked stats, "Unlock Full Stats" opens upgrade screen, no errors

Stage Summary:
- Player profiles now accessible from anywhere in the app (Popular Players, Leaderboard, Awards)
- Non-premium users see: name, avatar, position, team, matches count, follow button
- Premium users see: full stats, performance breakdown, success rates, tournament vs practice splits
- Own profile always shows full stats (no premium required for self)
- "Unlock Full Stats" CTA drives premium conversions

---
Task ID: 10
Agent: Main Agent
Task: Add Popular Players section with follow option and score on home screen

Work Log:
- Created /api/popular-players endpoint (src/app/api/popular-players/route.ts):
  - Queries Follow table to count followers per player via groupBy
  - Calculates composite popularity score (followers * 10 + totalPoints)
  - Falls back to top players by totalPoints if no follows exist in the database
  - Fetches team names separately via TeamMember (avoiding Prisma relation issues)
  - Supports userId param to check isFollowing status
  - Returns: rank, userId, name, avatar, playerCode, gender, position, overallRating, totalPoints, totalMatches, raidPoints, tacklePoints, followerCount, teamNames, isFollowing
- Created PopularPlayersSection component (src/components/kabaddi/PopularPlayersSection.tsx):
  - Horizontal scrollable player cards on home screen (between Leaderboard and Explore)
  - Each card shows: rank badge (animated crown for #1, silver/bronze for #2-3), avatar, name, position badge (R/D/AR), team name
  - Stats row: total points (⚡ brand-teal), overall rating (⭐ amber), matches (🏆 warm)
  - Follow/Following toggle button with POST /api/follow API integration
  - Loading skeleton with pulse animation while fetching
  - Animated card entrance with staggered spring delays
  - Rank-specific card styling: gold gradient (#1), silver (#2), bronze (#3)
  - Follower count display next to rank badge
- Integrated into HomeTab.tsx after Leaderboard Preview section (line ~2536)
- Added i18n translation: home.popularPlayers (en: 'Popular Players', hi: 'लोकप्रिय खिलाड़ी')
- Fixed Prisma query error: Used 'teams' instead of 'teamMembers' for User relation, and separate TeamMember queries instead of nested includes with isNotNull
- Tested with agent-browser: Section renders correctly, Follow button toggles to Following, API returns 200

Stage Summary:
- New "Popular Players" section on home screen with horizontal scrollable cards
- Players ranked by composite popularity score (follower count + total points)
- Each card has: avatar, name, position badge, team name, stats (points/rating/matches), follow button
- Follow/unfollow toggle works via existing /api/follow endpoint
- Fallback shows top-scoring players when no follows exist yet

---
Task ID: 9
Agent: Main Agent
Task: Add image crop option while uploading profile image

Work Log:
- Installed react-easy-crop (v6.0.2) for client-side image cropping
- Created ImageCropDialog component (/src/components/kabaddi/ImageCropDialog.tsx):
  - Uses react-easy-crop with circular crop mask (perfect for profile pics)
  - Zoom slider (1x-3x) with +/- buttons and percentage display
  - Reset button to restore default crop position/zoom
  - Premium UI: animated modal with brand-red gradient header, spring animations
  - getCroppedImg helper: draws cropped area to canvas, outputs JPEG at 512x512 max
  - Apply button with loading spinner, Cancel and Reset actions
- Created /api/upload POST route (/src/app/api/upload/route.ts):
  - CRITICAL FIX: This endpoint was missing! ProfileTab was POSTing to /api/upload but getting 404
  - Supports both JSON (base64) and FormData uploads
  - Saves files to public/uploads/avatars/ or public/uploads/teams/ based on folder param
  - Generates unique filenames (timestamp + random suffix)
  - Validates file type (JPEG, PNG, WebP, GIF) and size (5MB max)
  - Returns { url: "/api/uploads/avatars/{filename}" }
- Modified ProfileTab.tsx upload flow:
  - handleFileChange: Now reads file and opens crop dialog instead of uploading directly
  - handleCropComplete: Receives cropped base64 data, uploads it, updates avatar
  - handleCropCancel: Closes crop dialog, resets file input
  - Added cropImageSrc state for crop dialog visibility
  - Added ImageCropDialog import and render in JSX
- Added i18n translation: profile.cropPhoto (en: 'Crop Photo', hi: 'फ़ोटो क्रॉप करें')
- All lint checks pass, no dev server errors
- Pushed to GitHub for auto-deploy

Stage Summary:
- Profile image upload now shows a crop dialog before uploading
- Users can drag to reposition, zoom in/out, and apply crop
- Circular crop mask matches the circular avatar display
- Also fixed the missing /api/upload POST endpoint that was causing 404 errors on avatar upload

---
Task ID: 8
Agent: Main Agent
Task: Remove Smart Match tab and AI Team Suggestions feature

Work Log:
- Removed SmartTeamSuggestionsScreen import from HomeTab.tsx (line 109)
- Removed showTeamSuggestions state variable (line 643)
- Removed SmartTeamSuggestionsScreen render block (lines 1270-1272)
- Removed Smart Match feature card from Discover & Learn section (lines 2954-2969) - the violet/violet card with Wand2 icon
- Removed Wand2 icon import from lucide-react (only used by Smart Match card)
- Verified with agent-browser: "Smart Match" and "AI team suggestions" text no longer appear on the page
- Verified other Discover features still intact (Tournament Map, Rules Quiz, etc.)
- Note: "Smart analysis" text still exists - this is from the AI Insights feature, not Smart Match
- Lint passes clean
- Pushed to GitHub for auto-deploy

Stage Summary:
- Smart Match / AI Team Suggestions feature completely removed from UI
- SmartTeamSuggestionsScreen.tsx and /api/team-suggestions/route.ts still exist but are no longer referenced
- Discover & Learn section now has 9 cards instead of 10
- All other features remain intact

---
Task ID: 7
Agent: Main Agent
Task: Add Total Players primary tab with animated counter showing total signup numbers

Work Log:
- Created /api/total-players endpoint: Returns totalPlayers, totalCoaches, totalActivePlayers, recentSignups (7 days), todaySignups, latestSignup (name/role/createdAt)
- Created TotalPlayersBanner.tsx component with premium animations:
  - RollNumber: Animated counter with ease-out cubic effect, scales up while animating
  - FloatingParticles: 12 floating particles with random positions, sizes, and color variations (white/gold/red)
  - PulseRing: 3 expanding concentric rings from center behind the main number
  - StatMiniCard: Expandable stat cards with hover effects
  - Main banner layout: Header with Users icon + LIVE badge → Big animated number → Quick stats row (Today/This Week/Coaches) → Latest signup ticker → Expand/collapse chevron
  - Expanded details: Active Players count, This Week stat, Weekly Growth progress bar
  - Decorative: Court line patterns, shimmer overlays, background circles
- Integrated TotalPlayersBanner into HomeTab.tsx after the greeting section, before the Quick Stats Banner
- Added i18n translations: playersSignedUp, today, thisWeek, coaches, activePlayers, weeklyGrowth, community (en/hi)
- Verified with agent-browser: Banner renders correctly with all data (54 total players, 1 today, 54 this week, 3 coaches, latest signup shown)
- Verified with VLM: "visually striking, professional, clean hierarchy" - bold red gradient, high contrast, structured layout
- All lint checks pass clean
- Pushed to GitHub for auto-deploy

Stage Summary:
- New prominent "Total Players" banner is the first thing users see on the home page
- Shows total signup count with smooth animated counter (0→54 in 2 seconds)
- Displays live community metrics: today's signups, weekly growth, coach count
- Latest signup ticker shows most recent player join in real-time
- Expandable section reveals deeper stats with growth bar visualization
- API: /api/total-players (6 metrics from User/PlayerProfile tables)

---
Task ID: 6
Agent: Main Agent
Task: Transform "Find Teams" into "Teams & Grounds" — add Grounds tab since team location is ground location

Work Log:
- Completely rewrote FindTeamsScreen.tsx to include two tabs: "Teams" and "Grounds"
- Created /api/nearby-grounds route: GPS-based ground discovery using Haversine distance, returns ground name/address/city/surface/amenities/matchCount/distance
- Updated /api/nearby-teams route: Added groundName field to team distance map and API response (when team was found via a ground venue)
- Grounds tab shows: name, address, city, surface type badges (Mat/Mud/Grass/Synthetic with color coding), amenities (Lights/Changing Room/Seating/Parking with icons), match count, distance
- Teams tab now shows ground name when team was found via a ground venue (since team location = ground location)
- Updated HomeTab feature card: "Find Teams" → "Teams & Grounds" with subtitle "Nearby teams & venues"
- Updated i18n translations: title "Teams & Grounds" / "टीमें और मैदान", subtitle, added noGrounds key
- Verified with agent-browser + VLM: Both tabs work correctly, active tab styling changes (red for Teams, gold for Grounds), empty states display correctly
- All lint checks pass, no dev server errors
- Pushed to GitHub for auto-deploy

Stage Summary:
- "Find Teams" is now "Teams & Grounds" with a tab-based UI
- Teams tab: Shows nearby teams with ground name (when available), member count, join button
- Grounds tab: Shows nearby grounds/venues with surface type, amenities, match count
- New API: /api/nearby-grounds for GPS-based ground discovery
- Updated API: /api/nearby-teams now returns groundName field
- Team location = ground location concept is reflected in the UI (ground name shown on team cards)

---
Task ID: 5
Agent: Main Agent
Task: Remove "Find Kabaddi Player in Area" feature and fix all feature tabs to open as top overlay instead of at end of page

Work Log:
- Removed FindPlayersScreen import from HomeTab.tsx
- Removed showFindPlayers state variable from HomeTab.tsx
- Removed FindPlayersScreen rendering from Portal section in HomeTab.tsx
- Removed "Find Players" feature card from "Discover & Learn" grid in HomeTab.tsx
- Updated animation delays for remaining Discover & Learn cards (shifted down by 0.05s each)
- Fixed 9 screen components to use `fixed inset-0 z-50` instead of `min-h-screen` for proper overlay behavior:
  - FindTeamsScreen.tsx: min-h-screen → fixed inset-0 z-50 overflow-y-auto
  - TournamentMapScreen.tsx: min-h-screen → fixed inset-0 z-50 overflow-y-auto
  - SmartTeamSuggestionsScreen.tsx: min-h-screen → fixed inset-0 z-50 overflow-y-auto
  - PlayerWinRateScreen.tsx: min-h-screen → fixed inset-0 z-50 overflow-y-auto
  - RulesQuizScreen.tsx: min-h-screen → fixed inset-0 z-50 overflow-y-auto
  - TechniqueTutorialsScreen.tsx: min-h-screen → fixed inset-0 z-50 overflow-y-auto
  - PercentileRankingsScreen.tsx: min-h-screen → fixed inset-0 z-50 overflow-y-auto
  - LeaderboardSeasonsScreen.tsx: min-h-screen → fixed inset-0 z-50 overflow-y-auto
  - ScorecardPDFScreen.tsx: min-h-screen → fixed inset-0 z-50 overflow-y-auto
- Verified with agent-browser: Find Players card is gone, Find Teams opens as full-screen overlay at top
- Tested Rules Quiz overlay - opens correctly as top overlay
- All lint checks pass clean, no dev server errors
- Pushed to GitHub for auto-deploy to Vercel

Stage Summary:
- "Find Players in Area" feature completely removed (card, state, import, rendering)
- All 9 feature screens that used `min-h-screen` now use `fixed inset-0 z-50 overflow-y-auto`
- This means all feature tabs now open as full-screen overlays at the TOP of the page, covering the main content
- Previously, these tabs would render inline at the BOTTOM of the page, which was confusing
- The FindTeamsScreen, TournamentMapScreen, and other screens now behave consistently with LeaderboardScreen, AchievementsScreen, etc.

---
Task ID: 1
Agent: Main Agent
Task: Add weight categories feature (Open/Weight with manual entry)

Work Log:
- Explored full codebase to understand match/tournament data flow and existing weight category implementation
- Updated QuickScoreTab: Replaced 6-option weight category grid with 2-option (Open/Weight) + manual text input
- Updated TournamentsTab: Replaced 6-option weight category grid with 2-option (Open/Weight) + manual text input
- Updated LiveScoringScreen: Added weightCategory to match save API call + fixed display to show "Open" label
- Updated HomeTab: Added weightCategory to LiveMatch, CompletedMatch, UpcomingMatch interfaces + added weight category badges on all match cards (live, recent, upcoming)
- Updated MatchDetailsScreen: Added weightCategory to MatchData interface + added Weight Category display section
- Updated ShareScorecard: Added weightCategory to props + display in score header and footer section
- Updated MatchHistoryScreen: Added weightCategory to match interface + display badge on match cards
- Updated stats API: Added weightCategory field to live, recent, and upcoming match responses
- Updated i18n translations: Replaced old weight category translations with new Open/Weight/manual entry translations
- Updated OnboardingWizard: Replaced 5 weight options with 2-option (Open/Weight) + manual input
- Updated ProfileTab: Replaced weight category selector + display with Open/Weight options + manual input
- Updated store.ts: Changed OnboardingWeightCategory type from union to string (flexible for manual entry)
- Updated Prisma schema comments: Updated weightCategory field descriptions
- Tested with agent-browser: Verified Quick Score, Tournaments, Onboarding screens all render correctly

Stage Summary:
- Weight category now has only 2 options: "Open" (no restriction) or "Weight" (manually entered)
- Whatever is entered manually is stored as-is (e.g. "65kg", "70kg", "Below 80kg")
- Weight category displays on: match feed, recent results, upcoming matches, match details, scorecard, match history
- All existing old weight category values (below-60, 60-70, etc.) have been removed from the UI
- Schema and API support any string value for weightCategory

---
Task ID: 2-a
Agent: Main Agent
Task: Create 6 new screen components and their corresponding API routes for match-related features

Work Log:
- Created LiveScoreTVMode.tsx: Fullscreen TV mode with big scores, live timer, team colors, pulse LIVE indicator, auto-refresh
- Created RaidTimelineScreen.tsx: Raid-by-raid timeline with colored blocks, expandable details, running score, half filter, horizontal strip
- Created HeadToHeadScreen.tsx: H2H record with wins/draws/losses, percentage bar, past match results
- Created MatchCommentsScreen.tsx: Spectator comments with avatars, input field, auto-scroll, login check
- Created MatchPhotoGalleryScreen.tsx: Photo grid with upload, lightbox, keyboard nav, caption overlay
- Created MatchReportScreen.tsx: AI-generated match report with markdown rendering, loading skeleton, regenerate
- Created /api/head-to-head route: GET with homeTeamId/awayTeamId, returns H2H stats and match results
- Created /api/match-comments route: GET (list) and POST (create) for match comments
- Created /api/match-photos route: GET (list) and POST (create) for match photos
- Created /api/match-report route: POST generates AI report using z-ai-web-dev-sdk LLM
- Added i18n translations for all 6 features (en/hi)
- All lint checks pass clean

Stage Summary:
- 6 new screen components created following existing patterns (use client, framer-motion, shadcn/ui, warm colors, dark mode, i18n)
- 4 new API routes created (head-to-head, match-comments, match-photos, match-report)
- All components use proper Props pattern with onBack callback
- Match report uses z-ai-web-dev-sdk for AI generation
- i18n support added for all new features in both English and Hindi

---
Task ID: 2-b
Agent: Main Agent
Task: Create 5 new screen components and their corresponding API routes for discovery and community features

Work Log:
- Created FindPlayersScreen.tsx (Feature #63): GPS-based player discovery with position filter (Raider/Defender/All-Rounder), radius filter (1-50km), "Save My Location" button, player cards with avatar/name/position/distance/weight category, loading skeletons
- Created /api/nearby-players route: GET with lat/lng/radius/position/excludeUserId params, queries PlayerLocation + User + PlayerProfile tables, Haversine formula for distance calculation, sorted by nearest first
- Created /api/player-location route: POST to save/update user's GPS location in PlayerLocation table (upsert)
- Created FindTeamsScreen.tsx (Feature #64): Nearby team discovery with radius filter, team cards with logo/name/shortName/member count/distance, "Join Team" button using existing team join API
- Created /api/nearby-teams route: GET with lat/lng/radius/excludeUserId, uses dual strategy (team members' PlayerLocation + Ground-based matches), excludes teams user is already in
- Created TournamentMapScreen.tsx (Feature #67): Tournament discovery with list/grid view toggle, status filter (All/Upcoming/Ongoing), radius filter (5-100km), tournament cards with name/status/venue/date/team count/distance, type/gender/weight category badges
- Created /api/nearby-tournaments route: GET with lat/lng/radius/status, queries Tournament + Ground tables, cross-references venue text to known grounds, Haversine distance calculation
- Created SmartTeamSuggestionsScreen.tsx (Feature #68): AI-powered team recommendations with match reasons (Needs a Raider, Near your location, Similar skill level, Looking for players), match score bar, Top Pick badge, expandable reason cards, Join/View buttons
- Created /api/team-suggestions route: GET with userId, analyzes user profile + position + location, matches against teams needing that position, scores based on position need + proximity + skill level + team size, returns sorted suggestions with reasons
- Created PlayerWinRateScreen.tsx (Feature #11): Player win/loss record against each team, overall summary card with wins/losses/draws/win rate bar, per-team rows with visual win rate bar (green/gray/red), expandable detail with stats breakdown, sort options (Most Played/Highest Win%/Most Losses)
- Created /api/player-win-rate route: GET with playerId, queries Match table for completed matches where player's team participated, groups by opposing team, calculates win/loss/draw stats and percentages, returns sorted results
- Added i18n translations for all 5 features (en/hi): findPlayers.*, findTeams.*, tournamentMap.*, teamSuggestions.*, winRate.*
- All components follow existing patterns: 'use client', framer-motion animations, shadcn/ui components, warm/brand color palette, dark mode support, responsive design, loading skeletons

Stage Summary:
- 5 new screen components created in /src/components/kabaddi/
- 6 new API routes created in /src/app/api/ (nearby-players, player-location, nearby-teams, nearby-tournaments, team-suggestions, player-win-rate)
- Haversine formula used for distance calculations across all proximity-based APIs
- All screens support GPS geolocation via browser API
- FindPlayersScreen has "Save My Location" feature that upserts to PlayerLocation table
- FindTeamsScreen uses dual discovery strategy (member locations + ground matches)
- TournamentMapScreen supports both list and grid view modes
- SmartTeamSuggestionsScreen uses scoring algorithm with position need, proximity, skill level, and team size factors
- PlayerWinRateScreen has expandable team rows with visual win rate bars and sort options
- Full i18n support (English + Hindi) for all new features

---
Task ID: 2-c
Agent: Main Agent
Task: Create 5 new screen components and their corresponding API routes for learning, stats, and utility features

Work Log:
- Created RulesQuizScreen.tsx (Feature #41): Kabaddi Rules Quiz with XP rewards — category selector (Rules/Technique/Strategy), 10 multiple-choice questions per quiz, 15-second timer per question, animated progress bar, score display with XP earned (10 XP per correct answer), answer review with explanations, Play Again button, uses /api/quiz
- Created /api/quiz route: GET (get questions by category — 50+ hardcoded questions covering kabaddi rules, techniques, strategies) with random selection of 10, POST (submit answers, calculate score, store QuizAttempt in DB, return XP earned + results with explanations)
- Created TechniqueTutorialsScreen.tsx (Feature #42): Technique tutorials with step-by-step guides — 3 category tabs (Raiding/Defense/All-Round), expandable tutorial cards with numbered step lists and icons, difficulty badges (Beginner/Intermediate/Advanced), 14 tutorials covering: toe touch, hand touch, scorpion kick, frog jump, running hand touch, bonus point technique, ankle hold, back hold, dash, chain tackle, diving ankle hold, crocodile hold, court awareness, fitness basics, game intelligence, mental toughness — all content hardcoded, no API needed
- Created PercentileRankingsScreen.tsx (Feature #20): Comparative percentile rankings — overall percentile badge with gradient card, 5 stat cards (Raid Points, Tackle Points, Total Points, Success Rate, Super Tackles) each showing value + percentile + visual bar, "How You Compare" distribution chart with YOU marker, info card explaining percentiles, uses /api/percentile-rankings
- Created /api/percentile-rankings route: GET with userId param, fetches user's PlayerProfile stats, compares against all players with matches > 0, calculates percentile for each stat, computes overall percentile, generates distribution buckets for chart
- Created LeaderboardSeasonsScreen.tsx (Feature #51): Leaderboard with monthly seasons — season info card with days remaining + live indicator, season selector dropdown, leaderboard table (rank/player/points/raids/tackles/matches), current user highlight, rank badges (crown/medal/numbers), stats summary footer, uses /api/leaderboard-seasons
- Created /api/leaderboard-seasons route: GET with optional seasonId, auto-creates current month's season if none exists, returns season info + entries sorted by totalPoints + list of all past seasons for selector
- Created ScorecardPDFScreen.tsx (Feature #72): Scorecard PDF Download — match scorecard preview with score header (team names/scores/half scores), events summary table, top performers list, match details, Download as PDF button that opens a print-optimized HTML page in new window with window.print(), uses /api/scorecard-pdf
- Created /api/scorecard-pdf route: GET with matchId param, fetches match + teams + events + scorers, calculates half scores from events, aggregates top performers by player points, builds complete scorecard data object
- All lint checks pass clean

Stage Summary:
- 5 new screen components created in /src/components/kabaddi/
- 4 new API routes created in /src/app/api/ (quiz, percentile-rankings, leaderboard-seasons, scorecard-pdf)
- Quiz system has 50+ hardcoded questions across 3 categories, stores attempts in QuizAttempt model
- Technique tutorials has 14 tutorials with step-by-step guides, all content hardcoded (no API needed)
- Percentile rankings calculates real percentiles by comparing user stats against all players
- Leaderboard seasons auto-creates monthly seasons and supports season selection
- Scorecard PDF uses browser print-to-PDF with professionally styled HTML template
- All components follow existing patterns: 'use client', framer-motion animations, shadcn/ui, warm/brand colors, dark mode, responsive design, loading skeletons

---
Task ID: 3
Agent: Main Agent
Task: Wire 16 new feature screen components into HomeTab.tsx

Work Log:
- Added 16 component imports to HomeTab.tsx: LiveScoreTVMode, RaidTimelineScreen, HeadToHeadScreen, MatchCommentsScreen, MatchPhotoGalleryScreen, MatchReportScreen, FindPlayersScreen, FindTeamsScreen, TournamentMapScreen, SmartTeamSuggestionsScreen, PlayerWinRateScreen, RulesQuizScreen, TechniqueTutorialsScreen, PercentileRankingsScreen, LeaderboardSeasonsScreen, ScorecardPDFScreen
- Added 13 new lucide-react icon imports: Monitor, GitBranch, MessageSquare, Camera, FileText, Navigation, Map, Wand2, BarChart2, HelpCircle, Percent, CalendarRange, FileDown
- Added 24 new state variables for all 16 screens, including match/team ID states for match-specific screens (TVMode, RaidTimeline, HeadToHead, Comments, Photos, Report, ScorecardPDF)
- Added 16 screen renders inside the Portal wrapper, before closing </Portal> tag, with proper show/hide logic and onBack callbacks
- Added "Discover & Learn" feature cards section with NEW badge, containing 10 cards: Find Players, Find Teams, Tournament Map, Smart Match, Rules Quiz, Tutorials, Percentile Rank, Win Rate, Season Leaderboard, TV Mode
- Added match-specific action buttons to recent match cards, replacing the single Share button with a row of 7 action buttons: Raid Timeline, Head to Head, Comments, Photos, Match Report, Scorecard PDF, Share Scorecard
- TV Mode card auto-selects first live match or first recent match, shows toast if no matches available
- All lint checks pass clean

Stage Summary:
- All 16 feature screens are now accessible from the HomeTab
- 10 screens accessible via Discover & Learn section (Find Players, Find Teams, Tournament Map, Smart Match, Rules Quiz, Tutorials, Percentile Rank, Win Rate, Season Leaderboard, TV Mode)
- 6 screens accessible via match card action buttons (Raid Timeline, Head to Head, Comments, Photos, Match Report, Scorecard PDF)
- Match action buttons appear on each recent match card with distinct icons and colors
- All screens use proper show/hide state management with match/team ID tracking
- Consistent card styling follows existing patterns (motion.div, gradient backgrounds, hover effects)

---
Task ID: 4
Agent: Main Agent
Task: Remove bell icon from HomeTab + Add Feature #2 (Live Stream URL) + Final integration

Work Log:
- Removed bell icon notification button from HomeTab header (lines 1249-1269)
- Removed BellOff import (no longer used), kept Bell import (used for "Set Reminder" button on upcoming matches)
- Added liveStreamUrl field to Prisma Match model + ran db:push
- Added liveStreamUrl to MatchConfig interface in QuickScoreTab
- Added Live Stream URL input to Settings step (step 2) in QuickScoreTab with Radio icon, URL input, confirmation message
- Added Radio import to QuickScoreTab
- Added liveStreamUrl to ActiveMatch interface in store.ts
- Added liveStreamUrl to initiateToss call in QuickScoreTab
- Added liveStreamUrl to match save payload in LiveScoringScreen (POST /api/matches)
- Added liveStreamUrl to matches API route (POST handler)
- Added liveStreamUrl to stats API response for all match types
- Added "Watch Live" button with Radio icon in LiveScoringScreen header when liveStreamUrl is present
- Added Radio import to LiveScoringScreen
- Added new Prisma models: MatchComment, MatchPhoto, QuizAttempt, PlayerLocation, LeaderboardSeason, LeaderboardSeasonEntry
- Added back-relations to User model for new models
- Added comprehensive i18n translations for all 17 new features (English + Hindi)
- All lint checks pass clean
- Dev server running without errors

Stage Summary:
- Bell icon removed from HomeTab header as requested
- 17 features fully implemented:
  - #2: YouTube/Twitch Live Stream URL (match setup → live scoring display)
  - #3: Live Score TV/Projector Mode (fullscreen display)
  - #6: Raid-by-Raid Timeline (visual raid strip)
  - #10: Head-to-Head Record (team H2H stats)
  - #11: Player Win Rate vs Specific Teams
  - #20: Comparative Percentile Rankings
  - #28: Comments on Matches (spectator chat)
  - #34: Match Photo Gallery (upload & view)
  - #41: Kabaddi Rules Quiz with XP
  - #42: Technique Tutorials (14 step-by-step guides)
  - #51: Leaderboard Seasons (monthly reset)
  - #61: Auto-Generated Match Reports (AI-powered)
  - #63: Find Players Nearby (GPS discovery)
  - #64: Find Teams Nearby
  - #67: Tournament Discovery Map
  - #68: Smart Team Suggestions (AI-powered)
  - #72: Scorecard PDF Download
- 16 new screen components created
- 14 new API routes created
- 6 new Prisma models added
- "Discover & Learn" section added to HomeTab with 10 feature cards
- Match action buttons added to recent match cards for 6 match-specific features
- Full i18n support (English + Hindi) for all new features

---
Task ID: 12
Agent: Main Agent
Task: Remove player level system and coach weight/position fields; extend player profile accessibility

Work Log:
- Removed player level system (beginner/intermediate/advanced/legend):
  - Removed `getPlayerLevel()` function from ProfileTab.tsx
  - Removed `OnboardingExperience` type from store.ts
  - Removed `experienceLevel` from `CurrentUser` interface in store.ts
  - Removed `experience` from `OnboardingProfile` interface in store.ts
  - Removed `completeOnboarding` mapping of `experienceLevel` in store.ts
  - Removed `EXPERIENCE_OPTIONS` array from OnboardingWizard.tsx
  - Removed `CircleDot` import from OnboardingWizard.tsx
  - Removed Experience Level selection UI from ProfileStep in OnboardingWizard.tsx
  - Removed Experience row from profile summary in CompleteStep
  - Updated ProfileStep props to remove experience type
  - Updated handleLocalProfileChange to remove experience type
  - Removed level badge, progress bar, and SVG ring from ProfileTab.tsx banner
  - Removed level badge below avatar in ProfileTab.tsx
  - Removed calculatedLevel/experienceMap/selfReportedLevel/playerLevel variables

- Removed weight/position/jersey fields for coaches:
  - Wrapped Gender, Weight, Jersey Number, Position edit form fields with `currentUser?.role !== 'coach'` check
  - Wrapped Weight display in banner with coach check
  - Wrapped Position badge in banner with coach check
  - Wrapped Jersey badge in Badges Row with coach check
  - Wrapped Weight/Position/Jersey display rows in profile info section with coach check
  - Note: AuthScreen already had `!isCoach` conditionals for weight/position during signup
  - Note: OnboardingWizard is already skipped for coaches (auto-complete in page.tsx)

- Extended player profile accessibility:
  - Added `onViewPlayer` prop to MatchDetailsScreen.tsx
  - Made MOTM name, event timeline player names, top raiders, top defenders clickable
  - Added `onViewPlayer` prop to GlobalSearchScreen.tsx
  - Made search result player entries clickable
  - Connected both screens to `openPlayerProfile` in HomeTab.tsx

Stage Summary:
- Player level system completely removed from all UI and state management
- Coach accounts no longer see or can edit weight/position/jersey fields
- Player profiles now accessible from: Popular Players, Leaderboard (preview + full), Match Details, Global Search, Awards
- Premium gating for full stats already implemented in PlayerProfileScreen
- All changes verified with linter (no errors) and agent browser (onboarding shows no level, profile has no level badge)
