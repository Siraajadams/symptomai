'use client';

import { useState } from 'react';
import { createClient } from '@supabase/supabase-js';
import { decideTriage, redFlagQuestions } from './lib/triageRules';

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  return createClient(url, key);
}

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
  symptom: string;
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
  symptom: '',
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

  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
    age--;
  }

  return age >= 0 ? String(age) : '';
}

export default function Home() {
  const [form, setForm] = useState<FormState>(initialForm);
  const [result, setResult] = useState<any>(null);
  const [saving, setSaving] = useState(false);

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

  function isUKPatient() {
    return form.country === 'England' || form.country === 'Wales' || form.country === 'Scotland';
  }

  function getDoctorReferralUrl() {
    return isUKPatient() ? 'https://nhs.carelink.digital' : 'https://carelink.digital';
  }

  async function submitTriage() {
    setSaving(true);

    const decision = decideTriage({
      age: Number(form.age || 0),
      pregnant: form.gender === 'female' ? form.pregnant : 'no',
      symptom: form.symptom,
      duration: form.duration,
      redFlags: form.redFlags,
    });

    const doctorReferralUrl = getDoctorReferralUrl();

    const referralStatus =
      decision.level === 'DOCTOR_IN_PHARMACY'
        ? 'Doctor booking recommended'
        : decision.level === 'EMERGENCY'
        ? 'Emergency referred'
        : 'Advice provided';

    const referralChannel =
      decision.level === 'DOCTOR_IN_PHARMACY'
        ? isUKPatient()
          ? 'NHS Carelink UK'
          : 'Carelink South Africa'
        : decision.level === 'EMERGENCY'
        ? 'Emergency services'
        : 'Patient advice';

    const record = {
      id: Date.now(),
      createdAt: new Date().toISOString(),
      form,
      decision,
      referralStatus,
      referralChannel,
      referralUrl: decision.level === 'DOCTOR_IN_PHARMACY' ? doctorReferralUrl : '',
    };

    const existing = JSON.parse(localStorage.getItem('symptomai_triages') || '[]');
    localStorage.setItem('symptomai_triages', JSON.stringify([record, ...existing]));

    const supabase = getSupabase();

    if (supabase) {
      await supabase.from('triage_records').insert([
        {
          name: form.name,
          dob: form.dob || null,
          age: Number(form.age || 0),
          gender: form.gender,
          pregnant: form.gender === 'female' ? form.pregnant : 'no',
          country: form.country,
          dial_code: form.dialCode,
          phone: form.phone,
          email: form.email,
          location: form.location,
          symptom: form.symptom,
          duration: form.duration,
          red_flags: form.redFlags,
          notes: form.notes,
          outcome_level: decision.level,
          outcome_title: decision.title,
          outcome_recommendation: decision.recommendation,
          outcome_reason: decision.reason,
          outcome_reference: decision.reference,
          outcome_safety_net: decision.safetyNet,
          symptoms: form.symptom,
          outcome: decision.title,
          referral_status: referralStatus,
          referral_channel: referralChannel,
          referral_url: decision.level === 'DOCTOR_IN_PHARMACY' ? doctorReferralUrl : null,
          referral_notes: decision.recommendation,
          follow_up_required:
            decision.level === 'DOCTOR_IN_PHARMACY' || decision.level === 'EMERGENCY',
          clinical_notes: form.notes,
        },
      ]);
    }

    setResult(decision);
    setSaving(false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  const patientPhone = `${form.dialCode}${form.phone}`;

  const adviceText = encodeURIComponent(
    `SymptomAI triage summary

Patient: ${form.name}
Phone: ${patientPhone}
Country: ${form.country}
Location: ${form.location}
Outcome: ${result?.title || ''}

Recommendation:
${result?.recommendation || ''}

Clinical reference:
${result?.reference || ''}

Safety-net advice:
${result?.safetyNet || ''}`
  );

  const whatsappUrl = `https://wa.me/?text=${adviceText}`;
  const smsUrl = `sms:${patientPhone}?body=${adviceText}`;
  const emailUrl = `mailto:${form.email}?subject=SymptomAI triage advice&body=${adviceText}`;
  const emergencyWhatsappUrl = `https://wa.me/${emergencyContacts[form.country]}?text=${adviceText}`;

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

          <p><b>Why:</b> {result.reason}</p>
          <p><b>Clinical reference:</b> {result.reference}</p>
          <p><b>Safety-net advice:</b> {result.safetyNet}</p>

          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginTop: 20 }}>
            {result.level === 'EMERGENCY' && (
              <>
                <a className="button danger" href="tel:112">Call emergency services</a>
                <a className="button danger" href={emergencyWhatsappUrl} target="_blank">
                  Contact emergency support
                </a>
              </>
            )}

            {result.level === 'DOCTOR_IN_PHARMACY' && (
              <>
                <a className="button" href={getDoctorReferralUrl()} target="_blank">
                  {isUKPatient() ? 'Book UK GP/IP via NHS Carelink' : 'Book SA doctor via Carelink'}
                </a>
                <a className="button secondary" href={whatsappUrl} target="_blank">
                  WhatsApp referral note
                </a>
                <a className="button secondary" href={smsUrl}>SMS advice</a>
                <a className="button secondary" href={emailUrl}>Email advice</a>
              </>
            )}

            {(result.level === 'PHARMACIST_CARE' || result.level === 'SELF_CARE') && (
              <>
                <a className="button secondary" href={whatsappUrl} target="_blank">
                  WhatsApp advice / follow-up
                </a>
                <a className="button secondary" href={smsUrl}>SMS advice</a>
                <a className="button secondary" href={emailUrl}>Email advice</a>
              </>
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
                Capture basic details, screen red flags, and route patients to emergency care,
                doctor in pharmacy, pharmacist care, or self-care.
              </p>
              <a className="button" href="#triage">Start triage</a>
            </div>

            <div className="card">
              <h2>Built for pharmacies</h2>
              <p>Safe red-flag triage, referral support, and basic analytics.</p>
            </div>
          </section>

          <div id="triage" className="card" style={{ marginTop: 24 }}>
            <h2>Patient details</h2>

            <div className="grid">
              <label>
                Name
                <input className="input" value={form.name} onChange={(e) => update('name', e.target.value)} placeholder="Patient name" />
              </label>

              <label>
                Date of birth
                <input className="input" type="date" value={form.dob} onChange={(e) => updateDob(e.target.value)} />
              </label>

              <label>
                Age
                <input className="input" type="number" value={form.age} onChange={(e) => update('age', e.target.value)} placeholder="Auto-calculated from DOB" />
              </label>

              <label>
                Gender
                <select value={form.gender} onChange={(e) => updateGender(e.target.value)}>
                  <option value="">Select gender</option>
                  <option value="female">Female</option>
                  <option value="male">Male</option>
                  <option value="other">Other / prefer not to say</option>
                </select>
              </label>

              {form.gender === 'female' && (
                <label>
                  Pregnant?
                  <select value={form.pregnant} onChange={(e) => update('pregnant', e.target.value)}>
                    <option value="no">No</option>
                    <option value="yes">Yes</option>
                    <option value="unsure">Unsure</option>
                  </select>
                </label>
              )}

              <label>
                Country
                <select value={form.country} onChange={(e) => updateCountry(e.target.value)}>
                  <option value="South Africa">South Africa</option>
                  <option value="England">England</option>
                  <option value="Wales">Wales</option>
                  <option value="Scotland">Scotland</option>
                </select>
              </label>

              <label>
                Mobile / WhatsApp
                <div style={{ display: 'flex', gap: 8 }}>
                  <input className="input" value={form.dialCode} readOnly style={{ maxWidth: 90 }} />
                  <input className="input" value={form.phone} onChange={(e) => update('phone', e.target.value)} placeholder="Mobile number" />
                </div>
              </label>

              <label>
                Email
                <input className="input" value={form.email} onChange={(e) => update('email', e.target.value)} placeholder="Optional" />
              </label>

              <label>
                Nearest pharmacy / location
                <input className="input" value={form.location} onChange={(e) => update('location', e.target.value)} placeholder="Pharmacy or suburb" />
              </label>
            </div>

            <h2>Main symptom</h2>

            <div className="grid">
              <label>
                Symptom category
                <select value={form.symptom} onChange={(e) => update('symptom', e.target.value)}>
                  <option value="">Select symptom</option>
                  <option value="cold">Cold / flu symptoms</option>
                  <option value="cough">Cough</option>
                  <option value="breathing">Breathing / asthma</option>
                  <option value="chest">Chest pain / palpitations</option>
                  <option value="abdominal">Stomach pain / vomiting / diarrhoea</option>
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
                <select value={form.duration} onChange={(e) => update('duration', e.target.value)}>
                  <option value="less_than_24_hours">Less than 24 hours</option>
                  <option value="less_than_3_days">Less than 3 days</option>
                  <option value="more_than_3_days">More than 3 days</option>
                  <option value="sudden_or_worsening">Sudden or worsening</option>
                </select>
              </label>
            </div>

            <h2>Red flag check</h2>
            <p>Select any serious symptom present. If unsure, select it and refer upwards.</p>

            {redFlagQuestions.map((q) => (
              <label className="check" key={q.id}>
                <input type="checkbox" checked={form.redFlags.includes(q.id)} onChange={() => toggleFlag(q.id)} />
                <span>{q.label}</span>
              </label>
            ))}

            <label>
              Optional notes
              <textarea value={form.notes} onChange={(e) => update('notes', e.target.value)} placeholder="Short pharmacist note" rows={3} />
            </label>

            <label className="check">
              <input type="checkbox" required />
              <span>I understand this tool supports triage and does not replace a clinical diagnosis.</span>
            </label>

            <button className="button" onClick={submitTriage} disabled={saving}>
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
