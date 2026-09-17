This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out the [Next.js GitHub repository](https://github.com/nextjs/nextjs) - your feedback and welcome are appreciated.

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=nextjs&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.

## Authentication and access control

Email/password authentication is implemented with Supabase SSR cookies. Profiles are created by the `on_auth_user_created` database trigger and default to the `subscriber` role; the browser never submits a role. The `proxy.ts` session refresh redirects unauthenticated requests for `/dashboard/*` and `/admin/*` to `/login`, while server-side `requireSubscriber` and `requireAdmin` independently query the caller's RLS-protected profile before rendering protected routes or performing future privileged operations.

### Development administrator setup

Do not hardcode an administrator or change a role from the browser. Create the user normally, then, using the Supabase SQL Editor or a secure server-side maintenance process, run the following with that user's UUID:

```sql
update public.profiles
set role = 'admin'
where id = 'USER_UUID';
```

For future users, set `app_metadata.role` to `admin` only through the Supabase Admin API/service-role server environment before the user is created; the profile trigger recognizes this protected metadata. User-editable metadata is intentionally ignored for roles.

## Stripe subscription setup

This application uses Stripe Test Mode for subscription management. The implementation follows PCI compliance requirements with server-side validation and webhook processing.

### Pricing assumptions

The following pricing values are implementation choices for development and testing, not prices defined by the PRD:

- **Currency**: GBP (British Pound)
- **Monthly plan**: £12.00/month (1200 pence)
- **Yearly plan**: £120.00/year (12000 pence) - equivalent to 2 months free compared to monthly

These values are configurable via environment variables and Stripe Dashboard. The pricing page displays these amounts but does not control the actual Stripe prices.

### Required environment variables

Copy `env.example` to `.env` and add the following variables:

```bash
# Stripe Configuration
STRIPE_SECRET_KEY=sk_test_...              # Stripe secret key (Test Mode)
STRIPE_WEBHOOK_SECRET=whsec_...             # Stripe webhook signing secret
STRIPE_MONTHLY_PRICE_ID=price_...           # Stripe Price ID for monthly plan
STRIPE_YEARLY_PRICE_ID=price_...            # Stripe Price ID for yearly plan
```

See `env.example` for the complete environment variable template including Supabase configuration.

### Manual Stripe setup

1. **Create a Stripe account** and enable Test Mode
2. **Create products and prices** in Stripe Dashboard:
   - Create a product for the subscription
   - Create a monthly recurring price (£12.00 GBP)
   - Create a yearly recurring price (£120.00 GBP)
   - Copy the Price IDs for both plans

3. **Configure webhook endpoint**:
   - Add webhook endpoint: `https://your-domain.com/api/stripe/webhook`
   - For local development, use a tunneling service like ngrok or Stripe CLI
   - Select events to send:
     - `checkout.session.completed`
     - `customer.subscription.created`
     - `customer.subscription.updated`
     - `customer.subscription.deleted`
   - Copy the webhook signing secret

4. **Update environment variables** with the values from steps 2 and 3

### Local development with webhooks

For local development, you can use the Stripe CLI to forward webhooks:

```bash
# Install Stripe CLI
# Forward webhooks to your local server
stripe listen --forward-to localhost:3000/api/stripe/webhook
```

This will provide a webhook signing secret for local testing.

### Database migrations

Run the following migrations to set up the subscription and webhook infrastructure:

```bash
# Initial schema (includes subscriptions table)
supabase db push

# Stripe webhook events table
supabase db push

# Enhanced RLS policies for subscriptions and webhooks
supabase db push
```

### Security considerations

- Stripe secret keys and webhook secrets are server-only and never exposed to clients
- Subscription state is validated server-side using database queries, not client state
- RLS policies prevent client-side modification of subscription records
- Webhook signatures are verified before processing
- Price IDs are determined server-side; clients cannot specify arbitrary prices
- The webhook endpoint uses Supabase service role for database operations

### Subscription lifecycle

The implementation handles the complete subscription lifecycle:

1. **Checkout**: User initiates checkout via `/pricing` page → Server creates Stripe Checkout session with configured price ID
2. **Payment**: User completes payment in Stripe Checkout → Stripe sends `checkout.session.completed` webhook
3. **Subscription creation**: Stripe creates subscription → `customer.subscription.created` webhook syncs to database
4. **Renewal**: Stripe automatically renews → `customer.subscription.updated` webhook updates database
5. **Cancellation**: User cancels via UI → Server schedules cancellation in Stripe → `customer.subscription.updated` webhook updates database
6. **Expiration**: Subscription period ends → Access denied based on `current_period_end` field

### Access control

Subscriber-only functionality uses the `requireSubscriber()` helper which:

- Validates authentication server-side
- Queries the user's subscription status from the database under RLS
- Checks that subscription status is `active` or `trialing`
- Verifies that `current_period_end` is in the future (or null)
- Does not rely on localStorage, client state, or browser-supplied data

### Testing

Run the test suite to verify subscription logic:

```bash
npm test
```

Tests cover:
- Plan resolution and validation
- Subscription access control logic
- Subscription lifecycle states
- Webhook idempotency requirements
- Security guarantees

## Golf Score Management

This application includes a golf score management system for tracking Stableford scores.

### Implementation Decisions

**Date Validation**
- Future dates are not allowed for score entries
- Today's date is allowed
- Date validation is performed server-side using Zod schemas
- The database also enforces `score_date <= current_date` via check constraint

**Five-Score Rolling Rule**
- Only the 5 most recent scores by score_date are retained per user
- The rule is enforced server-side via a database trigger (`enforce_five_score_rolling_rule`)
- The trigger deletes the oldest score by score_date (not by insertion order)
- This handles concurrent requests correctly through PostgreSQL row-level locking
- The implementation correctly handles scores inserted out of chronological order

**Duplicate Date Handling**
- The database has a unique constraint on (user_id, score_date)
- Attempting to create a score for a date that already exists returns a clear error message
- Users are instructed to edit the existing score instead
- This prevents duplicate entries for the same date

**Score Validation**
- Scores must be between 1 and 45 (Stableford range)
- Validation is performed both client-side (UI) and server-side (API)
- Zod schemas ensure consistent validation across the application

**Authorization**
- All score operations require active subscriber authorization
- The `requireSubscriber()` helper ensures users have valid subscriptions
- User ID is derived from server-side session, never from client input
- RLS policies provide additional security by checking `auth.uid() = user_id`

### Database Schema

The `golf_scores` table includes:
- UUID primary key
- user_id (foreign key to profiles)
- score_date (date, with check constraint for current/past dates)
- stableford_score (smallint, 1-45 range)
- created_at and updated_at timestamps
- Unique constraint on (user_id, score_date) to prevent duplicates
- Index on (user_id, score_date desc) for efficient recent-score queries

### API Endpoints

- `GET /api/scores` - Get latest 5 scores for authenticated user
- `POST /api/scores` - Create a new score
- `GET /api/scores/[id]` - Get a specific score
- `PUT /api/scores/[id]` - Update a score
- `DELETE /api/scores/[id]` - Delete a score

All endpoints require authentication and active subscription.

## Draw Engine & Prize Pool System

This application implements a monthly draw-based reward system with two draw types: random (lottery-style) and algorithmic (weighted by score frequency).

### Implementation Decisions → Draw Algorithm

**Draw Number Range**
- Range: 1-45 (implementation decision to align with Stableford score range)
- Exactly 5 unique numbers are generated per draw
- Numbers are sorted consistently for comparison and display
- This range is configurable but defaults to 1-45 to match the golf score system

**Score-to-Number Mapping**
- For algorithmic draws, scores map directly to draw numbers (1-45)
- A user's latest 5 golf scores become their draw entry numbers
- If a user has fewer than 5 scores, they cannot participate in draws
- This creates a direct relationship between golf performance and draw participation

**Algorithmic Weighting Algorithm**
- The PRD specifies weighting by score frequency but does not define the exact method
- Implementation decision: frequency + 1 weighting method
1. Calculate frequency of each score (1-45) across all eligible subscribers' latest 5 scores
2. Assign weight = frequency + 1 (to handle zero-frequency scores) - implementation decision
3. Use weighted random selection with cumulative weight distribution
4. Generate 5 unique numbers using the weighted distribution
5. Higher frequency scores have higher probability of selection
6. Zero-frequency scores still have weight=1, ensuring all numbers can be selected
7. The algorithm is deterministic when seeded for simulation, random for production

**Match Definition**
- Implementation decision: exact set matching (count how many draw numbers appear in entry numbers)
- The PRD specifies 5/4/3-number matching but does not define the matching algorithm
- Numbers are compared as sets (order doesn't matter)
- Tiers: 5-match (all 5), 4-match (exactly 4), 3-match (exactly 3)
- Implementation decision: highest-tier-only winner classification
- A user can only win in one tier per draw (highest tier they qualify for)
- Example: If a user matches 5 numbers, they win the 5-match tier only, not 4-match or 3-match

**Eligibility Snapshot**
- Only active subscribers (status='active' or 'trialing') with valid subscription periods participate
- Eligibility is determined server-side from subscription data at draw time
- Participant snapshots are created when draws are published to ensure historical accuracy
- User's later subscription changes do not affect historical draw participation
- Users must have exactly 5 golf scores to participate

**Prize Contribution Percentage**
- Default: 50% of subscription revenue goes to prize pool (implementation decision)
- The PRD states a fixed portion contributes but does not specify the percentage
- This is configurable via environment variables but not specified in the PRD
- The percentage is applied to the total subscription amount

**Currency**
- All monetary values use GBP (British Pound) - implementation decision
- The PRD does not specify currency; GBP chosen to align with Stripe configuration
- Stored as integer minor units (pence) to avoid floating-point errors
- Display formatting uses Intl.NumberFormat for proper currency display

**Monthly/Yearly Subscription Normalization**
- Implementation decision: No normalization applied in current implementation
- The system uses the average subscription amount across all active subscribers as-is
- The PRD does not specify how to handle different billing intervals
- Future enhancement could normalize yearly subscriptions (divide by 12) for monthly fairness
- Current implementation treats all subscription amounts equally regardless of interval

**Rounding**
- All calculations use integer arithmetic (minor currency units)
- Prize distribution: floor(total * percentage / 100)
- Remainder from rounding is added to the 5-match pool (deterministic rule)
- Winner prize amounts: floor(pool / winnerCount)
- Remainder from winner division goes to the first winner in the tier (deterministic)

**Jackpot Rollover**
- 5-match pool rolls over if there are zero 5-match winners
- Rollover amount = current 5-match allocation + previous unclaimed jackpot
- 4-match and 3-match pools do NOT roll over (remainder stays with platform)
- Rollover state is stored explicitly in the prize_pools table (jackpot_rollover_in_minor, jackpot_rollover_out_minor)
- Rollover is paid out when a 5-match winner exists
- Implementation prevents double-counting: rollover is only added once when calculating pool, then cleared when paid out
- Database ensures only one published draw per month, preventing rollover conflicts

**Draw Lifecycle**
- States: draft → simulated → published → archived (cancelled can be reached from draft/simulated)
- Draft: Initial state, can be modified
- Simulated: Numbers generated for preview, can be modified or published
- Published: Final state, immutable, cannot be modified or republished
- Archived: Historical record, read-only
- Cancelled: Draw cancelled before publication
- State transitions are enforced server-side with validation

**Random Algorithm**
- Production: Uses Node.js crypto.randomBytes() for cryptographically secure random generation
- Simulation: Uses seeded deterministic generation for reproducibility
- The seeded version is NOT cryptographically secure and is marked with a warning
- Both versions generate exactly 5 unique numbers within the configured range

**Security Model**
- All draw operations require server-side admin authorization via requireAdmin()
- Client cannot supply arbitrary winners, prize amounts, or draw numbers
- Draw numbers are generated server-side using secure random sources
- Published draws are immutable via database triggers and application validation
- Database trigger prevents modification of draw numbers and type after publication
- Application validation prevents republishing already published draws
- Historical draw results cannot be altered
- Simulation cannot create production winners or payout obligations (strict separation)
- RLS policies prevent unauthorized access to draw data
- Service-role client is used for admin operations that bypass RLS

### Draw Engine Architecture

The draw engine is implemented as a pure business logic layer independent of UI:

```
lib/draw/
├── types.ts              # TypeScript types and interfaces
├── random-draw.ts        # Cryptographically secure random draw generation
├── algorithmic-draw.ts    # Weighted algorithmic draw based on score frequency
├── matching.ts           # Match calculation and tier classification
├── prize-calculator.ts   # Prize pool calculation and winner distribution
├── draw-engine.ts         # Main orchestrator and validation
├── operations.ts         # Server-side database operations (admin-only)
└── index.ts              # Public exports
```

The engine accepts structured inputs and returns structured results without depending on browser state.

### Database Schema

The draw system uses the following tables:

- **draws**: Monthly draw records with lifecycle management, draw numbers, and audit metadata
- **prize_pools**: Prize pool calculations with rollover tracking and tier allocations
- **draw_entries**: User entries for draws with score snapshots (immutable)
- **draw_results**: Match results for each draw entry
- **winners**: Winner records with verification status and prize amounts

Key constraints:
- Only one draw per month (unique constraint on draw_month)
- Published draws cannot be modified (trigger + check constraint)
- Draw numbers must be valid (5 unique numbers, 1-45 range)
- Users can only have one entry per draw (unique constraint)

### Server Operations

Admin-only server operations (lib/draw/operations.ts):

- **createDraw()**: Create a new draft draw for a specific month
- **simulateDraw()**: Run a simulation without publishing (returns preview data)
- **publishDraw()**: Publish a draw, create entries, calculate winners, and lock results
- **getDraw()**: Retrieve a specific draw (admin-only for unpublished draws)
- **getDrawHistory()**: Retrieve draw history for admin review
- **updateDraw()**: Update draft/simulated draw configuration
- **cancelDraw()**: Cancel a draw before publication

All operations use Zod validation and require admin authorization.

### Simulation vs Production

**Simulation** (Implementation Decision):
- Uses seeded random generation for reproducibility
- Generates candidate numbers and calculates expected results
- Shows expected winners and prize distribution
- Does NOT create database entries or permanent winners
- Does NOT create real payout obligations
- Updates draw status to 'simulated' with metadata only
- PRD requires admin simulation capability; this is our implementation

**Production**:
- Uses cryptographically secure random generation
- Creates actual draw entries for eligible participants
- Calculates and stores match results
- Creates winner records with prize amounts
- Updates prize pool with rollover calculations
- Changes draw status to 'published' (immutable)
- Simulation and production are strictly separated to prevent accidental payouts

### Prize Distribution

The PRD-defined distribution is:
- 5-match: 40% of total pool
- 4-match: 35% of total pool
- 3-match: 25% of total pool

Multiple winners in the same tier split the prize equally using integer division. Any remainder is allocated to the first winner in that tier (deterministic rule).

### Testing

Comprehensive automated tests cover:

- Draw generation (random and algorithmic)
- Number uniqueness and range validation
- Matching logic (5, 4, 3 matches and no match)
- Prize calculation and distribution
- Jackpot rollover behavior
- Draw lifecycle state transitions
- Validation of configurations
- Simulation reproducibility

Run tests with:
```bash
npm test
```

### Manual Supabase Setup Required

After implementing the draw system, run the database migration:

```bash
supabase db push
```

This will apply the draw lifecycle enhancements including:
- Additional constraints for draw state management
- Helper functions for subscriber count and subscription amount calculation
- Triggers to prevent modification of published draws
- Indexes for efficient draw queries
- Documentation comments on tables and columns

## Phase 8 — Charity System

This phase implements the charity directory, user charity selection, contribution percentage management, and independent donation functionality.

### PRD Requirements

The following features come directly from the PRD:
- Public charity directory with search and filtering
- Charity detail pages with events and impact information
- Featured charity support on homepage
- User charity selection for subscribers
- Minimum 10% contribution requirement
- Independent donation capability
- Charity cards with name, description, logo, and impact information

### Implementation Assumptions

**Contribution Calculation**
- The PRD requires a minimum 10% contribution but does not specify how to handle monthly vs yearly subscriptions
- Implementation: Contribution = subscription_amount × percentage / 100
- Monthly subscriptions: contribution applied to monthly amount as-is
- Yearly subscriptions: contribution applied to yearly amount as-is (no normalization)
- This treats the contribution as a percentage of the billing period amount
- Future enhancement could normalize yearly subscriptions to monthly equivalents if required

**Featured Charity Selection**
- The PRD mentions featured charities but does not define the selection process
- Implementation: The schema supports `is_featured` boolean with a unique constraint
- The homepage queries for `is_featured = true and is_active = true`
- If no featured charity exists, falls back to the first charity in the list
- Business rule for featured selection is intentionally undefined per PRD guidance

**Maximum Contribution Percentage**
- The PRD specifies minimum 10% but does not specify a maximum
- Implementation: Maximum is 100% (technical constraint from database schema)
- This is a technical maximum, not a business rule from the PRD

**Donation Amount Limits**
- The PRD requires independent donations but does not specify amount limits
- Implementation: Minimum £1.00, maximum £10,000.00
- These are reasonable bounds for security and usability
- Documented as implementation decisions, not PRD requirements

### Data Model

The charity system uses the existing schema from the initial migration - no new migrations were required:

**Existing Tables Used:**
- `charities`: Stores charity information with `is_featured` and `is_active` flags
- `charity_events`: Stores charity events and golf days
- `profiles`: Contains `preferred_charity_id` and `charity_contribution_percentage` fields
- `charity_contributions`: Records both subscription contributions and independent donations

**Key Schema Features:**
- Unique constraint on `charities.is_featured` ensures only one featured charity
- Database constraint ensures `charity_contribution_percentage >= 10 and <= 100`
- RLS policies ensure public users can only see active charities
- RLS policies ensure users can only modify their own charity selection

### Server-Side Operations

**Public Charity Operations** (`lib/public/charities.ts`):
- `getCharities(params?)`: List active charities with optional search/filter
- `getCharityBySlug(slug)`: Get charity details and upcoming events
- `getFeaturedCharity()`: Get the current featured charity

**User Charity Operations** (`lib/charity/user-charity.ts`):
- `getUserCharitySelection()`: Get current user's charity selection and percentage
- `updateCharitySelection(input)`: Update user's selected charity (validates charity is active)
- `updateContributionPercentage(input)`: Update contribution percentage (validates >= 10%)
- `calculateContribution()`: Calculate contribution amount based on subscription

**Donation Operations** (`lib/charity/donation.ts`):
- `createDonationCheckout(input)`: Create Stripe Checkout session for one-time donation
- `getUserDonations()`: Get user's donation history
- `validateDonationAmount(amount)`: Server-side donation amount validation

**Server Actions** (`lib/charity/actions.ts`):
- React Server Actions that wrap the above operations for client-side use
- Include cache revalidation for dashboard and charity pages

### Security Model

**User Authentication & Authorization:**
- All charity operations require authentication via `requireUser()` or `requireSubscriber()`
- User ID is derived from server-side session, never from client input
- RLS policies ensure users can only access their own data
- `requireSubscriber()` ensures active subscription for charity selection

**Charity Selection Security:**
- Server validates charity exists and is active before allowing selection
- Inactive charities cannot be selected
- RLS policy: `grant update (preferred_charity_id, charity_contribution_percentage) on public.profiles to authenticated`
- Cross-user modification prevented by RLS: `users update their profile: (select auth.uid()) = id`

**Contribution Percentage Security:**
- Server-side validation ensures minimum 10%
- Database constraint enforces `>= 10 and <= 100`
- Client cannot manipulate percentage beyond these bounds
- Calculation is performed server-side using actual subscription data

**Donation Security:**
- Donation amount validated server-side (minimum £1, maximum £10,000)
- Charity validated to be active before checkout creation
- Stripe Checkout session created server-side
- Stripe secret keys never exposed to client
- Donation recorded in database before redirecting to checkout
- Webhook will process successful donations and update records

**Public Access:**
- Public users can only see active charities via RLS: `public can read active charities: is_active`
- Public users can see active charity events via RLS
- No charity modification possible without authentication

### UI Components

**Charity Selection** (`components/charity/charity-selection.tsx`):
- Dropdown to select from active charities
- Shows current selection with charity name
- Displays featured badge on featured charities
- Error handling and loading states
- Server action integration with cache revalidation

**Contribution Percentage** (`components/charity/contribution-percentage.tsx`):
- Input for contribution percentage (10-100%)
- Shows current calculated contribution amount
- Displays subscription amount and interval
- Indicates monthly vs yearly behavior
- Server-side calculation display
- Error handling and loading states

**Donation Form** (`components/charity/donation-form.tsx`):
- Charity selection dropdown
- Amount input with validation
- Stripe Checkout redirect
- Recent donation history display
- Error handling and loading states
- Server-side validation before checkout creation

**Dashboard Integration** (`app/dashboard/page.tsx`):
- Tab-based interface with 4 tabs: Golf Scores, Charity, Contribution, Donate
- Integrates all charity components into subscriber dashboard
- Maintains existing golf score management functionality

**Homepage Integration** (`app/home-content.tsx`):
- Featured charity section with dedicated badge
- All charities section with grid display
- Uses `getFeaturedCharity()` for featured charity logic
- Falls back to first charity if no featured exists

### Stripe Donation Implementation

**Current Status:**
- Independent donation flow is fully implemented using Stripe Checkout
- Server-side creates Checkout sessions for one-time payments
- Donation intent recorded in `charity_contributions` table with `source = 'donation'`
- Webhook processing will handle successful donation completion
- No fake payment success behavior - real Stripe integration

**Webhook Handling:**
- Existing webhook infrastructure from Phase 5 can process donation events
- Donation metadata includes `donation_type: "one_time"` and `app_donation: "true"`
- Future enhancement: Add specific webhook handler for donation completion

### Testing

Comprehensive test coverage in `tests/charity.test.ts`:

**Validation Tests:**
- Charity selection UUID validation
- Contribution percentage validation (10-100% range)
- Donation amount validation (£1-£10,000 range)
- Currency format validation

**Business Logic Tests:**
- Minimum contribution requirement (10%)
- Contribution calculation behavior
- Charity selection security model
- Donation security model
- Featured charity behavior
- RLS policy documentation

**Data Model Tests:**
- Existing charity schema documentation
- No migration requirement confirmation
- RLS policy verification

**UI Component Tests:**
- Charity selection component features
- Contribution percentage component features
- Donation form component features
- Dashboard integration verification

**Homepage Integration Tests:**
- Featured charity section behavior
- All charities section behavior

Run tests with:
```bash
npm test
```

### RLS Policies

Charity system RLS policies (from initial schema):

```sql
-- Public access to charities
create policy "public can read active charities" on public.charities for select using (is_active);
create policy "public can read active charity events" on public.charity_events for select using (exists (select 1 from public.charities c where c.id = charity_id and c.is_active));

-- User profile access
create policy "users read their profile" on public.profiles for select to authenticated using ((select auth.uid()) = id);
create policy "users update their profile" on public.profiles for update to authenticated using ((select auth.uid()) = id) with check ((select auth.uid()) = id);

-- User contribution access
create policy "users read own contributions" on public.charity_contributions for select to authenticated using ((select auth.uid()) = user_id);

-- Specific grant for charity fields
revoke update on public.profiles from authenticated;
grant update (full_name, avatar_path, preferred_charity_id, charity_contribution_percentage) on public.profiles to authenticated;
```

### Verification

Run the following commands to verify the implementation:

```bash
# Run tests
npm test

# Run linting
npm run lint

# Type checking
npx tsc --noEmit

# Build
npm run build
```

### Files Created/Modified

**New Files:**
- `lib/charity/actions.ts` - Server actions for charity operations
- `components/charity/charity-selection.tsx` - Charity selection UI component
- `components/charity/contribution-percentage.tsx` - Contribution percentage UI component
- `components/charity/donation-form.tsx` - Donation form UI component
- `components/charity/index.ts` - Charity component exports
- `tests/charity.test.ts` - Comprehensive charity system tests

**Modified Files:**
- `lib/charity/index.ts` - Added actions export
- `app/dashboard/page.tsx` - Integrated charity components with tabs
- `app/home-content.tsx` - Enhanced with featured charity section
- `README.md` - Added Phase 8 documentation

**No Migrations Required:**
- All required schema already exists in initial migration
- RLS policies already in place
- Charity fields already present in profiles table

## Phase 9 — Subscriber Dashboard

The subscriber dashboard at `/dashboard` is a server-rendered overview for the signed-in subscriber. It does not start the administrator dashboard.

### Dashboard sections

- **Summary cards**: subscription, latest Stableford score, selected charity, charity contribution, latest draw, winnings/payment status
- **Subscription**: current status, monthly/yearly plan, amount, period end, and cancellation-at-period-end while access remains active
- **Golf scores**: latest 5 scores (newest first) with add/edit/delete using the existing Phase 6 API and rolling-five database rule
- **Charity**: selected charity, charity information, contribution percentage, and server-calculated contribution amount (minimum 10%)
- **Draw participation**: latest published monthly draw, draw numbers, the user's entry numbers, match count/tier, and winner status when those rows exist
- **Winnings / payment**: none, pending verification, approved, rejected, and paid, plus proof upload when verification is still pending or submitted
- **Donate**: existing independent donation form

### Server-side authorization

- Unauthenticated visitors are redirected to `/login` by `proxy.ts` and again by `requireSubscriber()`
- Authenticated users without an active/trialing subscription in period are redirected to `/unauthorized`
- Dashboard queries always use `requireSubscriber().user.id`; clients cannot supply another user id
- RLS remains enabled. Users can read only their own subscriptions, scores, donations, draw entries/results, winners, proofs, and payouts
- Subscribers cannot update subscription, payout, or winner verification fields, and cannot approve their own winnings

### Data sources

- Subscription: `subscriptions` via existing billing access helpers
- Scores: `getLatestScores()` / `/api/scores`
- Charity: `getUserCharitySelection()`, `calculateContribution()`, existing charity actions
- Draws: published `draws`, `draw_entries`, `draw_results`, and `winners` for that draw only
- Winnings: `winners`, `winner_proofs`, `payouts`

Independent sections load in parallel after the access check. Subscription, payment, and winner data are not cached.

### Implementation assumptions

- Dashboard access stays behind `requireSubscriber()` (active or trialing, period not ended). Inactive/lapsed mapping exists for display, but those users are sent to `/unauthorized`
- Contribution amounts are the existing Phase 8 server calculation (percentage of the billing-period amount, no monthly normalization)
- Proof upload records metadata only; it does not let the subscriber change `winners.verification_status`
- Winner proof insert RLS was the only schema gap required for the PRD proof-upload flow

### Deferred functionality

- Administrator dashboard, winner review/approval, and payout processing UI
- Donation webhook completion handler (already noted in Phase 8)
- Signed public URLs for viewing stored proof binaries in the browser

# Digital-heroes
