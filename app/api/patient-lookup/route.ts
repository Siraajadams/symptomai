import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const patientId = String(body.patientId || "").trim();

    if (!patientId) {
      return NextResponse.json({ error: "Patient ID is required" }, { status: 400 });
    }

    const { data, error } = await supabase
      .from("patients")
      .select("*")
      .eq("patient_id", patientId)
      .limit(1);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    if (!data || data.length === 0) {
      return NextResponse.json({ found: false });
    }

    const p = data[0];

    return NextResponse.json({
      found: true,
      patient: {
        id: p.id,
        firstName: p.first_name || "",
        surname: p.last_name || p.surname || "",
        patientId: p.patient_id || "",
        gender: p.gender || "",
        dob: p.dob || p.date_of_birth || "",
        mobile: p.mobile || p.mobile_number || "",
        email: p.email || "",
      },
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Lookup failed" }, { status: 500 });
  }
}
