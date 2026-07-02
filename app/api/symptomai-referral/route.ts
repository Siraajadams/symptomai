import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

function generateReferralCode() {
  return "CS-" + Math.random().toString(36).substring(2, 8).toUpperCase();
}

function generateConsentToken() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

export async function POST(request: Request) {
  try {
    const body = await request.json();

    const patientId = body.patientId;
    const triage = body.triage || {};
    const patientSnapshot = body.patientSnapshot || {};

    if (!patientId) {
      return NextResponse.json(
        { success: false, error: "patientId is required" },
        { status: 400 }
      );
    }

    const referralCode = generateReferralCode();
    const consentToken = generateConsentToken();

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    const { data, error } = await supabase
      .from("symptomai_referrals")
      .insert({
        patient_id: patientId,
        referral_code: referralCode,
        consent_token: consentToken,
        consent_given: true,
        status: "Pending",
        submitted_at: new Date().toISOString(),
        expires_at: expiresAt.toISOString(),
        triage_snapshot: triage,
        patient_snapshot: patientSnapshot,
      })
      .select("*")
      .single();

    if (error) {
      console.error("Referral insert error:", error);

      return NextResponse.json(
        { success: false, error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      referral: {
        id: data.id,
        referral_code: data.referral_code,
        consent_token: data.consent_token,
        expires_at: data.expires_at,
        status: data.status,
      },
    });
  } catch (err: any) {
    console.error("Referral API error:", err);

    return NextResponse.json(
      { success: false, error: err.message || "Referral failed" },
      { status: 500 }
    );
  }
}
