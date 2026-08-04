import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const stripeSecretKey = process.env.STRIPE_SECRET_KEY;

if (!stripeSecretKey) {
  console.warn("STRIPE_SECRET_KEY is not configured.");
}

const stripe = new Stripe(stripeSecretKey || "");

type PaymentRequestBody = {
  referralCode?: string;
  consentToken?: string;
  consultationReason?: string;
  patientName?: string;
  patientEmail?: string;
  patientId?: string;
};

function getBaseUrl(req: NextRequest) {
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

    const body = (await req.json()) as PaymentRequestBody;

    const referralCode =
      body.referralCode?.trim().toUpperCase() || "";

    const consentToken =
      body.consentToken?.trim() || "";

    const consultationReason =
      body.consultationReason?.trim() || "";

    const patientName =
      body.patientName?.trim() || "SymptomAI Patient";

    const patientEmail =
      body.patientEmail?.trim() || undefined;

    const patientId =
      body.patientId?.trim() || "";

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

    if (consultationReason.length > 500) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Consultation reason cannot exceed 500 characters.",
        },
        { status: 400 },
      );
    }

    if (patientName.length > 200) {
      return NextResponse.json(
        {
          success: false,
          error: "Patient name cannot exceed 200 characters.",
        },
        { status: 400 },
      );
    }

    if (patientId.length > 200) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Patient ID cannot exceed 200 characters.",
        },
        { status: 400 },
      );
    }

    const baseUrl = getBaseUrl(req);

    const session =
      await stripe.checkout.sessions.create({
        mode: "payment",

        /*
         * Enables the "Add promotion code" field
         * on the Stripe-hosted Checkout page.
         */
        allow_promotion_codes: true,

        payment_method_types: ["card"],

        customer_email: patientEmail,

        client_reference_id: referralCode,

        line_items: [
          {
            quantity: 1,
            price_data: {
              currency: "zar",
              unit_amount: 25000,
              product_data: {
                name: "Virtual GP Consultation",
                description:
                  `SymptomAI referral ${referralCode}`,
              },
            },
          },
        ],

        metadata: {
          referral_code: referralCode,
          consent_token: consentToken,
          consultation_reason:
            consultationReason.substring(0, 500),
          patient_name:
            patientName.substring(0, 200),
          patient_email:
            patientEmail?.substring(0, 200) || "",
          patient_id:
            patientId.substring(0, 200),
          service: "symptomai_virtual_gp",
        },

        payment_intent_data: {
          metadata: {
            referral_code: referralCode,
            consent_token: consentToken,
            patient_name:
              patientName.substring(0, 200),
            patient_email:
              patientEmail?.substring(0, 200) || "",
            patient_id:
              patientId.substring(0, 200),
            service: "symptomai_virtual_gp",
          },
        },

        success_url:
          `${baseUrl}/?payment=success` +
          `&session_id={CHECKOUT_SESSION_ID}` +
          `&referral_code=${encodeURIComponent(
            referralCode,
          )}`,

        cancel_url:
          `${baseUrl}/?payment=cancelled` +
          `&referral_code=${encodeURIComponent(
            referralCode,
          )}`,

        locale: "en",

        billing_address_collection: "auto",

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

    return NextResponse.json({
      success: true,
      checkoutUrl: session.url,
      sessionId: session.id,
      referralCode,
    });
  } catch (error: unknown) {
    console.error(
      "Stripe Checkout creation error:",
      error,
    );

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
