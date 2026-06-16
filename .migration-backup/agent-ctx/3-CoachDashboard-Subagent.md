# Task 3 - CoachDashboard Subagent

## Task
Build comprehensive CoachDashboard component to replace CoachesCornerScreen

## Work Completed

### API Routes Created
1. `/api/coach/fees/route.ts` - GET/POST/PUT for fee records with monthly summaries
2. `/api/coach/rewards/route.ts` - GET/POST for rewards with leaderboard aggregation
3. `/api/coach/parents/route.ts` - GET/POST for parent contacts
4. `/api/coach/analytics/route.ts` - GET for analytics (attendance-performance, trends, fee pie data)

### Component Created
- `/src/components/kabaddi/CoachDashboard.tsx` - Full 5-tab dashboard:
  - **Academy Tab**: List/create/detail academies, add/remove players, schedule settings
  - **Attendance Tab**: Date picker, bulk actions, one-tap toggle grid, save, notify parents
  - **Fees Tab**: Monthly overview, summary cards, fee records, mark paid, add fee, send reminders
  - **Rewards Tab**: Player of month, give reward form (4 types), points leaderboard, reward history
  - **Analytics Tab**: Bar chart (attendance vs performance), line chart (monthly trend), pie chart (fee collection with PremiumLock), quick stats

### Integration
- Updated `HomeTab.tsx` to import `CoachDashboard` instead of `CoachesCornerScreen`
- Uses existing Prisma models (FeeRecord, StudentReward, ParentContact)
- Uses existing academy API routes (`/api/academies`, `/api/academies/[id]/attendance`)
- Uses recharts for visualizations
- PremiumLock wraps advanced analytics

### Key Decisions
- Component is self-contained with `onClose` prop
- Uses fetch() for all API calls
- State management within component (no new Zustand state)
- Academy selector available in all tabs (except Academy tab which has its own navigation)
- Brand colors: brand-green for coach actions, brand-gold for rewards/premium
