import grpc from '@grpc/grpc-js';
import protoLoader from '@grpc/proto-loader';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import fetch from 'node-fetch';
import logger from '../utils/logger.js';
import dotenv from 'dotenv';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Canton Ledger Client with OAuth2 Authentication
 * Full gRPC integration with Keycloak OAuth2 token management
 */
class CantonLedgerClient {
  constructor() {
    this.host = process.env.CANTON_LEDGER_HOST || 'localhost';
    this.port = process.env.CANTON_LEDGER_PORT || '2901';
    this.partyId = process.env.CANTON_PARTY_ID;
    
    // OAuth2 configuration
    this.tokenUrl = process.env.KEYCLOAK_TOKEN_URL;
    this.clientId = process.env.KEYCLOAK_CLIENT_ID;
    this.clientSecret = process.env.KEYCLOAK_CLIENT_SECRET;
    this.audience = process.env.KEYCLOAK_AUDIENCE;
    
    if (!this.partyId) {
      throw new Error('CANTON_PARTY_ID environment variable is required');
    }
    
    if (!this.tokenUrl || !this.clientId || !this.clientSecret) {
      throw new Error('OAuth2 configuration required: KEYCLOAK_TOKEN_URL, KEYCLOAK_CLIENT_ID, KEYCLOAK_CLIENT_SECRET');
    }

    this.updateServiceClient = null;
    this.commandServiceClient = null;
    this.packageServiceClient = null;
    this.stream = null;
    this.packageId = null;
    
    // Token management
    this.accessToken = null;
    this.tokenExpiry = null;

    logger.info(`Initializing Canton Ledger Client for ${this.host}:${this.port}`);
    logger.info(`OAuth2 authentication enabled with ${this.tokenUrl}`);
  }

  async getAccessToken() {
    try {
      if (this.accessToken && this.tokenExpiry && Date.now() < this.tokenExpiry - 30000) {
        logger.debug('Using cached OAuth2 token');
        return this.accessToken;
      }

      logger.info('🔐 Requesting new OAuth2 token from Keycloak...');

      const response = await fetch(this.tokenUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: new URLSearchParams({
          client_id: this.clientId,
          client_secret: this.clientSecret,
          grant_type: 'client_credentials',
          audience: this.audience
        })
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`OAuth2 token request failed: ${response.status} - ${error}`);
      }

      const data = await response.json();
      
      if (!data.access_token) {
        throw new Error('No access_token in OAuth2 response');
      }

      this.accessToken = data.access_token;
      this.tokenExpiry = Date.now() + (data.expires_in * 1000);

      logger.info(`✅ OAuth2 token obtained (expires in ${data.expires_in}s)`);

      return this.accessToken;

    } catch (error) {
      logger.error('❌ Failed to get OAuth2 token', {
        error: error.message,
        tokenUrl: this.tokenUrl
      });
      throw error;
    }
  }

  async connect() {
    try {
      logger.info('Connecting to Canton Ledger API...');
      
      await this.getAccessToken();
      await this.loadProtos();
      
      logger.info('✅ Canton Ledger connection established', { 
        address: `${this.host}:${this.port}`,
        party: this.partyId,
        authenticated: true
      });
      
      return true;
      
    } catch (error) {
      logger.error('Failed to connect to Canton', { 
        error: error.message,
        stack: error.stack
      });
      throw error;
    }
  }

  async loadProtos() {
    try {
      logger.info('Loading Canton proto definitions...');

      const protoPath = path.resolve(__dirname, '../proto');
      
      if (!fs.existsSync(protoPath)) {
        throw new Error(`Proto directory not found: ${protoPath}`);
      }

      const address = `${this.host}:${this.port}`;
      await this.getAccessToken();

      const credentials = grpc.credentials.createInsecure();

      const options = {
        keepCase: true,
        longs: String,
        enums: String,
        defaults: true,
        oneofs: true,
        includeDirs: [protoPath]
      };

      const updateServiceProto = protoLoader.loadSync(
        'com/daml/ledger/api/v2/update_service.proto',
        options
      );
      
      const updateServiceDef = grpc.loadPackageDefinition(updateServiceProto);
      this.updateServiceClient = new updateServiceDef.com.daml.ledger.api.v2.UpdateService(
        address,
        credentials
      );

      const commandServiceProto = protoLoader.loadSync(
        'com/daml/ledger/api/v2/command_service.proto',
        options
      );
      const commandServiceDef = grpc.loadPackageDefinition(commandServiceProto);
      this.commandServiceClient = new commandServiceDef.com.daml.ledger.api.v2.CommandService(
        address,
        credentials
      );

      const packageServiceProto = protoLoader.loadSync(
        'com/daml/ledger/api/v2/package_service.proto',
        options
      );
      const packageServiceDef = grpc.loadPackageDefinition(packageServiceProto);
      this.packageServiceClient = new packageServiceDef.com.daml.ledger.api.v2.PackageService(
        address,
        credentials
      );

      logger.info('✅ Proto definitions loaded successfully with OAuth2 authentication');

      await this.discoverPackageId();

    } catch (error) {
      logger.error('Failed to load protos', { 
        error: error.message,
        stack: error.stack
      });
      throw error;
    }
  }

  async discoverPackageId() {
    try {
      logger.info('Discovering PayRoll package ID...');

      return new Promise((resolve, reject) => {
        this.packageServiceClient.listPackages({}, (error, response) => {
          if (error) {
            logger.warn(`Could not list packages: ${error.message}`);
            resolve();
            return;
          }

          const packages = response.package_ids || [];
          logger.debug(`Found ${packages.length} packages on ledger`);
          logger.info('Package discovery will happen from first event');
          resolve();
        });
      });

    } catch (error) {
      logger.warn(`Package discovery failed: ${error.message}`);
    }
  }

  async subscribeToPaymentRequests(callback) {
    try {
      logger.info('🔄 Subscribing to PaymentRequest events (REAL gRPC stream with OAuth2)...');
      logger.debug(`Subscribing for party: ${this.partyId}`);

      const request = {
        begin_bookmark: '',
        filter: {
          filters_by_party: {
            [this.partyId]: {
              inclusive: {}
            }
          }
        },
        verbose: true,
        update_format: {
          transaction_format: {
            event_format: {
              created_event_blob: false
            }
          }
        }
      };

      logger.debug(`Filter configured for party: ${this.partyId}`);

      const metadata = new grpc.Metadata();
      metadata.add('authorization', `Bearer ${this.accessToken}`);

      this.stream = this.updateServiceClient.getUpdates(request, metadata);

      this.stream.on('data', (update) => {
        try {
          // Skip offset checkpoints
          if (update.update === 'offset_checkpoint') {
            return;
          }

          // Log non-checkpoint updates
          logger.info('📨 Received transaction update');

          const event = this.parseUpdate(update);
          if (event) {
            logger.info('🎉 PaymentRequest detected!', {
              contractId: event.contractId,
              employeeId: event.employeeId,
              amount: event.amount
            });
            callback(event);
          }
        } catch (error) {
          logger.error(`Error parsing update: ${error.message}`);
        }
      });

      this.stream.on('error', async (error) => {
        logger.error(`Stream error: ${error.code} ${error.message}`);
        
        if (error.code === 16 || error.code === 'UNAUTHENTICATED') {
          logger.warn('🔐 Authentication error - refreshing token...');
          
          this.accessToken = null;
          
          setTimeout(async () => {
            try {
              await this.getAccessToken();
              await this.subscribeToPaymentRequests(callback);
            } catch (err) {
              logger.error(`Reconnection failed: ${err.message}`);
            }
          }, 2000);
        } else {
          logger.warn('Stream error - attempting reconnect...');
          setTimeout(() => {
            logger.info('Attempting to reconnect stream...');
            this.subscribeToPaymentRequests(callback).catch(err => {
              logger.error(`Reconnection failed: ${err.message}`);
            });
          }, 5000);
        }
      });

      this.stream.on('end', () => {
        logger.info('Stream ended - reconnecting...');
        setTimeout(() => {
          logger.info('Attempting to reconnect stream after end...');
          this.subscribeToPaymentRequests(callback).catch(err => {
            logger.error(`Reconnection failed: ${err.message}`);
          });
        }, 5000);
      });

      logger.info('✅ Real-time gRPC event stream active (authenticated)');

      return {
        cancel: () => {
          if (this.stream) {
            this.stream.cancel();
            logger.info('Event stream cancelled');
          }
        }
      };

    } catch (error) {
      logger.error('Failed to subscribe to transactions', { 
        error: error.message,
        stack: error.stack
      });
      throw error;
    }
  }

  parseUpdate(update) {
    try {
      // Canton v2 API structure: update.transaction
      if (!update || !update.transaction) {
        return null;
      }

      const transaction = update.transaction;
      
      if (!transaction.events || transaction.events.length === 0) {
        return null;
      }
      
      for (const event of transaction.events) {
        if (event.created) {
          return this.parseCreatedEvent(event.created);
        }
      }

      return null;

    } catch (error) {
      logger.error(`Failed to parse update: ${error.message}`);
      return null;
    }
  }

  parseCreatedEvent(created) {
    try {
      const templateId = created.template_id;

      if (!templateId || 
          templateId.module_name !== 'PayRoll.Employee' || 
          templateId.entity_name !== 'PaymentRequest') {
        return null;
      }

      if (templateId.package_id && !this.packageId) {
        this.packageId = templateId.package_id;
        logger.info(`✅ Discovered package ID: ${this.packageId}`);
      }

      const args = this.parseRecord(created.create_arguments);
      
      return {
        contractId: created.contract_id,
        packageId: templateId.package_id,
        employer: args.employer,
        employeeId: args.employeeId,
        amount: parseFloat(args.amount),
        requestTime: args.requestTime
      };

    } catch (error) {
      logger.error(`Failed to parse created event: ${error.message}`);
      return null;
    }
  }

  parseRecord(record) {
    const result = {};

    if (!record || !record.fields) {
      return result;
    }

    for (const field of record.fields) {
      const label = field.label;
      const value = this.parseValue(field.value);
      result[label] = value;
    }

    return result;
  }

  parseValue(value) {
    if (!value) return null;

    if (value.party) return value.party;
    if (value.text) return value.text;
    if (value.int64) return value.int64;
    if (value.numeric) return value.numeric;
    if (value.bool) return value.bool;
    if (value.timestamp) return value.timestamp;
    if (value.record) return this.parseRecord(value.record);
    if (value.list) return value.list.elements.map(e => this.parseValue(e));

    return null;
  }

  async confirmPayment(contractId, transactionHash, packageId) {
    try {
      logger.info('📝 Confirming payment on Canton (REAL gRPC with OAuth2)', { 
        contractId, 
        transactionHash 
      });

      const pkgId = packageId || this.packageId;
      
      if (!pkgId) {
        throw new Error('Package ID not available - cannot submit command');
      }

      await this.getAccessToken();

      const command = {
        commands: [
          {
            exercise: {
              template_id: {
                package_id: pkgId,
                module_name: 'PayRoll.Employee',
                entity_name: 'PaymentRequest'
              },
              contract_id: contractId,
              choice: 'ConfirmPayment',
              choice_argument: {
                record: {
                  fields: [
                    {
                      label: 'transactionHash',
                      value: {
                        text: transactionHash
                      }
                    }
                  ]
                }
              }
            }
          }
        ],
        workflow_id: `payroll-${Date.now()}`,
        application_id: 'payroll-bridge',
        command_id: `cmd-${Date.now()}`,
        act_as: [this.partyId],
        submission_id: `sub-${Date.now()}`
      };

      const metadata = new grpc.Metadata();
      metadata.add('authorization', `Bearer ${this.accessToken}`);

      const response = await new Promise((resolve, reject) => {
        this.commandServiceClient.submitAndWait(command, metadata, (error, response) => {
          if (error) {
            reject(error);
          } else {
            resolve(response);
          }
        });
      });

      logger.info('✅ Payment confirmed on Canton', { 
        transactionId: response.completion?.transaction_id 
      });

      return {
        confirmationContractId: response.completion?.transaction_id || 'confirmed',
        success: true
      };

    } catch (error) {
      logger.error('❌ Failed to confirm payment', { 
        contractId,
        error: error.message,
        stack: error.stack
      });
      throw error;
    }
  }

  async disconnect() {
    if (this.stream) {
      this.stream.cancel();
    }
    logger.info('Disconnected from Canton');
  }
}

export default CantonLedgerClient;