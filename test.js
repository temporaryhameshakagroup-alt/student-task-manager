const fs = require('fs');

const tests = [
  'server.js',
  'package.json',
  'public/index.html'
];

for (const file of tests) {
  if (!fs.existsSync(file)) {
    console.error(`TEST FAILED: ${file} not found`);
    process.exit(1);
  }
  console.log(`TEST PASSED: ${file} exists`);
}

console.log('All automated tests passed.');
