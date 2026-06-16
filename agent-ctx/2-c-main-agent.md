# Task 2-c — Learning, Stats & Utility Features

## Agent: Main Agent
## Task: Create 5 new screen components and their corresponding API routes

### Files Created

#### Components (in /src/components/kabaddi/)
1. **RulesQuizScreen.tsx** (Feature #41) — Kabaddi Rules Quiz with XP rewards
   - Category selector: Rules, Technique, Strategy
   - 10 MCQ per quiz with 15s timer
   - Progress bar, score display, XP earned (10 XP/correct)
   - Answer review with explanations, Play Again

2. **TechniqueTutorialsScreen.tsx** (Feature #42) — Technique tutorials
   - 3 category tabs: Raiding, Defense, All-Round
   - 14 expandable tutorials with step-by-step guides
   - Difficulty badges (Beginner/Intermediate/Advanced)
   - Covers: toe touch, hand touch, scorpion kick, frog jump, ankle hold, back hold, dash, etc.

3. **PercentileRankingsScreen.tsx** (Feature #20) — Comparative percentile rankings
   - Overall percentile badge with gradient card
   - 5 stat cards with percentile bars
   - "How You Compare" distribution chart
   - Stats: Raid Points, Tackle Points, Total Points, Success Rate, Super Tackles

4. **LeaderboardSeasonsScreen.tsx** (Feature #51) — Monthly season leaderboards
   - Season info card with days remaining
   - Season selector dropdown
   - Leaderboard table with rank badges
   - Current user highlight, stats summary

5. **ScorecardPDFScreen.tsx** (Feature #72) — Scorecard PDF download
   - Match scorecard preview (scores, half scores, events, top performers)
   - "Download as PDF" button
   - Opens print-optimized HTML in new window with window.print()

#### API Routes (in /src/app/api/)
1. **/api/quiz/route.ts** — GET (questions by category) + POST (submit answers, store QuizAttempt)
2. **/api/percentile-rankings/route.ts** — GET (calculate percentiles from PlayerProfile)
3. **/api/leaderboard-seasons/route.ts** — GET (auto-create season, return entries + seasons list)
4. **/api/scorecard-pdf/route.ts** — GET (match data for scorecard)

### Key Decisions
- Quiz has 50+ hardcoded questions (18 rules, 18 technique, 14 strategy)
- Technique tutorials are entirely client-side (no API needed)
- Percentile calculation compares user against all players with matches > 0
- Leaderboard season auto-creates current month's season if none exists
- Scorecard PDF uses browser print-to-PDF approach (HTML template + window.print())

### Lint Status
- All files pass `bun run lint` clean
