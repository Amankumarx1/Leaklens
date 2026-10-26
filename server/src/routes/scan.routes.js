import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import scanController from '../controllers/scanController.js';
import { authenticateToken, requireRole, ROLES } from '../middleware/auth.js';
import { ALLOWED_EXTENSIONS } from '../services/scanner/parsers/parserFactory.js';
import { errorResponse } from '../utils/apiResponse.js';

const router = Router();

// Configure Multer with strict 5MB limit and in-memory storage
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024 // 5 MB maximum
  },
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname || '').toLowerCase();
    if (!ALLOWED_EXTENSIONS.has(ext)) {
      const err = new Error(`Unsupported file extension "${ext}". Allowed: .txt, .json, .csv`);
      err.code = 'UNSUPPORTED_FORMAT';
      err.status = 415;
      return cb(err);
    }
    cb(null, true);
  }
});

// Middleware to safely handle Multer file size limit errors
function handleUploadErrors(err, req, res, next) {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return errorResponse(res, 'File size exceeds maximum permitted limit of 5 MB.', 'FILE_TOO_LARGE', 413);
    }
    return errorResponse(res, `Upload error: ${err.message}`, 'UPLOAD_ERROR', 400);
  } else if (err) {
    const status = err.status || 400;
    return errorResponse(res, err.message, err.code || 'UPLOAD_ERROR', status);
  }
  next();
}

// POST /api/scans — Initiates a scan. Restricted to ADMIN and ANALYST roles.
// Compliance Reviewer is forbidden from uploading.
router.post(
  '/',
  authenticateToken,
  requireRole([ROLES.ADMIN, ROLES.ANALYST]),
  (req, res, next) => {
    upload.single('file')(req, res, (err) => {
      if (err) return handleUploadErrors(err, req, res, next);
      next();
    });
  },
  scanController.initiateScan
);

// GET /api/scans — List permitted scans
router.get('/', authenticateToken, scanController.getScans);

// GET /api/scans/:id — Scan details
router.get('/:id', authenticateToken, scanController.getScanDetails);

// GET /api/scans/:id/findings — Findings for specific scan
router.get('/:id/findings', authenticateToken, scanController.getScanFindingsList);

// POST & DELETE /api/scans/clear — Reset operational scan and finding data (ADMIN role)
router.post('/clear', authenticateToken, requireRole([ROLES.ADMIN]), scanController.clearAllData);
router.delete('/clear', authenticateToken, requireRole([ROLES.ADMIN]), scanController.clearAllData);

export default router;
