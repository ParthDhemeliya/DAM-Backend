import { Router } from 'express'
import multer from 'multer'
import {
  createAsset,
  getAssetById,
  getAllAssets,
  updateAsset,
  deleteAsset,
  getAssetWithSignedUrl,
  uploadAssetFile,
} from '../services/asset.service'
import {
  CreateAssetRequest,
  UpdateAssetRequest,
} from '../interfaces/asset.interface'
import { asyncHandler } from '../middleware/asyncHandler'

const router = Router()

// Configure multer for file uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: parseInt(process.env.MAX_FILE_SIZE || '104857600'), // 100MB default
  },
  fileFilter: (req, file, cb) => {
    // Allow all file types for now, you can add validation here
    cb(null, true)
  },
})

// Get all assets
router.get(
  '/',
  asyncHandler(async (req: any, res: any) => {
    const assets = await getAllAssets()
    res.json({ success: true, data: assets, count: assets.length })
  })
)

// Get asset by ID
router.get('/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id)
    const asset = await getAssetById(id)

    if (!asset) {
      return res.status(404).json({ success: false, error: 'Asset not found' })
    }

    res.json({ success: true, data: asset })
  } catch (error) {
    console.error('Error getting asset by ID:', error)
    res.status(500).json({ success: false, error: 'Failed to get asset' })
  }
})

// Get asset by ID with signed URL for direct access
router.get('/:id/access', async (req, res) => {
  try {
    const id = parseInt(req.params.id)
    const expiresIn = parseInt(req.query.expiresIn as string) || 3600 // Default 1 hour

    const asset = await getAssetWithSignedUrl(id, expiresIn)

    if (!asset) {
      return res.status(404).json({ success: false, error: 'Asset not found' })
    }

    res.json({
      success: true,
      data: asset,
      message: 'Asset access URL generated successfully',
    })
  } catch (error) {
    console.error('Error getting asset with signed URL:', error)
    res
      .status(500)
      .json({ success: false, error: 'Failed to get asset access URL' })
  }
})

// Upload file and create asset
router.post('/upload', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: 'No file provided',
      })
    }

    // Extract metadata from request body
    const metadata = req.body.metadata ? JSON.parse(req.body.metadata) : {}

    // Upload file to MinIO and create asset
    const asset = await uploadAssetFile(req.file, metadata)

    res.status(201).json({
      success: true,
      data: asset,
      message: 'File uploaded and asset created successfully',
    })
  } catch (error) {
    console.error('Error uploading file:', error)

    const errorMessage =
      error instanceof Error ? error.message : 'Unknown error occurred'
    res.status(400).json({
      success: false,
      error: 'Failed to upload file',
      details: errorMessage,
    })
  }
})

// Create new asset (without file upload)
router.post('/', async (req, res) => {
  try {
    const assetData: CreateAssetRequest = req.body
    const asset = await createAsset(assetData)

    res.status(201).json({
      success: true,
      data: asset,
      message: 'Asset created successfully',
    })
  } catch (error) {
    console.error('Error creating asset:', error)

    const errorMessage =
      error instanceof Error ? error.message : 'Unknown error occurred'
    res.status(400).json({
      success: false,
      error: 'Failed to create asset',
      details: errorMessage,
      receivedData: req.body,
    })
  }
})

// Update asset
router.put('/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id)
    const updateData: UpdateAssetRequest = req.body
    const asset = await updateAsset(id, updateData)

    if (!asset) {
      return res.status(404).json({ success: false, error: 'Asset not found' })
    }

    res.json({
      success: true,
      data: asset,
      message: 'Asset updated successfully',
    })
  } catch (error) {
    console.error('Error updating asset:', error)
    res.status(400).json({ success: false, error: 'Failed to update asset' })
  }
})

// Delete asset
router.delete('/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id)
    const deleted = await deleteAsset(id)

    if (!deleted) {
      return res.status(404).json({ success: false, error: 'Asset not found' })
    }

    res.json({ success: true, message: 'Asset deleted successfully' })
  } catch (error) {
    console.error('Error deleting asset:', error)
    res.status(500).json({ success: false, error: 'Failed to delete asset' })
  }
})

export default router
