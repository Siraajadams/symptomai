import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(request: Request) {
  try {
    const body = await request.json();

    const patientId = (body.patientId || "").trim();

    if (!patientId) {
      return NextResponse.json(
        {
          success: false,
          error: "Patient ID is required",
        },
        { status: 400 }
      );
    }

    // Search CareScriber patients table
    const { data, error } = await supabase
      .from("patients")
      .select("*")
      .eq("patient_id", patientId)
      .limit(1);

    if (error) {
      console.error(error);

      return NextResponse.json(
        {
          success: false,
          error: error.message,
        },
        { status: 500 }
      );
    }

    if (!data || data.length === 0) {
      return NextResponse.json({
        success: true,
        found: false,
      });
    }

    const patient = data[0];

    return NextResponse.json({
      success: true,
      found: true,

      patient: {
        id: patient.id,
        first_name: patient.first_name,
        last_name: patient.last_name ?? patient.surname,
        patient_id: patient.patient_id,
        gender: patient.gender,
        mobile: patient.mobile,
        email: patient.email,
        dob: patient.dob ?? patient.date_of_birth,
        medical_aid: patient.medical_aid,
        allergies: patient.allergies,
        current_medicines: patient.current_medicines,
      },
    });
  } catch (err: any) {
    console.error(err);

    return NextResponse.json(
      {
        success: false,
        error: err.message,
      },
      { status: 500 }
    );
  }
}
