import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const stripe = new Stripe(stripeSecretKey || "");

function getSupabaseAdmin() {
  if (!supabaseUrl || !supabaseServiceRoleKey) {
    throw new Error(
      "Supabase server environment variables are not configured.",
    );
  }

  return createClient(supabaseUrl, supabaseServiceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

export async function POST(req: NextRequest) {
  if (!stripeSecretKey) {
    return NextResponse.json(
      { error: "STRIPE_SECRET_KEY is missing." },
      { status: 500 },
    );
  }

  if (!webhookSecret) {
    return NextResponse.json(
      { error: "STRIPE_WEBHOOK_SECRET is missing." },
      { status: 500 },
    );
  }

  const signature = req.headers.get("stripe-signature");

  if (!signature) {
    return NextResponse.json(
      { error: "Stripe signature header is missing." },
      { status: 400 },
    );
  }

  let event: Stripe.Event;

  try {
    const rawBody = await req.text();

    event = stripe.webhooks.constructEvent(
      rawBody,
      signature,
      webhookSecret,
    );
  } catch (error: unknown) {
    console.error("Stripe webhook signature verification failed:", error);

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Invalid Stripe webhook signature.",
      },
      { status: 400 },
    );
  }

  try {
    if (event.type === "checkout.session.completed") {
      const session = event.data.object as Stripe.Checkout.Session;

      const referralCode = session.metadata?.referral_code;
      const consentToken = session.metadata?.consent_token;
      const consultationReason =
        session.metadata?.consultation_reason || null;

      if (!referralCode) {
        throw new Error(
          `Stripe session ${session.id} has no referral code.`,
        );
      }

      if (session.payment_status !== "paid") {
        console.log(
          `Checkout completed but payment status is ${session.payment_status}.`,
        );

        return NextResponse.json({ received: true });
      }

      const supabase = getSupabaseAdmin();

      const { error } = await supabase
        .from("symptomai_referrals")
        .update({
          consultation_reason: consultationReason,
          payment_status: "paid",
          referral_status: "ready_for_doctor",
          consultation_fee: 250,
          currency: "ZAR",
          stripe_checkout_session_id: session.id,
          stripe_payment_intent_id:
            typeof session.payment_intent === "string"
              ? session.payment_intent
              : null,
          paid_at: new Date().toISOString(),
        })
        .eq("referral_code", referralCode)
        .eq("consent_token", consentToken);

      if (error) {
        throw new Error(
          `Could not update referral ${referralCode}: ${error.message}`,
        );
      }

      console.log(
        `Stripe payment confirmed for referral ${referralCode}.`,
      );
    }

    if (event.type === "checkout.session.expired") {
      const session = event.data.object as Stripe.Checkout.Session;
      const referralCode = session.metadata?.referral_code;

      if (referralCode && supabaseUrl && supabaseServiceRoleKey) {
        const supabase = getSupabaseAdmin();

        const { error } = await supabase
          .from("symptomai_referrals")
          .update({
            payment_status: "expired",
            referral_status: "awaiting_payment",
          })
          .eq("referral_code", referralCode)
          .neq("payment_status", "paid");

        if (error) {
          console.error(
            "Could not mark Stripe session as expired:",
            error,
          );
        }
      }
    }

    return NextResponse.json({ received: true });
  } catch (error: unknown) {
    console.error("Stripe webhook processing error:", error);

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Stripe webhook processing failed.",
      },
      { status: 500 },
    );
  }
}
