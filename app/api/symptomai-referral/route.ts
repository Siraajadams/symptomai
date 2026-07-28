import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function getSupabaseAdmin() {
  const supabaseUrl =
    process.env.CARESCRIBER_SUPABASE_URL?.trim() ||
    process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();

  const serviceRoleKey =
    process.env.CARESCRIBER_SUPABASE_SERVICE_ROLE_KEY?.trim() ||
    process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();

  if (!supabaseUrl) {
    throw new Error("CareScriber Supabase URL is missing.");
  }

  if (!serviceRoleKey) {
    throw new Error("CareScriber Supabase service-role key is missing.");
  }

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

function normalizePatientId(value: unknown): string {
  return String(value || "")
    .replace(/\s+/g, "")
    .replace(/-/g, "")
    .replace(/[^a-zA-Z0-9]/g, "")
    .trim()
    .toUpperCase();
}

function normalizeText(value: unknown): string {
  return String(value || "").trim();
}

function normalizeNullableText(value: unknown): string | null {
  const text = normalizeText(value);
  return text || null;
}

function generateReferralCode() {
  return (
    "CS-" +
    Math.random()
      .toString(36)
      .substring(2, 8)
      .toUpperCase()
  );
}

function generateConsentToken() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

function getDobFromSouthAfricanId(idNumber: string): string {
  const cleanId = idNumber.replace(/\D/g, "");

  if (cleanId.length !== 13) {
    return "";
  }

  const yy = Number(cleanId.slice(0, 2));
  const mm = Number(cleanId.slice(2, 4));
  const dd = Number(cleanId.slice(4, 6));

  if (
    Number.isNaN(yy) ||
    Number.isNaN(mm) ||
    Number.isNaN(dd) ||
    mm < 1 ||
    mm > 12 ||
    dd < 1 ||
    dd > 31
  ) {
    return "";
  }

  const currentYear = new Date().getFullYear();
  const currentTwoDigitYear = currentYear % 100;

  const fullYear =
    yy <= currentTwoDigitYear ? 2000 + yy : 1900 + yy;

  const date = new Date(fullYear, mm - 1, dd);

  const isValidDate =
    date.getFullYear() === fullYear &&
    date.getMonth() === mm - 1 &&
    date.getDate() === dd;

  if (!isValidDate) {
    return "";
  }

  return `${fullYear}-${String(mm).padStart(2, "0")}-${String(dd).padStart(
    2,
    "0",
  )}`;
}

function calculateAgeFromDob(dateOfBirth: string): string {
  if (!dateOfBirth) {
    return "";
  }

  const parts = dateOfBirth.split("-");

  if (parts.length !== 3) {
    return "";
  }

  const year = Number(parts[0]);
  const month = Number(parts[1]);
  const day = Number(parts[2]);

  if (
    Number.isNaN(year) ||
    Number.isNaN(month) ||
    Number.isNaN(day)
  ) {
    return "";
  }

  const today = new Date();

  let age = today.getFullYear() - year;

  const hasNotHadBirthday =
    today.getMonth() + 1 < month ||
    (today.getMonth() + 1 === month && today.getDate() < day);

  if (hasNotHadBirthday) {
    age -= 1;
  }

  return age >= 0 ? String(age) : "";
}

type PatientPayload = {
  id?: string | null;
  firstName?: string | null;
  surname?: string | null;
  nationalId?: string | null;
  dateOfBirth?: string | null;
  mobile?: string | null;
  email?: string | null;
  gender?: string | null;
  age?: string | number | null;
  country?: string | null;
  city?: string | null;
};

type TriagePayload = Record<string, unknown>;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    const patient = (body?.patient || {}) as PatientPayload;
    const triage = (body?.triage || {}) as TriagePayload;

    const nationalId = normalizePatientId(patient.nationalId);
    const firstName = normalizeText(patient.firstName);
    const surname = normalizeText(patient.surname);

    if (!nationalId) {
      return NextResponse.json(
        {
          error: "Patient national ID is required.",
        },
        { status: 400 },
      );
    }

    if (!firstName || !surname) {
      return NextResponse.json(
        {
          error: "Patient first name and surname are required.",
        },
        { status: 400 },
      );
    }

    const suppliedDob = normalizeText(patient.dateOfBirth);

    const resolvedDob =
      suppliedDob || getDobFromSouthAfricanId(nationalId);

    const resolvedAge =
      normalizeText(patient.age) ||
      calculateAgeFromDob(resolvedDob);

    const supabase = getSupabaseAdmin();

    let patientId = normalizeText(patient.id) || null;
    let patientCreated = false;
    let patientRecord: any = null;

    /*
     * Confirm that a supplied patient UUID still exists.
     */
    if (patientId) {
      const { data: suppliedPatient, error: suppliedPatientError } =
        await supabase
          .from("patients")
          .select(`
            id,
            first_name,
            last_name,
            surname,
            patient_id,
            id_number,
            national_id,
            dob,
            date_of_birth,
            gender,
            mobile,
            mobile_number,
            email
          `)
          .eq("id", patientId)
          .maybeSingle();

      if (suppliedPatientError) {
        console.error(
          "Supplied patient lookup error:",
          suppliedPatientError,
        );
      }

      if (suppliedPatient) {
        patientRecord = suppliedPatient;
      } else {
        patientId = null;
      }
    }

    /*
     * Search all supported ID columns to prevent duplicate patient records.
     */
    if (!patientId) {
      const { data: existingPatient, error: existingError } =
        await supabase
          .from("patients")
          .select(`
            id,
            first_name,
            last_name,
            surname,
            patient_id,
            id_number,
            national_id,
            dob,
            date_of_birth,
            gender,
            mobile,
            mobile_number,
            email
          `)
          .or(
            [
              `patient_id.eq.${nationalId}`,
              `id_number.eq.${nationalId}`,
              `national_id.eq.${nationalId}`,
            ].join(","),
          )
          .limit(1)
          .maybeSingle();

      if (existingError) {
        console.error("Existing patient lookup error:", existingError);

        return NextResponse.json(
          {
            error: `Could not search CareScriber patient: ${existingError.message}`,
          },
          { status: 500 },
        );
      }

      if (existingPatient) {
        patientId = existingPatient.id;
        patientRecord = existingPatient;
      }
    }

    /*
     * Update an existing patient with any missing or newly supplied details.
     */
    if (patientId && patientRecord) {
      const updatePayload: Record<string, unknown> = {
        first_name: firstName,
        last_name: surname,
        surname,
        patient_id: nationalId,
        id_number: nationalId,
        national_id: nationalId,
        gender:
          normalizeNullableText(patient.gender) ||
          patientRecord.gender ||
          null,
        mobile:
          normalizeNullableText(patient.mobile) ||
          patientRecord.mobile ||
          patientRecord.mobile_number ||
          null,
        mobile_number:
          normalizeNullableText(patient.mobile) ||
          patientRecord.mobile_number ||
          patientRecord.mobile ||
          null,
        email:
          normalizeNullableText(patient.email) ||
          patientRecord.email ||
          null,
      };

      if (resolvedDob) {
        updatePayload.dob = resolvedDob;
        updatePayload.date_of_birth = resolvedDob;
      }

      const { data: updatedPatient, error: updateError } =
        await supabase
          .from("patients")
          .update(updatePayload)
          .eq("id", patientId)
          .select(`
            id,
            first_name,
            last_name,
            surname,
            patient_id,
            id_number,
            national_id,
            dob,
            date_of_birth,
            gender,
            mobile,
            mobile_number,
            email
          `)
          .single();

      if (updateError) {
        console.error("Patient update error:", updateError);

        return NextResponse.json(
          {
            error: `Could not update CareScriber patient: ${updateError.message}`,
          },
          { status: 500 },
        );
      }

      patientRecord = updatedPatient;
    }

    /*
     * Create a new CareScriber patient when no matching record exists.
     */
    if (!patientId) {
      const insertPayload: Record<string, unknown> = {
        first_name: firstName,
        last_name: surname,
        surname,
        patient_id: nationalId,
        id_number: nationalId,
        national_id: nationalId,
        gender: normalizeNullableText(patient.gender),
        mobile: normalizeNullableText(patient.mobile),
        mobile_number: normalizeNullableText(patient.mobile),
        email: normalizeNullableText(patient.email),
        created_at: new Date().toISOString(),
      };

      if (resolvedDob) {
        insertPayload.dob = resolvedDob;
        insertPayload.date_of_birth = resolvedDob;
      }

      const { data: createdPatient, error: createError } =
        await supabase
          .from("patients")
          .insert(insertPayload)
          .select(`
            id,
            first_name,
            last_name,
            surname,
            patient_id,
            id_number,
            national_id,
            dob,
            date_of_birth,
            gender,
            mobile,
            mobile_number,
            email
          `)
          .single();

      if (createError) {
        console.error("Patient creation error:", createError);

        return NextResponse.json(
          {
            error: `Could not create CareScriber patient: ${createError.message}`,
          },
          { status: 500 },
        );
      }

      patientId = createdPatient.id;
      patientRecord = createdPatient;
      patientCreated = true;
    }

    if (!patientId || !patientRecord) {
      return NextResponse.json(
        {
          error: "Could not resolve the CareScriber patient record.",
        },
        { status: 500 },
      );
    }

    const referralCode = generateReferralCode();
    const consentToken = generateConsentToken();

    const now = new Date();
    const expiresAt = new Date(now);
    expiresAt.setDate(expiresAt.getDate() + 7);

    const patientSnapshot = {
      id: patientId,
      firstName:
        patientRecord.first_name || firstName,
      surname:
        patientRecord.surname ||
        patientRecord.last_name ||
        surname,
      nationalId:
        patientRecord.patient_id ||
        patientRecord.id_number ||
        patientRecord.national_id ||
        nationalId,
      dateOfBirth:
        patientRecord.date_of_birth ||
        patientRecord.dob ||
        resolvedDob ||
        null,
      age:
        resolvedAge ||
        calculateAgeFromDob(
          patientRecord.date_of_birth ||
            patientRecord.dob ||
            resolvedDob,
        ) ||
        null,
      gender:
        patientRecord.gender ||
        normalizeNullableText(patient.gender),
      mobile:
        patientRecord.mobile ||
        patientRecord.mobile_number ||
        normalizeNullableText(patient.mobile),
      email:
        patientRecord.email ||
        normalizeNullableText(patient.email),
      country: normalizeNullableText(patient.country),
      city: normalizeNullableText(patient.city),
    };

    const { data: referral, error: referralError } = await supabase
      .from("symptomai_referrals")
      .insert({
        patient_id: patientId,
        referral_code: referralCode,
        consent_token: consentToken,
        consent_given: true,
        status: "Pending",
        submitted_at: now.toISOString(),
        expires_at: expiresAt.toISOString(),
        patient_snapshot: patientSnapshot,
        triage_snapshot: triage,
      })
      .select(`
        id,
        patient_id,
        referral_code,
        consent_token,
        consent_given,
        status,
        submitted_at,
        expires_at
      `)
      .single();

    if (referralError) {
      console.error("Referral creation error:", referralError);

      return NextResponse.json(
        {
          error: `Could not create referral: ${referralError.message}`,
        },
        { status: 500 },
      );
    }

    const responseFirstName =
      patientRecord.first_name || firstName;

    const responseSurname =
      patientRecord.surname ||
      patientRecord.last_name ||
      surname;

    const responseNationalId =
      patientRecord.patient_id ||
      patientRecord.id_number ||
      patientRecord.national_id ||
      nationalId;

    const responseDob =
      patientRecord.date_of_birth ||
      patientRecord.dob ||
      resolvedDob ||
      "";

    const responseMobile =
      patientRecord.mobile ||
      patientRecord.mobile_number ||
      "";

    return NextResponse.json({
      success: true,
      patientCreated,

      patient: {
        id: patientId,

        first_name: responseFirstName,
        firstName: responseFirstName,

        surname: responseSurname,
        last_name: responseSurname,
        lastName: responseSurname,

        patient_id: responseNationalId,
        id_number: responseNationalId,
        national_id: responseNationalId,
        patientId: responseNationalId,
        nationalId: responseNationalId,

        dob: responseDob,
        date_of_birth: responseDob,
        dateOfBirth: responseDob,

        age:
          calculateAgeFromDob(responseDob) ||
          resolvedAge ||
          "",

        gender: patientRecord.gender || "",
        mobile: responseMobile,
        mobile_number: responseMobile,
        phone: responseMobile,
        email: patientRecord.email || "",
      },

      referral: {
        referral_code: referral.referral_code,
        consent_token: referral.consent_token,
        expires_at: referral.expires_at,
      },
    });
  } catch (error: unknown) {
    const message =
      error instanceof Error
        ? error.message
        : "Referral failed.";

    console.error("SymptomAI referral route error:", error);

    return NextResponse.json(
      {
        success: false,
        error: message,
      },
      { status: 500 },
    );
  }
}
