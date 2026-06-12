# Task 8-d: Match Countdown & Pull-to-Refresh Agent

## Summary
Added match countdown timers and pull-to-refresh functionality to the HomeTab component.

## Changes Made

### File: `/home/z/my-project/src/components/kabaddi/HomeTab.tsx`

1. **New Imports**: Added `RefreshCw` and `ArrowDown` from lucide-react

2. **CountdownTimer Component** (new inline component ~90 lines):
   - Takes `targetDate: string | null` prop
   - Uses `setInterval` with 1-second updates
   - Displays days (D), hours (H), minutes (M), seconds (S) in individual boxes
   - Each box uses framer-motion `rotateX` animation for flip effect on number change
   - When countdown reaches zero, shows "Starting Soon!" with pulse animation
   - Properly cleans up interval on unmount
   - Uses `Math.max(0, diff)` for safety

3. **Enhanced Upcoming Match Cards**:
   - Subtle gradient background layer based on team colors (7% opacity light, 12% dark)
   - Gender badge: ♀ (pink) / ♂ (sky blue) with dark mode variants
   - Team color circles with `ring-2 ring-white/30` for visual pop
   - Venue info row with MapPin icon showing tournament name or "Kabaddi Arena"
   - CountdownTimer in a bordered container below team names
   - All existing Set Reminder functionality preserved

4. **Pull-to-Refresh**:
   - State: `pullDistance`, `isRefreshing`, `touchStartY` ref
   - Touch handlers (`handleTouchStart`, `handleTouchMove`, `handleTouchEnd`) wrapped in `useCallback`
   - Rubber-band effect (0.4 multiplier) on pull distance
   - Pull threshold: 80px
   - `AnimatePresence`-powered pull indicator with spring animation
   - ArrowDown icon rotates based on pull progress, flips 180° at threshold
   - SVG progress arc fills proportionally (brand-red color)
   - Text states: "Pull to refresh" → "Release to refresh" → "Refreshing..."
   - Spinning RefreshCw icon during active refresh
   - On refresh: clears cached homeData, re-fetches all data, shows toast
   - Smooth spring transition for indicator height animation

## Lint Status
`bun run lint` passed with zero errors.
