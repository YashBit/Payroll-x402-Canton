import grpc from '@grpc/grpc-js';
import protoLoader from '@grpc/proto-loader';

const protoPath = '/Users/yashbharti/Desktop/Engineering/core_projects/canton/Payroll-x402-Canton/payroll-bridge/proto';
const address = 'localhost:2901';
const token = 'eyJhbGciOiJSUzI1NiIsInR5cCIgOiAiSldUIiwia2lkIiA6ICJlWjdHcm80MHhENkZ4TVQ3U3V4bWp3dmw1LVlaS2lRVU1ITEFlTlFwUmJ3In0.test';

console.log('Step 1: Loading proto...');
const options = {
  keepCase: true,
  longs: String,
  enums: String,
  defaults: true,
  oneofs: true,
  includeDirs: [protoPath]
};

const updateServiceProto = protoLoader.loadSync(
  'com/daml/ledger/api/v2/update_service.proto',
  options
);
console.log('✅ Proto loaded');

console.log('\nStep 2: Loading package definition...');
const updateServiceDef = grpc.loadPackageDefinition(updateServiceProto);
console.log('✅ Package definition loaded');
console.log('Has UpdateService?', !!updateServiceDef.com?.daml?.ledger?.api?.v2?.UpdateService);

console.log('\nStep 3: Creating call credentials...');
try {
  const callCredentials = grpc.credentials.createFromMetadataGenerator((params, callback) => {
    const metadata = new grpc.Metadata();
    metadata.add('authorization', `Bearer ${token}`);
    callback(null, metadata);
  });
  console.log('✅ Call credentials created');
  
  console.log('\nStep 4: Combining credentials...');
  const channelCredentials = grpc.credentials.combineChannelCredentials(
    grpc.credentials.createInsecure(),
    callCredentials
  );
  console.log('✅ Channel credentials combined');
  
  console.log('\nStep 5: Creating gRPC client...');
  const client = new updateServiceDef.com.daml.ledger.api.v2.UpdateService(
    address,
    channelCredentials
  );
  console.log('✅ gRPC client created successfully!');
  console.log('Client type:', typeof client);
  
} catch (error) {
  console.error('❌ Error:', error.message);
  console.error('Stack:', error.stack);
}
