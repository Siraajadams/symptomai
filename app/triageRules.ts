export type TriageLevel =
  | 'EMERGENCY'
  | 'DOCTOR_IN_PHARMACY'
  | 'PHARMACIST_CARE'
  | 'SELF_CARE';

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

export function decideTriage(input: TriageInput) {
  if (input.redFlags.length > 0) {
    return {
      level: 'EMERGENCY',
      title: 'Emergency care recommended',
      recommendation: 'Please seek emergency care now. If a doctor is not immediately available, call EMS or a paramedic service.',
      reason: 'One or more red flags were selected.',
      reference: 'Based on pharmacy red-flag triage principles for emergency referral.',
      safetyNet: 'Do not wait. Seek emergency help immediately.'
    };
  }

  const age = Number(input.age || 0);
  const isInfant = age > 0 && age < 1;
  const pregnancy = input.pregnant === 'yes';
  const longDuration = input.duration === 'more_than_3_days';

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
      reason: 'The symptoms require clinical assessment by a doctor.',
      reference: 'Based on pharmacist referral triage guidance.',
      safetyNet: 'If symptoms worsen, seek emergency care.'
    };
  }

  if (['cough', 'cold', 'skin', 'pain', 'allergy', 'minor'].includes(input.symptom)) {
    return {
      level: 'PHARMACIST_CARE',
      title: 'Pharmacist care recommended',
      recommendation: 'The pharmacist can assess and recommend OTC treatment and counselling.',
      reason: 'No emergency red flags were selected.',
      reference: 'Based on pharmacy triage principles for mild stable symptoms.',
      safetyNet: 'Return or book a doctor if symptoms worsen or persist.'
    };
  }

  return {
    level: 'SELF_CARE',
    title: 'Self-care and monitoring',
    recommendation: 'Monitor symptoms and speak to the pharmacist if unsure.',
    reason: 'No red flags or doctor referral triggers were identified.',
    reference: 'Based on safety-net triage principles.',
    safetyNet: 'Seek care if symptoms worsen.'
  };
}
