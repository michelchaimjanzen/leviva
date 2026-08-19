import React, { useState, useRef, useEffect, type ChangeEvent } from 'react';
import { io, Socket } from 'socket.io-client';
import { saveTestConfig } from '../../utils/testService'; 

// =========================================================================
// TYPE DEFINITIONS
// =========================================================================

export interface ReadingTask {
  id: string;
  taskName: string;
  instructionImageUrl: string | null;
  instructionText: string | null; // NEW: Typed instructions
  targetWords: string[]; 
}

export interface PatientWordResponse {
  expectedWord: string;
  patientResponse: string;
  isCorrect: boolean | null;       
  timestampMs: number | null;      
}

export interface PatientReadingResponse {
  taskID: string;
  isFlagged: boolean;
  clinicianComment: string;
  patientAudioBlob: Blob | null;   
  patientAudioUrl: string | null;
  itemizedResponses: PatientWordResponse[]; 
}

interface WorkspaceProps {
  initialData?: any; 
  onSave: (configData: ReadingTask[], meta: { title: string, description: string }) => void;
}

// =========================================================================
// LAYER 2: WORKSPACE / TEMPLATE CREATOR (TEXT-BASED)
// =========================================================================
export function ReadingAloudWorkspace({ initialData, onSave }: WorkspaceProps) {
  const [testTitle, setTestTitle] = useState(initialData?.title || '');
  const [testDescription, setTestDescription] = useState(initialData?.description || '');
  const [readingTasks, setReadingTasks] = useState<ReadingTask[]>(initialData?.configData || []);

  // Drag and Drop State for Words
  const [dragItemIndex, setDragItemIndex] = useState<{ taskIdx: number, wordIdx: number } | null>(null);

  const handleAddNewTask = () => {
    const newTask: ReadingTask = {
      id: `Task_${readingTasks.length + 1}`,
      taskName: `Reading Section ${readingTasks.length + 1}`,
      instructionImageUrl: null,
      instructionText: null,
      targetWords: []
    };
    setReadingTasks([...readingTasks, newTask]);
  };

  const handleInstructionUpload = (taskIndex: number, e: ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    const fileUrl = URL.createObjectURL(e.target.files[0]);
    const updatedTasks = [...readingTasks];
    updatedTasks[taskIndex].instructionImageUrl = fileUrl;
    setReadingTasks(updatedTasks);
  };

  const handleInstructionTextChange = (taskIndex: number, text: string) => {
    const updatedTasks = [...readingTasks];
    updatedTasks[taskIndex].instructionText = text;
    setReadingTasks(updatedTasks);
  };

  // --- TEXT TARGET MANAGEMENT ---
  const handleBulkPaste = (taskIndex: number, pastedText: string) => {
    const newWords = pastedText.split(/\r?\n/).map(w => w.trim()).filter(w => w.length > 0);
    const updatedTasks = [...readingTasks];
    updatedTasks[taskIndex].targetWords = [...updatedTasks[taskIndex].targetWords, ...newWords];
    setReadingTasks(updatedTasks);
  };

  const updateTargetWord = (taskIndex: number, wordIndex: number, value: string) => {
    const updatedTasks = [...readingTasks];
    updatedTasks[taskIndex].targetWords[wordIndex] = value;
    setReadingTasks(updatedTasks);
  };

  const addTargetWordSlot = (taskIndex: number) => {
    const updatedTasks = [...readingTasks];
    updatedTasks[taskIndex].targetWords.push("");
    setReadingTasks(updatedTasks);
  };

  const deleteWord = (taskIndex: number, wordIndex: number) => {
    const updatedTasks = [...readingTasks];
    updatedTasks[taskIndex].targetWords.splice(wordIndex, 1);
    setReadingTasks(updatedTasks);
  };

  // --- DRAG AND DROP HANDLERS FOR WORDS ---
  const handleDragStart = (taskIdx: number, wordIdx: number) => {
    setDragItemIndex({ taskIdx, wordIdx });
  };

  const handleDragEnter = (taskIdx: number, targetWordIdx: number) => {
    if (!dragItemIndex || dragItemIndex.taskIdx !== taskIdx || dragItemIndex.wordIdx === targetWordIdx) return;
    const updated = [...readingTasks];
    const words = updated[taskIdx].targetWords;
    const draggedWord = words[dragItemIndex.wordIdx];
    
    words.splice(dragItemIndex.wordIdx, 1); 
    words.splice(targetWordIdx, 0, draggedWord); 
    
    setDragItemIndex({ taskIdx, wordIdx: targetWordIdx });
    setReadingTasks(updated);
  };

  const handleDragEnd = () => setDragItemIndex(null);

  const handleValidateAndSave = () => {
    if (!testTitle.trim()) { alert("Please provide a Test Title."); return; }
    if (readingTasks.length === 0) { alert("You must add at least one section."); return; }
    const allSectionsHaveWords = readingTasks.every(t => t.targetWords.length > 0);
    if (!allSectionsHaveWords) { alert("Every section must contain at least one target word."); return; }
    onSave(readingTasks, { title: testTitle, description: testDescription });
  };

  return (
    <div style={{ padding: '20px', fontFamily: 'sans-serif', border: '1px solid gray', marginBottom: '20px' }}>
      <h2>Layer 2: Continuous Text-Reading Builder</h2>
      
      <div style={{ backgroundColor: '#f9f9f9', padding: '15px', border: '1px solid #ccc', marginBottom: '20px', borderRadius: '4px' }}>
        <input type="text" value={testTitle} onChange={(e) => setTestTitle(e.target.value)} placeholder="Enter Test Title (e.g., TILTAN16 Words)" style={{ width: '100%', padding: '10px', fontSize: '18px', fontWeight: 'bold', marginBottom: '10px', boxSizing: 'border-box' }} />
        <input type="text" value={testDescription} onChange={(e) => setTestDescription(e.target.value)} placeholder="Enter clinical tags or brief description..." style={{ width: '100%', padding: '8px', fontSize: '14px', boxSizing: 'border-box' }} />
      </div>

      <button onClick={handleAddNewTask} style={{ padding: '10px', backgroundColor: '#4CAF50', color: 'white', fontWeight: 'bold', border: 'none', borderRadius: '4px', cursor: 'pointer', marginBottom: '20px' }}>
        + Add New Section
      </button>

      {readingTasks.map((task, tIdx) => (
        <div key={task.id} style={{ border: '1px solid #ccc', padding: '15px', marginBottom: '15px', backgroundColor: '#fafafa' }}>
          <h3>{task.taskName}</h3>
          
          <div style={{ display: 'flex', gap: '20px', marginBottom: '20px' }}>
            <div style={{ flex: 1, padding: '15px', border: '1px dashed gray', backgroundColor: 'white' }}>
              <strong>1. Optional Instruction Slide</strong><br/><br/>
              
              <label style={{ fontSize: '12px', fontWeight: 'bold' }}>Upload Image/PDF:</label>
              <input type="file" accept="image/*" onChange={(e) => handleInstructionUpload(tIdx, e)} style={{ display: 'block', marginBottom: '10px', marginTop: '5px' }} />
              {task.instructionImageUrl && <p style={{ color: 'green', fontSize: '12px', margin: '0 0 15px 0' }}>✓ Image loaded</p>}

              <label style={{ fontSize: '12px', fontWeight: 'bold' }}>Or Type Instructions:</label>
              <textarea 
                value={task.instructionText || ''}
                onChange={(e) => handleInstructionTextChange(tIdx, e.target.value)}
                placeholder="Type instructions here..."
                style={{ width: '100%', height: '80px', padding: '8px', boxSizing: 'border-box', marginTop: '5px' }}
              />
            </div>

            <div style={{ flex: 2, padding: '15px', border: '1px dashed gray', backgroundColor: 'white' }}>
              <strong>2. Bulk Add Words (Paste List Here)</strong><br/><br/>
              <textarea 
                placeholder="Paste words here (one per line)..."
                onBlur={(e) => {
                  handleBulkPaste(tIdx, e.target.value);
                  e.target.value = ''; 
                }}
                style={{ width: '100%', height: '80px', padding: '8px', boxSizing: 'border-box' }}
              />
              <p style={{ fontSize: '12px', color: 'gray', margin: '5px 0 0 0' }}>Click outside the box to add pasted words to the list below.</p>
            </div>
          </div>

          <div style={{ backgroundColor: '#fff', padding: '15px', border: '1px solid #ddd' }}>
            <h4>Target Words (Drag to Reorder)</h4>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px' }}>
              {task.targetWords.map((word, wIdx) => (
                <div 
                  key={`${tIdx}_${wIdx}`} 
                  draggable
                  onDragStart={() => handleDragStart(tIdx, wIdx)}
                  onDragEnter={() => handleDragEnter(tIdx, wIdx)}
                  onDragEnd={handleDragEnd}
                  onDragOver={(e) => e.preventDefault()}
                  style={{ 
                    display: 'flex', alignItems: 'center', border: '1px solid #ccc', padding: '5px 10px', 
                    backgroundColor: (dragItemIndex?.taskIdx === tIdx && dragItemIndex?.wordIdx === wIdx) ? '#e0f7fa' : '#f0f0f0', 
                    cursor: 'grab', borderRadius: '20px'
                  }}
                >
                  <span style={{ marginRight: '8px', color: '#888', cursor: 'grab' }}>{wIdx + 1}.</span>
                  <input 
                    value={word} 
                    onChange={(e) => updateTargetWord(tIdx, wIdx, e.target.value)} 
                    style={{ border: 'none', background: 'transparent', outline: 'none', width: '80px', fontWeight: 'bold' }} 
                  />
                  <button onClick={() => deleteWord(tIdx, wIdx)} style={{ marginLeft: '10px', background: 'none', border: 'none', color: 'red', cursor: 'pointer', fontWeight: 'bold' }}>X</button>
                </div>
              ))}
              <button onClick={() => addTargetWordSlot(tIdx)} style={{ padding: '5px 15px', borderRadius: '20px', border: '1px dashed #666', cursor: 'pointer' }}>+ Blank Word</button>
            </div>
          </div>
        </div>
      ))}

      {readingTasks.length > 0 && (
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
interface ReadingRunnerProps {
  configuredTasks: ReadingTask[];
}

export function ReadingAloudRunner({ configuredTasks }: ReadingRunnerProps) {
  // --- SYNC & MODE STATE ---
  const [sessionMode, setSessionMode] = useState<'selection' | 'patient-solo' | 'clinician-solo' | 'synchronized'>('selection');
  const [socket, setSocket] = useState<Socket | null>(null);
  const [syncSetup, setSyncSetup] = useState({ ip: 'localhost:3001', roomId: 'room-123' });
  const [isSyncConnected, setIsSyncConnected] = useState(false);
  const [syncRole, setSyncRole] = useState<'clinician' | 'patient'>('clinician');

  // --- RUNNER STATE ---
  const [currentTaskIndex, setCurrentTaskIndex] = useState(0);
  const [isTaskActive, setIsTaskActive] = useState(false);
  const [patientAnswers, setPatientAnswers] = useState<PatientReadingResponse[]>([]);
  const [isTestComplete, setIsTestComplete] = useState(false);

  // --- RECORDING & GRADING STATE ---
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const startTimeRef = useRef<number | null>(null);

  const [liveGrades, setLiveGrades] = useState<Record<number, { isCorrect: boolean | null, comment: string, timestampMs: number | null }>>({});
  const [liveFlag, setLiveFlag] = useState(false);
  const [liveComment, setLiveComment] = useState('');

  const activeTask = configuredTasks[currentTaskIndex];

  // --- SYNC LISTENERS ---
  useEffect(() => {
    if (!socket) return;
    
    socket.on('sync-start-task', () => {
      startTimeRef.current = Date.now();
      setIsTaskActive(true);
      if (syncRole === 'patient') startLocalRecording();
    });

    socket.on('sync-grade-item', (data: { wordIdx: number, gradeData: any }) => {
      setLiveGrades(prev => ({ ...prev, [data.wordIdx]: data.gradeData }));
    });

    socket.on('sync-finish-task', () => {
      handleFinishTask(true);
    });

    return () => {
      socket.off('sync-start-task');
      socket.off('sync-grade-item');
      socket.off('sync-finish-task');
    };
  }, [socket, syncRole, liveGrades]);

  const handleConnectSync = () => {
    const newSocket = io(`http://${syncSetup.ip}`);
    newSocket.on('connect', () => {
      newSocket.emit('join-session', syncSetup.roomId);
      setSocket(newSocket);
      setIsSyncConnected(true);
    });
    newSocket.on('connect_error', () => alert(`Connection failed. Check server IP.`));
  };

  const startLocalRecording = async () => {
    try {
      audioChunksRef.current = [];
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (e) => { if (e.data.size > 0) audioChunksRef.current.push(e.data); };
      mediaRecorder.start();
    } catch (err) {
      alert("Microphone access denied. Cannot record audio.");
    }
  };

  const handleStartTask = () => {
    startTimeRef.current = Date.now();
    setIsTaskActive(true);
    
    if (sessionMode === 'patient-solo' || sessionMode === 'clinician-solo') {
      startLocalRecording();
    } else if (sessionMode === 'synchronized') {
      if (syncRole === 'patient') startLocalRecording();
      if (socket) socket.emit('reading-start-task', syncSetup.roomId);
    }
  };

  const handleLocalGrade = (wordIdx: number, isCorrect: boolean | null, comment: string) => {
    const timestampMs = startTimeRef.current ? Date.now() - startTimeRef.current : null;
    const gradeData = { isCorrect, comment, timestampMs };
    
    setLiveGrades(prev => ({ ...prev, [wordIdx]: gradeData }));
    
    if (socket && sessionMode === 'synchronized' && syncRole === 'clinician') {
      socket.emit('reading-grade-item', { sessionId: syncSetup.roomId, key: wordIdx, gradeData }); 
    }
  };

  const handleFinishTask = (isRemoteSync = false) => {
    if (sessionMode === 'synchronized' && !isRemoteSync && socket) {
      socket.emit('reading-finish-task', syncSetup.roomId);
    }

    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      mediaRecorderRef.current.onstop = () => {
        const finalBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        const audioUrl = URL.createObjectURL(finalBlob);
        finalizeTaskData(finalBlob, audioUrl);
      };
      mediaRecorderRef.current.stop();
      if (streamRef.current) streamRef.current.getTracks().forEach(t => t.stop());
    } else {
      finalizeTaskData(null, null);
    }
    setIsTaskActive(false); 
  };

  const finalizeTaskData = (blob: Blob | null, url: string | null) => {
    const itemizedResponses: PatientWordResponse[] = activeTask.targetWords.map((expectedWord, wIdx) => {
      const grade = liveGrades[wIdx] || { isCorrect: null, comment: '', timestampMs: null };
      return {
        expectedWord,
        patientResponse: grade.comment,
        isCorrect: grade.isCorrect,
        timestampMs: grade.timestampMs
      };
    });

    const responsePayload: PatientReadingResponse = {
      taskID: activeTask.id,
      isFlagged: liveFlag,
      clinicianComment: liveComment,
      patientAudioBlob: blob,
      patientAudioUrl: url,
      itemizedResponses
    };

    const updatedAnswers = [...patientAnswers, responsePayload];
    setPatientAnswers(updatedAnswers);
    setLiveFlag(false); setLiveComment(''); setLiveGrades({});

    if (currentTaskIndex < configuredTasks.length - 1) {
      setCurrentTaskIndex(prev => prev + 1);
    } else {
      setIsTestComplete(true);
    }
  };

  const triggerDownload = (finalPayload: PatientReadingResponse[]) => {
    const exportData = finalPayload.map(item => ({
      taskID: item.taskID,
      isFlagged: item.isFlagged,
      clinicianNotes: item.clinicianComment,
      audioPlaybackLink: item.patientAudioUrl, 
      itemizedResponses: item.itemizedResponses
    }));
    const dataString = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(exportData, null, 2));
    const anchor = document.createElement('a');
    anchor.href = dataString;
    anchor.download = `reading_naming_output_${Date.now()}.json`;
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
            <p>Test sequence complete. Audio recorded successfully.</p>
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
        <h2>Layer 3: Patient Testing Engine</h2>
        {isSyncConnected && <span style={{ padding: '5px 10px', backgroundColor: 'green', color: 'white', borderRadius: '15px', fontSize: '12px', fontWeight: 'bold' }}>🟢 Sync Active ({syncRole})</span>}
      </div>
      <p><strong>Section:</strong> {currentTaskIndex + 1} / {configuredTasks.length}</p>

      {/* CONTINUOUS SCROLL VIEWPORT */}
      <div style={{ backgroundColor: '#fff', padding: '20px', borderRadius: '8px', border: isTaskActive ? '3px solid red' : '1px solid #ccc', position: 'relative', maxHeight: '65vh', overflowY: 'auto' }}>
        
        {isTaskActive && (
          <div style={{ position: 'sticky', top: '0', backgroundColor: 'rgba(255,0,0,0.8)', color: 'white', padding: '5px', textAlign: 'center', fontWeight: 'bold', zIndex: 10, boxShadow: '0px 2px 5px rgba(0,0,0,0.2)' }}>
            {syncRole === 'patient' || sessionMode !== 'synchronized' ? '⏺ RECORDING AUDIO' : '🔴 PATIENT IS RECORDING'}
          </div>
        )}

        {/* INSTRUCTION SLIDE */}
        {(activeTask.instructionImageUrl || activeTask.instructionText) && (
          <div style={{ textAlign: 'center', marginBottom: '40px', marginTop: '20px', padding: '20px', backgroundColor: '#f9f9f9', border: '1px solid #ccc', borderRadius: '8px' }}>
            <h3 style={{ borderBottom: '2px solid #ddd', paddingBottom: '10px', margin: '0 0 20px 0' }}>Instructions</h3>
            
            {activeTask.instructionImageUrl && (
              <img src={activeTask.instructionImageUrl} alt="Instructions" style={{ maxWidth: '100%', marginBottom: '20px', border: '1px solid #aaa' }} />
            )}
            
            {activeTask.instructionText && (
              <p style={{ fontSize: '24px', fontWeight: 'bold', whiteSpace: 'pre-wrap', margin: 0, color: '#333' }}>
                {activeTask.instructionText}
              </p>
            )}
          </div>
        )}

        {!isTaskActive ? (
          <div style={{ textAlign: 'center', padding: '40px' }}>
            {sessionMode === 'synchronized' && syncRole === 'patient' ? (
               <p style={{ fontSize: '18px', fontWeight: 'bold' }}>Waiting for clinician to start the exam...</p>
            ) : (
              <button onClick={handleStartTask} style={{ padding: '20px 40px', fontSize: '20px', backgroundColor: 'green', color: 'white', borderRadius: '8px', cursor: 'pointer', border: 'none', fontWeight: 'bold' }}>
                Start Recording & Reveal Words
              </button>
            )}
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', paddingBottom: '40px', marginTop: '40px' }}>
            
            {/* DYNAMIC TEXT RENDERING */}
            <div style={{ fontSize: '32px', lineHeight: '2.5', textAlign: 'center', fontFamily: 'sans-serif' }}>
              {activeTask.targetWords.map((word, idx) => (
                <div key={idx}>{word}</div>
              ))}
            </div>
            
            {/* FINISH BUTTON AT THE VERY BOTTOM OF THE SCROLL */}
            {(sessionMode === 'clinician-solo' || (sessionMode === 'synchronized' && syncRole === 'clinician') || sessionMode === 'patient-solo') && (
              <button onClick={() => handleFinishTask(false)} style={{ width: '80%', padding: '20px', fontSize: '18px', backgroundColor: 'darkblue', color: 'white', borderRadius: '8px', cursor: 'pointer', border: 'none', fontWeight: 'bold', marginTop: '60px' }}>
                {currentTaskIndex < configuredTasks.length - 1 ? 'Finish Section & Proceed →' : 'Complete Exam'}
              </button>
            )}
          </div>
        )}
      </div>

      {/* CLINICIAN LIVE GRADING PANEL */}
      {(sessionMode === 'clinician-solo' || (sessionMode === 'synchronized' && syncRole === 'clinician')) && (
        <div style={{ marginTop: '20px', padding: '15px', backgroundColor: '#eef8ff', border: '1px solid #bce0ff', borderRadius: '8px' }}>
          <h3>Clinician Live Panel</h3>
          
          {isTaskActive && activeTask.targetWords.length > 0 && (
            <div style={{ marginBottom: '20px', padding: '15px', backgroundColor: 'white', border: '1px solid #ccc', borderRadius: '6px', maxHeight: '400px', overflowY: 'auto' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {activeTask.targetWords.map((word, wIdx) => {
                  const currentGrade = liveGrades[wIdx];
                  return (
                    <div key={wIdx} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '8px', backgroundColor: '#f9f9f9', borderRadius: '4px', border: '1px solid #eee' }}>
                      <button 
                        onClick={() => handleLocalGrade(wIdx, true, currentGrade?.comment || '')}
                        style={{ padding: '5px 10px', backgroundColor: currentGrade?.isCorrect === true ? 'green' : '#e0e0e0', color: currentGrade?.isCorrect === true ? 'white' : 'black', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>✓</button>
                      <button 
                        onClick={() => handleLocalGrade(wIdx, false, currentGrade?.comment || '')}
                        style={{ padding: '5px 10px', backgroundColor: currentGrade?.isCorrect === false ? 'red' : '#e0e0e0', color: currentGrade?.isCorrect === false ? 'white' : 'black', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>✗</button>
                      
                      <span style={{ fontWeight: 'bold', width: '120px', fontSize: '16px' }}>{wIdx + 1}. {word}</span>
                      
                      <input 
                        type="text" 
                        placeholder="Transcript / Note..."
                        value={currentGrade?.comment || ''}
                        onChange={(e) => handleLocalGrade(wIdx, currentGrade?.isCorrect ?? null, e.target.value)}
                        style={{ flex: 1, padding: '8px', border: '1px solid #999', borderRadius: '4px' }}
                      />
                      
                      {currentGrade?.timestampMs !== undefined && currentGrade?.timestampMs !== null && (
                        <span style={{ fontSize: '12px', color: 'gray', width: '60px' }}>
                          {(currentGrade.timestampMs / 1000).toFixed(1)}s
                        </span>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          <label style={{ display: 'block', marginBottom: '10px', cursor: 'pointer' }}>
            <input type="checkbox" checked={liveFlag} onChange={(e) => setLiveFlag(e.target.checked)} /> Flag this section
          </label>
          <textarea value={liveComment} onChange={(e) => setLiveComment(e.target.value)} placeholder="Take general clinician notes here..." style={{ width: '100%', height: '60px', padding: '8px', boxSizing: 'border-box' }} />
        </div>
      )}
    </div>
  );
}