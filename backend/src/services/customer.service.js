const Customer = require('../models/Customer');
const logger = require('../utils/logger');

/**
 * Find or create a customer by Ledger Name
 */
const upsertCustomer = async (partyName, mobile, companyName) => {
  try {
    // Standardize mobile number
    const normalizedMobile = mobile.replace(/[^0-9+]/g, '');

    const customer = await Customer.findOneAndUpdate(
      { tallyLedgerName: partyName },
      {
        name: partyName,
        mobile: normalizedMobile,
        companyName
      },
      { new: true, upsert: true }
    );
    logger.debug(`Customer details stored/updated: ${partyName} (${normalizedMobile})`);
    return customer;
  } catch (error) {
    logger.error(`Failed to upsert customer detail: ${error.message}`);
    throw error;
  }
};

module.exports = {
  upsertCustomer
};
