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
const pdf_lib_1 = require("pdf-lib");
const fs = __importStar(require("fs/promises"));
const merger_js_1 = require("./merger.js");
const path = __importStar(require("path"));
async function createDummyPDF(filename, text) {
    const pdfDoc = await pdf_lib_1.PDFDocument.create();
    const page = pdfDoc.addPage([600, 400]);
    const font = await pdfDoc.embedFont(pdf_lib_1.StandardFonts.Helvetica);
    page.drawText(text, {
        x: 50,
        y: 200,
        size: 30,
        font: font,
        color: (0, pdf_lib_1.rgb)(0, 0.53, 0.71),
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
        const mergedBuffer = await (0, merger_js_1.mergePDFs)([file1, file2]);
        console.log(`Merged PDF buffer generated successfully. Size: ${mergedBuffer.length} bytes.`);
        // Verify page count of merged PDF
        const mergedDoc = await pdf_lib_1.PDFDocument.load(mergedBuffer);
        const pages = mergedDoc.getPageCount();
        console.log(`Merged PDF page count: ${pages} (Expected: 2)`);
        if (pages === 2) {
            console.log('==================================');
            console.log('Verification SUCCESS!');
            console.log('==================================');
        }
        else {
            console.error('Verification FAILED: Page count is incorrect.');
            process.exit(1);
        }
        // Clean up files
        await fs.unlink(file1);
        await fs.unlink(file2);
        console.log('Temporary verification files cleaned up.');
    }
    catch (err) {
        console.error('Verification failed with error:', err);
        process.exit(1);
    }
}
run();
