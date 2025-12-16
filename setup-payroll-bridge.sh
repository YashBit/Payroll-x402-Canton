#!/bin/bash

# =====================================================
# Canton + x402 Payroll Bridge - Complete Setup
# =====================================================
# This script creates the entire project structure
# with all necessary files for the PoC
# =====================================================

set -e  # Exit on error

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}======================================"
echo "  Canton + x402 Payroll Bridge Setup"
echo "======================================${NC}"
echo ""

# Check if we're in the right directory
if [ ! -f "daml.yaml" ]; then
    echo -e "${RED}❌ Error: Must run from project root (where daml.yaml is)${NC}"
    exit 1
fi

# Remove old integration-service if exists
if [ -d "integration-service" ]; then
    echo -e "${YELLOW}⚠️  Removing old integration-service directory...${NC}"
    rm -rf integration-service
    echo -e "${GREEN}✓ Removed${NC}"
fi

echo -e "${YELLOW}[1/8] Creating directory structure...${NC}"

# Create main directories
mkdir -p payroll-bridge/utils
mkdir -p payroll-bridge/canton
mkdir -p payroll-bridge/x402
mkdir -p payroll-bridge/logs
mkdir -p x402-mock-server

echo -e "${GREEN}✓ Directories created${NC}"
echo ""

# =====================================================
# File 1: payroll-bridge/package.json
# =====================================================
echo -e "${YELLOW}[2/8] Creating payroll-bridge/package.json...${NC}"

cat > payroll-bridge/package.json << 'EOF'
{
  "name": "canton-x402-payroll-bridge",
  "version": "1.0.0",
  "description": "Bridge service connecting Canton Network smart contracts to x402 stablecoin payments",
  "main": "index.js",
  "type": "module",
  "scripts": {
    "start": "node index.js",
    "dev": "nodemon index.js",
    "test": "node --test"
  },
  "keywords": ["canton", "x402", "payroll", "daml", "blockchain", "stablecoin"],
  "author": "Yash Bharti",
  "license": "ISC",
  "dependencies": {
    "@daml/ledger": "^2.8.0",
    "@grpc/grpc-js": "^1.9.0",
    "@grpc/proto-loader": "^0.7.10",
    "@x402/fetch": "^2.0.0",
    "@x402/evm": "^2.0.0",
    "@x402/core": "^2.0.0",
    "viem": "^2.0.0",
    "dotenv": "^16.3.1",
    "winston": "^3.11.0"
  },
  "devDependencies": {
    "nodemon": "^3.0.2"
  },
  "engines": {
    "node": ">=20.0.0"
  }
}
EOF

echo -e "${GREEN}✓ package.json created${NC}"

# =====================================================
# File 2: payroll-bridge/.env
# =====================================================
echo -e "${YELLOW}[3/8] Creating payroll-bridge/.env...${NC}"

cat > payroll-bridge/.env << 'EOF'
# =====================================================
# Canton + x402 Payroll Bridge - TEST CONFIGURATION
# =====================================================
# WARNING: These are DUMMY values for PoC testing only
# DO NOT use these keys/addresses in production
# =====================================================

# ===========================
# Canton Network Configuration
# ===========================
CANTON_LEDGER_HOST=localhost
CANTON_LEDGER_PORT=2901

# TODO: Replace with your actual party ID from Canton Console
# Get this by running: cd ../cn-quickstart/quickstart && make canton-console
# Then: val employer = sandbox.parties.enable("AcmePayroll")
CANTON_PARTY_ID=AcmePayroll::122abc456def789poc000000000000000000000000000000000000000

# ===========================
# x402 Configuration
# ===========================
# Localhost mock settlement endpoint
X402_SETTLEMENT_ENDPOINT=http://localhost:3402

# Base Sepolia TESTNET (CAIP-2 format)
X402_NETWORK=eip155:84532

# ===========================
# EVM Wallet Configuration (DUMMY)
# ===========================
# DUMMY private key for testing (DO NOT USE IN PRODUCTION)
EVM_PRIVATE_KEY=0x0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef

# ===========================
# Employee Wallet Mapping (DUMMY)
# ===========================
EMPLOYEE_WALLETS=EMP001:0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb,EMP002:0x1234567890123456789012345678901234567890,EMP003:0xabcdefabcdefabcdefabcdefabcdefabcdefabcd

# ===========================
# Logging Configuration
# ===========================
LOG_LEVEL=debug
LOG_FILE=./logs/payroll-bridge.log

# ===========================
# Service Configuration
# ===========================
POLL_INTERVAL_MS=5000
EOF

echo -e "${GREEN}✓ .env created${NC}"

# =====================================================
# File 3: payroll-bridge/.gitignore
# =====================================================
echo -e "${YELLOW}[4/8] Creating payroll-bridge/.gitignore...${NC}"

cat > payroll-bridge/.gitignore << 'EOF'
# Dependencies
node_modules/

# Environment
.env
.env.local
.env.*.local

# Logs
logs/
*.log

# IDE
.vscode/
.idea/

# OS
.DS_Store
Thumbs.db

# Test
coverage/
.nyc_output/
EOF

echo -e "${GREEN}✓ .gitignore created${NC}"

# =====================================================
# File 4: payroll-bridge/utils/logger.js
# =====================================================
echo -e "${YELLOW}[5/8] Creating payroll-bridge/utils/logger.js...${NC}"

cat > payroll-bridge/utils/logger.js << 'EOF'
import winston from 'winston';
import dotenv from 'dotenv';

dotenv.config();

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    winston.format.errors({ stack: true }),
    winston.format.splat(),
    winston.format.json()
  ),
  defaultMeta: { service: 'payroll-bridge' },
  transports: [
    // Write all logs to console
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.printf(({ timestamp, level, message, ...meta }) => {
          let msg = `${timestamp} [${level}]: ${message}`;
          if (Object.keys(meta).length > 0 && meta.service !== 'payroll-bridge') {
            msg += ` ${JSON.stringify(meta)}`;
          }
          return msg;
        })
      )
    }),
    // Write all logs with level 'info' and below to file
    new winston.transports.File({ 
      filename: process.env.LOG_FILE || './logs/payroll-bridge.log',
      format: winston.format.json()
    })
  ]
});

export default logger;
EOF

echo -e "${GREEN}✓ logger.js created${NC}"

# =====================================================
# File 5: payroll-bridge/canton/ledgerClient.js
# =====================================================
echo -e "${YELLOW}[6/8] Creating payroll-bridge/canton/ledgerClient.js...${NC}"

cat > payroll-bridge/canton/ledgerClient.js << 'EOF'
import grpc from '@grpc/grpc-js';
import protoLoader from '@grpc/proto-loader';
import logger from '../utils/logger.js';
import dotenv from 'dotenv';

dotenv.config();

/**
 * Canton Ledger Client
 * Handles gRPC communication with Canton Validator Node
 */
class CantonLedgerClient {
  constructor() {
    this.host = process.env.CANTON_LEDGER_HOST || 'localhost';
    this.port = process.env.CANTON_LEDGER_PORT || '2901';
    this.partyId = process.env.CANTON_PARTY_ID;
    
    if (!this.partyId) {
      throw new Error('CANTON_PARTY_ID environment variable is required');
    }

    logger.info(`Initializing Canton Ledger Client for ${this.host}:${this.port}`);
  }

  /**
   * Initialize gRPC client
   * Week 3 TODO: Load Ledger API proto definitions
   */
  async connect() {
    logger.info('Canton Ledger Client connected (mock mode - Week 3 implementation)');
    
    // Week 3 TODO: Implement actual gRPC connection
    // const packageDefinition = protoLoader.loadSync('ledger_api.proto');
    // const protoDescriptor = grpc.loadPackageDefinition(packageDefinition);
    // this.client = new protoDescriptor.TransactionService(
    //   `${this.host}:${this.port}`,
    //   grpc.credentials.createInsecure()
    // );
    
    return true;
  }

  /**
   * Subscribe to Canton transaction stream
   * Week 3 TODO: Implement actual gRPC stream subscription
   */
  async subscribeToPaymentRequests(callback) {
    logger.info('Subscribing to PaymentRequest events...');
    logger.warn('Using mock event subscription (Week 3: implement gRPC)');
    return { cancel: () => logger.info('Stream cancelled') };
  }

  /**
   * Exercise ConfirmPayment choice on PaymentRequest contract
   * Week 3 TODO: Implement actual choice exercise
   */
  async confirmPayment(contractId, transactionHash) {
    logger.info(`Confirming payment for contract ${contractId} with txHash ${transactionHash}`);
    logger.warn('Using mock payment confirmation (Week 3: implement gRPC)');
    
    return {
      confirmationContractId: 'mock-confirmation-id-123',
      success: true
    };
  }
}

export default CantonLedgerClient;
EOF

echo -e "${GREEN}✓ canton/ledgerClient.js created${NC}"

# =====================================================
# File 6: payroll-bridge/canton/eventSubscriber.js
# =====================================================

cat > payroll-bridge/canton/eventSubscriber.js << 'EOF'
import logger from '../utils/logger.js';
import CantonLedgerClient from './ledgerClient.js';

/**
 * Canton Event Subscriber
 * High-level wrapper for processing Canton ledger events
 */
class EventSubscriber {
  constructor(ledgerClient) {
    this.ledgerClient = ledgerClient || new CantonLedgerClient();
    this.handlers = [];
    this.stream = null;
  }

  /**
   * Register handler for PaymentRequest events
   */
  onPaymentRequest(handler) {
    if (typeof handler !== 'function') {
      throw new Error('Handler must be a function');
    }
    this.handlers.push(handler);
    logger.info('Registered PaymentRequest handler');
  }

  /**
   * Start listening for Canton events
   */
  async start() {
    logger.info('Starting Canton event subscription...');
    
    await this.ledgerClient.connect();
    
    this.stream = await this.ledgerClient.subscribeToPaymentRequests(
      async (paymentRequest) => {
        logger.info('PaymentRequest event received', {
          contractId: paymentRequest.contractId,
          employeeId: paymentRequest.employeeId,
          amount: paymentRequest.amount
        });

        // Execute all registered handlers
        for (const handler of this.handlers) {
          try {
            await handler(paymentRequest);
          } catch (error) {
            logger.error('Error in PaymentRequest handler', {
              error: error.message,
              stack: error.stack,
              paymentRequest
            });
          }
        }
      }
    );

    logger.info('Canton event subscription active');
  }

  /**
   * Stop listening for Canton events
   */
  stop() {
    if (this.stream) {
      this.stream.cancel();
      logger.info('Canton event subscription stopped');
    }
  }
}

export default EventSubscriber;
EOF

echo -e "${GREEN}✓ canton/eventSubscriber.js created${NC}"

# =====================================================
# File 7: payroll-bridge/x402/client.js
# =====================================================

cat > payroll-bridge/x402/client.js << 'EOF'
import { wrapFetchWithPayment, x402Client } from '@x402/fetch';
import { registerExactEvmScheme } from '@x402/evm/exact/client';
import { privateKeyToAccount } from 'viem/accounts';
import logger from '../utils/logger.js';
import dotenv from 'dotenv';

dotenv.config();

/**
 * x402 Payment Client
 * Handles HTTP 402 payment protocol for payroll settlement
 */
class X402Client {
  constructor() {
    this.settlementEndpoint = process.env.X402_SETTLEMENT_ENDPOINT || 'http://localhost:3402';
    this.network = process.env.X402_NETWORK || 'eip155:84532';
    this.employeeWallets = this.parseEmployeeWallets();
    
    this.client = null;
    this.fetchWithPayment = null;
    
    logger.info('x402 Client initialized', {
      network: this.network,
      settlementEndpoint: this.settlementEndpoint
    });
  }

  /**
   * Parse employee wallet mappings from .env
   */
  parseEmployeeWallets() {
    const walletsEnv = process.env.EMPLOYEE_WALLETS || '';
    const walletMap = new Map();
    
    walletsEnv.split(',').forEach(mapping => {
      const [employeeId, walletAddress] = mapping.split(':');
      if (employeeId && walletAddress) {
        walletMap.set(employeeId.trim(), walletAddress.trim());
      }
    });

    logger.info(`Loaded ${walletMap.size} employee wallet mappings`);
    return walletMap;
  }

  /**
   * Initialize x402 payment client
   * Week 4 TODO: Implement real initialization
   */
  async initialize() {
    logger.warn('Using mock x402 client (Week 4: implement real client)');
    this.fetchWithPayment = fetch;
  }

  /**
   * Resolve employee wallet address
   */
  resolveEmployeeWallet(employeeId) {
    const walletAddress = this.employeeWallets.get(employeeId);
    
    if (!walletAddress) {
      throw new Error(`No wallet address configured for employee ${employeeId}`);
    }

    return walletAddress;
  }

  /**
   * Execute USDC payment via x402 protocol
   */
  async executePayment(paymentRequest) {
    const { employeeId, amount, contractId } = paymentRequest;
    
    logger.info('Executing x402 payment', {
      employeeId,
      amount,
      network: this.network
    });

    try {
      const recipientWallet = this.resolveEmployeeWallet(employeeId);

      // For now, simulate payment execution
      logger.warn('Using mock x402 payment (Week 4: implement HTTP call)');
      
      await new Promise(resolve => setTimeout(resolve, 2000));

      const mockResponse = {
        transactionHash: `0x${this.generateMockTxHash()}`,
        blockNumber: Math.floor(Math.random() * 1000000),
        network: this.network,
        recipient: recipientWallet,
        amount: amount,
        currency: 'USDC',
        executedAt: new Date().toISOString()
      };

      logger.info('x402 payment executed successfully', {
        employeeId,
        transactionHash: mockResponse.transactionHash,
        recipient: recipientWallet
      });

      return mockResponse;

    } catch (error) {
      logger.error('x402 payment execution failed', {
        employeeId,
        error: error.message
      });

      throw new Error(`x402 payment failed: ${error.message}`);
    }
  }

  /**
   * Generate mock transaction hash
   */
  generateMockTxHash() {
    return Array.from({ length: 64 }, () => 
      Math.floor(Math.random() * 16).toString(16)
    ).join('');
  }

  /**
   * Get block explorer URL
   */
  getExplorerUrl(txHash) {
    const explorers = {
      'eip155:8453': `https://basescan.org/tx/${txHash}`,
      'eip155:84532': `https://sepolia.basescan.org/tx/${txHash}`,
      'eip155:1': `https://etherscan.io/tx/${txHash}`,
      'eip155:11155111': `https://sepolia.etherscan.io/tx/${txHash}`
    };

    return explorers[this.network] || `https://etherscan.io/tx/${txHash}`;
  }
}

export default X402Client;
EOF

echo -e "${GREEN}✓ x402/client.js created${NC}"

# =====================================================
# File 8: payroll-bridge/index.js
# =====================================================

cat > payroll-bridge/index.js << 'EOF'
import dotenv from 'dotenv';
import logger from './utils/logger.js';
import EventSubscriber from './canton/eventSubscriber.js';
import CantonLedgerClient from './canton/ledgerClient.js';
import X402Client from './x402/client.js';

dotenv.config();

/**
 * Payroll Bridge Service
 * Connects Canton smart contracts to x402 stablecoin payments
 * 
 * Flow: Canton → x402 → Blockchain → Canton
 */
class PayrollBridge {
  constructor() {
    this.ledgerClient = new CantonLedgerClient();
    this.eventSubscriber = new EventSubscriber(this.ledgerClient);
    this.x402Client = new X402Client();
    
    this.isRunning = false;
  }

  /**
   * Main payment processing pipeline
   */
  async processPayment(paymentRequest) {
    const { contractId, employeeId, amount } = paymentRequest;
    
    logger.info('=== Payment Processing Started ===', {
      contractId,
      employeeId,
      amount
    });

    try {
      // Step 1: Execute x402 payment
      logger.info('[Step 1/3] Executing x402 payment...');
      const paymentResult = await this.x402Client.executePayment(paymentRequest);
      logger.info('[Step 1/3] ✓ Payment executed', {
        transactionHash: paymentResult.transactionHash,
        blockNumber: paymentResult.blockNumber
      });

      // Step 2: Verify blockchain settlement
      logger.info('[Step 2/3] Blockchain settlement confirmed', {
        network: paymentResult.network,
        txHash: paymentResult.transactionHash,
        explorerUrl: this.x402Client.getExplorerUrl(paymentResult.transactionHash)
      });

      // Step 3: Confirm payment on Canton
      logger.info('[Step 3/3] Confirming payment on Canton...');
      const confirmationResult = await this.ledgerClient.confirmPayment(
        contractId,
        paymentResult.transactionHash
      );
      logger.info('[Step 3/3] ✓ Payment confirmed on Canton', {
        confirmationContractId: confirmationResult.confirmationContractId
      });

      logger.info('=== Payment Processing Completed ===', {
        employeeId,
        amount,
        txHash: paymentResult.transactionHash,
        confirmationId: confirmationResult.confirmationContractId
      });

      return {
        success: true,
        transactionHash: paymentResult.transactionHash,
        confirmationContractId: confirmationResult.confirmationContractId
      };

    } catch (error) {
      logger.error('=== Payment Processing Failed ===', {
        contractId,
        employeeId,
        error: error.message,
        stack: error.stack
      });

      throw error;
    }
  }

  /**
   * Start the bridge service
   */
  async start() {
    logger.info('======================================');
    logger.info('     Canton x402 Payroll Bridge');
    logger.info('======================================');
    logger.info('Environment:', {
      canton: `${process.env.CANTON_LEDGER_HOST}:${process.env.CANTON_LEDGER_PORT}`,
      x402Endpoint: process.env.X402_SETTLEMENT_ENDPOINT,
      network: process.env.X402_NETWORK,
      partyId: process.env.CANTON_PARTY_ID || 'not configured'
    });
    logger.info('--------------------------------------');

    try {
      await this.x402Client.initialize();

      this.eventSubscriber.onPaymentRequest(async (paymentRequest) => {
        await this.processPayment(paymentRequest);
      });

      await this.eventSubscriber.start();

      this.isRunning = true;
      logger.info('Payroll Bridge started successfully ✓');
      logger.info('Waiting for PaymentRequest events...');

    } catch (error) {
      logger.error('Failed to start Payroll Bridge', {
        error: error.message,
        stack: error.stack
      });
      throw error;
    }
  }

  /**
   * Stop the bridge service
   */
  async stop() {
    logger.info('Stopping Payroll Bridge...');
    
    this.eventSubscriber.stop();
    this.isRunning = false;
    
    logger.info('Payroll Bridge stopped');
  }
}

// Main entry point
async function main() {
  const bridge = new PayrollBridge();

  // Graceful shutdown handlers
  process.on('SIGINT', async () => {
    logger.info('Received SIGINT, shutting down gracefully...');
    await bridge.stop();
    process.exit(0);
  });

  process.on('SIGTERM', async () => {
    logger.info('Received SIGTERM, shutting down gracefully...');
    await bridge.stop();
    process.exit(0);
  });

  // Handle uncaught errors
  process.on('uncaughtException', (error) => {
    logger.error('Uncaught exception', {
      error: error.message,
      stack: error.stack
    });
    process.exit(1);
  });

  process.on('unhandledRejection', (reason, promise) => {
    logger.error('Unhandled promise rejection', {
      reason: reason,
      promise: promise
    });
  });

  // Start service
  try {
    await bridge.start();
  } catch (error) {
    logger.error('Service failed to start', { error: error.message });
    process.exit(1);
  }
}

// Run if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

export default PayrollBridge;
EOF

echo -e "${GREEN}✓ index.js created${NC}"

# =====================================================
# x402 Mock Server Files
# =====================================================
echo -e "${YELLOW}[7/8] Creating x402-mock-server...${NC}"

# package.json
cat > x402-mock-server/package.json << 'EOF'
{
  "name": "x402-mock-settlement-server",
  "version": "1.0.0",
  "description": "Mock x402 settlement server for Canton payroll PoC",
  "main": "server.js",
  "type": "module",
  "scripts": {
    "start": "node server.js",
    "dev": "nodemon server.js"
  },
  "dependencies": {
    "express": "^4.18.2",
    "dotenv": "^16.3.1",
    "winston": "^3.11.0"
  },
  "devDependencies": {
    "nodemon": "^3.0.2"
  }
}
EOF

# .env
cat > x402-mock-server/.env << 'EOF'
PORT=3402
PAYMENT_PRICE=0.001
LOG_LEVEL=debug
EOF

# server.js
cat > x402-mock-server/server.js << 'EOF'
import express from 'express';
import dotenv from 'dotenv';
import winston from 'winston';

dotenv.config();

const logger = winston.createLogger({
  level: 'debug',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.colorize(),
    winston.format.printf(({ timestamp, level, message, ...meta }) => {
      let msg = `${timestamp} [${level}]: ${message}`;
      if (Object.keys(meta).length > 0) {
        msg += ` ${JSON.stringify(meta)}`;
      }
      return msg;
    })
  ),
  transports: [new winston.transports.Console()]
});

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 3402;
const PAYMENT_PRICE = process.env.PAYMENT_PRICE || '0.001';

const processedPayments = new Map();

app.use((req, res, next) => {
  logger.info(`${req.method} ${req.path}`, { body: req.body });
  next();
});

app.post('/transfer', async (req, res) => {
  const { recipient, amount, currency, network, metadata } = req.body;

  logger.info('Transfer request received', { recipient, amount, currency, network });

  const paymentSignature = req.headers['payment-signature'];

  if (!paymentSignature) {
    logger.warn('No payment signature - returning 402');

    const paymentRequired = {
      scheme: 'exact',
      price: PAYMENT_PRICE,
      network: network || 'eip155:84532',
      payTo: '0xMockPayrollSettlementContract000000000000',
      currency: 'USDC',
      description: 'Payroll settlement fee'
    };

    res.status(402)
      .set('PAYMENT-REQUIRED', JSON.stringify(paymentRequired))
      .json({
        error: 'Payment Required',
        message: 'Please sign payment and retry with PAYMENT-SIGNATURE header',
        payment: paymentRequired
      });

    return;
  }

  logger.info('Payment signature received - processing payment');

  await new Promise(resolve => setTimeout(resolve, 1000));

  const txHash = '0x' + Array.from({ length: 64 }, () => 
    Math.floor(Math.random() * 16).toString(16)
  ).join('');

  const paymentId = `payment-${Date.now()}`;
  const blockNumber = Math.floor(Math.random() * 1000000) + 5000000;

  processedPayments.set(paymentId, {
    recipient,
    amount,
    currency,
    network,
    txHash,
    blockNumber,
    timestamp: new Date().toISOString(),
    metadata
  });

  logger.info('Payment processed successfully', { paymentId, txHash, recipient, amount });

  res.status(200)
    .set('PAYMENT-RESPONSE', JSON.stringify({ paymentId, status: 'settled' }))
    .json({
      success: true,
      paymentId,
      transactionHash: txHash,
      blockNumber,
      network: network || 'eip155:84532',
      recipient,
      amount,
      currency: currency || 'USDC',
      executedAt: new Date().toISOString(),
      explorerUrl: `https://sepolia.basescan.org/tx/${txHash}`,
      metadata
    });
});

app.get('/payment/:paymentId', (req, res) => {
  const { paymentId } = req.params;
  const payment = processedPayments.get(paymentId);

  if (!payment) {
    return res.status(404).json({ error: 'Payment not found', paymentId });
  }

  res.json({ paymentId, status: 'settled', ...payment });
});

app.get('/payments', (req, res) => {
  const payments = Array.from(processedPayments.entries()).map(([id, data]) => ({
    paymentId: id,
    ...data
  }));

  res.json({ total: payments.length, payments });
});

app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    service: 'x402-mock-settlement-server',
    uptime: process.uptime(),
    timestamp: new Date().toISOString()
  });
});

app.listen(PORT, () => {
  logger.info('==========================================');
  logger.info('  x402 Mock Settlement Server');
  logger.info('==========================================');
  logger.info(`Server running on http://localhost:${PORT}`);
  logger.info(`Payment price: $${PAYMENT_PRICE} USDC`);
  logger.info('------------------------------------------');
  logger.info('Endpoints:');
  logger.info(`  POST   http://localhost:${PORT}/transfer`);
  logger.info(`  GET    http://localhost:${PORT}/payment/:id`);
  logger.info(`  GET    http://localhost:${PORT}/payments`);
  logger.info(`  GET    http://localhost:${PORT}/health`);
  logger.info('==========================================\n');
});

process.on('SIGINT', () => {
  logger.info('Shutting down gracefully...');
  process.exit(0);
});
EOF

echo -e "${GREEN}✓ x402-mock-server created${NC}"

# =====================================================
# Final Setup Steps
# =====================================================
echo -e "${YELLOW}[8/8] Installing dependencies...${NC}"

# Install payroll-bridge dependencies
cd payroll-bridge
npm install
echo -e "${GREEN}✓ payroll-bridge dependencies installed${NC}"

# Install mock server dependencies
cd ../x402-mock-server
npm install
echo -e "${GREEN}✓ x402-mock-server dependencies installed${NC}"

cd ..

echo ""
echo -e "${GREEN}======================================"
echo "  ✓ Setup Complete!"
echo "======================================${NC}"
echo ""
echo -e "${BLUE}Project structure:${NC}"
echo "  payroll-bridge/        (Canton ↔ x402 bridge service)"
echo "  x402-mock-server/      (Mock x402 HTTP 402 server)"
echo ""
echo -e "${BLUE}Next steps:${NC}"
echo ""
echo -e "${YELLOW}1. Update Canton Party ID:${NC}"
echo "   cd ../cn-quickstart/quickstart && make canton-console"
echo "   scala> val employer = sandbox.parties.enable(\"AcmePayroll\")"
echo "   Copy the party ID, then:"
echo "   nano payroll-bridge/.env"
echo "   Update: CANTON_PARTY_ID=<your-party-id>"
echo ""
echo -e "${YELLOW}2. Start x402 mock server (Terminal 1):${NC}"
echo "   cd x402-mock-server"
echo "   npm start"
echo ""
echo -e "${YELLOW}3. Start payroll bridge (Terminal 2):${NC}"
echo "   cd payroll-bridge"
echo "   npm start"
echo ""
echo -e "${YELLOW}4. Test the setup:${NC}"
echo "   curl http://localhost:3402/health"
echo ""
echo -e "${GREEN}All files created with dummy keys and localhost configuration!${NC}"
echo ""
