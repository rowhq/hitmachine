// Run this to generate a secure API key for mass-buy endpoint
const crypto = require('crypto');

const apiKey = crypto.randomBytes(32).toString('hex');

console.log('Generated API Key for mass-buy endpoint:');
console.log('=========================================');
console.log(apiKey);
console.log('\nAdd this to your .env file:');
console.log(`MASS_BUY_API_KEY=${apiKey}`);
console.log('\nUsage example:');
console.log('POST /api/mass-buy');
console.log('Headers: { "x-api-key": "' + apiKey + '" }');
console.log('Body: { "startIndex": 0, "endIndex": 10 }');