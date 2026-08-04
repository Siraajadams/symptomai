import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const stripeSecretKey = process.env.STRIPE_SECRET_KEY;

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceRoleKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY;

const careScriberApiUrl =
  process.env.CARESCRIBER_API_URL;

const careScriberApiSecret =
  process.env.CARESCRIBER_API_SECRET;

type VerifyPaymentBody = {
  sessionId?: string;
  referralCode?: string;
};

type ReferralRecord = {
  id: string;
  referral_code?: string | null;
  consent_token?: string | null;

  patient_first_name?: string | null;
  patient_surname?: string | null;
  patient_name?: string | null;

  patient_id?: string | null;
  national_id?: string | null;

  date_of_birth?: string | null;
  gender?: string | null;

  email?: string | null;
  mobile?: string | null;

  consultation_reason?: string | null;

  payment_status?: string | null;
  queue_status?: string | null;
  referral_status?: string | null;

  stripe_checkout_session_id?: string | null;
  stripe_payment_intent_id?: string | null;

  paid_at?: string | null;
  released_to_carescriber_at?: string | null;
  carescriber_release_status?: string | null;
  carescriber_release_error?: string | null;

  [key: string]: unknown;
};

type ReferralPayload = {
  referralCode: string;
  consentToken: string | null;

  patientFirstName: string | null;
  patientSurname: string | null;
  patientName: string | null;

  patientId: string | null;
  nationalId: string | null;

  dateOfBirth: string | null;
  gender: string | null;

  patientEmail: string | null;
  patientMobile: string | null;

  consultationReason: string | null;

  paymentStatus: "paid";
  queueStatus: "waiting";
  referralStatus: "ready_for_doctor";

  consultationFee: number;
  currency: "ZAR";

  stripeSessionId: string;
  stripePaymentIntentId: string | null;
  paidAt: string;
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

function normaliseBaseUrl(value: string): string {
  return value.replace(/\/+$/, "");
}

function buildCareScriberEndpoint(): string {
  if (!careScriberApiUrl) {
    throw new Error(
      "CARESCRIBER_API_URL is missing.",
    );
  }

  const baseUrl =
    normaliseBaseUrl(careScriberApiUrl);

  /*
   * CARESCRIBER_API_URL can be either:
   *
   * https://carescriber.com
   *
   * or the full endpoint:
   *
   * https://carescriber.com/api/symptomai-referral
   */
  if (
    baseUrl.endsWith(
      "/api/symptomai-referral",
    )
  ) {
    return baseUrl;
  }

  return `${baseUrl}/api/symptomai-referral`;
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

function buildReferralPayload({
  referral,
  session,
  referralCode,
  paidAt,
}: {
  referral: ReferralRecord;
  session: Stripe.Checkout.Session;
  referralCode: string;
  paidAt: string;
}): ReferralPayload {
  const metadata = session.metadata || {};

  const patientFirstName =
    getMetadataValue(
      metadata,
      "patientFirstName",
      "patient_first_name",
      "firstName",
      "first_name",
    ) ||
    referral.patient_first_name ||
    null;

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
    null;

  const metadataPatientName =
    getMetadataValue(
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
    ) ||
    referral.patient_id ||
    referral.national_id ||
    null;

  const nationalId =
    getMetadataValue(
      metadata,
      "nationalId",
      "national_id",
      "idNumber",
      "id_number",
    ) ||
    referral.national_id ||
    referral.patient_id ||
    null;

  const patientEmail =
    getMetadataValue(
      metadata,
      "patientEmail",
      "patient_email",
      "email",
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
      "mobile",
      "phone",
    ) ||
    session.customer_details?.phone ||
    referral.mobile ||
    null;

  const consultationReason =
    getMetadataValue(
      metadata,
      "consultationReason",
      "consultation_reason",
      "reasonForConsultation",
      "reason_for_consultation",
    ) ||
    referral.consultation_reason ||
    null;

  const consentToken =
    getMetadataValue(
      metadata,
      "consentToken",
      "consent_token",
    ) ||
    referral.consent_token ||
    null;

  const dateOfBirth =
    getMetadataValue(
      metadata,
      "dateOfBirth",
      "date_of_birth",
      "dob",
    ) ||
    referral.date_of_birth ||
    null;

  const gender =
    getMetadataValue(
      metadata,
      "gender",
      "patientGender",
      "patient_gender",
    ) ||
    referral.gender ||
    null;

  return {
    referralCode,
    consentToken,

    patientFirstName,
    patientSurname,
    patientName,

    patientId,
    nationalId,

    dateOfBirth,
    gender,

    patientEmail,
    patientMobile,

    consultationReason,

    paymentStatus: "paid",
    queueStatus: "waiting",
    referralStatus: "ready_for_doctor",

    consultationFee: 250,
    currency: "ZAR",

    stripeSessionId: session.id,
    stripePaymentIntentId:
      getPaymentIntentId(session),

    paidAt,
  };
}

async function updateReferralAsPaid({
  referral,
  payload,
}: {
  referral: ReferralRecord;
  payload: ReferralPayload;
}): Promise<ReferralRecord> {
  const supabase = getSupabaseAdmin();

  const completeUpdate = {
    patient_first_name:
      payload.patientFirstName,

    patient_surname:
      payload.patientSurname,

    patient_name:
      payload.patientName,

    patient_id:
      payload.patientId,

    email:
      payload.patientEmail,

    mobile:
      payload.patientMobile,

    consultation_reason:
      payload.consultationReason,

    payment_status: "paid",
    queue_status: "waiting",
    referral_status: "ready_for_doctor",

    consultation_fee: 250,
    currency: "ZAR",

    stripe_checkout_session_id:
      payload.stripeSessionId,

    stripe_payment_intent_id:
      payload.stripePaymentIntentId,

    paid_at:
      payload.paidAt,

    updated_at:
      payload.paidAt,
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
    "Complete payment update failed. " +
      "Trying essential update only.",
    completeResult.error,
  );

  /*
   * This fallback allows the route to work even if some
   * optional columns have not yet been created.
   */
  const essentialResult = await supabase
    .from("symptomai_referrals")
    .update({
      payment_status: "paid",
      queue_status: "waiting",
      referral_status:
        "ready_for_doctor",
      updated_at: payload.paidAt,
    })
    .eq("id", referral.id)
    .select("*")
    .single();

  if (
    essentialResult.error ||
    !essentialResult.data
  ) {
    throw new Error(
      `Referral payment update failed: ${
        essentialResult.error?.message ||
        completeResult.error?.message ||
        "Unknown Supabase error."
      }`,
    );
  }

  return essentialResult.data as ReferralRecord;
}

async function sendReferralToCareScriber(
  payload: ReferralPayload,
): Promise<{
  success: boolean;
  status: number;
  response: unknown;
}> {
  const endpoint =
    buildCareScriberEndpoint();

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Accept: "application/json",
  };

  /*
   * Add this only if the CareScriber receiving endpoint
   * checks an API secret.
   */
  if (careScriberApiSecret) {
    headers.Authorization =
      `Bearer ${careScriberApiSecret}`;

    headers["x-api-key"] =
      careScriberApiSecret;
  }

  console.log(
    `Sending paid referral ${payload.referralCode} to ${endpoint}`,
  );

  const response = await fetch(endpoint, {
    method: "POST",
    headers,
    body: JSON.stringify(payload),
    cache: "no-store",
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
      responseBody = responseText;
    }
  }

  if (!response.ok) {
    console.error(
      "CareScriber referral API failed:",
      {
        referralCode:
          payload.referralCode,
        status: response.status,
        response: responseBody,
      },
    );

    throw new Error(
      `CareScriber rejected referral ${payload.referralCode}. ` +
        `HTTP ${response.status}: ${
          typeof responseBody === "string"
            ? responseBody
            : JSON.stringify(responseBody)
        }`,
    );
  }

  console.log(
    `Referral ${payload.referralCode} successfully sent to CareScriber.`,
  );

  return {
    success: true,
    status: response.status,
    response: responseBody,
  };
}

async function markCareScriberReleaseSuccess({
  referralId,
  releasedAt,
}: {
  referralId: string;
  releasedAt: string;
}) {
  const supabase = getSupabaseAdmin();

  /*
   * This is optional. If the release tracking columns do
   * not exist, the payment flow must still succeed.
   */
  const { error } = await supabase
    .from("symptomai_referrals")
    .update({
      carescriber_release_status:
        "released",

      released_to_carescriber_at:
        releasedAt,

      carescriber_release_error:
        null,

      updated_at:
        releasedAt,
    })
    .eq("id", referralId);

  if (error) {
    console.warn(
      "Referral was sent to CareScriber, but release tracking could not be updated:",
      error.message,
    );
  }
}

async function markCareScriberReleaseFailure({
  referralId,
  message,
}: {
  referralId: string;
  message: string;
}) {
  const supabase = getSupabaseAdmin();

  /*
   * This is also optional and should not hide the original
   * CareScriber API error.
   */
  const { error } = await supabase
    .from("symptomai_referrals")
    .update({
      carescriber_release_status:
        "failed",

      carescriber_release_error:
        message.slice(0, 1000),

      updated_at:
        new Date().toISOString(),
    })
    .eq("id", referralId);

  if (error) {
    console.warn(
      "Could not store the CareScriber release error:",
      error.message,
    );
  }
}

export async function GET() {
  return NextResponse.json({
    ok: true,
    service:
      "Stripe payment verification and CareScriber release",

    configured: {
      stripeSecretKey:
        Boolean(stripeSecretKey),

      supabaseUrl:
        Boolean(supabaseUrl),

      supabaseServiceRoleKey:
        Boolean(supabaseServiceRoleKey),

      careScriberApiUrl:
        Boolean(careScriberApiUrl),

      careScriberApiSecret:
        Boolean(careScriberApiSecret),
    },
  });
}

export async function POST(req: NextRequest) {
  try {
    if (!stripeSecretKey) {
      return NextResponse.json(
        {
          error:
            "STRIPE_SECRET_KEY is missing.",
        },
        { status: 500 },
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
        { status: 500 },
      );
    }

    if (!careScriberApiUrl) {
      return NextResponse.json(
        {
          error:
            "CARESCRIBER_API_URL is missing.",
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
          error:
            "A valid JSON request body is required.",
        },
        { status: 400 },
      );
    }

    const sessionId =
      typeof body.sessionId === "string"
        ? body.sessionId.trim()
        : "";

    const requestedReferralCode =
      normaliseReferralCode(
        body.referralCode,
      );

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

          paymentStatus:
            session.payment_status,

          sessionStatus:
            session.status,
        },
        { status: 400 },
      );
    }

    if (
      requestedReferralCode &&
      requestedReferralCode !==
        sessionReferralCode
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

        paymentStatus:
          session.payment_status,

        sessionStatus:
          session.status,

        referralCode:
          sessionReferralCode,

        sessionId:
          session.id,

        message:
          "The Stripe payment has not yet completed.",
      });
    }

    const referral =
      await findReferral(
        sessionReferralCode,
      );

    if (!referral) {
      return NextResponse.json(
        {
          paid: true,
          released: false,

          error:
            `Payment succeeded, but referral ${sessionReferralCode} ` +
            "was not found in symptomai_referrals.",

          referralCode:
            sessionReferralCode,

          sessionId:
            session.id,

          paymentStatus:
            session.payment_status,

          sessionStatus:
            session.status,
        },
        { status: 404 },
      );
    }

    const paidAt =
      referral.paid_at ||
      new Date().toISOString();

    const payload =
      buildReferralPayload({
        referral,
        session,
        referralCode:
          sessionReferralCode,
        paidAt,
      });

    /*
     * First update the SymptomAI database.
     */
    const updatedReferral =
      await updateReferralAsPaid({
        referral,
        payload,
      });

    /*
     * If this referral has already been released successfully,
     * do not create another duplicate inbox record.
     */
    const alreadyReleased =
      referral.carescriber_release_status ===
        "released" ||
      Boolean(
        referral.released_to_carescriber_at,
      );

    let careScriberResult:
      | {
          success: boolean;
          status: number;
          response: unknown;
        }
      | null = null;

    if (!alreadyReleased) {
      try {
        careScriberResult =
          await sendReferralToCareScriber(
            payload,
          );

        await markCareScriberReleaseSuccess({
          referralId:
            updatedReferral.id,
          releasedAt:
            new Date().toISOString(),
        });
      } catch (releaseError: unknown) {
        const releaseMessage =
          releaseError instanceof Error
            ? releaseError.message
            : "CareScriber release failed.";

        await markCareScriberReleaseFailure({
          referralId:
            updatedReferral.id,
          message:
            releaseMessage,
        });

        return NextResponse.json(
          {
            paid: true,
            released: false,

            paymentStatus:
              session.payment_status,

            sessionStatus:
              session.status,

            referralCode:
              sessionReferralCode,

            sessionId:
              session.id,

            paymentIntentId:
              getPaymentIntentId(session),

            queueStatus:
              updatedReferral.queue_status ||
              "waiting",

            referralStatus:
              updatedReferral.referral_status ||
              "ready_for_doctor",

            error:
              "Payment was confirmed, but the referral could not be sent to CareScriber.",

            details:
              releaseMessage,
          },
          { status: 502 },
        );
      }
    }

    return NextResponse.json({
      paid: true,
      released: true,
      alreadyReleased,

      paymentStatus:
        session.payment_status,

      sessionStatus:
        session.status,

      referralCode:
        sessionReferralCode,

      sessionId:
        session.id,

      paymentIntentId:
        getPaymentIntentId(session),

      queueStatus:
        updatedReferral.queue_status ||
        "waiting",

      referralStatus:
        updatedReferral.referral_status ||
        "ready_for_doctor",

      careScriberApiStatus:
        careScriberResult?.status ||
        null,

      careScriberResponse:
        careScriberResult?.response ||
        null,

      message: alreadyReleased
        ? "Payment was previously confirmed and the referral was already released to CareScriber."
        : "Payment confirmed. The referral has been sent to the CareScriber doctor inbox.",
    });
  } catch (error: unknown) {
    const message =
      error instanceof Error
        ? error.message
        : "Payment verification failed.";

    console.error(
      "Stripe verification error:",
      error,
    );

    if (
      error instanceof
      Stripe.errors.StripeError
    ) {
      return NextResponse.json(
        {
          error:
            error.message,
          type:
            error.type,
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
