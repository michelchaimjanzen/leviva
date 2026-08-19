import React, { useState } from 'react';
import { saveTestConfig } from '../../utils/testService'; 

// 1. Define the shape of a single trial 
interface BinaryVerificationTrial {
  id: string;
  stimulus: string;
  correctAnswer: 'yes' | 'no';
}

// UPGRADED: Added initialData and metadata payload
interface WorkspaceProps {
  initialData?: any;
  onSave: (configData: BinaryVerificationTrial[], meta: { title: string, description: string }) => void;
}

export function BinaryVerificationWorkspace({ initialData, onSave }: WorkspaceProps) {
  // UPGRADED: State initialization for Edit Mode & Metadata
  const [testTitle, setTestTitle] = useState(initialData?.title || '');
  const [testDescription, setTestDescription] = useState(initialData?.description || '');
  const [trials, setTrials] = useState<BinaryVerificationTrial[]>(initialData?.configData || []);

  const addTrial = () => {
    setTrials([...trials, { id: `Trial_${Date.now()}`, stimulus: '', correctAnswer: 'yes' }]);
  };

  const updateTrial = (index: number, field: keyof BinaryVerificationTrial, value: string) => {
    const updated = [...trials];
    updated[index] = { ...updated[index], [field]: value };
    setTrials(updated);
  };

  // UPGRADED: Curation Controls
  const deleteTrial = (index: number) => {
    setTrials(trials.filter((_, i) => i !== index));
  };

  const moveTrial = (index: number, direction: 'up' | 'down') => {
    const updated = [...trials];
    if (direction === 'up' && index > 0) {
      [updated[index - 1], updated[index]] = [updated[index], updated[index - 1]];
    } else if (direction === 'down' && index < updated.length - 1) {
      [updated[index + 1], updated[index]] = [updated[index], updated[index + 1]];
    }
    setTrials(updated);
  };

 const handleValidateAndSave = async () => {
    if (!testTitle.trim()) { alert("Please provide a Test Title."); return; }
    if (trials.length === 0) { alert("Please add at least one trial."); return; }
    const isValid = trials.every(t => t.stimulus.trim() !== '');
    if (!isValid) { alert("All trials must have a stimulus."); return; }
    
    // --- MAP TO BACKEND SCHEMA ---
    const finalSlides = trials.map((t, index) => ({
      slideNumber: index + 1,
      imageUrl: "", // Verification uses text stimuli
      infoText: t.stimulus,
      targets: [
        {
          id: t.correctAnswer, // 'yes' or 'no'
          x: 0, y: 0,
          isCorrect: true
        }
      ]
    }));

    const testPayload = {
      testName: testTitle,
      testType: "BinaryVerification",
      slides: finalSlides
    };

    // Save to MongoDB via backend
    await saveTestConfig(testPayload, initialData?._id);

    onSave(trials, { title: testTitle, description: testDescription });
  };

  return (
    <div style={{ padding: '20px', fontFamily: 'sans-serif' }}>
      <h2>Layer 2: Binary Verification Template Creator</h2>

      {/* UPGRADED: Metadata Inputs */}
      <div style={{ backgroundColor: '#f9f9f9', padding: '15px', border: '1px solid #ccc', marginBottom: '20px', borderRadius: '4px' }}>
        <input 
          type="text" 
          value={testTitle} 
          onChange={(e) => setTestTitle(e.target.value)} 
          placeholder="Enter Test Title" 
          style={{ width: '100%', padding: '10px', fontSize: '18px', fontWeight: 'bold', marginBottom: '10px', boxSizing: 'border-box' }}
        />
        <input 
          type="text" 
          value={testDescription} 
          onChange={(e) => setTestDescription(e.target.value)} 
          placeholder="Enter description..." 
          style={{ width: '100%', padding: '8px', fontSize: '14px', boxSizing: 'border-box' }}
        />
      </div>

      <button onClick={addTrial} style={{ marginBottom: '20px', padding: '10px' }}>+ Add Trial</button>

      {trials.map((t, idx) => (
        <div key={t.id} style={{ marginBottom: '10px', display: 'flex', gap: '10px', alignItems: 'center' }}>
          {/* Curation Controls */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
            <button onClick={() => moveTrial(idx, 'up')} disabled={idx === 0} style={{ fontSize: '10px' }}>↑</button>
            <button onClick={() => deleteTrial(idx)} style={{ fontSize: '10px', color: 'red' }}>X</button>
            <button onClick={() => moveTrial(idx, 'down')} disabled={idx === trials.length - 1} style={{ fontSize: '10px' }}>↓</button>
          </div>

          <strong>#{idx + 1}</strong>
          <input 
            placeholder="Stimulus (e.g., 'Is a cat a vegetable?')" 
            value={t.stimulus} 
            onChange={(e) => updateTrial(idx, 'stimulus', e.target.value)} 
            style={{ flex: 1, padding: '8px' }}
          />
          <select value={t.correctAnswer} onChange={(e) => updateTrial(idx, 'correctAnswer', e.target.value as 'yes' | 'no')}>
            <option value="yes">Correct: YES</option>
            <option value="no">Correct: NO</option>
          </select>
        </div>
      ))}

      {trials.length > 0 && (
        <button 
          onClick={handleValidateAndSave} 
          style={{ width: '100%', padding: '15px', marginTop: '20px', backgroundColor: 'green', color: 'white', fontSize: '18px', fontWeight: 'bold', cursor: 'pointer' }}
        >
          {initialData ? 'Update Test in Bank 💾' : 'Save to Test Bank 💾'}
        </button>
      )}
    </div>
  );
}

// Layer 3: Runner Engine

// NEW: Interface to support sequence commands
interface BinaryVerificationRunnerProps {
  testData: BinaryVerificationTrial[];
  forcedMode?: string;
  onComplete?: (data: any) => void;
}

export const BinaryVerificationEngine = ({ testData, forcedMode, onComplete }: BinaryVerificationRunnerProps) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [startTime, setStartTime] = useState(Date.now());
  const [results, setResults] = useState<any[]>([]);

  const handleSelection = (userChoice: 'yes' | 'no') => {
    const reactionTime = Date.now() - startTime;
    const currentTrial = testData[currentIndex];
    const isCorrect = userChoice === currentTrial.correctAnswer;

    const newResult = {
      trialIndex: currentIndex,
      stimulus: currentTrial.stimulus,
      choice: userChoice,
      isCorrect,
      reactionTime,
      timestamp: new Date().toISOString(),
    };

    const updatedResults = [...results, newResult];
    setResults(updatedResults);

    if (currentIndex < testData.length - 1) {
      setCurrentIndex(prev => prev + 1);
      setStartTime(Date.now());
    } else {
      // NEW: Bypass standard download if running in a master sequence
      if (onComplete) {
        onComplete({
          testType: 'Binary Verification',
          results: updatedResults
        });
      } else {
        alert("Test Complete! Downloading report...");
        triggerDownload(updatedResults);
      }
    }
  };

  const triggerDownload = (finalResults: any[]) => {
    const dataString = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(finalResults, null, 2));
    const anchor = document.createElement('a');
    anchor.href = dataString;
    anchor.download = `binary_verification_output_${Date.now()}.json`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
  };

  const currentTrial = testData[currentIndex];

  return (
    <main style={{ textAlign: 'center', fontFamily: 'system-ui', padding: '40px' }}>
      <h1 style={{ fontSize: '4rem', margin: '60px 0' }}>{currentTrial.stimulus}</h1>
      <div style={{ display: 'flex', justifyContent: 'center', gap: '30px' }}>
        <button onClick={() => handleSelection('yes')} style={btnStyle}>YES</button>
        <button onClick={() => handleSelection('no')} style={btnStyle}>NO</button>
      </div>
    </main>
  );
};

const btnStyle: React.CSSProperties = {
  padding: '20px 60px', fontSize: '1.5rem', fontWeight: 'bold', borderRadius: '12px', cursor: 'pointer', backgroundColor: '#e6fffa'
};