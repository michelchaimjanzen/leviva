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
        setError('Could not load this sequence from the server.');
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
          gender: patientGender 
        },
        ...sequenceResults
      ];

      const payload = {
        patientId: patientIdNumber, // Matches your backend requirement
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
        alert(`❌ Failed to save results to cloud: ${errData.error}`);
      }
    } catch (error) {
      console.error("Cloud connection error:", error);
      alert("❌ Could not connect to backend to save results.");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loading) return <div style={{ padding: '40px', textAlign: 'center' }}>Loading sequence…</div>;

  if (error || !sequence) {
    return (
      <div style={{ padding: '40px', textAlign: 'center' }}>
        <p style={{ color: 'red' }}>{error || 'Sequence not found.'}</p>
        {onExit && <button onClick={onExit} style={{ padding: '10px 20px', cursor: 'pointer' }}>← Back</button>}
      </div>
    );
  }

  // --- PRE-TEST INTAKE SCREEN ---
  if (!isStarted) {
    return (
      <div style={{ padding: '40px', textAlign: 'center', maxWidth: '500px', margin: '60px auto', fontFamily: 'sans-serif', backgroundColor: '#f9f9f9', border: '1px solid #ccc', borderRadius: '8px' }}>
        <h2>Welcome</h2>
        <p style={{ fontSize: '18px', color: 'darkblue', marginBottom: '30px' }}>{sequence.sequenceName}</p>
        
        <div style={{ textAlign: 'left', display: 'flex', flexDirection: 'column', gap: '15px' }}>
          <label>
            <strong>Full Name:</strong>
            <input type="text" value={patientName} onChange={(e) => setPatientName(e.target.value)} style={{ width: '100%', padding: '10px', marginTop: '5px', fontSize: '16px' }} />
          </label>
          <label>
            <strong>ID Number:</strong>
            <input type="text" value={patientIdNumber} onChange={(e) => setPatientIdNumber(e.target.value)} style={{ width: '100%', padding: '10px', marginTop: '5px', fontSize: '16px' }} />
          </label>
          <label>
            <strong>Age:</strong>
            <input type="number" value={patientAge} onChange={(e) => setPatientAge(e.target.value)} style={{ width: '100%', padding: '10px', marginTop: '5px', fontSize: '16px' }} />
          </label>
          <label>
            <strong>Gender:</strong>
            <select value={patientGender} onChange={(e) => setPatientGender(e.target.value)} style={{ width: '100%', padding: '10px', marginTop: '5px', fontSize: '16px' }}>
              <option value="">Select...</option>
              <option value="Male">Male</option>
              <option value="Female">Female</option>
              <option value="Other">Other</option>
            </select>
          </label>
        </div>
        
        <button 
          onClick={() => {
            if (!patientName.trim() || !patientIdNumber.trim() || !patientAge || !patientGender) {
              return alert("Please fill out all fields to begin the test.");
            }
            setIsStarted(true);
          }}
          style={{ width: '100%', padding: '15px', backgroundColor: 'darkblue', color: 'white', border: 'none', borderRadius: '6px', fontSize: '18px', fontWeight: 'bold', cursor: 'pointer', marginTop: '30px' }}
        >
          Start Test
        </button>
      </div>
    );
  }

  // --- SEQUENCE COMPLETE SCREEN ---
  if (stepIndex >= sequence.steps.length) {
    if (submitSuccess) {
      return (
        <div style={{ padding: '60px 40px', textAlign: 'center', backgroundColor: '#eef8ff', border: '2px solid green', borderRadius: '8px', maxWidth: '600px', margin: '40px auto' }}>
          <h2>✅ Thank You!</h2>
          <p style={{ fontSize: '18px' }}>Your results have been successfully submitted.</p>
          <p>You may now close this window.</p>
        </div>
      );
    }

    return (
      <div style={{ padding: '60px 40px', textAlign: 'center', maxWidth: '500px', margin: '60px auto', backgroundColor: '#f9f9f9', border: '1px solid #ddd', borderRadius: '8px' }}>
        <h2>Test Complete</h2>
        <p style={{ fontSize: '18px', marginBottom: '30px' }}>Thank you for completing the test. Please click submit below.</p>
        
        <button
          onClick={handleSubmitResults}
          disabled={isSubmitting}
          style={{ width: '100%', padding: '15px 30px', backgroundColor: isSubmitting ? 'gray' : 'green', color: 'white', border: 'none', borderRadius: '8px', cursor: isSubmitting ? 'not-allowed' : 'pointer', fontSize: '18px', fontWeight: 'bold' }}
        >
          {isSubmitting ? 'Submitting... ⏳' : 'Submit'}
        </button>
      </div>
    );
  }

  const currentStep = sequence.steps[stepIndex];

  // Manual advance fallback
  const ManualAdvanceControl = (
    <div style={{ position: 'fixed', bottom: '20px', right: '20px', zIndex: 1000 }}>
      <button onClick={goToNextStep} style={{ padding: '10px 18px', backgroundColor: '#2196F3', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold', boxShadow: '0 2px 6px rgba(0,0,0,0.2)' }}>
        Skip Step ▶ ({stepIndex + 1}/{sequence.steps.length})
      </button>
    </div>
  );

  // --- INFO STEP ---
  if (currentStep.stepType === 'info') {
    return (
      <div style={{ maxWidth: '700px', margin: '60px auto', padding: '30px', border: '1px solid #ddd', borderRadius: '8px', backgroundColor: '#fafafa' }}>
        <p style={{ fontSize: '18px', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>{currentStep.infoContent}</p>
        <button onClick={goToNextStep} style={{ marginTop: '30px', padding: '12px 24px', backgroundColor: 'green', color: 'white', border: 'none', borderRadius: '6px', fontSize: '16px', cursor: 'pointer' }}>
          Continue →
        </button>
        {ManualAdvanceControl}
      </div>
    );
  }

  // --- TEST STEP ---
  const test = currentStep.testId;

  if (!test || typeof test === 'string') {
    return (
      <div style={{ padding: '40px', textAlign: 'center' }}>
        <p style={{ color: 'red' }}>This step references a test that could no longer be found.</p>
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
        return <p style={{ color: 'red' }}>Unknown test type: {test.testType}</p>;
    }
  };

  return (
    <div>
      {renderTestRunner()}
      {ManualAdvanceControl}
    </div>
  );
}