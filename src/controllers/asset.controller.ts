import { Request, Response } from 'express';
import { asyncHandler } from '../middleware/asyncHandler';
import {
  getAssetById,
  getAllAssets,
  createAsset,
  updateAsset,
  deleteAsset,
} from '../services/asset.service';
import { createJob } from '../services/job.service';
import { searchAssets } from '../services/asset.service';
import { checkForDuplicates } from '../services/duplicate.service';

export class AssetController {
  // Get all assets with pagination and filters
  getAllAssets = asyncHandler(async (req: Request, res: Response) => {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 10;
      const fileType = req.query.fileType as string;
      const status = req.query.status as string;
      const dateFrom = req.query.dateFrom as string;
      const dateTo = req.query.dateTo as string;
      const tags = req.query.tags as string;
      const category = req.query.category as string;
      const author = req.query.author as string;
      const department = req.query.department as string;
      const project = req.query.project as string;
      const sortBy = (req.query.sortBy as string) || 'created_at';
      const sortOrder = (req.query.sortOrder as string) || 'desc';

      const filters = {
        query: '', // Default empty query for all assets
        page,
        limit,
        fileType,
        status,
        sortBy,
        sortOrder,
      };

      const result = await searchAssets(filters);

      res.json({
        success: true,
        data: result.assets,
        pagination: result.pagination,
        message: 'Assets retrieved successfully',
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: 'Failed to retrieve assets',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  });

  // Get asset by ID
  getAssetById = asyncHandler(async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      const asset = await getAssetById(id);

      if (!asset) {
        return res.status(404).json({
          success: false,
          error: 'Asset not found',
          message: `Asset with ID ${id} not found`,
        });
      }

      res.json({
        success: true,
        data: asset,
        message: 'Asset retrieved successfully',
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: 'Failed to retrieve asset',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  });

  // Create new asset
  createAsset = asyncHandler(async (req: Request, res: Response) => {
    try {
      const assetData = req.body;
      const asset = await createAsset(assetData);

      // Queue processing jobs for the new asset
      const assets = [asset];
      const assetIds = assets.map((asset: any) => asset.id);

      // Add processing jobs to queue
      await createJob({
        job_type: 'asset_processing',
        asset_id: asset.id!,
        status: 'pending',
        priority: 1,
        input_data: { assetIds, operations: ['thumbnail', 'metadata'] },
      });

      res.status(201).json({
        success: true,
        data: asset,
        message: 'Asset created successfully',
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: 'Failed to create asset',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  });

  // Update asset
  updateAsset = asyncHandler(async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      const assetData = req.body;
      const asset = await updateAsset(id, assetData);

      if (!asset) {
        return res.status(404).json({
          success: false,
          error: 'Asset not found',
          message: `Asset with ID ${id} not found`,
        });
      }

      res.json({
        success: true,
        data: asset,
        message: 'Asset updated successfully',
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: 'Failed to update asset',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  });

  // Delete asset
  deleteAsset = asyncHandler(async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      const success = await deleteAsset(id);

      if (!success) {
        return res.status(404).json({
          success: false,
          error: 'Asset not found',
          message: `Asset with ID ${id} not found`,
        });
      }

      res.json({
        success: true,
        message: 'Asset deleted successfully',
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: 'Failed to delete asset',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  });

  // Upload asset file
  uploadAsset = asyncHandler(async (req: Request, res: Response) => {
    try {
      if (!req.file) {
        return res.status(400).json({
          success: false,
          error: 'No file uploaded',
          message: 'Please upload a file',
        });
      }

      const file = req.file;
      const assetData = {
        filename: file.originalname,
        original_name: file.originalname,
        mime_type: file.mimetype,
        file_size: file.size,
        file_type: file.mimetype.split('/')[0] as any, // Will be validated by service
        storage_path: file.path,
        metadata: {
          custom: {
            uploaded_by: req.body.uploaded_by || 'system',
            upload_method: 'direct',
            original_filename: file.originalname,
          },
        },
      };

      // Check for duplicates
      const duplicates = await checkForDuplicates(
        file.originalname,
        file.buffer,
        file.originalname
      );
      if (duplicates.isDuplicate) {
        return res.status(409).json({
          success: false,
          error: 'Duplicate file detected',
          message: 'A file with the same name and content already exists',
          duplicates,
        });
      }

      const asset = await createAsset(assetData);

      res.status(201).json({
        success: true,
        data: asset,
        message: 'Asset uploaded successfully',
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: 'Failed to upload asset',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  });
}
