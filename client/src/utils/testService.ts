const API_URL = 'https://leviva-backend.onrender.com';

export async function saveTestConfig(testData: any, testId?: string) {
  try {
    const url = testId 
      ? `${API_URL}/api/tests/${testId}`
      : `${API_URL}/api/tests`;
      
    const method = testId ? 'PUT' : 'POST';

    const response = await fetch(url, {
      method: method,
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(testData),
    });

    if (!response.ok) {
      throw new Error('Failed to save test configuration');
    }

    const savedTest = await response.json();
    console.log('✅ Test saved successfully to MongoDB:', savedTest);
    return savedTest;
  } catch (error) {
    console.error('❌ Error saving test:', error);
  }
}