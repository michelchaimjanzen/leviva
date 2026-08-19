import { useState, useEffect, useRef, type ChangeEvent } from 'react';
import { saveTestConfig } from '../../utils/testService'; 

// =========================================================================
// STEP A1: DATA STRUCTURES
// =========================================================================

type UserRole = 'patient' | 'clinician' | 'synchronized';

interface EvaluationAudio {
  id: string;
  audioUrl: string; 
}

interface PatientResponse {
  audioID: string;
  score: 'Correct!' | 'Incorrect';
  isFlagged: boolean;
  clinicianComment: string;
  writtenResponseText: string; 
}

// UPGRADED: Added initialData and metadata payload
interface WorkspaceProps {
  initialData?: any;
  onSave: (configData: EvaluationAudio[], meta: { title: string, description: string }) => void;
}

// =========================================================================
// LAYER 1: GLOBAL CONFIGURATION & ROUTING
// =========================================================================

export function SessionRoleRouter() {
  const [currentRole, setCurrentRole] = useState<UserRole | null>(null);
    
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const modeParam = urlParams.get('mode'); 

    if (modeParam === 'patient' || modeParam === 'clinician' || modeParam === 'synchronized') {
      setCurrentRole(modeParam); 
    } else {
      console.error("Invalid or missing session mode parameter!");
      setCurrentRole('synchronized'); 
    }
  }, []);
  
  if (currentRole === 'patient') return <p>Loading Patient Interface view...</p>;
  if (currentRole === 'clinician') return <p>Loading Clinician Interface panel...</p>;
  if (currentRole === 'synchronized') return <p>Loading Synchronized Context dual-screen layout...</p>;
  return <p>Checking session authorization status...</p>;
}


// =========================================================================
// LAYER 2: CLINICIAN TEMPLATE CREATOR (ADMIN SIDE)
// =========================================================================

export function WritingRepetitionWorkspace({ initialData, onSave }: WorkspaceProps) {
  // UPGRADED: State initialization for Edit Mode & Metadata
  const [testTitle, setTestTitle] = useState(initialData?.title || '');
  const [testDescription, setTestDescription] = useState(initialData?.description || '');
  const [auditoryTracks, setAuditoryTracks] = useState<EvaluationAudio[]>(initialData?.configData || []);

  const handleFolderUpload = (event: ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files) return;

    const uploadedAudio: EvaluationAudio[] = Array.from(files).map((file) => ({
      id: file.name,
      audioUrl: URL.createObjectURL(file) 
    }));

    setAuditoryTracks(uploadedAudio);
  };

  // UPGRADED: Pre-Save Validation
  const handleValidateAndSave = () => {
    if (!testTitle.trim()) { alert("Please provide a Test Title."); return; }
    if (auditoryTracks.length === 0) { alert("Please upload at least one audio track."); return; }
    onSave(auditoryTracks, { title: testTitle, description: testDescription });
  };

  return (
    <div style={{ padding: '20px', fontFamily: 'sans-serif' }}>
      <h2>Layer 2: Writing Repetition Template Creator</h2>
      
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

      <input type="file" multiple accept="audio/*" onChange={handleFolderUpload} />
      <p>Total Stimulus Audio Tracks Loaded: {auditoryTracks.length}</p>

      {auditoryTracks.length > 0 && (
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


// =========================================================================
// LAYER 3: WRITING REPETITION RUNNER ENGINE
// =========================================================================
interface WritingRunnerProps {
  configuredAudioTracks: EvaluationAudio[];
}

export function WritingRepetitionRunner({ configuredAudioTracks }: WritingRunnerProps) {
  const [currentIndex, setCurrentIndex] = useState<number>(0);
  const [patientAnswers, setPatientAnswers] = useState<PatientResponse[]>([]);

  // System flow toggles
  const [isStimulusPlaying, setIsStimulusPlaying] = useState<boolean>(false);
  
  // Patient response text field state
  const [patientInputText, setPatientInputText] = useState<string>('');

  // Clinician live scoring states
  const [liveScore, setLiveScore] = useState<'Correct!' | 'Incorrect'>('Correct!');
  const [liveComment, setLiveComment] = useState<string>('');
  const [liveFlag, setLiveFlag] = useState<boolean>(false);

  const stimulusAudioRef = useRef<HTMLAudioElement | null>(null);

  // Clear text entry workspace field clean every time a new slide track loads
  useEffect(() => {
    setPatientInputText('');
    return () => {
      if (stimulusAudioRef.current) {
        stimulusAudioRef.current.pause();
      }
    };
  }, [currentIndex, configuredAudioTracks]);

  const handlePlayStimulus = () => {
    if (stimulusAudioRef.current) {
      stimulusAudioRef.current.pause();
    }
    
    setIsStimulusPlaying(true);
    const activeTrack = configuredAudioTracks[currentIndex];
    const audio = new Audio(activeTrack.audioUrl);
    stimulusAudioRef.current = audio;

    audio.play();
    audio.onended = () => {
      setIsStimulusPlaying(false);
    };
  };

  const handlePatientTyping = (event: ChangeEvent<HTMLInputElement>) => {
    setPatientInputText(event.target.value);
  };

  const handleAdvanceNextSlide = () => {
    const activeTrack = configuredAudioTracks[currentIndex];

    // Packages our clinical data along with the crisp keyboard input text string
    const finalResponsePayload: PatientResponse = {
      audioID: activeTrack.id,
      score: liveScore,
      isFlagged: liveFlag,
      clinicianComment: liveComment,
      writtenResponseText: patientInputText.trim() // Trims extra stray whitespaces
    };

    const updatedAnswers = [...patientAnswers, finalResponsePayload];
    setPatientAnswers(updatedAnswers);

    // Reset loop views
    setLiveComment('');
    setLiveFlag(false);
    setLiveScore('Correct!');

    if (currentIndex < configuredAudioTracks.length - 1) {
      setCurrentIndex(prev => prev + 1);
    } else {
      alert("Writing Repetition Test Complete! Generating data file output pack...");
      triggerRawErrorOutputFileDownload(updatedAnswers);
    }
  };

  // =========================================================================
  // LAYER 4: DATA & ACCUMULATION SERVICES
  // =========================================================================
  const triggerRawErrorOutputFileDownload = (finalPayload: PatientResponse[]) => {
    const dataString = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(finalPayload, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute("href", dataString);
    downloadAnchor.setAttribute("download", `writing_keyboard_repetition_output_${Date.now()}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  if (configuredAudioTracks.length === 0) return <p>Waiting for loaded auditory tracks...</p>;
  const activeTrack = configuredAudioTracks[currentIndex];

  // Logic condition: Next button becomes pressable only after patient inputs at least 1 character
  const hasAnswered = patientInputText.trim().length > 0;

  return (
    <div style={{ padding: '20px', fontFamily: 'sans-serif', border: '2px solid darkgreen', marginTop: '20px' }}>
      <h2>Layer 3: Writing Repetition Runner Engine (Audio-to-Keyboard)</h2>
      <p>Audio Track Progress: {currentIndex + 1} / {configuredAudioTracks.length}</p>

      {/* --- PATIENT INTERFACE PANEL CONTROLS --- */}
      <div style={{ margin: '20px 0', padding: '20px', backgroundColor: '#e8f5e9', borderRadius: '8px', textAlign: 'center' }}>
        <p><strong>Track Target Stimulus Reference ID:</strong> {activeTrack.id}</p>
        
        <button 
          onClick={handlePlayStimulus} 
          disabled={isStimulusPlaying}
          style={{ padding: '10px 20px', backgroundColor: '#2e7d32', color: 'white', border: 'none', borderRadius: '4px', fontWeight: 'bold', cursor: 'pointer', marginBottom: '15px' }}
        >
          {isStimulusPlaying ? '🔊 Playing Audio Stimulus...' : '▶️ Play Audio Word'}
        </button>

        <p style={{ margin: '5px 0 12px 0', fontSize: '15px', color: '#333' }}>
          Type the word or sentence you just heard using your keyboard:
        </p>
        
        {/* SIMPLE KEYBOARD INPUT ZONE CHANNELS INPUT TO STATE */}
        <input
          type="text"
          value={patientInputText}
          onChange={handlePatientTyping}
          placeholder="Type your response here..."
          autoFocus
          style={{ 
            width: '100%', 
            maxWidth: '400px', 
            padding: '12px 16px', 
            fontSize: '16px', 
            border: '2px solid #2e7d32', 
            borderRadius: '4px',
            boxSizing: 'border-box',
            textAlign: 'center'
          }}
        />
      </div>

      {/* --- CLINICIAN LIVE OBSERVATION PANEL --- */}
      <div style={{ padding: '15px', backgroundColor: '#f1f3f5', borderRadius: '5px', border: '1px solid #dee2e6' }}>
        <h3>🩺 Clinician Live Observation Dashboard</h3>

        <div style={{ margin: '10px 0' }}>
          <button onClick={() => setLiveScore('Correct!')} style={{ marginRight: '10px', backgroundColor: liveScore === 'Correct!' ? 'green' : '#ccc', color: 'white', padding: '8px 16px', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>
            Score: Correct
          </button>
          <button onClick={() => setLiveScore('Incorrect')} style={{ backgroundColor: liveScore === 'Incorrect' ? 'red' : '#ccc', color: 'white', padding: '8px 16px', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>
            Score: Error
          </button>
        </div>

        <label style={{ display: 'block', margin: '12px 0', cursor: 'pointer' }}>
          <input type="checkbox" checked={liveFlag} onChange={(e) => setLiveFlag(e.target.checked)} />
          <span style={{ marginLeft: '6px', color: liveFlag ? 'red' : 'black', fontWeight: liveFlag ? 'bold' : 'normal' }}>
            Flag this writing attempt error profile (e.g., specific letter omissions, phoneme confusion)
          </span>
        </label>

        <textarea 
          value={liveComment} 
          onChange={(e) => setLiveComment(e.target.value)}
          placeholder="Enter qualitative structural keyboard mistake or spelling notes here..."
          style={{ width: '100%', height: '60px', boxSizing: 'border-box', padding: '6px', resize: 'none' }}
        />
      </div>

      <button 
        onClick={handleAdvanceNextSlide} 
        disabled={!hasAnswered} 
        style={{ 
          marginTop: '25px', 
          padding: '12px 24px', 
          backgroundColor: 'darkgreen', 
          color: 'white', 
          fontWeight: 'bold', 
          border: 'none', 
          borderRadius: '4px', 
          cursor: hasAnswered ? 'pointer' : 'not-allowed' 
        }}
      >
        Grade & Next Writing Slide →
      </button>
    </div>
  );
}