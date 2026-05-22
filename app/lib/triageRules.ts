export type TriageLevel =
  | 'EMERGENCY'
  | 'DOCTOR_IN_PHARMACY'
  | 'PHARMACIST_CARE'
  | 'SELF_CARE';

export type TriageInput = {
  age: number;
  gender: string;
  pregnant: string;
  symptoms: string[];
  duration: string;
  redFlags: string[];
};

export const symptomOptions = [
  'Abdominal pain',
  'Allergic reaction',
  'Backache',
  'Bites and stings',
  'Chest pain',
  'Cold and flu',
  'Constipation',
  'Cough',
  'Dental pain',
  'Diarrhoea',
  'Dizziness',
  'Earache',
  'Eye infection',
  'Fever',
  'Hayfever',
  'Headache',
  'Menstrual pain',
  'Nausea',
  'Palpitations',
  'Poisoning',
  'Rash',
  'Red eyes',
  'Shortness of breath',
  'Skin infection',
  'Sore throat',
  'Urinary tract infection',
  'Vomiting',
  'Weakness',
];

export const redFlagQuestions = [
  { id: 'breathing', label: 'Difficulty breathing, blue lips, choking, or unable to speak' },
  { id: 'chestpain', label: 'Chest pain, collapse, fainting, severe palpitations, or suspected heart problem' },
  { id: 'confusion', label: 'Confusion, severe drowsiness, seizure, or loss of consciousness' },
  { id: 'stroke', label: 'Sudden weakness, facial droop, slurred speech, or one-sided numbness' },
  { id: 'bleeding', label: 'Uncontrolled bleeding, vomiting blood, black stool, or coughing blood' },
  { id: 'severepain', label: 'Severe pain, worst-ever headache, severe abdominal pain, or severe eye pain' },
  { id: 'dehydration', label: 'Unable to drink, persistent vomiting, no urine, or severe dehydration' },
  { id: 'pregnancybleed', label: 'Pregnancy bleeding, severe pregnancy pain, or reduced fetal movement' },
  { id: 'childveryill', label: 'Child is floppy, blue, not feeding, convulsing, or unusually sleepy' },
  { id: 'poisoning', label: 'Poisoning, overdose, chemical exposure, or dangerous ingestion' },
];

export function decideTriage(input: TriageInput) {
  const symptoms = input.symptoms.map((s) => s.toLowerCase());

  const hasEmergencySymptom =
    symptoms.includes('chest pain') ||
    symptoms.includes('shortness of breath') ||
    symptoms.includes('poisoning') ||
    symptoms.includes('palpitations');

  if (input.redFlags.length > 0 || hasEmergencySymptom) {
    return {
      level: 'EMERGENCY' as TriageLevel,
      title: 'Emergency care recommended',
      recommendation:
        'The patient should seek urgent emergency care now. For South African patients, call Netcare 911 on 082 911 or local emergency services.',
      reason:
        'One or more red flags or high-risk symptoms were selected.',
      reference:
        'Based on emergency red-flag triage principles, NICE urgent referral guidance, South African STG/EML escalation principles, and Netcare emergency advice.',
      safetyNet:
        'Do not delay care. If symptoms are severe or worsening, call emergency services immediately.',
    };
  }

  const doctorSymptoms = [
    'dental pain',
    'earache',
    'urinary tract infection',
    'backache',
    'eye infection',
    'fever',
    'abdominal pain',
    'menstrual pain',
    'weakness',
  ];

  const needsDoctor =
    symptoms.some((s) => doctorSymptoms.includes(s)) ||
    input.duration === 'more_than_3_days' ||
    input.duration === 'sudden_or_worsening' ||
    input.pregnant === 'yes' ||
    input.pregnant === 'unsure';

  if (needsDoctor) {
    return {
      level: 'DOCTOR_IN_PHARMACY' as TriageLevel,
      title: 'Doctor in pharmacy recommended',
      recommendation:
        'Please book or refer the patient to a doctor in the pharmacy or appropriate clinical practitioner today.',
      reason:
        'The selected symptoms may require clinical assessment, prescribing, or further examination.',
      reference:
        'Based on pharmacist referral triage guidance, NICE Clinical Knowledge Summaries, South African STG/EML principles, and primary-care referral pathways.',
      safetyNet:
        'If symptoms worsen, become severe, or new red flags appear, seek emergency care.',
    };
  }

  const pharmacistSymptoms = [
    'allergic reaction',
    'bites and stings',
    'cold and flu',
    'constipation',
    'cough',
    'diarrhoea',
    'hayfever',
    'headache',
    'nausea',
    'rash',
    'red eyes',
    'skin infection',
    'sore throat',
    'vomiting',
  ];

  if (symptoms.some((s) => pharmacistSymptoms.includes(s))) {
    return {
      level: 'PHARMACIST_CARE' as TriageLevel,
      title: 'Pharmacist care recommended',
      recommendation:
        'The pharmacist can assess and recommend OTC treatment, counselling, and follow-up advice.',
      reason:
        'No emergency red flags were selected and the symptoms may be suitable for pharmacist-led care.',
      reference:
        'Based on community pharmacy minor-ailment triage principles, NICE CKS, South African STG/EML, and pharmacist scope-of-practice guidance.',
      safetyNet:
        'Return or book a doctor if symptoms persist, worsen, or new red flags develop.',
    };
  }

  return {
    level: 'SELF_CARE' as TriageLevel,
    title: 'Self-care advice recommended',
    recommendation:
      'Self-care advice may be appropriate with monitoring and safety-net instructions.',
    reason:
      'No red flags or urgent referral criteria were selected.',
    reference:
      'Based on pharmacy triage principles for mild, stable symptoms.',
    safetyNet:
      'Seek pharmacist or doctor advice if symptoms persist, worsen, or become concerning.',
  };
}
