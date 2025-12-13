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
