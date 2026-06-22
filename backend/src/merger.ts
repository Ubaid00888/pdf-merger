import { PDFDocument } from 'pdf-lib';
import * as fs from 'fs/promises';
import * as path from 'path';

/**
 * Merges multiple PDF files into a single PDF document in the specified order.
 * @param filePaths List of absolute paths to the PDF files to merge.
 * @returns A Buffer containing the merged PDF data.
 */
export async function mergePDFs(filePaths: string[]): Promise<Buffer> {
  if (filePaths.length === 0) {
    throw new Error('No files provided for merging.');
  }

  // Create a new PDF Document
  const mergedPdf = await PDFDocument.create();

  // Set standard creator/producer metadata
  mergedPdf.setCreator('PDF Merger SaaS');
  mergedPdf.setProducer('pdf-lib & PDF Merger SaaS');

  for (const filePath of filePaths) {
    try {
      // Check if file exists
      await fs.access(filePath);
      
      const fileBytes = await fs.readFile(filePath);
      const srcPdf = await PDFDocument.load(fileBytes, { 
        ignoreEncryption: true 
      });
      
      // Copy all pages from the source PDF
      const pageIndices = srcPdf.getPageIndices();
      const copiedPages = await mergedPdf.copyPages(srcPdf, pageIndices);
      
      // Add each page to the merged document
      for (const page of copiedPages) {
        mergedPdf.addPage(page);
      }
    } catch (err: any) {
      console.error(`Error processing file ${filePath}:`, err);
      throw new Error(`Failed to read or parse PDF: ${path.basename(filePath)}. ${err.message || ''}`);
    }
  }

  // Save the merged PDF and return as Buffer
  const mergedPdfBytes = await mergedPdf.save();
  return Buffer.from(mergedPdfBytes);
}
