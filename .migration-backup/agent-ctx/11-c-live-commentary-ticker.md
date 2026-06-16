# Task 11-c: Live Commentary Ticker Agent

## Task
Create a Live Commentary Ticker that shows real-time match commentary in the LiveScoringScreen and Home tab.

## Work Completed

### Files Created
1. **`/src/components/kabaddi/LiveCommentaryTicker.tsx`** - Main component with two modes:
   - **Compact Mode**: 48px horizontal scrolling ticker showing latest 5 events, auto-scrolls, click-to-expand
   - **Full Mode**: Collapsible panel with header/chevron toggle, filter buttons (All/Scoring/Cards/Other), half dividers, event count, max-h-64 scrollable feed

2. **`/src/app/api/match-events/route.ts`** - API endpoint for fetching match events by matchId

### Files Modified
1. **`/src/components/kabaddi/HomeTab.tsx`**:
   - Imported LiveCommentaryTicker and toCommentaryMatchInfo
   - Added `activeMatch` from store
   - Added compact ticker below each live match Card

2. **`/src/components/kabaddi/LiveScoringScreen.tsx`**:
   - Imported LiveCommentaryTicker and toCommentaryMatchInfo
   - Added full-mode commentary panel between raid overlays and bottom control bar
   - Default: collapsed, tap to expand

### Key Design Decisions
- Used `CommentaryMatchInfo` interface for lightweight match info (avoids coupling to full `ActiveMatch` type)
- Static `EventIcon` component with switch statement (avoids React Compiler "component-during-render" error)
- Commentary text uses `generateCommentary()` from `@/lib/commentary.ts` for standard types + custom text for remaining types
- Team color bar + point value badge + half labels on each commentary card
- Framer Motion animations for entrance and expand/collapse
- Dark mode support throughout

### Lint Status
- `bun run lint` passes with **zero errors, zero warnings**
