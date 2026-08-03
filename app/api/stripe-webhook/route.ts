import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { createClient } from "@supabase/supabase-js";
import { Resend } from "resend";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

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

function getResend() {
  if (!resendApiKey) {
    throw new Error("RESEND_API_KEY is missing.");
  }

  return new Resend(resendApiKey);
}

function escapeHtml(value: unknown): string {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function formatSouthAfricanDate(value: string | Date): string {
  const date =
    value instanceof Date ? value : new Date(value);

  return new Intl.DateTimeFormat("en-ZA", {
    timeZone: "Africa/Johannesburg",
    dateStyle: "long",
    timeStyle: "short",
  }).format(date);
}

async function sendPaymentNotification({
  referralCode,
  patientName,
  patientId,
  patientEmail,
  patientMobile,
  consultationReason,
  paymentIntentId,
  stripeSessionId,
  paidAt,
}: {
  referralCode: string;
  patientName: string | null;
  patientId: string | null;
  patientEmail: string | null;
  patientMobile: string | null;
  consultationReason: string | null;
  paymentIntentId: string | null;
  stripeSessionId: string;
  paidAt: string;
}) {
  const resend = getResend();

  const subject =
    `New GP Consultation Payment Received – ${referralCode}`;

  const paymentReference =
    paymentIntentId || stripeSessionId;

  const formattedDate =
    formatSouthAfricanDate(paidAt);

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
                SymptomAI GP consultation
              </p>
            </div>

            <div style="padding:28px;">
              <p style="margin-top:0;">
                A patient has successfully paid R250 for a
                VideoMed GP consultation.
              </p>

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
                    Amount
                  </td>
                  <td style="${valueStyle}">
                    R250.00
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
                    ${escapeHtml(
                      patientName || "Not provided",
                    )}
                  </td>
                </tr>

                <tr>
                  <td style="${labelStyle}">
                    Patient ID
                  </td>
                  <td style="${valueStyle}">
                    ${escapeHtml(
                      patientId || "Not provided",
                    )}
                  </td>
                </tr>

                <tr>
                  <td style="${labelStyle}">
                    Patient email
                  </td>
                  <td style="${valueStyle}">
                    ${escapeHtml(
                      patientEmail || "Not provided",
                    )}
                  </td>
                </tr>

                <tr>
                  <td style="${labelStyle}">
                    Patient mobile
                  </td>
                  <td style="${valueStyle}">
                    ${escapeHtml(
                      patientMobile || "Not provided",
                    )}
                  </td>
                </tr>

                <tr>
                  <td style="${labelStyle}">
                    Consultation reason
                  </td>
                  <td style="${valueStyle}">
                    ${escapeHtml(
                      consultationReason ||
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
                The referral has been released to the doctor
                referral inbox.
              </div>
            </div>
          </div>
        </div>
      </body>
    </html>
  `;

  const text = `
A SymptomAI consultation payment was successful.

Referral Code: ${referralCode}
Amount: R250.00
Payment Status: PAID
Payment Reference: ${paymentReference}

Patient: ${patientName || "Not provided"}
Patient ID: ${patientId || "Not provided"}
Patient Email: ${patientEmail || "Not provided"}
Patient Mobile: ${patientMobile || "Not provided"}

Consultation Reason:
${consultationReason || "Not provided"}

Payment Date:
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
    throw new Error(
      `Payment notification email failed: ${error.message}`,
    );
  }

  return data;
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

/*
 * Opening this endpoint in a browser confirms that
 * the webhook route exists.
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
    /*
     * Stripe signature verification requires the
     * unmodified raw request body.
     */
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

    if (
      event.type === "checkout.session.completed" ||
      event.type ===
        "checkout.session.async_payment_succeeded"
    ) {
      const session =
        event.data.object as Stripe.Checkout.Session;

      if (session.payment_status !== "paid") {
        console.log(
          `Session ${session.id} is ${session.payment_status}.`,
        );

        return NextResponse.json({
          received: true,
          processed: false,
          reason: "Payment not yet marked as paid.",
        });
      }

      const metadata = session.metadata || {};

      const referralCode =
        metadata.referralCode ||
        metadata.referral_code ||
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

      const metadataPatientName =
        metadata.patientName ||
        metadata.patient_name ||
        null;

      const patientName =
        metadataPatientName ||
        [patientFirstName, patientSurname]
          .filter(Boolean)
          .join(" ") ||
        null;

      const patientId =
        metadata.patientId ||
        metadata.patient_id ||
        null;

      const patientEmail =
        metadata.patientEmail ||
        metadata.patient_email ||
        session.customer_details?.email ||
        session.customer_email ||
        null;

      const patientMobile =
        metadata.patientMobile ||
        metadata.patient_mobile ||
        metadata.patientPhone ||
        metadata.patient_phone ||
        session.customer_details?.phone ||
        null;

      if (!referralCode) {
        console.error(
          `Stripe session ${session.id} has no referral code.`,
          metadata,
        );

        /*
         * This is a permanent metadata/configuration error.
         * Returning 200 avoids endless Stripe retries.
         */
        return NextResponse.json({
          received: true,
          processed: false,
          reason:
            "Paid session has no referral code metadata.",
        });
      }

      const paymentIntentId =
        typeof session.payment_intent === "string"
          ? session.payment_intent
          : session.payment_intent?.id || null;

      /*
       * Check the existing referral first.
       * This prevents duplicate emails when Stripe retries.
       */
      const {
        data: existingReferral,
        error: lookupError,
      } = await supabase
        .from("symptomai_referrals")
        .select(
          `
            id,
            referral_code,
            consent_token,
            patient_first_name,
            patient_surname,
            patient_name,
            patient_id,
            email,
            mobile,
            consultation_reason,
            payment_status,
            queue_status,
            referral_status,
            payment_notification_sent_at
          `,
        )
        .eq("referral_code", referralCode)
        .maybeSingle();

      if (lookupError) {
        throw new Error(
          `Could not look up referral ${referralCode}: ${lookupError.message}`,
        );
      }

      if (!existingReferral) {
        console.error(
          `No referral row found for ${referralCode}.`,
        );

        return NextResponse.json(
          {
            error:
              `No referral was found for ${referralCode}.`,
          },
          { status: 500 },
        );
      }

      const paidAt =
        new Date().toISOString();

      /*
       * Update SymptomAI and release the record to
       * the CareScriber inbox.
       */
      const {
        data: updatedReferral,
        error: updateError,
      } = await supabase
        .from("symptomai_referrals")
        .update({
          consultation_reason:
            consultationReason ||
            existingReferral.consultation_reason,

          patient_first_name:
            patientFirstName ||
            existingReferral.patient_first_name,

          patient_surname:
            patientSurname ||
            existingReferral.patient_surname,

          patient_name:
            patientName ||
            existingReferral.patient_name,

          patient_id:
            patientId ||
            existingReferral.patient_id,

          email:
            patientEmail ||
            existingReferral.email,

          mobile:
            patientMobile ||
            existingReferral.mobile,

          payment_status: "paid",

          /*
           * CareScriber should query records with
           * queue_status = waiting and
           * referral_status = ready_for_doctor.
           */
          queue_status: "waiting",
          referral_status: "ready_for_doctor",

          consultation_fee: 250,
          currency: "ZAR",

          stripe_checkout_session_id:
            session.id,

          stripe_payment_intent_id:
            paymentIntentId,

          paid_at: paidAt,
          updated_at: paidAt,
        })
        .eq("id", existingReferral.id)
        .select(
          `
            id,
            referral_code,
            patient_first_name,
            patient_surname,
            patient_name,
            patient_id,
            email,
            mobile,
            consultation_reason,
            payment_status,
            queue_status,
            referral_status,
            payment_notification_sent_at
          `,
        )
        .single();

      if (updateError) {
        throw new Error(
          `Could not update referral ${referralCode}: ${updateError.message}`,
        );
      }

      let emailSent = false;

      /*
       * Stripe can retry the same event.
       * Only send an email if it has not already
       * been recorded as sent.
       */
      if (
        !existingReferral.payment_notification_sent_at
      ) {
        const emailResult =
          await sendPaymentNotification({
            referralCode,
            patientName:
              updatedReferral.patient_name ||
              [
                updatedReferral.patient_first_name,
                updatedReferral.patient_surname,
              ]
                .filter(Boolean)
                .join(" ") ||
              null,

            patientId:
              updatedReferral.patient_id,

            patientEmail:
              updatedReferral.email,

            patientMobile:
              updatedReferral.mobile,

            consultationReason:
              updatedReferral.consultation_reason,

            paymentIntentId,
            stripeSessionId: session.id,
            paidAt,
          });

        const { error: notificationUpdateError } =
          await supabase
            .from("symptomai_referrals")
            .update({
              payment_notification_sent_at:
                new Date().toISOString(),

              payment_notification_email_id:
                emailResult?.id || null,

              payment_notification_error: null,
            })
            .eq("id", existingReferral.id);

        if (notificationUpdateError) {
          throw new Error(
            "Email was sent, but its status could not " +
              `be saved: ${notificationUpdateError.message}`,
          );
        }

        emailSent = true;
      }

      console.log(
        `Payment confirmed. Referral ${referralCode} released to CareScriber.`,
      );

      return NextResponse.json({
        received: true,
        processed: true,
        referralCode,
        paymentStatus: "paid",
        queueStatus: "waiting",
        referralStatus: "ready_for_doctor",
        notificationEmailSent: emailSent,
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
            queue_status: "not_released",
            updated_at: new Date().toISOString(),
          })
          .eq("referral_code", referralCode)
          .neq("payment_status", "paid");

        if (error) {
          console.error(
            `Could not expire referral ${referralCode}:`,
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

    /*
     * Returning 500 allows Stripe to retry
     * temporary database or email failures.
     */
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
