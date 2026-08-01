import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceRoleKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY;

function getStripe() {
  if (!stripeSecretKey) {
    throw new Error("STRIPE_SECRET_KEY is missing.");
  }

  return new Stripe(stripeSecretKey);
}

function getSupabaseAdmin() {
  if (!supabaseUrl || !supabaseServiceRoleKey) {
    throw new Error(
      "Supabase server environment variables are not configured.",
    );
  }

  return createClient(
    supabaseUrl,
    supabaseServiceRoleKey,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    },
  );
}

/*
 * This GET route is only for testing that the endpoint exists.
 * Opening it in a browser should return a healthy response.
 */
export async function GET() {
  return NextResponse.json({
    ok: true,
    service: "SymptomAI Stripe webhook",
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
    const stripe = getStripe();

    event = stripe.webhooks.constructEvent(
      rawBody,
      signature,
      webhookSecret,
    );
  } catch (error: unknown) {
    console.error(
      "Stripe webhook signature verification failed:",
      error,
    );

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
    const supabase = getSupabaseAdmin();

    if (event.type === "checkout.session.completed") {
      const session =
        event.data.object as Stripe.Checkout.Session;

      if (session.payment_status !== "paid") {
        console.log(
          `Checkout session ${session.id} completed with payment status ${session.payment_status}.`,
        );

        return NextResponse.json({
          received: true,
          processed: false,
          reason: "Payment not yet marked as paid.",
        });
      }

      const metadata = session.metadata || {};

      /*
       * Support both camelCase and snake_case metadata.
       * The current payment route has used camelCase.
       */
      const referralCode =
        metadata.referralCode ||
        metadata.referral_code ||
        "";

      const consentToken =
        metadata.consentToken ||
        metadata.consent_token ||
        "";

      const consultationReason =
        metadata.consultationReason ||
        metadata.consultation_reason ||
        null;

      const patientFirstName =
        metadata.patientFirstName ||
        metadata.patient_first_name ||
        null;

      const patientSurname =
        metadata.patientSurname ||
        metadata.patient_surname ||
        null;

      const patientName =
        metadata.patientName ||
        metadata.patient_name ||
        null;

      const patientId =
        metadata.patientId ||
        metadata.patient_id ||
        null;

      if (!referralCode) {
        console.error(
          `Stripe session ${session.id} has no referral code metadata.`,
          metadata,
        );

        return NextResponse.json(
          {
            error:
              "The paid Stripe session has no referral code metadata.",
          },
          { status: 400 },
        );
      }

      const paymentIntentId =
        typeof session.payment_intent === "string"
          ? session.payment_intent
          : session.payment_intent?.id || null;

      /*
       * Do not filter by consent token here.
       * The referral code is the reliable payment link.
       * The token is still retained in the referral row.
       */
      const { data: referral, error } = await supabase
        .from("symptomai_referrals")
        .update({
          consultation_reason: consultationReason,
          patient_first_name: patientFirstName,
          patient_surname: patientSurname,
          patient_name: patientName,
          patient_id: patientId,

          payment_status: "paid",
          queue_status: "waiting",
          referral_status: "ready_for_doctor",

          consultation_fee: 250,
          currency: "ZAR",

          stripe_checkout_session_id: session.id,
          stripe_payment_intent_id: paymentIntentId,

          paid_at: new Date().toISOString(),
        })
        .eq("referral_code", referralCode)
        .select(
          `
            id,
            referral_code,
            consent_token,
            payment_status,
            queue_status
          `,
        )
        .maybeSingle();

      if (error) {
        console.error(
          `Could not update referral ${referralCode}:`,
          error,
        );

        return NextResponse.json(
          {
            error: `Could not update referral ${referralCode}: ${error.message}`,
          },
          { status: 500 },
        );
      }

      if (!referral) {
        console.error(
          `No symptomai_referrals row was found for ${referralCode}.`,
        );

        return NextResponse.json(
          {
            error: `No referral was found for ${referralCode}.`,
          },
          { status: 404 },
        );
      }

      console.log(
        `Stripe payment confirmed and referral ${referralCode} released to the doctor inbox.`,
      );

      return NextResponse.json({
        received: true,
        processed: true,
        referralCode,
        paymentStatus: "paid",
        queueStatus: "waiting",
      });
    }

    if (event.type === "checkout.session.expired") {
      const session =
        event.data.object as Stripe.Checkout.Session;

      const metadata = session.metadata || {};

      const referralCode =
        metadata.referralCode ||
        metadata.referral_code ||
        "";

      if (referralCode) {
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
            `Could not mark referral ${referralCode} as expired:`,
            error,
          );
        }
      }

      return NextResponse.json({
        received: true,
        processed: true,
        eventType: event.type,
      });
    }

    return NextResponse.json({
      received: true,
      processed: false,
      eventType: event.type,
    });
  } catch (error: unknown) {
    console.error(
      "Stripe webhook processing error:",
      error,
    );

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
