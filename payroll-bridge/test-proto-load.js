import grpc from '@grpc/grpc-js';
import protoLoader from '@grpc/proto-loader';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const protoPath = path.resolve(__dirname, 'proto');
console.log('Proto path:', protoPath);
console.log('Exists?', fs.existsSync(protoPath));

const updateServiceProto = path.join(protoPath, 'com/daml/ledger/api/v2/update_service.proto');
console.log('Update service proto:', updateServiceProto);
console.log('Exists?', fs.existsSync(updateServiceProto));

try {
  console.log('\nLoading proto...');
  const definition = protoLoader.loadSync(
    'com/daml/ledger/api/v2/update_service.proto',
    {
      keepCase: true,
      longs: String,
      enums: String,
      defaults: true,
      oneofs: true,
      includeDirs: [protoPath]
    }
  );
  
  console.log('✅ Proto loaded successfully!');
  console.log('Keys:', Object.keys(definition));
  
  const proto = grpc.loadPackageDefinition(definition);
  console.log('✅ gRPC package loaded!');
  console.log('Has UpdateService?', !!proto.com?.daml?.ledger?.api?.v2?.UpdateService);
  
} catch (error) {
  console.error('❌ Error:', error.message);
  console.error('Full error:', error);
}
