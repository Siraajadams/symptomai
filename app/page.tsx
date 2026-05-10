"use client";

import { useState } from "react";
import { createClient } from "@supabase/supabase-js";

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !key) {
    console.error("Missing Supabase environment variables");
    return null;
  }

  return createClient(url, key);
}

type FormState = {
  name: string;
  dob: string;
  gender: string;
  pregnant: string;
  country: string;
  dialCode: string;
  phone: string;
  location: string;
  symptoms: string;
  fever: boolean;
  chestPain: boolean;
  breathing: boolean;
  bleeding: boolean;
};

export default function Home() {
  const [loading, setLoading] = useState(false);

  const [form, setForm] = useState<FormState>({
    name: "",
    dob: "",
    gender: "",
    pregnant: "No",
    country: "South Africa",
    dialCode: "+27",
    phone: "",
    location: "",
    symptoms: "",
    fever: false,
    chestPain: false,
    breathing: false,
    bleeding: false,
  });

  const [result, setResult] = useState("");

  const handleCountryChange = (country: string) => {
    let dialCode = "+27";

    if (country === "England") dialCode = "+44";
    if (country === "Wales") dialCode = "+44";
    if (country === "Scotland") dialCode = "+44";
    if (country === "South Africa") dialCode = "+27";

    setForm({
      ...form,
      country,
      dialCode,
    });
  };

  const handleSubmit = async () => {
    setLoading(true);

    let outcome = "Pharmacist care recommended";

    const emergency =
      form.chestPain ||
      form.breathing ||
      form.bleeding;

    if (emergency) {
      outcome = "Emergency referral required";
    }

    setResult(outcome);

    const supabase = getSupabase();

    if (!supabase) {
      alert(
        "Supabase not configured correctly in Vercel environment variables."
      );
      setLoading(false);
      return;
    }

    try {
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
          fever: form.fever,
          chest_pain: form.chestPain,
          breathing: form.breathing,
          bleeding: form.bleeding,
          outcome,
        },
      ]);
    } catch (error) {
      console.error(error);
    }

    if (outcome === "Emergency referral required") {
      let emergencyNumber = "082911";

      if (form.country === "England") {
        emergencyNumber = "999";
      }

      if (form.country === "Wales") {
        emergencyNumber = "999";
      }

      if (form.country === "Scotland") {
        emergencyNumber = "999";
      }

      const whatsappMessage = encodeURIComponent(
        `SymptomAI Emergency Referral\n\nPatient: ${form.name}\nCountry: ${form.country}\nLocation: ${form.location}\nSymptoms: ${form.symptoms}\n\nOutcome: Emergency referral required`
      );

      window.open(
        `https://wa.me/${emergencyNumber}?text=${whatsappMessage}`,
        "_blank"
      );
    }

    setLoading(false);
  };

  return (
    <main className="min-h-screen bg-white p-6">
      <div className="max-w-2xl mx-auto">

        <div className="flex items-center gap-3 mb-8">
          <div className="w-12 h-12 rounded-xl bg-black text-white flex items-center justify-center text-2xl">
            +
          </div>

          <div>
            <h1 className="text-4xl font-bold">
              SymptomAI
            </h1>

            <p className="text-gray-500">
              Right care. Right place. Right now.
            </p>
          </div>
        </div>

        <div className="bg-gray-50 rounded-2xl p-6 shadow-sm space-y-4">

          <h2 className="text-2xl font-semibold">
            Patient Details
          </h2>

          <input
            className="w-full border rounded-xl p-3"
            placeholder="Full name"
            value={form.name}
            onChange={(e) =>
              setForm({ ...form, name: e.target.value })
            }
          />

          <input
            type="date"
            className="w-full border rounded-xl p-3"
            value={form.dob}
            onChange={(e) =>
              setForm({ ...form, dob: e.target.value })
            }
          />

          <select
            className="w-full border rounded-xl p-3"
            value={form.gender}
            onChange={(e) =>
              setForm({ ...form, gender: e.target.value })
            }
          >
            <option value="">Select gender</option>
            <option value="Male">Male</option>
            <option value="Female">Female</option>
          </select>

          {form.gender === "Female" && (
            <select
              className="w-full border rounded-xl p-3"
              value={form.pregnant}
              onChange={(e) =>
                setForm({
                  ...form,
                  pregnant: e.target.value,
                })
              }
            >
              <option value="No">Pregnant: No</option>
              <option value="Yes">Pregnant: Yes</option>
            </select>
          )}

          <select
            className="w-full border rounded-xl p-3"
            value={form.country}
            onChange={(e) =>
              handleCountryChange(e.target.value)
            }
          >
            <option>South Africa</option>
            <option>England</option>
            <option>Wales</option>
            <option>Scotland</option>
          </select>

          <div className="flex gap-2">
            <input
              className="w-24 border rounded-xl p-3 bg-gray-100"
              value={form.dialCode}
              readOnly
            />

            <input
              className="flex-1 border rounded-xl p-3"
              placeholder="Phone number"
              value={form.phone}
              onChange={(e) =>
                setForm({
                  ...form,
                  phone: e.target.value,
                })
              }
            />
          </div>

          <input
            className="w-full border rounded-xl p-3"
            placeholder="Location"
            value={form.location}
            onChange={(e) =>
              setForm({
                ...form,
                location: e.target.value,
              })
            }
          />

          <textarea
            className="w-full border rounded-xl p-3"
            rows={4}
            placeholder="Describe symptoms"
            value={form.symptoms}
            onChange={(e) =>
              setForm({
                ...form,
                symptoms: e.target.value,
              })
            }
          />

          <div className="space-y-3 pt-4">

            <label className="flex items-center gap-3">
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
              Fever
            </label>

            <label className="flex items-center gap-3">
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
              Chest pain
            </label>

            <label className="flex items-center gap-3">
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
              Difficulty breathing
            </label>

            <label className="flex items-center gap-3">
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
              Severe bleeding
            </label>
          </div>

          <button
            onClick={handleSubmit}
            disabled={loading}
            className="w-full bg-black text-white rounded-xl p-4 font-semibold mt-4"
          >
            {loading ? "Processing..." : "Run SymptomAI Triage"}
          </button>
        </div>

        {result && (
          <div className="mt-8 bg-white border rounded-2xl p-6 shadow-sm">
            <h2 className="text-3xl font-bold mb-2">
              {result}
            </h2>

            <p className="text-gray-600">
              Clinical guidance generated using
              pharmacy-first triage principles.
            </p>
          </div>
        )}

        <div className="mt-8 text-sm text-gray-400">
          Admin view: /admin
        </div>

      </div>
    </main>
  );
}
