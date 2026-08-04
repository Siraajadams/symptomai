import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const stripeSecretKey = process.env.STRIPE_SECRET_KEY;

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceRoleKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY;

type VerifyPaymentBody = {
  sessionId?: string;
  referralCode?: string;
};

type ReferralRecord = {
  id: string;
  referral_code?: string | null;
  patient_first_name?: string | null;
  patient_surname?: string | null;
  patient_name?: string | null;
  patient_id?: string | null;
  email?: string | null;
  mobile?: string | null;
  consultation_reason?: string | null;
  payment_status?: string | null;
  queue_status?: string | null;
  referral_status?: string | null;
  [key: string]: unknown;
};

function getStripe(): Stripe {
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

function normaliseReferralCode(
  value: string | null | undefined,
): string {
  return String(value || "")
    .trim()
    .toUpperCase();
}

function getMetadataValue(
  metadata: Stripe.Metadata | null,
  ...keys: string[]
): string | null {
  if (!metadata) {
    return null;
  }

  for (const key of keys) {
    const value = metadata[key];

    if (
      typeof value === "string" &&
      value.trim().length > 0
    ) {
      return value.trim();
    }
  }

  return null;
}

function getSessionReferralCode(
  session: Stripe.Checkout.Session,
): string {
  const metadata = session.metadata || {};

  return normaliseReferralCode(
    metadata.referralCode ||
      metadata.referral_code ||
      metadata.symptomaiReferralCode ||
      metadata.symptomai_referral_code ||
      session.client_reference_id,
  );
}

function getPaymentIntentId(
  session: Stripe.Checkout.Session,
): string | null {
  if (typeof session.payment_intent === "string") {
    return session.payment_intent;
  }

  return session.payment_intent?.id || null;
}

async function findReferral(
  referralCode: string,
): Promise<ReferralRecord | null> {
  const supabase = getSupabaseAdmin();

  const { data, error } = await supabase
    .from("symptomai_referrals")
    .select("*")
    .ilike("referral_code", referralCode)
    .maybeSingle();

  if (error) {
    throw new Error(
      `Referral lookup failed: ${error.message}`,
    );
  }

  return (data as ReferralRecord | null) || null;
}

async function releaseReferralToCareScriber({
  referral,
  session,
  referralCode,
}: {
  referral: ReferralRecord;
  session: Stripe.Checkout.Session;
  referralCode: string;
}): Promise<ReferralRecord> {
  const supabase = getSupabaseAdmin();
  const metadata = session.metadata || {};

  const patientFirstName =
    getMetadataValue(
      metadata,
      "patientFirstName",
      "patient_first_name",
    ) ||
    referral.patient_first_name ||
    null;

  const patientSurname =
    getMetadataValue(
      metadata,
      "patientSurname",
      "patient_surname",
    ) ||
    referral.patient_surname ||
    null;

  const metadataPatientName = getMetadataValue(
    metadata,
    "patientName",
    "patient_name",
  );

  const combinedPatientName =
    [patientFirstName, patientSurname]
      .filter(Boolean)
      .join(" ") || null;

  const patientName =
    metadataPatientName ||
    combinedPatientName ||
    referral.patient_name ||
    null;

  const patientId =
    getMetadataValue(
      metadata,
      "patientId",
      "patient_id",
      "nationalId",
      "national_id",
    ) ||
    referral.patient_id ||
    null;

  const patientEmail =
    getMetadataValue(
      metadata,
      "patientEmail",
      "patient_email",
    ) ||
    session.customer_details?.email ||
    session.customer_email ||
    referral.email ||
    null;

  const patientMobile =
    getMetadataValue(
      metadata,
      "patientMobile",
      "patient_mobile",
      "patientPhone",
      "patient_phone",
    ) ||
    session.customer_details?.phone ||
    referral.mobile ||
    null;

  const consultationReason =
    getMetadataValue(
      metadata,
      "consultationReason",
      "consultation_reason",
    ) ||
    referral.consultation_reason ||
    null;

  const paidAt = new Date().toISOString();
  const paymentIntentId =
    getPaymentIntentId(session);

  /*
   * Attempt the complete update first.
   */
  const completeUpdate = {
    patient_first_name: patientFirstName,
    patient_surname: patientSurname,
    patient_name: patientName,
    patient_id: patientId,
    email: patientEmail,
    mobile: patientMobile,
    consultation_reason: consultationReason,

    payment_status: "paid",
    queue_status: "waiting",
    referral_status: "ready_for_doctor",

    consultation_fee: 250,
    currency: "ZAR",

    stripe_checkout_session_id: session.id,
    stripe_payment_intent_id: paymentIntentId,

    paid_at: paidAt,
    updated_at: paidAt,
  };

  const completeResult = await supabase
    .from("symptomai_referrals")
    .update(completeUpdate)
    .eq("id", referral.id)
    .select("*")
    .single();

  if (
    !completeResult.error &&
    completeResult.data
  ) {
    return completeResult.data as ReferralRecord;
  }

  console.warn(
    `Complete payment update failed for ${referralCode}. ` +
      "Trying essential CareScriber inbox update.",
    completeResult.error,
  );

  /*
   * Fallback update in case optional Stripe or patient
   * columns have not yet been created in Supabase.
   */
  const essentialResult = await supabase
    .from("symptomai_referrals")
    .update({
      payment_status: "paid",
      queue_status: "waiting",
      referral_status: "ready_for_doctor",
      updated_at: paidAt,
    })
    .eq("id", referral.id)
    .select("*")
    .single();

  if (
    essentialResult.error ||
    !essentialResult.data
  ) {
    throw new Error(
      `Referral ${referralCode} could not be released: ${
        essentialResult.error?.message ||
        completeResult.error?.message ||
        "Unknown Supabase error."
      }`,
    );
  }

  return essentialResult.data as ReferralRecord;
}

export async function GET() {
  return NextResponse.json({
    ok: true,
    service: "Stripe payment verification",
    configured: {
      stripeSecretKey: Boolean(stripeSecretKey),
      supabaseUrl: Boolean(supabaseUrl),
      supabaseServiceRoleKey: Boolean(
        supabaseServiceRoleKey,
      ),
    },
  });
}

export async function POST(req: NextRequest) {
  try {
    if (!stripeSecretKey) {
      return NextResponse.json(
        {
          error: "STRIPE_SECRET_KEY is missing.",
        },
        { status: 500 },
      );
    }

    if (!supabaseUrl || !supabaseServiceRoleKey) {
      return NextResponse.json(
        {
          error:
            "Supabase server environment variables are missing.",
        },
        { status: 500 },
      );
    }

    let body: VerifyPaymentBody;

    try {
      body =
        (await req.json()) as VerifyPaymentBody;
    } catch {
      return NextResponse.json(
        {
          error: "A valid JSON request body is required.",
        },
        { status: 400 },
      );
    }

    const sessionId =
      typeof body.sessionId === "string"
        ? body.sessionId.trim()
        : "";

    const requestedReferralCode =
      normaliseReferralCode(body.referralCode);

    if (!sessionId) {
      return NextResponse.json(
        {
          error:
            "Stripe session ID is required.",
        },
        { status: 400 },
      );
    }

    if (!sessionId.startsWith("cs_")) {
      return NextResponse.json(
        {
          error:
            "The Stripe Checkout Session ID is invalid.",
        },
        { status: 400 },
      );
    }

    const stripe = getStripe();

    const session =
      await stripe.checkout.sessions.retrieve(
        sessionId,
        {
          expand: ["payment_intent"],
        },
      );

    const sessionReferralCode =
      getSessionReferralCode(session);

    if (!sessionReferralCode) {
      return NextResponse.json(
        {
          paid: false,
          released: false,
          error:
            "No referral code is attached to this Stripe Checkout Session.",
          sessionId: session.id,
          paymentStatus: session.payment_status,
          sessionStatus: session.status,
        },
        { status: 400 },
      );
    }

    if (
      requestedReferralCode &&
      sessionReferralCode !==
        requestedReferralCode
    ) {
      return NextResponse.json(
        {
          paid: false,
          released: false,
          error:
            "The payment does not match this referral.",
          expectedReferralCode:
            requestedReferralCode,
          paymentReferralCode:
            sessionReferralCode,
        },
        { status: 400 },
      );
    }

    const paid =
      session.payment_status === "paid" &&
      session.status === "complete";

    if (!paid) {
      return NextResponse.json({
        paid: false,
        released: false,
        paymentStatus: session.payment_status,
        sessionStatus: session.status,
        referralCode: sessionReferralCode,
        sessionId: session.id,
        message:
          "The Stripe payment has not yet completed.",
      });
    }

    const referral =
      await findReferral(sessionReferralCode);

    if (!referral) {
      return NextResponse.json(
        {
          paid: true,
          released: false,
          error:
            `Payment succeeded, but referral ${sessionReferralCode} was not found in symptomai_referrals.`,
          referralCode: sessionReferralCode,
          sessionId: session.id,
          paymentStatus: session.payment_status,
          sessionStatus: session.status,
        },
        { status: 404 },
      );
    }

    const alreadyReleased =
      referral.payment_status === "paid" &&
      referral.queue_status === "waiting" &&
      referral.referral_status ===
        "ready_for_doctor";

    let updatedReferral = referral;

    if (!alreadyReleased) {
      updatedReferral =
        await releaseReferralToCareScriber({
          referral,
          session,
          referralCode: sessionReferralCode,
        });
    }

    return NextResponse.json({
      paid: true,
      released: true,
      alreadyReleased,

      paymentStatus: session.payment_status,
      sessionStatus: session.status,

      referralCode: sessionReferralCode,
      sessionId: session.id,
      paymentIntentId:
        getPaymentIntentId(session),

      queueStatus:
        updatedReferral.queue_status ||
        "waiting",

      referralStatus:
        updatedReferral.referral_status ||
        "ready_for_doctor",

      message: alreadyReleased
        ? "Payment was previously confirmed and the referral is already available in CareScriber."
        : "Payment confirmed. The referral has been released to the CareScriber doctor inbox.",
    });
  } catch (error: unknown) {
    const message =
      error instanceof Error
        ? error.message
        : "Payment verification failed.";

    console.error(
      "Stripe verification error:",
      message,
    );

    if (
      error instanceof Stripe.errors.StripeError
    ) {
      return NextResponse.json(
        {
          error: error.message,
          type: error.type,
        },
        {
          status:
            error.statusCode &&
            error.statusCode >= 400 &&
            error.statusCode < 600
              ? error.statusCode
              : 500,
        },
      );
    }

    return NextResponse.json(
      {
        error: message,
      },
      { status: 500 },
    );
  }
}
