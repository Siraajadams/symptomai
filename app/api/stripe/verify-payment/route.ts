import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";

export const runtime = "nodejs";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

export async function POST(req: NextRequest) {
  try {
    const { sessionId, referralCode } = await req.json();

    if (!sessionId) {
      return NextResponse.json(
        { error: "Stripe session ID is required." },
        { status: 400 }
      );
    }

    const session = await stripe.checkout.sessions.retrieve(sessionId);

    if (
      referralCode &&
      session.metadata?.referralCode &&
      session.metadata.referralCode !== referralCode
    ) {
      return NextResponse.json(
        { error: "The payment does not match this referral." },
        { status: 400 }
      );
    }

    const paid =
      session.payment_status === "paid" &&
      session.status === "complete";

    return NextResponse.json({
      paid,
      paymentStatus: session.payment_status,
      sessionStatus: session.status,
      referralCode: session.metadata?.referralCode || null,
    });
  } catch (error) {
    console.error("Stripe verification error:", error);

    return NextResponse.json(
      { error: "Payment verification failed." },
      { status: 500 }
    );
  }
}
