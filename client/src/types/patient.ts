// =========================================================================
// PATIENT INTAKE — TYPE-SAFE DATA MODEL
// Derived from: "שאלון להורים לקראת אבחון" (boy/girl parent questionnaires)
// =========================================================================
//
// Design intent:
// - Every field is typed to its actual domain, not just `string`.
//   Age is a number. Yes/No questions are a tri-state union (not boolean —
//   clinically, "unknown / not answered" is a real and different value from
//   "no", and the norm engine downstream needs to be able to tell them apart).
// - Gender drives pronoun phrasing in the UI (see patientPhrasing.ts) but is
//   stored once, not duplicated into two near-identical templates.
// - `RegisteredParameters` is the narrow, stable contract the future
//   test-selection / norm-comparison engine consumes. It's derived from
//   PatientIntake via a pure function (see extractRegisteredParameters),
//   so the engine never has to know about the raw form shape.

// --- Primitive / shared domain types -----------------------------------

/** Tri-state answer for yes/no questions. "unknown" = left blank / not yet known,
 *  distinct from a deliberate "no". Downstream logic should treat "unknown"
 *  as missing data, not as a negative finding. */
export type YesNoUnknown = 'yes' | 'no' | 'unknown';

export type Gender = 'male' | 'female';

export type DominantHand = 'right' | 'left' | 'both' | 'unknown';

export type ClassroomType = 'regular' | 'inclusion' | 'other';

/** Whole years. Branded so a raw `number` can't be passed where an
 *  AgeYears is expected without going through a constructor that validates
 *  range — catches unit-mixup bugs (months vs years) at compile time. */
export type AgeYears = number & { readonly __brand: 'AgeYears' };

export function makeAgeYears(value: number): AgeYears {
  if (!Number.isFinite(value) || value < 0 || value > 120) {
    throw new Error(`Invalid age in years: ${value}`);
  }
  return value as AgeYears;
}

/** ISO 8601 date string (YYYY-MM-DD). Branded to distinguish from free-text. */
export type ISODateString = string & { readonly __brand: 'ISODateString' };

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export function makeISODateString(value: string): ISODateString {
  if (!ISO_DATE_RE.test(value)) {
    throw new Error(`Invalid ISO date string: ${value}`);
  }
  return value as ISODateString;
}

/** Israeli national ID (תעודת זהות) — 9 digits, stored as a validated string
 *  (not a number) to preserve leading zeros. */
export type IsraeliIdNumber = string & { readonly __brand: 'IsraeliIdNumber' };

const ISRAELI_ID_RE = /^\d{9}$/;

export function makeIsraeliIdNumber(value: string): IsraeliIdNumber {
  if (!ISRAELI_ID_RE.test(value)) {
    throw new Error(`Invalid Israeli ID number: ${value}`);
  }
  return value as IsraeliIdNumber;
}

/** Phone number, digits only, 9-10 chars (Israeli local format). */
export type PhoneNumber = string & { readonly __brand: 'PhoneNumber' };

const PHONE_RE = /^\d{9,10}$/;

export function makePhoneNumber(value: string): PhoneNumber {
  const digitsOnly = value.replace(/[\s-]/g, '');
  if (!PHONE_RE.test(digitsOnly)) {
    throw new Error(`Invalid phone number: ${value}`);
  }
  return digitsOnly as PhoneNumber;
}

// --- Section: child identity ---------------------------------------------

export interface ChildIdentity {
  firstName: string;
  lastName: string;
  idNumber: IsraeliIdNumber | null;
  gender: Gender;
  dateOfBirth: ISODateString;
  /** Computed at submission time from dateOfBirth, not hand-entered —
   *  prevents the age the clinician sees from drifting out of sync with DOB. */
  ageYearsAtIntake: AgeYears;
  grade: string;
  schoolName: string;
  classroomType: ClassroomType;
  dominantHand: DominantHand;
  wearsGlasses: YesNoUnknown;
}

// --- Section: parent / guardian info -------------------------------------

export interface ParentInfo {
  name: string;
  age: AgeYears | null;
  phone: PhoneNumber | null;
  profession: string;
}

export interface ParentsInfo {
  father: ParentInfo;
  mother: ParentInfo;
}

// --- Section: family background ------------------------------------------

export interface Sibling {
  /** Free text per the original form ("מס' הילדים במשפחה וגילם" is asked
   *  as a combined count+ages field) is avoided here in favor of a
   *  structured list — gives the norm engine actual sibling ages without
   *  parsing free text. */
  ageYears: AgeYears;
}

export interface FamilyBackground {
  siblings: Sibling[];
  languagesSpokenAtHome: string[];
  childsPrimaryLanguage: string;
  familyHistoryOfLearningDisability: YesNoUnknown;
  familyHistoryOfADHD: YesNoUnknown;
  familyHistoryOtherNotes: string;
}

// --- Section: developmental background ------------------------------------

export type DevelopmentalDomain =
  | 'hearing'
  | 'vision'
  | 'fineMotor'
  | 'speechLanguage'
  | 'generalHealth';

export interface DevelopmentalDomainEntry {
  domain: DevelopmentalDomain;
  status: 'typical' | 'delayOrDifficulty';
  details: string;
}

export interface DevelopmentalBackground {
  pregnancyAndBirthTypical: YesNoUnknown;
  domains: DevelopmentalDomainEntry[];
  referralReason: string;
  referredByWhom: string;
  evaluationGoalsOrExpectations: string;
  priorEvaluations: YesNoUnknown;
  priorEvaluationFindingsSummary: string;
}

// --- Section: treatment history --------------------------------------------

export type TreatmentType =
  | 'speechLanguageTherapy'
  | 'occupationalTherapy'
  | 'psychological'
  | 'remedialTeaching'
  | 'other';

export interface TreatmentHistoryEntry {
  treatmentType: TreatmentType;
  otherTypeDescription?: string;
  ageAtTreatment: AgeYears | null;
  durationMonths: number | null;
  wasHelpful: YesNoUnknown;
}

export interface CurrentOrPastTreatment {
  hasReceivedTreatment: YesNoUnknown;
  history: TreatmentHistoryEntry[];
}

export interface MedicationInfo {
  takesMedicationRegularly: YesNoUnknown;
  reason: string;
  medicationName: string;
  durationMonths: number | null;
}

// --- Section: academic functioning -----------------------------------------

export interface AcademicFunctioning {
  generalIntegrationInFirstGrade: string;
  areasOfInterestAtSchool: string;
  areasOfDifficultyAtSchool: string;
  readingAcquisitionDescription: string;
  hadReadingDifficulties: YesNoUnknown;
  pastReadingDifficulties: string;
  currentReadingDifficulties: string;
  readingComprehensionDifficulties: YesNoUnknown;
  writingDescription: string;
  canExpressSelfInWritingClearly: YesNoUnknown;
  receivesSchoolSupport: YesNoUnknown;
}

// --- Section: spoken language -----------------------------------------------

export interface SpokenLanguage {
  hasWideVocabulary: YesNoUnknown;
  expressesSelfFluentlyDaily: YesNoUnknown;
  speaksInCorrectClearSentences: YesNoUnknown;
}

// --- Top-level intake record -------------------------------------------------

export interface PatientIntake {
  id: string;
  child: ChildIdentity;
  parents: ParentsInfo;
  familyBackground: FamilyBackground;
  developmentalBackground: DevelopmentalBackground;
  treatment: CurrentOrPastTreatment;
  medication: MedicationInfo;
  academic: AcademicFunctioning;
  spokenLanguage: SpokenLanguage;
  additionalNotes: string;
  consentToResearchUse: boolean;
  dateCreated: string;
  lastModified: string;
}

// --- Registered parameters: the engine-facing contract -----------------------
//
// This is intentionally narrow. The test-selection and norm-comparison engine
// should depend on THIS type, never on PatientIntake directly — that keeps the
// engine decoupled from form structure changes (new questionnaire sections,
// rewording, etc.) as long as this extraction function is kept up to date.

export interface RegisteredParameters {
  patientId: string;
  gender: Gender;
  ageYears: AgeYears;
  grade: string;
  dominantHand: DominantHand;
  wearsGlasses: YesNoUnknown;
  hasFamilyHistoryOfLearningDisability: YesNoUnknown;
  hasFamilyHistoryOfADHD: YesNoUnknown;
  hasAtypicalDevelopmentalDomains: boolean;
  atypicalDomains: DevelopmentalDomain[];
  hasPriorEvaluations: YesNoUnknown;
  isCurrentlyOrPreviouslyInTreatment: YesNoUnknown;
  takesMedicationRegularly: YesNoUnknown;
  hasReadingDifficulties: YesNoUnknown;
  hasReadingComprehensionDifficulties: YesNoUnknown;
}

export function extractRegisteredParameters(intake: PatientIntake): RegisteredParameters {
  return {
    patientId: intake.id,
    gender: intake.child.gender,
    ageYears: intake.child.ageYearsAtIntake,
    grade: intake.child.grade,
    dominantHand: intake.child.dominantHand,
    wearsGlasses: intake.child.wearsGlasses,
    hasFamilyHistoryOfLearningDisability:
      intake.familyBackground.familyHistoryOfLearningDisability,
    hasFamilyHistoryOfADHD: intake.familyBackground.familyHistoryOfADHD,
    hasAtypicalDevelopmentalDomains: intake.developmentalBackground.domains.some(
      (d) => d.status === 'delayOrDifficulty'
    ),
    atypicalDomains: intake.developmentalBackground.domains
      .filter((d) => d.status === 'delayOrDifficulty')
      .map((d) => d.domain),
    hasPriorEvaluations: intake.developmentalBackground.priorEvaluations,
    isCurrentlyOrPreviouslyInTreatment: intake.treatment.hasReceivedTreatment,
    takesMedicationRegularly: intake.medication.takesMedicationRegularly,
    hasReadingDifficulties: intake.academic.hadReadingDifficulties,
    hasReadingComprehensionDifficulties: intake.academic.readingComprehensionDifficulties,
  };
}

// --- Factory for a blank intake (used by the form on "new patient") ----------

export function createBlankPatientIntake(id: string): PatientIntake {
  return {
    id,
    child: {
      firstName: '',
      lastName: '',
      idNumber: null,
      gender: 'male',
      dateOfBirth: '' as ISODateString,
      ageYearsAtIntake: 0 as AgeYears,
      grade: '',
      schoolName: '',
      classroomType: 'regular',
      dominantHand: 'unknown',
      wearsGlasses: 'unknown',
    },
    parents: {
      father: { name: '', age: null, phone: null, profession: '' },
      mother: { name: '', age: null, phone: null, profession: '' },
    },
    familyBackground: {
      siblings: [],
      languagesSpokenAtHome: [],
      childsPrimaryLanguage: '',
      familyHistoryOfLearningDisability: 'unknown',
      familyHistoryOfADHD: 'unknown',
      familyHistoryOtherNotes: '',
    },
    developmentalBackground: {
      pregnancyAndBirthTypical: 'unknown',
      domains: [
        { domain: 'hearing', status: 'typical', details: '' },
        { domain: 'vision', status: 'typical', details: '' },
        { domain: 'fineMotor', status: 'typical', details: '' },
        { domain: 'speechLanguage', status: 'typical', details: '' },
        { domain: 'generalHealth', status: 'typical', details: '' },
      ],
      referralReason: '',
      referredByWhom: '',
      evaluationGoalsOrExpectations: '',
      priorEvaluations: 'unknown',
      priorEvaluationFindingsSummary: '',
    },
    treatment: {
      hasReceivedTreatment: 'unknown',
      history: [],
    },
    medication: {
      takesMedicationRegularly: 'unknown',
      reason: '',
      medicationName: '',
      durationMonths: null,
    },
    academic: {
      generalIntegrationInFirstGrade: '',
      areasOfInterestAtSchool: '',
      areasOfDifficultyAtSchool: '',
      readingAcquisitionDescription: '',
      hadReadingDifficulties: 'unknown',
      pastReadingDifficulties: '',
      currentReadingDifficulties: '',
      readingComprehensionDifficulties: 'unknown',
      writingDescription: '',
      canExpressSelfInWritingClearly: 'unknown',
      receivesSchoolSupport: 'unknown',
    },
    spokenLanguage: {
      hasWideVocabulary: 'unknown',
      expressesSelfFluentlyDaily: 'unknown',
      speaksInCorrectClearSentences: 'unknown',
    },
    additionalNotes: '',
    consentToResearchUse: false,
    dateCreated: new Date().toLocaleString(),
    lastModified: new Date().toLocaleString(),
  };
}

// --- Age computation helper ---------------------------------------------------

export function computeAgeYearsFromDOB(dob: ISODateString, asOf: Date = new Date()): AgeYears {
  const birth = new Date(dob);
  let years = asOf.getFullYear() - birth.getFullYear();
  const monthDiff = asOf.getMonth() - birth.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && asOf.getDate() < birth.getDate())) {
    years--;
  }
  return makeAgeYears(years);
}