"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.mergePDFs = mergePDFs;
const pdf_lib_1 = require("pdf-lib");
const fs = __importStar(require("fs/promises"));
const path = __importStar(require("path"));
/**
 * Merges multiple PDF files into a single PDF document in the specified order.
 * @param filePaths List of absolute paths to the PDF files to merge.
 * @returns A Buffer containing the merged PDF data.
 */
async function mergePDFs(filePaths) {
    if (filePaths.length === 0) {
        throw new Error('No files provided for merging.');
    }
    // Create a new PDF Document
    const mergedPdf = await pdf_lib_1.PDFDocument.create();
    // Set standard creator/producer metadata
    mergedPdf.setCreator('PDF Merger SaaS');
    mergedPdf.setProducer('pdf-lib & PDF Merger SaaS');
    for (const filePath of filePaths) {
        try {
            // Check if file exists
            await fs.access(filePath);
            const fileBytes = await fs.readFile(filePath);
            const srcPdf = await pdf_lib_1.PDFDocument.load(fileBytes, {
                ignoreEncryption: true
            });
            // Copy all pages from the source PDF
            const pageIndices = srcPdf.getPageIndices();
            const copiedPages = await mergedPdf.copyPages(srcPdf, pageIndices);
            // Add each page to the merged document
            for (const page of copiedPages) {
                mergedPdf.addPage(page);
            }
        }
        catch (err) {
            console.error(`Error processing file ${filePath}:`, err);
            throw new Error(`Failed to read or parse PDF: ${path.basename(filePath)}. ${err.message || ''}`);
        }
    }
    // Save the merged PDF and return as Buffer
    const mergedPdfBytes = await mergedPdf.save();
    return Buffer.from(mergedPdfBytes);
}
