# Canton Network × x402 Protocol - Micropayments Bridge

## 🎯 Project Vision

**Privacy-preserving micropayments powered by Canton's institutional ledger and x402's HTTP 402 protocol.**

This project demonstrates how Canton Network's atomic settlement and granular privacy can be combined with x402's programmable HTTP micropayments to enable:

- **Instant cross-border payroll** with privacy-preserving salary records
- **Per-transaction settlements** with cryptographic payment proofs
- **Regulatory compliance** through auditable on-chain confirmations
- **Machine-to-machine payments** with automatic retry and reconciliation

---

## 🏗️ What We're Building

### Core Innovation: Event-Driven Micropayments

```
Canton Ledger Event → x402 HTTP 402 Payment → On-Chain Confirmation
        ↓                       ↓                        ↓
  PaymentRequest          USDC Transfer          PaymentConfirmation
   (Private)              (Public Chain)            (Auditable)
```

### Architecture Components

```
┌─────────────────────────────────────────────────────────────┐
│                     CANTON NETWORK                          │
│                                                             │
│  ┌──────────────┐         ┌──────────────┐                │
│  │  Employee    │ PaySalary│ PaymentReq   │                │
│  │  Contract    ├─────────→│  Contract    │                │
│  └──────────────┘         └──────┬───────┘                │
│                                   │                         │
│        Privacy Layer: Only employer sees salary amounts    │
└───────────────────────────────────┼─────────────────────────┘
                                    │ gRPC Event Stream
                                    │ (OAuth2 Authenticated)
                                    ↓
┌─────────────────────────────────────────────────────────────┐
│                  PAYROLL BRIDGE (Node.js)                   │
│                                                             │
│  ┌────────────────────────────────────────────────────┐   │
│  │  Event Subscriber → Payment Handler → Confirmation │   │
│  └────────────────────────────────────────────────────┘   │
│                                                             │
│  • Listens for PaymentRequest creation                     │
│  • Resolves employee wallet addresses                      │
│  • Executes x402 payment flow                              │
│  • Writes confirmation back to Canton                      │
└───────────────────────────────────┼─────────────────────────┘
                                    │ HTTP 402 Protocol
                                    ↓
┌─────────────────────────────────────────────────────────────┐
│                  X402 SETTLEMENT LAYER                      │
│                                                             │
│  1. POST /transfer → 402 Payment Required                  │
│  2. Sign payment with EVM wallet                           │
│  3. Retry with PAYMENT-SIGNATURE header                    │
│  4. Receive transaction hash + block number                │
│                                                             │
│  Settlement: USDC on Base Sepolia (EVM L2)                │
└───────────────────────────────────┼─────────────────────────┘
                                    │ On-Chain Confirmation
                                    ↓
┌─────────────────────────────────────────────────────────────┐
│                  CANTON CONFIRMATION LOOP                   │
│                                                             │
│  Bridge submits ConfirmPayment choice with tx hash         │
│  → Creates immutable PaymentConfirmation contract          │
│  → Archives PaymentRequest (prevents double-payment)       │
│  → Provides cryptographic audit trail                      │
└─────────────────────────────────────────────────────────────┘
```

---

## 🔑 Key Features

### 1. **Canton Network Privacy**
- Employee contracts visible only to employer (signatory)
- Salary amounts never exposed to public chain
- Payment requests contain minimal data for off-chain settlement
- Confirmation loop creates immutable audit records

### 2. **x402 HTTP 402 Protocol**
- Standards-based micropayment protocol (RFC 9110)
- EVM wallet signing for payment authorization
- Automatic retry with signed payment credentials
- Native USDC settlement on EVM L2s (Base, Polygon, etc.)

### 3. **Event-Driven Architecture**
- Real-time gRPC event streaming from Canton
- OAuth2-authenticated participant node access
- Automatic token refresh on expiry
- Idempotent payment processing

### 4. **Atomic Settlement**
- PaymentRequest creation triggers instant payment
- Transaction hash recorded on Canton
- Double-payment prevention via contract archival
- Cryptographic proof linking on-chain and off-chain

---

## 📦 Technology Stack

### Canton Network Layer
- **Runtime:** Canton Validator Node (Quickstart)
- **Smart Contracts:** Daml SDK 3.x
- **Templates:** Employee, PaymentRequest, PaymentConfirmation
- **Privacy:** Signatory-based visibility control

### Bridge Layer
- **Runtime:** Node.js 20+
- **Protocol:** gRPC (Canton) + HTTP 402 (x402)
- **Auth:** OAuth2 (Keycloak) + EVM signing (viem)
- **Transport:** @grpc/grpc-js + node-fetch

### Settlement Layer
- **Protocol:** x402 HTTP 402
- **Network:** Base Sepolia (EVM L2)
- **Currency:** USDC stablecoin
- **Wallet:** EVM-compatible (viem accounts)

---

## 🔄 Payment Flow (Technical)

### Step 1: Canton Contract Creation
```daml
-- Employer creates Employee contract
create Employee with
  employer = AcmePayroll
  employeeId = "EMP001"
  salary = 5000.00

-- Employer exercises PaySalary choice
exercise employeeContractId PaySalary
  -- Creates PaymentRequest with:
  --   employer, employeeId, amount, requestTime
```

### Step 2: Bridge Detection
```javascript
// Real-time gRPC stream with OAuth2
const metadata = new grpc.Metadata();
metadata.add('authorization', `Bearer ${accessToken}`);

updateServiceClient.getUpdates(request, metadata)
  .on('data', (update) => {
    // Parse PaymentRequest creation event
    const paymentRequest = parseCreatedEvent(update);
    
    // Extract: contractId, employeeId, amount
    handlePaymentRequest(paymentRequest);
  });
```

### Step 3: x402 Payment Execution
```javascript
// Step 3a: Initial request (expect 402)
const response = await fetch(`${x402Endpoint}/transfer`, {
  method: 'POST',
  body: JSON.stringify({
    recipient: '0x742d35Cc...',
    amount: '5000.00',
    currency: 'USDC',
    network: 'eip155:84532'
  })
});

// Step 3b: Response 402 Payment Required
const paymentRequired = await response.json();
// { price: 0.01, payTo: '0xService...', currency: 'USDC', network: '...' }

// Step 3c: Sign payment with EVM wallet
const signature = await account.signMessage({
  message: JSON.stringify(paymentRequired)
});

// Step 3d: Retry with signature
const finalResponse = await fetch(`${x402Endpoint}/transfer`, {
  method: 'POST',
  headers: {
    'PAYMENT-SIGNATURE': signature
  },
  body: JSON.stringify({ /* same payload */ })
});

// Step 3e: Extract transaction hash
const result = await finalResponse.json();
// { transactionHash: '0xabc...', blockNumber: 12345, ... }
```

### Step 4: Canton Confirmation
```javascript
// Submit ConfirmPayment choice
await commandServiceClient.submitAndWait({
  commands: [{
    exercise: {
      template_id: {
        package_id: packageId,
        module_name: 'PayRoll.Employee',
        entity_name: 'PaymentRequest'
      },
      contract_id: paymentRequestContractId,
      choice: 'ConfirmPayment',
      choice_argument: {
        record: {
          fields: [{
            label: 'transactionHash',
            value: { text: '0xabc...' }
          }]
        }
      }
    }
  }],
  act_as: [employerPartyId]
}, metadata);

// Result:
// - PaymentRequest archived (prevents re-processing)
// - PaymentConfirmation created (immutable audit record)
```

---

## 🎯 Why This Matters

### Problem: Traditional Payroll Systems
- **T+1/T+2 settlement delays**
- **No privacy** (salary data exposed to intermediaries)
- **Manual reconciliation** (error-prone, time-consuming)
- **Limited programmability** (static rules, no automation)

### Solution: Canton + x402
- **T+0 atomic settlement** (instant finality)
- **Granular privacy** (salary visible only to employer)
- **Automatic reconciliation** (cryptographic audit trail)
- **Full programmability** (conditional payments, retries, confirmations)

### Use Cases Beyond Payroll
1. **Content Micropayments** - Pay-per-article with privacy
2. **API Metering** - HTTP 402 for API calls with Canton audit
3. **Cross-Border Remittances** - Privacy-preserving international transfers
4. **Supply Chain Settlements** - Atomic delivery vs payment
5. **Freelance Platforms** - Escrow + instant settlement

---

## 📊 Current Implementation Status

### ✅ What's Working
- [x] Canton Validator Node (cn-quickstart running)
- [x] OAuth2 authentication (Keycloak token management)
- [x] gRPC event stream subscription (real-time updates)
- [x] PaymentRequest contract detection
- [x] x402 client with EVM signing
- [x] HTTP 402 payment flow implementation
- [x] Transaction hash extraction
- [x] Confirmation command structure

### ⏳ What's Blocked
- [ ] **Canton write permissions** - Need party with command submission rights
- [ ] **End-to-end test** - Blocked by write permissions

### 🔬 What Needs Testing
- [ ] x402 payment execution (waiting for Canton unblock)
- [ ] Confirmation loop (waiting for payment execution)
- [ ] Error handling (retries, failures, double-payments)
- [ ] Privacy validation (query by different parties)

---

## 🚀 Next Steps

### Immediate (Unblock Development)
1. **Solve Canton write access** via Canton Console
   - Create Employee contract manually
   - Exercise PaySalary choice
   - Verify bridge detects PaymentRequest

2. **Test x402 payment flow**
   - Mock server response (if x402 endpoint unavailable)
   - Verify signature generation
   - Confirm USDC transfer on testnet

3. **Close confirmation loop**
   - Submit ConfirmPayment choice
   - Query PaymentConfirmation contract
   - Validate audit trail

### Follow-Up (Production Hardening)
1. Implement retry logic with exponential backoff
2. Add observability (metrics, tracing, structured logging)
3. Security hardening (secrets management, input validation)
4. Write end-to-end tests
5. Create deployment documentation

---

## 📚 Key Documentation References

### Canton Network
- [Canton Basics](/mnt/project/Canton_Network_-_Basics)
- [DAML Templates](/mnt/project/DAML_-_Template_Structure)
- [Application Design](/mnt/project/Canton_Network_-_Application_Design_Considerations)

### x402 Protocol
- [HTTP 402 Payment Required (RFC 9110)](https://httpwg.org/specs/rfc9110.html#status.402)
- [x402 GitHub Organization](https://github.com/x402)
- [ERC-3009: Transfer With Authorization](https://eips.ethereum.org/EIPS/eip-3009)

---

## 🎓 Project Learnings

### Canton Network
- **Privacy model:** Signatories see contracts, observers see events
- **Authorization:** Party must be signatory or controller to act
- **OAuth2 scopes:** Read ≠ Write in Canton participant nodes
- **Event streaming:** Real-time gRPC with automatic reconnection

### x402 Protocol
- **HTTP 402 flow:** Request → 402 Response → Sign → Retry
- **EVM signing:** Compatible with any viem/ethers.js wallet
- **Network flexibility:** Works on any EVM L2 (Base, Polygon, etc.)
- **Settlement proof:** Transaction hash links on-chain and off-chain

### Integration Patterns
- **Event-driven architecture:** Decouples ledger from payment layer
- **Idempotency:** Contract archival prevents double-processing
- **Atomic confirmation:** Links off-chain payment to on-chain record
- **Privacy preservation:** Minimal data exposure between layers

---

## 🆘 Getting Help

### Canton Support
- Documentation: https://docs.canton.network
- Console: `make canton-console` in quickstart directory
- Daml Shell: Query contracts and inspect ledger

### x402 Support
- Protocol Spec: HTTP 402 Payment Required (RFC 9110)
- EVM Wallets: viem documentation (https://viem.sh)
- Testnet USDC: Base Sepolia faucet

### This Project
- See `/home/claude/ACTION_PLAN.md` for prioritized tasks
- See `/home/claude/SOLVE_WRITE_ACCESS.md` for Canton permissions
- See `/home/claude/canton_console_commands.md` for manual testing

---

*Focus: Privacy-preserving micropayments with institutional-grade infrastructure*  
*Status: 85% complete, blocked on Canton write permissions*  
*Last Updated: December 17, 2025*