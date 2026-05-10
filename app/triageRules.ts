export type TriageLevel = 'EMERGENCY' | 'DOCTOR_IN_PHARMACY' | 'PHARMACIST_CARE' | 'SELF_CARE';

export type TriageInput = {
  age: number;
  pregnant: string;
  symptom: string;
  duration: string;
  redFlags: string[];
};

export const redFlagQuestions = [
  { id: 'breathing', label: 'Difficulty breathing, blue lips, choking, or unable to speak' },
  { id: 'chestPain', label: 'Chest pain, collapse, fainting, or severe palpitations' },
  { id: 'confusion', label: 'Confusion, severe drowsiness, seizure, or loss of consciousness' },
  { id: 'stroke', label: 'Sudden weakness, facial droop, slurred speech, or one-sided numbness' },
  { id: 'bleeding', label: 'Uncontrolled bleeding, vomiting blood, black stool, or coughing blood' },
  { id: 'severePain', label: 'Severe pain, worst-ever headache, severe abdominal pain, or major injury' },
  { id: 'dehydration', label: 'Unable to drink, persistent vomiting, no urine, or severe dehydration' },
  { id: 'pregnancyBleeding', label: 'Pregnancy bleeding, severe pregnancy pain, or reduced fetal movement' },
  { id: 'verySickChild', label: 'Child is floppy, blue, not feeding, convulsing, or unusually sleepy' },
];

export const doctorTriggers = [
  'feverMoreThan3Days',
  'asthmaNotImproving',
  'urinaryFever',
  'bloodInUrine',
  'persistentVomiting',
  'childConcern',
  'pregnancyConcern'
];

export function decideTriage(input: TriageInput): {
  level: TriageLevel;
  title: string;
  recommendation: string;
  reason: string;
  reference: string;
  safetyNet: string;
} {
  const emergencyFlags = input.redFlags.filter(Boolean);

  if (emergencyFlags.length > 0) {
    return {
      level: 'EMERGENCY',
      title: 'Emergency care recommended',
      recommendation: 'Please seek emergency care now. If a doctor is not immediately available, call EMS or a paramedic service.',
      reason: 'One or more red flags were selected. These symptoms may indicate a serious or life-threatening condition.',
      reference: 'Based on pharmacy red-flag triage principles aligned to emergency referral criteria: altered consciousness, breathing difficulty, chest pain, seizures, severe pain, bleeding, dehydration, pregnancy danger signs, and very sick child signs.',
      safetyNet: 'Do not wait for symptoms to improve. Keep the patient seated or lying down and avoid food/drink if very drowsy or vomiting.'
    };
  }

  const age = Number(input.age || 0);
  const isInfant = age > 0 && age < 1;
  const longDuration = input.duration === 'more_than_3_days';
  const pregnancy = input.pregnant === 'yes';

  if (
    pregnancy ||
    isInfant ||
    longDuration ||
    ['chest', 'breathing', 'urinary', 'pregnancy', 'child', 'injury', 'abdominal'].includes(input.symptom)
  ) {
    return {
      level: 'DOCTOR_IN_PHARMACY',
      title: 'Doctor in pharmacy recommended',
      recommendation: 'Please book or refer the patient to the doctor in the pharmacy today.',
      reason: 'The symptoms do not trigger an immediate emergency referral, but they require clinical assessment by a doctor.',
      reference: 'Based on red-flag triage guidance for pharmacist referral where fever persists, respiratory symptoms do not improve, urinary symptoms include systemic features, pregnancy concerns exist, or children require clinical review.',
      safetyNet: 'If breathing difficulty, chest pain, confusion, severe pain, bleeding, persistent vomiting, or sudden deterioration develops, seek emergency care immediately.'
    };
  }

  if (['cough', 'cold', 'skin', 'pain', 'allergy', 'minor'].includes(input.symptom)) {
    return {
      level: 'PHARMACIST_CARE',
      title: 'Pharmacist care recommended',
      recommendation: 'The pharmacist can assess and recommend OTC treatment, counselling, and monitoring.',
      reason: 'No emergency red flags were selected and the symptoms appear suitable for pharmacy assessment.',
      reference: 'Based on pharmacy triage principles where mild, stable symptoms without red flags may be managed with pharmacist assessment and OTC care.',
      safetyNet: 'Return or book a doctor if symptoms worsen, persist beyond 3 days, fever develops, pain becomes severe, or the patient becomes very unwell.'
    };
  }

  return {
    level: 'SELF_CARE',
    title: 'Self-care and monitoring',
    recommendation: 'Monitor symptoms, use supportive care, and speak to the pharmacist if unsure.',
    reason: 'No red flags or doctor referral triggers were identified.',
    reference: 'Based on safety-net triage principles for stable patients without red flags.',
    safetyNet: 'Seek pharmacist, doctor, or emergency care if symptoms worsen or new red flags appear.'
  };
}
