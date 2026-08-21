import { useState, useEffect } from 'react';

// Path is relative to client/src/components/dashboard/ -> client/src/components/tests/
import { AuditoryRepetitionRunner } from '../tests/AuditoryRepetition.tsx';
import { VisualAssociationRunner } from '../tests/VisualAssociationTemplate';
import { ReadingAloudRunner } from '../tests/ReadingAloud';
import { BinaryChoiceRunner } from '../tests/BinaryChoiceTemplate';
import { TargetRunnerEngine } from '../tests/VisualTargetIdentification';
import { NamingTaskRunner } from '../tests/NamingTask';

const API_URL = 'https://leviva-backend.onrender.com';

interface SequenceStep {
  stepType: 'info' | 'test';
  infoContent?: string;
  testId?: {
    _id: string;
    testName: string;
    testType: string;
    slides: any[];
  } | string | null;
}

interface FetchedSequence {
  _id: string;
  sequenceName: string;
  description?: string;
  steps: SequenceStep[];
}

interface PublicSequenceRunnerProps {
  sequenceId: string;
  onExit?: () => void;
}

export function PublicSequenceRunner({ sequenceId, onExit }: PublicSequenceRunnerProps) {
  const [sequence, setSequence] = useState<FetchedSequence | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Sequence Progress State
  const [stepIndex, setStepIndex] = useState(0);
  const [sequenceResults, setSequenceResults] = useState<any[]>([]); 
  
  // Participant Demographic State
  const [patientName, setPatientName] = useState('');
  const [patientIdNumber, setPatientIdNumber] = useState('');
  const [patientAge, setPatientAge] = useState('');
  const [patientGender, setPatientGender] = useState('');
  const [readingDifficulty, setReadingDifficulty] = useState('');
  
  const [isStarted, setIsStarted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState(false);

  useEffect(() => {
    setLoading(true);
    setError(null);
    fetch(`${API_URL}/api/sequences/${sequenceId}`)
      .then(res => {
        if (!res.ok) throw new Error(`Server responded ${res.status}`);
        return res.json();
      })
      .then(data => {
        setSequence(data);
        setStepIndex(0);
      })
      .catch(err => {
        console.error('Failed to load sequence:', err);
        setError('לא הצלחנו לטעון את הרצף מהשרת.');
      })
      .finally(() => setLoading(false));
  }, [sequenceId]);

  const goToNextStep = () => {
    if (!sequence) return;
    setStepIndex(prev => Math.min(prev + 1, sequence.steps.length));
  };

  const handleStepComplete = (testData: any) => {
    setSequenceResults(prev => [...prev, { 
      stepNumber: stepIndex + 1, 
      data: testData 
    }]);
    goToNextStep();
  };

  const handleSubmitResults = async () => {
    if (!sequence) return;
    setIsSubmitting(true);
    
    try {
      // Package the demographics with the test results
      const finalResults = [
        { 
          stepType: 'Participant Demographics', 
          name: patientName, 
          idNumber: patientIdNumber, 
          age: patientAge, 
          gender: patientGender,
          readingDifficulty: readingDifficulty
        },
        ...sequenceResults
      ];

      const payload = {
        patientId: patientIdNumber,
        sequenceId: sequence._id,
        sequenceName: sequence.sequenceName,
        masterResults: finalResults
      };

      const response = await fetch(`${API_URL}/api/results`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (response.ok) {
        setSubmitSuccess(true);
      } else {
        const errData = await response.json();
        alert(`❌ שגיאה בשמירת התוצאות בענן: ${errData.error}`);
      }
    } catch (error) {
      console.error("Cloud connection error:", error);
      alert("❌ לא ניתן להתחבר לשרת לשמירת התוצאות.");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loading) return <div dir="rtl" style={{ padding: '40px', textAlign: 'center' }}>טוען את המבדק…</div>;

  if (error || !sequence) {
    return (
      <div dir="rtl" style={{ padding: '40px', textAlign: 'center' }}>
        <p style={{ color: 'red' }}>{error || 'המבדק לא נמצא.'}</p>
        {onExit && <button onClick={onExit} style={{ padding: '10px 20px', cursor: 'pointer' }}>← חזור</button>}
      </div>
    );
  }

  // --- PRE-TEST INTAKE SCREEN ---
  if (!isStarted) {
    return (
      <div dir="rtl" style={{ padding: '40px', textAlign: 'right', maxWidth: '550px', margin: '60px auto', fontFamily: 'sans-serif', backgroundColor: '#f9f9f9', border: '1px solid #ccc', borderRadius: '8px' }}>
        <h2 style={{ color: 'darkblue', marginBottom: '10px' }}>תודה שאתם עוזרים לנו!</h2>
        <p style={{ fontSize: '18px', marginBottom: '30px' }}>אנא מלאו את הפרטים ונתחיל.</p>
        
        <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
          <label>
            <strong>שם מלא:</strong>
            <input type="text" value={patientName} onChange={(e) => setPatientName(e.target.value)} style={{ width: '100%', padding: '10px', marginTop: '5px', fontSize: '16px', boxSizing: 'border-box' }} />
          </label>
          <label>
            <strong>תעודת זהות:</strong>
            <input type="text" value={patientIdNumber} onChange={(e) => setPatientIdNumber(e.target.value)} style={{ width: '100%', padding: '10px', marginTop: '5px', fontSize: '16px', boxSizing: 'border-box' }} />
          </label>
          <label>
            <strong>גיל:</strong>
            <input type="number" value={patientAge} onChange={(e) => setPatientAge(e.target.value)} style={{ width: '100%', padding: '10px', marginTop: '5px', fontSize: '16px', boxSizing: 'border-box' }} />
          </label>
          <label>
            <strong>מגדר:</strong>
            <select value={patientGender} onChange={(e) => setPatientGender(e.target.value)} style={{ width: '100%', padding: '10px', marginTop: '5px', fontSize: '16px', boxSizing: 'border-box' }}>
              <option value="">בחרי/בחר...</option>
              <option value="Male">זכר</option>
              <option value="Female">נקבה</option>
              <option value="Other">אחר</option>
            </select>
          </label>
          <label>
            <strong>האם את/ה חושב/ת שיש לך קושי בקריאה?</strong>
            <select value={readingDifficulty} onChange={(e) => setReadingDifficulty(e.target.value)} style={{ width: '100%', padding: '10px', marginTop: '5px', fontSize: '16px', boxSizing: 'border-box' }}>
              <option value="">בחרי/בחר...</option>
              <option value="No">לא, אין לי קושי בקריאה</option>
              <option value="Diagnosed">יש לי אבחון של דיסלקסיה</option>
              <option value="Suspect">אני חושבת שיש לי קושי אבל לא אובחנתי</option>
            </select>
          </label>
        </div>
        
        <button 
          onClick={() => {
            if (!patientName.trim() || !patientIdNumber.trim() || !patientAge || !patientGender || !readingDifficulty) {
              return alert("נא למלא את כל השדות כדי להתחיל.");
            }
            setIsStarted(true);
          }}
          style={{ width: '100%', padding: '15px', backgroundColor: 'darkblue', color: 'white', border: 'none', borderRadius: '6px', fontSize: '18px', fontWeight: 'bold', cursor: 'pointer', marginTop: '30px' }}
        >
          התחלת המבדק
        </button>
      </div>
    );
  }

  // --- SEQUENCE COMPLETE SCREEN ---
  if (stepIndex >= sequence.steps.length) {
    if (submitSuccess) {
      return (
        <div dir="rtl" style={{ padding: '60px 40px', textAlign: 'center', backgroundColor: '#eef8ff', border: '2px solid green', borderRadius: '8px', maxWidth: '600px', margin: '40px auto' }}>
          <h2>✅ תודה רבה!</h2>
          <p style={{ fontSize: '18px' }}>התוצאות שלך נשמרו בהצלחה.</p>
          <p>כעת אפשר לסגור את החלון.</p>
        </div>
      );
    }

    return (
      <div dir="rtl" style={{ padding: '60px 40px', textAlign: 'center', maxWidth: '500px', margin: '60px auto', backgroundColor: '#f9f9f9', border: '1px solid #ddd', borderRadius: '8px' }}>
        <h2>המבדק הושלם</h2>
        <p style={{ fontSize: '18px', marginBottom: '30px' }}>תודה רבה על השלמת המבדק. אנא לחץ/י על כפתור השליחה למטה.</p>
        
        <button
          onClick={handleSubmitResults}
          disabled={isSubmitting}
          style={{ width: '100%', padding: '15px 30px', backgroundColor: isSubmitting ? 'gray' : 'green', color: 'white', border: 'none', borderRadius: '8px', cursor: isSubmitting ? 'not-allowed' : 'pointer', fontSize: '18px', fontWeight: 'bold' }}
        >
          {isSubmitting ? 'שולח... ⏳' : 'שלח תוצאות'}
        </button>
      </div>
    );
  }

  const currentStep = sequence.steps[stepIndex];

  // Manual advance fallback
  const ManualAdvanceControl = (
    <div style={{ position: 'fixed', bottom: '20px', left: '20px', zIndex: 1000 }}>
      <button onClick={goToNextStep} style={{ padding: '10px 18px', backgroundColor: '#2196F3', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold', boxShadow: '0 2px 6px rgba(0,0,0,0.2)' }}>
        דלג שלב ▶ ({stepIndex + 1}/{sequence.steps.length})
      </button>
    </div>
  );

  // --- INFO STEP ---
  if (currentStep.stepType === 'info') {
    let displayContent = currentStep.infoContent || '';
    if (patientGender === 'Female') {
      displayContent = displayContent
        .replace(/\bשים לב\b/g, 'שימי לב')
        .replace(/\bתוכל\b/g, 'תוכלי')
        .replace(/\bמוכן\b/g, 'מוכנה')
        .replace(/\bנבדק\b/g, 'נבדקת')
        .replace(/\bבוחר\b/g, 'בוחרת');
    }

    return (
      <div dir="rtl" style={{ maxWidth: '700px', margin: '60px auto', padding: '30px', border: '1px solid #ddd', borderRadius: '8px', backgroundColor: '#fafafa', textAlign: 'right' }}>
        <p style={{ fontSize: '22px', lineHeight: 1.8, whiteSpace: 'pre-wrap' }}>{displayContent}</p>
        <button onClick={goToNextStep} style={{ marginTop: '30px', padding: '12px 30px', backgroundColor: 'green', color: 'white', border: 'none', borderRadius: '6px', fontSize: '18px', cursor: 'pointer', fontWeight: 'bold' }}>
          המשך ←
        </button>
        {ManualAdvanceControl}
      </div>
    );
  }

  // --- TEST STEP ---
  const test = currentStep.testId;

  if (!test || typeof test === 'string') {
    return (
      <div dir="rtl" style={{ padding: '40px', textAlign: 'center' }}>
        <p style={{ color: 'red' }}>שגיאה: המבדק לא נמצא.</p>
        {ManualAdvanceControl}
      </div>
    );
  }

  const slides = test.slides || [];

  const renderTestRunner = () => {
    switch (test.testType) {
      case 'Auditory':
        return <AuditoryRepetitionRunner configuredAudioTracks={slides} forcedMode="Patient Solo" onComplete={handleStepComplete} />;
      case 'VisualAssociation':
        return <VisualAssociationRunner configuredSlides={slides} forcedMode="Patient Solo" onComplete={handleStepComplete} />;
      case 'ReadingAloud':
        return <ReadingAloudRunner configuredTasks={slides} forcedMode="Patient Solo" onComplete={handleStepComplete} />;
      case 'BinaryChoice':
        return <BinaryChoiceRunner configuredTrials={slides} testMode={slides[0]?.testType} forcedMode="Patient Solo" onComplete={handleStepComplete} />;
      case 'TargetID':
        return <TargetRunnerEngine configuredSlides={slides} forcedMode="Patient Solo" onComplete={handleStepComplete} />;
      case 'Naming':
        return <NamingTaskRunner configuredSlides={slides} forcedMode="Patient Solo" onComplete={handleStepComplete} />;
      default:
        return <p style={{ color: 'red' }}>סוג מבדק לא מוכר: {test.testType}</p>;
    }
  };

  return (
    <div>
      {renderTestRunner()}
      {ManualAdvanceControl}
    </div>
  );
}