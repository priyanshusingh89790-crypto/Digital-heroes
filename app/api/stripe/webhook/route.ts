import { NextResponse } from "next/server";
import Stripe from "stripe";
import { createAdminClient } from "@/lib/supabase/admin";
import { stripeClient, syncStripeSubscription } from "@/lib/billing/stripe";

export async function POST(request: Request) {
  const signature = request.headers.get("stripe-signature");
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!signature || !secret) return NextResponse.json({ error: "Webhook configuration missing." }, { status: 400 });

  let event: Stripe.Event;
  try {
    event = stripeClient().webhooks.constructEvent(await request.text(), signature, secret);
  } catch {
    return NextResponse.json({ error: "Invalid webhook signature." }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data: previous } = await admin.from("stripe_webhook_events").select("processed_at").eq("stripe_event_id", event.id).maybeSingle();
  if (previous?.processed_at) return NextResponse.json({ received: true, duplicate: true });

  const { error: insertError } = await admin.from("stripe_webhook_events").upsert(
    { stripe_event_id: event.id, event_type: event.type, payload: event },
    { onConflict: "stripe_event_id", ignoreDuplicates: true },
  );
  if (insertError) return NextResponse.json({ error: "Webhook persistence failed." }, { status: 500 });

  try {
    if (event.type === "checkout.session.completed") {
      const session = event.data.object as Stripe.Checkout.Session;
      if (typeof session.subscription === "string") {
        await syncStripeSubscription(await stripeClient().subscriptions.retrieve(session.subscription));
      }

      if (session.metadata?.app_donation === "true" && session.metadata.donation_type === "one_time" && session.payment_status === "paid") {
        const providerReference = session.id;
        const { error } = await admin
          .from("charity_contributions")
          .update({ payment_status: "paid" })
          .eq("provider_reference", providerReference)
          .eq("source", "donation")
          .eq("payment_status", "pending");
        if (error) throw new Error(`Failed to finalize donation: ${error.message}`);
      }
    }

    if (["customer.subscription.created", "customer.subscription.updated", "customer.subscription.deleted"].includes(event.type)) {
      await syncStripeSubscription(event.data.object as Stripe.Subscription);
    }

    await admin.from("stripe_webhook_events").update({ processed_at: new Date().toISOString(), processing_error: null }).eq("stripe_event_id", event.id);
    return NextResponse.json({ received: true });
  } catch (error) {
    await admin.from("stripe_webhook_events").update({ processing_error: error instanceof Error ? error.message : "Unknown error" }).eq("stripe_event_id", event.id);
    return NextResponse.json({ error: "Webhook processing failed." }, { status: 500 });
  }
}
