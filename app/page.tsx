"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "./lib/supabaseClient";

type FormState = {
  name: string;
  idNumber: string;
  dateOfBirth: string;
  mobile: string;
  age: string;
  gender: string;
  pregnant: string;
  country: string;
  city: string;
  heightCm: string;
  weightKg: string;
  duration: string;
  symptoms: string[];
  redFlags: string[];
  notes: string;
};

type ReferralDetails = {
  referral_code: string;
  consent_token: string;
  expires_at: string;
};

type TriageResult = {
  level: string;
  destination: string;
  urgency: string;
  advice: string;
  summary: string;
  reasoning: string;
  routeType: "emergency" | "doctor" | "pharmacist";
};

const initialForm: FormState = {
  name: "",
  idNumber: "",
  dateOfBirth: "",
  mobile: "",
  age: "",
  gender: "",
  pregnant: "no",
  country: "South Africa",
  city: "",
  heightCm: "",
  weightKg: "",
  duration: "",
  symptoms: [],
  redFlags: [],
  notes: "",
};

const symptoms = [
  "Backache",
  "Bites",
  "Blurred Vision",
  "Cold and Flu",
  "Constipation",
  "Dental Pain",
  "Diarrhoea",
  "Earache",
  "Eye Infection",
  "Fever",
  "Gastric Ulcer",
  "Hayfever",
  "Headache",
  "Heartburn",
  "Joint Pain",
  "Menstrual Pain",
  "Migraine",
  "Muscle Pain",
  "Palpitations",
  "Piles",
  "Poisoning",
  "Rashes",
  "Red Eyes",
  "Sinus",
  "Stomach Cramps",
  "Thrush",
  "Urinary Tract Infection",
].sort();

const redFlags = [
  "Chest pain",
  "Difficulty breathing",
  "Severe bleeding",
  "Confusion",
  "Loss of consciousness",
  "Severe dehydration",
  "Stroke symptoms",
  "Sudden blurred vision",
  "Severe headache / worst headache",
];

function decideTriage(form: FormState): TriageResult {
  const emergencySymptoms = ["Poisoning", "Palpitations", "Blurred Vision"];

  const doctorSymptoms = [
    "Dental Pain",
    "Earache",
    "Eye Infection",
    "Urinary Tract Infection",
    "Fever",
    "Migraine",
    "Gastric Ulcer",
    "Thrush",
  ];

  if (
    form.redFlags.length > 0 ||
    form.symptoms.some((s) => emergencySymptoms.includes(s))
  ) {
    return {
      level: "Emergency",
      destination: "Emergency care",
      urgency: "Immediate",
      advice:
        "Seek urgent medical attention immediately. If in South Africa, call Netcare 911 on 082 911 or local emergency services.",
      summary:
        "Red flag or high-risk symptoms were selected and require urgent escalation.",
      reasoning:
        "The triage engine detected emergency indicators such as red flags, possible poisoning, palpitations, sudden visual changes, breathing difficulty, chest pain, severe bleeding, confusion, or stroke-type symptoms. These should not be managed as routine pharmacy care.",
      routeType: "emergency",
    };
  }

  if (
    form.symptoms.some((s) => doctorSymptoms.includes(s)) ||
    form.duration === "More than 3 days" ||
    form.duration === "Sudden or worsening" ||
    form.pregnant === "yes" ||
    form.pregnant === "unsure"
  ) {
    return {
      level: "Doctor / Prescribing Pharmacist",
      destination: "GP or Prescribing Pharmacist",
      urgency: "Today or within 24 hours",
      advice:
        "A clinical assessment is recommended. Refer to a GP, doctor in pharmacy, or prescribing pharmacist.",
      summary:
        "The symptoms may require examination, prescribing, or further clinical assessment.",
      reasoning:
        "The selected symptoms may require clinical examination, diagnosis confirmation, prescription-only treatment, or escalation based on duration, pregnancy status, fever, infection symptoms, urinary symptoms, eye symptoms, migraine, gastric ulcer symptoms, or thrush.",
      routeType: "doctor",
    };
  }

  return {
    level: "Pharmacist care",
    destination: "Pharmacy care",
    urgency: "Routine",
    advice:
      "Pharmacist-led care, OTC advice, monitoring, and safety-net counselling are appropriate.",
    summary:
      "No urgent red flags were selected and the symptoms appear suitable for pharmacy-led care.",
    reasoning:
      "No emergency red flags were selected and the symptoms appear appropriate for pharmacist advice, OTC support, monitoring, and clear safety-net guidance.",
    routeType: "pharmacist",
  };
}

export default function Page() {
  const [form, setForm] = useState<FormState>(initialForm);
  const [result, setResult] = useState<TriageResult | null>(null);
  const [installPrompt, setInstallPrompt] = useState<any>(null);
  const [saveMessage, setSaveMessage] = useState("");
  const [referralMessage, setReferralMessage] = useState("");
  const [referralLoading, setReferralLoading] = useState(false);
  const [referral, setReferral] = useState<ReferralDetails | null>(null);

  useEffect(() => {
    const handler = (e: any) => {
      e.preventDefault();
      setInstallPrompt(e);
    };

    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  const bmi = useMemo(() => {
    const h = Number(form.heightCm) / 100;
    const w = Number(form.weightKg);

    if (!h || !w) return "";

    return (w / (h * h)).toFixed(1);
  }, [form.heightCm, form.weightKg]);

  const selectedSymptoms = useMemo(
    () => form.symptoms.join(", "),
    [form.symptoms],
  );

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function toggleSymptom(symptom: string) {
    setForm((prev) => ({
      ...prev,
      symptoms: prev.symptoms.includes(symptom)
        ? prev.symptoms.filter((s) => s !== symptom)
        : [...prev.symptoms, symptom],
    }));
  }

  function toggleRedFlag(flag: string) {
    setForm((prev) => ({
      ...prev,
      redFlags: prev.redFlags.includes(flag)
        ? prev.redFlags.filter((f) => f !== flag)
        : [...prev.redFlags, flag],
    }));
  }

  function generateReferralCode() {
    return "CS-" + Math.random().toString(36).substring(2, 8).toUpperCase();
  }

  function generateConsentToken() {
    return Math.floor(100000 + Math.random() * 900000).toString();
  }

  function splitName(fullName: string) {
    const parts = fullName.trim().split(/\s+/).filter(Boolean);
    const firstName = parts[0] || "Patient";
    const surname = parts.length > 1 ? parts.slice(1).join(" ") : "";
    return { firstName, surname };
  }

  async function findExistingPatientId() {
    if (form.idNumber.trim()) {
      const { data, error } = await supabase
        .from("patients")
        .select("id")
        .eq("id_number", form.idNumber.trim())
        .limit(1)
        .maybeSingle();

      if (!error && data?.id) return data.id as string;
    }

    if (form.mobile.trim()) {
      const { data, error } = await supabase
        .from("patients")
        .select("id")
        .eq("mobile", form.mobile.trim())
        .limit(1)
        .maybeSingle();

      if (!error && data?.id) return data.id as string;
    }

    return null;
  }

  async function createPatientForReferral() {
    const existingPatientId = await findExistingPatientId();
    if (existingPatientId) return existingPatientId;

    const { firstName, surname } = splitName(form.name);

    const insertAttempts: Record<string, any>[] = [
      {
        first_name: firstName,
        surname: surname,
        id_number: form.idNumber.trim() || null,
        date_of_birth: form.dateOfBirth || null,
        mobile: form.mobile.trim() || null,
        gender: form.gender || null,
        country: form.country || null,
      },
      {
        name: form.name.trim() || "Patient",
        id_number: form.idNumber.trim() || null,
        date_of_birth: form.dateOfBirth || null,
        mobile: form.mobile.trim() || null,
        gender: form.gender || null,
        country: form.country || null,
      },
      {
        id_number: form.idNumber.trim() || null,
        date_of_birth: form.dateOfBirth || null,
      },
    ];

    let lastError = "";

    for (const patientPayload of insertAttempts) {
      const { data, error } = await supabase
        .from("patients")
        .insert([patientPayload])
        .select("id")
        .single();

      if (!error && data?.id) return data.id as string;
      lastError = error?.message || "Unknown patient insert error";
    }

    throw new Error(lastError || "Could not create patient profile.");
  }

  async function generateCareScriberReferral() {
    if (!result) {
      alert("Please complete triage first.");
      return;
    }

    if (!form.name.trim()) {
      alert("Please enter the patient name before creating a referral.");
      return;
    }

    if (!form.idNumber.trim() && !form.mobile.trim()) {
      alert(
        "Please enter either an ID number or mobile number before creating a referral.",
      );
      return;
    }

    setReferralLoading(true);
    setReferralMessage("");

    try {
      const patientId = await createPatientForReferral();
      const referralCode = generateReferralCode();
      const consentToken = generateConsentToken();

      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 7);

      const { error } = await supabase.from("symptomai_referrals").insert([
        {
          patient_id: patientId,
          referral_code: referralCode,
          consent_token: consentToken,
          consent_given: true,
          status: "Pending",
          submitted_at: new Date().toISOString(),
          expires_at: expiresAt.toISOString(),
        },
      ]);

      if (error) throw error;

      setReferral({
        referral_code: referralCode,
        consent_token: consentToken,
        expires_at: expiresAt.toISOString(),
      });

      setReferralMessage(
        "CareScriber referral created. Share the referral code and consent token with the doctor.",
      );
    } catch (error: any) {
      console.error("Referral error:", error);
      setReferralMessage(
        "Could not create CareScriber referral: " + error.message,
      );
      alert("Could not create CareScriber referral: " + error.message);
    } finally {
      setReferralLoading(false);
    }
  }

  async function saveTriageToSupabase(decision: TriageResult) {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      setSaveMessage(
        "Triage completed, but not saved. Please create a profile/login first.",
      );
      return;
    }

    const recommendation = `${decision.level} | ${decision.destination} | ${decision.urgency} | ${decision.advice}`;

    const { error } = await supabase.from("triage_history").insert([
      {
        user_id: user.id,
        symptoms: form.symptoms,
        recommendation: recommendation,
        pharmacist_notes: form.notes,
        gender: form.gender,
        symptom_duration: form.duration,
        height_cm: form.heightCm,
        weight_kg: form.weightKg,
      },
    ]);

    if (error) {
      console.error("Save error:", error);
      setSaveMessage("Could not save triage history: " + error.message);
      alert("Could not save triage history: " + error.message);
    } else {
      setSaveMessage("Triage saved successfully to patient history.");
    }
  }

  async function submitTriage() {
    const decision = decideTriage(form);

    await saveTriageToSupabase(decision);

    setResult(decision);

    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  }

  function newTriage() {
    setForm(initialForm);
    setResult(null);
    setSaveMessage("");
    setReferralMessage("");
    setReferral(null);
  }

  function pharmacyMapByCity() {
    const query = form.city
      ? `pharmacy near ${form.city}, ${form.country}`
      : `pharmacy near me`;

    window.open(
      `https://www.google.com/maps/search/${encodeURIComponent(query)}`,
      "_blank",
    );
  }

  function pharmacyMapByLocation() {
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude } = pos.coords;

        window.open(
          `https://www.google.com/maps/search/pharmacy/@${latitude},${longitude},14z`,
          "_blank",
        );
      },
      () => pharmacyMapByCity(),
    );
  }

  const isUK =
    form.country === "England" ||
    form.country === "Wales" ||
    form.country === "Scotland";

  const gpReferralUrl = isUK
    ? "https://nhs.carelink.digital"
    : "https://carelink.digital";

  const prescribingPharmacistUrl = isUK
    ? "https://cpnbs.carelink.digital/home"
    : "https://carelink.digital";

  function reportText() {
    return `SYMPTOMAI TRIAGE REPORT

Patient: ${form.name || "Not provided"}
ID / Passport: ${form.idNumber || "Not provided"}
Date of birth: ${form.dateOfBirth || "Not provided"}
Mobile: ${form.mobile || "Not provided"}
Age: ${form.age || "Not provided"}
Gender: ${form.gender || "Not provided"}
Pregnant: ${form.gender === "female" ? form.pregnant : "Not applicable"}
Country: ${form.country}
Town/City: ${form.city || "Not provided"}
BMI: ${bmi || "Not calculated"}

Symptoms: ${selectedSymptoms || "None selected"}
Symptom duration: ${form.duration || "Not selected"}
Red flags: ${form.redFlags.length ? form.redFlags.join(", ") : "None selected"}
Notes: ${form.notes || "None"}

Outcome: ${result?.level || "Pending"}
Destination: ${result?.destination || "Pending"}
Urgency: ${result?.urgency || "Pending"}
Advice: ${result?.advice || "Pending"}
Summary: ${result?.summary || "Pending"}
AI reasoning: ${result?.reasoning || "Pending"}

Clinical references:
NICE Clinical Knowledge Summaries, South African Primary Care/STG/EML principles, pharmacist referral guidance, WHO emergency escalation principles.

Generated by SymptomAI.`;
  }

  function downloadPDF() {
    const win = window.open("", "_blank");

    if (!win) return;

    win.document.write(`
      <html>
        <head>
          <title>SymptomAI Report</title>
          <style>
            body { font-family: Arial; padding: 32px; color: #071b3d; }
            h1 { font-size: 30px; }
            pre { white-space: pre-wrap; font-size: 15px; line-height: 1.6; }
          </style>
        </head>
        <body>
          <h1>SymptomAI Triage Report</h1>
          <pre>${reportText()}</pre>
        </body>
      </html>
    `);

    win.document.close();
    win.focus();

    setTimeout(() => win.print(), 500);
  }

  async function installApp() {
    if (installPrompt) {
      installPrompt.prompt();
      await installPrompt.userChoice;
      setInstallPrompt(null);
    } else {
      alert(
        "To install SymptomAI, open your browser menu and select “Add to Home screen”.",
      );
    }
  }

  const whatsappLink = `https://wa.me/?text=${encodeURIComponent(reportText())}`;

  const emailLink = `mailto:?subject=SymptomAI Triage Report&body=${encodeURIComponent(
    reportText(),
  )}`;

  return (
    <>
      <style jsx global>{`
        * {
          box-sizing: border-box;
        }

        html,
        body {
          margin: 0;
          background: linear-gradient(135deg, #eefafa 0%, #f7fbff 100%);
          color: #071b3d;
          font-family: Arial, Helvetica, sans-serif;
        }

        .page {
          max-width: 880px;
          margin: 0 auto;
          padding: 28px 16px 70px;
        }

        .brand {
          display: flex;
          align-items: center;
          gap: 14px;
          margin-bottom: 24px;
        }

        .brand-icon {
          width: 70px;
          height: 70px;
          border-radius: 22px;
          background: #071b3d;
          color: #1dd5c5;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 54px;
          font-weight: 900;
        }

        .brand-title {
          font-size: 48px;
          font-weight: 900;
          line-height: 0.95;
        }

        .brand-subtitle {
          color: #667785;
          font-size: 17px;
          font-weight: 800;
          margin-top: 5px;
        }

        .card {
          background: rgba(255, 255, 255, 0.94);
          border-radius: 32px;
          padding: 30px;
          margin-bottom: 22px;
          box-shadow: 0 18px 55px rgba(7, 27, 61, 0.09);
          border: 1px solid rgba(7, 27, 61, 0.06);
        }

        .hero h1,
        .result h1 {
          font-size: 50px;
          line-height: 1;
          margin: 0 0 18px;
          font-weight: 900;
          letter-spacing: -1.5px;
        }

        h2 {
          font-size: 32px;
          margin: 0 0 18px;
          font-weight: 900;
        }

        p {
          color: #647480;
          font-size: 19px;
          line-height: 1.5;
        }

        .chat {
          background: #f4fbfb;
          border: 1px solid #dceeee;
          border-radius: 24px;
          padding: 18px;
          margin-bottom: 20px;
          color: #61727f;
          font-size: 17px;
          line-height: 1.5;
        }

        .chat strong {
          color: #071b3d;
          display: block;
          margin-bottom: 5px;
        }

        .grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 16px;
        }

        label {
          display: block;
          font-size: 16px;
          font-weight: 900;
          margin-bottom: 8px;
        }

        input,
        select,
        textarea {
          width: 100%;
          border: 2px solid #dfe9ea;
          border-radius: 18px;
          padding: 16px;
          font-size: 16px;
          outline: none;
          color: #071b3d;
          background: white;
        }

        textarea {
          min-height: 110px;
          resize: vertical;
        }

        input:focus,
        select:focus,
        textarea:focus {
          border-color: #1dcfc1;
          box-shadow: 0 0 0 4px rgba(29, 207, 193, 0.14);
        }

        .section {
          margin-top: 26px;
        }

        .chips {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 12px;
        }

        .chip {
          border: 2px solid #dfe9ea;
          background: white;
          color: #071b3d;
          border-radius: 20px;
          padding: 17px;
          font-size: 16px;
          font-weight: 900;
          text-align: left;
          cursor: pointer;
        }

        .chip.active {
          border-color: #1dcfc1;
          background: #e9fbf9;
        }

        .chip.red.active {
          border-color: #d92d20;
          background: #fff1f1;
          color: #8a1f1f;
        }

        .button-row {
          display: flex;
          gap: 12px;
          flex-wrap: wrap;
          margin-top: 22px;
        }

        .button {
          border: none;
          background: #1dcfc1;
          color: white;
          border-radius: 18px;
          padding: 16px 24px;
          font-size: 16px;
          font-weight: 900;
          cursor: pointer;
          text-decoration: none;
          display: inline-flex;
          align-items: center;
          justify-content: center;
        }

        .button.secondary {
          background: #071b3d;
        }

        .button.outline {
          background: #ffffff;
          color: #071b3d;
          border: 2px solid #071b3d;
        }

        .button.danger {
          background: #d92d20;
        }

        .button.gold {
          background: #f79009;
        }

        .result {
          border-left: 9px solid #1dcfc1;
        }

        .result.emergency {
          border-left-color: #d92d20;
        }

        .result.doctor {
          border-left-color: #f79009;
        }

        .badge {
          display: inline-block;
          background: #eef8f8;
          color: #071b3d;
          padding: 10px 14px;
          border-radius: 999px;
          font-size: 12px;
          font-weight: 900;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          margin-bottom: 18px;
        }

        .severity {
          display: inline-block;
          padding: 12px 16px;
          border-radius: 18px;
          font-weight: 900;
          margin-bottom: 16px;
        }

        .severity.emergency {
          background: #fff1f1;
          color: #b42318;
        }

        .severity.doctor {
          background: #fff7e6;
          color: #b54708;
        }

        .severity.pharmacist {
          background: #e9fbf9;
          color: #067367;
        }

        .result-line {
          font-size: 18px;
          color: #647480;
          line-height: 1.5;
          margin: 12px 0;
        }

        .result-line b {
          color: #071b3d;
        }

        .save-message {
          background: #eef8f8;
          border-radius: 18px;
          padding: 14px 16px;
          font-weight: 900;
          color: #071b3d;
          margin: 16px 0;
        }

        .referral-box {
          background: #f4fbfb;
          border: 2px solid #1dcfc1;
          border-radius: 24px;
          padding: 18px;
          margin-top: 20px;
        }

        .referral-title {
          font-size: 20px;
          font-weight: 900;
          margin-bottom: 10px;
          color: #071b3d;
        }

        .referral-code {
          background: #ffffff;
          border: 1px solid #dceeee;
          border-radius: 18px;
          padding: 14px;
          font-size: 22px;
          font-weight: 900;
          letter-spacing: 0.08em;
          margin: 10px 0;
        }

        .referral-note {
          color: #647480;
          font-size: 16px;
          line-height: 1.5;
          margin-top: 10px;
        }

        .references {
          font-size: 14px;
          color: #6b7b86;
          line-height: 1.5;
          border-top: 1px solid #e4eeee;
          margin-top: 28px;
          padding-top: 18px;
        }

        .bmi-box {
          background: #eef8f8;
          border-radius: 18px;
          padding: 16px;
          font-weight: 900;
          color: #071b3d;
        }

        @media (max-width: 700px) {
          .page {
            padding: 22px 14px 60px;
          }

          .brand-icon {
            width: 62px;
            height: 62px;
            font-size: 46px;
          }

          .brand-title {
            font-size: 40px;
          }

          .card {
            padding: 24px;
            border-radius: 28px;
          }

          .hero h1,
          .result h1 {
            font-size: 38px;
          }

          h2 {
            font-size: 28px;
          }

          .grid,
          .chips {
            grid-template-columns: 1fr;
          }

          .button {
            width: 100%;
          }

          p {
            font-size: 17px;
          }
        }
      `}</style>

      <main className="page">
        <div className="brand">
          <div className="brand-icon">+</div>
          <div>
            <div className="brand-title">SymptomAI</div>
            <div className="brand-subtitle">
              Right care. Right place. Right now.
            </div>
          </div>
        </div>

        {result ? (
          <section
            className={`card result ${
              result.routeType === "emergency"
                ? "emergency"
                : result.routeType === "doctor"
                  ? "doctor"
                  : ""
            }`}
          >
            <span className="badge">{result.level}</span>

            <div
              className={`severity ${
                result.routeType === "emergency"
                  ? "emergency"
                  : result.routeType === "doctor"
                    ? "doctor"
                    : "pharmacist"
              }`}
            >
              {result.urgency}
            </div>

            <h1>{result.destination}</h1>

            {saveMessage && <div className="save-message">{saveMessage}</div>}

            <div className="result-line">
              <b>Advice:</b> {result.advice}
            </div>

            <div className="result-line">
              <b>Summary:</b> {result.summary}
            </div>

            <div className="result-line">
              <b>AI reasoning:</b> {result.reasoning}
            </div>

            <div className="result-line">
              <b>BMI:</b> {bmi || "Not calculated"}
            </div>

            {referralMessage && (
              <div className="save-message">{referralMessage}</div>
            )}

            {referral && (
              <div className="referral-box">
                <div className="referral-title">
                  CareScriber Referral Created
                </div>
                <div className="result-line">
                  <b>Referral Code</b>
                </div>
                <div className="referral-code">{referral.referral_code}</div>
                <div className="result-line">
                  <b>Patient Consent Token</b>
                </div>
                <div className="referral-code">{referral.consent_token}</div>
                <div className="referral-note">
                  Share both codes with the doctor. The doctor will use these
                  codes in CareScriber to unlock the patient profile and triage
                  summary. This referral expires on{" "}
                  {new Date(referral.expires_at).toLocaleDateString()}.
                </div>
              </div>
            )}

            <div className="button-row">
              {result.routeType === "emergency" && (
                <a className="button danger" href="tel:082911">
                  Call Netcare 911
                </a>
              )}

              {result.routeType === "doctor" && (
                <>
                  <a className="button" href={gpReferralUrl} target="_blank">
                    Book GP via Carelink
                  </a>

                  <a
                    className="button gold"
                    href={prescribingPharmacistUrl}
                    target="_blank"
                  >
                    Refer to Prescribing Pharmacist
                  </a>
                </>
              )}

              <button className="button" onClick={pharmacyMapByCity}>
                Find pharmacy by city
              </button>

              <button
                className="button secondary"
                onClick={pharmacyMapByLocation}
              >
                Use current location
              </button>

              <a
                className="button secondary"
                href={whatsappLink}
                target="_blank"
              >
                WhatsApp report
              </a>

              <a className="button secondary" href={emailLink}>
                Email report
              </a>

              <button className="button secondary" onClick={downloadPDF}>
                Download PDF
              </button>

              <button
                className="button"
                onClick={generateCareScriberReferral}
                disabled={referralLoading}
              >
                {referralLoading
                  ? "Creating referral..."
                  : "Generate CareScriber Referral"}
              </button>

              <button className="button" onClick={newTriage}>
                New triage
              </button>
            </div>
          </section>
        ) : (
          <>
            <section className="card hero">
              <h1>60-second pharmacy triage</h1>

              <p>
                Capture symptoms, identify red flags, and route patients to
                emergency care, GP review, prescribing pharmacist care, or
                pharmacy-led self-care.
              </p>

              <div className="button-row">
                <a className="button" href="#triage">
                  Start triage
                </a>

                <a className="button outline" href="/login">
                  Create Profile / Login
                </a>

                <a className="button secondary" href="/history">
                  View Patient History
                </a>

                <button className="button secondary" onClick={installApp}>
                  Install web app
                </button>
              </div>
            </section>

            <section className="card">
              <h2>Built for pharmacies</h2>

              <p>
                Interactive symptom selection, BMI capture, red-flag screening,
                clinical references, WhatsApp summaries, PDF reports, GP
                routing, prescribing pharmacist referral and nearest pharmacy
                search.
              </p>
            </section>

            <section id="triage" className="card">
              <div className="chat">
                <strong>SymptomAI</strong>
                Let’s complete a quick pharmacy triage assessment.
              </div>

              <h2>Patient details</h2>

              <div className="grid">
                <div>
                  <label>Full name</label>
                  <input
                    value={form.name}
                    onChange={(e) => update("name", e.target.value)}
                    placeholder="Patient name"
                  />
                </div>

                <div>
                  <label>ID / Passport number</label>
                  <input
                    value={form.idNumber}
                    onChange={(e) => update("idNumber", e.target.value)}
                    placeholder="SA ID, passport or national ID"
                  />
                </div>

                <div>
                  <label>Date of birth</label>
                  <input
                    type="date"
                    value={form.dateOfBirth}
                    onChange={(e) => update("dateOfBirth", e.target.value)}
                  />
                </div>

                <div>
                  <label>Mobile number</label>
                  <input
                    value={form.mobile}
                    onChange={(e) => update("mobile", e.target.value)}
                    placeholder="0821234567"
                  />
                </div>

                <div>
                  <label>Age</label>
                  <input
                    value={form.age}
                    onChange={(e) => update("age", e.target.value)}
                    placeholder="Age"
                  />
                </div>

                <div>
                  <label>Country</label>
                  <select
                    value={form.country}
                    onChange={(e) => update("country", e.target.value)}
                  >
                    <option value="South Africa">South Africa</option>
                    <option value="England">England</option>
                    <option value="Wales">Wales</option>
                    <option value="Scotland">Scotland</option>
                    <option value="New Zealand">New Zealand</option>
                  </select>
                </div>

                <div>
                  <label>Town / city</label>
                  <input
                    value={form.city}
                    onChange={(e) => update("city", e.target.value)}
                    placeholder="Cape Town, London, Auckland..."
                  />
                </div>

                <div>
                  <label>Gender</label>
                  <select
                    value={form.gender}
                    onChange={(e) => update("gender", e.target.value)}
                  >
                    <option value="">Select gender</option>
                    <option value="male">Male</option>
                    <option value="female">Female</option>
                    <option value="other">Other / prefer not to say</option>
                  </select>
                </div>

                <div>
                  <label>Height cm</label>
                  <input
                    value={form.heightCm}
                    onChange={(e) => update("heightCm", e.target.value)}
                    placeholder="170"
                  />
                </div>

                <div>
                  <label>Weight kg</label>
                  <input
                    value={form.weightKg}
                    onChange={(e) => update("weightKg", e.target.value)}
                    placeholder="75"
                  />
                </div>

                <div>
                  <label>Symptom duration</label>
                  <select
                    value={form.duration}
                    onChange={(e) => update("duration", e.target.value)}
                  >
                    <option value="">Select symptom duration</option>
                    <option value="Less than 24 hours">
                      Less than 24 hours
                    </option>
                    <option value="Less than 3 days">Less than 3 days</option>
                    <option value="More than 3 days">More than 3 days</option>
                    <option value="Sudden or worsening">
                      Sudden or worsening
                    </option>
                  </select>
                </div>
              </div>

              {bmi && <div className="section bmi-box">BMI: {bmi}</div>}

              {form.gender === "female" && (
                <div className="section">
                  <label>Pregnant?</label>

                  <select
                    value={form.pregnant}
                    onChange={(e) => update("pregnant", e.target.value)}
                  >
                    <option value="no">No</option>
                    <option value="yes">Yes</option>
                    <option value="unsure">Unsure</option>
                  </select>
                </div>
              )}

              <div className="section">
                <div className="chat">
                  <strong>SymptomAI</strong>
                  Select one or more symptoms from the alphabetical list.
                </div>

                <h2>Symptoms</h2>

                <div className="chips">
                  {symptoms.map((symptom) => (
                    <button
                      key={symptom}
                      className={`chip ${
                        form.symptoms.includes(symptom) ? "active" : ""
                      }`}
                      onClick={() => toggleSymptom(symptom)}
                      type="button"
                    >
                      {form.symptoms.includes(symptom) ? "✓ " : ""}
                      {symptom}
                    </button>
                  ))}
                </div>
              </div>

              <div className="section">
                <div className="chat">
                  <strong>SymptomAI</strong>
                  Check for red flags. If unsure, select it and refer upwards.
                </div>

                <h2>Red flags</h2>

                <div className="chips">
                  {redFlags.map((flag) => (
                    <button
                      key={flag}
                      className={`chip red ${
                        form.redFlags.includes(flag) ? "active" : ""
                      }`}
                      onClick={() => toggleRedFlag(flag)}
                      type="button"
                    >
                      {form.redFlags.includes(flag) ? "✓ " : ""}
                      {flag}
                    </button>
                  ))}
                </div>
              </div>

              <div className="section">
                <label>Pharmacist notes</label>

                <textarea
                  value={form.notes}
                  onChange={(e) => update("notes", e.target.value)}
                  placeholder="Short pharmacist note"
                />
              </div>

              <div className="button-row">
                <button
                  className="button secondary"
                  onClick={pharmacyMapByCity}
                >
                  Find pharmacy by city
                </button>

                <button
                  className="button secondary"
                  onClick={pharmacyMapByLocation}
                >
                  Use current location
                </button>

                <button className="button" onClick={submitTriage}>
                  Get triage recommendation
                </button>
              </div>

              <div className="references">
                Clinical guidance references: NICE Clinical Knowledge Summaries,
                South African Primary Care/STG/EML principles, pharmacist
                referral guidance, WHO emergency escalation principles, and
                pharmacy minor ailment triage pathways.
              </div>
            </section>
          </>
        )}
      </main>
    </>
  );
}
