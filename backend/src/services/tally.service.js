const axios = require('axios');
const xml2js = require('xml2js');
const logger = require('../utils/logger');
const config = require('../config/env');

// Helper to parse XML to JS object
const parseXml = (xmlString) => {
  return new Promise((resolve, reject) => {
    xml2js.parseString(xmlString, { explicitArray: false }, (err, result) => {
      if (err) reject(err);
      else resolve(result);
    });
  });
};

/**
 * Isolated Client Service to query TallyPrime via its XML HTTP Port.
 * Since TallyPrime only supports XML querying natively on its XML interface, 
 * this service serializes requests to Tally XML and returns structured JSON responses.
 */
class TallyService {
  constructor() {
    this.tallyUrl = `http://${config.tally.host}:${config.tally.port}`;
  }

  async sendXmlRequest(xmlPayload) {
    try {
      const response = await axios.post(this.tallyUrl, xmlPayload, {
        headers: {
          'Content-Type': 'text/xml; charset=utf-8',
          'Accept': 'text/xml'
        },
        timeout: 8000
      });
      return response.data;
    } catch (error) {
      logger.error(`Error communicating with TallyPrime: ${error.message}`);
      throw new Error(`Tally Server is offline or unreachable on ${this.tallyUrl}`);
    }
  }

  /**
   * Fetch outstanding ledger balance from Tally using XML query
   */
  async getLedgerBalance(ledgerName) {
    logger.info(`Fetching ledger balance for ${ledgerName} from TallyPrime`);
    const xml = `
      <ENVELOPE>
        <HEADER>
          <VERSION>1</VERSION>
          <TALLYREQUEST>Export</TALLYREQUEST>
          <TYPE>Data</TYPE>
          <ID>Ledger Outstandings</ID>
        </HEADER>
        <BODY>
          <DESC>
            <STATICVARIABLES>
              <SVLEDGERNAME>${ledgerName}</SVLEDGERNAME>
            </STATICVARIABLES>
          </DESC>
        </BODY>
      </ENVELOPE>
    `;

    const rawResponse = await this.sendXmlRequest(xml);
    const parsed = await parseXml(rawResponse);
    return parsed;
  }

  /**
   * Fetch details for a specific customer/ledger
   */
  async getCustomerDetails(ledgerName) {
    const xml = `
      <ENVELOPE>
        <HEADER>
          <VERSION>1</VERSION>
          <TALLYREQUEST>Export</TALLYREQUEST>
          <TYPE>Data</TYPE>
          <ID>Ledger Details</ID>
        </HEADER>
        <BODY>
          <DESC>
            <STATICVARIABLES>
              <SVLEDGERNAME>${ledgerName}</SVLEDGERNAME>
            </STATICVARIABLES>
          </DESC>
        </BODY>
      </ENVELOPE>
    `;
    const rawResponse = await this.sendXmlRequest(xml);
    return await parseXml(rawResponse);
  }

  /**
   * Fetch invoice details
   */
  async getInvoiceDetails(voucherNumber) {
    const xml = `
      <ENVELOPE>
        <HEADER>
          <VERSION>1</VERSION>
          <TALLYREQUEST>Export</TALLYREQUEST>
          <TYPE>Data</TYPE>
          <ID>Voucher Details</ID>
        </HEADER>
        <BODY>
          <DESC>
            <STATICVARIABLES>
              <SVVOUCHERNUMBER>${voucherNumber}</SVVOUCHERNUMBER>
            </STATICVARIABLES>
          </DESC>
        </BODY>
      </ENVELOPE>
    `;
    const rawResponse = await this.sendXmlRequest(xml);
    return await parseXml(rawResponse);
  }

  /**
   * Fetch outstanding bills/amounts for a party ledger
   */
  async getOutstandingAmount(ledgerName) {
    logger.info(`Querying outstanding amount for: ${ledgerName}`);
    // Simulated outstanding query response or raw XML request
    const xml = `
      <ENVELOPE>
        <HEADER>
          <VERSION>1</VERSION>
          <TALLYREQUEST>Export</TALLYREQUEST>
          <TYPE>Data</TYPE>
          <ID>Outstanding Bills</ID>
        </HEADER>
        <BODY>
          <DESC>
            <STATICVARIABLES>
              <SVLEDGERNAME>${ledgerName}</SVLEDGERNAME>
            </STATICVARIABLES>
          </DESC>
        </BODY>
      </ENVELOPE>
    `;
    try {
      const rawResponse = await this.sendXmlRequest(xml);
      const parsed = await parseXml(rawResponse);
      return parsed;
    } catch (e) {
      // Mock safe fallback if XML schema fails
      return { totalOutstanding: 0 };
    }
  }

  /**
   * Get last invoice summaries for user two-way communication request
   */
  async getLastInvoices(ledgerName, limit = 5) {
    logger.info(`Fetching last ${limit} invoices for ${ledgerName}`);
    const xml = `
      <ENVELOPE>
        <HEADER>
          <VERSION>1</VERSION>
          <TALLYREQUEST>Export</TALLYREQUEST>
          <TYPE>Data</TYPE>
          <ID>Last Vouchers</ID>
        </HEADER>
        <BODY>
          <DESC>
            <STATICVARIABLES>
              <SVLEDGERNAME>${ledgerName}</SVLEDGERNAME>
              <SVLIMIT>${limit}</SVLIMIT>
            </STATICVARIABLES>
          </DESC>
        </BODY>
      </ENVELOPE>
    `;
    try {
      const rawResponse = await this.sendXmlRequest(xml);
      return await parseXml(rawResponse);
    } catch (e) {
      return [];
    }
  }
}

module.exports = new TallyService();
