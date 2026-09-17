import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/authorization";
import { planSchema } from "@/lib/billing/plans";
import { isStripeConfigured, stripeClient } from "@/lib/billing/stripe";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: Request) { try {
  if (!isStripeConfigured()) return NextResponse.json({ error: "Billing is not configured yet." }, { status: 503 });
  const user = await requireUser(); const body = await request.json(); const plan = planSchema.safeParse(body.plan);
  if (!plan.success) return NextResponse.json({ error: "Invalid plan." }, { status: 400 });
  const supabase = await createClient(); const { data: existing } = await supabase.from("subscriptions").select("stripe_customer_id").eq("user_id", user.id).order("created_at", { ascending: false }).limit(1).maybeSingle();
  const stripe = stripeClient(); const customerId = existing?.stripe_customer_id ?? (await stripe.customers.create({ email: user.email, metadata: { app_user_id: user.id } })).id;
  const price = plan.data === "monthly" ? process.env.STRIPE_MONTHLY_PRICE_ID! : process.env.STRIPE_YEARLY_PRICE_ID!;
  const origin = new URL(request.url).origin;
  const session = await stripe.checkout.sessions.create({ mode: "subscription", customer: customerId, line_items: [{ price, quantity: 1 }], success_url: `${origin}/pricing?checkout=success`, cancel_url: `${origin}/pricing?checkout=cancelled`, metadata: { app_user_id: user.id, plan: plan.data }, subscription_data: { metadata: { app_user_id: user.id, plan: plan.data } } });
  return NextResponse.json({ url: session.url });
} catch (error) { const status = error instanceof Error && error.name === "AuthenticationRequiredError" ? 401 : 500; return NextResponse.json({ error: status === 401 ? "Please sign in to subscribe." : "Unable to start checkout." }, { status }); } }
