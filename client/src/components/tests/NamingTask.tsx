import React, { useState, useRef, useEffect, type ChangeEvent } from 'react';
import { extractImagesFromPDF } from '../../utils/pdfExtractor';
import { io, Socket } from 'socket.io-client';
import { saveTestConfig } from '../../utils/testService'; 

// =========================================================================
// TYPE DEFINITIONS
// =========================================================================

export interface NamingSlide {
  id: string;
  type: 'info' | 'graded';
  imageUrl: string;
  instructionText?: string;
  targetWord?: string; 
}

export type NamingGrade = 'correct-immediate' | 'correct-hesitation' | 'incorrect' | null;

export interface PatientNamingResponse {
  slideID: string;
  expectedWord: string;
  grade: NamingGrade;
  clinicianComment: string;
  audioBlob: Blob | null;
  audioUrl: string | null;
}

interface WorkspaceProps {
  initialData?: any;
  onSave: (configData: NamingSlide[], meta: { title: string, description: string }) => void;
}

// =========================================================================
// LAYER 2: WORKSPACE / TARGET CALIBRATION
// =========================================================================
export function NamingTaskWorkspace({ initialData, onSave }: WorkspaceProps) {
  const [testTitle, setTestTitle] = useState(initialData?.title || '');
  const [testDescription, setTestDescription] = useState(initialData?.description || '');
  const [slides, setSlides] = useState<NamingSlide[]>(initialData?.configData || []);
  
  const [dragItemIndex, setDragItemIndex] = useState<number | null>(null);
  const [bulkWords, setBulkWords] = useState('');

  // --- FILE UPLOAD ---
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    const files = Array.from(e.target.files);
    let newSlides: NamingSlide[] = [];

    for (const file of files) {
      if (file.type === 'application/pdf') {
        const images = await extractImagesFromPDF(file);
        const pdfSlides: NamingSlide[] = images.map((imgData, index) => ({
          id: `slide_${Date.now()}_${index}`, type: 'graded', imageUrl: imgData, targetWord: ''
        }));
        newSlides = [...newSlides, ...pdfSlides];
      } else {
        newSlides.push({
          id: `slide_${Date.now()}_${file.name}`, type: 'graded', imageUrl: URL.createObjectURL(file), targetWord: ''
        });
      }
    }
    setSlides(prev => [...prev, ...newSlides]);
  };

  const addBlankInfoPage = () => {
    setSlides(prev => [...prev, { id: `info_${Date.now()}`, type: 'info', imageUrl: '', instructionText: '' }]);
  };

  // --- SLIDE MANAGEMENT ---
  const deleteSlide = (idx: number) => {
    const updated = [...slides];
    updated.splice(idx, 1);
    setSlides(updated);
  };

  const updateTargetWord = (idx: number, word: string) => {
    const updated = [...slides];
    updated[idx].targetWord = word;
    setSlides(updated);
  };

  const updateInfoText = (idx: number, text: string) => {
    const updated = [...slides];
    updated[idx].instructionText = text;
    setSlides(updated);
  };

  // --- BULK ASSIGN TARGET WORDS ---
  const handleBulkAssign = () => {
    const words = bulkWords.split(/\r?\n/).map(w => w.trim()).filter(w => w.length > 0);
    if (words.length === 0) return;

    let wordIdx = 0;
    const updated = slides.map(slide => {
      if (slide.type === 'graded' && wordIdx < words.length) {
        const newSlide = { ...slide, targetWord: words[wordIdx] };
        wordIdx++;
        return newSlide;
      }
      return slide;
    });
    setSlides(updated);
    setBulkWords(''); // Clear after assign
    alert(`Successfully assigned ${wordIdx} target words to graded slides.`);
  };

  // --- DRAG AND DROP ---
  const handleDragStart = (idx: number) => setDragItemIndex(idx);
  const handleDragEnter = (idx: number) => {
    if (dragItemIndex === null || dragItemIndex === idx) return;
    const updated = [...slides];
    const draggedItem = updated[dragItemIndex];
    updated.splice(dragItemIndex, 1);
    updated.splice(idx, 0, draggedItem);
    setDragItemIndex(idx);
    setSlides(updated);
  };
  const handleDragEnd = () => setDragItemIndex(null);

  const handleValidateAndSave = () => {
    if (!testTitle.trim()) { alert("Please provide a Test Title."); return; }
    if (slides.length === 0) { alert("Please add at least one slide."); return; }
    onSave(slides, { title: testTitle, description: testDescription });
  };

  return (
    <div style={{ padding: '20px', border: '1px solid gray', marginBottom: '20px', fontFamily: 'sans-serif' }}>
      <h2>Layer 2: Naming Task Calibration (Slide-by-Slide)</h2>
      
      <div style={{ backgroundColor: '#f9f9f9', padding: '15px', border: '1px solid #ccc', marginBottom: '20px', borderRadius: '4px' }}>
        <input type="text" value={testTitle} onChange={(e) => setTestTitle(e.target.value)} placeholder="Enter Test Title (e.g., TILTAN16 Naming)" style={{ width: '100%', padding: '10px', fontSize: '18px', fontWeight: 'bold', marginBottom: '10px', boxSizing: 'border-box' }} />
        <input type="text" value={testDescription} onChange={(e) => setTestDescription(e.target.value)} placeholder="Enter description..." style={{ width: '100%', padding: '8px', fontSize: '14px', boxSizing: 'border-box' }} />
      </div>

      <div style={{ display: 'flex', gap: '15px', marginBottom: '20px' }}>
        <div style={{ flex: 1, padding: '15px', border: '1px dashed gray', backgroundColor: '#fff' }}>
          <strong>1. Upload Slides</strong><br/><br/>
          <input type="file" multiple accept="image/*, application/pdf" onChange={handleFileUpload} style={{ marginBottom: '10px' }}/>
          <button onClick={addBlankInfoPage} style={{ width: '100%', padding: '8px', backgroundColor: '#eef8ff', border: '1px solid darkblue', cursor: 'pointer' }}>+ Add Text Info Slide</button>
        </div>

        <div style={{ flex: 1, padding: '15px', border: '1px dashed gray', backgroundColor: '#fff' }}>
          <strong>2. Auto-Assign Target Words</strong><br/><br/>
          <textarea 
            value={bulkWords} onChange={(e) => setBulkWords(e.target.value)}
            placeholder="Paste column of words here..."
            style={{ width: '100%', height: '60px', padding: '5px', boxSizing: 'border-box', marginBottom: '5px' }}
          />
          <button onClick={handleBulkAssign} style={{ width: '100%', padding: '8px', backgroundColor: 'purple', color: 'white', border: 'none', cursor: 'pointer', fontWeight: 'bold' }}>Assign in Order →</button>
        </div>
      </div>

      {slides.length > 0 && (
        <div style={{ backgroundColor: '#fff', padding: '15px', border: '1px solid #ddd' }}>
          <h4>Slide Sequence (Drag to Reorder)</h4>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '15px' }}>
            {slides.map((s, idx) => (
              <div 
                key={s.id} draggable onDragStart={() => handleDragStart(idx)} onDragEnter={() => handleDragEnter(idx)} onDragEnd={handleDragEnd} onDragOver={(e) => e.preventDefault()}
                style={{ width: '180px', border: '1px solid #ccc', padding: '10px', textAlign: 'center', backgroundColor: '#fafafa', opacity: dragItemIndex === idx ? 0.4 : 1, cursor: 'grab', display: 'flex', flexDirection: 'column' }}
              >
                <div style={{ fontSize: '12px', fontWeight: 'bold', marginBottom: '5px', color: '#555' }}>Slide {idx + 1}</div>
                
                {s.type === 'info' ? (
                  <div style={{ flex: 1 }}>
                    <div style={{ height: '80px', backgroundColor: '#fff9e6', border: '1px dashed orange', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '10px', fontSize: '12px' }}>Info Slide</div>
                    <textarea value={s.instructionText || ''} onChange={(e) => updateInfoText(idx, e.target.value)} placeholder="Type instructions..." style={{ width: '100%', height: '40px', fontSize: '11px', boxSizing: 'border-box', resize: 'none' }} />
                  </div>
                ) : (
                  <div style={{ flex: 1 }}>
                    <img src={s.imageUrl} alt="thumb" style={{ height: '80px', objectFit: 'contain', marginBottom: '10px', pointerEvents: 'none', width: '100%' }} />
                    <input value={s.targetWord || ''} onChange={(e) => updateTargetWord(idx, e.target.value)} placeholder="Target word..." style={{ width: '100%', padding: '4px', boxSizing: 'border-box', textAlign: 'center', fontWeight: 'bold' }} />
                  </div>
                )}
                
                <button onClick={() => deleteSlide(idx)} style={{ marginTop: '10px', color: 'white', backgroundColor: 'red', border: 'none', borderRadius: '4px', cursor: 'pointer', padding: '4px' }}>Delete</button>
              </div>
            ))}
          </div>
        </div>
      )}

      {slides.length > 0 && (
        <button onClick={handleValidateAndSave} style={{ width: '100%', padding: '15px', marginTop: '20px', backgroundColor: 'green', color: 'white', fontSize: '18px', fontWeight: 'bold', cursor: 'pointer' }}>
          {initialData ? 'Update Test in Bank 💾' : 'Save to Test Bank 💾'}
        </button>
      )}
    </div>
  );
}

// =========================================================================
// LAYER 3: TEST RUNNER ENGINE
// =========================================================================
interface NamingRunnerProps {
  configuredSlides: NamingSlide[];
}

export function NamingTaskRunner({ configuredSlides }: NamingRunnerProps) {
  const [sessionMode, setSessionMode] = useState<'selection' | 'patient-solo' | 'clinician-solo' | 'synchronized'>('selection');
  const [socket, setSocket] = useState<Socket | null>(null);
  const [syncSetup, setSyncSetup] = useState({ ip: 'localhost:3001', roomId: 'room-123' });
  const [isSyncConnected, setIsSyncConnected] = useState(false);
  const [syncRole, setSyncRole] = useState<'clinician' | 'patient'>('clinician');

  const [currentIndex, setCurrentIndex] = useState(0);
  const [patientAnswers, setPatientAnswers] = useState<PatientNamingResponse[]>([]);
  const [isTestComplete, setIsTestComplete] = useState(false);

  // Live Clinician Inputs
  const [liveGrade, setLiveGrade] = useState<NamingGrade>(null);
  const [liveComment, setLiveComment] = useState('');

  // Audio Recording State
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const [isRecording, setIsRecording] = useState(false);

  const activeSlide = configuredSlides[currentIndex];

  // --- SYNC LISTENERS ---
  useEffect(() => {
    if (!socket) return;
    
    socket.on('sync-naming-slide-change', async (data: { newIndex: number, gradeData: any }) => {
      if (syncRole === 'patient') {
        // Patient receives advance command -> save previous slide's recording + the clinician's grade, then move
        await saveCurrentSlideAndAdvance(data.newIndex, data.gradeData);
      } else {
        setCurrentIndex(data.newIndex);
        setLiveGrade(null);
        setLiveComment('');
      }
    });

    socket.on('sync-naming-grade', (data: { grade: NamingGrade, comment: string }) => {
      if (syncRole === 'patient') {
        setLiveGrade(data.grade);
        setLiveComment(data.comment);
      }
    });

    return () => {
      socket.off('sync-naming-slide-change');
      socket.off('sync-naming-grade');
    };
  }, [socket, syncRole, currentIndex, liveGrade, liveComment]);

  // --- AUDIO LOGIC (PER SLIDE) ---
  useEffect(() => {
    // Triggers every time the slide changes. Start recording if graded.
    const startPerSlideRecording = async () => {
      if (!activeSlide || activeSlide.type === 'info') return;
      if (sessionMode === 'selection' || (sessionMode === 'synchronized' && syncRole === 'clinician')) return; // Clinician sync doesn't record

      try {
        audioChunksRef.current = [];
        if (!streamRef.current) {
          streamRef.current = await navigator.mediaDevices.getUserMedia({ audio: true });
        }
        const mediaRecorder = new MediaRecorder(streamRef.current);
        mediaRecorderRef.current = mediaRecorder;

        mediaRecorder.ondataavailable = (e) => { if (e.data.size > 0) audioChunksRef.current.push(e.data); };
        mediaRecorder.start();
        setIsRecording(true);
      } catch (err) {
        console.error("Mic access denied.", err);
      }
    };

    startPerSlideRecording();

    return () => {
      // Cleanup is handled in saveCurrentSlideAndAdvance
    };
  }, [currentIndex, activeSlide, sessionMode, syncRole]);

  const stopRecordingAsync = (): Promise<Blob | null> => {
    return new Promise((resolve) => {
      if (!mediaRecorderRef.current || mediaRecorderRef.current.state === "inactive") {
        resolve(null);
        return;
      }
      mediaRecorderRef.current.onstop = () => {
        const blob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        resolve(blob);
      };
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    });
  };

  // --- CORE ENGINE PIPELINE ---
  const saveCurrentSlideAndAdvance = async (nextIndex: number, overrideGradeData?: any) => {
    const finalGrade = overrideGradeData?.grade !== undefined ? overrideGradeData.grade : liveGrade;
    const finalComment = overrideGradeData?.comment !== undefined ? overrideGradeData.comment : liveComment;

    let blob = null;
    let url = null;
    
    // Only patient/solo actually has the recorder running
    if (isRecording) {
      blob = await stopRecordingAsync();
      if (blob) url = URL.createObjectURL(blob);
    }

    if (activeSlide.type === 'graded') {
      const answer: PatientNamingResponse = {
        slideID: activeSlide.id,
        expectedWord: activeSlide.targetWord || '',
        grade: finalGrade,
        clinicianComment: finalComment,
        audioBlob: blob,
        audioUrl: url
      };
      setPatientAnswers(prev => [...prev, answer]);
    }

    setLiveGrade(null);
    setLiveComment('');

    if (nextIndex < configuredSlides.length) {
      setCurrentIndex(nextIndex);
    } else {
      // Test complete cleanup
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(t => t.stop());
      }
      setIsTestComplete(true);
    }
  };

  const handleNextSlideTrigger = async () => {
    const nextIndex = currentIndex + 1;
    const gradeData = { grade: liveGrade, comment: liveComment };

    if (sessionMode === 'synchronized' && syncRole === 'clinician') {
      // Tell patient device to save and advance
      socket?.emit('naming-slide-change', { sessionId: syncSetup.roomId, newIndex: nextIndex, gradeData });
      setCurrentIndex(nextIndex);
      setLiveGrade(null);
      setLiveComment('');
    } else {
      // Solo modes or patient override
      await saveCurrentSlideAndAdvance(nextIndex, gradeData);
    }
  };

  const handleLiveGradeUpdate = (grade: NamingGrade) => {
    setLiveGrade(grade);
    if (sessionMode === 'synchronized' && syncRole === 'clinician') {
      socket?.emit('naming-grade-update', { sessionId: syncSetup.roomId, grade, comment: liveComment });
    }
  };

  const handleConnectSync = () => {
    const newSocket = io(`http://${syncSetup.ip}`);
    newSocket.on('connect', () => {
      newSocket.emit('join-session', syncSetup.roomId);
      setSocket(newSocket);
      setIsSyncConnected(true);
    });
    newSocket.on('connect_error', () => alert(`Connection failed.`));
  };

  const triggerDownload = (finalPayload: PatientNamingResponse[]) => {
    const exportData = finalPayload.map(item => ({
      slideID: item.slideID,
      expectedTarget: item.expectedWord,
      clinicianGrade: item.grade,
      clinicianNotes: item.clinicianComment,
      isolatedAudioLink: item.audioUrl
    }));
    const dataString = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(exportData, null, 2));
    const anchor = document.createElement('a');
    anchor.href = dataString;
    anchor.download = `naming_task_output_${Date.now()}.json`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
  };

  const btnStyle = { padding: '20px', fontSize: '16px', cursor: 'pointer', backgroundColor: '#eef8ff', border: '2px solid darkblue', borderRadius: '8px', fontWeight: 'bold' };

  // --- SCREENS ---
  if (sessionMode === 'selection') {
    return (
      <div style={{ padding: '40px', textAlign: 'center', fontFamily: 'sans-serif' }}>
        <h2>Select Session Mode</h2>
        <div style={{ display: 'flex', justifyContent: 'center', gap: '20px', marginTop: '30px' }}>
          <button onClick={() => setSessionMode('patient-solo')} style={btnStyle}>👤 Patient Solo</button>
          <button onClick={() => setSessionMode('clinician-solo')} style={btnStyle}>🩺 Clinician Solo</button>
          <button onClick={() => setSessionMode('synchronized')} style={btnStyle}>🔗 Synchronized</button>
        </div>
      </div>
    );
  }

  if (sessionMode === 'synchronized' && !isSyncConnected) {
    return (
      <div style={{ padding: '40px', textAlign: 'center', fontFamily: 'sans-serif', maxWidth: '500px', margin: '0 auto' }}>
        <h2>🔗 Setup Synchronized Session</h2>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '15px', marginTop: '20px', textAlign: 'left' }}>
          <label><strong>Server IP:</strong> <input type="text" value={syncSetup.ip} onChange={(e) => setSyncSetup({...syncSetup, ip: e.target.value})} style={{ width: '100%', padding: '10px', marginTop: '5px' }} /></label>
          <label><strong>Room ID:</strong> <input type="text" value={syncSetup.roomId} onChange={(e) => setSyncSetup({...syncSetup, roomId: e.target.value})} style={{ width: '100%', padding: '10px', marginTop: '5px' }} /></label>
          <label style={{ marginTop: '10px' }}><strong>Join as:</strong>
            <div style={{ display: 'flex', gap: '10px', marginTop: '5px' }}>
              <button onClick={() => setSyncRole('clinician')} style={{ flex: 1, padding: '10px', backgroundColor: syncRole === 'clinician' ? 'darkblue' : '#ccc', color: syncRole === 'clinician' ? 'white' : 'black' }}>🩺 Clinician</button>
              <button onClick={() => setSyncRole('patient')} style={{ flex: 1, padding: '10px', backgroundColor: syncRole === 'patient' ? 'green' : '#ccc', color: syncRole === 'patient' ? 'white' : 'black' }}>👤 Patient</button>
            </div>
          </label>
          <button onClick={handleConnectSync} style={{ padding: '12px', backgroundColor: 'darkblue', color: 'white', fontWeight: 'bold' }}>Connect & Join Room</button>
        </div>
      </div>
    );
  }

  if (isTestComplete) {
    return (
      <div style={{ padding: '40px', textAlign: 'center', fontFamily: 'sans-serif', border: '2px solid green', marginTop: '20px', backgroundColor: '#f9fff9' }}>
        <h2>Test Complete</h2>
        {(sessionMode === 'synchronized' && syncRole === 'clinician') ? (
          <p>Grades synced to patient device. Please download the diagnostic report from the Patient iPad to retain the audio files.</p>
        ) : (
          <>
            <p>Test sequence complete. Per-slide audio recorded successfully.</p>
            <button onClick={() => triggerDownload(patientAnswers)} style={{ padding: '15px 30px', fontSize: '18px', backgroundColor: 'green', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', marginTop: '20px', fontWeight: 'bold' }}>
              📥 Download Diagnostic Output (JSON)
            </button>
          </>
        )}
      </div>
    );
  }

  return (
    <div style={{ padding: '20px', border: '2px solid darkblue', marginTop: '20px', fontFamily: 'sans-serif' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2>Layer 3: Naming Test Engine</h2>
        {isSyncConnected && <span style={{ padding: '5px 10px', backgroundColor: 'green', color: 'white', borderRadius: '15px', fontSize: '12px', fontWeight: 'bold' }}>🟢 Sync Active ({syncRole})</span>}
      </div>
      <p><strong>Slide:</strong> {currentIndex + 1} / {configuredSlides.length}</p>

      {/* --- PATIENT VIEWPORT --- */}
      <div style={{ backgroundColor: '#fff', padding: '20px', borderRadius: '8px', border: isRecording ? '3px solid red' : '1px solid #ccc', position: 'relative', textAlign: 'center', minHeight: '300px' }}>
        {isRecording && <div style={{ position: 'absolute', top: '10px', right: '10px', backgroundColor: 'red', color: 'white', padding: '4px 10px', borderRadius: '15px', fontSize: '12px', fontWeight: 'bold', animation: 'pulse 1.5s infinite' }}>⏺ RECORDING SLIDE</div>}

        {activeSlide.type === 'info' ? (
          <div style={{ padding: '20px' }}>
            {activeSlide.imageUrl && <img src={activeSlide.imageUrl} alt="Info" style={{ maxWidth: '100%', maxHeight: '40vh', marginBottom: '20px' }} />}
            {activeSlide.instructionText && <p style={{ fontSize: '24px', fontWeight: 'bold', whiteSpace: 'pre-wrap' }}>{activeSlide.instructionText}</p>}
          </div>
        ) : (
          <img src={activeSlide.imageUrl} alt="Target" style={{ maxWidth: '100%', maxHeight: '50vh', objectFit: 'contain' }} />
        )}
      </div>

      {/* --- CLINICIAN VIEWPORT & CONTROLS --- */}
      <div style={{ marginTop: '20px', padding: '15px', backgroundColor: '#eef8ff', border: '1px solid #bce0ff', borderRadius: '8px' }}>
        
        {activeSlide.type === 'info' ? (
          (sessionMode === 'synchronized' && syncRole === 'patient') ? (
            <p style={{ textAlign: 'center', fontSize: '18px', fontWeight: 'bold', margin: 0 }}>Waiting for clinician to advance...</p>
          ) : (
            <button onClick={handleNextSlideTrigger} style={{ width: '100%', padding: '15px', backgroundColor: 'darkblue', color: 'white', fontSize: '18px', fontWeight: 'bold', cursor: 'pointer' }}>Begin Exam →</button>
          )
        ) : (
          <>
            {(sessionMode === 'clinician-solo' || (sessionMode === 'synchronized' && syncRole === 'clinician')) ? (
              <div style={{ display: 'flex', gap: '20px' }}>
                {/* Miniature Clinician View */}
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', backgroundColor: 'white', padding: '10px', border: '1px solid #ccc', borderRadius: '8px' }}>
                   <img src={activeSlide.imageUrl} alt="Ref" style={{ height: '100px', objectFit: 'contain', marginBottom: '10px' }} />
                   <div style={{ fontSize: '24px', fontWeight: 'bold', color: 'darkblue' }}>Target: {activeSlide.targetWord || 'None'}</div>
                </div>

                {/* Grading Controls */}
                <div style={{ flex: 2, display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  <div style={{ display: 'flex', gap: '10px' }}>
                    <button onClick={() => handleLiveGradeUpdate('correct-immediate')} style={{ flex: 1, padding: '15px', fontSize: '16px', fontWeight: 'bold', borderRadius: '8px', cursor: 'pointer', border: liveGrade === 'correct-immediate' ? '3px solid black' : '1px solid #ccc', backgroundColor: liveGrade === 'correct-immediate' ? '#4CAF50' : '#e8f5e9', color: liveGrade === 'correct-immediate' ? 'white' : '#2e7d32' }}>🟢 נכון מיידי</button>
                    <button onClick={() => handleLiveGradeUpdate('correct-hesitation')} style={{ flex: 1, padding: '15px', fontSize: '16px', fontWeight: 'bold', borderRadius: '8px', cursor: 'pointer', border: liveGrade === 'correct-hesitation' ? '3px solid black' : '1px solid #ccc', backgroundColor: liveGrade === 'correct-hesitation' ? '#FF9800' : '#fff3e0', color: liveGrade === 'correct-hesitation' ? 'white' : '#e65100' }}>🟡 נכון לאחר היסוס/טעות</button>
                    <button onClick={() => handleLiveGradeUpdate('incorrect')} style={{ flex: 1, padding: '15px', fontSize: '16px', fontWeight: 'bold', borderRadius: '8px', cursor: 'pointer', border: liveGrade === 'incorrect' ? '3px solid black' : '1px solid #ccc', backgroundColor: liveGrade === 'incorrect' ? '#F44336' : '#ffebee', color: liveGrade === 'incorrect' ? 'white' : '#c62828' }}>🔴 לא נכון</button>
                  </div>
                  
                  <textarea 
                    value={liveComment} 
                    onChange={(e) => {
                      setLiveComment(e.target.value);
                      if (sessionMode === 'synchronized' && syncRole === 'clinician') socket?.emit('naming-grade-update', { sessionId: syncSetup.roomId, grade: liveGrade, comment: e.target.value });
                    }} 
                    placeholder="Clinician notes for this specific slide..." 
                    style={{ width: '100%', height: '50px', padding: '8px', boxSizing: 'border-box', borderRadius: '4px' }} 
                  />
                  
                  <button onClick={handleNextSlideTrigger} style={{ width: '100%', padding: '15px', backgroundColor: 'darkblue', color: 'white', fontSize: '18px', fontWeight: 'bold', borderRadius: '8px', cursor: 'pointer', border: 'none', marginTop: '10px' }}>
                    {currentIndex < configuredSlides.length - 1 ? 'Save Audio & Next Slide →' : 'Complete Exam'}
                  </button>
                </div>
              </div>
            ) : (
              // Patient Solo view
              <div style={{ textAlign: 'center' }}>
                <button onClick={handleNextSlideTrigger} style={{ padding: '15px 40px', fontSize: '18px', backgroundColor: 'darkblue', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' }}>
                   {currentIndex < configuredSlides.length - 1 ? 'Next Image →' : 'Complete Exam'}
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}