import fetch from 'node-fetch';
import grpc from '@grpc/grpc-js';
import protoLoader from '@grpc/proto-loader';
import fs from 'fs';
import dotenv from 'dotenv';

// Load .env
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

// Use the party from your .env
const partyId = process.env.EMPLOYER_PARTY_ID;
const packageId = '0ed64c25cef2a020bdbcb0cf332cbb87feeead35549bb0ac9a119085635c9236';

console.log('\n📝 Creating Employee contract...');
console.log(`Party ID: ${partyId}`);
console.log(`Package ID: ${packageId.substring(0, 20)}...`);

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

console.log('\n🚀 Submitting create command...');
client.submitAndWait(request, metadata, (error, response) => {
  if (error) {
    console.error('\n❌ CREATE FAILED');
    console.error('Error:', error.message);
    console.error('Code:', error.code);
    
    // Try to get more details
    if (error.metadata) {
      const details = error.metadata.get('grpc-status-details-bin');
      if (details && details.length > 0) {
        console.error('Details available but binary');
      }
    }
    
    console.log('\n💡 This party may not be connected to a synchronizer.');
    console.log('💡 Or it may not have the right permissions.');
    console.log('\n🔍 Let me try listing what synchronizers are available...');
    process.exit(1);
  }
  
  console.log('\n✅ ✅ ✅ EMPLOYEE CREATED! ✅ ✅ ✅');
  
  const contractId = response.transaction.events[0].created.contract_id;
  console.log(`Contract ID: ${contractId}`);
  
  console.log('\n🎯 Exercising PaySalary choice in 2 seconds...');
  console.log('👀 👀 👀 GET READY TO WATCH YOUR BRIDGE! 👀 👀 👀\n');
  
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
    
    console.log('🚀 Submitting PaySalary exercise...');
    client.submitAndWait(exerciseReq, metadata, (error, response) => {
      if (error) {
        console.error('\n❌ EXERCISE FAILED');
        console.error('Error:', error.message);
        process.exit(1);
      }
      
      console.log('\n🎉 🎉 🎉 🎉 🎉 🎉 🎉 🎉 🎉 🎉');
      console.log('🎉  SUCCESS! PAYMENT REQUEST CREATED!  ��');
      console.log('🎉 🎉 🎉 🎉 🎉 🎉 🎉 🎉 🎉 🎉');
      console.log('\n👀 CHECK YOUR BRIDGE TERMINAL NOW!');
      console.log('You should see:');
      console.log('  - PaymentRequest detected');
      console.log('  - x402 payment execution');
      console.log('  - Payment confirmation back to Canton');
      
      process.exit(0);
    });
  }, 2000);
});
