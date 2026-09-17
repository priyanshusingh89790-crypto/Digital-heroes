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

Open [http://localhost:3000](http://localhost:3000) with your browser.

This project uses `next/font` to optimize fonts.

## Learn More

To learn more about Next.js, see the Next.js documentation.

## Deploy on Vercel

The easiest way to deploy this app is with Vercel.

## Authentication and access control

Email/password authentication is implemented with Supabase SSR cookies. Profiles are created by the `on_auth_user_created` database trigger and default to the `subscriber` role. Protected routes use server-side authorization checks.

### Development administrator setup

Create the user normally, then, using the Supabase SQL Editor or a secure server-side maintenance process, promote the user with:

```sql
update public.profiles
set role = 'admin'
where id = 'USER_UUID';
```

## Stripe subscription setup

The application uses Stripe Test Mode for subscription management. Secret keys and webhook secrets remain server-side.

### Pricing assumptions

- Currency: GBP
- Monthly plan: £12.00/month
- Yearly plan: £120.00/year

These are implementation choices and can be configured through Stripe/environment variables.

### Required environment variables

```bash
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_MONTHLY_PRICE_ID=price_...
STRIPE_YEARLY_PRICE_ID=price_...
```

See `env.example` for the complete template.

## Golf Score Management

The application supports Stableford scores from 1–45. Users can have one score per date, and a database trigger retains only their five most recent scores. Score operations require an active subscriber.

## Draw Engine & Prize Pool System

The monthly draw supports random and algorithmic generation, five-number entries, 5/4/3 match tiers, prize allocation, winner verification, and jackpot rollover. Draw operations are admin-only and published draws are immutable.

## Charity & Donations

Users can select charities, configure their contribution percentage, browse charity information and events, and make independent one-time donations. Charity and winner proof data are protected with Supabase RLS and private storage policies.

## Testing

Run:

```bash
npm test
npm run lint
npx tsc --noEmit
npm run build
```

CI runs these checks automatically on pushes to `main` and pull requests.

<!-- CI verification trigger -->
