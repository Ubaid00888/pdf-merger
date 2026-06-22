import { Router, Request, Response, NextFunction } from 'express';
import multer from 'multer';
import * as path from 'path';
import * as fs from 'fs/promises';
import { existsSync } from 'fs';
import crypto from 'crypto';
import { PDFDocument } from 'pdf-lib';
import { mergePDFs } from './merger.js';

const router = Router();

// Store file metadata in-memory (maps fileId -> file path & metadata)
interface FileMetadata {
  id: string;
  filename: string;
  size: number;
  pageCount: number;
  filePath: string;
  createdAt: number;
}

const fileRegistry = new Map<string, FileMetadata>();

// Setup temporary upload directory
const UPLOADS_DIR = path.join(process.cwd(), 'uploads');
fs.mkdir(UPLOADS_DIR, { recursive: true }).catch(console.error);

// Multer storage configuration
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, UPLOADS_DIR);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = crypto.randomUUID();
    cb(null, `${uniqueSuffix}.pdf`);
  }
});

// File validation
const fileFilter = (req: Request, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  const fileExtension = path.extname(file.originalname).toLowerCase();
  if (fileExtension === '.pdf' || file.mimetype === 'application/pdf') {
    cb(null, true);
  } else {
    cb(new Error('Only PDF files are allowed.'));
  }
};

const upload = multer({
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
    if (existsSync(UPLOADS_DIR)) {
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
        } catch (err) {
          console.error(`[Cleanup] Failed to stat/unlink file ${filePath}:`, err);
        }
      }
    }
  } catch (err) {
    console.error('[Cleanup] Failed to scan uploads directory:', err);
  }
}, 5 * 60 * 1000); // Run check every 5 minutes

// Route 1: Upload a single PDF file
router.post('/upload', (req: Request, res: Response, next: NextFunction) => {
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
    const id = crypto.randomUUID();

    try {
      // Validate PDF and get page count using pdf-lib
      const fileBytes = await fs.readFile(filePath);
      const pdfDoc = await PDFDocument.load(fileBytes, { ignoreEncryption: true });
      const pageCount = pdfDoc.getPageCount();

      const metadata: FileMetadata = {
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
    } catch (err: any) {
      // Remove invalid/corrupted file
      try {
        await fs.unlink(filePath);
      } catch (e) {}

      return res.status(400).json({ 
        error: `Invalid or corrupted PDF file: ${filename}. ${err.message || ''}` 
      });
    }
  });
});

// Route 2: Merge multiple PDFs based on an array of file IDs
router.post('/merge', async (req: Request, res: Response) => {
  const { fileIds, filename } = req.body;

  if (!Array.isArray(fileIds) || fileIds.length === 0) {
    return res.status(400).json({ error: 'Invalid file list. Please provide an array of file IDs.' });
  }

  const pathsToMerge: string[] = [];

  for (const id of fileIds) {
    const meta = fileRegistry.get(id);
    if (!meta || !existsSync(meta.filePath)) {
      return res.status(400).json({ error: `File reference not found or expired: ${id}` });
    }
    pathsToMerge.push(meta.filePath);
  }

  try {
    const mergedBuffer = await mergePDFs(pathsToMerge);

    // Set download headers
    const outputFilename = filename ? (filename.endsWith('.pdf') ? filename : `${filename}.pdf`) : 'merged.pdf';
    
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(outputFilename)}"`);
    res.setHeader('Content-Length', mergedBuffer.length);
    
    return res.send(mergedBuffer);
  } catch (err: any) {
    console.error('Merge error:', err);
    return res.status(500).json({ error: `Merge failed: ${err.message || 'Unknown error'}` });
  }
});

// Route 3: Delete an uploaded file explicitly
router.delete('/files/:id', async (req: Request, res: Response) => {
  const { id } = req.params;
  const meta = fileRegistry.get(id);

  if (!meta) {
    return res.status(404).json({ error: 'File not found or already deleted.' });
  }

  try {
    if (existsSync(meta.filePath)) {
      await fs.unlink(meta.filePath);
    }
    fileRegistry.delete(id);
    return res.json({ success: true, message: 'File deleted successfully.' });
  } catch (err: any) {
    return res.status(500).json({ error: `Failed to delete file: ${err.message}` });
  }
});

// Route 4: Clear all session files for current client
router.post('/clear', async (req: Request, res: Response) => {
  const { fileIds } = req.body;
  if (!Array.isArray(fileIds)) {
    return res.status(400).json({ error: 'Invalid parameters.' });
  }

  const errors: string[] = [];
  for (const id of fileIds) {
    const meta = fileRegistry.get(id);
    if (meta) {
      try {
        if (existsSync(meta.filePath)) {
          await fs.unlink(meta.filePath);
        }
        fileRegistry.delete(id);
      } catch (err: any) {
        errors.push(`Failed to delete file ID ${id}: ${err.message}`);
      }
    }
  }

  if (errors.length > 0) {
    return res.status(207).json({ success: false, errors });
  }
  return res.json({ success: true });
});

export default router;
