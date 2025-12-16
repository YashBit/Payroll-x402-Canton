import fetch from 'node-fetch';
import grpc from '@grpc/grpc-js';
import protoLoader from '@grpc/proto-loader';

// Get OAuth2 token
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
  const data = await response.json();
  return data.access_token;
}

console.log('🔐 Getting OAuth2 token...');
const token = await getToken();
console.log('✅ Token obtained');

// Load command service proto
const protoPath = './proto';
const packageDef = protoLoader.loadSync(
  'com/daml/ledger/api/v2/command_service.proto',
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
const CommandService = grpcDef.com.daml.ledger.api.v2.CommandService;

const client = new CommandService('localhost:2901', grpc.credentials.createInsecure());

const metadata = new grpc.Metadata();
metadata.add('authorization', `Bearer ${token}`);

const partyId = 'AcmePayroll::1220d19c5817f45ed90da1c93a7f6d5a20538458aeca7b15dfb9a7d9b30fb435a5b7';
const packageId = '0ed64c25cef2a020bdbcb0cf332cbb87feeead35549bb0ac9a119085635c9236';

console.log('\n📝 Creating Employee contract...');
console.log(`Party: ${partyId}`);
console.log(`Package: ${packageId}`);

// Create Employee - FIXED structure
const createRequest = {
  commands: {
    commands: [{
      command: {
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
              { label: 'salary', value: { numeric: '1000.0' } }
            ]
          }
        }
      }
    }],
    workflow_id: `test-${Date.now()}`,
    application_id: 'payroll-test',
    command_id: `cmd-${Date.now()}`,
    act_as: [partyId],
    submission_id: `sub-${Date.now()}`
  }
};

client.submitAndWait(createRequest, metadata, (error, response) => {
  if (error) {
    console.error('❌ Error creating Employee:', error.message);
    console.error('Full error:', error);
    process.exit(1);
  }
  
  console.log('✅ Employee contract created!');
  const contractId = response.transaction.events[0].created.contract_id;
  console.log(`Contract ID: ${contractId}`);
  
  console.log('\n🎯 Exercising PaySalary choice...');
  console.log('👀 👀 👀 WATCH YOUR BRIDGE TERMINAL NOW! 👀 👀 👀\n');
  
  // Exercise PaySalary - FIXED structure
  const exerciseRequest = {
    commands: {
      commands: [{
        command: {
          exercise: {
            template_id: {
              package_id: packageId,
              module_name: 'PayRoll.Employee',
              entity_name: 'Employee'
            },
            contract_id: contractId,
            choice: 'PaySalary',
            choice_argument: {
              record: { fields: [] }
            }
          }
        }
      }],
      workflow_id: `test-${Date.now()}`,
      application_id: 'payroll-test',
      command_id: `cmd-${Date.now()}`,
      act_as: [partyId],
      submission_id: `sub-${Date.now()}`
    }
  };
  
  client.submitAndWait(exerciseRequest, metadata, (error, response) => {
    if (error) {
      console.error('❌ Error exercising PaySalary:', error.message);
      console.error('Full error:', error);
      process.exit(1);
    }
    
    console.log('\n✅ ✅ ✅ PaymentRequest created! ✅ ✅ ✅');
    console.log('Check your bridge terminal for the payment execution!');
    process.exit(0);
  });
});
