// =========================================================================
// PATIENT INTAKE FORM
// Single unified form covering both source questionnaires (boy/girl).
// Gender is the first field captured and drives all gendered phrasing via
// utils/patientPhrasing.ts — there is exactly one template, not two.
// =========================================================================

import { useState } from 'react';
import type {
  PatientIntake,
  Gender,
  DominantHand,
  ClassroomType,
  YesNoUnknown,
  DevelopmentalDomain,
  TreatmentType,
  TreatmentHistoryEntry,
  Sibling,
} from '../../types/patient';
import {
  createBlankPatientIntake,
  makeAgeYears,
  makeISODateString,
  computeAgeYearsFromDOB,
} from '../../types/patient';
import { phrasing, developmentalDomainLabels, treatmentTypeLabels } from '../../utils/patientPhrasing';
import {
  TextField,
  TextAreaField,
  NumberField,
  DigitsField,
  DateField,
  YesNoField,
  SelectField,
  FieldWrap,
  FieldLabel,
} from './PatientFormFields';

// --- Layout primitives (matches the plain inline-style pattern already
// used throughout App.tsx, rather than introducing a new visual system) ---

const pageStyle: React.CSSProperties = {
  maxWidth: '760px',
  margin: '0 auto',
  marginTop: '20px',
  marginBottom: '60px',
  direction: 'rtl',
  fontFamily: 'Arial, sans-serif',
};

const sectionStyle: React.CSSProperties = {
  border: '1px solid #ddd',
  borderRadius: '8px',
  padding: '20px',
  marginBottom: '20px',
  backgroundColor: '#fff',
};

const sectionTitleStyle: React.CSSProperties = {
  fontSize: '18px',
  fontWeight: 'bold',
  color: 'darkblue',
  marginTop: 0,
  marginBottom: '16px',
  borderBottom: '2px solid #eef8ff',
  paddingBottom: '8px',
};

const introBoxStyle: React.CSSProperties = {
  backgroundColor: '#eef8ff',
  border: '1px solid #cde4f7',
  borderRadius: '8px',
  padding: '16px',
  marginBottom: '20px',
  fontSize: '14px',
  lineHeight: 1.6,
};

const tableStyle: React.CSSProperties = {
  width: '100%',
  borderCollapse: 'collapse',
  fontSize: '13px',
  marginBottom: '8px',
};

const thStyle: React.CSSProperties = {
  border: '1px solid #ddd',
  padding: '8px',
  backgroundColor: '#f5f5f5',
  textAlign: 'center',
};

const tdStyle: React.CSSProperties = {
  border: '1px solid #ddd',
  padding: '6px',
};

const smallBtnStyle: React.CSSProperties = {
  padding: '6px 12px',
  fontSize: '13px',
  cursor: 'pointer',
  backgroundColor: '#eef8ff',
  border: '1px solid darkblue',
  color: 'darkblue',
  borderRadius: '4px',
  fontWeight: 'bold',
};

const removeBtnStyle: React.CSSProperties = {
  padding: '4px 10px',
  fontSize: '12px',
  cursor: 'pointer',
  backgroundColor: '#fff0f0',
  border: '1px solid #d9534f',
  color: '#d9534f',
  borderRadius: '4px',
};

// --- Props (matches the existing Workspace component pattern: initialData
// for edit mode, onSave to hand the finished record back up to App.tsx) ---

interface PatientIntakeWorkspaceProps {
  initialData: PatientIntake | null;
  onSave: (data: PatientIntake) => void;
}

export function PatientIntakeWorkspace({ initialData, onSave }: PatientIntakeWorkspaceProps) {
  const [intake, setIntake] = useState<PatientIntake>(
    () => initialData ?? createBlankPatientIntake(`Patient_${Date.now()}`)
  );
  const [dobError, setDobError] = useState<string | null>(null);
  const [idError, setIdError] = useState<string | null>(null);

  const gender: Gender = intake.child.gender;

  // --- Generic nested-state updater helpers ---

  function updateChild<K extends keyof PatientIntake['child']>(
    key: K,
    value: PatientIntake['child'][K]
  ) {
    setIntake((prev) => ({ ...prev, child: { ...prev.child, [key]: value } }));
  }

  function updateParent(
    who: 'father' | 'mother',
    key: keyof PatientIntake['parents']['father'],
    value: string | number | null
  ) {
    setIntake((prev) => ({
      ...prev,
      parents: {
        ...prev.parents,
        [who]: { ...prev.parents[who], [key]: value },
      },
    }));
  }

  function updateFamily<K extends keyof PatientIntake['familyBackground']>(
    key: K,
    value: PatientIntake['familyBackground'][K]
  ) {
    setIntake((prev) => ({
      ...prev,
      familyBackground: { ...prev.familyBackground, [key]: value },
    }));
  }

  function updateDevelopmental<K extends keyof PatientIntake['developmentalBackground']>(
    key: K,
    value: PatientIntake['developmentalBackground'][K]
  ) {
    setIntake((prev) => ({
      ...prev,
      developmentalBackground: { ...prev.developmentalBackground, [key]: value },
    }));
  }

  function updateDomainStatus(domain: DevelopmentalDomain, status: 'typical' | 'delayOrDifficulty') {
    setIntake((prev) => ({
      ...prev,
      developmentalBackground: {
        ...prev.developmentalBackground,
        domains: prev.developmentalBackground.domains.map((d) =>
          d.domain === domain ? { ...d, status } : d
        ),
      },
    }));
  }

  function updateDomainDetails(domain: DevelopmentalDomain, details: string) {
    setIntake((prev) => ({
      ...prev,
      developmentalBackground: {
        ...prev.developmentalBackground,
        domains: prev.developmentalBackground.domains.map((d) =>
          d.domain === domain ? { ...d, details } : d
        ),
      },
    }));
  }

  function updateTreatment<K extends keyof PatientIntake['treatment']>(
    key: K,
    value: PatientIntake['treatment'][K]
  ) {
    setIntake((prev) => ({ ...prev, treatment: { ...prev.treatment, [key]: value } }));
  }

  function updateMedication<K extends keyof PatientIntake['medication']>(
    key: K,
    value: PatientIntake['medication'][K]
  ) {
    setIntake((prev) => ({ ...prev, medication: { ...prev.medication, [key]: value } }));
  }

  function updateAcademic<K extends keyof PatientIntake['academic']>(
    key: K,
    value: PatientIntake['academic'][K]
  ) {
    setIntake((prev) => ({ ...prev, academic: { ...prev.academic, [key]: value } }));
  }

  function updateSpokenLanguage<K extends keyof PatientIntake['spokenLanguage']>(
    key: K,
    value: PatientIntake['spokenLanguage'][K]
  ) {
    setIntake((prev) => ({ ...prev, spokenLanguage: { ...prev.spokenLanguage, [key]: value } }));
  }

  // --- Siblings (dynamic list) ---

  function addSibling() {
    const newSibling: Sibling = { ageYears: makeAgeYears(0) };
    updateFamily('siblings', [...intake.familyBackground.siblings, newSibling]);
  }

  function updateSiblingAge(index: number, age: number) {
    const next = intake.familyBackground.siblings.map((s, i) =>
      i === index ? { ageYears: makeAgeYears(age) } : s
    );
    updateFamily('siblings', next);
  }

  function removeSibling(index: number) {
    updateFamily(
      'siblings',
      intake.familyBackground.siblings.filter((_, i) => i !== index)
    );
  }

  // --- Treatment history (dynamic list) ---

  function addTreatmentEntry() {
    const entry: TreatmentHistoryEntry = {
      treatmentType: 'speechLanguageTherapy',
      ageAtTreatment: null,
      durationMonths: null,
      wasHelpful: 'unknown',
    };
    updateTreatment('history', [...intake.treatment.history, entry]);
  }

  function updateTreatmentEntry<K extends keyof TreatmentHistoryEntry>(
    index: number,
    key: K,
    value: TreatmentHistoryEntry[K]
  ) {
    const next = intake.treatment.history.map((entry, i) =>
      i === index ? { ...entry, [key]: value } : entry
    );
    updateTreatment('history', next);
  }

  function removeTreatmentEntry(index: number) {
    updateTreatment(
      'history',
      intake.treatment.history.filter((_, i) => i !== index)
    );
  }

  // --- DOB -> age sync (age is always derived, never independently typed) ---

  function handleDobChange(raw: string) {
    setDobError(null);
    if (!raw) {
      updateChild('dateOfBirth', '' as PatientIntake['child']['dateOfBirth']);
      return;
    }
    try {
      const iso = makeISODateString(raw);
      const age = computeAgeYearsFromDOB(iso);
      setIntake((prev) => ({
        ...prev,
        child: { ...prev.child, dateOfBirth: iso, ageYearsAtIntake: age },
      }));
    } catch {
      setDobError('תאריך לא תקין');
    }
  }

  function handleIdChange(raw: string) {
    setIdError(null);
    updateChild('idNumber', raw === '' ? null : (raw as PatientIntake['child']['idNumber']));
  }

  // --- Submit ---

  function handleSave() {
    if (intake.child.idNumber && !/^\d{9}$/.test(intake.child.idNumber)) {
      setIdError('מספר תעודת זהות חייב להיות 9 ספרות');
      return;
    }
    if (!intake.child.dateOfBirth) {
      setDobError('שדה חובה');
      return;
    }
    const finalRecord: PatientIntake = {
      ...intake,
      lastModified: new Date().toLocaleString(),
    };
    onSave(finalRecord);
  }

  return (
    <div style={pageStyle}>
      <h2 style={{ textAlign: 'center' }}>{phrasing.formTitle(gender)}</h2>
      <div style={introBoxStyle}>{phrasing.intro(gender)}</div>

      {/* --- Gender selector: drives every other gendered label on this page --- */}
      <div style={sectionStyle}>
        <SelectField<Gender>
          label="מין הילד/ה"
          value={gender}
          onChange={(v) => updateChild('gender', v)}
          options={[
            { value: 'male', text: 'זכר' },
            { value: 'female', text: 'נקבה' },
          ]}
        />
      </div>

      {/* --- Child identity --- */}
      <div style={sectionStyle}>
        <h3 style={sectionTitleStyle}>{phrasing.childSectionTitle(gender)}</h3>
        <TextField label="שם פרטי" value={intake.child.firstName} onChange={(v) => updateChild('firstName', v)} />
        <TextField label="שם משפחה" value={intake.child.lastName} onChange={(v) => updateChild('lastName', v)} />
        <DigitsField
          label="מספר תעודת זהות"
          value={intake.child.idNumber ?? ''}
          onChange={handleIdChange}
          maxLength={9}
          placeholder="9 ספרות"
        />
        {idError && <div style={{ color: '#d9534f', fontSize: '13px', marginBottom: '12px' }}>{idError}</div>}

        <FieldWrap>
          <FieldLabel>תאריך לידה</FieldLabel>
          <DateField label="" value={intake.child.dateOfBirth} onChange={handleDobChange} />
          {dobError && <div style={{ color: '#d9534f', fontSize: '13px' }}>{dobError}</div>}
          {intake.child.dateOfBirth && !dobError && (
            <div style={{ color: '#555', fontSize: '13px' }}>גיל מחושב: {intake.child.ageYearsAtIntake}</div>
          )}
        </FieldWrap>

        <TextField label="כיתה" value={intake.child.grade} onChange={(v) => updateChild('grade', v)} placeholder='למשל: ג' />
        <TextField label="שם בית הספר" value={intake.child.schoolName} onChange={(v) => updateChild('schoolName', v)} />

        <SelectField<ClassroomType>
          label="סוג כיתה"
          value={intake.child.classroomType}
          onChange={(v) => updateChild('classroomType', v)}
          options={[
            { value: 'regular', text: 'רגילה' },
            { value: 'inclusion', text: 'שילוב' },
            { value: 'other', text: 'אחר' },
          ]}
        />

        <SelectField<DominantHand>
          label="יד דומיננטית"
          value={intake.child.dominantHand}
          onChange={(v) => updateChild('dominantHand', v)}
          options={[
            { value: 'right', text: 'ימין' },
            { value: 'left', text: 'שמאל' },
            { value: 'both', text: 'שתיהן' },
            { value: 'unknown', text: 'לא ידוע' },
          ]}
        />

        <YesNoField
          label={phrasing.wearsGlasses(gender)}
          value={intake.child.wearsGlasses}
          onChange={(v) => updateChild('wearsGlasses', v)}
        />
      </div>

      {/* --- Parents --- */}
      <div style={sectionStyle}>
        <h3 style={sectionTitleStyle}>פרטי ההורים</h3>
        <table style={tableStyle}>
          <thead>
            <tr>
              <th style={thStyle}></th>
              <th style={thStyle}>אבא</th>
              <th style={thStyle}>אמא</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td style={tdStyle}>שם</td>
              <td style={tdStyle}>
                <input style={{ width: '100%' }} value={intake.parents.father.name} onChange={(e) => updateParent('father', 'name', e.target.value)} />
              </td>
              <td style={tdStyle}>
                <input style={{ width: '100%' }} value={intake.parents.mother.name} onChange={(e) => updateParent('mother', 'name', e.target.value)} />
              </td>
            </tr>
            <tr>
              <td style={tdStyle}>גיל</td>
              <td style={tdStyle}>
                <input
                  type="number"
                  style={{ width: '100%' }}
                  value={intake.parents.father.age ?? ''}
                  onChange={(e) => updateParent('father', 'age', e.target.value === '' ? null : Number(e.target.value))}
                />
              </td>
              <td style={tdStyle}>
                <input
                  type="number"
                  style={{ width: '100%' }}
                  value={intake.parents.mother.age ?? ''}
                  onChange={(e) => updateParent('mother', 'age', e.target.value === '' ? null : Number(e.target.value))}
                />
              </td>
            </tr>
            <tr>
              <td style={tdStyle}>מספר טלפון</td>
              <td style={tdStyle}>
                <input
                  style={{ width: '100%' }}
                  inputMode="numeric"
                  value={intake.parents.father.phone ?? ''}
                  onChange={(e) => updateParent('father', 'phone', e.target.value.replace(/\D/g, ''))}
                />
              </td>
              <td style={tdStyle}>
                <input
                  style={{ width: '100%' }}
                  inputMode="numeric"
                  value={intake.parents.mother.phone ?? ''}
                  onChange={(e) => updateParent('mother', 'phone', e.target.value.replace(/\D/g, ''))}
                />
              </td>
            </tr>
            <tr>
              <td style={tdStyle}>מקצוע</td>
              <td style={tdStyle}>
                <input style={{ width: '100%' }} value={intake.parents.father.profession} onChange={(e) => updateParent('father', 'profession', e.target.value)} />
              </td>
              <td style={tdStyle}>
                <input style={{ width: '100%' }} value={intake.parents.mother.profession} onChange={(e) => updateParent('mother', 'profession', e.target.value)} />
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* --- Family background --- */}
      <div style={sectionStyle}>
        <h3 style={sectionTitleStyle}>רקע משפחתי</h3>

        <FieldWrap>
          <FieldLabel>מס&apos; הילדים במשפחה וגילם (אחים/אחיות)</FieldLabel>
          {intake.familyBackground.siblings.map((sib, i) => (
            <div key={i} style={{ display: 'flex', gap: '8px', alignItems: 'center', marginBottom: '6px' }}>
              <span style={{ fontSize: '13px', minWidth: '50px' }}>אח/ות {i + 1}:</span>
              <input
                type="number"
                style={{ width: '80px' }}
                value={sib.ageYears}
                onChange={(e) => updateSiblingAge(i, Number(e.target.value))}
              />
              <span style={{ fontSize: '12px', color: '#777' }}>גיל</span>
              <button style={removeBtnStyle} onClick={() => removeSibling(i)}>
                הסר
              </button>
            </div>
          ))}
          <button style={smallBtnStyle} onClick={addSibling}>
            + הוסף אח/ות
          </button>
        </FieldWrap>

        <TextField
          label="שפה/שפות מדוברות בבית (מופרדות בפסיק)"
          value={intake.familyBackground.languagesSpokenAtHome.join(', ')}
          onChange={(v) =>
            updateFamily(
              'languagesSpokenAtHome',
              v.split(',').map((s) => s.trim()).filter(Boolean)
            )
          }
        />

        <TextField
          label={phrasing.childPrimaryLanguage(gender)}
          value={intake.familyBackground.childsPrimaryLanguage}
          onChange={(v) => updateFamily('childsPrimaryLanguage', v)}
        />

        <YesNoField
          label="האם ידוע על לקות למידה בקרב ההורים והאחים?"
          value={intake.familyBackground.familyHistoryOfLearningDisability}
          onChange={(v) => updateFamily('familyHistoryOfLearningDisability', v)}
        />
        <YesNoField
          label="האם ידוע על הפרעת קשב וריכוז בקרב ההורים והאחים?"
          value={intake.familyBackground.familyHistoryOfADHD}
          onChange={(v) => updateFamily('familyHistoryOfADHD', v)}
        />
        <TextAreaField
          label="פירוט נוסף (הפרעה אחרת וכו')"
          value={intake.familyBackground.familyHistoryOtherNotes}
          onChange={(v) => updateFamily('familyHistoryOtherNotes', v)}
        />
      </div>

      {/* --- Developmental background --- */}
      <div style={sectionStyle}>
        <h3 style={sectionTitleStyle}>רקע התפתחותי</h3>

        <YesNoField
          label="האם מהלך ההיריון והלידה היו תקינים?"
          value={intake.developmentalBackground.pregnancyAndBirthTypical}
          onChange={(v) => updateDevelopmental('pregnancyAndBirthTypical', v)}
        />

        <table style={tableStyle}>
          <thead>
            <tr>
              <th style={thStyle}>תחום</th>
              <th style={thStyle}>התפתחות תקינה</th>
              <th style={thStyle}>איחור או קושי</th>
              <th style={thStyle}>פירוט</th>
            </tr>
          </thead>
          <tbody>
            {intake.developmentalBackground.domains.map((entry) => (
              <tr key={entry.domain}>
                <td style={tdStyle}>{developmentalDomainLabels[entry.domain]}</td>
                <td style={{ ...tdStyle, textAlign: 'center' }}>
                  <input
                    type="radio"
                    checked={entry.status === 'typical'}
                    onChange={() => updateDomainStatus(entry.domain, 'typical')}
                  />
                </td>
                <td style={{ ...tdStyle, textAlign: 'center' }}>
                  <input
                    type="radio"
                    checked={entry.status === 'delayOrDifficulty'}
                    onChange={() => updateDomainStatus(entry.domain, 'delayOrDifficulty')}
                  />
                </td>
                <td style={tdStyle}>
                  <input
                    style={{ width: '100%' }}
                    value={entry.details}
                    onChange={(e) => updateDomainDetails(entry.domain, e.target.value)}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        <TextAreaField
          label={phrasing.referralReason(gender)}
          value={intake.developmentalBackground.referralReason}
          onChange={(v) => updateDevelopmental('referralReason', v)}
        />
        <TextField
          label="ביוזמת מי הופנה/תה לאבחון?"
          value={intake.developmentalBackground.referredByWhom}
          onChange={(v) => updateDevelopmental('referredByWhom', v)}
        />
        <TextAreaField
          label="מה מטרת האבחון / מה הציפיות שלכם מאבחון זה?"
          value={intake.developmentalBackground.evaluationGoalsOrExpectations}
          onChange={(v) => updateDevelopmental('evaluationGoalsOrExpectations', v)}
        />
        <YesNoField
          label="האם נערכו אבחונים כלשהם בעבר?"
          value={intake.developmentalBackground.priorEvaluations}
          onChange={(v) => updateDevelopmental('priorEvaluations', v)}
        />
        <TextAreaField
          label="פרט/י את עיקרי ממצאי האבחונים הקודמים"
          value={intake.developmentalBackground.priorEvaluationFindingsSummary}
          onChange={(v) => updateDevelopmental('priorEvaluationFindingsSummary', v)}
        />
      </div>

      {/* --- Treatment history --- */}
      <div style={sectionStyle}>
        <h3 style={sectionTitleStyle}>היסטוריית טיפולים</h3>

        <YesNoField
          label={phrasing.hasReceivedTreatment(gender)}
          value={intake.treatment.hasReceivedTreatment}
          onChange={(v) => updateTreatment('hasReceivedTreatment', v)}
        />

        <FieldWrap>
          <FieldLabel>{phrasing.treatmentsGivenTo(gender)}</FieldLabel>
          <table style={tableStyle}>
            <thead>
              <tr>
                <th style={thStyle}>סוג הטיפול</th>
                <th style={thStyle}>גיל הטיפול</th>
                <th style={thStyle}>משך (חודשים)</th>
                <th style={thStyle}>סייע?</th>
                <th style={thStyle}></th>
              </tr>
            </thead>
            <tbody>
              {intake.treatment.history.map((entry, i) => (
                <tr key={i}>
                  <td style={tdStyle}>
                    <select
                      style={{ width: '100%' }}
                      value={entry.treatmentType}
                      onChange={(e) =>
                        updateTreatmentEntry(i, 'treatmentType', e.target.value as TreatmentType)
                      }
                    >
                      {Object.entries(treatmentTypeLabels).map(([val, text]) => (
                        <option key={val} value={val}>
                          {text}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td style={tdStyle}>
                    <input
                      type="number"
                      style={{ width: '100%' }}
                      value={entry.ageAtTreatment ?? ''}
                      onChange={(e) =>
                        updateTreatmentEntry(
                          i,
                          'ageAtTreatment',
                          e.target.value === '' ? null : makeAgeYears(Number(e.target.value))
                        )
                      }
                    />
                  </td>
                  <td style={tdStyle}>
                    <input
                      type="number"
                      style={{ width: '100%' }}
                      value={entry.durationMonths ?? ''}
                      onChange={(e) =>
                        updateTreatmentEntry(
                          i,
                          'durationMonths',
                          e.target.value === '' ? null : Number(e.target.value)
                        )
                      }
                    />
                  </td>
                  <td style={tdStyle}>
                    <select
                      style={{ width: '100%' }}
                      value={entry.wasHelpful}
                      onChange={(e) => updateTreatmentEntry(i, 'wasHelpful', e.target.value as YesNoUnknown)}
                    >
                      <option value="yes">כן</option>
                      <option value="no">לא</option>
                      <option value="unknown">לא ידוע</option>
                    </select>
                  </td>
                  <td style={tdStyle}>
                    <button style={removeBtnStyle} onClick={() => removeTreatmentEntry(i)}>
                      הסר
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <button style={smallBtnStyle} onClick={addTreatmentEntry}>
            + הוסף טיפול
          </button>
        </FieldWrap>
      </div>

      {/* --- Medication --- */}
      <div style={sectionStyle}>
        <h3 style={sectionTitleStyle}>תרופות</h3>
        <YesNoField
          label={phrasing.takesMedication(gender)}
          value={intake.medication.takesMedicationRegularly}
          onChange={(v) => updateMedication('takesMedicationRegularly', v)}
        />
        {intake.medication.takesMedicationRegularly === 'yes' && (
          <>
            <TextField label="סיבה" value={intake.medication.reason} onChange={(v) => updateMedication('reason', v)} />
            <TextField label="סוג התרופה" value={intake.medication.medicationName} onChange={(v) => updateMedication('medicationName', v)} />
            <NumberField
              label="משך זמן הטיפול התרופתי (חודשים)"
              value={intake.medication.durationMonths}
              onChange={(v) => updateMedication('durationMonths', v)}
              min={0}
            />
          </>
        )}
      </div>

      {/* --- Academic functioning --- */}
      <div style={sectionStyle}>
        <h3 style={sectionTitleStyle}>תפקוד לימודי</h3>
        <TextAreaField
          label="כיצד הייתה ההשתלבות הכללית בכיתה א'?"
          value={intake.academic.generalIntegrationInFirstGrade}
          onChange={(v) => updateAcademic('generalIntegrationInFirstGrade', v)}
        />
        <TextAreaField
          label='מהם תחומי העניין בביה"ס?'
          value={intake.academic.areasOfInterestAtSchool}
          onChange={(v) => updateAcademic('areasOfInterestAtSchool', v)}
        />
        <TextAreaField
          label='מהם התחומים שבהם מתקשה בביה"ס?'
          value={intake.academic.areasOfDifficultyAtSchool}
          onChange={(v) => updateAcademic('areasOfDifficultyAtSchool', v)}
        />
        <TextAreaField
          label={phrasing.readingAcquisition(gender)}
          value={intake.academic.readingAcquisitionDescription}
          onChange={(v) => updateAcademic('readingAcquisitionDescription', v)}
        />
        <YesNoField
          label="האם עלו קשיים בקריאה?"
          value={intake.academic.hadReadingDifficulties}
          onChange={(v) => updateAcademic('hadReadingDifficulties', v)}
        />
        <TextAreaField
          label="מה היו הקשיים?"
          value={intake.academic.pastReadingDifficulties}
          onChange={(v) => updateAcademic('pastReadingDifficulties', v)}
        />
        <TextAreaField
          label="מה הקשיים כיום?"
          value={intake.academic.currentReadingDifficulties}
          onChange={(v) => updateAcademic('currentReadingDifficulties', v)}
        />
        <YesNoField
          label={phrasing.readingComprehension(gender)}
          value={intake.academic.readingComprehensionDifficulties}
          onChange={(v) => updateAcademic('readingComprehensionDifficulties', v)}
        />
        <TextAreaField
          label={phrasing.writingDescription(gender)}
          value={intake.academic.writingDescription}
          onChange={(v) => updateAcademic('writingDescription', v)}
        />
        <YesNoField
          label={phrasing.expressSelfInWriting(gender)}
          value={intake.academic.canExpressSelfInWritingClearly}
          onChange={(v) => updateAcademic('canExpressSelfInWritingClearly', v)}
        />
        <YesNoField
          label={phrasing.receivesSchoolSupport(gender)}
          value={intake.academic.receivesSchoolSupport}
          onChange={(v) => updateAcademic('receivesSchoolSupport', v)}
        />
      </div>

      {/* --- Spoken language --- */}
      <div style={sectionStyle}>
        <h3 style={sectionTitleStyle}>שפה דבורה</h3>
        <YesNoField
          label={phrasing.hasWideVocabulary(gender)}
          value={intake.spokenLanguage.hasWideVocabulary}
          onChange={(v) => updateSpokenLanguage('hasWideVocabulary', v)}
        />
        <YesNoField
          label={phrasing.expressesSelfFluently(gender)}
          value={intake.spokenLanguage.expressesSelfFluentlyDaily}
          onChange={(v) => updateSpokenLanguage('expressesSelfFluentlyDaily', v)}
        />
        <YesNoField
          label={phrasing.speaksInCorrectSentences(gender)}
          value={intake.spokenLanguage.speaksInCorrectClearSentences}
          onChange={(v) => updateSpokenLanguage('speaksInCorrectClearSentences', v)}
        />
      </div>

      {/* --- Additional notes + consent --- */}
      <div style={sectionStyle}>
        <h3 style={sectionTitleStyle}>מידע נוסף</h3>
        <TextAreaField
          label="מידע רלוונטי נוסף"
          value={intake.additionalNotes}
          onChange={(v) => setIntake((prev) => ({ ...prev, additionalNotes: v }))}
        />
        <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px' }}>
          <input
            type="checkbox"
            checked={intake.consentToResearchUse}
            onChange={(e) => setIntake((prev) => ({ ...prev, consentToResearchUse: e.target.checked }))}
          />
          ידוע לי כי הערכת השפה נעשית במעבדת מחקר באוניברסיטת תל אביב וכי ייתכן שנתונים מההערכה ישמשו למחקר (ללא פרטים מזהים).
        </label>
      </div>

      <div style={{ textAlign: 'center', marginTop: '24px' }}>
        <button
          onClick={handleSave}
          style={{
            padding: '14px 40px',
            fontSize: '16px',
            fontWeight: 'bold',
            backgroundColor: 'darkblue',
            color: 'white',
            border: 'none',
            borderRadius: '6px',
            cursor: 'pointer',
          }}
        >
          שמור שאלון
        </button>
      </div>
    </div>
  );
}
