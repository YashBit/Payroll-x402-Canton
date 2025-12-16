import fs from 'fs';

const file = 'canton/ledgerClient.js';
let content = fs.readFileSync(file, 'utf8');

// Find the filter setup and replace it
const oldPattern = /filter\.filters_by_party\[this\.partyId\] = \{[\s\S]*?\};/;
const newCode = `// Listen for ALL parties (not just one)
    filter.filters_for_any_party = {
      cumulative: {}
    };`;

if (content.match(oldPattern)) {
  content = content.replace(oldPattern, newCode);
  fs.writeFileSync(file, content);
  console.log('✅ Updated bridge to listen for ALL parties');
} else {
  console.log('⚠️  Could not find filter pattern to replace');
  console.log('Manual edit needed in canton/ledgerClient.js');
}
