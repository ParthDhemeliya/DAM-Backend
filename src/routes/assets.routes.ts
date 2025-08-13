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

const router = Router()

// Get all assets
router.get('/', async (req, res) => {
  try {
    const assets = await getAllAssets()
    res.json({ success: true, data: assets, count: assets.length })
  } catch (error) {
    console.error('Error getting all assets:', error)
    res.status(500).json({ success: false, error: 'Failed to get assets' })
  }
})

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
    const assetData: CreateAssetRequest = req.body
    const asset = await createAsset(assetData)
    res.status(201).json({
      success: true,
      data: asset,
      message: 'Asset created successfully',
    })
  } catch (error) {
    console.error('Error creating asset:', error)
    res.status(400).json({ success: false, error: 'Failed to create asset' })
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

// Delete asset (soft delete)
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
