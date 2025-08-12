import { Router } from 'express';
import { AssetService } from '../services/asset.service';
import { CreateAssetRequest, UpdateAssetRequest } from '../interfaces/asset.interface';

const router = Router();
const assetService = new AssetService();

// GET /api/assets - Get all assets
router.get('/', async (req, res) => {
  try {
    const { limit = 50, offset = 0, status } = req.query;
    const assets = await assetService.getAllAssets(
      parseInt(limit as string),
      parseInt(offset as string),
      status as string
    );
    
    res.json({
      success: true,
      data: assets,
      count: assets.length
    });
  } catch (error) {
    console.error('Error getting assets:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get assets'
    });
  }
});

// GET /api/assets/:id - Get asset by ID
router.get('/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const asset = await assetService.getAssetById(id);
    
    if (!asset) {
      return res.status(404).json({
        success: false,
        error: 'Asset not found'
      });
    }
    
    res.json({
      success: true,
      data: asset
    });
  } catch (error) {
    console.error('Error getting asset:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get asset'
    });
  }
});

// POST /api/assets - Create new asset
router.post('/', async (req, res) => {
  try {
    const assetData: CreateAssetRequest = req.body;
    
    // Basic validation
    if (!assetData.filename || !assetData.original_name || !assetData.file_type || 
        !assetData.mime_type || !assetData.file_size || !assetData.storage_path) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: filename, original_name, file_type, mime_type, file_size, storage_path'
      });
    }
    
    const asset = await assetService.createAsset(assetData);
    
    res.status(201).json({
      success: true,
      data: asset,
      message: 'Asset created successfully'
    });
  } catch (error) {
    console.error('Error creating asset:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create asset'
    });
  }
});

// PUT /api/assets/:id - Update asset
router.put('/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const updateData: UpdateAssetRequest = req.body;
    
    const asset = await assetService.updateAsset(id, updateData);
    
    if (!asset) {
      return res.status(404).json({
        success: false,
        error: 'Asset not found'
      });
    }
    
    res.json({
      success: true,
      data: asset,
      message: 'Asset updated successfully'
    });
  } catch (error) {
    console.error('Error updating asset:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update asset'
    });
  }
});

// DELETE /api/assets/:id - Soft delete asset
router.delete('/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const deleted = await assetService.deleteAsset(id);
    
    if (!deleted) {
      return res.status(404).json({
        success: false,
        error: 'Asset not found'
      });
    }
    
    res.json({
      success: true,
      message: 'Asset deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting asset:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete asset'
    });
  }
});

// GET /api/assets/type/:fileType - Get assets by file type
router.get('/type/:fileType', async (req, res) => {
  try {
    const fileType = req.params.fileType;
    const assets = await assetService.getAssetsByType(fileType);
    
    res.json({
      success: true,
      data: assets,
      count: assets.length
    });
  } catch (error) {
    console.error('Error getting assets by type:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get assets by type'
    });
  }
});

// GET /api/assets/status/:status - Get assets by status
router.get('/status/:status', async (req, res) => {
  try {
    const status = req.params.status;
    const assets = await assetService.getAssetsByStatus(status);
    
    res.json({
      success: true,
      data: assets,
      count: assets.length
    });
  } catch (error) {
    console.error('Error getting assets by status:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get assets by status'
    });
  }
});

export default router;
