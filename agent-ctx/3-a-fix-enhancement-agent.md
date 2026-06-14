# Task 3-a: Fix & Enhancement Agent

## Task
Fix profile upload, add footer, enhance premium badges, gate compare/stats behind premium

## Changes Made

### 1. Profile Picture Upload Fix (ProfileTab.tsx)
- Changed hidden file input from `className="hidden"` (display:none) to opacity+absolute positioning for better cross-browser support
- Added cleanup of avatarPreview blob URL in finally block
- Verified upload API works correctly

### 2. Footer on HomeTab
- Already existed - verified correct implementation with i18n keys

### 3. Premium Badge Enhancement (ProfileTab.tsx)
- Golden gradient name text: `from-yellow-400 via-amber-300 to-yellow-500`
- PRO Badge with shimmer animation and golden gradient
- Enhanced crown icon with ring effect
- Enhanced Premium Active Card with shimmer overlay

### 4. Compare Teams Premium Gate (HomeTab.tsx)
- Added lock icon indicator for non-premium users
- Added inline "PRO" badge text
- Click gating already existed

### 5. Player Stats Premium Gate (PlayerProfileCard.tsx)
- Added premium gating to card back view (Performance, Success Rates, Season Highlights)
- Added premium gating to fullscreen view (Stats Grid, Performance, Success Rates, Season Highlights, Match Summary)
- Uses `canSeeStats` (viewerIsPremium || isOwnProfile) to control visibility
- Own profile stats remain fully visible

## Files Modified
- `/src/components/kabaddi/ProfileTab.tsx` - Upload fix, premium badge enhancements
- `/src/components/kabaddi/HomeTab.tsx` - Compare Teams lock indicator
- `/src/components/kabaddi/PlayerProfileCard.tsx` - Stats premium gating for back/fullscreen views

## Verification
- ESLint passes clean (exit code 0)
- Dev server compiles successfully (HTTP 200)
