import React, { useState, useRef, useEffect } from 'react';
import { extractImagesFromPDF } from '../../utils/pdfExtractor';
import { io, Socket } from 'socket.io-client'; 
import { saveTestConfig } from '../../utils/testService'; 

// =========================================================================
// TYPE DEFINITIONS & MATH ENGINE
// =========================================================================

export interface BoundingBox {
  id: string;
  xPercent: number;
  yPercent: number;
  widthPercent: number;
  heightPercent: number;
}

export interface PolygonPoint {
  xPercent: number;
  yPercent: number;
}

export interface TargetZone {
  id: string;
  type: 'correct' | 'incorrect';
  shapeType: 'rectangle' | 'polygon'; 
  box?: BoundingBox;
  polygon?: { id: string; points: PolygonPoint[] };
}

export interface TargetSlide {
  id: string;
  slideType: 'graded' | 'info'; 
  imageUrl: string;
  infoText?: string;            
  targetZones: TargetZone[];
  timeLimitSeconds?: number | null; 
  selectionMode?: 'single' | 'multiple'; 
  allowBackNavigation?: boolean; // NEW: Toggle for back navigation
}

export interface PatientTargetResponse {
  slideID: string;
  score: string;
  selectedZones: TargetZone[]; 
  reactionTimeMs: number | null; 
  timeSpentOnSlideMs: number | null; 
  isFlagged: boolean;
  clinicianComment: string;
}

interface WorkspaceProps {
  initialData?: any;
  onSave: (configData: TargetSlide[], meta: { title: string, description: string }) => void;
}

export const isPointInZone = (xPct: number, yPct: number, zone: TargetZone) => {
  if (zone.shapeType === 'rectangle' && zone.box) {
    return xPct >= zone.box.xPercent && xPct <= zone.box.xPercent + zone.box.widthPercent &&
           yPct >= zone.box.yPercent && yPct <= zone.box.yPercent + zone.box.heightPercent;
  }
  
  if (zone.shapeType === 'polygon' && zone.polygon) {
    let inside = false;
    const vs = zone.polygon.points;
    for (let i = 0, j = vs.length - 1; i < vs.length; j = i++) {
      const xi = vs[i].xPercent, yi = vs[i].yPercent;
      const xj = vs[j].xPercent, yj = vs[j].yPercent;
      const intersect = ((yi > yPct) !== (yj > yPct)) && (xPct < (xj - xi) * (yPct - yi) / (yj - yi) + xi);
      if (intersect) inside = !inside;
    }
    return inside;
  }
  return false;
};

// =========================================================================
// LAYER 2: WORKSPACE / TARGET CALIBRATION
// =========================================================================
export function VisualTargetWorkspace({ initialData, onSave }: WorkspaceProps) {
  
  const [testTitle, setTestTitle] = useState(initialData?.testName || initialData?.title || '');
  const [testDescription, setTestDescription] = useState(initialData?.description || '');
  
  const [slides, setSlides] = useState<TargetSlide[]>(() => {
    if (initialData?.slides) {
      return initialData.slides.map((s: any): TargetSlide => ({
        id: s._id || `slide_${Date.now()}_${Math.random()}`,
        slideType: s.slideType || (s.targets?.length > 0 ? 'graded' : 'info'),
        imageUrl: s.imageUrl || '',
        infoText: s.infoText || '',
        targetZones: (s.targets || []).map((t: any): TargetZone => {
          const isPoly = !!t.polygonPoints && t.polygonPoints.length > 0;
          return {
            id: t.id || `zone_${Math.random()}`,
            type: t.isCorrect ? 'correct' : 'incorrect',
            shapeType: isPoly ? 'polygon' : 'rectangle',
            box: isPoly ? undefined : {
              id: t.id,
              xPercent: t.x,
              yPercent: t.y,
              widthPercent: t.width || 10,
              heightPercent: t.height || 10,
            },
            polygon: isPoly ? {
              id: t.id,
              points: t.polygonPoints.map((p: any) => ({ xPercent: p.x, yPercent: p.y }))
            } : undefined
          };
        })
      }));
    }
    return initialData?.configData || [];
  });

  const [activeSlideIndex, setActiveSlideIndex] = useState<number | null>(null);

  const firstSlideHasLimit = !!initialData?.configData?.[0]?.timeLimitSeconds || !!initialData?.slides?.[0]?.timeLimitMs;
  const [hasTimeLimit, setHasTimeLimit] = useState<boolean>(firstSlideHasLimit);
  const [timeLimit, setTimeLimit] = useState<number>(
    initialData?.slides?.[0]?.timeLimitMs ? initialData.slides[0].timeLimitMs / 1000 : (initialData?.configData?.[0]?.timeLimitSeconds || 90)
  );
  
  const initialMode = initialData?.configData?.[0]?.selectionMode === 'multiple';
  const [isMultiSelect, setIsMultiSelect] = useState<boolean>(initialMode);

  // NEW: Toggle for back navigation
  const initialBackMode = initialData?.configData?.[0]?.allowBackNavigation === true;
  const [allowBackNavigation, setAllowBackNavigation] = useState<boolean>(initialBackMode);

  const [activeTool, setActiveTool] = useState<'rect' | 'poly' | 'toggle' | 'delete'>('rect');
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  
  const [isDrawingRect, setIsDrawingRect] = useState(false);
  const [startPoint, setStartPoint] = useState<{ x: number; y: number } | null>(null);
  const [currentPoint, setCurrentPoint] = useState<{ x: number; y: number } | null>(null);
  
  const [polyDraft, setPolyDraft] = useState<{x: number, y: number}[]>([]);
  const [mousePos, setMousePos] = useState<{x: number, y: number} | null>(null);
  const [dragItemIndex, setDragItemIndex] = useState<number | null>(null);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    const files = Array.from(e.target.files);
    let newSlides: TargetSlide[] = [];

    for (const file of files) {
      if (file.type === 'application/pdf') {
        const images = await extractImagesFromPDF(file);
        const pdfSlides: TargetSlide[] = images.map((imgData, index) => ({
          id: `slide_${Date.now()}_${index}`, slideType: 'graded', imageUrl: imgData, targetZones: []
        }));
        newSlides = [...newSlides, ...pdfSlides];
      } else {
        newSlides.push({
          id: `slide_${Date.now()}_${file.name}`, slideType: 'graded', imageUrl: URL.createObjectURL(file), targetZones: []
        });
      }
    }
    setSlides(prev => {
        const updated = [...prev, ...newSlides];
        if (prev.length === 0 && updated.length > 0) setActiveSlideIndex(0);
        return updated;
    });
  };

  const toggleSlideType = (idx: number) => {
    const updated = [...slides];
    updated[idx].slideType = updated[idx].slideType === 'info' ? 'graded' : 'info';
    if (updated[idx].slideType === 'info') updated[idx].targetZones = []; 
    setSlides(updated);
  };

  const addBlankInfoPage = () => {
    setSlides(prev => {
      const updated = [...prev, { id: `info_${Date.now()}`, slideType: 'info', imageUrl: '', infoText: '', targetZones: [] }];
      setActiveSlideIndex(updated.length - 1);
      return updated;
    });
  };

  const deleteSlide = (idx: number) => {
    const updated = [...slides];
    updated.splice(idx, 1);
    setSlides(updated);
    if (activeSlideIndex === idx) setActiveSlideIndex(null);
  };

  const moveSlide = (idx: number, direction: 'left' | 'right') => {
    const updated = [...slides];
    if (direction === 'left' && idx > 0) {
      [updated[idx - 1], updated[idx]] = [updated[idx], updated[idx - 1]];
    } else if (direction === 'right' && idx < updated.length - 1) {
      [updated[idx + 1], updated[idx]] = [updated[idx], updated[idx + 1]];
    }
    setSlides(updated);
    setActiveSlideIndex(null);
  };

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

  const handleValidateAndSave = async () => {
    if (!testTitle.trim()) { alert("Please provide a Test Title."); return; }
    if (slides.length === 0) { alert("Please add at least one slide."); return; }
    const gradedSlides = slides.filter(s => s.slideType === 'graded');
    if (gradedSlides.length === 0) { alert("You must have at least one graded test slide."); return; }
    
    const finalSlides = slides.map((s, index) => ({
      slideNumber: index + 1,
      slideType: s.slideType,
      imageUrl: s.imageUrl,
      infoText: s.infoText,
      timeLimitMs: hasTimeLimit ? timeLimit * 1000 : undefined,
      targets: s.targetZones.map(z => ({
        id: z.id,
        x: z.box ? z.box.xPercent : (z.polygon?.points[0]?.xPercent || 0),
        y: z.box ? z.box.yPercent : (z.polygon?.points[0]?.yPercent || 0),
        width: z.box?.widthPercent,
        height: z.box?.heightPercent,
        polygonPoints: z.polygon?.points.map(p => ({ x: p.xPercent, y: p.yPercent })),
        isCorrect: z.type === 'correct'
      }))
    }));

    const testPayload = {
      testName: testTitle,
      testType: "VisualTargetIdentification",
      slides: finalSlides
    };

    await saveTestConfig(testPayload, initialData?._id);

    const mappedSlidesForApp = slides.map(s => ({
      ...s,
      timeLimitSeconds: hasTimeLimit ? timeLimit : null,
      selectionMode: isMultiSelect ? ('multiple' as const) : ('single' as const),
      allowBackNavigation: allowBackNavigation
    }));

    onSave(mappedSlidesForApp, { title: testTitle, description: testDescription });
  };

  const activeSlide = activeSlideIndex !== null ? slides[activeSlideIndex] : null;

  useEffect(() => {
    if (!canvasRef.current || !activeSlide || activeSlide.slideType === 'info') return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const img = new Image();
    img.src = activeSlide.imageUrl;
    img.onload = () => {
      const baseWidth = 800;
      const scaleFactor = baseWidth / img.width;
      canvas.width = baseWidth;
      canvas.height = img.height * scaleFactor;

      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

      activeSlide.targetZones.forEach((zone) => {
        ctx.strokeStyle = zone.type === 'correct' ? 'green' : 'red';
        ctx.lineWidth = 3;
        
        if (zone.shapeType === 'rectangle' && zone.box) {
          const x = (zone.box.xPercent / 100) * canvas.width;
          const y = (zone.box.yPercent / 100) * canvas.height;
          const w = (zone.box.widthPercent / 100) * canvas.width;
          const h = (zone.box.heightPercent / 100) * canvas.height;
          ctx.strokeRect(x, y, w, h);
          ctx.fillStyle = 'black';
          ctx.fillText(zone.type === 'correct' ? '✓ Correct' : '✗ Incorrect', x + 5, y + 15);
        } else if (zone.shapeType === 'polygon' && zone.polygon) {
          ctx.beginPath();
          const pts = zone.polygon.points;
          ctx.moveTo((pts[0].xPercent / 100) * canvas.width, (pts[0].yPercent / 100) * canvas.height);
          for (let i = 1; i < pts.length; i++) {
            ctx.lineTo((pts[i].xPercent / 100) * canvas.width, (pts[i].yPercent / 100) * canvas.height);
          }
          ctx.closePath();
          ctx.stroke();
          ctx.fillStyle = 'black';
          ctx.fillText(zone.type === 'correct' ? '✓ Correct' : '✗ Incorrect', (pts[0].xPercent / 100) * canvas.width + 5, (pts[0].yPercent / 100) * canvas.height + 15);
        }
      });

      if (activeTool === 'rect' && isDrawingRect && startPoint && currentPoint) {
        ctx.strokeStyle = 'blue'; ctx.setLineDash([5, 5]);
        ctx.strokeRect(startPoint.x, startPoint.y, currentPoint.x - startPoint.x, currentPoint.y - startPoint.y);
        ctx.setLineDash([]);
      }

      if (activeTool === 'poly' && polyDraft.length > 0) {
        ctx.strokeStyle = 'blue'; ctx.lineWidth = 2; ctx.setLineDash([5, 5]);
        ctx.beginPath();
        ctx.moveTo(polyDraft[0].x, polyDraft[0].y);
        for(let i=1; i<polyDraft.length; i++) ctx.lineTo(polyDraft[i].x, polyDraft[i].y);
        if (mousePos) ctx.lineTo(mousePos.x, mousePos.y); 
        ctx.stroke();
        ctx.setLineDash([]);
      }
    };
  }, [activeSlide, isDrawingRect, currentPoint, polyDraft, mousePos, slides, activeTool]);

  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!activeSlide || !canvasRef.current || activeSlide.slideType === 'info') return;
    const rect = canvasRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const xPct = (x / rect.width) * 100;
    const yPct = (y / rect.height) * 100;

    if (activeTool === 'toggle' || activeTool === 'delete') {
      const clickedZoneIndex = activeSlide.targetZones.findIndex((z) => isPointInZone(xPct, yPct, z));
      if (clickedZoneIndex !== -1) {
        const updatedSlides = [...slides];
        if (activeTool === 'toggle') {
          updatedSlides[activeSlideIndex!].targetZones[clickedZoneIndex].type = 
            updatedSlides[activeSlideIndex!].targetZones[clickedZoneIndex].type === 'correct' ? 'incorrect' : 'correct';
        } else if (activeTool === 'delete') {
          updatedSlides[activeSlideIndex!].targetZones.splice(clickedZoneIndex, 1);
        }
        setSlides(updatedSlides);
      }
      return;
    }

    if (activeTool === 'poly') { setPolyDraft([...polyDraft, { x, y }]); return; }
    if (activeTool === 'rect') { setStartPoint({ x, y }); setCurrentPoint({ x, y }); setIsDrawingRect(true); }
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!canvasRef.current) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const pos = { x: e.clientX - rect.left, y: e.clientY - rect.top };
    setMousePos(pos);
    if (activeTool === 'rect' && isDrawingRect) setCurrentPoint(pos);
  };

  const handlePointerUp = () => {
    if (activeTool === 'rect' && isDrawingRect && startPoint && currentPoint && canvasRef.current) {
      const rect = canvasRef.current.getBoundingClientRect();
      const newBox: BoundingBox = {
        id: `Box_${Date.now()}`,
        xPercent: (Math.min(startPoint.x, currentPoint.x) / rect.width) * 100,
        yPercent: (Math.min(startPoint.y, currentPoint.y) / rect.height) * 100,
        widthPercent: (Math.abs(currentPoint.x - startPoint.x) / rect.width) * 100,
        heightPercent: (Math.abs(currentPoint.y - startPoint.y) / rect.height) * 100
      };

      if (newBox.widthPercent > 2 && newBox.heightPercent > 2) {
        const newZone: TargetZone = { id: newBox.id, type: 'incorrect', shapeType: 'rectangle', box: newBox };
        const updatedSlides = [...slides];
        updatedSlides[activeSlideIndex!].targetZones.push(newZone);
        setSlides(updatedSlides);
      }
      setIsDrawingRect(false); setStartPoint(null); setCurrentPoint(null);
    }
  };

  const handleDoubleClick = () => {
    if (activeTool === 'poly' && polyDraft.length > 2 && canvasRef.current) {
      const rect = canvasRef.current.getBoundingClientRect();
      const newZone: TargetZone = {
        id: `PolyZone_${Date.now()}`, type: 'incorrect', shapeType: 'polygon',
        polygon: { id: `Poly_${Date.now()}`, points: polyDraft.map(p => ({ xPercent: (p.x / rect.width) * 100, yPercent: (p.y / rect.height) * 100 })) }
      };
      const updatedSlides = [...slides];
      updatedSlides[activeSlideIndex!].targetZones.push(newZone);
      setSlides(updatedSlides);
      setPolyDraft([]); 
    }
  };

  const toolBtnStyle = (tool: string) => ({
    padding: '10px 15px', fontWeight: 'bold', cursor: 'pointer', border: '1px solid #333',
    backgroundColor: activeTool === tool ? 'darkblue' : '#f0f0f0',
    color: activeTool === tool ? 'white' : 'black'
  });

  return (
    <div style={{ padding: '20px', border: '1px solid gray', marginBottom: '20px' }}>
      <h2>Layer 2: Visual Target Calibration</h2>
      
      <div style={{ backgroundColor: '#f9f9f9', padding: '15px', border: '1px solid #ccc', marginBottom: '20px', borderRadius: '4px' }}>
        <input type="text" value={testTitle} onChange={(e) => setTestTitle(e.target.value)} placeholder="Enter Test Title" style={{ width: '100%', padding: '10px', fontSize: '18px', fontWeight: 'bold', marginBottom: '10px', boxSizing: 'border-box' }} />
        <input type="text" value={testDescription} onChange={(e) => setTestDescription(e.target.value)} placeholder="Enter description..." style={{ width: '100%', padding: '8px', fontSize: '14px', boxSizing: 'border-box' }} />
      </div>

      <div style={{ display: 'flex', gap: '20px', marginBottom: '20px', flexWrap: 'wrap' }}>
        <div style={{ backgroundColor: '#e2e3e5', padding: '15px', border: '1px solid #d6d8db', borderRadius: '4px', display: 'flex', alignItems: 'center', gap: '15px', flex: 1 }}>
          <strong>👆 Selection Mode:</strong>
          <label style={{ cursor: 'pointer' }}><input type="radio" checked={!isMultiSelect} onChange={() => setIsMultiSelect(false)} /> Single-Choice</label>
          <label style={{ cursor: 'pointer' }}><input type="radio" checked={isMultiSelect} onChange={() => setIsMultiSelect(true)} /> Multi-Select</label>
        </div>

        {/* NEW: Back Navigation Toggle UI */}
        <div style={{ backgroundColor: '#e2e3e5', padding: '15px', border: '1px solid #d6d8db', borderRadius: '4px', display: 'flex', alignItems: 'center', gap: '15px', flex: 1 }}>
          <strong>⬅️ Back Navigation:</strong>
          <label style={{ cursor: 'pointer' }}><input type="radio" checked={!allowBackNavigation} onChange={() => setAllowBackNavigation(false)} /> Disabled</label>
          <label style={{ cursor: 'pointer' }}><input type="radio" checked={allowBackNavigation} onChange={() => setAllowBackNavigation(true)} /> Allowed</label>
        </div>

        <div style={{ backgroundColor: '#fff3cd', padding: '15px', border: '1px solid #ffeeba', borderRadius: '4px', display: 'flex', alignItems: 'center', gap: '15px', flex: 1 }}>
          <strong>⏱️ Global Time Limit:</strong>
          <label style={{ cursor: 'pointer' }}><input type="radio" checked={!hasTimeLimit} onChange={() => setHasTimeLimit(false)} /> No Limit</label>
          <label style={{ cursor: 'pointer' }}><input type="radio" checked={hasTimeLimit} onChange={() => setHasTimeLimit(true)} /> Set Limit</label>
          {hasTimeLimit && (
            <span style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
              <input type="number" value={timeLimit} onChange={(e) => setTimeLimit(Number(e.target.value))} style={{ width: '60px', padding: '5px', textAlign: 'center' }} /> 
              seconds
            </span>
          )}
        </div>
      </div>

      <div style={{ display: 'flex', gap: '15px', marginBottom: '20px' }}>
        <input type="file" multiple accept="image/*, application/pdf" onChange={handleFileUpload} />
        <button onClick={addBlankInfoPage} style={{ padding: '8px', backgroundColor: '#eef8ff', border: '1px solid darkblue', cursor: 'pointer' }}>+ Add Blank Info Page</button>
      </div>

      {slides.length > 0 && (
        <div style={{ marginTop: '20px' }}>
          <div style={{ display: 'flex', gap: '10px', overflowX: 'auto', marginBottom: '20px', paddingBottom: '10px' }}>
            {slides.map((s, idx) => (
              <div 
                key={s.id} 
                draggable
                onDragStart={() => handleDragStart(idx)}
                onDragEnter={() => handleDragEnter(idx)}
                onDragEnd={handleDragEnd}
                onDragOver={(e) => e.preventDefault()}
                style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', opacity: dragItemIndex === idx ? 0.4 : 1, cursor: 'grab' }}
              >
                <div onClick={() => setActiveSlideIndex(idx)} style={{ border: activeSlideIndex === idx ? '3px solid blue' : (s.slideType === 'info' ? '2px dashed orange' : '1px solid #ccc'), padding: '5px', cursor: 'pointer', marginBottom: '5px', backgroundColor: s.slideType === 'info' ? '#fff9e6' : 'white' }}>
                  {s.imageUrl ? <img src={s.imageUrl} alt="thumb" style={{ height: '60px', pointerEvents: 'none' }} /> : <div style={{ height: '60px', width: '80px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '10px', pointerEvents: 'none' }}>Text Page</div>}
                </div>
                <button onClick={() => toggleSlideType(idx)} style={{ fontSize: '10px', padding: '2px 5px', marginBottom: '4px', cursor: 'pointer', backgroundColor: s.slideType === 'info' ? 'orange' : '#ccc', border: 'none' }}>
                  {s.slideType === 'info' ? '📌 Info' : '🎯 Graded'}
                </button>
                <div style={{ display: 'flex', gap: '5px' }}>
                  <button onClick={() => moveSlide(idx, 'left')} disabled={idx === 0} style={{ padding: '2px 8px', fontSize: '12px', fontWeight: 'bold' }}>←</button>
                  <button onClick={() => deleteSlide(idx)} style={{ padding: '2px 8px', fontSize: '12px', color: 'red', fontWeight: 'bold' }}>X</button>
                  <button onClick={() => moveSlide(idx, 'right')} disabled={idx === slides.length - 1} style={{ padding: '2px 8px', fontSize: '12px', fontWeight: 'bold' }}>→</button>
                </div>
              </div>
            ))}
          </div>

          {activeSlide && (
            <div style={{ textAlign: 'center', backgroundColor: '#f0f0f0', padding: '10px' }}>
              {activeSlide.slideType === 'info' ? (
                <div style={{ padding: '20px' }}>
                  <h3>Instruction / Info Page</h3>
                  <textarea value={activeSlide.infoText || ''} onChange={(e) => { const updated = [...slides]; updated[activeSlideIndex!].infoText = e.target.value; setSlides(updated); }} placeholder="Type instructions for the patient here..." style={{ width: '80%', height: '150px', padding: '10px', fontSize: '16px' }} />
                </div>
              ) : (
                <>
                  <div style={{ display: 'flex', justifyContent: 'center', gap: '10px', marginBottom: '15px' }}>
                    <button onClick={() => { setActiveTool('rect'); setPolyDraft([]); }} style={toolBtnStyle('rect')}>🔲 Draw Rectangle</button>
                    <button onClick={() => setActiveTool('poly')} style={toolBtnStyle('poly')}>🛑 Draw Polygon (Double-click to finish)</button>
                    <button onClick={() => { setActiveTool('toggle'); setPolyDraft([]); }} style={toolBtnStyle('toggle')}>👆 Toggle Correct/Incorrect</button>
                    <button onClick={() => { setActiveTool('delete'); setPolyDraft([]); }} style={toolBtnStyle('delete')}>🗑️ Delete Tool</button>
                  </div>
                  
                  <canvas
                    ref={canvasRef} 
                    style={{ border: '2px solid black', cursor: activeTool === 'poly' || activeTool === 'rect' ? 'crosshair' : 'pointer', backgroundColor: 'white', maxWidth: '100%' }}
                    onPointerDown={handlePointerDown} onPointerMove={handlePointerMove} onPointerUp={handlePointerUp} onDoubleClick={handleDoubleClick} 
                  />
                </>
              )}
            </div>
          )}
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
// LAYER 3 & 4: PATIENT TEST RUNNER & DATA OUTPUT
// =========================================================================
interface TargetRunnerProps {
  configuredSlides: TargetSlide[];
  forcedMode?: string;
  onComplete?: (data: any) => void;
}

export function TargetRunnerEngine({ configuredSlides, forcedMode, onComplete }: TargetRunnerProps) {
  const [sessionMode, setSessionMode] = useState<'selection' | 'patient-solo' | 'clinician-solo' | 'synchronized'>(
    forcedMode === 'Patient Solo' ? 'patient-solo' : 'selection'
  );
  const [socket, setSocket] = useState<Socket | null>(null);
  const [syncSetup, setSyncSetup] = useState({ ip: 'localhost:3001', roomId: 'room-123' });
  const [isSyncConnected, setIsSyncConnected] = useState(false);
  const [syncRole, setSyncRole] = useState<'clinician' | 'patient'>('clinician');

  const [currentIndex, setCurrentIndex] = useState(0);
  const [patientAnswers, setPatientAnswers] = useState<PatientTargetResponse[]>([]);
  const [liveFlag, setLiveFlag] = useState(false);
  const [liveComment, setLiveComment] = useState('');
  const [isTestComplete, setIsTestComplete] = useState(false);

  const [selectedZones, setSelectedZones] = useState<TargetZone[]>([]);
  
  const [testStartTime, setTestStartTime] = useState<number | null>(null);
  const slideStartTimeRef = useRef<number>(Date.now());
  const [lastClickTime, setLastClickTime] = useState<number | null>(null);
  const [timeLeft, setTimeLeft] = useState<number | null>(configuredSlides[0]?.timeLimitSeconds || null);

  // NEW: Dictionary to store selections silently before final submission
  const answersMapRef = useRef<Record<string, PatientTargetResponse>>({});

  const activeSlide = configuredSlides[currentIndex];

  useEffect(() => {
    slideStartTimeRef.current = Date.now();
    
    // NEW: When slide changes, load previously stored selections if they exist
    const existingMemory = answersMapRef.current[activeSlide.id];
    setSelectedZones(existingMemory ? existingMemory.selectedZones : []);
    setLastClickTime(existingMemory ? existingMemory.reactionTimeMs : null);
    
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [currentIndex, activeSlide.id]);

  useEffect(() => {
    if (timeLeft === null || isTestComplete || testStartTime === null) return;
    
    if (timeLeft <= 0) {
      alert("Time is up! The test has automatically ended.");
      handleForceEndTest();
      return;
    }
    
    const timerId = setTimeout(() => setTimeLeft(prev => prev !== null ? prev - 1 : null), 1000);
    return () => clearTimeout(timerId);
  }, [timeLeft, isTestComplete, testStartTime]);

  useEffect(() => {
    if (!socket) return;
    const handleSlideChange = (newIndex: number) => {
      setCurrentIndex(newIndex);
      setLiveFlag(false);
      setLiveComment('');
    };
    const handlePatientInteraction = (data: { newSelectedZones: TargetZone[], clickTime: number }) => {
      setSelectedZones(data.newSelectedZones);
      setLastClickTime(data.clickTime);
    };

    socket.on('sync-slide-change', handleSlideChange);
    socket.on('sync-patient-interaction', handlePatientInteraction);

    return () => {
      socket.off('sync-slide-change', handleSlideChange);
      socket.off('sync-patient-interaction', handlePatientInteraction);
    };
  }, [socket]);

  useEffect(() => {
    if (forcedMode === 'Patient Solo') {
      setTestStartTime(Date.now());
    }
  }, [forcedMode]);

  const handleStartTestMode = (mode: 'patient-solo' | 'clinician-solo' | 'synchronized') => {
    setSessionMode(mode);
    if (mode !== 'synchronized') {
      setTestStartTime(Date.now());
    }
  };

  const handleConnectSync = () => {
    const newSocket = io(`http://${syncSetup.ip}`);
    newSocket.on('connect', () => {
      console.log('✅ Connected to Sync Server:', newSocket.id);
      newSocket.emit('join-session', syncSetup.roomId);
      setSocket(newSocket);
      setIsSyncConnected(true);
      setTestStartTime(Date.now()); 
    });
    newSocket.on('connect_error', () => {
      alert(`Connection failed. Make sure the server is running at ${syncSetup.ip}`);
    });
  };

  const handlePatientTap = (e: React.MouseEvent<HTMLImageElement>) => {
    if (activeSlide.slideType === 'info' || isTestComplete) return; 

    const rect = e.currentTarget.getBoundingClientRect();
    const xPct = ((e.clientX - rect.left) / rect.width) * 100;
    const yPct = ((e.clientY - rect.top) / rect.height) * 100;
    
    const hitZone = activeSlide.targetZones.find(z => isPointInZone(xPct, yPct, z));
    
    if (hitZone) {
      const clickTime = Date.now() - slideStartTimeRef.current;
      setLastClickTime(clickTime);

      let updatedZones: TargetZone[] = [];

      if (activeSlide.selectionMode === 'multiple') {
        const isAlreadySelected = selectedZones.find(z => z.id === hitZone.id);
        updatedZones = isAlreadySelected 
          ? selectedZones.filter(z => z.id !== hitZone.id) 
          : [...selectedZones, hitZone];
      } else {
        updatedZones = [hitZone];
      }

      setSelectedZones(updatedZones);
      
      if (socket && sessionMode === 'synchronized' && syncRole === 'patient') {
        socket.emit('patient-interaction', { sessionId: syncSetup.roomId, interactionData: { newSelectedZones: updatedZones, clickTime } });
      }
    }
  };

  // NEW: Extracts the save logic so we can call it when going Forward OR Backward
  const commitCurrentSlideToMemory = () => {
    if (activeSlide.slideType === 'graded') {
      const correctHits = selectedZones.filter(z => z.type === 'correct').length;
      const incorrectHits = selectedZones.filter(z => z.type === 'incorrect').length;
      
      answersMapRef.current[activeSlide.id] = {
        slideID: activeSlide.id,
        score: activeSlide.selectionMode === 'multiple' 
          ? `${correctHits} Correct, ${incorrectHits} Incorrect` 
          : (selectedZones[0]?.type === 'correct' ? 'Correct!' : (selectedZones.length > 0 ? 'Incorrect!' : 'No Answer')),
        selectedZones: selectedZones,
        reactionTimeMs: lastClickTime,
        timeSpentOnSlideMs: Date.now() - slideStartTimeRef.current,
        isFlagged: liveFlag,
        clinicianComment: liveComment,
      };
    }
  };

  const proceedToNextStep = () => {
    commitCurrentSlideToMemory();
    setLiveFlag(false);
    setLiveComment('');

    if (currentIndex < configuredSlides.length - 1) {
      const nextIndex = currentIndex + 1;
      setCurrentIndex(nextIndex);
      
      if (socket && sessionMode === 'synchronized' && syncRole === 'clinician') {
        socket.emit('clinician-slide-change', { sessionId: syncSetup.roomId, newIndex: nextIndex });
      }
   } else {
      // NEW: Build the final array from memory ONLY when the test is completely finished
      const finalAnswersArray = configuredSlides
        .filter(s => s.slideType === 'graded')
        .map(s => answersMapRef.current[s.id])
        .filter(Boolean); // Filter out any undefineds if they skipped something

      setPatientAnswers(finalAnswersArray);
      setIsTestComplete(true);
      
      if (onComplete) {
        onComplete({
          testType: 'Visual Target Identification',
          slideResults: finalAnswersArray
        });
      }
    }
  };

  // NEW: Back Navigation Handler
  const handlePreviousStep = () => {
    commitCurrentSlideToMemory(); // Save progress before moving backwards
    setLiveFlag(false);
    setLiveComment('');

    if (currentIndex > 0) {
      const prevIndex = currentIndex - 1;
      setCurrentIndex(prevIndex);
      if (socket && sessionMode === 'synchronized' && syncRole === 'clinician') {
        socket.emit('clinician-slide-change', { sessionId: syncSetup.roomId, newIndex: prevIndex });
      }
    }
  };

  const handleForceEndTest = () => {
    setIsTestComplete(true);
  };

  const triggerDownload = () => {
    const finalReport = {
      testType: 'Visual Target Identification',
      totalTimeSpentMs: testStartTime ? Date.now() - testStartTime : null,
      timeLimitAppliedSeconds: configuredSlides[0]?.timeLimitSeconds || null,
      slideResults: patientAnswers
    };

    const dataString = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(finalReport, null, 2));
    const anchor = document.createElement('a');
    anchor.href = dataString;
    anchor.download = `patient_target_output_${Date.now()}.json`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
  };

  const btnStyle = { padding: '20px', fontSize: '16px', cursor: 'pointer', backgroundColor: '#eef8ff', border: '2px solid darkblue', borderRadius: '8px', fontWeight: 'bold' };

  if (sessionMode === 'selection') {
    return (
      <div style={{ padding: '40px', textAlign: 'center', fontFamily: 'sans-serif' }}>
        <h2>Select Session Mode</h2>
        <div style={{ display: 'flex', justifyContent: 'center', gap: '20px', marginTop: '30px' }}>
          <button onClick={() => handleStartTestMode('patient-solo')} style={btnStyle}>👤 Patient Solo<br/><small>Self-administered</small></button>
          <button onClick={() => handleStartTestMode('clinician-solo')} style={btnStyle}>🩺 Clinician Solo<br/><small>Shared Screen</small></button>
          <button onClick={() => handleStartTestMode('synchronized')} style={btnStyle}>🔗 Synchronized<br/><small>Cross-device Setup</small></button>
        </div>
      </div>
    );
  }

  if (sessionMode === 'synchronized' && !isSyncConnected) {
    return (
      <div style={{ padding: '40px', textAlign: 'center', fontFamily: 'sans-serif', maxWidth: '500px', margin: '0 auto' }}>
        <h2>🔗 Setup Synchronized Session</h2>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '15px', marginTop: '20px', textAlign: 'left' }}>
          <label><strong>Server IP Address:</strong>
            <input type="text" value={syncSetup.ip} onChange={(e) => setSyncSetup({...syncSetup, ip: e.target.value})} style={{ width: '100%', padding: '10px', marginTop: '5px' }} />
          </label>
          <label><strong>Session Room ID:</strong>
            <input type="text" value={syncSetup.roomId} onChange={(e) => setSyncSetup({...syncSetup, roomId: e.target.value})} style={{ width: '100%', padding: '10px', marginTop: '5px' }} />
          </label>
          <label style={{ marginTop: '10px' }}><strong>I am joining this room as the:</strong>
            <div style={{ display: 'flex', gap: '10px', marginTop: '5px' }}>
              <button onClick={() => setSyncRole('clinician')} style={{ flex: 1, padding: '10px', backgroundColor: syncRole === 'clinician' ? 'darkblue' : '#ccc', color: syncRole === 'clinician' ? 'white' : 'black', fontWeight: 'bold' }}>🩺 Clinician</button>
              <button onClick={() => setSyncRole('patient')} style={{ flex: 1, padding: '10px', backgroundColor: syncRole === 'patient' ? 'green' : '#ccc', color: syncRole === 'patient' ? 'white' : 'black', fontWeight: 'bold' }}>👤 Patient</button>
            </div>
          </label>
          <div style={{ display: 'flex', gap: '10px', marginTop: '15px' }}>
            <button onClick={() => setSessionMode('selection')} style={{ padding: '12px', flex: 1 }}>Cancel</button>
            <button onClick={handleConnectSync} style={{ padding: '12px', flex: 2, backgroundColor: 'darkblue', color: 'white', fontWeight: 'bold' }}>Connect & Join Room</button>
          </div>
        </div>
      </div>
    );
  }

  if (isTestComplete) {
    if (onComplete) return null; 

    if (sessionMode === 'synchronized' && syncRole === 'patient') {
      return (
        <div style={{ padding: '40px', textAlign: 'center', fontFamily: 'sans-serif', border: '2px solid green', marginTop: '20px', backgroundColor: '#f9fff9' }}>
          <h2>Test Complete</h2><p style={{ fontSize: '18px' }}>Thank you. The clinician has received your results.</p>
        </div>
      );
    }
    return (
      <div style={{ padding: '40px', textAlign: 'center', fontFamily: 'sans-serif', border: '2px solid green', marginTop: '20px', backgroundColor: '#f9fff9' }}>
        <h2>Layer 4: Data & Accumulation Services</h2>
        <p style={{ fontSize: '18px' }}>Test sequence complete. ({patientAnswers.length} graded interactions recorded)</p>
        <button onClick={() => triggerDownload()} style={{ padding: '15px 30px', fontSize: '18px', backgroundColor: 'green', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', marginTop: '20px', fontWeight: 'bold' }}>
          📥 Download Raw Diagnostic Output (JSON)
        </button>
      </div>
    );
  }

  return (
    <div style={{ padding: '20px', border: '2px solid darkblue', marginTop: '20px', display: 'flex', flexDirection: 'column', minHeight: '80vh' }}>
      
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
        <h2>Layer 3: Patient Testing Engine</h2>
        <div style={{ display: 'flex', gap: '15px', alignItems: 'center' }}>
          {timeLeft !== null && (
            <div style={{ padding: '10px 15px', backgroundColor: timeLeft <= 15 ? 'darkred' : '#222', color: 'white', borderRadius: '8px', fontWeight: 'bold', fontSize: '18px' }}>
              ⏱️ Time Left: {Math.floor(timeLeft / 60)}:{(timeLeft % 60).toString().padStart(2, '0')}
            </div>
          )}
          {isSyncConnected && <span style={{ padding: '5px 10px', backgroundColor: 'green', color: 'white', borderRadius: '15px', fontSize: '12px', fontWeight: 'bold' }}>🟢 Sync Active: {syncSetup.roomId} ({syncRole})</span>}
        </div>
      </div>
      
      <p>Slide {currentIndex + 1} / {configuredSlides.length}</p>
      
      <div style={{ position: 'relative', textAlign: 'center', backgroundColor: '#f0f0f0', padding: '20px', flexGrow: 1 }}>
        {activeSlide.slideType === 'info' ? (
          <div style={{ padding: '20px' }}>
            {activeSlide.imageUrl && <img src={activeSlide.imageUrl} style={{ maxWidth: '100%', border: '1px solid #ccc', marginBottom: '20px' }} alt="Info" />}
            {activeSlide.infoText && <p style={{ fontSize: '24px', fontWeight: 'bold' }}>{activeSlide.infoText}</p>}
          </div>
        ) : (
          <div>
            <p>Patient View (Tap targets to select/deselect):</p>
            <div style={{ position: 'relative', display: 'inline-block' }}>
              <img src={activeSlide.imageUrl} onClick={handlePatientTap} style={{ maxWidth: '100%', cursor: 'pointer', border: '1px solid #ccc' }} alt="Target" />
              
              {selectedZones.length > 0 && (
                <svg viewBox="0 0 100 100" preserveAspectRatio="none" style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', pointerEvents: 'none' }}>
                  {selectedZones.map((zone) => (
                    <g key={zone.id}>
                      {zone.shapeType === 'rectangle' && zone.box && (
                        <rect x={`${zone.box.xPercent}`} y={`${zone.box.yPercent}`} width={`${zone.box.widthPercent}`} height={`${zone.box.heightPercent}`} fill="rgba(0,0,255,0.2)" stroke="blue" strokeWidth="0.5" />
                      )}
                      {zone.shapeType === 'polygon' && zone.polygon && (
                        <polygon points={zone.polygon.points.map(p => `${p.xPercent},${p.yPercent}`).join(' ')} fill="rgba(0,0,255,0.2)" stroke="blue" strokeWidth="0.5" />
                      )}
                    </g>
                  ))}
                </svg>
              )}
            </div>
          </div>
        )}
      </div>

      <div style={{ position: 'sticky', bottom: '0', zIndex: 10, marginTop: '20px', padding: '15px', backgroundColor: '#eef8ff', borderTop: '2px solid darkblue', boxShadow: '0 -2px 10px rgba(0,0,0,0.1)' }}>
        {activeSlide.slideType === 'info' ? (
          (sessionMode === 'synchronized' && syncRole === 'patient') ? (
            <p style={{ textAlign: 'center', fontSize: '18px', fontWeight: 'bold', margin: 0 }}>Waiting for clinician to advance...</p>
          ) : (
            <div style={{ display: 'flex', gap: '10px' }}>
              {activeSlide.allowBackNavigation && currentIndex > 0 && (
                 <button onClick={handlePreviousStep} style={{ flex: 1, padding: '15px', backgroundColor: '#666', color: 'white', fontSize: '18px', fontWeight: 'bold', cursor: 'pointer', borderRadius: '8px' }}>← Back</button>
              )}
              <button onClick={proceedToNextStep} style={{ flex: activeSlide.allowBackNavigation && currentIndex > 0 ? 2 : 1, padding: '15px', backgroundColor: 'darkblue', color: 'white', fontSize: '18px', fontWeight: 'bold', cursor: 'pointer', borderRadius: '8px' }}>Continue to Next Slide →</button>
            </div>
          )
        ) : (
          <>
            {(sessionMode === 'clinician-solo' || (sessionMode === 'synchronized' && syncRole === 'clinician')) ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span>Targets Selected: <strong>{selectedZones.length}</strong></span>
                  <label><input type="checkbox" checked={liveFlag} onChange={(e) => setLiveFlag(e.target.checked)} /> Flag Trial</label>
                </div>
                <textarea placeholder="Clinician comment..." value={liveComment} onChange={(e) => setLiveComment(e.target.value)} style={{ width: '100%' }}/>
                <div style={{ display: 'flex', gap: '10px', marginTop: '10px' }}>
                  {activeSlide.allowBackNavigation && currentIndex > 0 && (
                    <button onClick={handlePreviousStep} style={{ flex: 1, padding: '12px', backgroundColor: '#666', color: 'white', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' }}>← Back</button>
                  )}
                  <button onClick={proceedToNextStep} style={{ flex: 2, padding: '12px', backgroundColor: 'darkblue', color: 'white', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' }}>Next Slide / Finish</button>
                </div>
              </div>
            ) : (sessionMode === 'synchronized' && syncRole === 'patient') ? (
              <div style={{ textAlign: 'center' }}>
                <p style={{ fontSize: '18px', fontWeight: 'bold', margin: 0 }}>Selections synced. Waiting for clinician...</p>
              </div>
            ) : (
              <div style={{ textAlign: 'center', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontWeight: 'bold', fontSize: '16px' }}>Selected {selectedZones.length} targets.</span>
                <div style={{ display: 'flex', gap: '10px' }}>
                  {activeSlide.allowBackNavigation && currentIndex > 0 && (
                    <button onClick={handlePreviousStep} style={{ padding: '15px 30px', fontSize: '18px', backgroundColor: '#666', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' }}>← Back</button>
                  )}
                  <button onClick={proceedToNextStep} style={{ padding: '15px 30px', fontSize: '18px', backgroundColor: 'green', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' }}>
                    {currentIndex < configuredSlides.length - 1 ? 'Submit & Next Slide →' : 'Submit & Finish'}
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}