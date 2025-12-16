import fetch from 'node-fetch';
import grpc from '@grpc/grpc-js';
import protoLoader from '@grpc/proto-loader';
import dotenv from 'dotenv';

dotenv.config();

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

console.log('🔐 Getting token...');
const token = await getToken();
console.log('✅ Token obtained');

const protoPath = './proto';
const packageDef = protoLoader.loadSync(
  'com/daml/ledger/api/v2/command_service.proto',
  { keepCase: true, longs: String, enums: String, defaults: true, oneofs: true, includeDirs: [protoPath] }
);

const grpcDef = grpc.loadPackageDefinition(packageDef);
const CommandService = grpcDef.com.daml.ledger.api.v2.CommandService;
const client = new CommandService('localhost:2901', grpc.credentials.createInsecure());
const metadata = new grpc.Metadata();
metadata.add('authorization', `Bearer ${token}`);

// THIS is the party that works with app-user-validator token
const partyId = 'app_user_quickstart-yashbharti-1::1220d19c5817f45ed90da1c93a7f6d5a20538458aeca7b15dfb9a7d9b30fb435a5b7';
const packageId = '0ed64c25cef2a020bdbcb0cf332cbb87feeead35549bb0ac9a119085635c9236';

console.log('\n📝 IMPORTANT: Using app_user_quickstart party');
console.log('🔧 Your bridge needs to listen to ALL parties, not just AcmePayroll');
console.log('Party ID:', partyId);

// First, let's try to just list active contracts to see if we have access
console.log('\n🧪 Testing access by trying to list packages...');

const testMetadata = new grpc.Metadata();
testMetadata.add('authorization', `Bearer ${token}`);

// Load package service to test
const pkgDef = protoLoader.loadSync(
  'com/daml/ledger/api/v2/package_service.proto',
  { keepCase: true, longs: String, enums: String, defaults: true, oneofs: true, includeDirs: [protoPath] }
);
const pkgGrpc = grpc.loadPackageDefinition(pkgDef);
const PackageService = pkgGrpc.com.daml.ledger.api.v2.PackageService;
const pkgClient = new PackageService('localhost:2901', grpc.credentials.createInsecure());

pkgClient.listPackages({}, testMetadata, (error, response) => {
  if (error) {
    console.error('❌ Cannot even list packages:', error.message);
    console.log('\n💡 The OAuth2 token has NO access to this participant!');
    console.log('💡 Solution: We need to use Canton Console or find the right token.');
    process.exit(1);
  }
  
  console.log(`✅ Can list packages! Found ${response.package_ids.length} packages`);
  console.log('✅ OAuth2 token has SOME access\n');
  
  // Now try to create the contract
  console.log('🚀 Attempting to create Employee contract...\n');
  
  const request = {
    commands: {
      application_id: 'payroll-bridge',
      command_id: `cmd-${Date.now()}`,
      act_as: [partyId],
      commands: [{
        create: {
          template_id: {
            package_id: packageId,
            module_name: 'PayRoll.Employee',
            entity_name: 'Employee'
          },
          create_arguments: {
            fields: [
              { label: 'employer', value: { party: partyId } },
              { label: 'employeeId', value: { text: 'EMP001' } },
              { label: 'salary', value: { numeric: '5000' } }
            ]
          }
        }
      }]
    }
  };
  
  client.submitAndWait(request, metadata, (error, response) => {
    if (error) {
      console.error('❌ CREATE FAILED:', error.message);
      console.error('Error code:', error.code);
      
      if (error.code === 7) {
        console.log('\n💡 PERMISSION_DENIED means:');
        console.log('   - The token can READ but not WRITE');
        console.log('   - OR the party needs to be properly allocated');
        console.log('\n🎯 SOLUTION: Use your QuickTest.daml script instead!');
        console.log('   That script allocates a party with proper permissions.');
      } else if (error.code === 9) {
        console.log('\n💡 NO_SYNCHRONIZER means:');
        console.log('   - The party exists but isn\'t connected to a domain');
        console.log('\n🎯 SOLUTION: Connect party to synchronizer via Canton Console');
      }
      
      process.exit(1);
    }
    
    console.log('🎉 🎉 🎉 SUCCESS! 🎉 🎉 🎉');
    console.log('Employee created!');
    
    const contractId = response.transaction.events[0].created.contract_id;
    console.log(`Contract ID: ${contractId}`);
    
    // Exercise PaySalary
    setTimeout(() => {
      const exerciseReq = {
        commands: {
          application_id: 'payroll-bridge',
          command_id: `cmd-${Date.now()}`,
          act_as: [partyId],
          commands: [{
            exercise: {
              template_id: {
                package_id: packageId,
                module_name: 'PayRoll.Employee',
                entity_name: 'Employee'
              },
              contract_id: contractId,
              choice: 'PaySalary',
              choice_argument: { record: { fields: [] } }
            }
          }]
        }
      };
      
      client.submitAndWait(exerciseReq, metadata, (error) => {
        if (error) {
          console.error('❌ Exercise failed:', error.message);
          process.exit(1);
        }
        
        console.log('\n🎉 PaymentRequest created! Check bridge!');
        process.exit(0);
      });
    }, 2000);
  });
});
