"use client";

import { useEffect, useMemo, useState } from "react";

type FormState = {
  name: string;
  firstName: string;
  surname: string;
  email: string;
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

type PaymentStatus =
  | "not_started"
  | "pending"
  | "verifying"
  | "paid"
  | "failed";

type PaymentConfirmation = {
  referralCode: string | null;
  consultationReason: string | null;
  amountTotal: number | null;
  currency: string | null;
};

type PatientLookupResult = {
  id: string;
  first_name?: string | null;
  surname?: string | null;
  last_name?: string | null;
  patient_id?: string | null;
  national_id?: string | null;
  id_number?: string | null;
  dob?: string | null;
  date_of_birth?: string | null;
  gender?: string | null;
  mobile?: string | null;
  mobile_number?: string | null;
  phone?: string | null;
  email?: string | null;
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
  firstName: "",
  surname: "",
  email: "",
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

const consultationReasonOptions = [
  "New Consultation with GP",
  "Follow-up Consultation",
  "New Prescription",
  "Repeat Prescription",
  "BodyLab (Weight Loss)",
  "PillSquad (Contraception)",
  "Other",
] as const;

type ConsultationReasonType =
  (typeof consultationReasonOptions)[number] | "";

const PAYMENT_CONTEXT_KEY = "symptomai_virtual_consult_context";

function getJohannesburgMinutes() {
  const parts = new Intl.DateTimeFormat("en-ZA", {
    timeZone: "Africa/Johannesburg",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(new Date());

  const hour = Number(
    parts.find((part) => part.type === "hour")?.value || "0",
  );
  const minute = Number(
    parts.find((part) => part.type === "minute")?.value || "0",
  );

  return hour * 60 + minute;
}

function isCurrentlyAfterHours() {
  const currentMinutes = getJohannesburgMinutes();
  const openingMinutes = 9 * 60;
  const closingMinutes = 21 * 60;

  return currentMinutes < openingMinutes || currentMinutes >= closingMinutes;
}

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
  const [patientLookupLoading, setPatientLookupLoading] = useState(false);
  const [patientLookupMessage, setPatientLookupMessage] = useState("");
  const [selectedPatientId, setSelectedPatientId] = useState<string | null>(null);
  const [selectedPatient, setSelectedPatient] =
    useState<PatientLookupResult | null>(null);
  const [consultationReasonType, setConsultationReasonType] =
    useState<ConsultationReasonType>("");
  const [consultationReason, setConsultationReason] = useState("");
  const [paymentStatus, setPaymentStatus] =
    useState<PaymentStatus>("not_started");
  const [paymentMessage, setPaymentMessage] = useState("");
  const [paymentConfirmation, setPaymentConfirmation] =
    useState<PaymentConfirmation | null>(null);
  const [afterHours, setAfterHours] = useState(false);

  useEffect(() => {
    const handler = (e: any) => {
      e.preventDefault();
      setInstallPrompt(e);
    };

    window.addEventListener("beforeinstallprompt", handler);

    const updateAvailability = () => {
      setAfterHours(isCurrentlyAfterHours());
    };

    updateAvailability();
    const availabilityTimer = window.setInterval(updateAvailability, 60_000);

    async function verifyReturnedPayment() {
      const params = new URLSearchParams(window.location.search);
      const payment = params.get("payment");
      const sessionId = params.get("session_id");

      let restoredReferral: ReferralDetails | null = null;
      let restoredReason = "";

      try {
        const storedContext = window.localStorage.getItem(PAYMENT_CONTEXT_KEY);

        if (storedContext) {
          const parsed = JSON.parse(storedContext);

          if (parsed?.form) setForm(parsed.form);
          if (parsed?.result) setResult(parsed.result);

          if (parsed?.referral) {
            restoredReferral = parsed.referral;
            setReferral(parsed.referral);
          }

          if (typeof parsed?.consultationReason === "string") {
            restoredReason = parsed.consultationReason;
            setConsultationReason(parsed.consultationReason);

            const restoredType =
              typeof parsed?.consultationReasonType === "string"
                ? parsed.consultationReasonType
                : consultationReasonOptions.includes(
                    parsed.consultationReason as (typeof consultationReasonOptions)[number],
                  )
                  ? parsed.consultationReason
                  : parsed.consultationReason
                    ? "Other"
                    : "";

            if (
              restoredType === "" ||
              consultationReasonOptions.includes(
                restoredType as (typeof consultationReasonOptions)[number],
              )
            ) {
              setConsultationReasonType(
                restoredType as ConsultationReasonType,
              );
            }
          }

          if (typeof parsed?.selectedPatientId === "string") {
            setSelectedPatientId(parsed.selectedPatientId);
          }
        }
      } catch (error) {
        console.error("Could not restore payment context:", error);
      }

      if (payment === "success" && sessionId) {
        setPaymentStatus("verifying");
        setPaymentMessage("Verifying your Stripe payment...");

        try {
          const returnedReferralCode =
            params.get("referral_code") ||
            restoredReferral?.referral_code ||
            null;

          const response = await fetch("/api/verify-payment", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            cache: "no-store",
            body: JSON.stringify({
              sessionId,
              referralCode: returnedReferralCode,
            }),
          });

          const payload = await response.json().catch(() => ({}));

          if (!response.ok) {
            throw new Error(payload?.error || "Could not verify the payment.");
          }

          if (payload?.paid !== true) {
            throw new Error(
              "Stripe has not confirmed this payment as paid. Your referral is still active and you may try another card.",
            );
          }

          setPaymentStatus("paid");
          setPaymentConfirmation({
            referralCode:
              payload?.referralCode ||
              params.get("referral_code") ||
              restoredReferral?.referral_code ||
              null,
            consultationReason:
              payload?.consultationReason || restoredReason || null,
            amountTotal:
              typeof payload?.amountTotal === "number"
                ? payload.amountTotal
                : null,
            currency: payload?.currency || null,
          });
          setPaymentMessage(
            "Payment confirmed. Your referral has been released to the CareScriber doctor inbox.",
          );

          window.history.replaceState({}, "", window.location.pathname);
        } catch (error: unknown) {
          console.error("Payment verification error:", error);
          setPaymentStatus("failed");
          setPaymentMessage(
            error instanceof Error
              ? error.message
              : "Could not verify the payment. Your referral is still active and you may try another card.",
          );
        }
      } else if (payment === "success") {
        setPaymentStatus("failed");
        setPaymentMessage(
          "Stripe returned without a payment session ID. Your referral is still active and you may try another card.",
        );
      } else if (payment === "cancelled" || payment === "failed") {
        setPaymentStatus("failed");
        setPaymentMessage(
          "Payment was not completed. Your referral is still active. Please try again using another card.",
        );

        window.history.replaceState({}, "", window.location.pathname);
      }
    }

    void verifyReturnedPayment();

    return () => {
      window.removeEventListener("beforeinstallprompt", handler);
      window.clearInterval(availabilityTimer);
    };
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

  function patientFullName() {
    return `${form.firstName} ${form.surname}`.trim() || form.name.trim();
  }

  function finalConsultationReason() {
    if (consultationReasonType === "Other") {
      return consultationReason.trim();
    }

    return consultationReasonType.trim();
  }

  function calculateAgeFromDob(dob: string) {
    if (!dob) return "";
    const birthDate = new Date(dob);
    if (Number.isNaN(birthDate.getTime())) return "";

    const today = new Date();
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();

    if (
      monthDiff < 0 ||
      (monthDiff === 0 && today.getDate() < birthDate.getDate())
    ) {
      age -= 1;
    }

    return age >= 0 ? String(age) : "";
  }

  function normaliseId(value: string) {
    return value.trim().replace(/\s+/g, "").toUpperCase();
  }

  function patientDisplayName(patient: PatientLookupResult) {
    const first = patient.first_name || "";
    const last = patient.surname || patient.last_name || "";
    return `${first} ${last}`.trim();
  }

  function applyPatientToForm(patient: PatientLookupResult) {
    const existingName = patientDisplayName(patient);
    setForm((prev) => ({
      ...prev,
      name: existingName || prev.name,
      firstName: patient.first_name || prev.firstName,
      surname: patient.surname || patient.last_name || prev.surname,
      email: patient.email || prev.email,
      idNumber:
        patient.patient_id ||
        patient.national_id ||
        patient.id_number ||
        prev.idNumber,
      dateOfBirth: patient.dob || patient.date_of_birth || prev.dateOfBirth,
      mobile: patient.mobile || patient.mobile_number || patient.phone || prev.mobile,
      age: calculateAgeFromDob(patient.dob || patient.date_of_birth || prev.dateOfBirth),
      gender: patient.gender ? patient.gender.toLowerCase() : prev.gender,
    }));
  }

  async function findExistingPatientById(idValue?: string) {
    const rawValue = (idValue || form.idNumber || "").trim();
    const lookupValue = normaliseId(rawValue);

    if (!lookupValue) return null;

    const response = await fetch("/api/patient-lookup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        patientId: lookupValue,
        idNumber: lookupValue,
        nationalId: lookupValue,
        national_id: lookupValue,
      }),
    });

    const payload = await response.json().catch(() => ({}));

    if (!response.ok || payload?.success === false) {
      throw new Error(payload?.error || "Could not search CareScriber patients.");
    }

    if (payload?.found && payload?.patient?.id) {
      return payload.patient as PatientLookupResult;
    }

    return null;
  }

  async function searchPatientByNationalId() {
    if (!form.idNumber.trim()) {
      alert("Please enter the National ID / Passport number first.");
      return;
    }

    setPatientLookupLoading(true);
    setPatientLookupMessage("");
    setSelectedPatientId(null);
    setSelectedPatient(null);

    try {
      const patient = await findExistingPatientById(form.idNumber);

      if (patient?.id) {
        setSelectedPatientId(patient.id);
        setSelectedPatient(patient);
        applyPatientToForm(patient);
        setPatientLookupMessage(
          `Existing CareScriber patient found: ${patientDisplayName(patient) || "patient profile"}. Continue with triage.`,
        );
        return;
      }

      setPatientLookupMessage(
        "No existing CareScriber patient found. Complete First Name, Surname, DOB, Gender and Mobile. SymptomAI will create the CareScriber patient profile before referral.",
      );
    } catch (error: any) {
      console.error("Patient lookup error:", error);
      setPatientLookupMessage("Could not search patient: " + error.message);
    } finally {
      setPatientLookupLoading(false);
    }
  }

  async function findExistingPatientId() {
    if (selectedPatientId) return selectedPatientId;

    const patientById = await findExistingPatientById(form.idNumber);
    if (patientById?.id) {
      setSelectedPatientId(patientById.id);
      setSelectedPatient(patientById);
      applyPatientToForm(patientById);
      return patientById.id;
    }

    return null;
  }

  async function submitReferralViaApi(decision: TriageResult) {
    const patientPayload = {
      firstName: form.firstName.trim(),
      surname: form.surname.trim(),
      nationalId: normaliseId(form.idNumber),
      dateOfBirth: form.dateOfBirth || null,
      mobile: form.mobile.trim() || null,
      email: form.email.trim() || null,
      gender: form.gender || null,
      age: form.age || calculateAgeFromDob(form.dateOfBirth) || null,
      country: form.country || null,
      city: form.city || null,
    };

    const triagePayload = {
      pregnant: form.gender === "female" ? form.pregnant : "not_applicable",
      country: form.country || null,
      city: form.city || null,
      heightCm: form.heightCm || null,
      weightKg: form.weightKg || null,
      bmi: bmi || null,
      symptomDuration: form.duration || null,
      symptoms: form.symptoms,
      redFlags: form.redFlags,
      notes: form.notes || null,
      triageLevel: decision.level,
      destination: decision.destination,
      urgency: decision.urgency,
      advice: decision.advice,
      summary: decision.summary,
      reasoning: decision.reasoning,
      routeType: decision.routeType,
    };

    const response = await fetch("/api/symptomai-referral", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ patient: patientPayload, triage: triagePayload }),
    });

    const payload = await response.json().catch(() => ({}));

    if (!response.ok) {
      throw new Error(payload?.error || "Could not create CareScriber referral.");
    }

    return payload as {
      patient: PatientLookupResult;
      referral: ReferralDetails;
      triageId?: string | null;
      patientCreated?: boolean;
    };
  }

  async function generateCareScriberReferral() {
    if (!result) {
      alert("Please complete triage first.");
      return;
    }

    if (!form.idNumber.trim()) {
      alert("Please enter the National ID / Passport number before creating a referral.");
      return;
    }

    if (!form.firstName.trim() || !form.surname.trim()) {
      alert("Please enter the patient first name and surname before creating a referral.");
      return;
    }

    setReferralLoading(true);
    setReferralMessage("");

    try {
      const apiResult = await submitReferralViaApi(result);

      if (apiResult.patient?.id) {
        setSelectedPatientId(apiResult.patient.id);
        setSelectedPatient(apiResult.patient);
        applyPatientToForm(apiResult.patient);
      }

      setReferral(apiResult.referral);
      persistVirtualConsultContext(
        apiResult.referral,
        finalConsultationReason(),
        consultationReasonType,
      );

      setReferralMessage(
        apiResult.patientCreated
          ? "New CareScriber patient profile created and virtual consult referral generated. Share the referral code and consent token with the doctor."
          : "Existing CareScriber patient found and virtual consult referral generated. Share the referral code and consent token with the doctor.",
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

  function persistVirtualConsultContext(
    referralOverride: ReferralDetails | null = referral,
    reasonOverride: string = finalConsultationReason(),
    reasonTypeOverride: ConsultationReasonType = consultationReasonType,
  ) {
    try {
      window.localStorage.setItem(
        PAYMENT_CONTEXT_KEY,
        JSON.stringify({
          form,
          result,
          referral: referralOverride,
          consultationReason: reasonOverride,
          consultationReasonType: reasonTypeOverride,
          selectedPatientId,
        }),
      );
    } catch (error) {
      console.error("Could not save virtual consult context:", error);
    }
  }

  async function startVirtualConsultPayment() {
    if (!referral) {
      alert("Please generate the referral code and consent token first.");
      return;
    }

    const reason = finalConsultationReason();

    if (!consultationReasonType) {
      alert("Please select the reason for consultation or prescription request.");
      return;
    }

    if (consultationReasonType === "Other" && !reason) {
      alert("Please enter the reason for consultation or prescription request.");
      return;
    }

    setPaymentStatus("pending");
    setPaymentMessage("");
    persistVirtualConsultContext(
      referral,
      reason,
      consultationReasonType,
    );

    try {
      const response = await fetch("/api/virtual-consult-payment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          referralCode: referral.referral_code,
          consentToken: referral.consent_token,
          consultationReason: reason,
          patientName: patientFullName(),
          patientEmail: form.email.trim() || undefined,
          patientId: selectedPatientId || normaliseId(form.idNumber),
        }),
      });

      const payload = await response.json().catch(() => ({}));

      if (!response.ok || !payload?.checkoutUrl) {
        throw new Error(
          payload?.error || "Could not create the R250 Stripe payment link.",
        );
      }

      window.location.assign(payload.checkoutUrl);
    } catch (error: unknown) {
      console.error("Payment error:", error);
      setPaymentStatus("failed");
      setPaymentMessage(
        error instanceof Error
          ? error.message
          : "Could not start the Stripe payment.",
      );
    }
  }

  async function saveTriageToSupabase(decision: TriageResult) {
    setSaveMessage(
      "Triage completed. Generate the CareScriber referral to save the patient profile, linked triage history and consent token.",
    );
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
    setPatientLookupMessage("");
    setSelectedPatientId(null);
    setSelectedPatient(null);
    setConsultationReasonType("");
    setConsultationReason("");
    setPaymentStatus("not_started");
    setPaymentMessage("");
    setPaymentConfirmation(null);

    try {
      window.localStorage.removeItem(PAYMENT_CONTEXT_KEY);
      window.history.replaceState({}, "", window.location.pathname);
    } catch (error) {
      console.error("Could not clear saved triage context:", error);
    }
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

Patient: ${patientFullName() || "Not provided"}
First name: ${form.firstName || "Not provided"}
Surname: ${form.surname || "Not provided"}
ID / Passport: ${form.idNumber || "Not provided"}
Date of birth: ${form.dateOfBirth || "Not provided"}
Mobile: ${form.mobile || "Not provided"}
Email: ${form.email || "Not provided"}
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
Reason for consultation / prescription request: ${finalConsultationReason() || "Not provided"}
Payment status: ${paymentStatus}

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

        /* PRIMARY TRIAGE ACTION */
        .primary-action-section {
          margin-top: 30px;
          margin-bottom: 0;
        }

        .primary-referral-button {
          width: 100%;
          min-height: 72px;
          padding: 20px 28px;
          border-radius: 20px;
          background: #39ff14;
          color: #071b3d;
          font-size: 20px;
          font-weight: 900;
          border: 2px solid #21d900;
          box-shadow: 0 12px 30px rgba(57, 255, 20, 0.35);
        }

        .primary-referral-button:hover:not(:disabled) {
          background: #4dff2c;
          transform: translateY(-1px);
          box-shadow: 0 14px 34px rgba(57, 255, 20, 0.42);
        }

        .primary-action-caption {
          margin-top: 10px;
          text-align: center;
          color: #46606f;
          font-size: 13px;
          font-weight: 900;
          text-transform: uppercase;
          letter-spacing: 0.08em;
        }

        /* Deliberate separation from the primary referral action */
        .secondary-actions-section {
          margin-top: 44px;
          padding-top: 28px;
          border-top: 1px solid #dfe9ea;
        }

        .secondary-actions-label {
          margin-bottom: 14px;
          color: #6b7b86;
          font-size: 12px;
          font-weight: 900;
          text-transform: uppercase;
          letter-spacing: 0.08em;
        }

        .clinical-actions {
          display: flex;
          gap: 12px;
          flex-wrap: wrap;
        }

        .utility-actions {
          display: flex;
          gap: 12px;
          flex-wrap: wrap;
          margin-top: 28px;
          padding-top: 24px;
          border-top: 1px dashed #dfe9ea;
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

        .payment-panel {
          margin-top: 22px;
          padding-top: 20px;
          border-top: 1px solid #dceeee;
        }

        .consultation-reason-options {
          display: grid;
          gap: 10px;
          margin-top: 10px;
        }

        .consultation-reason-option {
          display: flex;
          align-items: center;
          gap: 12px;
          border: 2px solid #dfe9ea;
          border-radius: 18px;
          padding: 14px 16px;
          background: #ffffff;
          cursor: pointer;
          font-weight: 800;
          margin-bottom: 0;
        }

        .consultation-reason-option.selected {
          border-color: #1dcfc1;
          background: #e9fbf9;
        }

        .consultation-reason-option input[type="radio"] {
          width: 20px;
          height: 20px;
          margin: 0;
          padding: 0;
          accent-color: #1dcfc1;
          flex: 0 0 auto;
        }

        .consultation-reason-option span {
          line-height: 1.35;
        }

        .other-reason-field {
          margin-top: 14px;
        }

        .availability-notice {
          margin-top: 16px;
          padding: 16px;
          border-radius: 16px;
          background: #eef8ff;
          color: #071b3d;
          font-size: 16px;
          line-height: 1.5;
        }

        .after-hours-notice {
          margin-top: 16px;
          padding: 16px;
          border-radius: 16px;
          background: #fff7e6;
          border: 2px solid #f79009;
          color: #7a3e00;
          font-size: 16px;
          line-height: 1.5;
        }

        .after-hours-notice strong {
          display: block;
          margin-bottom: 6px;
          color: #7a3e00;
        }

        .payment-confirmation {
          margin-top: 18px;
          padding: 18px;
          border: 2px solid #18a66a;
          border-radius: 18px;
          background: #eafff4;
          color: #12382a;
        }

        .payment-error {
          margin-top: 16px;
          padding: 14px 16px;
          border-radius: 16px;
          background: #fff1f1;
          color: #8a1f1f;
          font-weight: 800;
        }

        .button:disabled {
          background: #a8c8c5;
          cursor: not-allowed;
          opacity: 0.8;
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

        {(paymentStatus === "verifying" ||
          paymentStatus === "paid" ||
          (paymentStatus === "failed" && paymentMessage)) && (
          <section className="card">
            {paymentStatus === "verifying" && (
              <div className="save-message">{paymentMessage}</div>
            )}

            {paymentStatus === "paid" && (
              <div className="payment-confirmation" style={{ marginTop: 0 }}>
                <div className="referral-title">Stripe Payment Confirmed</div>
                <p style={{ color: "#12382a", marginBottom: 8 }}>
                  {paymentMessage}
                </p>
                {paymentConfirmation?.referralCode && (
                  <div style={{ marginTop: 10 }}>
                    <b>Referral code:</b> {paymentConfirmation.referralCode}
                  </div>
                )}
                {paymentConfirmation?.consultationReason && (
                  <div style={{ marginTop: 10 }}>
                    <b>Reason:</b> {paymentConfirmation.consultationReason}
                  </div>
                )}
                <div style={{ marginTop: 10 }}>
                  <b>Doctor availability:</b> Daily from 09:00 to 21:00.
                  Requests received after hours will be attended to from 09:30
                  the following day.
                </div>
              </div>
            )}

            {paymentStatus === "failed" && paymentMessage && (
              <>
                <div className="payment-error" style={{ marginTop: 0 }}>
                  <div className="referral-title" style={{ color: "#8a1f1f" }}>
                    Payment verification failed
                  </div>
                  <div>{paymentMessage}</div>
                </div>

                {afterHours && (
                  <div className="after-hours-notice">
                    <strong>Currently after hours</strong>
                    If you proceed, the doctor will only contact you the next
                    day from 09:30.
                  </div>
                )}

                {referral && finalConsultationReason() && (
                  <button
                    type="button"
                    className="button"
                    onClick={startVirtualConsultPayment}
                    style={{ width: "100%", marginTop: 16 }}
                  >
                    Try another card
                  </button>
                )}
              </>
            )}
          </section>
        )}

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
                  Virtual Consult Referral Created
                </div>

                <div className="result-line">
                  <b>Referral Code</b>
                </div>
                <div className="referral-code">{referral.referral_code}</div>

                <div className="result-line">
                  <b>Patient Consent Token</b>
                </div>
                <div className="referral-code">{referral.consent_token}</div>

                <div className="payment-panel">
                  <label>
                    Reason for consultation / prescription request
                  </label>

                  <div
                    className="consultation-reason-options"
                    role="radiogroup"
                    aria-label="Reason for consultation or prescription request"
                  >
                    {consultationReasonOptions.map((option) => (
                      <label
                        key={option}
                        className={`consultation-reason-option ${
                          consultationReasonType === option ? "selected" : ""
                        }`}
                      >
                        <input
                          type="radio"
                          name="consultationReasonType"
                          value={option}
                          checked={consultationReasonType === option}
                          disabled={paymentStatus === "paid"}
                          onChange={() => {
                            setConsultationReasonType(option);

                            const nextReason =
                              option === "Other" ? "" : option;

                            setConsultationReason(nextReason);

                            persistVirtualConsultContext(
                              referral,
                              nextReason,
                              option,
                            );
                          }}
                        />

                        <span>{option}</span>
                      </label>
                    ))}
                  </div>

                  {consultationReasonType === "Other" && (
                    <div className="other-reason-field">
                      <label htmlFor="consultationReason">
                        Please describe the reason
                      </label>

                      <textarea
                        id="consultationReason"
                        value={consultationReason}
                        onChange={(e) => {
                          const nextReason = e.target.value;
                          setConsultationReason(nextReason);

                          persistVirtualConsultContext(
                            referral,
                            nextReason,
                            "Other",
                          );
                        }}
                        placeholder="Briefly describe the symptoms, health concern, medication or prescription required."
                        disabled={paymentStatus === "paid"}
                      />
                    </div>
                  )}

                  {afterHours ? (
                    <div className="after-hours-notice">
                      <strong>Currently after hours</strong>
                      If you proceed, the doctor will only contact you the next
                      day from 09:30.
                    </div>
                  ) : (
                    <div className="availability-notice">
                      <b>Doctor availability:</b> Virtual doctors are currently
                      available. Daily operating hours are{" "}
                      <b>09:00 to 21:00</b>.
                    </div>
                  )}

                  <button
                    type="button"
                    className="button"
                    onClick={startVirtualConsultPayment}
                    disabled={
                      !consultationReasonType ||
                      (consultationReasonType === "Other" &&
                        !consultationReason.trim()) ||
                      paymentStatus === "pending" ||
                      paymentStatus === "verifying" ||
                      paymentStatus === "paid"
                    }
                    style={{ width: "100%", marginTop: 16 }}
                  >
                    {paymentStatus === "pending"
                      ? "Preparing secure payment..."
                      : paymentStatus === "verifying"
                        ? "Verifying payment..."
                        : paymentStatus === "paid"
                          ? "R250 Payment Confirmed"
                          : paymentStatus === "failed"
                            ? "Try another card"
                            : "Pay R250 for Virtual GP Consultation"}
                  </button>

                  {paymentStatus === "paid" && (
                    <div className="payment-confirmation">
                      <div className="referral-title">Payment Confirmed</div>
                      <div>
                        Your R250 payment was successful. The referral can now
                        be released to the CareScriber doctor inbox.
                      </div>
                      <div style={{ marginTop: 10 }}>
                        <b>Reason:</b>{" "}
                        {finalConsultationReason() || "Saved with payment"}
                      </div>
                      <div style={{ marginTop: 10 }}>
                        Keep referral code <b>{referral.referral_code}</b> and
                        consent token <b>{referral.consent_token}</b>.
                      </div>
                    </div>
                  )}

                  {paymentStatus === "failed" && paymentMessage && (
                    <div className="payment-error">
                      <div style={{ marginBottom: 6 }}>
                        <b>Payment was not completed</b>
                      </div>
                      {paymentMessage}
                    </div>
                  )}
                </div>

                <div className="referral-note">
                  Share both codes with the doctor. The doctor will use these
                  codes in CareScriber to unlock the patient profile and triage
                  summary. This referral expires on{" "}
                  {new Date(referral.expires_at).toLocaleDateString()}.
                </div>
              </div>
            )}

            {result.routeType === "emergency" ? (
              <div className="primary-action-section">
                <a
                  className="button danger"
                  href="tel:082911"
                  style={{ width: "100%", minHeight: 72, fontSize: 20 }}
                >
                  Call Netcare 911
                </a>
              </div>
            ) : (
              !referral && (
                <div className="primary-action-section">
                  <button
                    className="button primary-referral-button"
                    onClick={generateCareScriberReferral}
                    disabled={referralLoading}
                  >
                    {referralLoading
                      ? "Creating referral..."
                      : "Start Virtual Consult Referral"}
                  </button>
                  <div className="primary-action-caption">
                    Recommended next step
                  </div>
                </div>
              )
            )}

            <div className="secondary-actions-section">
              <div className="secondary-actions-label">Other care options</div>

              <div className="clinical-actions">
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
              </div>

              <div className="utility-actions">
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

                <button className="button" onClick={newTriage}>
                  New triage
                </button>
              </div>
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

              <div className="chat">
                <strong>Lookup first</strong>
                Enter the National ID / Passport number first and search before capturing the rest of the form. This prevents duplicate patient profiles across SymptomAI and CareScriber.
              </div>

              {patientLookupMessage && (
                <div className="save-message">{patientLookupMessage}</div>
              )}

              {selectedPatient && (
                <div className="referral-box">
                  <div className="referral-title">Existing CareScriber Patient Found</div>
                  <div className="result-line"><b>Name:</b> {patientDisplayName(selectedPatient) || "Not recorded"}</div>
                  <div className="result-line"><b>ID / Passport:</b> {selectedPatient.patient_id || selectedPatient.national_id || selectedPatient.id_number || "Not recorded"}</div>
                  <div className="result-line"><b>DOB:</b> {selectedPatient.dob || selectedPatient.date_of_birth || "Not recorded"}</div>
                  <div className="result-line"><b>Mobile:</b> {selectedPatient.phone || selectedPatient.mobile || "Not recorded"}</div>
                </div>
              )}

              <div className="grid">
                <div>
                  <label>National ID / Passport number</label>
                  <input
                    value={form.idNumber}
                    onChange={(e) => {
                      update("idNumber", e.target.value);
                      setSelectedPatientId(null);
                      setSelectedPatient(null);
                      setPatientLookupMessage("");
                    }}
                    placeholder="SA ID, passport or national ID"
                  />
                </div>

                <div>
                  <label>Lookup existing CareScriber patient</label>
                  <button
                    className="button secondary"
                    onClick={searchPatientByNationalId}
                    type="button"
                    disabled={patientLookupLoading}
                    style={{ width: "100%" }}
                  >
                    {patientLookupLoading ? "Searching..." : "Search Patient"}
                  </button>
                </div>

                <div>
                  <label>First name</label>
                  <input
                    value={form.firstName}
                    onChange={(e) => {
                      const firstName = e.target.value;
                      setForm((prev) => ({
                        ...prev,
                        firstName,
                        name: `${firstName} ${prev.surname}`.trim(),
                      }));
                    }}
                    placeholder="First name"
                  />
                </div>

                <div>
                  <label>Surname</label>
                  <input
                    value={form.surname}
                    onChange={(e) => {
                      const surname = e.target.value;
                      setForm((prev) => ({
                        ...prev,
                        surname,
                        name: `${prev.firstName} ${surname}`.trim(),
                      }));
                    }}
                    placeholder="Surname"
                  />
                </div>

                <div>
                  <label>Date of birth</label>
                  <input
                    type="date"
                    value={form.dateOfBirth}
                    onChange={(e) => {
                      const dateOfBirth = e.target.value;
                      setForm((prev) => ({
                        ...prev,
                        dateOfBirth,
                        age: calculateAgeFromDob(dateOfBirth),
                      }));
                    }}
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
                  <label>Email address</label>
                  <input
                    value={form.email}
                    onChange={(e) => update("email", e.target.value)}
                    placeholder="patient@email.com"
                  />
                </div>

                <div>
                  <label>Age (calculated from DOB)</label>
                  <input
                    value={form.age}
                    onChange={(e) => update("age", e.target.value)}
                    placeholder="Auto-calculated after DOB"
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
                <button className="button" onClick={submitTriage}>
                  Get triage recommendation
                </button>

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
