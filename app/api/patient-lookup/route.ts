import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function normalizePatientId(value: unknown): string {
  return String(value || "")
    .replace(/\s+/g, "")
    .replace(/-/g, "")
    .replace(/[^a-zA-Z0-9]/g, "")
    .trim()
    .toUpperCase();
}

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

/**
 * Extracts a date of birth from a valid-looking 13-digit
 * South African identity number.
 *
 * Example:
 * 7703205036082 -> 1977-03-20
 */
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

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    const patientId = normalizePatientId(
      body.patientId ||
        body.idNumber ||
        body.nationalId ||
        body.national_id,
    );

    if (!patientId) {
      return NextResponse.json(
        {
          success: false,
          found: false,
          error: "Patient ID is required.",
        },
        { status: 400 },
      );
    }

    const supabase = getSupabaseAdmin();

    const { data, error } = await supabase
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
          `patient_id.eq.${patientId}`,
          `id_number.eq.${patientId}`,
          `national_id.eq.${patientId}`,
        ].join(","),
      )
      .limit(1)
      .maybeSingle();

    if (error) {
      console.error("Patient lookup error:", error);

      return NextResponse.json(
        {
          success: false,
          found: false,
          error: `Patient lookup failed: ${error.message}`,
        },
        { status: 500 },
      );
    }

    if (!data) {
      return NextResponse.json({
        success: true,
        found: false,
        patient: null,
      });
    }

    const resolvedFirstName = String(data.first_name || "").trim();

    const resolvedSurname = String(
      data.surname || data.last_name || "",
    ).trim();

    const resolvedPatientId = normalizePatientId(
      data.patient_id ||
        data.id_number ||
        data.national_id ||
        patientId,
    );

    const storedDateOfBirth = String(
      data.date_of_birth || data.dob || "",
    ).trim();

    const derivedDateOfBirth =
      storedDateOfBirth ||
      getDobFromSouthAfricanId(resolvedPatientId) ||
      getDobFromSouthAfricanId(patientId);

    const resolvedMobile = String(
      data.mobile || data.mobile_number || "",
    ).trim();

    const resolvedEmail = String(data.email || "").trim();
    const resolvedGender = String(data.gender || "").trim();
    const resolvedAge = calculateAgeFromDob(derivedDateOfBirth);

    return NextResponse.json({
      success: true,
      found: true,

      patient: {
        id: data.id,

        /*
         * Snake-case fields used by the current SymptomAI page.
         */
        first_name: resolvedFirstName,
        surname: resolvedSurname,
        last_name: resolvedSurname,

        patient_id: resolvedPatientId,
        id_number: resolvedPatientId,
        national_id: resolvedPatientId,

        dob: derivedDateOfBirth,
        date_of_birth: derivedDateOfBirth,

        gender: resolvedGender,
        mobile: resolvedMobile,
        mobile_number: resolvedMobile,
        phone: resolvedMobile,
        email: resolvedEmail,
        age: resolvedAge,

        /*
         * Camel-case fields retained for other integrations.
         */
        firstName: resolvedFirstName,
        lastName: resolvedSurname,
        patientId: resolvedPatientId,
        nationalId: resolvedPatientId,
        idNumber: resolvedPatientId,
        dateOfBirth: derivedDateOfBirth,
        mobileNumber: resolvedMobile,
      },
    });
  } catch (error: unknown) {
    const message =
      error instanceof Error
        ? error.message
        : "Patient lookup failed.";

    console.error("Patient lookup route error:", error);

    return NextResponse.json(
      {
        success: false,
        found: false,
        error: message,
      },
      { status: 500 },
    );
  }
}
