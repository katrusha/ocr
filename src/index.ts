import express from 'express';
import multer from 'multer';
import cors from 'cors';
import path from 'path';
import { OCRProcessor } from './processors/ocrProcessor';
import { FileValidator } from './utils/fileValidator';
import { OCRResult, OCRError } from './types';

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '../public')));

// Configure multer for file uploads
const storage = multer.memoryStorage();
const upload = multer({ 
  storage,
  limits: {
    fileSize: FileValidator.getMaxFileSize()
  }
});

// Routes

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// Get supported file types and languages
app.get('/api/info', (req, res) => {
  res.json({
    supportedTypes: OCRProcessor.getSupportedTypes(),
    supportedLanguages: OCRProcessor.getSupportedLanguages(),
    maxFileSize: `${FileValidator.getMaxFileSize() / (1024 * 1024)}MB`
  });
});

// Main OCR endpoint
app.post('/api/ocr', upload.single('file'), async (req, res) => {
  try {
    const file = req.file;
    const language = req.body.language || 'eng';

    // Check if file exists
    if (!file) {
      const error: OCRError = {
        error: 'Validation Error',
        message: 'No file provided'
      };
      return res.status(400).json(error);
    }

    // Validate file
    const validation = FileValidator.validateFile(file);
    if (!validation.isValid) {
      const error: OCRError = {
        error: 'Validation Error',
        message: validation.error!
      };
      return res.status(400).json(error);
    }

    console.log(`Processing file: ${validation.fileInfo!.originalName} (${validation.fileInfo!.mimeType})`);

    // Process file
    const result: OCRResult = await OCRProcessor.processFile(
      file!.buffer,
      file!.mimetype,
      language
    );

    console.log(`OCR completed in ${result.processingTime}ms`);

    res.json({
      success: true,
      data: result,
      fileInfo: validation.fileInfo
    });

  } catch (error) {
    console.error('OCR processing error:', error);
    
    const errorResponse: OCRError = {
      error: 'Processing Error',
      message: error instanceof Error ? error.message : 'Unknown error occurred'
    };
    
    res.status(500).json(errorResponse);
  }
});

// Serve the web interface
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/index.html'));
});

// Error handling middleware
app.use((error: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Unhandled error:', error);
  
  const errorResponse: OCRError = {
    error: 'Internal Server Error',
    message: 'An unexpected error occurred'
  };
  
  res.status(500).json(errorResponse);
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    error: 'Not Found',
    message: 'The requested endpoint does not exist'
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 OCR API Server running on http://localhost:${PORT}`);
  console.log(`📄 Web interface available at http://localhost:${PORT}`);
  console.log(`🔗 API endpoint: http://localhost:${PORT}/api/ocr`);
  console.log(`ℹ️  API info: http://localhost:${PORT}/api/info`);
});

export default app;
