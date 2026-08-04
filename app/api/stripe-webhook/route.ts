import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { createClient } from "@supabase/supabase-js";
import { Resend } from "resend";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
const stripeWebhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceRoleKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY;

const resendApiKey = process.env.RESEND_API_KEY;

const paymentEmailFrom =
  process.env.PAYMENT_NOTIFICATION_FROM ||
  "CareScriber <prescriptions@carescriber.com>";

const paymentEmailRecipient =
  process.env.PAYMENT_NOTIFICATION_TO ||
  "info@videomed.co.za";

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
  payment_notification_sent_at?: string | null;
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

function escapeHtml(value: unknown): string {
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
    value instanceof Date ? value : new Date(value);

  return new Intl.DateTimeFormat("en-ZA", {
    timeZone: "Africa/Johannesburg",
    dateStyle: "long",
    timeStyle: "short",
  }).format(date);
}

function normaliseReferralCode(
  value: string | null | undefined,
): string {
  return String(value || "")
    .trim()
    .toUpperCase();
}

function getPaymentIntentId(
  session: Stripe.Checkout.Session,
): string | null {
  if (typeof session.payment_intent === "string") {
    return session.payment_intent;
  }

  return session.payment_intent?.id || null;
}

/**
 * Extract the referral code from metadata first.
 *
 * client_reference_id is included as a fallback and should
 * also be populated when creating the Checkout Session.
 */
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

function getMetadataValue(
  metadata: Stripe.Metadata | null,
  ...keys: string[]
): string | null {
  if (!metadata) {
    return null;
  }

  for (const key of keys) {
    const value = metadata[key];

    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
  }

  return null;
}

async function findReferral(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  referralCode: string,
): Promise<ReferralRecord | null> {
  /*
   * select("*") avoids webhook failure when one of the
   * optional notification columns is not present.
   */
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

/**
 * Some deployments may not yet have every newer payment
 * column. We attempt the full update first, then fall back
 * to the essential inbox fields.
 */
async function releaseReferralToInbox({
  supabase,
  existingReferral,
  session,
  referralCode,
}: {
  supabase: ReturnType<typeof getSupabaseAdmin>;
  existingReferral: ReferralRecord;
  session: Stripe.Checkout.Session;
  referralCode: string;
}): Promise<ReferralRecord> {
  const metadata = session.metadata || {};

  const firstName = getMetadataValue(
    metadata,
    "patientFirstName",
    "patient_first_name",
  );

  const surname = getMetadataValue(
    metadata,
    "patientSurname",
    "patient_surname",
  );

  const metadataName = getMetadataValue(
    metadata,
    "patientName",
    "patient_name",
  );

  const combinedName =
    [firstName, surname].filter(Boolean).join(" ") ||
    null;

  const patientName =
    metadataName ||
    combinedName ||
    (existingReferral.patient_name as string | null) ||
    null;

  const patientId =
    getMetadataValue(
      metadata,
      "patientId",
      "patient_id",
      "nationalId",
      "national_id",
    ) ||
    (existingReferral.patient_id as string | null) ||
    null;

  const patientEmail =
    getMetadataValue(
      metadata,
      "patientEmail",
      "patient_email",
    ) ||
    session.customer_details?.email ||
    session.customer_email ||
    (existingReferral.email as string | null) ||
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
    (existingReferral.mobile as string | null) ||
    null;

  const consultationReason =
    getMetadataValue(
      metadata,
      "consultationReason",
      "consultation_reason",
    ) ||
    (existingReferral.consultation_reason as
      | string
      | null) ||
    null;

  const paidAt = new Date().toISOString();
  const paymentIntentId = getPaymentIntentId(session);

  const fullUpdate = {
    patient_first_name:
      firstName || existingReferral.patient_first_name,

    patient_surname:
      surname || existingReferral.patient_surname,

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

  const fullResult = await supabase
    .from("symptomai_referrals")
    .update(fullUpdate)
    .eq("id", existingReferral.id)
    .select("*")
    .single();

  if (!fullResult.error && fullResult.data) {
    return fullResult.data as ReferralRecord;
  }

  console.warn(
    `Full referral update failed for ${referralCode}. ` +
      "Attempting essential inbox update:",
    fullResult.error,
  );

  /*
   * Essential fallback. These are the fields required by
   * the CareScriber Virtual Consult Inbox.
   */
  const essentialUpdate = {
    payment_status: "paid",
    queue_status: "waiting",
    referral_status: "ready_for_doctor",
    updated_at: paidAt,
  };

  const essentialResult = await supabase
    .from("symptomai_referrals")
    .update(essentialUpdate)
    .eq("id", existingReferral.id)
    .select("*")
    .single();

  if (essentialResult.error || !essentialResult.data) {
    throw new Error(
      `Referral release failed: ${
        essentialResult.error?.message ||
        fullResult.error?.message ||
        "Unknown database error."
      }`,
    );
  }

  return essentialResult.data as ReferralRecord;
}

async function sendPaymentNotification({
  referralCode,
  referral,
  session,
}: {
  referralCode: string;
  referral: ReferralRecord;
  session: Stripe.Checkout.Session;
}): Promise<string | null> {
  /*
   * Email is optional. It must never prevent the referral
   * from reaching the doctor inbox.
   */
  if (!resendApiKey) {
    console.warn(
      "RESEND_API_KEY is missing. Payment email skipped.",
    );

    return null;
  }

  const resend = new Resend(resendApiKey);
  const paidAt = new Date().toISOString();

  const paymentIntentId = getPaymentIntentId(session);
  const paymentReference =
    paymentIntentId || session.id;

  const patientName =
    (referral.patient_name as string | null) ||
    [
      referral.patient_first_name,
      referral.patient_surname,
    ]
      .filter(Boolean)
      .join(" ") ||
    "Not provided";

  const amountPaid =
    typeof session.amount_total === "number"
      ? session.amount_total / 100
      : 250;

  const currency =
    session.currency?.toUpperCase() || "ZAR";

  const formattedAmount = new Intl.NumberFormat(
    "en-ZA",
    {
      style: "currency",
      currency,
    },
  ).format(amountPaid);

  const formattedDate =
    formatSouthAfricanDate(paidAt);

  const subject =
    `New GP consultation payment – ${referralCode}`;

  const html = `
    <!doctype html>
    <html lang="en">
      <head>
        <meta charset="utf-8" />
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1"
        />
      </head>

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
                    Payment status
                  </td>
                  <td style="${valueStyle}">
                    PAID
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
                    Patient email
                  </td>
                  <td style="${valueStyle}">
                    ${escapeHtml(
                      referral.email ||
                        "Not provided",
                    )}
                  </td>
                </tr>

                <tr>
                  <td style="${labelStyle}">
                    Patient mobile
                  </td>
                  <td style="${valueStyle}">
                    ${escapeHtml(
                      referral.mobile ||
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
                The referral has been released to the
                doctor inbox.
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
Payment status: PAID
Payment reference: ${paymentReference}

Patient: ${patientName}
Patient ID: ${referral.patient_id || "Not provided"}
Patient email: ${referral.email || "Not provided"}
Patient mobile: ${referral.mobile || "Not provided"}

Consultation reason:
${referral.consultation_reason || "Not provided"}

Payment date:
${formattedDate}

The referral has been released to the CareScriber doctor inbox.
  `.trim();

  const { data, error } = await resend.emails.send({
    from: paymentEmailFrom,
    to: [paymentEmailRecipient],
    subject,
    html,
    text,
  });

  if (error) {
    throw new Error(error.message);
  }

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
  const supabase = getSupabaseAdmin();

  const payload = emailId
    ? {
        payment_notification_sent_at:
          new Date().toISOString(),
        payment_notification_email_id: emailId,
        payment_notification_error: null,
      }
    : {
        payment_notification_error:
          errorMessage || "Notification was not sent.",
      };

  const { error } = await supabase
    .from("symptomai_referrals")
    .update(payload)
    .eq("id", referralId);

  /*
   * These notification columns are optional. A missing
   * column must not fail the payment webhook.
   */
  if (error) {
    console.warn(
      "Could not save payment email status:",
      error.message,
    );
  }
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

export async function GET() {
  return NextResponse.json({
    ok: true,
    service: "CareScriber Stripe webhook",
    route: "/api/stripe/webhook",
    configured: {
      stripeSecretKey: Boolean(stripeSecretKey),
      stripeWebhookSecret: Boolean(
        stripeWebhookSecret,
      ),
      supabaseUrl: Boolean(supabaseUrl),
      supabaseServiceRoleKey: Boolean(
        supabaseServiceRoleKey,
      ),
      resendApiKey: Boolean(resendApiKey),
    },
  });
}

export async function POST(req: NextRequest) {
  if (!stripeSecretKey) {
    return NextResponse.json(
      {
        error: "STRIPE_SECRET_KEY is missing.",
      },
      { status: 500 },
    );
  }

  if (!stripeWebhookSecret) {
    return NextResponse.json(
      {
        error: "STRIPE_WEBHOOK_SECRET is missing.",
      },
      { status: 500 },
    );
  }

  const signature =
    req.headers.get("stripe-signature");

  if (!signature) {
    return NextResponse.json(
      {
        error:
          "Stripe signature header is missing.",
      },
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
        error: message,
      },
      { status: 400 },
    );
  }

  /*
   * Acknowledge unrelated events immediately.
   * Do not query Supabase or send email for them.
   */
  const supportedEvents = new Set([
    "checkout.session.completed",
    "checkout.session.async_payment_succeeded",
    "checkout.session.expired",
  ]);

  if (!supportedEvents.has(event.type)) {
    return NextResponse.json({
      received: true,
      processed: false,
      ignored: true,
      eventType: event.type,
    });
  }

  try {
    const supabase = getSupabaseAdmin();

    if (event.type === "checkout.session.expired") {
      const session =
        event.data.object as Stripe.Checkout.Session;

      const referralCode =
        getReferralCode(session);

      if (referralCode) {
        const { error } = await supabase
          .from("symptomai_referrals")
          .update({
            payment_status: "expired",
            queue_status: "not_released",
            referral_status: "awaiting_payment",
            updated_at: new Date().toISOString(),
          })
          .ilike("referral_code", referralCode)
          .neq("payment_status", "paid");

        if (error) {
          /*
           * Expiry processing is non-critical.
           * A failed expiry must not create continuous
           * webhook retries.
           */
          console.warn(
            `Could not expire referral ${referralCode}:`,
            error.message,
          );
        }
      }

      return NextResponse.json({
        received: true,
        processed: true,
        eventType: event.type,
        referralCode: referralCode || null,
      });
    }

    const session =
      event.data.object as Stripe.Checkout.Session;

    if (session.payment_status !== "paid") {
      return NextResponse.json({
        received: true,
        processed: false,
        reason: "Payment is not marked as paid.",
        paymentStatus: session.payment_status,
      });
    }

    const referralCode =
      getReferralCode(session);

    if (!referralCode) {
      /*
       * This is a permanent Checkout configuration issue.
       * Return 200 so Stripe does not retry forever.
       */
      console.error(
        `Paid Checkout Session ${session.id} has no ` +
          "referral code in metadata or client_reference_id.",
      );

      return NextResponse.json({
        received: true,
        processed: false,
        permanentError: true,
        reason:
          "No referral code was attached to the Checkout Session.",
        stripeSessionId: session.id,
      });
    }

    const existingReferral =
      await findReferral(
        supabase,
        referralCode,
      );

    if (!existingReferral) {
      /*
       * A missing database record will not be corrected by
       * repeatedly retrying the same Stripe event.
       */
      console.error(
        `No SymptomAI referral exists for ${referralCode}.`,
      );

      return NextResponse.json({
        received: true,
        processed: false,
        permanentError: true,
        reason:
          `No referral was found for ${referralCode}.`,
        referralCode,
        stripeSessionId: session.id,
      });
    }

    const alreadyReleased =
      existingReferral.payment_status === "paid" &&
      existingReferral.queue_status === "waiting" &&
      existingReferral.referral_status ===
        "ready_for_doctor";

    let updatedReferral = existingReferral;

    if (!alreadyReleased) {
      updatedReferral =
        await releaseReferralToInbox({
          supabase,
          existingReferral,
          session,
          referralCode,
        });
    }

    /*
     * Return successful payment processing independently
     * of notification email delivery.
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
            referral: updatedReferral,
            session,
          });

        if (emailId) {
          await recordNotificationResult({
            referralId: existingReferral.id,
            emailId,
          });
        }
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
        referralId: existingReferral.id,
        errorMessage: message,
      });

      /*
       * Do not throw. The payment and doctor-inbox release
       * have already succeeded.
       */
    }

    console.log(
      `Referral ${referralCode} released to CareScriber.`,
    );

    return NextResponse.json({
      received: true,
      processed: true,
      alreadyReleased,
      referralCode,
      stripeSessionId: session.id,
      paymentStatus: "paid",
      queueStatus: "waiting",
      referralStatus: "ready_for_doctor",
    });
  } catch (error: unknown) {
    const message =
      error instanceof Error
        ? error.message
        : "Stripe webhook processing failed.";

    console.error(
      "Stripe webhook processing error:",
      message,
    );

    /*
     * Return 500 only for genuine temporary failures,
     * such as Supabase being unavailable.
     */
    return NextResponse.json(
      {
        error: message,
        eventType: event.type,
      },
      { status: 500 },
    );
  }
}
