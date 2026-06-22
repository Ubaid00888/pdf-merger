import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import apiRouter from './routes.js';
import * as path from 'path';
import * as fs from 'fs/promises';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// Middlewares
app.use(cors({
  origin: '*', // Allow all origins in development or docker, can be customized via env
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  exposedHeaders: ['Content-Disposition']
}));

// Configure body-parser limits for large requests (metadata passing)
app.use(express.json({ limit: '100mb' }));
app.use(express.urlencoded({ limit: '100mb', extended: true }));

// Request Logger
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
  next();
});

// Health Check Endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Bind API Routes
app.use('/api', apiRouter);

// Global Error Handler
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Unhandled server error:', err);
  res.status(500).json({ 
    error: err.message || 'An internal server error occurred.' 
  });
});

// Start server
async function startServer() {
  const uploadsDir = path.join(process.cwd(), 'uploads');
  await fs.mkdir(uploadsDir, { recursive: true });
  
  app.listen(PORT, () => {
    console.log(`[Server] Running on http://localhost:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Fatal error starting Express server:', err);
  process.exit(1);
});
