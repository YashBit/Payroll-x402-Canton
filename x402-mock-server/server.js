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
