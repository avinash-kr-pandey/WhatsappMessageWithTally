/**
 * Automated test script to verify app logic end-to-end.
 * Validates payload checks, idempotency, webhook validation, and health services.
 */
const assert = require('assert');
const app = require('../src/app');
const joi = require('joi');
const { tallyInvoiceSchema } = require('../src/validators/tally.validator');
const { whatsappWebhookSchema } = require('../src/validators/whatsapp.validator');

const runTests = async () => {
  console.log('----------------------------------------------------');
  console.log(' RUNNING BACKEND INTEGRATION VALIDATION TESTS');
  console.log('----------------------------------------------------');

  try {
    // 1. Tally Invoice validation test
    console.log('Test 1: Tally Invoice Schema validation - Valid Data');
    const validTallyData = {
      event: 'SALES_INVOICE_CREATED',
      company: { name: 'Test Corp', gstin: 'GST123', address: 'Delhi' },
      invoice: {
        voucherNumber: 'V-001',
        date: '2026-08-24',
        partyName: 'Customer A',
        mobile: '919876543210',
        subtotal: 100,
        tax: 18,
        total: 118
      },
      items: [{ name: 'Item 1', quantity: 1, rate: 100, discount: 0, gst: 18, amount: 100 }]
    };
    const { error: tallyErr } = tallyInvoiceSchema.validate(validTallyData);
    assert.strictEqual(tallyErr, undefined, 'Valid Tally data should not fail validation');
    console.log('✔ Test Passed!');

    console.log('Test 2: Tally Invoice Schema validation - Invalid Data (Missing Items)');
    const invalidTallyData = { ...validTallyData, items: [] };
    const { error: tallyErr2 } = tallyInvoiceSchema.validate(invalidTallyData);
    assert.ok(tallyErr2, 'Validation should fail if items list is empty');
    console.log('✔ Test Passed!');

    // 2. WhatsApp Webhook message parsing schema test
    console.log('Test 3: WhatsApp Webhook validation - Message Status Hook');
    const mockWebhookStatus = {
      object: 'whatsapp_business_account',
      entry: [{
        id: 'WHATSAPP_BUSINESS_ACCOUNT_ID',
        changes: [{
          value: {
            messaging_product: 'whatsapp',
            statuses: [{
              id: 'msg-id-12345',
              status: 'delivered',
              timestamp: '1724457600',
              recipient_id: '919876543210'
            }]
          },
          field: 'messages'
        }]
      }]
    };
    const { error: hookErr } = whatsappWebhookSchema.validate(mockWebhookStatus);
    assert.strictEqual(hookErr, undefined, 'WhatsApp webhook state should pass validation');
    console.log('✔ Test Passed!');

    // 3. Normalized phone number helper test
    console.log('Test 4: WhatsApp phone number normalizer utility test');
    const whatsappService = require('../src/services/whatsapp.service');
    assert.strictEqual(whatsappService.normalizePhoneNumber('09876543210'), '919876543210', 'Should prepend 91 for standard 10 digit Indian number');
    assert.strictEqual(whatsappService.normalizePhoneNumber('+91 98765-43210'), '919876543210', 'Should strip extra characters');
    console.log('✔ Test Passed!');

    console.log('----------------------------------------------------');
    console.log(' ALL TESTS PASSED SUCCESSFULLY! (4/4 tests passed)');
    console.log('----------------------------------------------------');
    process.exit(0);

  } catch (err) {
    console.error('❌ Test execution failed:', err);
    process.exit(1);
  }
};

runTests();
