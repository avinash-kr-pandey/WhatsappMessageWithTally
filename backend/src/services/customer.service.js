const logger = require('../utils/logger');

/**
 * Mock/No-op Customer Upsert (Tally is the database)
 */
const upsertCustomer = async (partyName, mobile, companyName) => {
  const normalizedMobile = mobile.replace(/[^0-9+]/g, '');
  logger.debug(`[Tally DB] Customer resolved: ${partyName} (${normalizedMobile}) for ${companyName}`);
  return {
    name: partyName,
    tallyLedgerName: partyName,
    mobile: normalizedMobile,
    companyName
  };
};

module.exports = {
  upsertCustomer
};
