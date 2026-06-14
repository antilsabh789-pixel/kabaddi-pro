---
Task ID: 3
Agent: TossScreen Rewrite Agent
Task: Completely rewrite TossScreen component with 3-phase interactive toss flow

Work Log:
- Read worklog.md to understand project context (Kabaddi scoring app, Next.js 16, Zustand store)
- Read current TossScreen.tsx (964 lines with choice/ready/flipping/result/choosing phases)
- Read store.ts to understand tossMatchConfig, showToss, cancelToss, startMatch integration
- Read page.tsx to understand TossScreen props integration (homeTeam, awayTeam, homeTeamColor, awayTeamColor, onTossComplete, onBack)
- Completely rewrote TossScreen.tsx with new 3-phase interactive toss flow:
  - Phase 1 (choose-caller): Select which team calls Heads/Tails - two team selection cards with avatars
  - Phase 2a (choose-side): Calling team picks Heads or Tails - large gold/silver circular buttons
  - Phase 2b (ready): Confirmation with chosen side + animated "FLIP COIN" button
  - Phase 2c (flipping): 3D coin flip animation with progress bar and sound wave indicators
  - Phase 3a (result): Winner announcement with celebration effects, confetti, team glow
  - Phase 3b (choose-advantage): Choose between "RAID FIRST" (Swords icon) or "CHOOSE COURT" (Shield icon)
  - Countdown: 3-2-1 countdown before match starts
- New visual features:
  - Phase indicator dots (3 steps with connecting lines)
  - Step labels at top ("Step 1 — Choose Caller", etc.)
  - TeamAvatar component with glow effects
  - Coin faces: Heads has "KABADDI PRO" with raider silhouette, Tails has "KP" with raider silhouette
  - Close button (X) in top-left corner
  - Grid pattern background overlay
  - 16 floating particles in team colors
  - 50 confetti particles in team colors + gold/purple/cyan
  - Dark background with team color radial gradients
  - Fully responsive (mobile-first with sm: breakpoints)
- Props interface unchanged: maintains backward compatibility with page.tsx integration
- Uses framer-motion for all animations, lucide-react icons, cn() from @/lib/utils
- Lint passes cleanly, page renders 200 OK

Stage Summary:
- Complete TossScreen rewrite with 3-phase interactive toss flow
- New phases: choose-caller → choose-side → ready → flipping → result → choose-advantage → countdown
- Visual: PKL-style dark theme with team colors, 3D coin, confetti, phase indicators
- Integration: Same props interface, no changes needed to page.tsx or store.ts
