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
  patientAudioBlob: Blob | null;   
  patientAudioUrl: string | null;  
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

export function AuditoryRepetitionWorkspace({ initialData, onSave }: WorkspaceProps) {
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
      <h2>Layer 2: Auditory Repetition Template Creator</h2>
      
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
// LAYER 3: AUDITORY REPETITION RUNNER ENGINE
// =========================================================================
interface AuditoryRunnerProps {
  configuredAudioTracks: EvaluationAudio[];
}

export function AuditoryRepetitionRunner({ configuredAudioTracks }: AuditoryRunnerProps) {
  const [currentIndex, setCurrentIndex] = useState<number>(0);
  const [patientAnswers, setPatientAnswers] = useState<PatientResponse[]>([]);

  const [isStimulusPlaying, setIsStimulusPlaying] = useState<boolean>(false);
  const [isRecording, setIsRecording] = useState<boolean>(false);

  const [liveScore, setLiveScore] = useState<'Correct!' | 'Incorrect'>('Correct!');
  const [liveComment, setLiveComment] = useState<string>('');
  const [liveFlag, setLiveFlag] = useState<boolean>(false);

  const stimulusAudioRef = useRef<HTMLAudioElement | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    return () => {
      stopPlaybackAndRecording();
    };
  }, [currentIndex]);

  const stopPlaybackAndRecording = () => {
    if (stimulusAudioRef.current) {
      stimulusAudioRef.current.pause();
      stimulusAudioRef.current.currentTime = 0;
    }
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
    }
    setIsRecording(false);
    setIsStimulusPlaying(false);
  };

  const handlePlayStimulus = () => {
    stopPlaybackAndRecording();
    setIsStimulusPlaying(true);

    const activeTrack = configuredAudioTracks[currentIndex];
    const audio = new Audio(activeTrack.audioUrl);
    stimulusAudioRef.current = audio;

    audio.play();
    audio.onended = () => {
      setIsStimulusPlaying(false);
      startRecordingPatientEcho();
    };
  };

  const handleManualRetryReset = () => {
    stopPlaybackAndRecording();  
    audioChunksRef.current = [];
  };

  const startRecordingPatientEcho = async () => {
    try {
      audioChunksRef.current = [];
      setIsRecording(true);

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };
      mediaRecorder.start();
    } catch (err) {
      console.error(err);
      setIsRecording(false);
      alert("Microphone connection failure.");
    }
  };

  const handleAdvanceNextSlide = () => {
    if (!mediaRecorderRef.current || mediaRecorderRef.current.state === "inactive") {
      proceedToNextStep(null, null);
      return;
    }

    mediaRecorderRef.current.onstop = () => {
      const finalAudioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
      const playableAudioUrl = URL.createObjectURL(finalAudioBlob);
      proceedToNextStep(finalAudioBlob, playableAudioUrl);
    };

    mediaRecorderRef.current.stop();
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
    }
  };

  const proceedToNextStep = (patientBlob: Blob | null, patientUrl: string | null) => {
    const activeTrack = configuredAudioTracks[currentIndex];
    const finalResponsePayload: PatientResponse = {
      audioID: activeTrack.id,
      score: liveScore,
      isFlagged: liveFlag,
      clinicianComment: liveComment,
      patientAudioBlob: patientBlob,
      patientAudioUrl: patientUrl
    };

    const updatedAnswers = [...patientAnswers, finalResponsePayload];
    setPatientAnswers(updatedAnswers);
    
    setLiveComment('');
    setLiveFlag(false);
    setLiveScore('Correct!');
    setIsRecording(false);
    
    if (currentIndex < configuredAudioTracks.length - 1) {
      setCurrentIndex(prev => prev + 1);
    } else {
      alert("Auditory Repetition Test Complete!");
      triggerRawErrorOutputFileDownload(updatedAnswers);
    }
  };
  
  const triggerRawErrorOutputFileDownload = (finalPayload: PatientResponse[]) => {
    const exportReadyPayload = finalPayload.map(item => ({
      audioID: item.audioID,
      score: item.score,
      isFlagged: item.isFlagged,
      clinicianComment: item.clinicianComment,
      patientAudioPlaybackLink: item.patientAudioUrl 
    }));

    const dataString = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(exportReadyPayload, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute("href", dataString);
    downloadAnchor.setAttribute("download", `auditory_repetition_output_${Date.now()}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  if (configuredAudioTracks.length === 0) return <p>Waiting for loaded auditory tracks...</p>;
  const activeTrack = configuredAudioTracks[currentIndex];

  return (
    <div style={{ padding: '20px', fontFamily: 'sans-serif', border: '2px solid darkblue', marginTop: '20px' }}>
      <h2>Layer 3: Auditory Repetition Runner (Audio-to-Audio)</h2>
      <p>Audio Track Progress: {currentIndex + 1} / {configuredAudioTracks.length}</p>

      <div style={{ margin: '30px 0', textAlign: 'center', padding: '20px', backgroundColor: '#e2f0fe', borderRadius: '8px' }}>
        <p style={{ fontWeight: 'bold' }}>Track Target Reference ID: {activeTrack.id}</p>
        <button 
          onClick={handlePlayStimulus} 
          disabled={isStimulusPlaying || isRecording}
          style={{ padding: '15px 30px', fontSize: '16px', backgroundColor: '#007bff', color: 'white', fontWeight: 'bold', border: 'none', borderRadius: '5px', cursor: 'pointer' }}
        >
          {isStimulusPlaying ? '🔊 Playing Audio Stimulus...' : '▶️ Play Audio Stimulus'}
        </button>
        {isRecording && <p style={{ color: 'red', fontWeight: 'bold', marginTop: '15px' }}>🔴 Recording...</p>}
      </div>

      <div style={{ marginBottom: '20px', padding: '10px', backgroundColor: '#fff3cd', border: '1px solid #ffeeba', borderRadius: '4px' }}>
        <button onClick={handleManualRetryReset} style={{ padding: '6px 12px', cursor: 'pointer', backgroundColor: '#ffc107', border: 'none', borderRadius: '4px', fontWeight: 'bold' }}>
          🔄 Retry Stimulus
        </button>
      </div>

      <div style={{ padding: '15px', backgroundColor: '#f1f3f5', borderRadius: '5px' }}>
        <h3>Clinician Live Scoring</h3>
        <div style={{ margin: '10px 0' }}>
          <button onClick={() => setLiveScore('Correct!')} style={{ marginRight: '10px', backgroundColor: liveScore === 'Correct!' ? 'green' : '#ccc', color: 'white', padding: '8px 16px', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>Correct</button>
          <button onClick={() => setLiveScore('Incorrect')} style={{ backgroundColor: liveScore === 'Incorrect' ? 'red' : '#ccc', color: 'white', padding: '8px 16px', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>Error</button>
        </div>
        <label><input type="checkbox" checked={liveFlag} onChange={(e) => setLiveFlag(e.target.checked)} /> Flag error</label>
        <textarea value={liveComment} onChange={(e) => setLiveComment(e.target.value)} style={{ width: '100%', height: '60px', marginTop: '10px' }}/>
      </div>

      <button onClick={handleAdvanceNextSlide} style={{ marginTop: '25px', padding: '12px 24px', backgroundColor: 'darkblue', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>
        Next Audio Slide →
      </button>
    </div>
  );
}