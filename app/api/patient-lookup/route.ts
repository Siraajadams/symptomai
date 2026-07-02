import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    const patientId = String(
      body.patientId ||
        body.idNumber ||
        body.nationalId ||
        body.national_id ||
        ""
    ).trim();

    if (!patientId) {
      return NextResponse.json(
        { error: "Patient ID is required" },
        { status: 400 }
      );
    }

    const { data, error } = await supabase
      .from("patients")
      .select("*")
      .or(
        `patient_id.eq.${patientId},id_number.eq.${patientId},national_id.eq.${patientId}`
      )
      .limit(1);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    if (!data || data.length === 0) {
      return NextResponse.json({ found: false });
    }

    const p = data[0];

    const firstName = p.first_name || "";
    const surname = p.last_name || p.surname || "";
    const idNumber = p.patient_id || p.id_number || p.national_id || "";
    const dob = p.dob || p.date_of_birth || "";
    const mobile = p.mobile || p.mobile_number || p.phone || "";

    return NextResponse.json({
      found: true,
      patient: {
        id: p.id,

        // app/page.tsx expects these
        first_name: firstName,
        surname: surname,
        last_name: surname,
        patient_id: idNumber,
        id_number: idNumber,
        national_id: idNumber,
        dob: dob,
        date_of_birth: dob,
        mobile: mobile,
        mobile_number: mobile,
        phone: mobile,
        gender: p.gender || "",
        email: p.email || "",

        // also keep camelCase for future use
        firstName,
        patientId: idNumber,
      },
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "Lookup failed" },
      { status: 500 }
    );
  }
}
