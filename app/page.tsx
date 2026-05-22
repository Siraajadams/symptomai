'use client';

import { useState } from 'react';
import { decideTriage, redFlagQuestions } from './lib/triageRules';

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

const countryDialCodes: Record<string, string> = {
  England: '+44',
  Wales: '+44',
  Scotland: '+44',
  'South Africa': '+27',
};

const emergencyContacts: Record<string, string> = {
  'South Africa': '27823111111',
  England: '44111',
  Wales: '44111',
  Scotland: '44111',
};

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
  symptoms: '',
  duration: 'less_than_3_days',
  redFlags: [],
  notes: '',
};

function calculateAge(dob: string) {
  if (!dob) return '';

  const birthDate = new Date(dob);
  const today = new Date();

  let age = today.getFullYear() - birthDate.getFullYear();
  const monthDiff = today.getMonth() - birthDate.getMonth();

  if (
    monthDiff < 0 ||
    (monthDiff === 0 && today.getDate() < birthDate.getDate())
  ) {
    age--;
  }

  return age >= 0 ? String(age) : '';
}

export default function Home() {
  const [form, setForm] = useState<FormState>(initialForm);
  const [result, setResult] = useState<any>(null);

  function update(key: keyof FormState, value: any) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function updateCountry(country: string) {
    setForm((prev) => ({
      ...prev,
      country,
      dialCode: countryDialCodes[country] || '',
    }));
  }

  function updateDob(dob: string) {
    setForm((prev) => ({
      ...prev,
      dob,
      age: calculateAge(dob),
    }));
  }

  function updateGender(gender: string) {
    setForm((prev) => ({
      ...prev,
      gender,
      pregnant: gender === 'female' ? prev.pregnant : 'no',
    }));
  }

  function toggleFlag(id: string) {
    setForm((prev) => ({
      ...prev,
      redFlags: prev.redFlags.includes(id)
        ? prev.redFlags.filter((x) => x !== id)
        : [...prev.redFlags, id],
    }));
  }

  function submitTriage() {
    const decision = decideTriage({
      age: Number(form.age || 0),
      gender: form.gender,
      pregnant: form.gender === 'female' ? form.pregnant : 'no',
      symptoms: form.symptoms,
      duration: form.duration,
      redFlags: form.redFlags,
    });

    setResult(decision);

    window.scrollTo({
      top: 0,
      behavior: 'smooth',
    });
  }

  const carelinkUrl =
    form.country === 'South Africa'
      ? 'https://carelink.digital'
      : 'https://cpnbs.carelink.digital/home';

  const patientPhone = `${form.dialCode}${form.phone}`;

  const standardWhatsappText = encodeURIComponent(
    `SymptomAI referral request for ${form.name}. Outcome: ${result?.title}. Phone: ${patientPhone}. Country: ${form.country}. Location: ${form.location}.`
  );

  const emergencyWhatsappText = encodeURIComponent(
    `EMERGENCY TRIAGE ALERT

Patient: ${form.name}
Phone: ${patientPhone}
Country: ${form.country}
Location: ${form.location}
Outcome: ${result?.title}

SymptomAI identified emergency referral criteria. Please contact or assist the patient urgently.`
  );

  const standardWhatsappUrl = `https://wa.me/?text=${standardWhatsappText}`;

  const emergencyWhatsappUrl = `https://wa.me/${
    emergencyContacts[form.country]
  }?text=${emergencyWhatsappText}`;

  return (
    <>
      <style jsx global>{`
        * {
          box-sizing: border-box;
        }

        html,
        body {
          margin: 0;
          padding: 0;
          font-family: Arial, sans-serif;
          background: #eef8f8;
          color: #071b3d;
        }

        body {
          overflow-x: hidden;
        }

        .container {
          max-width: 760px;
          margin: 0 auto;
          padding: 28px 18px 80px;
        }

        .logo {
          display: flex;
          align-items: center;
          gap: 14px;
          margin-bottom: 28px;
        }

        .logoMark {
          width: 72px;
          height: 72px;
          border-radius: 22px;
          background: #071b3d;
          position: relative;
          flex-shrink: 0;
        }

        .logoMark::before {
          content: '+';
          color: #1dd5c5;
          font-size: 52px;
          font-weight: 900;
          position: absolute;
          inset: 0;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .brandTitle {
          font-size: 52px;
          line-height: 0.95;
          font-weight: 900;
        }

        .small {
          font-size: 16px;
          color: #697586;
          font-weight: 800;
          margin-top: 8px;
        }

        .hero {
          display: grid;
          gap: 22px;
        }

        .card {
          background: #ffffff;
          border-radius: 34px;
          padding: 30px;
          margin-bottom: 24px;
          box-shadow: 0 18px 55px rgba(7, 27, 61, 0.08);
          overflow: hidden;
        }

        .card h1 {
          font-size: 60px;
          line-height: 0.95;
          margin: 0 0 20px;
          font-weight: 900;
        }

        .card h2 {
          font-size: 36px;
          line-height: 1.05;
          margin: 0 0 18px;
          font-weight: 900;
        }

        .card p {
          font-size: 18px;
          line-height: 1.5;
          color: #6b7785;
          margin: 0 0 20px;
        }

        .button {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          background: #1dcfc1;
          color: white;
          border: none;
          border-radius: 18px;
          padding: 16px 24px;
          font-size: 18px;
          font-weight: 900;
          text-decoration: none;
          cursor: pointer;
        }

        .button.secondary {
          background: #071b3d;
        }

        .button.danger {
          background: #d92d20;
        }

        .grid {
          display: grid;
          grid-template-columns: 1fr;
          gap: 18px;
        }

        label {
          display: block;
          font-size: 18px;
          font-weight: 900;
          margin-top: 14px;
        }

        .input,
        select,
        textarea {
          width: 100%;
          margin-top: 10px;
          padding: 18px;
          border-radius: 18px;
          border: 2px solid #dfe7e8;
          font-size: 17px;
          background: white;
          color: #071b3d;
          font-family: Arial, sans-serif;
        }

        textarea {
          min-height: 110px;
        }

        .check {
          display: flex;
          align-items: flex-start;
          gap: 14px;
          border: 2px solid #e4eaec;
          border-radius: 22px;
          padding: 18px;
          margin: 14px 0;
          background: white;
        }

        .check input {
          width: 22px;
          height: 22px;
          margin-top: 2px;
          flex-shrink: 0;
        }

        .check span {
          font-size: 17px;
          line-height: 1.4;
          font-weight: 800;
        }

        .badge {
          display: inline-block;
          background: #eef8f8;
          padding: 10px 14px;
          border-radius: 999px;
          font-size: 12px;
          font-weight: 900;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          margin-bottom: 18px;
        }

        .result {
          border-left: 8px solid #1dcfc1;
        }

        .result.DOCTOR_IN_PHARMACY {
          border-left-color: #f79009;
        }

        .result.EMERGENCY {
          border-left-color: #d92d20;
        }

        @media (max-width: 640px) {
          .container {
            padding: 20px 14px 60px;
          }

          .brandTitle {
            font-size: 38px;
          }

          .card {
            padding: 24px;
            border-radius: 28px;
          }

          .card h1 {
            font-size: 42px;
          }

          .card h2 {
            font-size: 30px;
          }

          .button {
            width: 100%;
          }
        }
      `}</style>

      <main className="container">
        <div className="logo">
          <div className="logoMark" />

          <div>
            <div className="brandTitle">SymptomAI</div>

            <div className="small">
              Right care. Right place. Right now.
            </div>
          </div>
        </div>

        {result ? (
          <div className={`card result ${result.level}`}>
            <span className="badge">
              {result.level.replaceAll('_', ' ')}
            </span>

            <h1>{result.title}</h1>

            <h2>{result.recommendation}</h2>

            <p>
              <b>Why:</b> {result.reason}
            </p>

            <p>
              <b>Clinical reference:</b> {result.reference}
            </p>

            <p>
              <b>Safety-net advice:</b> {result.safetyNet}
            </p>

            <div
              style={{
                display: 'flex',
                gap: 12,
                flexWrap: 'wrap',
                marginTop: 24,
              }}
            >
              {result.level === 'EMERGENCY' && (
                <>
                  <a className="button danger" href="tel:112">
                    Call emergency services
                  </a>

                  <a
                    className="button danger"
                    href={emergencyWhatsappUrl}
                    target="_blank"
                  >
                    Emergency support
                  </a>
                </>
              )}

              {result.level === 'DOCTOR_IN_PHARMACY' && (
                <>
                  <a
                    className="button"
                    href={carelinkUrl}
                    target="_blank"
                  >
                    Book doctor via Carelink
                  </a>

                  <a
                    className="button secondary"
                    href={standardWhatsappUrl}
                    target="_blank"
                  >
                    WhatsApp referral note
                  </a>
                </>
              )}

              {(result.level === 'PHARMACIST_CARE' ||
                result.level === 'SELF_CARE') && (
                <a
                  className="button secondary"
                  href={standardWhatsappUrl}
                  target="_blank"
                >
                  Send advice / follow-up
                </a>
              )}

              <button
                className="button"
                onClick={() => {
                  setResult(null);
                  setForm(initialForm);
                }}
              >
                New triage
              </button>
            </div>
          </div>
        ) : (
          <>
            <section className="hero">
              <div className="card">
                <h1>60-second pharmacy triage</h1>

                <p>
                  Capture basic details, screen red flags, and route patients
                  to emergency care, doctor in pharmacy, pharmacist care, or
                  self-care.
                </p>

                <a className="button" href="#triage">
                  Start triage
                </a>
              </div>

              <div className="card">
                <h2>Built for pharmacies</h2>

                <p>
                  Safe red-flag triage, referral support, and basic analytics.
                </p>
              </div>
            </section>

            <div id="triage" className="card">
              <h2>Patient details</h2>

              <div className="grid">
                <label>
                  Name
                  <input
                    className="input"
                    value={form.name}
                    onChange={(e) => update('name', e.target.value)}
                    placeholder="Patient name"
                  />
                </label>

                <label>
                  Date of birth
                  <input
                    className="input"
                    type="date"
                    value={form.dob}
                    onChange={(e) => updateDob(e.target.value)}
                  />
                </label>

                <label>
                  Age
                  <input
                    className="input"
                    type="number"
                    value={form.age}
                    onChange={(e) => update('age', e.target.value)}
                    placeholder="Auto-calculated from DOB"
                  />
                </label>

                <label>
                  Gender
                  <select
                    value={form.gender}
                    onChange={(e) => updateGender(e.target.value)}
                  >
                    <option value="">Select gender</option>
                    <option value="female">Female</option>
                    <option value="male">Male</option>
                    <option value="other">Other</option>
                  </select>
                </label>

                {form.gender === 'female' && (
                  <label>
                    Pregnant?
                    <select
                      value={form.pregnant}
                      onChange={(e) =>
                        update('pregnant', e.target.value)
                      }
                    >
                      <option value="no">No</option>
                      <option value="yes">Yes</option>
                      <option value="unsure">Unsure</option>
                    </select>
                  </label>
                )}

                <label>
                  Country
                  <select
                    value={form.country}
                    onChange={(e) => updateCountry(e.target.value)}
                  >
                    <option value="South Africa">South Africa</option>
                    <option value="England">England</option>
                    <option value="Wales">Wales</option>
                    <option value="Scotland">Scotland</option>
                  </select>
                </label>

                <label>
                  Mobile / WhatsApp
                  <div
                    style={{
                      display: 'flex',
                      gap: 10,
                    }}
                  >
                    <input
                      className="input"
                      value={form.dialCode}
                      readOnly
                      style={{ maxWidth: 100 }}
                    />

                    <input
                      className="input"
                      value={form.phone}
                      onChange={(e) => update('phone', e.target.value)}
                      placeholder="Mobile number"
                    />
                  </div>
                </label>

                <label>
                  Email
                  <input
                    className="input"
                    value={form.email}
                    onChange={(e) => update('email', e.target.value)}
                    placeholder="Optional"
                  />
                </label>

                <label>
                  Nearest pharmacy / location
                  <input
                    className="input"
                    value={form.location}
                    onChange={(e) => update('location', e.target.value)}
                    placeholder="Pharmacy or suburb"
                  />
                </label>
              </div>

              <h2 style={{ marginTop: 36 }}>Main symptom</h2>

              <div className="grid">
                <label>
                  Symptom category
                  <select
                    value={form.symptom}
                    onChange={(e) => update('symptom', e.target.value)}
                  >
                    <option value="">Select symptom</option>
                    <option value="cold">Cold / flu symptoms</option>
                    <option value="cough">Cough</option>
                    <option value="breathing">Breathing / asthma</option>
                    <option value="chest">Chest pain / palpitations</option>
                    <option value="abdominal">
                      Stomach pain / vomiting / diarrhoea
                    </option>
                    <option value="urinary">Urinary symptoms</option>
                    <option value="pain">Pain / headache</option>
                    <option value="skin">Skin / rash</option>
                    <option value="allergy">Allergy</option>
                    <option value="injury">Injury / wound / burn</option>
                    <option value="pregnancy">Pregnancy concern</option>
                    <option value="child">Child illness</option>
                    <option value="minor">Other minor symptom</option>
                  </select>
                </label>

                <label>
                  Duration
                  <select
                    value={form.duration}
                    onChange={(e) => update('duration', e.target.value)}
                  >
                    <option value="less_than_24_hours">
                      Less than 24 hours
                    </option>

                    <option value="less_than_3_days">
                      Less than 3 days
                    </option>

                    <option value="more_than_3_days">
                      More than 3 days
                    </option>

                    <option value="sudden_or_worsening">
                      Sudden or worsening
                    </option>
                  </select>
                </label>
              </div>

              <h2 style={{ marginTop: 36 }}>Red flag check</h2>

              <p>
                Select any serious symptom present. If unsure, select it and
                refer upwards.
              </p>

              {redFlagQuestions.map((q) => (
                <label className="check" key={q.id}>
                  <input
                    type="checkbox"
                    checked={form.redFlags.includes(q.id)}
                    onChange={() => toggleFlag(q.id)}
                  />

                  <span>{q.label}</span>
                </label>
              ))}

              <label>
                Optional notes
                <textarea
                  value={form.notes}
                  onChange={(e) => update('notes', e.target.value)}
                  placeholder="Short pharmacist note"
                />
              </label>

              <label className="check">
                <input type="checkbox" required />

                <span>
                  I understand this tool supports triage and does not replace a
                  clinical diagnosis.
                </span>
              </label>

              <button
                className="button"
                style={{ marginTop: 22 }}
                onClick={submitTriage}
              >
                Get triage recommendation
              </button>
            </div>
          </>
        )}
      </main>
    </>
  );
}
