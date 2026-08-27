const axios = require('axios');
const xml2js = require('xml2js');

const TALLY_URL = 'http://127.0.0.1:9000';

const parseXml = (xmlString) => {
  return new Promise((resolve, reject) => {
    xml2js.parseString(xmlString, { explicitArray: false }, (err, result) => {
      if (err) reject(err);
      else resolve(result);
    });
  });
};

const sendRequest = async (xml) => {
  const response = await axios.post(TALLY_URL, xml, {
    headers: { 'Content-Type': 'text/xml; charset=utf-8' },
    timeout: 5000
  });
  return response.data;
};

async function main() {
  console.log('Probing Tally at', TALLY_URL);
  
  // 1. Get Company info
  try {
    const compXml = `
      <ENVELOPE>
        <HEADER>
          <VERSION>1</VERSION>
          <TALLYREQUEST>Export</TALLYREQUEST>
          <TYPE>Collection</TYPE>
          <ID>ActiveCompanies</ID>
        </HEADER>
        <BODY>
          <DESC>
            <STATICVARIABLES>
              <SVEXPORTFORMAT>$$SysName:XML</SVEXPORTFORMAT>
            </STATICVARIABLES>
            <TDL>
              <TDLMESSAGE>
                <COLLECTION NAME="ActiveCompanies">
                  <TYPE>Company</TYPE>
                  <FETCH>Name, GUID</FETCH>
                </COLLECTION>
              </TDLMESSAGE>
            </TDL>
          </DESC>
        </BODY>
      </ENVELOPE>
    `;
    const res = await sendRequest(compXml);
    const parsed = await parseXml(res);
    console.log('Active Companies Response:', JSON.stringify(parsed, null, 2));
  } catch (err) {
    console.error('Error fetching active companies:', err.message);
  }

  // 2. Fetch sample Vouchers and their MasterIDs/AlterIDs to verify cursor support
  try {
    const vchXml = `
      <ENVELOPE>
        <HEADER>
          <VERSION>1</VERSION>
          <TALLYREQUEST>Export</TALLYREQUEST>
          <TYPE>Collection</TYPE>
          <ID>VoucherSample</ID>
        </HEADER>
        <BODY>
          <DESC>
            <STATICVARIABLES>
              <SVEXPORTFORMAT>$$SysName:XML</SVEXPORTFORMAT>
            </STATICVARIABLES>
            <TDL>
              <TDLMESSAGE>
                <COLLECTION NAME="VoucherSample">
                  <TYPE>Voucher</TYPE>
                  <FETCH>VoucherNumber, Date, PartyLedgerName, Amount, MasterID, AlterID, GUID, VoucherTypeName</FETCH>
                </COLLECTION>
              </TDLMESSAGE>
            </TDL>
          </DESC>
        </BODY>
      </ENVELOPE>
    `;
    const res = await sendRequest(vchXml);
    const parsed = await parseXml(res);
    let vouchers = [];
    if (parsed?.ENVELOPE?.BODY?.DATA?.COLLECTION?.VOUCHER) {
      const v = parsed.ENVELOPE.BODY.DATA.COLLECTION.VOUCHER;
      vouchers = Array.isArray(v) ? v : [v];
    }
    console.log(`Fetched ${vouchers.length} sample vouchers.`);
    if (vouchers.length > 0) {
      console.log('Sample Voucher Details:', JSON.stringify(vouchers.slice(0, 3), null, 2));
    }
  } catch (err) {
    console.error('Error fetching sample vouchers:', err.message);
  }
}

main();
