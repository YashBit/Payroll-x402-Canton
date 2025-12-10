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
