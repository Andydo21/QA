const fs = require('fs');
const path = require('path');

// Read test files
const testDir = path.join(__dirname, 'tests/unit');
const testFiles = fs.readdirSync(testDir).filter(f => f.endsWith('.test.js'));

testFiles.forEach(file => {
  console.log(`\n📄 ${file}:`);
  const content = fs.readFileSync(path.join(testDir, file), 'utf8');
  
  // Extract test names using regex
  const testPattern = /it\(['"`](.*?)['"`]/g;
  let match;
  let count = 0;
  
  while ((match = testPattern.exec(content)) !== null) {
    count++;
    console.log(`  ✅ ${count}. ${match[1]}`);
  }
});
