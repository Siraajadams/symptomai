'use client';

import { useState } from 'react';
import { decideTriage, redFlagQuestions } from './lib/triageRules';

type FormState = {
  name: string;
  phone: string;
  email: string;
  location: string;
  age: string;
  pregnant: string;
  symptom: string;
  duration: string;
  redFlags: string[];
  notes: string;
};

const initialForm: FormState = {
  name: '',
  phone: '',
  email: '',
  location: '',
  age: '',
  pregnant: 'no',
  symptom: '',
  duration: 'less_than_3_days',
  redFlags: [],
  notes: '',
};

export default function Home() {
  const [form, setForm] = useState<FormState>(initialForm);
  const [result, setResult] = useState<any>(null);

  function update(key: keyof FormState, value: any) {
    setForm((prev) => ({ ...prev, [key]: value }));
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
      pregnant: form.pregnant,
      symptom: form.symptom,
      duration: form.duration,
      redFlags: form.redFlags,
    });

    const record = {
      id: Date.now(),
      createdAt: new Date().toISOString(),
      form,
      decision,
    };

    const existing = JSON.parse(
      localStorage.getItem('symptomai_triages') || '[]'
    );

    localStorage.setItem(
      'symptomai_triages',
      JSON.stringify([record, ...existing])
    );

    setResult(decision);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  const carelinkUrl = 'https://cpnbs.carelink.digital/home';

  const whatsappText = encodeURIComponent(
    `SymptomAI referral request for ${form.name}. Outcome: ${result?.title}. Phone: ${form.phone}. Location: ${form.location}.`
  );

  const whatsappUrl = `https://wa.me/?text=${whatsappText}`;

  return (
    <main className="container">
      <div className="logo">
        <div className="logoMark" />
        <div>
          SymptomAI
          <div className="small">Right care. Right place. Right now.</div>
        </div>
      </div>

      {result ? (
        <div className={`card result ${result.level}`} style={{ marginTop: 24 }}>
          <span className="badge">{result.level.replaceAll('_', ' ')}</span>

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

          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginTop: 20 }}>
            {result.level === 'EMERGENCY' && (
              <>
                <a className="button danger" href="tel:112">
                  Call emergency services
                </a>

                <a className="button secondary" href={whatsappUrl}>
                  Request paramedic / admin callback
                </a>
              </>
            )}

            {result.level === 'DOCTOR_IN_PHARMACY' && (
              <>
                <a className="button" href={carelinkUrl} target="_blank">
                  Book doctor via Carelink
                </a>

                <a className="button secondary" href={whatsappUrl}>
                  WhatsApp referral note
                </a>
              </>
            )}

            {(result.level === 'PHARMACIST_CARE' ||
              result.level === 'SELF_CARE') && (
              <a className="button secondary" href={whatsappUrl}>
                Send advice / follow-up note
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
        <section className="hero">
          <div className="card">
            <h1>60-second pharmacy triage</h1>

            <p>
              Capture basic details, screen red flags, and route patients to
              emergency care, doctor in pharmacy, pharmacist care, or self-care.
            </p>

            <a className="button" href="#triage">
              Start triage
            </a>
          </div>

          <div className="card">
            <h2>Built for pharmacies</h2>

            <p>
              No diagnosis. No complex EHR. Just safe red-flag triage, referral
              support, and basic analytics.
            </p>
          </div>
        </section>
      )}

      {!result && (
        <div id="triage" className="card" style={{ marginTop: 24 }}>
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
              Mobile / WhatsApp
              <input
                className="input"
                value={form.phone}
                onChange={(e) => update('phone', e.target.value)}
                placeholder="+27..."
              />
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

            <label>
              Age
              <input
                className="input"
                type="number"
                value={form.age}
                onChange={(e) => update('age', e.target.value)}
                placeholder="Age in years"
              />
            </label>

            <label>
              Pregnant?
              <select
                value={form.pregnant}
                onChange={(e) => update('pregnant', e.target.value)}
              >
                <option value="no">No / not applicable</option>
                <option value="yes">Yes</option>
                <option value="unsure">Unsure</option>
              </select>
            </label>
          </div>

          <h2>Main symptom</h2>

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
                <option value="less_than_24_hours">Less than 24 hours</option>
                <option value="less_than_3_days">Less than 3 days</option>
                <option value="more_than_3_days">More than 3 days</option>
                <option value="sudden_or_worsening">Sudden or worsening</option>
              </select>
            </label>
          </div>

          <h2>Red flag check</h2>

          <p>
            Select any serious symptom present. If unsure, select it and refer
            upwards.
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
              rows={3}
            />
          </label>

          <label className="check">
            <input type="checkbox" required />
            <span>
              I understand this tool supports triage and does not replace a
              clinical diagnosis.
            </span>
          </label>

          <button className="button" onClick={submitTriage}>
            Get triage recommendation
          </button>
        </div>
      )}

      <p className="small" style={{ marginTop: 20 }}>
        Admin view: <a href="/admin">/admin</a>
      </p>
    </main>
  );
}
