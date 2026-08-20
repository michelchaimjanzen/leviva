import { useState, useEffect, useRef } from 'react';
import { useAuth } from '@clerk/clerk-react';

const API_URL = 'https://leviva-backend.onrender.com';

export function SequenceBuilder() {
  const { getToken } = useAuth();   
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [availableTests, setAvailableTests] = useState<any[]>([]);
  const [steps, setSteps] = useState<any[]>([]);

  const dragItem = useRef<number | null>(null);
  const dragOverItem = useRef<number | null>(null);

  const handleSort = () => {
    if (dragItem.current !== null && dragOverItem.current !== null) {
      const _steps = [...steps];
      const draggedItemContent = _steps.splice(dragItem.current, 1)[0];
      _steps.splice(dragOverItem.current, 0, draggedItemContent);
      setSteps(_steps);
    }
    dragItem.current = null;
    dragOverItem.current = null;
  };

  // 1. Fetch all your pre-built tests from the database
  useEffect(() => {
    const loadTests = async () => {
      try {
        const token = await getToken(); 
        
        const response = await fetch(`${API_URL}/api/tests`, {
          headers: {
            'Authorization': `Bearer ${token}` 
          }
        });
        
        const data = await response.json();
        
        if (Array.isArray(data)) {
          setAvailableTests(data);
        } else if (data && Array.isArray(data.tests)) {
          setAvailableTests(data.tests);
        } else if (data && Array.isArray(data.data)) {
          setAvailableTests(data.data);
        } else {
          console.error("Backend sent unexpected data format:", data);
          setAvailableTests([]); 
        }
      } catch (err) {
        console.error("Failed to load tests:", err);
      }
    };

    loadTests();
  }, [getToken]);

  // 2. Handlers to add blocks to your sequence
  const addInfoPage = () => {
    setSteps([...steps, { stepType: 'info', infoContent: '' }]);
  };

  const addTestStep = () => {
    setSteps([...steps, { stepType: 'test', testId: '' }]);
  };

  const updateStep = (index: number, field: string, value: string) => {
    const updatedSteps = [...steps];
    updatedSteps[index][field] = value;
    setSteps(updatedSteps);
  };

  const removeStep = (index: number) => {
    const updated = [...steps];
    updated.splice(index, 1);
    setSteps(updated);
  };

  // 3. Save the final Sequence to MongoDB
  const handleSaveSequence = async () => {
    if (!title.trim()) {
      alert("Please give this sequence a title.");
      return;
    }

    const payload = { 
      sequenceName: title, 
      description, 
      steps 
    };

    try {
      const token = await getToken(); // Grab token so the backend allows the save
      const response = await fetch(`${API_URL}/api/sequences`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}` // Show ID badge!
        },
        body: JSON.stringify(payload)
      });
      
      if (response.ok) {
        const savedData = await response.json();
        alert("✅ Sequence successfully saved to the Cloud and Local database!");
        
        const existingLocalSeqs = JSON.parse(localStorage.getItem('leviva_sequenceBank') || '[]');
        const newLocalSeq = {
          _id: savedData._id || `Seq_${Date.now()}`,
          sequenceName: title,
          description,
          steps,
          dateCreated: new Date().toLocaleString()
        };
        localStorage.setItem('leviva_sequenceBank', JSON.stringify([...existingLocalSeqs, newLocalSeq]));

        setSteps([]); 
        setTitle('');
        setDescription('');
      } else {
        alert("❌ Failed to save sequence.");
      }
    } catch (error) {
      console.error("Error saving sequence:", error);
      alert("❌ Could not connect to backend.");
    }
  };

  return (
    <div style={{ padding: '20px', fontFamily: 'sans-serif', maxWidth: '800px', margin: '0 auto' }}>
      <h2>Layer 2: Master Sequence Builder</h2>
      
      <div style={{ backgroundColor: '#f9f9f9', padding: '15px', border: '1px solid #ccc', marginBottom: '20px' }}>
        <input 
          type="text" 
          placeholder="Sequence Title (e.g., 'Full Dyslexia Assessment Battery')"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          style={{ width: '100%', padding: '10px', fontSize: '18px', fontWeight: 'bold', marginBottom: '10px', boxSizing: 'border-box' }}
        />
        <input 
          type="text" 
          placeholder="Brief description..."
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          style={{ width: '100%', padding: '8px', fontSize: '14px', boxSizing: 'border-box' }}
        />
      </div>

      <div style={{ display: 'flex', gap: '10px', marginBottom: '20px' }}>
        <button onClick={addInfoPage} style={{ padding: '10px', backgroundColor: '#e0e0e0', cursor: 'pointer' }}>+ Add Info/Instruction Page</button>
        <button onClick={addTestStep} style={{ padding: '10px', backgroundColor: '#e0e0e0', cursor: 'pointer' }}>+ Add Interactive Test</button>
      </div>

{/* RENDER THE SEQUENCE STEPS */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '15px', marginBottom: '20px' }}>
        {steps.map((step, idx) => (
          <div 
            key={idx} 
            draggable
            onDragStart={() => (dragItem.current = idx)}
            onDragEnter={() => (dragOverItem.current = idx)}
            onDragEnd={handleSort}
            onDragOver={(e) => e.preventDefault()} 
            style={{ 
              padding: '15px', 
              border: '2px solid darkblue', 
              backgroundColor: '#fff', 
              position: 'relative',
              cursor: 'grab' 
            }}
          >
            <div style={{ position: 'absolute', top: '10px', left: '10px', cursor: 'grab', fontSize: '20px', color: '#888' }}>
              ☰
            </div>

            <button onClick={() => removeStep(idx)} style={{ position: 'absolute', top: '10px', right: '10px', color: 'red', cursor: 'pointer' }}>X</button>
            
            <h4 style={{ margin: '0 0 10px 30px' }}>Step {idx + 1}: {step.stepType === 'info' ? 'Information Page' : 'Interactive Test'}</h4>
            
            {step.stepType === 'info' ? (
              <textarea 
                placeholder="Type instructions for the participant here (e.g., 'In this next test, you will...')"
                value={step.infoContent || ''}
                onChange={(e) => updateStep(idx, 'infoContent', e.target.value)}
                style={{ width: '100%', height: '80px', padding: '8px', boxSizing: 'border-box', marginLeft: '30px', width: 'calc(100% - 30px)' }}
              />
            ) : (
              <select 
                value={step.testId || ''}
                onChange={(e) => updateStep(idx, 'testId', e.target.value)}
                style={{ padding: '10px', marginLeft: '30px', width: 'calc(100% - 30px)' }}
              >
                <option value="" disabled>-- Select a test from your bank --</option>
                {availableTests?.map(t => (
                  <option key={t._id} value={t._id}>{t.testName} ({t.testType})</option>
                ))}
              </select>
            )}
          </div>
        ))}
      </div>

      {steps.length > 0 && (
        <button onClick={handleSaveSequence} style={{ width: '100%', padding: '15px', backgroundColor: 'green', color: 'white', fontSize: '18px', fontWeight: 'bold', cursor: 'pointer' }}>
          Save Sequence to Cloud 💾
        </button>
      )}
    </div>
  );
}