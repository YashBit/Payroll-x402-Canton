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
