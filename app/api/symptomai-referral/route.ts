import { NextRequest, NextResponse } from "next/server";
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

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    const patient = body.patient;
    const triage = body.triage;

    if (!patient?.nationalId) {
      return NextResponse.json({ error: "Patient national ID is required" }, { status: 400 });
    }

    let patientId = patient.id || null;
    let patientCreated = false;

    if (!patientId) {
      const { data: existing } = await supabase
        .from("patients")
        .select("*")
        .eq("patient_id", patient.nationalId)
        .limit(1);

      if (existing && existing.length > 0) {
        patientId = existing[0].id;
      } else {
        const { data: created, error: createError } = await supabase
          .from("patients")
          .insert({
            first_name: patient.firstName,
            last_name: patient.surname,
            patient_id: patient.nationalId,
            dob: patient.dateOfBirth,
            gender: patient.gender,
            mobile: patient.mobile,
            email: patient.email,
            created_at: new Date().toISOString(),
          })
          .select("*")
          .single();

        if (createError) {
          return NextResponse.json({ error: createError.message }, { status: 500 });
        }

        patientId = created.id;
        patientCreated = true;
      }
    }

    const referralCode = generateReferralCode();
    const consentToken = generateConsentToken();

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    const { data: referral, error: referralError } = await supabase
      .from("symptomai_referrals")
      .insert({
        patient_id: patientId,
        referral_code: referralCode,
        consent_token: consentToken,
        consent_given: true,
        status: "Pending",
        submitted_at: new Date().toISOString(),
        expires_at: expiresAt.toISOString(),
        patient_snapshot: patient,
        triage_snapshot: triage,
      })
      .select("*")
      .single();

    if (referralError) {
      return NextResponse.json({ error: referralError.message }, { status: 500 });
    }

    return NextResponse.json({
      patientCreated,
      patient: {
        id: patientId,
        first_name: patient.firstName,
        surname: patient.surname,
        patient_id: patient.nationalId,
        dob: patient.dateOfBirth,
        gender: patient.gender,
        mobile: patient.mobile,
        email: patient.email,
      },
      referral: {
        referral_code: referral.referral_code,
        consent_token: referral.consent_token,
        expires_at: referral.expires_at,
      },
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Referral failed" }, { status: 500 });
  }
}
