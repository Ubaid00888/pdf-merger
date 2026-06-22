import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import * as fs from 'fs/promises';
import { mergePDFs } from './merger.js';
import * as path from 'path';

async function createDummyPDF(filename: string, text: string): Promise<string> {
  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage([600, 400]);
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  page.drawText(text, {
    x: 50,
    y: 200,
    size: 30,
    font: font,
    color: rgb(0, 0.53, 0.71),
  });
  const pdfBytes = await pdfDoc.save();
  const filePath = path.join(process.cwd(), filename);
  await fs.writeFile(filePath, pdfBytes);
  return filePath;
}

async function run() {
  console.log('--- Starting PDF Merger Logic Verification ---');
  try {
    const file1 = await createDummyPDF('test_file1.pdf', 'Hello Page One');
    const file2 = await createDummyPDF('test_file2.pdf', 'Hello Page Two');
    console.log(`Created dummy PDFs: \n- ${file1}\n- ${file2}`);

    console.log('Merging PDFs...');
    const mergedBuffer = await mergePDFs([file1, file2]);
    console.log(`Merged PDF buffer generated successfully. Size: ${mergedBuffer.length} bytes.`);

    // Verify page count of merged PDF
    const mergedDoc = await PDFDocument.load(mergedBuffer);
    const pages = mergedDoc.getPageCount();
    console.log(`Merged PDF page count: ${pages} (Expected: 2)`);

    if (pages === 2) {
      console.log('==================================');
      console.log('Verification SUCCESS!');
      console.log('==================================');
    } else {
      console.error('Verification FAILED: Page count is incorrect.');
      process.exit(1);
    }

    // Clean up files
    await fs.unlink(file1);
    await fs.unlink(file2);
    console.log('Temporary verification files cleaned up.');

  } catch (err) {
    console.error('Verification failed with error:', err);
    process.exit(1);
  }
}

run();
