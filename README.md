# Payroll Integration Service

Bridge between Canton Network and Google AP2 for automated payroll processing.

## Architecture

```
Canton Ledger (gRPC)
    ↓ PaymentRequest created event
EventSubscriber (canton/eventSubscriber.js)
    ↓ Parse event data
MandateGenerator (ap2/mandateGenerator.js)
    ↓ Generate W3C Verifiable Credential
AP2Client (ap2/client.js)
    ↓ Submit to Google AP2 Sandbox
Blockchain Settlement (Base Sepolia)
    ↓ Transaction Hash
CantonLedgerClient (canton/ledgerClient.js)
    ↓ Exercise ConfirmPayment choice
Canton Ledger (PaymentConfirmation created)
```

## Components

### Canton Integration (`canton/`)
- **ledgerClient.js** - gRPC communication with Canton Validator Node
- **eventSubscriber.js** - Subscribe to PaymentRequest creation events

### AP2 Integration (`ap2/`)
- **mandateGenerator.js** - Generate W3C Verifiable Credentials (Intent Mandates)
- **client.js** - Submit mandates to Google AP2 API

### Utilities (`utils/`)
- **logger.js** - Winston-based logging with file + console output

## Setup

### 1. Install Dependencies
```bash
cd integration-service
npm install
```

### 2. Configure Environment
```bash
cp .env.example .env
# Edit .env with your configuration
```

Required variables:
```bash
CANTON_LEDGER_HOST=localhost
CANTON_LEDGER_PORT=2901
CANTON_PARTY_ID=AcmePayroll::122...  # Get from Canton Console

# Week 4: Add AP2 credentials
AP2_ENDPOINT=https://sandbox.ap2.google.com/v1
AP2_API_KEY=your-google-ap2-sandbox-key

# Week 4: Add employee wallet mappings
EMPLOYEE_WALLETS=EMP001:0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb
```

### 3. Generate Key Pair (Week 4)
```bash
mkdir -p keys
openssl genrsa -out keys/employer-signing-key.pem 2048
openssl rsa -in keys/employer-signing-key.pem -pubout -out keys/employer-public-key.pem

# Add to .env
EMPLOYER_PRIVATE_KEY_PATH=./keys/employer-signing-key.pem
```

### 4. Run Service
```bash
npm start
```

Expected output:
```
======================================
  Canton + AP2 Payroll Integration
======================================
Environment: {
  canton: 'localhost:2901',
  ap2Endpoint: 'mock',
  network: 'base-sepolia',
  partyId: 'AcmePayroll::122...'
}
--------------------------------------
Integration service started successfully ✓
Waiting for PaymentRequest events...
```

## Development

### Run with Auto-Reload
```bash
npm run dev  # Uses nodemon
```

### Check Logs
```bash
tail -f logs/integration-service.log
```

### Test Components
```bash
# Test Canton connection
node -e "import('./canton/ledgerClient.js').then(m => new m.default().connect())"

# Test AP2 mandate generation
node -e "import('./ap2/mandateGenerator.js').then(m => {
  const gen = new m.default();
  const mandate = await gen.generateIntentMandate({
    contractId: 'test-123',
    employer: 'TestEmployer',
    employeeId: 'EMP001',
    amount: '5000.0',
    requestTime: new Date().toISOString()
  });
  console.log(mandate);
})"
```

## Implementation Timeline

### Week 3: Canton Integration ✅
- [x] Project scaffolding
- [x] Logger utility
- [x] CantonLedgerClient skeleton
- [x] EventSubscriber skeleton
- [ ] **TODO**: Implement gRPC Ledger API connection
- [ ] **TODO**: Implement transaction stream subscription
- [ ] **TODO**: Implement ConfirmPayment choice exercise

### Week 4: AP2 Integration
- [x] MandateGenerator skeleton
- [x] AP2Client skeleton
- [ ] **TODO**: Load private key from file system
- [ ] **TODO**: Sign W3C VC with jose library
- [ ] **TODO**: Submit mandate to AP2 sandbox
- [ ] **TODO**: Parse AP2 response + txHash

### Week 5: End-to-End Testing
- [ ] **TODO**: Test with real Canton Quickstart
- [ ] **TODO**: Test with real AP2 sandbox
- [ ] **TODO**: Verify blockchain settlement
- [ ] **TODO**: Confirm Canton receives txHash

## Current Status: Week 3 (Mock Mode)

All components are implemented with mock data. Real gRPC/HTTP calls marked with `Week X TODO`.

### Mock Behavior
- **Canton events**: Not subscribed (returns mock stream)
- **AP2 submission**: Returns mock txHash after 2s delay
- **Payment confirmation**: Returns mock confirmation ID

### Next Steps
1. **Implement gRPC connection** to Canton Ledger API
2. **Test event subscription** with Canton Quickstart
3. **Implement choice exercise** for ConfirmPayment

## Troubleshooting

### "CANTON_PARTY_ID environment variable is required"
Get your employer party ID from Canton Console:
```scala
sandbox> val employer = sandbox.parties.enable("AcmePayroll")
// Copy the party ID from output
```

### "No wallet address configured for employee EMP001"
Add employee wallet mapping to `.env`:
```bash
EMPLOYEE_WALLETS=EMP001:0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb
```

### "Canton Ledger Client connected (mock mode - Week 3 implementation)"
This is expected. gRPC implementation coming in Week 3.

## References

- [Canton Ledger API Docs](https://docs.digitalasset.com/canton/stable/user-manual/apis/ledger-api.html)
- [Google AP2 Protocol](https://cloud.google.com/blog/products/ai-machine-learning/announcing-agents-to-payments-ap2-protocol)
- [W3C Verifiable Credentials](https://www.w3.org/TR/vc-data-model/)
- [jose Library](https://github.com/panva/jose) - JWT signing for Node.js