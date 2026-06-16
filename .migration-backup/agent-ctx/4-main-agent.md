# Task 4: PKL-compliant scoring overhaul for LiveScoringScreen

## Summary
Applied 8 targeted improvements to `/home/z/my-project/src/components/kabaddi/LiveScoringScreen.tsx` without rewriting from scratch.

## Changes Made

### 1. Self-Out Feature (NEW)
- Added `selfOutConfirm` state and `handleSelfOut` handler
- Self-Out button in raid tab that switches to defense tab
- Defense tab shows active defenders with "Self-Out" tap option
- Confirmation popup with player name, Cancel/Confirm buttons
- Creates `self_out` event (teamId: raidingTeamId, value: 1)
- All-out check included in self-out handler

### 2. Do-or-Die Fix
- Per-team consecutive empty raid tracking (`Record<string, number>`)
- Auto-out on failed DoD raid: creates `do_or_die_raid` event for defending team
- Resets counters when teams score points

### 3. Super Raid Auto-Detection
- After successful raid: if touchCount + bonus >= 3, auto-adds `super_raid` event
- Shows `SuperRaidCelebration` fire-themed animation

### 4. Bonus Point Validation
- Available only when 6+ active defenders on court
- Disabled in both Special tab and defenders phase when < 6 defenders
- Shows "Need 6+ defenders" label when unavailable

### 5. All-Out from Self-Out
- `handleSelfOut` checks if self-out triggers all-out
- Uses `[...defendingOutIds, selfOutPlayer.id]` to count out defenders

### 6. Enhanced Raider Glow
- Dual-layer breathing gold: box-shadow + pulsating border ring
- 1.5s smooth animation cycle

### 7. Enhanced Out Player Visualization
- 60% red overlay, larger X icon (w-4/w-5), strokeWidth={3}, drop-shadow glow

### 8. Super Raid Celebration Component
- Fire particles rising upward (🔥✨💥)
- "SUPER RAID!" text with player name and team
- Auto-dismiss after 3 seconds

### 9. Event Log
- Added `self_out: '🚫'` and `self_out: 'Self-Out'`

### 10. End Half Reset
- `consecutiveEmptyRaidsRef.current = {}` for per-team reset

## Verification
- Lint passed with zero errors
- Dev server running without compilation errors
