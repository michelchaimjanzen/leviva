// =========================================================================
// PATIENT BANK
// Lists saved patient intake records. Parallel to App.tsx's existing
// "bank" view for tests — same visual language, same edit/select pattern.
// =========================================================================

import type { PatientIntake } from '../../types/patient';
import { extractRegisteredParameters } from '../../types/patient';

interface PatientBankProps {
  patients: PatientIntake[];
  onEdit: (patient: PatientIntake) => void;
  onSelectForTesting: (patient: PatientIntake) => void;
}

const containerStyle: React.CSSProperties = {
  maxWidth: '900px',
  margin: '0 auto',
  marginTop: '30px',
  direction: 'rtl',
};

const rowStyle: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  padding: '15px',
  border: '1px solid #ddd',
  borderRadius: '4px',
  backgroundColor: 'white',
  marginBottom: '10px',
};

const tagStyle: React.CSSProperties = {
  display: 'inline-block',
  padding: '2px 8px',
  fontSize: '12px',
  borderRadius: '10px',
  backgroundColor: '#eef8ff',
  color: 'darkblue',
  marginInlineEnd: '6px',
};

export function PatientBank({ patients, onEdit, onSelectForTesting }: PatientBankProps) {
  return (
    <div style={containerStyle}>
      <h2>בנק מטופלים</h2>
      {patients.length === 0 ? (
        <p>אין מטופלים רשומים עדיין. צרו שאלון מטופל חדש כדי להתחיל.</p>
      ) : (
        <div>
          {patients.map((patient) => {
            const params = extractRegisteredParameters(patient);
            return (
              <div key={patient.id} style={rowStyle}>
                <div>
                  <strong style={{ fontSize: '17px', color: 'darkblue' }}>
                    {patient.child.firstName} {patient.child.lastName}
                  </strong>
                  <div style={{ marginTop: '6px' }}>
                    <span style={tagStyle}>גיל {params.ageYears}</span>
                    <span style={tagStyle}>{params.gender === 'male' ? 'זכר' : 'נקבה'}</span>
                    {patient.child.grade && <span style={tagStyle}>כיתה {patient.child.grade}</span>}
                    {params.hasAtypicalDevelopmentalDomains && (
                      <span style={{ ...tagStyle, backgroundColor: '#fff3cd', color: '#856404' }}>
                        קשיים התפתחותיים
                      </span>
                    )}
                  </div>
                  <div style={{ color: 'gray', fontSize: '12px', marginTop: '6px' }}>
                    עודכן לאחרונה: {patient.lastModified}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '10px' }}>
                  <button
                    onClick={() => onEdit(patient)}
                    style={{
                      padding: '8px 16px',
                      backgroundColor: '#ffc107',
                      color: 'black',
                      fontWeight: 'bold',
                      border: 'none',
                      borderRadius: '4px',
                      cursor: 'pointer',
                    }}
                  >
                    ✏️ ערוך
                  </button>
                  <button
                    onClick={() => onSelectForTesting(patient)}
                    style={{
                      padding: '8px 16px',
                      backgroundColor: 'green',
                      color: 'white',
                      fontWeight: 'bold',
                      border: 'none',
                      borderRadius: '4px',
                      cursor: 'pointer',
                    }}
                  >
                    ▶ בחר מבחנים
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
