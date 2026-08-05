import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const stripeSecretKey =
  process.env.STRIPE_SECRET_KEY;

const stripeWebhookSecret =
  process.env.STRIPE_WEBHOOK_SECRET;

const supabaseUrl =
  process.env.NEXT_PUBLIC_SUPABASE_URL;

const supabaseServiceRoleKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY;

const careScriberApiUrl =
  process.env.CARESCRIBER_API_URL;

const careScriberApiSecret =
  process.env.CARESCRIBER_API_SECRET;

const REFERRAL_TABLE =
  "symptomai_referrals";

type ReferralRecord = {
  id: string;

  referral_code?: string | null;
  consent_token?: string | null;

  patient_first_name?: string | null;
  patient_surname?: string | null;
  patient_name?: string | null;
  patient_id?: string | null;

  consultation_reason?: string | null;

  payment_status?: string | null;
  queue_status?: string | null;
  referral_status?: string | null;

  consultation_fee?: number | null;
  currency?: string | null;

  stripe_checkout_session_id?: string | null;
  stripe_payment_intent_id?: string | null;

  paid_at?: string | null;
  created_at?: string | null;
  updated_at?: string | null;

  carescriber_release_status?: string | null;
  released_to_carescriber_at?: string | null;
  carescriber_release_error?: string | null;

  patient_snapshot?: unknown;
  triage_snapshot?: unknown;
  triage_summary?: unknown;

  [key: string]: unknown;
};

type TraceStage =
  | "Webhook received"
  | "Webhook ignored"
  | "Payment not paid"
  | "Referral code extracted"
  | "Referral found in SymptomAI"
  | "Referral updated to paid"
  | "Sending referral to CareScriber"
  | "CareScriber responded"
  | "Referral inserted into CareScriber"
  | "Processing completed"
  | "Processing failed";

function trace(
  stage: TraceStage,
  referralCode: string | null,
  details: Record<string, unknown> = {},
) {
  console.log(
    JSON.stringify({
      trace: "symptomai-carescriber",
      stage,
      referralCode,
      timestamp: new Date().toISOString(),
      ...details,
    }),
  );
}

function getStripe(): Stripe {
  if (!stripeSecretKey) {
    throw new Error(
      "STRIPE_SECRET_KEY is missing.",
    );
  }

  return new Stripe(stripeSecretKey);
}

function getSupabaseAdmin() {
  if (
    !supabaseUrl ||
    !supabaseServiceRoleKey
  ) {
    throw new Error(
      "Supabase server environment variables are missing.",
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

function cleanString(
  value: unknown,
): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const cleaned = value.trim();

  return cleaned || null;
}

function normaliseReferralCode(
  value: unknown,
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
    const value = cleanString(metadata[key]);

    if (value) {
      return value;
    }
  }

  return null;
}

function getReferralCode(
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
  if (
    typeof session.payment_intent ===
    "string"
  ) {
    return session.payment_intent;
  }

  return session.payment_intent?.id || null;
}

function buildCareScriberEndpoint(): string {
  const configuredUrl =
    careScriberApiUrl ||
    "https://carescriber.com";

  const cleanUrl =
    configuredUrl.replace(/\/+$/, "");

  if (
    cleanUrl.endsWith(
      "/api/symptomai-referral",
    )
  ) {
    return cleanUrl;
  }

  return `${cleanUrl}/api/symptomai-referral`;
}

function objectValue(
  value: unknown,
): Record<string, unknown> | null {
  if (
    value &&
    typeof value === "object" &&
    !Array.isArray(value)
  ) {
    return value as Record<string, unknown>;
  }

  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);

      if (
        parsed &&
        typeof parsed === "object" &&
        !Array.isArray(parsed)
      ) {
        return parsed as Record<string, unknown>;
      }
    } catch {
      return null;
    }
  }

  return null;
}

function getObjectString(
  object: Record<string, unknown> | null,
  ...keys: string[]
): string | null {
  if (!object) {
    return null;
  }

  for (const key of keys) {
    const value = cleanString(object[key]);

    if (value) {
      return value;
    }
  }

  return null;
}

async function findReferral(
  referralCode: string,
): Promise<ReferralRecord | null> {
  const supabase = getSupabaseAdmin();

  const { data, error } = await supabase
    .from(REFERRAL_TABLE)
    .select("*")
    .ilike(
      "referral_code",
      referralCode,
    )
    .order("created_at", {
      ascending: false,
    })
    .limit(1);

  if (error) {
    throw new Error(
      `Referral lookup failed: ${error.message}`,
    );
  }

  if (!data || data.length === 0) {
    return null;
  }

  return data[0] as ReferralRecord;
}

function buildReferralValues({
  referral,
  session,
}: {
  referral: ReferralRecord;
  session: Stripe.Checkout.Session;
}) {
  const metadata = session.metadata || {};

  const patientSnapshot =
    objectValue(
      referral.patient_snapshot,
    );

  const patientFirstName =
    getMetadataValue(
      metadata,
      "patientFirstName",
      "patient_first_name",
      "firstName",
      "first_name",
    ) ||
    referral.patient_first_name ||
    getObjectString(
      patientSnapshot,
      "firstName",
      "first_name",
      "patientFirstName",
      "patient_first_name",
    );

  const patientSurname =
    getMetadataValue(
      metadata,
      "patientSurname",
      "patient_surname",
      "surname",
      "lastName",
      "last_name",
    ) ||
    referral.patient_surname ||
    getObjectString(
      patientSnapshot,
      "surname",
      "lastName",
      "last_name",
      "patientSurname",
      "patient_surname",
    );

  const combinedPatientName =
    [
      patientFirstName,
      patientSurname,
    ]
      .filter(Boolean)
      .join(" ") || null;

  const patientName =
    getMetadataValue(
      metadata,
      "patientName",
      "patient_name",
    ) ||
    referral.patient_name ||
    getObjectString(
      patientSnapshot,
      "patientName",
      "patient_name",
      "name",
      "fullName",
      "full_name",
    ) ||
    combinedPatientName;

  const patientId =
    getMetadataValue(
      metadata,
      "patientId",
      "patient_id",
      "nationalId",
      "national_id",
      "idNumber",
      "id_number",
    ) ||
    referral.patient_id ||
    getObjectString(
      patientSnapshot,
      "patientId",
      "patient_id",
      "nationalId",
      "national_id",
      "idNumber",
      "id_number",
    );

  /*
   * These are used only in the outbound CareScriber
   * payload. They are not written into local columns.
   */
  const patientEmail =
    getMetadataValue(
      metadata,
      "patientEmail",
      "patient_email",
      "email",
    ) ||
    session.customer_details?.email ||
    session.customer_email ||
    getObjectString(
      patientSnapshot,
      "email",
      "patientEmail",
      "patient_email",
    );

  const patientMobile =
    getMetadataValue(
      metadata,
      "patientMobile",
      "patient_mobile",
      "patientPhone",
      "patient_phone",
      "mobile",
      "phone",
    ) ||
    session.customer_details?.phone ||
    getObjectString(
      patientSnapshot,
      "mobile",
      "phone",
      "mobileNumber",
      "mobile_number",
    );

  const dateOfBirth =
    getMetadataValue(
      metadata,
      "dateOfBirth",
      "date_of_birth",
      "dob",
    ) ||
    getObjectString(
      patientSnapshot,
      "dateOfBirth",
      "date_of_birth",
      "dob",
    );

  const gender =
    getMetadataValue(
      metadata,
      "gender",
      "patientGender",
      "patient_gender",
    ) ||
    getObjectString(
      patientSnapshot,
      "gender",
      "patientGender",
      "patient_gender",
    );

  const consultationReason =
    getMetadataValue(
      metadata,
      "consultationReason",
      "consultation_reason",
      "reasonForConsultation",
      "reason_for_consultation",
    ) ||
    referral.consultation_reason ||
    cleanString(
      referral.triage_summary,
    );

  const consentToken =
    getMetadataValue(
      metadata,
      "consentToken",
      "consent_token",
    ) ||
    referral.consent_token ||
    null;

  return {
    patientFirstName,
    patientSurname,
    patientName,
    patientId,
    patientEmail,
    patientMobile,
    dateOfBirth,
    gender,
    consultationReason,
    consentToken,
  };
}

async function updateReferralAsPaid({
  referral,
  session,
  referralCode,
}: {
  referral: ReferralRecord;
  session: Stripe.Checkout.Session;
  referralCode: string;
}): Promise<ReferralRecord> {
  const supabase = getSupabaseAdmin();

  const values =
    buildReferralValues({
      referral,
      session,
    });

  const paidAt =
    new Date().toISOString();

  /*
   * Only write columns confirmed to be part of the
   * referral/inbox schema.
   */
  const primaryUpdate = {
    patient_first_name:
      values.patientFirstName,

    patient_surname:
      values.patientSurname,

    patient_name:
      values.patientName,

    patient_id:
      values.patientId,

    consent_token:
      values.consentToken,

    consultation_reason:
      values.consultationReason,

    payment_status:
      "paid",

    queue_status:
      "waiting",

    referral_status:
      "ready_for_doctor",

    consultation_fee:
      250,

    currency:
      "ZAR",

    stripe_checkout_session_id:
      session.id,

    stripe_payment_intent_id:
      getPaymentIntentId(session),

    paid_at:
      paidAt,

    updated_at:
      paidAt,
  };

  const primaryResult = await supabase
    .from(REFERRAL_TABLE)
    .update(primaryUpdate)
    .eq("id", referral.id)
    .select("*")
    .single();

  if (
    !primaryResult.error &&
    primaryResult.data
  ) {
    const updated =
      primaryResult.data as ReferralRecord;

    trace(
      "Referral updated to paid",
      referralCode,
      {
        updateMode: "primary",
        referralId: updated.id,
        paymentStatus:
          updated.payment_status,
        queueStatus:
          updated.queue_status,
        referralStatus:
          updated.referral_status,
      },
    );

    return updated;
  }

  console.warn(
    `Primary referral update failed for ${referralCode}.`,
    primaryResult.error?.message,
  );

  /*
   * Minimal fallback. These fields are the only fields
   * required for the inbox query.
   */
  const essentialResult = await supabase
    .from(REFERRAL_TABLE)
    .update({
      payment_status:
        "paid",

      queue_status:
        "waiting",

      referral_status:
        "ready_for_doctor",

      paid_at:
        paidAt,

      updated_at:
        paidAt,
    })
    .eq("id", referral.id)
    .select("*")
    .single();

  if (
    essentialResult.error ||
    !essentialResult.data
  ) {
    throw new Error(
      `Referral update failed: ${
        essentialResult.error?.message ||
        primaryResult.error?.message ||
        "Unknown Supabase error."
      }`,
    );
  }

  const updated =
    essentialResult.data as ReferralRecord;

  trace(
    "Referral updated to paid",
    referralCode,
    {
      updateMode: "essential",
      referralId: updated.id,
      paymentStatus:
        updated.payment_status,
      queueStatus:
        updated.queue_status,
      referralStatus:
        updated.referral_status,
    },
  );

  return updated;
}

function buildCareScriberPayload({
  referral,
  session,
  referralCode,
}: {
  referral: ReferralRecord;
  session: Stripe.Checkout.Session;
  referralCode: string;
}) {
  const values =
    buildReferralValues({
      referral,
      session,
    });

  const paidAt =
    referral.paid_at ||
    new Date().toISOString();

  return {
    referralCode,
    referral_code:
      referralCode,

    consentToken:
      values.consentToken,

    consent_token:
      values.consentToken,

    patientFirstName:
      values.patientFirstName,

    patient_first_name:
      values.patientFirstName,

    patientSurname:
      values.patientSurname,

    patient_surname:
      values.patientSurname,

    patientName:
      values.patientName,

    patient_name:
      values.patientName,

    patientId:
      values.patientId,

    patient_id:
      values.patientId,

    /*
     * The CareScriber receiver may place these values in
     * patient_snapshot rather than physical table columns.
     */
    patientEmail:
      values.patientEmail,

    patient_email:
      values.patientEmail,

    patientMobile:
      values.patientMobile,

    patient_mobile:
      values.patientMobile,

    dateOfBirth:
      values.dateOfBirth,

    date_of_birth:
      values.dateOfBirth,

    gender:
      values.gender,

    consultationReason:
      values.consultationReason,

    consultation_reason:
      values.consultationReason,

    paymentStatus:
      "paid",

    payment_status:
      "paid",

    queueStatus:
      "waiting",

    queue_status:
      "waiting",

    referralStatus:
      "ready_for_doctor",

    referral_status:
      "ready_for_doctor",

    consultationFee:
      250,

    consultation_fee:
      250,

    currency:
      "ZAR",

    stripeSessionId:
      session.id,

    stripe_session_id:
      session.id,

    stripePaymentIntentId:
      getPaymentIntentId(session),

    stripe_payment_intent_id:
      getPaymentIntentId(session),

    paidAt,
    paid_at:
      paidAt,

    source:
      "symptomai",
  };
}

async function sendReferralToCareScriber({
  referral,
  session,
  referralCode,
}: {
  referral: ReferralRecord;
  session: Stripe.Checkout.Session;
  referralCode: string;
}): Promise<unknown> {
  if (!careScriberApiSecret) {
    throw new Error(
      "CARESCRIBER_API_SECRET is missing.",
    );
  }

  const endpoint =
    buildCareScriberEndpoint();

  const payload =
    buildCareScriberPayload({
      referral,
      session,
      referralCode,
    });

  trace(
    "Sending referral to CareScriber",
    referralCode,
    {
      endpoint,
      stripeSessionId:
        session.id,
    },
  );

  const response =
    await fetch(endpoint, {
      method: "POST",

      headers: {
        "Content-Type":
          "application/json",

        Accept:
          "application/json",

        Authorization:
          `Bearer ${careScriberApiSecret}`,

        "x-api-key":
          careScriberApiSecret,
      },

      body:
        JSON.stringify(payload),

      cache:
        "no-store",
    });

  const responseText =
    await response.text();

  let responseBody: unknown =
    responseText;

  if (responseText) {
    try {
      responseBody =
        JSON.parse(responseText);
    } catch {
      responseBody =
        responseText;
    }
  }

  trace(
    "CareScriber responded",
    referralCode,
    {
      status:
        response.status,

      ok:
        response.ok,

      response:
        responseBody,
    },
  );

  if (!response.ok) {
    throw new Error(
      `CareScriber rejected referral ${referralCode}. ` +
        `HTTP ${response.status}: ${
          typeof responseBody === "string"
            ? responseBody
            : JSON.stringify(responseBody)
        }`,
    );
  }

  const result =
    responseBody &&
    typeof responseBody === "object"
      ? responseBody as Record<
          string,
          unknown
        >
      : null;

  trace(
    "Referral inserted into CareScriber",
    referralCode,
    {
      status:
        response.status,

      created:
        result?.created ??
        null,

      referralId:
        result?.referralId ??
        null,

      released:
        result?.released ??
        true,
    },
  );

  return responseBody;
}

async function markReleaseSuccess(
  referralId: string,
) {
  const supabase = getSupabaseAdmin();
  const releasedAt = new Date().toISOString();

  const { error } = await supabase
    .from(REFERRAL_TABLE)
    .update({
      carescriber_release_status: "released",
      released_to_carescriber_at: releasedAt,
      carescriber_release_error: null,
      updated_at: releasedAt,
    })
    .eq("id", referralId);

  if (error) {
    console.warn(
      "CareScriber release succeeded, but release tracking could not be saved:",
      error.message,
    );
  }
}

async function markReleaseFailure(
  referralId: string,
  message: string,
) {
  const supabase = getSupabaseAdmin();
  const failedAt = new Date().toISOString();

  const { error } = await supabase
    .from(REFERRAL_TABLE)
    .update({
      carescriber_release_status: "failed",
      carescriber_release_error: message.slice(0, 1000),
      updated_at: failedAt,
    })
    .eq("id", referralId);

  if (error) {
    console.warn(
      "Could not save the CareScriber release failure:",
      error.message,
    );
  }
}

async function processPaidSession(
  session: Stripe.Checkout.Session,
  event: Stripe.Event,
) {
  if (
    session.payment_status !==
    "paid"
  ) {
    trace(
      "Payment not paid",
      null,
      {
        eventId:
          event.id,

        stripeSessionId:
          session.id,

        paymentStatus:
          session.payment_status,
      },
    );

    return {
      processed:
        false,

      reason:
        "Payment is not marked as paid.",
    };
  }

  const referralCode =
    getReferralCode(session);

  trace(
    "Referral code extracted",
    referralCode || null,
    {
      stripeSessionId:
        session.id,

      paymentIntentId:
        getPaymentIntentId(session),
    },
  );

  if (!referralCode) {
    return {
      processed:
        false,

      permanentError:
        true,

      reason:
        "No referral code was attached to the Checkout Session.",
    };
  }

  const existingReferral =
    await findReferral(
      referralCode,
    );

  trace(
    "Referral found in SymptomAI",
    referralCode,
    {
      found:
        Boolean(existingReferral),

      referralId:
        existingReferral?.id ||
        null,

      paymentStatus:
        existingReferral?.payment_status ||
        null,

      queueStatus:
        existingReferral?.queue_status ||
        null,

      referralStatus:
        existingReferral?.referral_status ||
        null,
    },
  );

  if (!existingReferral) {
    return {
      processed:
        false,

      permanentError:
        true,

      reason:
        `No referral was found for ${referralCode}.`,
    };
  }

  const updatedReferral =
    await updateReferralAsPaid({
      referral:
        existingReferral,

      session,

      referralCode,
    });

  const alreadyReleased =
    existingReferral.carescriber_release_status === "released" ||
    updatedReferral.carescriber_release_status === "released" ||
    Boolean(
      existingReferral.released_to_carescriber_at ||
      updatedReferral.released_to_carescriber_at,
    );

  let careScriberResponse: unknown = null;

  if (!alreadyReleased) {
    try {
      careScriberResponse =
        await sendReferralToCareScriber({
          referral:
            updatedReferral,

          session,

          referralCode,
        });

      await markReleaseSuccess(
        updatedReferral.id,
      );
    } catch (error: unknown) {
      const message =
        error instanceof Error
          ? error.message
          : "CareScriber release failed.";

      await markReleaseFailure(
        updatedReferral.id,
        message,
      );

      throw error;
    }
  } else {
    trace(
      "Referral inserted into CareScriber",
      referralCode,
      {
        duplicatePrevented: true,
        referralId: updatedReferral.id,
      },
    );
  }

  trace(
    "Processing completed",
    referralCode,
    {
      eventId:
        event.id,

      eventType:
        event.type,

      referralId:
        updatedReferral.id,

      stripeSessionId:
        session.id,
    },
  );

  return {
    processed:
      true,

    referralCode,

    referralId:
      updatedReferral.id,

    stripeSessionId:
      session.id,

    paymentStatus:
      updatedReferral.payment_status ||
      "paid",

    queueStatus:
      updatedReferral.queue_status ||
      "waiting",

    referralStatus:
      updatedReferral.referral_status ||
      "ready_for_doctor",

    alreadyReleased,
    careScriberResponse,
  };
}

export async function GET() {
  return NextResponse.json({
    ok:
      true,

    service:
      "SymptomAI Stripe webhook and CareScriber referral release",

    route:
      "/api/stripe-webhook",

    configured: {
      stripeSecretKey:
        Boolean(
          stripeSecretKey,
        ),

      stripeWebhookSecret:
        Boolean(
          stripeWebhookSecret,
        ),

      supabaseUrl:
        Boolean(
          supabaseUrl,
        ),

      supabaseServiceRoleKey:
        Boolean(
          supabaseServiceRoleKey,
        ),

      careScriberApiUrl:
        Boolean(
          careScriberApiUrl,
        ),

      effectiveCareScriberEndpoint:
        buildCareScriberEndpoint(),

      careScriberApiSecret:
        Boolean(
          careScriberApiSecret,
        ),
    },

    supportedEvents: [
      "checkout.session.completed",
      "checkout.session.async_payment_succeeded",
      "checkout.session.expired",
    ],
  });
}

export async function POST(
  req: NextRequest,
) {
  if (!stripeSecretKey) {
    return NextResponse.json(
      {
        error:
          "STRIPE_SECRET_KEY is missing.",
      },
      {
        status: 500,
      },
    );
  }

  if (!stripeWebhookSecret) {
    return NextResponse.json(
      {
        error:
          "STRIPE_WEBHOOK_SECRET is missing.",
      },
      {
        status: 500,
      },
    );
  }

  if (
    !supabaseUrl ||
    !supabaseServiceRoleKey
  ) {
    return NextResponse.json(
      {
        error:
          "Supabase server environment variables are missing.",
      },
      {
        status: 500,
      },
    );
  }

  if (!careScriberApiSecret) {
    return NextResponse.json(
      {
        error:
          "CARESCRIBER_API_SECRET is missing.",
      },
      {
        status: 500,
      },
    );
  }

  const signature =
    req.headers.get(
      "stripe-signature",
    );

  if (!signature) {
    return NextResponse.json(
      {
        error:
          "Stripe signature header is missing.",
      },
      {
        status: 400,
      },
    );
  }

  let event: Stripe.Event;

  try {
    const rawBody =
      await req.text();

    event =
      getStripe()
        .webhooks
        .constructEvent(
          rawBody,
          signature,
          stripeWebhookSecret,
        );
  } catch (error: unknown) {
    const message =
      error instanceof Error
        ? error.message
        : "Invalid Stripe webhook signature.";

    console.error(
      "Stripe webhook signature verification failed:",
      message,
    );

    return NextResponse.json(
      {
        error:
          message,
      },
      {
        status: 400,
      },
    );
  }

  trace(
    "Webhook received",
    null,
    {
      eventId:
        event.id,

      eventType:
        event.type,
    },
  );

  const supportedEvents =
    new Set([
      "checkout.session.completed",
      "checkout.session.async_payment_succeeded",
      "checkout.session.expired",
    ]);

  if (
    !supportedEvents.has(
      event.type,
    )
  ) {
    trace(
      "Webhook ignored",
      null,
      {
        eventId:
          event.id,

        eventType:
          event.type,
      },
    );

    return NextResponse.json({
      received:
        true,

      processed:
        false,

      ignored:
        true,

      eventType:
        event.type,
    });
  }

  try {
    if (
      event.type ===
      "checkout.session.expired"
    ) {
      const session =
        event.data
          .object as Stripe.Checkout.Session;

      const referralCode =
        getReferralCode(session);

      if (referralCode) {
        const supabase =
          getSupabaseAdmin();

        const { error } =
          await supabase
            .from(
              REFERRAL_TABLE,
            )
            .update({
              payment_status:
                "expired",

              queue_status:
                "not_released",

              referral_status:
                "awaiting_payment",

              updated_at:
                new Date()
                  .toISOString(),
            })
            .ilike(
              "referral_code",
              referralCode,
            )
            .neq(
              "payment_status",
              "paid",
            );

        if (error) {
          console.warn(
            `Could not expire referral ${referralCode}:`,
            error.message,
          );
        }
      }

      return NextResponse.json({
        received:
          true,

        processed:
          true,

        eventType:
          event.type,

        referralCode:
          referralCode || null,
      });
    }

    const session =
      event.data
        .object as Stripe.Checkout.Session;

    const result =
      await processPaidSession(
        session,
        event,
      );

    return NextResponse.json({
      received:
        true,

      eventId:
        event.id,

      eventType:
        event.type,

      ...result,
    });
  } catch (error: unknown) {
    const message =
      error instanceof Error
        ? error.message
        : "Stripe webhook processing failed.";

    trace(
      "Processing failed",
      null,
      {
        eventId:
          event.id,

        eventType:
          event.type,

        error:
          message,
      },
    );

    console.error(
      "Stripe webhook processing error:",
      error,
    );

    return NextResponse.json(
      {
        received:
          false,

        error:
          message,

        eventId:
          event.id,

        eventType:
          event.type,
      },
      {
        status: 500,
      },
    );
  }
}
