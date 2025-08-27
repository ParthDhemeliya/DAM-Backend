import { Request, Response } from 'express';
import { asyncHandler } from '../middleware/asyncHandler';
import { searchAssets, getAssetsWithFilters } from '../services/asset.service';

export class AssetSearchController {
  // Search assets by query
  searchAssets = asyncHandler(async (req: Request, res: Response) => {
    try {
      const query = req.query.q as string;
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 10;
      const fileType = req.query.fileType as string;
      const status = req.query.status as string;
      const sortBy = (req.query.sortBy as string) || 'relevance';
      const sortOrder = (req.query.sortOrder as string) || 'desc';

      if (!query) {
        return res.status(400).json({
          success: false,
          error: 'Missing search query',
          message: 'Search query parameter "q" is required',
        });
      }

      const filters = {
        query,
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
        query,
        message: `Found ${result.assets.length} assets matching "${query}"`,
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: 'Search failed',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  });

  // Get batch assets by IDs
  getBatchAssets = asyncHandler(async (req: Request, res: Response) => {
    try {
      const { assetIds } = req.body;

      if (!assetIds || !Array.isArray(assetIds) || assetIds.length === 0) {
        return res.status(400).json({
          success: false,
          error: 'Invalid asset IDs',
          message: 'assetIds array is required and must not be empty',
        });
      }

      if (assetIds.length > 100) {
        return res.status(400).json({
          success: false,
          error: 'Too many asset IDs',
          message: 'Maximum 100 asset IDs allowed per request',
        });
      }

      const filters = {
        page: 1,
        limit: assetIds.length,
        assetIds,
        sortBy: 'id',
        sortOrder: 'asc',
      };

      const result = await getAssetsWithFilters(filters);

      res.json({
        success: true,
        data: result.assets,
        count: result.assets.length,
        requested: assetIds.length,
        message: `Retrieved ${result.assets.length} assets`,
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: 'Failed to retrieve batch assets',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  });

  // Get asset access information
  getAssetAccess = asyncHandler(async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);

      // This would typically check user permissions and return access info
      // For now, return basic asset info
      const filters = {
        page: 1,
        limit: 1,
        assetIds: [id],
      };

      const result = await getAssetsWithFilters(filters);
      const asset = result.assets[0];

      if (!asset) {
        return res.status(404).json({
          success: false,
          error: 'Asset not found',
          message: `Asset with ID ${id} not found`,
        });
      }

      const accessInfo = {
        assetId: id,
        canView: true,
        canDownload: true,
        canEdit: false,
        canDelete: false,
        permissions: ['view', 'download'],
        restrictions: [],
        expiresAt: null,
      };

      res.json({
        success: true,
        data: {
          asset,
          access: accessInfo,
        },
        message: 'Asset access information retrieved successfully',
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: 'Failed to retrieve asset access information',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  });
}
