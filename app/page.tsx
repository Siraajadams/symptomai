"use client";

import { useState } from "react";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export default function Home() {
  const [loading, setLoading] = useState(false);

  const [form, setForm] = useState({
    name: "",
    dob: "",
    gender: "",
    phone: "",
    location: "",
    country: "South Africa",
    symptoms: "",
    fever: false,
    chestPain: false,
    breathing: false,
    bleeding: false,
    notes: "",
  });

  const [result, setResult] = useState<any>(null);

  const handleSubmit = async () => {
    setLoading(true);

    let outcome = "Pharmacist Care";
    let referralUrl = "";
    let referralChannel = "";

    const emergency =
      form.chestPain ||
      form.breathing ||
      form.bleeding;

    if (emergency) {
      outcome = "Emergency Referral";
    } else if (
      form.symptoms.toLowerCase().includes("doctor") ||
      form.symptoms.toLowerCase().includes("pain") ||
      form.symptoms.toLowerCase().includes("infection")
    ) {
      outcome = "Doctor Referral";
    }

    // UK Routing
    if (
      form.country === "United Kingdom" &&
      outcome === "Doctor Referral"
    ) {
      referralUrl = "https://nhs.carelink.digital";
      referralChannel = "NHS Carelink UK";
    }

    // South Africa Routing
    if (
      form.country === "South Africa" &&
      outcome === "Doctor Referral"
    ) {
      referralUrl = "https://carelink.digital";
      referralChannel = "Carelink South Africa";
    }

    const payload = {
      name: form.name,
      dob: form.dob,
      gender: form.gender,
      phone: form.phone,
      location: form.location,
      symptoms: form.symptoms,
      fever: form.fever,
      chest_pain: form.chestPain,
      breathing: form.breathing,
      bleeding: form.bleeding,
      outcome,
      referral_url: referralUrl,
      referral_channel: referralChannel,
      referral_status: "Pending",
      follow_up_required: true,
      whatsapp_sent: false,
      sms_sent: false,
      email_sent: false,
      clinical_notes: form.notes,
    };

    const { error } = await supabase
      .from("triage_records")
      .insert([payload]);

    if (error) {
      alert(error.message);
      setLoading(false);
      return;
    }

    setResult({
      outcome,
      referralUrl,
      referralChannel,
    });

    setLoading(false);
  };

  return (
    <main className="min-h-screen bg-[#edf4f4] p-4">
      <div className="max-w-3xl mx-auto">

        {/* HEADER */}
        <div className="flex items-center gap-4 mb-6">
          <div className="w-20 h-20 rounded-3xl bg-[#052049] flex items-center justify-center text-5xl text-[#18c5b7] font-bold">
            +
          </div>

          <div>
            <h1 className="text-5xl font-black text-[#052049]">
              SymptomAI
            </h1>

            <p className="text-gray-500 text-xl font-semibold">
              Right care. Right place. Right now.
            </p>
          </div>
        </div>

        {/* HERO */}
        <div className="bg-white rounded-[40px] shadow-xl p-8 mb-6">
          <h2 className="text-5xl font-black text-[#052049] leading-tight">
            60-second pharmacy triage
          </h2>

          <p className="text-gray-500 text-2xl mt-6 leading-relaxed">
            Capture symptoms, identify red flags,
            and route patients to pharmacist care,
            GP in pharmacy, or emergency services.
          </p>
        </div>

        {/* FORM */}
        <div className="bg-white rounded-[40px] shadow-xl p-8 space-y-6">

          <div>
            <label className="font-bold text-[#052049]">
              Full name
            </label>

            <input
              className="w-full mt-2 border rounded-2xl p-4 text-lg"
              placeholder="Patient name"
              value={form.name}
              onChange={(e) =>
                setForm({ ...form, name: e.target.value })
              }
            />
          </div>

          <div>
            <label className="font-bold text-[#052049]">
              Date of birth
            </label>

            <input
              type="date"
              className="w-full mt-2 border rounded-2xl p-4 text-lg"
              value={form.dob}
              onChange={(e) =>
                setForm({ ...form, dob: e.target.value })
              }
            />
          </div>

          <div>
            <label className="font-bold text-[#052049]">
              Gender
            </label>

            <select
              className="w-full mt-2 border rounded-2xl p-4 text-lg"
              value={form.gender}
              onChange={(e) =>
                setForm({ ...form, gender: e.target.value })
              }
            >
              <option value="">Select gender</option>
              <option>Male</option>
              <option>Female</option>
              <option>Other</option>
            </select>
          </div>

          <div>
            <label className="font-bold text-[#052049]">
              Country
            </label>

            <select
              className="w-full mt-2 border rounded-2xl p-4 text-lg"
              value={form.country}
              onChange={(e) =>
                setForm({ ...form, country: e.target.value })
              }
            >
              <option>South Africa</option>
              <option>United Kingdom</option>
            </select>
          </div>

          <div>
            <label className="font-bold text-[#052049]">
              Phone number
            </label>

            <input
              className="w-full mt-2 border rounded-2xl p-4 text-lg"
              placeholder="+27..."
              value={form.phone}
              onChange={(e) =>
                setForm({ ...form, phone: e.target.value })
              }
            />
          </div>

          <div>
            <label className="font-bold text-[#052049]">
              Pharmacy / location
            </label>

            <input
              className="w-full mt-2 border rounded-2xl p-4 text-lg"
              placeholder="Suburb or pharmacy"
              value={form.location}
              onChange={(e) =>
                setForm({ ...form, location: e.target.value })
              }
            />
          </div>

          <div>
            <label className="font-bold text-[#052049]">
              Main symptoms
            </label>

            <textarea
              className="w-full mt-2 border rounded-2xl p-4 text-lg min-h-[140px]"
              placeholder="Describe symptoms"
              value={form.symptoms}
              onChange={(e) =>
                setForm({ ...form, symptoms: e.target.value })
              }
            />
          </div>

          {/* RED FLAGS */}
          <div>
            <h3 className="text-3xl font-black text-[#052049] mb-4">
              Red flag check
            </h3>

            <div className="space-y-4">

              <label className="flex gap-4 items-start bg-[#f7f7f7] rounded-3xl p-5">
                <input
                  type="checkbox"
                  checked={form.fever}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      fever: e.target.checked,
                    })
                  }
                />

                <span className="font-bold text-xl">
                  Fever
                </span>
              </label>

              <label className="flex gap-4 items-start bg-[#f7f7f7] rounded-3xl p-5">
                <input
                  type="checkbox"
                  checked={form.chestPain}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      chestPain: e.target.checked,
                    })
                  }
                />

                <span className="font-bold text-xl">
                  Chest pain or collapse
                </span>
              </label>

              <label className="flex gap-4 items-start bg-[#f7f7f7] rounded-3xl p-5">
                <input
                  type="checkbox"
                  checked={form.breathing}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      breathing: e.target.checked,
                    })
                  }
                />

                <span className="font-bold text-xl">
                  Difficulty breathing
                </span>
              </label>

              <label className="flex gap-4 items-start bg-[#f7f7f7] rounded-3xl p-5">
                <input
                  type="checkbox"
                  checked={form.bleeding}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      bleeding: e.target.checked,
                    })
                  }
                />

                <span className="font-bold text-xl">
                  Severe bleeding
                </span>
              </label>
            </div>
          </div>

          {/* NOTES */}
          <div>
            <label className="font-bold text-[#052049]">
              Clinical notes
            </label>

            <textarea
              className="w-full mt-2 border rounded-2xl p-4 text-lg min-h-[120px]"
              placeholder="Optional pharmacist notes"
              value={form.notes}
              onChange={(e) =>
                setForm({ ...form, notes: e.target.value })
              }
            />
          </div>

          {/* BUTTON */}
          <button
            onClick={handleSubmit}
            disabled={loading}
            className="w-full bg-[#18c5b7] hover:bg-[#10b2a5] transition text-white text-2xl font-black rounded-3xl py-5"
          >
            {loading
              ? "Saving..."
              : "Get triage recommendation"}
          </button>
        </div>

        {/* RESULT */}
        {result && (
          <div className="bg-white rounded-[40px] shadow-xl p-8 mt-6">

            <h2 className="text-4xl font-black text-[#052049]">
              Triage outcome
            </h2>

            <div className="mt-6 text-2xl font-bold text-[#18c5b7]">
              {result.outcome}
            </div>

            {result.referralUrl && (
              <div className="mt-6">

                <div className="text-gray-500 mb-2">
                  Referral platform
                </div>

                <a
                  href={result.referralUrl}
                  target="_blank"
                  className="inline-block bg-[#052049] text-white px-6 py-4 rounded-2xl font-bold"
                >
                  Open {result.referralChannel}
                </a>
              </div>
            )}

            {/* WhatsApp */}
            <div className="mt-6">
              <a
                href={`https://wa.me/${form.phone.replace(/\+/g, "")}`}
                target="_blank"
                className="inline-block bg-green-500 text-white px-6 py-4 rounded-2xl font-bold"
              >
                WhatsApp follow-up
              </a>
            </div>

            {/* EMAIL */}
            <div className="mt-4">
              <a
                href={`mailto:?subject=SymptomAI Referral&body=Outcome: ${result.outcome}`}
                className="inline-block bg-gray-700 text-white px-6 py-4 rounded-2xl font-bold"
              >
                Email advice
              </a>
            </div>
          </div>
        )}

        {/* ADMIN */}
        <div className="text-center mt-8 mb-10">
          <a
            href="/admin"
            className="text-gray-500 underline"
          >
            Admin dashboard
          </a>
        </div>
      </div>
    </main>
  );
}
