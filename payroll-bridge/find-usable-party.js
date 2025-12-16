import fetch from 'node-fetch';
import grpc from '@grpc/grpc-js';
import protoLoader from '@grpc/proto-loader';

async function getToken() {
  const response = await fetch('http://localhost:8082/realms/AppUser/protocol/openid-connect/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: 'app-user-validator',
      client_secret: '6m12QyyGl81d9nABWQXMycZdXho6ejEX',
      grant_type: 'client_credentials',
      audience: 'https://canton.network.global'
    })
  });
  return (await response.json()).access_token;
}

const token = await getToken();
console.log('✅ Token obtained');

const protoPath = './proto';
const packageDef = protoLoader.loadSync(
  'com/daml/ledger/api/v2/party_management_service.proto',
  {
    keepCase: true,
    longs: String,
    enums: String,
    defaults: true,
    oneofs: true,
    includeDirs: [protoPath]
  }
);

const grpcDef = grpc.loadPackageDefinition(packageDef);
const PartyService = grpcDef.com.daml.ledger.api.v2.admin.PartyManagementService;

const client = new PartyService('localhost:2902', grpc.credentials.createInsecure());

const metadata = new grpc.Metadata();
metadata.add('authorization', `Bearer ${token}`);

console.log('\n�� Listing parties accessible with this token...\n');

client.listKnownParties({}, metadata, (error, response) => {
  if (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
  
  console.log('Available parties:');
  response.party_details.forEach(party => {
    console.log(`  - ${party.party}`);
    if (party.display_name) console.log(`    Name: ${party.display_name}`);
    console.log(`    Local: ${party.is_local}`);
  });
  
  console.log('\n💡 Use one of these parties in your test script!');
  process.exit(0);
});
