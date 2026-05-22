'use client';

import { useMemo, useState } from 'react';

type FormState = {
  name: string;
  dob: string;
  gender: string;
  country: string;
  dialCode: string;
  phone: string;
  email: string;
  location: string;
  age: string;
  pregnant: string;
  symptoms: string[];
  duration: string;
  redFlags: string[];
  notes: string;
};

type TriageInput = {
  age: number;
  gender: string;
  pregnant: string;
  symptoms: string[];
  duration: string;
  redFlags: string[];
};

type TriageResult = {
  level: string;
  destination: string;
  advice: string;
  urgency: string;
  summary: string;
};

const symptomOptions = [
  'Backache',
  'Bites',
  'Cold and Flu',
  'Dental Pain',
  'Earache',
  'Eye Infection',
  'Hayfever',
  'Menstrual Pain',
  'Palpitations',
  'Poisoning',
  'Rashes',
  'Red Eyes',
  'Urinary Tract Infection',
].sort();

const redFlagOptions = [
  'Chest pain',
  'Difficulty breathing',
  'Severe bleeding',
  'Confusion',
  'Loss of consciousness',
  'Severe dehydration',
  'Stroke symptoms',
];

const initialForm: FormState = {
  name: '',
  dob: '',
  gender: '',
  country: 'South Africa',
  dialCode: '+27',
  phone: '',
  email: '',
  location: '',
  age: '',
  pregnant: 'no',
  symptoms: [],
  duration: '',
  redFlags: [],
  notes: '',
};

function decideTriage(data: TriageInput): TriageResult {
  const emergencySymptoms = [
    'Palpitations',
    'Poisoning',
  ];

  const hasEmergencySymptom = data.symptoms.some((s) =>
    emergencySymptoms.includes(s)
  );

  if (
    data.redFlags.length > 0 ||
    hasEmergencySymptom
  ) {
    return {
      level: 'Emergency',
      destination: 'Emergency Care',
      urgency: 'Immediate',
      advice:
        'Please seek urgent emergency medical attention immediately.',
      summary:
        'Red flag symptoms identified requiring emergency escalation.',
    };
  }

  if (
    data.symptoms.includes('Urinary Tract Infection') ||
    data.symptoms.includes('Dental Pain') ||
    data.symptoms.includes('Eye Infection') ||
    data.symptoms.includes('Earache')
  ) {
    return {
      level: 'Doctor Review',
      destination: 'Doctor / GP / Pharmacy Clinic',
      urgency: 'Within 24 hours',
      advice:
        'A healthcare professional review is recommended.',
      summary:
        'Symptoms suitable for GP or pharmacist-led clinical assessment.',
    };
  }

  return {
    level: 'Self Care',
    destination: 'Pharmacy / Home Care',
    urgency: 'Routine',
    advice:
      'Supportive care and pharmacist guidance recommended.',
    summary:
      'Symptoms appear suitable for pharmacy-led care and monitoring.',
  };
}

export default function Page() {
  const [form, setForm] =
    useState<FormState>(initialForm);

  const [result, setResult] =
    useState<TriageResult | null>(null);

  function update<K extends keyof FormState>(
    key: K,
    value: FormState[K]
  ) {
    setForm((prev) => ({
      ...prev,
      [key]: value,
    }));
  }

  function toggleSymptom(symptom: string) {
    setForm((prev) => ({
      ...prev,
      symptoms: prev.symptoms.includes(symptom)
        ? prev.symptoms.filter(
            (s) => s !== symptom
          )
        : [...prev.symptoms, symptom],
    }));
  }

  function toggleRedFlag(flag: string) {
    setForm((prev) => ({
      ...prev,
      redFlags: prev.redFlags.includes(flag)
        ? prev.redFlags.filter(
            (f) => f !== flag
          )
        : [...prev.redFlags, flag],
    }));
  }

  function submitTriage() {
    const decision = decideTriage({
      age: Number(form.age || 0),
      gender: form.gender,
      pregnant:
        form.gender === 'female'
          ? form.pregnant
          : 'no',
      symptoms: form.symptoms,
      duration: form.duration,
      redFlags: form.redFlags,
    });

    setResult(decision);
  }

  const alphabeticalSymptoms = useMemo(
    () => symptomOptions,
    []
  );

  return (
    <main className="min-h-screen bg-[#f7f9fc] p-6">
      <div className="max-w-3xl mx-auto bg-white rounded-3xl shadow-xl p-6 space-y-6">
        <div className="space-y-2">
          <h1 className="text-4xl font-bold text-[#0f172a]">
            SymptomAI
          </h1>

          <p className="text-gray-600">
            Right care. Right place. Right now.
          </p>

          <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-sm text-red-700">
            Emergency? Call Netcare 911:
            <span className="font-bold ml-1">
              082 911
            </span>
          </div>
        </div>

        <div className="grid md:grid-cols-2 gap-4">
          <input
            placeholder="Full name"
            className="border rounded-xl p-3"
            value={form.name}
            onChange={(e) =>
              update('name', e.target.value)
            }
          />

          <input
            placeholder="Age"
            className="border rounded-xl p-3"
            value={form.age}
            onChange={(e) =>
              update('age', e.target.value)
            }
          />

          <select
            className="border rounded-xl p-3"
            value={form.gender}
            onChange={(e) =>
              update('gender', e.target.value)
            }
          >
            <option value="">
              Select gender
            </option>
            <option value="male">
              Male
            </option>
            <option value="female">
              Female
            </option>
            <option value="other">
              Other
            </option>
          </select>

          <select
            className="border rounded-xl p-3"
            value={form.duration}
            onChange={(e) =>
              update(
                'duration',
                e.target.value
              )
            }
          >
            <option value="">
              Symptom duration
            </option>
            <option value="1 day">
              1 day
            </option>
            <option value="2-3 days">
              2–3 days
            </option>
            <option value="1 week">
              1 week
            </option>
            <option value="More than 1 week">
              More than 1 week
            </option>
          </select>
        </div>

        {form.gender === 'female' && (
          <div>
            <label className="text-sm font-medium">
              Pregnant?
            </label>

            <select
              className="border rounded-xl p-3 w-full mt-2"
              value={form.pregnant}
              onChange={(e) =>
                update(
                  'pregnant',
                  e.target.value
                )
              }
            >
              <option value="no">
                No
              </option>
              <option value="yes">
                Yes
              </option>
            </select>
          </div>
        )}

        <div className="space-y-3">
          <label className="font-medium text-sm">
            Select Symptoms
          </label>

          <div className="flex flex-wrap gap-2">
            {alphabeticalSymptoms.map(
              (symptom) => (
                <button
                  key={symptom}
                  type="button"
                  onClick={() =>
                    toggleSymptom(symptom)
                  }
                  className={`px-3 py-2 rounded-full border text-sm transition ${
                    form.symptoms.includes(
                      symptom
                    )
                      ? 'bg-cyan-500 text-white border-cyan-500'
                      : 'bg-white text-gray-700 border-gray-300'
                  }`}
                >
                  {form.symptoms.includes(
                    symptom
                  )
                    ? '✓ '
                    : ''}
                  {symptom}
                </button>
              )
            )}
          </div>
        </div>

        <div className="space-y-3">
          <label className="font-medium text-sm">
            Red Flags
          </label>

          <div className="flex flex-wrap gap-2">
            {redFlagOptions.map((flag) => (
              <button
                key={flag}
                type="button"
                onClick={() =>
                  toggleRedFlag(flag)
                }
                className={`px-3 py-2 rounded-full border text-sm transition ${
                  form.redFlags.includes(flag)
                    ? 'bg-red-500 text-white border-red-500'
                    : 'bg-white text-gray-700 border-gray-300'
                }`}
              >
                {flag}
              </button>
            ))}
          </div>
        </div>

        <textarea
          placeholder="Additional notes"
          className="border rounded-xl p-3 w-full min-h-[120px]"
          value={form.notes}
          onChange={(e) =>
            update('notes', e.target.value)
          }
        />

        <button
          onClick={submitTriage}
          className="bg-cyan-500 hover:bg-cyan-600 transition text-white px-6 py-4 rounded-2xl font-semibold w-full"
        >
          Start AI Triage
        </button>

        {result && (
          <div className="bg-slate-50 border rounded-2xl p-6 space-y-3">
            <h2 className="text-2xl font-bold">
              Triage Result
            </h2>

            <div>
              <span className="font-semibold">
                Severity:
              </span>{' '}
              {result.level}
            </div>

            <div>
              <span className="font-semibold">
                Destination:
              </span>{' '}
              {result.destination}
            </div>

            <div>
              <span className="font-semibold">
                Urgency:
              </span>{' '}
              {result.urgency}
            </div>

            <div>
              <span className="font-semibold">
                Advice:
              </span>{' '}
              {result.advice}
            </div>

            <div>
              <span className="font-semibold">
                Summary:
              </span>{' '}
              {result.summary}
            </div>

            <div className="flex flex-wrap gap-3 pt-4">
              <button className="bg-green-500 text-white px-4 py-2 rounded-xl">
                WhatsApp Report
              </button>

              <button className="bg-blue-500 text-white px-4 py-2 rounded-xl">
                Email Report
              </button>

              <button className="bg-slate-800 text-white px-4 py-2 rounded-xl">
                Download PDF
              </button>
            </div>
          </div>
        )}

        <div className="border-t pt-4 text-xs text-gray-500 leading-relaxed">
          Clinical guidance references:
          NICE Guidelines, South African
          Primary Care Guidelines, WHO
          symptom escalation guidance,
          Pharmacy First pathways, emergency
          escalation screening.
        </div>
      </div>
    </main>
  );
}
