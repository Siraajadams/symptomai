"use client";

import { useState } from "react";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export default function Home() {
  const [form, setForm] = useState({
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

  const [outcome, setOutcome] = useState("");
  const [submitted, setSubmitted] = useState(false);

  const updateCountry = (country: string) => {
    let code = "+27";

    if (country === "England") code = "+44";
    if (country === "Wales") code = "+44";
    if (country === "Scotland") code = "+44";
    if (country === "South Africa") code = "+27";

    setForm({
      ...form,
      country,
      dialCode: code,
    });
  };

  const handleSubmit = async () => {
    let triageOutcome = "Pharmacist care recommended";

    if (
      form.chestPain ||
      form.breathing ||
      form.bleeding
    ) {
      triageOutcome = "Emergency referral recommended";
    }

    setOutcome(triageOutcome);
    setSubmitted(true);

    try {
      const { data, error } = await supabase
        .from("triage_records")
        .insert([
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
            outcome: triageOutcome,
          },
        ])
        .select();

      if (error) {
        alert("Supabase error: " + error.message);
        console.error(error);
      } else {
        console.log("Saved:", data);
        alert("Triage saved successfully");
      }
    } catch (error: any) {
      alert("Unexpected error: " + error.message);
      console.error(error);
    }

    let emergencyNumber = "";

    if (form.country === "South Africa") {
      emergencyNumber = "27823148000";
    } else {
      emergencyNumber = "447860039092";
    }

    const whatsappMessage = `SymptomAI referral request for ${form.name}. Outcome: ${triageOutcome}. Phone: ${form.dialCode}${form.phone}. Country: ${form.country}. Location: ${form.location}.`;

    const whatsappUrl = `https://wa.me/${emergencyNumber}?text=${encodeURIComponent(
      whatsappMessage
    )}`;

    window.open(whatsappUrl, "_blank");
  };

  if (submitted) {
    return (
      <main className="min-h-screen bg-gray-50 p-6">
        <div className="max-w-3xl mx-auto bg-white rounded-3xl shadow-xl p-8">
          <h1 className="text-5xl font-bold mb-6 text-gray-900">
            SymptomAI
          </h1>

          <div className="border-l-4 border-yellow-500 pl-6">
            <p className="text-sm font-bold uppercase text-gray-500">
              TRIAGE OUTCOME
            </p>

            <h2 className="text-4xl font-bold mt-2 mb-4">
              {outcome}
            </h2>

            <p className="text-gray-600 text-lg">
              Thank you. Your assessment has been completed.
            </p>
          </div>

          <button
            onClick={() => {
              setSubmitted(false);
              setOutcome("");
            }}
            className="mt-8 bg-black text-white px-6 py-3 rounded-2xl"
          >
            New triage
          </button>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-3xl mx-auto bg-white rounded-3xl shadow-xl p-8">
        <h1 className="text-5xl font-bold mb-2 text-gray-900">
          SymptomAI
        </h1>

        <p className="text-gray-500 mb-8 text-lg">
          Right care. Right place. Right now.
        </p>

        <div className="space-y-5">
          <input
            type="text"
            placeholder="Full name"
            value={form.name}
            onChange={(e) =>
              setForm({ ...form, name: e.target.value })
            }
            className="w-full border p-4 rounded-2xl"
          />

          <input
            type="date"
            value={form.dob}
            onChange={(e) =>
              setForm({ ...form, dob: e.target.value })
            }
            className="w-full border p-4 rounded-2xl"
          />

          <select
            value={form.gender}
            onChange={(e) =>
              setForm({ ...form, gender: e.target.value })
            }
            className="w-full border p-4 rounded-2xl"
          >
            <option value="">Select gender</option>
            <option value="Male">Male</option>
            <option value="Female">Female</option>
          </select>

          {form.gender === "Female" && (
            <select
              value={form.pregnant}
              onChange={(e) =>
                setForm({
                  ...form,
                  pregnant: e.target.value,
                })
              }
              className="w-full border p-4 rounded-2xl"
            >
              <option value="No">Pregnant: No</option>
              <option value="Yes">Pregnant: Yes</option>
            </select>
          )}

          <select
            value={form.country}
            onChange={(e) => updateCountry(e.target.value)}
            className="w-full border p-4 rounded-2xl"
          >
            <option>South Africa</option>
            <option>England</option>
            <option>Wales</option>
            <option>Scotland</option>
          </select>

          <div className="flex gap-3">
            <input
              type="text"
              value={form.dialCode}
              readOnly
              className="w-24 border p-4 rounded-2xl bg-gray-100"
            />

            <input
              type="text"
              placeholder="Phone number"
              value={form.phone}
              onChange={(e) =>
                setForm({
                  ...form,
                  phone: e.target.value,
                })
              }
              className="flex-1 border p-4 rounded-2xl"
            />
          </div>

          <input
            type="text"
            placeholder="Location"
            value={form.location}
            onChange={(e) =>
              setForm({
                ...form,
                location: e.target.value,
              })
            }
            className="w-full border p-4 rounded-2xl"
          />

          <textarea
            placeholder="Describe symptoms"
            value={form.symptoms}
            onChange={(e) =>
              setForm({
                ...form,
                symptoms: e.target.value,
              })
            }
            className="w-full border p-4 rounded-2xl h-32"
          />

          <div className="space-y-3">
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
            className="w-full bg-black text-white py-4 rounded-2xl text-lg font-bold"
          >
            Submit assessment
          </button>
        </div>
      </div>
    </main>
  );
}
