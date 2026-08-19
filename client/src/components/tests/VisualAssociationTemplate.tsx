import React, { useState, useRef, type ChangeEvent, useEffect } from 'react';
import { extractImagesFromPDF } from '../../utils/pdfExtractor';
import { saveTestConfig } from '../../utils/testService'; 

// --- TYPE DEFINITIONS (Responsive Coordinates) ---
export interface Point { x: number; y: number; }

export interface BoundingBox {
  id: string;
  xPercent: number;
  yPercent: number;
  widthPercent: number;
  heightPercent: number;
}

export interface AssociationTrial {
  id: string;
  imageUrl: string;
  hitboxes: BoundingBox[];
  correctPair: [string, string] | null; 
}

export interface PatientAssociationResponse {
  trialID: string;
  score: 'Correct!' | 'Incorrect';
  isFlagged: boolean;
  clinicianComment: string;
  patientImageBlob: Blob | null;
  patientImageUrl: string | null;
}

// UPGRADED: Added initialData and metadata payload
export interface WorkspaceProps {
  initialData?: any;
  onSave: (configData: AssociationTrial[], meta: { title: string, description: string }) => void;
}
// Utility Math: Check if a percentage coordinate is inside a percentage box
const isPointInPercentBox = (xPct: number, yPct: number, box: BoundingBox) => {
  return xPct >= box.xPercent && xPct <= box.xPercent + box.widthPercent && 
         yPct >= box.yPercent && yPct <= box.yPercent + box.heightPercent;
};

// =========================================================================
// LAYER 2: WORKSPACE / HITBOX CREATOR
// =========================================================================
export function VisualAssociationWorkspace({ initialData, onSave }: WorkspaceProps) {
  
  // UPGRADED: State initialization for Edit Mode
  const [testTitle, setTestTitle] = useState(initialData?.title || '');
  const [testDescription, setTestDescription] = useState(initialData?.description || '');
  const [associationTracks, setAssociationTracks] = useState<AssociationTrial[]>(initialData?.configData || []);
  
  const [activeSlideIndex, setActiveSlideIndex] = useState<number | null>(null);
  const [isProcessing, setIsProcessing] = useState(false); // <-- NEW STATE

  // Hitbox Drawing States (Temporary Pixels while dragging)
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [startPoint, setStartPoint] = useState<Point | null>(null);
  const [currentPoint, setCurrentPoint] = useState<Point | null>(null);

  // UNIFIED HANDLER: Processes both Standard Images and PDFs
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    const files = Array.from(e.target.files);
    let newTracks: AssociationTrial[] = [];

    setIsProcessing(true); // Start loading indicator

    try {
      for (const file of files) {
        if (file.type === 'application/pdf') {
          console.log("Starting PDF extraction for:", file.name);
          const images = await extractImagesFromPDF(file);
          
          if (!images || images.length === 0) {
            alert(`Failed to extract images from ${file.name}. Check the console.`);
            continue;
          }

          const pdfTracks: AssociationTrial[] = images.map((imgData, idx) => ({
            id: `Trial_${Date.now()}_${idx}`,
            imageUrl: imgData,
            hitboxes: [],
            correctPair: null
          }));
          newTracks = [...newTracks, ...pdfTracks];
        } else {
          newTracks.push({ 
            id: `Trial_${Date.now()}_${file.name}`, 
            imageUrl: URL.createObjectURL(file), 
            hitboxes: [], 
            correctPair: null 
          });
        }
      }
      
      setAssociationTracks((prev) => [...prev, ...newTracks]);
      setActiveSlideIndex((prevIndex) => prevIndex === null ? 0 : prevIndex);
      
    } catch (error) {
      console.error("PDF Extraction Error:", error);
      alert("An error occurred while processing the file. Please check the browser console for details.");
    } finally {
      setIsProcessing(false); // Stop loading indicator
      e.target.value = ''; // Reset input so you can re-upload the same file if needed
    }
  };

  // UPGRADED: Curation Controls
  const deleteSlide = (idx: number) => {
    const updated = [...associationTracks];
    updated.splice(idx, 1);
    setAssociationTracks(updated);
    if (activeSlideIndex === idx) setActiveSlideIndex(null);
  };

  const moveSlide = (idx: number, direction: 'left' | 'right') => {
    const updated = [...associationTracks];
    if (direction === 'left' && idx > 0) {
      [updated[idx - 1], updated[idx]] = [updated[idx], updated[idx - 1]];
    } else if (direction === 'right' && idx < updated.length - 1) {
      [updated[idx + 1], updated[idx]] = [updated[idx], updated[idx + 1]];
    }
    setAssociationTracks(updated);
    setActiveSlideIndex(null); // Reset active slide to avoid drawing on the wrong one
  };

const handleValidateAndSave = async () => {
    if (!testTitle.trim()) {
      alert("Validation Failed: Please provide a Test Title.");
      return;
    }
    if (associationTracks.length === 0) {
      alert("Validation Failed: You must add at least one slide.");
      return;
    }
    
    const isValid = associationTracks.every(t => t.hitboxes.length > 0 && t.correctPair);
    if (!isValid) {
      alert("Validation Failed: Every slide must have its hitboxes drawn and a correct pair marked (Green).");
      return;
    }

    // --- MAP TO BACKEND SCHEMA ---
    const finalSlides = associationTracks.map((track, index) => ({
      slideNumber: index + 1,
      imageUrl: track.imageUrl,
      targets: track.hitboxes.map(box => ({
        id: box.id,
        x: box.xPercent,
        y: box.yPercent,
        width: box.widthPercent,
        height: box.heightPercent,
        // Mark as correct if this box ID is part of the correctPair array
        isCorrect: track.correctPair ? track.correctPair.includes(box.id) : false
      }))
    }));

    const testPayload = {
      testName: testTitle,
      testType: "VisualAssociation",
      slides: finalSlides
    };

    // Save to MongoDB via backend
    await saveTestConfig(testPayload, initialData?._id);

    onSave(associationTracks, { title: testTitle, description: testDescription });
  };


  const activeSlide = activeSlideIndex !== null ? associationTracks[activeSlideIndex] : null;

  // Render Hitbox Canvas Editor
  useEffect(() => {
    if (!canvasRef.current || !activeSlide) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const img = new Image();
    img.src = activeSlide.imageUrl;
    img.onload = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

      // Draw saved hitboxes (Convert % back to pixels for rendering)
      activeSlide.hitboxes.forEach(box => {
        const x = (box.xPercent / 100) * canvas.width;
        const y = (box.yPercent / 100) * canvas.height;
        const w = (box.widthPercent / 100) * canvas.width;
        const h = (box.heightPercent / 100) * canvas.height;

        ctx.strokeStyle = activeSlide.correctPair?.includes(box.id) ? 'green' : 'red';
        ctx.lineWidth = 3;
        ctx.strokeRect(x, y, w, h);
        
        ctx.fillStyle = 'black';
        ctx.fillText(box.id, x + 5, y + 15);
      });

      // Draw the box currently being dragged
      if (isDrawing && startPoint && currentPoint) {
        ctx.strokeStyle = 'blue';
        ctx.setLineDash([5, 5]);
        ctx.strokeRect(startPoint.x, startPoint.y, currentPoint.x - startPoint.x, currentPoint.y - startPoint.y);
        ctx.setLineDash([]); // Reset
      }
    };
  }, [activeSlide, isDrawing, currentPoint, associationTracks]);

  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!activeSlide || !canvasRef.current) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const clickY = e.clientY - rect.top;
    
    const xPct = (clickX / rect.width) * 100;
    const yPct = (clickY / rect.height) * 100;

    // Check if clinician is clicking an existing box to set the Correct Answer
    const clickedBox = activeSlide.hitboxes.find(box => isPointInPercentBox(xPct, yPct, box));
    if (clickedBox) {
      let currentPair = activeSlide.correctPair ? [...activeSlide.correctPair] : [];
      if (currentPair.includes(clickedBox.id)) {
        currentPair = currentPair.filter(id => id !== clickedBox.id);
      } else if (currentPair.length < 2) {
        currentPair.push(clickedBox.id);
      }
      
      const updatedTracks = [...associationTracks];
      updatedTracks[activeSlideIndex!] = { 
        ...activeSlide, 
        correctPair: currentPair.length === 2 ? [currentPair[0], currentPair[1]] : null 
      };
      setAssociationTracks(updatedTracks);
      return;
    }

    if (activeSlide.hitboxes.length >= 3) {
      alert("You already have 3 zones defined. Clear them to start over.");
      return;
    }
    setStartPoint({ x: clickX, y: clickY });
    setCurrentPoint({ x: clickX, y: clickY });
    setIsDrawing(true);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDrawing || !canvasRef.current) return;
    const rect = canvasRef.current.getBoundingClientRect();
    setCurrentPoint({ x: e.clientX - rect.left, y: e.clientY - rect.top });
  };

  const handlePointerUp = () => {
    if (!isDrawing || !startPoint || !currentPoint || !activeSlide || !canvasRef.current) return;
    const rect = canvasRef.current.getBoundingClientRect();
    
    // Convert physical drag area into universally scaling percentages
    const newBox: BoundingBox = {
      id: `Zone_${activeSlide.hitboxes.length + 1}`,
      xPercent: (Math.min(startPoint.x, currentPoint.x) / rect.width) * 100,
      yPercent: (Math.min(startPoint.y, currentPoint.y) / rect.height) * 100,
      widthPercent: (Math.abs(currentPoint.x - startPoint.x) / rect.width) * 100,
      heightPercent: (Math.abs(currentPoint.y - startPoint.y) / rect.height) * 100
    };

    if (newBox.widthPercent > 2 && newBox.heightPercent > 2) {
      const updatedTracks = [...associationTracks];
      updatedTracks[activeSlideIndex!].hitboxes.push(newBox);
      setAssociationTracks(updatedTracks);
    }
    
    setIsDrawing(false);
    setStartPoint(null);
    setCurrentPoint(null);
  };

  return (
    <div style={{ padding: '20px', fontFamily: 'sans-serif', border: '1px solid gray', marginBottom: '20px' }}>
      <h2>Layer 2: Visual Association Template Creator</h2>
      
      {/* UPGRADED: Metadata Inputs */}
      <div style={{ backgroundColor: '#f9f9f9', padding: '15px', border: '1px solid #ccc', marginBottom: '20px', borderRadius: '4px' }}>
        <input 
          type="text" 
          value={testTitle} 
          onChange={(e) => setTestTitle(e.target.value)} 
          placeholder="Enter Test Title (e.g., Pyramids and Palm Trees)" 
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

      <input type="file" multiple accept="image/*, application/pdf" onChange={handleFileUpload} />
      
      {/* NEW: Loading Indicator */}
      {isProcessing && <p style={{ color: 'blue', fontWeight: 'bold', marginTop: '10px' }}>Processing file... Please wait ⏳</p>}
      
      {associationTracks.length > 0 && (
        <div style={{ marginTop: '20px' }}>
          <h3>Step 1: Hitbox Calibration</h3>
          <p>1. Select a slide. <br/>2. Click and drag to draw 3 boxes. <br/>3. Click the 2 correct boxes to mark them green.</p>
          
          <div style={{ display: 'flex', gap: '10px', overflowX: 'auto', marginBottom: '20px', paddingBottom: '10px' }}>
            {associationTracks.map((track, idx) => (
              <div key={track.id} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                <div onClick={() => setActiveSlideIndex(idx)} style={{ border: activeSlideIndex === idx ? '3px solid blue' : '1px solid #ccc', padding: '5px', cursor: 'pointer', marginBottom: '5px' }}>
                  <img src={track.imageUrl} alt="thumb" style={{ height: '60px' }} />
                  <div style={{ fontSize: '10px', textAlign: 'center', color: track.correctPair ? 'green' : 'red' }}>
                    {track.correctPair ? '✓ Ready' : 'Needs Zones'}
                  </div>
                </div>
                {/* UPGRADED: Curation Controls UI */}
                <div style={{ display: 'flex', gap: '5px' }}>
                  <button onClick={() => moveSlide(idx, 'left')} disabled={idx === 0} style={{ padding: '2px 5px', fontSize: '10px', cursor: idx === 0 ? 'not-allowed' : 'pointer' }}>←</button>
                  <button onClick={() => deleteSlide(idx)} style={{ padding: '2px 5px', fontSize: '10px', color: 'white', backgroundColor: 'red', border: 'none', borderRadius: '3px', cursor: 'pointer' }}>X</button>
                  <button onClick={() => moveSlide(idx, 'right')} disabled={idx === associationTracks.length - 1} style={{ padding: '2px 5px', fontSize: '10px', cursor: idx === associationTracks.length - 1 ? 'not-allowed' : 'pointer' }}>→</button>
                </div>
              </div>
            ))}
          </div>

          {activeSlide && (
            <div style={{ textAlign: 'center', backgroundColor: '#f0f0f0', padding: '10px' }}>
              <canvas 
                ref={canvasRef} width={800} height={450} 
                style={{ border: '2px solid black', cursor: 'crosshair', backgroundColor: 'white', maxWidth: '100%' }}
                onPointerDown={handlePointerDown} onPointerMove={handlePointerMove} onPointerUp={handlePointerUp}
              />
              <br/>
              <button onClick={() => {
                const updated = [...associationTracks];
                updated[activeSlideIndex!].hitboxes = [];
                updated[activeSlideIndex!].correctPair = null;
                setAssociationTracks(updated);
              }} style={{ marginTop: '10px', padding: '5px 10px' }}>Clear All Boxes on this Slide</button>
            </div>
          )}
        </div>
      )}

      {associationTracks.length > 0 && (
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
// LAYER 3: TEST RUNNER ENGINE (Patient View & Auto-Grading)
// =========================================================================

// NEW: Interface to support sequence commands
interface VisualAssociationRunnerProps { 
  configuredSlides: AssociationTrial[];
  forcedMode?: string;
  onComplete?: (data: any) => void;
}

export function VisualAssociationRunner({ configuredSlides, forcedMode, onComplete }: VisualAssociationRunnerProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [patientAnswers, setPatientAnswers] = useState<PatientAssociationResponse[]>([]);
  
  const [liveFlag, setLiveFlag] = useState(false);
  const [liveComment, setLiveComment] = useState('');
  
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [startBox, setStartBox] = useState<BoundingBox | null>(null);
  const [currentPoint, setCurrentPoint] = useState<Point | null>(null);
  const [lockedPair, setLockedPair] = useState<[BoundingBox, BoundingBox] | null>(null);

  const activeSlide = configuredSlides[currentIndex];

  useEffect(() => {
    if (!canvasRef.current || !activeSlide) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const img = new Image();
    img.src = activeSlide.imageUrl;
    img.onload = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

      // Draw active dragging line from center of the starting box
      if (isDrawing && startBox && currentPoint) {
        const startX = ((startBox.xPercent + startBox.widthPercent / 2) / 100) * canvas.width;
        const startY = ((startBox.yPercent + startBox.heightPercent / 2) / 100) * canvas.height;

        ctx.beginPath();
        ctx.moveTo(startX, startY);
        ctx.lineTo(currentPoint.x, currentPoint.y);
        ctx.strokeStyle = 'rgba(0, 0, 255, 0.5)';
        ctx.lineWidth = 6;
        ctx.stroke();
      }

      // Draw the LOCKED successful connection
      if (lockedPair) {
        const [boxA, boxB] = lockedPair;
        
        const ax = ((boxA.xPercent + boxA.widthPercent / 2) / 100) * canvas.width;
        const ay = ((boxA.yPercent + boxA.heightPercent / 2) / 100) * canvas.height;
        const bx = ((boxB.xPercent + boxB.widthPercent / 2) / 100) * canvas.width;
        const by = ((boxB.yPercent + boxB.heightPercent / 2) / 100) * canvas.height;

        ctx.beginPath();
        ctx.moveTo(ax, ay);
        ctx.lineTo(bx, by);
        ctx.strokeStyle = '#4CAF50';
        ctx.lineWidth = 8;
        ctx.stroke();

        ctx.fillStyle = 'rgba(76, 175, 80, 0.2)';
        ctx.fillRect((boxA.xPercent/100)*canvas.width, (boxA.yPercent/100)*canvas.height, (boxA.widthPercent/100)*canvas.width, (boxA.heightPercent/100)*canvas.height);
        ctx.fillRect((boxB.xPercent/100)*canvas.width, (boxB.yPercent/100)*canvas.height, (boxB.widthPercent/100)*canvas.width, (boxB.heightPercent/100)*canvas.height);
      }
    };
  }, [currentIndex, activeSlide, isDrawing, currentPoint, lockedPair]);

  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (lockedPair || !canvasRef.current) return; 
    const rect = canvasRef.current.getBoundingClientRect();
    
    const xPct = ((e.clientX - rect.left) / rect.width) * 100;
    const yPct = ((e.clientY - rect.top) / rect.height) * 100;

    const clickedBox = activeSlide.hitboxes.find(box => isPointInPercentBox(xPct, yPct, box));
    if (clickedBox) {
      setStartBox(clickedBox);
      setCurrentPoint({ x: e.clientX - rect.left, y: e.clientY - rect.top });
      setIsDrawing(true);
    }
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDrawing || !canvasRef.current) return;
    const rect = canvasRef.current.getBoundingClientRect();
    setCurrentPoint({ x: e.clientX - rect.left, y: e.clientY - rect.top });
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDrawing || !startBox || !canvasRef.current) return;
    const rect = canvasRef.current.getBoundingClientRect();
    
    const xPct = ((e.clientX - rect.left) / rect.width) * 100;
    const yPct = ((e.clientY - rect.top) / rect.height) * 100;

    const endBox = activeSlide.hitboxes.find(box => isPointInPercentBox(xPct, yPct, box));
    
    if (endBox && endBox.id !== startBox.id) {
      setLockedPair([startBox, endBox]);
    }
    
    setIsDrawing(false);
    setStartBox(null);
    setCurrentPoint(null);
  };

  const proceedToNextStep = () => {
    if (!canvasRef.current) return;
    
    let autoScore: 'Correct!' | 'Incorrect' = 'Incorrect';
    if (lockedPair && activeSlide.correctPair) {
      const patientIds = [lockedPair[0].id, lockedPair[1].id];
      const isMatch = activeSlide.correctPair.every(id => patientIds.includes(id));
      if (isMatch) autoScore = 'Correct!';
    }

    canvasRef.current.toBlob((blob) => {
      const finalResponsePayload: PatientAssociationResponse = {
        trialID: activeSlide.id,
        score: autoScore,
        isFlagged: liveFlag,
        clinicianComment: liveComment,
        patientImageBlob: blob,
        patientImageUrl: blob ? URL.createObjectURL(blob) : null
      };

      const updatedAnswers = [...patientAnswers, finalResponsePayload];
      setPatientAnswers(updatedAnswers);

      setLiveComment('');
      setLiveFlag(false);
      setLockedPair(null); 

      if (currentIndex < configuredSlides.length - 1) {
        setCurrentIndex((prev) => prev + 1);
      } else {
        // NEW: Check if running within a sequence, pass data upward if true
        if (onComplete) {
          onComplete({
            testType: 'Visual Association',
            results: updatedAnswers
          });
        } else {
          alert("Visual Association Test Complete!");
        }
      }
    }, 'image/png');
  };

  const isLastSlide = currentIndex === configuredSlides.length - 1;

  return (
    <div style={{ padding: '20px', border: '2px solid darkblue', marginTop: '20px' }}>
      <h2>Layer 3: Patient Testing Engine</h2>
      
      <div style={{ textAlign: 'center', backgroundColor: '#f0f0f0', padding: '20px' }}>
        <p style={{ fontWeight: 'bold' }}>Patient View: (Draw a line connecting the correct items)</p>
        <canvas 
          ref={canvasRef} width={800} height={450} 
          style={{ border: '2px solid #ccc', cursor: 'crosshair', backgroundColor: 'white', maxWidth: '100%', touchAction: 'none' }}
          onPointerDown={handlePointerDown} onPointerMove={handlePointerMove} onPointerUp={handlePointerUp}
        />
      </div>

      <div style={{ marginTop: '20px', padding: '15px', backgroundColor: '#eef8ff' }}>
        <h3>Clinician Live Auto-Grader Panel</h3>
        <p><strong>Calculated System Score:</strong> {lockedPair ? (activeSlide.correctPair?.every(id => [lockedPair[0].id, lockedPair[1].id].includes(id)) ? '✅ Correct Match' : '❌ Incorrect Match') : 'Waiting for patient...'}</p>
        
        <label><input type="checkbox" checked={liveFlag} onChange={(e) => setLiveFlag(e.target.checked)} /> Flag Trial</label>
        <textarea value={liveComment} onChange={(e) => setLiveComment(e.target.value)} placeholder="Observations..." style={{ width: '100%', marginTop: '10px' }}/>
        
        {/* NEW: Dynamic Button Text based on test position */}
        <button onClick={proceedToNextStep} style={{ width: '100%', padding: '12px', marginTop: '10px', backgroundColor: 'darkblue', color: 'white', fontWeight: 'bold', cursor: 'pointer' }}>
          {!isLastSlide ? 'Next Slide' : (onComplete ? 'Submit & Continue Sequence →' : 'Finish Test')}
        </button>
      </div>
    </div>
  );
}