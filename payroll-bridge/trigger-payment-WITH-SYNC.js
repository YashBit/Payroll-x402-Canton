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

const partyId = 'app_user_quickstart-yashbharti-1::1220d19c5817f45ed90da1c93a7f6d5a20538458aeca7b15dfb9a7d9b30fb435a5b7';
const packageId = '0ed64c25cef2a020bdbcb0cf332cbb87feeead35549bb0ac9a119085635c9236';
const synchronizerId = 'global-domain::122018e9c3bc847e0036debbc6fba90f07297a2149bd1e87f5d70dfcb13b4084'; // From Canton console output

console.log('📝 Creating Employee...');
console.log(`Party: ${partyId.substring(0, 30)}...`);
console.log(`Synchronizer: ${synchronizerId.substring(0, 30)}...`);

const request = {
  commands: {
    application_id: 'payroll-test',
    command_id: `cmd-create-${Date.now()}`,
    act_as: [partyId],
    synchronizer_id: synchronizerId,  // ADD THIS!
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
            { label: 'salary', value: { numeric: '1000' } }
          ]
        }
      }
    }]
  }
};

client.submitAndWait(request, metadata, (error, response) => {
  if (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
  
  console.log('✅ Employee created!');
  
  const contractId = response.transaction.events[0].created.contract_id;
  console.log(`Contract ID: ${contractId}`);
  
  console.log('\n🎯 Exercising PaySalary...');
  console.log('👀 👀 👀 WATCH YOUR BRIDGE NOW! 👀 👀 👀\n');
  
  setTimeout(() => {
    const exerciseReq = {
      commands: {
        application_id: 'payroll-test',
        command_id: `cmd-exercise-${Date.now()}`,
        act_as: [partyId],
        synchronizer_id: synchronizerId,  // ADD THIS!
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
    
    client.submitAndWait(exerciseReq, metadata, (error, response) => {
      if (error) {
        console.error('❌ Error exercising:', error.message);
        process.exit(1);
      }
      
      console.log('\n🎉 🎉 🎉 SUCCESS! PaymentRequest Created! 🎉 🎉 🎉');
      console.log('👀 CHECK YOUR BRIDGE TERMINAL NOW!');
      process.exit(0);
    });
  }, 1000);
});
