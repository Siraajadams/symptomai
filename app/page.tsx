'use client';

import { useState } from 'react';
import { decideTriage, redFlagQuestions } from './lib/triageRules';

export default function Home() {
  const [submitted, setSubmitted] = useState(false);

  return (
    <>
      <style jsx global>{`
        * {
          box-sizing: border-box;
        }

        body {
          margin: 0;
          font-family: Inter, Arial, sans-serif;
          background: #eef5f4;
          color: #0b1b3b;
        }

        .container {
          max-width: 760px;
          margin: 0 auto;
          padding: 24px;
        }

        .logo {
          display: flex;
          align-items: center;
          gap: 16px;
          margin-bottom: 24px;
        }

        .logoBox {
          width: 64px;
          height: 64px;
          border-radius: 18px;
          background: #071b46;
          display: flex;
          align-items: center;
          justify-content: center;
          color: #19d3c5;
          font-size: 40px;
          font-weight: 700;
        }

        .logoText h1 {
          margin: 0;
          font-size: 54px;
          line-height: 1;
        }

        .logoText p {
          margin: 4px 0 0;
          color: #667085;
          font-weight: 600;
          font-size: 18px;
        }

        .card {
          background: white;
          border-radius: 32px;
          padding: 32px;
          margin-bottom: 24px;
          box-shadow: 0 8px 30px rgba(0,0,0,0.06);
        }

        h2 {
          margin-top: 0;
          font-size: 52px;
          line-height: 1;
          margin-bottom: 20px;
        }

        .muted {
          color: #667085;
          font-size: 20px;
          line-height: 1.6;
        }

        .button {
          background: #18c4b7;
          color: white;
          border: none;
          border-radius: 18px;
          padding: 18px 28px;
          font-size: 24px;
          font-weight: 700;
          cursor: pointer;
          margin-top: 24px;
        }

        .input,
        select,
        textarea {
          width: 100%;
          padding: 18px;
          border-radius: 18px;
          border: 2px solid #e4e7ec;
          font-size: 18px;
          margin-top: 8px;
          margin-bottom: 20px;
          background: white;
        }

        .label {
          font-weight: 700;
          font-size: 18px;
        }

        .redFlag {
          border: 2px solid #e5e7eb;
          border-radius: 24px;
          padding: 24px;
          display: flex;
          gap: 16px;
          align-items: flex-start;
          margin-bottom: 18px;
          background: #fff;
        }

        .redFlag input {
          width: 28px;
          height: 28px;
          margin-top: 4px;
        }

        .redFlag span {
          font-size: 20px;
          font-weight: 700;
          line-height: 1.4;
        }

        .sectionTitle {
          font-size: 28px;
          font-weight: 800;
          margin-top: 40px;
          margin-bottom: 10px;
        }

        .admin {
          margin-top: 24px;
          color: #667085;
        }

        .admin a {
          color: #667085;
        }

        @media (max-width: 768px) {
          .logoText h1 {
            font-size: 42px;
          }

          h2 {
            font-size: 44px;
          }

          .card {
            padding: 24px;
            border-radius: 28px;
          }
        }
      `}</style>

      <main className="container">
        <div className="logo">
          <div className="logoBox">+</div>

          <div className="logoText">
            <h1>SymptomAI</h1>
            <p>Right care. Right place. Right now.</p>
          </div>
        </div>

        {!submitted && (
          <>
            <div className="card">
              <h2>60-second pharmacy triage</h2>

              <p className="muted">
                Capture basic details, screen red flags, and route patients to
                emergency care, doctor in pharmacy, pharmacist care, or self-care.
              </p>

              <button
                className="button"
                onClick={() => {
                  document
                    .getElementById('triage')
                    ?.scrollIntoView({ behavior: 'smooth' });
                }}
              >
                Start triage
              </button>
            </div>

            <div className="card">
              <h2 style={{ fontSize: 38 }}>Built for pharmacies</h2>

              <p className="muted">
                Safe red-flag triage, referral support, and basic analytics.
              </p>
            </div>

            <div id="triage" className="card">
              <div className="sectionTitle">Patient details</div>

              <div className="label">Full name</div>
              <input className="input" placeholder="Patient name" />

              <div className="label">Date of birth</div>
              <input className="input" type="date" />

              <div className="label">Gender</div>
              <select>
                <option>Select gender</option>
                <option>Female</option>
                <option>Male</option>
              </select>

              <div className="label">Country</div>
              <select>
                <option>South Africa</option>
                <option>England</option>
                <option>Wales</option>
                <option>Scotland</option>
              </select>

              <div className="label">Mobile / WhatsApp</div>
              <input className="input" placeholder="Mobile number" />

              <div className="label">Nearest pharmacy / location</div>
              <input className="input" placeholder="Pharmacy or suburb" />

              <div className="sectionTitle">Main symptom</div>

              <div className="label">Symptom category</div>
              <select>
                <option>Select symptom</option>
                <option>Cold / flu symptoms</option>
                <option>Cough</option>
                <option>Breathing / asthma</option>
                <option>Chest pain / palpitations</option>
                <option>Stomach pain / vomiting / diarrhoea</option>
                <option>Urinary symptoms</option>
                <option>Pain / headache</option>
                <option>Skin / rash</option>
                <option>Allergy</option>
                <option>Injury / wound / burn</option>
                <option>Pregnancy concern</option>
                <option>Child illness</option>
              </select>

              <div className="label">Duration</div>
              <select>
                <option>Less than 24 hours</option>
                <option>Less than 3 days</option>
                <option>More than 3 days</option>
                <option>Sudden or worsening</option>
              </select>

              <div className="sectionTitle">Red flag check</div>

              <p className="muted">
                Select any serious symptom present. If unsure, select it and
                refer upwards.
              </p>

              {redFlagQuestions.map((q) => (
                <label key={q.id} className="redFlag">
                  <input type="checkbox" />
                  <span>{q.label}</span>
                </label>
              ))}

              <div className="sectionTitle">Optional notes</div>

              <textarea
                rows={4}
                placeholder="Short pharmacist note"
              ></textarea>

              <label className="redFlag">
                <input type="checkbox" />

                <span>
                  I understand this tool supports triage and does not replace a
                  clinical diagnosis.
                </span>
              </label>

              <button
                className="button"
                onClick={() => setSubmitted(true)}
              >
                Get triage recommendation
              </button>

              <div className="admin">
                Admin view: <a href="/admin">/admin</a>
              </div>
            </div>
          </>
        )}

        {submitted && (
          <div className="card">
            <h2>Triage recommendation</h2>

            <p className="muted">
              Example outcome screen. Referral workflow integrations can now be
              added.
            </p>

            <button
              className="button"
              onClick={() => setSubmitted(false)}
            >
              New triage
            </button>
          </div>
        )}
      </main>
    </>
  );
}
