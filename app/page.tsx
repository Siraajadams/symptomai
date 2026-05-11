'use client';

import { useState } from 'react';
import { createClient } from '@supabase/supabase-js';

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !key) return null;
  return createClient(url, key);
}

export default function Home() {
  const [form, setForm] = useState({
    name: '',
    dob: '',
    gender: '',
    pregnant: 'No',
    country: 'South Africa',
    dialCode: '+27',
    phone: '',
    location: '',
    symptoms: '',
    fever: false,
    chestPain: false,
    breathing: false,
    bleeding: false,
  });

  const [outcome, setOutcome] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [saving, setSaving] = useState(false);

  function updateCountry(country: string) {
    const dialCode = country === 'South Africa' ? '+27' : '+44';
    setForm({ ...form, country, dialCode });
  }

  async function handleSubmit() {
    setSaving(true);

    const emergency = form.chestPain || form.breathing || form.bleeding;
    const triageOutcome = emergency
      ? 'Emergency referral recommended'
      : form.fever
      ? 'Doctor in pharmacy recommended'
      : 'Pharmacist care recommended';

    setOutcome(triageOutcome);
    setSubmitted(true);

    const supabase = getSupabase();

    if (supabase) {
      const { error } = await supabase.from('triage_records').insert([
        {
          name: form.name,
          dob: form.dob || null,
          gender: form.gender,
          pregnant: form.gender === 'Female' ? form.pregnant : 'No',
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
      ]);

      if (error) alert('Supabase error: ' + error.message);
    }

    setSaving(false);
  }

  const whatsappMessage = encodeURIComponent(
    `SymptomAI referral request for ${form.name}. Outcome: ${outcome}. Phone: ${form.dialCode}${form.phone}. Country: ${form.country}. Location: ${form.location}. Symptoms: ${form.symptoms}`
  );

  const emergencyNumber =
    form.country === 'South Africa' ? '27823148000' : '447860039092';

  return (
    <main className="container">
      <div className="logo">
        <div className="logoMark" />
        <div>
          SymptomAI
          <div className="small">Right care. Right place. Right now.</div>
        </div>
      </div>

      {submitted ? (
        <div
          className={`card result ${
            outcome.includes('Emergency')
              ? 'EMERGENCY'
              : outcome.includes('Doctor')
              ? 'DOCTOR_IN_PHARMACY'
              : 'PHARMACIST_CARE'
          }`}
          style={{ marginTop: 24 }}
        >
          <span className="badge">
            {outcome.includes('Emergency')
              ? 'EMERGENCY'
              : outcome.includes('Doctor')
              ? 'DOCTOR IN PHARMACY'
              : 'PHARMACIST CARE'}
          </span>

          <h1>{outcome}</h1>

          <h2>
            {outcome.includes('Emergency')
              ? 'The patient should seek urgent emergency care.'
              : outcome.includes('Doctor')
              ? 'The patient should be referred to a doctor in the pharmacy.'
              : 'The pharmacist can assess and recommend OTC treatment and counselling.'}
          </h2>

          <p>
            <b>Why:</b>{' '}
            {outcome.includes('Emergency')
              ? 'One or more red flags were selected.'
              : outcome.includes('Doctor')
              ? 'Symptoms may require clinical assessment.'
              : 'No emergency red flags were selected.'}
          </p>

          <p>
            <b>Clinical reference:</b> Based on pharmacy red-flag triage
            principles for safe referral and escalation.
          </p>

          <p>
            <b>Safety-net advice:</b> If symptoms worsen, breathing changes,
            chest pain develops, confusion occurs, or severe pain appears, seek
            emergency care immediately.
          </p>

          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginTop: 20 }}>
            {outcome.includes('Emergency') && (
              <>
                <a className="button danger" href="tel:112">
                  Call emergency services
                </a>

                <a
                  className="button danger"
                  target="_blank"
                  href={`https://wa.me/${emergencyNumber}?text=${whatsappMessage}`}
                >
                  WhatsApp emergency referral
                </a>
              </>
            )}

            {outcome.includes('Doctor') && (
              <a
                className="button"
                target="_blank"
                href="https://cpnbs.carelink.digital/home"
              >
                Book doctor via Carelink
              </a>
            )}

            <button
              className="button secondary"
              onClick={() => {
                setSubmitted(false);
                setOutcome('');
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
                Capture basic details, screen red flags, and route patients to
                emergency care, doctor in pharmacy, pharmacist care, or
                self-care.
              </p>
              <a className="button" href="#triage">
                Start triage
              </a>
            </div>

            <div className="card">
              <h2>Built for pharmacies</h2>
              <p>
                Safe red-flag triage, referral support, Supabase storage, and
                basic analytics.
              </p>
            </div>
          </section>

          <div id="triage" className="card" style={{ marginTop: 24 }}>
            <h2>Patient details</h2>

            <div className="grid">
              <label>
                Full name
                <input
                  className="input"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="Patient name"
                />
              </label>

              <label>
                Date of birth
                <input
                  className="input"
                  type="date"
                  value={form.dob}
                  onChange={(e) => setForm({ ...form, dob: e.target.value })}
                />
              </label>

              <label>
                Gender
                <select
                  value={form.gender}
                  onChange={(e) => setForm({ ...form, gender: e.target.value })}
                >
                  <option value="">Select gender</option>
                  <option value="Female">Female</option>
                  <option value="Male">Male</option>
                  <option value="Other">Other / prefer not to say</option>
                </select>
              </label>

              {form.gender === 'Female' && (
                <label>
                  Pregnant?
                  <select
                    value={form.pregnant}
                    onChange={(e) =>
                      setForm({ ...form, pregnant: e.target.value })
                    }
                  >
                    <option value="No">No</option>
                    <option value="Yes">Yes</option>
                    <option value="Unsure">Unsure</option>
                  </select>
                </label>
              )}

              <label>
                Country
                <select
                  value={form.country}
                  onChange={(e) => updateCountry(e.target.value)}
                >
                  <option>South Africa</option>
                  <option>England</option>
                  <option>Wales</option>
                  <option>Scotland</option>
                </select>
              </label>

              <label>
                Mobile / WhatsApp
                <div style={{ display: 'flex', gap: 8 }}>
                  <input
                    className="input"
                    value={form.dialCode}
                    readOnly
                    style={{ maxWidth: 90 }}
                  />
                  <input
                    className="input"
                    value={form.phone}
                    onChange={(e) =>
                      setForm({ ...form, phone: e.target.value })
                    }
                    placeholder="Mobile number"
                  />
                </div>
              </label>

              <label>
                Location
                <input
                  className="input"
                  value={form.location}
                  onChange={(e) =>
                    setForm({ ...form, location: e.target.value })
                  }
                  placeholder="Pharmacy, suburb or town"
                />
              </label>
            </div>

            <h2>Main symptom</h2>

            <label>
              Describe symptoms
              <textarea
                value={form.symptoms}
                onChange={(e) =>
                  setForm({ ...form, symptoms: e.target.value })
                }
                placeholder="Example: fever, cough, chest pain, vomiting..."
                rows={4}
              />
            </label>

            <h2>Red flag check</h2>

            <label className="check">
              <input
                type="checkbox"
                checked={form.fever}
                onChange={(e) => setForm({ ...form, fever: e.target.checked })}
              />
              <span>Fever or symptoms not improving</span>
            </label>

            <label className="check">
              <input
                type="checkbox"
                checked={form.chestPain}
                onChange={(e) =>
                  setForm({ ...form, chestPain: e.target.checked })
                }
              />
              <span>Chest pain, collapse, fainting, or severe palpitations</span>
            </label>

            <label className="check">
              <input
                type="checkbox"
                checked={form.breathing}
                onChange={(e) =>
                  setForm({ ...form, breathing: e.target.checked })
                }
              />
              <span>Difficulty breathing, blue lips, choking, or unable to speak</span>
            </label>

            <label className="check">
              <input
                type="checkbox"
                checked={form.bleeding}
                onChange={(e) =>
                  setForm({ ...form, bleeding: e.target.checked })
                }
              />
              <span>Severe or uncontrolled bleeding</span>
            </label>

            <label className="check">
              <input type="checkbox" required />
              <span>
                I understand this tool supports triage and does not replace a
                clinical diagnosis.
              </span>
            </label>

            <button className="button" onClick={handleSubmit} disabled={saving}>
              {saving ? 'Saving triage...' : 'Get triage recommendation'}
            </button>
          </div>
        </>
      )}

      <p className="small" style={{ marginTop: 20 }}>
        Admin view: <a href="/admin">/admin</a>
      </p>
    </main>
  );
}
