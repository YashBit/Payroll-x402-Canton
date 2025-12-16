import X402Client from './x402/client.js';
import dotenv from 'dotenv';

dotenv.config();

async function testPayment() {
  console.log('🧪 Testing Real x402 Payment Flow\n');
  
  const client = new X402Client();
  
  try {
    console.log('📝 Processing payment for EMP001: $5000...\n');
    
    const result = await client.processPayment('EMP001', 5000.00);
    
    console.log('✅ Payment Successful!\n');
    console.log('Transaction Hash:', result.transactionHash);
    console.log('Block Number:', result.blockNumber);
    console.log('Network:', result.network);
    console.log('Explorer URL:', result.explorerUrl);
    console.log('\n🎉 Real x402 flow working!\n');
    
  } catch (error) {
    console.error('❌ Payment Failed:', error.message);
    process.exit(1);
  }
}

testPayment();