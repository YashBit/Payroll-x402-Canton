import fs from 'fs';

const file = 'canton/ledgerClient.js';
let content = fs.readFileSync(file, 'utf8');

// Find and replace the party filter line
content = content.replace(
  /filter\.filters_by_party\[this\.partyId\] = \{/,
  `filter.filters_by_party = {}; // Listen for ALL parties
  filter.filters_for_any_party = {`
);

fs.writeFileSync(file, content);
console.log('✅ Updated ledgerClient to listen for all parties');
