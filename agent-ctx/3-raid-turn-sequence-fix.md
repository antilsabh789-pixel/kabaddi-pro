# Task 3: Raid Turn Sequence Bug Fixes (UI Layer)

## Agent: Main Agent
## Date: 2025-03-05

## Task Description
Fix bugs in the live scoring system where the strict alternating raid sequence was not properly enforced at the UI level.

## Changes Made

### 1. Non-attacking team player circles — visual disabled state
- Added `isDefending` prop to `PlayerCircle` component
- Defending team players show: opacity-50, dotted gray border
- Pass `isDefending={!isRaidingSide && !outIds.includes(player.id) && raidPhase === 'idle'}` from TeamHalf

### 2. Prominent visual turn indicator
- Replaced small ArrowRight icon in score header with team-colored badge (Swords icon + team name)
- Added persistent turn indicator bar between score header and team splits
  - Normal idle: "{TeamName}'S RAID" with pulsing Swords icon
  - Turn transition: "TURN → {TeamName}'S RAID" with rotating ArrowRightLeft icon
  - Both show Do-or-Die flame when applicable

### 3. Race condition fix
- Moved `setIsTurnTransitioning(true)` to beginning of `processRaidResult()` BEFORE `addBatchEvents()`
- Prevents brief window where new raiding team could select a raider before lock activates

### 4-7. Verified existing logic (no changes needed)
- processRaidResult state reset: correct
- Do-or-Die evaluation timing: correct (before addBatchEvents)
- Super Tackle evaluation: correct (onCourtActive.length <= 3)
- All-Out evaluation: correct (all on-court defenders out)

## Files Modified
- `src/components/kabaddi/LiveScoringScreen.tsx`

## Store NOT Modified
Core store logic (raidQueue, addBatchEvents, getRaidQueueFromEvents) verified correct and unchanged.
