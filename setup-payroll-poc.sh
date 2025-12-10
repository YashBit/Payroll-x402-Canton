#!/bin/bash
# setup-payroll-poc.sh
# Simple PayRoll PoC Setup Script

set -e  # Exit on error

echo "================================================"
echo "Canton + AP2 PayRoll PoC - Simple Setup"
echo "================================================"
echo ""

# Navigate to your project directory
cd /Users/yashbharti/Desktop/Engineering/core_projects/canton/canton_googleAP2

echo "✓ Step 1: Creating PayRoll directory structure..."
mkdir -p daml/PayRoll
mkdir -p docs/poc
mkdir -p integration-service

echo "✓ Step 2: Creating simple Daml templates..."

# Employee Template
cat > daml/PayRoll/Employee.daml << 'EOF'
module PayRoll.Employee where

import DA.Date

template Employee
  with
    employer : Party
    employeeId : Text
    salary : Decimal
  where
    signatory employer

    choice PaySalary : ContractId PaymentRequest
      controller employer
      do
        currentTime <- getTime
        create PaymentRequest with
          employer
          employeeId
          amount = salary
          requestTime = currentTime

template PaymentRequest
  with
    employer : Party
    employeeId : Text
    amount : Decimal
    requestTime : Time
  where
    signatory employer

    choice ConfirmPayment : ContractId PaymentConfirmation
      with
        transactionHash : Text
      controller employer
      do
        create PaymentConfirmation with
          employer
          employeeId
          amount
          transactionHash

template PaymentConfirmation
  with
    employer : Party
    employeeId : Text
    amount : Decimal
    transactionHash : Text
  where
    signatory employer
EOF

echo "✓ Step 3: Creating/updating daml.yaml..."

# Check if daml.yaml exists
if [ ! -f "daml.yaml" ]; then
    echo "Creating new daml.yaml..."
    cat > daml.yaml << 'EOF'
sdk-version: 3.4.8
name: payroll-poc
version: 1.0.0
source: daml
dependencies:
  - daml-prim
  - daml-stdlib
exposed-modules:
  - PayRoll.Employee
EOF
else
    echo "daml.yaml exists, backing up..."
    cp daml.yaml daml.yaml.backup
    # Add exposed-modules if not present
    if ! grep -q "PayRoll.Employee" daml.yaml; then
        echo "" >> daml.yaml
        echo "exposed-modules:" >> daml.yaml
        echo "  - PayRoll.Employee" >> daml.yaml
    fi
fi

echo "✓ Step 4: Creating PoC documentation..."

cat > docs/poc/README.md << 'EOF'
# Canton + AP2 PayRoll PoC

## Simple Flow
1. Create Employee contract with salary
2. Exercise PaySalary choice → creates PaymentRequest
3. Integration service captures PaymentRequest event
4. Service generates AP2 Intent Mandate
5. AP2 executes USDC payment
6. Service exercises ConfirmPayment → creates PaymentConfirmation

## Components
- `daml/PayRoll/Employee.daml` - Single file with all templates
- `integration-service/` - AP2 integration (Week 3-4)
- Canton Sandbox - For testing Daml templates

## Quick Start

### Build
```bash
daml build
```

### Test with Daml Sandbox
```bash
# Terminal 1: Start sandbox
daml sandbox

# Terminal 2: Run test script
daml script --dar .daml/dist/payroll-poc-1.0.0.dar --script-name Main:test
```

### Test with Canton Console (from cn-quickstart)
```bash
cd ../cn-quickstart/quickstart
make start
make canton-console

# Upload this DAR
daml ledger upload-dar --host localhost --port 2901 \
  ../../canton_googleAP2/.daml/dist/payroll-poc-1.0.0.dar
```

## Week 1 Status: ✓ Environment Setup Complete
EOF

cat > docs/poc/DEMO_SCRIPT.md << 'EOF'
# PoC Demo Script

## Option 1: Daml Sandbox (Simplest)

### Setup (2 min)
```bash
cd /Users/yashbharti/Desktop/Engineering/core_projects/canton/canton_googleAP2
daml build
daml sandbox
```

### Demo with Daml Script
Create `daml/Test.daml`:
```daml
module Test where

import PayRoll.Employee
import Daml.Script

test = script do
  -- Setup parties
  employer <- allocateParty "AcmePayroll"
  
  -- Create employee
  empCid <- submit employer do
    createCmd Employee with
      employer
      employeeId = "EMP001"
      salary = 5000.0
  
  -- Pay salary
  payReqCid <- submit employer do
    exerciseCmd empCid PaySalary
  
  -- Confirm payment
  confirmCid <- submit employer do
    exerciseCmd payReqCid ConfirmPayment with
      transactionHash = "0xtest123"
  
  -- Query results
  confirmations <- query @PaymentConfirmation employer
  debug confirmations
  
  return ()
```

Run: `daml test`

## Option 2: Canton Console (Full Network)

### Setup (5 min)
```bash
# Build your DAR
cd /Users/yashbharti/Desktop/Engineering/core_projects/canton/canton_googleAP2
daml build

# Start Canton
cd ../cn-quickstart/quickstart
make start
make canton-console
```

### Upload DAR
```scala
sandbox.dars.upload("../../canton_googleAP2/.daml/dist/payroll-poc-1.0.0.dar")
```

### Demo Flow
```scala
// Create employer party
val employer = sandbox.parties.enable("AcmePayroll")

// Create employee
val emp1 = sandbox.ledger.submit(employer, 
  Employee(employer, "EMP001", 5000.0).create
).contractId

// Pay salary
val paymentReq = sandbox.ledger.exercise(employer, emp1, "PaySalary", ())

// Confirm payment
sandbox.ledger.exercise(employer, paymentReq.contractId, 
  "ConfirmPayment", Map("transactionHash" -> "0xtest123")
)

// Query confirmations
sandbox.ledger.query(employer).filter(_.templateId.entityName == "PaymentConfirmation")
```
EOF

cat > docs/poc/QUICKSTART.md << 'EOF'
# Quick Start Guide

## Fastest Path to Testing

### 1. Build
```bash
cd /Users/yashbharti/Desktop/Engineering/core_projects/canton/canton_googleAP2
daml build
```

### 2. Test Locally
```bash
daml sandbox
```

### 3. Create Simple Test Script
Create `daml/QuickTest.daml`:
```daml
module QuickTest where

import PayRoll.Employee
import Daml.Script

quickTest = script do
  employer <- allocateParty "Employer"
  
  -- Create and pay employee
  emp <- submit employer $ createCmd Employee with
    employer; employeeId = "EMP001"; salary = 5000.0
  
  req <- submit employer $ exerciseCmd emp PaySalary
  
  conf <- submit employer $ exerciseCmd req ConfirmPayment with
    transactionHash = "0x123"
  
  debug "✓ Payment flow complete!"
  return conf
```

### 4. Run Test
```bash
daml test --script-name QuickTest:quickTest
```

## Next Steps
- Week 2: Add more test scenarios
- Week 3: Build integration service
- Week 4: Connect to AP2
EOF

echo "✓ Step 5: Creating integration service placeholder..."

cat > integration-service/package.json << 'EOF'
{
  "name": "payroll-ap2-integration",
  "version": "1.0.0",
  "description": "Simple Canton to AP2 bridge",
  "main": "index.js",
  "scripts": {
    "start": "node index.js"
  },
  "dependencies": {
    "@grpc/grpc-js": "^1.9.0",
    "axios": "^1.6.0"
  }
}
EOF

cat > integration-service/index.js << 'EOF'
// Simple Canton → AP2 Integration
// Week 3-4 Implementation

console.log('PayRoll AP2 Integration Service');
console.log('Project: /Users/yashbharti/Desktop/Engineering/core_projects/canton/canton_googleAP2');
console.log('TODO: Subscribe to PaymentRequest events');
console.log('TODO: Generate AP2 Intent Mandates');
console.log('TODO: Call x402 API for USDC settlement');

// Placeholder for Week 3
EOF

cat > integration-service/.env.example << 'EOF'
CANTON_LEDGER_HOST=localhost:2901
PARTY_ID=your-party-id-here
AP2_API_KEY=your-ap2-key-here
AP2_ENDPOINT=https://sandbox.ap2.example.com
EOF

echo "✓ Step 6: Creating simple test script..."

cat > daml/QuickTest.daml << 'EOF'
module QuickTest where

import PayRoll.Employee
import Daml.Script

quickTest = script do
  employer <- allocateParty "TestEmployer"
  
  -- Create employee with $5000 salary
  empCid <- submit employer $ createCmd Employee with
    employer
    employeeId = "EMP001"
    salary = 5000.0
  
  debug "✓ Employee created"
  
  -- Pay salary
  payReqCid <- submit employer $ exerciseCmd empCid PaySalary
  
  debug "✓ Payment requested"
  
  -- Confirm payment
  confirmCid <- submit employer $ exerciseCmd payReqCid ConfirmPayment with
    transactionHash = "0xtest123abc"
  
  debug "✓ Payment confirmed"
  
  -- Query all confirmations
  confirmations <- query @PaymentConfirmation employer
  debug ("Total confirmations: " <> show (length confirmations))
  
  return ()
EOF

echo "✓ Step 7: Creating Makefile for convenience..."

cat > Makefile << 'EOF'
.PHONY: build test clean sandbox upload

build:
	@echo "Building Daml templates..."
	daml build

test:
	@echo "Running tests..."
	daml test

sandbox:
	@echo "Starting Daml Sandbox..."
	daml sandbox

clean:
	@echo "Cleaning build artifacts..."
	rm -rf .daml/dist

upload:
	@echo "Uploading to Canton (make sure Canton is running)..."
	daml ledger upload-dar --host localhost --port 2901 .daml/dist/payroll-poc-1.0.0.dar

help:
	@echo "Available commands:"
	@echo "  make build    - Build Daml templates"
	@echo "  make test     - Run Daml tests"
	@echo "  make sandbox  - Start local Daml sandbox"
	@echo "  make upload   - Upload DAR to Canton (requires Canton running)"
	@echo "  make clean    - Clean build artifacts"
EOF

echo ""
echo "================================================"
echo "✓ Setup Complete!"
echo "================================================"
echo ""
echo "Your PoC structure:"
echo "  📁 /Users/yashbharti/Desktop/Engineering/core_projects/canton/canton_googleAP2/"
echo "     ├── daml/PayRoll/Employee.daml    - All templates"
echo "     ├── daml/QuickTest.daml           - Simple test"
echo "     ├── docs/poc/                     - Documentation"
echo "     ├── integration-service/          - AP2 integration (Week 3-4)"
echo "     ├── daml.yaml                     - Project config"
echo "     └── Makefile                      - Build commands"
echo ""
echo "Next steps:"
echo "  1. make build          # Compile Daml templates"
echo "  2. make test           # Run QuickTest"
echo "  3. make sandbox        # Start local sandbox (optional)"
echo ""
echo "OR connect to Canton:"
echo "  1. cd ../cn-quickstart/quickstart && make start"
echo "  2. make upload         # Upload your DAR to Canton"
echo ""
echo "Week 1: ✓ COMPLETE"
echo "Week 2: Ready to test templates!"
echo ""