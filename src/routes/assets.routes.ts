import { Router } from 'express'
import {
  createAsset,
  getAssetById,
  getAllAssets,
  updateAsset,
  deleteAsset,
} from '../services/asset.service'
import {
  CreateAssetRequest,
  UpdateAssetRequest,
} from '../interfaces/asset.interface'
import { asyncHandler } from '../middleware/asyncHandler'
import { IRequest } from 'minio/dist/main/internal/type'

const router = Router()

// Get all assets
router.get(
  '/',
  asyncHandler(async (req: any, res: any) => {
    const assets = await getAllAssets()
    res.json({ success: true, data: assets, count: assets.length })
  })
)

//  Get asset by ID
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

// Create new asset
router.post('/', async (req, res) => {
  try {
    console.log('=== ASSET CREATION REQUEST START ===')
    console.log('Request headers:', req.headers)
    console.log('Request body:', req.body)
    console.log('Request body type:', typeof req.body)
    console.log('Request body keys:', Object.keys(req.body || {}))

    const assetData: CreateAssetRequest = req.body
    console.log('Parsed asset data:', assetData)
    console.log('Asset data validation starting...')

    const asset = await createAsset(assetData)
    console.log('Asset created successfully:', asset)

    res.status(201).json({
      success: true,
      data: asset,
      message: 'Asset created successfully',
    })
  } catch (error) {
    console.error('=== ASSET CREATION ERROR ===')
    console.error('Error type:', typeof error)
    console.error('Error constructor:', error?.constructor?.name)

    // Use type guards to safely access error properties
    if (error && typeof error === 'object' && 'message' in error) {
      console.error('Error message:', (error as any).message)
    }
    if (error && typeof error === 'object' && 'stack' in error) {
      console.error('Error stack:', (error as any).stack)
    }
    console.error('Full error object:', error)

    // Return the actual error message for debugging
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
