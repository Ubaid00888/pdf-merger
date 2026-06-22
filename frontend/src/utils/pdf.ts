import * as pdfjs from 'pdfjs-dist';
import { PDFDocument } from 'pdf-lib';

// Configure the pdfjs worker pointing to a CDN matching the installed version
pdfjs.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

/**
 * Merges multiple PDF files into a single PDF document in the browser.
 * @param files List of File objects to merge.
 * @returns A Uint8Array containing the merged PDF bytes.
 */
export async function mergePDFsClientSide(files: File[]): Promise<Uint8Array> {
  if (files.length === 0) {
    throw new Error('No files provided for merging.');
  }

  // Create a new PDF Document
  const mergedPdf = await PDFDocument.create();

  // Set standard creator/producer metadata
  mergedPdf.setCreator('PDF Merger SaaS');
  mergedPdf.setProducer('pdf-lib & PDF Merger SaaS');

  for (const file of files) {
    try {
      const arrayBuffer = await file.arrayBuffer();
      const srcPdf = await PDFDocument.load(arrayBuffer, { 
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
      console.error(`Error processing file ${file.name}:`, err);
      throw new Error(`Failed to read or parse PDF: ${file.name}. ${err.message || ''}`);
    }
  }

  // Save the merged PDF and return as Uint8Array
  return await mergedPdf.save();
}

/**
 * Reads a PDF file locally and returns its page count and a base64 thumbnail of the first page.
 * @param file The PDF File object uploaded by the user.
 * @returns An object containing the page count and a base64 thumbnail URL.
 */
export async function getPdfDetails(file: File): Promise<{ pageCount: number; thumbnail: string }> {
  try {
    const arrayBuffer = await file.arrayBuffer();
    
    // Load the PDF document
    const loadingTask = pdfjs.getDocument({ data: arrayBuffer });
    const pdfDoc = await loadingTask.promise;
    const pageCount = pdfDoc.numPages;
    
    // Load the first page
    const page = await pdfDoc.getPage(1);
    
    // Set a scale that gives a clear thumbnail (e.g., width ~180px)
    const originalViewport = page.getViewport({ scale: 1.0 });
    const targetWidth = 180;
    const scale = targetWidth / originalViewport.width;
    const viewport = page.getViewport({ scale });
    
    // Create an offscreen canvas
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    
    if (!context) {
      throw new Error('Could not create canvas 2D context.');
    }
    
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    
    // Render the page contents into the canvas context
    const renderContext = {
      canvasContext: context,
      viewport: viewport,
    };
    
    await page.render(renderContext).promise;
    
    // Convert to image URI
    const thumbnail = canvas.toDataURL('image/jpeg', 0.85);
    
    // Cleanup page and document objects to prevent memory leaks
    page.cleanup();
    await pdfDoc.destroy();
    
    return {
      pageCount,
      thumbnail
    };
  } catch (error: any) {
    console.error('Error rendering PDF thumbnail locally:', error);
    throw new Error(`Failed to generate thumbnail for ${file.name}: ${error.message || ''}`);
  }
}
