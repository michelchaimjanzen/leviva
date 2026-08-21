import { useState, useEffect, useRef } from 'react';

const API_URL = 'https://leviva-backend.onrender.com';

export function SequenceBuilder({ 
  initialSequence = null, 
  onSaveComplete, 
  onCancel 
}: { 
  initialSequence?: any; 
  onSaveComplete?: () => void; 
  onCancel?: () => void; 
}) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [availableTests, setAvailableTests] = useState<any[]>([]);
  const [steps, setSteps] = useState<any[]>([]);

  const dragItem = useRef<number | null>(null);
  const dragOverItem = useRef<number | null>(null);

  // Auto-fill the form if we are editing an existing sequence
  useEffect(() => {
    if (initialSequence) {
      setTitle(initialSequence.sequenceName || '');
      setDescription(initialSequence.description || '');
      
      const formattedSteps = initialSequence.steps?.map((s: any) => ({
        ...s,
        testId: typeof s.testId === 'object' && s.testId !== null ? s.testId._id : s.testId
      })) || [];
      
      setSteps(formattedSteps);
    }
  }, [initialSequence]);

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
        // TEMP: Dummy token until JWT is wired up
        const token = "temp_local_token"; 
        
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
  }, []);

  // 2. Handlers to add blocks to your sequence
  const addInfoPage = () => {
    setSteps([...steps, { stepType: 'info', infoContent: '', infoContentFemale: '' }]); 
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
      // TEMP: Dummy token until JWT is wired up
      const token = "temp_local_token"; 
      
      // Dynamically choose PUT (update) or POST (create)
      const method = initialSequence ? 'PUT' : 'POST';
      const endpoint = initialSequence 
        ? `${API_URL}/api/sequences/${initialSequence._id}` 
        : `${API_URL}/api/sequences`;

      const response = await fetch(endpoint, {
        method: method,
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}` // Show ID badge!
        },
        body: JSON.stringify(payload)
      });
      
      if (response.ok) {
        const savedData = await response.json();
        alert(`✅ Sequence successfully ${initialSequence ? 'updated' : 'saved'} to the Cloud!`);
        
        if (onSaveComplete) {
          onSaveComplete(); // Jump back to the bank!
        }
        
        const existingLocalSeqs = JSON.parse(localStorage.getItem('leviva_sequenceBank') || '[]');
        if (!initialSequence) {
          const newLocalSeq = {
            _id: savedData._id || `Seq_${Date.now()}`,
            sequenceName: title,
            description,
            steps,
            dateCreated: new Date().toLocaleString()
          };
          localStorage.setItem('leviva_sequenceBank', JSON.stringify([...existingLocalSeqs, newLocalSeq]));
        }

        if (!initialSequence) {
          setSteps([]); 
          setTitle('');
          setDescription('');
        }
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
      <h2>{initialSequence ? 'Edit Sequence' : 'Layer 2: Master Sequence Builder'}</h2>
      
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
              <div style={{ marginLeft: '30px', width: 'calc(100% - 30px)' }}>
                <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '5px' }}>Default / Masculine Instructions:</label>
                <textarea 
                  placeholder="Type instructions here (e.g., 'שים לב...')"
                  value={step.infoContent || ''}
                  onChange={(e) => updateStep(idx, 'infoContent', e.target.value)}
                  style={{ width: '100%', height: '80px', padding: '8px', boxSizing: 'border-box', marginBottom: '15px' }}
                />
                <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '5px', color: 'darkmagenta' }}>Feminine Instructions (Optional):</label>
                <textarea 
                  placeholder="Type feminine instructions here (e.g., 'שימי לב...'). If left blank, the default will be used."
                  value={step.infoContentFemale || ''}
                  onChange={(e) => updateStep(idx, 'infoContentFemale', e.target.value)}
                  style={{ width: '100%', height: '80px', padding: '8px', boxSizing: 'border-box', border: '1px solid darkmagenta' }}
                />
              </div>
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
          {initialSequence ? 'Update Sequence 💾' : 'Save Sequence to Cloud 💾'}
        </button>
      )}
    </div>
  );
}