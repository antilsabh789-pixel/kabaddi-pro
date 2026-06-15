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

---
Task ID: 2
Agent: Main Agent
Task: Redesign LiveScoringScreen players to rectangular cards matching reference image + remove tie/court lines from center divider

Work Log:
- Analyzed reference image: rectangular player cards with avatar left, jersey#/name/position right, team-colored backgrounds
- Replaced PlayerCircle component with PlayerCard component in LiveScoringScreen.tsx
- PlayerCard design: rectangular card with left color border, circular avatar on left, jersey number + name + captain label on right
- Changed onCourt layout from 2-column grid of circles to single-column list of rectangular cards
- Removed court lines pattern (center line, baulk lines, center circle) from center divider between teams
- Center divider now shows only: turn arrow indicator, do-or-die flame, timer, half indicator
- Substitutes also use small PlayerCard variant
- All 6 references to PlayerCircle updated to PlayerCard
- Verified lint passes and dev server has no errors

Stage Summary:
- LiveScoringScreen players now shown as rectangular cards matching reference design
- Each card has: circular avatar, jersey number (#XX), player name, captain/position label, raid/tackle stat badges
- Cards have team-colored left border and team-tinted background
- Court line "tie" pattern removed from center divider
- Layout is cleaner with vertical card lists per team side

---
Task ID: 3
Agent: Main Agent
Task: Remove center timer display and close gap between teams during live scoring

Work Log:
- Identified the center divider section in LiveScoringScreen.tsx (lines 2448-2492)
- The center divider was a w-[52px] column containing: turn arrow indicator, do-or-die flame, timer display, and half indicator
- Replaced the entire 52px center divider with a thin 2px gradient line between the two team panels
- The thin divider uses a gradient from home team color to away team color for visual continuity
- Timer was already displayed in the compact top info bar, so no information is lost
- Verified lint passes cleanly
- Verified via agent-browser: center timer removed, teams joined with thin line, no time in center

Stage Summary:
- Center timer/divider completely removed from between team panels during scoring
- Teams now sit side-by-side with only a 2px gradient divider line
- More horizontal space for each team panel (gained ~50px)
- Timer still available in the top info bar above the team panels

---
Task ID: 4
Agent: Main Agent
Task: Five major LiveScoringScreen improvements - substitute section, remove animations, timeout selector, add player ID/search, fix auto-pause timer

Work Log:
- Fixed auto-pause timer bug: raid gap timer useEffect had `raidGapTimer !== null` (boolean) as dependency instead of `raidGapTimer` (number), so when timer reached 0 the effect never re-ran to trigger setIsPaused(true)
- Removed all celebration animations from scorer screen: ConfettiParticle, AllOutCelebration, SuperRaidCelebration functions deleted; MatchEndCelebration→MatchEndScreen (no animations), HalfTimeTransition→HalfTimeScreen (no animations); overlay renders removed; state setters kept for viewer phone compatibility
- Added timeout type selector: pressing TIMEOUT button now shows dialog with Home Team, Away Team, and Official Timeout options; each shows used/total count; official timeout doesn't count against team totals; timeoutTeam type extended to include 'official'
- Redesigned substitute flow: changed from "tap on-court OUT first, then tap sub IN" to "tap sub IN first, then auto-ask which on-court player to take OUT"; renamed subOutPlayer→subInPlayer; new two-step overlay with clear instructions
- Enhanced add player: added ID/Player Code input field; added debounced auto-search (300ms) that queries /api/players by phone_code or name; search results filtered to current team; tap-to-auto-fill functionality; newPlayer uses playerCode and ID from search
- Moved search useEffect before early return to fix React hooks rules violation
- Verified all 5 features via agent-browser: no animations, timeout selector works, substitute flow works, add player has ID+search, auto-pause timer triggers after 5s

Stage Summary:
- Auto-pause timer now correctly pauses after 5 seconds of inactivity
- Scorer screen has NO celebration animations (all-out, super raid, confetti) — these will run on viewer's phone only
- Timeout now asks which team or if official timeout, with used/total counts displayed
- Substitute flow reversed: tap sub player first → then select who goes out
- Add player now has ID/Player Code field with auto-detect search from database

---
Task ID: 5
Agent: Main Agent
Task: Change player addition to phone-number-based system — phone + name required, one phone per player, links to account for match records

Work Log:
- Added `phone?: string` field to MatchPlayer interface in store.ts — phone is the primary identifier linking players to their accounts
- Replaced `addPlayerId` and `addPlayerJersey` state variables with `addPlayerPhone` in LiveScoringScreen.tsx
- Updated search useEffect to search by phone number first (via /api/players/search) instead of ID/player code
- Updated handleAddPlayer to require phone + name, check for duplicate phone numbers in squad, use existing user ID if found
- Redesigned Add Player modal: phone number input first (with tel type), name input second, help text explaining phone links player to account
- Created /api/players/search API endpoint: searches users by phone or name, returns player info with phone, jersey number, team membership
- Fixed SQLite compatibility issue (removed mode: 'insensitive' from Prisma query)
- Updated /api/match-events to include phone in user select and formatPlayers output
- Updated MatchPlayerAPI interface in MatchDayExperience.tsx to include phone field
- Updated QuickScoreTab: addDbPlayer now includes phone number and checks for duplicate phone numbers in squad
- Updated QuickScoreTab: addQuickPlayer now detects phone number input, stores phone, uses phone-based ID format
- Updated search placeholder from "Search by phone or Player ID" to "Search by phone number or name"
- Updated "Quick add" button text and help text to emphasize phone number linking
- Verified all changes with agent-browser: phone search works, Add Player modal shows phone + name, no runtime errors

Stage Summary:
- Adding a player (both mid-match and pre-match) now requires phone number + name
- Phone number is the primary unique identifier — one phone number per player
- When phone matches existing user, auto-fills name and uses existing user ID
- When phone doesn't match, creates new player with phone-based ID (phone_<number>)
- When a player signs up with that phone number later, they can see their match records
- API endpoint /api/players/search supports both phone and name searches
- All player data flows now include phone numbers

---
Task ID: 6
Agent: Main Agent
Task: Redesign team setup flow — select your team from teams you're a member of, create team option, find opponent by team code with auto-fetch roster

Work Log:
- Created /api/teams/search API endpoint — searches teams by teamCode or name, returns full roster with members (phone, jersey, position, playerCode)
- Added new state variables: teamSetupPhase ('my-team'|'opponent'), opponentTeamCode, opponentSearchResults, isSearchingTeam, showCreateTeam, newTeamName/Color, isCreatingTeam, homeTeamRoster, awayTeamRoster
- Added debounced opponent search useEffect — searches /api/teams/search as user types team code
- Added selectMyTeam() — fetches team roster via /api/teams/{id}, auto-populates home lineup and playing 7
- Added selectOpponentTeam() — fetches opponent roster, auto-populates away lineup and playing 7
- Added handleCreateTeam() — creates new team via POST /api/teams, auto-selects as home team, moves to opponent phase
- Redesigned step 2 (Team Setup) with two phases:
  - Phase 1 ('my-team'): Shows user's teams as selectable cards, "Create New Team" button/form, "Skip" fallback
  - Phase 2 ('opponent'): Shows selected team indicator, VS divider, team code search input with results, opponent selected confirmation, manual entry fallback
- Updated handleStart to use real team IDs (homeTeamId/awayTeamId) instead of generated IDs
- Updated handlePrev to reset teamSetupPhase when going back
- Verified via agent-browser: create team → opponent search by team code (KT2005 found Jaipur Kings) → auto-populated 5 players → lineup step shows both teams

Stage Summary:
- Team setup now has a proper 2-phase flow: select YOUR team → find opponent by team code
- Teams the user is a member of are shown as selectable cards
- "Create New Team" form with name + color picker creates and auto-selects the team
- Opponent team code search auto-fetches full team roster from database
- Team roster auto-populates lineup and selects playing 7
- Real team IDs are used when starting a match (for linking to DB records)
- Manual entry fallback still available for both teams
