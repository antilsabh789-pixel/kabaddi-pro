# Task 3-b: Team Profile Picture & Warrior Avatars

## Summary
Added team profile picture support with 12 warrior avatar images and custom upload functionality.

## Changes Made

### 1. Generated 12 Warrior Avatar Images
- Location: `/home/z/my-project/public/warriors/warrior_1.png` through `warrior_12.png`
- Generated using z-ai CLI at 1024x1024 PNG
- Each warrior has unique theme: Lion, Eagle, Tiger, Bull, Cobra, Panther, Bear, Wolf, Hawk, Rhino, Dragon, Phoenix

### 2. Updated TeamManagementScreen.tsx
- WARRIOR_IMAGES now references actual image files (`/warriors/warrior_N.png`)
- Added `handleAvatarUpload()` for gallery upload via `/api/upload`
- Added `getTeamAvatar()` helper to resolve warrior IDs and custom URLs
- Team creation sends `logo` field (warrior ID or custom URL)
- Team list shows actual warrior images instead of emoji
- New "Team Avatar" section in create form with:
  - Current avatar preview
  - "Choose Warrior" button → warrior picker dialog
  - "Upload from Gallery" button → file upload
  - Quick warrior strip (horizontal scrollable thumbnails)
  - "Remove custom avatar" option
- New Warrior Avatar Picker Dialog (3x4 grid, motion-animated)

### 3. Updated TeamDetailScreen.tsx
- Added WARRIOR_IMAGES constant and getTeamAvatar() helper
- Team header card shows warrior/custom avatar image
- Falls back to colored div with initials when no avatar

### 4. No API Changes Needed
- POST /api/teams already accepts `logo` parameter
- PATCH /api/teams/[id] already handles `logo` updates

## Verification
- ESLint passes clean
- Dev server compiles successfully
- All 12 warrior images in /public/warriors/
