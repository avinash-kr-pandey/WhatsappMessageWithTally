const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');
const config = require('../config/env');
const logger = require('./logger');

/**
 * Dynamically generates a production-ready clean PDF invoice using PDFKit.
 * Stores the PDF temporarily under tempDir and returns the absolute file path.
 * 
 * @param {Object} invoiceData Invoice DB record structure
 * @returns {Promise<string>} File path of the created invoice PDF
 */
const generateInvoicePDF = (invoiceData) => {
  return new Promise((resolve, reject) => {
    try {
      const dir = config.pdf.tempDir;
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }

      const fileName = `INV_${invoiceData.companyName.replace(/[^a-zA-Z0-9]/g, '_')}_${invoiceData.voucherNumber}.pdf`;
      const filePath = path.join(dir, fileName);

      const doc = new PDFDocument({ margin: 50 });
      const writeStream = fs.createWriteStream(filePath);

      doc.pipe(writeStream);

      // Header Banner
      doc.rect(0, 0, 612, 100).fill('#0f172a');
      doc.fillColor('#ffffff').fontSize(20).text(invoiceData.companyName, 50, 40, { bold: true });
      doc.fontSize(10).text(`GSTIN: ${invoiceData.companyGSTIN || 'N/A'}`, 50, 65);

      // Invoice Details
      doc.fillColor('#334155').fontSize(14).text('TAX INVOICE', 450, 35, { align: 'right' });
      doc.fontSize(9).fillColor('#94a3b8').text(`Invoice No: ${invoiceData.voucherNumber}`, 450, 55, { align: 'right' });
      doc.text(`Date: ${invoiceData.voucherDate.toISOString().split('T')[0]}`, 450, 70, { align: 'right' });

      // Customer section
      doc.moveDown(4);
      doc.fillColor('#0f172a').fontSize(12).text('BILL TO:', 50, 130, { underline: true });
      doc.fontSize(10).fillColor('#334155').text(`Party Name: ${invoiceData.partyName}`, 50, 150);
      doc.text(`Mobile: ${invoiceData.mobile}`, 50, 165);
      doc.text(`Address: ${invoiceData.companyAddress || 'N/A'}`, 50, 180);

      // Draw table header
      doc.rect(50, 210, 512, 20).fill('#e2e8f0');
      doc.fillColor('#0f172a').fontSize(9).text('Item Name', 60, 216);
      doc.text('Qty', 300, 216, { width: 40, align: 'right' });
      doc.text('Rate', 360, 216, { width: 60, align: 'right' });
      doc.text('GST', 430, 216, { width: 40, align: 'right' });
      doc.text('Total', 500, 216, { width: 50, align: 'right' });

      let currentY = 235;

      invoiceData.items.forEach((item) => {
        doc.fillColor('#334155').fontSize(9).text(item.name, 60, currentY);
        doc.text(String(item.quantity), 300, currentY, { width: 40, align: 'right' });
        doc.text(`₹${item.rate.toFixed(2)}`, 360, currentY, { width: 60, align: 'right' });
        doc.text(`${item.gst || 0}%`, 430, currentY, { width: 40, align: 'right' });
        const itemTotal = item.amount;
        doc.text(`₹${itemTotal.toFixed(2)}`, 500, currentY, { width: 50, align: 'right' });
        
        // Draw bottom line
        doc.moveTo(50, currentY + 15).lineTo(562, currentY + 15).strokeColor('#cbd5e1').lineWidth(0.5).stroke();
        currentY += 20;
      });

      // Totals Panel
      doc.moveDown(2);
      doc.fillColor('#0f172a').fontSize(10).text(`Subtotal: ₹${(invoiceData.amount - (invoiceData.tax || 0)).toFixed(2)}`, 400, currentY + 20, { align: 'right' });
      doc.text(`Tax (GST): ₹${(invoiceData.tax || 0).toFixed(2)}`, 400, currentY + 35, { align: 'right' });
      
      doc.fontSize(11).text(`Grand Total: ₹${invoiceData.amount.toFixed(2)}`, 400, currentY + 55, { align: 'right', bold: true });

      // Footer Note
      doc.fontSize(8).fillColor('#94a3b8').text('This is a computer generated invoice and requires no signature.', 50, 720, { align: 'center' });

      doc.end();

      writeStream.on('finish', () => {
        logger.info(`PDF generated successfully: ${filePath}`);
        resolve(filePath);
      });

      writeStream.on('error', (err) => {
        logger.error(`Write stream error creating PDF: ${err.message}`);
        reject(err);
      });

    } catch (error) {
      logger.error(`Error inside generateInvoicePDF: ${error.message}`);
      reject(error);
    }
  });
};

module.exports = {
  generateInvoicePDF
};
