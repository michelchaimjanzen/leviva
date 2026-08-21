import { useState, type ChangeEvent, useMemo } from 'react';
import { extractImagesFromPDF } from '../../utils/pdfExtractor';
import { saveTestConfig } from '../../utils/testService'; 

// =========================================================================
// TYPE DEFINITIONS
// =========================================================================

export type BinaryTestType = 'SimplePairs' | 'MainWord' | 'Picture';

export interface BinaryTrial {
  id: string;
  testType: BinaryTestType;
  
  mainWord?: string;     
  imageUrl?: string;     
  
  correctChoice: string;
  incorrectChoice: string;

  forcedLeftChoice?: string; 
  forcedRightChoice?: string;
}

export interface BinarySessionOutput {
  trialID: string;
  testType: string;
  patientSelected: string | null;
  isCorrect: boolean;
}

export interface FinalReport {
  testMode: string;
  isFlagged: boolean;
  clinicianComment: string;
  totalTimeSpentMs?: number; 
  results: BinarySessionOutput[];
}

export interface WorkspaceProps {
  initialData?: any;
  onSave: (configData: BinaryTrial[], meta: { title: string, description: string }) => void;
}

// =========================================================================
// LAYER 2: WORKSPACE (Main Menu & Builders)
// =========================================================================

export function BinaryChoiceWorkspace({ initialData, onSave }: WorkspaceProps)  {
  
  const [testTitle, setTestTitle] = useState(initialData?.title || '');
  const [testDescription, setTestDescription] = useState(initialData?.description || '');
  const [selectedMode, setSelectedMode] = useState<BinaryTestType | null>(initialData?.configData?.[0]?.testType || null);
  const [trials, setTrials] = useState<BinaryTrial[]>(initialData?.configData || []);
  
  const [bulkMainWords, setBulkMainWords] = useState('');

  const deleteTrial = (index: number) => {
    const updated = [...trials];
    updated.splice(index, 1);
    setTrials(updated);
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
    if (!testTitle.trim()) return alert("Validation Failed: Please provide a Test Title.");
    if (trials.length === 0) return alert("Validation Failed: You must add at least one trial to this test.");
    
    const isValid = trials.every(t => {
      if (t.testType === 'SimplePairs') return t.correctChoice && t.incorrectChoice && t.forcedLeftChoice && t.forcedRightChoice;
      if (t.testType === 'MainWord') return t.mainWord && t.correctChoice && t.incorrectChoice;
      if (t.testType === 'Picture') return t.imageUrl && t.correctChoice && t.incorrectChoice;
      return false;
    });

    if (!isValid) return alert("Validation Failed: Please ensure all trials have a marked correct answer and all text fields filled out.");

    // --- MAP TO BACKEND SCHEMA ---
    const finalSlides = trials.map((t, index) => ({
      slideNumber: index + 1,
      imageUrl: t.imageUrl || "", // Fallback if it's text-only
      infoText: t.mainWord || undefined, // Store main word if applicable
      targets: [
        {
          id: `choice_correct_${index}`,
          x: 0, y: 0, // Text-based choices don't use canvas coordinates, but schema requires fields
          isCorrect: true
        },
        {
          id: `choice_incorrect_${index}`,
          x: 0, y: 0,
          isCorrect: false
        }
      ]
    }));

    const testPayload = {
      testName: testTitle,
      testType: `BinaryChoice_${selectedMode}`,
      slides: finalSlides
    };

    // Save to MongoDB via backend
    await saveTestConfig(testPayload, initialData?._id);

    onSave(trials, { title: testTitle, description: testDescription });
  };

  // --- TEST 1: SIMPLE PAIRS ---
  const addSimplePairRow = () => {
    setTrials([...trials, { id: `Pair_${Date.now()}`, testType: 'SimplePairs', correctChoice: '', incorrectChoice: '', forcedLeftChoice: '', forcedRightChoice: '' }]);
  };

  const updateSimplePair = (index: number, left: string, right: string, correctSide: 'left' | 'right') => {
    const updated = [...trials];
    updated[index].forcedLeftChoice = left;
    updated[index].forcedRightChoice = right;
    updated[index].correctChoice = correctSide === 'left' ? left : right;
    updated[index].incorrectChoice = correctSide === 'left' ? right : left;
    setTrials(updated);
  };

  // --- TEST 2: MAIN WORD BATCH BUILDER ---
  const handleBatchMainWordCreation = () => {
    const count = parseInt(prompt("How many blank questions do you want to add?", "5") || "0", 10);
    if (isNaN(count) || count <= 0) return;
    
    const newTrials = Array.from({ length: count }).map((_, i) => ({
      id: `MainWord_${Date.now()}_${i}`,
      testType: 'MainWord' as BinaryTestType,
      mainWord: '',
      forcedLeftChoice: '',
      forcedRightChoice: '',
      correctChoice: '',
      incorrectChoice: ''
    }));
    setTrials([...trials, ...newTrials]);
  };

  const handleBulkMainWordPaste = () => {
    const words = bulkMainWords.trim().split(/\s+/);
    if (words.length < 3) return alert("Please paste at least 3 words.");

    const newTrials: BinaryTrial[] = [];
    for (let i = 0; i < words.length; i += 3) {
      if (words[i] && words[i+1] && words[i+2]) {
        newTrials.push({
          id: `MainWord_${Date.now()}_${i}`,
          testType: 'MainWord',
          mainWord: words[i],
          forcedLeftChoice: words[i+1],
          forcedRightChoice: words[i+2],
          correctChoice: '', 
          incorrectChoice: ''
        });
      }
    }
    setTrials([...trials, ...newTrials]);
    setBulkMainWords(''); 
  };

  const updateMainWordText = (index: number, value: string) => {
    const updated = [...trials];
    updated[index].mainWord = value;
    setTrials(updated);
  };

  const updateMainWordChoice = (index: number, choiceA: string, choiceB: string, correctSide: 'A' | 'B') => {
    const updated = [...trials];
    updated[index].forcedLeftChoice = choiceA;
    updated[index].forcedRightChoice = choiceB;
    updated[index].correctChoice = correctSide === 'A' ? choiceA : choiceB;
    updated[index].incorrectChoice = correctSide === 'A' ? choiceB : choiceA;
    setTrials(updated);
  };

  // --- TEST 3: PICTURE ---
  const handlePictureUpload = async (e: ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files) return;
    const files = Array.from(e.target.files);
    let newTrials: BinaryTrial[] = [];

    for (const file of files) {
      if (file.type === 'application/pdf') {
        const images = await extractImagesFromPDF(file);
        const pdfTrials: BinaryTrial[] = images.map((imgData, idx) => ({
          id: `Pic_${Date.now()}_${idx}`,
          testType: 'Picture' as BinaryTestType,
          imageUrl: imgData,
          correctChoice: '',
          incorrectChoice: ''
        }));
        newTrials = [...newTrials, ...pdfTrials];
      } else {
        newTrials.push({
          id: `Pic_${Date.now()}_${file.name}`,
          testType: 'Picture' as BinaryTestType,
          imageUrl: URL.createObjectURL(file),
          correctChoice: '',
          incorrectChoice: ''
        });
      }
    }
    setTrials([...trials, ...newTrials]);
  };

  const updatePictureRow = (index: number, field: 'correctChoice' | 'incorrectChoice', value: string) => {
    const updated = [...trials];
    updated[index][field] = value;
    setTrials(updated);
  };

  return (
    <div style={{ padding: '20px', border: '1px solid gray', fontFamily: 'sans-serif' }}>
      <h2>Layer 2: Binary Choice Test Templates</h2>
      
      <div style={{ backgroundColor: '#f9f9f9', padding: '15px', border: '1px solid #ccc', marginBottom: '20px', borderRadius: '4px' }}>
        <input 
          type="text" 
          value={testTitle} 
          onChange={(e) => setTestTitle(e.target.value)} 
          placeholder="Enter Test Title (e.g., Semantic Binary Choice)" 
          style={{ width: '100%', padding: '10px', fontSize: '18px', fontWeight: 'bold', marginBottom: '10px', boxSizing: 'border-box' }}
        />
        <input 
          type="text" 
          value={testDescription} 
          onChange={(e) => setTestDescription(e.target.value)} 
          placeholder="Enter clinical tags or brief description..." 
          style={{ width: '100%', padding: '8px', fontSize: '14px', boxSizing: 'border-box' }}
        />
      </div>

      {!selectedMode && (
        <div style={{ display: 'flex', gap: '15px' }}>
          <button onClick={() => setSelectedMode('SimplePairs')} style={btnStyle}>1. Lexical Pairs (Side-by-Side)</button>
          <button onClick={() => setSelectedMode('MainWord')} style={btnStyle}>2. Main Word + Choices</button>
          <button onClick={() => setSelectedMode('Picture')} style={btnStyle}>3. Picture + Choices</button>
        </div>
      )}

      {/* BUILDER 1: SIMPLE PAIRS */}
      {selectedMode === 'SimplePairs' && (
        <div>
          <h3>Template 1: Simple Word Pairs</h3>
          {trials.map((t, idx) => (
            <div key={t.id} style={{ marginBottom: '10px', padding: '10px', border: '1px solid #ccc', display: 'flex', alignItems: 'center' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', marginRight: '15px' }}>
                <button onClick={() => moveTrial(idx, 'up')} disabled={idx === 0} style={miniBtn}>↑</button>
                <button onClick={() => deleteTrial(idx)} style={{ ...miniBtn, backgroundColor: 'red', color: 'white' }}>X</button>
                <button onClick={() => moveTrial(idx, 'down')} disabled={idx === trials.length - 1} style={miniBtn}>↓</button>
              </div>
              <strong>#{idx + 1} </strong>
              <input placeholder="Left Word" value={t.forcedLeftChoice || ''} onChange={e => updateSimplePair(idx, e.target.value, t.forcedRightChoice || '', t.correctChoice === t.forcedLeftChoice ? 'left' : 'right')} style={{ margin: '0 10px' }}/>
              <input type="radio" checked={t.correctChoice === t.forcedLeftChoice && t.correctChoice !== ''} onChange={() => updateSimplePair(idx, t.forcedLeftChoice || '', t.forcedRightChoice || '', 'left')} /> Correct
              <span style={{ margin: '0 20px' }}>|</span>
              <input placeholder="Right Word" value={t.forcedRightChoice || ''} onChange={e => updateSimplePair(idx, t.forcedLeftChoice || '', e.target.value, t.correctChoice === t.forcedRightChoice ? 'right' : 'left')} style={{ margin: '0 10px' }}/>
              <input type="radio" checked={t.correctChoice === t.forcedRightChoice && t.correctChoice !== ''} onChange={() => updateSimplePair(idx, t.forcedLeftChoice || '', t.forcedRightChoice || '', 'right')} /> Correct
            </div>
          ))}
          <button onClick={addSimplePairRow} style={{ padding: '8px', marginTop: '10px' }}>+ Add Word Pair</button>
        </div>
      )}

      {/* BUILDER 2: MAIN WORD */}
      {selectedMode === 'MainWord' && (
        <div>
          <h3>Template 2: Main Word Semantic Choice</h3>
          
          <div style={{ display: 'flex', gap: '20px', marginBottom: '20px' }}>
            <div style={{ flex: 1, padding: '15px', border: '1px dashed gray', backgroundColor: '#fff' }}>
              <strong>1. Add Blank Rows Manually</strong><br/><br/>
              <button onClick={handleBatchMainWordCreation} style={{ padding: '10px', width: '100%' }}>+ Add Blank Questions</button>
            </div>

            <div style={{ flex: 2, padding: '15px', border: '1px dashed gray', backgroundColor: '#fff' }}>
              <strong>2. Bulk Add Questions (Paste List)</strong><br/><br/>
              <textarea 
                value={bulkMainWords} 
                onChange={(e) => setBulkMainWords(e.target.value)}
                placeholder="Paste raw text here. Every 3 words becomes a row."
                style={{ width: '100%', height: '60px', padding: '8px', boxSizing: 'border-box', marginBottom: '10px' }}
              />
              <button onClick={handleBulkMainWordPaste} style={{ padding: '8px', backgroundColor: 'purple', color: 'white', border: 'none', cursor: 'pointer', fontWeight: 'bold', width: '100%' }}>
                Auto-Generate Questions
              </button>
            </div>
          </div>
          
          {trials.map((t, idx) => (
            <div key={t.id} style={{ marginBottom: '10px', padding: '10px', border: '1px solid #ccc', display: 'flex', gap: '15px', alignItems: 'center' }}>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                <button onClick={() => moveTrial(idx, 'up')} disabled={idx === 0} style={miniBtn}>↑</button>
                <button onClick={() => deleteTrial(idx)} style={{ ...miniBtn, backgroundColor: 'red', color: 'white' }}>X</button>
                <button onClick={() => moveTrial(idx, 'down')} disabled={idx === trials.length - 1} style={miniBtn}>↓</button>
              </div>

              <strong>#{idx + 1}</strong>
              <input placeholder="MAIN WORD" value={t.mainWord || ''} onChange={e => updateMainWordText(idx, e.target.value)} style={{ border: '2px solid purple', fontWeight: 'bold' }} />
              
              <span style={{ borderLeft: '1px solid #ccc', paddingLeft: '15px' }}>Choice A:</span>
              <input value={t.forcedLeftChoice || ''} onChange={e => updateMainWordChoice(idx, e.target.value, t.forcedRightChoice || '', t.correctChoice === t.forcedLeftChoice ? 'A' : 'B')} />
              <input type="radio" checked={t.correctChoice === t.forcedLeftChoice && t.correctChoice !== ''} onChange={() => updateMainWordChoice(idx, t.forcedLeftChoice || '', t.forcedRightChoice || '', 'A')} />
              
              <span style={{ borderLeft: '1px solid #ccc', paddingLeft: '15px' }}>Choice B:</span>
              <input value={t.forcedRightChoice || ''} onChange={e => updateMainWordChoice(idx, t.forcedLeftChoice || '', e.target.value, t.correctChoice === t.forcedRightChoice ? 'B' : 'A')} />
              <input type="radio" checked={t.correctChoice === t.forcedRightChoice && t.correctChoice !== ''} onChange={() => updateMainWordChoice(idx, t.forcedLeftChoice || '', t.forcedRightChoice || '', 'B')} />
            </div>
          ))}
        </div>
      )}

      {/* BUILDER 3: PICTURE */}
      {selectedMode === 'Picture' && (
        <div>
          <h3>Template 3: Picture Association</h3>
          <div style={{ padding: '15px', border: '1px dashed gray', backgroundColor: '#fff', marginBottom: '20px' }}>
             <input type="file" multiple accept="image/*, application/pdf" onChange={handlePictureUpload} />
          </div>
          <div>
            {trials.map((t, idx) => (
              <div key={t.id} style={{ marginBottom: '10px', padding: '10px', border: '1px solid #ccc', display: 'flex', gap: '15px', alignItems: 'center' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                  <button onClick={() => moveTrial(idx, 'up')} disabled={idx === 0} style={miniBtn}>↑</button>
                  <button onClick={() => deleteTrial(idx)} style={{ ...miniBtn, backgroundColor: 'red', color: 'white' }}>X</button>
                  <button onClick={() => moveTrial(idx, 'down')} disabled={idx === trials.length - 1} style={miniBtn}>↓</button>
                </div>
                <strong>#{idx + 1}</strong>
                <img src={t.imageUrl} alt="preview" style={{ height: '50px', width: '50px', objectFit: 'contain', border: '1px solid #eee' }} />
                <input placeholder="Correct Answer" value={t.correctChoice} onChange={e => updatePictureRow(idx, 'correctChoice', e.target.value)} style={{ border: '2px solid green' }} />
                <input placeholder="Incorrect Answer" value={t.incorrectChoice} onChange={e => updatePictureRow(idx, 'incorrectChoice', e.target.value)} style={{ border: '2px solid red' }} />
              </div>
            ))}
          </div>
        </div>
      )}

      {trials.length > 0 && (
        <button onClick={handleValidateAndSave} style={{ marginTop: '30px', padding: '15px', backgroundColor: 'green', color: 'white', fontSize: '18px', width: '100%', cursor: 'pointer', fontWeight: 'bold' }}>
          {initialData ? 'Update Test in Bank 💾' : 'Save to Test Bank 💾'}
        </button>
      )}
    </div>
  );
}

const btnStyle = { padding: '10px 20px', cursor: 'pointer', backgroundColor: '#e0e0e0', border: 'none', borderRadius: '4px', fontWeight: 'bold' };
const miniBtn = { padding: '2px 5px', cursor: 'pointer', fontSize: '10px', border: '1px solid #999', borderRadius: '3px' };

// =========================================================================
// LAYER 3: UNIFIED PATIENT RUNNER ENGINE
// =========================================================================

interface RunnerProps {
  configuredTrials: BinaryTrial[];
  testMode: BinaryTestType;
  forcedMode?: string;
  onComplete?: (data: any) => void;
}
export function BinaryChoiceRunner({ configuredTrials, testMode, forcedMode, onComplete }: RunnerProps) {
  const [patientSelections, setPatientSelections] = useState<Record<string, string>>({});
  const [liveFlag, setLiveFlag] = useState(false);
  const [liveComment, setLiveComment] = useState('');
  
  // <-- ADD THIS STOPWATCH
  const [testStartTime] = useState(() => Date.now());

  const renderList = useMemo(() => {
    return configuredTrials.map(trial => {
      if (trial.testType === 'SimplePairs') {
        return { ...trial, leftOpt: trial.forcedLeftChoice!, rightOpt: trial.forcedRightChoice! };
      }
      const isCorrectLeft = Math.random() > 0.5;
      return {
        ...trial,
        leftOpt: isCorrectLeft ? trial.correctChoice : trial.incorrectChoice,
        rightOpt: isCorrectLeft ? trial.incorrectChoice : trial.correctChoice
      };
    });
  }, [configuredTrials]);

  const handlePatientClick = (trialId: string, wordSelected: string) => {
    setPatientSelections(prev => ({
      ...prev,
      [trialId]: prev[trialId] === wordSelected ? '' : wordSelected 
    }));
  };

  const handleFinishAndDownload = () => {
    const results: BinarySessionOutput[] = renderList.map(trial => {
      const selection = patientSelections[trial.id] || null;
      return {
        trialID: trial.id,
        testType: trial.testType,
        patientSelected: selection,
        isCorrect: selection === trial.correctChoice
      };
    });
    // <-- CALCULATE TIME AND ADD TO REPORT
    const totalTimeSpentMs = Date.now() - testStartTime;
    const finalReport: FinalReport = { testMode, isFlagged: liveFlag, clinicianComment: liveComment, totalTimeSpentMs, results };
    // Bypassing manual download if controlled by Sequence Runner
    if (onComplete) {
      onComplete(finalReport);
      return;
    }

    const dataString = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(finalReport, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute("href", dataString);
    downloadAnchor.setAttribute("download", `binary_choice_${testMode}_${Date.now()}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  return (
    <div style={{ padding: '20px', border: '2px solid darkblue', marginTop: '20px', fontFamily: 'sans-serif' }}>
      <h2>Layer 3: Patient Testing Engine ({testMode})</h2>
      
      <div style={{ backgroundColor: '#f9f9f9', padding: '40px', borderRadius: '8px', maxHeight: '60vh', overflowY: 'auto', border: '1px solid #ccc' }}>
        {renderList.map((trial, idx) => {
          const selectedWord = patientSelections[trial.id];
          return (
            <div key={trial.id} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: '60px', paddingBottom: '30px', borderBottom: '1px solid #ddd' }}>
              {trial.testType === 'MainWord' && <div style={{ fontSize: '32px', fontWeight: 'bold', color: 'purple', marginBottom: '30px', textAlign: 'center' }}>{trial.mainWord}</div>}
              {trial.testType === 'Picture' && <img src={trial.imageUrl} alt="Target" style={{ height: '200px', marginBottom: '30px', border: '1px solid gray' }} />}
              {trial.testType === 'SimplePairs' && <div style={{ marginBottom: '15px', color: '#666', fontSize: '14px' }}>Question {idx + 1}</div>}

              <div style={{ display: 'flex', gap: '80px', width: '100%', justifyContent: 'center' }}>
                <div onClick={() => handlePatientClick(trial.id, trial.leftOpt)} style={{ fontSize: '28px', padding: '15px 40px', cursor: 'pointer', borderRadius: '8px', userSelect: 'none', backgroundColor: selectedWord === trial.leftOpt ? '#d1e7dd' : 'white', border: selectedWord === trial.leftOpt ? '3px solid #0f5132' : '2px solid #ccc' }}>
                  {trial.leftOpt}
                </div>
                <div onClick={() => handlePatientClick(trial.id, trial.rightOpt)} style={{ fontSize: '28px', padding: '15px 40px', cursor: 'pointer', borderRadius: '8px', userSelect: 'none', backgroundColor: selectedWord === trial.rightOpt ? '#d1e7dd' : 'white', border: selectedWord === trial.rightOpt ? '3px solid #0f5132' : '2px solid #ccc' }}>
                  {trial.rightOpt}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div style={{ marginTop: '20px', padding: '15px', backgroundColor: '#eef8ff' }}>
        <button onClick={handleFinishAndDownload} style={{ width: '100%', padding: '15px', backgroundColor: 'darkblue', color: 'white', fontSize: '18px', fontWeight: 'bold' }}>
          {onComplete ? 'Submit & Continue Sequence →' : 'Finish Test & Download Diagnostics'}
        </button>
      </div>
    </div>
  );
}