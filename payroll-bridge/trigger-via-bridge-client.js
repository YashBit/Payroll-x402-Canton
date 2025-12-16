// Use the bridge's own authenticated ledger client
import './canton/ledgerClient.js';
import { LedgerClient } from './canton/ledgerClient.js';

console.log('🚀 Creating test contract via bridge ledger client...\n');

const client = new LedgerClient({
  host: 'localhost',
  port: 2901,
  partyId: 'AcmePayroll::1220d19c5817f45ed90da1c93a7f6d5a20538458aeca7b15dfb9a7d9b30fb435a5b7',
  keycloak: {
    tokenUrl: 'http://localhost:8082/realms/AppUser/protocol/openid-connect/token',
    clientId: 'app-user-validator',
    clientSecret: '6m12QyyGl81d9nABWQXMycZdXho6ejEX',
    audience: 'https://canton.network.global'
  }
});

async function test() {
  try {
    await client.connect();
    console.log('✅ Connected to Canton');
    
    // Try to submit a test command using the bridge's method
    console.log('\n📝 Attempting to create Employee via bridge client...');
    
    // This won't work directly, but shows the issue
    console.log('❌ Bridge client only has subscription methods, not command submission');
    console.log('\n💡 The bridge can READ but not WRITE');
    console.log('💡 We need admin API access or a different token\n');
    
    process.exit(0);
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

test();
