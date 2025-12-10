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
