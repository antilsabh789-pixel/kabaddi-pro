# Task 9-a: Kabaddi Rules & Tutorial Screen

## Summary
Created a comprehensive, interactive Kabaddi Rules & Tutorial Screen component and integrated it into the Home tab's Explore section.

## Files Created
- `/home/z/my-project/src/components/kabaddi/KabaddiRulesScreen.tsx` — Full rules & tutorial screen component (~960 lines)

## Files Modified
- `/home/z/my-project/src/components/kabaddi/HomeTab.tsx` — Added import, state variable, Explore card, and conditional render

## Component Structure

### KabaddiRulesScreen
- **Sticky header** with back button and "Rules & Tutorial" title
- **Section tab bar** (Intro, Rules, Tutorial, Glossary) with AnimatePresence transitions
- **Introduction Section**:
  - Animated kabaddi court SVG with moving raider circle
  - "What is Kabaddi?" overview card with gradient-text heading
  - 4 key facts cards in 2x2 grid (Team Size, Match Duration, Court Size, All Out)
- **Rules Section** (Accordion with 6 expandable items):
  - Basic Rules (raid mechanics, scoring, lob, bonus line)
  - Scoring System (7 point types with values and badges)
  - Match Format (halves, duration, timeouts, result)
  - Player Positions (raider, defender, all-rounder with color-coded cards)
  - Cards & Penalties (green, yellow, red card with visual representations)
  - Court Layout (detailed SVG diagram with labeled areas)
- **Tutorial Section** (4-step Carousel):
  - Step 1: "The Raid" — animated raider crossing court
  - Step 2: "Scoring Points" — animated scoring badges
  - Step 3: "Defending" — defenders closing in animation
  - Step 4: "All Out" — pulsing ALL OUT text
  - Progress bar per step, highlight tips, pro tip card
- **Glossary Section**: 18 terms in scrollable list with color-coded first letters

### HomeTab Integration
- Added `BookOpen` icon import
- Added `KabaddiRulesScreen` component import
- Added `showRules` state variable
- Added "Rules" card in Explore grid (teal theme, BookOpen icon, "Learn the game" subtitle)
- Added conditional render block for KabaddiRulesScreen

## Lint Status
- `bun run lint` — **0 errors, 0 warnings**
