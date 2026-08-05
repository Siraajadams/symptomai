import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { createClient } from "@supabase/supabase-js";
import { Resend } from "resend";

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

const resendApiKey =
  process.env.RESEND_API_KEY;

const paymentEmailFrom =
  process.env.PAYMENT_NOTIFICATION_FROM ||
  "CareScriber <prescriptions@carescriber.com>";

const paymentEmailRecipient =
  process.env.PAYMENT_NOTIFICATION_TO ||
  "info@videomed.co.za";

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
  national_id?: string | null;

  date_of_birth?: string | null;
  gender?: string | null;

  email?: string | null;
  mobile?: string | null;

  consultation_reason?: string | null;

  payment_status?: string | null;
  queue_status?: string | null;
  referral_status?: string | null;

  consultation_fee?: number | null;
  currency?: string | null;

  stripe_checkout_session_id?: string | null;
  stripe_payment_intent_id?: string | null;

  paid_at?: string | null;
  updated_at?: string | null;

  payment_notification_sent_at?: string | null;

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
  | "Payment email sent"
  | "Payment email skipped"
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
      "Supabase environment variables are not configured.",
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
      value.trim()
    ) {
      return value.trim();
    }
  }

  return null;
}

function getReferralCode(
  session: Stripe.Checkout.Session,
): string {
  const metadata =
    session.metadata || {};

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
  if (!careScriberApiUrl) {
    throw new Error(
      "CARESCRIBER_API_URL is missing.",
    );
  }

  const cleanUrl =
    careScriberApiUrl.replace(/\/+$/, "");

  if (
    cleanUrl.endsWith(
      "/api/symptomai-referral",
    )
  ) {
    return cleanUrl;
  }

  return `${cleanUrl}/api/symptomai-referral`;
}

function escapeHtml(
  value: unknown,
): string {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function formatSouthAfricanDate(
  value: string | Date,
): string {
  const date =
    value instanceof Date
      ? value
      : new Date(value);

  return new Intl.DateTimeFormat(
    "en-ZA",
    {
      timeZone:
        "Africa/Johannesburg",
      dateStyle:
        "long",
      timeStyle:
        "short",
    },
  ).format(date);
}

async function findReferral(
  referralCode: string,
): Promise<ReferralRecord | null> {
  const supabase =
    getSupabaseAdmin();

  /*
   * limit(1) avoids maybeSingle failing if an old
   * duplicate referral exists.
   */
  const { data, error } =
    await supabase
      .from(REFERRAL_TABLE)
      .select("*")
      .ilike(
        "referral_code",
        referralCode,
      )
      .order(
        "created_at",
        {
          ascending: false,
        },
      )
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
  const metadata =
    session.metadata || {};

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
    combinedPatientName ||
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
    referral.national_id ||
    null;

  const nationalId =
    getMetadataValue(
      metadata,
      "nationalId",
      "national_id",
      "patientId",
      "patient_id",
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
    patientFirstName,
    patientSurname,
    patientName,
    patientId,
    nationalId,
    patientEmail,
    patientMobile,
    consultationReason,
    consentToken,
    dateOfBirth,
    gender,
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
  const supabase =
    getSupabaseAdmin();

  const values =
    buildReferralValues({
      referral,
      session,
    });

  const paidAt =
    new Date().toISOString();

  /*
   * Attempt the complete update first.
   */
  const completeUpdate = {
    patient_first_name:
      values.patientFirstName,

    patient_surname:
      values.patientSurname,

    patient_name:
      values.patientName,

    patient_id:
      values.patientId,

    national_id:
      values.nationalId,

    date_of_birth:
      values.dateOfBirth,

    gender:
      values.gender,

    email:
      values.patientEmail,

    mobile:
      values.patientMobile,

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

  const completeResult =
    await supabase
      .from(REFERRAL_TABLE)
      .update(completeUpdate)
      .eq("id", referral.id)
      .select("*")
      .single();

  if (
    !completeResult.error &&
    completeResult.data
  ) {
    const updated =
      completeResult.data as ReferralRecord;

    trace(
      "Referral updated to paid",
      referralCode,
      {
        updateMode: "complete",
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
    `Complete update failed for ${referralCode}. ` +
      "Trying essential inbox fields.",
    completeResult.error?.message,
  );

  /*
   * Fallback for older schemas where optional patient,
   * Stripe or notification columns do not exist.
   */
  const essentialResult =
    await supabase
      .from(REFERRAL_TABLE)
      .update({
        payment_status:
          "paid",

        queue_status:
          "waiting",

        referral_status:
          "ready_for_doctor",

        consultation_reason:
          values.consultationReason,

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
        completeResult.error?.message ||
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

    nationalId:
      values.nationalId,

    national_id:
      values.nationalId,

    dateOfBirth:
      values.dateOfBirth,

    date_of_birth:
      values.dateOfBirth,

    gender:
      values.gender,

    patientEmail:
      values.patientEmail,

    patient_email:
      values.patientEmail,

    patientMobile:
      values.patientMobile,

    patient_mobile:
      values.patientMobile,

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

  const responseObject =
    responseBody &&
    typeof responseBody === "object"
      ? responseBody as Record<string, unknown>
      : null;

  trace(
    "Referral inserted into CareScriber",
    referralCode,
    {
      status:
        response.status,
      created:
        responseObject?.created ??
        null,
      referralId:
        responseObject?.referralId ??
        null,
      released:
        responseObject?.released ??
        true,
    },
  );

  return responseBody;
}

const labelStyle = [
  "padding:11px 8px 11px 0",
  "border-bottom:1px solid #e5e7eb",
  "font-weight:bold",
  "vertical-align:top",
  "width:38%",
].join(";");

const valueStyle = [
  "padding:11px 0",
  "border-bottom:1px solid #e5e7eb",
  "vertical-align:top",
].join(";");

async function sendPaymentNotification({
  referralCode,
  referral,
  session,
}: {
  referralCode: string;
  referral: ReferralRecord;
  session: Stripe.Checkout.Session;
}): Promise<string | null> {
  if (!resendApiKey) {
    trace(
      "Payment email skipped",
      referralCode,
      {
        reason:
          "RESEND_API_KEY is missing.",
      },
    );

    return null;
  }

  const resend =
    new Resend(resendApiKey);

  const paidAt =
    referral.paid_at ||
    new Date().toISOString();

  const paymentIntentId =
    getPaymentIntentId(session);

  const paymentReference =
    paymentIntentId ||
    session.id;

  const patientName =
    referral.patient_name ||
    [
      referral.patient_first_name,
      referral.patient_surname,
    ]
      .filter(Boolean)
      .join(" ") ||
    "Not provided";

  const amountPaid =
    typeof session.amount_total ===
    "number"
      ? session.amount_total / 100
      : 250;

  const currency =
    session.currency?.toUpperCase() ||
    "ZAR";

  const formattedAmount =
    new Intl.NumberFormat(
      "en-ZA",
      {
        style: "currency",
        currency,
      },
    ).format(amountPaid);

  const formattedDate =
    formatSouthAfricanDate(
      paidAt,
    );

  const subject =
    `New GP consultation payment – ${referralCode}`;

  const html = `
    <!doctype html>
    <html lang="en">
      <body
        style="
          margin:0;
          padding:0;
          background:#f4f7f6;
          font-family:Arial,Helvetica,sans-serif;
          color:#1f2937;
        "
      >
        <div
          style="
            max-width:680px;
            margin:0 auto;
            padding:30px 16px;
          "
        >
          <div
            style="
              background:#ffffff;
              border:1px solid #e5e7eb;
              border-radius:14px;
              overflow:hidden;
            "
          >
            <div
              style="
                background:#087f5b;
                padding:24px 28px;
              "
            >
              <h1
                style="
                  margin:0;
                  color:#ffffff;
                  font-size:22px;
                "
              >
                Consultation payment received
              </h1>

              <p
                style="
                  margin:8px 0 0;
                  color:#d1fae5;
                  font-size:14px;
                "
              >
                SymptomAI virtual GP consultation
              </p>
            </div>

            <div style="padding:28px;">
              <table
                style="
                  width:100%;
                  border-collapse:collapse;
                  font-size:14px;
                "
              >
                <tr>
                  <td style="${labelStyle}">
                    Referral code
                  </td>
                  <td style="${valueStyle}">
                    ${escapeHtml(referralCode)}
                  </td>
                </tr>

                <tr>
                  <td style="${labelStyle}">
                    Amount paid
                  </td>
                  <td style="${valueStyle}">
                    ${escapeHtml(formattedAmount)}
                  </td>
                </tr>

                <tr>
                  <td style="${labelStyle}">
                    Payment reference
                  </td>
                  <td style="${valueStyle}">
                    ${escapeHtml(paymentReference)}
                  </td>
                </tr>

                <tr>
                  <td style="${labelStyle}">
                    Patient
                  </td>
                  <td style="${valueStyle}">
                    ${escapeHtml(patientName)}
                  </td>
                </tr>

                <tr>
                  <td style="${labelStyle}">
                    Patient ID
                  </td>
                  <td style="${valueStyle}">
                    ${escapeHtml(
                      referral.patient_id ||
                        "Not provided",
                    )}
                  </td>
                </tr>

                <tr>
                  <td style="${labelStyle}">
                    Consultation reason
                  </td>
                  <td style="${valueStyle}">
                    ${escapeHtml(
                      referral.consultation_reason ||
                        "Not provided",
                    )}
                  </td>
                </tr>

                <tr>
                  <td style="${labelStyle}">
                    Payment date
                  </td>
                  <td style="${valueStyle}">
                    ${escapeHtml(formattedDate)}
                  </td>
                </tr>
              </table>

              <div
                style="
                  margin-top:22px;
                  padding:16px;
                  background:#ecfdf5;
                  border:1px solid #a7f3d0;
                  border-radius:10px;
                "
              >
                <strong>CareScriber status:</strong>
                The referral has been released to the doctor inbox.
              </div>
            </div>
          </div>
        </div>
      </body>
    </html>
  `;

  const text = `
A SymptomAI consultation payment was successful.

Referral code: ${referralCode}
Amount paid: ${formattedAmount}
Payment reference: ${paymentReference}

Patient: ${patientName}
Patient ID: ${referral.patient_id || "Not provided"}

Consultation reason:
${referral.consultation_reason || "Not provided"}

Payment date:
${formattedDate}

The referral has been released to the CareScriber doctor inbox.
  `.trim();

  const { data, error } =
    await resend.emails.send({
      from:
        paymentEmailFrom,

      to:
        [paymentEmailRecipient],

      subject,
      html,
      text,
    });

  if (error) {
    throw new Error(
      error.message,
    );
  }

  trace(
    "Payment email sent",
    referralCode,
    {
      emailId:
        data?.id || null,
      recipient:
        paymentEmailRecipient,
    },
  );

  return data?.id || null;
}

async function recordNotificationResult({
  referralId,
  emailId,
  errorMessage,
}: {
  referralId: string;
  emailId?: string | null;
  errorMessage?: string | null;
}) {
  const supabase =
    getSupabaseAdmin();

  const payload =
    emailId
      ? {
          payment_notification_sent_at:
            new Date().toISOString(),

          payment_notification_email_id:
            emailId,

          payment_notification_error:
            null,
        }
      : {
          payment_notification_error:
            errorMessage ||
            "Notification was not sent.",
        };

  const { error } =
    await supabase
      .from(REFERRAL_TABLE)
      .update(payload)
      .eq("id", referralId);

  /*
   * Notification tracking columns are optional.
   */
  if (error) {
    console.warn(
      "Could not save payment email status:",
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
      processed: false,
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
    /*
     * Permanent Checkout configuration issue.
     */
    return {
      processed: false,
      permanentError: true,
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
        existingReferral?.id || null,
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
      processed: false,
      permanentError: true,
      reason:
        `No referral was found for ${referralCode}.`,
    };
  }

  const alreadyReleasedLocally =
    existingReferral.payment_status ===
      "paid" &&
    existingReferral.queue_status ===
      "waiting" &&
    existingReferral.referral_status ===
      "ready_for_doctor";

  let updatedReferral =
    existingReferral;

  /*
   * Updating again is safe, but avoid unnecessary writes.
   */
  if (!alreadyReleasedLocally) {
    updatedReferral =
      await updateReferralAsPaid({
        referral:
          existingReferral,
        session,
        referralCode,
      });
  } else {
    trace(
      "Referral updated to paid",
      referralCode,
      {
        skipped:
          true,
        reason:
          "Referral was already marked paid and waiting.",
        referralId:
          existingReferral.id,
        paymentStatus:
          existingReferral.payment_status,
        queueStatus:
          existingReferral.queue_status,
        referralStatus:
          existingReferral.referral_status,
      },
    );
  }

  /*
   * This is the missing cross-application step.
   */
  const careScriberResponse =
    await sendReferralToCareScriber({
      referral:
        updatedReferral,
      session,
      referralCode,
    });

  /*
   * Email failure must never undo payment or inbox release.
   */
  try {
    const notificationAlreadySent =
      Boolean(
        updatedReferral
          .payment_notification_sent_at,
      );

    if (!notificationAlreadySent) {
      const emailId =
        await sendPaymentNotification({
          referralCode,
          referral:
            updatedReferral,
          session,
        });

      if (emailId) {
        await recordNotificationResult({
          referralId:
            updatedReferral.id,
          emailId,
        });
      }
    } else {
      trace(
        "Payment email skipped",
        referralCode,
        {
          reason:
            "Notification was already sent.",
        },
      );
    }
  } catch (emailError: unknown) {
    const message =
      emailError instanceof Error
        ? emailError.message
        : "Payment notification email failed.";

    console.error(
      "Payment notification failed:",
      message,
    );

    await recordNotificationResult({
      referralId:
        updatedReferral.id,
      errorMessage:
        message,
    });
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
      "paid",

    queueStatus:
      "waiting",

    referralStatus:
      "ready_for_doctor",

    careScriberResponse,
  };
}

export async function GET() {
  return NextResponse.json({
    ok: true,

    service:
      "SymptomAI Stripe webhook and CareScriber release",

    route:
      "/api/stripe/webhook",

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

      careScriberApiSecret:
        Boolean(
          careScriberApiSecret,
        ),

      resendApiKey:
        Boolean(
          resendApiKey,
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
          "Supabase environment variables are missing.",
      },
      {
        status: 500,
      },
    );
  }

  if (!careScriberApiUrl) {
    return NextResponse.json(
      {
        error:
          "CARESCRIBER_API_URL is missing.",
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
    /*
     * Stripe requires the exact unparsed body.
     */
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
        getReferralCode(
          session,
        );

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

    /*
     * Stripe will retry when a genuine temporary or
     * integration error returns 500.
     */
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
