// Test Auto-Distribution API
// Run this script to test the auto-profit distribution system

const testAutoDistribution = async () => {
  try {
    console.log('🚀 Testing Auto-Profit Distribution System...\n');

    // Test the auto-distribution API endpoint
    const response = await fetch('http://localhost:3000/api/auto-profit-distribution', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      }
    });

    const result = await response.json();

    if (response.ok) {
      console.log('✅ Auto-Distribution API Response:');
      console.log('Success:', result.success);
      console.log('Message:', result.message);
      console.log('Execution Time:', result.executionTimeMs + 'ms');
      console.log('Distribution Types:', result.distributionTypes);
      console.log('Timestamp:', result.timestamp);
    } else {
      console.log('❌ Auto-Distribution API Error:');
      console.log('Success:', result.success);
      console.log('Error:', result.error);
      console.log('Timestamp:', result.timestamp);
    }

  } catch (error) {
    console.error('❌ Network Error:', error.message);
    console.log('\n💡 Make sure your Next.js server is running on localhost:3000');
    console.log('   Run: npm run dev');
  }
};

// Alternative test using curl command
const showCurlCommand = () => {
  console.log('\n📋 Alternative: Test using curl command:');
  console.log('curl -X POST http://localhost:3000/api/auto-profit-distribution');
  console.log('\n📋 Or test the GET endpoint for status:');
  console.log('curl -X GET http://localhost:3000/api/auto-profit-distribution');
};

// Run the test
testAutoDistribution().then(() => {
  showCurlCommand();
}).catch((error) => {
  console.error('Test failed:', error);
  showCurlCommand();
});
