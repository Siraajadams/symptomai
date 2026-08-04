import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const stripeSecretKey = process.env.STRIPE_SECRET_KEY;

type PaymentRequestBody = {
  referralCode?: string;
  consentToken?: string;
  consultationReason?: string;

  patientName?: string;
  patientFirstName?: string;
  patientSurname?: string;

  patientEmail?: string;
  patientMobile?: string;

  patientId?: string;
  nationalId?: string;

  dateOfBirth?: string;
  gender?: string;
};

function getStripe(): Stripe {
  if (!stripeSecretKey) {
    throw new Error(
      "Stripe is not configured. Add STRIPE_SECRET_KEY in Vercel.",
    );
  }

  return new Stripe(stripeSecretKey);
}

function getBaseUrl(req: NextRequest): string {
  const configuredUrl =
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.APP_URL ||
    process.env.VERCEL_PROJECT_PRODUCTION_URL;

  if (configuredUrl) {
    const cleanUrl = configuredUrl.replace(/\/+$/, "");

    if (
      cleanUrl.startsWith("http://") ||
      cleanUrl.startsWith("https://")
    ) {
      return cleanUrl;
    }

    return `https://${cleanUrl}`;
  }

  return req.nextUrl.origin;
}

function cleanValue(
  value: string | undefined,
  maxLength: number,
): string {
  return String(value || "")
    .trim()
    .substring(0, maxLength);
}

function normaliseReferralCode(
  value: string | undefined,
): string {
  return String(value || "")
    .trim()
    .toUpperCase();
}

function isValidEmail(value: string): boolean {
  if (!value) {
    return true;
  }

  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

export async function GET() {
  return NextResponse.json({
    ok: true,
    service: "SymptomAI virtual-consult payment",
    configured: {
      stripeSecretKey: Boolean(stripeSecretKey),
      appUrl: Boolean(
        process.env.NEXT_PUBLIC_APP_URL ||
          process.env.APP_URL ||
          process.env.VERCEL_PROJECT_PRODUCTION_URL,
      ),
    },
    amount: {
      value: 250,
      currency: "ZAR",
    },
  });
}

export async function POST(req: NextRequest) {
  try {
    if (!stripeSecretKey) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Stripe is not configured. Add STRIPE_SECRET_KEY in Vercel.",
        },
        { status: 500 },
      );
    }

    let body: PaymentRequestBody;

    try {
      body = (await req.json()) as PaymentRequestBody;
    } catch {
      return NextResponse.json(
        {
          success: false,
          error: "A valid JSON request body is required.",
        },
        { status: 400 },
      );
    }

    const referralCode = normaliseReferralCode(
      body.referralCode,
    );

    const consentToken = cleanValue(
      body.consentToken,
      100,
    );

    const consultationReason = cleanValue(
      body.consultationReason,
      500,
    );

    const patientFirstName = cleanValue(
      body.patientFirstName,
      100,
    );

    const patientSurname = cleanValue(
      body.patientSurname,
      100,
    );

    const suppliedPatientName = cleanValue(
      body.patientName,
      200,
    );

    const combinedPatientName = [
      patientFirstName,
      patientSurname,
    ]
      .filter(Boolean)
      .join(" ");

    const patientName =
      suppliedPatientName ||
      combinedPatientName ||
      "SymptomAI Patient";

    const patientEmail = cleanValue(
      body.patientEmail,
      200,
    );

    const patientMobile = cleanValue(
      body.patientMobile,
      50,
    );

    const patientId = cleanValue(
      body.patientId,
      200,
    );

    const nationalId = cleanValue(
      body.nationalId,
      200,
    );

    const dateOfBirth = cleanValue(
      body.dateOfBirth,
      30,
    );

    const gender = cleanValue(
      body.gender,
      50,
    );

    if (!referralCode) {
      return NextResponse.json(
        {
          success: false,
          error: "Referral code is required.",
        },
        { status: 400 },
      );
    }

    if (!consentToken) {
      return NextResponse.json(
        {
          success: false,
          error: "Patient consent token is required.",
        },
        { status: 400 },
      );
    }

    if (!consultationReason) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Reason for consultation or prescription request is required.",
        },
        { status: 400 },
      );
    }

    if (
      patientEmail &&
      !isValidEmail(patientEmail)
    ) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Please provide a valid patient email address.",
        },
        { status: 400 },
      );
    }

    const baseUrl = getBaseUrl(req);
    const stripe = getStripe();

    /*
     * Both snake_case and camelCase metadata are included.
     *
     * This allows the verification endpoint to read the
     * metadata regardless of which naming format it expects.
     */
    const paymentMetadata: Stripe.MetadataParam = {
      referralCode,
      referral_code: referralCode,

      consentToken,
      consent_token: consentToken,

      consultationReason,
      consultation_reason: consultationReason,

      patientName,
      patient_name: patientName,

      patientFirstName,
      patient_first_name: patientFirstName,

      patientSurname,
      patient_surname: patientSurname,

      patientEmail,
      patient_email: patientEmail,

      patientMobile,
      patient_mobile: patientMobile,

      patientId,
      patient_id: patientId,

      nationalId,
      national_id: nationalId,

      dateOfBirth,
      date_of_birth: dateOfBirth,

      gender,

      service: "symptomai_virtual_gp",
      source: "symptomai",
    };

    const successUrl =
      `${baseUrl}/?payment=success` +
      `&session_id={CHECKOUT_SESSION_ID}` +
      `&referral_code=${encodeURIComponent(
        referralCode,
      )}`;

    const cancelUrl =
      `${baseUrl}/?payment=cancelled` +
      `&referral_code=${encodeURIComponent(
        referralCode,
      )}`;

    const session =
      await stripe.checkout.sessions.create({
        mode: "payment",

        payment_method_types: ["card"],

        /*
         * Displays the Stripe promotion-code field.
         */
        allow_promotion_codes: true,

        /*
         * Stripe will pre-populate the patient's email.
         */
        customer_email:
          patientEmail || undefined,

        /*
         * Provides a second reliable way to link the
         * Checkout Session to the referral.
         */
        client_reference_id:
          referralCode,

        line_items: [
          {
            quantity: 1,

            price_data: {
              currency: "zar",

              /*
               * Stripe amounts use cents:
               *
               * 25000 cents = R250.00
               */
              unit_amount: 25000,

              product_data: {
                name:
                  "Virtual GP Consultation",

                description:
                  `SymptomAI referral ${referralCode}`,
              },
            },
          },
        ],

        /*
         * Metadata stored on the Checkout Session.
         */
        metadata: paymentMetadata,

        /*
         * Metadata also stored on the Payment Intent.
         * This helps the webhook identify the referral.
         */
        payment_intent_data: {
          metadata: paymentMetadata,

          description:
            `SymptomAI virtual GP consultation – ${referralCode}`,
        },

        success_url: successUrl,
        cancel_url: cancelUrl,

        locale: "en",

        billing_address_collection:
          "auto",

        /*
         * Request a telephone number during Checkout only
         * when it was not already supplied by SymptomAI.
         */
        phone_number_collection: {
          enabled: !patientMobile,
        },

        /*
         * Checkout Session expires after 30 minutes.
         */
        expires_at:
          Math.floor(Date.now() / 1000) +
          30 * 60,
      });

    if (!session.url) {
      throw new Error(
        "Stripe did not return a Checkout URL.",
      );
    }

    console.log(
      "Stripe Checkout Session created:",
      {
        referralCode,
        sessionId: session.id,
        amount: 25000,
        currency: "zar",
        successUrl,
      },
    );

    return NextResponse.json({
      success: true,

      checkoutUrl:
        session.url,

      sessionId:
        session.id,

      referralCode,

      amount:
        250,

      currency:
        "ZAR",

      verificationEndpoint:
        "/api/virtual-consult-payment/verify",

      message:
        "Stripe Checkout Session created successfully.",
    });
  } catch (error: unknown) {
    console.error(
      "Stripe Checkout creation error:",
      error,
    );

    if (
      error instanceof
      Stripe.errors.StripeError
    ) {
      return NextResponse.json(
        {
          success: false,
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

    const message =
      error instanceof Error
        ? error.message
        : "Could not create the Stripe payment link.";

    return NextResponse.json(
      {
        success: false,
        error: message,
      },
      { status: 500 },
    );
  }
}
