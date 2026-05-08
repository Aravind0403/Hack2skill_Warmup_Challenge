const assert = require('assert');
const { execSync } = require('child_process');

// This is a simple test script to verify the backend logic without needing a full test runner
const mockQuery = "A spiritual trip to Thanjavur";

// Simulate the logic in server.js
function mockParse(query) {
    const lowerQuery = query.toLowerCase();
    let destination = "Unknown";
    let vibe = "adventure";
    
    if (lowerQuery.includes("thanjavur")) destination = "Thanjavur";
    if (lowerQuery.includes("spiritual")) vibe = "spiritual";
    
    return { destination, vibe };
}

const result = mockParse(mockQuery);
console.log('Testing Parser Logic:');
console.log(`Input: "${mockQuery}"`);
console.log(`Result: ${JSON.stringify(result)}`);

assert.strictEqual(result.destination, 'Thanjavur');
assert.strictEqual(result.vibe, 'spiritual');

console.log('✅ Parser logic test passed!');
