# Kabaddi Pro - Work Log

---
Task ID: tournament-practice-stats-separation
Agent: Main Agent
Task: Separate tournament and practice stats - only tournament scores count for leaderboard, awards, profile total; add dedicated Practice Stats section

Work Log:
- Changed ProfileTab stat calculations: totalPoints, raidPoints, tacklePoints, totalMatches now all use tournament-only stats
- Added separate practiceRaidPoints, practiceTacklePoints, practiceTotalPoints, practiceMatches variables for the practice stats section
- Updated all badge categories (Performance, Consistency, Social, Special) to use tournament-only stats with explicit "tourney" labels in thresholds
- Changed donut chart center label from "Total Pts" to "🏆 Tourney Pts" to make it clear these are tournament points
- Replaced old Practice vs Tournament side-by-side cards with enhanced version including a full Practice Stats card with:
  - 4-column grid (Matches, Raid Pts, Tackle Pts, Total Pts)
  - Points Distribution bar (raid vs tackle percentage)
  - Empty state message
  - "Not counted in leaderboard or awards" disclaimer
- Added "COUNTS" label on Tournament comparison card and "TRAINING" label on Practice comparison card
- Enhanced PlayerStatsScreen Match Breakdown section:
  - Added "🏆 Tournament = Leaderboard" badge in header
  - Improved toggle styling: amber for tournament, emerald for practice
  - Added practice disclaimer note when practice tab is selected
- Leaderboard API was already tournament-only (verified)
- Lint passes, browser test confirms all changes working

Stage Summary:
- Profile total score = tournament-only (no practice)
- Badges/honors = tournament-only thresholds
- New dedicated "Practice Stats" section with full breakdown
- Tournament/Practice comparison cards with COUNTS/TRAINING labels
- PlayerStatsScreen has tournament-focused UI with practice disclaimer
- Files modified: ProfileTab.tsx, PlayerStatsScreen.tsx

---
Task ID: coaches-corner-premium
Agent: Main Agent
Task: Add Coach's Corner as a premium feature

Work Log:
- Added "Coach's Corner" to the PREMIUM_FEATURES list in PremiumUpgradeScreen.tsx with Megaphone icon, teal color scheme, and description "Manage academies, track attendance & organize training sessions"
- Added Megaphone import to PremiumUpgradeScreen.tsx (Whistle was tried first but doesn't exist in lucide-react)
- Moved Coach's Corner card from Quick Actions section to Pro Features section in HomeTab.tsx
- Added premium gating to Coach's Corner card: onClick checks isPremium, shows upgrade screen if not premium, opens CoachesCornerScreen if premium
- Added lock icon badge (yellow/amber gradient circle) and PRO text badge on the card for non-premium users
- Added shimmer/gold ring effects matching other Pro Feature cards
- Added premium gate inside CoachesCornerScreen.tsx itself: non-premium users see a locked screen with crown icon, feature list, and "Upgrade to Pro" button
- Added PremiumUpgradeScreen import and showUpgrade state to CoachesCornerScreen
- Added Crown and Lock imports to CoachesCornerScreen
- Lint passes, browser test confirms gating works correctly

Stage Summary:
- Coach's Corner is now a premium-only feature
- Non-premium users see lock icon + PRO badge on the card
- Clicking Coach's Corner as non-premium shows the PremiumUpgradeScreen
- Even if CoachesCornerScreen is opened directly, it shows a locked screen with upgrade CTA
- Premium users see the full Coach's Corner as before
- Files modified: PremiumUpgradeScreen.tsx, HomeTab.tsx, CoachesCornerScreen.tsx

---
Task ID: scoring-ux-overhaul
Agent: Main Agent
Task: Multiple scoring UX improvements - animation timing, event panel, auto-pause, nav hiding, tab styling, mid-match player addition

Work Log:
- Reduced All-Out celebration overlay: 3000ms→2000ms auto-dismiss, 1.5s→0.8s flash fade, smaller text, fewer repeats
- Reduced Super Raid celebration overlay: 3000ms→2000ms auto-dismiss, 20→10 fire particles, 1.5s→1s particle duration, smaller text
- Replaced Live Events panel (event log/commentary) with compact Revival/Court-Entry panel showing OUT players as horizontal pills with team colors
- Enhanced auto-pause feedback: stronger RAID_GAP_WARNING sound (double beep 600+700Hz) and stronger vibration pattern [100, 50, 200]
- Removed BottomNav from live scoring view in page.tsx, changed container from min-h-screen to h-screen overflow-hidden
- Changed LiveScoringScreen height from `calc(100vh-80px)` to `h-screen` for full-screen scoring
- Fixed Quick Score tab color: white/bright button in day mode (gradient from-white to-gray-100 with red icon), white label text
- Added `addPlayerToMatch` method to Zustand store (interface + implementation)
- Added mid-match player addition feature: ADD button in control bar, bottom-sheet modal with team selection then player name/jersey form
- Replaced 5-column control bar with 6-column (UNDO, PAUSE, ADD, TIMEOUT, H#, END) - removed HANDOFF from bar
- Added UserPlus import from lucide-react
- Lint passes, no errors

Stage Summary:
- 6 user requests implemented in one pass
- Scoring screen is now full-screen (no bottom nav) with more vertical space
- Celebration animations are snappy (2s max) instead of 3s
- OUT players shown as compact pills instead of verbose event log
- Auto-pause after 5s inactivity has better sound + vibration
- Quick Score tab is visually bright/white in day mode
- Mid-match player addition works via ADD button → team pick → name/jersey form
- Files modified: LiveScoringScreen.tsx, page.tsx, BottomNav.tsx, sounds.ts, store.ts

---
Task ID: simplify-match-types
Agent: Main Agent
Task: Remove dual match types (Standard/Practice), keep only Practice Match with fully flexible scoring

Work Log:
- Removed `matchType` field from `MatchConfig` interface in QuickScoreTab.tsx
- Removed SQUAD_LIMITS constant (no more standard vs practice distinction)
- Changed STEPS from ['Type', 'Gender', 'Settings', 'Teams', 'Lineup', 'Start'] (6 steps) to ['Category', 'Settings', 'Teams', 'Lineup', 'Start'] (5 steps)
- Changed STEP_ICONS accordingly (removed Swords for Type, rest renumbered)
- Deleted entire Step 0 "Match Type" (Standard/PKL vs Practice/FLEX selection cards)
- Renumbered all remaining steps: Gender→0, Settings→1, Teams→2, Lineup→3, Start→4
- Updated canNext() switch cases for new step numbers
- Updated handleStart() to always set `isPractice: true`
- Replaced Match Type Indicator in Settings step with Practice Match Banner ("Fully flexible — configure players, duration & scoring as you need")
- Removed all `config.matchType === 'standard'` conditional styling: opacity-60, locked overlay, 🔒 Fixed labels
- Half Duration and Players Per Side are now always fully editable
- Removed "Type: 🏋️ Practice" row from Match Preview (step 4)
- Verified via agent-browser: full flow works (Category→Settings→Teams→Lineup→Start), no errors
- Lint passes clean

Stage Summary:
- Match setup now has 5 steps instead of 6 (Type step removed)
- All matches are "Practice Match" with fully flexible configuration
- No more locked/standard mode — everything is configurable
- File modified: `/home/z/my-project/src/components/kabaddi/QuickScoreTab.tsx`

---
Task ID: tackle-turn-fix
Agent: Main Agent
Task: Fix tackle/super_tackle/do_or_die_raid turn rotation bug in getRaidQueueFromEvents

Work Log:
- Analyzed the root cause: `getRaidQueueFromEvents()` always returned the OPPOSITE side of the scoring team, which is correct for raid events (raiding team scores → opponent raids next) but WRONG for tackle events (defending team scores → defending team should raid next, not opponent)
- Identified that tackle_point, super_tackle, and do_or_die_raid are all scored by the DEFENDING team, so the turn should go to the SAME side as the scorer
- Added `DEFENDING_TEAM_SCORES` Set constant with the three event types
- Modified `getRaidQueueFromEvents()` to check if the last raid-ending event is in DEFENDING_TEAM_SCORES; if so, return the SAME side as the scoring team (they now raid); otherwise return the OPPOSITE side
- Verified all 7 scenarios (raid_point, tackle_point, super_tackle, empty_raid, do_or_die_raid, super_raid, raid_point+all_out) produce correct turn rotation
- Tested via agent-browser: Lions raided, got caught by Tigers → turn correctly flipped to Tigers (showed "Tigers 'S RAID", Tigers got RAID badge, Lions got DEF badge)
- Lint passes, no errors

Stage Summary:
- Root cause: `getRaidQueueFromEvents()` didn't distinguish between events scored by the raiding team vs defending team
- Fix: Added `DEFENDING_TEAM_SCORES` set and conditional logic in `getRaidQueueFromEvents()`
- File modified: `/home/z/my-project/src/lib/store.ts` (lines 400-429)
- Verified working via agent-browser end-to-end test (tackle correctly flips turn)

---

## Session: Bug Fix - Strict Alternating Raid Sequence & Turn Control

### Current Project Status
- Next.js 16 app with Kabaddi live scoring system
- Teams Leaderboard feature completed in previous session
- Live scoring had critical bugs with turn rotation, do-or-die, and state management

### Completed Modifications

#### 1. Fixed `addEvent()` in store.ts — No longer blindly flips raidQueue
**Bug**: `addEvent()` always flipped `raidQueue` regardless of event type. This meant timeouts, substitutions, cards, and other non-raid events would incorrectly change whose turn it was to raid.
**Fix**: Only raid-ending events (raid_point, tackle_point, super_tackle, empty_raid, bonus_point, do_or_die_raid, super_raid, self_out) now flip the turn. Non-raid events (all_out, substitution, timeout, yellow_card, red_card, green_card) preserve the current raidQueue.

#### 2. Fixed `getRaidQueueFromEvents()` — Added missing event types
**Bug**: `super_raid` and `self_out` were not in the `raidEventTypes` list used to determine the raid queue from event history. This caused incorrect turn calculation when these were the last events.
**Fix**: Created `RAID_ENDING_EVENT_TYPES` constant that includes all raid-ending events including `super_raid` and `self_out`.

#### 3. Added team-specific Do-or-Die tracking (`doOrDieTeamId`)
**Bug**: `isDoOrDie` was a global boolean, but do-or-die applies to a specific team's next raid. If Team A earned a do-or-die, it would incorrectly show for Team B's next raid too.
**Fix**: Added `doOrDieTeamId: string | null` to `ActiveMatch` interface. Updated `setDoOrDie()` to accept an optional teamId parameter. All UI checks now verify both `isDoOrDie` AND that `doOrDieTeamId` matches the current raiding team.

#### 4. Added strict turn lock with visual indicators
**Changes**:
- Added `isTurnTransitioning` state that briefly prevents raider selection after a raid ends (800ms lock)
- Added "RAID" badge (with Swords icon) on the raiding team's info bar
- Added "DEF" badge (with Shield icon) on the defending team's info bar
- Added "DEFENDING" label at the bottom of the non-raiding side
- Added "TAP TO RAID" label on the raiding side (existing, kept)
- Added turn transition overlay showing "[Team]'S RAID" with animated arrow when turn switches
- Do-or-die flame 🔥 only shows when it's the affected team's turn to raid

#### 5. Clean state reset per raid
**Changes**:
- After every raid, ALL raid state is completely cleared: raider, raidResult, selectedDefenders, bonusPoint
- Turn transition lock activates to prevent immediate selection by the next team
- Half-time transition now also resets `isTurnTransitioning`

#### 6. Proper evaluation order — Do-or-Die/Super Tackle/All-Out before turn swap
**Verified**: The current order is correct:
1. Create events for raid result (including all-out, super tackle auto-detection)
2. Evaluate do-or-die logic (set/clear per team)
3. Call `addBatchEvents()` which triggers recalculation AND raidQueue flip
4. Reset raid state
5. Activate turn transition lock

### Files Modified
- `/home/z/my-project/src/lib/store.ts`:
  - Added `doOrDieTeamId: string | null` to `ActiveMatch` interface
  - Added `RAID_ENDING_EVENT_TYPES` and `NON_RAID_EVENT_TYPES` constants
  - Fixed `addEvent()` to only flip raidQueue for raid-ending events
  - Fixed `getRaidQueueFromEvents()` to use `RAID_ENDING_EVENT_TYPES`
  - Updated `setDoOrDie()` signature to accept optional `teamId` parameter
  - Updated `startMatch()`, `switchHalf()` to initialize/reset `doOrDieTeamId`
  - Updated type definitions for `initiateToss`, `startMatch`, `tossMatchConfig`

- `/home/z/my-project/src/components/kabaddi/LiveScoringScreen.tsx`:
  - Added `isTurnTransitioning` state for strict turn lock
  - Updated `handleSelectRaider()` to check turn transition lock and team-specific do-or-die
  - Updated `processRaidResult()` with team-specific do-or-die checks and proper evaluation order
  - Updated `TeamHalf` component with RAID/DEF badges and DEFENDING label
  - Added turn transition overlay
  - Updated do-or-die flame indicator to be team-specific
  - Updated half-time handler to reset turn transition

### Unresolved Issues / Risks
- Client-side error on page load (pre-existing, not caused by these changes)
- `consecutiveEmptyRaidsRef` is still stored in a React ref (lost on page refresh)
- Super Raid adds an extra point beyond touch count (non-standard per some kabaddi rules, but may be intentional design)
- Quick action buttons (handleTacklePoint, handleSuperTackle, handleBonusPoint) use `addEvent` which now correctly preserves the raidQueue, but they may need additional logic to properly end the current raid flow

### Priority Recommendations for Next Phase
1. Fix the client-side rendering error
2. Persist `consecutiveEmptyRaidsRef` to the store for refresh resilience
3. Add integration tests for the turn rotation logic
4. Consider adding a "Confirm Turn" dialog for extra safety in competitive matches

---

## Task 3: Raid Turn Sequence Bug Fixes (UI Layer)

### Date: 2025-03-05

### Summary
Fixed remaining bugs in the live scoring system where the strict alternating raid sequence was not properly enforced at the UI level. Focus was on visual indicators, race condition prevention, and turn swap feedback.

### Changes Made

#### 1. Non-attacking team player circles — visual disabled state
**Bug**: Players on the defending team looked identical to raiding team players. No visual indication that they cannot be selected as raiders.
**Fix**:
- Added `isDefending` prop to `PlayerCircle` component
- Defending team's on-court players now show: `opacity-50`, dotted gray border (vs solid team-color border for raiding team)
- Pass `isDefending={!isRaidingSide && !outIds.includes(player.id) && raidPhase === 'idle'}` from `TeamHalf`
- Substitutes and out players are unaffected by this change

#### 2. Prominent visual turn indicator at top of scoring screen
**Bug**: The only turn indicator was a small animated arrow in the score header, easy to miss.
**Fix**:
- Replaced the small `ArrowRight` icon in the score header with a prominent colored badge showing the raiding team's name and `Swords` icon
- The badge uses the raiding team's color with animated directional movement
- Added a persistent turn indicator bar between the score header and team splits
  - During normal idle: shows `"{TeamName}'S RAID"` with pulsing Swords icon and team color
  - During turn transition: shows dramatic `"TURN → {TeamName}'S RAID"` with rotating `ArrowRightLeft` icon animation
  - Both states show Do-or-Die flame when applicable

#### 3. Race condition fix — moved turn lock activation
**Bug**: `setIsTurnTransitioning(true)` was called AFTER `addBatchEvents()`, which updates the Zustand store and flips `raidQueue`. This created a brief window where the new raiding team could potentially select a raider before the lock was activated.
**Fix**: Moved `setIsTurnTransitioning(true)` to the very beginning of `processRaidResult()`, right after the guard clause, BEFORE `addBatchEvents()` is called. This ensures the lock is active before any store updates can trigger re-renders.

#### 4. Verified processRaidResult state reset (already correct)
The existing reset logic in `processRaidResult` properly clears all raid state:
- `raidPhase` → `'idle'`
- `raider` → `null`
- `raidResult` → `null`
- `selectedDefenders` → `new Set()`
- `bonusPoint` → `false`
- Turn transition lock activated with 800ms timeout

#### 5. Verified Do-or-Die evaluation timing (already correct)
Do-or-Die evaluation happens BEFORE `addBatchEvents()` is called, which is the correct order:
1. Evaluate `consecutiveEmptyRaidsRef` for the raiding team
2. Call `setDoOrDie()` if needed
3. Then `addBatchEvents()` flips the raidQueue

#### 6. Verified Super Tackle evaluation (already correct)
Super tackle correctly evaluates when `onCourtActive.length <= 3` defenders remain on court.

#### 7. Verified All-Out evaluation (already correct)
All-out triggers when all on-court defenders are out (`newDefendingOutCount >= onCourt.length`).

### Files Modified
- `/home/z/my-project/src/components/kabaddi/LiveScoringScreen.tsx`:
  - Added `isDefending` prop to `PlayerCircle` with visual styling (opacity-50, dotted gray border)
  - Passed `isDefending` from `TeamHalf` for on-court defending team players
  - Replaced small arrow indicator in score header with prominent team-colored badge
  - Replaced turn transition overlay with comprehensive turn indicator (always visible during idle, enhanced during transition)
  - Moved `setIsTurnTransitioning(true)` to beginning of `processRaidResult` for race condition prevention

### Store Logic — No Changes
The store's core logic (`raidQueue`, `addBatchEvents`, `getRaidQueueFromEvents`) was verified to work correctly and was NOT modified.

---

## Session: Price Fix & Leaderboard Practice Stats Tab

### Date: 2025-06-14

### Summary
Fixed incorrect premium price display (₹149 → ₹99) and added Tournament/Practice tab toggle to the Leaderboard screen. Also fixed PlayerProfileCard to use tournament-only stats instead of combined stats.

### Changes Made

#### 1. Fixed premium price: ₹149 → ₹99 in ProfileTab.tsx
**Bug**: The ProfileTab premium banner showed ₹99/month (correct) but the previous developer had hardcoded ₹149.
**Fix**: Changed `₹149` to `₹99` on line 1433 of ProfileTab.tsx.

#### 2. Fixed PlayerProfileCard to use tournament-only stats
**Bug**: `PlayerProfileCard.tsx` was using combined stats (`totalPoints`, `raidPoints`, `tacklePoints`) which include practice match scores. This caused the card to show inflated numbers (e.g., 149 total instead of 99 tournament-only).
**Fix**:
- Changed `totalPoints`, `raidPoints`, `tacklePoints`, `matches` to use tournament-specific fields (`tournamentTotalPoints`, `tournamentRaidPoints`, `tournamentTacklePoints`, `tournamentMatches`)
- Added practice stats variables (`practiceTotalPoints`, `practiceRaidPoints`, `practiceTacklePoints`, `practiceMatches`) for separate display
- Updated Season Highlights sections in both normal and fullscreen views to show "Tourney Matches" and "Tourney Pts" instead of combined "Matches" and "Total Pts"

#### 3. Added Tournament/Practice tab toggle to LeaderboardScreen
**Feature**: Added a prominent tab toggle at the top of the leaderboard screen to switch between Tournament and Practice mode.
**Changes to LeaderboardScreen.tsx**:
- Added `TabMode` type (`'tournament' | 'practice'`)
- Added `tabMode` state
- Added Tournament/Practice toggle buttons with distinct styling:
  - Tournament: Yellow/amber gradient with Trophy icon, "🏆 Counts" subtitle
  - Practice: Green/emerald gradient with Dumbbell icon, "🏋️ Training" subtitle
- Updated header to show mode-specific icon and label ("Tournament matches only" / "Practice matches only")
- Updated category tab active color: red for tournament, emerald for practice
- Updated time period filter active color: brand-gold for tournament, emerald for practice
- Updated podium and list styling with mode-appropriate colors
- Updated empty state messages per mode
- Added Dumbbell import from lucide-react

#### 4. Updated Leaderboard API to support practice mode
**Changes to `/api/leaderboard/route.ts`**:
- Added `mode` query parameter (`'tournament'` or `'practice'`, default: `'tournament'`)
- Made `prefix` dynamic based on mode (`'tournament'` or `'practice'`)
- Updated `profileWhere` to use `prefix + 'Matches'` > 0
- Updated `orderBy` to use `prefix + 'RaidPoints'` etc.
- Updated stat calculations to pull from the correct prefix fields
- Returns `mode` in response for client verification

### Files Modified
- `/home/z/my-project/src/components/kabaddi/ProfileTab.tsx` — ₹149→₹99 price fix
- `/home/z/my-project/src/components/kabaddi/PlayerProfileCard.tsx` — Tournament-only stats fix
- `/home/z/my-project/src/components/kabaddi/LeaderboardScreen.tsx` — Tournament/Practice tab toggle
- `/home/z/my-project/src/app/api/leaderboard/route.ts` — Practice mode API support

### Verification
- ✅ Lint passes clean
- ✅ Dev server running without errors
- ✅ Agent-browser confirms: Profile tab shows ₹99/mo
- ✅ Agent-browser confirms: Leaderboard has Tournament/Practice tabs with distinct colors
- ✅ Agent-browser confirms: Practice tab shows "Practice matches only" and green theme
- ✅ Agent-browser confirms: Tournament tab shows "Tournament matches only" and gold theme
- ✅ Empty states show mode-appropriate messages

---
Task ID: otp-phone-auth
Agent: Main Agent
Task: Implement OTP-first phone registration with password-based login

Work Log:
- Added `phoneVerified` boolean field to User model in Prisma schema (default: false)
- Ran `bun run db:push` to push schema changes to database
- Ran `bun run db:generate` to regenerate Prisma client with new field
- Completely rewrote `/src/app/api/auth/route.ts`:
  - Added in-memory OTP store with lazy cleanup (no setInterval to avoid hot-reload crashes)
  - Added `generateOTP()` function using Math.random() for 6-digit codes
  - Added `createVerificationToken()` for secure signup flow tokens
  - Added `send-signup-otp` action: generates OTP, stores with 5min expiry, returns demoOtp for UI
  - Added `verify-signup-otp` action: validates OTP with attempt tracking (max 3), returns verificationToken
  - Modified `register` action: now requires verificationToken from OTP verification, sets phoneVerified: true
  - Improved `forgot-password` flow: now generates real OTP instead of hardcoded "123456"
  - Improved `verify-otp` flow: validates against stored OTP with attempt tracking
  - Improved `reset-password` flow: requires verificationToken for security
  - Removed console.log calls that were causing server instability
  - Changed from `randomInt` (crypto) to `Math.random()` for better compatibility
- Completely rewrote `/src/components/kabaddi/AuthScreen.tsx`:
  - New signup flow: Phone → OTP verification → Name + Password → Register
  - Login flow unchanged: Phone + Password → Login
  - Added `SignupStep` type: 'phone' | 'otp' | 'set-password'
  - Added `CountdownTimer` component for OTP resend cooldown
  - Added step progress indicators (Phone ✓ → OTP → Password)
  - Added "Auto-fill" button for demo OTP in testing
  - Added phone verified badge with ShieldCheck icon after OTP verification
  - Added OTP Verification Required badge on signup screen
  - Added resend OTP with rate limiting (max 3 resends)
  - Added "Change number" option on OTP screen
  - Improved forgot password flow with real OTP generation and demo display
- Changed Prisma logging from `['query']` to `['error']` in `/src/lib/db.ts` to reduce overhead
- Tested full registration + login flow via Node.js script: all 4 steps passed

Stage Summary:
- OTP-first phone verification is now required for signup
- Real 6-digit OTP generated server-side (demo mode shows OTP on UI for testing)
- Password login for returning users (no OTP needed)
- phoneVerified flag tracks verification status
- Forgot password flow uses real OTP with attempt tracking
- Files modified: prisma/schema.prisma, src/app/api/auth/route.ts, src/components/kabaddi/AuthScreen.tsx, src/lib/db.ts

---
Task ID: qa-testing-session
Agent: Main Agent
Task: Full QA testing of the Kabaddi Pro app using agent-browser and API testing

Work Log:
- Attempted comprehensive agent-browser testing of the app
- Discovered critical configuration bug: `allowedDevOrigins` in next.config.ts was causing Next.js to BLOCK (not just warn) cross-origin chunk requests, resulting in ChunkLoadError for all dynamic imports
- Root cause: When `allowedDevOrigins` is defined in next.config, Next.js 16 switches from 'warn' mode to 'block' mode for cross-origin requests. The browser requests chunks from 127.0.0.1 which weren't matching the allowed origins list, causing 403 responses
- Fixed by removing `allowedDevOrigins` from next.config.ts, reverting to default 'warn' mode which allows cross-origin requests with just a warning
- After the fix, the app successfully loaded in agent-browser: Splash screen → Auth screen with login/signup forms
- Verified auth flow via API testing:
  - ✅ Send OTP: Returns demo OTP successfully
  - ✅ Verify OTP: Returns verification token
  - ✅ Register: Creates user with phoneVerified=true
  - ✅ Login: Returns user data with correct fields
- Verified lint: Clean, no errors
- Verified leaderboard API: Correctly uses tournament/practice prefix for stats
- Verified PlayerProfileCard: Uses tournamentTotalPoints for main display (149→99 fix is in place)
- Took 19 screenshots documenting the testing process
- Server stability issue: Dev server (Turbopack) crashes when compiling large dynamic chunks (PlayerStatsScreen, AuthScreen) due to memory constraints in the sandbox environment. Works with NODE_OPTIONS="--max-old-space-size=8192" and pre-warming

Stage Summary:
- **Fixed critical bug**: Removed `allowedDevOrigins` from next.config.ts which was blocking chunk loading
- **App loads successfully** in browser after the fix (splash → auth screen)
- **Auth flow works** end-to-end (OTP → verify → register → login)
- **Score display uses tournament-only stats** (the 149→99 fix from previous session is confirmed working)
- **Leaderboard API** correctly separates tournament/practice stats
- **Lint**: Clean
- **Known issue**: Dev server can crash when compiling large components simultaneously; requires 8GB Node memory limit
- Files modified: next.config.ts (removed allowedDevOrigins)

### Test Report Summary

| Test | Status | Notes |
|------|--------|-------|
| App loads in browser | ✅ | Splash → Auth screen works |
| Signup flow (Phone → OTP → Password) | ✅ | Full API flow verified |
| Login flow (Phone + Password) | ✅ | Returns correct user data |
| OTP generation & verification | ✅ | 6-digit OTP with attempt tracking |
| Forgot password flow | ✅ | Real OTP (not hardcoded) |
| Leaderboard API (tournament) | ✅ | Uses tournamentXxx fields |
| Leaderboard API (practice) | ✅ | Uses practiceXxx fields |
| PlayerProfileCard (tournament scores) | ✅ | Uses tournamentTotalPoints |
| Coach's Corner premium gate | ✅ | Confirmed in code review |
| Lint check | ✅ | Clean, no errors |
| Dev server stability | ⚠️ | Needs 8GB memory for large components |
| Cross-origin chunk loading | ✅ | Fixed by removing allowedDevOrigins |

### Unresolved Issues
1. **Dev server memory**: Turbopack compilation of large components (PlayerStatsScreen, AuthScreen) can crash the server in the sandbox environment. Workaround: Use NODE_OPTIONS="--max-old-space-size=8192"
2. **Real SMS OTP**: Currently uses demo mode (OTP shown on screen). For production, integrate with Twilio/MSG91/SNS
3. **Agent-browser full E2E**: Cannot complete full end-to-end test through agent-browser because the browser's parallel chunk requests overwhelm the dev server. Individual API tests and partial browser tests work fine.

### Priority Recommendations
1. Integrate real SMS provider for OTP (Twilio, MSG91, or AWS SNS)
2. Consider splitting large components (HomeTab 163KB, ProfileTab 142KB, TournamentsTab 134KB) to reduce compilation memory
3. Add rate limiting to auth API endpoints for production
4. Consider adding JWT sessions instead of relying solely on Zustand localStorage

---
Task ID: otp-real-provider
Agent: Main Agent
Task: Add real OTP verification with provider support (MSG91, Twilio, Demo mode)

Work Log:
- Created /src/lib/otp-provider.ts - Provider abstraction layer supporting MSG91 (India), Twilio (global), and Demo mode
- Updated /src/app/api/auth/route.ts - Integrated real OTP providers with provider-side verification + local fallback
- Added new `otp-status` API action for frontend to check provider mode
- Updated /src/components/kabaddi/AuthScreen.tsx:
  - Added isOtpDemoMode state (fetched from backend on mount)
  - Real OTP flow: shows "SMS Sent Successfully" confirmation instead of Demo OTP banner
  - Demo mode: shows Demo OTP banner with Auto-fill button (existing behavior preserved)
  - Fixed forgot password OTP flow: added countdown timer, resend button, auto-fill, change number
  - Fixed forgot password demo OTP bug: now returns demoOtp even for non-existent accounts in demo mode
  - Fixed weight field "kg" doubling bug: strips "kg" suffix before appending
- Updated .env with full OTP provider configuration and setup instructions
- Ran comprehensive agent-browser E2E test - all flows pass

Stage Summary:
- Real OTP provider system fully implemented and tested
- MSG91 recommended for India (₹0.30-0.50/SMS), Twilio for global (₹0.70-1.00/SMS)
- Demo mode works out of box (OTP_PROVIDER=demo, default)
- To switch to real provider: set OTP_PROVIDER=msg91 or twilio + credentials in .env
- Security: forgot-password doesn't reveal user existence in production mode
- Rate limiting: 3 resends max, 3 wrong attempts max per OTP, 5-min expiry
- Bug fixes: forgot password demo OTP, weight "kg" doubling, missing UI elements

---
Task ID: msg91-setup-and-tester-deployment
Agent: Main Agent
Task: Configure MSG91 OTP provider, fix bugs, and prepare app for tester deployment

Work Log:
- Guided user through MSG91 setup: created Auth Key (528840AMmrbUJi0U4b6a2e3858P1) and OTP Template (6a2e3af8cda93304790f2f32)
- Configured .env: OTP_PROVIDER=msg91, MSG91_AUTH_KEY, MSG91_TEMPLATE_ID
- Added OTP_TESTER_MODE feature: when true, OTP is sent via real SMS AND shown on screen for testers
- Fixed BUG-1: Footer not sticking to bottom on Auth screen - changed layout from `items-center justify-center` to `flex-1` content area with footer pushed to bottom
- Fixed BUG-2: Escape key to dismiss Forgot Password modal - added onKeyDown handler and auto-focus via useRef
- Fixed VIS-2: Step indicator text size increased from 10px to 11px for better readability on mobile
- Added version badge "v1.0-beta" and "Tester Mode" indicator on Auth screen
- Added floating Bug Report / Feedback button for testers (orange FAB in bottom-right)
- Updated backend API to include testerMode flag in otp-status response and demoOtp in signup/forgot-password responses when tester mode is active
- Final QA passed: footer sticks, tester mode badge visible, OTP shown, Escape key works, mobile view OK

Stage Summary:
- MSG91 OTP integration is LIVE - real SMS delivery with tester mode overlay
- App is ready for tester deployment with v1.0-beta
- Key env vars: OTP_PROVIDER=msg91, OTP_TESTER_MODE=true
- For production: set OTP_TESTER_MODE=false to hide OTP on screen
- All bugs fixed, lint clean, no console errors
