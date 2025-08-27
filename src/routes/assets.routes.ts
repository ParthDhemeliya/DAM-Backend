import { Router } from 'express';
import multer from 'multer';
import { AssetController } from '../controllers/asset.controller';
import { AssetSearchController } from '../controllers/asset-search.controller';
import { AssetFileController } from '../controllers/asset-file.controller';

const router = Router();
const assetController = new AssetController();
const assetSearchController = new AssetSearchController();
const assetFileController = new AssetFileController();

// Configure multer for file uploads
const bucket = process.env.MINIO_BUCKET || 'dam-media';
const upload = multer({ dest: '/tmp/uploads' });

// Get all assets with pagination and filters
router.get('/', assetController.getAllAssets);

// Search assets by keyword
router.get('/search', assetSearchController.searchAssets);

// Get assets by IDs with signed URLs (batch access)
router.post('/batch-access', assetSearchController.getBatchAssets);

// Get asset by ID
router.get('/:id', assetController.getAssetById);

// Get asset by ID with signed URL for direct access
router.get('/:id/access', assetSearchController.getAssetAccess);

// Upload asset file
router.post('/upload', upload.single('file'), assetController.uploadAsset);

// Update asset
router.put('/:id', assetController.updateAsset);

// Delete asset
router.delete('/:id', assetController.deleteAsset);

// Download asset
router.get('/:id/download', assetFileController.downloadAsset);

// Stream asset (for preview/playback)
router.get('/:id/stream', assetFileController.streamAsset);

// Test upload endpoint for debugging
router.post('/test-upload', upload.single('file'), async (req, res) => {
  try {
    const file = req.file;
    if (!file) {
      return res
        .status(400)
        .json({ success: false, error: 'No file provided' });
    }

    console.log('Test upload received:', {
      originalname: file.originalname,
      size: file.size,
      mimetype: file.mimetype,
      buffer: file.buffer ? 'Buffer exists' : 'No buffer',
    });

    res.json({
      success: true,
      message: 'Test upload successful',
      file: {
        originalname: file.originalname,
        size: file.size,
        mimetype: file.mimetype,
        hasBuffer: !!file.buffer,
      },
    });
  } catch (error) {
    console.error('Test upload failed:', error);
    res.status(500).json({
      success: false,
      error: 'Test upload failed',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

export default router;
