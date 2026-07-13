import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function normalizePatientId(value: unknown) {
  return String(value || "")
    .replace(/\s+/g, "")
    .replace(/-/g, "")
    .trim();
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

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const patientId = normalizePatientId(body.patientId);

    if (!patientId) {
      return NextResponse.json(
        {
          found: false,
          error: "Patient ID is required.",
        },
        { status: 400 }
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
        ].join(",")
      )
      .limit(1)
      .maybeSingle();

    if (error) {
      console.error("Patient lookup error:", error);

      return NextResponse.json(
        {
          found: false,
          error: `Patient lookup failed: ${error.message}`,
        },
        { status: 500 }
      );
    }

    if (!data) {
      return NextResponse.json({
        found: false,
      });
    }

    return NextResponse.json({
      found: true,
      patient: {
        id: data.id,
        firstName: data.first_name || "",
        surname: data.last_name || data.surname || "",
        patientId:
          data.patient_id ||
          data.id_number ||
          data.national_id ||
          patientId,
        dateOfBirth: data.dob || data.date_of_birth || "",
        gender: data.gender || "",
        mobile: data.mobile || data.mobile_number || "",
        email: data.email || "",
      },
    });
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : "Patient lookup failed.";

    console.error("Patient lookup route error:", error);

    return NextResponse.json(
      {
        found: false,
        error: message,
      },
      { status: 500 }
    );
  }
}
