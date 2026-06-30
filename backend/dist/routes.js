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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const multer_1 = __importDefault(require("multer"));
const path = __importStar(require("path"));
const fs = __importStar(require("fs/promises"));
const fs_1 = require("fs");
const crypto_1 = __importDefault(require("crypto"));
const pdf_lib_1 = require("pdf-lib");
const merger_js_1 = require("./merger.js");
const router = (0, express_1.Router)();
const fileRegistry = new Map();
// Setup temporary upload directory
const UPLOADS_DIR = path.join(process.cwd(), 'uploads');
fs.mkdir(UPLOADS_DIR, { recursive: true }).catch(console.error);
// Multer storage configuration
const storage = multer_1.default.diskStorage({
    destination: (req, file, cb) => {
        cb(null, UPLOADS_DIR);
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = crypto_1.default.randomUUID();
        cb(null, `${uniqueSuffix}.pdf`);
    }
});
// File validation
const fileFilter = (req, file, cb) => {
    const fileExtension = path.extname(file.originalname).toLowerCase();
    if (fileExtension === '.pdf' || file.mimetype === 'application/pdf') {
        cb(null, true);
    }
    else {
        cb(new Error('Only PDF files are allowed.'));
    }
};
const upload = (0, multer_1.default)({
    storage,
    fileFilter,
    limits: {
        fileSize: 100 * 1024 * 1024, // 100MB per file
    }
});
// Helper: Clean up files older than 30 minutes directly from disk
const CLEANUP_TIMEOUT = 30 * 60 * 1000; // 30 minutes
setInterval(async () => {
    const now = Date.now();
    try {
        if ((0, fs_1.existsSync)(UPLOADS_DIR)) {
            const files = await fs.readdir(UPLOADS_DIR);
            for (const file of files) {
                const filePath = path.join(UPLOADS_DIR, file);
                try {
                    const stats = await fs.stat(filePath);
                    if (now - stats.mtimeMs > CLEANUP_TIMEOUT) {
                        await fs.unlink(filePath);
                        // Clean from registry if present
                        for (const [id, meta] of fileRegistry.entries()) {
                            if (meta.filePath === filePath) {
                                fileRegistry.delete(id);
                                break;
                            }
                        }
                        console.log(`[Cleanup] Purged expired temp file: ${file}`);
                    }
                }
                catch (err) {
                    console.error(`[Cleanup] Failed to stat/unlink file ${filePath}:`, err);
                }
            }
        }
    }
    catch (err) {
        console.error('[Cleanup] Failed to scan uploads directory:', err);
    }
}, 5 * 60 * 1000); // Run check every 5 minutes
// Route 1: Upload a single PDF file
router.post('/upload', (req, res, next) => {
    upload.single('file')(req, res, async (err) => {
        if (err) {
            return res.status(400).json({ error: err.message || 'File upload failed.' });
        }
        if (!req.file) {
            return res.status(400).json({ error: 'No file uploaded.' });
        }
        const filePath = req.file.path;
        const filename = req.file.originalname;
        const size = req.file.size;
        const id = crypto_1.default.randomUUID();
        try {
            // Validate PDF and get page count using pdf-lib
            const fileBytes = await fs.readFile(filePath);
            const pdfDoc = await pdf_lib_1.PDFDocument.load(fileBytes, { ignoreEncryption: true });
            const pageCount = pdfDoc.getPageCount();
            const metadata = {
                id,
                filename,
                size,
                pageCount,
                filePath,
                createdAt: Date.now()
            };
            fileRegistry.set(id, metadata);
            return res.json({
                id,
                filename,
                size,
                pageCount,
                createdAt: metadata.createdAt
            });
        }
        catch (err) {
            // Remove invalid/corrupted file
            try {
                await fs.unlink(filePath);
            }
            catch (e) { }
            return res.status(400).json({
                error: `Invalid or corrupted PDF file: ${filename}. ${err.message || ''}`
            });
        }
    });
});
// Route 2: Merge multiple PDFs based on an array of file IDs
router.post('/merge', async (req, res) => {
    const { fileIds, filename } = req.body;
    if (!Array.isArray(fileIds) || fileIds.length === 0) {
        return res.status(400).json({ error: 'Invalid file list. Please provide an array of file IDs.' });
    }
    const pathsToMerge = [];
    for (const id of fileIds) {
        const meta = fileRegistry.get(id);
        if (!meta || !(0, fs_1.existsSync)(meta.filePath)) {
            return res.status(400).json({ error: `File reference not found or expired: ${id}` });
        }
        pathsToMerge.push(meta.filePath);
    }
    try {
        const mergedBuffer = await (0, merger_js_1.mergePDFs)(pathsToMerge);
        // Set download headers
        const outputFilename = filename ? (filename.endsWith('.pdf') ? filename : `${filename}.pdf`) : 'merged.pdf';
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(outputFilename)}"`);
        res.setHeader('Content-Length', mergedBuffer.length);
        return res.send(mergedBuffer);
    }
    catch (err) {
        console.error('Merge error:', err);
        return res.status(500).json({ error: `Merge failed: ${err.message || 'Unknown error'}` });
    }
});
// Route 3: Delete an uploaded file explicitly
router.delete('/files/:id', async (req, res) => {
    const { id } = req.params;
    const meta = fileRegistry.get(id);
    if (!meta) {
        return res.status(404).json({ error: 'File not found or already deleted.' });
    }
    try {
        if ((0, fs_1.existsSync)(meta.filePath)) {
            await fs.unlink(meta.filePath);
        }
        fileRegistry.delete(id);
        return res.json({ success: true, message: 'File deleted successfully.' });
    }
    catch (err) {
        return res.status(500).json({ error: `Failed to delete file: ${err.message}` });
    }
});
// Route 4: Clear all session files for current client
router.post('/clear', async (req, res) => {
    const { fileIds } = req.body;
    if (!Array.isArray(fileIds)) {
        return res.status(400).json({ error: 'Invalid parameters.' });
    }
    const errors = [];
    for (const id of fileIds) {
        const meta = fileRegistry.get(id);
        if (meta) {
            try {
                if ((0, fs_1.existsSync)(meta.filePath)) {
                    await fs.unlink(meta.filePath);
                }
                fileRegistry.delete(id);
            }
            catch (err) {
                errors.push(`Failed to delete file ID ${id}: ${err.message}`);
            }
        }
    }
    if (errors.length > 0) {
        return res.status(207).json({ success: false, errors });
    }
    return res.json({ success: true });
});
exports.default = router;
