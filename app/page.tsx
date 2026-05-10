"use client";

import { useState } from "react";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

type Outcome =
  | "Emergency referral"
  | "Doctor in pharmacy"
  | "Pharmacist care recommended";

export default function HomePage() {
  const [loading, setLoading] = useState(false);

  const [form, setForm] = useState({
    name: "",
    dob: "",
    gender: "",
    pregnant: "",
    country: "South Africa",
    dialCode: "+27",
    phone: "",
    location: "",
    symptoms: "",
  });

  const [outcome, setOutcome] = useState<Outcome | null>(null);

  const countryCodes: Record<string, string> = {
    "South Africa": "+27",
    England: "+44",
    Scotland: "+44",
    Wales: "+44",
  };

  const handleCountryChange = (country: string) => {
    setForm({
      ...form,
      country,
      dialCode: countryCodes[country],
    });
  };

  const determineOutcome = (): Outcome => {
    const s = form.symptoms.toLowerCase();

    if (
      s.includes("chest pain") ||
      s.includes("stroke") ||
      s.includes("shortness of breath") ||
      s.includes("bleeding")
    ) {
      return "Emergency referral";
    }

    if (
      s.includes("infection") ||
      s.includes("fever") ||
      s.includes("uti")
    ) {
      return "Doctor in pharmacy";
    }

    return "Pharmacist care recommended";
  };

  const getEmergencyWhatsapp = () => {
    switch (form.country) {
      case "South Africa":
        return "https://wa.me/27820022000";
      case "England":
      case "Scotland":
      case "Wales":
        return "https://www.nhs.uk/nhs-services/urgent-and-emergency-care-services/";
      default:
        return "#";
    }
  };

  const submitTriage = async () => {
    setLoading(true);

    const result = determineOutcome();
    setOutcome(result);

    await supabase.from("triage_records").insert([
      {
        name: form.name,
        dob: form.dob,
        gender: form.gender,
        pregnant: form.pregnant,
        country: form.country,
        dial_code: form.dialCode,
        phone: form.phone,
        location: form.location,
        symptoms: form.symptoms,
        outcome: result,
      },
    ]);

    setLoading(false);
  };

  return (
    <main className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-3xl mx-auto bg-white rounded-2xl shadow-lg p-8">
        <h1 className="text-4xl font-bold mb-2">SymptomAI</h1>
        <p className="text-gray-500 mb-8">
          Right care. Right place. Right now.
        </p>

        {!outcome && (
          <div className="space-y-4">
            <input
              className="w-full border p-3 rounded-xl"
              placeholder="Full Name"
              value={form.name}
              onChange={(e) =>
                setForm({ ...form, name: e.target.value })
              }
            />

            <input
              type="date"
              className="w-full border p-3 rounded-xl"
              value={form.dob}
              onChange={(e) =>
                setForm({ ...form, dob: e.target.value })
              }
            />

            <select
              className="w-full border p-3 rounded-xl"
              value={form.gender}
              onChange={(e) =>
                setForm({ ...form, gender: e.target.value })
              }
            >
              <option value="">Select Gender</option>
              <option>Male</option>
              <option>Female</option>
            </select>

            {form.gender === "Female" && (
              <select
                className="w-full border p-3 rounded-xl"
                value={form.pregnant}
                onChange={(e) =>
                  setForm({ ...form, pregnant: e.target.value })
                }
              >
                <option value="">Pregnant?</option>
                <option>No</option>
                <option>Yes</option>
              </select>
            )}

            <select
              className="w-full border p-3 rounded-xl"
              value={form.country}
              onChange={(e) =>
                handleCountryChange(e.target.value)
              }
            >
              <option>South Africa</option>
              <option>England</option>
              <option>Scotland</option>
              <option>Wales</option>
            </select>

            <div className="flex gap-2">
              <input
                className="w-24 border p-3 rounded-xl bg-gray-100"
                value={form.dialCode}
                readOnly
              />

              <input
                className="flex-1 border p-3 rounded-xl"
                placeholder="Phone Number"
                value={form.phone}
                onChange={(e) =>
                  setForm({ ...form, phone: e.target.value })
                }
              />
            </div>

            <input
              className="w-full border p-3 rounded-xl"
              placeholder="Location"
              value={form.location}
              onChange={(e) =>
                setForm({ ...form, location: e.target.value })
              }
            />

            <textarea
              className="w-full border p-3 rounded-xl h-32"
              placeholder="Describe symptoms"
              value={form.symptoms}
              onChange={(e) =>
                setForm({ ...form, symptoms: e.target.value })
              }
            />

            <button
              onClick={submitTriage}
              disabled={loading}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white p-4 rounded-xl font-bold"
            >
              {loading ? "Submitting..." : "Run Triage"}
            </button>
          </div>
        )}

        {outcome && (
          <div className="border-l-4 border-yellow-500 bg-yellow-50 p-6 rounded-xl">
            <h2 className="text-3xl font-bold mb-4">
              {outcome}
            </h2>

            {outcome === "Emergency referral" && (
              <a
                href={getEmergencyWhatsapp()}
                target="_blank"
                className="inline-block bg-red-600 text-white px-6 py-3 rounded-xl mt-4"
              >
                Contact Emergency Services
              </a>
            )}

            <button
              onClick={() => setOutcome(null)}
              className="ml-4 bg-gray-200 px-6 py-3 rounded-xl"
            >
              New Triage
            </button>
          </div>
        )}
      </div>
    </main>
  );
}
