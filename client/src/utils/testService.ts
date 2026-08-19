export async function saveTestConfig(testData: any, testId?: string) {
  try {
    const url = testId 
      ? `http://localhost:3000/api/tests/${testId}` 
      : 'http://localhost:3000/api/tests';
      
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