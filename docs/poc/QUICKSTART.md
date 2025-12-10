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
